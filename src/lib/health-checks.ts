/**
 * Comprehensive health checks for all system components
 * Monitors database, external services, caches, and business logic
 */
import { createLogger } from './logger';
import { env } from './env-validation';

const logger = createLogger('health-checks');

// Health check result interface
interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  message?: string;
  metadata?: any;
  timestamp: string;
}

// Health check configuration
interface HealthCheckConfig {
  timeout: number;
  retries: number;
  interval: number;
  enabled: boolean;
}

const config: HealthCheckConfig = {
  timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000'),
  retries: parseInt(process.env.HEALTH_CHECK_RETRIES || '3'),
  interval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
  enabled: process.env.ENABLE_HEALTH_CHECKS !== 'false',
};

// Health check results cache
const healthCache = new Map<string, HealthCheckResult>();

// Database health check
export const databaseHealthCheck = async (): Promise<HealthCheckResult> => {
  const startTime = Date.now();
  
  try {
    // Import database connection
    const { db } = await import('./database');
    
    // Simple query to check database connectivity
    const result = await db.query('SELECT 1 as health_check');
    
    const responseTime = Date.now() - startTime;
    
    return {
      name: 'database',
      status: 'healthy',
      responseTime,
      message: 'Database connection successful',
      metadata: {
        queryResult: result.rows[0]?.health_check === 1,
        connectionCount: result.rowCount,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      name: 'database',
      status: 'unhealthy',
      responseTime,
      message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      metadata: { error: error instanceof Error ? error.stack : error },
      timestamp: new Date().toISOString(),
    };
  }
};

// Redis health check (if using Redis)
export const redisHealthCheck = async (): Promise<HealthCheckResult> => {
  const startTime = Date.now();
  
  try {
    // Check if Redis is configured
    if (!process.env.REDIS_URL) {
      return {
        name: 'redis',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        message: 'Redis not configured - skipping',
        timestamp: new Date().toISOString(),
      };
    }

    // Import Redis client
    const { createClient } = await import('redis');
    const client = createClient({ url: process.env.REDIS_URL });
    
    await client.connect();
    await client.ping();
    await client.disconnect();
    
    const responseTime = Date.now() - startTime;
    
    return {
      name: 'redis',
      status: 'healthy',
      responseTime,
      message: 'Redis connection successful',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      name: 'redis',
      status: 'unhealthy',
      responseTime,
      message: `Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      metadata: { error: error instanceof Error ? error.stack : error },
      timestamp: new Date().toISOString(),
    };
  }
};

// External API health checks
export const externalAPIHealthChecks = async (): Promise<HealthCheckResult[]> => {
  const checks: HealthCheckResult[] = [];
  
  // Check Supabase
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const startTime = Date.now();
    
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
      // Simple query to check Supabase connectivity
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1);
      
      const responseTime = Date.now() - startTime;
      
      if (error) {
        checks.push({
          name: 'supabase',
          status: 'unhealthy',
          responseTime,
          message: `Supabase query failed: ${error.message}`,
          metadata: { error },
          timestamp: new Date().toISOString(),
        });
      } else {
        checks.push({
          name: 'supabase',
          status: 'healthy',
          responseTime,
          message: 'Supabase connection successful',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      checks.push({
        name: 'supabase',
        status: 'unhealthy',
        responseTime,
        message: `Supabase connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { error: error instanceof Error ? error.stack : error },
        timestamp: new Date().toISOString(),
      });
    }
  }
  
  // Check Tambo API
  if (process.env.TAMBO_API_KEY) {
    const startTime = Date.now();
    
    try {
      const response = await fetch('https://api.tambo.ai/v1/health', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.TAMBO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(config.timeout),
      });
      
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        checks.push({
          name: 'tambo_api',
          status: 'healthy',
          responseTime,
          message: 'Tambo API connection successful',
          metadata: { statusCode: response.status },
          timestamp: new Date().toISOString(),
        });
      } else {
        checks.push({
          name: 'tambo_api',
          status: 'unhealthy',
          responseTime,
          message: `Tambo API returned ${response.status}: ${response.statusText}`,
          metadata: { statusCode: response.status, statusText: response.statusText },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      checks.push({
        name: 'tambo_api',
        status: 'unhealthy',
        responseTime,
        message: `Tambo API connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { error: error instanceof Error ? error.stack : error },
        timestamp: new Date().toISOString(),
      });
    }
  }
  
  // Check Resend API
  if (process.env.RESEND_API_KEY) {
    const startTime = Date.now();
    
    try {
      const response = await fetch('https://api.resend.com/domains', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(config.timeout),
      });
      
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        checks.push({
          name: 'resend_api',
          status: 'healthy',
          responseTime,
          message: 'Resend API connection successful',
          metadata: { statusCode: response.status },
          timestamp: new Date().toISOString(),
        });
      } else {
        checks.push({
          name: 'resend_api',
          status: 'unhealthy',
          responseTime,
          message: `Resend API returned ${response.status}: ${response.statusText}`,
          metadata: { statusCode: response.status, statusText: response.statusText },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      checks.push({
        name: 'resend_api',
        status: 'unhealthy',
        responseTime,
        message: `Resend API connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { error: error instanceof Error ? error.stack : error },
        timestamp: new Date().toISOString(),
      });
    }
  }
  
  return checks;
};

