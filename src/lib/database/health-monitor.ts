import { PoolClient } from 'pg';
import { getDatabase } from './connection';
import logger from '../logger';

// Health check types
export interface DatabaseHealthMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  connections: {
    total: number;
    active: number;
    idle: number;
    waiting: number;
    maxConnections: number;
    utilization: number;
  };
  performance: {
    avgResponseTime: number;
    slowQueryCount: number;
    errorRate: number;
    transactionRate: number;
    lockWaitTime: number;
  };
  storage: {
    totalSize: number;
    availableSize: number;
    usedSize: number;
    utilizationPercent: number;
    tableCount: number;
    indexCount: number;
  };
  replication: {
    isReplicated: boolean;
    lag: number | null;
    slaveCount: number;
  };
  alerts: DatabaseAlert[];
  recommendations: string[];
}

export interface DatabaseAlert {
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: string;
}

export interface HealthCheckThresholds {
  connectionUtilization: {
    warning: number;
    critical: number;
  };
  responseTime: {
    warning: number;
    critical: number;
  };
  errorRate: {
    warning: number;
    critical: number;
  };
  storageUtilization: {
    warning: number;
    critical: number;
  };
  replicationLag: {
    warning: number;
    critical: number;
  };
}

export class DatabaseHealthMonitor {
  private static instance: DatabaseHealthMonitor;
  private db = getDatabase();
  private lastHealthCheck: DatabaseHealthMetrics | null = null;
  private healthHistory: DatabaseHealthMetrics[] = [];
  private readonly maxHistorySize = 100;
  
  private readonly defaultThresholds: HealthCheckThresholds = {
    connectionUtilization: { warning: 70, critical: 90 },
    responseTime: { warning: 1000, critical: 5000 },
    errorRate: { warning: 1, critical: 5 },
    storageUtilization: { warning: 80, critical: 95 },
    replicationLag: { warning: 1000, critical: 5000 }
  };

  private constructor() {
    this.startPeriodicHealthChecks();
  }

  public static getInstance(): DatabaseHealthMonitor {
    if (!DatabaseHealthMonitor.instance) {
      DatabaseHealthMonitor.instance = new DatabaseHealthMonitor();
    }
    return DatabaseHealthMonitor.instance;
  }

