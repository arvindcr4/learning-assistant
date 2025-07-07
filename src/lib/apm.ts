// Edge Runtime compatible performance and logging
import { performanceLogger, loggerUtils } from './logger';
import { metricsUtils } from './metrics';

// Use globalThis.performance for Edge Runtime compatibility
const performance = typeof globalThis !== 'undefined' && globalThis.performance 
  ? globalThis.performance 
  : { now: () => Date.now() };

// Performance monitoring configuration
interface PerformanceConfig {
  enabled: boolean;
  sampleRate: number;
  slowThresholdMs: number;
  memoryThresholdMB: number;
}

const config: PerformanceConfig = {
  enabled: process.env.NODE_ENV === 'production' || process.env.ENABLE_APM === 'true',
  sampleRate: parseFloat(process.env.APM_SAMPLE_RATE || '0.1'),
  slowThresholdMs: parseInt(process.env.APM_SLOW_THRESHOLD_MS || '1000'),
  memoryThresholdMB: parseInt(process.env.APM_MEMORY_THRESHOLD_MB || '512'),
};

// Performance tracking state
const performanceState = {
  traces: new Map<string, { startTime: number; metadata: any }>(),
  metrics: {
    requests: 0,
    errors: 0,
    slowRequests: 0,
    averageResponseTime: 0,
    memoryUsage: 0,
    cpuUsage: 0,
  },
};

