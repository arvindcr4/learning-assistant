/**
 * Backup Retention Management System for Learning Assistant
 * Comprehensive retention policies, archival, and lifecycle management
 */

import { EventEmitter } from 'events';
import { BackupService, BackupMetadata } from './backup-service';
import { promises as fs } from 'fs';
import { join } from 'path';

interface RetentionConfig {
  policies: RetentionPolicy[];
  archival: {
    enabled: boolean;
    archiveAfterDays: number;
    archiveLocation: {
      type: 'local' | 's3' | 'azure' | 'gcs' | 'glacier';
      config: Record<string, any>;
    };
    compressionLevel: number;
    encryptionEnabled: boolean;
  };
  cleanup: {
    schedule: string; // cron expression
    dryRun: boolean;
    confirmationRequired: boolean;
    batchSize: number;
  };
  compliance: {
    enabled: boolean;
    regulations: string[]; // e.g., ['GDPR', 'HIPAA', 'SOX']
    auditTrail: boolean;
    immutableBackups: boolean;
    legalHoldSupport: boolean;
  };
  monitoring: {
    enabled: boolean;
    alertOnPolicyViolation: boolean;
    reportingEnabled: boolean;
    metricsCollection: boolean;
  };
}

interface RetentionPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number; // Higher number = higher priority
  conditions: RetentionCondition[];
  actions: RetentionAction[];
  tags: string[]; // Apply to backups with these tags
  backupTypes: ('full' | 'incremental' | 'differential')[];
  schedule?: string; // cron expression for policy evaluation
}

interface RetentionCondition {
  type: 'age' | 'count' | 'size' | 'tag' | 'custom';
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne' | 'in' | 'contains';
  value: any;
  unit?: 'days' | 'weeks' | 'months' | 'years' | 'bytes' | 'gb' | 'tb';
}

interface RetentionAction {
  type: 'delete' | 'archive' | 'move' | 'tag' | 'notify' | 'legal_hold';
  parameters: Record<string, any>;
  delay?: number; // days to delay action
  requiresApproval?: boolean;
}

interface RetentionExecution {
  id: string;
  policyId: string;
  timestamp: Date;
  status: 'planned' | 'running' | 'completed' | 'failed' | 'cancelled';
  backupsProcessed: number;
  actions: ExecutedAction[];
  summary: ExecutionSummary;
  errors: string[];
  dryRun: boolean;
}

interface ExecutedAction {
  backupId: string;
  action: RetentionAction;
  status: 'pending' | 'completed' | 'failed' | 'skipped';
  timestamp: Date;
  result?: any;
  error?: string;
}

interface ExecutionSummary {
  totalBackups: number;
  deleted: number;
  archived: number;
  moved: number;
  tagged: number;
  skipped: number;
  failed: number;
  spaceFreed: number; // bytes
  costSavings: number; // estimated
}

interface ArchiveMetadata {
  id: string;
  originalBackupId: string;
  archiveDate: Date;
  archiveLocation: string;
  originalSize: number;
  archivedSize: number;
  compressionRatio: number;
  encrypted: boolean;
  retrievalTime: 'immediate' | 'expedited' | 'standard' | 'bulk';
  cost: number;
  tags: string[];
  metadata: Record<string, any>;
}

interface ComplianceAudit {
  id: string;
  timestamp: Date;
  operation: 'create' | 'delete' | 'archive' | 'retrieve' | 'modify';
  backupId: string;
  policyId?: string;
  user: string;
  reason: string;
  complianceFlags: string[];
  approved: boolean;
  approver?: string;
  digitalSignature?: string;
}

export class RetentionManager extends EventEmitter {
  private config: RetentionConfig;
  private backupService: BackupService;
  private policies: Map<string, RetentionPolicy> = new Map();
  private executions: Map<string, RetentionExecution> = new Map();
  private archives: Map<string, ArchiveMetadata> = new Map();
  private auditTrail: ComplianceAudit[] = [];
  private scheduledTasks: Map<string, NodeJS.Timeout> = new Map();
  private legalHolds: Set<string> = new Set(); // Backup IDs under legal hold

