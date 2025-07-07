import { NextRequest, NextResponse } from 'next/server';
import { withSecureAuth } from '@/middleware/secure-auth';
import { privacyComplianceService } from '@/lib/security/privacy-compliance';
import { z } from 'zod';

const consentSchema = z.object({
  type: z.enum(['necessary', 'analytics', 'marketing', 'personalization']),
  granted: z.boolean(),
});

const multipleConsentSchema = z.object({
  consents: z.array(consentSchema),
});

async function handlePost(request: NextRequest) {
  try {
    const body = await request.json();
    const { consents } = multipleConsentSchema.parse(body);
    
    const userId = request.user!.id;
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || '';
    
    const consentIds: string[] = [];
    
    for (const consent of consents) {
      const consentId = privacyComplianceService.recordConsent({
        userId,
        type: consent.type,
        granted: consent.granted,
        ipAddress,
        userAgent,
      });
      consentIds.push(consentId);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Consent preferences updated',
      consentIds,
    });
  } catch (error) {
    console.error('Consent recording error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid consent data',
          details: error.errors,
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to record consent',
        code: 'CONSENT_ERROR'
      },
      { status: 500 }
    );
  }
}

async function handleGet(request: NextRequest) {
  try {
    const userId = request.user!.id;
    const consentHistory = privacyComplianceService.getConsentHistory(userId);
    
    // Get current consent status for each type
    const currentConsents = {
      necessary: privacyComplianceService.hasConsent(userId, 'necessary'),
      analytics: privacyComplianceService.hasConsent(userId, 'analytics'),
      marketing: privacyComplianceService.hasConsent(userId, 'marketing'),
      personalization: privacyComplianceService.hasConsent(userId, 'personalization'),
    };
    
    return NextResponse.json({
      success: true,
      data: {
        current: currentConsents,
        history: consentHistory.map(consent => ({
          type: consent.type,
          granted: consent.granted,
          timestamp: consent.timestamp,
          version: consent.version,
          expiresAt: consent.expiresAt,
        })),
      },
    });
  } catch (error) {
    console.error('Consent retrieval error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to retrieve consent data',
        code: 'CONSENT_RETRIEVAL_ERROR'
      },
      { status: 500 }
    );
  }
}

export const POST = withSecureAuth(handlePost, {
  requiredRoles: ['user', 'admin'],
  rateLimits: {
    maxRequestsPerUser: 10,
    maxRequestsPerIP: 5,
    windowMs: 60000, // 1 minute
  },
});

export const GET = withSecureAuth(handleGet, {
  requiredRoles: ['user', 'admin'],
  rateLimits: {
    maxRequestsPerUser: 30,
    maxRequestsPerIP: 20,
    windowMs: 60000, // 1 minute
  },
});