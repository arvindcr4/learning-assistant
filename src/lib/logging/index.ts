/**
 * Centralized Logging System
 * 
 * This module provides a comprehensive logging infrastructure with:
 * - Multi-transport Winston logger configuration
 * - Structured logging with proper formatting
 * - Log rotation and archival policies
 * - Performance metrics collection
 * - Security audit logging
 * - Log aggregation for production
 * - Sensitive data scrubbing
 * - Request/response logging middleware
 * - Integration with error handling and monitoring
 */

// Core logger exports
export { logger, EnhancedLogger, createLogger } from './core/logger';
export { performanceLogger, PerformanceLogger, measurePerformance } from './core/performance-logger';
export { loggingSystem, LoggingSystem } from './core/logging-system';

// Middleware exports
export { 
  requestLoggingMiddleware, 
  RequestLoggingMiddleware,
  expressRequestLogger,
  nextRequestLogger 
} from './middleware/request-logging';

// Transport exports
export { 
  productionTransports,
  checkTransportHealth,
  createFileTransports,
  createLogzioTransport,
  createElasticsearchTransport,
  HttpTransport 
} from './transports/production';

// Utilities exports
export { 
  logFormatter, 
  sensitiveDataScrubber, 
  logSampler,
  logBuffer,
  LogFormatter,
  LogSampler,
  LogBuffer,
  formatUtils
} from './utils/formatters';

export { 
  loggerFactory, 
  loggerRegistry,
  LoggerFactory,
  LoggerRegistry,
  createContextualLogger,
  createModuleLogger,
  createRequestLogger,
  createUserLogger,
  getOrCreateLogger
} from './utils/logger-factory';

// Security exports
export { 
  securityAuditLogger,
  SecurityAuditLogger,
  SecurityEventType,
  SecurityEventSeverity,
  createSecurityAuditLogger
} from './security/audit-logger';

// Integration exports
export { 
  sentryIntegration,
  SentryIntegration,
  createSentryIntegration
} from './integrations/sentry-integration';

// Configuration exports
export { default as config } from './config';
export { 
  LOGGING_CONFIG,
  PERFORMANCE_THRESHOLDS,
  SECURITY_CONFIG,
  REQUEST_LOGGING_CONFIG,
  EXTERNAL_SERVICES,
  createDefaultLoggerConfig,
  getEnvironmentConfig,
  validateConfiguration
} from './config';

// Types exports
export type {
  LogContext,
  LogLevel,
  LogEntry,
  LogTransport,
  LoggerConfig,
  PerformanceMetric,
  SecurityEvent,
  SecurityEventSeverity as SecuritySeverity,
  SecurityEventType as SecurityType,
  AuditEvent,
  DataAccessEvent,
  RequestLogContext,
  LogFormatterOptions,
  LogSamplingOptions,
  LogBufferOptions,
  MonitoringThresholds,
  HealthCheckResult,
  LogStatistics,
  ComplianceContext,
  ErrorContext,
  BusinessEventContext,
  SystemMetricContext
} from './types';

// Default configured logger instance
export const defaultLogger = logger;

// Quick access to main components
export const mainLogger = logger;
export const mainPerformanceLogger = performanceLogger;
export const mainSecurityLogger = securityAuditLogger;
export const mainLoggingSystem = loggingSystem;
export const mainSentryIntegration = sentryIntegration;

// Initialize logging system function
export async function initializeLogging(): Promise<void> {
  try {
    // Initialize main logging system
    await loggingSystem.initialize();
    
    // Initialize Sentry integration
    await sentryIntegration.initialize();
    
    // Log successful initialization
    logger.info('Centralized logging system initialized successfully', {
      category: 'system',
      environment: process.env.NODE_ENV,
      features: {
        performance: true,
        security: true,
        audit: true,
        sentry: sentryIntegration.getStatus().enabled
      }
    });
    
  } catch (error) {
    console.error('Failed to initialize logging system:', error);
    throw error;
  }
}

// Shutdown logging system function
export async function shutdownLogging(): Promise<void> {
  try {
    await Promise.all([
      loggingSystem.shutdown(),
      sentryIntegration.shutdown()
    ]);
    
    console.log('Centralized logging system shutdown completed');
  } catch (error) {
    console.error('Error during logging system shutdown:', error);
    throw error;
  }
}

// Health check function
export async function checkLoggingHealth(): Promise<Record<string, any>> {
  const health = await loggingSystem.performHealthCheck();
  return {
    ...health,
    sentry: sentryIntegration.getStatus(),
    configuration: config.validateConfiguration()
  };
}

// Get logging statistics
export async function getLoggingStatistics(): Promise<Record<string, any>> {
  const stats = await loggingSystem.getSystemStatistics();
  return {
    ...stats,
    factory: loggerFactory.getStatistics(),
    security: securityAuditLogger.getStatistics(),
    performance: performanceLogger.getStatistics()
  };
}