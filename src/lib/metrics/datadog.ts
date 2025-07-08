/**
 * Datadog metrics provider
 * Provides a clean interface for Datadog APM and metrics
 */
import { StatsD } from 'hot-shots';

interface DatadogConfig {
  apiKey: string;
  appKey: string;
  site: string;
  prefix: string;
  tags: Record<string, string>;
  host?: string;
  port?: number;
}

export const createDatadogClient = (config: DatadogConfig) => {
  // Initialize StatsD client for metrics
  const statsd = new StatsD({
    host: config.host || 'localhost',
    port: config.port || 8125,
    prefix: config.prefix + '.',
    globalTags: Object.entries(config.tags).map(([key, value]) => `${key}:${value}`),
  });

  // Helper to format tags
  const formatTags = (tags: Record<string, string> = {}) => {
    return Object.entries({ ...config.tags, ...tags }).map(([key, value]) => `${key}:${value}`);
  };

  return {
    // Record counter metric
    recordCounter: (name: string, value: number, tags?: Record<string, string>) => {
      statsd.increment(name, value, formatTags(tags));
    },

    // Record histogram metric
    recordHistogram: (name: string, value: number, tags?: Record<string, string>) => {
      statsd.histogram(name, value, formatTags(tags));
    },

    // Record gauge metric
    recordGauge: (name: string, value: number, tags?: Record<string, string>) => {
      statsd.gauge(name, value, formatTags(tags));
    },

    // Record timing metric
    recordTiming: (name: string, value: number, tags?: Record<string, string>) => {
      statsd.timing(name, value, formatTags(tags));
    },

    // Record distribution metric
    recordDistribution: (name: string, value: number, tags?: Record<string, string>) => {
      statsd.distribution(name, value, formatTags(tags));
    },

    // Send custom event to Datadog
    sendEvent: async (title: string, text: string, tags?: Record<string, string>) => {
      try {
        const response = await fetch(`https://api.${config.site}/api/v1/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'DD-API-KEY': config.apiKey,
          },
          body: JSON.stringify({
            title,
            text,
            tags: formatTags(tags),
            source_type_name: 'learning-assistant',
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        console.error('Failed to send Datadog event:', error);
        throw error;
      }
    },

    // Send log to Datadog
    sendLog: async (message: string, level: 'info' | 'warning' | 'error', tags?: Record<string, string>) => {
      try {
        const response = await fetch(`https://http-intake.logs.${config.site}/v1/input/${config.apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message,
            level,
            service: 'learning-assistant',
            tags: formatTags(tags),
            timestamp: new Date().toISOString(),
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        console.error('Failed to send Datadog log:', error);
        throw error;
      }
    },

    // Send metric to Datadog API
    sendMetric: async (metric: string, value: number, type: 'gauge' | 'counter' | 'histogram', tags?: Record<string, string>) => {
      try {
        const response = await fetch(`https://api.${config.site}/api/v1/series`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'DD-API-KEY': config.apiKey,
          },
          body: JSON.stringify({
            series: [
              {
                metric: `${config.prefix}.${metric}`,
                points: [[Math.floor(Date.now() / 1000), value]],
                type,
                tags: formatTags(tags),
              },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        console.error('Failed to send Datadog metric:', error);
        throw error;
      }
    },

    // Health check
    healthCheck: () => {
      try {
        statsd.gauge('health_check', 1, formatTags({ check: 'client' }));
        return true;
      } catch (error) {
        return false;
      }
    },

    // Close connection
    close: () => {
      statsd.close();
    },

    // Get client instance
    getClient: () => statsd,
  };
};

export default createDatadogClient;