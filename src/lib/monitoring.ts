/**
 * Comprehensive monitoring and observability service
 * Supports multiple APM providers: Datadog, New Relic, Sentry, and custom metrics
 */
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createPrometheusMetrics } from './metrics/prometheus';
import { createDatadogClient } from './metrics/datadog';
import { createNewRelicClient } from './metrics/newrelic';
import { createLogger } from './logger';
import { env } from './env-validation';

// Import existing monitoring components
import { apm } from './apm';
import { metricsUtils } from './metrics';
import monitoringService from './monitoring/index';

const logger = createLogger('monitoring');

// Monitoring configuration
interface MonitoringConfig {
  enabled: boolean;
  provider: 'datadog' | 'newrelic' | 'sentry' | 'prometheus' | 'custom';
  sampleRate: number;
  errorThreshold: number;
  performanceThreshold: number;
  healthCheckInterval: number;
  retentionDays: number;
  alerting: {
    enabled: boolean;
    webhookUrl?: string;
    slackChannel?: string;
    emailRecipients?: string[];
    escalationPolicy?: string;
  };
  customMetrics: {
    enabled: boolean;
    prefix: string;
    tags: Record<string, string>;
  };
  tracing: {
    enabled: boolean;
    sampleRate: number;
    serviceName: string;
  };
  syntheticMonitoring: {
    enabled: boolean;
    urls: string[];
    interval: number;
  };
}

const config: MonitoringConfig = {
  enabled: env.NODE_ENV === 'production' || process.env.ENABLE_MONITORING === 'true',
  provider: (process.env.MONITORING_PROVIDER as any) || 'custom',
  sampleRate: parseFloat(process.env.MONITORING_SAMPLE_RATE || '1.0'),
  errorThreshold: parseInt(process.env.ERROR_THRESHOLD || '10'),
  performanceThreshold: parseInt(process.env.PERFORMANCE_THRESHOLD || '2000'),
  healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '60000'),
  retentionDays: parseInt(process.env.METRICS_RETENTION_DAYS || '30'),
  alerting: {
    enabled: process.env.ENABLE_ALERTING === 'true',
    webhookUrl: process.env.ALERT_WEBHOOK_URL,
    slackChannel: process.env.ALERT_SLACK_CHANNEL,
    emailRecipients: process.env.ALERT_EMAIL_RECIPIENTS?.split(',') || [],
    escalationPolicy: process.env.ALERT_ESCALATION_POLICY || 'immediate',
  },
  customMetrics: {
    enabled: process.env.ENABLE_CUSTOM_METRICS === 'true',
    prefix: process.env.METRICS_PREFIX || 'learning_assistant',
    tags: {
      environment: env.NODE_ENV,
      service: 'learning-assistant',
      version: process.env.npm_package_version || '1.0.0',
    },
  },
  tracing: {
    enabled: process.env.ENABLE_TRACING === 'true',
    sampleRate: parseFloat(process.env.TRACING_SAMPLE_RATE || '0.1'),
    serviceName: process.env.SERVICE_NAME || 'learning-assistant',
  },
  syntheticMonitoring: {
    enabled: process.env.ENABLE_SYNTHETIC_MONITORING === 'true',
    urls: process.env.SYNTHETIC_MONITOR_URLS?.split(',') || [],
    interval: parseInt(process.env.SYNTHETIC_MONITOR_INTERVAL || '300000'), // 5 minutes
  },
};

// Initialize monitoring providers
let monitoringProvider: any = null;
let metricsClient: any = null;
let tracingClient: any = null;

