import { Pool, PoolClient } from 'pg';

// ====================
// DATABASE MONITORING AND OPTIMIZATION
// ====================

export interface DatabaseMetrics {
  connections: {
    total: number;
    active: number;
    idle: number;
    waiting: number;
  };
  queries: {
    totalExecuted: number;
    averageExecutionTime: number;
    slowQueries: number;
    failedQueries: number;
  };
  tables: {
    name: string;
    size: string;
    rowCount: number;
    indexCount: number;
    lastVacuum?: Date;
    lastAnalyze?: Date;
  }[];
  indexes: {
    schemaname: string;
    tablename: string;
    indexname: string;
    size: string;
    scans: number;
    tuples_read: number;
    tuples_fetched: number;
    efficiency: number;
  }[];
  locks: {
    granted: number;
    waiting: number;
    types: Record<string, number>;
  };
  replication?: {
    lag: number;
    status: string;
  };
}

export interface SlowQuery {
  query: string;
  calls: number;
  totalTime: number;
  meanTime: number;
  maxTime: number;
  minTime: number;
  stddevTime: number;
  rows: number;
}

export interface IndexRecommendation {
  table: string;
  columns: string[];
  type: 'btree' | 'gin' | 'gist' | 'hash';
  reason: string;
  impact: 'high' | 'medium' | 'low';
  createStatement: string;
}

export interface MaintenanceTask {
  table: string;
  task: 'vacuum' | 'analyze' | 'reindex' | 'cluster';
  priority: 'high' | 'medium' | 'low';
  reason: string;
  estimatedDuration: string;
  lastPerformed?: Date;
}

