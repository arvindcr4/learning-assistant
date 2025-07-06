// Authentication middleware for API routes
import { NextRequest, NextResponse } from 'next/server';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

// Mock authentication function - replace with actual authentication logic
export async function authenticateToken(token: string): Promise<AuthenticatedRequest['user'] | null> {
  // In a real application, this would validate the JWT token
  // For now, we'll simulate authentication
  if (!token || token === 'invalid') {
    return null;
  }
  
  // Mock user data - replace with actual user lookup
  return {
    id: 'user-123',
    email: 'user@example.com',
    name: 'John Doe',
    role: 'user'
  };
}

// Authentication middleware
export async function authenticateUser(request: NextRequest): Promise<{
  user: AuthenticatedRequest['user'];
  response?: NextResponse;
}> {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('Authorization');
    let token: string | null = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    
    // Also check for token in cookies (for web app)
    if (!token) {
      token = request.cookies.get('auth-token')?.value || null;
    }
    
    // Also check for API key in headers
    if (!token) {
      token = request.headers.get('X-API-Key') || null;
    }
    
    if (!token) {
      return {
        user: null,
        response: NextResponse.json(
          { 
            error: 'Authentication required',
            message: 'Please provide a valid authentication token' 
          },
          { status: 401 }
        )
      };
    }
    
    const user = await authenticateToken(token);
    
    if (!user) {
      return {
        user: null,
        response: NextResponse.json(
          { 
            error: 'Invalid authentication token',
            message: 'The provided token is invalid or expired' 
          },
          { status: 401 }
        )
      };
    }
    
    return { user };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      user: null,
      response: NextResponse.json(
        { 
          error: 'Authentication failed',
          message: 'An error occurred during authentication' 
        },
        { status: 500 }
      )
    };
  }
}

// Authorization middleware
export function authorizeUser(requiredRole?: string) {
  return (user: AuthenticatedRequest['user']): NextResponse | null => {
    if (!user) {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'User not authenticated' 
        },
        { status: 401 }
      );
    }
    
    if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Forbidden',
          message: `Access denied. Required role: ${requiredRole}` 
        },
        { status: 403 }
      );
    }
    
    return null;
  };
}

// Rate limiting middleware
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

export function rateLimit(maxRequests: number = 100, windowMs: number = 60000) {
  return (request: NextRequest): NextResponse | null => {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;
    
    const userLimit = rateLimitMap.get(ip) || { count: 0, lastReset: now };
    
    // Reset if window has passed
    if (userLimit.lastReset < windowStart) {
      userLimit.count = 0;
      userLimit.lastReset = now;
    }
    
    userLimit.count++;
    rateLimitMap.set(ip, userLimit);
    
    if (userLimit.count > maxRequests) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: `Too many requests. Maximum ${maxRequests} requests per ${windowMs / 1000} seconds.`,
          retryAfter: Math.ceil((windowMs - (now - userLimit.lastReset)) / 1000)
        },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((windowMs - (now - userLimit.lastReset)) / 1000).toString(),
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': Math.max(0, maxRequests - userLimit.count).toString(),
            'X-RateLimit-Reset': new Date(userLimit.lastReset + windowMs).toISOString()
          }
        }
      );
    }
    
    return null;
  };
}

// CORS middleware
export function corsHeaders(origin?: string) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Allow-Credentials': 'true'
  };
}

// Combined middleware wrapper
export function withAuth(handler: (request: AuthenticatedRequest) => Promise<NextResponse>) {
  return async (request: NextRequest) => {
    try {
      // Apply rate limiting
      const rateLimitResponse = rateLimit()(request);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }
      
      // Handle preflight requests
      if (request.method === 'OPTIONS') {
        return new NextResponse(null, { 
          status: 200,
          headers: corsHeaders()
        });
      }
      
      // Authenticate user
      const { user, response } = await authenticateUser(request);
      if (response) {
        return response;
      }
      
      // Add user to request
      const authenticatedRequest = request as AuthenticatedRequest;
      authenticatedRequest.user = user;
      
      // Call the handler
      const result = await handler(authenticatedRequest);
      
      // Add CORS headers to response
      Object.entries(corsHeaders()).forEach(([key, value]) => {
        result.headers.set(key, value);
      });
      
      return result;
    } catch (error) {
      console.error('Middleware error:', error);
      return NextResponse.json(
        { 
          error: 'Internal server error',
          message: 'An unexpected error occurred' 
        },
        { status: 500 }
      );
    }
  };
}