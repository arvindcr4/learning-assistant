/**
 * Backup Monitoring and Alerting System
 * Learning Assistant - Real-time Backup Health Monitoring
 * Version: 2.0.0
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { createHash } from 'crypto';

// Types
interface BackupMetrics {
  timestamp: Date;
  backupId: string;
  type: 'database' | 'application' | 'full';
  status: 'success' | 'failed' | 'running' | 'warning';
  duration: number;
  size: number;
  compressionRatio: number;
  errorCount: number;
  warningCount: number;
  rto: number; // Recovery Time Objective in seconds
  rpo: number; // Recovery Point Objective in seconds
}

interface BackupHealthStatus {
  overall: 'healthy' | 'degraded' | 'critical';
  lastBackup: Date | null;
  consecutiveFailures: number;
  averageDuration: number;
  averageSize: number;
  uptimePercentage: number;
  trends: {
    duration: 'improving' | 'stable' | 'degrading';
    size: 'improving' | 'stable' | 'degrading';
    reliability: 'improving' | 'stable' | 'degrading';
  };
}

interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: (metrics: BackupMetrics[], health: BackupHealthStatus) => boolean;
  severity: 'info' | 'warning' | 'error' | 'critical';
  cooldown: number; // Minutes between identical alerts
  enabled: boolean;
}

interface NotificationChannel {
  type: 'slack' | 'discord' | 'email' | 'webhook' | 'pagerduty';
  config: Record<string, any>;
  enabled: boolean;
  severityFilter: string[];
}

interface BackupMonitorConfig {
  backupDirectory: string;
  monitoringInterval: number; // Minutes
  metricsRetention: number; // Days
  healthCheckInterval: number; // Minutes
  alertRules: AlertRule[];
  notificationChannels: NotificationChannel[];
  thresholds: {
    maxBackupAge: number; // Hours
    maxBackupDuration: number; // Minutes
    minCompressionRatio: number;
    maxConsecutiveFailures: number;
    minUptimePercentage: number;
  };
}

/**
 * Backup Monitoring System
 * Provides real-time monitoring, alerting, and health tracking for backup operations
 */
export class BackupMonitor extends EventEmitter {
  private config: BackupMonitorConfig;
  private metricsHistory: BackupMetrics[] = [];
  private activeAlerts: Map<string, Date> = new Map();
  private healthStatus: BackupHealthStatus;
  private monitoringInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private isRunning = false;

  constructor(config: Partial<BackupMonitorConfig> = {}) {
    super();
    
    this.config = {
      backupDirectory: process.env.BACKUP_DIR || '/var/backups/learning-assistant',
      monitoringInterval: 5, // Check every 5 minutes
      metricsRetention: 30, // Keep 30 days of metrics
      healthCheckInterval: 15, // Health check every 15 minutes
      alertRules: this.getDefaultAlertRules(),
      notificationChannels: this.getDefaultNotificationChannels(),
      thresholds: {
        maxBackupAge: 25, // 25 hours
        maxBackupDuration: 120, // 2 hours
        minCompressionRatio: 0.3, // 30% compression
        maxConsecutiveFailures: 3,
        minUptimePercentage: 95, // 95%
      },
      ...config,
    };

    this.healthStatus = {
      overall: 'healthy',
      lastBackup: null,
      consecutiveFailures: 0,
      averageDuration: 0,
      averageSize: 0,
      uptimePercentage: 100,
      trends: {
        duration: 'stable',
        size: 'stable',
        reliability: 'stable',
      },
    };

    this.setupEventHandlers();
  }