const initializeMonitoring = async () => {
  if (!config.enabled) return;

  try {
    switch (config.provider) {
      case 'datadog':
        metricsClient = createDatadogClient({
          apiKey: process.env.DATADOG_API_KEY!,
          appKey: process.env.DATADOG_APP_KEY!,
          site: process.env.DATADOG_SITE || 'datadoghq.com',
          prefix: config.customMetrics.prefix,
          tags: config.customMetrics.tags,
        });
        break;
      case 'newrelic':
        metricsClient = createNewRelicClient({
          apiKey: process.env.NEW_RELIC_API_KEY!,
          accountId: process.env.NEW_RELIC_ACCOUNT_ID!,
          appName: config.tracing.serviceName,
          region: process.env.NEW_RELIC_REGION || 'US',
        });
        break;
      case 'prometheus':
        metricsClient = createPrometheusMetrics({
          prefix: config.customMetrics.prefix,
          labels: config.customMetrics.tags,
        });
        break;
      case 'sentry':
        // Sentry is already initialized via @sentry/nextjs
        break;
      default:
        // Use custom metrics implementation
        metricsClient = metricsUtils;
        break;
    }

    logger.info('Monitoring initialized', {
      provider: config.provider,
      enabled: config.enabled,
      tracing: config.tracing.enabled,
      customMetrics: config.customMetrics.enabled,
    });
  } catch (error) {
    logger.error('Failed to initialize monitoring', error);
  }
};

// Business metrics for learning system
export const businessMetrics = {
  // User engagement metrics
  trackUserEngagement: (userId: string, sessionDuration: number, contentViews: number, interactions: number) => {
    if (!config.enabled) return;

    const metrics = {
      session_duration: sessionDuration,
      content_views: contentViews,
      interactions: interactions,
      timestamp: Date.now(),
    };

    metricsClient?.recordGauge('user_engagement_session_duration', sessionDuration, {
      user_id: userId,
      ...config.customMetrics.tags,
    });

    metricsClient?.recordCounter('user_engagement_content_views', contentViews, {
      user_id: userId,
      ...config.customMetrics.tags,
    });

    metricsClient?.recordCounter('user_engagement_interactions', interactions, {
      user_id: userId,
      ...config.customMetrics.tags,
    });

    logger.info('User engagement tracked', { userId, ...metrics });
  },

  // Learning effectiveness metrics
  trackLearningEffectiveness: (userId: string, contentId: string, completionRate: number, scoreImprovement: number, timeSpent: number) => {
    if (!config.enabled) return;

    const metrics = {
      completion_rate: completionRate,
      score_improvement: scoreImprovement,
      time_spent: timeSpent,
      timestamp: Date.now(),
    };

    metricsClient?.recordGauge('learning_completion_rate', completionRate, {
      user_id: userId,
      content_id: contentId,
      ...config.customMetrics.tags,
    });

    metricsClient?.recordGauge('learning_score_improvement', scoreImprovement, {
      user_id: userId,
      content_id: contentId,
      ...config.customMetrics.tags,
    });

    metricsClient?.recordGauge('learning_time_spent', timeSpent, {
      user_id: userId,
      content_id: contentId,
      ...config.customMetrics.tags,
    });

    logger.info('Learning effectiveness tracked', { userId, contentId, ...metrics });
  },

  // Content performance metrics
  trackContentPerformance: (contentId: string, contentType: string, avgRating: number, completionRate: number, timeToComplete: number) => {
    if (!config.enabled) return;

    const metrics = {
      avg_rating: avgRating,
      completion_rate: completionRate,
      time_to_complete: timeToComplete,
      timestamp: Date.now(),
    };

    metricsClient?.recordGauge('content_avg_rating', avgRating, {
      content_id: contentId,
      content_type: contentType,
      ...config.customMetrics.tags,
    });

    metricsClient?.recordGauge('content_completion_rate', completionRate, {
      content_id: contentId,
      content_type: contentType,
      ...config.customMetrics.tags,
    });

    metricsClient?.recordGauge('content_time_to_complete', timeToComplete, {
      content_id: contentId,
      content_type: contentType,
      ...config.customMetrics.tags,
    });

    logger.info('Content performance tracked', { contentId, contentType, ...metrics });
  },

  // System performance metrics
  trackSystemPerformance: (cpuUsage: number, memoryUsage: number, activeUsers: number, responseTime: number) => {
    if (!config.enabled) return;

    const metrics = {
      cpu_usage: cpuUsage,
      memory_usage: memoryUsage,
      active_users: activeUsers,
      response_time: responseTime,
      timestamp: Date.now(),
    };

    metricsClient?.recordGauge('system_cpu_usage', cpuUsage, config.customMetrics.tags);
    metricsClient?.recordGauge('system_memory_usage', memoryUsage, config.customMetrics.tags);
    metricsClient?.recordGauge('system_active_users', activeUsers, config.customMetrics.tags);
    metricsClient?.recordGauge('system_response_time', responseTime, config.customMetrics.tags);

    logger.debug('System performance tracked', metrics);
  },

  // Revenue and conversion metrics
  trackBusinessKPIs: (newUsers: number, retainedUsers: number, conversionRate: number, revenue: number) => {
    if (!config.enabled) return;

    const metrics = {
      new_users: newUsers,
      retained_users: retainedUsers,
      conversion_rate: conversionRate,
      revenue: revenue,
      timestamp: Date.now(),
    };

    metricsClient?.recordGauge('business_new_users', newUsers, config.customMetrics.tags);
    metricsClient?.recordGauge('business_retained_users', retainedUsers, config.customMetrics.tags);
    metricsClient?.recordGauge('business_conversion_rate', conversionRate, config.customMetrics.tags);
    metricsClient?.recordGauge('business_revenue', revenue, config.customMetrics.tags);

    logger.info('Business KPIs tracked', metrics);
  },
};