export class DatabaseMonitor {
  private pool: Pool;
  private metrics: Map<string, any> = new Map();
  private alertThresholds = {
    maxConnections: 80, // percentage
    avgQueryTime: 1000, // milliseconds
    slowQueryThreshold: 5000, // milliseconds
    lockWaitThreshold: 10, // seconds
    replicationLag: 5000, // milliseconds
  };

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get comprehensive database metrics
   */
  public async getDatabaseMetrics(): Promise<DatabaseMetrics> {
    const client = await this.pool.connect();
    
    try {
      const [
        connectionStats,
        queryStats,
        tableStats,
        indexStats,
        lockStats,
        replicationStats,
      ] = await Promise.all([
        this.getConnectionStats(client),
        this.getQueryStats(client),
        this.getTableStats(client),
        this.getIndexStats(client),
        this.getLockStats(client),
        this.getReplicationStats(client),
      ]);

      return {
        connections: connectionStats,
        queries: queryStats,
        tables: tableStats,
        indexes: indexStats,
        locks: lockStats,
        replication: replicationStats,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get connection statistics
   */
  private async getConnectionStats(client: PoolClient) {
    const result = await client.query(`
      SELECT 
        state,
        COUNT(*) as count
      FROM pg_stat_activity 
      WHERE datname = current_database()
      GROUP BY state
    `);

    const stats = result.rows.reduce((acc, row) => {
      acc[row.state || 'unknown'] = parseInt(row.count);
      return acc;
    }, {} as Record<string, number>);

    return {
      total: Object.values(stats).reduce((sum, count) => sum + count, 0),
      active: stats.active || 0,
      idle: stats.idle || 0,
      waiting: stats['idle in transaction'] || 0,
    };
  }

  /**
   * Get query performance statistics
   */
  private async getQueryStats(client: PoolClient) {
    // Check if pg_stat_statements extension is available
    const extensionCheck = await client.query(`
      SELECT EXISTS(
        SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
      ) as has_extension
    `);

    if (!extensionCheck.rows[0]?.has_extension) {
      return {
        totalExecuted: 0,
        averageExecutionTime: 0,
        slowQueries: 0,
        failedQueries: 0,
      };
    }

    const result = await client.query(`
      SELECT 
        SUM(calls) as total_executed,
        AVG(mean_exec_time) as avg_execution_time,
        COUNT(CASE WHEN mean_exec_time > $1 THEN 1 END) as slow_queries
      FROM pg_stat_statements
      WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
    `, [this.alertThresholds.slowQueryThreshold]);

    const row = result.rows[0];
    return {
      totalExecuted: parseInt(row.total_executed) || 0,
      averageExecutionTime: parseFloat(row.avg_execution_time) || 0,
      slowQueries: parseInt(row.slow_queries) || 0,
      failedQueries: 0, // Would need error tracking
    };
  }

  /**
   * Get table statistics
   */
  private async getTableStats(client: PoolClient) {
    const result = await client.query(`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        n_tup_ins + n_tup_upd + n_tup_del as total_operations,
        n_live_tup as row_count,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        last_autoanalyze
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `);

    const indexCountQuery = await client.query(`
      SELECT 
        schemaname,
        tablename,
        COUNT(*) as index_count
      FROM pg_indexes
      WHERE schemaname = 'public'
      GROUP BY schemaname, tablename
    `);

    const indexCounts = indexCountQuery.rows.reduce((acc, row) => {
      acc[`${row.schemaname}.${row.tablename}`] = parseInt(row.index_count);
      return acc;
    }, {} as Record<string, number>);

    return result.rows.map(row => ({
      name: `${row.schemaname}.${row.tablename}`,
      size: row.size,
      rowCount: parseInt(row.row_count) || 0,
      indexCount: indexCounts[`${row.schemaname}.${row.tablename}`] || 0,
      lastVacuum: row.last_vacuum || row.last_autovacuum,
      lastAnalyze: row.last_analyze || row.last_autoanalyze,
    }));
  }

  /**
   * Get index statistics and efficiency
   */
  private async getIndexStats(client: PoolClient) {
    const result = await client.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) as size,
        idx_scan as scans,
        idx_tup_read as tuples_read,
        idx_tup_fetch as tuples_fetched,
        CASE 
          WHEN idx_tup_read > 0 THEN 
            ROUND((idx_tup_fetch::numeric / idx_tup_read::numeric) * 100, 2)
          ELSE 0 
        END as efficiency
      FROM pg_stat_user_indexes
      ORDER BY schemaname, tablename, indexname
    `);

    return result.rows.map(row => ({
      schemaname: row.schemaname,
      tablename: row.tablename,
      indexname: row.indexname,
      size: row.size,
      scans: parseInt(row.scans) || 0,
      tuples_read: parseInt(row.tuples_read) || 0,
      tuples_fetched: parseInt(row.tuples_fetched) || 0,
      efficiency: parseFloat(row.efficiency) || 0,
    }));
  }

  /**
   * Get lock statistics
   */
  private async getLockStats(client: PoolClient) {
    const result = await client.query(`
      SELECT 
        mode,
        granted,
        COUNT(*) as count
      FROM pg_locks
      WHERE database = (SELECT oid FROM pg_database WHERE datname = current_database())
      GROUP BY mode, granted
      ORDER BY mode, granted
    `);

    const stats = result.rows.reduce((acc, row) => {
      const status = row.granted ? 'granted' : 'waiting';
      if (!acc[status]) acc[status] = 0;
      acc[status] += parseInt(row.count);
      
      if (!acc.types) acc.types = {};
      acc.types[row.mode] = (acc.types[row.mode] || 0) + parseInt(row.count);
      
      return acc;
    }, {} as any);

    return {
      granted: stats.granted || 0,
      waiting: stats.waiting || 0,
      types: stats.types || {},
    };
  }

  /**
   * Get replication statistics (if applicable)
   */
  private async getReplicationStats(client: PoolClient) {
    try {
      const result = await client.query(`
        SELECT 
          client_addr,
          state,
          pg_wal_lsn_diff(pg_current_wal_lsn(), sent_lsn) as lag_bytes,
          EXTRACT(EPOCH FROM (now() - backend_start)) as connection_time
        FROM pg_stat_replication
      `);

      if (result.rows.length === 0) {
        return undefined;
      }

      const totalLag = result.rows.reduce((sum, row) => sum + (parseFloat(row.lag_bytes) || 0), 0);
      const avgLag = totalLag / result.rows.length;

      return {
        lag: avgLag,
        status: result.rows.every(row => row.state === 'streaming') ? 'healthy' : 'degraded',
      };
    } catch (error) {
      // Replication views might not be accessible
      return undefined;
    }
  }

  /**
   * Get slow queries report
   */
  public async getSlowQueries(limit: number = 10): Promise<SlowQuery[]> {
    const client = await this.pool.connect();
    
    try {
      const extensionCheck = await client.query(`
        SELECT EXISTS(
          SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
        ) as has_extension
      `);

      if (!extensionCheck.rows[0]?.has_extension) {
        return [];
      }

      const result = await client.query(`
        SELECT 
          query,
          calls,
          total_exec_time as total_time,
          mean_exec_time as mean_time,
          max_exec_time as max_time,
          min_exec_time as min_time,
          stddev_exec_time as stddev_time,
          rows
        FROM pg_stat_statements
        WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
        ORDER BY mean_exec_time DESC
        LIMIT $1
      `, [limit]);

      return result.rows.map(row => ({
        query: row.query,
        calls: parseInt(row.calls),
        totalTime: parseFloat(row.total_time),
        meanTime: parseFloat(row.mean_time),
        maxTime: parseFloat(row.max_time),
        minTime: parseFloat(row.min_time),
        stddevTime: parseFloat(row.stddev_time),
        rows: parseInt(row.rows),
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Generate index recommendations
   */
  public async getIndexRecommendations(): Promise<IndexRecommendation[]> {
    const client = await this.pool.connect();
    const recommendations: IndexRecommendation[] = [];
    
    try {
      // Find tables with low index usage
      const underusedIndexes = await client.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan
        FROM pg_stat_user_indexes
        WHERE idx_scan < 10
        AND schemaname = 'public'
        ORDER BY idx_scan
      `);

      // Find tables without indexes on foreign key columns
      const missingFkIndexes = await client.query(`
        SELECT 
          tc.table_name,
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND NOT EXISTS (
          SELECT 1 FROM pg_indexes pi
          WHERE pi.tablename = tc.table_name
          AND pi.indexdef LIKE '%' || kcu.column_name || '%'
        )
      `);

      // Add recommendations for missing foreign key indexes
      for (const row of missingFkIndexes.rows) {
        recommendations.push({
          table: row.table_name,
          columns: [row.column_name],
          type: 'btree',
          reason: 'Missing index on foreign key column',
          impact: 'high',
          createStatement: `CREATE INDEX CONCURRENTLY idx_${row.table_name}_${row.column_name} ON ${row.table_name} (${row.column_name});`,
        });
      }

      // Find tables that might benefit from composite indexes
      const compositeIndexCandidates = await client.query(`
        SELECT 
          schemaname,
          tablename,
          attname,
          n_distinct,
          correlation
        FROM pg_stats
        WHERE schemaname = 'public'
        AND n_distinct > 1
        ORDER BY tablename, n_distinct DESC
      `);

      // Group by table and suggest composite indexes
      const tableColumns = compositeIndexCandidates.rows.reduce((acc, row) => {
        if (!acc[row.tablename]) acc[row.tablename] = [];
        acc[row.tablename].push(row.attname);
        return acc;
      }, {} as Record<string, string[]>);

      for (const [table, columns] of Object.entries(tableColumns)) {
        if (columns.length >= 2) {
          const topColumns = columns.slice(0, 3); // Top 3 columns
          recommendations.push({
            table,
            columns: topColumns,
            type: 'btree',
            reason: 'Potential composite index for common query patterns',
            impact: 'medium',
            createStatement: `CREATE INDEX CONCURRENTLY idx_${table}_composite ON ${table} (${topColumns.join(', ')});`,
          });
        }
      }

      // Find array columns that might benefit from GIN indexes
      const arrayColumns = await client.query(`
        SELECT 
          table_name,
          column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND data_type = 'ARRAY'
        AND NOT EXISTS (
          SELECT 1 FROM pg_indexes pi
          WHERE pi.tablename = table_name
          AND pi.indexdef LIKE '%GIN%'
          AND pi.indexdef LIKE '%' || column_name || '%'
        )
      `);

      for (const row of arrayColumns.rows) {
        recommendations.push({
          table: row.table_name,
          columns: [row.column_name],
          type: 'gin',
          reason: 'Array column without GIN index',
          impact: 'medium',
          createStatement: `CREATE INDEX CONCURRENTLY idx_${row.table_name}_${row.column_name}_gin ON ${row.table_name} USING gin (${row.column_name});`,
        });
      }

    } finally {
      client.release();
    }

    return recommendations;
  }

