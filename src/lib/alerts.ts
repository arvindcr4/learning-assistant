/**
 * Intelligent alerting system with escalation policies
 * Supports multiple notification channels and smart alert routing
 */
import { createLogger } from './logger';
import { env } from './env-validation';

const logger = createLogger('alerts');

// Alert severity levels
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

// Alert categories
export type AlertCategory = 
  | 'performance' 
  | 'error' 
  | 'security' 
  | 'business' 
  | 'infrastructure' 
  | 'learning_system';

// Alert interface
export interface Alert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  category: AlertCategory;
  timestamp: string;
  metadata?: Record<string, any>;
  source?: string;
  resolved?: boolean;
  resolvedAt?: string;
  escalationLevel?: number;
  notificationChannels?: string[];
}

// Alert rule interface
export interface AlertRule {
  id: string;
  name: string;
  category: AlertCategory;
  severity: AlertSeverity;
  enabled: boolean;
  conditions: AlertCondition[];
  actions: AlertAction[];
  cooldown: number; // minutes
  escalationPolicy?: string;
  tags?: string[];
}

// Alert condition interface
export interface AlertCondition {
  metric: string;
  operator: '>' | '<' | '==' | '!=' | '>=' | '<=';
  threshold: number;
  duration: number; // minutes
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
}

// Alert action interface
export interface AlertAction {
  type: 'email' | 'slack' | 'webhook' | 'pagerduty' | 'sms';
  target: string;
  template?: string;
  severity?: AlertSeverity[];
}

// Alert configuration
interface AlertConfig {
  enabled: boolean;
  retentionDays: number;
  maxAlertsPerHour: number;
  escalationInterval: number; // minutes
  channels: {
    email: {
      enabled: boolean;
      smtp?: {
        host: string;
        port: number;
        secure: boolean;
        auth: { user: string; pass: string };
      };
      from: string;
      templates: Record<string, string>;
    };
    slack: {
      enabled: boolean;
      webhookUrl?: string;
      channel?: string;
      botToken?: string;
    };
    webhook: {
      enabled: boolean;
      url?: string;
      auth?: { type: 'bearer' | 'basic'; token: string };
    };
    pagerduty: {
      enabled: boolean;
      routingKey?: string;
      serviceKey?: string;
    };
  };
}

const config: AlertConfig = {
  enabled: process.env.ENABLE_ALERTS === 'true',
  retentionDays: parseInt(process.env.ALERT_RETENTION_DAYS || '90'),
  maxAlertsPerHour: parseInt(process.env.MAX_ALERTS_PER_HOUR || '10'),
  escalationInterval: parseInt(process.env.ALERT_ESCALATION_INTERVAL || '15'),
  channels: {
    email: {
      enabled: process.env.ALERT_EMAIL_ENABLED === 'true',
      smtp: process.env.SMTP_HOST ? {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        },
      } : undefined,
      from: process.env.ALERT_EMAIL_FROM || 'alerts@learning-assistant.com',
      templates: {
        critical: 'critical-alert',
        error: 'error-alert',
        warning: 'warning-alert',
        info: 'info-alert',
      },
    },
    slack: {
      enabled: process.env.ALERT_SLACK_ENABLED === 'true',
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      channel: process.env.SLACK_ALERT_CHANNEL || '#alerts',
      botToken: process.env.SLACK_BOT_TOKEN,
    },
    webhook: {
      enabled: process.env.ALERT_WEBHOOK_ENABLED === 'true',
      url: process.env.ALERT_WEBHOOK_URL,
      auth: process.env.ALERT_WEBHOOK_AUTH_TOKEN ? {
        type: 'bearer',
        token: process.env.ALERT_WEBHOOK_AUTH_TOKEN,
      } : undefined,
    },
    pagerduty: {
      enabled: process.env.ALERT_PAGERDUTY_ENABLED === 'true',
      routingKey: process.env.PAGERDUTY_ROUTING_KEY,
      serviceKey: process.env.PAGERDUTY_SERVICE_KEY,
    },
  },
};