// Alert management
export const alertManager = {
  // Send critical alert
  sendCriticalAlert: async (title: string, message: string, metadata?: any) => {
    if (!config.alerting.enabled) return;

    const alert = {
      severity: 'critical',
      title,
      message,
      metadata,
      timestamp: new Date().toISOString(),
      service: config.tracing.serviceName,
    };

    // Send to Sentry
    Sentry.captureMessage(`CRITICAL: ${title} - ${message}`, 'error');

    // Send to webhook
    if (config.alerting.webhookUrl) {
      try {
        await fetch(config.alerting.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alert),
        });
      } catch (error) {
        logger.error('Failed to send webhook alert', error);
      }
    }

    // Send to Slack
    if (config.alerting.slackChannel) {
      try {
        await sendSlackAlert(alert);
      } catch (error) {
        logger.error('Failed to send Slack alert', error);
      }
    }

    // Send email alerts
    if (config.alerting.emailRecipients.length > 0) {
      try {
        await sendEmailAlert(alert);
      } catch (error) {
        logger.error('Failed to send email alert', error);
      }
    }

    logger.error('Critical alert sent', alert);
  },

  // Send warning alert
  sendWarningAlert: async (title: string, message: string, metadata?: any) => {
    if (!config.alerting.enabled) return;

    const alert = {
      severity: 'warning',
      title,
      message,
      metadata,
      timestamp: new Date().toISOString(),
      service: config.tracing.serviceName,
    };

    // Send to Sentry
    Sentry.captureMessage(`WARNING: ${title} - ${message}`, 'warning');

    // Send to webhook for warnings based on escalation policy
    if (config.alerting.webhookUrl && config.alerting.escalationPolicy !== 'critical-only') {
      try {
        await fetch(config.alerting.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alert),
        });
      } catch (error) {
        logger.error('Failed to send webhook alert', error);
      }
    }

    logger.warn('Warning alert sent', alert);
  },

  // Check thresholds and send alerts
  checkThresholds: async (metrics: any) => {
    if (!config.alerting.enabled) return;

    // Check error rate threshold
    if (metrics.errorRate > config.errorThreshold) {
      await alertManager.sendCriticalAlert(
        'High Error Rate',
        `Error rate is ${metrics.errorRate}%, above threshold of ${config.errorThreshold}%`,
        { errorRate: metrics.errorRate, threshold: config.errorThreshold }
      );
    }

    // Check response time threshold
    if (metrics.avgResponseTime > config.performanceThreshold) {
      await alertManager.sendWarningAlert(
        'High Response Time',
        `Average response time is ${metrics.avgResponseTime}ms, above threshold of ${config.performanceThreshold}ms`,
        { avgResponseTime: metrics.avgResponseTime, threshold: config.performanceThreshold }
      );
    }

    // Check memory usage threshold
    if (metrics.memoryUsage > 85) {
      await alertManager.sendCriticalAlert(
        'High Memory Usage',
        `Memory usage is ${metrics.memoryUsage}%, above critical threshold of 85%`,
        { memoryUsage: metrics.memoryUsage, threshold: 85 }
      );
    }

    // Check CPU usage threshold
    if (metrics.cpuUsage > 90) {
      await alertManager.sendCriticalAlert(
        'High CPU Usage',
        `CPU usage is ${metrics.cpuUsage}%, above critical threshold of 90%`,
        { cpuUsage: metrics.cpuUsage, threshold: 90 }
      );
    }
  },
};

