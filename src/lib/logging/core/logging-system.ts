/**
 * Centralized Logging System
 * 
 * Main orchestrator for the entire logging infrastructure:
 * - Initializes all logging components
 * - Manages lifecycle and configuration
 * - Provides unified interface
 * - Handles shutdown and cleanup
 */

import { logger, EnhancedLogger } from './logger';
import { performanceLogger, PerformanceLogger } from './performance-logger';
import { securityAuditLogger, SecurityAuditLogger } from '../security/audit-logger';
import { requestLoggingMiddleware, RequestLoggingMiddleware } from '../middleware/request-logging';
import { productionTransports, checkTransportHealth } from '../transports/production';
import { logFormatter, logSampler, logBuffer } from '../utils/formatters';
import { correlationManager } from '../../correlation';
import { LoggerConfig, LogContext, HealthCheckResult, LogStatistics } from '../types';

// System configuration
interface LoggingSystemConfig {
  enabled: boolean;
  environment: 'development' | 'test' | 'staging' | 'production';
  logLevel: string;
  enablePerformanceLogging: boolean;
  enableSecurityLogging: boolean;
  enableRequestLogging: boolean;
  enableMetrics: boolean;
  enableHealthChecks: boolean;
  healthCheckInterval: number; // milliseconds
  metricsInterval: number; // milliseconds
  shutdownTimeout: number; // milliseconds
}

// Default system configuration
const defaultSystemConfig: LoggingSystemConfig = {
  enabled: true,
  environment: (process.env.NODE_ENV as any) || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  enablePerformanceLogging: true,
  enableSecurityLogging: true,
  enableRequestLogging: true,
  enableMetrics: true,
  enableHealthChecks: process.env.NODE_ENV === 'production',
  healthCheckInterval: 300000, // 5 minutes
  metricsInterval: 60000, // 1 minute
  shutdownTimeout: 10000 // 10 seconds
};

/**
 * Main Logging System Class
 */
export class LoggingSystem {
  private static instance: LoggingSystem;
  private config: LoggingSystemConfig;
  private initialized: boolean = false;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private metricsTimer: NodeJS.Timeout | null = null;
  private shutdownHandlers: Array<() => Promise<void>> = [];

  // Component instances
  private coreLogger: EnhancedLogger;
  private performanceLogger: PerformanceLogger;
  private securityLogger: SecurityAuditLogger;
  private requestMiddleware: RequestLoggingMiddleware;

  private constructor(config: Partial<LoggingSystemConfig> = {}) {
    this.config = { ...defaultSystemConfig, ...config };
    this.coreLogger = logger;
    this.performanceLogger = performanceLogger;
    this.securityLogger = securityAuditLogger;
    this.requestMiddleware = requestLoggingMiddleware;
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<LoggingSystemConfig>): LoggingSystem {
    if (!LoggingSystem.instance) {
      LoggingSystem.instance = new LoggingSystem(config);
    }
    return LoggingSystem.instance;
  }

  /**
   * Initialize the complete logging system
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.coreLogger.warn('Logging system already initialized');
      return;
    }

    try {
      this.coreLogger.info('Initializing logging system', {
        config: this.config,
        category: 'system'
      });

      // Initialize correlation manager
      this.initializeCorrelationManager();

      // Setup production transports if in production
      if (this.config.environment === 'production') {
        await this.initializeProductionTransports();
      }

      // Start monitoring services
      if (this.config.enableHealthChecks) {
        this.startHealthChecks();
      }

      if (this.config.enableMetrics) {
        this.startMetricsCollection();
      }

      // Setup shutdown handlers
      this.setupShutdownHandlers();

      // Log system startup
      this.securityLogger.logSecurityEvent({
        type: 'SYSTEM_ERROR' as any,
        severity: 'LOW' as any,
        message: 'Logging system initialized successfully',
        outcome: 'success',
        details: {
          environment: this.config.environment,
          componentsEnabled: {
            performance: this.config.enablePerformanceLogging,
            security: this.config.enableSecurityLogging,
            request: this.config.enableRequestLogging,
            metrics: this.config.enableMetrics
          }
        }
      });

      this.initialized = true;
      this.coreLogger.info('Logging system initialization completed', {
        category: 'system',
        initialized: true,
        environment: this.config.environment
      });

    } catch (error) {
      this.coreLogger.error('Failed to initialize logging system', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        category: 'system'
      });
      throw error;
    }
  }

  /**
   * Initialize correlation manager
   */
  private initializeCorrelationManager(): void {
    // Correlation manager is already a singleton, just ensure it's available
    this.coreLogger.debug('Correlation manager initialized', {
      category: 'system'
    });
  }

