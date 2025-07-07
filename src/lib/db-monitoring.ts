/**
 * Database Performance Monitoring and Analytics
 * 
 * This module provides comprehensive database monitoring with:
 * - Real-time query performance tracking
 * - Slow query detection and analysis
 * - Connection pool monitoring
 * - Database health metrics
 * - Alerting and notifications
 * - Performance trend analysis
 * 
 * @module DatabaseMonitoring
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { DatabaseConnection, QueryMetrics, PoolStats } from './database';
import { DatabasePoolManager, PoolMetrics } from './db-pool';

// Query performance analysis
export interface QueryAnalysis {
  query: string;
  normalizedQuery: string;
  executionCount: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  totalTime: number;
  lastExecuted: Date;
  errorRate: number;
  impactScore: number;
}

// Slow query detection
export interface SlowQueryAlert {
  query: string;
  duration: number;
  threshold: number;
  parameters?: any[];
  timestamp: Date;
  severity: 'warning' | 'critical';
  suggestions?: string[];
}

// Database health metrics
export interface DatabaseHealthMetrics {
  timestamp: Date;
  overallHealth: 'healthy' | 'degraded' | 'critical';
  
  // Connection metrics
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingClients: number;
  connectionUtilization: number;
  
  // Query metrics
  totalQueries: number;
  queriesPerSecond: number;
  averageQueryTime: number;
  slowQueries: number;
  failedQueries: number;
  
  // Performance metrics
  cacheHitRatio: number;
  lockWaitTime: number;
  deadlocks: number;
  
  // Resource metrics
  diskUsage: number;
  memoryUsage: number;
  cpuUsage: number;
  
  // Table metrics
  tableStats: TableMetrics[];
}

// Table-level metrics
export interface TableMetrics {
  tableName: string;
  schemaName: string;
  rowCount: number;
  tableSize: number;
  indexSize: number;
  sequentialScans: number;
  indexScans: number;
  insertions: number;
  updates: number;
  deletions: number;
  deadTuples: number;
  liveTuples: number;
  lastAnalyzed: Date;
  lastVacuumed: Date;
}

// Alert configuration
export interface AlertConfig {
  slowQueryThreshold: number;
  criticalSlowQueryThreshold: number;
  connectionThreshold: number;
  errorRateThreshold: number;
  diskUsageThreshold: number;
  memoryUsageThreshold: number;
  lockWaitThreshold: number;
  enableSlowQueryAlerts: boolean;
  enableConnectionAlerts: boolean;
  enableErrorRateAlerts: boolean;
  enableResourceAlerts: boolean;
  alertCooldown: number;
}

// Performance trend data
export interface PerformanceTrend {
  metric: string;
  timeframe: '1hour' | '1day' | '1week' | '1month';
  values: Array<{ timestamp: Date; value: number }>;
  trend: 'improving' | 'stable' | 'degrading';
  changeRate: number;
}

export class DatabaseMonitor extends EventEmitter {
  private database: DatabaseConnection;
  private poolManager?: DatabasePoolManager;
  private queryAnalysis: Map<string, QueryAnalysis> = new Map();
  private healthMetrics: DatabaseHealthMetrics[] = [];
  private alertConfig: AlertConfig;
  private lastAlerts: Map<string, Date> = new Map();
  private monitoringInterval?: NodeJS.Timeout;
  private metricsCollectionInterval?: NodeJS.Timeout;
  private readonly startTime: Date;

  constructor(
    database: DatabaseConnection,
    poolManager?: DatabasePoolManager,
    config?: Partial<AlertConfig>
  ) {
    super();
    this.database = database;
    this.poolManager = poolManager;
    this.startTime = new Date();
    
    this.alertConfig = {
      slowQueryThreshold: 1000, // 1 second
      criticalSlowQueryThreshold: 5000, // 5 seconds
      connectionThreshold: 0.8, // 80% of max connections
      errorRateThreshold: 0.05, // 5% error rate
      diskUsageThreshold: 0.85, // 85% disk usage
      memoryUsageThreshold: 0.85, // 85% memory usage
      lockWaitThreshold: 1000, // 1 second
      enableSlowQueryAlerts: true,
      enableConnectionAlerts: true,
      enableErrorRateAlerts: true,
      enableResourceAlerts: true,
      alertCooldown: 300000, // 5 minutes
      ...config,
    };

    this.setupEventListeners();
    this.startMonitoring();
  }

  private setupEventListeners(): void {
    // Listen for slow queries from database connection
    this.database.on('slowQuery', (metrics: QueryMetrics) => {
      this.handleSlowQuery(metrics);
    });

    // Listen for pool events if pool manager is provided
    if (this.poolManager) {
      this.poolManager.on('metricsCollected', (metrics) => {
        this.handlePoolMetrics(metrics);
      });

      this.poolManager.on('primaryHealthCheckFailure', (data) => {
        this.handleHealthCheckFailure('primary', data);
      });

      this.poolManager.on('replicaHealthCheckFailure', (data) => {
        this.handleHealthCheckFailure('replica', data);
      });
    }
  }

  private startMonitoring(): void {
    // Start periodic monitoring
    this.monitoringInterval = setInterval(async () => {
      await this.collectDatabaseMetrics();
    }, 60000); // Every minute

    // Start metrics collection
    this.metricsCollectionInterval = setInterval(async () => {
      await this.analyzePerformance();
    }, 300000); // Every 5 minutes
  }

  private async collectDatabaseMetrics(): Promise<void> {
    try {
      const metrics = await this.gatherHealthMetrics();
      this.healthMetrics.push(metrics);
      
      // Keep only last 1440 metrics (24 hours at 1-minute intervals)
      if (this.healthMetrics.length > 1440) {
        this.healthMetrics = this.healthMetrics.slice(-1440);
      }

      // Check for alerts
      await this.checkAlerts(metrics);
      
      this.emit('metricsCollected', metrics);
    } catch (error) {
      console.error('Failed to collect database metrics:', error);
      this.emit('metricsError', error);
    }
  }

  private async gatherHealthMetrics(): Promise<DatabaseHealthMetrics> {
    const [
      connectionStats,
      queryStats,
      performanceStats,
      resourceStats,
      tableStats,
    ] = await Promise.all([
      this.getConnectionStats(),
      this.getQueryStats(),
      this.getPerformanceStats(),
      this.getResourceStats(),
      this.getTableStats(),
    ]);

    const overallHealth = this.calculateOverallHealth(
      connectionStats,
      queryStats,
      performanceStats,
      resourceStats
    );

    return {
      timestamp: new Date(),
      overallHealth,
      ...connectionStats,
      ...queryStats,
      ...performanceStats,
      ...resourceStats,
      tableStats,
    };
  }

  private async getConnectionStats(): Promise<any> {
    const stats = this.database.getStats();
    
    return {
      totalConnections: stats.totalConnections,
      activeConnections: stats.activeConnections,
      idleConnections: stats.idleConnections,
      waitingClients: stats.waitingClients,
      connectionUtilization: stats.totalConnections / 20, // Assuming max 20 connections
    };
  }

  private async getQueryStats(): Promise<any> {
    const stats = this.database.getStats();
    const currentTime = Date.now();
    const oneMinuteAgo = currentTime - 60000;
    
    // Get recent queries
    const recentQueries = this.database.getQueryMetrics(100)
      .filter(q => q.timestamp.getTime() > oneMinuteAgo);

    const queriesPerSecond = recentQueries.length / 60;
    const failedQueries = recentQueries.filter(q => q.error).length;

    return {
      totalQueries: stats.totalQueries,
      queriesPerSecond,
      averageQueryTime: stats.averageQueryTime,
      slowQueries: stats.slowQueries,
      failedQueries,
    };
  }

  private async getPerformanceStats(): Promise<any> {
    try {
      const result = await this.database.query(`
        SELECT 
          round(blks_hit::numeric/(blks_read+blks_hit+1)*100,2) as cache_hit_ratio,
          sum(blks_read) as disk_blocks_read,
          sum(blks_hit) as cache_blocks_hit
        FROM pg_stat_database 
        WHERE datname = current_database()
      `);

      const lockResult = await this.database.query(`
        SELECT 
          count(*) as lock_count,
          coalesce(sum(extract(epoch from now()-query_start)),0) as lock_wait_time
        FROM pg_stat_activity 
        WHERE state = 'active' AND wait_event_type = 'Lock'
      `);

      const deadlockResult = await this.database.query(`
        SELECT deadlocks 
        FROM pg_stat_database 
        WHERE datname = current_database()
      `);

      return {
        cacheHitRatio: result.rows[0]?.cache_hit_ratio || 0,
        lockWaitTime: lockResult.rows[0]?.lock_wait_time || 0,
        deadlocks: deadlockResult.rows[0]?.deadlocks || 0,
      };
    } catch (error) {
      console.error('Failed to get performance stats:', error);
      return {
        cacheHitRatio: 0,
        lockWaitTime: 0,
        deadlocks: 0,
      };
    }
  }

  private async getResourceStats(): Promise<any> {
    try {
      const result = await this.database.query(`
        SELECT 
          pg_size_pretty(pg_database_size(current_database())) as database_size,
          pg_database_size(current_database()) as database_size_bytes
      `);

      return {
        diskUsage: 0, // This would need OS-level monitoring
        memoryUsage: 0, // This would need OS-level monitoring
        cpuUsage: 0, // This would need OS-level monitoring
      };
    } catch (error) {
      console.error('Failed to get resource stats:', error);
      return {
        diskUsage: 0,
        memoryUsage: 0,
        cpuUsage: 0,
      };
    }
  }

  private async getTableStats(): Promise<TableMetrics[]> {
    try {
      const result = await this.database.query(`
        SELECT 
          schemaname,
          tablename,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples,
          seq_scan as sequential_scans,
          idx_scan as index_scans,
          n_tup_ins as insertions,
          n_tup_upd as updates,
          n_tup_del as deletions,
          last_analyze,
          last_vacuum,
          pg_total_relation_size(schemaname||'.'||tablename) as total_size,
          pg_indexes_size(schemaname||'.'||tablename) as index_size
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 20
      `);

      return result.rows.map(row => ({
        tableName: row.tablename,
        schemaName: row.schemaname,
        rowCount: row.live_tuples + row.dead_tuples,
        tableSize: row.total_size,
        indexSize: row.index_size,
        sequentialScans: row.sequential_scans,
        indexScans: row.index_scans,
        insertions: row.insertions,
        updates: row.updates,
        deletions: row.deletions,
        deadTuples: row.dead_tuples,
        liveTuples: row.live_tuples,
        lastAnalyzed: row.last_analyze,
        lastVacuumed: row.last_vacuum,
      }));
    } catch (error) {
      console.error('Failed to get table stats:', error);
      return [];
    }
  }

  private calculateOverallHealth(
    connectionStats: any,
    queryStats: any,
    performanceStats: any,
    resourceStats: any
  ): 'healthy' | 'degraded' | 'critical' {
    const issues = [];

    // Check connection health
    if (connectionStats.connectionUtilization > 0.9) {
      issues.push('critical');
    } else if (connectionStats.connectionUtilization > 0.8) {
      issues.push('degraded');
    }

    // Check query performance
    if (queryStats.averageQueryTime > 5000) {
      issues.push('critical');
    } else if (queryStats.averageQueryTime > 2000) {
      issues.push('degraded');
    }

    // Check cache hit ratio
    if (performanceStats.cacheHitRatio < 90) {
      issues.push('degraded');
    }

    // Check for deadlocks
    if (performanceStats.deadlocks > 0) {
      issues.push('degraded');
    }

    if (issues.includes('critical')) {
      return 'critical';
    } else if (issues.includes('degraded')) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  private handleSlowQuery(metrics: QueryMetrics): void {
    const normalizedQuery = this.normalizeQuery(metrics.query);
    const existing = this.queryAnalysis.get(normalizedQuery);

    if (existing) {
      existing.executionCount++;
      existing.totalTime += metrics.duration;
      existing.averageTime = existing.totalTime / existing.executionCount;
      existing.minTime = Math.min(existing.minTime, metrics.duration);
      existing.maxTime = Math.max(existing.maxTime, metrics.duration);
      existing.lastExecuted = metrics.timestamp;
      
      if (metrics.error) {
        existing.errorRate = (existing.errorRate + 1) / existing.executionCount;
      }
    } else {
      this.queryAnalysis.set(normalizedQuery, {
        query: metrics.query,
        normalizedQuery,
        executionCount: 1,
        averageTime: metrics.duration,
        minTime: metrics.duration,
        maxTime: metrics.duration,
        totalTime: metrics.duration,
        lastExecuted: metrics.timestamp,
        errorRate: metrics.error ? 1 : 0,
        impactScore: this.calculateImpactScore(metrics.duration, 1),
      });
    }

    // Generate alert if needed
    if (this.alertConfig.enableSlowQueryAlerts) {
      const severity = metrics.duration > this.alertConfig.criticalSlowQueryThreshold ? 'critical' : 'warning';
      const alert: SlowQueryAlert = {
        query: metrics.query,
        duration: metrics.duration,
        threshold: this.alertConfig.slowQueryThreshold,
        parameters: metrics.parameters,
        timestamp: metrics.timestamp,
        severity,
        suggestions: this.generateOptimizationSuggestions(metrics.query, metrics.duration),
      };

      this.emitAlert('slowQuery', alert);
    }
  }

  private handlePoolMetrics(metrics: any): void {
    // Process pool metrics and emit events
    this.emit('poolMetrics', metrics);
  }

  private handleHealthCheckFailure(poolName: string, data: any): void {
    this.emit('healthCheckFailure', { poolName, ...data });
  }

  private normalizeQuery(query: string): string {
    return query
      .replace(/\$\d+/g, '?') // Replace parameters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\b\d+\b/g, '?') // Replace numeric literals
      .replace(/'[^']*'/g, '?') // Replace string literals
      .trim()
      .toLowerCase();
  }

  private calculateImpactScore(duration: number, executionCount: number): number {
    // Simple impact score based on duration and frequency
    return Math.log(duration) * Math.log(executionCount);
  }

  private generateOptimizationSuggestions(query: string, duration: number): string[] {
    const suggestions: string[] = [];
    
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('select *')) {
      suggestions.push('Consider selecting only the columns you need instead of using SELECT *');
    }
    
    if (lowerQuery.includes('where') && !lowerQuery.includes('index')) {
      suggestions.push('Consider adding an index on the WHERE clause columns');
    }
    
    if (lowerQuery.includes('like') && lowerQuery.includes('%')) {
      suggestions.push('Consider using full-text search for LIKE queries with leading wildcards');
    }
    
    if (lowerQuery.includes('order by') && !lowerQuery.includes('limit')) {
      suggestions.push('Consider adding LIMIT to ORDER BY queries');
    }
    
    if (duration > 5000) {
      suggestions.push('Consider breaking down this query into smaller parts');
    }
    
    return suggestions;
  }

  private async checkAlerts(metrics: DatabaseHealthMetrics): Promise<void> {
    // Check connection alerts
    if (this.alertConfig.enableConnectionAlerts && 
        metrics.connectionUtilization > this.alertConfig.connectionThreshold) {
      this.emitAlert('highConnectionUsage', {
        current: metrics.connectionUtilization,
        threshold: this.alertConfig.connectionThreshold,
        timestamp: metrics.timestamp,
      });
    }

    // Check error rate alerts
    if (this.alertConfig.enableErrorRateAlerts) {
      const errorRate = metrics.failedQueries / metrics.totalQueries;
      if (errorRate > this.alertConfig.errorRateThreshold) {
        this.emitAlert('highErrorRate', {
          current: errorRate,
          threshold: this.alertConfig.errorRateThreshold,
          timestamp: metrics.timestamp,
        });
      }
    }

    // Check resource alerts
    if (this.alertConfig.enableResourceAlerts) {
      if (metrics.diskUsage > this.alertConfig.diskUsageThreshold) {
        this.emitAlert('highDiskUsage', {
          current: metrics.diskUsage,
          threshold: this.alertConfig.diskUsageThreshold,
          timestamp: metrics.timestamp,
        });
      }

      if (metrics.memoryUsage > this.alertConfig.memoryUsageThreshold) {
        this.emitAlert('highMemoryUsage', {
          current: metrics.memoryUsage,
          threshold: this.alertConfig.memoryUsageThreshold,
          timestamp: metrics.timestamp,
        });
      }
    }
  }

  private emitAlert(type: string, data: any): void {
    const now = new Date();
    const lastAlert = this.lastAlerts.get(type);
    
    // Check cooldown period
    if (lastAlert && (now.getTime() - lastAlert.getTime()) < this.alertConfig.alertCooldown) {
      return;
    }

    this.lastAlerts.set(type, now);
    this.emit('alert', { type, data });
  }

  private async analyzePerformance(): Promise<void> {
    // Analyze query performance and generate insights
    const topSlowQueries = Array.from(this.queryAnalysis.values())
      .sort((a, b) => b.impactScore - a.impactScore)
      .slice(0, 10);

    this.emit('performanceAnalysis', {
      topSlowQueries,
      totalQueries: this.queryAnalysis.size,
      timestamp: new Date(),
    });
  }

  /**
   * Get current health metrics
   */
  getCurrentMetrics(): DatabaseHealthMetrics | null {
    return this.healthMetrics.length > 0 ? this.healthMetrics[this.healthMetrics.length - 1] : null;
  }

  /**
   * Get historical metrics
   */
  getHistoricalMetrics(hours: number = 24): DatabaseHealthMetrics[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.healthMetrics.filter(m => m.timestamp >= cutoff);
  }

  /**
   * Get query analysis
   */
  getQueryAnalysis(): QueryAnalysis[] {
    return Array.from(this.queryAnalysis.values())
      .sort((a, b) => b.impactScore - a.impactScore);
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(metric: string, timeframe: '1hour' | '1day' | '1week' | '1month'): PerformanceTrend | null {
    const now = new Date();
    let cutoff: Date;
    
    switch (timeframe) {
      case '1hour':
        cutoff = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '1day':
        cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '1week':
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '1month':
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const relevantMetrics = this.healthMetrics.filter(m => m.timestamp >= cutoff);
    if (relevantMetrics.length < 2) return null;

    const values = relevantMetrics.map(m => ({
      timestamp: m.timestamp,
      value: this.extractMetricValue(m, metric),
    }));

    // Calculate trend
    const firstValue = values[0].value;
    const lastValue = values[values.length - 1].value;
    const changeRate = (lastValue - firstValue) / firstValue;

    let trend: 'improving' | 'stable' | 'degrading';
    if (Math.abs(changeRate) < 0.05) {
      trend = 'stable';
    } else if (changeRate > 0) {
      trend = metric === 'averageQueryTime' ? 'degrading' : 'improving';
    } else {
      trend = metric === 'averageQueryTime' ? 'improving' : 'degrading';
    }

    return {
      metric,
      timeframe,
      values,
      trend,
      changeRate,
    };
  }

  private extractMetricValue(metrics: DatabaseHealthMetrics, metric: string): number {
    switch (metric) {
      case 'averageQueryTime':
        return metrics.averageQueryTime;
      case 'connectionUtilization':
        return metrics.connectionUtilization;
      case 'queriesPerSecond':
        return metrics.queriesPerSecond;
      case 'cacheHitRatio':
        return metrics.cacheHitRatio;
      case 'lockWaitTime':
        return metrics.lockWaitTime;
      default:
        return 0;
    }
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
    }
    
    this.emit('stopped');
  }
}

// Export types and classes
export type {
  QueryAnalysis,
  SlowQueryAlert,
  DatabaseHealthMetrics,
  TableMetrics,
  AlertConfig,
  PerformanceTrend,
};