// Helper functions
const sendSlackAlert = async (alert: any) => {
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!slackWebhookUrl) return;

  const slackMessage = {
    text: `🚨 ${alert.severity.toUpperCase()}: ${alert.title}`,
    attachments: [
      {
        color: alert.severity === 'critical' ? 'danger' : 'warning',
        fields: [
          { title: 'Message', value: alert.message, short: false },
          { title: 'Service', value: alert.service, short: true },
          { title: 'Time', value: alert.timestamp, short: true },
        ],
      },
    ],
  };

  await fetch(slackWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(slackMessage),
  });
};

const sendEmailAlert = async (alert: any) => {
  // This would integrate with your email service (e.g., SendGrid, AWS SES)
  // For now, we'll just log the alert
  logger.info('Email alert would be sent', {
    recipients: config.alerting.emailRecipients,
    alert,
  });
};

// Distributed tracing
export const tracing = {
  // Start a trace
  startTrace: (operationName: string, metadata?: any) => {
    if (!config.tracing.enabled) return null;

    const traceId = apm.startTrace(operationName, metadata);
    
    // Add to Sentry span
    const span = Sentry.startSpan({
      name: operationName,
      forceTransaction: true,
      attributes: metadata,
    }, (s) => s);

    return { traceId, transaction: span };
  },

  // End a trace
  endTrace: (trace: any, metadata?: any) => {
    if (!config.tracing.enabled || !trace) return;

    const duration = apm.endTrace(trace.traceId, metadata);
    
    if (trace.transaction) {
      trace.transaction.setData('duration', duration);
      trace.transaction.finish();
    }

    return duration;
  },

  // Add span to trace
  addSpan: (trace: any, spanName: string, metadata?: any) => {
    if (!config.tracing.enabled || !trace) return null;

    const span = trace.transaction?.startChild({
      op: spanName,
      data: metadata,
    });

    return span;
  },

  // End span
  endSpan: (span: any, metadata?: any) => {
    if (!config.tracing.enabled || !span) return;

    if (metadata) {
      span.setData('metadata', metadata);
    }
    span.finish();
  },
};

// Request monitoring middleware
export const requestMonitoring = (req: NextRequest) => {
  if (!config.enabled) return null;

  const startTime = Date.now();
  const trace = tracing.startTrace('http_request', {
    method: req.method,
    url: req.url,
    userAgent: req.headers.get('user-agent'),
  });

  return {
    trace,
    startTime,
    end: (response: NextResponse) => {
      const duration = Date.now() - startTime;
      const statusCode = response.status;

      // Track the request
      apm.trackApiRequest(req.method, req.url, statusCode, duration);

      // Track business metrics
      businessMetrics.trackSystemPerformance(
        0, // CPU usage - would need to be calculated
        0, // Memory usage - would need to be calculated
        1, // Active users - would need to be tracked
        duration
      );

      // End trace
      tracing.endTrace(trace, {
        statusCode,
        duration,
        success: statusCode < 400,
      });

      return duration;
    },
  };
};

