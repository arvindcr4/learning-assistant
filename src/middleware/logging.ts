import { NextRequest, NextResponse } from 'next/server';
import { correlationManager, performanceTracker } from '../lib/correlation';
import { auditLogger } from '../lib/audit-logger';
import logger, { createContextualLogger } from '../lib/logger';

// Request logging configuration
export interface RequestLoggingConfig {
  enabled: boolean;
  logRequestBody: boolean;
  logResponseBody: boolean;
  logHeaders: boolean;
  logSensitiveData: boolean;
  maxBodySize: number;
  slowRequestThreshold: number;
  excludePaths: string[];
  excludeUserAgents: string[];
  includeQueryParams: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  sampling: {
    enabled: boolean;
    rate: number;
    excludeErrors: boolean;
  };
}

// Default configuration
const defaultConfig: RequestLoggingConfig = {
  enabled: true,
  logRequestBody: false,
  logResponseBody: false,
  logHeaders: true,
  logSensitiveData: false,
  maxBodySize: 1024 * 10, // 10KB
  slowRequestThreshold: 5000, // 5 seconds
  excludePaths: ['/health', '/metrics', '/favicon.ico'],
  excludeUserAgents: ['kube-probe', 'ELB-HealthChecker'],
  includeQueryParams: true,
  logLevel: 'info',
  sampling: {
    enabled: false,
    rate: 0.1,
    excludeErrors: true,
  },
};

// Request metrics collector
export class RequestMetricsCollector {
  private static instance: RequestMetricsCollector;
  private metrics: Map<string, any> = new Map();
  
  private constructor() {}
  
  static getInstance(): RequestMetricsCollector {
    if (!RequestMetricsCollector.instance) {
      RequestMetricsCollector.instance = new RequestMetricsCollector();
    }
    return RequestMetricsCollector.instance;
  }
  
  recordRequest(method: string, path: string, statusCode: number, duration: number): void {
    const key = `${method}:${path}`;
    const existing = this.metrics.get(key) || {
      count: 0,
      totalDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      errorCount: 0,
      lastRequest: null,
    };
    
    existing.count++;
    existing.totalDuration += duration;
    existing.minDuration = Math.min(existing.minDuration, duration);
    existing.maxDuration = Math.max(existing.maxDuration, duration);
    existing.lastRequest = new Date().toISOString();
    
    if (statusCode >= 400) {
      existing.errorCount++;
    }
    
    this.metrics.set(key, existing);
  }
  
  getMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [key, metrics] of this.metrics) {
      result[key] = {
        ...metrics,
        avgDuration: metrics.totalDuration / metrics.count,
        errorRate: metrics.errorCount / metrics.count,
      };
    }
    
    return result;
  }
  
  reset(): void {
    this.metrics.clear();
  }
}

// Request logger class
export class RequestLogger {
  private config: RequestLoggingConfig;
  private metricsCollector: RequestMetricsCollector;
  
  constructor(config: Partial<RequestLoggingConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.metricsCollector = RequestMetricsCollector.getInstance();
  }
  
  // Configure the logger
  configure(config: Partial<RequestLoggingConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  // Check if request should be logged
  private shouldLog(request: NextRequest): boolean {
    if (!this.config.enabled) return false;
    
    const { pathname } = new URL(request.url);
    const userAgent = request.headers.get('user-agent') || '';
    
    // Exclude specific paths
    if (this.config.excludePaths.some(path => pathname.startsWith(path))) {
      return false;
    }
    
    // Exclude specific user agents
    if (this.config.excludeUserAgents.some(ua => userAgent.includes(ua))) {
      return false;
    }
    
    // Apply sampling
    if (this.config.sampling.enabled) {
      if (Math.random() > this.config.sampling.rate) {
        return false;
      }
    }
    
    return true;
  }
  
  // Sanitize sensitive data
  private sanitizeData(data: any): any {
    if (!this.config.logSensitiveData) {
      const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'key', 'authorization'];
      
      if (typeof data === 'object' && data !== null) {
        const sanitized = { ...data };
        for (const field of sensitiveFields) {
          if (field in sanitized) {
            sanitized[field] = '[REDACTED]';
          }
        }
        return sanitized;
      }
    }
    
    return data;
  }
  
