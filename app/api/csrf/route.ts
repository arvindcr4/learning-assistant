import { NextRequest, NextResponse } from 'next/server';

import { csrfProtection } from '@/lib/csrf';
import { authenticateUser } from '@/middleware/secure-auth';

export async function GET(request: NextRequest) {
  try {
    // Get user session if available
    const { user } = await authenticateUser(request);
    const sessionId = user?.sessionId;

    // Generate CSRF token
    const csrfToken = csrfProtection.generateToken(sessionId);

    // Return token with appropriate headers
    const response = NextResponse.json({
      csrfToken,
      success: true,
    });

    // Set CSRF token in headers for client access
    response.headers.set('X-CSRF-Token', csrfToken);
    
    // Security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error) {
    console.error('CSRF token generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'];
  const isAllowedOrigin = origin && allowedOrigins.includes(origin);
  
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': isAllowedOrigin ? origin : allowedOrigins[0]!,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}