// Synthetic monitoring
export const syntheticMonitoring = {
  // Run synthetic checks
  runSyntheticChecks: async () => {
    if (!config.syntheticMonitoring.enabled) return;

    const results = [];
    
    for (const url of config.syntheticMonitoring.urls) {
      try {
        const startTime = Date.now();
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'User-Agent': 'Learning-Assistant-Synthetic-Monitor' },
        });
        const duration = Date.now() - startTime;

        const result = {
          url,
          statusCode: response.status,
          duration,
          success: response.ok,
          timestamp: new Date().toISOString(),
        };

        results.push(result);

        // Track metrics
        metricsClient?.recordGauge('synthetic_check_duration', duration, {
          url,
          status: response.status.toString(),
          ...config.customMetrics.tags,
        });

        metricsClient?.recordCounter('synthetic_check_total', 1, {
          url,
          status: response.ok ? 'success' : 'failure',
          ...config.customMetrics.tags,
        });

        // Send alert if check fails
        if (!response.ok) {
          await alertManager.sendCriticalAlert(
            'Synthetic Check Failed',
            `Synthetic check for ${url} failed with status ${response.status}`,
            { url, statusCode: response.status, duration }
          );
        }

        logger.info('Synthetic check completed', result);
      } catch (error) {
        const result = {
          url,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false,
          timestamp: new Date().toISOString(),
        };

        results.push(result);

        // Track error
        metricsClient?.recordCounter('synthetic_check_total', 1, {
          url,
          status: 'error',
          ...config.customMetrics.tags,
        });

        // Send alert
        await alertManager.sendCriticalAlert(
          'Synthetic Check Error',
          `Synthetic check for ${url} failed with error: ${result.error}`,
          { url, error: result.error }
        );

        logger.error('Synthetic check failed', result);
      }
    }

    return results;
  },

  // Start synthetic monitoring
  startSyntheticMonitoring: () => {
    if (!config.syntheticMonitoring.enabled) return;

    const interval = setInterval(async () => {
      await syntheticMonitoring.runSyntheticChecks();
    }, config.syntheticMonitoring.interval);

    logger.info('Synthetic monitoring started', {
      interval: config.syntheticMonitoring.interval,
      urls: config.syntheticMonitoring.urls,
    });

    return interval;
  },
};

// Main monitoring service
export const monitoring = {
  // Initialize monitoring
  initialize: async () => {
    await initializeMonitoring();
    
    // Start synthetic monitoring
    if (config.syntheticMonitoring.enabled) {
      syntheticMonitoring.startSyntheticMonitoring();
    }

    // Start periodic health checks
    setInterval(async () => {
      const metrics = apm.getMetrics();
      await alertManager.checkThresholds(metrics);
    }, config.healthCheckInterval);

    logger.info('Monitoring service initialized', { config });
  },

  // Get configuration
  getConfig: () => config,

  // Update configuration
  updateConfig: (newConfig: Partial<MonitoringConfig>) => {
    Object.assign(config, newConfig);
    logger.info('Monitoring configuration updated', newConfig);
  },

  // Get health status
  getHealth: () => {
    const metrics = apm.getMetrics();
    const isHealthy = apm.healthCheck() && monitoringService.healthCheck.isHealthy();
    
    return {
      healthy: isHealthy,
      metrics,
      timestamp: new Date().toISOString(),
      config: {
        enabled: config.enabled,
        provider: config.provider,
        tracing: config.tracing.enabled,
        alerting: config.alerting.enabled,
      },
    };
  },

  // Manual health check
  performHealthCheck: async () => {
    const health = monitoring.getHealth();
    
    if (!health.healthy) {
      await alertManager.sendCriticalAlert(
        'Health Check Failed',
        'Application health check failed',
        health
      );
    }

    return health;
  },
};

// Export everything
export {
  config,
};

export const healthCheck = monitoring.performHealthCheck;

// Auto-initialize if enabled
if (config.enabled) {
  monitoring.initialize().catch(error => {
    logger.error('Failed to initialize monitoring', error);
  });
}

export default monitoring;