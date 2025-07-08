/**
 * Comprehensive Error Handling System
 * Provides standardized error handling patterns across the application
 * 
 * @fileoverview This module contains the core error handling utilities
 * @author Learning Assistant Team
 * @version 1.0.0
 * @since 2024-07-08
 */

/**
 * Standard error types used throughout the application
 */
export enum ErrorType {
  /** Validation errors for user input */
  VALIDATION = 'VALIDATION',
  /** Authentication and authorization errors */
  AUTH = 'AUTH',
  /** Network and API errors */
  NETWORK = 'NETWORK',
  /** Database operation errors */
  DATABASE = 'DATABASE',
  /** File system errors */
  FILE_SYSTEM = 'FILE_SYSTEM',
  /** External service errors */
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  /** Business logic errors */
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  /** Configuration errors */
  CONFIGURATION = 'CONFIGURATION',
  /** Rate limiting errors */
  RATE_LIMIT = 'RATE_LIMIT',
  /** Unknown or unexpected errors */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Error severity levels for proper categorization
 */
export enum ErrorSeverity {
  /** Low severity - minor issues that don't affect functionality */
  LOW = 'LOW',
  /** Medium severity - issues that affect some functionality */
  MEDIUM = 'MEDIUM',
  /** High severity - issues that significantly impact functionality */
  HIGH = 'HIGH',
  /** Critical severity - issues that make the application unusable */
  CRITICAL = 'CRITICAL',
}

/**
 * Error context interface for providing additional error information
 */
export interface ErrorContext {
  /** Component or module where error occurred */
  component?: string;
  /** User ID if available */
  userId?: string;
  /** Session ID for tracking */
  sessionId?: string;
  /** Request ID for API calls */
  requestId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Timestamp when error occurred */
  timestamp: number;
  /** Stack trace if available */
  stack?: string;
}

/**
 * Standard application error class with enhanced context
 */
export class AppError extends Error {
  /** Error type classification */
  public readonly type: ErrorType;
  /** Error severity level */
  public readonly severity: ErrorSeverity;
  /** Additional error context */
  public readonly context: ErrorContext;
  /** Whether error should be retried */
  public readonly retryable: boolean;
  /** Error code for programmatic handling */
  public readonly code?: string;

  /**
   * Creates a new AppError instance
   * @param message - Error message
   * @param type - Error type
   * @param severity - Error severity
   * @param context - Error context
   * @param retryable - Whether error can be retried
   * @param code - Error code
   */
  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context: Partial<ErrorContext> = {},
    retryable = false,
    code?: string
  ) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.severity = severity;
    this.retryable = retryable;
    this.code = code;
    this.context = {
      timestamp: Date.now(),
      ...context,
    };

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Converts the error to a plain object for serialization
   * @returns Plain object representation
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      severity: this.severity,
      context: this.context,
      retryable: this.retryable,
      code: this.code,
      stack: this.stack,
    };
  }

  /**
   * Creates a user-friendly error message
   * @returns User-friendly message
   */
  getUserMessage(): string {
    switch (this.type) {
      case ErrorType.VALIDATION:
        return 'Please check your input and try again.';
      case ErrorType.AUTH:
        return 'Authentication required. Please log in.';
      case ErrorType.NETWORK:
        return 'Network error. Please check your connection.';
      case ErrorType.RATE_LIMIT:
        return 'Too many requests. Please wait and try again.';
      default:
        return 'Something went wrong. Please try again.';
    }
  }
}

/**
 * Validation error for input validation failures
 */
export class ValidationError extends AppError {
  /** Field validation errors */
  public readonly fieldErrors: Record<string, string[]>;

