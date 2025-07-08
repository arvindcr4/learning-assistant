/**
 * Disaster Recovery Orchestrator for Learning Assistant
 * Handles automated failover, recovery procedures, and RTO/RPO management
 */

import { EventEmitter } from 'events';
import { BackupService, BackupMetadata } from './backup-service';
import { promises as fs } from 'fs';
import { join } from 'path';

interface DisasterRecoveryConfig {
  primarySite: {
    id: string;
    name: string;
    region: string;
    endpoints: {
      database: string;
      application: string;
      monitoring: string;
    };
    priority: number;
  };
  secondarySites: Array<{
    id: string;
    name: string;
    region: string;
    endpoints: {
      database: string;
      application: string;
      monitoring: string;
    };
    priority: number;
    autoFailover: boolean;
    syncType: 'synchronous' | 'asynchronous';
  }>;
  objectives: {
    rto: number; // Recovery Time Objective in minutes
    rpo: number; // Recovery Point Objective in minutes
    maxDataLoss: number; // Maximum acceptable data loss in minutes
  };
  monitoring: {
    healthCheckInterval: number;
    failureThreshold: number;
    recoveryThreshold: number;
    alerting: {
      email: string[];
      webhook: string[];
      pagerDuty?: string;
    };
  };
  procedures: {
    preFailoverChecks: string[];
    postFailoverTasks: string[];
    rollbackProcedures: string[];
    dataValidationSteps: string[];
  };
  automation: {
    enableAutoFailover: boolean;
    enableAutoRecovery: boolean;
    requireApproval: boolean;
    approvalTimeout: number;
  };
}

interface Site {
  id: string;
  name: string;
  region: string;
  status: 'healthy' | 'degraded' | 'failed' | 'maintenance';
  lastHealthCheck: Date;
  responseTime: number;
  uptime: number;
  activeConnections: number;
  lag?: number; // For secondary sites
}

interface FailoverEvent {
  id: string;
  timestamp: Date;
  trigger: 'manual' | 'automatic' | 'scheduled';
  reason: string;
  fromSite: string;
  toSite: string;
  status: 'initiated' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  rto: number; // Actual recovery time
  rpo: number; // Actual recovery point
  dataLoss: number; // Actual data loss in minutes
  steps: FailoverStep[];
  approvals?: Approval[];
}

interface FailoverStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  output?: string;
  error?: string;
}

interface Approval {
  id: string;
  timestamp: Date;
  approver: string;
  action: 'approved' | 'rejected' | 'timeout';
  reason?: string;
}

interface RecoveryPlan {
  id: string;
  name: string;
  type: 'full_site_failover' | 'database_failover' | 'application_failover' | 'rollback';
  targetSite: string;
  estimatedRTO: number;
  estimatedRPO: number;
  steps: RecoveryStep[];
  prerequisites: string[];
  postValidation: string[];
}

interface RecoveryStep {
  id: string;
  name: string;
  type: 'backup_restore' | 'dns_update' | 'service_start' | 'data_sync' | 'validation' | 'custom';
  command?: string;
  parameters?: Record<string, any>;
  timeout: number;
  retries: number;
  rollbackCommand?: string;
  dependencies: string[];
}

export class DisasterRecoveryOrchestrator extends EventEmitter {
  private config: DisasterRecoveryConfig;
  private backupService: BackupService;
  private sites: Map<string, Site> = new Map();
  private failoverHistory: FailoverEvent[] = [];
  private recoveryPlans: Map<string, RecoveryPlan> = new Map();
  private activeFailover?: FailoverEvent;
  private healthCheckInterval?: NodeJS.Timeout;
  private currentPrimarySite: string;

  constructor(config: DisasterRecoveryConfig, backupService: BackupService) {
    super();
    this.config = config;
    this.backupService = backupService;
    this.currentPrimarySite = config.primarySite.id;
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    try {
      // Initialize site status tracking
      this.initializeSites();

      // Load recovery plans
      await this.loadRecoveryPlans();

      // Load failover history
      await this.loadFailoverHistory();

      // Start continuous monitoring
      this.startMonitoring();

      // Initialize predefined recovery plans
      await this.initializeDefaultRecoveryPlans();

      this.emit('dr:service-initialized');
    } catch (error) {
      this.emit('dr:initialization-failed', error);
      throw error;
    }
  }

