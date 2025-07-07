import { NextRequest, NextResponse } from 'next/server';

import { sessionManager } from '@/lib/session-manager';
import { env } from '@/lib/env-validation';

export async function GET(request: NextRequest) {
  try {
    // Get session statistics
    const sessionStats = await sessionManager.getSessionStats();
    
    // Basic health information
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime ? Math.floor(process.uptime()) : 0,
      security: {
        activeSessions: sessionStats.totalActiveSessions,
        uniqueUsers: sessionStats.uniqueUsers,
        blacklistedTokens: sessionStats.blacklistedTokens,
        securityEvents: sessionStats.securityEvents,
      },
      features: {
        jwtEnabled: true,
        csrfEnabled: true,
        sessionManagement: true,
        rateLimiting: true,
        roleBasedAccess: true,
      },
    };

    const response = NextResponse.json(health);
    
    // Add security headers even to health endpoint
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    return response;
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { 
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}