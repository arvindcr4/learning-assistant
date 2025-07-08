/**
 * Request Logging Middleware
 * 
 * Comprehensive request/response logging with:
 * - Request/response tracking
 * - Performance monitoring
 * - Error tracking
 * - Security monitoring
 * - Compliance logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { correlationManager } from '../../correlation';
import { logger } from '../core/logger';
import { LogContext, RequestLogContext } from '../types';
import { formatUtils } from '../utils/formatters';

// Request logging configuration
interface RequestLoggingConfig {
  enabled: boolean;
  includeRequestBody: boolean;
  includeResponseBody: boolean;
  includeHeaders: boolean;
  maxBodySize: number; // bytes
  sensitiveHeaders: string[];
  ignorePaths: string[];
  logLevel: 'info' | 'debug';
  enablePerformanceMetrics: boolean;
  enableSecurityLogging: boolean;
}

// Default configuration
const defaultConfig: RequestLoggingConfig = {
  enabled: true,
  includeRequestBody: process.env.NODE_ENV === 'development',
  includeResponseBody: false,
  includeHeaders: true,
  maxBodySize: 10240, // 10KB
  sensitiveHeaders: [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
    'x-access-token',
    'x-refresh-token'
  ],
  ignorePaths: [
    '/health',
    '/metrics',
    '/favicon.ico',
    '/_next',
    '/_vercel',
    '/api/health'
  ],
  logLevel: 'info',
  enablePerformanceMetrics: true,
  enableSecurityLogging: true
};

/**
 * Request logging middleware class
 */
export class RequestLoggingMiddleware {
  private config: RequestLoggingConfig;

  constructor(config: Partial<RequestLoggingConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Express/Node.js middleware
   */
  middleware = (req: any, res: any, next: any) => {
    if (!this.config.enabled || this.shouldIgnorePath(req.url)) {
      return next();
    }

    const startTime = Date.now();
    const correlationId = req.correlationId || correlationManager.generateCorrelationId();
    
    // Set correlation ID if not already set
    if (!req.correlationId) {
      req.correlationId = correlationId;
      correlationManager.setCorrelationId(correlationId);
    }

    // Create request context
    const requestContext = this.createRequestContext(req);

    // Log request start
    this.logRequestStart(requestContext);

    // Capture original response methods
    const originalSend = res.send;
    const originalJson = res.json;
    const originalEnd = res.end;

    let responseBody: any = null;

    // Override response methods to capture response data
    res.send = function(body: any) {
      responseBody = body;
      return originalSend.call(this, body);
    };

    res.json = function(body: any) {
      responseBody = body;
      return originalJson.call(this, body);
    };

    res.end = function(chunk: any, encoding?: any) {
      if (chunk && !responseBody) {
        responseBody = chunk;
      }
      return originalEnd.call(this, chunk, encoding);
    };

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const responseContext = this.createResponseContext(req, res, duration, responseBody);
      this.logRequestEnd(responseContext);
    });

    // Log errors
    res.on('error', (error: Error) => {
      const duration = Date.now() - startTime;
      this.logRequestError(error, requestContext, duration);
    });

