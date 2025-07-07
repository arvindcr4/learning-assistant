import { NextRequest, NextResponse } from 'next/server';
import { apm } from '@/lib/apm';
import securityMonitoring from '@/lib/monitoring/security-monitoring';

export async function GET(request: NextRequest) {
  const traceId = apm.startTrace('security_analytics');
  
  try {
    const url = new URL(request.url);
    const timeRange = url.searchParams.get('timeRange') || '24h';
    const severity = url.searchParams.get('severity');
    const eventType = url.searchParams.get('eventType');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    
    // Get security metrics and events
    const metrics = securityMonitoring.getMetrics();
    const recentEvents = securityMonitoring.getRecentEvents(limit);
    const highRiskEvents = securityMonitoring.getHighRiskEvents();
    const threatSummary = securityMonitoring.getThreatSummary();
    
    // Mock additional security data
    const securityData = {
      timestamp: new Date().toISOString(),
      timeRange,
      
      // Current security status
      status: {
        threat_level: threatSummary.high_risk_events > 10 ? 'high' : 
                     threatSummary.high_risk_events > 5 ? 'medium' : 'low',
        active_incidents: highRiskEvents.filter(e => !e.mitigated).length,
        blocked_ips: threatSummary.blocked_ips,
        security_score: Math.max(100 - threatSummary.avg_risk_score, 0),
      },
      
      // Security metrics
      metrics: {
        ...metrics,
        ...threatSummary,
      },
      
      // Recent events
      events: recentEvents.filter(event => {
        if (severity && event.severity !== severity) return false;
        if (eventType && event.type !== eventType) return false;
        return true;
      }),
      
      // High-risk events
      high_risk_events: highRiskEvents,
      
      // Security trends
      trends: {
        threat_volume: {
          current: threatSummary.total_events,
          previous: threatSummary.total_events - 15, // Mock previous period
          change: 15,
          change_percent: 8.5,
        },
        attack_patterns: [
          { type: 'brute_force_attempt', count: 23, trend: 'increasing' },
          { type: 'injection_attempt', count: 12, trend: 'stable' },
          { type: 'suspicious_activity', count: 45, trend: 'decreasing' },
          { type: 'rate_limit_exceeded', count: 67, trend: 'increasing' },
        ],
        geographic_distribution: {
          'United States': 45,
          'China': 23,
          'Russia': 18,
          'Brazil': 8,
          'Other': 6,
        },
      },
      
      // Threat intelligence
      threat_intelligence: {
        known_malicious_ips: 156,
        suspicious_ips: 89,
        blacklisted_domains: 234,
        malware_signatures: 1567,
        last_updated: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      
      // Vulnerability assessment
      vulnerabilities: {
        critical: 2,
        high: 5,
        medium: 12,
        low: 23,
        total: 42,
        remediated: 89,
        remediation_rate: 0.68,
      },
      
      // Security controls effectiveness
      controls: {
        authentication: {
          status: 'effective',
          success_rate: 0.97,
          failure_rate: 0.03,
          mfa_adoption: 0.85,
        },
        authorization: {
          status: 'effective',
          success_rate: 0.99,
          policy_violations: 3,
        },
        network_security: {
          status: 'effective',
          firewall_blocks: 234,
          intrusion_attempts: 45,
          ddos_mitigation: 'active',
        },
        data_protection: {
          status: 'effective',
          encryption_coverage: 0.98,
          data_leaks: 0,
          compliance_score: 0.95,
        },
      },
      
      // Incident response
      incidents: [
        {
          id: 'inc-001',
          title: 'Brute Force Attack Detected',
          severity: 'high',
          status: 'investigating',
          started_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          affected_systems: ['authentication'],
          response_time: 5, // minutes
        },
        {
          id: 'inc-002',
          title: 'Suspicious Data Access Pattern',
          severity: 'medium',
          status: 'monitoring',
          started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          affected_systems: ['database'],
          response_time: 12,
        },
      ],
      
      // Compliance status
      compliance: {
        gdpr: {
          status: 'compliant',
          score: 0.94,
          issues: 2,
          last_audit: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        sox: {
          status: 'compliant',
          score: 0.97,
          issues: 1,
          last_audit: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        },
        pci_dss: {
          status: 'compliant',
          score: 0.92,
          issues: 3,
          last_audit: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        },
      },
      
      // Security recommendations
      recommendations: [
        {
          id: 'rec-001',
          priority: 'high',
          category: 'authentication',
          title: 'Implement additional rate limiting for login endpoints',
          description: 'Current rate limiting may be insufficient for preventing brute force attacks',
          estimated_effort: 'medium',
          risk_reduction: 'high',
        },
        {
          id: 'rec-002',
          priority: 'medium',
          category: 'monitoring',
          title: 'Enhance anomaly detection for user behavior',
          description: 'Implement machine learning-based user behavior analytics',
          estimated_effort: 'high',
          risk_reduction: 'medium',
        },
        {
          id: 'rec-003',
          priority: 'medium',
          category: 'network',
          title: 'Deploy Web Application Firewall (WAF)',
          description: 'Additional protection against common web application attacks',
          estimated_effort: 'medium',
          risk_reduction: 'high',
        },
      ],
      
      // Top attackers
      top_attackers: [
        { ip: '192.168.1.100', events: 23, risk_score: 85, country: 'Unknown', blocked: true },
        { ip: '10.0.0.50', events: 18, risk_score: 72, country: 'US', blocked: false },
        { ip: '172.16.0.25', events: 15, risk_score: 68, country: 'CN', blocked: true },
      ],
      
      // Security alerts
      active_alerts: [
        {
          id: 'alert-sec-001',
          type: 'threat_detection',
          severity: 'high',
          message: 'Multiple failed login attempts from same IP',
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          acknowledged: false,
        },
        {
          id: 'alert-sec-002',
          type: 'anomaly_detection',
          severity: 'medium',
          message: 'Unusual data access pattern detected',
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          acknowledged: true,
        },
      ],
    };
    
    apm.endTrace(traceId, { 
      timeRange, 
      severity, 
      eventType,
      totalEvents: securityData.events.length,
      threatLevel: securityData.status.threat_level,
      success: true 
    });
    
    return NextResponse.json(securityData, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
    
  } catch (error) {
    apm.endTrace(traceId, { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    
    console.error('Security analytics error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to retrieve security analytics data',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const traceId = apm.startTrace('security_event_tracking');
  
  try {
    const body = await request.json();
    const { 
      type, 
      severity, 
      source, 
      target, 
      details 
    } = body;
    
    if (!type || !severity || !source || !target) {
      return NextResponse.json(
        { error: 'Missing required fields: type, severity, source, target' },
        { status: 400 }
      );
    }
    
    // Track the security event
    const event = securityMonitoring.trackEvent({
      type,
      severity,
      source,
      target,
      details: details || {},
    });
    
    apm.endTrace(traceId, { 
      eventType: type, 
      severity, 
      riskScore: event.risk_score,
      success: true 
    });
    
    return NextResponse.json(
      { 
        message: 'Security event tracked successfully',
        event: {
          id: event.id,
          type: event.type,
          severity: event.severity,
          risk_score: event.risk_score,
          timestamp: event.timestamp,
        },
      },
      { status: 201 }
    );
    
  } catch (error) {
    apm.endTrace(traceId, { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    
    console.error('Security event tracking error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to track security event',
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}