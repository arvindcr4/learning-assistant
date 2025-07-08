/**
 * Monitoring Dashboard API
 * Provides comprehensive monitoring data for dashboards and visualizations
 */
import { NextRequest, NextResponse } from 'next/server';
import { multiProviderAPM } from '@/lib/apm-providers';
import { healthMonitoringService } from '@/lib/health-monitoring';
import { learningMetrics } from '@/lib/learning-metrics';
import { logAggregationManager } from '@/lib/log-aggregation';
import { alertingEngine } from '@/lib/alerting-engine';
import { createLogger } from '@/lib/logger';

const logger = createLogger('dashboard-api');

export async function GET(request: NextRequest) {
  const traceId = multiProviderAPM.startTrace('dashboard_data_fetch');
  
  try {
    const url = new URL(request.url);
    const timeRange = url.searchParams.get('timeRange') || '1h';
    const category = url.searchParams.get('category') || 'all';
    
    // Calculate time range
    const endTime = new Date();
    const startTime = new Date();
    
    switch (timeRange) {
      case '15m':
        startTime.setMinutes(endTime.getMinutes() - 15);
        break;
      case '1h':
        startTime.setHours(endTime.getHours() - 1);
        break;
      case '6h':
        startTime.setHours(endTime.getHours() - 6);
        break;
      case '24h':
        startTime.setDate(endTime.getDate() - 1);
        break;
      case '7d':
        startTime.setDate(endTime.getDate() - 7);
        break;
      case '30d':
        startTime.setDate(endTime.getDate() - 30);
        break;
      default:
        startTime.setHours(endTime.getHours() - 1);
    }

    // Gather monitoring data based on category
    let dashboardData: any = {
      timestamp: new Date().toISOString(),
      timeRange: {
        start: startTime.toISOString(),
        end: endTime.toISOString(),
        duration: timeRange,
      },
    };

    if (category === 'all' || category === 'system') {
      dashboardData.system = await getSystemMetrics();
    }

    if (category === 'all' || category === 'health') {
      dashboardData.health = await getHealthMetrics();
    }

    if (category === 'all' || category === 'learning') {
      dashboardData.learning = await getLearningMetrics(startTime, endTime);
    }

    if (category === 'all' || category === 'alerts') {
      dashboardData.alerts = await getAlertMetrics();
    }

    if (category === 'all' || category === 'logs') {
      dashboardData.logs = await getLogMetrics(startTime, endTime);
    }

    if (category === 'all' || category === 'performance') {
      dashboardData.performance = await getPerformanceMetrics();
    }

    if (category === 'all' || category === 'apm') {
      dashboardData.apm = await getAPMMetrics();
    }

    multiProviderAPM.endTrace(traceId, {
      category,
      timeRange,
      success: true,
    });

    return NextResponse.json(dashboardData, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Response-Time': `${Date.now() - parseInt(traceId.split('_')[1])}ms`,
      },
    });

  } catch (error) {
    multiProviderAPM.endTrace(traceId, {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    logger.error('Dashboard API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch dashboard data',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// System metrics
async function getSystemMetrics() {
  try {
    const apmMetrics = multiProviderAPM.getMetrics();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      overview: {
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid,
        environment: process.env.NODE_ENV,
      },
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
        arrayBuffers: Math.round(memoryUsage.arrayBuffers / 1024 / 1024), // MB
        usagePercent: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        loadAverage: process.platform !== 'win32' ? process.loadavg() : [0, 0, 0],
      },
      apm: {
        providersStatus: apmMetrics,
        healthy: multiProviderAPM.healthCheck(),
      },
    };
  } catch (error) {
    logger.error('Error getting system metrics:', error);
    return {
      error: 'Failed to fetch system metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Health metrics
async function getHealthMetrics() {
  try {
    const healthResults = await healthMonitoringService.runAllHealthChecks();
    const overallStatus = healthMonitoringService.getOverallStatus(healthResults);
    
    return {
      overall: overallStatus,
      checks: healthResults.map(check => ({
        name: check.name,
        status: check.status,
        responseTime: check.responseTime,
        message: check.message,
        timestamp: check.timestamp,
      })),
      summary: {
        total: healthResults.length,
        healthy: healthResults.filter(c => c.status === 'healthy').length,
        degraded: healthResults.filter(c => c.status === 'degraded').length,
        unhealthy: healthResults.filter(c => c.status === 'unhealthy').length,
      },
    };
  } catch (error) {
    logger.error('Error getting health metrics:', error);
    return {
      error: 'Failed to fetch health metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Learning metrics
async function getLearningMetrics(startTime: Date, endTime: Date) {
  try {
    const activeSessionCount = learningMetrics.getActiveSessionCount();
    const bufferSize = learningMetrics.getBufferSize();
    
    // Mock learning analytics data (would come from actual analytics in production)
    const mockAnalytics = {
      sessions: {
        total: Math.floor(Math.random() * 1000) + 500,
        active: activeSessionCount,
        averageDuration: Math.floor(Math.random() * 30) + 15, // minutes
        completionRate: Math.random() * 0.3 + 0.7, // 70-100%
      },
      content: {
        totalViews: Math.floor(Math.random() * 5000) + 2000,
        totalCompletions: Math.floor(Math.random() * 3000) + 1500,
        averageTimeSpent: Math.floor(Math.random() * 20) + 10, // minutes
        topContent: [
          { id: 'content_1', title: 'Introduction to JavaScript', views: 245, completions: 198 },
          { id: 'content_2', title: 'React Fundamentals', views: 189, completions: 156 },
          { id: 'content_3', title: 'Node.js Basics', views: 167, completions: 134 },
        ],
      },
      quizzes: {
        totalAttempts: Math.floor(Math.random() * 2000) + 1000,
        totalCompletions: Math.floor(Math.random() * 1500) + 800,
        averageScore: Math.random() * 0.3 + 0.7, // 70-100%
        passRate: Math.random() * 0.2 + 0.8, // 80-100%
      },
      users: {
        totalUsers: Math.floor(Math.random() * 500) + 250,
        activeUsers: Math.floor(Math.random() * 200) + 100,
        newUsers: Math.floor(Math.random() * 50) + 25,
        engagementScore: Math.random() * 30 + 70, // 70-100
      },
      performance: {
        averageLoadTime: Math.random() * 1000 + 500, // ms
        errorRate: Math.random() * 0.05, // 0-5%
        apiResponseTime: Math.random() * 200 + 100, // ms
      },
    };

    return {
      ...mockAnalytics,
      bufferSize,
      timeRange: {
        start: startTime.toISOString(),
        end: endTime.toISOString(),
      },
    };
  } catch (error) {
    logger.error('Error getting learning metrics:', error);
    return {
      error: 'Failed to fetch learning metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Alert metrics
async function getAlertMetrics() {
  try {
    const alerts = alertingEngine.getAlerts();
    const rules = alertingEngine.getRules();
    const engineMetrics = alertingEngine.getMetrics();
    
    return {
      summary: engineMetrics,
      recentAlerts: alerts.slice(0, 20).map(alert => ({
        id: alert.id,
        ruleName: alert.ruleName,
        severity: alert.severity,
        status: alert.status,
        category: alert.category,
        timestamp: alert.timestamp,
        escalationLevel: alert.escalationLevel,
      })),
      rules: {
        total: rules.length,
        enabled: rules.filter(r => r.enabled).length,
        disabled: rules.filter(r => !r.enabled).length,
        bySeverity: {
          low: rules.filter(r => r.severity === 'low').length,
          medium: rules.filter(r => r.severity === 'medium').length,
          high: rules.filter(r => r.severity === 'high').length,
          critical: rules.filter(r => r.severity === 'critical').length,
        },
      },
      trends: {
        // Mock trend data (would come from time series data in production)
        last24Hours: Array.from({ length: 24 }, (_, i) => ({
          hour: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).getHours(),
          alerts: Math.floor(Math.random() * 10),
          critical: Math.floor(Math.random() * 3),
        })),
      },
    };
  } catch (error) {
    logger.error('Error getting alert metrics:', error);
    return {
      error: 'Failed to fetch alert metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Log metrics
async function getLogMetrics(startTime: Date, endTime: Date) {
  try {
    const healthStatus = await logAggregationManager.healthCheck();
    
    // Mock log analytics data (in production, this would come from actual log aggregation service)
    const mockAnalytics = {
      summary: {
        totalLogs: Math.floor(Math.random() * 10000) + 5000,
        errorLogs: Math.floor(Math.random() * 500) + 100,
        warnLogs: Math.floor(Math.random() * 1000) + 500,
        infoLogs: Math.floor(Math.random() * 8000) + 4000,
        topErrors: [
          { message: 'Database connection timeout', count: Math.floor(Math.random() * 50) + 10 },
          { message: 'Authentication failed', count: Math.floor(Math.random() * 30) + 5 },
          { message: 'Rate limit exceeded', count: Math.floor(Math.random() * 20) + 3 },
        ],
      },
      patterns: [
        { pattern: 'error', matches: Math.floor(Math.random() * 100) + 50 },
        { pattern: 'timeout', matches: Math.floor(Math.random() * 50) + 20 },
        { pattern: 'unauthorized', matches: Math.floor(Math.random() * 30) + 10 },
      ],
      trends: {
        last24Hours: Array.from({ length: 24 }, (_, i) => ({
          hour: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).getHours(),
          logs: Math.floor(Math.random() * 500) + 100,
          errors: Math.floor(Math.random() * 50) + 10,
        })),
      },
    };
    
    return {
      storage: {
        providers: healthStatus,
        healthy: Object.values(healthStatus).every(status => status === true),
      },
      analytics: mockAnalytics,
      recentErrors: mockAnalytics.summary.topErrors.slice(0, 10),
      patterns: mockAnalytics.patterns.filter(p => p.matches > 0).slice(0, 10),
      trends: mockAnalytics.trends,
    };
  } catch (error) {
    logger.error('Error getting log metrics:', error);
    return {
      error: 'Failed to fetch log metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Performance metrics
async function getPerformanceMetrics() {
  try {
    // Mock performance data (would come from real monitoring in production)
    const performanceData = {
      responseTime: {
        current: Math.random() * 200 + 100, // ms
        average: Math.random() * 150 + 125, // ms
        p95: Math.random() * 300 + 200, // ms
        p99: Math.random() * 500 + 400, // ms
      },
      throughput: {
        requestsPerSecond: Math.random() * 100 + 50,
        requestsPerMinute: Math.random() * 6000 + 3000,
      },
      errors: {
        rate: Math.random() * 0.05, // 0-5%
        count: Math.floor(Math.random() * 50),
        types: [
          { type: '500 Internal Server Error', count: Math.floor(Math.random() * 20) },
          { type: '404 Not Found', count: Math.floor(Math.random() * 15) },
          { type: '429 Too Many Requests', count: Math.floor(Math.random() * 10) },
        ],
      },
      database: {
        connectionPool: {
          active: Math.floor(Math.random() * 10) + 5,
          idle: Math.floor(Math.random() * 15) + 10,
          total: 25,
        },
        queryTime: {
          average: Math.random() * 50 + 25, // ms
          slow: Math.floor(Math.random() * 5), // count of slow queries
        },
      },
      cache: {
        hitRate: Math.random() * 0.2 + 0.8, // 80-100%
        missRate: Math.random() * 0.2, // 0-20%
        evictionRate: Math.random() * 0.05, // 0-5%
      },
    };

    return performanceData;
  } catch (error) {
    logger.error('Error getting performance metrics:', error);
    return {
      error: 'Failed to fetch performance metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// APM metrics
async function getAPMMetrics() {
  try {
    const apmMetrics = multiProviderAPM.getMetrics();
    const providerStatus = multiProviderAPM.getProviderStatus();
    
    return {
      providers: providerStatus,
      metrics: apmMetrics,
      health: multiProviderAPM.healthCheck(),
      traces: {
        // Mock trace data
        active: Math.floor(Math.random() * 100) + 50,
        completed: Math.floor(Math.random() * 1000) + 500,
        failed: Math.floor(Math.random() * 50),
        averageDuration: Math.random() * 1000 + 500, // ms
      },
      spans: {
        // Mock span data
        database: Math.floor(Math.random() * 200) + 100,
        http: Math.floor(Math.random() * 300) + 150,
        cache: Math.floor(Math.random() * 150) + 75,
        custom: Math.floor(Math.random() * 100) + 50,
      },
    };
  } catch (error) {
    logger.error('Error getting APM metrics:', error);
    return {
      error: 'Failed to fetch APM metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
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