// Alert storage
const alertHistory = new Map<string, Alert>();
const activeAlerts = new Map<string, Alert>();
const alertRules = new Map<string, AlertRule>();

// Rate limiting
const alertRateLimiter = new Map<string, number>();

// Default alert rules
const defaultAlertRules: AlertRule[] = [
  {
    id: 'high-error-rate',
    name: 'High Error Rate',
    category: 'error',
    severity: 'critical',
    enabled: true,
    conditions: [
      {
        metric: 'error_rate',
        operator: '>',
        threshold: 5,
        duration: 5,
        aggregation: 'avg',
      },
    ],
    actions: [
      { type: 'email', target: 'ops@learning-assistant.com', severity: ['critical', 'error'] },
      { type: 'slack', target: '#alerts', severity: ['critical', 'error'] },
      { type: 'pagerduty', target: 'engineering', severity: ['critical'] },
    ],
    cooldown: 30,
    escalationPolicy: 'immediate',
  },
  {
    id: 'high-response-time',
    name: 'High Response Time',
    category: 'performance',
    severity: 'warning',
    enabled: true,
    conditions: [
      {
        metric: 'response_time',
        operator: '>',
        threshold: 2000,
        duration: 10,
        aggregation: 'avg',
      },
    ],
    actions: [
      { type: 'email', target: 'ops@learning-assistant.com', severity: ['warning'] },
      { type: 'slack', target: '#alerts', severity: ['warning'] },
    ],
    cooldown: 15,
  },
  {
    id: 'memory-usage-high',
    name: 'High Memory Usage',
    category: 'infrastructure',
    severity: 'critical',
    enabled: true,
    conditions: [
      {
        metric: 'memory_usage',
        operator: '>',
        threshold: 85,
        duration: 5,
        aggregation: 'avg',
      },
    ],
    actions: [
      { type: 'email', target: 'ops@learning-assistant.com', severity: ['critical'] },
      { type: 'slack', target: '#alerts', severity: ['critical'] },
      { type: 'pagerduty', target: 'engineering', severity: ['critical'] },
    ],
    cooldown: 30,
    escalationPolicy: 'immediate',
  },
  {
    id: 'database-connection-failure',
    name: 'Database Connection Failure',
    category: 'infrastructure',
    severity: 'critical',
    enabled: true,
    conditions: [
      {
        metric: 'db_connection_failures',
        operator: '>',
        threshold: 3,
        duration: 2,
        aggregation: 'sum',
      },
    ],
    actions: [
      { type: 'email', target: 'ops@learning-assistant.com', severity: ['critical'] },
      { type: 'slack', target: '#alerts', severity: ['critical'] },
      { type: 'pagerduty', target: 'engineering', severity: ['critical'] },
    ],
    cooldown: 60,
    escalationPolicy: 'immediate',
  },
  {
    id: 'learning-system-failure',
    name: 'Learning System Failure',
    category: 'learning_system',
    severity: 'error',
    enabled: true,
    conditions: [
      {
        metric: 'learning_failures',
        operator: '>',
        threshold: 10,
        duration: 5,
        aggregation: 'sum',
      },
    ],
    actions: [
      { type: 'email', target: 'product@learning-assistant.com', severity: ['error'] },
      { type: 'slack', target: '#product-alerts', severity: ['error'] },
    ],
    cooldown: 20,
  },
  {
    id: 'security-incident',
    name: 'Security Incident',
    category: 'security',
    severity: 'critical',
    enabled: true,
    conditions: [
      {
        metric: 'security_events',
        operator: '>',
        threshold: 5,
        duration: 1,
        aggregation: 'sum',
      },
    ],
    actions: [
      { type: 'email', target: 'security@learning-assistant.com', severity: ['critical'] },
      { type: 'slack', target: '#security-alerts', severity: ['critical'] },
      { type: 'pagerduty', target: 'security', severity: ['critical'] },
    ],
    cooldown: 5,
    escalationPolicy: 'immediate',
  },
  {
    id: 'business-metrics-anomaly',
    name: 'Business Metrics Anomaly',
    category: 'business',
    severity: 'warning',
    enabled: true,
    conditions: [
      {
        metric: 'conversion_rate',
        operator: '<',
        threshold: 50,
        duration: 30,
        aggregation: 'avg',
      },
    ],
    actions: [
      { type: 'email', target: 'business@learning-assistant.com', severity: ['warning'] },
      { type: 'slack', target: '#business-alerts', severity: ['warning'] },
    ],
    cooldown: 60,
  },
];

