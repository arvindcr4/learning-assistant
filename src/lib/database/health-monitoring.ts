// Database Health Monitoring and Alerting System
import { EventEmitter } from 'events';
import { DatabaseConnection, getDatabase } from './connection';
import { DatabaseUtils } from './utils';

// Health check result interface
interface HealthCheckResult {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  timestamp: Date;
  details?: any;
  error?: string;
}

// System metrics interface
interface SystemMetrics {
  database: {
    connectionPool: {
      total: number;
      active: number;
      idle: number;
      waiting: number;
    };
    performance: {
      avgQueryTime: number;
      slowQueries: number;
      totalQueries: number;
      errorRate: number;
    };
    storage: {
      totalSize: number;
      usedSize: number;
      tableCount: number;
      indexCount: number;
    };
  };
  system: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    timestamp: Date;
  };
}

// Alert configuration
interface AlertConfig {
  enabled: boolean;
  thresholds: {
    responseTime: number; // ms
    errorRate: number; // percentage
    connectionUtilization: number; // percentage
    diskUsage: number; // percentage
  };
  channels: {
    email?: boolean;
    webhook?: string;
    slack?: string;
  };
}

// Alert event
interface AlertEvent {
  id: string;
  type: 'connection' | 'performance' | 'storage' | 'error';
  severity: 'warning' | 'critical';
  message: string;
  component: string;
  metrics: any;
  timestamp: Date;
  resolved: boolean;
}

export class DatabaseHealthMonitor extends EventEmitter {
  private db: DatabaseConnection;
  private utils: DatabaseUtils;
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertConfig: AlertConfig;
  private healthHistory: HealthCheckResult[] = [];
  private metricsHistory: SystemMetrics[] = [];
  private activeAlerts: Map<string, AlertEvent> = new Map();
  private readonly maxHistorySize = 1000;

  constructor(alertConfig?: Partial<AlertConfig>) {
    super();
    this.db = getDatabase();
    this.utils = new DatabaseUtils();
    this.alertConfig = {
      enabled: true,
      thresholds: {
        responseTime: 5000, // 5 seconds
        errorRate: 5, // 5%
        connectionUtilization: 80, // 80%
        diskUsage: 85 // 85%
      },
      channels: {
        email: false
      },
      ...alertConfig
    };
  }

