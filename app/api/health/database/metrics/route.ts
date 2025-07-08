import { NextRequest, NextResponse } from 'next/server';
import { databaseHealthMonitor } from '@/lib/database/health-monitor';
import { getDatabase } from '@/lib/database/connection';
import logger from '@/lib/logger';

// GET /api/health/database/metrics - Get detailed database metrics
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const timeRange = url.searchParams.get('range') || '24h';
    const format = url.searchParams.get('format') || 'json';
    
    logger.info('Database metrics requested', {
      timeRange,
      format,
      category: 'health',
      operation: 'database_metrics'
    });

    const db = getDatabase();
    const dbMetrics = db.getMetrics();
    const poolStats = db.getPoolStats();
    const latestHealth = databaseHealthMonitor.getLatestHealth();
    
    // Parse time range
    const hours = timeRange === '1h' ? 1 : 
                 timeRange === '6h' ? 6 : 
                 timeRange === '24h' ? 24 : 
                 timeRange === '7d' ? 168 : 24;
    
    const trends = databaseHealthMonitor.getHealthTrends(hours);
    const history = databaseHealthMonitor.getHealthHistory(50);

    // Get additional database statistics
    const [connectionStats, queryStats, indexStats] = await Promise.all([
      getConnectionStatistics(),
      getQueryStatistics(),
      getIndexStatistics()
    ]);

    const metrics = {
      timestamp: new Date().toISOString(),
      timeRange,
      overview: {
        status: latestHealth?.status || 'unknown',
        version: latestHealth?.version || 'unknown',
        uptime: latestHealth?.uptime || 0
      },
      connections: {
        pool: poolStats,
        database: connectionStats,
        utilization: dbMetrics.isHealthy ? 'normal' : 'high'
      },
      performance: {
        queries: {
          total: dbMetrics.totalQueries,
          errors: dbMetrics.queryErrors,
          retries: dbMetrics.retries,
          avgResponseTime: latestHealth?.performance.avgResponseTime || 0,
          slowQueries: latestHealth?.performance.slowQueryCount || 0
        },
        database: queryStats,
        indexes: indexStats
      },
      storage: latestHealth?.storage || {
        totalSize: 0,
        usedSize: 0,
        tableCount: 0,
        indexCount: 0
      },
      trends: {
        responseTime: trends.avgResponseTime,
        connectionUtilization: trends.connectionUtilization,
        errorCounts: trends.errorCounts,
        timestamps: trends.timestamps
      },
      history: history.slice(-20), // Last 20 health checks
      alerts: latestHealth?.alerts || [],
      recommendations: latestHealth?.recommendations || []
    };

    if (format === 'prometheus') {
      // Return Prometheus format
      const prometheusMetrics = convertToPrometheusFormat(metrics);
      return new Response(prometheusMetrics, {
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    return NextResponse.json(metrics);
  } catch (error) {
    logger.error('Failed to get database metrics', {
      error: error instanceof Error ? error.message : String(error),
      category: 'health',
      operation: 'database_metrics'
    });

    return NextResponse.json({
      error: 'Failed to get database metrics',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// Get connection statistics from PostgreSQL
async function getConnectionStatistics() {
  const db = getDatabase();
  
  try {
    const result = await db.query(`
      SELECT 
        datname,
        numbackends as connections,
        xact_commit as transactions_committed,
        xact_rollback as transactions_rolled_back,
        blks_read as blocks_read,
        blks_hit as blocks_hit,
        tup_returned as tuples_returned,
        tup_fetched as tuples_fetched,
        tup_inserted as tuples_inserted,
        tup_updated as tuples_updated,
        tup_deleted as tuples_deleted,
        conflicts as conflicts,
        temp_files as temp_files,
        temp_bytes as temp_bytes,
        deadlocks as deadlocks,
        blk_read_time as read_time,
        blk_write_time as write_time
      FROM pg_stat_database 
      WHERE datname = current_database()
    `);
    
    return result.rows[0] || {};
  } catch (error) {
    logger.warn('Failed to get connection statistics', { error });
    return {};
  }
}

// Get query statistics from PostgreSQL
async function getQueryStatistics() {
  const db = getDatabase();
  
  try {
    const [slowQueries, activeQueries, lockedQueries] = await Promise.all([
      // Slow queries
      db.query(`
        SELECT 
          COUNT(*) as slow_query_count,
          AVG(EXTRACT(EPOCH FROM (NOW() - query_start))) as avg_duration
        FROM pg_stat_activity 
        WHERE state = 'active' 
        AND query_start < NOW() - INTERVAL '1 second'
        AND query NOT LIKE '%pg_stat_activity%'
      `),
      
      // Active queries
      db.query(`
        SELECT 
          COUNT(*) as active_query_count,
          COUNT(CASE WHEN wait_event_type IS NOT NULL THEN 1 END) as waiting_queries
        FROM pg_stat_activity 
        WHERE state = 'active'
        AND query NOT LIKE '%pg_stat_activity%'
      `),
      
      // Locked queries
      db.query(`
        SELECT 
          COUNT(*) as locked_query_count,
          SUM(CASE WHEN wait_event_type = 'Lock' THEN EXTRACT(EPOCH FROM (NOW() - query_start)) ELSE 0 END) as total_lock_wait_time
        FROM pg_stat_activity 
        WHERE wait_event_type = 'Lock'
      `)
    ]);

    return {
      slowQueries: {
        count: parseInt(slowQueries.rows[0]?.slow_query_count) || 0,
        avgDuration: parseFloat(slowQueries.rows[0]?.avg_duration) || 0
      },
      activeQueries: {
        count: parseInt(activeQueries.rows[0]?.active_query_count) || 0,
        waiting: parseInt(activeQueries.rows[0]?.waiting_queries) || 0
      },
      lockedQueries: {
        count: parseInt(lockedQueries.rows[0]?.locked_query_count) || 0,
        totalWaitTime: parseFloat(lockedQueries.rows[0]?.total_lock_wait_time) || 0
      }
    };
  } catch (error) {
    logger.warn('Failed to get query statistics', { error });
    return {};
  }
}

// Get index usage statistics
async function getIndexStatistics() {
  const db = getDatabase();
  
  try {
    const [indexUsage, indexSize, unusedIndexes] = await Promise.all([
      // Index usage
      db.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan as scans,
          idx_tup_read as tuples_read,
          idx_tup_fetch as tuples_fetched
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
        ORDER BY idx_scan DESC
        LIMIT 10
      `),
      
      // Index sizes
      db.query(`
        SELECT 
          SUM(pg_relation_size(indexrelid)) as total_index_size,
          COUNT(*) as index_count
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
      `),
      
      // Unused indexes
      db.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          pg_size_pretty(pg_relation_size(indexrelid)) as size
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
        AND idx_scan = 0
        AND pg_relation_size(indexrelid) > 65536 -- Only show indexes > 64KB
      `)
    ]);

    return {
      usage: indexUsage.rows,
      totalSize: parseInt(indexSize.rows[0]?.total_index_size) || 0,
      totalCount: parseInt(indexSize.rows[0]?.index_count) || 0,
      unused: unusedIndexes.rows
    };
  } catch (error) {
    logger.warn('Failed to get index statistics', { error });
    return {};
  }
}

// Convert metrics to Prometheus format
function convertToPrometheusFormat(metrics: any): string {
  const lines: string[] = [];
  const timestamp = Date.now();
  
  // Database connection metrics
  lines.push(`# HELP db_connections_total Total number of database connections`);
  lines.push(`# TYPE db_connections_total gauge`);
  lines.push(`db_connections_total{type="active"} ${metrics.connections.pool.totalConnections - metrics.connections.pool.idleConnections} ${timestamp}`);
  lines.push(`db_connections_total{type="idle"} ${metrics.connections.pool.idleConnections} ${timestamp}`);
  lines.push(`db_connections_total{type="waiting"} ${metrics.connections.pool.waitingClients} ${timestamp}`);
  
  // Query metrics
  lines.push(`# HELP db_queries_total Total number of queries executed`);
  lines.push(`# TYPE db_queries_total counter`);
  lines.push(`db_queries_total ${metrics.performance.queries.total} ${timestamp}`);
  
  lines.push(`# HELP db_query_errors_total Total number of query errors`);
  lines.push(`# TYPE db_query_errors_total counter`);
  lines.push(`db_query_errors_total ${metrics.performance.queries.errors} ${timestamp}`);
  
  lines.push(`# HELP db_query_duration_seconds Average query duration in seconds`);
  lines.push(`# TYPE db_query_duration_seconds gauge`);
  lines.push(`db_query_duration_seconds ${metrics.performance.queries.avgResponseTime / 1000} ${timestamp}`);
  
  // Storage metrics
  lines.push(`# HELP db_storage_bytes Database storage usage in bytes`);
  lines.push(`# TYPE db_storage_bytes gauge`);
  lines.push(`db_storage_bytes{type="total"} ${metrics.storage.totalSize} ${timestamp}`);
  lines.push(`db_storage_bytes{type="used"} ${metrics.storage.usedSize} ${timestamp}`);
  
  // Table and index counts
  lines.push(`# HELP db_tables_total Total number of tables`);
  lines.push(`# TYPE db_tables_total gauge`);
  lines.push(`db_tables_total ${metrics.storage.tableCount} ${timestamp}`);
  
  lines.push(`# HELP db_indexes_total Total number of indexes`);
  lines.push(`# TYPE db_indexes_total gauge`);
  lines.push(`db_indexes_total ${metrics.storage.indexCount} ${timestamp}`);
  
  // Health status (1 = healthy, 0.5 = degraded, 0 = unhealthy)
  const statusValue = metrics.overview.status === 'healthy' ? 1 : 
                     metrics.overview.status === 'degraded' ? 0.5 : 0;
  lines.push(`# HELP db_health_status Database health status`);
  lines.push(`# TYPE db_health_status gauge`);
  lines.push(`db_health_status ${statusValue} ${timestamp}`);
  
  return lines.join('\n') + '\n';
}