// APM utility functions
export const apm = {
  // Start a performance trace
  startTrace: (name: string, metadata?: any): string => {
    if (!config.enabled) return '';
    
    const traceId = `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    performanceState.traces.set(traceId, {
      startTime: performance.now(),
      metadata: metadata || {},
    });
    
    return traceId;
  },

  // End a performance trace
  endTrace: (traceId: string, additionalMetadata?: any): number => {
    if (!config.enabled || !traceId) return 0;
    
    const trace = performanceState.traces.get(traceId);
    if (!trace) return 0;
    
    const duration = performance.now() - trace.startTime;
    const metadata = { ...trace.metadata, ...additionalMetadata };
    
    // Log if duration exceeds threshold
    if (duration > config.slowThresholdMs) {
      performanceLogger.warn('Slow operation detected', {
        traceId,
        duration,
        metadata,
        threshold: config.slowThresholdMs,
      });
      performanceState.metrics.slowRequests++;
    }
    
    // Sample and log performance data
    if (Math.random() < config.sampleRate) {
      loggerUtils.logPerformanceMetric(
        metadata.operation || 'unknown',
        duration,
        'ms',
        metadata
      );
    }
    
    performanceState.traces.delete(traceId);
    return duration;
  },

  // Track API request performance
  trackApiRequest: (method: string, route: string, statusCode: number, duration: number, userId?: string) => {
    if (!config.enabled) return;
    
    performanceState.metrics.requests++;
    performanceState.metrics.averageResponseTime = 
      (performanceState.metrics.averageResponseTime * (performanceState.metrics.requests - 1) + duration) / 
      performanceState.metrics.requests;
    
    if (statusCode >= 400) {
      performanceState.metrics.errors++;
    }
    
    // Record metrics
    metricsUtils.recordApiRequest(method, route, statusCode, duration / 1000);
    
    // Log slow requests
    if (duration > config.slowThresholdMs) {
      performanceLogger.warn('Slow API request', {
        method,
        route,
        statusCode,
        duration,
        userId,
      });
    }
  },

  // Track database query performance
  trackDbQuery: (query: string, duration: number, table?: string, error?: Error) => {
    if (!config.enabled) return;
    
    const queryType = query.trim().split(' ')[0].toUpperCase();
    const tableName = table || 'unknown';
    
    metricsUtils.recordDbQuery(queryType, tableName, duration / 1000);
    
    if (error) {
      performanceLogger.error('Database query error', {
        query: query.substring(0, 200),
        duration,
        error: error.message,
        table: tableName,
      });
    } else if (duration > config.slowThresholdMs) {
      performanceLogger.warn('Slow database query', {
        query: query.substring(0, 200),
        duration,
        table: tableName,
        queryType,
      });
    }
  },

  // Track memory usage
  trackMemoryUsage: () => {
    if (!config.enabled || typeof process === 'undefined') return;
    
    try {
      const memoryUsage = process.memoryUsage();
      const memoryUsedMB = memoryUsage.heapUsed / 1024 / 1024;
    
    performanceState.metrics.memoryUsage = memoryUsedMB;
    
    if (memoryUsedMB > config.memoryThresholdMB) {
      performanceLogger.warn('High memory usage detected', {
        memoryUsedMB,
        threshold: config.memoryThresholdMB,
        memoryUsage,
      });
    }
    
      metricsUtils.updateSystemMetrics(memoryUsage.heapUsed, 0, 0);
    } catch (error) {
      // Ignore in Edge Runtime
    }
  },

  // Track CPU usage (simplified)
  trackCpuUsage: () => {
    if (!config.enabled || typeof process === 'undefined') return;
    
    try {
      const cpuUsage = process.cpuUsage();
      const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    
    performanceState.metrics.cpuUsage = cpuPercent;
    
      performanceLogger.debug('CPU usage', {
        cpuPercent,
        cpuUsage,
      });
    } catch (error) {
      // Ignore in Edge Runtime
    }
  },

  // Track learning session performance
  trackLearningSession: (userId: string, contentType: string, duration: number, learningStyle: string, engagement: number) => {
    if (!config.enabled) return;
    
    metricsUtils.recordLearningSession(userId, contentType, duration, learningStyle);
    metricsUtils.updateUserEngagement(userId, contentType, engagement);
    
    performanceLogger.info('Learning session tracked', {
      userId,
      contentType,
      duration,
      learningStyle,
      engagement,
    });
  },

  // Track adaptive changes
  trackAdaptiveChange: (changeType: string, userId: string, reason: string, effectiveness?: number) => {
    if (!config.enabled) return;
    
    metricsUtils.recordAdaptiveChange(changeType, userId);
    
    performanceLogger.info('Adaptive change tracked', {
      changeType,
      userId,
      reason,
      effectiveness,
    });
  },

  // Track assessment performance
  trackAssessment: (assessmentType: string, userId: string, score: number, difficulty: string, duration: number) => {
    if (!config.enabled) return;
    
    metricsUtils.recordAssessmentAttempt(assessmentType, userId, score, difficulty);
    
    performanceLogger.info('Assessment tracked', {
      assessmentType,
      userId,
      score,
      difficulty,
      duration,
    });
  },

  // Get performance metrics
  getMetrics: () => {
    const metrics: any = {
      ...performanceState.metrics,
      activeTraces: performanceState.traces.size,
    };
    
    if (typeof process !== 'undefined') {
      try {
        metrics.uptime = process.uptime();
        metrics.memoryUsage = process.memoryUsage();
        metrics.cpuUsage = process.cpuUsage();
      } catch (error) {
        // Ignore in Edge Runtime
      }
    }
    
    return metrics;
  },

  // Reset metrics (useful for testing)
  resetMetrics: () => {
    performanceState.metrics = {
      requests: 0,
      errors: 0,
      slowRequests: 0,
      averageResponseTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
    };
    performanceState.traces.clear();
  },

  // Health check
  healthCheck: (): boolean => {
    return config.enabled && performanceState.traces.size < 1000; // Prevent memory leaks
  },

  // Configure APM
  configure: (newConfig: Partial<PerformanceConfig>) => {
    Object.assign(config, newConfig);
  },
};

// Middleware for automatic API performance tracking
export const withPerformanceTracking = (handler: any) => {
  return async (req: any, res: any, ...args: any[]) => {
    if (!config.enabled) {
      return handler(req, res, ...args);
    }
    
    const startTime = performance.now();
    const traceId = apm.startTrace('api_request', {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
    });
    
    try {
      const result = await handler(req, res, ...args);
      
      const duration = performance.now() - startTime;
      const statusCode = res.statusCode || 200;
      
      apm.endTrace(traceId, {
        statusCode,
        duration,
        success: true,
      });
      
      apm.trackApiRequest(req.method, req.url, statusCode, duration);
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      const statusCode = 500;
      
      apm.endTrace(traceId, {
        statusCode,
        duration,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      apm.trackApiRequest(req.method, req.url, statusCode, duration);
      
      throw error;
    }
  };
};

// Decorator for function performance tracking
export const withTracing = (name: string, metadata?: any) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      if (!config.enabled) {
        return originalMethod.apply(this, args);
      }
      
      const traceId = apm.startTrace(name, {
        method: propertyKey,
        className: target.constructor.name,
        ...metadata,
      });
      
      try {
        const result = await originalMethod.apply(this, args);
        apm.endTrace(traceId, { success: true });
        return result;
      } catch (error) {
        apm.endTrace(traceId, {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    };
    
    return descriptor;
  };
};

// Periodic system metrics collection (only in Node.js runtime)
if (config.enabled && typeof process !== 'undefined' && typeof setInterval !== 'undefined') {
  try {
    setInterval(() => {
      apm.trackMemoryUsage();
      apm.trackCpuUsage();
    }, 30000); // Every 30 seconds
  } catch (error) {
    // Ignore in Edge Runtime
  }
}

export default apm;