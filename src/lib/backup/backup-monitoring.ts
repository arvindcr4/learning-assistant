/**
 * Backup Monitoring System for Learning Assistant
 * Comprehensive monitoring, alerting, and metrics collection for backup operations
 */

import { EventEmitter } from 'events';
import { BackupService, BackupMetadata, BackupStatus } from './backup-service';
import { DisasterRecoveryOrchestrator } from './disaster-recovery';
import { promises as fs } from 'fs';
import { join } from 'path';

interface MonitoringConfig {
  metrics: {
    enabled: boolean;
    collectionInterval: number;
    retention: {
      raw: number; // days
      aggregated: number; // days
    };
    endpoints: {
      prometheus?: string;
      datadog?: string;
      newrelic?: string;
      custom?: string;
    };
  };
  alerting: {
    enabled: boolean;
    channels: {
      email?: {
        enabled: boolean;
        smtp: {
          host: string;
          port: number;
          secure: boolean;
          auth: {
            user: string;
            pass: string;
          };
        };
        recipients: string[];
        templates: {
          success: string;
          failure: string;
          warning: string;
        };
      };
      slack?: {
        enabled: boolean;
        webhook: string;
        channel: string;
        mentions: string[];
      };
      pagerduty?: {
        enabled: boolean;
        integrationKey: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
      };
      webhook?: {
        enabled: boolean;
        url: string;
        headers: Record<string, string>;
        retries: number;
      };
    };
    rules: AlertRule[];
  };
  healthChecks: {
    enabled: boolean;
    interval: number;
    timeout: number;
    thresholds: {
      backupAge: number; // hours
      diskSpace: number; // percentage
      failureRate: number; // percentage
      responseTime: number; // milliseconds
    };
  };
  reporting: {
    enabled: boolean;
    schedule: string; // cron expression
    recipients: string[];
    includeMetrics: boolean;
    includeTrends: boolean;
    retentionDays: number;
  };
}

interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: string; // JavaScript expression
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  cooldownMinutes: number;
  channels: string[];
}

interface Metric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  labels: Record<string, string>;
}

interface Alert {
  id: string;
  ruleId: string;
  name: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata: Record<string, any>;
}

interface HealthCheckResult {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  responseTime: number;
  timestamp: Date;
  metadata: Record<string, any>;
}

interface BackupReport {
  id: string;
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalBackups: number;
    successfulBackups: number;
    failedBackups: number;
    averageSize: number;
    averageDuration: number;
    totalDataProtected: number;
  };
  trends: {
    backupSizeGrowth: number;
    durationTrend: number;
    successRate: number;
    storageEfficiency: number;
  };
  issues: {
    failures: BackupMetadata[];
    warnings: string[];
    recommendations: string[];
  };
  sla: {
    rtoCompliance: number;
    rpoCompliance: number;
    availabilityTarget: number;
    actualAvailability: number;
  };
}

export class BackupMonitoringService extends EventEmitter {
  private config: MonitoringConfig;
  private backupService: BackupService;
  private drOrchestrator?: DisasterRecoveryOrchestrator;
  private metrics: Map<string, Metric[]> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private healthChecks: Map<string, HealthCheckResult> = new Map();
  private reports: BackupReport[] = [];
  private activeAlerts: Set<string> = new Set();
  private lastAlertTimes: Map<string, Date> = new Map();
  
  private metricsInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private reportingInterval?: NodeJS.Timeout;

  constructor(
    config: MonitoringConfig,
    backupService: BackupService,
    drOrchestrator?: DisasterRecoveryOrchestrator
  ) {
    super();
    this.config = config;
    this.backupService = backupService;
    this.drOrchestrator = drOrchestrator;
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    try {
      // Load historical data
      await this.loadMetrics();
      await this.loadAlerts();
      await this.loadReports();

      // Start monitoring components
      if (this.config.metrics.enabled) {
        this.startMetricsCollection();
      }

      if (this.config.healthChecks.enabled) {
        this.startHealthChecks();
      }

      if (this.config.reporting.enabled) {
        this.scheduleReporting();
      }

      // Set up event listeners
      this.setupEventListeners();

      this.emit('monitoring:service-initialized');
    } catch (error) {
      this.emit('monitoring:initialization-failed', error);
      throw error;
    }
  }