// System resource health check
export const systemResourceHealthCheck = async (): Promise<HealthCheckResult> => {
  const startTime = Date.now();
  
  try {
    let memoryUsage = 0;
    let cpuUsage = 0;
    let diskUsage = 0;
    
    // Get memory usage
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memory = process.memoryUsage();
      memoryUsage = Math.round((memory.heapUsed / memory.heapTotal) * 100);
    }
    
    // Get CPU usage (simplified)
    if (typeof process !== 'undefined' && process.cpuUsage) {
      const cpu = process.cpuUsage();
      cpuUsage = Math.round(((cpu.user + cpu.system) / 1000000) * 100);
    }
    
    // Get disk usage (if available)
    try {
      const { execSync } = await import('child_process');
      const diskInfo = execSync('df -h / | tail -1 | awk \'{print $5}\'', { encoding: 'utf8' });
      diskUsage = parseInt(diskInfo.replace('%', ''));
    } catch {
      // Ignore disk usage if not available
    }
    
    const responseTime = Date.now() - startTime;
    
    // Determine status based on resource usage
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    let message = 'System resources are healthy';
    
    if (memoryUsage > 90 || cpuUsage > 95 || diskUsage > 95) {
      status = 'unhealthy';
      message = 'System resources are critically high';
    } else if (memoryUsage > 80 || cpuUsage > 80 || diskUsage > 85) {
      status = 'degraded';
      message = 'System resources are elevated';
    }
    
    return {
      name: 'system_resources',
      status,
      responseTime,
      message,
      metadata: {
        memoryUsage,
        cpuUsage,
        diskUsage,
        uptime: process.uptime ? Math.floor(process.uptime()) : 0,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      name: 'system_resources',
      status: 'unhealthy',
      responseTime,
      message: `System resource check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      metadata: { error: error instanceof Error ? error.stack : error },
      timestamp: new Date().toISOString(),
    };
  }
};

// Application-specific health checks
export const applicationHealthCheck = async (): Promise<HealthCheckResult> => {
  const startTime = Date.now();
  
  try {
    // Check if core application components are working
    const { sessionManager } = await import('./session-manager');
    const { metricsUtils } = await import('./metrics');
    
    // Test session management
    const sessionStats = await sessionManager.getSessionStats();
    
    // Test metrics
    const metrics = metricsUtils.getMetrics();
    
    const responseTime = Date.now() - startTime;
    
    return {
      name: 'application',
      status: 'healthy',
      responseTime,
      message: 'Application components are healthy',
      metadata: {
        sessionStats,
        metricsAvailable: metrics !== null,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      name: 'application',
      status: 'unhealthy',
      responseTime,
      message: `Application health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      metadata: { error: error instanceof Error ? error.stack : error },
      timestamp: new Date().toISOString(),
    };
  }
};

