import { NextRequest, NextResponse } from 'next/server';
import { withSecureAuth, AuthenticatedRequest } from '@/middleware/secure-auth';
import * as Sentry from '@sentry/nextjs';
import { withSentryErrorHandler, createApiError, ErrorCategory, ErrorSeverity } from '@/middleware/sentry-error-handler';

/**
 * Sentry monitoring tunnel endpoint
 * This endpoint serves as a tunnel for Sentry requests to bypass ad blockers
 * Only accessible by admin users for security reasons
 */
async function handlePost(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
    // Only admin users can access the monitoring tunnel
    if (request.user!.role !== 'admin') {
      throw createApiError(
        'Access denied to monitoring tunnel',
        403,
        'INSUFFICIENT_PERMISSIONS'
      );
    }

    const body = await request.text();
    const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    
    if (!sentryDsn) {
      throw createApiError(
        'Sentry DSN not configured',
        500,
        'SENTRY_NOT_CONFIGURED'
      );
    }

    // Extract the Sentry project ID from DSN
    const sentryUrl = new URL(sentryDsn);
    const projectId = sentryUrl.pathname.substring(1);
    
    // Forward the request to Sentry
    const sentryEndpoint = `https://sentry.io/api/${projectId}/envelope/`;
    
    const response = await fetch(sentryEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'User-Agent': request.headers.get('User-Agent') || 'Learning-Assistant/1.0',
      },
      body,
    });

    if (!response.ok) {
      throw createApiError(
        `Sentry tunnel failed: ${response.statusText}`,
        response.status,
        'SENTRY_TUNNEL_FAILED'
      );
    }

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    // This error will be caught by the Sentry error handler middleware
    throw error;
  }
}

/**
 * Health check endpoint for Sentry monitoring
 * Only accessible by admin users
 */
async function handleGet(request: AuthenticatedRequest): Promise<NextResponse> {
  // Only admin users can access monitoring endpoints
  if (request.user!.role !== 'admin') {
    throw createApiError(
      'Access denied to monitoring endpoints',
      403,
      'INSUFFICIENT_PERMISSIONS'
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'test-error':
        // Test error reporting (only for admins)
        throw createApiError(
          'This is a test error for Sentry monitoring',
          500,
          'TEST_ERROR',
          { 
            testData: { 
              timestamp: Date.now(), 
              userAgent: request.headers.get('User-Agent'),
              adminId: request.user!.id 
            } 
          }
        );

      case 'test-warning':
        // Test warning reporting
        Sentry.captureMessage('This is a test warning for Sentry monitoring', 'warning');
        return NextResponse.json({
          message: 'Test warning sent to Sentry',
          timestamp: new Date().toISOString(),
        });

      case 'test-performance':
        // Test performance monitoring
        const result = await Sentry.startSpan({
          name: 'test-performance',
          op: 'test',
        }, async () => {
          // Simulate some work
          await new Promise(resolve => setTimeout(resolve, 100));
          return { duration: '100ms' };
        });
        
        return NextResponse.json({
          message: 'Performance test completed',
          duration: result.duration,
          timestamp: new Date().toISOString(),
        });

      case 'health':
      default:
        return NextResponse.json({
          status: 'healthy',
          sentry: {
            configured: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
            environment: process.env.NODE_ENV,
            release: process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
          },
          timestamp: new Date().toISOString(),
        });
    }
  } catch (error) {
    // This error will be caught by the Sentry error handler middleware
    throw error;
  }
}

// Export handlers with secure authentication and Sentry error handling
export const GET = withSecureAuth(withSentryErrorHandler(handleGet), {
  requiredRoles: ['admin'],
  rateLimits: {
    maxRequestsPerUser: 20,
    maxRequestsPerIP: 10,
    windowMs: 60000, // 1 minute
  },
});

export const POST = withSecureAuth(withSentryErrorHandler(handlePost), {
  requiredRoles: ['admin'],
  rateLimits: {
    maxRequestsPerUser: 10,
    maxRequestsPerIP: 5,
    windowMs: 60000, // 1 minute
  },
});