  constructor(config: RetentionConfig, backupService: BackupService) {
    super();
    this.config = config;
    this.backupService = backupService;
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    try {
      // Load policies and state
      await this.loadPolicies();
      await this.loadExecutions();
      await this.loadArchives();
      await this.loadAuditTrail();
      await this.loadLegalHolds();

      // Initialize default policies if none exist
      if (this.policies.size === 0) {
        await this.createDefaultPolicies();
      }

      // Setup scheduled tasks
      this.setupScheduledTasks();

      this.emit('retention:service-initialized');
    } catch (error) {
      this.emit('retention:initialization-failed', error);
      throw error;
    }
  }

  private async loadPolicies(): Promise<void> {
    try {
      const policiesPath = join(process.cwd(), 'data', 'retention-policies.json');
      const data = await fs.readFile(policiesPath, 'utf8');
      const policies = JSON.parse(data);
      
      policies.forEach((policy: RetentionPolicy) => {
        this.policies.set(policy.id, policy);
      });
    } catch (error) {
      // Initialize empty policies if file doesn't exist
    }
  }

  private async savePolicies(): Promise<void> {
    try {
      const policiesPath = join(process.cwd(), 'data', 'retention-policies.json');
      await fs.mkdir(join(process.cwd(), 'data'), { recursive: true });
      
      const policiesArray = Array.from(this.policies.values());
      await fs.writeFile(policiesPath, JSON.stringify(policiesArray, null, 2));
    } catch (error) {
      this.emit('retention:save-policies-failed', error);
    }
  }

  private async loadExecutions(): Promise<void> {
    try {
      const executionsPath = join(process.cwd(), 'data', 'retention-executions.json');
      const data = await fs.readFile(executionsPath, 'utf8');
      const executions = JSON.parse(data);
      
      executions.forEach((execution: RetentionExecution) => {
        this.executions.set(execution.id, execution);
      });
    } catch (error) {
      // Initialize empty executions if file doesn't exist
    }
  }

  private async saveExecutions(): Promise<void> {
    try {
      const executionsPath = join(process.cwd(), 'data', 'retention-executions.json');
      await fs.mkdir(join(process.cwd(), 'data'), { recursive: true });
      
      const executionsArray = Array.from(this.executions.values());
      await fs.writeFile(executionsPath, JSON.stringify(executionsArray, null, 2));
    } catch (error) {
      this.emit('retention:save-executions-failed', error);
    }
  }

  private async loadArchives(): Promise<void> {
    try {
      const archivesPath = join(process.cwd(), 'data', 'backup-archives.json');
      const data = await fs.readFile(archivesPath, 'utf8');
      const archives = JSON.parse(data);
      
      archives.forEach((archive: ArchiveMetadata) => {
        this.archives.set(archive.id, archive);
      });
    } catch (error) {
      // Initialize empty archives if file doesn't exist
    }
  }

  private async saveArchives(): Promise<void> {
    try {
      const archivesPath = join(process.cwd(), 'data', 'backup-archives.json');
      await fs.mkdir(join(process.cwd(), 'data'), { recursive: true });
      
      const archivesArray = Array.from(this.archives.values());
      await fs.writeFile(archivesPath, JSON.stringify(archivesArray, null, 2));
    } catch (error) {
      this.emit('retention:save-archives-failed', error);
    }
  }

  private async loadAuditTrail(): Promise<void> {
    try {
      const auditPath = join(process.cwd(), 'data', 'compliance-audit.json');
      const data = await fs.readFile(auditPath, 'utf8');
      this.auditTrail = JSON.parse(data);
    } catch (error) {
      this.auditTrail = [];
    }
  }

  private async saveAuditTrail(): Promise<void> {
    try {
      const auditPath = join(process.cwd(), 'data', 'compliance-audit.json');
      await fs.mkdir(join(process.cwd(), 'data'), { recursive: true });
      await fs.writeFile(auditPath, JSON.stringify(this.auditTrail, null, 2));
    } catch (error) {
      this.emit('retention:save-audit-failed', error);
    }
  }

  private async loadLegalHolds(): Promise<void> {
    try {
      const holdsPath = join(process.cwd(), 'data', 'legal-holds.json');
      const data = await fs.readFile(holdsPath, 'utf8');
      const holds = JSON.parse(data);
      
      holds.forEach((backupId: string) => {
        this.legalHolds.add(backupId);
      });
    } catch (error) {
      // Initialize empty legal holds if file doesn't exist
    }
  }

