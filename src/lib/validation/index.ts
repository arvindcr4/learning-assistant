import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

// ====================
// VALIDATION UTILITIES
// ====================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    issues: z.ZodIssue[];
    code: string;
  };
}

export interface ValidationOptions {
  abortEarly?: boolean;
  stripUnknown?: boolean;
  customErrorMessage?: string;
}

/**
 * Validates data against a Zod schema
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  options: ValidationOptions = {}
): ValidationResult<T> {
  try {
    const result = schema.safeParse(data);
    
    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    } else {
      return {
        success: false,
        error: {
          message: options.customErrorMessage || 'Validation failed',
          issues: result.error.issues,
          code: 'VALIDATION_ERROR',
        },
      };
    }
  } catch (error) {
    return {
      success: false,
      error: {
        message: 'Validation error occurred',
        issues: [],
        code: 'VALIDATION_EXCEPTION',
      },
    };
  }
}

/**
 * Validates request body against a Zod schema
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>,
  options: ValidationOptions = {}
): Promise<ValidationResult<T>> {
  try {
    const body = await request.json();
    return validateData(schema, body, options);
  } catch (error) {
    return {
      success: false,
      error: {
        message: 'Invalid JSON in request body',
        issues: [],
        code: 'INVALID_JSON',
      },
    };
  }
}

/**
 * Validates query parameters against a Zod schema
 */
export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>,
  options: ValidationOptions = {}
): ValidationResult<T> {
  const params: Record<string, string | string[]> = {};
  
  // Convert URLSearchParams to object
  for (const [key, value] of searchParams.entries()) {
    if (params[key]) {
      // Handle multiple values for the same key
      if (Array.isArray(params[key])) {
        (params[key] as string[]).push(value);
      } else {
        params[key] = [params[key] as string, value];
      }
    } else {
      params[key] = value;
    }
  }
  
  return validateData(schema, params, options);
}

/**
 * Validates path parameters against a Zod schema
 */
export function validatePathParams<T>(
  params: Record<string, string | string[]>,
  schema: z.ZodSchema<T>,
  options: ValidationOptions = {}
): ValidationResult<T> {
  return validateData(schema, params, options);
}

/**
 * Creates a validation error response
 */
export function createValidationErrorResponse(
  error: ValidationResult<any>['error'],
  statusCode: number = 400
): NextResponse {
  return NextResponse.json(
    {
      error: 'Validation Error',
      message: error?.message || 'Invalid request data',
      code: error?.code || 'VALIDATION_ERROR',
      details: error?.issues?.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      })) || [],
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  );
}

/**
 * Creates a generic error response
 */
export function createErrorResponse(
  message: string,
  statusCode: number = 500,
  code: string = 'INTERNAL_ERROR',
  details?: any
): NextResponse {
  return NextResponse.json(
    {
      error: 'Error',
      message,
      code,
      details,
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  );
}

/**
 * Creates a success response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  statusCode: number = 200
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  );
}

// ====================
// MIDDLEWARE HELPERS
// ====================

/**
 * Higher-order function to create validation middleware
 */
export function withValidation<T>(
  schema: z.ZodSchema<T>,
  validateBody: boolean = true,
  validateQuery: boolean = false,
  validateParams: boolean = false
) {
  return function (handler: (
    request: NextRequest,
    validatedData: {
      body?: T;
      query?: any;
      params?: any;
    },
    context?: any
  ) => Promise<NextResponse> | NextResponse) {
    return async function (request: NextRequest, context?: any) {
      const validatedData: {
        body?: T;
        query?: any;
        params?: any;
      } = {};

      // Validate request body
      if (validateBody && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
        const bodyValidation = await validateRequestBody(request, schema);
        if (!bodyValidation.success) {
          return createValidationErrorResponse(bodyValidation.error);
        }
        validatedData.body = bodyValidation.data;
      }

      // Validate query parameters
      if (validateQuery) {
        const queryValidation = validateQueryParams(
          request.nextUrl.searchParams,
          schema
        );
        if (!queryValidation.success) {
          return createValidationErrorResponse(queryValidation.error);
        }
        validatedData.query = queryValidation.data;
      }

      // Validate path parameters
      if (validateParams && context?.params) {
        const paramsValidation = validatePathParams(context.params, schema);
        if (!paramsValidation.success) {
          return createValidationErrorResponse(paramsValidation.error);
        }
        validatedData.params = paramsValidation.data;
      }

      return handler(request, validatedData, context);
    };
  };
}

/**
 * Middleware to validate JSON content type
 */
export function validateContentType(request: NextRequest): ValidationResult<void> {
  const contentType = request.headers.get('content-type');
  
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    if (!contentType || !contentType.includes('application/json')) {
      return {
        success: false,
        error: {
          message: 'Content-Type must be application/json',
          issues: [],
          code: 'INVALID_CONTENT_TYPE',
        },
      };
    }
  }
  
  return { success: true };
}

/**
 * Middleware to validate request size
 */
export function validateRequestSize(
  request: NextRequest,
  maxSize: number = 10 * 1024 * 1024 // 10MB
): ValidationResult<void> {
  const contentLength = request.headers.get('content-length');
  
  if (contentLength && parseInt(contentLength) > maxSize) {
    return {
      success: false,
      error: {
        message: `Request size exceeds maximum allowed size of ${maxSize} bytes`,
        issues: [],
        code: 'REQUEST_TOO_LARGE',
      },
    };
  }
  
  return { success: true };
}

/**
 * Middleware to validate authorization
 */
export function validateAuthorization(request: NextRequest): ValidationResult<string> {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader) {
    return {
      success: false,
      error: {
        message: 'Authorization header is required',
        issues: [],
        code: 'UNAUTHORIZED',
      },
    };
  }
  
  const [type, token] = authHeader.split(' ');
  
  if (type !== 'Bearer' || !token) {
    return {
      success: false,
      error: {
        message: 'Invalid authorization format. Use: Bearer <token>',
        issues: [],
        code: 'INVALID_AUTH_FORMAT',
      },
    };
  }
  
  return {
    success: true,
    data: token,
  };
}

// ====================
// FORM VALIDATION HELPERS
// ====================

/**
 * Converts Zod issues to form-friendly error format
 */
export function zodIssueToFormError(issues: z.ZodIssue[]) {
  const errors: Record<string, string> = {};
  
  issues.forEach(issue => {
    const path = issue.path.join('.');
    errors[path] = issue.message;
  });
  
  return errors;
}

/**
 * Validates form data with Zod and returns form-friendly errors
 */
export function validateFormData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: boolean; data?: T; errors?: Record<string, string> } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  } else {
    return {
      success: false,
      errors: zodIssueToFormError(result.error.issues),
    };
  }
}

// ====================
// TYPE GUARDS
// ====================

/**
 * Type guard to check if value is a validation error
 */
export function isValidationError(
  result: ValidationResult<any>
): result is ValidationResult<any> & { success: false } {
  return !result.success;
}

/**
 * Type guard to check if value is validation success
 */
export function isValidationSuccess<T>(
  result: ValidationResult<T>
): result is ValidationResult<T> & { success: true; data: T } {
  return result.success;
}

// ====================
// EXPORT EVERYTHING
// ====================

export * from './schemas';
export * from './sanitization';
export * from './rate-limiting';