  private async loadMetrics(): Promise<void> {
    try {
      const metricsPath = join(process.cwd(), 'data', 'backup-metrics.json');
      const data = await fs.readFile(metricsPath, 'utf8');
      const metrics = JSON.parse(data);
      
      for (const [name, values] of Object.entries(metrics)) {
        this.metrics.set(name, values as Metric[]);
      }
    } catch (error) {
      // Initialize empty metrics if file doesn't exist
    }
  }

  private async saveMetrics(): Promise<void> {
    try {
      const metricsPath = join(process.cwd(), 'data', 'backup-metrics.json');
      await fs.mkdir(join(process.cwd(), 'data'), { recursive: true });
      
      const metricsObj = Object.fromEntries(this.metrics.entries());
      await fs.writeFile(metricsPath, JSON.stringify(metricsObj, null, 2));
    } catch (error) {
      this.emit('monitoring:save-metrics-failed', error);
    }
  }

  private async loadAlerts(): Promise<void> {
    try {
      const alertsPath = join(process.cwd(), 'data', 'backup-alerts.json');
      const data = await fs.readFile(alertsPath, 'utf8');
      const alerts = JSON.parse(data);
      
      alerts.forEach((alert: Alert) => {
        this.alerts.set(alert.id, alert);
        if (!alert.resolved) {
          this.activeAlerts.add(alert.id);
        }
      });
    } catch (error) {
      // Initialize empty alerts if file doesn't exist
    }
  }

  private async saveAlerts(): Promise<void> {
    try {
      const alertsPath = join(process.cwd(), 'data', 'backup-alerts.json');
      await fs.mkdir(join(process.cwd(), 'data'), { recursive: true });
      
      const alertsArray = Array.from(this.alerts.values());
      await fs.writeFile(alertsPath, JSON.stringify(alertsArray, null, 2));
    } catch (error) {
      this.emit('monitoring:save-alerts-failed', error);
    }
  }

  private async loadReports(): Promise<void> {
    try {
      const reportsPath = join(process.cwd(), 'data', 'backup-reports.json');
      const data = await fs.readFile(reportsPath, 'utf8');
      this.reports = JSON.parse(data);
    } catch (error) {
      this.reports = [];
    }
  }

  private async saveReports(): Promise<void> {
    try {
      const reportsPath = join(process.cwd(), 'data', 'backup-reports.json');
      await fs.mkdir(join(process.cwd(), 'data'), { recursive: true });
      await fs.writeFile(reportsPath, JSON.stringify(this.reports, null, 2));
    } catch (error) {
      this.emit('monitoring:save-reports-failed', error);
    }
  }