  private initializeSites(): void {
    // Initialize primary site
    this.sites.set(this.config.primarySite.id, {
      id: this.config.primarySite.id,
      name: this.config.primarySite.name,
      region: this.config.primarySite.region,
      status: 'healthy',
      lastHealthCheck: new Date(),
      responseTime: 0,
      uptime: 100,
      activeConnections: 0,
    });

    // Initialize secondary sites
    this.config.secondarySites.forEach(site => {
      this.sites.set(site.id, {
        id: site.id,
        name: site.name,
        region: site.region,
        status: 'healthy',
        lastHealthCheck: new Date(),
        responseTime: 0,
        uptime: 100,
        activeConnections: 0,
        lag: 0,
      });
    });
  }

  private async loadRecoveryPlans(): Promise<void> {
    try {
      const plansPath = join(process.cwd(), 'data', 'recovery-plans.json');
      const data = await fs.readFile(plansPath, 'utf8');
      const plans = JSON.parse(data);
      
      plans.forEach((plan: RecoveryPlan) => {
        this.recoveryPlans.set(plan.id, plan);
      });
    } catch (error) {
      // Initialize with empty plans if file doesn't exist
    }
  }

  private async saveRecoveryPlans(): Promise<void> {
    try {
      const plansPath = join(process.cwd(), 'data', 'recovery-plans.json');
      await fs.mkdir(join(process.cwd(), 'data'), { recursive: true });
      
      const plans = Array.from(this.recoveryPlans.values());
      await fs.writeFile(plansPath, JSON.stringify(plans, null, 2));
    } catch (error) {
      this.emit('dr:save-plans-failed', error);
    }
  }

  private async loadFailoverHistory(): Promise<void> {
    try {
      const historyPath = join(process.cwd(), 'data', 'failover-history.json');
      const data = await fs.readFile(historyPath, 'utf8');
      this.failoverHistory = JSON.parse(data);
    } catch (error) {
      this.failoverHistory = [];
    }
  }

  private async saveFailoverHistory(): Promise<void> {
    try {
      const historyPath = join(process.cwd(), 'data', 'failover-history.json');
      await fs.mkdir(join(process.cwd(), 'data'), { recursive: true });
      await fs.writeFile(historyPath, JSON.stringify(this.failoverHistory, null, 2));
    } catch (error) {
      this.emit('dr:save-history-failed', error);
    }
  }

