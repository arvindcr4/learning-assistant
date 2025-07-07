import { NextRequest, NextResponse } from 'next/server';
import { withSecureAuth, AuthenticatedRequest } from '@/middleware/secure-auth';
import { csrfProtection } from '@/lib/csrf';

async function handlePOST(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
    const user = request.user!;
    
    // Validate CSRF token for state-changing operations
    const csrfToken = csrfProtection.getTokenFromRequest(request);
    if (!csrfToken || !csrfProtection.validateToken(csrfToken, user.sessionId)) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { sessionData } = body;

    // Validate session data
    if (!sessionData || !sessionData.contentId || !sessionData.duration) {
      return NextResponse.json(
        { error: 'Invalid session data' },
        { status: 400 }
      );
    }

    // Mock learning session processing
    const processedSession = {
      id: `session-${Date.now()}`,
      userId: user.id,
      contentId: sessionData.contentId,
      duration: sessionData.duration,
      score: sessionData.score || 0,
      completed: true,
      processedAt: new Date().toISOString(),
      insights: {
        learningEfficiency: 85,
        recommendedBreak: false,
        nextDifficulty: 'intermediate',
      },
    };

    return NextResponse.json({
      success: true,
      data: processedSession,
      message: 'Session processed successfully',
    });
  } catch (error) {
    console.error('Session processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process session' },
      { status: 500 }
    );
  }
}

// Export with secure authentication middleware
export const POST = withSecureAuth(handlePOST, {
  requiredRoles: ['user', 'admin'],
  rateLimits: {
    maxRequestsPerUser: 200,
    maxRequestsPerIP: 100,
    windowMs: 60000, // 1 minute
  },
});