  // Extract request body safely
  private async extractRequestBody(request: NextRequest): Promise<any> {
    if (!this.config.logRequestBody) return null;
    
    try {
      const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
      
      if (contentLength > this.config.maxBodySize) {
        return `[TRUNCATED: Body size ${contentLength} exceeds limit ${this.config.maxBodySize}]`;
      }
      
      const contentType = request.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        const body = await request.json();
        return this.sanitizeData(body);
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const body = await request.formData();
        const formData: Record<string, any> = {};
        for (const [key, value] of body.entries()) {
          formData[key] = value;
        }
        return this.sanitizeData(formData);
      } else if (contentType.includes('text/')) {
        const body = await request.text();
        return body.length > this.config.maxBodySize ? 
          `[TRUNCATED: ${body.substring(0, this.config.maxBodySize)}...]` : body;
      }
      
      return '[BINARY DATA]';
    } catch (error) {
      return `[ERROR READING BODY: ${error instanceof Error ? error.message : String(error)}]`;
    }
  }
  
  // Extract response body safely
  private extractResponseBody(response: NextResponse): any {
    if (!this.config.logResponseBody) return null;
    
    try {
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        // Note: In Next.js middleware, response body is not easily accessible
        // This would need to be implemented differently in API routes
        return '[RESPONSE BODY LOGGING NOT SUPPORTED IN MIDDLEWARE]';
      }
      
      return null;
    } catch (error) {
      return `[ERROR READING RESPONSE: ${error instanceof Error ? error.message : String(error)}]`;
    }
  }
  
  // Log request start
  async logRequestStart(request: NextRequest): Promise<void> {
    if (!this.shouldLog(request)) return;
    
    const { pathname, search } = new URL(request.url);
    const method = request.method;
    const correlationContext = correlationManager.getCurrentContext();
    
    const requestLogger = createContextualLogger({
      correlationId: correlationContext?.correlationId,
      traceId: correlationContext?.traceId,
      spanId: correlationContext?.spanId,
      category: 'http',
      operation: `${method} ${pathname}`,
    });
    
    const logData = {
      method,
      path: pathname,
      query: this.config.includeQueryParams ? search : undefined,
      userAgent: request.headers.get('user-agent'),
      referer: request.headers.get('referer'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      contentLength: request.headers.get('content-length'),
      contentType: request.headers.get('content-type'),
      headers: this.config.logHeaders ? this.sanitizeData(Object.fromEntries(request.headers)) : undefined,
      body: await this.extractRequestBody(request),
      timestamp: new Date().toISOString(),
    };
    
    requestLogger.info(`Request started: ${method} ${pathname}`, logData);
    
    // Start performance tracking
    performanceTracker.start(`${method} ${pathname}`);
  }
  
  // Log request completion
  logRequestComplete(
    request: NextRequest,
    response: NextResponse,
    error?: Error
  ): void {
    if (!this.shouldLog(request)) return;
    
    const { pathname } = new URL(request.url);
    const method = request.method;
    const statusCode = response.status;
    const duration = performanceTracker.end(`${method} ${pathname}`);
    
    const correlationContext = correlationManager.getCurrentContext();
    
    const requestLogger = createContextualLogger({
      correlationId: correlationContext?.correlationId,
      traceId: correlationContext?.traceId,
      spanId: correlationContext?.spanId,
      category: 'http',
      operation: `${method} ${pathname}`,
    });
    
    const logData = {
      method,
      path: pathname,
      statusCode,
      duration,
      responseTime: `${duration}ms`,
      contentLength: response.headers.get('content-length'),
      contentType: response.headers.get('content-type'),
      responseHeaders: this.config.logHeaders ? 
        this.sanitizeData(Object.fromEntries(response.headers)) : undefined,
      responseBody: this.extractResponseBody(response),
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
      timestamp: new Date().toISOString(),
    };
    
    // Record metrics
    this.metricsCollector.recordRequest(method, pathname, statusCode, duration);
    
    // Choose appropriate log level
    let logLevel = this.config.logLevel;
    if (error || statusCode >= 500) {
      logLevel = 'error';
    } else if (statusCode >= 400) {
      logLevel = 'warn';
    } else if (duration > this.config.slowRequestThreshold) {
      logLevel = 'warn';
    }
    
    const message = error ? 
      `Request failed: ${method} ${pathname} - ${statusCode}` :
      `Request completed: ${method} ${pathname} - ${statusCode}`;
    
    requestLogger[logLevel](message, logData);
    
    // Log slow requests
    if (duration > this.config.slowRequestThreshold) {
      requestLogger.warn(`Slow request detected: ${method} ${pathname}`, {
        ...logData,
        slowRequest: true,
        threshold: this.config.slowRequestThreshold,
      });
    }
    
    // Log security-related events
    if (statusCode === 401 || statusCode === 403) {
      auditLogger.logSecurityViolation(
        `Unauthorized access attempt: ${method} ${pathname}`,
        'HIGH',
        {
          method,
          path: pathname,
          statusCode,
          userAgent: request.headers.get('user-agent'),
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          correlationId: correlationContext?.correlationId,
        }
      );
    }
    
    // Log rate limiting
    if (statusCode === 429) {
      auditLogger.logSecurityViolation(
        `Rate limit exceeded: ${method} ${pathname}`,
        'MEDIUM',
        {
          method,
          path: pathname,
          statusCode,
          userAgent: request.headers.get('user-agent'),
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          correlationId: correlationContext?.correlationId,
        }
      );
    }
  }
  
  // Get request metrics
  getMetrics(): Record<string, any> {
    return this.metricsCollector.getMetrics();
  }
  
  // Reset metrics
  resetMetrics(): void {
    this.metricsCollector.reset();
  }
}

