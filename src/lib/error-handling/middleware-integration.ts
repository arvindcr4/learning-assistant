import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { 
  captureApiError, 
  captureAuthError, 
  setSentryUser,
  addNavigationBreadcrumb 
} from './sentry-utils';
import { globalErrorHandler } from './index';

// Enhanced middleware error handling with Sentry integration
export function withSentryMiddleware(
  middleware: (req: NextRequest) => NextResponse | Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();
    const requestId = `req-${startTime}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Set request context for Sentry
    Sentry.withScope((scope) => {
      scope.setTag('middleware', 'true');
      scope.setTag('request_id', requestId);
      scope.setTag('method', req.method);
      scope.setTag('url', req.url);
      
      scope.setContext('request', {
        id: requestId,
        method: req.method,
        url: req.url,
        headers: Object.fromEntries(req.headers.entries()),
        timestamp: new Date().toISOString(),
      });
      
      // Add navigation breadcrumb
      addNavigationBreadcrumb(
        req.headers.get('referer') || 'unknown',
        req.url,
        { method: req.method }
      );
    });

    try {
      const response = await middleware(req);
      const duration = Date.now() - startTime;
      
      // Log successful requests in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[MIDDLEWARE] ${req.method} ${req.url} - ${response.status} (${duration}ms)`);
      }
      
      // Add request tracking headers
      response.headers.set('X-Request-ID', requestId);
      response.headers.set('X-Response-Time', `${duration}ms`);
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Capture middleware error
      const errorId = captureApiError(error as Error, {
        url: req.url,
        method: req.method,
        duration,
      });
      
      // Handle the error through global error handler
      const errorResponse = globalErrorHandler.handleError(error, {
        url: req.url,
        method: req.method,
        headers: req.headers,
        requestId,
      });
      
      // Add error tracking headers
      errorResponse.headers.set('X-Request-ID', requestId);
      errorResponse.headers.set('X-Error-ID', errorId);
      errorResponse.headers.set('X-Response-Time', `${duration}ms`);
      
      return errorResponse;
    }
  };
}

// Authentication middleware integration
export function withAuthErrorHandling(
  authMiddleware: (req: NextRequest) => NextResponse | Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      return await authMiddleware(req);
    } catch (error) {
      const errorId = captureAuthError(error as Error, {
        action: 'middleware_auth',
        provider: 'session',
      });
      
      console.error(`[AUTH_MIDDLEWARE] Error: ${error}`, { errorId });
      
      // Return unauthorized response
      return new NextResponse('Authentication failed', { 
        status: 401,
        headers: {
          'X-Error-ID': errorId,
        },
      });
    }
  };
}

// Rate limiting middleware integration
export function withRateLimitErrorHandling(
  rateLimitMiddleware: (req: NextRequest) => NextResponse | null
) {
  return (req: NextRequest): NextResponse | null => {
    try {
      const response = rateLimitMiddleware(req);
      
      // If rate limited, add tracking
      if (response && response.status === 429) {
        Sentry.addBreadcrumb({
          message: 'Rate limit exceeded',
          category: 'security',
          level: 'warning',
          data: {
            ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
            path: req.nextUrl.pathname,
            userAgent: req.headers.get('user-agent'),
          },
        });
      }
      
      return response;
    } catch (error) {
      console.error('[RATE_LIMIT_MIDDLEWARE] Error:', error);
      
      // Don't block request if rate limiting fails
      return null;
    }
  };
}

// Security middleware integration
export function withSecurityErrorHandling(
  securityMiddleware: (req: NextRequest) => NextResponse | null
) {
  return (req: NextRequest): NextResponse | null => {
    try {
      const response = securityMiddleware(req);
      
      // If blocked by security, add tracking
      if (response && response.status === 403) {
        Sentry.addBreadcrumb({
          message: 'Security violation detected',
          category: 'security',
          level: 'error',
          data: {
            ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
            path: req.nextUrl.pathname,
            userAgent: req.headers.get('user-agent'),
            reason: 'security_middleware_block',
          },
        });
      }
      
      return response;
    } catch (error) {
      console.error('[SECURITY_MIDDLEWARE] Error:', error);
      
      // Log security middleware errors but don't block
      Sentry.captureException(error, {
        tags: {
          middleware: 'security',
          error_type: 'security_middleware_error',
        },
      });
      
      return null;
    }
  };
}

// Learning session middleware integration
export function withLearningSessionTracking(
  sessionMiddleware: (req: NextRequest) => NextResponse | Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    // Extract session information from request
    const sessionId = req.headers.get('x-learning-session-id') || 
                     req.cookies.get('learning-session-id')?.value;
    const userId = req.headers.get('x-user-id') || 
                  req.cookies.get('user-id')?.value;
    
    if (sessionId) {
      Sentry.withScope((scope) => {
        scope.setTag('learning_session_id', sessionId);
        
        if (userId) {
          setSentryUser({ id: userId });
        }
        
        scope.setContext('learning_session', {
          id: sessionId,
          userId,
          timestamp: new Date().toISOString(),
        });
      });
    }
    
    try {
      return await sessionMiddleware(req);
    } catch (error) {
      // Capture learning session specific errors
      Sentry.withScope((scope) => {
        scope.setTag('error_type', 'learning_session_error');
        
        if (sessionId) {
          scope.setTag('learning_session_id', sessionId);
          scope.setContext('learning_session', {
            id: sessionId,
            userId,
            error_context: 'middleware',
          });
        }
        
        Sentry.captureException(error);
      });
      
      throw error;
    }
  };
}

// API route error handling wrapper
export function withApiErrorHandling(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();
    const requestId = `api-${startTime}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const response = await handler(req);
      const duration = Date.now() - startTime;
      
      // Track successful API calls
      if (response.status >= 400) {
        captureApiError(new Error(`API Error: ${response.status}`), {
          url: req.url,
          method: req.method,
          statusCode: response.status,
          duration,
        });
      }
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      const errorId = captureApiError(error as Error, {
        url: req.url,
        method: req.method,
        duration,
      });
      
      console.error(`[API_ERROR] ${req.method} ${req.url}:`, error, { errorId });
      
      return globalErrorHandler.handleError(error, {
        url: req.url,
        method: req.method,
        headers: req.headers,
        requestId,
      });
    }
  };
}

// Composite middleware wrapper
export function withEnhancedErrorHandling(
  middleware: (req: NextRequest) => NextResponse | Promise<NextResponse>
) {
  return withSentryMiddleware(
    withAuthErrorHandling(
      withLearningSessionTracking(middleware)
    )
  );
}

export default {
  withSentryMiddleware,
  withAuthErrorHandling,
  withRateLimitErrorHandling,
  withSecurityErrorHandling,
  withLearningSessionTracking,
  withApiErrorHandling,
  withEnhancedErrorHandling,
};