/**
 * Performance Logger
 * 
 * Specialized logger for performance metrics and monitoring:
 * - Response time tracking
 * - Resource utilization monitoring
 * - Database query performance
 * - Memory and CPU metrics
 * - Custom performance counters
 */

import { logger } from './logger';
import { PerformanceMetric, LogContext } from '../types';
import { formatUtils } from '../utils/formatters';

// Performance thresholds
interface PerformanceThresholds {
  responseTime: {
    warn: number;
    critical: number;
  };
  memoryUsage: {
    warn: number;
    critical: number;
  };
  cpuUsage: {
    warn: number;
    critical: number;
  };
  diskUsage: {
    warn: number;
    critical: number;
  };
  databaseQuery: {
    warn: number;
    critical: number;
  };
}

// Default thresholds
const defaultThresholds: PerformanceThresholds = {
  responseTime: {
    warn: 1000, // 1 second
    critical: 5000 // 5 seconds
  },
  memoryUsage: {
    warn: 80, // 80%
    critical: 95 // 95%
  },
  cpuUsage: {
    warn: 80, // 80%
    critical: 95 // 95%
  },
  diskUsage: {
    warn: 85, // 85%
    critical: 95 // 95%
  },
  databaseQuery: {
    warn: 500, // 500ms
    critical: 2000 // 2 seconds
  }
};

// Performance counter interface
interface PerformanceCounter {
  name: string;
  count: number;
  totalDuration: number;
  minDuration: number;
  maxDuration: number;
  avgDuration: number;
  lastUpdate: Date;
}

/**
 * Performance Logger Class
 */
export class PerformanceLogger {
  private thresholds: PerformanceThresholds;
  private counters: Map<string, PerformanceCounter> = new Map();
  private activeOperations: Map<string, { startTime: number; context: LogContext }> = new Map();
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor(thresholds: Partial<PerformanceThresholds> = {}) {
    this.thresholds = { ...defaultThresholds, ...thresholds };
    this.startSystemMetricsCollection();
  }

  /**
   * Start timing an operation
   */
  startOperation(operationId: string, operationName: string, context: LogContext = {}): void {
    const startTime = Date.now();
    
    this.activeOperations.set(operationId, {
      startTime,
      context: {
        ...context,
        operation: operationName,
        operationId,
        category: 'performance'
      }
    });

    logger.debug(`Performance tracking started: ${operationName}`, {
      ...context,
      operationId,
      operation: operationName,
      category: 'performance',
      performanceEvent: 'start'
    });
  }

  /**
   * End timing an operation
   */
  endOperation(operationId: string, success: boolean = true, metadata: Record<string, any> = {}): PerformanceMetric | null {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      logger.warn(`Performance tracking not found for operation: ${operationId}`, {
        operationId,
        category: 'performance'
      });
      return null;
    }

    const duration = Date.now() - operation.startTime;
    const operationName = operation.context.operation || 'unknown';

    // Remove from active operations
    this.activeOperations.delete(operationId);

    // Create performance metric
    const metric: PerformanceMetric = {
      operation: operationName,
      duration,
      unit: 'ms',
      success,
      timestamp: new Date(),
      context: operation.context,
      metadata
    };

    // Update counters
    this.updateCounter(operationName, duration);

    // Log the metric
    this.logMetric(metric);

