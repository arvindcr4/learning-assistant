// Edge Runtime compatible logger
const isDevelopment = process.env.NODE_ENV === 'development';

// Simple console logger that works everywhere
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

// Use simple logger for Edge Runtime compatibility
const logger = createSimpleLogger();

// Request logging middleware
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  const { method, url, headers } = req;
  
  logger.http(`${method} ${url}`, {
    userAgent: headers['user-agent'],
    ip: headers['x-forwarded-for'] || req.connection?.remoteAddress,
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

// Health check function for monitoring
export const loggerHealthCheck = (): boolean => {
  try {
    logger.info('Logger health check');
    return true;
  } catch (error) {
    console.error('Logger health check failed:', error);
    return false;
  }
};

export default logger;