// Database performance monitoring and optimization
import logger from '../logger';
import { metricsUtils } from '../metrics';
import { apm } from '../apm';

export interface DatabaseMetrics {
  connections: {
    total: number;
    active: number;
    idle: number;
    waiting: number;
  };
  queries: {
    total: number;
    slow_queries: number;
    failed_queries: number;
    avg_duration: number;
    queries_per_second: number;
  };
  performance: {
    cache_hit_ratio: number;
    lock_waits: number;
    deadlocks: number;
    buffer_pool_usage: number;
  };
  storage: {
    size: number;
    growth_rate: number;
    fragmentation: number;
    index_usage: number;
  };
}

export interface SlowQuery {
  id: string;
  query: string;
  duration: number;
  timestamp: string;
  table: string;
  execution_plan?: string;
  recommendations?: string[];
}

export interface QueryOptimization {
  query_id: string;
  original_query: string;
  optimized_query?: string;
  performance_gain: number;
  recommendations: string[];
  status: 'pending' | 'implemented' | 'tested' | 'rejected';
}

// Database monitoring configuration
const dbConfig = {
  enabled: process.env.ENABLE_DB_MONITORING === 'true',
  slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000'), // ms
  connectionThreshold: parseInt(process.env.DB_CONNECTION_THRESHOLD || '80'),
  cacheHitThreshold: parseFloat(process.env.CACHE_HIT_THRESHOLD || '0.9'),
  analyzeInterval: parseInt(process.env.DB_ANALYZE_INTERVAL || '3600'), // seconds
};

// Database monitoring state
const dbState = {
  metrics: {
    connections: { total: 0, active: 0, idle: 0, waiting: 0 },
    queries: { total: 0, slow_queries: 0, failed_queries: 0, avg_duration: 0, queries_per_second: 0 },
    performance: { cache_hit_ratio: 0, lock_waits: 0, deadlocks: 0, buffer_pool_usage: 0 },
    storage: { size: 0, growth_rate: 0, fragmentation: 0, index_usage: 0 },
  } as DatabaseMetrics,
  slowQueries: [] as SlowQuery[],
  optimizations: [] as QueryOptimization[],
  lastAnalysis: 0,
  queryStats: new Map<string, { count: number; totalDuration: number; avgDuration: number }>(),
};

