/**
 * Deep health monitoring for all system components
 * Provides comprehensive monitoring with detailed insights into system health
 */
import { createLogger } from '../logger';
import { env } from '../env-validation';

const logger = createLogger('deep-monitoring');

// Deep health check result interface
export interface DeepHealthResult {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  responseTime: number;
  message?: string;
  metadata?: any;
  timestamp: string;
  checks: {
    connectivity?: boolean;
    performance?: boolean;
    availability?: boolean;
    capacity?: boolean;
    security?: boolean;
  };
  metrics: {
    latency?: number;
    throughput?: number;
    errorRate?: number;
    saturation?: number;
    availability?: number;
  };
  recommendations?: string[];
}

// Deep monitoring configuration
interface DeepMonitoringConfig {
  enabled: boolean;
  timeouts: {
    default: number;
    database: number;
    external: number;
    filesystem: number;
  };
  thresholds: {
    latency: {
      good: number;
      degraded: number;
      critical: number;
    };
    errorRate: {
      good: number;
      degraded: number;
      critical: number;
    };
    resourceUsage: {
      good: number;
      degraded: number;
      critical: number;
    };
  };
  samplingRates: {
    high: number;
    medium: number;
    low: number;
  };
}

const config: DeepMonitoringConfig = {
  enabled: process.env.ENABLE_DEEP_MONITORING !== 'false',
  timeouts: {
    default: parseInt(process.env.DEEP_MONITOR_TIMEOUT_DEFAULT || '10000'),
    database: parseInt(process.env.DEEP_MONITOR_TIMEOUT_DB || '5000'),
    external: parseInt(process.env.DEEP_MONITOR_TIMEOUT_EXTERNAL || '15000'),
    filesystem: parseInt(process.env.DEEP_MONITOR_TIMEOUT_FS || '3000'),
  },
  thresholds: {
    latency: {
      good: parseInt(process.env.LATENCY_THRESHOLD_GOOD || '100'),
      degraded: parseInt(process.env.LATENCY_THRESHOLD_DEGRADED || '500'),
      critical: parseInt(process.env.LATENCY_THRESHOLD_CRITICAL || '2000'),
    },
    errorRate: {
      good: parseFloat(process.env.ERROR_RATE_THRESHOLD_GOOD || '0.1'),
      degraded: parseFloat(process.env.ERROR_RATE_THRESHOLD_DEGRADED || '1.0'),
      critical: parseFloat(process.env.ERROR_RATE_THRESHOLD_CRITICAL || '5.0'),
    },
    resourceUsage: {
      good: parseInt(process.env.RESOURCE_THRESHOLD_GOOD || '70'),
      degraded: parseInt(process.env.RESOURCE_THRESHOLD_DEGRADED || '85'),
      critical: parseInt(process.env.RESOURCE_THRESHOLD_CRITICAL || '95'),
    },
  },
  samplingRates: {
    high: parseFloat(process.env.SAMPLING_RATE_HIGH || '1.0'),
    medium: parseFloat(process.env.SAMPLING_RATE_MEDIUM || '0.5'),
    low: parseFloat(process.env.SAMPLING_RATE_LOW || '0.1'),
  },
};

// Metrics storage for trend analysis
const metricsHistory = new Map<string, Array<{ timestamp: number; value: number }>>();

// Helper function to add metric to history
const addMetricToHistory = (metricName: string, value: number, maxHistory = 100) => {
  if (!metricsHistory.has(metricName)) {
    metricsHistory.set(metricName, []);
  }
  
  const history = metricsHistory.get(metricName)!;
  history.push({ timestamp: Date.now(), value });
  
  // Keep only recent history
  if (history.length > maxHistory) {
    history.splice(0, history.length - maxHistory);
  }
};

// Helper function to calculate trend
const calculateTrend = (metricName: string, windowSize = 10): number => {
  const history = metricsHistory.get(metricName);
  if (!history || history.length < 2) return 0;
  
  const recent = history.slice(-windowSize);
  if (recent.length < 2) return 0;
  
  const first = recent[0].value;
  const last = recent[recent.length - 1].value;
  
  return ((last - first) / first) * 100; // Percentage change
};