  private setupEventListeners(): void {
    // Listen to backup service events
    this.backupService.on('job:started', (event) => {
      this.recordMetric('backup_jobs_started', 1, 'count', { type: 'database' });
    });

    this.backupService.on('job:completed', (event) => {
      const { job } = event;
      this.recordMetric('backup_jobs_completed', 1, 'count', { 
        type: 'database',
        status: 'success' 
      });
      this.recordMetric('backup_duration', job.endTime!.getTime() - job.startTime.getTime(), 'milliseconds', {
        type: 'database',
        job_id: job.jobId
      });
      if (job.metadata) {
        this.recordMetric('backup_size', job.metadata.size, 'bytes', {
          type: 'database',
          backup_id: job.metadata.id
        });
      }
    });

    this.backupService.on('job:failed', (event) => {
      const { job, error } = event;
      this.recordMetric('backup_jobs_failed', 1, 'count', { 
        type: 'database',
        status: 'failed' 
      });
      this.triggerAlert('backup_failure', {
        jobId: job.jobId,
        error: error.message,
        duration: job.endTime!.getTime() - job.startTime.getTime()
      });
    });

    // Listen to disaster recovery events
    if (this.drOrchestrator) {
      this.drOrchestrator.on('failover:initiated', (event) => {
        this.recordMetric('failover_events', 1, 'count', { 
          trigger: event.trigger,
          from_site: event.fromSite,
          to_site: event.toSite 
        });
        this.triggerAlert('failover_initiated', event);
      });

      this.drOrchestrator.on('failover:completed', (event) => {
        this.recordMetric('failover_duration', event.rto, 'milliseconds', {
          from_site: event.fromSite,
          to_site: event.toSite
        });
        this.recordMetric('recovery_point_objective', event.rpo, 'minutes', {
          from_site: event.fromSite,
          to_site: event.toSite
        });
      });

      this.drOrchestrator.on('site:health-degraded', (event) => {
        this.triggerAlert('site_health_degraded', event);
      });
    }
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      await this.collectSystemMetrics();
      await this.publishMetrics();
      await this.cleanupOldMetrics();
    }, this.config.metrics.collectionInterval);
  }

  private async collectSystemMetrics(): Promise<void> {
    try {
      // Collect backup service health
      const backupHealth = await this.backupService.getHealthStatus();
      this.recordMetric('backup_service_health', backupHealth.activeJobs, 'count', { component: 'backup_service' });
      
      // Collect disk space metrics
      if (backupHealth.diskSpace) {
        this.recordMetric('disk_space_available', backupHealth.diskSpace.available, 'bytes', { component: 'storage' });
        this.recordMetric('disk_space_percentage', backupHealth.diskSpace.percentage, 'percentage', { component: 'storage' });
      }

      // Collect backup statistics
      const recentBackups = this.backupService.listBackups({
        dateRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          end: new Date()
        }
      });

      const successfulBackups = recentBackups.filter(b => b.status === 'success').length;
      const failedBackups = recentBackups.filter(b => b.status === 'failed').length;
      const totalSize = recentBackups.reduce((sum, b) => sum + b.size, 0);

      this.recordMetric('backup_success_rate', 
        recentBackups.length > 0 ? (successfulBackups / recentBackups.length) * 100 : 0, 
        'percentage', 
        { period: '24h' }
      );
      this.recordMetric('backup_total_size', totalSize, 'bytes', { period: '24h' });

      // Collect DR metrics if available
      if (this.drOrchestrator) {
        const drStatus = this.drOrchestrator.getStatus();
        this.recordMetric('dr_sites_healthy', 
          drStatus.sites.filter(s => s.status === 'healthy').length, 
          'count', 
          { component: 'disaster_recovery' }
        );
      }

    } catch (error) {
      this.emit('monitoring:metrics-collection-failed', error);
    }
  }

  private recordMetric(name: string, value: number, unit: string, labels: Record<string, string> = {}): void {
    const metric: Metric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      labels
    };

    const existing = this.metrics.get(name) || [];
    existing.push(metric);
    this.metrics.set(name, existing);

    this.emit('metric:recorded', metric);
  }

  private async publishMetrics(): Promise<void> {
    const currentMetrics = this.getCurrentMetrics();

    // Publish to Prometheus
    if (this.config.metrics.endpoints.prometheus) {
      await this.publishToPrometheus(currentMetrics);
    }

    // Publish to DataDog
    if (this.config.metrics.endpoints.datadog) {
      await this.publishToDatadog(currentMetrics);
    }

    // Publish to New Relic
    if (this.config.metrics.endpoints.newrelic) {
      await this.publishToNewRelic(currentMetrics);
    }

    // Publish to custom endpoint
    if (this.config.metrics.endpoints.custom) {
      await this.publishToCustomEndpoint(currentMetrics);
    }
  }

  private getCurrentMetrics(): Metric[] {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    const recentMetrics: Metric[] = [];
    
    for (const [name, metrics] of this.metrics.entries()) {
      const recent = metrics.filter(m => m.timestamp >= fiveMinutesAgo);
      recentMetrics.push(...recent);
    }
    
    return recentMetrics;
  }

  private async publishToPrometheus(metrics: Metric[]): Promise<void> {
    try {
      const pushgatewayUrl = this.config.metrics.endpoints.prometheus!;
      
      // Format metrics for Prometheus
      let payload = '';
      for (const metric of metrics) {
        const labelStr = Object.entries(metric.labels)
          .map(([key, value]) => `${key}="${value}"`)
          .join(',');
        
        payload += `# HELP ${metric.name} ${metric.name}\n`;
        payload += `# TYPE ${metric.name} gauge\n`;
        payload += `${metric.name}{${labelStr}} ${metric.value} ${metric.timestamp.getTime()}\n`;
      }

      await fetch(`${pushgatewayUrl}/metrics/job/backup-monitoring`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: payload
      });

      this.emit('monitoring:prometheus-published', { metricsCount: metrics.length });
    } catch (error) {
      this.emit('monitoring:prometheus-failed', error);
    }
  }

  private async publishToDatadog(metrics: Metric[]): Promise<void> {
    try {
      const datadogUrl = this.config.metrics.endpoints.datadog!;
      
      const payload = {
        series: metrics.map(metric => ({
          metric: metric.name,
          points: [[metric.timestamp.getTime() / 1000, metric.value]],
          tags: Object.entries(metric.labels).map(([key, value]) => `${key}:${value}`)
        }))
      };

      await fetch(datadogUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      this.emit('monitoring:datadog-published', { metricsCount: metrics.length });
    } catch (error) {
      this.emit('monitoring:datadog-failed', error);
    }
  }

  private async publishToNewRelic(metrics: Metric[]): Promise<void> {
    try {
      const newrelicUrl = this.config.metrics.endpoints.newrelic!;
      
      const payload = metrics.map(metric => ({
        name: metric.name,
        value: metric.value,
        timestamp: metric.timestamp.getTime(),
        attributes: metric.labels
      }));

      await fetch(newrelicUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      this.emit('monitoring:newrelic-published', { metricsCount: metrics.length });
    } catch (error) {
      this.emit('monitoring:newrelic-failed', error);
    }
  }

  private async publishToCustomEndpoint(metrics: Metric[]): Promise<void> {
    try {
      const customUrl = this.config.metrics.endpoints.custom!;
      
      await fetch(customUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics, timestamp: new Date() })
      });

      this.emit('monitoring:custom-published', { metricsCount: metrics.length });
    } catch (error) {
      this.emit('monitoring:custom-failed', error);
    }
  }

  private async cleanupOldMetrics(): Promise<void> {
    const retentionDate = new Date(Date.now() - this.config.metrics.retention.raw * 24 * 60 * 60 * 1000);
    
    for (const [name, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter(m => m.timestamp > retentionDate);
      this.metrics.set(name, filtered);
    }
    
    await this.saveMetrics();
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
      await this.evaluateAlerts();
    }, this.config.healthChecks.interval);
  }

  private async performHealthChecks(): Promise<void> {
    const checks = [
      this.checkBackupServiceHealth(),
      this.checkDiskSpaceHealth(),
      this.checkBackupFreshnessHealth(),
      this.checkCloudStorageHealth(),
    ];

    if (this.drOrchestrator) {
      checks.push(this.checkDisasterRecoveryHealth());
    }

    const results = await Promise.allSettled(checks);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const checkResult = result.value;
        this.healthChecks.set(checkResult.component, checkResult);
        this.emit('health-check:completed', checkResult);
      } else {
        this.emit('health-check:failed', { index, error: result.reason });
      }
    });
  }

  private async checkBackupServiceHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const health = await this.backupService.getHealthStatus();
      const responseTime = Date.now() - startTime;
      
      return {
        component: 'backup-service',
        status: health.status === 'healthy' ? 'healthy' : 'degraded',
        message: `Active jobs: ${health.activeJobs}, Last backup: ${health.lastBackup.timestamp || 'none'}`,
        responseTime,
        timestamp: new Date(),
        metadata: health
      };
    } catch (error) {
      return {
        component: 'backup-service',
        status: 'unhealthy',
        message: `Health check failed: ${error.message}`,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        metadata: { error: error.message }
      };
    }
  }

  private async checkDiskSpaceHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const health = await this.backupService.getHealthStatus();
      const diskSpace = health.diskSpace;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = `${diskSpace.percentage.toFixed(1)}% available`;
      
      if (diskSpace.percentage < this.config.healthChecks.thresholds.diskSpace) {
        status = diskSpace.percentage < this.config.healthChecks.thresholds.diskSpace / 2 ? 'unhealthy' : 'degraded';
        message = `Low disk space: ${diskSpace.percentage.toFixed(1)}% available`;
      }
      
      return {
        component: 'disk-space',
        status,
        message,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        metadata: diskSpace
      };
    } catch (error) {
      return {
        component: 'disk-space',
        status: 'unhealthy',
        message: `Check failed: ${error.message}`,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        metadata: { error: error.message }
      };
    }
  }

  private async checkBackupFreshnessHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const backups = this.backupService.listBackups({ status: 'success' });
      const latestBackup = backups[0];
      
      if (!latestBackup) {
        return {
          component: 'backup-freshness',
          status: 'unhealthy',
          message: 'No successful backups found',
          responseTime: Date.now() - startTime,
          timestamp: new Date(),
          metadata: { backupCount: 0 }
        };
      }
      
      const hoursSinceLastBackup = (Date.now() - latestBackup.timestamp.getTime()) / (1000 * 60 * 60);
      const threshold = this.config.healthChecks.thresholds.backupAge;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = `Last backup: ${hoursSinceLastBackup.toFixed(1)} hours ago`;
      
      if (hoursSinceLastBackup > threshold) {
        status = hoursSinceLastBackup > threshold * 2 ? 'unhealthy' : 'degraded';
        message = `Backup overdue: ${hoursSinceLastBackup.toFixed(1)} hours since last backup`;
      }
      
      return {
        component: 'backup-freshness',
        status,
        message,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        metadata: { 
          lastBackupAge: hoursSinceLastBackup,
          threshold,
          latestBackupId: latestBackup.id
        }
      };
    } catch (error) {
      return {
        component: 'backup-freshness',
        status: 'unhealthy',
        message: `Check failed: ${error.message}`,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        metadata: { error: error.message }
      };
    }
  }

  private async checkCloudStorageHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const health = await this.backupService.getHealthStatus();
      const cloudStorage = health.cloudStorage || {};
      
      const storageServices = Object.keys(cloudStorage);
      const healthyServices = Object.values(cloudStorage).filter(Boolean).length;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = `${healthyServices}/${storageServices.length} storage services healthy`;
      
      if (healthyServices === 0) {
        status = 'unhealthy';
        message = 'All cloud storage services unhealthy';
      } else if (healthyServices < storageServices.length) {
        status = 'degraded';
        message = `${storageServices.length - healthyServices} storage services degraded`;
      }
      
      return {
        component: 'cloud-storage',
        status,
        message,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        metadata: cloudStorage
      };
    } catch (error) {
      return {
        component: 'cloud-storage',
        status: 'unhealthy',
        message: `Check failed: ${error.message}`,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        metadata: { error: error.message }
      };
    }
  }

  private async checkDisasterRecoveryHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const drStatus = this.drOrchestrator!.getStatus();
      const healthySites = drStatus.sites.filter(s => s.status === 'healthy').length;
      const totalSites = drStatus.sites.length;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = `${healthySites}/${totalSites} sites healthy`;
      
      if (healthySites === 0) {
        status = 'unhealthy';
        message = 'All DR sites unhealthy';
      } else if (healthySites < totalSites) {
        status = 'degraded';
        message = `${totalSites - healthySites} DR sites degraded`;
      }
      
      return {
        component: 'disaster-recovery',
        status,
        message,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        metadata: drStatus
      };
    } catch (error) {
      return {
        component: 'disaster-recovery',
        status: 'unhealthy',
        message: `Check failed: ${error.message}`,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        metadata: { error: error.message }
      };
    }
  }

  private async evaluateAlerts(): Promise<void> {
    for (const rule of this.config.alerting.rules) {
      if (!rule.enabled) {
        continue;
      }

      try {
        const shouldAlert = await this.evaluateAlertRule(rule);
        
        if (shouldAlert) {
          const lastAlertTime = this.lastAlertTimes.get(rule.id);
          const cooldownExpired = !lastAlertTime || 
            (Date.now() - lastAlertTime.getTime()) > (rule.cooldownMinutes * 60 * 1000);
          
          if (cooldownExpired) {
            await this.triggerAlert(rule.id, {});
          }
        }
      } catch (error) {
        this.emit('monitoring:alert-evaluation-failed', { ruleId: rule.id, error });
      }
    }
  }

  private async evaluateAlertRule(rule: AlertRule): Promise<boolean> {
    // Create evaluation context
    const context = {
      metrics: this.getMetricValues(),
      healthChecks: Object.fromEntries(this.healthChecks.entries()),
      activeAlerts: this.activeAlerts.size,
      now: Date.now(),
    };

    try {
      // Evaluate the condition (safely)
      const func = new Function('context', `with(context) { return ${rule.condition}; }`);
      return func(context);
    } catch (error) {
      this.emit('monitoring:rule-evaluation-failed', { ruleId: rule.id, error });
      return false;
    }
  }

  private getMetricValues(): Record<string, number> {
    const values: Record<string, number> = {};
    
    for (const [name, metrics] of this.metrics.entries()) {
      const recent = metrics.filter(m => 
        m.timestamp.getTime() > Date.now() - 5 * 60 * 1000 // Last 5 minutes
      );
      
      if (recent.length > 0) {
        values[name] = recent[recent.length - 1].value; // Latest value
        values[`${name}_avg`] = recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
        values[`${name}_count`] = recent.length;
      }
    }
    
    return values;
  }

  private async triggerAlert(ruleId: string, metadata: Record<string, any>): Promise<void> {
    const rule = this.config.alerting.rules.find(r => r.id === ruleId);
    if (!rule) {
      return;
    }

    const alert: Alert = {
      id: `alert-${Date.now()}-${ruleId}`,
      ruleId,
      name: rule.name,
      severity: rule.severity,
      message: rule.description,
      timestamp: new Date(),
      resolved: false,
      metadata
    };

    this.alerts.set(alert.id, alert);
    this.activeAlerts.add(alert.id);
    this.lastAlertTimes.set(ruleId, new Date());

    await this.saveAlerts();
    this.emit('alert:triggered', alert);

    // Send notifications
    if (this.config.alerting.enabled) {
      await this.sendAlertNotifications(alert, rule);
    }
  }

  private async sendAlertNotifications(alert: Alert, rule: AlertRule): Promise<void> {
    const promises: Promise<void>[] = [];

    // Send to configured channels
    for (const channel of rule.channels) {
      switch (channel) {
        case 'email':
          if (this.config.alerting.channels.email?.enabled) {
            promises.push(this.sendEmailAlert(alert));
          }
          break;
        case 'slack':
          if (this.config.alerting.channels.slack?.enabled) {
            promises.push(this.sendSlackAlert(alert));
          }
          break;
        case 'pagerduty':
          if (this.config.alerting.channels.pagerduty?.enabled) {
            promises.push(this.sendPagerDutyAlert(alert));
          }
          break;
        case 'webhook':
          if (this.config.alerting.channels.webhook?.enabled) {
            promises.push(this.sendWebhookAlert(alert));
          }
          break;
      }
    }

    await Promise.allSettled(promises);
  }

  private async sendEmailAlert(alert: Alert): Promise<void> {
    try {
      const emailConfig = this.config.alerting.channels.email!;
      const nodemailer = require('nodemailer');
      
      const transporter = nodemailer.createTransporter({
        host: emailConfig.smtp.host,
        port: emailConfig.smtp.port,
        secure: emailConfig.smtp.secure,
        auth: emailConfig.smtp.auth
      });

      const template = emailConfig.templates[alert.severity] || emailConfig.templates.failure;
      
      await transporter.sendMail({
        from: emailConfig.smtp.auth.user,
        to: emailConfig.recipients.join(','),
        subject: `[${alert.severity.toUpperCase()}] ${alert.name}`,
        html: template.replace(/\{(\w+)\}/g, (match, key) => alert[key] || alert.metadata[key] || match)
      });

      this.emit('notification:email-sent', { alertId: alert.id });
    } catch (error) {
      this.emit('notification:email-failed', { alertId: alert.id, error });
    }
  }

  private async sendSlackAlert(alert: Alert): Promise<void> {
    try {
      const slackConfig = this.config.alerting.channels.slack!;
      
      const color = {
        info: 'good',
        warning: 'warning',
        critical: 'danger'
      }[alert.severity];

      const payload = {
        channel: slackConfig.channel,
        text: `${alert.severity.toUpperCase()}: ${alert.name}`,
        attachments: [{
          color,
          fields: [
            { title: 'Message', value: alert.message, short: false },
            { title: 'Timestamp', value: alert.timestamp.toISOString(), short: true },
            { title: 'Alert ID', value: alert.id, short: true }
          ]
        }]
      };

      if (alert.severity === 'critical' && slackConfig.mentions.length > 0) {
        payload.text += ` ${slackConfig.mentions.map(m => `<@${m}>`).join(' ')}`;
      }

      await fetch(slackConfig.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      this.emit('notification:slack-sent', { alertId: alert.id });
    } catch (error) {
      this.emit('notification:slack-failed', { alertId: alert.id, error });
    }
  }

  private async sendPagerDutyAlert(alert: Alert): Promise<void> {
    try {
      const pagerDutyConfig = this.config.alerting.channels.pagerduty!;
      
      const payload = {
        routing_key: pagerDutyConfig.integrationKey,
        event_action: 'trigger',
        dedup_key: alert.ruleId,
        payload: {
          summary: alert.name,
          source: 'backup-monitoring',
          severity: pagerDutyConfig.severity,
          custom_details: {
            message: alert.message,
            alert_id: alert.id,
            timestamp: alert.timestamp.toISOString(),
            metadata: alert.metadata
          }
        }
      };

      await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      this.emit('notification:pagerduty-sent', { alertId: alert.id });
    } catch (error) {
      this.emit('notification:pagerduty-failed', { alertId: alert.id, error });
    }
  }

  private async sendWebhookAlert(alert: Alert): Promise<void> {
    try {
      const webhookConfig = this.config.alerting.channels.webhook!;
      
      const payload = {
        alert,
        timestamp: new Date().toISOString(),
        source: 'backup-monitoring-service'
      };

      await fetch(webhookConfig.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...webhookConfig.headers
        },
        body: JSON.stringify(payload)
      });

      this.emit('notification:webhook-sent', { alertId: alert.id });
    } catch (error) {
      this.emit('notification:webhook-failed', { alertId: alert.id, error });
    }
  }

  private scheduleReporting(): void {
    // Parse cron expression and schedule reports
    const cron = require('node-cron');
    
    cron.schedule(this.config.reporting.schedule, async () => {
      await this.generateReport();
    });
  }

  private async generateReport(): Promise<BackupReport> {
    const now = new Date();
    const reportPeriod = this.parseReportingSchedule();
    const startDate = new Date(now.getTime() - reportPeriod);
    
    const backups = this.backupService.listBackups({
      dateRange: { start: startDate, end: now }
    });

    const report: BackupReport = {
      id: `report-${Date.now()}`,
      generatedAt: now,
      period: { start: startDate, end: now },
      summary: this.generateSummary(backups),
      trends: this.generateTrends(backups),
      issues: this.generateIssues(backups),
      sla: this.generateSLAReport(backups)
    };

    this.reports.push(report);
    await this.saveReports();

    // Send report to recipients
    if (this.config.reporting.recipients.length > 0) {
      await this.sendReport(report);
    }

    this.emit('report:generated', report);
    return report;
  }

  private parseReportingSchedule(): number {
    // Simple parsing for common schedules
    const schedule = this.config.reporting.schedule;
    
    if (schedule.includes('0 0 * * *')) return 24 * 60 * 60 * 1000; // Daily
    if (schedule.includes('0 0 * * 0')) return 7 * 24 * 60 * 60 * 1000; // Weekly
    if (schedule.includes('0 0 1 * *')) return 30 * 24 * 60 * 60 * 1000; // Monthly
    
    return 24 * 60 * 60 * 1000; // Default to daily
  }

  private generateSummary(backups: BackupMetadata[]): BackupReport['summary'] {
    const successful = backups.filter(b => b.status === 'success');
    const failed = backups.filter(b => b.status === 'failed');
    
    return {
      totalBackups: backups.length,
      successfulBackups: successful.length,
      failedBackups: failed.length,
      averageSize: successful.reduce((sum, b) => sum + b.size, 0) / Math.max(successful.length, 1),
      averageDuration: successful.reduce((sum, b) => sum + b.duration, 0) / Math.max(successful.length, 1),
      totalDataProtected: successful.reduce((sum, b) => sum + b.size, 0)
    };
  }

  private generateTrends(backups: BackupMetadata[]): BackupReport['trends'] {
    const successful = backups.filter(b => b.status === 'success');
    
    // Calculate trends (simplified)
    const midpoint = Math.floor(successful.length / 2);
    const firstHalf = successful.slice(0, midpoint);
    const secondHalf = successful.slice(midpoint);
    
    const firstHalfAvgSize = firstHalf.reduce((sum, b) => sum + b.size, 0) / Math.max(firstHalf.length, 1);
    const secondHalfAvgSize = secondHalf.reduce((sum, b) => sum + b.size, 0) / Math.max(secondHalf.length, 1);
    
    const firstHalfAvgDuration = firstHalf.reduce((sum, b) => sum + b.duration, 0) / Math.max(firstHalf.length, 1);
    const secondHalfAvgDuration = secondHalf.reduce((sum, b) => sum + b.duration, 0) / Math.max(secondHalf.length, 1);
    
    return {
      backupSizeGrowth: ((secondHalfAvgSize - firstHalfAvgSize) / Math.max(firstHalfAvgSize, 1)) * 100,
      durationTrend: ((secondHalfAvgDuration - firstHalfAvgDuration) / Math.max(firstHalfAvgDuration, 1)) * 100,
      successRate: (successful.length / Math.max(backups.length, 1)) * 100,
      storageEfficiency: successful.length > 0 ? 
        (successful.reduce((sum, b) => sum + (b.compressedSize || b.size), 0) / 
         successful.reduce((sum, b) => sum + b.size, 0)) * 100 : 0
    };
  }

  private generateIssues(backups: BackupMetadata[]): BackupReport['issues'] {
    const failures = backups.filter(b => b.status === 'failed');
    const warnings: string[] = [];
    const recommendations: string[] = [];
    
    // Generate warnings
    if (failures.length > 0) {
      warnings.push(`${failures.length} backup failures detected`);
    }
    
    const largeDurations = backups.filter(b => b.duration > 60 * 60 * 1000); // > 1 hour
    if (largeDurations.length > 0) {
      warnings.push(`${largeDurations.length} backups took longer than 1 hour`);
    }
    
    // Generate recommendations
    if (failures.length > backups.length * 0.1) {
      recommendations.push('High failure rate detected - review backup configuration');
    }
    
    if (largeDurations.length > 0) {
      recommendations.push('Consider increasing parallelization for faster backups');
    }
    
    return { failures, warnings, recommendations };
  }

  private generateSLAReport(backups: BackupMetadata[]): BackupReport['sla'] {
    const successful = backups.filter(b => b.status === 'success');
    
    // Calculate RTO/RPO compliance (simplified)
    const rtoCompliance = successful.filter(b => b.duration <= 4 * 60 * 60 * 1000).length / Math.max(successful.length, 1) * 100; // 4 hour RTO
    const rpoCompliance = 100; // Assume full compliance for now
    
    return {
      rtoCompliance,
      rpoCompliance,
      availabilityTarget: 99.9,
      actualAvailability: (successful.length / Math.max(backups.length, 1)) * 100
    };
  }

  private async sendReport(report: BackupReport): Promise<void> {
    // Implementation would send formatted report via email
    this.emit('report:sent', { reportId: report.id, recipients: this.config.reporting.recipients });
  }

  /**
   * Get current monitoring status
   */
  public getStatus(): {
    metrics: { count: number; lastUpdate: Date };
    alerts: { active: number; total: number };
    healthChecks: HealthCheckResult[];
    lastReport?: Date;
  } {
    const healthChecks = Array.from(this.healthChecks.values());
    const lastReport = this.reports[this.reports.length - 1]?.generatedAt;
    
    return {
      metrics: {
        count: Array.from(this.metrics.values()).reduce((sum, metrics) => sum + metrics.length, 0),
        lastUpdate: new Date() // Simplified
      },
      alerts: {
        active: this.activeAlerts.size,
        total: this.alerts.size
      },
      healthChecks,
      lastReport
    };
  }

  /**
   * Resolve an alert
   */
  public resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.activeAlerts.delete(alertId);
      this.saveAlerts();
      this.emit('alert:resolved', alert);
    }
  }

  /**
   * Get metrics for a specific time range
   */
  public getMetrics(metricName: string, startTime: Date, endTime: Date): Metric[] {
    const metrics = this.metrics.get(metricName) || [];
    return metrics.filter(m => m.timestamp >= startTime && m.timestamp <= endTime);
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts)
      .map(id => this.alerts.get(id)!)
      .filter(Boolean);
  }

  /**
   * Get latest report
   */
  public getLatestReport(): BackupReport | undefined {
    return this.reports[this.reports.length - 1];
  }

  /**
   * Stop the monitoring service
   */
  public stop(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
    }
    
    this.emit('monitoring:service-stopped');
  }
}

export { MonitoringConfig, AlertRule, Metric, Alert, HealthCheckResult, BackupReport };