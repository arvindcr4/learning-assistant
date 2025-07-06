import { NextRequest, NextResponse } from 'next/server';
import { securityMiddleware, secureResponse } from '@/middleware/security';
import { loggerUtils } from '@/lib/logger';
import { apm } from '@/lib/apm';

export async function middleware(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    // Track request start
    const traceId = apm.startTrace('middleware_request', {
      method: request.method,
      path: request.nextUrl.pathname,
      userAgent: request.headers.get('user-agent'),
    });
    
    // Apply security middleware
    const securityResponse = securityMiddleware(request);
    if (securityResponse) {
      // Security middleware blocked the request
      const duration = performance.now() - startTime;
      
      apm.endTrace(traceId, {
        statusCode: securityResponse.status,
        blocked: true,
        duration,
      });
      
      loggerUtils.logApiRequest(
        request.method,
        request.nextUrl.pathname,
        undefined,
        duration
      );
      
      return secureResponse(securityResponse, request);
    }
    
    // Continue with the request
    const response = NextResponse.next();
    
    // Apply response security measures
    const securedResponse = secureResponse(response, request);
    
    // Track request completion
    const duration = performance.now() - startTime;
    
    apm.endTrace(traceId, {
      statusCode: response.status,
      blocked: false,
      duration,
    });
    
    // Log API request
    loggerUtils.logApiRequest(
      request.method,
      request.nextUrl.pathname,
      undefined,
      duration
    );
    
    return securedResponse;
    
  } catch (error) {
    // Log error
    loggerUtils.logError(
      error instanceof Error ? error : new Error('Unknown middleware error'),
      'middleware',
      undefined,
      {
        method: request.method,
        path: request.nextUrl.pathname,
        userAgent: request.headers.get('user-agent'),
      }
    );
    
    // Return error response with security headers
    const errorResponse = new NextResponse('Internal Server Error', { status: 500 });
    return secureResponse(errorResponse, request);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};