// Initialize default rules
defaultAlertRules.forEach(rule => {
  alertRules.set(rule.id, rule);
});

// Alert manager
export const alertManager = {
  // Create and send alert
  createAlert: async (alert: Omit<Alert, 'id' | 'timestamp'>) => {
    if (!config.enabled) return null;

    const alertId = generateAlertId();
    const fullAlert: Alert = {
      ...alert,
      id: alertId,
      timestamp: new Date().toISOString(),
      escalationLevel: 0,
    };

    // Check rate limiting
    const rateLimitKey = `${alert.category}-${alert.severity}`;
    const currentHour = Math.floor(Date.now() / (60 * 60 * 1000));
    const rateKey = `${rateLimitKey}-${currentHour}`;
    
    const currentCount = alertRateLimiter.get(rateKey) || 0;
    if (currentCount >= config.maxAlertsPerHour) {
      logger.warn('Alert rate limit exceeded', {
        category: alert.category,
        severity: alert.severity,
        currentCount,
        maxAllowed: config.maxAlertsPerHour,
      });
      return null;
    }

    alertRateLimiter.set(rateKey, currentCount + 1);

    // Store alert
    alertHistory.set(alertId, fullAlert);
    activeAlerts.set(alertId, fullAlert);

    // Send notifications
    await sendNotifications(fullAlert);

    logger.info('Alert created', {
      alertId,
      title: fullAlert.title,
      severity: fullAlert.severity,
      category: fullAlert.category,
    });

    return fullAlert;
  },

  // Resolve alert
  resolveAlert: async (alertId: string, resolvedBy?: string) => {
    const alert = activeAlerts.get(alertId);
    if (!alert) return false;

    alert.resolved = true;
    alert.resolvedAt = new Date().toISOString();
    
    if (resolvedBy) {
      alert.metadata = { ...alert.metadata, resolvedBy };
    }

    activeAlerts.delete(alertId);
    alertHistory.set(alertId, alert);

    logger.info('Alert resolved', {
      alertId,
      title: alert.title,
      resolvedBy,
    });

    return true;
  },

  // Get active alerts
  getActiveAlerts: () => Array.from(activeAlerts.values()),

  // Get alert history
  getAlertHistory: (filters?: {
    category?: AlertCategory;
    severity?: AlertSeverity;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) => {
    let alerts = Array.from(alertHistory.values());

    if (filters) {
      if (filters.category) {
        alerts = alerts.filter(a => a.category === filters.category);
      }
      if (filters.severity) {
        alerts = alerts.filter(a => a.severity === filters.severity);
      }
      if (filters.startDate) {
        alerts = alerts.filter(a => a.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        alerts = alerts.filter(a => a.timestamp <= filters.endDate!);
      }
      if (filters.limit) {
        alerts = alerts.slice(0, filters.limit);
      }
    }

    return alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  // Add alert rule
  addAlertRule: (rule: AlertRule) => {
    alertRules.set(rule.id, rule);
    logger.info('Alert rule added', { ruleId: rule.id, name: rule.name });
  },

  // Update alert rule
  updateAlertRule: (ruleId: string, updates: Partial<AlertRule>) => {
    const rule = alertRules.get(ruleId);
    if (!rule) return false;

    const updatedRule = { ...rule, ...updates };
    alertRules.set(ruleId, updatedRule);
    logger.info('Alert rule updated', { ruleId, updates });
    return true;
  },

  // Delete alert rule
  deleteAlertRule: (ruleId: string) => {
    const deleted = alertRules.delete(ruleId);
    if (deleted) {
      logger.info('Alert rule deleted', { ruleId });
    }
    return deleted;
  },

  // Get alert rules
  getAlertRules: () => Array.from(alertRules.values()),

  // Evaluate metrics against rules
  evaluateMetrics: async (metrics: Record<string, number>) => {
    const triggeredRules = [];

    for (const rule of alertRules.values()) {
      if (!rule.enabled) continue;

      const shouldTrigger = rule.conditions.every(condition => {
        const value = metrics[condition.metric];
        if (value === undefined) return false;

        switch (condition.operator) {
          case '>': return value > condition.threshold;
          case '<': return value < condition.threshold;
          case '==': return value === condition.threshold;
          case '!=': return value !== condition.threshold;
          case '>=': return value >= condition.threshold;
          case '<=': return value <= condition.threshold;
          default: return false;
        }
      });

      if (shouldTrigger) {
        triggeredRules.push(rule);
        
        // Create alert
        await alertManager.createAlert({
          title: rule.name,
          message: `Alert rule "${rule.name}" triggered`,
          severity: rule.severity,
          category: rule.category,
          source: 'rule-engine',
          metadata: {
            ruleId: rule.id,
            triggeredConditions: rule.conditions,
            metrics,
          },
        });
      }
    }

    return triggeredRules;
  },

  // Get alert statistics
  getAlertStats: () => {
    const allAlerts = Array.from(alertHistory.values());
    const activeCount = activeAlerts.size;
    const totalCount = allAlerts.length;
    const resolvedCount = allAlerts.filter(a => a.resolved).length;

    const severityStats = allAlerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<AlertSeverity, number>);

    const categoryStats = allAlerts.reduce((acc, alert) => {
      acc[alert.category] = (acc[alert.category] || 0) + 1;
      return acc;
    }, {} as Record<AlertCategory, number>);

    return {
      active: activeCount,
      total: totalCount,
      resolved: resolvedCount,
      byCategory: categoryStats,
      bySeverity: severityStats,
    };
  },

  // Configuration
  getConfig: () => config,
  updateConfig: (updates: Partial<AlertConfig>) => {
    Object.assign(config, updates);
    logger.info('Alert configuration updated', updates);
  },
};

// Notification sending
const sendNotifications = async (alert: Alert) => {
  const promises = [];

  // Send email notifications
  if (config.channels.email.enabled) {
    promises.push(sendEmailNotification(alert));
  }

  // Send Slack notifications
  if (config.channels.slack.enabled) {
    promises.push(sendSlackNotification(alert));
  }

  // Send webhook notifications
  if (config.channels.webhook.enabled) {
    promises.push(sendWebhookNotification(alert));
  }

  // Send PagerDuty notifications
  if (config.channels.pagerduty.enabled && alert.severity === 'critical') {
    promises.push(sendPagerDutyNotification(alert));
  }

  await Promise.allSettled(promises);
};

// Email notification
const sendEmailNotification = async (alert: Alert) => {
  try {
    if (!config.channels.email.smtp) {
      throw new Error('SMTP configuration not provided');
    }

    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransporter(config.channels.email.smtp);

    const template = config.channels.email.templates[alert.severity] || 'default';
    const subject = `[${alert.severity.toUpperCase()}] ${alert.title}`;
    const html = generateEmailHTML(alert);

    await transporter.sendMail({
      from: config.channels.email.from,
      to: 'ops@learning-assistant.com', // This should be configurable
      subject,
      html,
    });

    logger.info('Email notification sent', { alertId: alert.id, severity: alert.severity });
  } catch (error) {
    logger.error('Failed to send email notification', { alertId: alert.id, error });
  }
};

// Slack notification
const sendSlackNotification = async (alert: Alert) => {
  try {
    if (!config.channels.slack.webhookUrl) {
      throw new Error('Slack webhook URL not configured');
    }

    const color = {
      info: '#36a64f',
      warning: '#ff9500',
      error: '#ff4444',
      critical: '#ff0000',
    }[alert.severity];

    const payload = {
      text: `🚨 ${alert.severity.toUpperCase()}: ${alert.title}`,
      channel: config.channels.slack.channel,
      attachments: [
        {
          color,
          fields: [
            { title: 'Message', value: alert.message, short: false },
            { title: 'Category', value: alert.category, short: true },
            { title: 'Severity', value: alert.severity, short: true },
            { title: 'Time', value: alert.timestamp, short: true },
          ],
        },
      ],
    };

    await fetch(config.channels.slack.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    logger.info('Slack notification sent', { alertId: alert.id, severity: alert.severity });
  } catch (error) {
    logger.error('Failed to send Slack notification', { alertId: alert.id, error });
  }
};

// Webhook notification
const sendWebhookNotification = async (alert: Alert) => {
  try {
    if (!config.channels.webhook.url) {
      throw new Error('Webhook URL not configured');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.channels.webhook.auth) {
      headers['Authorization'] = `Bearer ${config.channels.webhook.auth.token}`;
    }

    await fetch(config.channels.webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        alert,
        timestamp: new Date().toISOString(),
        service: 'learning-assistant',
      }),
    });

    logger.info('Webhook notification sent', { alertId: alert.id, severity: alert.severity });
  } catch (error) {
    logger.error('Failed to send webhook notification', { alertId: alert.id, error });
  }
};

