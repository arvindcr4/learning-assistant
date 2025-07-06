import { NextResponse } from 'next/server';
import { loggerHealthCheck } from '@/lib/logger';
import { metricsHealthCheck } from '@/lib/metrics';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    [key: string]: {
      status: 'healthy' | 'unhealthy';
      message?: string;
      responseTime?: number;
    };
  };
}

// Health check dependencies
const checkDatabase = async (): Promise<{ status: 'healthy' | 'unhealthy'; message?: string; responseTime: number }> => {
  const startTime = Date.now();
  
  try {
    // In a real implementation, you would check database connectivity
    // For now, we'll simulate a database check
    await new Promise(resolve => setTimeout(resolve, 10)); // Simulate DB query
    
    return {
      status: 'healthy',
      responseTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Database connection failed',
      responseTime: Date.now() - startTime,
    };
  }
};

const checkRedis = async (): Promise<{ status: 'healthy' | 'unhealthy'; message?: string; responseTime: number }> => {
  const startTime = Date.now();
  
  try {
    // In a real implementation, you would check Redis connectivity
    // For now, we'll simulate a Redis check
    await new Promise(resolve => setTimeout(resolve, 5)); // Simulate Redis ping
    
    return {
      status: 'healthy',
      responseTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Redis connection failed',
      responseTime: Date.now() - startTime,
    };
  }
};

const checkLogger = (): { status: 'healthy' | 'unhealthy'; message?: string; responseTime: number } => {
  const startTime = Date.now();
  
  try {
    const isHealthy = loggerHealthCheck();
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      message: isHealthy ? undefined : 'Logger not responding',
      responseTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Logger check failed',
      responseTime: Date.now() - startTime,
    };
  }
};

const checkMetrics = (): { status: 'healthy' | 'unhealthy'; message?: string; responseTime: number } => {
  const startTime = Date.now();
  
  try {
    const isHealthy = metricsHealthCheck();
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      message: isHealthy ? undefined : 'Metrics not available',
      responseTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Metrics check failed',
      responseTime: Date.now() - startTime,
    };
  }
};

const checkDiskSpace = (): { status: 'healthy' | 'unhealthy'; message?: string; responseTime: number } => {
  const startTime = Date.now();
  
  try {
    // In a real implementation, you would check disk space
    // For now, we'll simulate a disk space check
    const memoryUsage = process.memoryUsage();
    const freeMemory = process.memoryUsage().heapTotal - process.memoryUsage().heapUsed;
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    
    return {
      status: memoryUsagePercent < 90 ? 'healthy' : 'unhealthy',
      message: memoryUsagePercent >= 90 ? `High memory usage: ${memoryUsagePercent.toFixed(1)}%` : undefined,
      responseTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Disk space check failed',
      responseTime: Date.now() - startTime,
    };
  }
};

export async function GET(): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    // Run all health checks
    const [databaseCheck, redisCheck, loggerCheck, metricsCheck, diskSpaceCheck] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      Promise.resolve(checkLogger()),
      Promise.resolve(checkMetrics()),
      Promise.resolve(checkDiskSpace()),
    ]);
    
    const checks = {
      database: databaseCheck,
      redis: redisCheck,
      logger: loggerCheck,
      metrics: metricsCheck,
      diskSpace: diskSpaceCheck,
    };
    
    // Determine overall status
    const unhealthyChecks = Object.values(checks).filter(check => check.status === 'unhealthy');
    const overallStatus = unhealthyChecks.length === 0 ? 'healthy' : 
                         unhealthyChecks.length < Object.keys(checks).length ? 'degraded' : 'unhealthy';
    
    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      checks,
    };
    
    // Set appropriate HTTP status code
    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;
    
    return NextResponse.json(result, { status: statusCode });
    
  } catch (error) {
    const result: HealthCheckResult = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      checks: {
        error: {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Unknown error during health check',
          responseTime: Date.now() - startTime,
        },
      },
    };
    
    return NextResponse.json(result, { status: 503 });
  }
}

// Handle HEAD requests for load balancer health checks
export async function HEAD(): Promise<NextResponse> {
  try {
    // Quick health check for load balancers
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    
    if (memoryUsagePercent > 95) {
      return new NextResponse(null, { status: 503 });
    }
    
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}