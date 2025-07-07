// Simple logger for production compatibility with Edge Runtime
const isDevelopment = process.env.NODE_ENV === 'development';

// Fallback console logger for production/Edge Runtime
const createSimpleLogger = () => {
  const log = (level: string, message: string, meta?: any) => {
    const timestamp = new Date().toISOString();
    const metaString = meta ? JSON.stringify(meta) : '';
    console.log(`${timestamp} [${level.toUpperCase()}]: ${message} ${metaString}`);
  };

  return {
    error: (message: string, meta?: any) => log('error', message, meta),
    warn: (message: string, meta?: any) => log('warn', message, meta),
    info: (message: string, meta?: any) => log('info', message, meta),
    debug: (message: string, meta?: any) => {
      if (isDevelopment) log('debug', message, meta);
    },
    http: (message: string, meta?: any) => log('http', message, meta),
  };
};

// Create Winston logger only in development and server-side
const createWinstonLogger = () => {
  if (!isDevelopment || typeof window !== 'undefined') {
    return null;
  }

  try {
    const winston = require('winston');
    const { combine, timestamp, errors, json, printf, colorize } = winston.format;
    
    // Custom log format for console output
    const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }: any) => {
      const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
      return `${timestamp} [${level}]: ${message} ${stack || ''} ${metaString}`;
    });

    const logLevel = process.env.LOG_LEVEL || 'debug';
    
    return winston.createLogger({
      level: logLevel,
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        json()
      ),
      transports: [
        new winston.transports.Console({
          format: combine(
            colorize({ all: true }),
            timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            errors({ stack: true }),
            consoleFormat
          ),
          level: logLevel,
        }),
      ],
    });
  } catch (error) {
    console.warn('Winston not available, using simple logger');
    return null;
  }
};

// Create the appropriate logger
const winstonLogger = createWinstonLogger();
const logger = winstonLogger || createSimpleLogger();

// Request logging middleware
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  const { method, url, headers } = req;
  
  logger.http(`${method} ${url}`, {
    userAgent: headers['user-agent'],
    ip: headers['x-forwarded-for'] || req.connection.remoteAddress,
  });

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    
    logger.http(`${method} ${url} ${statusCode}`, {
      duration: `${duration}ms`,
      statusCode,
    });
  });

  if (next) next();
};

// Error logging helper
export const logError = (error: Error, context?: string) => {
  logger.error(`${context ? `[${context}] ` : ''}${error.message}`, {
    stack: error.stack,
    name: error.name,
    context,
  });
};

// Performance logging helper
export const logPerformance = (operation: string, duration: number, metadata?: any) => {
  logger.info(`Performance: ${operation}`, {
    duration: `${duration}ms`,
    ...metadata,
  });
};

// Export specific loggers for different contexts
export const performanceLogger = logger;
export const securityLogger = logger;

// Export utility functions as loggerUtils
export const loggerUtils = {
  logPerformanceMetric: (operation: string, value: number, unit: string, metadata?: any) => {
    logger.info(`Performance metric: ${operation}`, {
      value,
      unit,
      ...metadata,
    });
  },
};

export default logger;
