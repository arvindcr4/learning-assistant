import { NextRequest, NextResponse } from 'next/server';
import { withSecureAuth, AuthenticatedRequest } from '@/middleware/secure-auth';
import { securityMonitoringService } from '@/lib/security/security-monitoring';
import { infrastructureSecurityService } from '@/lib/security/infrastructure-security';
import { privacyComplianceService } from '@/lib/security/privacy-compliance';

async function handleGet(request: AuthenticatedRequest) {
  try {
    // Only allow admin users to access security dashboard
    if (request.user!.role !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Access denied',
          code: 'INSUFFICIENT_PERMISSIONS'
        },
        { status: 403 }
      );
    }

    // Get dashboard metrics
    const securityMetrics = securityMonitoringService.getDashboardMetrics();
    
    // Get recent security events
    const recentEvents = securityMonitoringService.getEvents({
      limit: 50,
      timeRange: {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        end: new Date(),
      },
    });

    // Get active alerts
    const activeAlerts = securityMonitoringService.getAlerts({
      resolved: false,
      limit: 20,
    });

    // Get privacy compliance report
    const privacyReport = privacyComplianceService.generateComplianceReport();

    // Get infrastructure security status
    const infrastructureValidation = infrastructureSecurityService.validateConfiguration();

    // Get summary statistics
    const summary = {
      totalEvents24h: recentEvents.length,
      criticalEvents24h: recentEvents.filter(e => e.severity === 'critical').length,
      activeAlerts: activeAlerts.filter(a => !a.acknowledged).length,
      criticalAlerts: activeAlerts.filter(a => a.severity === 'critical' && !a.resolved).length,
      overallRiskScore: securityMetrics.riskScore,
      securityPosture: calculateSecurityPosture(securityMetrics, infrastructureValidation),
    };

    return NextResponse.json({
      success: true,
      data: {
        summary,
        metrics: securityMetrics,
        recentEvents: recentEvents.slice(0, 10), // Latest 10 events
        activeAlerts,
        privacyCompliance: privacyReport,
        infrastructure: {
          status: infrastructureValidation.isValid ? 'secure' : 'needs_attention',
          warnings: infrastructureValidation.warnings.length,
          errors: infrastructureValidation.errors.length,
          recommendations: infrastructureValidation.recommendations.length,
        },
      },
    });
  } catch (error) {
    console.error('Security dashboard error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to load security dashboard',
        code: 'DASHBOARD_ERROR'
      },
      { status: 500 }
    );
  }
}

function calculateSecurityPosture(
  metrics: any, 
  infrastructure: any
): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
  let score = 100;

  // Deduct points for high risk score
  score -= metrics.riskScore * 0.5;

  // Deduct points for critical events
  score -= metrics.severityCounts.critical * 10;
  score -= metrics.severityCounts.high * 5;

  // Deduct points for infrastructure issues
  score -= infrastructure.errors.length * 15;
  score -= infrastructure.warnings.length * 5;

  // Determine posture based on score
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'fair';
  if (score >= 40) return 'poor';
  return 'critical';
}

export const GET = withSecureAuth(handleGet, {
  requiredRoles: ['admin'],
  rateLimits: {
    maxRequestsPerUser: 60,
    maxRequestsPerIP: 30,
    windowMs: 60000, // 1 minute
  },
});