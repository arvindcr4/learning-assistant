import { NextRequest, NextResponse } from 'next/server';
import { withSecureAuth, AuthenticatedRequest } from '@/middleware/secure-auth';
import { privacyComplianceService } from '@/lib/security/privacy-compliance';
import { z } from 'zod';

const deletionRequestSchema = z.object({
  reason: z.string().max(500).optional(),
  confirmPassword: z.string().min(1),
});

const verificationSchema = z.object({
  requestId: z.string(),
  verificationCode: z.string(),
});

async function handlePost(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { reason, confirmPassword } = deletionRequestSchema.parse(body);
    
    const userId = request.user!.id;
    
    // In a real implementation, you would verify the password here
    // For now, we'll just check it's not empty
    if (!confirmPassword) {
      return NextResponse.json(
        { 
          error: 'Password confirmation required',
          code: 'PASSWORD_REQUIRED'
        },
        { status: 400 }
      );
    }
    
    // Log the data processing activity
    privacyComplianceService.logDataProcessing({
      userId,
      dataType: 'deletion_request',
      purpose: 'right_to_erasure',
      legalBasis: 'consent',
      processedBy: 'deletion_service',
      retentionPeriod: 90, // Keep deletion requests for 90 days
    });
    
    const requestId = await privacyComplianceService.requestDataDeletion(userId, reason);
    
    return NextResponse.json({
      success: true,
      message: 'Data deletion request submitted. Please check your email for verification instructions.',
      requestId,
      warning: 'This action cannot be undone. All your data will be permanently deleted.',
    });
  } catch (error) {
    console.error('Data deletion request error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid deletion request',
          details: error.errors,
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to process deletion request',
        code: 'DELETION_ERROR'
      },
      { status: 500 }
    );
  }
}

async function handlePatch(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { requestId, verificationCode } = verificationSchema.parse(body);
    
    const success = await privacyComplianceService.verifyDataDeletion(requestId, verificationCode);
    
    if (!success) {
      return NextResponse.json(
        { 
          error: 'Invalid verification code or request',
          code: 'VERIFICATION_FAILED'
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Data deletion verified and initiated. Your data will be permanently deleted within 30 days.',
      warning: 'Your account will be deactivated and you will be logged out.',
    });
  } catch (error) {
    console.error('Data deletion verification error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid verification data',
          details: error.errors,
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to verify deletion request',
        code: 'VERIFICATION_ERROR'
      },
      { status: 500 }
    );
  }
}

export const POST = withSecureAuth(handlePost, {
  requiredRoles: ['user', 'admin'],
  rateLimits: {
    maxRequestsPerUser: 2, // Very limited - only 2 deletion requests per user per day
    maxRequestsPerIP: 3,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
  },
});

export const PATCH = withSecureAuth(handlePatch, {
  requiredRoles: ['user', 'admin'],
  rateLimits: {
    maxRequestsPerUser: 5,
    maxRequestsPerIP: 5,
    windowMs: 60000, // 1 minute
  },
});