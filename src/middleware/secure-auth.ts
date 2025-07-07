// Secure Authentication middleware for API routes
import { NextRequest, NextResponse } from 'next/server';
import { jwtService, JWTPayload } from '@/lib/jwt';
import { sessionManager } from '@/lib/session-manager';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env-validation';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
    name?: string;
    role: string;
    sessionId?: string;
  };
}

export interface AuthenticationResult {
  user: AuthenticatedRequest['user'] | null;
  response?: NextResponse;
  error?: string;
}

/**
 * Extract and validate authentication token from request
 */
async function extractAndValidateToken(request: NextRequest): Promise<{
  token: string | null;
  payload: JWTPayload | null;
  error: string | null;
}> {
  let token: string | null = null;

  // Try Authorization header first (Bearer token)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // Try cookie-based token
  if (!token) {
    token = request.cookies.get('auth-token')?.value || null;
  }

  // Try API key header
  if (!token) {
    token = request.headers.get('X-API-Key') || null;
  }

  if (!token) {
    return { token: null, payload: null, error: 'No authentication token provided' };
  }

  // Check if token is blacklisted
  if (await sessionManager.isTokenBlacklisted(token)) {
    return { token, payload: null, error: 'Token has been revoked' };
  }

  try {
    // Verify JWT token
    const payload = jwtService.verifyAccessToken(token);
    return { token, payload, error: null };
  } catch (error) {
    return { 
      token, 
      payload: null, 
      error: error instanceof Error ? error.message : 'Token verification failed' 
    };
  }
}

/**
 * Validate session and user status
 */
async function validateSessionAndUser(payload: JWTPayload): Promise<{
  user: AuthenticatedRequest['user'] | null;
  error: string | null;
}> {
  try {
    // Validate session if sessionId is present
    if (payload.sessionId) {
      const session = await sessionManager.validateSession(payload.sessionId);
      if (!session) {
        return { user: null, error: 'Session expired or invalid' };
      }

      // Ensure session belongs to the token user
      if (session.userId !== payload.userId) {
        return { user: null, error: 'Session mismatch' };
      }
    }

    // Verify user still exists and is active using better-auth
    const betterAuthSession = await auth.api.getSession({
      headers: {
        authorization: `Bearer ${payload.userId}`, // This is a simplification
      },
    });

    if (!betterAuthSession || !betterAuthSession.user) {
      // Fallback: Try to get user directly
      const user = await auth.api.getUser({ userId: payload.userId });
      if (!user) {
        return { user: null, error: 'User not found or inactive' };
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role || 'user',
          sessionId: payload.sessionId,
        },
        error: null,
      };
    }

    return {
      user: {
        id: betterAuthSession.user.id,
        email: betterAuthSession.user.email,
        name: betterAuthSession.user.name,
        role: betterAuthSession.user.role || 'user',
        sessionId: payload.sessionId,
      },
      error: null,
    };
  } catch (error) {
    console.error('Session validation error:', error);
    return { user: null, error: 'Session validation failed' };
  }
}

/**
 * Check for suspicious activity
 */
async function checkSuspiciousActivity(
  request: NextRequest, 
  userId: string
): Promise<boolean> {
  const ipAddress = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown';

  return await sessionManager.detectSuspiciousActivity(userId, ipAddress);
}

/**
 * Main authentication function
 */
