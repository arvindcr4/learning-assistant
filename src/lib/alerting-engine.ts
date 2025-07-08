/**
 * Comprehensive Alerting Engine with Escalation Procedures
 * Advanced alerting system with multi-channel notifications and intelligent escalation
 */
import { createLogger } from './logger';
import { multiProviderAPM } from './apm-providers';
import { env } from './env-validation';

const logger = createLogger('alerting-engine');

// Alert severity levels
export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Alert status
export enum AlertStatus {
  OPEN = 'open',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  SUPPRESSED = 'suppressed',
}

// Notification channels
export enum NotificationChannel {
  EMAIL = 'email',
  SLACK = 'slack',
  DISCORD = 'discord',
  WEBHOOK = 'webhook',
  SMS = 'sms',
  PAGERDUTY = 'pagerduty',
  OPSGENIE = 'opsgenie',
  MICROSOFT_TEAMS = 'microsoft_teams',
  PHONE = 'phone',
}

// Alert rule interface
export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: AlertSeverity;
  category: string;
  condition: AlertCondition;
  schedule: AlertSchedule;
  escalation: EscalationPolicy;
  channels: NotificationChannel[];
  recipients: Record<NotificationChannel, string[]>;
  cooldown: number; // minutes
  maxAlerts: number; // per hour
  suppressionRules?: SuppressionRule[];
  metadata?: Record<string, any>;
}

// Alert condition interface
export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'contains' | 'not_contains' | 'regex';
  threshold: number | string;
  duration: number; // minutes - how long condition must be true
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count' | 'rate';
  timeWindow: number; // minutes - time window for aggregation
  tags?: Record<string, string>; // filter by tags
}

// Alert schedule interface
export interface AlertSchedule {
  enabled: boolean;
  timezone: string;
  businessHours?: {
    start: string; // HH:MM format
    end: string; // HH:MM format
    days: number[]; // 0-6, Sunday = 0
  };
  maintenanceWindows?: Array<{
    start: Date;
    end: Date;
    reason: string;
  }>;
}

// Escalation policy interface
export interface EscalationPolicy {
  enabled: boolean;
  levels: EscalationLevel[];
  timeout: number; // minutes before escalation
  maxEscalations: number;
}

// Escalation level interface
export interface EscalationLevel {
  level: number;
  timeout: number; // minutes
  channels: NotificationChannel[];
  recipients: Record<NotificationChannel, string[]>;
  repeatInterval?: number; // minutes, 0 = no repeat
  maxRepeats?: number;
}

// Suppression rule interface
export interface SuppressionRule {
  id: string;
  name: string;
  condition: string; // condition that must be true to suppress
  duration: number; // minutes
  reason: string;
}

// Alert interface
export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  status: AlertStatus;
  category: string;
  title: string;
  description: string;
  timestamp: Date;
  resolvedAt?: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  escalationLevel: number;
  suppressedUntil?: Date;
  suppressionReason?: string;
  metadata: Record<string, any>;
  notifications: AlertNotification[];
  context: {
    metric: string;
    value: number | string;
    threshold: number | string;
    tags: Record<string, string>;
    source: string;
    environment: string;
  };
}

// Alert notification interface
export interface AlertNotification {
  id: string;
  channel: NotificationChannel;
  recipients: string[];
  sentAt: Date;
  status: 'pending' | 'sent' | 'failed' | 'delivered';
  error?: string;
  escalationLevel: number;
  retryCount: number;
}

// Notification provider interface
export interface NotificationProvider {
  channel: NotificationChannel;
  send(alert: Alert, recipients: string[]): Promise<boolean>;
  healthCheck(): Promise<boolean>;
}

// Email notification provider
class EmailNotificationProvider implements NotificationProvider {
  channel = NotificationChannel.EMAIL;

