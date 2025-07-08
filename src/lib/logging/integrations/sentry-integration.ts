/**
 * Sentry Integration for Logging System
 * 
 * Integrates logging with Sentry for:
 * - Error tracking and alerting
 * - Performance monitoring
 * - User context and breadcrumbs
 * - Release tracking
 * - Custom tags and fingerprinting
 */

import * as Sentry from '@sentry/nextjs';
import { logger } from '../core/logger';
import { performanceLogger } from '../core/performance-logger';
import { securityAuditLogger } from '../security/audit-logger';
import { LogContext, SecurityEvent, PerformanceMetric } from '../types';
import { correlationManager } from '../../correlation';

// Sentry integration configuration
interface SentryIntegrationConfig {
  enabled: boolean;
  dsn?: string;
  environment: string;
  release?: string;
  sampleRate: number;
  tracesSampleRate: number;
  profilesSampleRate: number;
  enablePerformanceMonitoring: boolean;
  enableSecurityLogging: boolean;
  enableUserContext: boolean;
  enableBreadcrumbs: boolean;
  captureConsole: boolean;
  captureUnhandledRejections: boolean;
  beforeSend?: (event: Sentry.Event) => Sentry.Event | null;
  beforeSendTransaction?: (event: any) => any | null;
}

// Default configuration
const defaultConfig: SentryIntegrationConfig = {
  enabled: process.env.NODE_ENV === 'production' && !!process.env.SENTRY_DSN,
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  release: process.env.npm_package_version || process.env.VERCEL_GIT_COMMIT_SHA,
  sampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE || '1.0'),
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
  profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
  enablePerformanceMonitoring: true,
  enableSecurityLogging: true,
  enableUserContext: true,
  enableBreadcrumbs: true,
  captureConsole: process.env.NODE_ENV !== 'development',
  captureUnhandledRejections: true
};

/**
 * Sentry Integration Class
 */
export class SentryIntegration {
  private static instance: SentryIntegration;
  private config: SentryIntegrationConfig;
  private initialized: boolean = false;