  /**
   * Generate maintenance recommendations
   */
  public async getMaintenanceTasks(): Promise<MaintenanceTask[]> {
    const client = await this.pool.connect();
    const tasks: MaintenanceTask[] = [];
    
    try {
      // Tables that need VACUUM
      const vacuumCandidates = await client.query(`
        SELECT 
          schemaname,
          tablename,
          n_dead_tup,
          n_live_tup,
          last_vacuum,
          last_autovacuum
        FROM pg_stat_user_tables
        WHERE n_dead_tup > 1000
        OR (last_vacuum IS NULL AND last_autovacuum IS NULL)
        OR (
          GREATEST(last_vacuum, last_autovacuum) < NOW() - INTERVAL '7 days'
          AND n_live_tup > 10000
        )
        ORDER BY n_dead_tup DESC
      `);

      for (const row of vacuumCandidates.rows) {
        const deadTuples = parseInt(row.n_dead_tup);
        const liveTuples = parseInt(row.n_live_tup);
        const deadRatio = liveTuples > 0 ? deadTuples / liveTuples : 0;

        tasks.push({
          table: `${row.schemaname}.${row.tablename}`,
          task: 'vacuum',
          priority: deadRatio > 0.2 ? 'high' : deadRatio > 0.1 ? 'medium' : 'low',
          reason: `${deadTuples} dead tuples (${Math.round(deadRatio * 100)}% of table)`,
          estimatedDuration: this.estimateVacuumDuration(liveTuples + deadTuples),
          lastPerformed: row.last_vacuum || row.last_autovacuum,
        });
      }

      // Tables that need ANALYZE
      const analyzeCandidates = await client.query(`
        SELECT 
          schemaname,
          tablename,
          n_mod_since_analyze,
          n_live_tup,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables
        WHERE n_mod_since_analyze > 1000
        OR (last_analyze IS NULL AND last_autoanalyze IS NULL)
        ORDER BY n_mod_since_analyze DESC
      `);

      for (const row of analyzeCandidates.rows) {
        const modifiedTuples = parseInt(row.n_mod_since_analyze);
        const liveTuples = parseInt(row.n_live_tup);
        const modifiedRatio = liveTuples > 0 ? modifiedTuples / liveTuples : 0;

        tasks.push({
          table: `${row.schemaname}.${row.tablename}`,
          task: 'analyze',
          priority: modifiedRatio > 0.1 ? 'high' : 'medium',
          reason: `${modifiedTuples} modifications since last analyze`,
          estimatedDuration: '< 1 minute',
          lastPerformed: row.last_analyze || row.last_autoanalyze,
        });
      }

      // Indexes that might need rebuilding
      const reindexCandidates = await client.query(`
        SELECT 
          schemaname,
          tablename,
          indexname
        FROM pg_stat_user_indexes
        WHERE idx_scan = 0
        AND schemaname = 'public'
      `);

      for (const row of reindexCandidates.rows) {
        tasks.push({
          table: `${row.schemaname}.${row.tablename}`,
          task: 'reindex',
          priority: 'low',
          reason: `Index ${row.indexname} has never been used`,
          estimatedDuration: '5-10 minutes',
        });
      }

    } finally {
      client.release();
    }

    return tasks;
  }