    return metric;
  }

  /**
   * Measure a function execution time
   */
  async measureAsync<T>(
    operationName: string,
    fn: () => Promise<T>,
    context: LogContext = {}
  ): Promise<{ result: T; metric: PerformanceMetric }> {
    const operationId = `${operationName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.startOperation(operationId, operationName, context);
    
    let success = true;
    let result: T;
    let error: Error | null = null;

    try {
      result = await fn();
    } catch (err) {
      success = false;
      error = err as Error;
      throw err;
    } finally {
      const metric = this.endOperation(operationId, success, {
        error: error?.message,
        stack: error?.stack
      });

      if (metric) {
        return { result: result!, metric };
      }
    }

    // This should never be reached, but TypeScript requires it
    throw new Error('Performance measurement failed');
  }

  /**
   * Measure synchronous function execution time
   */
  measureSync<T>(
    operationName: string,
    fn: () => T,
    context: LogContext = {}
  ): { result: T; metric: PerformanceMetric } {
    const operationId = `${operationName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.startOperation(operationId, operationName, context);
    
    let success = true;
    let result: T;
    let error: Error | null = null;

    try {
      result = fn();
    } catch (err) {
      success = false;
      error = err as Error;
      throw err;
    } finally {
      const metric = this.endOperation(operationId, success, {
        error: error?.message,
        stack: error?.stack
      });

      if (metric) {
        return { result, metric };
      }
    }

    // This should never be reached
    throw new Error('Performance measurement failed');
  }

  /**
   * Log database query performance
   */
  logDatabaseQuery(
    query: string,
    duration: number,
    rowCount?: number,
    context: LogContext = {}
  ): void {
    const metric: PerformanceMetric = {
      operation: 'database_query',
      duration,
      unit: 'ms',
      success: true,
      timestamp: new Date(),
      context: {
        ...context,
        category: 'database',
        query: this.sanitizeQuery(query),
        rowCount
      },
      metadata: {
        queryLength: query.length,
        rowCount
      }
    };

    this.updateCounter('database_query', duration);
    this.logMetric(metric);

    // Alert on slow queries
    if (duration > this.thresholds.databaseQuery.critical) {
      logger.error(`Critical slow database query: ${formatUtils.formatDuration(duration)}`, {
        ...context,
        query: this.sanitizeQuery(query),
        duration,
        category: 'database',
        performanceAlert: 'critical'
      });
    } else if (duration > this.thresholds.databaseQuery.warn) {
      logger.warn(`Slow database query: ${formatUtils.formatDuration(duration)}`, {
        ...context,
        query: this.sanitizeQuery(query),
        duration,
        category: 'database',
        performanceAlert: 'warning'
      });
    }
  }

  /**
   * Log HTTP request performance
   */
  logHttpRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    context: LogContext = {}
  ): void {
    const metric: PerformanceMetric = {
      operation: 'http_request',
      duration,
      unit: 'ms',
      success: statusCode < 400,
      timestamp: new Date(),
      context: {
        ...context,
        method,
        url,
        statusCode,
        category: 'http'
      },
      metadata: {
        statusCode,
        statusClass: Math.floor(statusCode / 100) + 'xx'
      }
    };

    this.updateCounter(`http_${method.toLowerCase()}`, duration);
    this.logMetric(metric);

    // Alert on slow requests
    if (duration > this.thresholds.responseTime.critical) {
      logger.error(`Critical slow HTTP request: ${method} ${url}`, {
        ...context,
        method,
        url,
        statusCode,
        duration,
        category: 'http',
        performanceAlert: 'critical'
      });
    } else if (duration > this.thresholds.responseTime.warn) {
      logger.warn(`Slow HTTP request: ${method} ${url}`, {
        ...context,
        method,
        url,
        statusCode,
        duration,
        category: 'http',
        performanceAlert: 'warning'
      });
    }
  }

  /**
   * Log memory usage
   */
  logMemoryUsage(context: LogContext = {}): void {
    const memUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    const freeMemory = require('os').freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    const metric: PerformanceMetric = {
      operation: 'memory_usage',
      duration: memoryUsagePercent,
      unit: '%',
      success: memoryUsagePercent < this.thresholds.memoryUsage.critical,
      timestamp: new Date(),
      context: {
        ...context,
        category: 'system'
      },
      metadata: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers,
        totalMemory,
        freeMemory,
        usedMemory,
        memoryUsagePercent
      }
    };

    this.logMetric(metric);

    // Alert on high memory usage
    if (memoryUsagePercent > this.thresholds.memoryUsage.critical) {
      logger.error(`Critical memory usage: ${memoryUsagePercent.toFixed(2)}%`, {
        ...context,
        memoryUsagePercent,
        category: 'system',
        performanceAlert: 'critical'
      });
    } else if (memoryUsagePercent > this.thresholds.memoryUsage.warn) {
      logger.warn(`High memory usage: ${memoryUsagePercent.toFixed(2)}%`, {
        ...context,
        memoryUsagePercent,
        category: 'system',
        performanceAlert: 'warning'
      });
    }
  }

  /**
   * Log CPU usage
   */
  logCpuUsage(context: LogContext = {}): void {
    const cpus = require('os').cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu: any) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const cpuUsagePercent = 100 - ~~(100 * totalIdle / totalTick);

    const metric: PerformanceMetric = {
      operation: 'cpu_usage',
      duration: cpuUsagePercent,
      unit: '%',
      success: cpuUsagePercent < this.thresholds.cpuUsage.critical,
      timestamp: new Date(),
      context: {
        ...context,
        category: 'system'
      },
      metadata: {
        cpuCount: cpus.length,
        cpuUsagePercent,
        loadAverage: require('os').loadavg()
      }
    };

    this.logMetric(metric);

    // Alert on high CPU usage
    if (cpuUsagePercent > this.thresholds.cpuUsage.critical) {
      logger.error(`Critical CPU usage: ${cpuUsagePercent}%`, {
        ...context,
        cpuUsagePercent,
        category: 'system',
        performanceAlert: 'critical'
      });
    } else if (cpuUsagePercent > this.thresholds.cpuUsage.warn) {
      logger.warn(`High CPU usage: ${cpuUsagePercent}%`, {
        ...context,
        cpuUsagePercent,
        category: 'system',
        performanceAlert: 'warning'
      });
    }
  }

  /**
   * Log a generic performance metric
   */
  logMetric(metric: PerformanceMetric): void {
    const message = `Performance: ${metric.operation} - ${formatUtils.formatDuration(metric.duration)} (${metric.success ? 'success' : 'failure'})`;
    
    if (!metric.success) {
      logger.error(message, {
        ...metric.context,
        performanceMetric: true,
        operation: metric.operation,
        duration: metric.duration,
        unit: metric.unit,
        success: metric.success,
        metadata: metric.metadata
      });
    } else {
      logger.info(message, {
        ...metric.context,
        performanceMetric: true,
        operation: metric.operation,
        duration: metric.duration,
        unit: metric.unit,
        success: metric.success,
        metadata: metric.metadata
      });
    }
  }

  /**
   * Update performance counter
   */
  private updateCounter(operationName: string, duration: number): void {
    const counter = this.counters.get(operationName);
    
    if (counter) {
      counter.count++;
      counter.totalDuration += duration;
      counter.minDuration = Math.min(counter.minDuration, duration);
      counter.maxDuration = Math.max(counter.maxDuration, duration);
      counter.avgDuration = counter.totalDuration / counter.count;
      counter.lastUpdate = new Date();
    } else {
      this.counters.set(operationName, {
        name: operationName,
        count: 1,
        totalDuration: duration,
        minDuration: duration,
        maxDuration: duration,
        avgDuration: duration,
        lastUpdate: new Date()
      });
    }
  }

  /**
   * Start collecting system metrics
   */
  private startSystemMetricsCollection(): void {
    const interval = parseInt(process.env.PERFORMANCE_METRICS_INTERVAL || '60000'); // 1 minute
    
    this.metricsInterval = setInterval(() => {
      try {
        this.logMemoryUsage({ source: 'automatic' });
        this.logCpuUsage({ source: 'automatic' });
        this.logSystemMetrics();
      } catch (error) {
        logger.error('Failed to collect system metrics', {
          error: error instanceof Error ? error.message : 'Unknown error',
          category: 'performance'
        });
      }
    }, interval);
  }

  /**
   * Log general system metrics
   */
  private logSystemMetrics(): void {
    const uptime = process.uptime();
    const { pid, platform, version } = process;

    logger.info('System metrics', {
      category: 'system',
      systemMetrics: true,
      uptime: formatUtils.formatDuration(uptime * 1000),
      pid,
      platform,
      nodeVersion: version,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Sanitize database query for logging
   */
  private sanitizeQuery(query: string): string {
    // Remove potential sensitive data from queries
    return query
      .replace(/\bvalues\s*\([^)]*\)/gi, 'VALUES (...)')
      .replace(/\bset\s+\w+\s*=\s*'[^']*'/gi, "SET field = '***'")
      .substring(0, 500); // Limit length
  }

  /**
   * Get performance statistics
   */
  getStatistics(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [name, counter] of this.counters) {
      stats[name] = {
        count: counter.count,
        avgDuration: counter.avgDuration,
        minDuration: counter.minDuration,
        maxDuration: counter.maxDuration,
        totalDuration: counter.totalDuration,
        lastUpdate: counter.lastUpdate
      };
    }

    return {
      counters: stats,
      activeOperations: this.activeOperations.size,
      thresholds: this.thresholds,
      uptime: process.uptime()
    };
  }

  /**
   * Reset performance counters
   */
  reset(): void {
    this.counters.clear();
    this.activeOperations.clear();
  }

  /**
   * Update thresholds
   */
  updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }

  /**
   * Shutdown performance logger
   */
  shutdown(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    this.reset();
  }
}

// Create default instance
export const performanceLogger = new PerformanceLogger();

// Export factory function
export function createPerformanceLogger(thresholds: Partial<PerformanceThresholds> = {}): PerformanceLogger {
  return new PerformanceLogger(thresholds);
}

// Export performance decorator
export function measurePerformance(operationName?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const operation = operationName || `${target.constructor.name}.${propertyName}`;

    descriptor.value = async function (...args: any[]) {
      const { result } = await performanceLogger.measureAsync(
        operation,
        () => method.apply(this, args),
        { component: target.constructor.name, method: propertyName }
      );
      return result;
    };
  };
}

export default performanceLogger;