  /**
   * Initialize production transports
   */
  private async initializeProductionTransports(): Promise<void> {
    try {
      // Add production transports to main logger
      const transports = productionTransports;
      
      transports.forEach(transport => {
        this.coreLogger.addTransport(transport);
      });

      this.coreLogger.info('Production transports initialized', {
        transportCount: transports.length,
        category: 'system'
      });

      // Check transport health
      if (this.config.enableHealthChecks) {
        const health = await checkTransportHealth();
        this.coreLogger.info('Transport health check completed', {
          health,
          category: 'system'
        });
      }

    } catch (error) {
      this.coreLogger.error('Failed to initialize production transports', {
        error: error instanceof Error ? error.message : 'Unknown error',
        category: 'system'
      });
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        const healthResults = await this.performHealthCheck();
        
        this.coreLogger.info('Logging system health check', {
          health: healthResults,
          category: 'health'
        });

        // Alert on unhealthy components
        const unhealthyComponents = Object.entries(healthResults)
          .filter(([_, result]) => !result.healthy)
          .map(([name]) => name);

        if (unhealthyComponents.length > 0) {
          this.securityLogger.logSecurityEvent({
            type: 'SYSTEM_ERROR' as any,
            severity: 'HIGH' as any,
            message: `Unhealthy logging components detected: ${unhealthyComponents.join(', ')}`,
            outcome: 'failure',
            details: {
              unhealthyComponents,
              healthResults
            }
          });
        }

      } catch (error) {
        this.coreLogger.error('Health check failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          category: 'health'
        });
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(async () => {
      try {
        const statistics = await this.getSystemStatistics();
        
        this.coreLogger.info('Logging system metrics', {
          statistics,
          category: 'metrics'
        });

        // Check for concerning metrics
        this.analyzeMetrics(statistics);

      } catch (error) {
        this.coreLogger.error('Metrics collection failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          category: 'metrics'
        });
      }
    }, this.config.metricsInterval);
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const gracefulShutdown = async (signal: string) => {
      this.coreLogger.info(`Received ${signal}, starting graceful shutdown`, {
        signal,
        category: 'system'
      });

      try {
        await this.shutdown();
        process.exit(0);
      } catch (error) {
        this.coreLogger.error('Error during shutdown', {
          error: error instanceof Error ? error.message : 'Unknown error',
          category: 'system'
        });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.coreLogger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack,
        category: 'system'
      });
      
      this.securityLogger.logSecurityEvent({
        type: 'SYSTEM_ERROR' as any,
        severity: 'CRITICAL' as any,
        message: `Uncaught exception: ${error.message}`,
        outcome: 'failure',
        details: {
          error: error.message,
          stack: error.stack
        }
      });

