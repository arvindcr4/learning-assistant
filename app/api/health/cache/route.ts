import { NextRequest, NextResponse } from 'next/server';
import { distributedCache } from '@/lib/cache/distributed-cache-service';
import { cacheManager } from '@/lib/cache';
import { sessionCache } from '@/lib/session-cache';
import { contentCache } from '@/lib/content-cache';
import { cacheMonitoring } from '@/lib/cache-monitoring';
import { cacheWarming } from '@/lib/cache-warming';
import { cacheInvalidation } from '@/lib/cache-invalidation';
import { redisManager } from '@/lib/redis-client';
import { env } from '@/lib/env-validation';
import logger from '@/lib/logger';

// ====================
// CACHE HEALTH ENDPOINT
// ====================

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const url = new URL(request.url);
    const detailed = url.searchParams.get('detailed') === 'true';
    const includeMetrics = url.searchParams.get('metrics') === 'true';
    const includeOperations = url.searchParams.get('operations') === 'true';

    // Basic cache health checks
    const [
      distributedCacheHealth,
      memoryCacheStats,
      sessionCacheStats,
      contentCacheStats,
      redisMetrics,
      warmupMetrics,
      invalidationMetrics,
      monitoringHealth
    ] = await Promise.allSettled([
      distributedCache.getHealthStatus(),
      cacheManager.getStats(),
      sessionCache.getSessionStats(),
      contentCache.getContentStats(),
      Promise.resolve(redisManager.getMetrics()),
      Promise.resolve(cacheWarming.getMetrics()),
      Promise.resolve(cacheInvalidation.getMetrics()),
      cacheMonitoring.getHealthStatus()
    ]);

    // Calculate overall health status
    const overallStatus = calculateOverallCacheHealth({
      distributedCacheHealth,
      memoryCacheStats,
      sessionCacheStats,
      contentCacheStats,
      redisMetrics,
      monitoringHealth
    });

    const responseTime = Date.now() - startTime;

    // Basic health response
    const health = {
      status: overallStatus.status,
      message: overallStatus.message,
      timestamp: new Date().toISOString(),
      responseTime,
      
      // Core cache systems
      systems: {
        distributedCache: {
          status: distributedCacheHealth.status === 'fulfilled' ? 
            distributedCacheHealth.value.status : 'unhealthy',
          shards: distributedCacheHealth.status === 'fulfilled' ? 
            Object.keys(distributedCacheHealth.value.shards).length : 0,
          nodes: distributedCacheHealth.status === 'fulfilled' ? 
            Object.keys(distributedCacheHealth.value.nodes).length : 0,
        },
        memoryCache: {
          status: memoryCacheStats.status === 'fulfilled' ? 'healthy' : 'unhealthy',
          hitRate: memoryCacheStats.status === 'fulfilled' ? 
            memoryCacheStats.value.hitRate : 0,
          totalKeys: memoryCacheStats.status === 'fulfilled' ? 
            memoryCacheStats.value.totalKeys : 0,
        },
        sessionCache: {
          status: sessionCacheStats.status === 'fulfilled' ? 'healthy' : 'unhealthy',
          activeSessions: sessionCacheStats.status === 'fulfilled' ? 
            sessionCacheStats.value.activeSessions : 0,
          totalSessions: sessionCacheStats.status === 'fulfilled' ? 
            sessionCacheStats.value.totalSessions : 0,
        },
        contentCache: {
          status: contentCacheStats.status === 'fulfilled' ? 'healthy' : 'unhealthy',
          cachedContent: contentCacheStats.status === 'fulfilled' ? 
            contentCacheStats.value.cachedContent : 0,
          hitRate: contentCacheStats.status === 'fulfilled' ? 
            contentCacheStats.value.hitRate : 0,
        },
        redis: {
          status: redisMetrics.status === 'fulfilled' ? 'healthy' : 'unhealthy',
          connections: redisMetrics.status === 'fulfilled' ? 
            redisMetrics.value.connectionCount : 0,
          memoryUsage: redisMetrics.status === 'fulfilled' ? 
            redisMetrics.value.usedMemoryHuman : 'unknown',
        },
      },

      // Summary metrics
      summary: {
        totalCacheHits: calculateTotalHits({
          memoryCacheStats,
          sessionCacheStats,
          contentCacheStats,
          redisMetrics
        }),
        totalCacheSize: calculateTotalSize({
          memoryCacheStats,
          redisMetrics
        }),
        overallHitRate: calculateOverallHitRate({
          memoryCacheStats,
          sessionCacheStats,
          contentCacheStats,
          redisMetrics
        }),
        avgResponseTime: responseTime,
      },
    };

    // Add detailed information if requested
    if (detailed) {
      (health as any).detailed = {
        distributedCache: distributedCacheHealth.status === 'fulfilled' ? 
          distributedCacheHealth.value : { error: 'Failed to get distributed cache health' },
        
        operations: {
          warming: warmupMetrics.status === 'fulfilled' ? {
            status: 'healthy',
            metrics: warmupMetrics.value
          } : { status: 'unhealthy', error: 'Failed to get warming metrics' },
          
          invalidation: invalidationMetrics.status === 'fulfilled' ? {
            status: 'healthy',
            metrics: invalidationMetrics.value
          } : { status: 'unhealthy', error: 'Failed to get invalidation metrics' },
          
          monitoring: monitoringHealth.status === 'fulfilled' ? {
            status: 'healthy',
            health: monitoringHealth.value
          } : { status: 'unhealthy', error: 'Failed to get monitoring health' },
        },

        performance: await getCachePerformanceMetrics(),
        
        configuration: {
          redisClusterEnabled: env.REDIS_CLUSTER_ENABLED,
          compressionEnabled: env.CACHE_COMPRESSION_ENABLED,
          compressionThreshold: env.CACHE_COMPRESSION_THRESHOLD,
          defaultTTL: env.CACHE_TTL_DEFAULT,
          warmingEnabled: env.CACHE_WARMING_ENABLED,
          metricsEnabled: env.CACHE_METRICS_ENABLED,
        },
      };
    }

    // Add operation history if requested
    if (includeOperations && distributedCacheHealth.status === 'fulfilled') {
      (health as any).operations = {
        recent: distributedCache.getOperationHistory(50),
        patterns: await getCachePatternUsage(),
      };
    }

    // Add comprehensive metrics if requested
    if (includeMetrics) {
      (health as any).metrics = {
        redis: redisMetrics.status === 'fulfilled' ? redisMetrics.value : null,
        memory: memoryCacheStats.status === 'fulfilled' ? memoryCacheStats.value : null,
        sessions: sessionCacheStats.status === 'fulfilled' ? sessionCacheStats.value : null,
        content: contentCacheStats.status === 'fulfilled' ? contentCacheStats.value : null,
        distributed: distributedCacheHealth.status === 'fulfilled' ? 
          distributedCacheHealth.value.metrics : null,
      };
    }

    // Determine HTTP status code
    const httpStatus = overallStatus.status === 'unhealthy' ? 503 : 
                     overallStatus.status === 'degraded' ? 200 : 200;

    const response = NextResponse.json(health, { status: httpStatus });
    
    // Add cache-specific headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('X-Cache-Status', overallStatus.status);
    response.headers.set('X-Cache-Response-Time', responseTime.toString());
    response.headers.set('X-Cache-Hit-Rate', health.summary.overallHitRate.toFixed(2));
    
    return response;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('Cache health check error:', error);
    
    const errorHealth = { 
      status: 'unhealthy',
      error: 'Cache health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      responseTime,
    };

    const response = NextResponse.json(errorHealth, { status: 500 });
    
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('X-Cache-Status', 'unhealthy');
    response.headers.set('X-Cache-Response-Time', responseTime.toString());
    
    return response;
  }
}

