// Only import winston on server-side to prevent client-side bundling issues
let winston: any;
let DailyRotateFile: any;

if (typeof window === 'undefined') {
  // Server-side imports
  try {
    winston = require('winston');
    DailyRotateFile = require('winston-daily-rotate-file');
  } catch (error) {
    console.warn('Failed to import winston packages:', error);
  }
}

import { correlationManager } from './correlation';

// Only import log aggregation on server-side
let logAggregationManager: any;
let initializeLogAggregation: any;

if (typeof window === 'undefined') {
  try {
    const logAgg = require('./log-aggregation');
    logAggregationManager = logAgg.logAggregationManager;
    initializeLogAggregation = logAgg.initializeLogAggregation;
  } catch (error) {
    console.warn('Failed to import log aggregation:', error);
  }
}

// Environment variables
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

// Log format configuration
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, correlationId, userId, sessionId, ...meta } = info;
    return JSON.stringify({
      timestamp,
      level,
      message,
      correlationId,
      userId,
      sessionId,
      service: 'learning-assistant',
      environment: process.env.NODE_ENV,
      ...meta
    });
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf((info) => {
    const { timestamp, level, message, correlationId, ...meta } = info;
    const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    const correlationString = correlationId ? `[${correlationId}]` : '';
    return `${timestamp} ${level} ${correlationString}: ${message} ${metaString}`;
  })
);

// Initialize log aggregation (server-side only)
if (typeof window === 'undefined' && initializeLogAggregation) {
  initializeLogAggregation();
}

// Transport configuration (server-side only)
const transports: any[] = [];

if (typeof window === 'undefined' && winston) {
  transports.push(
    // Console transport
    new winston.transports.Console({
      format: isDevelopment ? consoleFormat : logFormat,
      level: logLevel
    })
  );
  
  // Add log aggregation transports
  if (logAggregationManager) {
    transports.push(...logAggregationManager.getTransports());
  }
}

// File transports for production (server-side only)
if (isProduction && typeof window === 'undefined' && DailyRotateFile) {
  // Application logs with rotation
  transports.push(
    new DailyRotateFile({
      filename: 'logs/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: logFormat,
      level: 'info'
    })
  );

  // Error logs with rotation
  transports.push(
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      format: logFormat,
      level: 'error'
    })
  );

  // Security audit logs
  transports.push(
    new DailyRotateFile({
      filename: 'logs/security-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '90d',
      format: logFormat,
      level: 'warn'
    })
  );
}

// Create Winston logger instance (server-side only)
let winstonLogger: any;

if (typeof window === 'undefined' && winston) {
  winstonLogger = winston.createLogger({
    level: logLevel,
    format: logFormat,
    transports,
    exitOnError: false,
    silent: process.env.NODE_ENV === 'test'
  });
} else {
  // Browser fallback - simple console logger
  winstonLogger = {
    log: (level: string, message: string, meta: any = {}) => {
      switch (level) {
        case 'error':
          console.error(message, meta);
          break;
        case 'warn':
          console.warn(message, meta);
          break;
        case 'info':
          console.log(message, meta);
          break;
        case 'debug':
          console.debug(message, meta);
          break;
        default:
          console.log(message, meta);
      }
    },
    error: (message: string, meta?: any) => console.error(message, meta),
    warn: (message: string, meta?: any) => console.warn(message, meta),
    info: (message: string, meta?: any) => console.log(message, meta),
    debug: (message: string, meta?: any) => console.debug(message, meta),
  };
}