  async send(alert: Alert, recipients: string[]): Promise<boolean> {
    try {
      // Implementation would integrate with email service (SendGrid, AWS SES, etc.)
      const emailContent = this.formatEmailContent(alert);
      
      // Mock implementation
      logger.info('Email notification sent', {
        alertId: alert.id,
        recipients,
        subject: emailContent.subject,
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to send email notification:', error);
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Mock health check
      return true;
    } catch (error) {
      return false;
    }
  }

  private formatEmailContent(alert: Alert) {
    const severityEmoji = {
      [AlertSeverity.LOW]: '🟢',
      [AlertSeverity.MEDIUM]: '🟡',
      [AlertSeverity.HIGH]: '🟠',
      [AlertSeverity.CRITICAL]: '🔴',
    };

    return {
      subject: `${severityEmoji[alert.severity]} ${alert.severity.toUpperCase()}: ${alert.title}`,
      html: `
        <h2>${alert.title}</h2>
        <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
        <p><strong>Category:</strong> ${alert.category}</p>
        <p><strong>Description:</strong> ${alert.description}</p>
        <p><strong>Time:</strong> ${alert.timestamp.toISOString()}</p>
        <p><strong>Metric:</strong> ${alert.context.metric}</p>
        <p><strong>Value:</strong> ${alert.context.value}</p>
        <p><strong>Threshold:</strong> ${alert.context.threshold}</p>
        <p><strong>Environment:</strong> ${alert.context.environment}</p>
        <hr>
        <p><em>Alert ID: ${alert.id}</em></p>
      `,
    };
  }
}

// Slack notification provider
class SlackNotificationProvider implements NotificationProvider {
  channel = NotificationChannel.SLACK;

  async send(alert: Alert, recipients: string[]): Promise<boolean> {
    try {
      const webhookUrl = process.env.SLACK_WEBHOOK_URL;
      if (!webhookUrl) {
        throw new Error('Slack webhook URL not configured');
      }

      const message = this.formatSlackMessage(alert);
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
      }

      logger.info('Slack notification sent', {
        alertId: alert.id,
        recipients,
      });

      return true;
    } catch (error) {
      logger.error('Failed to send Slack notification:', error);
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const webhookUrl = process.env.SLACK_WEBHOOK_URL;
      return !!webhookUrl;
    } catch (error) {
      return false;
    }
  }

  private formatSlackMessage(alert: Alert) {
    const severityColor = {
      [AlertSeverity.LOW]: 'good',
      [AlertSeverity.MEDIUM]: 'warning',
      [AlertSeverity.HIGH]: 'danger',
      [AlertSeverity.CRITICAL]: 'danger',
    };

    const severityEmoji = {
      [AlertSeverity.LOW]: '🟢',
      [AlertSeverity.MEDIUM]: '🟡',
      [AlertSeverity.HIGH]: '🟠',
      [AlertSeverity.CRITICAL]: '🔴',
    };

    return {
      text: `${severityEmoji[alert.severity]} *${alert.severity.toUpperCase()}*: ${alert.title}`,
      attachments: [
        {
          color: severityColor[alert.severity],
          fields: [
            { title: 'Category', value: alert.category, short: true },
            { title: 'Environment', value: alert.context.environment, short: true },
            { title: 'Metric', value: alert.context.metric, short: true },
            { title: 'Value', value: String(alert.context.value), short: true },
            { title: 'Threshold', value: String(alert.context.threshold), short: true },
            { title: 'Time', value: alert.timestamp.toISOString(), short: true },
            { title: 'Description', value: alert.description, short: false },
          ],
          footer: `Alert ID: ${alert.id}`,
          ts: Math.floor(alert.timestamp.getTime() / 1000),
        },
      ],
    };
  }
}

// PagerDuty notification provider
class PagerDutyNotificationProvider implements NotificationProvider {
  channel = NotificationChannel.PAGERDUTY;

  async send(alert: Alert, recipients: string[]): Promise<boolean> {
    try {
      const apiKey = process.env.PAGERDUTY_API_KEY;
      const serviceKey = process.env.PAGERDUTY_SERVICE_KEY;

      if (!apiKey || !serviceKey) {
        throw new Error('PagerDuty API key or service key not configured');
      }

      const payload = {
        routing_key: serviceKey,
        event_action: 'trigger',
        dedup_key: alert.id,
        payload: {
          summary: alert.title,
          severity: alert.severity,
          source: alert.context.source,
          timestamp: alert.timestamp.toISOString(),
          custom_details: {
            description: alert.description,
            category: alert.category,
            metric: alert.context.metric,
            value: alert.context.value,
            threshold: alert.context.threshold,
            environment: alert.context.environment,
            tags: alert.context.tags,
          },
        },
      };

      const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token token=${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`PagerDuty API error: ${response.status} ${response.statusText}`);
      }

      logger.info('PagerDuty notification sent', {
        alertId: alert.id,
        dedupKey: alert.id,
      });

      return true;
    } catch (error) {
      logger.error('Failed to send PagerDuty notification:', error);
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const apiKey = process.env.PAGERDUTY_API_KEY;
      const serviceKey = process.env.PAGERDUTY_SERVICE_KEY;
      return !!(apiKey && serviceKey);
    } catch (error) {
      return false;
    }
  }
}