export async function authenticateUser(request: NextRequest): Promise<AuthenticationResult> {
  try {
    // Extract and validate token
    const { token, payload, error: tokenError } = await extractAndValidateToken(request);
    
    if (tokenError || !payload) {
      return {
        user: null,
        response: NextResponse.json(
          { 
            error: 'Authentication required',
            message: tokenError || 'Please provide a valid authentication token',
            code: 'AUTH_TOKEN_INVALID'
          },
          { status: 401 }
        ),
        error: tokenError || 'Invalid token',
      };
    }

    // Validate session and user
    const { user, error: sessionError } = await validateSessionAndUser(payload);
    
    if (sessionError || !user) {
      // Blacklist the token if session is invalid
      if (token) {
        await sessionManager.blacklistToken(token);
      }
      
      return {
        user: null,
        response: NextResponse.json(
          { 
            error: 'Invalid session',
            message: sessionError || 'Your session has expired. Please log in again.',
            code: 'SESSION_INVALID'
          },
          { status: 401 }
        ),
        error: sessionError || 'Invalid session',
      };
    }

    // Check for suspicious activity
    const isSuspicious = await checkSuspiciousActivity(request, user.id);
    if (isSuspicious) {
      return {
        user: null,
        response: NextResponse.json(
          { 
            error: 'Suspicious activity detected',
            message: 'Your account has been temporarily locked due to suspicious activity.',
            code: 'SUSPICIOUS_ACTIVITY'
          },
          { status: 423 } // Locked
        ),
        error: 'Suspicious activity',
      };
    }

    return { user, error: null };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      user: null,
      response: NextResponse.json(
        { 
          error: 'Authentication failed',
          message: 'An error occurred during authentication. Please try again.',
          code: 'AUTH_ERROR'
        },
        { status: 500 }
      ),
      error: 'Authentication system error',
    };
  }
}

/**
 * Role-based authorization middleware
 */
export function authorizeUser(requiredRoles: string | string[] = []) {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  
  return (user: AuthenticatedRequest['user'] | null): NextResponse | null => {
    if (!user) {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'User not authenticated',
          code: 'USER_NOT_AUTHENTICATED'
        },
        { status: 401 }
      );
    }
    
    // If no specific roles required, just need to be authenticated
    if (roles.length === 0) {
      return null;
    }
    
    // Admin role has access to everything
    if (user.role === 'admin') {
      return null;
    }
    
    // Check if user has required role
    if (!roles.includes(user.role)) {
      return NextResponse.json(
        { 
          error: 'Forbidden',
          message: `Access denied. Required role(s): ${roles.join(', ')}`,
          code: 'INSUFFICIENT_PERMISSIONS'
        },
        { status: 403 }
      );
    }
    
    return null;
  };
}

/**
 * Enhanced rate limiting with user-based tracking
 */
const userRateLimitMap = new Map<string, { count: number; lastReset: number }>();
const ipRateLimitMap = new Map<string, { count: number; lastReset: number }>();

export function enhancedRateLimit(
  maxRequestsPerUser: number = 1000,
  maxRequestsPerIP: number = 100,
  windowMs: number = 60000
) {
  return (request: NextRequest, user?: AuthenticatedRequest['user']): NextResponse | null => {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // IP-based rate limiting
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    const ipLimit = ipRateLimitMap.get(ip) || { count: 0, lastReset: now };
    
    if (ipLimit.lastReset < windowStart) {
      ipLimit.count = 0;
      ipLimit.lastReset = now;
    }
    
    ipLimit.count++;
    ipRateLimitMap.set(ip, ipLimit);
    
    if (ipLimit.count > maxRequestsPerIP) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: `Too many requests from this IP. Maximum ${maxRequestsPerIP} requests per ${windowMs / 1000} seconds.`,
          code: 'IP_RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((windowMs - (now - ipLimit.lastReset)) / 1000)
        },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((windowMs - (now - ipLimit.lastReset)) / 1000).toString(),
            'X-RateLimit-Limit': maxRequestsPerIP.toString(),
            'X-RateLimit-Remaining': Math.max(0, maxRequestsPerIP - ipLimit.count).toString(),
            'X-RateLimit-Reset': new Date(ipLimit.lastReset + windowMs).toISOString()
          }
        }
      );
    }
    
    // User-based rate limiting (higher limits for authenticated users)
    if (user) {
      const userLimit = userRateLimitMap.get(user.id) || { count: 0, lastReset: now };
      
      if (userLimit.lastReset < windowStart) {
        userLimit.count = 0;
        userLimit.lastReset = now;
      }
      
      userLimit.count++;
      userRateLimitMap.set(user.id, userLimit);
      
      if (userLimit.count > maxRequestsPerUser) {
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded',
            message: `Too many requests. Maximum ${maxRequestsPerUser} requests per ${windowMs / 1000} seconds.`,
            code: 'USER_RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil((windowMs - (now - userLimit.lastReset)) / 1000)
          },
          { 
            status: 429,
            headers: {
              'Retry-After': Math.ceil((windowMs - (now - userLimit.lastReset)) / 1000).toString(),
              'X-RateLimit-Limit': maxRequestsPerUser.toString(),
              'X-RateLimit-Remaining': Math.max(0, maxRequestsPerUser - userLimit.count).toString(),
              'X-RateLimit-Reset': new Date(userLimit.lastReset + windowMs).toISOString()
            }
          }
        );
      }
    }
    
    return null;
  };
}

