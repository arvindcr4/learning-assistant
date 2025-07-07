import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

// ====================
// ERROR TYPES AND INTERFACES
// ====================

export enum ErrorCode {
  // Validation Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  
  // Authentication & Authorization Errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Resource Errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',
  
  // Rate Limiting & Abuse
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  IP_BLOCKED = 'IP_BLOCKED',
  
  // Database Errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  DATABASE_CONNECTION_ERROR = 'DATABASE_CONNECTION_ERROR',
  QUERY_FAILED = 'QUERY_FAILED',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  
  // External Service Errors
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  EMAIL_SERVICE_ERROR = 'EMAIL_SERVICE_ERROR',
  STORAGE_SERVICE_ERROR = 'STORAGE_SERVICE_ERROR',
  
  // System Errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  
  // Business Logic Errors
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  INVALID_OPERATION = 'INVALID_OPERATION',
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
}

export interface ErrorDetails {
  field?: string;
  value?: any;
  constraint?: string;
  expected?: any;
  actual?: any;
  metadata?: Record<string, any>;
}

export interface AppError {
  code: ErrorCode;
  message: string;
  details?: ErrorDetails[];
  statusCode: number;
  timestamp: string;
  requestId?: string;
  userId?: string;
  path?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  stack?: string;
  cause?: Error;
}

export interface ErrorHandlerConfig {
  includeStack?: boolean;
  includeSensitiveInfo?: boolean;
  logErrors?: boolean;
  notifyExternal?: boolean;
  sanitizeErrorMessages?: boolean;
}

// ====================
// ERROR CLASSES
// ====================

export class ValidationError extends Error {
  code = ErrorCode.VALIDATION_ERROR;
  statusCode = 400;
  details: ErrorDetails[];

