/**
 * Multi-provider APM service
 * Integrates with multiple monitoring providers simultaneously
 */
import { createPrometheusMetrics } from './metrics/prometheus';
import { createDatadogClient } from './metrics/datadog';
import { createNewRelicClient } from './metrics/newrelic';
import * as Sentry from '@sentry/nextjs';
import { createLogger } from './logger';

const logger = createLogger('apm-providers');

// Provider interface
interface APMProvider {
  name: string;
  enabled: boolean;
  client: any;
  recordMetric: (name: string, value: number, type: 'counter' | 'gauge' | 'histogram', tags?: Record<string, string>) => void;
  recordEvent: (name: string, attributes?: Record<string, any>) => void;
  recordError: (error: Error, context?: Record<string, any>) => void;
  startTrace: (name: string, metadata?: Record<string, any>) => string;
  endTrace: (traceId: string, metadata?: Record<string, any>) => void;
  healthCheck: () => boolean;
}

// Multi-provider APM configuration
interface APMConfig {
  providers: {
    prometheus: {
      enabled: boolean;
      prefix: string;
      labels: Record<string, string>;
    };
    datadog: {
      enabled: boolean;
      apiKey?: string;
      appKey?: string;
      site: string;
      prefix: string;
      tags: Record<string, string>;
    };
    newrelic: {
      enabled: boolean;
      apiKey?: string;
      accountId?: string;
      appName: string;
      region: 'US' | 'EU';
    };
    sentry: {
      enabled: boolean;
      dsn?: string;
      environment: string;
    };
  };
  sampling: {
    tracesSampleRate: number;
    errorSampleRate: number;
    performanceSampleRate: number;
  };
  bufferSize: number;
  flushInterval: number;
}

// Default configuration
const defaultConfig: APMConfig = {
  providers: {
    prometheus: {
      enabled: process.env.PROMETHEUS_ENABLED === 'true',
      prefix: process.env.PROMETHEUS_PREFIX || 'learning_assistant',
      labels: {
        service: 'learning-assistant',
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
      },
    },
    datadog: {
      enabled: process.env.DATADOG_ENABLED === 'true',
      apiKey: process.env.DATADOG_API_KEY,
      appKey: process.env.DATADOG_APP_KEY,
      site: process.env.DATADOG_SITE || 'datadoghq.com',
      prefix: process.env.DATADOG_PREFIX || 'learning_assistant',
      tags: {
        service: 'learning-assistant',
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
      },
    },
    newrelic: {
      enabled: process.env.NEW_RELIC_ENABLED === 'true',
      apiKey: process.env.NEW_RELIC_API_KEY,
      accountId: process.env.NEW_RELIC_ACCOUNT_ID,
      appName: process.env.NEW_RELIC_APP_NAME || 'learning-assistant',
      region: (process.env.NEW_RELIC_REGION as 'US' | 'EU') || 'US',
    },
    sentry: {
      enabled: process.env.SENTRY_DSN !== undefined,
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
    },
  },
  sampling: {
    tracesSampleRate: parseFloat(process.env.TRACES_SAMPLE_RATE || '0.1'),
    errorSampleRate: parseFloat(process.env.ERROR_SAMPLE_RATE || '1.0'),
    performanceSampleRate: parseFloat(process.env.PERFORMANCE_SAMPLE_RATE || '0.1'),
  },
  bufferSize: parseInt(process.env.APM_BUFFER_SIZE || '1000'),
  flushInterval: parseInt(process.env.APM_FLUSH_INTERVAL || '30000'),
};

