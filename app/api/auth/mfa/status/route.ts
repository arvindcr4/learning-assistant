import { NextRequest, NextResponse } from 'next/server';
import { withSecureAuth } from '@/middleware/secure-auth';
import { mfaManager } from '@/lib/mfa/mfa-manager';

async function handler(request: NextRequest) {
  try {
    const userId = request.user!.id;
    const status = mfaManager.getMFAStatus(userId);
    
    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('MFA status error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get MFA status',
        code: 'MFA_STATUS_ERROR'
      },
      { status: 500 }
    );
  }
}

export const GET = withSecureAuth(handler, {
  requiredRoles: ['user', 'admin'],
  rateLimits: {
    maxRequestsPerUser: 60,
    maxRequestsPerIP: 30,
    windowMs: 60000, // 1 minute
  },
});