  private async saveLegalHolds(): Promise<void> {
    try {
      const holdsPath = join(process.cwd(), 'data', 'legal-holds.json');
      await fs.mkdir(join(process.cwd(), 'data'), { recursive: true });
      
      const holdsArray = Array.from(this.legalHolds);
      await fs.writeFile(holdsPath, JSON.stringify(holdsArray, null, 2));
    } catch (error) {
      this.emit('retention:save-holds-failed', error);
    }
  }

  private async createDefaultPolicies(): Promise<void> {
    // Daily backup retention policy
    const dailyPolicy: RetentionPolicy = {
      id: 'daily-retention',
      name: 'Daily Backup Retention',
      description: 'Keep daily backups for 30 days',
      enabled: true,
      priority: 1,
      conditions: [
        {
          type: 'age',
          operator: 'gt',
          value: 30,
          unit: 'days'
        }
      ],
      actions: [
        {
          type: 'delete',
          parameters: {}
        }
      ],
      tags: ['daily'],
      backupTypes: ['full', 'incremental'],
      schedule: '0 2 * * *' // Daily at 2 AM
    };

    // Weekly backup retention policy
    const weeklyPolicy: RetentionPolicy = {
      id: 'weekly-retention',
      name: 'Weekly Backup Retention',
      description: 'Keep weekly backups for 12 weeks, then archive',
      enabled: true,
      priority: 2,
      conditions: [
        {
          type: 'age',
          operator: 'gt',
          value: 12,
          unit: 'weeks'
        }
      ],
      actions: [
        {
          type: 'archive',
          parameters: {
            storageClass: 'STANDARD_IA'
          }
        }
      ],
      tags: ['weekly'],
      backupTypes: ['full'],
      schedule: '0 3 * * 0' // Weekly on Sunday at 3 AM
    };

    // Monthly backup retention policy
    const monthlyPolicy: RetentionPolicy = {
      id: 'monthly-retention',
      name: 'Monthly Backup Retention',
      description: 'Keep monthly backups for 7 years for compliance',
      enabled: true,
      priority: 3,
      conditions: [
        {
          type: 'age',
          operator: 'gt',
          value: 7,
          unit: 'years'
        }
      ],
      actions: [
        {
          type: 'delete',
          parameters: {},
          requiresApproval: true
        }
      ],
      tags: ['monthly', 'compliance'],
      backupTypes: ['full'],
      schedule: '0 4 1 * *' // Monthly on 1st at 4 AM
    };

    // Large backup cleanup policy
    const largeSizePolicy: RetentionPolicy = {
      id: 'large-size-cleanup',
      name: 'Large Backup Cleanup',
      description: 'Archive backups larger than 10GB after 7 days',
      enabled: true,
      priority: 4,
      conditions: [
        {
          type: 'size',
          operator: 'gt',
          value: 10,
          unit: 'gb'
        },
        {
          type: 'age',
          operator: 'gt',
          value: 7,
          unit: 'days'
        }
      ],
      actions: [
        {
          type: 'archive',
          parameters: {
            storageClass: 'GLACIER'
          }
        }
      ],
      tags: [],
      backupTypes: ['full', 'incremental', 'differential']
    };

    // Add default policies
    this.policies.set(dailyPolicy.id, dailyPolicy);
    this.policies.set(weeklyPolicy.id, weeklyPolicy);
    this.policies.set(monthlyPolicy.id, monthlyPolicy);
    this.policies.set(largeSizePolicy.id, largeSizePolicy);

    await this.savePolicies();
    this.emit('retention:default-policies-created');
  }

  private setupScheduledTasks(): void {
    const cron = require('node-cron');

    // Main cleanup schedule
    if (this.config.cleanup.schedule) {
      const cleanupTask = cron.schedule(this.config.cleanup.schedule, async () => {
        await this.runScheduledRetention();
      }, { scheduled: false });
      cleanupTask.start();
      this.scheduledTasks.set('cleanup', cleanupTask);
    }

    // Setup individual policy schedules
    for (const policy of this.policies.values()) {
      if (policy.schedule && policy.enabled) {
        const policyTask = cron.schedule(policy.schedule, async () => {
          await this.executePolicyRetention(policy.id);
        }, { scheduled: false });
        policyTask.start();
        this.scheduledTasks.set(`policy-${policy.id}`, policyTask);
      }
    }
  }

