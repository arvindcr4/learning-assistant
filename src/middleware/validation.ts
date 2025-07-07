import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  validateRequestBody, 
  validateQueryParams, 
  validatePathParams,
  createValidationErrorResponse,
  createErrorResponse,
  createSuccessResponse 
} from '@/lib/validation';
import { 
  apiRateLimiter, 
  authRateLimiter, 
  chatRateLimiter, 
  assessmentRateLimiter,
  abuseDetector 
} from '@/lib/validation/rate-limiting';
import { sanitizeUserInput } from '@/lib/validation/sanitization';

// ====================
// MIDDLEWARE TYPES
// ====================

export interface ValidationMiddlewareConfig {
  bodySchema?: z.ZodSchema<any>;
  querySchema?: z.ZodSchema<any>;
  paramsSchema?: z.ZodSchema<any>;
  requireAuth?: boolean;
  rateLimiter?: 'api' | 'auth' | 'chat' | 'assessment' | 'none';
  sanitizeInputs?: boolean;
  checkAbuse?: boolean;
  customValidation?: (request: NextRequest) => Promise<boolean>;
}

export interface ValidatedRequest extends NextRequest {
  validatedBody?: any;
  validatedQuery?: any;
  validatedParams?: any;
  user?: any;
}

// ====================
// CORE VALIDATION MIDDLEWARE
// ====================

/**
 * Main validation middleware factory
 */
export function createValidationMiddleware(config: ValidationMiddlewareConfig) {
  return async function validationMiddleware(
    request: NextRequest,
    context?: { params: Record<string, string | string[]> }
  ): Promise<{ 
    success: boolean; 
    response?: NextResponse; 
    validatedData?: any;
    error?: string;
  }> {
    try {
      // 1. Check for abuse detection
      if (config.checkAbuse !== false) {
        const abuseCheck = abuseDetector.checkRequest(request);
        if (abuseCheck.isAbusive) {
          return {
            success: false,
            response: createErrorResponse(abuseCheck.reason || 'Request blocked due to suspicious activity', 429),
          };
        }
      }

      // 2. Apply rate limiting
      if (config.rateLimiter && config.rateLimiter !== 'none') {
        const rateLimiter = getRateLimiter(config.rateLimiter);
        const rateLimitResult = await rateLimiter.isAllowed(request);
        
        if (!rateLimitResult.allowed) {
          return {
            success: false,
            response: rateLimitResult.response,
          };
        }
      }

      // 3. Validate content type for POST/PUT/PATCH requests
      if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
        const contentType = request.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          return {
            success: false,
            response: createValidationErrorResponse({
              message: 'Content-Type must be application/json',
              issues: [],
              code: 'INVALID_CONTENT_TYPE',
            }),
          };
        }
      }

      // 4. Validate request size
      const contentLength = request.headers.get('content-length');
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (contentLength && parseInt(contentLength) > maxSize) {
        return {
          success: false,
          response: createErrorResponse('Request size exceeds maximum allowed size', 413),
        };
      }

      const validatedData: any = {};

      // 5. Validate request body
      if (config.bodySchema && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
        const bodyValidation = await validateRequestBody(request, config.bodySchema);
        if (!bodyValidation.success) {
          return {
            success: false,
            response: createValidationErrorResponse(bodyValidation.error),
          };
        }
        validatedData.body = bodyValidation.data;

        // Sanitize body inputs if requested
        if (config.sanitizeInputs) {
          validatedData.body = sanitizeObjectInputs(validatedData.body);
        }
      }

      // 6. Validate query parameters
      if (config.querySchema) {
        const queryValidation = validateQueryParams(request.nextUrl.searchParams, config.querySchema);
        if (!queryValidation.success) {
          return {
            success: false,
            response: createValidationErrorResponse(queryValidation.error),
          };
        }
        validatedData.query = queryValidation.data;

        // Sanitize query inputs if requested
        if (config.sanitizeInputs) {
          validatedData.query = sanitizeObjectInputs(validatedData.query);
        }
      }

      // 7. Validate path parameters
      if (config.paramsSchema && context?.params) {
        const paramsValidation = validatePathParams(context.params, config.paramsSchema);
        if (!paramsValidation.success) {
          return {
            success: false,
            response: createValidationErrorResponse(paramsValidation.error),
          };
        }
        validatedData.params = paramsValidation.data;
      }

      // 8. Authentication check
      if (config.requireAuth) {
        const authResult = await validateAuthentication(request);
        if (!authResult.success) {
          return {
            success: false,
            response: createErrorResponse(authResult.error || 'Authentication required', 401),
          };
        }
        validatedData.user = authResult.user;
      }

      // 9. Custom validation
      if (config.customValidation) {
        const customResult = await config.customValidation(request);
        if (!customResult) {
          return {
            success: false,
            response: createErrorResponse('Custom validation failed', 400),
          };
        }
      }

      return {
        success: true,
        validatedData,
      };

    } catch (error) {
      console.error('Validation middleware error:', error);
      return {
        success: false,
        response: createErrorResponse('Internal validation error', 500),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };
}

// ====================
// HELPER FUNCTIONS
// ====================