  private startMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.monitoring.healthCheckInterval);
  }

  private async performHealthChecks(): Promise<void> {
    const healthPromises = Array.from(this.sites.keys()).map(siteId => 
      this.checkSiteHealth(siteId)
    );

    await Promise.allSettled(healthPromises);

    // Evaluate failover conditions
    await this.evaluateFailoverConditions();
  }

  private async checkSiteHealth(siteId: string): Promise<void> {
    const site = this.sites.get(siteId)!;
    const siteConfig = siteId === this.config.primarySite.id 
      ? this.config.primarySite 
      : this.config.secondarySites.find(s => s.id === siteId)!;

    try {
      const startTime = Date.now();

      // Check database connectivity
      const dbHealthy = await this.checkDatabaseHealth(siteConfig.endpoints.database);
      
      // Check application health
      const appHealthy = await this.checkApplicationHealth(siteConfig.endpoints.application);
      
      // Check monitoring endpoint
      const monitoringHealthy = await this.checkMonitoringHealth(siteConfig.endpoints.monitoring);

      const responseTime = Date.now() - startTime;

      // Update site status
      const wasHealthy = site.status === 'healthy';
      if (dbHealthy && appHealthy && monitoringHealthy) {
        site.status = 'healthy';
        site.uptime = Math.min(100, site.uptime + 0.1);
      } else if (dbHealthy || appHealthy) {
        site.status = 'degraded';
        site.uptime = Math.max(0, site.uptime - 1);
      } else {
        site.status = 'failed';
        site.uptime = Math.max(0, site.uptime - 5);
      }

      site.lastHealthCheck = new Date();
      site.responseTime = responseTime;

      // Get additional metrics for secondary sites
      if (siteId !== this.config.primarySite.id) {
        site.lag = await this.getReplicationLag(siteConfig.endpoints.database);
      }

      // Emit health change events
      if (wasHealthy && site.status !== 'healthy') {
        this.emit('site:health-degraded', { siteId, site });
      } else if (!wasHealthy && site.status === 'healthy') {
        this.emit('site:health-recovered', { siteId, site });
      }

    } catch (error) {
      site.status = 'failed';
      site.lastHealthCheck = new Date();
      site.uptime = Math.max(0, site.uptime - 10);
      
      this.emit('site:health-check-failed', { siteId, error });
    }
  }

  private async checkDatabaseHealth(endpoint: string): Promise<boolean> {
    try {
      const { Client } = require('pg');
      const client = new Client({ connectionString: endpoint });
      
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkApplicationHealth(endpoint: string): Promise<boolean> {
    try {
      const response = await fetch(`${endpoint}/health`, { 
        method: 'GET',
        timeout: 5000 
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  private async checkMonitoringHealth(endpoint: string): Promise<boolean> {
    try {
      const response = await fetch(`${endpoint}/health`, { 
        method: 'GET',
        timeout: 5000 
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  private async getReplicationLag(dbEndpoint: string): Promise<number> {
    try {
      const { Client } = require('pg');
      const client = new Client({ connectionString: dbEndpoint });
      
      await client.connect();
      const result = await client.query('SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))::INT AS lag_seconds');
      await client.end();
      
      return result.rows[0]?.lag_seconds || 0;
    } catch (error) {
      return -1; // Unknown lag
    }
  }

  private async evaluateFailoverConditions(): Promise<void> {
    if (this.activeFailover) {
      return; // Already in failover process
    }

    const primarySite = this.sites.get(this.currentPrimarySite);
    if (!primarySite) {
      return;
    }

    // Check if primary site is failing
    const isFailoverNeeded = this.shouldTriggerFailover(primarySite);
    
    if (isFailoverNeeded && this.config.automation.enableAutoFailover) {
      const targetSite = await this.selectBestFailoverTarget();
      
      if (targetSite) {
        await this.initiateFailover({
          trigger: 'automatic',
          reason: `Primary site ${primarySite.name} health degraded`,
          targetSite: targetSite.id,
        });
      }
    }
  }

  private shouldTriggerFailover(primarySite: Site): boolean {
    // Check multiple criteria for failover decision
    const criteria = [
      primarySite.status === 'failed',
      primarySite.uptime < this.config.monitoring.failureThreshold,
      primarySite.responseTime > 30000, // 30 second response time
    ];

    // Require at least 2 criteria to be met for automatic failover
    const failedCriteria = criteria.filter(Boolean).length;
    return failedCriteria >= 2;
  }

  private async selectBestFailoverTarget(): Promise<Site | null> {
    const availableSites = this.config.secondarySites
      .map(siteConfig => ({
        config: siteConfig,
        site: this.sites.get(siteConfig.id)!
      }))
      .filter(({ site, config }) => 
        site.status === 'healthy' && 
        config.autoFailover &&
        (site.lag || 0) < this.config.objectives.rpo
      )
      .sort((a, b) => {
        // Sort by priority first, then by lag
        if (a.config.priority !== b.config.priority) {
          return a.config.priority - b.config.priority;
        }
        return (a.site.lag || 0) - (b.site.lag || 0);
      });

    return availableSites.length > 0 ? availableSites[0].site : null;
  }

  /**
   * Initiate a failover process
   */
  public async initiateFailover(options: {
    trigger: 'manual' | 'automatic' | 'scheduled';
    reason: string;
    targetSite: string;
    planId?: string;
    approver?: string;
  }): Promise<string> {
    if (this.activeFailover) {
      throw new Error('Failover already in progress');
    }

    const targetSite = this.sites.get(options.targetSite);
    if (!targetSite) {
      throw new Error(`Target site not found: ${options.targetSite}`);
    }

    if (targetSite.status !== 'healthy') {
      throw new Error(`Target site is not healthy: ${targetSite.status}`);
    }

    const failoverEvent: FailoverEvent = {
      id: `failover-${Date.now()}`,
      timestamp: new Date(),
      trigger: options.trigger,
      reason: options.reason,
      fromSite: this.currentPrimarySite,
      toSite: options.targetSite,
      status: 'initiated',
      rto: 0,
      rpo: 0,
      dataLoss: 0,
      steps: [],
      approvals: options.approver ? [{
        id: `approval-${Date.now()}`,
        timestamp: new Date(),
        approver: options.approver,
        action: 'approved',
      }] : [],
    };

    this.activeFailover = failoverEvent;
    this.emit('failover:initiated', failoverEvent);

    try {
      // Check if approval is required
      if (this.config.automation.requireApproval && options.trigger !== 'manual') {
        const approved = await this.requestApproval(failoverEvent);
        if (!approved) {
          failoverEvent.status = 'failed';
          failoverEvent.approvals?.push({
            id: `approval-timeout-${Date.now()}`,
            timestamp: new Date(),
            approver: 'system',
            action: 'timeout',
            reason: 'Approval timeout reached',
          });
          throw new Error('Failover approval timeout or rejection');
        }
      }

      // Execute failover plan
      const planId = options.planId || 'default-failover';
      const plan = this.recoveryPlans.get(planId);
      
      if (!plan) {
        throw new Error(`Recovery plan not found: ${planId}`);
      }

      await this.executeRecoveryPlan(failoverEvent, plan);

      // Update current primary site
      this.currentPrimarySite = options.targetSite;
      
      failoverEvent.status = 'completed';
      failoverEvent.rto = Date.now() - failoverEvent.timestamp.getTime();
      
      this.emit('failover:completed', failoverEvent);

    } catch (error) {
      failoverEvent.status = 'failed';
      this.emit('failover:failed', { failoverEvent, error });
      throw error;
    } finally {
      this.failoverHistory.push(failoverEvent);
      await this.saveFailoverHistory();
      this.activeFailover = undefined;
    }

    return failoverEvent.id;
  }

  private async requestApproval(failoverEvent: FailoverEvent): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, this.config.automation.approvalTimeout);

      // Send approval notifications
      this.sendApprovalNotifications(failoverEvent);

      // Listen for approval response
      const approvalHandler = (approval: Approval) => {
        if (approval.action === 'approved') {
          clearTimeout(timeout);
          failoverEvent.approvals?.push(approval);
          resolve(true);
        } else if (approval.action === 'rejected') {
          clearTimeout(timeout);
          failoverEvent.approvals?.push(approval);
          resolve(false);
        }
      };

      this.once('approval:response', approvalHandler);
    });
  }

  private sendApprovalNotifications(failoverEvent: FailoverEvent): void {
    const message = {
      subject: `URGENT: Disaster Recovery Failover Approval Required`,
      body: `
        Failover Event ID: ${failoverEvent.id}
        Trigger: ${failoverEvent.trigger}
        Reason: ${failoverEvent.reason}
        From Site: ${failoverEvent.fromSite}
        To Site: ${failoverEvent.toSite}
        Timestamp: ${failoverEvent.timestamp.toISOString()}
        
        Please approve or reject this failover within ${this.config.automation.approvalTimeout / 1000} seconds.
      `,
    };

    // Send email notifications
    this.config.monitoring.alerting.email.forEach(email => {
      this.sendEmailNotification(email, message);
    });

    // Send webhook notifications
    this.config.monitoring.alerting.webhook.forEach(webhook => {
      this.sendWebhookNotification(webhook, { ...message, failoverEvent });
    });

    // Send PagerDuty alert
    if (this.config.monitoring.alerting.pagerDuty) {
      this.sendPagerDutyAlert(message, failoverEvent);
    }
  }

  private async sendEmailNotification(email: string, message: any): Promise<void> {
    // Implementation would integrate with email service
    this.emit('notification:email-sent', { email, message });
  }

  private async sendWebhookNotification(webhook: string, payload: any): Promise<void> {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      this.emit('notification:webhook-sent', { webhook, payload });
    } catch (error) {
      this.emit('notification:webhook-failed', { webhook, error });
    }
  }

  private async sendPagerDutyAlert(message: any, failoverEvent: FailoverEvent): Promise<void> {
    const payload = {
      routing_key: this.config.monitoring.alerting.pagerDuty,
      event_action: 'trigger',
      payload: {
        summary: message.subject,
        source: 'disaster-recovery-orchestrator',
        severity: 'critical',
        custom_details: {
          failover_id: failoverEvent.id,
          trigger: failoverEvent.trigger,
          reason: failoverEvent.reason,
          from_site: failoverEvent.fromSite,
          to_site: failoverEvent.toSite,
        },
      },
    };

    try {
      await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      this.emit('notification:pagerduty-sent', payload);
    } catch (error) {
      this.emit('notification:pagerduty-failed', error);
    }
  }

  private async executeRecoveryPlan(failoverEvent: FailoverEvent, plan: RecoveryPlan): Promise<void> {
    failoverEvent.status = 'in_progress';
    this.emit('failover:progress', failoverEvent);

    // Execute each step in the recovery plan
    for (const step of plan.steps) {
      const failoverStep: FailoverStep = {
        id: step.id,
        name: step.name,
        description: step.name,
        status: 'pending',
      };

      failoverEvent.steps.push(failoverStep);

      try {
        failoverStep.status = 'running';
        failoverStep.startTime = new Date();
        this.emit('failover:step-started', { failoverEvent, step: failoverStep });

        await this.executeRecoveryStep(step, failoverEvent);

        failoverStep.status = 'completed';
        failoverStep.endTime = new Date();
        failoverStep.duration = failoverStep.endTime.getTime() - failoverStep.startTime.getTime();
        
        this.emit('failover:step-completed', { failoverEvent, step: failoverStep });

      } catch (error) {
        failoverStep.status = 'failed';
        failoverStep.error = error.message;
        failoverStep.endTime = new Date();
        
        this.emit('failover:step-failed', { failoverEvent, step: failoverStep, error });

        // Execute rollback if step fails
        if (step.rollbackCommand) {
          await this.executeRollbackStep(step, failoverEvent);
        }

        throw error;
      }
    }
  }

  private async executeRecoveryStep(step: RecoveryStep, failoverEvent: FailoverEvent): Promise<void> {
    switch (step.type) {
      case 'backup_restore':
        await this.executeBackupRestore(step, failoverEvent);
        break;
      case 'dns_update':
        await this.executeDnsUpdate(step, failoverEvent);
        break;
      case 'service_start':
        await this.executeServiceStart(step, failoverEvent);
        break;
      case 'data_sync':
        await this.executeDataSync(step, failoverEvent);
        break;
      case 'validation':
        await this.executeValidation(step, failoverEvent);
        break;
      case 'custom':
        await this.executeCustomStep(step, failoverEvent);
        break;
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  private async executeBackupRestore(step: RecoveryStep, failoverEvent: FailoverEvent): Promise<void> {
    const { backupId, targetDatabase } = step.parameters || {};
    
    if (!backupId) {
      // Find the latest backup
      const backups = this.backupService.listBackups({ 
        type: 'full',
        status: 'success' 
      });
      
      if (backups.length === 0) {
        throw new Error('No available backups for restore');
      }
      
      const latestBackup = backups[0];
      await this.backupService.restoreFromBackup(latestBackup.id, {
        backupId: latestBackup.id,
        targetLocation: targetDatabase,
      });
    } else {
      await this.backupService.restoreFromBackup(backupId, {
        backupId,
        targetLocation: targetDatabase,
      });
    }
  }

  private async executeDnsUpdate(step: RecoveryStep, failoverEvent: FailoverEvent): Promise<void> {
    // DNS update implementation would integrate with DNS provider API
    const { recordName, newValue, recordType = 'A' } = step.parameters || {};
    
    // Simulate DNS update
    this.emit('dns:update-requested', { 
      recordName, 
      newValue, 
      recordType,
      failoverEvent: failoverEvent.id 
    });
  }

  private async executeServiceStart(step: RecoveryStep, failoverEvent: FailoverEvent): Promise<void> {
    const { serviceName, targetSite } = step.parameters || {};
    
    if (step.command) {
      await this.executeCommand(step.command, step.timeout);
    }
    
    this.emit('service:start-requested', { 
      serviceName, 
      targetSite,
      failoverEvent: failoverEvent.id 
    });
  }

  private async executeDataSync(step: RecoveryStep, failoverEvent: FailoverEvent): Promise<void> {
    const { sourceEndpoint, targetEndpoint, syncType } = step.parameters || {};
    
    this.emit('data:sync-requested', { 
      sourceEndpoint, 
      targetEndpoint, 
      syncType,
      failoverEvent: failoverEvent.id 
    });
  }

  private async executeValidation(step: RecoveryStep, failoverEvent: FailoverEvent): Promise<void> {
    const { validationType, endpoint, expectedResult } = step.parameters || {};
    
    // Perform validation based on type
    switch (validationType) {
      case 'health_check':
        const isHealthy = await this.checkApplicationHealth(endpoint);
        if (!isHealthy) {
          throw new Error(`Health check failed for ${endpoint}`);
        }
        break;
      case 'data_integrity':
        // Implement data integrity check
        break;
      default:
        throw new Error(`Unknown validation type: ${validationType}`);
    }
  }

  private async executeCustomStep(step: RecoveryStep, failoverEvent: FailoverEvent): Promise<void> {
    if (step.command) {
      await this.executeCommand(step.command, step.timeout);
    } else {
      throw new Error('Custom step requires a command');
    }
  }

  private async executeCommand(command: string, timeout: number = 30000): Promise<string> {
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const process = spawn('bash', ['-c', command]);
      
      let output = '';
      let error = '';
      
      const timer = setTimeout(() => {
        process.kill();
        reject(new Error(`Command timeout: ${command}`));
      }, timeout);
      
      process.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });
      
      process.stderr.on('data', (data: Buffer) => {
        error += data.toString();
      });
      
      process.on('close', (code: number) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Command failed (${code}): ${error}`));
        }
      });
    });
  }

  private async executeRollbackStep(step: RecoveryStep, failoverEvent: FailoverEvent): Promise<void> {
    if (step.rollbackCommand) {
      try {
        await this.executeCommand(step.rollbackCommand, step.timeout);
        this.emit('failover:rollback-completed', { failoverEvent, step });
      } catch (error) {
        this.emit('failover:rollback-failed', { failoverEvent, step, error });
      }
    }
  }

  private async initializeDefaultRecoveryPlans(): Promise<void> {
    // Full site failover plan
    const fullSiteFailoverPlan: RecoveryPlan = {
      id: 'default-failover',
      name: 'Full Site Failover',
      type: 'full_site_failover',
      targetSite: '',
      estimatedRTO: this.config.objectives.rto,
      estimatedRPO: this.config.objectives.rpo,
      prerequisites: [
        'Verify target site health',
        'Confirm latest backup availability',
        'Notify stakeholders',
      ],
      steps: [
        {
          id: 'stop-primary-services',
          name: 'Stop Primary Site Services',
          type: 'service_start',
          command: 'systemctl stop learning-assistant',
          parameters: {},
          timeout: 60000,
          retries: 3,
          dependencies: [],
        },
        {
          id: 'restore-database',
          name: 'Restore Database',
          type: 'backup_restore',
          parameters: { targetDatabase: 'learning_assistant_db' },
          timeout: 1800000, // 30 minutes
          retries: 1,
          dependencies: ['stop-primary-services'],
        },
        {
          id: 'start-target-services',
          name: 'Start Target Site Services',
          type: 'service_start',
          command: 'systemctl start learning-assistant',
          parameters: {},
          timeout: 120000,
          retries: 3,
          dependencies: ['restore-database'],
        },
        {
          id: 'update-dns',
          name: 'Update DNS Records',
          type: 'dns_update',
          parameters: {
            recordName: 'app.learningassistant.com',
            recordType: 'A',
          },
          timeout: 300000,
          retries: 2,
          dependencies: ['start-target-services'],
        },
        {
          id: 'validate-health',
          name: 'Validate Application Health',
          type: 'validation',
          parameters: {
            validationType: 'health_check',
            endpoint: 'https://app.learningassistant.com',
          },
          timeout: 60000,
          retries: 5,
          dependencies: ['update-dns'],
        },
      ],
      postValidation: [
        'Verify all critical functions',
        'Monitor application metrics',
        'Confirm data consistency',
        'Update monitoring configurations',
      ],
    };

    this.recoveryPlans.set(fullSiteFailoverPlan.id, fullSiteFailoverPlan);
    await this.saveRecoveryPlans();
  }

  /**
   * Approve or reject a pending failover
   */
  public approveFailover(failoverId: string, approver: string, action: 'approved' | 'rejected', reason?: string): void {
    const approval: Approval = {
      id: `approval-${Date.now()}`,
      timestamp: new Date(),
      approver,
      action,
      reason,
    };

    this.emit('approval:response', approval);
  }

  /**
   * Get current disaster recovery status
   */
  public getStatus(): {
    currentPrimarySite: string;
    sites: Site[];
    activeFailover?: FailoverEvent;
    lastFailover?: FailoverEvent;
    healthStatus: string;
  } {
    return {
      currentPrimarySite: this.currentPrimarySite,
      sites: Array.from(this.sites.values()),
      activeFailover: this.activeFailover,
      lastFailover: this.failoverHistory[this.failoverHistory.length - 1],
      healthStatus: this.calculateOverallHealth(),
    };
  }

  private calculateOverallHealth(): string {
    const sites = Array.from(this.sites.values());
    const healthySites = sites.filter(s => s.status === 'healthy').length;
    const totalSites = sites.length;
    
    if (healthySites === totalSites) {
      return 'healthy';
    } else if (healthySites > totalSites / 2) {
      return 'degraded';
    } else {
      return 'critical';
    }
  }

  /**
   * Test failover procedures
   */
  public async testFailover(targetSite: string, planId?: string): Promise<string> {
    return this.initiateFailover({
      trigger: 'manual',
      reason: 'Disaster recovery test',
      targetSite,
      planId: planId || 'default-failover',
    });
  }

  /**
   * Get failover history
   */
  public getFailoverHistory(limit?: number): FailoverEvent[] {
    const history = [...this.failoverHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Create custom recovery plan
   */
  public async createRecoveryPlan(plan: RecoveryPlan): Promise<void> {
    this.recoveryPlans.set(plan.id, plan);
    await this.saveRecoveryPlans();
    this.emit('recovery-plan:created', plan);
  }

  /**
   * Update recovery plan
   */
  public async updateRecoveryPlan(planId: string, updates: Partial<RecoveryPlan>): Promise<void> {
    const plan = this.recoveryPlans.get(planId);
    if (!plan) {
      throw new Error(`Recovery plan not found: ${planId}`);
    }

    Object.assign(plan, updates);
    await this.saveRecoveryPlans();
    this.emit('recovery-plan:updated', { planId, plan });
  }

  /**
   * Stop the disaster recovery service
   */
  public stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.emit('dr:service-stopped');
  }
}

export { DisasterRecoveryConfig, Site, FailoverEvent, RecoveryPlan, RecoveryStep };