  /**
   * Create a new retention policy
   */
  public async createRetentionPolicy(policy: Omit<RetentionPolicy, 'id'>): Promise<string> {
    const policyId = `policy-${Date.now()}`;
    const fullPolicy: RetentionPolicy = {
      id: policyId,
      ...policy
    };

    this.policies.set(policyId, fullPolicy);
    await this.savePolicies();

    // Setup schedule if provided
    if (fullPolicy.schedule && fullPolicy.enabled) {
      const cron = require('node-cron');
      const policyTask = cron.schedule(fullPolicy.schedule, async () => {
        await this.executePolicyRetention(policyId);
      }, { scheduled: false });
      policyTask.start();
      this.scheduledTasks.set(`policy-${policyId}`, policyTask);
    }

    this.emit('retention:policy-created', { policyId, policy: fullPolicy });
    await this.recordAuditEvent('create', '', policyId, 'system', 'Retention policy created');

    return policyId;
  }

  /**
   * Update a retention policy
   */
  public async updateRetentionPolicy(policyId: string, updates: Partial<RetentionPolicy>): Promise<void> {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Retention policy not found: ${policyId}`);
    }

    // Update policy
    Object.assign(policy, updates);
    await this.savePolicies();

    // Update schedule if changed
    if (updates.schedule !== undefined || updates.enabled !== undefined) {
      const existingTask = this.scheduledTasks.get(`policy-${policyId}`);
      if (existingTask) {
        existingTask.destroy();
        this.scheduledTasks.delete(`policy-${policyId}`);
      }

      if (policy.schedule && policy.enabled) {
        const cron = require('node-cron');
        const policyTask = cron.schedule(policy.schedule, async () => {
          await this.executePolicyRetention(policyId);
        }, { scheduled: false });
        policyTask.start();
        this.scheduledTasks.set(`policy-${policyId}`, policyTask);
      }
    }

    this.emit('retention:policy-updated', { policyId, policy });
    await this.recordAuditEvent('modify', '', policyId, 'system', 'Retention policy updated');
  }

  /**
   * Execute retention for a specific policy
   */
  public async executePolicyRetention(policyId: string, dryRun: boolean = false): Promise<string> {
    const policy = this.policies.get(policyId);
    if (!policy || !policy.enabled) {
      throw new Error(`Policy not found or disabled: ${policyId}`);
    }

    const executionId = `exec-${policyId}-${Date.now()}`;
    const execution: RetentionExecution = {
      id: executionId,
      policyId,
      timestamp: new Date(),
      status: 'running',
      backupsProcessed: 0,
      actions: [],
      summary: {
        totalBackups: 0,
        deleted: 0,
        archived: 0,
        moved: 0,
        tagged: 0,
        skipped: 0,
        failed: 0,
        spaceFreed: 0,
        costSavings: 0
      },
      errors: [],
      dryRun: dryRun || this.config.cleanup.dryRun
    };

    this.executions.set(executionId, execution);
    this.emit('retention:execution-started', execution);

    try {
      // Get all backups that match policy criteria
      const allBackups = this.backupService.listBackups();
      const eligibleBackups = this.filterBackupsByPolicy(allBackups, policy);
      
      execution.summary.totalBackups = eligibleBackups.length;
      execution.backupsProcessed = 0;

      // Process backups in batches
      const batchSize = this.config.cleanup.batchSize;
      for (let i = 0; i < eligibleBackups.length; i += batchSize) {
        const batch = eligibleBackups.slice(i, i + batchSize);
        
        for (const backup of batch) {
          try {
            await this.processBackupRetention(backup, policy, execution);
            execution.backupsProcessed++;
          } catch (error) {
            execution.errors.push(`Failed to process backup ${backup.id}: ${error.message}`);
            execution.summary.failed++;
          }
        }

        // Emit progress
        this.emit('retention:execution-progress', {
          executionId,
          processed: execution.backupsProcessed,
          total: eligibleBackups.length
        });
      }

      execution.status = 'completed';
      this.emit('retention:execution-completed', execution);

    } catch (error) {
      execution.status = 'failed';
      execution.errors.push(error.message);
      this.emit('retention:execution-failed', { execution, error });
    }

    await this.saveExecutions();
    return executionId;
  }

  private filterBackupsByPolicy(backups: BackupMetadata[], policy: RetentionPolicy): BackupMetadata[] {
    return backups.filter(backup => {
      // Skip backups under legal hold
      if (this.legalHolds.has(backup.id)) {
        return false;
      }

      // Check backup type filter
      if (policy.backupTypes.length > 0 && !policy.backupTypes.includes(backup.type)) {
        return false;
      }

      // Check tag filter
      if (policy.tags.length > 0) {
        const backupTags = Object.keys(backup.tags || {});
        const hasMatchingTag = policy.tags.some(tag => backupTags.includes(tag));
        if (!hasMatchingTag) {
          return false;
        }
      }

      // Check all conditions
      return policy.conditions.every(condition => this.evaluateCondition(backup, condition));
    });
  }

  private evaluateCondition(backup: BackupMetadata, condition: RetentionCondition): boolean {
    let backupValue: any;

    switch (condition.type) {
      case 'age':
        const ageMs = Date.now() - backup.timestamp.getTime();
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        
        switch (condition.unit) {
          case 'days':
            backupValue = ageDays;
            break;
          case 'weeks':
            backupValue = ageDays / 7;
            break;
          case 'months':
            backupValue = ageDays / 30;
            break;
          case 'years':
            backupValue = ageDays / 365;
            break;
          default:
            backupValue = ageDays;
        }
        break;

      case 'size':
        switch (condition.unit) {
          case 'bytes':
            backupValue = backup.size;
            break;
          case 'gb':
            backupValue = backup.size / (1024 * 1024 * 1024);
            break;
          case 'tb':
            backupValue = backup.size / (1024 * 1024 * 1024 * 1024);
            break;
          default:
            backupValue = backup.size;
        }
        break;

      case 'count':
        // This would require counting backups of the same type/tag
        // Simplified implementation
        backupValue = 1;
        break;

      case 'tag':
        backupValue = backup.tags || {};
        break;

      default:
        return false;
    }

    // Apply operator
    switch (condition.operator) {
      case 'gt':
        return backupValue > condition.value;
      case 'gte':
        return backupValue >= condition.value;
      case 'lt':
        return backupValue < condition.value;
      case 'lte':
        return backupValue <= condition.value;
      case 'eq':
        return backupValue === condition.value;
      case 'ne':
        return backupValue !== condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(backupValue);
      case 'contains':
        return typeof backupValue === 'object' && Object.keys(backupValue).some(key => 
          condition.value.includes(key)
        );
      default:
        return false;
    }
  }

  private async processBackupRetention(
    backup: BackupMetadata,
    policy: RetentionPolicy,
    execution: RetentionExecution
  ): Promise<void> {
    for (const action of policy.actions) {
      const executedAction: ExecutedAction = {
        backupId: backup.id,
        action,
        status: 'pending',
        timestamp: new Date()
      };

      execution.actions.push(executedAction);

      try {
        // Check if approval is required
        if (action.requiresApproval && !execution.dryRun) {
          const approved = await this.requestApproval(backup, action, policy);
          if (!approved) {
            executedAction.status = 'skipped';
            executedAction.result = 'Approval denied or timeout';
            execution.summary.skipped++;
            continue;
          }
        }

        // Apply delay if specified
        if (action.delay && action.delay > 0) {
          const delayMs = action.delay * 24 * 60 * 60 * 1000; // Convert days to ms
          const scheduledTime = new Date(Date.now() + delayMs);
          
          // Schedule action for later
          setTimeout(async () => {
            await this.executeRetentionAction(backup, action, execution.dryRun);
          }, delayMs);

          executedAction.status = 'completed';
          executedAction.result = `Scheduled for ${scheduledTime.toISOString()}`;
          continue;
        }

        // Execute action immediately
        const result = await this.executeRetentionAction(backup, action, execution.dryRun);
        
        executedAction.status = 'completed';
        executedAction.result = result;

        // Update summary
        this.updateExecutionSummary(execution, action, backup, result);

      } catch (error) {
        executedAction.status = 'failed';
        executedAction.error = error.message;
        execution.summary.failed++;
      }
    }
  }

  private async executeRetentionAction(
    backup: BackupMetadata,
    action: RetentionAction,
    dryRun: boolean
  ): Promise<any> {
    const actionLog = `${action.type} on backup ${backup.id}`;
    
    if (dryRun) {
      this.emit('retention:dry-run-action', { backup, action });
      return `DRY RUN: Would execute ${actionLog}`;
    }

    switch (action.type) {
      case 'delete':
        return await this.deleteBackup(backup, action.parameters);

      case 'archive':
        return await this.archiveBackup(backup, action.parameters);

      case 'move':
        return await this.moveBackup(backup, action.parameters);

      case 'tag':
        return await this.tagBackup(backup, action.parameters);

      case 'notify':
        return await this.notifyAction(backup, action.parameters);

      case 'legal_hold':
        return await this.applyLegalHold(backup, action.parameters);

      default:
        throw new Error(`Unknown retention action: ${action.type}`);
    }
  }

  private async deleteBackup(backup: BackupMetadata, parameters: Record<string, any>): Promise<any> {
    // Record audit before deletion
    await this.recordAuditEvent('delete', backup.id, '', 'system', 'Backup deleted by retention policy');

    // Delete from cloud storage
    for (const location of backup.storageLocations) {
      if (location.startsWith('s3://') || location.startsWith('azure://') || location.startsWith('gs://')) {
        // Implementation would delete from cloud storage
        this.emit('retention:cloud-delete-requested', { backup, location });
      }
    }

    // Delete local files
    const localFiles = backup.storageLocations.filter(loc => loc.startsWith('/'));
    for (const filePath of localFiles) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // File might already be deleted
      }
    }

    this.emit('retention:backup-deleted', backup);
    return { deleted: true, spaceFreed: backup.size };
  }

  private async archiveBackup(backup: BackupMetadata, parameters: Record<string, any>): Promise<any> {
    const archiveId = `archive-${backup.id}-${Date.now()}`;
    const archiveLocation = await this.getArchiveLocation(parameters);
    
    // Create archive metadata
    const archiveMetadata: ArchiveMetadata = {
      id: archiveId,
      originalBackupId: backup.id,
      archiveDate: new Date(),
      archiveLocation,
      originalSize: backup.size,
      archivedSize: backup.compressedSize || backup.size,
      compressionRatio: backup.compressedSize ? backup.compressedSize / backup.size : 1,
      encrypted: backup.encrypted,
      retrievalTime: parameters.retrievalTime || 'standard',
      cost: this.calculateArchiveCost(backup, parameters),
      tags: Object.keys(backup.tags || {}),
      metadata: { ...backup, archived: true }
    };

    // Archive to specified location
    await this.performArchiveOperation(backup, archiveLocation, parameters);

    // Save archive metadata
    this.archives.set(archiveId, archiveMetadata);
    await this.saveArchives();

    // Record audit
    await this.recordAuditEvent('archive', backup.id, '', 'system', 'Backup archived by retention policy');

    this.emit('retention:backup-archived', { backup, archive: archiveMetadata });
    return { archived: true, archiveId, location: archiveLocation };
  }

  private async moveBackup(backup: BackupMetadata, parameters: Record<string, any>): Promise<any> {
    const targetLocation = parameters.targetLocation;
    if (!targetLocation) {
      throw new Error('Target location not specified for move action');
    }

    // Implementation would move backup to different storage tier or location
    this.emit('retention:backup-moved', { backup, targetLocation });
    
    await this.recordAuditEvent('modify', backup.id, '', 'system', `Backup moved to ${targetLocation}`);
    return { moved: true, targetLocation };
  }

  private async tagBackup(backup: BackupMetadata, parameters: Record<string, any>): Promise<any> {
    const newTags = parameters.tags || {};
    
    // Update backup metadata with new tags
    backup.tags = { ...backup.tags, ...newTags };
    
    this.emit('retention:backup-tagged', { backup, newTags });
    return { tagged: true, tags: newTags };
  }

  private async notifyAction(backup: BackupMetadata, parameters: Record<string, any>): Promise<any> {
    const message = parameters.message || `Retention action applied to backup ${backup.id}`;
    const recipients = parameters.recipients || [];
    
    this.emit('retention:notification-sent', { backup, message, recipients });
    return { notified: true, recipients: recipients.length };
  }

  private async applyLegalHold(backup: BackupMetadata, parameters: Record<string, any>): Promise<any> {
    this.legalHolds.add(backup.id);
    await this.saveLegalHolds();
    
    const reason = parameters.reason || 'Legal hold applied by retention policy';
    await this.recordAuditEvent('modify', backup.id, '', 'system', `Legal hold applied: ${reason}`);
    
    this.emit('retention:legal-hold-applied', { backup, reason });
    return { legalHold: true, reason };
  }

  private async getArchiveLocation(parameters: Record<string, any>): Promise<string> {
    const archiveConfig = this.config.archival.archiveLocation;
    
    switch (archiveConfig.type) {
      case 's3':
        return `s3://${archiveConfig.config.bucket}/archives/`;
      case 'azure':
        return `azure://${archiveConfig.config.account}/${archiveConfig.config.container}/archives/`;
      case 'gcs':
        return `gs://${archiveConfig.config.bucket}/archives/`;
      case 'glacier':
        return `glacier://${archiveConfig.config.vault}/`;
      case 'local':
        return join(archiveConfig.config.path, 'archives');
      default:
        throw new Error(`Unsupported archive location type: ${archiveConfig.type}`);
    }
  }

  private async performArchiveOperation(
    backup: BackupMetadata,
    archiveLocation: string,
    parameters: Record<string, any>
  ): Promise<void> {
    // Implementation would perform actual archival based on location type
    this.emit('retention:archive-operation-requested', { backup, archiveLocation, parameters });
  }

  private calculateArchiveCost(backup: BackupMetadata, parameters: Record<string, any>): number {
    // Simplified cost calculation
    const sizeGB = backup.size / (1024 * 1024 * 1024);
    const storageCostPerGB = parameters.costPerGB || 0.004; // AWS Glacier pricing
    return sizeGB * storageCostPerGB;
  }

  private updateExecutionSummary(
    execution: RetentionExecution,
    action: RetentionAction,
    backup: BackupMetadata,
    result: any
  ): void {
    switch (action.type) {
      case 'delete':
        execution.summary.deleted++;
        execution.summary.spaceFreed += backup.size;
        break;
      case 'archive':
        execution.summary.archived++;
        execution.summary.costSavings += result.cost || 0;
        break;
      case 'move':
        execution.summary.moved++;
        break;
      case 'tag':
        execution.summary.tagged++;
        break;
    }
  }

  private async requestApproval(
    backup: BackupMetadata,
    action: RetentionAction,
    policy: RetentionPolicy
  ): Promise<boolean> {
    // Simplified approval mechanism
    // In a real implementation, this would integrate with approval workflow
    
    this.emit('retention:approval-requested', {
      backup,
      action,
      policy,
      timeout: 24 * 60 * 60 * 1000 // 24 hours
    });

    // Return true for now (auto-approve)
    return true;
  }

  private async recordAuditEvent(
    operation: string,
    backupId: string,
    policyId: string,
    user: string,
    reason: string
  ): Promise<void> {
    if (!this.config.compliance.auditTrail) {
      return;
    }

    const audit: ComplianceAudit = {
      id: `audit-${Date.now()}`,
      timestamp: new Date(),
      operation: operation as any,
      backupId,
      policyId,
      user,
      reason,
      complianceFlags: this.config.compliance.regulations,
      approved: true,
      digitalSignature: this.generateDigitalSignature(operation, backupId, user, reason)
    };

    this.auditTrail.push(audit);
    await this.saveAuditTrail();
    
    this.emit('retention:audit-recorded', audit);
  }

  private generateDigitalSignature(operation: string, backupId: string, user: string, reason: string): string {
    const crypto = require('crypto');
    const data = `${operation}:${backupId}:${user}:${reason}:${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private async runScheduledRetention(): Promise<void> {
    try {
      const enabledPolicies = Array.from(this.policies.values())
        .filter(p => p.enabled)
        .sort((a, b) => b.priority - a.priority); // Higher priority first

      for (const policy of enabledPolicies) {
        await this.executePolicyRetention(policy.id);
      }

      this.emit('retention:scheduled-retention-completed');
    } catch (error) {
      this.emit('retention:scheduled-retention-failed', error);
    }
  }

  /**
   * Remove legal hold from backup
   */
  public async removeLegalHold(backupId: string, reason: string, approver: string): Promise<void> {
    if (!this.legalHolds.has(backupId)) {
      throw new Error(`No legal hold found for backup: ${backupId}`);
    }

    this.legalHolds.delete(backupId);
    await this.saveLegalHolds();

    await this.recordAuditEvent('modify', backupId, '', approver, `Legal hold removed: ${reason}`);
    this.emit('retention:legal-hold-removed', { backupId, reason, approver });
  }

  /**
   * Retrieve archived backup
   */
  public async retrieveArchivedBackup(archiveId: string, urgency: 'bulk' | 'standard' | 'expedited' = 'standard'): Promise<string> {
    const archive = this.archives.get(archiveId);
    if (!archive) {
      throw new Error(`Archive not found: ${archiveId}`);
    }

    // Implementation would initiate retrieval from archive storage
    const retrievalId = `retrieval-${Date.now()}`;
    
    this.emit('retention:archive-retrieval-requested', {
      archiveId,
      retrievalId,
      urgency,
      estimatedTime: this.getRetrievalTime(urgency)
    });

    await this.recordAuditEvent('retrieve', archive.originalBackupId, '', 'system', `Archive retrieval requested: ${urgency}`);

    return retrievalId;
  }

  private getRetrievalTime(urgency: string): string {
    switch (urgency) {
      case 'expedited': return '1-5 minutes';
      case 'standard': return '3-5 hours';
      case 'bulk': return '5-12 hours';
      default: return '3-5 hours';
    }
  }

  /**
   * Get retention policy by ID
   */
  public getRetentionPolicy(policyId: string): RetentionPolicy | undefined {
    return this.policies.get(policyId);
  }

  /**
   * List all retention policies
   */
  public listRetentionPolicies(): RetentionPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get execution status
   */
  public getExecutionStatus(executionId: string): RetentionExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * List recent executions
   */
  public listExecutions(limit: number = 50): RetentionExecution[] {
    return Array.from(this.executions.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get compliance audit trail
   */
  public getAuditTrail(startDate?: Date, endDate?: Date): ComplianceAudit[] {
    let trail = this.auditTrail;
    
    if (startDate || endDate) {
      trail = trail.filter(audit => {
        const auditTime = audit.timestamp.getTime();
        const afterStart = !startDate || auditTime >= startDate.getTime();
        const beforeEnd = !endDate || auditTime <= endDate.getTime();
        return afterStart && beforeEnd;
      });
    }
    
    return trail.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get retention summary
   */
  public getRetentionSummary(): {
    policies: number;
    activePolicies: number;
    totalExecutions: number;
    backupsProcessed: number;
    spaceFreed: number;
    archivesCreated: number;
    legalHolds: number;
  } {
    const executions = Array.from(this.executions.values());
    
    return {
      policies: this.policies.size,
      activePolicies: Array.from(this.policies.values()).filter(p => p.enabled).length,
      totalExecutions: executions.length,
      backupsProcessed: executions.reduce((sum, e) => sum + e.backupsProcessed, 0),
      spaceFreed: executions.reduce((sum, e) => sum + e.summary.spaceFreed, 0),
      archivesCreated: this.archives.size,
      legalHolds: this.legalHolds.size
    };
  }

  /**
   * Stop the retention manager
   */
  public stop(): void {
    // Clear all scheduled tasks
    this.scheduledTasks.forEach(task => task.destroy());
    this.scheduledTasks.clear();

    this.emit('retention:service-stopped');
  }
}

export { 
  RetentionConfig, 
  RetentionPolicy, 
  RetentionExecution, 
  ArchiveMetadata, 
  ComplianceAudit 
};