  private constructor(config: Partial<SentryIntegrationConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  static getInstance(config?: Partial<SentryIntegrationConfig>): SentryIntegration {
    if (!SentryIntegration.instance) {
      SentryIntegration.instance = new SentryIntegration(config);
    }
    return SentryIntegration.instance;
  }

  /**
   * Initialize Sentry integration
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled || !this.config.dsn) {
      logger.info('Sentry integration disabled or DSN not configured', {
        category: 'sentry'
      });
      return;
    }

    if (this.initialized) {
      logger.warn('Sentry integration already initialized', {
        category: 'sentry'
      });
      return;
    }

    try {
      // Initialize Sentry
      Sentry.init({
        dsn: this.config.dsn,
        environment: this.config.environment,
        release: this.config.release,
        sampleRate: this.config.sampleRate,
        tracesSampleRate: this.config.tracesSampleRate,
        profilesSampleRate: this.config.profilesSampleRate,
        
        // Performance monitoring
        enableTracing: this.config.enablePerformanceMonitoring,
        
        // Integrations
        integrations: this.createIntegrations(),
        
        // Event filtering and enhancement
        beforeSend: this.createBeforeSendHandler(),
        beforeSendTransaction: this.config.beforeSendTransaction,
        
        // Initial scope configuration
        initialScope: {
          tags: {
            component: 'logging-system',
            service: 'learning-assistant'
          },
          contexts: {
            app: {
              name: 'learning-assistant',
              version: this.config.release || '1.0.0'
            }
          }
        }
      });

      // Set up logging integration
      this.setupLoggingIntegration();

      // Set up performance monitoring
      if (this.config.enablePerformanceMonitoring) {
        this.setupPerformanceMonitoring();
      }

      // Set up security event monitoring
      if (this.config.enableSecurityLogging) {
        this.setupSecurityMonitoring();
      }

      this.initialized = true;

      logger.info('Sentry integration initialized successfully', {
        category: 'sentry',
        environment: this.config.environment,
        release: this.config.release
      });

      // Log successful initialization to Sentry
      Sentry.addBreadcrumb({
        message: 'Sentry integration initialized',
        category: 'logging',
        level: 'info',
        data: {
          environment: this.config.environment,
          release: this.config.release
        }
      });

    } catch (error) {
      logger.error('Failed to initialize Sentry integration', {
        error: error instanceof Error ? error.message : 'Unknown error',
        category: 'sentry'
      });
      throw error;
    }
  }

  /**
   * Create Sentry integrations
   */
  private createIntegrations(): Sentry.Integration[] {
    const integrations: Sentry.Integration[] = [];

    // Use default integrations - Sentry v8 includes most integrations by default
    // Custom integrations can be added here if needed
    // The following integrations are included by default in v8:
    // - httpIntegration (for HTTP request tracking)
    // - nodeContextIntegration (for Node.js context)
    // - onUncaughtExceptionIntegration (for uncaught exceptions)
    // - onUnhandledRejectionIntegration (for unhandled promise rejections)

    return integrations;
  }

  /**
   * Create beforeSend handler for event processing
   */
  private createBeforeSendHandler(): (event: Sentry.Event) => Sentry.Event | null {
    return (event: Sentry.Event): Sentry.Event | null => {
      // Add correlation ID if available
      const correlationId = correlationManager.getCurrentCorrelationId();
      if (correlationId) {
        event.tags = {
          ...event.tags,
          correlationId
        };
        
        event.contexts = {
          ...event.contexts,
          trace: {
            ...event.contexts?.trace,
            correlation_id: correlationId
          }
        };
      }

      // Sanitize sensitive data
      event = this.sanitizeEvent(event);

      // Apply custom filtering
      if (this.config.beforeSend) {
        return this.config.beforeSend(event);
      }

      return event;
    };
  }

  /**
   * Setup logging integration
   */
  private setupLoggingIntegration(): void {
    // Override logger methods to send to Sentry
    const originalLogError = logger.error.bind(logger);
    logger.error = (message: string, context?: LogContext) => {
      // Call original logger
      originalLogError(message, context);

      // Send to Sentry
      this.captureLogError(message, context);
    };

    const originalLogWarn = logger.warn.bind(logger);
    logger.warn = (message: string, context?: LogContext) => {
      // Call original logger
      originalLogWarn(message, context);

      // Add breadcrumb to Sentry
      Sentry.addBreadcrumb({
        message,
        category: context?.category || 'application',
        level: 'warning',
        data: context
      });
    };

    // Add breadcrumbs for info logs
    const originalLogInfo = logger.info.bind(logger);
    logger.info = (message: string, context?: LogContext) => {
      // Call original logger
      originalLogInfo(message, context);

      // Add breadcrumb for important events
      if (context?.category === 'security' || context?.category === 'business') {
        Sentry.addBreadcrumb({
          message,
          category: context.category,
          level: 'info',
          data: context
        });
      }
    };
  }

  /**
   * Setup performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    // Override performance logger to send to Sentry
    const originalLogMetric = performanceLogger.logMetric.bind(performanceLogger);
    performanceLogger.logMetric = (metric: PerformanceMetric) => {
      // Call original logger
      originalLogMetric(metric);

      // Send to Sentry for slow operations
      if (metric.duration > 1000 || !metric.success) {
        this.capturePerformanceEvent(metric);
      }
    };

    // Override HTTP request logging
    const originalLogHttpRequest = performanceLogger.logHttpRequest.bind(performanceLogger);
    performanceLogger.logHttpRequest = (method: string, url: string, statusCode: number, duration: number, context?: LogContext) => {
      // Call original logger
      originalLogHttpRequest(method, url, statusCode, duration, context);

      // Create Sentry span
      Sentry.startSpan({
        op: 'http.request',
        name: `${method} ${url}`,
        forceTransaction: true,
        attributes: {
          method,
          status_code: statusCode.toString(),
          success: statusCode < 400,
          url,
          duration,
          ...context
        }
      }, (span) => {
        span.setHttpStatus(statusCode);
        span.finish();
      });
    };

    // Override database query logging
    const originalLogDatabaseQuery = performanceLogger.logDatabaseQuery.bind(performanceLogger);
    performanceLogger.logDatabaseQuery = (query: string, duration: number, rowCount?: number, context?: LogContext) => {
      // Call original logger
      originalLogDatabaseQuery(query, duration, rowCount, context);

      // Create Sentry span
      Sentry.startSpan({
        op: 'db.query',
        name: 'Database Query',
        attributes: {
          query: query.substring(0, 100), // Truncate for safety
          duration,
          rowCount,
          ...context
        }
      }, (span) => {
        span.finish();
      });

      // Alert on slow queries
      if (duration > 2000) {
        Sentry.captureMessage(`Slow database query: ${duration}ms`, 'warning');
      }
    };
  }

  /**
   * Setup security monitoring
   */
  private setupSecurityMonitoring(): void {
    // Override security logger to send critical events to Sentry
    const originalLogSecurityEvent = securityAuditLogger.logSecurityEvent.bind(securityAuditLogger);
    securityAuditLogger.logSecurityEvent = (event: Omit<SecurityEvent, 'timestamp' | 'correlationId'>) => {
      // Call original logger
      originalLogSecurityEvent(event);

      // Send high and critical security events to Sentry
      if (event.severity === 'HIGH' || event.severity === 'CRITICAL') {
        this.captureSecurityEvent(event as SecurityEvent);
      } else {
        // Add breadcrumb for lower severity events
        Sentry.addBreadcrumb({
          message: `Security Event: ${event.type} - ${event.message}`,
          category: 'security',
          level: event.severity === 'MEDIUM' ? 'warning' : 'info',
          data: {
            type: event.type,
            severity: event.severity,
            outcome: event.outcome,
            ...event.details
          }
        });
      }
    };
  }

  /**
   * Capture log error in Sentry
   */
  private captureLogError(message: string, context?: LogContext): void {
    Sentry.withScope((scope) => {
      // Set user context
      if (context?.userId) {
        scope.setUser({ id: context.userId });
      }

      // Set tags
      scope.setTags({
        category: context?.category || 'application',
        component: context?.component,
        operation: context?.operation,
        correlationId: context?.correlationId
      });

      // Set context data
      scope.setContext('logContext', context);

      // Set level
      scope.setLevel('error');

      // Capture the error
      if (context?.stack) {
        // If we have a stack trace, create an error object
        const error = new Error(message);
        error.stack = context.stack;
        Sentry.captureException(error);
      } else {
        Sentry.captureMessage(message, 'error');
      }
    });
  }

  /**
   * Capture performance event in Sentry
   */
  private capturePerformanceEvent(metric: PerformanceMetric): void {
    Sentry.withScope((scope) => {
      scope.setTags({
        operation: metric.operation,
        success: metric.success.toString(),
        category: 'performance'
      });

      scope.setContext('performance', {
        operation: metric.operation,
        duration: metric.duration,
        unit: metric.unit,
        success: metric.success,
        metadata: metric.metadata
      });

      const level = metric.success ? 'warning' : 'error';
      const message = `Performance issue: ${metric.operation} took ${metric.duration}${metric.unit}`;
      
      Sentry.captureMessage(message, level);
    });
  }

  /**
   * Capture security event in Sentry
   */
  private captureSecurityEvent(event: SecurityEvent): void {
    Sentry.withScope((scope) => {
      // Set user context
      if (event.userId) {
        scope.setUser({ id: event.userId });
      }

      // Set tags
      scope.setTags({
        securityEventType: event.type,
        severity: event.severity,
        outcome: event.outcome || 'unknown',
        category: 'security'
      });

      // Set context
      scope.setContext('security', {
        type: event.type,
        severity: event.severity,
        ip: event.ip,
        userAgent: event.userAgent,
        resource: event.resource,
        action: event.action,
        riskScore: event.riskScore,
        details: event.details
      });

      // Set fingerprint for grouping similar security events
      scope.setFingerprint([
        'security-event',
        event.type,
        event.ip || 'unknown-ip'
      ]);

      const level = event.severity === 'CRITICAL' ? 'fatal' : 'error';
      Sentry.captureMessage(`Security Event: ${event.type} - ${event.message}`, level);
    });
  }

  /**
   * Sanitize event data to remove sensitive information
   */
  private sanitizeEvent(event: Sentry.Event): Sentry.Event {
    // Remove sensitive keys
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization'];
    
    const sanitizeObject = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;
      
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          sanitized[key] = sanitizeObject(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    };

    // Sanitize request data
    if (event.request) {
      event.request = sanitizeObject(event.request);
    }

    // Sanitize extra data
    if (event.extra) {
      event.extra = sanitizeObject(event.extra);
    }

    // Sanitize contexts
    if (event.contexts) {
      event.contexts = sanitizeObject(event.contexts);
    }

    return event;
  }

  /**
   * Set user context
   */
  setUser(user: { id?: string; username?: string; email?: string; ip?: string }): void {
    if (!this.initialized) return;

    Sentry.setUser(user);
  }

  /**
   * Add breadcrumb
   */
  addBreadcrumb(breadcrumb: {
    message: string;
    category?: string;
    level?: Sentry.SeverityLevel;
    data?: Record<string, any>;
  }): void {
    if (!this.initialized) return;

    Sentry.addBreadcrumb(breadcrumb);
  }

  /**
   * Set tag
   */
  setTag(key: string, value: string): void {
    if (!this.initialized) return;

    Sentry.setTag(key, value);
  }

  /**
   * Set context
   */
  setContext(key: string, context: Record<string, any>): void {
    if (!this.initialized) return;

    Sentry.setContext(key, context);
  }

  /**
   * Capture exception manually
   */
  captureException(error: Error, context?: LogContext): void {
    if (!this.initialized) return;

    Sentry.withScope((scope) => {
      if (context) {
        scope.setContext('additional', context);
        
        if (context.userId) {
          scope.setUser({ id: context.userId });
        }
        
        if (context.correlationId) {
          scope.setTag('correlationId', context.correlationId);
        }
      }

      Sentry.captureException(error);
    });
  }

  /**
   * Start transaction for performance tracking
   */
  startTransaction(name: string, op: string, data?: Record<string, any>): any {
    if (!this.initialized) {
      // Return a mock transaction if not initialized
      return {
        finish: () => {},
        setHttpStatus: () => {},
        setTag: () => {},
        setData: () => {}
      } as any;
    }

    return Sentry.startSpan({
      name,
      op,
      forceTransaction: true,
      attributes: data
    }, (span) => span);
  }

  /**
   * Get configuration
   */
  getConfig(): SentryIntegrationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SentryIntegrationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      enabled: this.config.enabled,
      dsn: this.config.dsn ? 'configured' : 'not configured',
      environment: this.config.environment,
      release: this.config.release
    };
  }

  /**
   * Shutdown Sentry integration
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    try {
      // Flush pending events
      await Sentry.flush(5000); // 5 second timeout
      
      logger.info('Sentry integration shutdown completed', {
        category: 'sentry'
      });

      this.initialized = false;
    } catch (error) {
      logger.error('Error during Sentry shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
        category: 'sentry'
      });
    }
  }
}

// Create and export singleton instance
export const sentryIntegration = SentryIntegration.getInstance();

// Export factory function
export function createSentryIntegration(config?: Partial<SentryIntegrationConfig>): SentryIntegration {
  return SentryIntegration.getInstance(config);
}

export default sentryIntegration;