// Logger interface for consistency
interface Logger {
  error: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  info: (message: string, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
  http: (message: string, meta?: any) => void;
}

// Create enhanced logger with additional context
const createEnhancedLogger = (): Logger => {
  const log = (level: string, message: string, meta: any = {}) => {
    // Add correlation context
    const correlationContext = correlationManager.getLoggingContext();
    
    // Add default metadata
    const enrichedMeta = {
      ...correlationContext,
      ...meta,
      pid: process.pid,
      hostname: process.env.HOSTNAME || 'unknown',
      version: process.env.npm_package_version || '1.0.0'
    };

    winstonLogger.log(level, message, enrichedMeta);
  };

  return {
    error: (message: string, meta?: any) => log('error', message, meta),
    warn: (message: string, meta?: any) => log('warn', message, meta),
    info: (message: string, meta?: any) => log('info', message, meta),
    debug: (message: string, meta?: any) => log('debug', message, meta),
    http: (message: string, meta?: any) => log('info', message, { ...meta, category: 'http' }),
  };
};

// Create logger instance
const logger = createEnhancedLogger();

// Enhanced logging utilities
export interface LogContext {
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  category?: string;
  operation?: string;
  component?: string;
  [key: string]: any;
}

// Create contextual logger
export const createContextualLogger = (context: LogContext) => {
  return {
    error: (message: string, meta?: any) => 
      logger.error(message, { ...context, ...meta }),
    warn: (message: string, meta?: any) => 
      logger.warn(message, { ...context, ...meta }),
    info: (message: string, meta?: any) => 
      logger.info(message, { ...context, ...meta }),
    debug: (message: string, meta?: any) => 
      logger.debug(message, { ...context, ...meta }),
    http: (message: string, meta?: any) => 
      logger.http(message, { ...context, ...meta }),
  };
};

// Request logging middleware (enhanced)
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  const { method, url, headers } = req;
  const correlationId = req.headers['x-correlation-id'] || req.correlationId;
  const userId = req.user?.id || req.userId;
  const sessionId = req.sessionId;
  
  const context: LogContext = {
    correlationId,
    userId,
    sessionId,
    userAgent: headers['user-agent'],
    ip: headers['x-forwarded-for'] || req.connection?.remoteAddress,
    method,
    url,
    category: 'http'
  };

  // Log request start
  logger.http(`${method} ${url} - Start`, context);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    
    // Log request completion
    logger.http(`${method} ${url} - ${statusCode}`, {
      ...context,
      statusCode,
      duration,
      responseTime: `${duration}ms`
    });

    // Log slow requests as warnings
    if (duration > 5000) {
      logger.warn(`Slow request detected: ${method} ${url}`, {
        ...context,
        statusCode,
        duration,
        slowRequest: true
      });
    }

    // Log error responses
    if (statusCode >= 400) {
      const level = statusCode >= 500 ? 'error' : 'warn';
      logger[level](`HTTP ${statusCode}: ${method} ${url}`, {
        ...context,
        statusCode,
        duration,
        httpError: true
      });
    }
  });

  if (next) next();
};

// Enhanced error logging
export const logError = (error: Error, context?: string, meta?: LogContext) => {
  const errorMeta = {
    ...meta,
    stack: error.stack,
    name: error.name,
    context,
    category: 'error'
  };

  logger.error(`${context ? `[${context}] ` : ''}${error.message}`, errorMeta);

  // Log critical errors to security log for monitoring
  if (error.name === 'SecurityError' || error.message.includes('security')) {
    logger.warn(`Security-related error: ${error.message}`, {
      ...errorMeta,
      category: 'security'
    });
  }
};

// Performance logging with enhanced metrics
export const logPerformance = (operation: string, duration: number, metadata?: LogContext) => {
  const performanceMeta = {
    ...metadata,
    duration,
    responseTime: `${duration}ms`,
    category: 'performance',
    operation
  };

  logger.info(`Performance: ${operation}`, performanceMeta);

  // Log slow operations as warnings
  if (duration > 3000) {
    logger.warn(`Slow operation: ${operation}`, {
      ...performanceMeta,
      slowOperation: true
    });
  }
};

// Security audit logging
export const logSecurityEvent = (event: string, details: LogContext) => {
  logger.warn(`Security Event: ${event}`, {
    ...details,
    category: 'security',
    securityEvent: true,
    timestamp: new Date().toISOString()
  });
};