    next();
  };

  /**
   * Next.js middleware
   */
  nextMiddleware = async (request: NextRequest): Promise<NextResponse> => {
    if (!this.config.enabled || this.shouldIgnorePath(request.nextUrl.pathname)) {
      return NextResponse.next();
    }

    const startTime = Date.now();
    const correlationId = request.headers.get('x-correlation-id') || correlationManager.generateCorrelationId();
    
    correlationManager.setCorrelationId(correlationId);

    // Create request context
    const requestContext = this.createNextRequestContext(request);

    // Log request start
    this.logRequestStart(requestContext);

    try {
      // Continue to the next middleware/handler
      const response = NextResponse.next();
      
      // Add correlation ID to response
      response.headers.set('x-correlation-id', correlationId);

      // Log response
      const duration = Date.now() - startTime;
      const responseContext = this.createNextResponseContext(request, response, duration);
      this.logRequestEnd(responseContext);

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logRequestError(error as Error, requestContext, duration);
      throw error;
    } finally {
      correlationManager.clearCorrelationId();
    }
  };

  /**
   * Create request context from Express request
   */
  private createRequestContext(req: any): RequestLogContext {
    const context: RequestLogContext = {
      correlationId: req.correlationId,
      method: req.method,
      url: req.url,
      route: req.route?.path,
      ip: this.getClientIp(req),
      userAgent: req.headers['user-agent'],
      userId: req.user?.id || req.userId,
      sessionId: req.sessionId,
      category: 'http',
      operation: 'request',
      timestamp: new Date().toISOString()
    };

    // Add request size
    const contentLength = req.headers['content-length'];
    if (contentLength) {
      context.requestSize = parseInt(contentLength);
    }

    // Add headers if enabled
    if (this.config.includeHeaders) {
      context.headers = this.sanitizeHeaders(req.headers);
    }

    // Add query parameters
    if (req.query && Object.keys(req.query).length > 0) {
      context.query = req.query;
    }

    // Add route parameters
    if (req.params && Object.keys(req.params).length > 0) {
      context.params = req.params;
    }

    // Add request body if enabled and within size limit
    if (this.config.includeRequestBody && req.body) {
      const bodySize = JSON.stringify(req.body).length;
      if (bodySize <= this.config.maxBodySize) {
        context.body = req.body;
      } else {
        context.body = `[Body too large: ${formatUtils.formatBytes(bodySize)}]`;
      }
    }

    return context;
  }

  /**
   * Create request context from Next.js request
   */
  private createNextRequestContext(request: NextRequest): RequestLogContext {
    const url = request.nextUrl;
    
    const context: RequestLogContext = {
      correlationId: request.headers.get('x-correlation-id') || undefined,
      method: request.method,
      url: url.pathname + url.search,
      ip: this.getNextClientIp(request),
      userAgent: request.headers.get('user-agent') || undefined,
      category: 'http',
      operation: 'request',
      timestamp: new Date().toISOString()
    };

    // Add headers if enabled
    if (this.config.includeHeaders) {
      const headers: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        headers[key] = value;
      });
      context.headers = this.sanitizeHeaders(headers);
    }

    // Add query parameters
    if (url.searchParams.size > 0) {
      const query: Record<string, string> = {};
      url.searchParams.forEach((value, key) => {
        query[key] = value;
      });
      context.query = query;
    }

    return context;
  }

  /**
   * Create response context
   */
  private createResponseContext(req: any, res: any, duration: number, responseBody?: any): RequestLogContext {
    const context: RequestLogContext = {
      correlationId: req.correlationId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      responseTime: formatUtils.formatDuration(duration),
      category: 'http',
      operation: 'response',
      timestamp: new Date().toISOString()
    };

    // Add response size
    const responseSize = res.get('content-length');
    if (responseSize) {
      context.responseSize = parseInt(responseSize);
    } else if (responseBody) {
      context.responseSize = JSON.stringify(responseBody).length;
    }

    // Add response body if enabled and within size limit
    if (this.config.includeResponseBody && responseBody) {
      const bodySize = JSON.stringify(responseBody).length;
      if (bodySize <= this.config.maxBodySize) {
        context.body = responseBody;
      } else {
        context.body = `[Response too large: ${formatUtils.formatBytes(bodySize)}]`;
      }
    }

    return context;
  }

  /**
   * Create Next.js response context
   */
  private createNextResponseContext(request: NextRequest, response: NextResponse, duration: number): RequestLogContext {
    const context: RequestLogContext = {
      correlationId: request.headers.get('x-correlation-id') || undefined,
      method: request.method,
      url: request.nextUrl.pathname + request.nextUrl.search,
      statusCode: response.status,
      duration,
      responseTime: formatUtils.formatDuration(duration),
      category: 'http',
      operation: 'response',
      timestamp: new Date().toISOString()
    };

    return context;
  }

  /**
   * Log request start
   */
  private logRequestStart(context: RequestLogContext): void {
    const message = `${context.method} ${context.url} - Started`;
    
    if (this.config.logLevel === 'debug') {
      logger.debug(message, context);
    } else {
      logger.info(message, context);
    }

    // Security logging for suspicious requests
    if (this.config.enableSecurityLogging) {
      this.checkForSuspiciousActivity(context);
    }
  }

  /**
   * Log request end
   */
  private logRequestEnd(context: RequestLogContext): void {
    const { statusCode, duration, method, url } = context;
    const message = `${method} ${url} - ${statusCode} (${formatUtils.formatDuration(duration || 0)})`;

    // Determine log level based on status code and duration
    if (statusCode && statusCode >= 500) {
      logger.error(message, context);
    } else if (statusCode && statusCode >= 400) {
      logger.warn(message, context);
    } else if (duration && duration > 5000) {
      logger.warn(`Slow request: ${message}`, { ...context, slowRequest: true });
    } else {
      logger.info(message, context);
    }

    // Performance metrics
    if (this.config.enablePerformanceMetrics && duration) {
      this.logPerformanceMetrics(context);
    }
  }

  /**
   * Log request error
   */
  private logRequestError(error: Error, context: RequestLogContext, duration: number): void {
    const message = `${context.method} ${context.url} - Error: ${error.message}`;
    
    logger.error(message, {
      ...context,
      error: error.message,
      stack: error.stack,
      duration,
      category: 'error'
    });
  }

  /**
   * Log performance metrics
   */
  private logPerformanceMetrics(context: RequestLogContext): void {
    const { method, url, duration, statusCode } = context;
    
    logger.logPerformance(`HTTP ${method} ${url}`, duration || 0, {
      ...context,
      performanceCategory: 'http-request',
      success: statusCode ? statusCode < 400 : false
    });
  }

  /**
   * Check for suspicious activity
   */
  private checkForSuspiciousActivity(context: RequestLogContext): void {
    const { method, url, userAgent, ip } = context;

    // Check for common attack patterns
    if (url) {
      // SQL injection patterns
      if (/(\bunion\b|\bselect\b|\binsert\b|\bdelete\b|\bdrop\b|\bupdate\b)/i.test(url)) {
        logger.logSecurity('Potential SQL injection attempt detected', {
          ...context,
          securityEventType: 'sql_injection_attempt',
          severity: 'high'
        });
      }

      // XSS patterns
      if (/<script|javascript:|onload=|onerror=/i.test(url)) {
        logger.logSecurity('Potential XSS attempt detected', {
          ...context,
          securityEventType: 'xss_attempt',
          severity: 'high'
        });
      }

      // Path traversal patterns
      if (/\.\.\/|\.\.\\|%2e%2e/i.test(url)) {
        logger.logSecurity('Potential path traversal attempt detected', {
          ...context,
          securityEventType: 'path_traversal_attempt',
          severity: 'medium'
        });
      }
    }

    // Check for suspicious user agents
    if (userAgent) {
      const suspiciousAgents = ['sqlmap', 'nikto', 'nmap', 'masscan', 'zap'];
      if (suspiciousAgents.some(agent => userAgent.toLowerCase().includes(agent))) {
        logger.logSecurity('Suspicious user agent detected', {
          ...context,
          securityEventType: 'suspicious_user_agent',
          severity: 'medium'
        });
      }
    }

    // Check for unusual request methods
    if (method && !['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(method)) {
      logger.logSecurity('Unusual HTTP method detected', {
        ...context,
        securityEventType: 'unusual_http_method',
        severity: 'low'
      });
    }
  }

  /**
   * Get client IP address
   */
  private getClientIp(req: any): string {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           'unknown';
  }

  /**
   * Get client IP from Next.js request
   */
  private getNextClientIp(request: NextRequest): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
           request.headers.get('x-real-ip') ||
           'unknown';
  }

  /**
   * Sanitize headers by removing sensitive information
   */
  private sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(headers)) {
      if (this.config.sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * Check if path should be ignored
   */
  private shouldIgnorePath(path: string): boolean {
    return this.config.ignorePaths.some(ignorePath => path.startsWith(ignorePath));
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RequestLoggingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): RequestLoggingConfig {
    return { ...this.config };
  }
}

// Create default instance
export const requestLoggingMiddleware = new RequestLoggingMiddleware();

// Export factory function
export function createRequestLoggingMiddleware(config: Partial<RequestLoggingConfig> = {}): RequestLoggingMiddleware {
  return new RequestLoggingMiddleware(config);
}

// Export middleware functions
export const expressRequestLogger = requestLoggingMiddleware.middleware;
export const nextRequestLogger = requestLoggingMiddleware.nextMiddleware;