  /**
   * Start backup monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    console.log('🔍 Starting backup monitoring system...');
    
    try {
      await this.loadHistoricalMetrics();
      this.calculateHealthStatus();
      
      // Start monitoring intervals
      this.monitoringInterval = setInterval(
        () => this.checkBackups(),
        this.config.monitoringInterval * 60 * 1000
      );
      
      this.healthCheckInterval = setInterval(
        () => this.performHealthCheck(),
        this.config.healthCheckInterval * 60 * 1000
      );
      
      this.isRunning = true;
      
      // Initial checks
      await this.checkBackups();
      await this.performHealthCheck();
      
      this.emit('started');
      console.log('✅ Backup monitoring system started successfully');
      
    } catch (error) {
      console.error('❌ Failed to start backup monitoring:', error);
      throw error;
    }
  }

  /**
   * Stop backup monitoring
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping backup monitoring system...');
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    await this.saveMetrics();
    
    this.isRunning = false;
    this.emit('stopped');
    
    console.log('✅ Backup monitoring system stopped');
  }

  /**
   * Get current health status
   */
  getHealthStatus(): BackupHealthStatus {
    return { ...this.healthStatus };
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(hours = 24): BackupMetrics[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metricsHistory.filter(metric => metric.timestamp >= cutoff);
  }

  /**
   * Force a backup check
   */
  async forceCheck(): Promise<void> {
    await this.checkBackups();
    await this.performHealthCheck();
  }

  /**
   * Add custom alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.config.alertRules.push(rule);
    console.log(`📋 Added alert rule: ${rule.name}`);
  }

  /**
   * Add notification channel
   */
  addNotificationChannel(channel: NotificationChannel): void {
    this.config.notificationChannels.push(channel);
    console.log(`📢 Added notification channel: ${channel.type}`);
  }

  /**
   * Check for new backups and analyze them
   */
  private async checkBackups(): Promise<void> {
    try {
      const backupFiles = await this.discoverBackupFiles();
      
      for (const backupFile of backupFiles) {
        const metrics = await this.analyzeBackup(backupFile);
        if (metrics && !this.isDuplicateMetric(metrics)) {
          this.metricsHistory.push(metrics);
          this.emit('newBackup', metrics);
          
          // Check alert rules for this backup
          await this.evaluateAlertRules([metrics]);
        }
      }
      
      // Clean up old metrics
      this.cleanupOldMetrics();
      
    } catch (error) {
      console.error('❌ Error checking backups:', error);
      this.emit('error', error);
    }
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      this.calculateHealthStatus();
      
      // Check all alert rules
      await this.evaluateAlertRules(this.metricsHistory);
      
      // Emit health status
      this.emit('healthCheck', this.healthStatus);
      
      // Save metrics periodically
      await this.saveMetrics();
      
    } catch (error) {
      console.error('❌ Error performing health check:', error);
      this.emit('error', error);
    }
  }

