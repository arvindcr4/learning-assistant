import { NextRequest, NextResponse } from 'next/server';
import { withSecureAuth, AuthenticatedRequest } from '@/middleware/secure-auth';
import { privacyComplianceService } from '@/lib/security/privacy-compliance';
import { z } from 'zod';

const exportRequestSchema = z.object({
  format: z.enum(['json', 'csv', 'xml']).optional().default('json'),
});

async function handlePost(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { format } = exportRequestSchema.parse(body);
    
    const userId = request.user!.id;
    
    // Log the data processing activity
    privacyComplianceService.logDataProcessing({
      userId,
      dataType: 'user_data',
      purpose: 'data_export',
      legalBasis: 'consent',
      processedBy: 'export_service',
      retentionPeriod: 30, // Export files kept for 30 days
    });
    
    const requestId = await privacyComplianceService.requestDataExport(userId, format);
    
    return NextResponse.json({
      success: true,
      message: 'Data export request submitted',
      requestId,
      estimatedCompletion: '24 hours',
    });
  } catch (error) {
    console.error('Data export request error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid export request',
          details: error.errors,
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }
    
    if (error instanceof Error && error.message.includes('not enabled')) {
      return NextResponse.json(
        { 
          error: 'Data export is not available',
          code: 'FEATURE_DISABLED'
        },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to process export request',
        code: 'EXPORT_ERROR'
      },
      { status: 500 }
    );
  }
}

async function handleGet(request: AuthenticatedRequest) {
  try {
    const userId = request.user!.id;
    
    // Get user's export request status
    // In a real implementation, you would query the database for requests
    // For now, we'll return a placeholder
    
    return NextResponse.json({
      success: true,
      data: {
        requests: [], // Would contain actual export requests
        message: 'No export requests found',
      },
    });
  } catch (error) {
    console.error('Export status retrieval error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to retrieve export status',
        code: 'EXPORT_STATUS_ERROR'
      },
      { status: 500 }
    );
  }
}

export const POST = withSecureAuth(handlePost, {
  requiredRoles: ['user', 'admin'],
  rateLimits: {
    maxRequestsPerUser: 3, // Very limited - only 3 export requests per user per day
    maxRequestsPerIP: 5,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
  },
});

export const GET = withSecureAuth(handleGet, {
  requiredRoles: ['user', 'admin'],
  rateLimits: {
    maxRequestsPerUser: 10,
    maxRequestsPerIP: 5,
    windowMs: 60000, // 1 minute
  },
});