function getRateLimiter(type: string) {
  switch (type) {
    case 'auth':
      return authRateLimiter;
    case 'chat':
      return chatRateLimiter;
    case 'assessment':
      return assessmentRateLimiter;
    case 'api':
    default:
      return apiRateLimiter;
  }
}

function sanitizeObjectInputs(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObjectInputs(item));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // Apply appropriate sanitization based on field name
      if (key.toLowerCase().includes('email')) {
        sanitized[key] = sanitizeUserInput(value, 'email');
      } else if (key.toLowerCase().includes('url') || key.toLowerCase().includes('link')) {
        sanitized[key] = sanitizeUserInput(value, 'url');
      } else if (key.toLowerCase().includes('html') || key.toLowerCase().includes('content')) {
        sanitized[key] = sanitizeUserInput(value, 'html');
      } else if (key.toLowerCase().includes('phone')) {
        sanitized[key] = sanitizeUserInput(value, 'phone');
      } else {
        sanitized[key] = sanitizeUserInput(value, 'text', { allowSpecialChars: true });
      }
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObjectInputs(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

async function validateAuthentication(request: NextRequest): Promise<{
  success: boolean;
  user?: any;
  error?: string;
}> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return { success: false, error: 'Authorization header missing' };
    }

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      return { success: false, error: 'Invalid authorization format' };
    }

    // Here you would verify the JWT token and extract user information
    // For now, we'll just return a basic structure
    // In a real implementation, you'd verify the token against your auth service
    
    const user = {
      id: 'user-id', // Extract from token
      email: 'user@example.com', // Extract from token
      role: 'user', // Extract from token
    };

    return { success: true, user };
  } catch (error) {
    return { success: false, error: 'Token validation failed' };
  }
}

// ====================
// ROUTE WRAPPER UTILITIES
// ====================

/**
 * Higher-order function to wrap API routes with validation
 */
export function withValidation(config: ValidationMiddlewareConfig) {
  return function <T extends any[]>(
    handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
  ) {
    return async function (request: NextRequest, ...args: T): Promise<NextResponse> {
      const middleware = createValidationMiddleware(config);
      
      // Extract context from args if present (for dynamic routes)
      const context = args.length > 0 && typeof args[0] === 'object' && args[0].params 
        ? args[0] as { params: Record<string, string | string[]> }
        : undefined;

      const result = await middleware(request, context);

      if (!result.success) {
        return result.response!;
      }

      // Add validated data to request object
      const validatedRequest = request as ValidatedRequest;
      validatedRequest.validatedBody = result.validatedData?.body;
      validatedRequest.validatedQuery = result.validatedData?.query;
      validatedRequest.validatedParams = result.validatedData?.params;
      validatedRequest.user = result.validatedData?.user;

      return handler(validatedRequest, ...args);
    };
  };
}

/**
 * Validates and processes file uploads
 */
export function validateFileUpload(request: NextRequest, options: {
  maxSize?: number;
  allowedTypes?: string[];
  maxFiles?: number;
}): { success: boolean; error?: string } {
  const maxSize = options.maxSize || 10 * 1024 * 1024; // 10MB default
  const allowedTypes = options.allowedTypes || ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
  const maxFiles = options.maxFiles || 5;

  const contentType = request.headers.get('content-type');
  if (!contentType || !contentType.includes('multipart/form-data')) {
    return { success: false, error: 'Content-Type must be multipart/form-data for file uploads' };
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > maxSize) {
    return { success: false, error: `File size exceeds maximum allowed size of ${maxSize} bytes` };
  }

  return { success: true };
}

/**
 * Creates a standardized API response
 */
export function createApiResponse<T>(
  data: T,
  message?: string,
  statusCode: number = 200
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
      message: message || 'Request processed successfully',
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  );
}

/**
 * Creates a standardized error response
 */
export function createApiErrorResponse(
  message: string,
  statusCode: number = 400,
  code?: string,
  details?: any
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        code: code || 'API_ERROR',
        details,
      },
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  );
}

// ====================
// PREDEFINED MIDDLEWARE CONFIGURATIONS
// ====================

export const commonApiValidation: ValidationMiddlewareConfig = {
  rateLimiter: 'api',
  sanitizeInputs: true,
  checkAbuse: true,
};

export const authValidation: ValidationMiddlewareConfig = {
  rateLimiter: 'auth',
  sanitizeInputs: true,
  checkAbuse: true,
  requireAuth: false, // Auth endpoints don't require existing auth
};

export const authenticatedApiValidation: ValidationMiddlewareConfig = {
  rateLimiter: 'api',
  sanitizeInputs: true,
  checkAbuse: true,
  requireAuth: true,
};

export const chatValidation: ValidationMiddlewareConfig = {
  rateLimiter: 'chat',
  sanitizeInputs: true,
  checkAbuse: true,
  requireAuth: true,
};

export const assessmentValidation: ValidationMiddlewareConfig = {
  rateLimiter: 'assessment',
  sanitizeInputs: true,
  checkAbuse: true,
  requireAuth: true,
};

export default {
  createValidationMiddleware,
  withValidation,
  validateFileUpload,
  createApiResponse,
  createApiErrorResponse,
  commonApiValidation,
  authValidation,
  authenticatedApiValidation,
  chatValidation,
  assessmentValidation,
};