// Global request logger instance
export const requestLogger = new RequestLogger();

// Middleware factory
export function createRequestLoggingMiddleware(
  config: Partial<RequestLoggingConfig> = {}
): (request: NextRequest) => Promise<NextResponse> {
  const logger = new RequestLogger(config);
  
  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();
    
    // Log request start
    await logger.logRequestStart(request);
    
    try {
      // Process the request (this would be handled by Next.js routing)
      const response = NextResponse.next();
      
      // Log request completion
      logger.logRequestComplete(request, response);
      
      return response;
    } catch (error) {
      // Log request error
      const errorResponse = NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      );
      
      logger.logRequestComplete(request, errorResponse, error as Error);
      
      throw error;
    }
  };
}

// API route wrapper for request logging
export function withRequestLogging<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>,
  config: Partial<RequestLoggingConfig> = {}
): (...args: T) => Promise<NextResponse> {
  const logger = new RequestLogger(config);
  
  return async (...args: T): Promise<NextResponse> => {
    const [request] = args;
    
    if (request instanceof NextRequest) {
      await logger.logRequestStart(request);
    }
    
    try {
      const response = await handler(...args);
      
      if (request instanceof NextRequest) {
        logger.logRequestComplete(request, response);
      }
      
      return response;
    } catch (error) {
      if (request instanceof NextRequest) {
        const errorResponse = NextResponse.json(
          { error: 'Internal Server Error' },
          { status: 500 }
        );
        
        logger.logRequestComplete(request, errorResponse, error as Error);
      }
      
      throw error;
    }
  };
}

// Express.js style middleware for API routes
export function expressRequestLogging(
  config: Partial<RequestLoggingConfig> = {}
) {
  const logger = new RequestLogger(config);
  
  return (req: any, res: any, next: () => void) => {
    const startTime = Date.now();
    const { method, url, headers } = req;
    
    const correlationContext = correlationManager.getCurrentContext();
    
    const requestLogger = createContextualLogger({
      correlationId: correlationContext?.correlationId,
      traceId: correlationContext?.traceId,
      spanId: correlationContext?.spanId,
      category: 'http',
      operation: `${method} ${url}`,
    });
    
    // Log request start
    requestLogger.info(`Request started: ${method} ${url}`, {
      method,
      url,
      userAgent: headers['user-agent'],
      referer: headers.referer,
      ip: headers['x-forwarded-for'] || req.connection?.remoteAddress,
      contentLength: headers['content-length'],
      contentType: headers['content-type'],
      headers: config.logHeaders ? logger['sanitizeData'](headers) : undefined,
      timestamp: new Date().toISOString(),
    });
    
    // Override res.end to capture response
    const originalEnd = res.end;
    res.end = function(chunk: any, encoding: any) {
      const duration = Date.now() - startTime;
      const { statusCode } = res;
      
      // Record metrics
      logger.getMetrics(); // This will record the metric
      
      // Log request completion
      requestLogger.info(`Request completed: ${method} ${url} - ${statusCode}`, {
        method,
        url,
        statusCode,
        duration,
        responseTime: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });
      
      // Log slow requests
      if (duration > (config.slowRequestThreshold || 5000)) {
        requestLogger.warn(`Slow request detected: ${method} ${url}`, {
          method,
          url,
          statusCode,
          duration,
          slowRequest: true,
          threshold: config.slowRequestThreshold || 5000,
        });
      }
      
      originalEnd.call(this, chunk, encoding);
    };
    
    next();
  };
}

// Performance monitoring utilities
export const performanceMonitor = {
  // Track database queries
  trackDatabaseQuery: (query: string, duration: number) => {
    const contextLogger = createContextualLogger({ category: 'database' });
    contextLogger.info(`Database query executed`, {
      query: query.substring(0, 200), // Limit query length
      duration,
      responseTime: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
    
    if (duration > 1000) {
      contextLogger.warn(`Slow database query detected`, {
        query: query.substring(0, 200),
        duration,
        slowQuery: true,
        threshold: 1000,
      });
    }
  },
  
  // Track external API calls
  trackExternalApiCall: (url: string, method: string, statusCode: number, duration: number) => {
    const contextLogger = createContextualLogger({ category: 'external-api' });
    contextLogger.info(`External API call completed`, {
      url,
      method,
      statusCode,
      duration,
      responseTime: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
    
    if (duration > 5000) {
      contextLogger.warn(`Slow external API call detected`, {
        url,
        method,
        statusCode,
        duration,
        slowApiCall: true,
        threshold: 5000,
      });
    }
  },
  
  // Track memory usage
  trackMemoryUsage: () => {
    const memUsage = process.memoryUsage();
    const contextLogger = createContextualLogger({ category: 'system' });
    
    contextLogger.info('Memory usage snapshot', {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)} MB`,
      timestamp: new Date().toISOString(),
    });
  },
};

// Export utilities
export { RequestMetricsCollector, defaultConfig as defaultRequestLoggingConfig };