class MultiProviderAPM {
  private providers: Map<string, APMProvider> = new Map();
  private config: APMConfig;
  private metricsBuffer: any[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(config: APMConfig = defaultConfig) {
    this.config = config;
    this.initializeProviders();
    this.startFlushInterval();
  }

  private initializeProviders() {
    try {
      // Initialize Prometheus
      if (this.config.providers.prometheus.enabled) {
        const prometheusClient = createPrometheusMetrics(this.config.providers.prometheus);
        this.providers.set('prometheus', {
          name: 'prometheus',
          enabled: true,
          client: prometheusClient,
          recordMetric: (name, value, type, tags) => {
            switch (type) {
              case 'counter':
                prometheusClient.recordCounter(name, value, tags);
                break;
              case 'gauge':
                prometheusClient.recordGauge(name, value, tags);
                break;
              case 'histogram':
                prometheusClient.recordHistogram(name, value, tags);
                break;
            }
          },
          recordEvent: (name, attributes) => {
            // Prometheus doesn't have events, convert to counter
            prometheusClient.recordCounter(`event_${name}`, 1, attributes);
          },
          recordError: (error, context) => {
            prometheusClient.recordCounter('errors_total', 1, {
              error_type: error.name,
              ...context,
            });
          },
          startTrace: (name, metadata) => {
            const traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            prometheusClient.recordCounter('traces_started', 1, { operation: name, ...metadata });
            return traceId;
          },
          endTrace: (traceId, metadata) => {
            prometheusClient.recordCounter('traces_completed', 1, metadata);
          },
          healthCheck: () => prometheusClient.healthCheck(),
        });
        logger.info('Prometheus provider initialized');
      }

      // Initialize Datadog
      if (this.config.providers.datadog.enabled && this.config.providers.datadog.apiKey) {
        const datadogClient = createDatadogClient(this.config.providers.datadog as any);
        this.providers.set('datadog', {
          name: 'datadog',
          enabled: true,
          client: datadogClient,
          recordMetric: (name, value, type, tags) => {
            switch (type) {
              case 'counter':
                datadogClient.recordCounter(name, value, tags);
                break;
              case 'gauge':
                datadogClient.recordGauge(name, value, tags);
                break;
              case 'histogram':
                datadogClient.recordHistogram(name, value, tags);
                break;
            }
          },
          recordEvent: (name, attributes) => {
            datadogClient.sendEvent(name, JSON.stringify(attributes), attributes);
          },
          recordError: (error, context) => {
            datadogClient.recordCounter('errors_total', 1, {
              error_type: error.name,
              error_message: error.message,
              ...context,
            });
          },
          startTrace: (name, metadata) => {
            const traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            datadogClient.recordCounter('traces_started', 1, { operation: name, ...metadata });
            return traceId;
          },
          endTrace: (traceId, metadata) => {
            datadogClient.recordCounter('traces_completed', 1, metadata);
          },
          healthCheck: () => datadogClient.healthCheck(),
        });
        logger.info('Datadog provider initialized');
      }

      // Initialize New Relic
      if (this.config.providers.newrelic.enabled && this.config.providers.newrelic.apiKey) {
        const newrelicClient = createNewRelicClient(this.config.providers.newrelic as any);
        this.providers.set('newrelic', {
          name: 'newrelic',
          enabled: true,
          client: newrelicClient,
          recordMetric: (name, value, type, tags) => {
            switch (type) {
              case 'counter':
                newrelicClient.recordCounter(name, value, tags);
                break;
              case 'gauge':
                newrelicClient.recordGauge(name, value, tags);
                break;
              case 'histogram':
                newrelicClient.recordHistogram(name, value, tags);
                break;
            }
          },
          recordEvent: (name, attributes) => {
            newrelicClient.sendCustomEvent(name, attributes);
          },
          recordError: (error, context) => {
            newrelicClient.recordError(error, context);
          },
          startTrace: (name, metadata) => {
            const traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            newrelicClient.recordCounter('traces_started', 1, { operation: name, ...metadata });
            return traceId;
          },
          endTrace: (traceId, metadata) => {
            newrelicClient.recordCounter('traces_completed', 1, metadata);
          },
          healthCheck: () => newrelicClient.healthCheck(),
        });
        logger.info('New Relic provider initialized');
      }

      // Initialize Sentry
      if (this.config.providers.sentry.enabled) {
        this.providers.set('sentry', {
          name: 'sentry',
          enabled: true,
          client: Sentry,
          recordMetric: (name, value, type, tags) => {
            // Sentry doesn't support direct metrics, use events
            Sentry.addBreadcrumb({
              message: `Metric: ${name}`,
              level: 'info',
              data: { value, type, ...tags },
            });
          },
          recordEvent: (name, attributes) => {
            Sentry.addBreadcrumb({
              message: `Event: ${name}`,
              level: 'info',
              data: attributes,
            });
          },
          recordError: (error, context) => {
            Sentry.captureException(error, {
              tags: context,
              extra: context,
            });
          },
          startTrace: (name, metadata) => {
            const span = Sentry.startSpan({
              name,
              forceTransaction: true,
              attributes: metadata,
            }, (s) => s);
            return span.toTraceparent();
          },
          endTrace: (traceId, metadata) => {
            // Sentry transactions are handled differently
            // This is a simplified implementation
            Sentry.addBreadcrumb({
              message: `Trace ended: ${traceId}`,
              level: 'info',
              data: metadata,
            });
          },
          healthCheck: () => true, // Sentry doesn't have a specific health check
        });
        logger.info('Sentry provider initialized');
      }

    } catch (error) {
      logger.error('Error initializing APM providers:', error);
    }
  }

  private startFlushInterval() {
    this.flushInterval = setInterval(() => {
      this.flushMetrics();
    }, this.config.flushInterval);
  }

  private flushMetrics() {
    if (this.metricsBuffer.length === 0) return;

    try {
      const metricsToFlush = [...this.metricsBuffer];
      this.metricsBuffer = [];

      // Process buffered metrics
      for (const metric of metricsToFlush) {
        this.providers.forEach((provider) => {
          if (provider.enabled) {
            try {
              provider.recordMetric(metric.name, metric.value, metric.type, metric.tags);
            } catch (error) {
              logger.error(`Error flushing metric to ${provider.name}:`, error);
            }
          }
        });
      }

      logger.debug(`Flushed ${metricsToFlush.length} metrics to ${this.providers.size} providers`);
    } catch (error) {
      logger.error('Error flushing metrics:', error);
    }
  }

  // Public API
  public recordMetric(name: string, value: number, type: 'counter' | 'gauge' | 'histogram', tags?: Record<string, string>) {
    if (this.metricsBuffer.length >= this.config.bufferSize) {
      this.flushMetrics();
    }

    this.metricsBuffer.push({ name, value, type, tags });

    // For critical metrics, send immediately
    if (type === 'counter' && (name.includes('error') || name.includes('critical'))) {
      this.providers.forEach((provider) => {
        if (provider.enabled) {
          try {
            provider.recordMetric(name, value, type, tags);
          } catch (error) {
            logger.error(`Error recording critical metric to ${provider.name}:`, error);
          }
        }
      });
    }
  }

  public recordEvent(name: string, attributes?: Record<string, any>) {
    this.providers.forEach((provider) => {
      if (provider.enabled) {
        try {
          provider.recordEvent(name, attributes);
        } catch (error) {
          logger.error(`Error recording event to ${provider.name}:`, error);
        }
      }
    });
  }

  public recordError(error: Error, context?: Record<string, any>) {
    this.providers.forEach((provider) => {
      if (provider.enabled) {
        try {
          provider.recordError(error, context);
        } catch (error) {
          logger.error(`Error recording error to ${provider.name}:`, error);
        }
      }
    });
  }

  public startTrace(name: string, metadata?: Record<string, any>): string {
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.providers.forEach((provider) => {
      if (provider.enabled) {
        try {
          provider.startTrace(name, { traceId, ...metadata });
        } catch (error) {
          logger.error(`Error starting trace in ${provider.name}:`, error);
        }
      }
    });

    return traceId;
  }

  public endTrace(traceId: string, metadata?: Record<string, any>) {
    this.providers.forEach((provider) => {
      if (provider.enabled) {
        try {
          provider.endTrace(traceId, metadata);
        } catch (error) {
          logger.error(`Error ending trace in ${provider.name}:`, error);
        }
      }
    });
  }

  public getProviderStatus(): Record<string, { enabled: boolean; healthy: boolean }> {
    const status: Record<string, { enabled: boolean; healthy: boolean }> = {};
    
    this.providers.forEach((provider, name) => {
      status[name] = {
        enabled: provider.enabled,
        healthy: provider.healthCheck(),
      };
    });

    return status;
  }

  public getMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    
    this.providers.forEach((provider, name) => {
      metrics[name] = {
        enabled: provider.enabled,
        healthy: provider.healthCheck(),
      };
    });

    metrics.buffer = {
      size: this.metricsBuffer.length,
      capacity: this.config.bufferSize,
    };

    return metrics;
  }

  public healthCheck(): boolean {
    const enabledProviders = Array.from(this.providers.values()).filter(p => p.enabled);
    if (enabledProviders.length === 0) return false;

    const healthyProviders = enabledProviders.filter(p => p.healthCheck());
    return healthyProviders.length > 0; // At least one provider must be healthy
  }

  public shutdown() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushMetrics();
    
    this.providers.forEach((provider) => {
      if (provider.client?.close) {
        provider.client.close();
      }
    });
  }
}

// Create singleton instance
export const multiProviderAPM = new MultiProviderAPM();

// Export for use in other modules
export default multiProviderAPM;