  /**
   * Creates a new ValidationError
   * @param message - Error message
   * @param fieldErrors - Field-specific errors
   * @param context - Error context
   */
  constructor(
    message: string,
    fieldErrors: Record<string, string[]> = {},
    context: Partial<ErrorContext> = {}
  ) {
    super(message, ErrorType.VALIDATION, ErrorSeverity.MEDIUM, context, false);
    this.name = 'ValidationError';
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Network error for API and network-related failures
 */
export class NetworkError extends AppError {
  /** HTTP status code */
  public readonly statusCode?: number;
  /** Response data if available */
  public readonly responseData?: unknown;

  /**
   * Creates a new NetworkError
   * @param message - Error message
   * @param statusCode - HTTP status code
   * @param responseData - Response data
   * @param context - Error context
   */
  constructor(
    message: string,
    statusCode?: number,
    responseData?: unknown,
    context: Partial<ErrorContext> = {}
  ) {
    const retryable = statusCode ? statusCode >= 500 || statusCode === 429 : true;
    super(message, ErrorType.NETWORK, ErrorSeverity.HIGH, context, retryable);
    this.name = 'NetworkError';
    this.statusCode = statusCode;
    this.responseData = responseData;
  }
}

/**
 * Result wrapper for handling operations that may fail
 * Implements the Result pattern for better error handling
 */
export type Result<T, E = AppError> = {
  /** Whether operation was successful */
  success: true;
  /** Result data */
  data: T;
} | {
  /** Whether operation failed */
  success: false;
  /** Error information */
  error: E;
};

/**
 * Creates a successful result
 * @param data - Success data
 * @returns Success result
 */
export function createSuccessResult<T>(data: T): Result<T, never> {
  return { success: true, data };
}

/**
 * Creates a failure result
 * @param error - Error information
 * @returns Failure result
 */
export function createErrorResult<E = AppError>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Wraps a function to return a Result instead of throwing
 * @param fn - Function to wrap
 * @returns Wrapped function that returns Result
 */
export function wrapResult<T, Args extends unknown[]>(
  fn: (...args: Args) => T | Promise<T>
): (...args: Args) => Promise<Result<T, AppError>> {
  return async (...args: Args): Promise<Result<T, AppError>> => {
    try {
      const result = await fn(...args);
      return createSuccessResult(result);
    } catch (error) {
      if (error instanceof AppError) {
        return createErrorResult(error);
      }
      
      // Convert unknown errors to AppError
      const appError = new AppError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        ErrorType.UNKNOWN,
        ErrorSeverity.HIGH,
        {
          originalError: error,
        }
      );
      
      return createErrorResult(appError);
    }
  };
}

/**
 * Retry configuration for operations
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Base delay between retries in milliseconds */
  baseDelay: number;
  /** Maximum delay between retries in milliseconds */
  maxDelay: number;
  /** Exponential backoff multiplier */
  backoffMultiplier: number;
  /** Function to determine if error should be retried */
  shouldRetry?: (error: AppError) => boolean;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  shouldRetry: (error: AppError) => error.retryable,
};

/**
 * Retries an operation with exponential backoff
 * @param operation - Operation to retry
 * @param config - Retry configuration
 * @returns Result of the operation
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: AppError | undefined;
  
  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const appError = error instanceof AppError 
        ? error 
        : new AppError(
            error instanceof Error ? error.message : 'Unknown error',
            ErrorType.UNKNOWN,
            ErrorSeverity.HIGH
          );
      
      lastError = appError;
      
      // Don't retry if this is the last attempt or error is not retryable
      if (attempt === finalConfig.maxAttempts || !finalConfig.shouldRetry?.(appError)) {
        throw appError;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        finalConfig.baseDelay * Math.pow(finalConfig.backoffMultiplier, attempt - 1),
        finalConfig.maxDelay
      );
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Global error handler for unhandled promise rejections and errors
 */
export class GlobalErrorHandler {
  private static instance: GlobalErrorHandler;
  private readonly errorHandlers: Map<ErrorType, (error: AppError) => void> = new Map();

  /**
   * Gets the singleton instance
   * @returns GlobalErrorHandler instance
   */
  static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler();
    }
    return GlobalErrorHandler.instance;
  }

  /**
   * Registers an error handler for a specific error type
   * @param type - Error type
   * @param handler - Error handler function
   */
  registerHandler(type: ErrorType, handler: (error: AppError) => void): void {
    this.errorHandlers.set(type, handler);
  }

  /**
   * Handles an error by routing to appropriate handler
   * @param error - Error to handle
   */
  handleError(error: AppError): void {
    const handler = this.errorHandlers.get(error.type);
    if (handler) {
      handler(error);
    } else {
      // Default error handling
      console.error('Unhandled error:', error);
    }
  }

  /**
   * Initializes global error handling
   */
  initialize(): void {
    // Handle unhandled promise rejections
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (event) => {
        const error = event.reason instanceof AppError 
          ? event.reason 
          : new AppError(
              event.reason?.message || 'Unhandled promise rejection',
              ErrorType.UNKNOWN,
              ErrorSeverity.HIGH
            );
        
        this.handleError(error);
        event.preventDefault();
      });
    }
  }
}