/**
 * CORS headers with security considerations
 */
export function corsHeaders(origin?: string) {
  const allowedOrigins = env.CORS_ORIGIN ? env.CORS_ORIGIN.split(',') : ['http://localhost:3000'];
  const isAllowedOrigin = origin && allowedOrigins.includes(origin);
  
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours
    'Vary': 'Origin',
  };
}

/**
 * Security headers
 */
export function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
  };
}

/**
 * Combined secure middleware wrapper
 */
export function withSecureAuth(
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>,
  options: {
    requiredRoles?: string | string[];
    rateLimits?: {
      maxRequestsPerUser?: number;
      maxRequestsPerIP?: number;
      windowMs?: number;
    };
  } = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const startTime = Date.now();
      
      // Handle preflight requests
      if (request.method === 'OPTIONS') {
        return new NextResponse(null, { 
          status: 200,
          headers: {
            ...corsHeaders(request.headers.get('origin') || undefined),
            ...securityHeaders(),
          }
        });
      }
      
      // Apply rate limiting (IP-based first)
      const rateLimitResponse = enhancedRateLimit(
        options.rateLimits?.maxRequestsPerUser,
        options.rateLimits?.maxRequestsPerIP,
        options.rateLimits?.windowMs
      )(request);
      
      if (rateLimitResponse) {
        return rateLimitResponse;
      }
      
      // Authenticate user
      const { user, response: authResponse } = await authenticateUser(request);
      if (authResponse) {
        return authResponse;
      }
      
      // Apply user-based rate limiting
      const userRateLimitResponse = enhancedRateLimit(
        options.rateLimits?.maxRequestsPerUser,
        options.rateLimits?.maxRequestsPerIP,
        options.rateLimits?.windowMs
      )(request, user);
      
      if (userRateLimitResponse) {
        return userRateLimitResponse;
      }
      
      // Authorize user
      const authorizationResponse = authorizeUser(options.requiredRoles)(user);
      if (authorizationResponse) {
        return authorizationResponse;
      }
      
      // Add user to request
      const authenticatedRequest = Object.assign(request, { user }) as AuthenticatedRequest;
      
      // Call the handler
      const result = await handler(authenticatedRequest);
      
      // Add security headers to response
      Object.entries({
        ...corsHeaders(request.headers.get('origin') || undefined),
        ...securityHeaders(),
      }).forEach(([key, value]) => {
        result.headers.set(key, value);
      });
      
      // Add performance timing header
      const duration = Date.now() - startTime;
      result.headers.set('X-Response-Time', `${duration}ms`);
      
      return result;
    } catch (error) {
      console.error('Secure middleware error:', error);
      return NextResponse.json(
        { 
          error: 'Internal server error',
          message: 'An unexpected error occurred',
          code: 'INTERNAL_ERROR'
        },
        { 
          status: 500,
          headers: securityHeaders()
        }
      );
    }
  };
}