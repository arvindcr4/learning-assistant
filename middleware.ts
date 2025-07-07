import { NextRequest, NextResponse } from 'next/server';
import { securityMiddleware, secureResponse } from '@/middleware/security';

export async function middleware(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    // Skip middleware for static files and Next.js internals
    if (request.nextUrl.pathname.startsWith('/_next/') || 
        request.nextUrl.pathname.startsWith('/api/_next/') ||
        request.nextUrl.pathname.includes('.')) {
      return NextResponse.next();
    }
    
    // Apply security middleware first
    const securityResponse = securityMiddleware(request);
    if (securityResponse) {
      // Security middleware blocked the request
      const duration = performance.now() - startTime;
      if (process.env.NODE_ENV === 'development') {
        console.log(`${request.method} ${request.nextUrl.pathname} - BLOCKED - ${duration}ms`);
      }
      return secureResponse(securityResponse, request);
    }
    
    // Continue with the request
    const response = NextResponse.next();
    
    // Apply response security measures
    const securedResponse = secureResponse(response, request);
    
    // Track request completion in development
    if (process.env.NODE_ENV === 'development') {
      const duration = performance.now() - startTime;
      console.log(`${request.method} ${request.nextUrl.pathname} - ${response.status} - ${duration}ms`);
    }
    
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
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};