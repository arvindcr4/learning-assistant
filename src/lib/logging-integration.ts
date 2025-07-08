import winston from 'winston';
import logger, { LogContext, createContextualLogger } from './logger';
import { logAggregationService } from './log-aggregation';
import { logRetentionManager, logMonitor } from './log-retention';
import { securityAuditLogger, SecurityEventType, SecurityEventSeverity } from './audit-logger';
import { correlationManager } from './correlation';

// Centralized logging integration manager
export class LoggingIntegration {
  private static instance: LoggingIntegration;
  private initialized = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): LoggingIntegration {
    if (!LoggingIntegration.instance) {
      LoggingIntegration.instance = new LoggingIntegration();
    }
    return LoggingIntegration.instance;
  }

  // Initialize the complete logging system
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize log aggregation services
      const aggregationTransports = logAggregationService.getTransports();
      if (aggregationTransports.length > 0) {
        // Add aggregation transports to the main logger
        aggregationTransports.forEach(transport => {
          (logger as any).add(transport);
        });
        
        logger.info('Log aggregation services initialized', {
          transportCount: aggregationTransports.length,
          category: 'logging'
        });
      }

      // Start retention management
      if (process.env.LOG_RETENTION_ENABLED === 'true') {
        // Schedule retention cleanup
        await logRetentionManager.performCleanup();
        
        logger.info('Log retention management initialized', {
          category: 'logging'
        });
      }

      // Start monitoring
      this.startHealthChecks();
      this.startMetricsCollection();

      // Log system startup
      securityAuditLogger.logSecurityEvent({
        type: SecurityEventType.SYSTEM_ERROR,
        severity: SecurityEventSeverity.LOW,
        message: 'Logging system initialized successfully',
        outcome: 'success',
        details: {
          aggregationEnabled: aggregationTransports.length > 0,
          retentionEnabled: process.env.LOG_RETENTION_ENABLED === 'true',
          securityLoggingEnabled: true
        }
      });

      this.initialized = true;
      logger.info('Logging integration initialization completed', {
        category: 'logging',
        system: 'startup'
      });
    } catch (error) {
      logger.error('Failed to initialize logging integration', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        category: 'logging'
      });
      throw error;
    }
  }

  // Start health checks for logging services
  private startHealthChecks(): void {
    const healthCheckInterval = parseInt(process.env.LOG_HEALTH_CHECK_INTERVAL || '300000'); // 5 minutes

    this.healthCheckInterval = setInterval(async () => {
      try {
        // Check logger health
        const loggerHealthy = logger !== undefined;
        
        // Check aggregation services health
        const aggregationHealth = await logAggregationService.healthCheck();
        
        // Check retention system health
        const retentionStats = await logRetentionManager.getRetentionStats();
        
        // Log health status
        logger.info('Logging system health check', {
          category: 'health',
          logger: { healthy: loggerHealthy },
          aggregation: aggregationHealth,
          retention: {
            healthy: retentionStats.totalFiles >= 0,
            totalFiles: retentionStats.totalFiles,
            totalSize: retentionStats.totalSize
          }
        });

        // Alert on unhealthy services
        const unhealthyServices = aggregationHealth.filter(service => !service.healthy);
        if (unhealthyServices.length > 0) {
          securityAuditLogger.logSystemError(
            `Unhealthy logging services: ${unhealthyServices.map(s => s.service).join(', ')}`,
            'logging-health-check',
            {
              unhealthyServices,
              category: 'monitoring'
            }
          );
        }
      } catch (error) {
        logger.error('Logging health check failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          category: 'health'
        });
      }
    }, healthCheckInterval);
  }

  // Start metrics collection for logging system
  private startMetricsCollection(): void {
    const metricsInterval = parseInt(process.env.LOG_METRICS_INTERVAL || '60000'); // 1 minute

    this.metricsInterval = setInterval(async () => {
      try {
        // Collect system metrics
        const memUsage = process.memoryUsage();
        const uptime = process.uptime();
        
        // Log system metrics
        logger.info('System metrics', {
          category: 'metrics',
          memory: {
            rss: Math.round(memUsage.rss / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024)
          },
          uptime: Math.round(uptime),
          timestamp: new Date().toISOString()
        });

        // Monitor error rates
        const errorMonitoring = await logMonitor.monitorErrorRate();
        if (errorMonitoring.alert) {
          securityAuditLogger.logSecurityEvent({
            type: SecurityEventType.SYSTEM_ERROR,
            severity: SecurityEventSeverity.HIGH,
            message: 'High error rate detected',
            outcome: 'failure',
            details: {
              errorRate: errorMonitoring.rate,
              threshold: 10 // from logMonitor thresholds
            }
          });
        }

        // Monitor log volume
        const volumeMonitoring = await logMonitor.monitorLogVolume();
        if (volumeMonitoring.alert) {
          logger.warn('High log volume detected', {
            category: 'monitoring',
            logVolume: volumeMonitoring.volume,
            threshold: 500, // from logMonitor thresholds
            alert: true
          });
        }
      } catch (error) {
        logger.error('Metrics collection failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          category: 'metrics'
        });
      }
    }, metricsInterval);
  }

  // Create an enhanced logger with full context and features
  createEnhancedLogger(baseContext: LogContext = {}): winston.Logger {
    const correlationId = correlationManager.getCurrentCorrelationId();
    
    const enhancedContext = {
      ...baseContext,
      correlationId,
      service: 'learning-assistant',
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString()
    };

    return createContextualLogger(enhancedContext) as any;
  }

  // Log business events with full context
  logBusinessEvent(event: string, details: LogContext): void {
    const enhancedLogger = this.createEnhancedLogger({ category: 'business' });
    enhancedLogger.info(`Business Event: ${event}`, {
      ...details,
      businessEvent: true,
      eventType: event
    });
  }

  // Log performance metrics with context
  logPerformanceMetric(operation: string, duration: number, metadata: LogContext = {}): void {
    const enhancedLogger = this.createEnhancedLogger({ category: 'performance' });
    
    const performanceData = {
      ...metadata,
      operation,
      duration,
      responseTime: `${duration}ms`,
      performanceMetric: true
    };

    if (duration > 1000) {
      enhancedLogger.warn(`Slow operation: ${operation}`, performanceData);
    } else {
      enhancedLogger.info(`Performance: ${operation}`, performanceData);
    }
  }

  // Log database operations with context
  logDatabaseOperation(operation: string, table: string, duration: number, metadata: LogContext = {}): void {
    const enhancedLogger = this.createEnhancedLogger({ category: 'database' });
    
    enhancedLogger.info(`Database ${operation} on ${table}`, {
      ...metadata,
      operation,
      table,
      duration,
      responseTime: `${duration}ms`,
      databaseOperation: true
    });

    // Alert on slow database operations
    if (duration > 5000) {
      securityAuditLogger.logSystemError(
        `Slow database operation: ${operation} on ${table} took ${duration}ms`,
        'database-performance',
        {
          operation,
          table,
          duration,
          category: 'performance'
        }
      );
    }
  }

  // Log API calls with context
  logApiCall(method: string, endpoint: string, statusCode: number, duration: number, metadata: LogContext = {}): void {
    const enhancedLogger = this.createEnhancedLogger({ category: 'api' });
    
    const apiData = {
      ...metadata,
      method,
      endpoint,
      statusCode,
      duration,
      responseTime: `${duration}ms`,
      apiCall: true
    };

    if (statusCode >= 400) {
      const level = statusCode >= 500 ? 'error' : 'warn';
      enhancedLogger[level](`API ${statusCode}: ${method} ${endpoint}`, apiData);
    } else {
      enhancedLogger.info(`API ${statusCode}: ${method} ${endpoint}`, apiData);
    }
  }

  // Log user actions with context
  logUserAction(userId: string, action: string, resource: string, metadata: LogContext = {}): void {
    const enhancedLogger = this.createEnhancedLogger({ category: 'user-action' });
    
    enhancedLogger.info(`User Action: ${action} on ${resource}`, {
      ...metadata,
      userId,
      action,
      resource,
      userAction: true
    });

    // Log sensitive actions to security audit
    const sensitiveActions = ['delete', 'export', 'admin', 'config'];
    if (sensitiveActions.some(sa => action.toLowerCase().includes(sa))) {
      securityAuditLogger.logSecurityEvent({
        type: SecurityEventType.PRIVILEGE_ESCALATION,
        severity: SecurityEventSeverity.MEDIUM,
        message: `Sensitive user action: ${action} on ${resource}`,
        userId,
        outcome: 'success',
        details: {
          action,
          resource,
          ...metadata
        }
      });
    }
  }

  // Log authentication events
  logAuthEvent(type: 'login' | 'logout' | 'failed_login', userId: string, ip: string, userAgent: string, metadata: LogContext = {}): void {
    const enhancedLogger = this.createEnhancedLogger({ category: 'authentication' });
    
    const authData = {
      ...metadata,
      userId,
      ip,
      userAgent,
      authEvent: true,
      eventType: type
    };

    switch (type) {
      case 'login':
        enhancedLogger.info(`User login successful: ${userId}`, authData);
        securityAuditLogger.logAuthenticationSuccess(userId, ip, userAgent, metadata);
        break;
      
      case 'logout':
        enhancedLogger.info(`User logout: ${userId}`, authData);
        break;
      
      case 'failed_login':
        enhancedLogger.warn(`Failed login attempt: ${userId}`, authData);
        securityAuditLogger.logAuthenticationFailure(userId, ip, userAgent, 'Invalid credentials', metadata);
        break;
    }
  }

  // Get logging system status
  getStatus(): {
    initialized: boolean;
    aggregationEnabled: boolean;
    retentionEnabled: boolean;
    securityLoggingEnabled: boolean;
    healthChecksRunning: boolean;
    metricsCollectionRunning: boolean;
  } {
    return {
      initialized: this.initialized,
      aggregationEnabled: logAggregationService.getTransports().length > 0,
      retentionEnabled: process.env.LOG_RETENTION_ENABLED === 'true',
      securityLoggingEnabled: true,
      healthChecksRunning: this.healthCheckInterval !== null,
      metricsCollectionRunning: this.metricsInterval !== null
    };
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    try {
      // Clear intervals
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }
      
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
        this.metricsInterval = null;
      }

      // Shutdown services
      await logAggregationService.shutdown();
      await logRetentionManager.shutdown();

      // Log shutdown
      logger.info('Logging integration shutdown completed', {
        category: 'logging',
        system: 'shutdown'
      });

      this.initialized = false;
    } catch (error) {
      logger.error('Error during logging integration shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
        category: 'logging'
      });
      throw error;
    }
  }
}

// Singleton instance
export const loggingIntegration = LoggingIntegration.getInstance();

// Convenience functions
export const logBusinessEvent = (event: string, details: LogContext) => 
  loggingIntegration.logBusinessEvent(event, details);

export const logPerformanceMetric = (operation: string, duration: number, metadata?: LogContext) => 
  loggingIntegration.logPerformanceMetric(operation, duration, metadata);

export const logDatabaseOperation = (operation: string, table: string, duration: number, metadata?: LogContext) => 
  loggingIntegration.logDatabaseOperation(operation, table, duration, metadata);

export const logApiCall = (method: string, endpoint: string, statusCode: number, duration: number, metadata?: LogContext) => 
  loggingIntegration.logApiCall(method, endpoint, statusCode, duration, metadata);

export const logUserAction = (userId: string, action: string, resource: string, metadata?: LogContext) => 
  loggingIntegration.logUserAction(userId, action, resource, metadata);

export const logAuthEvent = (type: 'login' | 'logout' | 'failed_login', userId: string, ip: string, userAgent: string, metadata?: LogContext) => 
  loggingIntegration.logAuthEvent(type, userId, ip, userAgent, metadata);

export default loggingIntegration;