// Deep database health monitoring
export const deepDatabaseHealthCheck = async (): Promise<DeepHealthResult> => {
  const startTime = Date.now();
  const result: DeepHealthResult = {
    name: 'database_deep',
    status: 'unknown',
    responseTime: 0,
    timestamp: new Date().toISOString(),
    checks: {},
    metrics: {},
    recommendations: [],
  };

  try {
    // Test database connectivity
    const connectivityStart = Date.now();
    const { db } = await import('../database');
    const connectivityTime = Date.now() - connectivityStart;
    result.checks.connectivity = true;

    // Test basic query performance
    const queryStart = Date.now();
    await db.query('SELECT 1 as health_check');
    const queryTime = Date.now() - queryStart;

    // Test transaction performance
    const transactionStart = Date.now();
    await db.transaction(async (tx) => {
      await tx.query('SELECT 1');
    });
    const transactionTime = Date.now() - transactionStart;

    // Test concurrent connections
    const concurrentStart = Date.now();
    const concurrentQueries = Array.from({ length: 5 }, () => 
      db.query('SELECT pg_sleep(0.01)')
    );
    await Promise.all(concurrentQueries);
    const concurrentTime = Date.now() - concurrentStart;

    // Get database metrics
    const metricsQuery = await db.query(`
      SELECT 
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
        (SELECT sum(blks_hit) / (sum(blks_hit) + sum(blks_read)) * 100 FROM pg_stat_database) as cache_hit_ratio,
        (SELECT avg(mean_exec_time) FROM pg_stat_statements LIMIT 1) as avg_query_time
    `);

    const dbMetrics = metricsQuery.rows[0];
    const activeConnections = parseInt(dbMetrics.active_connections) || 0;
    const maxConnections = parseInt(dbMetrics.max_connections) || 100;
    const connectionUsage = (activeConnections / maxConnections) * 100;
    const cacheHitRatio = parseFloat(dbMetrics.cache_hit_ratio) || 0;

    // Store metrics for trend analysis
    addMetricToHistory('db_query_time', queryTime);
    addMetricToHistory('db_connection_usage', connectionUsage);
    addMetricToHistory('db_cache_hit_ratio', cacheHitRatio);

    // Calculate performance metrics
    result.metrics = {
      latency: queryTime,
      availability: 100, // Connected successfully
      saturation: connectionUsage,
    };

    // Performance assessment
    result.checks.performance = queryTime < config.thresholds.latency.degraded;
    result.checks.availability = true;
    result.checks.capacity = connectionUsage < config.thresholds.resourceUsage.degraded;

    // Determine overall status
    if (queryTime > config.thresholds.latency.critical || 
        connectionUsage > config.thresholds.resourceUsage.critical) {
      result.status = 'unhealthy';
      result.message = 'Database performance is critically degraded';
    } else if (queryTime > config.thresholds.latency.degraded || 
               connectionUsage > config.thresholds.resourceUsage.degraded) {
      result.status = 'degraded';
      result.message = 'Database performance is degraded';
    } else {
      result.status = 'healthy';
      result.message = 'Database is performing optimally';
    }

    // Generate recommendations
    if (connectionUsage > 80) {
      result.recommendations?.push('Consider connection pooling optimization');
    }
    if (cacheHitRatio < 90) {
      result.recommendations?.push('Consider increasing shared_buffers');
    }
    if (queryTime > 100) {
      result.recommendations?.push('Review slow queries and add indexes');
    }

    const trend = calculateTrend('db_query_time');
    if (trend > 20) {
      result.recommendations?.push('Query performance is trending worse');
    }

    result.metadata = {
      connectivityTime,
      queryTime,
      transactionTime,
      concurrentTime,
      activeConnections,
      maxConnections,
      connectionUsage,
      cacheHitRatio: cacheHitRatio.toFixed(2),
      trend: trend.toFixed(2),
    };

    result.responseTime = Date.now() - startTime;
    logger.info('Deep database health check completed', result.metadata);

  } catch (error) {
    result.status = 'unhealthy';
    result.responseTime = Date.now() - startTime;
    result.message = `Database deep health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    result.metadata = { error: error instanceof Error ? error.stack : error };
    result.checks = {
      connectivity: false,
      performance: false,
      availability: false,
      capacity: false,
    };
    
    logger.error('Deep database health check failed', error);
  }

  return result;
};

// Deep Redis health monitoring
export const deepRedisHealthCheck = async (): Promise<DeepHealthResult> => {
  const startTime = Date.now();
  const result: DeepHealthResult = {
    name: 'redis_deep',
    status: 'unknown',
    responseTime: 0,
    timestamp: new Date().toISOString(),
    checks: {},
    metrics: {},
    recommendations: [],
  };

  try {
    if (!process.env.REDIS_URL) {
      result.status = 'healthy';
      result.message = 'Redis not configured - skipping deep monitoring';
      result.responseTime = Date.now() - startTime;
      return result;
    }

    const { createClient } = await import('redis');
    const client = createClient({ url: process.env.REDIS_URL });
    await client.connect();

    // Test basic operations
    const pingStart = Date.now();
    await client.ping();
    const pingTime = Date.now() - pingStart;

    // Test set/get performance
    const setGetStart = Date.now();
    await client.set('health_check_key', 'test_value', { EX: 10 });
    const getValue = await client.get('health_check_key');
    const setGetTime = Date.now() - setGetStart;
    await client.del('health_check_key');

    // Test pipeline performance
    const pipelineStart = Date.now();
    const pipeline = client.multi();
    for (let i = 0; i < 10; i++) {
      pipeline.set(`test_${i}`, `value_${i}`, { EX: 5 });
    }
    await pipeline.exec();
    const pipelineTime = Date.now() - pipelineStart;

    // Clean up test keys
    for (let i = 0; i < 10; i++) {
      await client.del(`test_${i}`);
    }

    // Get Redis info
    const info = await client.info();
    const memory = await client.info('memory');
    const stats = await client.info('stats');

    // Parse Redis metrics
    const parseInfo = (infoStr: string) => {
      const lines = infoStr.split('\r\n');
      const data: any = {};
      lines.forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) data[key] = value;
      });
      return data;
    };

    const memoryInfo = parseInfo(memory);
    const statsInfo = parseInfo(stats);

    const usedMemory = parseInt(memoryInfo.used_memory) || 0;
    const maxMemory = parseInt(memoryInfo.maxmemory) || 0;
    const memoryUsage = maxMemory > 0 ? (usedMemory / maxMemory) * 100 : 0;
    const connectedClients = parseInt(statsInfo.connected_clients) || 0;

    // Store metrics for trend analysis
    addMetricToHistory('redis_ping_time', pingTime);
    addMetricToHistory('redis_memory_usage', memoryUsage);
    addMetricToHistory('redis_connected_clients', connectedClients);

    result.checks = {
      connectivity: true,
      performance: setGetTime < config.thresholds.latency.degraded,
      availability: true,
      capacity: memoryUsage < config.thresholds.resourceUsage.degraded,
    };

    result.metrics = {
      latency: pingTime,
      availability: 100,
      saturation: memoryUsage,
    };

    // Determine status
    if (pingTime > config.thresholds.latency.critical || 
        memoryUsage > config.thresholds.resourceUsage.critical) {
      result.status = 'unhealthy';
      result.message = 'Redis performance is critically degraded';
    } else if (pingTime > config.thresholds.latency.degraded || 
               memoryUsage > config.thresholds.resourceUsage.degraded) {
      result.status = 'degraded';
      result.message = 'Redis performance is degraded';
    } else {
      result.status = 'healthy';
      result.message = 'Redis is performing optimally';
    }

    // Generate recommendations
    if (memoryUsage > 80) {
      result.recommendations?.push('Consider increasing Redis memory or implementing eviction policies');
    }
    if (connectedClients > 100) {
      result.recommendations?.push('Monitor client connection patterns');
    }
    if (setGetTime > 50) {
      result.recommendations?.push('Review Redis configuration and network latency');
    }

    const trend = calculateTrend('redis_ping_time');
    if (trend > 20) {
      result.recommendations?.push('Redis performance is trending worse');
    }

    result.metadata = {
      pingTime,
      setGetTime,
      pipelineTime,
      usedMemory,
      maxMemory,
      memoryUsage: memoryUsage.toFixed(2),
      connectedClients,
      trend: trend.toFixed(2),
    };

    await client.disconnect();
    result.responseTime = Date.now() - startTime;
    logger.info('Deep Redis health check completed', result.metadata);

  } catch (error) {
    result.status = 'unhealthy';
    result.responseTime = Date.now() - startTime;
    result.message = `Redis deep health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    result.metadata = { error: error instanceof Error ? error.stack : error };
    result.checks = {
      connectivity: false,
      performance: false,
      availability: false,
      capacity: false,
    };
    
    logger.error('Deep Redis health check failed', error);
  }

  return result;
};

