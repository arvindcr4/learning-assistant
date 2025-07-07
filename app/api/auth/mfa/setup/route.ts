import { NextRequest, NextResponse } from 'next/server';
import { withSecureAuth } from '@/middleware/secure-auth';
import { mfaManager } from '@/lib/mfa/mfa-manager';
import { z } from 'zod';

const setupSchema = z.object({
  type: z.enum(['totp', 'backup_codes']),
  deviceName: z.string().min(1).max(100).optional(),
});

async function handler(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, deviceName } = setupSchema.parse(body);
    
    const userId = request.user!.id;
    
    let result;
    
    switch (type) {
      case 'totp':
        result = await mfaManager.setupTOTP(userId, deviceName || 'Authenticator App');
        break;
        
      case 'backup_codes':
        result = await mfaManager.setupBackupCodes(userId);
        break;
        
      default:
        return NextResponse.json(
          { error: 'Unsupported MFA type', code: 'INVALID_MFA_TYPE' },
          { status: 400 }
        );
    }
    
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    
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
        error: 'Failed to setup MFA',
        code: 'MFA_SETUP_ERROR'
      },
      { status: 500 }
    );
  }
}

export const POST = withSecureAuth(handler, {
  requiredRoles: ['user', 'admin'],
  rateLimits: {
    maxRequestsPerUser: 10,
    maxRequestsPerIP: 5,
    windowMs: 60000, // 1 minute
  },
});