// Webhook notification provider
class WebhookNotificationProvider implements NotificationProvider {
  channel = NotificationChannel.WEBHOOK;

  async send(alert: Alert, recipients: string[]): Promise<boolean> {
    try {
      const webhookUrl = process.env.ALERT_WEBHOOK_URL;
      if (!webhookUrl) {
        throw new Error('Webhook URL not configured');
      }

      const payload = {
        alert,
        recipients,
        timestamp: new Date().toISOString(),
        service: 'learning-assistant',
        environment: alert.context.environment,
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook error: ${response.status} ${response.statusText}`);
      }

      logger.info('Webhook notification sent', {
        alertId: alert.id,
        recipients,
        url: webhookUrl,
      });

      return true;
    } catch (error) {
      logger.error('Failed to send webhook notification:', error);
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const webhookUrl = process.env.ALERT_WEBHOOK_URL;
      return !!webhookUrl;
    } catch (error) {
      return false;
    }
  }
}

// Main alerting engine class
export class AlertingEngine {
  private rules: Map<string, AlertRule> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private providers: Map<NotificationChannel, NotificationProvider> = new Map();
  private evaluationInterval: NodeJS.Timeout | null = null;
  private escalationInterval: NodeJS.Timeout | null = null;
  private ruleStates: Map<string, any> = new Map(); // Track rule evaluation state

  constructor() {
    this.initializeProviders();
    this.loadDefaultRules();
    this.startEvaluationLoop();
    this.startEscalationLoop();
  }

  private initializeProviders() {
    this.providers.set(NotificationChannel.EMAIL, new EmailNotificationProvider());
    this.providers.set(NotificationChannel.SLACK, new SlackNotificationProvider());
    this.providers.set(NotificationChannel.PAGERDUTY, new PagerDutyNotificationProvider());
    this.providers.set(NotificationChannel.WEBHOOK, new WebhookNotificationProvider());
  }

  private loadDefaultRules() {
    // Critical system health rules
    this.addRule({
      id: 'high_error_rate',
      name: 'High Error Rate',
      description: 'Application error rate is above acceptable threshold',
      enabled: true,
      severity: AlertSeverity.HIGH,
      category: 'system',
      condition: {
        metric: 'error_rate',
        operator: 'gt',
        threshold: 5,
        duration: 5,
        aggregation: 'avg',
        timeWindow: 10,
      },
      schedule: {
        enabled: true,
        timezone: 'UTC',
      },
      escalation: {
        enabled: true,
        levels: [
          {
            level: 1,
            timeout: 15,
            channels: [NotificationChannel.SLACK],
            recipients: {
              [NotificationChannel.SLACK]: ['#alerts'],
            },
            repeatInterval: 30,
            maxRepeats: 3,
          },
          {
            level: 2,
            timeout: 30,
            channels: [NotificationChannel.EMAIL, NotificationChannel.PAGERDUTY],
            recipients: {
              [NotificationChannel.EMAIL]: ['oncall@company.com'],
              [NotificationChannel.PAGERDUTY]: ['oncall-service'],
            },
          },
        ],
        timeout: 15,
        maxEscalations: 2,
      },
      channels: [NotificationChannel.SLACK, NotificationChannel.EMAIL],
      recipients: {
        [NotificationChannel.SLACK]: ['#alerts'],
        [NotificationChannel.EMAIL]: ['team@company.com'],
      },
      cooldown: 30,
      maxAlerts: 10,
    });

    this.addRule({
      id: 'critical_memory_usage',
      name: 'Critical Memory Usage',
      description: 'Memory usage is critically high',
      enabled: true,
      severity: AlertSeverity.CRITICAL,
      category: 'infrastructure',
      condition: {
        metric: 'memory_usage_percent',
        operator: 'gt',
        threshold: 90,
        duration: 2,
        aggregation: 'avg',
        timeWindow: 5,
      },
      schedule: {
        enabled: true,
        timezone: 'UTC',
      },
      escalation: {
        enabled: true,
        levels: [
          {
            level: 1,
            timeout: 5,
            channels: [NotificationChannel.SLACK, NotificationChannel.PAGERDUTY],
            recipients: {
              [NotificationChannel.SLACK]: ['#critical-alerts'],
              [NotificationChannel.PAGERDUTY]: ['critical-service'],
            },
            repeatInterval: 10,
            maxRepeats: 5,
          },
        ],
        timeout: 5,
        maxEscalations: 1,
      },
      channels: [NotificationChannel.SLACK, NotificationChannel.PAGERDUTY],
      recipients: {
        [NotificationChannel.SLACK]: ['#critical-alerts'],
        [NotificationChannel.PAGERDUTY]: ['critical-service'],
      },
      cooldown: 10,
      maxAlerts: 20,
    });

    this.addRule({
      id: 'database_connection_failure',
      name: 'Database Connection Failure',
      description: 'Unable to connect to database',
      enabled: true,
      severity: AlertSeverity.CRITICAL,
      category: 'infrastructure',
      condition: {
        metric: 'database_health',
        operator: 'eq',
        threshold: 'unhealthy',
        duration: 1,
        aggregation: 'count',
        timeWindow: 1,
      },
      schedule: {
        enabled: true,
        timezone: 'UTC',
      },
      escalation: {
        enabled: true,
        levels: [
          {
            level: 1,
            timeout: 2,
            channels: [NotificationChannel.SLACK, NotificationChannel.EMAIL, NotificationChannel.PAGERDUTY],
            recipients: {
              [NotificationChannel.SLACK]: ['#critical-alerts'],
              [NotificationChannel.EMAIL]: ['dba@company.com', 'oncall@company.com'],
              [NotificationChannel.PAGERDUTY]: ['database-service'],
            },
            repeatInterval: 5,
            maxRepeats: 10,
          },
        ],
        timeout: 2,
        maxEscalations: 1,
      },
      channels: [NotificationChannel.SLACK, NotificationChannel.EMAIL, NotificationChannel.PAGERDUTY],
      recipients: {
        [NotificationChannel.SLACK]: ['#critical-alerts'],
        [NotificationChannel.EMAIL]: ['dba@company.com'],
        [NotificationChannel.PAGERDUTY]: ['database-service'],
      },
      cooldown: 5,
      maxAlerts: 50,
    });

    this.addRule({
      id: 'slow_response_time',
      name: 'Slow Response Time',
      description: 'API response time is above acceptable threshold',
      enabled: true,
      severity: AlertSeverity.MEDIUM,
      category: 'performance',
      condition: {
        metric: 'response_time_p95',
        operator: 'gt',
        threshold: 2000,
        duration: 10,
        aggregation: 'avg',
        timeWindow: 15,
      },
      schedule: {
        enabled: true,
        timezone: 'UTC',
        businessHours: {
          start: '09:00',
          end: '17:00',
          days: [1, 2, 3, 4, 5], // Monday to Friday
        },
      },
      escalation: {
        enabled: true,
        levels: [
          {
            level: 1,
            timeout: 30,
            channels: [NotificationChannel.SLACK],
            recipients: {
              [NotificationChannel.SLACK]: ['#performance-alerts'],
            },
            repeatInterval: 60,
            maxRepeats: 2,
          },
          {
            level: 2,
            timeout: 60,
            channels: [NotificationChannel.EMAIL],
            recipients: {
              [NotificationChannel.EMAIL]: ['performance-team@company.com'],
            },
          },
        ],
        timeout: 30,
        maxEscalations: 2,
      },
      channels: [NotificationChannel.SLACK],
      recipients: {
        [NotificationChannel.SLACK]: ['#performance-alerts'],
      },
      cooldown: 60,
      maxAlerts: 5,
    });

    logger.info(`Loaded ${this.rules.size} default alert rules`);
  }

  private startEvaluationLoop() {
    this.evaluationInterval = setInterval(async () => {
      await this.evaluateRules();
    }, 60000); // Evaluate every minute

    logger.info('Alert rule evaluation loop started');
  }

  private startEscalationLoop() {
    this.escalationInterval = setInterval(async () => {
      await this.processEscalations();
    }, 30000); // Check escalations every 30 seconds

    logger.info('Alert escalation loop started');
  }

  private async evaluateRules() {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      try {
        await this.evaluateRule(rule);
      } catch (error) {
        logger.error(`Error evaluating rule ${rule.id}:`, error);
      }
    }
  }

  private async evaluateRule(rule: AlertRule) {
    // Check if rule is within schedule
    if (!this.isRuleScheduleActive(rule)) {
      return;
    }

    // Get current metric value
    const metricValue = await this.getMetricValue(rule.condition);
    
    // Evaluate condition
    const conditionMet = this.evaluateCondition(rule.condition, metricValue);
    
    // Get rule state
    const ruleState = this.ruleStates.get(rule.id) || {
      conditionStartTime: null,
      alertCount: 0,
      lastAlertTime: null,
    };

    if (conditionMet) {
      // Start tracking condition duration
      if (!ruleState.conditionStartTime) {
        ruleState.conditionStartTime = new Date();
        this.ruleStates.set(rule.id, ruleState);
        return;
      }

      // Check if condition has been true for required duration
      const conditionDuration = (Date.now() - ruleState.conditionStartTime.getTime()) / 60000; // minutes
      
      if (conditionDuration >= rule.condition.duration) {
        // Check cooldown and rate limiting
        if (this.shouldTriggerAlert(rule, ruleState)) {
          await this.triggerAlert(rule, metricValue);
          ruleState.alertCount++;
          ruleState.lastAlertTime = new Date();
          this.ruleStates.set(rule.id, ruleState);
        }
      }
    } else {
      // Condition no longer met, reset state
      if (ruleState.conditionStartTime) {
        ruleState.conditionStartTime = null;
        this.ruleStates.set(rule.id, ruleState);
      }
    }
  }

  private isRuleScheduleActive(rule: AlertRule): boolean {
    if (!rule.schedule.enabled) return true;

    const now = new Date();

    // Check maintenance windows
    if (rule.schedule.maintenanceWindows) {
      for (const window of rule.schedule.maintenanceWindows) {
        if (now >= window.start && now <= window.end) {
          return false;
        }
      }
    }

    // Check business hours
    if (rule.schedule.businessHours) {
      const { businessHours } = rule.schedule;
      const dayOfWeek = now.getDay();
      const timeStr = now.toTimeString().slice(0, 5); // HH:MM format

      if (!businessHours.days.includes(dayOfWeek)) return false;
      if (timeStr < businessHours.start || timeStr > businessHours.end) return false;
    }

    return true;
  }

  private async getMetricValue(condition: AlertCondition): Promise<number | string> {
    // This would integrate with your metrics system
    // For now, return mock values based on metric name
    switch (condition.metric) {
      case 'error_rate':
        return Math.random() * 10; // 0-10%
      case 'memory_usage_percent':
        return Math.random() * 100; // 0-100%
      case 'response_time_p95':
        return Math.random() * 5000; // 0-5000ms
      case 'database_health':
        return Math.random() > 0.95 ? 'unhealthy' : 'healthy';
      default:
        return 0;
    }
  }

  private evaluateCondition(condition: AlertCondition, value: number | string): boolean {
    switch (condition.operator) {
      case 'gt':
        return Number(value) > Number(condition.threshold);
      case 'gte':
        return Number(value) >= Number(condition.threshold);
      case 'lt':
        return Number(value) < Number(condition.threshold);
      case 'lte':
        return Number(value) <= Number(condition.threshold);
      case 'eq':
        return value === condition.threshold;
      case 'neq':
        return value !== condition.threshold;
      case 'contains':
        return String(value).includes(String(condition.threshold));
      case 'not_contains':
        return !String(value).includes(String(condition.threshold));
      case 'regex':
        const regex = new RegExp(String(condition.threshold));
        return regex.test(String(value));
      default:
        return false;
    }
  }

  private shouldTriggerAlert(rule: AlertRule, ruleState: any): boolean {
    const now = new Date();

    // Check cooldown
    if (ruleState.lastAlertTime) {
      const timeSinceLastAlert = (now.getTime() - ruleState.lastAlertTime.getTime()) / 60000; // minutes
      if (timeSinceLastAlert < rule.cooldown) {
        return false;
      }
    }

    // Check rate limiting (alerts per hour)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentAlerts = Array.from(this.alerts.values()).filter(
      alert => alert.ruleId === rule.id && alert.timestamp >= oneHourAgo
    );

    if (recentAlerts.length >= rule.maxAlerts) {
      return false;
    }

    return true;
  }

  private async triggerAlert(rule: AlertRule, metricValue: number | string) {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      status: AlertStatus.OPEN,
      category: rule.category,
      title: rule.name,
      description: rule.description,
      timestamp: new Date(),
      escalationLevel: 0,
      metadata: rule.metadata || {},
      notifications: [],
      context: {
        metric: rule.condition.metric,
        value: metricValue,
        threshold: rule.condition.threshold,
        tags: rule.condition.tags || {},
        source: 'learning-assistant',
        environment: env.NODE_ENV,
      },
    };

    this.alerts.set(alert.id, alert);

    // Send initial notifications
    await this.sendNotifications(alert, rule.channels, rule.recipients);

    // Record metrics
    multiProviderAPM.recordMetric(
      'alerts_triggered',
      1,
      'counter',
      {
        rule_id: rule.id,
        severity: rule.severity,
        category: rule.category,
      }
    );

    logger.warn('Alert triggered', {
      alertId: alert.id,
      ruleId: rule.id,
      severity: rule.severity,
      metric: rule.condition.metric,
      value: metricValue,
      threshold: rule.condition.threshold,
    });
  }

  private async sendNotifications(
    alert: Alert,
    channels: NotificationChannel[],
    recipients: Record<NotificationChannel, string[]>
  ) {
    for (const channel of channels) {
      const provider = this.providers.get(channel);
      if (!provider) {
        logger.warn(`No provider found for channel: ${channel}`);
        continue;
      }

      const channelRecipients = recipients[channel] || [];
      if (channelRecipients.length === 0) {
        logger.warn(`No recipients configured for channel: ${channel}`);
        continue;
      }

      const notification: AlertNotification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        channel,
        recipients: channelRecipients,
        sentAt: new Date(),
        status: 'pending',
        escalationLevel: alert.escalationLevel,
        retryCount: 0,
      };

      try {
        const success = await provider.send(alert, channelRecipients);
        notification.status = success ? 'sent' : 'failed';
        
        if (!success) {
          notification.error = 'Provider send failed';
        }
      } catch (error) {
        notification.status = 'failed';
        notification.error = error instanceof Error ? error.message : 'Unknown error';
      }

      alert.notifications.push(notification);
    }
  }

  private async processEscalations() {
    const openAlerts = Array.from(this.alerts.values()).filter(
      alert => alert.status === AlertStatus.OPEN
    );

    for (const alert of openAlerts) {
      const rule = this.rules.get(alert.ruleId);
      if (!rule || !rule.escalation.enabled) continue;

      await this.processAlertEscalation(alert, rule);
    }
  }

  private async processAlertEscalation(alert: Alert, rule: AlertRule) {
    const { escalation } = rule;
    const now = new Date();
    const alertAge = (now.getTime() - alert.timestamp.getTime()) / 60000; // minutes

    // Check if we should escalate
    const currentLevel = alert.escalationLevel;
    const nextLevel = escalation.levels.find(level => level.level === currentLevel + 1);

    if (!nextLevel || currentLevel >= escalation.maxEscalations) {
      return;
    }

    // Check if enough time has passed for escalation
    let shouldEscalate = false;
    
    if (currentLevel === 0) {
      // First escalation based on initial timeout
      shouldEscalate = alertAge >= escalation.timeout;
    } else {
      const currentLevelConfig = escalation.levels.find(level => level.level === currentLevel);
      if (currentLevelConfig) {
        const lastNotification = alert.notifications
          .filter(n => n.escalationLevel === currentLevel)
          .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())[0];

        if (lastNotification) {
          const timeSinceLastNotification = (now.getTime() - lastNotification.sentAt.getTime()) / 60000;
          shouldEscalate = timeSinceLastNotification >= currentLevelConfig.timeout;
        }
      }
    }

    if (shouldEscalate) {
      alert.escalationLevel = nextLevel.level;
      await this.sendNotifications(alert, nextLevel.channels, nextLevel.recipients);

      logger.warn('Alert escalated', {
        alertId: alert.id,
        fromLevel: currentLevel,
        toLevel: nextLevel.level,
        ruleId: rule.id,
      });

      // Record escalation metric
      multiProviderAPM.recordMetric(
        'alerts_escalated',
        1,
        'counter',
        {
          rule_id: rule.id,
          from_level: currentLevel.toString(),
          to_level: nextLevel.level.toString(),
        }
      );
    }
  }

  // Public API methods
  public addRule(rule: AlertRule) {
    this.rules.set(rule.id, rule);
    logger.info(`Added alert rule: ${rule.id}`);
  }

  public removeRule(ruleId: string) {
    this.rules.delete(ruleId);
    this.ruleStates.delete(ruleId);
    logger.info(`Removed alert rule: ${ruleId}`);
  }

  public updateRule(ruleId: string, updates: Partial<AlertRule>) {
    const existingRule = this.rules.get(ruleId);
    if (existingRule) {
      const updatedRule = { ...existingRule, ...updates };
      this.rules.set(ruleId, updatedRule);
      logger.info(`Updated alert rule: ${ruleId}`);
    }
  }

  public acknowledgeAlert(alertId: string, acknowledgedBy: string) {
    const alert = this.alerts.get(alertId);
    if (alert && alert.status === AlertStatus.OPEN) {
      alert.status = AlertStatus.ACKNOWLEDGED;
      alert.acknowledgedAt = new Date();
      alert.acknowledgedBy = acknowledgedBy;
      
      logger.info('Alert acknowledged', {
        alertId,
        acknowledgedBy,
      });

      multiProviderAPM.recordMetric(
        'alerts_acknowledged',
        1,
        'counter',
        { rule_id: alert.ruleId }
      );
    }
  }

  public resolveAlert(alertId: string) {
    const alert = this.alerts.get(alertId);
    if (alert && alert.status !== AlertStatus.RESOLVED) {
      alert.status = AlertStatus.RESOLVED;
      alert.resolvedAt = new Date();
      
      logger.info('Alert resolved', { alertId });

      multiProviderAPM.recordMetric(
        'alerts_resolved',
        1,
        'counter',
        { rule_id: alert.ruleId }
      );
    }
  }

  public suppressAlert(alertId: string, duration: number, reason: string) {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.status = AlertStatus.SUPPRESSED;
      alert.suppressedUntil = new Date(Date.now() + duration * 60000); // duration in minutes
      alert.suppressionReason = reason;
      
      logger.info('Alert suppressed', {
        alertId,
        duration,
        reason,
      });
    }
  }

  public getAlerts(filters?: {
    status?: AlertStatus;
    severity?: AlertSeverity;
    category?: string;
    ruleId?: string;
  }): Alert[] {
    let alerts = Array.from(this.alerts.values());

    if (filters) {
      if (filters.status) {
        alerts = alerts.filter(alert => alert.status === filters.status);
      }
      if (filters.severity) {
        alerts = alerts.filter(alert => alert.severity === filters.severity);
      }
      if (filters.category) {
        alerts = alerts.filter(alert => alert.category === filters.category);
      }
      if (filters.ruleId) {
        alerts = alerts.filter(alert => alert.ruleId === filters.ruleId);
      }
    }

    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  public getMetrics(): Record<string, any> {
    const alerts = Array.from(this.alerts.values());
    const openAlerts = alerts.filter(a => a.status === AlertStatus.OPEN);
    const acknowledgedAlerts = alerts.filter(a => a.status === AlertStatus.ACKNOWLEDGED);
    const resolvedAlerts = alerts.filter(a => a.status === AlertStatus.RESOLVED);

    return {
      totalRules: this.rules.size,
      enabledRules: Array.from(this.rules.values()).filter(r => r.enabled).length,
      totalAlerts: alerts.length,
      openAlerts: openAlerts.length,
      acknowledgedAlerts: acknowledgedAlerts.length,
      resolvedAlerts: resolvedAlerts.length,
      alertsBySeverity: {
        low: alerts.filter(a => a.severity === AlertSeverity.LOW).length,
        medium: alerts.filter(a => a.severity === AlertSeverity.MEDIUM).length,
        high: alerts.filter(a => a.severity === AlertSeverity.HIGH).length,
        critical: alerts.filter(a => a.severity === AlertSeverity.CRITICAL).length,
      },
      providerHealth: Object.fromEntries(
        Array.from(this.providers.entries()).map(([channel, provider]) => [
          channel,
          provider.healthCheck(),
        ])
      ),
    };
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const providerHealthChecks = await Promise.all(
        Array.from(this.providers.values()).map(provider => provider.healthCheck())
      );
      
      return providerHealthChecks.some(healthy => healthy); // At least one provider must be healthy
    } catch (error) {
      logger.error('Alerting engine health check failed:', error);
      return false;
    }
  }

  public shutdown() {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
    }
    if (this.escalationInterval) {
      clearInterval(this.escalationInterval);
    }
    
    logger.info('Alerting engine shutdown');
  }
}

// Create singleton instance
export const alertingEngine = new AlertingEngine();

// Export default
export default alertingEngine;