  // Start periodic health checks
  private startPeriodicHealthChecks(): void {
    const interval = parseInt(process.env.DB_HEALTH_CHECK_INTERVAL || '60000'); // 1 minute
    
    setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('Periodic health check failed', {
          error: error instanceof Error ? error.message : String(error),
          category: 'database',
          operation: 'periodic_health_check'
        });
      }
    }, interval);
  }

  // Perform comprehensive health check
  public async performHealthCheck(thresholds?: Partial<HealthCheckThresholds>): Promise<DatabaseHealthMetrics> {
    const start = Date.now();
    const checkThresholds = { ...this.defaultThresholds, ...thresholds };
    
    try {
      const [
        versionInfo,
        connectionMetrics,
        performanceMetrics,
        storageMetrics,
        replicationMetrics
      ] = await Promise.all([
        this.getVersionInfo(),
        this.getConnectionMetrics(),
        this.getPerformanceMetrics(),
        this.getStorageMetrics(),
        this.getReplicationMetrics()
      ]);

      const metrics: DatabaseHealthMetrics = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Date.now() - start,
        version: versionInfo.version,
        connections: connectionMetrics,
        performance: performanceMetrics,
        storage: storageMetrics,
        replication: replicationMetrics,
        alerts: [],
        recommendations: []
      };

      // Analyze health and generate alerts
      this.analyzeHealth(metrics, checkThresholds);
      
      // Store health check result
      this.lastHealthCheck = metrics;
      this.addToHistory(metrics);
      
      // Log health status
      const duration = Date.now() - start;
      logger.info('Database health check completed', {
        status: metrics.status,
        duration,
        alertCount: metrics.alerts.length,
        category: 'database',
        operation: 'health_check'
      });

      return metrics;
    } catch (error) {
      const errorMetrics: DatabaseHealthMetrics = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: 0,
        version: 'unknown',
        connections: {
          total: 0,
          active: 0,
          idle: 0,
          waiting: 0,
          maxConnections: 0,
          utilization: 0
        },
        performance: {
          avgResponseTime: 0,
          slowQueryCount: 0,
          errorRate: 100,
          transactionRate: 0,
          lockWaitTime: 0
        },
        storage: {
          totalSize: 0,
          availableSize: 0,
          usedSize: 0,
          utilizationPercent: 0,
          tableCount: 0,
          indexCount: 0
        },
        replication: {
          isReplicated: false,
          lag: null,
          slaveCount: 0
        },
        alerts: [{
          level: 'critical',
          message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
          metric: 'overall_health',
          value: 0,
          threshold: 1,
          timestamp: new Date().toISOString()
        }],
        recommendations: ['Check database connectivity', 'Review error logs', 'Verify database server status']
      };

      this.lastHealthCheck = errorMetrics;
      this.addToHistory(errorMetrics);
      
      logger.error('Database health check failed', {
        error: error instanceof Error ? error.message : String(error),
        category: 'database',
        operation: 'health_check'
      });

      return errorMetrics;
    }
  }

  // Get database version information
  private async getVersionInfo(): Promise<{ version: string; uptime: number }> {
    const result = await this.db.query(`
      SELECT 
        version() as version,
        EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time())) as uptime
    `);
    
    return {
      version: result.rows[0].version,
      uptime: parseInt(result.rows[0].uptime) * 1000 // Convert to milliseconds
    };
  }

  // Get connection pool metrics
  private async getConnectionMetrics() {
    const poolStats = this.db.getPoolStats();
    
    // Get max connections from database
    const maxConnResult = await this.db.query('SHOW max_connections');
    const maxConnections = parseInt(maxConnResult.rows[0].max_connections);
    
    const utilization = (poolStats.totalConnections / maxConnections) * 100;
    
    return {
      total: poolStats.totalConnections,
      active: poolStats.totalConnections - poolStats.idleConnections,
      idle: poolStats.idleConnections,
      waiting: poolStats.waitingClients,
      maxConnections,
      utilization
    };
  }

  // Get performance metrics
  private async getPerformanceMetrics() {
    const queries = await Promise.all([
      // Average response time from pg_stat_database
      this.db.query(`
        SELECT 
          COALESCE(AVG(blk_read_time + blk_write_time), 0) as avg_response_time,
          SUM(numbackends) as active_connections
        FROM pg_stat_database 
        WHERE datname = current_database()
      `),
      
      // Slow query count (queries running for more than 1 second)
      this.db.query(`
        SELECT COUNT(*) as slow_query_count
        FROM pg_stat_activity 
        WHERE state = 'active' 
        AND query_start < NOW() - INTERVAL '1 second'
        AND query NOT LIKE '%pg_stat_activity%'
      `),
      
      // Lock wait time
      this.db.query(`
        SELECT 
          COALESCE(SUM(EXTRACT(EPOCH FROM (NOW() - query_start)) * 1000), 0) as total_lock_wait_time,
          COUNT(*) as waiting_queries
        FROM pg_stat_activity 
        WHERE wait_event_type = 'Lock'
      `),
      
      // Transaction rate
      this.db.query(`
        SELECT 
          SUM(xact_commit + xact_rollback) as total_transactions
        FROM pg_stat_database 
        WHERE datname = current_database()
      `)
    ]);

    const [responseTimeResult, slowQueryResult, lockWaitResult, transactionResult] = queries;
    
    return {
      avgResponseTime: parseFloat(responseTimeResult.rows[0].avg_response_time) || 0,
      slowQueryCount: parseInt(slowQueryResult.rows[0].slow_query_count) || 0,
      errorRate: 0, // Would need application-level error tracking
      transactionRate: parseInt(transactionResult.rows[0].total_transactions) || 0,
      lockWaitTime: parseFloat(lockWaitResult.rows[0].total_lock_wait_time) || 0
    };
  }

  // Get storage metrics
  private async getStorageMetrics() {
    const queries = await Promise.all([
      // Database size
      this.db.query(`
        SELECT pg_database_size(current_database()) as db_size
      `),
      
      // Table and index counts
      this.db.query(`
        SELECT 
          COUNT(CASE WHEN schemaname = 'public' AND tablename IS NOT NULL THEN 1 END) as table_count,
          COUNT(CASE WHEN schemaname = 'public' AND indexname IS NOT NULL THEN 1 END) as index_count
        FROM pg_tables 
        FULL OUTER JOIN pg_indexes ON pg_tables.tablename = pg_indexes.tablename
        WHERE schemaname = 'public'
      `),
      
      // Disk space (if available)
      this.db.query(`
        SELECT 
          COALESCE(SUM(pg_total_relation_size(schemaname||'.'||tablename)), 0) as total_size
        FROM pg_tables 
        WHERE schemaname = 'public'
      `)
    ]);

    const [sizeResult, countResult, diskResult] = queries;
    
    const dbSize = parseInt(sizeResult.rows[0].db_size) || 0;
    const totalSize = parseInt(diskResult.rows[0].total_size) || dbSize;
    
    return {
      totalSize,
      availableSize: 0, // Would need system-level monitoring
      usedSize: dbSize,
      utilizationPercent: 0, // Would need system-level monitoring
      tableCount: parseInt(countResult.rows[0].table_count) || 0,
      indexCount: parseInt(countResult.rows[0].index_count) || 0
    };
  }

  // Get replication metrics
  private async getReplicationMetrics() {
    try {
      const replicationResult = await this.db.query(`
        SELECT 
          state,
          pg_wal_lsn_diff(pg_current_wal_lsn(), flush_lsn) as lag_bytes
        FROM pg_stat_replication
      `);
      
      const isReplicated = replicationResult.rows.length > 0;
      const lag = isReplicated ? 
        Math.max(...replicationResult.rows.map(row => parseInt(row.lag_bytes) || 0)) : 
        null;
      
      return {
        isReplicated,
        lag,
        slaveCount: replicationResult.rows.length
      };
    } catch (error) {
      // Replication views might not be available
      return {
        isReplicated: false,
        lag: null,
        slaveCount: 0
      };
    }
  }

  // Analyze health metrics and generate alerts
  private analyzeHealth(metrics: DatabaseHealthMetrics, thresholds: HealthCheckThresholds): void {
    const alerts: DatabaseAlert[] = [];
    const recommendations: string[] = [];

    // Check connection utilization
    if (metrics.connections.utilization >= thresholds.connectionUtilization.critical) {
      alerts.push({
        level: 'critical',
        message: 'Connection pool utilization critically high',
        metric: 'connection_utilization',
        value: metrics.connections.utilization,
        threshold: thresholds.connectionUtilization.critical,
        timestamp: new Date().toISOString()
      });
      recommendations.push('Consider increasing max_connections or optimizing connection usage');
    } else if (metrics.connections.utilization >= thresholds.connectionUtilization.warning) {
      alerts.push({
        level: 'warning',
        message: 'Connection pool utilization high',
        metric: 'connection_utilization',
        value: metrics.connections.utilization,
        threshold: thresholds.connectionUtilization.warning,
        timestamp: new Date().toISOString()
      });
    }

    // Check response time
    if (metrics.performance.avgResponseTime >= thresholds.responseTime.critical) {
      alerts.push({
        level: 'critical',
        message: 'Database response time critically slow',
        metric: 'avg_response_time',
        value: metrics.performance.avgResponseTime,
        threshold: thresholds.responseTime.critical,
        timestamp: new Date().toISOString()
      });
      recommendations.push('Investigate slow queries and consider query optimization');
    } else if (metrics.performance.avgResponseTime >= thresholds.responseTime.warning) {
      alerts.push({
        level: 'warning',
        message: 'Database response time slow',
        metric: 'avg_response_time',
        value: metrics.performance.avgResponseTime,
        threshold: thresholds.responseTime.warning,
        timestamp: new Date().toISOString()
      });
    }

    // Check slow queries
    if (metrics.performance.slowQueryCount > 0) {
      alerts.push({
        level: 'warning',
        message: `${metrics.performance.slowQueryCount} slow queries detected`,
        metric: 'slow_query_count',
        value: metrics.performance.slowQueryCount,
        threshold: 0,
        timestamp: new Date().toISOString()
      });
      recommendations.push('Review and optimize slow queries');
    }

    // Check lock wait time
    if (metrics.performance.lockWaitTime > 5000) { // 5 seconds
      alerts.push({
        level: 'warning',
        message: 'High lock wait time detected',
        metric: 'lock_wait_time',
        value: metrics.performance.lockWaitTime,
        threshold: 5000,
        timestamp: new Date().toISOString()
      });
      recommendations.push('Review locking patterns and consider query optimization');
    }

    // Check replication lag
    if (metrics.replication.isReplicated && metrics.replication.lag !== null) {
      if (metrics.replication.lag >= thresholds.replicationLag.critical) {
        alerts.push({
          level: 'critical',
          message: 'Replication lag critically high',
          metric: 'replication_lag',
          value: metrics.replication.lag,
          threshold: thresholds.replicationLag.critical,
          timestamp: new Date().toISOString()
        });
        recommendations.push('Investigate replication performance and network connectivity');
      } else if (metrics.replication.lag >= thresholds.replicationLag.warning) {
        alerts.push({
          level: 'warning',
          message: 'Replication lag high',
          metric: 'replication_lag',
          value: metrics.replication.lag,
          threshold: thresholds.replicationLag.warning,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Determine overall status
    const criticalAlerts = alerts.filter(alert => alert.level === 'critical');
    const warningAlerts = alerts.filter(alert => alert.level === 'warning');
    
    if (criticalAlerts.length > 0) {
      metrics.status = 'unhealthy';
    } else if (warningAlerts.length > 0) {
      metrics.status = 'degraded';
    } else {
      metrics.status = 'healthy';
    }

    metrics.alerts = alerts;
    metrics.recommendations = recommendations;
  }

  // Add metrics to history
  private addToHistory(metrics: DatabaseHealthMetrics): void {
    this.healthHistory.push(metrics);
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory.shift();
    }
  }

  // Get latest health metrics
  public getLatestHealth(): DatabaseHealthMetrics | null {
    return this.lastHealthCheck;
  }

  // Get health history
  public getHealthHistory(limit?: number): DatabaseHealthMetrics[] {
    if (limit) {
      return this.healthHistory.slice(-limit);
    }
    return [...this.healthHistory];
  }

  // Get health trends
  public getHealthTrends(hours: number = 24): {
    avgResponseTime: number[];
    connectionUtilization: number[];
    errorCounts: number[];
    timestamps: string[];
  } {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentMetrics = this.healthHistory.filter(
      metrics => new Date(metrics.timestamp) >= since
    );

    return {
      avgResponseTime: recentMetrics.map(m => m.performance.avgResponseTime),
      connectionUtilization: recentMetrics.map(m => m.connections.utilization),
      errorCounts: recentMetrics.map(m => m.alerts.filter(a => a.level === 'error' || a.level === 'critical').length),
      timestamps: recentMetrics.map(m => m.timestamp)
    };
  }

  // Quick health check
  public async quickHealthCheck(): Promise<{ status: string; responseTime: number }> {
    const start = Date.now();
    try {
      await this.db.query('SELECT 1');
      const responseTime = Date.now() - start;
      return {
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        responseTime
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - start
      };
    }
  }
}

// Export singleton instance
export const databaseHealthMonitor = DatabaseHealthMonitor.getInstance();

// Convenience functions
export const performHealthCheck = (thresholds?: Partial<HealthCheckThresholds>) =>
  databaseHealthMonitor.performHealthCheck(thresholds);

export const getLatestHealth = () =>
  databaseHealthMonitor.getLatestHealth();

export const getHealthHistory = (limit?: number) =>
  databaseHealthMonitor.getHealthHistory(limit);

export const getHealthTrends = (hours?: number) =>
  databaseHealthMonitor.getHealthTrends(hours);

export const quickHealthCheck = () =>
  databaseHealthMonitor.quickHealthCheck();