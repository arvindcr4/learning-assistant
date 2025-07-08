import { NextRequest, NextResponse } from 'next/server';
import { databaseHealthMonitor, quickHealthCheck } from '@/lib/database/health-monitor';
import { databaseBackupManager } from '@/lib/database/backup-recovery';
import logger from '@/lib/logger';

// GET /api/health/database - Quick database health check
export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();
    
    // Get query parameters
    const url = new URL(request.url);
    const detailed = url.searchParams.get('detailed') === 'true';
    const includeMetrics = url.searchParams.get('metrics') === 'true';
    
    logger.info('Database health check requested', {
      detailed,
      includeMetrics,
      category: 'health',
      operation: 'database_health_check'
    });

    if (detailed) {
      // Perform comprehensive health check
      const healthMetrics = await databaseHealthMonitor.performHealthCheck();
      const duration = Date.now() - startTime;
      
      const response = {
        status: healthMetrics.status,
        timestamp: new Date().toISOString(),
        duration,
        database: {
          version: healthMetrics.version,
          uptime: healthMetrics.uptime,
          connections: healthMetrics.connections,
          performance: healthMetrics.performance,
          storage: healthMetrics.storage,
          replication: healthMetrics.replication
        },
        alerts: healthMetrics.alerts,
        recommendations: healthMetrics.recommendations,
        ...(includeMetrics && {
          metrics: {
            trends: databaseHealthMonitor.getHealthTrends(24),
            history: databaseHealthMonitor.getHealthHistory(10)
          }
        })
      };

      const statusCode = healthMetrics.status === 'healthy' ? 200 : 
                        healthMetrics.status === 'degraded' ? 206 : 503;

      return NextResponse.json(response, { status: statusCode });
    } else {
      // Quick health check
      const quickCheck = await quickHealthCheck();
      const duration = Date.now() - startTime;
      
      const response = {
        status: quickCheck.status,
        timestamp: new Date().toISOString(),
        duration,
        responseTime: quickCheck.responseTime,
        checks: {
          connectivity: quickCheck.status !== 'unhealthy',
          responseTime: quickCheck.responseTime < 1000
        }
      };

      const statusCode = quickCheck.status === 'healthy' ? 200 : 
                        quickCheck.status === 'degraded' ? 206 : 503;

      return NextResponse.json(response, { status: statusCode });
    }
  } catch (error) {
    logger.error('Database health check failed', {
      error: error instanceof Error ? error.message : String(error),
      category: 'health',
      operation: 'database_health_check'
    });

    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 503 });
  }
}