  /**
   * Estimate VACUUM duration based on table size
   */
  private estimateVacuumDuration(rowCount: number): string {
    if (rowCount < 10000) return '< 1 minute';
    if (rowCount < 100000) return '1-5 minutes';
    if (rowCount < 1000000) return '5-15 minutes';
    return '15+ minutes';
  }

  /**
   * Check for performance alerts
   */
  public async checkAlerts(): Promise<Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    value: number;
    threshold: number;
  }>> {
    const alerts = [];
    const metrics = await this.getDatabaseMetrics();

    // Connection usage alert
    const connectionUsage = (metrics.connections.active / metrics.connections.total) * 100;
    if (connectionUsage > this.alertThresholds.maxConnections) {
      alerts.push({
        type: 'high_connection_usage',
        severity: connectionUsage > 95 ? 'critical' : 'high' as const,
        message: `High connection usage: ${connectionUsage.toFixed(1)}%`,
        value: connectionUsage,
        threshold: this.alertThresholds.maxConnections,
      });
    }

    // Average query time alert
    if (metrics.queries.averageExecutionTime > this.alertThresholds.avgQueryTime) {
      alerts.push({
        type: 'slow_queries',
        severity: metrics.queries.averageExecutionTime > 5000 ? 'high' : 'medium' as const,
        message: `High average query execution time: ${metrics.queries.averageExecutionTime.toFixed(2)}ms`,
        value: metrics.queries.averageExecutionTime,
        threshold: this.alertThresholds.avgQueryTime,
      });
    }

    // Lock waits alert
    if (metrics.locks.waiting > 0) {
      alerts.push({
        type: 'lock_waits',
        severity: metrics.locks.waiting > 5 ? 'high' : 'medium' as const,
        message: `${metrics.locks.waiting} queries waiting for locks`,
        value: metrics.locks.waiting,
        threshold: 0,
      });
    }

    // Replication lag alert
    if (metrics.replication && metrics.replication.lag > this.alertThresholds.replicationLag) {
      alerts.push({
        type: 'replication_lag',
        severity: metrics.replication.lag > 10000 ? 'critical' : 'high' as const,
        message: `High replication lag: ${metrics.replication.lag.toFixed(2)}ms`,
        value: metrics.replication.lag,
        threshold: this.alertThresholds.replicationLag,
      });
    }

    return alerts;
  }

  /**
   * Generate performance report
   */
  public async generatePerformanceReport(): Promise<{
    summary: {
      overall_health: 'excellent' | 'good' | 'fair' | 'poor';
      total_score: number;
      recommendations_count: number;
      maintenance_tasks_count: number;
    };
    metrics: DatabaseMetrics;
    slow_queries: SlowQuery[];
    index_recommendations: IndexRecommendation[];
    maintenance_tasks: MaintenanceTask[];
    alerts: any[];
  }> {
    const [metrics, slowQueries, indexRecommendations, maintenanceTasks, alerts] = await Promise.all([
      this.getDatabaseMetrics(),
      this.getSlowQueries(5),
      this.getIndexRecommendations(),
      this.getMaintenanceTasks(),
      this.checkAlerts(),
    ]);

    // Calculate overall health score
    let score = 100;
    score -= alerts.filter(a => a.severity === 'critical').length * 20;
    score -= alerts.filter(a => a.severity === 'high').length * 10;
    score -= alerts.filter(a => a.severity === 'medium').length * 5;
    score -= indexRecommendations.filter(r => r.impact === 'high').length * 5;
    score -= maintenanceTasks.filter(t => t.priority === 'high').length * 3;

    const healthStatus = score >= 90 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'fair' : 'poor';

    return {
      summary: {
        overall_health: healthStatus,
        total_score: Math.max(0, score),
        recommendations_count: indexRecommendations.length,
        maintenance_tasks_count: maintenanceTasks.length,
      },
      metrics,
      slow_queries: slowQueries,
      index_recommendations: indexRecommendations,
      maintenance_tasks: maintenanceTasks,
      alerts,
    };
  }
}

// ====================
// EXPORTS
// ====================

export default DatabaseMonitor;