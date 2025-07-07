import { NextRequest, NextResponse } from 'next/server';
import { securityMiddleware, secureResponse } from '@/middleware/security';
// import { logError } from '@/lib/logger'; // Removed due to Edge Runtime compatibility
// import { apm } from '@/lib/apm'; // Removed due to Edge Runtime compatibility

export async function middleware(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    // Track request start (APM disabled in Edge Runtime)
    // const traceId = apm.startTrace('middleware_request', {
    //   method: request.method,
    //   path: request.nextUrl.pathname,
    //   userAgent: request.headers.get('user-agent'),
    // });
    
    // Apply security middleware
    const securityResponse = securityMiddleware(request);
    if (securityResponse) {
      // Security middleware blocked the request
      const duration = performance.now() - startTime;
      
      // apm.endTrace(traceId, {
      //   statusCode: securityResponse.status,
      //   blocked: true,
      //   duration,
      // });
      
      // Log blocked request
      console.log(`${request.method} ${request.nextUrl.pathname} - BLOCKED - ${duration}ms`);
      
      return secureResponse(securityResponse, request);
    }
    
    // Continue with the request
    const response = NextResponse.next();
    
    // Apply response security measures
    const securedResponse = secureResponse(response, request);
    
    // Track request completion
    const duration = performance.now() - startTime;
    
    // apm.endTrace(traceId, {
    //   statusCode: response.status,
    //   blocked: false,
    //   duration,
    // });
    
    // Log API request
    console.log(`${request.method} ${request.nextUrl.pathname} - ${response.status} - ${duration}ms`);
    
    return securedResponse;
    
  } catch (error) {
    // Log error
    console.error('Middleware error:', error instanceof Error ? error.message : 'Unknown error');
    
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