// PagerDuty notification
const sendPagerDutyNotification = async (alert: Alert) => {
  try {
    if (!config.channels.pagerduty.routingKey) {
      throw new Error('PagerDuty routing key not configured');
    }

    const payload = {
      routing_key: config.channels.pagerduty.routingKey,
      event_action: 'trigger',
      payload: {
        summary: `${alert.title}: ${alert.message}`,
        severity: alert.severity,
        source: 'learning-assistant',
        component: alert.category,
        group: alert.category,
        class: alert.severity,
        custom_details: alert.metadata,
      },
    };

    await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    logger.info('PagerDuty notification sent', { alertId: alert.id, severity: alert.severity });
  } catch (error) {
    logger.error('Failed to send PagerDuty notification', { alertId: alert.id, error });
  }
};

// Helper functions
const generateAlertId = () => {
  return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const generateEmailHTML = (alert: Alert) => {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="color: ${alert.severity === 'critical' ? '#ff0000' : alert.severity === 'error' ? '#ff4444' : alert.severity === 'warning' ? '#ff9500' : '#36a64f'};">
            ${alert.severity.toUpperCase()}: ${alert.title}
          </h2>
          <p><strong>Message:</strong> ${alert.message}</p>
          <p><strong>Category:</strong> ${alert.category}</p>
          <p><strong>Severity:</strong> ${alert.severity}</p>
          <p><strong>Time:</strong> ${alert.timestamp}</p>
          ${alert.metadata ? `<p><strong>Details:</strong> <pre>${JSON.stringify(alert.metadata, null, 2)}</pre></p>` : ''}
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            This alert was generated by the Learning Assistant monitoring system.
          </p>
        </div>
      </body>
    </html>
  `;
};

// Auto-cleanup old alerts
setInterval(() => {
  const cutoffDate = new Date(Date.now() - (config.retentionDays * 24 * 60 * 60 * 1000));
  
  for (const [alertId, alert] of alertHistory.entries()) {
    if (new Date(alert.timestamp) < cutoffDate) {
      alertHistory.delete(alertId);
    }
  }
}, 24 * 60 * 60 * 1000); // Run daily

export default alertManager;