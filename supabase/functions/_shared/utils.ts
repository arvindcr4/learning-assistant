// Shared utilities for Supabase Edge Functions
// Compatible with Deno runtime

import { 
  ResponseData, 
  CorsHeaders, 
  EdgeFunctionError, 
  ValidationError, 
  RequestContext 
} from './types.ts';

/**
 * CORS headers for edge functions
 */
export const corsHeaders: CorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};

/**
 * Create a standardized JSON response
 */
export function createResponse<T>(
  data: T,
  options: {
    status?: number;
    success?: boolean;
    message?: string;
    headers?: Record<string, string>;
  } = {}
): Response {
  const {
    status = 200,
    success = true,
    message,
    headers = {}
  } = options;

  const responseData: ResponseData<T> = {
    success,
    data: success ? data : undefined,
    error: !success ? (data as any) : undefined,
    message,
    timestamp: new Date().toISOString()
  };

  return new Response(
    JSON.stringify(responseData),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
        ...headers
      }
    }
  );
}

/**
 * Create an error response
 */
export function createErrorResponse(
  error: string | Error,
  status: number = 500,
  code?: string
): Response {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorData = {
    message: errorMessage,
    code: code || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString()
  };

  return createResponse(errorData, {
    status,
    success: false
  });
}

/**
 * Handle CORS preflight requests
 */
export function handleCors(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

/**
 * Parse and validate JSON request body
 */
export async function parseRequestBody<T>(request: Request): Promise<T> {
  try {
    const contentType = request.headers.get('content-type');
    
    if (!contentType || !contentType.includes('application/json')) {
      throw new ValidationError('Content-Type must be application/json');
    }

    const body = await request.text();
    
    if (!body.trim()) {
      throw new ValidationError('Request body is required');
    }

    return JSON.parse(body) as T;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('Invalid JSON in request body');
  }
}

/**
 * Extract user ID from JWT token in Authorization header
 */
export function extractUserId(request: Request): string {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ValidationError('Authorization header with Bearer token is required');
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    
    // In a real implementation, you would validate the JWT token here
    // For now, we'll extract the user ID from the token payload
    const payload = JSON.parse(atob(token.split('.')[1]));
    
    if (!payload.sub) {
      throw new ValidationError('Invalid token: missing user ID');
    }

    return payload.sub;
  } catch (error) {
    throw new ValidationError('Invalid or malformed JWT token');
  }
}

/**
 * Create request context from incoming request
 */
export function createRequestContext(request: Request): RequestContext {
  const url = new URL(request.url);
  const headers = request.headers;
  const method = request.method;

  return {
    request,
    url,
    headers,
    method
  };
}

/**
 * Validate required fields in an object
 */
export function validateRequiredFields(
  obj: Record<string, any>,
  requiredFields: string[]
): void {
  const missingFields = requiredFields.filter(field => {
    const value = obj[field];
    return value === undefined || value === null || value === '';
  });

  if (missingFields.length > 0) {
    throw new ValidationError(`Missing required fields: ${missingFields.join(', ')}`);
  }
}

/**
 * Sanitize and validate user input
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove HTML tags and potentially harmful characters
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[<>'"&]/g, '')
    .trim();
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Generate a simple UUID (v4)
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Calculate cache key for consistent caching
 */
export function calculateCacheKey(prefix: string, ...parts: string[]): string {
  const cleanParts = parts.map(part => 
    sanitizeInput(part).replace(/[^a-zA-Z0-9]/g, '_')
  );
  return `${prefix}:${cleanParts.join(':')}`;
}

/**
 * Rate limiting helper (simple in-memory implementation)
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const key = `rate_limit:${identifier}`;
  const current = rateLimitStore.get(key);

  if (!current || now > current.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs
    });
    return true;
  }

  if (current.count >= maxRequests) {
    return false;
  }

  current.count++;
  return true;
}

/**
 * Log function calls for debugging (compatible with Deno)
 */
export function logFunction(
  functionName: string,
  userId?: string,
  data?: any
): void {
  const logData = {
    function: functionName,
    userId,
    timestamp: new Date().toISOString(),
    data: data ? JSON.stringify(data) : undefined
  };
  
  console.log(JSON.stringify(logData));
}

/**
 * Handle function errors consistently
 */
export function handleFunctionError(
  error: Error,
  functionName: string,
  userId?: string
): Response {
  logFunction(`${functionName}:error`, userId, {
    error: error.message,
    stack: error.stack
  });

  if (error instanceof EdgeFunctionError) {
    return createErrorResponse(error.message, error.statusCode, error.code);
  }

  // Don't expose internal errors to clients
  return createErrorResponse(
    'An internal error occurred',
    500,
    'INTERNAL_ERROR'
  );
}

/**
 * Parse query parameters from URL
 */
export function parseQueryParams(url: URL): Record<string, string> {
  const params: Record<string, string> = {};
  
  for (const [key, value] of url.searchParams.entries()) {
    params[key] = value;
  }
  
  return params;
}

/**
 * Validate pagination parameters
 */
export function validatePagination(params: {
  page?: string;
  limit?: string;
}): { page: number; limit: number } {
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(params.limit || '20', 10)));
  
  return { page, limit };
}

/**
 * Calculate offset for database queries
 */
export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Create pagination metadata
 */
export function createPaginationMeta(
  page: number,
  limit: number,
  total: number
): {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
} {
  const totalPages = Math.ceil(total / limit);
  
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
}