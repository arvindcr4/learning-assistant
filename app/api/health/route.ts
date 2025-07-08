import { NextRequest, NextResponse } from 'next/server';

import { sessionManager } from '@/lib/session-manager';
import { env } from '@/lib/env-validation';
import { healthCheckManager } from '@/lib/health-checks';
import { monitoring } from '@/lib/monitoring';
import { apm } from '@/lib/apm';

// Import comprehensive monitoring systems
import { deepMonitoring } from '@/lib/health/deep-monitoring';
import { syntheticMonitoring } from '@/lib/health/synthetic-monitoring';
import { dependencyMonitoring } from '@/lib/health/dependency-monitor';
import { circuitBreakerManager } from '@/lib/health/circuit-breaker';
import { slaMonitoring } from '@/lib/health/sla-monitoring';
import { autoHealing } from '@/lib/health/auto-healing';
import { chaosEngineering } from '@/lib/health/chaos-engineering';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Start trace for health check
    const traceId = apm.startTrace('health_check', {
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown',
    });

    // Run comprehensive health checks
    const healthChecks = await healthCheckManager.runAll();
    const overallStatus = healthCheckManager.getOverallStatus(healthChecks);
    
    // Get session statistics
    const sessionStats = await sessionManager.getSessionStats();
    
    // Get monitoring metrics
    const monitoringHealth = monitoring.getHealth();
    const apmMetrics = apm.getMetrics();
    
    // Get comprehensive monitoring data
    const deepHealthSummary = await deepMonitoring.getSummary();
    const syntheticSummary = syntheticMonitoring.getSummary();
    const dependencySummary = dependencyMonitoring.getSummary();
    const circuitBreakerSummary = circuitBreakerManager.getSummary();
    const slaSummary = slaMonitoring.getSummary();
    const healingSummary = autoHealing.getSummary();
    const chaosSummary = chaosEngineering.getSummary();
    
    // Calculate response time
    const responseTime = Date.now() - startTime;
    
    // Determine overall system health from all monitoring systems
    const allHealthScores = [
      deepHealthSummary.overall.score,
      syntheticSummary.overallHealth.score,
      dependencySummary.overallHealth.score,
      slaSummary.overallCompliance,
    ].filter(score => !isNaN(score));
    
    const avgHealthScore = allHealthScores.length > 0 
      ? allHealthScores.reduce((sum, score) => sum + score, 0) / allHealthScores.length 
      : 100;
    
    // Determine final status based on comprehensive monitoring
    let finalStatus = overallStatus.status;
    let finalMessage = overallStatus.message;
    
    if (dependencySummary.unhealthyDependencies > 0 || circuitBreakerSummary.openBreakers > 0) {
      finalStatus = 'unhealthy';
      finalMessage = 'Critical dependencies or circuit breakers are failing';
    } else if (avgHealthScore < 50) {
      finalStatus = 'unhealthy';
      finalMessage = 'Multiple system components are failing';
    } else if (avgHealthScore < 80 || syntheticSummary.overallHealth.status === 'unhealthy') {
      finalStatus = 'degraded';
      finalMessage = 'System performance is degraded';
    } else if (deepHealthSummary.overall.status === 'healthy' && avgHealthScore >= 95) {
      finalStatus = 'healthy';
      finalMessage = 'All systems operational and performing optimally';
    }

    // Comprehensive health information
    const health = {
      status: finalStatus,
      message: finalMessage,
      timestamp: new Date().toISOString(),
      responseTime,
      environment: env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime ? Math.floor(process.uptime()) : 0,
      healthScore: Math.round(avgHealthScore),
      
      // System health
      system: {
        memory: apmMetrics.memoryUsage ? `${Math.round(apmMetrics.memoryUsage)}MB` : 'unknown',
        cpu: apmMetrics.cpuUsage ? `${Math.round(apmMetrics.cpuUsage)}%` : 'unknown',
        uptime: typeof process.uptime === 'function' ? Math.floor(process.uptime()) : 0,
        nodeVersion: process.version,
        platform: process.platform,
        load: typeof process.loadavg === 'function' ? process.loadavg() : [],
      },
      
      // Security health
      security: {
        activeSessions: sessionStats.totalActiveSessions,
        uniqueUsers: sessionStats.uniqueUsers,
        blacklistedTokens: sessionStats.blacklistedTokens,
        securityEvents: sessionStats.securityEvents,
        status: sessionStats.securityEvents > 10 ? 'elevated' : 'normal',
      },
      
      // Feature status
      features: {
        jwtEnabled: true,
        csrfEnabled: true,
        sessionManagement: true,
        rateLimiting: true,
        roleBasedAccess: true,
        monitoring: monitoringHealth.config.enabled,
        tracing: monitoringHealth.config.tracing,
        alerting: monitoringHealth.config.alerting,
        deepMonitoring: deepHealthSummary.overall.status !== 'unhealthy',
        syntheticMonitoring: syntheticSummary.enabled,
        dependencyMonitoring: dependencySummary.enabled,
        circuitBreakers: circuitBreakerSummary.totalBreakers > 0,
        slaMonitoring: slaSummary.enabled,
        autoHealing: healingSummary.enabled,
        chaosEngineering: chaosSummary.enabled,
      },
      
      // Performance metrics
      performance: {
        requests: apmMetrics.requests,
        errors: apmMetrics.errors,
        slowRequests: apmMetrics.slowRequests,
        averageResponseTime: Math.round(apmMetrics.averageResponseTime),
        activeTraces: apmMetrics.activeTraces,
        throughput: apmMetrics.requests / Math.max(process.uptime() || 1, 1),
      },
      
      // Deep monitoring summary
      deepHealth: {
        status: deepHealthSummary.overall.status,
        score: deepHealthSummary.overall.score,
        categories: deepHealthSummary.categories,
        recommendations: deepHealthSummary.recommendations.slice(0, 5), // Top 5 recommendations
        trends: deepHealthSummary.trends,
      },
      
      // Synthetic monitoring
      synthetic: {
        enabled: syntheticSummary.enabled,
        totalJourneys: syntheticSummary.totalJourneys,
        activeJourneys: syntheticSummary.activeJourneys,
        healthStatus: syntheticSummary.overallHealth.status,
        score: syntheticSummary.overallHealth.score,
        recentResults: Object.keys(syntheticSummary.recentResults).length,
      },
      
      // Dependency monitoring
      dependencies: {
        total: dependencySummary.totalDependencies,
        healthy: dependencySummary.healthyDependencies,
        degraded: dependencySummary.degradedDependencies,
        unhealthy: dependencySummary.unhealthyDependencies,
        critical: dependencySummary.criticalDependencies,
        cascadeFailure: dependencySummary.cascadeFailure.detected,
        slaBreaches: dependencySummary.slaBreaches,
      },
      
      // Circuit breakers
      circuitBreakers: {
        total: circuitBreakerSummary.totalBreakers,
        closed: circuitBreakerSummary.closedBreakers,
        open: circuitBreakerSummary.openBreakers,
        halfOpen: circuitBreakerSummary.halfOpenBreakers,
        totalRequests: circuitBreakerSummary.totalRequests,
        totalFailures: circuitBreakerSummary.totalFailures,
        avgResponseTime: Math.round(circuitBreakerSummary.averageResponseTime || 0),
      },
      
      // SLA monitoring
      sla: {
        enabled: slaSummary.enabled,
        totalSLAs: slaSummary.totalSLAs,
        activeSLAs: slaSummary.activeSLAs,
        overallCompliance: Math.round(slaSummary.overallCompliance),
        compliant: slaSummary.slaStatus.compliant,
        atRisk: slaSummary.slaStatus.atRisk,
        breached: slaSummary.slaStatus.breached,
        activeIncidents: slaSummary.activeIncidents,
      },
      
      // Auto-healing
      autoHealing: {
        enabled: healingSummary.enabled,
        totalActions: healingSummary.totalActions,
        enabledActions: healingSummary.enabledActions,
        runningActions: healingSummary.runningActions,
        recentExecutions: healingSummary.recentExecutions,
        successRate: Math.round(healingSummary.successRate),
        avgDuration: Math.round(healingSummary.averageDuration),
      },
      
      // Chaos engineering
      chaos: {
        enabled: chaosSummary.enabled,
        totalExperiments: chaosSummary.totalExperiments,
        enabledExperiments: chaosSummary.enabledExperiments,
        runningExperiments: chaosSummary.runningExperiments,
        recentExecutions: chaosSummary.recentExecutions,
        successRate: Math.round(chaosSummary.successRate),
        safeguards: chaosSummary.safeguards,
      },
      
      // Detailed health checks
      checks: healthChecks.map(check => ({
        name: check.name,
        status: check.status,
        responseTime: check.responseTime,
        message: check.message,
      })),
      
      // Critical issues (if any)
      ...(finalStatus === 'unhealthy' && {
        criticalIssues: [
          ...overallStatus.criticalIssues || [],
          ...(dependencySummary.unhealthyDependencies > 0 ? [`${dependencySummary.unhealthyDependencies} dependencies unhealthy`] : []),
          ...(circuitBreakerSummary.openBreakers > 0 ? [`${circuitBreakerSummary.openBreakers} circuit breakers open`] : []),
          ...(slaSummary.slaStatus.breached > 0 ? [`${slaSummary.slaStatus.breached} SLA breaches`] : []),
        ],
      }),
      
      // Performance issues (if any)
      ...(finalStatus === 'degraded' && {
        performanceIssues: [
          ...overallStatus.performanceIssues || [],
          ...(deepHealthSummary.recommendations.slice(0, 3) || []),
          ...(avgHealthScore < 80 ? ['Overall system health score below 80%'] : []),
        ],
      }),
      
      // Recommendations
      recommendations: [
        ...deepHealthSummary.recommendations.slice(0, 3),
        ...(dependencySummary.unhealthyDependencies > 0 ? ['Check dependency health and restore failed services'] : []),
        ...(circuitBreakerSummary.openBreakers > 0 ? ['Investigate and fix issues causing circuit breaker failures'] : []),
        ...(slaSummary.slaStatus.breached > 0 ? ['Address SLA breaches to maintain service quality'] : []),
        ...(healingSummary.recentExecutions > 0 ? ['Review recent auto-healing actions for system insights'] : []),
      ].slice(0, 10), // Top 10 recommendations
    };

    // End trace
    apm.endTrace(traceId, {
      status: finalStatus,
      responseTime,
      checksCount: healthChecks.length,
      healthScore: avgHealthScore,
    });

    // Determine HTTP status code based on comprehensive health
    const httpStatus = finalStatus === 'unhealthy' ? 503 : 
                     finalStatus === 'degraded' ? 200 : 200;

    const response = NextResponse.json(health, { status: httpStatus });
    
    // Add comprehensive headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('X-Health-Status', finalStatus);
    response.headers.set('X-Health-Score', Math.round(avgHealthScore).toString());
    response.headers.set('X-Response-Time', responseTime.toString());
    response.headers.set('X-Checks-Count', healthChecks.length.toString());
    response.headers.set('X-Dependencies-Healthy', dependencySummary.healthyDependencies.toString());
    response.headers.set('X-Circuit-Breakers-Open', circuitBreakerSummary.openBreakers.toString());
    response.headers.set('X-SLA-Compliance', Math.round(slaSummary.overallCompliance).toString());
    response.headers.set('X-Auto-Healing-Active', healingSummary.runningActions.toString());
    
    return response;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('Health check error:', error);
    
    const errorHealth = { 
      status: 'unhealthy',
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      responseTime,
      environment: env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
    };

    const response = NextResponse.json(errorHealth, { status: 500 });
    
    // Add error headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('X-Health-Status', 'unhealthy');
    response.headers.set('X-Response-Time', responseTime.toString());
    
    return response;
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