// Database operation logging
export const logDatabaseOperation = (operation: string, table: string, duration: number, meta?: LogContext) => {
  logger.info(`Database: ${operation} on ${table}`, {
    ...meta,
    operation,
    table,
    duration,
    category: 'database'
  });
};

// Business logic logging
export const logBusinessEvent = (event: string, details: LogContext) => {
  logger.info(`Business Event: ${event}`, {
    ...details,
    category: 'business',
    businessEvent: true
  });
};

// Export specific loggers for different contexts
export const performanceLogger = createContextualLogger({ category: 'performance' });
export const securityLogger = createContextualLogger({ category: 'security' });
export const databaseLogger = createContextualLogger({ category: 'database' });
export const businessLogger = createContextualLogger({ category: 'business' });

// Export utility functions as loggerUtils
export const loggerUtils = {
  logPerformanceMetric: (operation: string, value: number, unit: string, metadata?: LogContext) => {
    logger.info(`Performance metric: ${operation}`, {
      ...metadata,
      value,
      unit,
      category: 'metrics',
      operation
    });
  },
  
  logMemoryUsage: () => {
    const memUsage = process.memoryUsage();
    logger.info('Memory usage', {
      category: 'system',
      memory: {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)} MB`,
      }
    });
  },

  logSystemMetrics: () => {
    const uptime = process.uptime();
    logger.info('System metrics', {
      category: 'system',
      uptime: `${Math.round(uptime)} seconds`,
      pid: process.pid,
      platform: process.platform,
      nodeVersion: process.version
    });
  }
};

// Health check function for monitoring
export const loggerHealthCheck = (): boolean => {
  try {
    logger.info('Logger health check', { category: 'health' });
    return true;
  } catch (error) {
    console.error('Logger health check failed:', error);
    return false;
  }
};

// Advanced log sampling for high-volume events
class LogSampler {
  private counters: Map<string, number> = new Map();
  private lastReset: number = Date.now();
  private resetInterval: number = 60000; // 1 minute
  
  constructor(
    private sampleRate: number = 0.1,
    private burstProtection: boolean = true,
    private maxLogsPerMinute: number = 1000
  ) {}
  
  shouldLog(key: string, level: string): boolean {
    // Always log errors and warnings
    if (level === 'error' || level === 'warn') {
      return true;
    }
    
    // Reset counters periodically
    const now = Date.now();
    if (now - this.lastReset > this.resetInterval) {
      this.counters.clear();
      this.lastReset = now;
    }
    
    // Check burst protection
    if (this.burstProtection) {
      const count = this.counters.get(key) || 0;
      if (count >= this.maxLogsPerMinute) {
        return false;
      }
      this.counters.set(key, count + 1);
    }
    
    // Apply sampling
    return Math.random() <= this.sampleRate;
  }
}

const globalSampler = new LogSampler();

// Log sampling for high-volume events
export const createSampledLogger = (sampleRate: number = 0.1, key: string = 'default') => {
  const sampler = new LogSampler(sampleRate);
  
  return {
    error: (message: string, meta?: any) => logger.error(message, meta),
    warn: (message: string, meta?: any) => logger.warn(message, meta),
    info: (message: string, meta?: any) => {
      if (sampler.shouldLog(key, 'info')) {
        logger.info(message, { ...meta, sampled: true, sampleRate });
      }
    },
    debug: (message: string, meta?: any) => {
      if (sampler.shouldLog(key, 'debug')) {
        logger.debug(message, { ...meta, sampled: true, sampleRate });
      }
    },
    http: (message: string, meta?: any) => {
      if (sampler.shouldLog(key, 'http')) {
        logger.http(message, { ...meta, sampled: true, sampleRate });
      }
    }
  };
};

// Create logger function for specific modules
export const createLogger = (module: string) => {
  return createContextualLogger({ component: module });
};

// Log-based metrics and alerting
export class LogMetricsCollector {
  private static instance: LogMetricsCollector;
  private metrics: Map<string, any> = new Map();
  private alerts: Array<{
    condition: (log: any) => boolean;
    action: (log: any) => void;
    name: string;
  }> = [];
  
  private constructor() {
    this.setupDefaultAlerts();
  }
  
  static getInstance(): LogMetricsCollector {
    if (!LogMetricsCollector.instance) {
      LogMetricsCollector.instance = new LogMetricsCollector();
    }
    return LogMetricsCollector.instance;
  }
  
  // Collect metrics from log entries
  collectMetric(level: string, category: string, operation?: string): void {
    const key = `${level}:${category}:${operation || 'unknown'}`;
    const existing = this.metrics.get(key) || { count: 0, lastSeen: null };
    
    existing.count++;
    existing.lastSeen = new Date().toISOString();
    
    this.metrics.set(key, existing);
  }
  
  // Add alert condition
  addAlert(name: string, condition: (log: any) => boolean, action: (log: any) => void): void {
    this.alerts.push({ name, condition, action });
  }
  
  // Check alerts
  checkAlerts(logEntry: any): void {
    for (const alert of this.alerts) {
      try {
        if (alert.condition(logEntry)) {
          alert.action(logEntry);
        }
      } catch (error) {
        console.error(`Alert ${alert.name} failed:`, error);
      }
    }
  }
  
  // Get metrics
  getMetrics(): Record<string, any> {
    return Object.fromEntries(this.metrics);
  }
  
  // Setup default alerts
  private setupDefaultAlerts(): void {
    // High error rate alert
    this.addAlert(
      'high_error_rate',
      (log) => log.level === 'error' && log.category === 'http',
      (log) => {
        console.error('HIGH ERROR RATE ALERT:', {
          message: log.message,
          correlationId: log.correlationId,
          timestamp: log.timestamp,
        });
      }
    );
    
    // Slow request alert
    this.addAlert(
      'slow_request',
      (log) => log.slowRequest === true,
      (log) => {
        console.warn('SLOW REQUEST ALERT:', {
          operation: log.operation,
          duration: log.duration,
          correlationId: log.correlationId,
        });
      }
    );
    
    // Security violation alert
    this.addAlert(
      'security_violation',
      (log) => log.category === 'security' && log.securityEvent === true,
      (log) => {
        console.error('SECURITY ALERT:', {
          event: log.message,
          severity: log.severity,
          correlationId: log.correlationId,
          riskScore: log.riskScore,
        });
      }
    );
  }
}

const metricsCollector = LogMetricsCollector.getInstance();

// Enhanced logger with metrics collection
const enhancedLogger = createEnhancedLogger();
const originalLog = winstonLogger.log;

// Override Winston log method to collect metrics
winstonLogger.log = function(level: string, message: string, meta: any = {}) {
  // Collect metrics
  metricsCollector.collectMetric(level, meta.category || 'general', meta.operation);
  
  // Check alerts
  metricsCollector.checkAlerts({ level, message, ...meta });
  
  // Call original log method
  return originalLog.call(this, level, message, meta);
};

// Health check for logging infrastructure
export const loggingHealthCheck = async (): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: Record<string, boolean>;
  details: Record<string, any>;
}> => {
  const components: Record<string, boolean> = {};
  const details: Record<string, any> = {};
  
  try {
    // Check Winston logger
    components.winston = loggerHealthCheck();
    
    // Check log aggregation services
    const aggregationHealth = await logAggregationManager.healthCheck();
    Object.assign(components, aggregationHealth);
    
    // Check correlation manager
    components.correlation = correlationManager.getCurrentContext() !== undefined || true;
    
    // Get metrics
    details.metrics = metricsCollector.getMetrics();
    details.timestamp = new Date().toISOString();
    
    const healthyCount = Object.values(components).filter(Boolean).length;
    const totalCount = Object.keys(components).length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount === totalCount) {
      status = 'healthy';
    } else if (healthyCount > totalCount * 0.5) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }
    
    return { status, components, details };
  } catch (error) {
    return {
      status: 'unhealthy',
      components,
      details: {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
    };
  }
};

// Export metrics collector and sampler
export { LogSampler, metricsCollector, globalSampler };

// Export the main logger
export default logger;