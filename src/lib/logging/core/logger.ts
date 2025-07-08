/**
 * Core Logger Implementation
 * 
 * Enhanced Winston logger with comprehensive features:
 * - Multiple transport support
 * - Structured logging
 * - Performance monitoring
 * - Security audit trails
 * - Sensitive data scrubbing
 * - Context-aware logging
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { correlationManager } from '../../../lib/correlation';
import { LogContext, LogLevel, LogEntry, LoggerConfig } from '../types';
import { logFormatter, sensitiveDataScrubber } from '../utils/formatters';
import { productionTransports } from '../transports/production';
import { developmentTransports } from '../transports/development';

// Environment configuration
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Default logger configuration
const defaultConfig: LoggerConfig = {
  level: (process.env.LOG_LEVEL as LogLevel) || (isDevelopment ? 'debug' : 'info'),
  format: 'json',
  transports: [],
  enableConsole: true,
  enableFile: isProduction,
  enableRemote: isProduction,
  enableSampling: false,
  samplingRate: 0.1,
  enableBuffering: false,
  bufferSize: 1000,
  flushInterval: 5000,
  enableScrubbing: true,
  scrubFields: ['password', 'token', 'secret', 'key', 'authorization', 'cookie'],
  enableMetrics: true,
  enableAudit: true,
  enableCompliance: isProduction,
  retention: {
    local: 30,
    remote: 365,
    archive: 2555 // 7 years
  },
  rotation: {
    enabled: true,
    maxSize: '20m',
    maxFiles: 14,
    datePattern: 'YYYY-MM-DD'
  }
};

// Enhanced logger class
export class EnhancedLogger {
  private logger: winston.Logger;
  private config: LoggerConfig;
  private metrics: Map<string, any>;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.metrics = new Map();
    this.logger = this.createLogger();
  }

  private createLogger(): winston.Logger {
    const transports: winston.transport[] = [];

    // Console transport
    if (this.config.enableConsole) {
      transports.push(
        new winston.transports.Console({
          format: isDevelopment ? this.createDevelopmentFormat() : this.createProductionFormat(),
          level: this.config.level
        })
      );
    }

    // File transports
    if (this.config.enableFile) {
      transports.push(...this.createFileTransports());
    }

    // Remote transports
    if (this.config.enableRemote) {
      transports.push(...this.getRemoteTransports());
    }

    return winston.createLogger({
      level: this.config.level,
      format: this.createProductionFormat(),
      transports,
      exitOnError: false,
      silent: isTest
    });
  }

  private createDevelopmentFormat(): winston.Logform.Format {
    return winston.format.combine(
      winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
      winston.format.colorize(),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, correlationId, component, ...meta }) => {
        const correlationStr = correlationId ? `[${correlationId.substring(0, 8)}]` : '';
        const componentStr = component ? `[${component}]` : '';
        const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
        return `${timestamp} ${level} ${correlationStr}${componentStr}: ${message}${metaStr}`;
      })
    );
  }

  private createProductionFormat(): winston.Logform.Format {
    return winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf((info) => {
        const { timestamp, level, message, correlationId, userId, sessionId, ...meta } = info;
        
        // Scrub sensitive data
        const scrubbedMeta = this.config.enableScrubbing ? 
          sensitiveDataScrubber(meta, this.config.scrubFields) : meta;

        return JSON.stringify({
          timestamp,
          level,
          message,
          correlationId,
          userId,
          sessionId,
          service: 'learning-assistant',
          environment: process.env.NODE_ENV,
          version: process.env.npm_package_version || '1.0.0',
          pid: process.pid,
          hostname: process.env.HOSTNAME || 'unknown',
          ...scrubbedMeta
        });
      })
    );
  }

  private createFileTransports(): winston.transport[] {
    const transports: winston.transport[] = [];

    // Application logs
    transports.push(
      new DailyRotateFile({
        filename: 'logs/app-%DATE%.log',
        datePattern: this.config.rotation.datePattern,
        zippedArchive: true,
        maxSize: this.config.rotation.maxSize,
        maxFiles: `${this.config.retention.local}d`,
        format: this.createProductionFormat(),
        level: 'info'
      })
    );

    // Error logs
    transports.push(
      new DailyRotateFile({
        filename: 'logs/error-%DATE%.log',
        datePattern: this.config.rotation.datePattern,
        zippedArchive: true,
        maxSize: this.config.rotation.maxSize,
        maxFiles: `${this.config.retention.local}d`,
        format: this.createProductionFormat(),
        level: 'error'
      })
    );

    // Security logs
    transports.push(
      new DailyRotateFile({
        filename: 'logs/security-%DATE%.log',
        datePattern: this.config.rotation.datePattern,
        zippedArchive: true,
        maxSize: this.config.rotation.maxSize,
        maxFiles: `${this.config.retention.archive}d`,
        format: this.createProductionFormat(),
        level: 'warn',
        // Only log security-related events
        filter: (info) => info.category === 'security' || info.securityEvent === true
      })
    );

    // Performance logs
    transports.push(
      new DailyRotateFile({
        filename: 'logs/performance-%DATE%.log',
        datePattern: this.config.rotation.datePattern,
        zippedArchive: true,
        maxSize: this.config.rotation.maxSize,
        maxFiles: `${this.config.retention.local}d`,
        format: this.createProductionFormat(),
        level: 'info',
        // Only log performance-related events
        filter: (info) => info.category === 'performance' || info.performanceMetric === true
      })
    );

    // Audit logs
    transports.push(
      new DailyRotateFile({
        filename: 'logs/audit-%DATE%.log',
        datePattern: this.config.rotation.datePattern,
        zippedArchive: true,
        maxSize: this.config.rotation.maxSize,
        maxFiles: `${this.config.retention.archive}d`,
        format: this.createProductionFormat(),
        level: 'info',
        // Only log audit-related events
        filter: (info) => info.category === 'audit' || info.auditEvent === true
      })
    );

    return transports;
  }

  private getRemoteTransports(): winston.transport[] {
    return isProduction ? productionTransports : [];
  }

  // Core logging methods
  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  http(message: string, context?: LogContext): void {
    this.log('http', message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  verbose(message: string, context?: LogContext): void {
    this.log('verbose', message, context);
  }

  // Main logging method
  log(level: LogLevel, message: string, context: LogContext = {}): void {
    // Add correlation ID if not provided
    const correlationId = context.correlationId || correlationManager.getCurrentCorrelationId();
    
    // Create enhanced context
    const enhancedContext: LogContext = {
      ...context,
      correlationId,
      timestamp: new Date().toISOString(),
      pid: process.pid,
      hostname: process.env.HOSTNAME || 'unknown',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV
    };

    // Apply sampling if enabled
    if (this.config.enableSampling && this.shouldSample(level)) {
      return;
    }

    // Log the message
    this.logger.log(level, message, enhancedContext);

    // Update metrics
    this.updateMetrics(level, message, enhancedContext);
  }

  // Specialized logging methods
  logError(error: Error, context?: LogContext): void {
    const errorContext: LogContext = {
      ...context,
      stack: error.stack,
      name: error.name,
      category: 'error'
    };

    this.error(`${error.name}: ${error.message}`, errorContext);
  }

  logPerformance(operation: string, duration: number, context?: LogContext): void {
    const performanceContext: LogContext = {
      ...context,
      operation,
      duration,
      responseTime: `${duration}ms`,
      category: 'performance',
      performanceMetric: true
    };

    if (duration > 1000) {
      this.warn(`Slow operation: ${operation}`, performanceContext);
    } else {
      this.info(`Performance: ${operation}`, performanceContext);
    }
  }

  logSecurity(event: string, context: LogContext): void {
    const securityContext: LogContext = {
      ...context,
      category: 'security',
      securityEvent: true,
      timestamp: new Date().toISOString()
    };

    this.warn(`Security Event: ${event}`, securityContext);
  }

  logAudit(event: string, context: LogContext): void {
    const auditContext: LogContext = {
      ...context,
      category: 'audit',
      auditEvent: true,
      timestamp: new Date().toISOString()
    };

    this.info(`Audit Event: ${event}`, auditContext);
  }

  logBusiness(event: string, context: LogContext): void {
    const businessContext: LogContext = {
      ...context,
      category: 'business',
      businessEvent: true,
      timestamp: new Date().toISOString()
    };

    this.info(`Business Event: ${event}`, businessContext);
  }

  // Utility methods
  private shouldSample(level: LogLevel): boolean {
    if (!this.config.enableSampling) return false;
    
    // Never sample errors or security events
    if (level === 'error' || level === 'warn') return false;
    
    return Math.random() > this.config.samplingRate;
  }

  private updateMetrics(level: LogLevel, message: string, context: LogContext): void {
    if (!this.config.enableMetrics) return;

    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const key = `${level}-${minute}`;

    if (!this.metrics.has(key)) {
      this.metrics.set(key, { count: 0, size: 0 });
    }

    const metric = this.metrics.get(key);
    metric.count++;
    metric.size += message.length + JSON.stringify(context).length;

    // Clean up old metrics (older than 1 hour)
    const hourAgo = Math.floor((now - 3600000) / 60000);
    for (const [metricKey] of this.metrics) {
      const [, metricMinute] = metricKey.split('-');
      if (parseInt(metricMinute) < hourAgo) {
        this.metrics.delete(metricKey);
      }
    }
  }

  // Logger management
  addTransport(transport: winston.transport): void {
    this.logger.add(transport);
  }

  removeTransport(transport: winston.transport): void {
    this.logger.remove(transport);
  }

  setLevel(level: LogLevel): void {
    this.logger.level = level;
    this.config.level = level;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      this.info('Logger health check', { category: 'health' });
      return true;
    } catch (error) {
      console.error('Logger health check failed:', error);
      return false;
    }
  }

  // Metrics
  getMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    
    for (const [key, value] of this.metrics) {
      metrics[key] = value;
    }

    return {
      metrics,
      totalTransports: this.logger.transports.length,
      currentLevel: this.logger.level,
      isProduction: isProduction,
      isDevelopment: isDevelopment,
      config: this.config
    };
  }

  // Graceful shutdown
  async close(): Promise<void> {
    try {
      // Close all transports
      this.logger.transports.forEach(transport => {
        if (transport.close) {
          transport.close();
        }
      });

      // Clear metrics
      this.metrics.clear();

      this.info('Logger shutdown completed', { category: 'shutdown' });
    } catch (error) {
      console.error('Error during logger shutdown:', error);
    }
  }
}

// Create and export the default logger instance
export const logger = new EnhancedLogger();

// Export factory function for creating custom loggers
export function createLogger(config: Partial<LoggerConfig> = {}): EnhancedLogger {
  return new EnhancedLogger(config);
}

// Export contextual logger creator
export function createContextualLogger(baseContext: LogContext): EnhancedLogger {
  const contextualLogger = new EnhancedLogger();
  
  // Override the log method to include base context
  const originalLog = contextualLogger.log.bind(contextualLogger);
  contextualLogger.log = (level: LogLevel, message: string, context: LogContext = {}) => {
    const mergedContext = { ...baseContext, ...context };
    originalLog(level, message, mergedContext);
  };

  return contextualLogger;
}

export default logger;