  constructor(message: string, details: ErrorDetails[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class AuthenticationError extends Error {
  code = ErrorCode.UNAUTHORIZED;
  statusCode = 401;

  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  code = ErrorCode.FORBIDDEN;
  statusCode = 403;

  constructor(message: string = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error {
  code = ErrorCode.NOT_FOUND;
  statusCode = 404;

  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  code = ErrorCode.ALREADY_EXISTS;
  statusCode = 409;

  constructor(message: string = 'Resource already exists') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends Error {
  code = ErrorCode.RATE_LIMIT_EXCEEDED;
  statusCode = 429;
  retryAfter?: number;

  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class DatabaseError extends Error {
  code = ErrorCode.DATABASE_ERROR;
  statusCode = 500;
  originalError?: Error;

  constructor(message: string, originalError?: Error) {
    super(message);
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}

export class ExternalServiceError extends Error {
  code = ErrorCode.EXTERNAL_SERVICE_ERROR;
  statusCode = 502;
  service?: string;

  constructor(message: string, service?: string) {
    super(message);
    this.name = 'ExternalServiceError';
    this.service = service;
  }
}

export class BusinessRuleError extends Error {
  code = ErrorCode.BUSINESS_RULE_VIOLATION;
  statusCode = 422;
  rule?: string;

  constructor(message: string, rule?: string) {
    super(message);
    this.name = 'BusinessRuleError';
    this.rule = rule;
  }
}

// ====================
// ERROR HANDLER CLASS
// ====================

export class ErrorHandler {
  private config: Required<ErrorHandlerConfig>;

  constructor(config: ErrorHandlerConfig = {}) {
    this.config = {
      includeStack: config.includeStack !== false && process.env.NODE_ENV === 'development',
      includeSensitiveInfo: config.includeSensitiveInfo !== false && process.env.NODE_ENV === 'development',
      logErrors: config.logErrors !== false,
      notifyExternal: config.notifyExternal !== false && process.env.NODE_ENV === 'production',
      sanitizeErrorMessages: config.sanitizeErrorMessages !== false,
    };
  }

  /**
   * Handles errors and returns appropriate NextResponse
   */
  handleError(
    error: unknown,
    request?: {
      url?: string;
      method?: string;
      headers?: Headers;
      userId?: string;
      requestId?: string;
    }
  ): NextResponse {
    const appError = this.normalizeError(error, request);

    // Log the error
    if (this.config.logErrors) {
      this.logError(appError);
    }

    // Notify external services if configured
    if (this.config.notifyExternal && appError.statusCode >= 500) {
      this.notifyExternalServices(appError);
    }

    // Create response
    return this.createErrorResponse(appError);
  }

  /**
   * Normalizes any error into AppError format
   */
  private normalizeError(
    error: unknown,
    request?: {
      url?: string;
      method?: string;
      headers?: Headers;
      userId?: string;
      requestId?: string;
    }
  ): AppError {
    const timestamp = new Date().toISOString();
    const baseError: Partial<AppError> = {
      timestamp,
      requestId: request?.requestId,
      userId: request?.userId,
      path: request?.url,
      method: request?.method,
      userAgent: request?.headers?.get('user-agent') || undefined,
      ip: this.getClientIp(request?.headers),
    };

    // Handle known error types
    if (error instanceof ValidationError) {
      return {
        ...baseError,
        code: error.code,
        message: error.message,
        details: error.details,
        statusCode: error.statusCode,
        stack: this.config.includeStack ? error.stack : undefined,
      } as AppError;
    }

    if (error instanceof AuthenticationError) {
      return {
        ...baseError,
        code: error.code,
        message: this.config.sanitizeErrorMessages ? 'Authentication failed' : error.message,
        statusCode: error.statusCode,
        stack: this.config.includeStack ? error.stack : undefined,
      } as AppError;
    }

    if (error instanceof AuthorizationError) {
      return {
        ...baseError,
        code: error.code,
        message: this.config.sanitizeErrorMessages ? 'Access denied' : error.message,
        statusCode: error.statusCode,
        stack: this.config.includeStack ? error.stack : undefined,
      } as AppError;
    }

    if (error instanceof NotFoundError) {
      return {
        ...baseError,
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        stack: this.config.includeStack ? error.stack : undefined,
      } as AppError;
    }

    if (error instanceof ConflictError) {
      return {
        ...baseError,
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        stack: this.config.includeStack ? error.stack : undefined,
      } as AppError;
    }

    if (error instanceof RateLimitError) {
      return {
        ...baseError,
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        details: error.retryAfter ? [{ field: 'retryAfter', value: error.retryAfter }] : undefined,
        stack: this.config.includeStack ? error.stack : undefined,
      } as AppError;
    }

    if (error instanceof DatabaseError) {
      return {
        ...baseError,
        code: error.code,
        message: this.config.sanitizeErrorMessages ? 'Database operation failed' : error.message,
        statusCode: error.statusCode,
        stack: this.config.includeStack ? error.stack : undefined,
        cause: this.config.includeSensitiveInfo ? error.originalError : undefined,
      } as AppError;
    }

    if (error instanceof ExternalServiceError) {
      return {
        ...baseError,
        code: error.code,
        message: this.config.sanitizeErrorMessages ? 'External service error' : error.message,
        statusCode: error.statusCode,
        details: error.service ? [{ field: 'service', value: error.service }] : undefined,
        stack: this.config.includeStack ? error.stack : undefined,
      } as AppError;
    }

    if (error instanceof BusinessRuleError) {
      return {
        ...baseError,
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        details: error.rule ? [{ field: 'rule', value: error.rule }] : undefined,
        stack: this.config.includeStack ? error.stack : undefined,
      } as AppError;
    }

    // Handle Zod validation errors
    if (error instanceof ZodError) {
      const details: ErrorDetails[] = error.issues.map(issue => ({
        field: issue.path.join('.'),
        value: issue.code,
        expected: issue.message,
        metadata: { code: issue.code },
      }));

      return {
        ...baseError,
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        details,
        statusCode: 400,
      } as AppError;
    }

    // Handle standard JavaScript errors
    if (error instanceof Error) {
      // Check for specific error types by message/name
      if (error.name === 'SyntaxError') {
        return {
          ...baseError,
          code: ErrorCode.INVALID_FORMAT,
          message: 'Invalid request format',
          statusCode: 400,
          stack: this.config.includeStack ? error.stack : undefined,
        } as AppError;
      }

      if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        return {
          ...baseError,
          code: ErrorCode.TIMEOUT,
          message: 'Request timeout',
          statusCode: 408,
          stack: this.config.includeStack ? error.stack : undefined,
        } as AppError;
      }

      return {
        ...baseError,
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: this.config.sanitizeErrorMessages ? 'Internal server error' : error.message,
        statusCode: 500,
        stack: this.config.includeStack ? error.stack : undefined,
        cause: this.config.includeSensitiveInfo ? error : undefined,
      } as AppError;
    }

    // Handle unknown error types
    return {
      ...baseError,
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
      statusCode: 500,
      details: this.config.includeSensitiveInfo 
        ? [{ field: 'originalError', value: String(error) }] 
        : undefined,
    } as AppError;
  }

  /**
   * Creates a NextResponse from AppError
   */
  private createErrorResponse(error: AppError): NextResponse {
    const response: any = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        timestamp: error.timestamp,
      },
    };

    // Add details if present
    if (error.details && error.details.length > 0) {
      response.error.details = error.details;
    }

    // Add request ID for tracing
    if (error.requestId) {
      response.error.requestId = error.requestId;
    }

    // Add stack trace in development
    if (error.stack && this.config.includeStack) {
      response.error.stack = error.stack;
    }

    const nextResponse = NextResponse.json(response, { 
      status: error.statusCode 
    });

    // Add retry-after header for rate limiting
    if (error.code === ErrorCode.RATE_LIMIT_EXCEEDED && error.details) {
      const retryAfter = error.details.find(d => d.field === 'retryAfter')?.value;
      if (retryAfter) {
        nextResponse.headers.set('Retry-After', String(retryAfter));
      }
    }

    // Add CORS headers if needed
    nextResponse.headers.set('Access-Control-Allow-Origin', '*');
    nextResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    nextResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return nextResponse;
  }

  /**
   * Logs the error for monitoring
   */
  private logError(error: AppError): void {
    const logLevel = error.statusCode >= 500 ? 'error' : 'warn';
    const logMessage = {
      level: logLevel,
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      timestamp: error.timestamp,
      requestId: error.requestId,
      userId: error.userId,
      path: error.path,
      method: error.method,
      userAgent: error.userAgent,
      ip: error.ip,
      details: error.details,
      stack: error.stack,
    };

    // In a real application, you'd use a proper logging service
    if (logLevel === 'error') {
      console.error('[ERROR]', JSON.stringify(logMessage, null, 2));
    } else {
      console.warn('[WARN]', JSON.stringify(logMessage, null, 2));
    }
  }

  /**
   * Notifies external monitoring services
   */
  private notifyExternalServices(error: AppError): void {
    // In a real application, you'd integrate with services like:
    // - Sentry
    // - DataDog
    // - New Relic
    // - Custom webhook endpoints
    
    console.log('[EXTERNAL_NOTIFICATION]', {
      service: 'monitoring',
      error: {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        timestamp: error.timestamp,
        requestId: error.requestId,
      },
    });
  }

  /**
   * Extracts client IP from headers
   */
  private getClientIp(headers?: Headers): string | undefined {
    if (!headers) return undefined;
    
    return headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
           headers.get('x-real-ip') ||
           headers.get('x-client-ip') ||
           undefined;
  }
}

// ====================
// GLOBAL ERROR HANDLER INSTANCE
// ====================

export const globalErrorHandler = new ErrorHandler();

// ====================
// UTILITY FUNCTIONS
// ====================

/**
 * Creates a validation error from Zod issues
 */
export function createValidationError(issues: any[]): ValidationError {
  const details: ErrorDetails[] = issues.map(issue => ({
    field: Array.isArray(issue.path) ? issue.path.join('.') : issue.path,
    value: issue.received,
    expected: issue.expected,
    constraint: issue.code,
    metadata: { message: issue.message },
  }));

  return new ValidationError('Validation failed', details);
}

/**
 * Wraps an async function with error handling
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      // Re-throw known errors
      if (error instanceof ValidationError ||
          error instanceof AuthenticationError ||
          error instanceof AuthorizationError ||
          error instanceof NotFoundError ||
          error instanceof ConflictError ||
          error instanceof RateLimitError ||
          error instanceof DatabaseError ||
          error instanceof ExternalServiceError ||
          error instanceof BusinessRuleError) {
        throw error;
      }

      // Wrap unknown errors
      throw new Error(`Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
}

/**
 * Creates a safe error message (removes sensitive information)
 */
export function sanitizeErrorMessage(message: string): string {
  // Remove potential SQL injection patterns
  let sanitized = message.replace(/(\bpassword\b|\btoken\b|\bkey\b|\bsecret\b)[\s:=]+[^\s]+/gi, '$1=***');
  
  // Remove file paths
  sanitized = sanitized.replace(/([a-zA-Z]:\\|\/)[^\s]+/g, '[PATH_REDACTED]');
  
  // Remove emails
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');
  
  // Remove IP addresses
  sanitized = sanitized.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP_REDACTED]');
  
  return sanitized;
}

export default {
  ErrorHandler,
  globalErrorHandler,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  BusinessRuleError,
  createValidationError,
  withErrorHandling,
  sanitizeErrorMessage,
  ErrorCode,
};