  /**
   * Discover backup files in the backup directory
   */
  private async discoverBackupFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.config.backupDirectory);
      
      return files.filter(file => 
        (file.includes('_backup_') || file.includes('_report.json')) &&
        !file.includes('verification') &&
        !file.includes('recovery')
      ).map(file => join(this.config.backupDirectory, file));
      
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
      return [];
    }
  }

  /**
   * Analyze a backup file and extract metrics
   */
  private async analyzeBackup(filePath: string): Promise<BackupMetrics | null> {
    try {
      const stats = await fs.stat(filePath);
      const fileName = filePath.split('/').pop() || '';
      
      // Skip if we've already analyzed this file
      const fileHash = createHash('md5').update(filePath + stats.mtime.toISOString()).digest('hex');
      if (this.metricsHistory.some(m => m.backupId.includes(fileHash.substring(0, 8)))) {
        return null;
      }
      
      let metrics: BackupMetrics;
      
      if (fileName.endsWith('_report.json')) {
        // Parse backup report file
        metrics = await this.parseBackupReport(filePath);
      } else {
        // Analyze backup file directly
        metrics = await this.analyzeBackupFile(filePath, stats);
      }
      
      return metrics;
      
    } catch (error) {
      console.warn(`⚠️ Failed to analyze backup file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Parse backup report JSON file
   */
  private async parseBackupReport(filePath: string): Promise<BackupMetrics> {
    const content = await fs.readFile(filePath, 'utf-8');
    const report = JSON.parse(content);
    
    const backupId = report.backup_id || report.backup_name || 'unknown';
    const timestamp = new Date(report.created_at || report.timestamp);
    
    return {
      timestamp,
      backupId,
      type: this.determineBackupType(report),
      status: this.determineBackupStatus(report),
      duration: report.performance?.backup_duration || 0,
      size: report.statistics?.total_size || report.total_size || 0,
      compressionRatio: this.calculateCompressionRatio(report),
      errorCount: 0, // Would need to parse from logs
      warningCount: 0, // Would need to parse from logs
      rto: report.performance?.recovery_time_estimate || 0,
      rpo: this.calculateRPO(timestamp),
    };
  }

  /**
   * Analyze backup file directly
   */
  private async analyzeBackupFile(filePath: string, stats: any): Promise<BackupMetrics> {
    const fileName = filePath.split('/').pop() || '';
    const timestamp = stats.mtime;
    
    // Extract backup ID from filename
    const backupIdMatch = fileName.match(/_backup_(\d{8}_\d{6})/);
    const backupId = backupIdMatch ? backupIdMatch[1] : 'unknown';
    
    return {
      timestamp,
      backupId,
      type: this.determineBackupTypeFromFilename(fileName),
      status: 'success', // Assume success if file exists
      duration: 0, // Cannot determine from file alone
      size: stats.size,
      compressionRatio: this.estimateCompressionRatio(fileName),
      errorCount: 0,
      warningCount: 0,
      rto: this.estimateRTO(stats.size),
      rpo: this.calculateRPO(timestamp),
    };
  }

  /**
   * Calculate current health status
   */
  private calculateHealthStatus(): void {
    const recent24h = this.getRecentMetrics(24);
    const recent7d = this.getRecentMetrics(24 * 7);
    
    if (recent24h.length === 0) {
      this.healthStatus.overall = 'critical';
      this.healthStatus.lastBackup = null;
      return;
    }
    
    // Calculate basic metrics
    this.healthStatus.lastBackup = recent24h[recent24h.length - 1]?.timestamp || null;
    
    const failures = recent7d.filter(m => m.status === 'failed');
    this.healthStatus.consecutiveFailures = this.getConsecutiveFailures();
    
    const successfulBackups = recent7d.filter(m => m.status === 'success');
    this.healthStatus.averageDuration = successfulBackups.length > 0 
      ? successfulBackups.reduce((sum, m) => sum + m.duration, 0) / successfulBackups.length
      : 0;
    
    this.healthStatus.averageSize = successfulBackups.length > 0
      ? successfulBackups.reduce((sum, m) => sum + m.size, 0) / successfulBackups.length
      : 0;
    
    this.healthStatus.uptimePercentage = recent7d.length > 0
      ? (successfulBackups.length / recent7d.length) * 100
      : 100;
    
    // Calculate trends
    this.healthStatus.trends = this.calculateTrends(recent7d);
    
    // Determine overall health
    this.healthStatus.overall = this.determineOverallHealth();
  }

  /**
   * Determine overall health status
   */
  private determineOverallHealth(): 'healthy' | 'degraded' | 'critical' {
    const { thresholds } = this.config;
    const now = new Date();
    
    // Critical conditions
    if (!this.healthStatus.lastBackup) {
      return 'critical';
    }
    
    const hoursSinceLastBackup = (now.getTime() - this.healthStatus.lastBackup.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceLastBackup > thresholds.maxBackupAge) {
      return 'critical';
    }
    
    if (this.healthStatus.consecutiveFailures >= thresholds.maxConsecutiveFailures) {
      return 'critical';
    }
    
    if (this.healthStatus.uptimePercentage < thresholds.minUptimePercentage) {
      return 'critical';
    }
    
    // Degraded conditions
    if (hoursSinceLastBackup > thresholds.maxBackupAge * 0.8) {
      return 'degraded';
    }
    
    if (this.healthStatus.consecutiveFailures > 0) {
      return 'degraded';
    }
    
    if (this.healthStatus.uptimePercentage < 99) {
      return 'degraded';
    }
    
    if (this.healthStatus.trends.reliability === 'degrading') {
      return 'degraded';
    }
    
    return 'healthy';
  }

  /**
   * Evaluate alert rules
   */
  private async evaluateAlertRules(metrics: BackupMetrics[]): Promise<void> {
    for (const rule of this.config.alertRules) {
      if (!rule.enabled) continue;
      
      try {
        const shouldAlert = rule.condition(metrics, this.healthStatus);
        
        if (shouldAlert && this.shouldSendAlert(rule)) {
          await this.sendAlert(rule, metrics);
          this.activeAlerts.set(rule.id, new Date());
        }
      } catch (error) {
        console.error(`❌ Error evaluating alert rule ${rule.name}:`, error);
      }
    }
  }

  /**
   * Check if alert should be sent (respecting cooldown)
   */
  private shouldSendAlert(rule: AlertRule): boolean {
    const lastAlert = this.activeAlerts.get(rule.id);
    if (!lastAlert) return true;
    
    const cooldownMs = rule.cooldown * 60 * 1000;
    return Date.now() - lastAlert.getTime() > cooldownMs;
  }

  /**
   * Send alert notification
   */
  private async sendAlert(rule: AlertRule, metrics: BackupMetrics[]): Promise<void> {
    const alert = {
      rule,
      timestamp: new Date(),
      metrics: metrics.slice(-5), // Include last 5 metrics
      healthStatus: this.healthStatus,
    };
    
    console.log(`🚨 Alert triggered: ${rule.name} (${rule.severity})`);
    
    // Send to all enabled notification channels
    const promises = this.config.notificationChannels
      .filter(channel => 
        channel.enabled && 
        channel.severityFilter.includes(rule.severity)
      )
      .map(channel => this.sendNotification(channel, alert));
    
    await Promise.allSettled(promises);
    
    this.emit('alert', alert);
  }

  /**
   * Send notification to a specific channel
   */
  private async sendNotification(channel: NotificationChannel, alert: any): Promise<void> {
    try {
      switch (channel.type) {
        case 'slack':
          await this.sendSlackNotification(channel.config, alert);
          break;
        case 'discord':
          await this.sendDiscordNotification(channel.config, alert);
          break;
        case 'email':
          await this.sendEmailNotification(channel.config, alert);
          break;
        case 'webhook':
          await this.sendWebhookNotification(channel.config, alert);
          break;
        case 'pagerduty':
          await this.sendPagerDutyNotification(channel.config, alert);
          break;
        default:
          console.warn(`⚠️ Unknown notification channel type: ${channel.type}`);
      }
    } catch (error) {
      console.error(`❌ Failed to send notification via ${channel.type}:`, error);
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(config: any, alert: any): Promise<void> {
    const { webhookUrl } = config;
    
    const color = this.getSeverityColor(alert.rule.severity);
    const icon = this.getSeverityIcon(alert.rule.severity);
    
    const payload = {
      attachments: [{
        color,
        title: `${icon} Backup Alert: ${alert.rule.name}`,
        text: alert.rule.description,
        fields: [
          {
            title: 'Severity',
            value: alert.rule.severity.toUpperCase(),
            short: true,
          },
          {
            title: 'Overall Health',
            value: this.healthStatus.overall.toUpperCase(),
            short: true,
          },
          {
            title: 'Last Backup',
            value: this.healthStatus.lastBackup 
              ? this.healthStatus.lastBackup.toISOString()
              : 'Never',
            short: true,
          },
          {
            title: 'Uptime',
            value: `${this.healthStatus.uptimePercentage.toFixed(1)}%`,
            short: true,
          },
        ],
        footer: 'Learning Assistant Backup Monitor',
        ts: Math.floor(alert.timestamp.getTime() / 1000),
      }],
    };
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`Slack notification failed: ${response.status}`);
    }
  }

  /**
   * Send Discord notification
   */
  private async sendDiscordNotification(config: any, alert: any): Promise<void> {
    const { webhookUrl } = config;
    
    const color = this.getSeverityColor(alert.rule.severity, 'discord');
    const icon = this.getSeverityIcon(alert.rule.severity);
    
    const payload = {
      embeds: [{
        title: `${icon} Backup Alert: ${alert.rule.name}`,
        description: alert.rule.description,
        color,
        fields: [
          {
            name: 'Severity',
            value: alert.rule.severity.toUpperCase(),
            inline: true,
          },
          {
            name: 'Overall Health',
            value: this.healthStatus.overall.toUpperCase(),
            inline: true,
          },
          {
            name: 'Last Backup',
            value: this.healthStatus.lastBackup 
              ? this.healthStatus.lastBackup.toISOString()
              : 'Never',
            inline: true,
          },
        ],
        timestamp: alert.timestamp.toISOString(),
        footer: {
          text: 'Learning Assistant Backup Monitor',
        },
      }],
    };
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`Discord notification failed: ${response.status}`);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(config: any, alert: any): Promise<void> {
    // Email implementation would depend on the email service being used
    console.log('📧 Email notification (not implemented):', alert.rule.name);
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(config: any, alert: any): Promise<void> {
    const { url, headers = {} } = config;
    
    const payload = {
      alert: alert.rule,
      timestamp: alert.timestamp,
      healthStatus: this.healthStatus,
      recentMetrics: alert.metrics,
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`Webhook notification failed: ${response.status}`);
    }
  }

  /**
   * Send PagerDuty notification
   */
  private async sendPagerDutyNotification(config: any, alert: any): Promise<void> {
    const { integrationKey } = config;
    
    const payload = {
      routing_key: integrationKey,
      event_action: 'trigger',
      payload: {
        summary: `Backup Alert: ${alert.rule.name}`,
        source: 'learning-assistant-backup-monitor',
        severity: alert.rule.severity,
        component: 'backup-system',
        custom_details: {
          rule_description: alert.rule.description,
          health_status: this.healthStatus.overall,
          last_backup: this.healthStatus.lastBackup,
          uptime_percentage: this.healthStatus.uptimePercentage,
        },
      },
    };
    
    const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`PagerDuty notification failed: ${response.status}`);
    }
  }

  /**
   * Get default alert rules
   */
  private getDefaultAlertRules(): AlertRule[] {
    return [
      {
        id: 'backup_failed',
        name: 'Backup Failed',
        description: 'A backup operation has failed',
        condition: (metrics) => metrics.some(m => m.status === 'failed'),
        severity: 'error',
        cooldown: 30,
        enabled: true,
      },
      {
        id: 'backup_overdue',
        name: 'Backup Overdue',
        description: 'No successful backup in the last 25 hours',
        condition: (_, health) => {
          if (!health.lastBackup) return true;
          const hours = (Date.now() - health.lastBackup.getTime()) / (1000 * 60 * 60);
          return hours > 25;
        },
        severity: 'critical',
        cooldown: 60,
        enabled: true,
      },
      {
        id: 'consecutive_failures',
        name: 'Consecutive Backup Failures',
        description: 'Multiple consecutive backup failures detected',
        condition: (_, health) => health.consecutiveFailures >= 3,
        severity: 'critical',
        cooldown: 120,
        enabled: true,
      },
      {
        id: 'low_compression',
        name: 'Poor Compression Ratio',
        description: 'Backup compression ratio is below expected threshold',
        condition: (metrics) => metrics.some(m => m.compressionRatio > 0.7),
        severity: 'warning',
        cooldown: 180,
        enabled: true,
      },
      {
        id: 'slow_backup',
        name: 'Slow Backup Performance',
        description: 'Backup taking longer than expected',
        condition: (metrics) => metrics.some(m => m.duration > 7200), // 2 hours
        severity: 'warning',
        cooldown: 60,
        enabled: true,
      },
      {
        id: 'degraded_health',
        name: 'Degraded Backup Health',
        description: 'Overall backup system health is degraded',
        condition: (_, health) => health.overall === 'degraded',
        severity: 'warning',
        cooldown: 240,
        enabled: true,
      },
    ];
  }

  /**
   * Get default notification channels
   */
  private getDefaultNotificationChannels(): NotificationChannel[] {
    const channels: NotificationChannel[] = [];
    
    if (process.env.SLACK_WEBHOOK) {
      channels.push({
        type: 'slack',
        config: { webhookUrl: process.env.SLACK_WEBHOOK },
        enabled: true,
        severityFilter: ['warning', 'error', 'critical'],
      });
    }
    
    if (process.env.DISCORD_WEBHOOK) {
      channels.push({
        type: 'discord',
        config: { webhookUrl: process.env.DISCORD_WEBHOOK },
        enabled: true,
        severityFilter: ['error', 'critical'],
      });
    }
    
    if (process.env.PAGERDUTY_INTEGRATION_KEY) {
      channels.push({
        type: 'pagerduty',
        config: { integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY },
        enabled: true,
        severityFilter: ['critical'],
      });
    }
    
    return channels;
  }

  // Helper methods
  private determineBackupType(report: any): 'database' | 'application' | 'full' {
    if (report.backup_type) return report.backup_type;
    if (report.backup_components?.database && report.backup_components?.application_data) return 'full';
    if (report.backup_components?.database) return 'database';
    return 'application';
  }

  private determineBackupTypeFromFilename(filename: string): 'database' | 'application' | 'full' {
    if (filename.includes('_full') || filename.includes('database')) return 'database';
    if (filename.includes('app_data') || filename.includes('user_data')) return 'application';
    return 'full';
  }

  private determineBackupStatus(report: any): 'success' | 'failed' | 'warning' {
    // Implementation would depend on report structure
    return 'success';
  }

  private calculateCompressionRatio(report: any): number {
    const compressed = report.statistics?.total_size || 0;
    const uncompressed = report.statistics?.uncompressed_size || compressed * 2;
    return uncompressed > 0 ? compressed / uncompressed : 0.5;
  }

  private estimateCompressionRatio(filename: string): number {
    if (filename.endsWith('.gz')) return 0.3;
    if (filename.endsWith('.backup')) return 0.4;
    return 1.0;
  }

  private calculateRPO(timestamp: Date): number {
    return (Date.now() - timestamp.getTime()) / 1000; // Seconds since backup
  }

  private estimateRTO(size: number): number {
    // Rough estimate: 100MB/min restore speed
    return Math.ceil(size / (100 * 1024 * 1024)) * 60;
  }

  private getConsecutiveFailures(): number {
    let failures = 0;
    for (let i = this.metricsHistory.length - 1; i >= 0; i--) {
      if (this.metricsHistory[i].status === 'failed') {
        failures++;
      } else {
        break;
      }
    }
    return failures;
  }

  private calculateTrends(metrics: BackupMetrics[]): BackupHealthStatus['trends'] {
    if (metrics.length < 2) {
      return { duration: 'stable', size: 'stable', reliability: 'stable' };
    }
    
    const recent = metrics.slice(-Math.min(7, metrics.length));
    const older = metrics.slice(-Math.min(14, metrics.length), -7);
    
    if (older.length === 0) {
      return { duration: 'stable', size: 'stable', reliability: 'stable' };
    }
    
    const recentAvgDuration = recent.reduce((sum, m) => sum + m.duration, 0) / recent.length;
    const olderAvgDuration = older.reduce((sum, m) => sum + m.duration, 0) / older.length;
    
    const recentAvgSize = recent.reduce((sum, m) => sum + m.size, 0) / recent.length;
    const olderAvgSize = older.reduce((sum, m) => sum + m.size, 0) / older.length;
    
    const recentSuccessRate = recent.filter(m => m.status === 'success').length / recent.length;
    const olderSuccessRate = older.filter(m => m.status === 'success').length / older.length;
    
    return {
      duration: this.getTrend(recentAvgDuration, olderAvgDuration, true), // Lower is better
      size: this.getTrend(recentAvgSize, olderAvgSize, false), // Stable is preferred
      reliability: this.getTrend(recentSuccessRate, olderSuccessRate, false), // Higher is better
    };
  }

  private getTrend(recent: number, older: number, lowerIsBetter: boolean): 'improving' | 'stable' | 'degrading' {
    const threshold = 0.1; // 10% change threshold
    const change = (recent - older) / older;
    
    if (Math.abs(change) < threshold) return 'stable';
    
    if (lowerIsBetter) {
      return change < 0 ? 'improving' : 'degrading';
    } else {
      return change > 0 ? 'improving' : 'degrading';
    }
  }

  private getSeverityColor(severity: string, platform: 'slack' | 'discord' = 'slack'): string | number {
    if (platform === 'discord') {
      switch (severity) {
        case 'critical': return 16711680; // Red
        case 'error': return 16744448; // Orange-Red
        case 'warning': return 16776960; // Yellow
        default: return 65280; // Green
      }
    } else {
      switch (severity) {
        case 'critical': return 'danger';
        case 'error': return 'danger';
        case 'warning': return 'warning';
        default: return 'good';
      }
    }
  }

  private getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'critical': return '🚨';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return '✅';
    }
  }

  private isDuplicateMetric(metric: BackupMetrics): boolean {
    return this.metricsHistory.some(existing => 
      existing.backupId === metric.backupId && 
      existing.timestamp.getTime() === metric.timestamp.getTime()
    );
  }

  private cleanupOldMetrics(): void {
    const cutoff = new Date(Date.now() - this.config.metricsRetention * 24 * 60 * 60 * 1000);
    this.metricsHistory = this.metricsHistory.filter(metric => metric.timestamp >= cutoff);
  }

  private async loadHistoricalMetrics(): Promise<void> {
    try {
      const metricsFile = join(this.config.backupDirectory, 'monitoring_metrics.json');
      const content = await fs.readFile(metricsFile, 'utf-8');
      const data = JSON.parse(content);
      
      this.metricsHistory = data.metrics.map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      }));
      
      console.log(`📊 Loaded ${this.metricsHistory.length} historical metrics`);
    } catch (error) {
      console.log('📊 No historical metrics found, starting fresh');
    }
  }

  private async saveMetrics(): Promise<void> {
    try {
      const metricsFile = join(this.config.backupDirectory, 'monitoring_metrics.json');
      const data = {
        lastUpdated: new Date().toISOString(),
        metrics: this.metricsHistory,
        healthStatus: this.healthStatus,
      };
      
      await fs.writeFile(metricsFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('❌ Failed to save metrics:', error);
    }
  }

  private setupEventHandlers(): void {
    this.on('alert', (alert) => {
      console.log(`🚨 Alert: ${alert.rule.name} (${alert.rule.severity})`);
    });

    this.on('newBackup', (metrics) => {
      console.log(`📦 New backup detected: ${metrics.backupId} (${metrics.status})`);
    });

    this.on('healthCheck', (health) => {
      console.log(`💓 Health check: ${health.overall} (${health.uptimePercentage.toFixed(1)}% uptime)`);
    });
  }
}

// Export singleton instance
export const backupMonitor = new BackupMonitor();

// Auto-start monitoring if running as module
if (process.env.NODE_ENV !== 'test' && process.env.AUTO_START_BACKUP_MONITOR === 'true') {
  backupMonitor.start().catch(console.error);
}