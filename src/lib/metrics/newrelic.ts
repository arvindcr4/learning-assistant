/**
 * New Relic metrics provider
 * Provides a clean interface for New Relic APM and metrics
 */
import newrelic from 'newrelic';

interface NewRelicConfig {
  apiKey: string;
  accountId: string;
  appName: string;
  region: 'US' | 'EU';
}

export const createNewRelicClient = (config: NewRelicConfig) => {
  const baseUrl = config.region === 'EU' 
    ? 'https://api.eu.newrelic.com' 
    : 'https://api.newrelic.com';

  // Helper to send metrics to New Relic
  const sendMetric = async (metrics: any[]) => {
    try {
      const response = await fetch(`${baseUrl}/metric/v1`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': config.apiKey,
        },
        body: JSON.stringify([
          {
            metrics,
            common: {
              'app.name': config.appName,
              'service.name': 'learning-assistant',
            },
          },
        ]),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to send New Relic metric:', error);
      throw error;
    }
  };

  // Helper to send events to New Relic
  const sendEvent = async (events: any[]) => {
    try {
      const response = await fetch(`${baseUrl}/v1/accounts/${config.accountId}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': config.apiKey,
        },
        body: JSON.stringify(events),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to send New Relic event:', error);
      throw error;
    }
  };

  return {
    // Record counter metric
    recordCounter: async (name: string, value: number, attributes?: Record<string, string>) => {
      const metrics = [
        {
          name: `custom.${name}`,
          type: 'count',
          value,
          timestamp: Date.now(),
          attributes: attributes || {},
        },
      ];

      await sendMetric(metrics);
      
      // Also use New Relic agent if available
      if (newrelic?.recordMetric) {
        newrelic.recordMetric(`Custom/${name}`, value);
      }
    },

    // Record gauge metric
    recordGauge: async (name: string, value: number, attributes?: Record<string, string>) => {
      const metrics = [
        {
          name: `custom.${name}`,
          type: 'gauge',
          value,
          timestamp: Date.now(),
          attributes: attributes || {},
        },
      ];

      await sendMetric(metrics);
      
      // Also use New Relic agent if available
      if (newrelic?.recordMetric) {
        newrelic.recordMetric(`Custom/${name}`, value);
      }
    },

    // Record histogram metric
    recordHistogram: async (name: string, value: number, attributes?: Record<string, string>) => {
      const metrics = [
        {
          name: `custom.${name}`,
          type: 'summary',
          value,
          timestamp: Date.now(),
          attributes: attributes || {},
        },
      ];

      await sendMetric(metrics);
      
      // Also use New Relic agent if available
      if (newrelic?.recordMetric) {
        newrelic.recordMetric(`Custom/${name}`, value);
      }
    },

    // Send custom event
    sendCustomEvent: async (eventType: string, attributes: Record<string, any>) => {
      const events = [
        {
          eventType,
          timestamp: Date.now(),
          ...attributes,
        },
      ];

      await sendEvent(events);
      
      // Also use New Relic agent if available
      if (newrelic?.recordCustomEvent) {
        newrelic.recordCustomEvent(eventType, attributes);
      }
    },

    // Add custom attributes to transaction
    addCustomAttributes: (attributes: Record<string, any>) => {
      if (newrelic?.addCustomAttributes) {
        newrelic.addCustomAttributes(attributes);
      }
    },

    // Set user context
    setUser: (userId: string, attributes?: Record<string, any>) => {
      if (newrelic?.setUserID) {
        newrelic.setUserID(userId);
      }
      
      if (attributes && newrelic?.addCustomAttributes) {
        newrelic.addCustomAttributes({ userId, ...attributes });
      }
    },

    // Record error
    recordError: (error: Error, attributes?: Record<string, any>) => {
      if (newrelic?.noticeError) {
        newrelic.noticeError(error, attributes);
      }
    },

    // Start transaction
    startTransaction: (name: string, group?: string) => {
      if (newrelic?.startWebTransaction) {
        return newrelic.startWebTransaction(name, () => {
          // Return a promise that resolves when transaction should end
          return new Promise((resolve) => {
            return { resolve };
          });
        });
      }
      return null;
    },

    // End transaction
    endTransaction: () => {
      if (newrelic?.endTransaction) {
        newrelic.endTransaction();
      }
    },

    // Add trace
    addTrace: (name: string, fn: () => Promise<any>) => {
      if (newrelic?.startSegment) {
        return newrelic.startSegment(name, false, fn);
      }
      return fn();
    },

    // Send log
    sendLog: async (message: string, level: 'info' | 'warning' | 'error', attributes?: Record<string, any>) => {
      const events = [
        {
          eventType: 'LogEvent',
          message,
          level,
          timestamp: Date.now(),
          service: 'learning-assistant',
          ...attributes,
        },
      ];

      await sendEvent(events);
    },

    // Health check
    healthCheck: () => {
      try {
        // Simple check - if New Relic agent is available, we're good
        return newrelic !== undefined;
      } catch (error) {
        return false;
      }
    },

    // Get New Relic agent
    getAgent: () => newrelic,
  };
};

export default createNewRelicClient;