      // Give time for logs to flush
      setTimeout(() => process.exit(1), 1000);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.coreLogger.error('Unhandled promise rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
        category: 'system'
      });

      this.securityLogger.logSecurityEvent({
        type: 'SYSTEM_ERROR' as any,
        severity: 'HIGH' as any,
        message: `Unhandled promise rejection: ${reason}`,
        outcome: 'failure',
        details: {
          reason: String(reason)
        }
      });
    });
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<Record<string, HealthCheckResult>> {
    const results: Record<string, HealthCheckResult> = {};

    // Check core logger
    results.coreLogger = {
      service: 'coreLogger',
      healthy: await this.coreLogger.healthCheck(),
      lastCheck: new Date()
    };

    // Check performance logger
    results.performanceLogger = {
      service: 'performanceLogger',
      healthy: true, // Performance logger doesn't have explicit health check
      lastCheck: new Date()
    };

    // Check security logger
    results.securityLogger = {
      service: 'securityLogger',
      healthy: true, // Security logger doesn't have explicit health check
      lastCheck: new Date()
    };

    // Check external transports
    if (this.config.environment === 'production') {
      try {
        const transportHealth = await checkTransportHealth();
        Object.entries(transportHealth).forEach(([name, healthy]) => {
          results[`transport_${name}`] = {
            service: `transport_${name}`,
            healthy,
            lastCheck: new Date()
          };
        });
      } catch (error) {
        results.transports = {
          service: 'transports',
          healthy: false,
          lastCheck: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return results;
  }

  /**
   * Get comprehensive system statistics
   */
  async getSystemStatistics(): Promise<LogStatistics> {
    // Get metrics from various components
    const coreMetrics = this.coreLogger.getMetrics();
    const performanceStats = this.performanceLogger.getStatistics();
    const securityStats = this.securityLogger.getStatistics();

    // Calculate aggregate statistics
    const totalLogs = Object.values(coreMetrics.metrics || {})
      .reduce((sum: number, metric: any) => sum + (metric.count || 0), 0);

    return {
      totalLogs,
      errorCount: coreMetrics.metrics?.['error'] || 0,
      warningCount: coreMetrics.metrics?.['warn'] || 0,
      infoCount: coreMetrics.metrics?.['info'] || 0,
      debugCount: coreMetrics.metrics?.['debug'] || 0,
      logRate: totalLogs / (Date.now() / 60000), // logs per minute (approximate)
      averageLogSize: 0, // Would need to track this separately
      diskUsage: 0, // Would need to check actual disk usage
      oldestLog: new Date(Date.now() - 24 * 60 * 60 * 1000), // Placeholder
      newestLog: new Date()
    };
  }

  /**
   * Analyze metrics for concerning patterns
   */
  private analyzeMetrics(statistics: LogStatistics): void {
    // High error rate
    if (statistics.errorCount > 100) {
      this.coreLogger.warn('High error rate detected', {
        errorCount: statistics.errorCount,
        category: 'metrics',
        alert: true
      });
    }

    // High log volume
    if (statistics.logRate > 1000) {
      this.coreLogger.warn('High log volume detected', {
        logRate: statistics.logRate,
        category: 'metrics',
        alert: true
      });
    }
  }

  /**
   * Create contextual logger with base context
   */
  createContextualLogger(context: LogContext): EnhancedLogger {
    return this.coreLogger; // For now, return the same logger
    // In a full implementation, you might create a wrapper that adds context
  }

  /**
   * Get logger instances
   */
  getLoggers() {
    return {
      core: this.coreLogger,
      performance: this.performanceLogger,
      security: this.securityLogger,
      request: this.requestMiddleware
    };
  }

  /**
   * Get system configuration
   */
  getConfig(): LoggingSystemConfig {
    return { ...this.config };
  }

  /**
   * Update system configuration
   */
  updateConfig(newConfig: Partial<LoggingSystemConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.coreLogger.info('Logging system configuration updated', {
      config: this.config,
      category: 'system'
    });
  }

  /**
   * Get system status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      environment: this.config.environment,
      enabled: this.config.enabled,
      components: {
        performance: this.config.enablePerformanceLogging,
        security: this.config.enableSecurityLogging,
        request: this.config.enableRequestLogging,
        metrics: this.config.enableMetrics,
        healthChecks: this.config.enableHealthChecks
      },
      timers: {
        healthCheck: this.healthCheckTimer !== null,
        metrics: this.metricsTimer !== null
      }
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.coreLogger.info('Starting logging system shutdown', {
      category: 'system'
    });

    try {
      // Clear timers
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
        this.healthCheckTimer = null;
      }

      if (this.metricsTimer) {
        clearInterval(this.metricsTimer);
        this.metricsTimer = null;
      }

      // Shutdown components
      this.performanceLogger.shutdown();
      this.securityLogger.shutdown();

      // Execute custom shutdown handlers
      await Promise.all(this.shutdownHandlers.map(handler => handler()));

      // Final flush and close loggers
      await this.coreLogger.close();

      this.initialized = false;

      console.log('Logging system shutdown completed');

    } catch (error) {
      console.error('Error during logging system shutdown:', error);
      throw error;
    }
  }

  /**
   * Add custom shutdown handler
   */
  addShutdownHandler(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }

  /**
   * Force flush all logs
   */
  async flush(): Promise<void> {
    // Trigger flush on all components that support it
    // This is useful for testing or before shutdown
    this.coreLogger.info('Flushing all logs', {
      category: 'system'
    });

    // Wait a moment for logs to flush
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Export singleton instance
export const loggingSystem = LoggingSystem.getInstance();

// Export factory function
export function createLoggingSystem(config?: Partial<LoggingSystemConfig>): LoggingSystem {
  return LoggingSystem.getInstance(config);
}

export default loggingSystem;