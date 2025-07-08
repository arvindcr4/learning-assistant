import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { trackApiError, setUserContext, setSentryContext } from '@/lib/sentry';

// Enhanced error interface for API routes
interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: Record<string, any>;
  userId?: string;
  endpoint?: string;
  method?: string;
  timestamp?: number;
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Error categories for better organization
export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  DATABASE = 'database',
  EXTERNAL_API = 'external_api',
  RATE_LIMITING = 'rate_limiting',
  SYSTEM = 'system',
  USER_INPUT = 'user_input',
  BUSINESS_LOGIC = 'business_logic'
}

// Enhanced error context
interface ErrorContext {
  endpoint: string;
  method: string;
  userId?: string;
  userAgent?: string;
  ip?: string;
  timestamp: number;
  requestId?: string;
  sessionId?: string;
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  metadata?: Record<string, any>;
}

/**
 * Enhanced API error handler with Sentry integration
 */
export class SentryApiErrorHandler {
  private static instance: SentryApiErrorHandler;
  private errorCounts: Map<string, number> = new Map();
  private rateLimitWindow = 60000; // 1 minute
  private maxErrorsPerWindow = 10;

  static getInstance(): SentryApiErrorHandler {
    if (!SentryApiErrorHandler.instance) {
      SentryApiErrorHandler.instance = new SentryApiErrorHandler();
    }
    return SentryApiErrorHandler.instance;
  }

  /**
   * Handle API errors with enhanced context and Sentry reporting
   */
  handleError(
    error: ApiError,
    request: NextRequest,
    context: Partial<ErrorContext> = {}
  ): NextResponse {
    const errorContext: ErrorContext = {
      endpoint: request.nextUrl.pathname,
      method: request.method,
      userId: context.userId,
      userAgent: request.headers.get('user-agent') || undefined,
      ip: this.getClientIp(request),
      timestamp: Date.now(),
      requestId: context.requestId || this.generateRequestId(),
      sessionId: context.sessionId,
      category: context.category || this.categorizeError(error),
      severity: context.severity || this.determineSeverity(error),
      metadata: context.metadata,
    };

    // Check rate limiting for error reporting
    if (this.isRateLimited(errorContext)) {
      return this.createErrorResponse(error, errorContext, true);
    }

    // Set user context for Sentry
    if (errorContext.userId) {
      setUserContext({
        id: errorContext.userId,
        username: errorContext.userId, // Use userId as username for tracking
      });
    }

    // Set additional context
    setSentryContext('api_error', {
      endpoint: errorContext.endpoint,
      method: errorContext.method,
      requestId: errorContext.requestId,
      category: errorContext.category,
      severity: errorContext.severity,
      timestamp: errorContext.timestamp,
    });

    // Report to Sentry with enhanced context
    Sentry.withScope((scope) => {
      scope.setTag('error.category', errorContext.category);
      scope.setTag('error.severity', errorContext.severity);
      scope.setTag('api.endpoint', errorContext.endpoint);
      scope.setTag('api.method', errorContext.method);
      scope.setLevel(this.mapSeverityToSentryLevel(errorContext.severity || ErrorSeverity.MEDIUM));
      
      scope.setContext('request', {
        url: request.url,
        method: request.method,
        headers: this.sanitizeHeaders(request.headers),
        ip: errorContext.ip,
        userAgent: errorContext.userAgent,
      });

      scope.setContext('error_context', errorContext as any);
      
      if (errorContext.metadata) {
        scope.setContext('metadata', errorContext.metadata);
      }

      // Use the enhanced trackApiError function
      trackApiError(errorContext.endpoint, error);
    });

    // Log error details in development
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', {
        error: {
          message: error.message,
          stack: error.stack,
          code: error.code,
          statusCode: error.statusCode,
        },
        context: errorContext,
      });
    }

    return this.createErrorResponse(error, errorContext);
  }

  /**
   * Middleware wrapper for API routes
   */
  withErrorHandler(handler: (request: NextRequest) => Promise<NextResponse>) {
    return async (request: NextRequest): Promise<NextResponse> => {
      try {
        return await handler(request);
      } catch (error) {
        const apiError = error as ApiError;
        return this.handleError(apiError, request);
      }
    };
  }

  /**
   * Higher-order function for wrapping API route handlers
   */
  wrapApiHandler(handler: (request: NextRequest) => Promise<NextResponse>) {
    return this.withErrorHandler(handler);
  }

  private categorizeError(error: ApiError): ErrorCategory {
    const message = error.message.toLowerCase();
    const code = error.code?.toLowerCase();
    
    if (message.includes('unauthorized') || message.includes('authentication')) {
      return ErrorCategory.AUTHENTICATION;
    }
    if (message.includes('forbidden') || message.includes('permission')) {
      return ErrorCategory.AUTHORIZATION;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorCategory.VALIDATION;
    }
    if (message.includes('database') || message.includes('query')) {
      return ErrorCategory.DATABASE;
    }
    if (message.includes('rate limit') || code === 'rate_limit_exceeded') {
      return ErrorCategory.RATE_LIMITING;
    }
    if (message.includes('external') || message.includes('api')) {
      return ErrorCategory.EXTERNAL_API;
    }
    if (message.includes('timeout') || message.includes('connection')) {
      return ErrorCategory.SYSTEM;
    }
    
    return ErrorCategory.BUSINESS_LOGIC;
  }

  private determineSeverity(error: ApiError): ErrorSeverity {
    const statusCode = error.statusCode || 500;
    const message = error.message.toLowerCase();
    
    if (statusCode >= 500) {
      return ErrorSeverity.CRITICAL;
    }
    if (statusCode >= 400) {
      if (message.includes('security') || message.includes('attack')) {
        return ErrorSeverity.HIGH;
      }
      return ErrorSeverity.MEDIUM;
    }
    
    return ErrorSeverity.LOW;
  }

  private mapSeverityToSentryLevel(severity: ErrorSeverity): Sentry.SeverityLevel {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 'fatal';
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warning';
      case ErrorSeverity.LOW:
        return 'info';
      default:
        return 'error';
    }
  }

  private isRateLimited(context: ErrorContext): boolean {
    const key = `${context.endpoint}:${context.ip}`;
    const now = Date.now();
    const count = this.errorCounts.get(key) || 0;
    
    // Clean up old entries
    this.cleanupErrorCounts();
    
    if (count >= this.maxErrorsPerWindow) {
      return true;
    }
    
    this.errorCounts.set(key, count + 1);
    return false;
  }

  private cleanupErrorCounts(): void {
    const now = Date.now();
    const cutoff = now - this.rateLimitWindow;
    
    for (const [key, timestamp] of this.errorCounts.entries()) {
      if (timestamp < cutoff) {
        this.errorCounts.delete(key);
      }
    }
  }

  private getClientIp(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    if (realIp) {
      return realIp;
    }
    
    // For Next.js apps, try to get IP from request.ip
    const reqWithIp = request as any;
    if (reqWithIp.ip) {
      return reqWithIp.ip;
    }
    
    return 'unknown';
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeHeaders(headers: Headers): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    
    headers.forEach((value, key) => {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[FILTERED]';
      } else {
        sanitized[key] = value;
      }
    });
    
    return sanitized;
  }

  private createErrorResponse(
    error: ApiError,
    context: ErrorContext,
    isRateLimited: boolean = false
  ): NextResponse {
    const statusCode = error.statusCode || 500;
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    const errorResponse = {
      error: {
        message: error.message,
        code: error.code || 'INTERNAL_SERVER_ERROR',
        requestId: context.requestId,
        timestamp: context.timestamp,
      },
      ...(isDevelopment && {
        debug: {
          stack: error.stack,
          context: context,
          details: error.details,
        },
      }),
      ...(isRateLimited && {
        rateLimited: true,
        retryAfter: Math.ceil(this.rateLimitWindow / 1000),
      }),
    };

    const response = NextResponse.json(errorResponse, { status: statusCode });
    
    // Add error tracking headers
    response.headers.set('X-Error-ID', context.requestId || 'unknown');
    response.headers.set('X-Error-Category', context.category || 'unknown');
    response.headers.set('X-Error-Severity', context.severity || 'unknown');
    
    if (isRateLimited) {
      response.headers.set('Retry-After', Math.ceil(this.rateLimitWindow / 1000).toString());
    }

    return response;
  }
}

