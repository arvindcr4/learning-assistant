import { NextRequest, NextResponse } from 'next/server';
import { withSecureAuth } from '@/middleware/secure-auth';
import { mfaManager } from '@/lib/mfa/mfa-manager';
import { z } from 'zod';

const verifySchema = z.object({
  deviceId: z.string().optional(),
  challengeId: z.string().optional(),
  token: z.string().min(6).max(8),
  setup: z.boolean().optional(),
});

async function handler(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, challengeId, token, setup } = verifySchema.parse(body);
    
    const userId = request.user!.id;
    
    // If this is setup verification
    if (setup && deviceId) {
      const isValid = await mfaManager.verifyTOTPSetup(deviceId, token);
      
      if (!isValid) {
        return NextResponse.json(
          { 
            error: 'Invalid verification code',
            code: 'INVALID_VERIFICATION_CODE'
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: 'MFA device successfully activated',
      });
    }
    
    // If this is challenge verification
    if (challengeId) {
      const result = await mfaManager.verifyChallenge(challengeId, token);
      
      if (!result.isValid) {
        return NextResponse.json(
          { 
            error: 'Invalid verification code',
            code: 'INVALID_VERIFICATION_CODE',
            remainingAttempts: result.remainingAttempts,
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: 'MFA verification successful',
        challenge: result.challenge,
      });
    }
    
    // Create new challenge if no challengeId provided
    const challenge = await mfaManager.createChallenge(userId, deviceId);
    
    if (!challenge) {
      return NextResponse.json(
        { 
          error: 'No MFA devices available',
          code: 'NO_MFA_DEVICES'
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      challenge: {
        id: challenge.id,
        type: challenge.type,
        expiresAt: challenge.expiresAt,
        remainingAttempts: challenge.maxAttempts - challenge.attempts,
      },
    });
  } catch (error) {
    console.error('MFA verification error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors,
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to verify MFA',
        code: 'MFA_VERIFICATION_ERROR'
      },
      { status: 500 }
    );
  }
}

export const POST = withSecureAuth(handler, {
  requiredRoles: ['user', 'admin'],
  rateLimits: {
    maxRequestsPerUser: 30,
    maxRequestsPerIP: 20,
    windowMs: 60000, // 1 minute
  },
});