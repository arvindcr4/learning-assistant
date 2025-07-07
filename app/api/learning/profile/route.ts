import { NextRequest, NextResponse } from 'next/server';

import { withSecureAuth, AuthenticatedRequest } from '@/middleware/secure-auth';
import { csrfProtection } from '@/lib/csrf';

async function handleGET(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
    const user = request.user!;
    
    // Mock learning profile data
    const profile = {
      id: `profile-${user.id}`,
      userId: user.id,
      learningStyle: 'visual',
      preferences: {
        difficulty: 'intermediate',
        pace: 'normal',
        subjects: ['mathematics', 'science'],
      },
      progress: {
        completedLessons: 45,
        totalLessons: 100,
        averageScore: 85,
      },
      lastActivity: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

async function handlePOST(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
    const user = request.user!;
    
    // Validate CSRF token
    const csrfToken = csrfProtection.getTokenFromRequest(request);
    if (!csrfToken || !csrfProtection.validateToken(csrfToken, user.sessionId)) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { learningStyle, preferences } = body;

    // Validate input
    if (!learningStyle || !preferences) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Mock profile creation/update
    const updatedProfile = {
      id: `profile-${user.id}`,
      userId: user.id,
      learningStyle,
      preferences,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: updatedProfile,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

// Export with secure authentication middleware
export const GET = withSecureAuth(handleGET, {
  requiredRoles: ['user', 'admin'],
  rateLimits: {
    maxRequestsPerUser: 100,
    maxRequestsPerIP: 50,
    windowMs: 60000, // 1 minute
  },
});

export const POST = withSecureAuth(handlePOST, {
  requiredRoles: ['user', 'admin'],
  rateLimits: {
    maxRequestsPerUser: 50,
    maxRequestsPerIP: 25,
    windowMs: 60000, // 1 minute
  },
});