// Learning system specific health check
export const learningSystemHealthCheck = async (): Promise<HealthCheckResult> => {
  const startTime = Date.now();
  
  try {
    // Check if learning algorithms are working
    const { learningEngine } = await import('./learning-engine');
    const { learningService } = await import('../services/learning-service');
    
    // Test learning engine
    const testProgress = await learningEngine.calculateProgress('test-user', 'test-content');
    
    // Test learning service
    const testRecommendations = await learningService.getRecommendations('test-user');
    
    const responseTime = Date.now() - startTime;
    
    return {
      name: 'learning_system',
      status: 'healthy',
      responseTime,
      message: 'Learning system is healthy',
      metadata: {
        progressCalculation: testProgress !== null,
        recommendationsAvailable: testRecommendations !== null,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      name: 'learning_system',
      status: 'unhealthy',
      responseTime,
      message: `Learning system health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      metadata: { error: error instanceof Error ? error.stack : error },
      timestamp: new Date().toISOString(),
    };
  }
};

// Run all health checks
export const runAllHealthChecks = async (): Promise<HealthCheckResult[]> => {
  if (!config.enabled) {
    return [];
  }

  const checks: HealthCheckResult[] = [];
  
  try {
    // Run core health checks
    const [
      dbCheck,
      redisCheck,
      systemCheck,
      appCheck,
      learningCheck,
    ] = await Promise.all([
      databaseHealthCheck(),
      redisHealthCheck(),
      systemResourceHealthCheck(),
      applicationHealthCheck(),
      learningSystemHealthCheck(),
    ]);
    
    checks.push(dbCheck, redisCheck, systemCheck, appCheck, learningCheck);
    
    // Run external API checks
    const externalChecks = await externalAPIHealthChecks();
    checks.push(...externalChecks);
    
    // Cache results
    checks.forEach(check => {
      healthCache.set(check.name, check);
    });
    
    logger.info('Health checks completed', {
      total: checks.length,
      healthy: checks.filter(c => c.status === 'healthy').length,
      unhealthy: checks.filter(c => c.status === 'unhealthy').length,
      degraded: checks.filter(c => c.status === 'degraded').length,
    });
    
    return checks;
  } catch (error) {
    logger.error('Failed to run health checks', error);
    throw error;
  }
};

// Get cached health check results
export const getCachedHealthChecks = (): HealthCheckResult[] => {
  return Array.from(healthCache.values());
};

// Get overall health status
export const getOverallHealthStatus = (checks: HealthCheckResult[]) => {
  if (checks.length === 0) {
    return {
      status: 'unknown',
      message: 'No health checks available',
    };
  }
  
  const unhealthy = checks.filter(c => c.status === 'unhealthy');
  const degraded = checks.filter(c => c.status === 'degraded');
  
  if (unhealthy.length > 0) {
    return {
      status: 'unhealthy',
      message: `${unhealthy.length} critical issue(s) detected`,
      criticalIssues: unhealthy.map(c => c.name),
    };
  }
  
  if (degraded.length > 0) {
    return {
      status: 'degraded',
      message: `${degraded.length} performance issue(s) detected`,
      performanceIssues: degraded.map(c => c.name),
    };
  }
  
  return {
    status: 'healthy',
    message: 'All systems operational',
  };
};

// Start periodic health checks
export const startPeriodicHealthChecks = () => {
  if (!config.enabled) {
    return null;
  }
  
  const interval = setInterval(async () => {
    try {
      await runAllHealthChecks();
    } catch (error) {
      logger.error('Periodic health check failed', error);
    }
  }, config.interval);
  
  logger.info('Periodic health checks started', {
    interval: config.interval,
    timeout: config.timeout,
    retries: config.retries,
  });
  
  return interval;
};

// Health check manager
export const healthCheckManager = {
  runAll: runAllHealthChecks,
  getCached: getCachedHealthChecks,
  getOverallStatus: getOverallHealthStatus,
  startPeriodic: startPeriodicHealthChecks,
  config,
  
  // Individual health checks
  database: databaseHealthCheck,
  redis: redisHealthCheck,
  externalAPIs: externalAPIHealthChecks,
  systemResources: systemResourceHealthCheck,
  application: applicationHealthCheck,
  learningSystem: learningSystemHealthCheck,
};

export default healthCheckManager;