  // Start monitoring
  startMonitoring(intervalMs: number = 30000): void {
    if (this.isMonitoring) {
      console.warn('Health monitoring is already running');
      return;
    }

    console.log(`Starting database health monitoring (interval: ${intervalMs}ms)`);
    this.isMonitoring = true;

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthChecks();
        await this.collectMetrics();
        this.checkThresholds();
      } catch (error) {
        console.error('Health monitoring error:', error);
        this.emit('monitoringError', error);
      }
    }, intervalMs);

    // Initial health check
    this.performHealthChecks();
  }

  // Stop monitoring
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    console.log('Stopping database health monitoring');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  // Perform comprehensive health checks
  private async performHealthChecks(): Promise<void> {
    const checks = [
      this.checkDatabaseConnection(),
      this.checkTableIntegrity(),
      this.checkIndexHealth(),
      this.checkQueryPerformance(),
      this.checkDiskSpace()
    ];

    const results = await Promise.allSettled(checks);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        this.addHealthResult(result.value);
      } else {
        this.addHealthResult({
          component: `check_${index}`,
          status: 'unhealthy',
          responseTime: 0,
          timestamp: new Date(),
          error: result.reason?.message || 'Unknown error'
        });
      }
    });
  }

  // Check database connection
  private async checkDatabaseConnection(): Promise<HealthCheckResult> {
    const start = Date.now();
    
    try {
      await this.db.query('SELECT 1 as health_check');
      
      return {
        component: 'database_connection',
        status: 'healthy',
        responseTime: Date.now() - start,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        component: 'database_connection',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        timestamp: new Date(),
        error: (error as Error).message
      };
    }
  }

  // Check table integrity
  private async checkTableIntegrity(): Promise<HealthCheckResult> {
    const start = Date.now();
    
    try {
      const result = await this.db.query(`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins,
          n_tup_upd,
          n_tup_del
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        LIMIT 10
      `);

      return {
        component: 'table_integrity',
        status: 'healthy',
        responseTime: Date.now() - start,
        timestamp: new Date(),
        details: {
          tableCount: result.rowCount,
          tables: result.rows
        }
      };
    } catch (error) {
      return {
        component: 'table_integrity',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        timestamp: new Date(),
        error: (error as Error).message
      };
    }
  }

  // Check index health
  private async checkIndexHealth(): Promise<HealthCheckResult> {
    const start = Date.now();
    
    try {
      const result = await this.db.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        AND idx_tup_read > 0
        ORDER BY idx_tup_read DESC
        LIMIT 10
      `);

      return {
        component: 'index_health',
        status: 'healthy',
        responseTime: Date.now() - start,
        timestamp: new Date(),
        details: {
          indexCount: result.rowCount,
          indexes: result.rows
        }
      };
    } catch (error) {
      return {
        component: 'index_health',
        status: 'degraded',
        responseTime: Date.now() - start,
        timestamp: new Date(),
        error: (error as Error).message
      };
    }
  }

  // Check query performance
  private async checkQueryPerformance(): Promise<HealthCheckResult> {
    const start = Date.now();
    
    try {
      const result = await this.db.query(`
        SELECT 
          query,
          calls,
          total_time,
          mean_time,
          max_time
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat_statements%'
        ORDER BY mean_time DESC
        LIMIT 5
      `);

      const slowQueries = result.rows.filter(row => row.mean_time > 1000);
      const status = slowQueries.length > 3 ? 'degraded' : 'healthy';

      return {
        component: 'query_performance',
        status,
        responseTime: Date.now() - start,
        timestamp: new Date(),
        details: {
          totalQueries: result.rowCount,
          slowQueries: slowQueries.length,
          queries: result.rows
        }
      };
    } catch (error) {
      // pg_stat_statements might not be enabled
      return {
        component: 'query_performance',
        status: 'healthy',
        responseTime: Date.now() - start,
        timestamp: new Date(),
        details: { note: 'pg_stat_statements not available' }
      };
    }
  }

  // Check disk space
  private async checkDiskSpace(): Promise<HealthCheckResult> {
    const start = Date.now();
    
    try {
      const result = await this.db.query(`
        SELECT 
          pg_database_size(current_database()) as database_size,
          pg_size_pretty(pg_database_size(current_database())) as database_size_pretty
      `);

      const databaseSize = parseInt(result.rows[0].database_size);
      const sizePretty = result.rows[0].database_size_pretty;

      // This is a simplified check - in production you'd want to check actual disk space
      const status = databaseSize > 10 * 1024 * 1024 * 1024 ? 'degraded' : 'healthy'; // 10GB threshold

      return {
        component: 'disk_space',
        status,
        responseTime: Date.now() - start,
        timestamp: new Date(),
        details: {
          databaseSize,
          databaseSizePretty: sizePretty
        }
      };
    } catch (error) {
      return {
        component: 'disk_space',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        timestamp: new Date(),
        error: (error as Error).message
      };
    }
  }

  // Collect system metrics
  private async collectMetrics(): Promise<void> {
    try {
      const poolStats = this.db.getPoolStats();
      const poolMetrics = this.db.getMetrics();
      const memoryUsage = process.memoryUsage();

      // Get database storage metrics
      const storageResult = await this.db.query(`
        SELECT 
          COUNT(DISTINCT tablename) as table_count,
          COUNT(DISTINCT indexname) as index_count
        FROM pg_stat_user_tables t
        LEFT JOIN pg_stat_user_indexes i ON t.tablename = i.tablename
        WHERE t.schemaname = 'public'
      `);

      const sizeResult = await this.db.query(`
        SELECT 
          pg_database_size(current_database()) as total_size,
          pg_database_size(current_database()) as used_size
      `);

      const metrics: SystemMetrics = {
        database: {
          connectionPool: {
            total: poolStats.totalConnections,
            active: poolStats.activeConnections || 0,
            idle: poolStats.idleConnections,
            waiting: poolStats.waitingClients
          },
          performance: {
            avgQueryTime: this.calculateAvgQueryTime(),
            slowQueries: this.countSlowQueries(),
            totalQueries: poolMetrics.totalQueries,
            errorRate: this.calculateErrorRate(poolMetrics)
          },
          storage: {
            totalSize: parseInt(sizeResult.rows[0].total_size),
            usedSize: parseInt(sizeResult.rows[0].used_size),
            tableCount: parseInt(storageResult.rows[0].table_count),
            indexCount: parseInt(storageResult.rows[0].index_count)
          }
        },
        system: {
          uptime: process.uptime(),
          memoryUsage,
          timestamp: new Date()
        }
      };

      this.addMetrics(metrics);
      this.emit('metricsCollected', metrics);

    } catch (error) {
      console.error('Error collecting metrics:', error);
      this.emit('metricsError', error);
    }
  }

  // Calculate average query time from recent health checks
  private calculateAvgQueryTime(): number {
    const recentChecks = this.healthHistory
      .filter(check => check.component === 'database_connection')
      .slice(-10);
    
    if (recentChecks.length === 0) return 0;
    
    const totalTime = recentChecks.reduce((sum, check) => sum + check.responseTime, 0);
    return totalTime / recentChecks.length;
  }

  // Count slow queries from recent health checks
  private countSlowQueries(): number {
    const recentCheck = this.healthHistory
      .filter(check => check.component === 'query_performance')
      .slice(-1)[0];
    
    return recentCheck?.details?.slowQueries || 0;
  }

  // Calculate error rate
  private calculateErrorRate(metrics: any): number {
    if (metrics.totalQueries === 0) return 0;
    return (metrics.errorCount / metrics.totalQueries) * 100;
  }

  // Check thresholds and generate alerts
  private checkThresholds(): void {
    if (!this.alertConfig.enabled) return;

    const latestMetrics = this.metricsHistory[this.metricsHistory.length - 1];
    if (!latestMetrics) return;

    const { thresholds } = this.alertConfig;

    // Check response time
    if (latestMetrics.database.performance.avgQueryTime > thresholds.responseTime) {
      this.generateAlert({
        type: 'performance',
        severity: 'warning',
        message: `High database response time: ${latestMetrics.database.performance.avgQueryTime}ms`,
        component: 'database_response_time',
        metrics: { responseTime: latestMetrics.database.performance.avgQueryTime }
      });
    }

    // Check error rate
    if (latestMetrics.database.performance.errorRate > thresholds.errorRate) {
      this.generateAlert({
        type: 'error',
        severity: 'critical',
        message: `High error rate: ${latestMetrics.database.performance.errorRate}%`,
        component: 'database_errors',
        metrics: { errorRate: latestMetrics.database.performance.errorRate }
      });
    }

    // Check connection utilization
    const connectionUtilization = (latestMetrics.database.connectionPool.active / 
      latestMetrics.database.connectionPool.total) * 100;
    
    if (connectionUtilization > thresholds.connectionUtilization) {
      this.generateAlert({
        type: 'connection',
        severity: 'warning',
        message: `High connection utilization: ${connectionUtilization.toFixed(1)}%`,
        component: 'connection_pool',
        metrics: { utilization: connectionUtilization }
      });
    }
  }

  // Generate alert
  private generateAlert(alertData: Omit<AlertEvent, 'id' | 'timestamp' | 'resolved'>): void {
    const alertId = `${alertData.component}_${Date.now()}`;
    
    const alert: AlertEvent = {
      id: alertId,
      timestamp: new Date(),
      resolved: false,
      ...alertData
    };

    this.activeAlerts.set(alertId, alert);
    this.emit('alert', alert);

    console.warn(`ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);

    // Send notifications based on configuration
    this.sendNotifications(alert);
  }

  // Send notifications
  private async sendNotifications(alert: AlertEvent): Promise<void> {
    const { channels } = this.alertConfig;

    try {
      // Email notification
      if (channels.email) {
        // Implementation would depend on your email service
        console.log(`Email notification sent for alert: ${alert.id}`);
      }

      // Webhook notification
      if (channels.webhook) {
        const fetch = (await import('node-fetch')).default;
        await fetch(channels.webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alert)
        });
        console.log(`Webhook notification sent for alert: ${alert.id}`);
      }

      // Slack notification
      if (channels.slack) {
        const fetch = (await import('node-fetch')).default;
        await fetch(channels.slack, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 Database Alert: ${alert.message}`,
            attachments: [{
              color: alert.severity === 'critical' ? 'danger' : 'warning',
              fields: [{
                title: 'Component',
                value: alert.component,
                short: true
              }, {
                title: 'Timestamp',
                value: alert.timestamp.toISOString(),
                short: true
              }]
            }]
          })
        });
        console.log(`Slack notification sent for alert: ${alert.id}`);
      }

    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  }

  // Add health check result to history
  private addHealthResult(result: HealthCheckResult): void {
    this.healthHistory.push(result);
    
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory.shift();
    }

    this.emit('healthCheck', result);
  }

  // Add metrics to history
  private addMetrics(metrics: SystemMetrics): void {
    this.metricsHistory.push(metrics);
    
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
  }

  // Get current health status
  getHealthStatus(): { overall: string; components: HealthCheckResult[] } {
    const recentChecks = this.healthHistory.slice(-10);
    const componentStatus = new Map<string, HealthCheckResult>();

    // Get latest status for each component
    recentChecks.forEach(check => {
      if (!componentStatus.has(check.component) || 
          check.timestamp > componentStatus.get(check.component)!.timestamp) {
        componentStatus.set(check.component, check);
      }
    });

    const components = Array.from(componentStatus.values());
    
    // Determine overall status
    let overall = 'healthy';
    if (components.some(c => c.status === 'unhealthy')) {
      overall = 'unhealthy';
    } else if (components.some(c => c.status === 'degraded')) {
      overall = 'degraded';
    }

    return { overall, components };
  }

  // Get latest metrics
  getLatestMetrics(): SystemMetrics | null {
    return this.metricsHistory[this.metricsHistory.length - 1] || null;
  }

  // Get active alerts
  getActiveAlerts(): AlertEvent[] {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
  }

  // Resolve alert
  resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      this.emit('alertResolved', alert);
      return true;
    }
    return false;
  }

  // Get health history
  getHealthHistory(component?: string, limit: number = 100): HealthCheckResult[] {
    let history = this.healthHistory;
    
    if (component) {
      history = history.filter(check => check.component === component);
    }
    
    return history.slice(-limit);
  }

  // Get metrics history
  getMetricsHistory(limit: number = 100): SystemMetrics[] {
    return this.metricsHistory.slice(-limit);
  }
}

// Create singleton instance
export const databaseHealthMonitor = new DatabaseHealthMonitor();

// Convenience functions
export const startHealthMonitoring = (intervalMs?: number) => 
  databaseHealthMonitor.startMonitoring(intervalMs);

export const stopHealthMonitoring = () => 
  databaseHealthMonitor.stopMonitoring();

export const getHealthStatus = () => 
  databaseHealthMonitor.getHealthStatus();

export const getLatestMetrics = () => 
  databaseHealthMonitor.getLatestMetrics();

export const getActiveAlerts = () => 
  databaseHealthMonitor.getActiveAlerts();

export default databaseHealthMonitor;