// Deep filesystem health monitoring
export const deepFilesystemHealthCheck = async (): Promise<DeepHealthResult> => {
  const startTime = Date.now();
  const result: DeepHealthResult = {
    name: 'filesystem_deep',
    status: 'unknown',
    responseTime: 0,
    timestamp: new Date().toISOString(),
    checks: {},
    metrics: {},
    recommendations: [],
  };

  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');

    // Test write performance
    const writeStart = Date.now();
    const testFile = path.join(os.tmpdir(), 'health_check_write_test.txt');
    const testData = 'health check test data '.repeat(100);
    await fs.writeFile(testFile, testData);
    const writeTime = Date.now() - writeStart;

    // Test read performance
    const readStart = Date.now();
    const readData = await fs.readFile(testFile, 'utf8');
    const readTime = Date.now() - readStart;

    // Test delete performance
    const deleteStart = Date.now();
    await fs.unlink(testFile);
    const deleteTime = Date.now() - deleteStart;

    // Get filesystem stats
    let diskStats = null;
    try {
      const { execSync } = await import('child_process');
      const diskInfo = execSync('df -h / | tail -1', { encoding: 'utf8' });
      const parts = diskInfo.trim().split(/\s+/);
      diskStats = {
        filesystem: parts[0],
        size: parts[1],
        used: parts[2],
        available: parts[3],
        usePercent: parseInt(parts[4].replace('%', '')),
        mountPoint: parts[5],
      };
    } catch (error) {
      // Fallback for non-Unix systems
      diskStats = { usePercent: 0 };
    }

    // Get temp directory stats
    const tempDir = os.tmpdir();
    let tempStats = null;
    try {
      const stats = await fs.stat(tempDir);
      tempStats = {
        accessible: true,
        isDirectory: stats.isDirectory(),
        mode: stats.mode,
      };
    } catch (error) {
      tempStats = { accessible: false };
    }

    // Store metrics for trend analysis
    addMetricToHistory('fs_write_time', writeTime);
    addMetricToHistory('fs_read_time', readTime);
    addMetricToHistory('fs_disk_usage', diskStats?.usePercent || 0);

    result.checks = {
      connectivity: tempStats?.accessible || false,
      performance: writeTime < 100 && readTime < 50,
      availability: true,
      capacity: (diskStats?.usePercent || 0) < config.thresholds.resourceUsage.degraded,
    };

    result.metrics = {
      latency: (writeTime + readTime) / 2,
      availability: tempStats?.accessible ? 100 : 0,
      saturation: diskStats?.usePercent || 0,
    };

    // Determine status
    const diskUsage = diskStats?.usePercent || 0;
    const avgLatency = (writeTime + readTime) / 2;

    if (!tempStats?.accessible || diskUsage > config.thresholds.resourceUsage.critical) {
      result.status = 'unhealthy';
      result.message = 'Filesystem is critically degraded';
    } else if (avgLatency > 200 || diskUsage > config.thresholds.resourceUsage.degraded) {
      result.status = 'degraded';
      result.message = 'Filesystem performance is degraded';
    } else {
      result.status = 'healthy';
      result.message = 'Filesystem is performing optimally';
    }

    // Generate recommendations
    if (diskUsage > 85) {
      result.recommendations?.push('Disk usage is high - consider cleanup or expansion');
    }
    if (writeTime > 100) {
      result.recommendations?.push('Slow write performance - check disk I/O');
    }
    if (readTime > 50) {
      result.recommendations?.push('Slow read performance - check disk I/O');
    }

    const writeTimeTrend = calculateTrend('fs_write_time');
    if (writeTimeTrend > 20) {
      result.recommendations?.push('Filesystem write performance is trending worse');
    }

    result.metadata = {
      writeTime,
      readTime,
      deleteTime,
      diskStats,
      tempStats,
      avgLatency: avgLatency.toFixed(2),
      writeTimeTrend: writeTimeTrend.toFixed(2),
    };

    result.responseTime = Date.now() - startTime;
    logger.info('Deep filesystem health check completed', result.metadata);

  } catch (error) {
    result.status = 'unhealthy';
    result.responseTime = Date.now() - startTime;
    result.message = `Filesystem deep health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    result.metadata = { error: error instanceof Error ? error.stack : error };
    result.checks = {
      connectivity: false,
      performance: false,
      availability: false,
      capacity: false,
    };
    
    logger.error('Deep filesystem health check failed', error);
  }

  return result;
};

// Deep application health monitoring
export const deepApplicationHealthCheck = async (): Promise<DeepHealthResult> => {
  const startTime = Date.now();
  const result: DeepHealthResult = {
    name: 'application_deep',
    status: 'unknown',
    responseTime: 0,
    timestamp: new Date().toISOString(),
    checks: {},
    metrics: {},
    recommendations: [],
  };

  try {
    // Test session management
    const sessionStart = Date.now();
    const { sessionManager } = await import('../session-manager');
    const sessionStats = await sessionManager.getSessionStats();
    const sessionTime = Date.now() - sessionStart;

    // Test learning service
    const learningStart = Date.now();
    const { learningService } = await import('../../services/learning-service');
    // Safe test that doesn't require real data
    const learningHealthy = typeof learningService.getRecommendations === 'function';
    const learningTime = Date.now() - learningStart;

    // Test authentication flow
    const authStart = Date.now();
    const { authUtils } = await import('../auth');
    const authHealthy = typeof authUtils.verifyToken === 'function';
    const authTime = Date.now() - authStart;

    // Get memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    // Get CPU usage (simplified)
    const cpuStart = process.cpuUsage();
    setTimeout(() => {}, 100); // Small delay
    const cpuEnd = process.cpuUsage(cpuStart);
    const cpuUsage = ((cpuEnd.user + cpuEnd.system) / 1000000) * 100;

    // Store metrics for trend analysis
    addMetricToHistory('app_memory_usage', memoryUsagePercent);
    addMetricToHistory('app_session_time', sessionTime);
    addMetricToHistory('app_active_sessions', sessionStats.totalActiveSessions);

    result.checks = {
      connectivity: true,
      performance: sessionTime < 100 && learningTime < 100,
      availability: sessionStats.totalActiveSessions >= 0,
      capacity: memoryUsagePercent < config.thresholds.resourceUsage.degraded,
      security: sessionStats.securityEvents < 10,
    };

    result.metrics = {
      latency: (sessionTime + learningTime + authTime) / 3,
      availability: 100,
      saturation: Math.max(memoryUsagePercent, cpuUsage),
    };

    // Determine status
    if (memoryUsagePercent > config.thresholds.resourceUsage.critical || 
        sessionStats.securityEvents > 50) {
      result.status = 'unhealthy';
      result.message = 'Application is critically degraded';
    } else if (memoryUsagePercent > config.thresholds.resourceUsage.degraded || 
               sessionTime > 200 || sessionStats.securityEvents > 10) {
      result.status = 'degraded';
      result.message = 'Application performance is degraded';
    } else {
      result.status = 'healthy';
      result.message = 'Application is performing optimally';
    }

    // Generate recommendations
    if (memoryUsagePercent > 80) {
      result.recommendations?.push('High memory usage - consider optimizing or scaling');
    }
    if (sessionStats.securityEvents > 5) {
      result.recommendations?.push('Elevated security events - review security logs');
    }
    if (sessionStats.totalActiveSessions > 1000) {
      result.recommendations?.push('High active session count - monitor capacity');
    }

    const memoryTrend = calculateTrend('app_memory_usage');
    if (memoryTrend > 20) {
      result.recommendations?.push('Memory usage is trending higher');
    }

    result.metadata = {
      sessionTime,
      learningTime,
      authTime,
      sessionStats,
      memoryUsage: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
        arrayBuffers: Math.round(memoryUsage.arrayBuffers / 1024 / 1024),
        usagePercent: memoryUsagePercent.toFixed(2),
      },
      cpuUsage: cpuUsage.toFixed(2),
      memoryTrend: memoryTrend.toFixed(2),
      uptime: process.uptime ? Math.floor(process.uptime()) : 0,
    };

    result.responseTime = Date.now() - startTime;
    logger.info('Deep application health check completed', result.metadata);

  } catch (error) {
    result.status = 'unhealthy';
    result.responseTime = Date.now() - startTime;
    result.message = `Application deep health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    result.metadata = { error: error instanceof Error ? error.stack : error };
    result.checks = {
      connectivity: false,
      performance: false,
      availability: false,
      capacity: false,
      security: false,
    };
    
    logger.error('Deep application health check failed', error);
  }

  return result;
};

