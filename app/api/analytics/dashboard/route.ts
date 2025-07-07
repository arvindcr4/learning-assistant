import { NextRequest, NextResponse } from 'next/server';
import { apm } from '@/lib/apm';
import { monitoring } from '@/lib/monitoring';
import { metricsUtils } from '@/lib/metrics';

export async function GET(request: NextRequest) {
  const traceId = apm.startTrace('analytics_dashboard');
  
  try {
    const url = new URL(request.url);
    const timeRange = url.searchParams.get('timeRange') || '24h';
    const metrics = url.searchParams.get('metrics')?.split(',') || [];
    
    // Get monitoring state
    const monitoringState = monitoring.getState();
    const performanceMetrics = apm.getMetrics();
    
    // Mock data for different time ranges (in production, this would come from your database)
    const dashboardData = {
      timestamp: new Date().toISOString(),
      timeRange,
      
      // User Analytics
      userMetrics: {
        totalUsers: 1250,
        activeUsers: 89,
        newUsers: 12,
        retentionRate: 0.78,
        averageSessionTime: 1800, // 30 minutes
        bounceRate: 0.24,
      },
      
      // Learning Analytics
      learningMetrics: {
        totalSessions: 2340,
        completionRate: 0.85,
        averageScore: 78.5,
        totalAssessments: 1890,
        adaptiveChanges: 156,
        contentViews: 4560,
        learningPathsCompleted: 89,
      },
      
      // Performance Metrics
      performanceMetrics: {
        ...performanceMetrics,
        responseTime: {
          average: 245,
          p95: 580,
          p99: 1200,
        },
        errorRate: monitoringState.errorCount,
        throughput: 450, // requests per minute
        availability: 99.9,
      },
      
      // Infrastructure Metrics
      infrastructureMetrics: {
        memoryUsage: performanceMetrics.memoryUsage || 0,
        cpuUsage: performanceMetrics.cpuUsage || 0,
        diskUsage: 0.65,
        networkIO: {
          inbound: 1.2, // MB/s
          outbound: 0.8, // MB/s
        },
        databaseConnections: 15,
      },
      
      // Cost Metrics
      costMetrics: {
        totalCost: 287.50,
        breakdown: {
          compute: 156.80,
          database: 78.20,
          storage: 23.10,
          network: 18.40,
          monitoring: 11.00,
        },
        dailyCost: 9.58,
        projection: 287.50,
      },
      
      // Security Metrics
      securityMetrics: {
        securityEvents: monitoringState.securityEvents,
        failedLogins: 8,
        suspiciousActivity: 2,
        blockedRequests: 45,
        threatLevel: 'low',
      },
      
      // Error Tracking
      errorMetrics: {
        totalErrors: monitoringState.errorCount,
        errorRate: (monitoringState.errorCount / (performanceMetrics.requests || 1)) * 100,
        criticalErrors: 2,
        warnings: 12,
        resolved: 89,
      },
      
      // Top Content
      topContent: [
        { id: 'math-101', title: 'Introduction to Calculus', views: 245, completion: 0.89 },
        { id: 'physics-201', title: 'Quantum Physics Basics', views: 189, completion: 0.76 },
        { id: 'cs-101', title: 'Data Structures', views: 156, completion: 0.92 },
        { id: 'bio-101', title: 'Cell Biology', views: 134, completion: 0.83 },
      ],
      
      // Recent Activities
      recentActivities: [
        { timestamp: new Date().toISOString(), type: 'completion', user: 'user123', content: 'Linear Algebra Quiz' },
        { timestamp: new Date(Date.now() - 300000).toISOString(), type: 'registration', user: 'user456', content: 'New user registration' },
        { timestamp: new Date(Date.now() - 600000).toISOString(), type: 'adaptive', user: 'user789', content: 'Difficulty adjusted for Physics' },
      ],
      
      // Learning Styles Distribution
      learningStylesDistribution: {
        visual: 35,
        auditory: 28,
        kinesthetic: 22,
        reading: 15,
      },
      
      // Device Analytics
      deviceAnalytics: {
        desktop: 45,
        mobile: 38,
        tablet: 17,
      },
      
      // Geographic Distribution
      geographicDistribution: {
        'North America': 45,
        'Europe': 28,
        'Asia': 18,
        'Other': 9,
      },
      
      // Alerts
      activeAlerts: [
        {
          id: 'alert-001',
          type: 'performance',
          severity: 'warning',
          message: 'Response time increased by 15% in the last hour',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
        },
        {
          id: 'alert-002',
          type: 'cost',
          severity: 'info',
          message: 'Monthly cost projection exceeds budget by 5%',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
      ],
    };
    
    // Filter metrics if specified with type safety
    let filteredData: any = dashboardData;
    if (metrics.length > 0) {
      const filtered: any = {
        timestamp: dashboardData.timestamp,
        timeRange: dashboardData.timeRange
      };
      
      metrics.forEach(metric => {
        if (metric && typeof metric === 'string' && metric in dashboardData) {
          filtered[metric] = dashboardData[metric as keyof typeof dashboardData];
        }
      });
      
      filteredData = filtered;
    }
    
    apm.endTrace(traceId, { 
      timeRange, 
      metricsRequested: metrics.length,
      success: true 
    });
    
    return NextResponse.json(filteredData, {
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
    
    console.error('Analytics dashboard error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to retrieve analytics data',
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