// Convenience functions for common error types
export const createApiError = (
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: Record<string, any>
): ApiError => {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  error.timestamp = Date.now();
  return error;
};

export const createValidationError = (
  message: string,
  details?: Record<string, any>
): ApiError => {
  return createApiError(message, 400, 'VALIDATION_ERROR', details);
};

export const createAuthenticationError = (
  message: string = 'Authentication required',
  details?: Record<string, any>
): ApiError => {
  return createApiError(message, 401, 'AUTHENTICATION_ERROR', details);
};

export const createAuthorizationError = (
  message: string = 'Access denied',
  details?: Record<string, any>
): ApiError => {
  return createApiError(message, 403, 'AUTHORIZATION_ERROR', details);
};

export const createNotFoundError = (
  message: string = 'Resource not found',
  details?: Record<string, any>
): ApiError => {
  return createApiError(message, 404, 'NOT_FOUND', details);
};

export const createRateLimitError = (
  message: string = 'Rate limit exceeded',
  details?: Record<string, any>
): ApiError => {
  return createApiError(message, 429, 'RATE_LIMIT_EXCEEDED', details);
};

export const createInternalServerError = (
  message: string = 'Internal server error',
  details?: Record<string, any>
): ApiError => {
  return createApiError(message, 500, 'INTERNAL_SERVER_ERROR', details);
};

// Export the singleton instance
export const sentryApiErrorHandler = SentryApiErrorHandler.getInstance();

// Export a simple wrapper function
export const withSentryErrorHandler = (
  handler: (request: NextRequest) => Promise<NextResponse>
) => {
  return sentryApiErrorHandler.wrapApiHandler(handler);
};

// Export types
export type { ApiError, ErrorContext };