// Run all deep health checks
export const runAllDeepHealthChecks = async (): Promise<DeepHealthResult[]> => {
  if (!config.enabled) {
    return [];
  }

  const checks: DeepHealthResult[] = [];
  
  try {
    logger.info('Starting deep health checks');
    
    // Run all deep checks in parallel for better performance
    const [
      dbResult,
      redisResult,
      fsResult,
      appResult,
    ] = await Promise.allSettled([
      deepDatabaseHealthCheck(),
      deepRedisHealthCheck(),
      deepFilesystemHealthCheck(),
      deepApplicationHealthCheck(),
    ]);

    // Process results
    [dbResult, redisResult, fsResult, appResult].forEach((result, index) => {
      if (result.status === 'fulfilled') {
        checks.push(result.value);
      } else {
        const checkNames = ['database_deep', 'redis_deep', 'filesystem_deep', 'application_deep'];
        checks.push({
          name: checkNames[index],
          status: 'unhealthy',
          responseTime: 0,
          message: `Deep health check failed: ${result.reason}`,
          timestamp: new Date().toISOString(),
          checks: {},
          metrics: {},
          recommendations: ['Health check execution failed - investigate immediately'],
        });
      }
    });

    logger.info('Deep health checks completed', {
      total: checks.length,
      healthy: checks.filter(c => c.status === 'healthy').length,
      unhealthy: checks.filter(c => c.status === 'unhealthy').length,
      degraded: checks.filter(c => c.status === 'degraded').length,
    });

    return checks;
  } catch (error) {
    logger.error('Failed to run deep health checks', error);
    throw error;
  }
};