// ====================
// CACHE MANAGEMENT ENDPOINTS
// ====================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, params } = body;

    switch (action) {
      case 'clear':
        return await handleClearCache(params);
      case 'warm':
        return await handleWarmCache(params);
      case 'invalidate':
        return await handleInvalidateCache(params);
      case 'refresh':
        return await handleRefreshCache(params);
      default:
        return NextResponse.json(
          { error: 'Invalid action', supportedActions: ['clear', 'warm', 'invalidate', 'refresh'] },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Cache management error:', error);
    return NextResponse.json(
      { error: 'Cache management failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ====================
// HELPER FUNCTIONS
// ====================

function calculateOverallCacheHealth(results: any): { status: string; message: string } {
  const systems = [
    results.distributedCacheHealth,
    results.memoryCacheStats,
    results.sessionCacheStats,
    results.contentCacheStats,
    results.redisMetrics,
    results.monitoringHealth
  ];

  const failedSystems = systems.filter(s => s.status === 'rejected').length;
  const degradedSystems = systems.filter(s => 
    s.status === 'fulfilled' && 
    (s.value?.status === 'degraded' || s.value?.hitRate < 70)
  ).length;

  if (failedSystems > 2) {
    return { 
      status: 'unhealthy', 
      message: `${failedSystems} cache systems are failing` 
    };
  } else if (failedSystems > 0 || degradedSystems > 1) {
    return { 
      status: 'degraded', 
      message: `${failedSystems} systems failing, ${degradedSystems} degraded` 
    };
  } else {
    return { 
      status: 'healthy', 
      message: 'All cache systems operational' 
    };
  }
}

function calculateTotalHits(results: any): number {
  let totalHits = 0;
  
  if (results.memoryCacheStats.status === 'fulfilled') {
    totalHits += results.memoryCacheStats.value.hits || 0;
  }
  if (results.redisMetrics.status === 'fulfilled') {
    totalHits += results.redisMetrics.value.hits || 0;
  }
  
  return totalHits;
}

function calculateTotalSize(results: any): number {
  let totalSize = 0;
  
  if (results.memoryCacheStats.status === 'fulfilled') {
    totalSize += results.memoryCacheStats.value.totalSize || 0;
  }
  if (results.redisMetrics.status === 'fulfilled') {
    totalSize += results.redisMetrics.value.usedMemory || 0;
  }
  
  return totalSize;
}

function calculateOverallHitRate(results: any): number {
  const hitRates: number[] = [];
  
  if (results.memoryCacheStats.status === 'fulfilled' && results.memoryCacheStats.value.hitRate > 0) {
    hitRates.push(results.memoryCacheStats.value.hitRate);
  }
  if (results.contentCacheStats.status === 'fulfilled' && results.contentCacheStats.value.hitRate > 0) {
    hitRates.push(results.contentCacheStats.value.hitRate);
  }
  
  return hitRates.length > 0 ? hitRates.reduce((a, b) => a + b, 0) / hitRates.length : 0;
}

async function getCachePerformanceMetrics(): Promise<any> {
  try {
    const distributedMetrics = distributedCache.getMetrics();
    const operationHistory = distributedCache.getOperationHistory(100);
    
    // Calculate performance statistics
    const successful = operationHistory.filter(op => op.success).length;
    const total = operationHistory.length;
    const avgDuration = total > 0 ? 
      operationHistory.reduce((sum, op) => sum + op.duration, 0) / total : 0;
    
    return {
      successRate: total > 0 ? (successful / total) * 100 : 100,
      avgResponseTime: avgDuration,
      operationsPerSecond: calculateOpsPerSecond(operationHistory),
      errorRate: total > 0 ? ((total - successful) / total) * 100 : 0,
      distributedMetrics,
    };
  } catch (error) {
    return { error: 'Failed to get performance metrics' };
  }
}

function calculateOpsPerSecond(operations: any[]): number {
  if (operations.length === 0) return 0;
  
  const now = Date.now();
  const oneSecondAgo = now - 1000;
  const recentOps = operations.filter(op => op.timestamp > oneSecondAgo);
  
  return recentOps.length;
}

async function getCachePatternUsage(): Promise<any> {
  try {
    const operationHistory = distributedCache.getOperationHistory(1000);
    const patternCounts = operationHistory.reduce((counts, op) => {
      const strategy = op.options?.strategy || 'cache-aside';
      counts[strategy] = (counts[strategy] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    return {
      patterns: patternCounts,
      totalOperations: operationHistory.length,
      mostUsedPattern: Object.keys(patternCounts).reduce((a, b) => 
        patternCounts[a] > patternCounts[b] ? a : b, 'cache-aside'
      ),
    };
  } catch (error) {
    return { error: 'Failed to get pattern usage' };
  }
}

// ====================
// CACHE MANAGEMENT HANDLERS
// ====================

async function handleClearCache(params: any): Promise<NextResponse> {
  try {
    const { namespace, pattern } = params;
    
    let result;
    if (pattern) {
      result = await cacheManager.deleteByPattern(pattern, { namespace });
    } else if (namespace) {
      await cacheManager.clear(namespace);
      result = 'cleared';
    } else {
      await cacheManager.clear();
      result = 'cleared';
    }

    return NextResponse.json({
      success: true,
      action: 'clear',
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Clear failed' },
      { status: 500 }
    );
  }
}

async function handleWarmCache(params: any): Promise<NextResponse> {
  try {
    const { patterns } = params;
    
    if (patterns && Array.isArray(patterns)) {
      const execution = await cacheWarming.executeOnDemandWarmup(patterns);
      return NextResponse.json({
        success: true,
        action: 'warm',
        result: execution,
        timestamp: new Date().toISOString(),
      });
    } else {
      const metrics = await cacheWarming.executeStartupWarmup();
      return NextResponse.json({
        success: true,
        action: 'warm',
        result: metrics,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Warm failed' },
      { status: 500 }
    );
  }
}

async function handleInvalidateCache(params: any): Promise<NextResponse> {
  try {
    const { ruleId, eventType, eventData } = params;
    
    let result;
    if (ruleId) {
      // Execute specific invalidation rule
      const rule = cacheInvalidation['rules'].get(ruleId);
      if (!rule) {
        return NextResponse.json(
          { success: false, error: `Invalidation rule not found: ${ruleId}` },
          { status: 404 }
        );
      }
      result = await cacheInvalidation.executeRule(rule);
    } else if (eventType) {
      // Trigger invalidation event
      await cacheInvalidation.triggerEvent(eventType, eventData || {});
      result = { eventType, eventData };
    } else {
      return NextResponse.json(
        { success: false, error: 'Must specify ruleId or eventType for invalidation' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      action: 'invalidate',
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Invalidate failed' },
      { status: 500 }
    );
  }
}

async function handleRefreshCache(params: any): Promise<NextResponse> {
  try {
    const { keys, namespace } = params;
    
    if (!keys || !Array.isArray(keys)) {
      return NextResponse.json(
        { success: false, error: 'Keys array is required for refresh' },
        { status: 400 }
      );
    }

    const results = await Promise.allSettled(
      keys.map(async (key) => {
        // Delete the key to force refresh on next access
        return await cacheManager.delete(key, { namespace });
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;

    return NextResponse.json({
      success: true,
      action: 'refresh',
      result: {
        total: keys.length,
        successful,
        failed: keys.length - successful,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Refresh failed' },
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