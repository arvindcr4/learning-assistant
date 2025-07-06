import { createLogger, format, transports } from 'winston';
import 'winston-daily-rotate-file';

const { combine, timestamp, errors, json, printf, colorize } = format;

// Custom log format for console output
const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
  return `${timestamp} [${level}]: ${message} ${stack || ''} ${metaString}`;
});

// Create logger configuration
const createLoggerConfig = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');
  
  const loggerTransports = [
    // Console transport
    new transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        consoleFormat
      ),
      level: logLevel,
    }),
  ];

  // Add file transports for non-development environments
  if (!isDevelopment) {
    // Error log file
    loggerTransports.push(
      new transports.DailyRotateFile({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        format: combine(
          timestamp(),
          errors({ stack: true }),
          json()
        ),
        maxSize: '20m',
        maxFiles: '14d',
        zippedArchive: true,
      })
    );

    // Combined log file
    loggerTransports.push(
      new transports.DailyRotateFile({
        filename: 'logs/combined-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        format: combine(
          timestamp(),
          errors({ stack: true }),
          json()
        ),
        maxSize: '20m',
        maxFiles: '14d',
        zippedArchive: true,
      })
    );
  }

  return {
    level: logLevel,
    format: combine(
      timestamp(),
      errors({ stack: true }),
      json()
    ),
    transports: loggerTransports,
    exitOnError: false,
  };
};

// Create logger instance
const logger = createLogger(createLoggerConfig());

// Create specific loggers for different contexts
export const apiLogger = logger.child({ context: 'API' });
export const dbLogger = logger.child({ context: 'Database' });
export const authLogger = logger.child({ context: 'Authentication' });
export const learningLogger = logger.child({ context: 'Learning' });
export const performanceLogger = logger.child({ context: 'Performance' });
export const securityLogger = logger.child({ context: 'Security' });

// Logger utility functions
export const loggerUtils = {
  // Log API requests
  logApiRequest: (method: string, url: string, userId?: string, duration?: number) => {
    apiLogger.info('API Request', {
      method,
      url,
      userId,
      duration,
      timestamp: new Date().toISOString(),
    });
  },

  // Log API responses
  logApiResponse: (method: string, url: string, status: number, duration: number, userId?: string) => {
    const level = status >= 400 ? 'error' : 'info';
    apiLogger.log(level, 'API Response', {
      method,
      url,
      status,
      duration,
      userId,
      timestamp: new Date().toISOString(),
    });
  },

  // Log database queries
  logDatabaseQuery: (query: string, duration: number, error?: Error) => {
    if (error) {
      dbLogger.error('Database Query Error', {
        query: query.substring(0, 200), // Truncate long queries
        duration,
        error: error.message,
        stack: error.stack,
      });
    } else {
      dbLogger.debug('Database Query', {
        query: query.substring(0, 200),
        duration,
      });
    }
  },

  // Log authentication events
  logAuthEvent: (event: string, userId?: string, email?: string, ip?: string, success: boolean = true) => {
    const level = success ? 'info' : 'warn';
    authLogger.log(level, 'Authentication Event', {
      event,
      userId,
      email,
      ip,
      success,
      timestamp: new Date().toISOString(),
    });
  },

  // Log learning events
  logLearningEvent: (event: string, userId: string, contentId?: string, sessionId?: string, metadata?: any) => {
    learningLogger.info('Learning Event', {
      event,
      userId,
      contentId,
      sessionId,
      metadata,
      timestamp: new Date().toISOString(),
    });
  },

  // Log performance metrics
  logPerformanceMetric: (metric: string, value: number, unit: string = 'ms', tags?: Record<string, string>) => {
    performanceLogger.info('Performance Metric', {
      metric,
      value,
      unit,
      tags,
      timestamp: new Date().toISOString(),
    });
  },

  // Log security events
  logSecurityEvent: (event: string, severity: 'low' | 'medium' | 'high', details: any, ip?: string) => {
    const level = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
    securityLogger.log(level, 'Security Event', {
      event,
      severity,
      details,
      ip,
      timestamp: new Date().toISOString(),
    });
  },

  // Log errors with context
  logError: (error: Error, context?: string, userId?: string, additional?: any) => {
    logger.error('Application Error', {
      message: error.message,
      stack: error.stack,
      context,
      userId,
      additional,
      timestamp: new Date().toISOString(),
    });
  },

  // Log business metrics
  logBusinessMetric: (metric: string, value: number, userId?: string, metadata?: any) => {
    logger.info('Business Metric', {
      metric,
      value,
      userId,
      metadata,
      timestamp: new Date().toISOString(),
    });
  },
};

// Export default logger
export default logger;

// Health check for logger
export const loggerHealthCheck = (): boolean => {
  try {
    logger.info('Logger health check');
    return true;
  } catch (error) {
    console.error('Logger health check failed:', error);
    return false;
  }
};

// Graceful shutdown for logger
export const shutdownLogger = async (): Promise<void> => {
  return new Promise((resolve) => {
    logger.on('finish', resolve);
    logger.end();
  });
};