// Query analysis and optimization
const queryAnalyzer = {
  analyzeQuery: (query: string, duration: number, table?: string): SlowQuery | null => {
    if (duration < dbConfig.slowQueryThreshold) return null;

    const slowQuery: SlowQuery = {
      id: `sq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      query: query.length > 500 ? query.substring(0, 500) + '...' : query,
      duration,
      timestamp: new Date().toISOString(),
      table: table || queryAnalyzer.extractTableName(query),
      recommendations: queryAnalyzer.generateRecommendations(query, duration),
    };

    dbState.slowQueries.push(slowQuery);
    dbState.metrics.queries.slow_queries++;

    // Keep only last 100 slow queries
    if (dbState.slowQueries.length > 100) {
      dbState.slowQueries = dbState.slowQueries.slice(-100);
    }

    logger.warn('Slow query detected', {
      query_id: slowQuery.id,
      duration,
      table: slowQuery.table,
      query: slowQuery.query,
    });

    return slowQuery;
  },

  extractTableName: (query: string): string => {
    const patterns = [
      /FROM\s+([`"]?)(\w+)\1/i,
      /UPDATE\s+([`"]?)(\w+)\1/i,
      /INSERT\s+INTO\s+([`"]?)(\w+)\1/i,
      /DELETE\s+FROM\s+([`"]?)(\w+)\1/i,
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match && match[2]) {
        return match[2];
      }
    }

    return 'unknown';
  },

  generateRecommendations: (query: string, duration: number): string[] => {
    const recommendations: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Check for missing indexes
    if (lowerQuery.includes('where') && !lowerQuery.includes('index')) {
      recommendations.push('Consider adding indexes on WHERE clause columns');
    }

    // Check for SELECT *
    if (lowerQuery.includes('select *')) {
      recommendations.push('Avoid SELECT * - specify only needed columns');
    }

    // Check for JOINs without proper conditions
    if (lowerQuery.includes('join') && !lowerQuery.includes('on')) {
      recommendations.push('Ensure JOINs have proper ON conditions');
    }

    // Check for LIMIT usage
    if (lowerQuery.includes('select') && !lowerQuery.includes('limit') && duration > 2000) {
      recommendations.push('Consider adding LIMIT to reduce result set size');
    }

    // Check for ORDER BY without index
    if (lowerQuery.includes('order by')) {
      recommendations.push('Ensure ORDER BY columns are indexed');
    }

    // Check for subqueries
    if (lowerQuery.includes('select') && lowerQuery.match(/\(/g)?.length > 0) {
      recommendations.push('Consider rewriting subqueries as JOINs if possible');
    }

    // Duration-based recommendations
    if (duration > 5000) {
      recommendations.push('Query is taking over 5 seconds - review query structure');
    }

    return recommendations;
  },

  optimizeQuery: (queryId: string): QueryOptimization | null => {
    const slowQuery = dbState.slowQueries.find(q => q.id === queryId);
    if (!slowQuery) return null;

    const optimization: QueryOptimization = {
      query_id: queryId,
      original_query: slowQuery.query,
      performance_gain: 0,
      recommendations: slowQuery.recommendations || [],
      status: 'pending',
    };

    // Generate optimized query suggestions
    optimization.optimized_query = queryAnalyzer.generateOptimizedQuery(slowQuery.query);
    optimization.performance_gain = queryAnalyzer.estimatePerformanceGain(slowQuery.query);

    dbState.optimizations.push(optimization);

    return optimization;
  },

  generateOptimizedQuery: (originalQuery: string): string => {
    let optimized = originalQuery;

    // Replace SELECT * with specific columns (placeholder)
    if (optimized.toLowerCase().includes('select *')) {
      optimized = optimized.replace(/SELECT \*/gi, 'SELECT id, name, created_at /* Add specific columns */');
    }

    // Add LIMIT if missing
    if (!optimized.toLowerCase().includes('limit') && optimized.toLowerCase().includes('select')) {
      optimized += ' LIMIT 100';
    }

    return optimized;
  },

  estimatePerformanceGain: (query: string): number => {
    let gain = 0;
    const lowerQuery = query.toLowerCase();

    // Estimate gains from various optimizations
    if (lowerQuery.includes('select *')) gain += 20;
    if (!lowerQuery.includes('limit') && lowerQuery.includes('select')) gain += 30;
    if (lowerQuery.includes('order by')) gain += 15;
    if (lowerQuery.includes('join')) gain += 25;

    return Math.min(gain, 80); // Cap at 80% improvement
  },
};

// Database monitoring service
export const databaseMonitoring = {
  trackQuery: (query: string, duration: number, table?: string, error?: Error) => {
    if (!dbConfig.enabled) return;

    const traceId = apm.startTrace('db_query_tracking');

    try {
      // Update query statistics
      const queryHash = queryAnalyzer.extractTableName(query) + '_' + query.substring(0, 50);
      const stats = dbState.queryStats.get(queryHash) || { count: 0, totalDuration: 0, avgDuration: 0 };
      
      stats.count++;
      stats.totalDuration += duration;
      stats.avgDuration = stats.totalDuration / stats.count;
      
      dbState.queryStats.set(queryHash, stats);

      // Update metrics
      dbState.metrics.queries.total++;
      
      if (error) {
        dbState.metrics.queries.failed_queries++;
        logger.error('Database query failed', {
          query: query.substring(0, 200),
          duration,
          error: error.message,
          table,
        });
      } else {
        // Track with APM
        apm.trackDbQuery(query, duration, table);
        
        // Analyze for slow queries
        const slowQuery = queryAnalyzer.analyzeQuery(query, duration, table);
        
        if (slowQuery) {
          // Suggest optimization
          queryAnalyzer.optimizeQuery(slowQuery.id);
        }
      }

      // Update average duration
      const totalQueries = dbState.metrics.queries.total;
      dbState.metrics.queries.avg_duration = 
        (dbState.metrics.queries.avg_duration * (totalQueries - 1) + duration) / totalQueries;

      apm.endTrace(traceId, { table, duration, success: !error });

    } catch (monitoringError) {
      apm.endTrace(traceId, { success: false, error: monitoringError.message });
      logger.error('Database monitoring error', monitoringError);
    }
  },

  updateConnectionMetrics: (total: number, active: number, idle: number, waiting: number) => {
    if (!dbConfig.enabled) return;

    dbState.metrics.connections = { total, active, idle, waiting };

    // Track with existing metrics
    metricsUtils.updateDbConnections(active, total);

    // Check connection threshold
    const connectionUsage = active / total;
    if (connectionUsage > dbConfig.connectionThreshold / 100) {
      logger.warn('High database connection usage', {
        active,
        total,
        usage_percent: connectionUsage * 100,
        threshold: dbConfig.connectionThreshold,
      });
    }
  },

  updatePerformanceMetrics: (cacheHitRatio: number, lockWaits: number, deadlocks: number, bufferPoolUsage: number) => {
    if (!dbConfig.enabled) return;

    dbState.metrics.performance = {
      cache_hit_ratio: cacheHitRatio,
      lock_waits: lockWaits,
      deadlocks: deadlocks,
      buffer_pool_usage: bufferPoolUsage,
    };

    // Check cache hit ratio
    if (cacheHitRatio < dbConfig.cacheHitThreshold) {
      logger.warn('Low database cache hit ratio', {
        cache_hit_ratio: cacheHitRatio,
        threshold: dbConfig.cacheHitThreshold,
      });
    }

    // Check for deadlocks
    if (deadlocks > 0) {
      logger.warn('Database deadlocks detected', {
        deadlocks,
        lock_waits: lockWaits,
      });
    }
  },

  updateStorageMetrics: (size: number, growthRate: number, fragmentation: number, indexUsage: number) => {
    if (!dbConfig.enabled) return;

    dbState.metrics.storage = {
      size,
      growth_rate: growthRate,
      fragmentation,
      index_usage: indexUsage,
    };

    // Check storage growth
    if (growthRate > 0.1) { // 10% growth
      logger.warn('High database growth rate', {
        size,
        growth_rate: growthRate,
      });
    }

    // Check fragmentation
    if (fragmentation > 0.3) { // 30% fragmentation
      logger.warn('High database fragmentation', {
        fragmentation,
        recommendation: 'Consider running OPTIMIZE TABLE or REINDEX',
      });
    }
  },

  getMetrics: (): DatabaseMetrics => {
    return { ...dbState.metrics };
  },

  getSlowQueries: (limit: number = 50): SlowQuery[] => {
    return dbState.slowQueries.slice(-limit);
  },

  getOptimizations: (): QueryOptimization[] => {
    return [...dbState.optimizations];
  },

  getQueryStats: () => {
    const stats = Array.from(dbState.queryStats.entries()).map(([query, stats]) => ({
      query,
      ...stats,
    }));

    return stats.sort((a, b) => b.avgDuration - a.avgDuration);
  },

  getPerformanceSummary: () => {
    const now = Date.now();
    const recentSlowQueries = dbState.slowQueries.filter(q => 
      now - new Date(q.timestamp).getTime() < 3600000 // Last hour
    );

    return {
      connection_usage: dbState.metrics.connections.active / dbState.metrics.connections.total,
      cache_efficiency: dbState.metrics.performance.cache_hit_ratio,
      query_performance: {
        total_queries: dbState.metrics.queries.total,
        slow_queries: recentSlowQueries.length,
        avg_duration: dbState.metrics.queries.avg_duration,
        failure_rate: dbState.metrics.queries.failed_queries / dbState.metrics.queries.total,
      },
      storage_health: {
        size: dbState.metrics.storage.size,
        growth_rate: dbState.metrics.storage.growth_rate,
        fragmentation: dbState.metrics.storage.fragmentation,
      },
      optimization_opportunities: dbState.optimizations.filter(o => o.status === 'pending').length,
    };
  },

  analyzePerformance: () => {
    const now = Date.now();
    if (now - dbState.lastAnalysis < dbConfig.analyzeInterval * 1000) return;

    dbState.lastAnalysis = now;

    logger.info('Running database performance analysis');

    const summary = databaseMonitoring.getPerformanceSummary();
    const recommendations = [];

    // Connection analysis
    if (summary.connection_usage > 0.8) {
      recommendations.push({
        type: 'connections',
        priority: 'high',
        message: 'Consider increasing connection pool size or optimizing connection usage',
      });
    }

    // Cache analysis
    if (summary.cache_efficiency < 0.9) {
      recommendations.push({
        type: 'cache',
        priority: 'medium',
        message: 'Database cache hit ratio is low - consider increasing buffer pool size',
      });
    }

    // Query analysis
    if (summary.query_performance.slow_queries > 10) {
      recommendations.push({
        type: 'queries',
        priority: 'high',
        message: 'High number of slow queries detected - review query optimization',
      });
    }

    // Storage analysis
    if (summary.storage_health.fragmentation > 0.3) {
      recommendations.push({
        type: 'storage',
        priority: 'medium',
        message: 'High database fragmentation - consider maintenance operations',
      });
    }

    if (recommendations.length > 0) {
      logger.info('Database performance recommendations', { recommendations });
    }

    return { summary, recommendations };
  },

  reset: () => {
    dbState.metrics = {
      connections: { total: 0, active: 0, idle: 0, waiting: 0 },
      queries: { total: 0, slow_queries: 0, failed_queries: 0, avg_duration: 0, queries_per_second: 0 },
      performance: { cache_hit_ratio: 0, lock_waits: 0, deadlocks: 0, buffer_pool_usage: 0 },
      storage: { size: 0, growth_rate: 0, fragmentation: 0, index_usage: 0 },
    };
    dbState.slowQueries = [];
    dbState.optimizations = [];
    dbState.queryStats.clear();
  },
};

// Periodic analysis
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    if (dbConfig.enabled) {
      databaseMonitoring.analyzePerformance();
    }
  }, dbConfig.analyzeInterval * 1000);
}

export default databaseMonitoring;