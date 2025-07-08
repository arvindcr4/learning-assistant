/**
 * Prometheus metrics provider
 * Provides a clean interface for Prometheus metrics collection
 */
import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

interface PrometheusConfig {
  prefix: string;
  labels: Record<string, string>;
  collectDefaultMetrics?: boolean;
}

// Metrics storage
const metrics = {
  counters: new Map<string, Counter<string>>(),
  histograms: new Map<string, Histogram<string>>(),
  gauges: new Map<string, Gauge<string>>(),
};

export const createPrometheusMetrics = (config: PrometheusConfig) => {
  // Collect default metrics if enabled
  if (config.collectDefaultMetrics !== false) {
    collectDefaultMetrics({
      prefix: config.prefix + '_',
      register,
    });
  }

  // Helper to create metric name
  const metricName = (name: string) => `${config.prefix}_${name}`;

  // Helper to merge labels
  const mergeLabels = (labels: Record<string, string> = {}) => ({
    ...config.labels,
    ...labels,
  });

  return {
    // Record counter metric
    recordCounter: (name: string, value: number, labels?: Record<string, string>) => {
      const fullName = metricName(name);
      const mergedLabels = mergeLabels(labels);
      
      if (!metrics.counters.has(fullName)) {
        metrics.counters.set(fullName, new Counter({
          name: fullName,
          help: `Counter for ${name}`,
          labelNames: Object.keys(mergedLabels),
          registers: [register],
        }));
      }

      const counter = metrics.counters.get(fullName)!;
      counter.inc(mergedLabels, value);
    },

    // Record histogram metric (for durations, sizes, etc.)
    recordHistogram: (name: string, value: number, labels?: Record<string, string>) => {
      const fullName = metricName(name);
      const mergedLabels = mergeLabels(labels);
      
      if (!metrics.histograms.has(fullName)) {
        metrics.histograms.set(fullName, new Histogram({
          name: fullName,
          help: `Histogram for ${name}`,
          labelNames: Object.keys(mergedLabels),
          buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
          registers: [register],
        }));
      }

      const histogram = metrics.histograms.get(fullName)!;
      histogram.observe(mergedLabels, value);
    },

    // Record gauge metric (for current values)
    recordGauge: (name: string, value: number, labels?: Record<string, string>) => {
      const fullName = metricName(name);
      const mergedLabels = mergeLabels(labels);
      
      if (!metrics.gauges.has(fullName)) {
        metrics.gauges.set(fullName, new Gauge({
          name: fullName,
          help: `Gauge for ${name}`,
          labelNames: Object.keys(mergedLabels),
          registers: [register],
        }));
      }

      const gauge = metrics.gauges.get(fullName)!;
      gauge.set(mergedLabels, value);
    },

    // Get metrics for HTTP endpoint
    getMetrics: async () => {
      return register.metrics();
    },

    // Clear all metrics
    clear: () => {
      register.clear();
      metrics.counters.clear();
      metrics.histograms.clear();
      metrics.gauges.clear();
    },

    // Get registry
    getRegistry: () => register,

    // Health check
    healthCheck: () => {
      try {
        return register.metrics() !== undefined;
      } catch (error) {
        return false;
      }
    },
  };
};

// Default instance
export const prometheus = createPrometheusMetrics({
  prefix: 'learning_assistant',
  labels: {
    service: 'learning-assistant',
    environment: process.env.NODE_ENV || 'development',
  },
});

export default prometheus;