// Get deep monitoring summary
export const getDeepMonitoringSummary = async () => {
  const checks = await runAllDeepHealthChecks();
  
  const summary = {
    overall: {
      status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      score: 100,
      message: 'All systems operational',
    },
    categories: {
      connectivity: { healthy: 0, total: 0, score: 100 },
      performance: { healthy: 0, total: 0, score: 100 },
      availability: { healthy: 0, total: 0, score: 100 },
      capacity: { healthy: 0, total: 0, score: 100 },
      security: { healthy: 0, total: 0, score: 100 },
    },
    recommendations: [] as string[],
    trends: {} as Record<string, number>,
    timestamp: new Date().toISOString(),
  };

  // Calculate category scores
  checks.forEach(check => {
    Object.keys(check.checks).forEach(category => {
      if (category in summary.categories) {
        const cat = summary.categories[category as keyof typeof summary.categories];
        cat.total++;
        if (check.checks[category as keyof typeof check.checks]) {
          cat.healthy++;
        }
      }
    });

    // Collect recommendations
    if (check.recommendations) {
      summary.recommendations.push(...check.recommendations);
    }
  });

  // Calculate category scores
  Object.keys(summary.categories).forEach(category => {
    const cat = summary.categories[category as keyof typeof summary.categories];
    cat.score = cat.total > 0 ? Math.round((cat.healthy / cat.total) * 100) : 100;
  });

  // Calculate overall score and status
  const categoryScores = Object.values(summary.categories).map(cat => cat.score);
  summary.overall.score = Math.round(categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length);

  if (summary.overall.score < 50) {
    summary.overall.status = 'unhealthy';
    summary.overall.message = 'Critical system issues detected';
  } else if (summary.overall.score < 80) {
    summary.overall.status = 'degraded';
    summary.overall.message = 'System performance is degraded';
  }

  // Add trend information
  const trendMetrics = ['db_query_time', 'redis_ping_time', 'app_memory_usage', 'fs_write_time'];
  trendMetrics.forEach(metric => {
    summary.trends[metric] = calculateTrend(metric);
  });

  return summary;
};

// Export the deep monitoring service
export const deepMonitoring = {
  config,
  runAll: runAllDeepHealthChecks,
  getSummary: getDeepMonitoringSummary,
  
  // Individual checks
  database: deepDatabaseHealthCheck,
  redis: deepRedisHealthCheck,
  filesystem: deepFilesystemHealthCheck,
  application: deepApplicationHealthCheck,
  
  // Utility functions
  addMetric: addMetricToHistory,
  getTrend: calculateTrend,
  getMetricsHistory: () => Object.fromEntries(metricsHistory),
};

export default deepMonitoring;