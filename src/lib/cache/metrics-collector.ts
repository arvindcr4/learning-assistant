import { distributedCache } from './distributed-cache-service';
import { cacheManager } from '../cache';
import { sessionCache } from '../session-cache';
import { contentCache } from '../content-cache';
import { redisManager } from '../redis-client';
import { env } from '../env-validation';
import { executeRedisCommand } from '../redis-client';

// ====================
// TYPES AND INTERFACES
// ====================

export interface CacheMetricsSnapshot {
  timestamp: number;
  distributedCache: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    avgResponseTime: number;
    hitRate: number;
    missRate: number;
    compressionRatio: number;
    networkLatency: number;
    shardsHealth: number;
    nodesHealth: number;
  };
  memoryCache: {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    evictions: number;
    hitRate: number;
    avgResponseTime: number;
    totalKeys: number;
    totalSize: number;
    memoryUsage: number;
  };
  sessionCache: {
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
    averageSessionDuration: number;
    totalSessionTime: number;
    uniqueUsers: number;
    peakConcurrentSessions: number;
  };
  contentCache: {
    totalContent: number;
    cachedContent: number;
    adaptations: number;
    hitRate: number;
    avgAdaptationTime: number;
    cacheSize: number;
    compressionRatio: number;
    invalidationCount: number;
  };
  redis: {
    connectionCount: number;
    memoryUsage: number;
    hits: number;
    misses: number;
    totalConnectionsReceived: number;
    totalCommandsProcessed: number;
    instantaneousOpsPerSec: number;
    usedMemory: number;
    usedMemoryPeak: number;
    connectedClients: number;
    evictedKeys: number;
    expiredKeys: number;
  };
}

export interface CacheMetricsTrend {
  metric: string;
  timeframe: string;
  dataPoints: { timestamp: number; value: number }[];
  trend: 'increasing' | 'decreasing' | 'stable';
  changeRate: number;
  variance: number;
  min: number;
  max: number;
  avg: number;
}

export interface CachePerformanceAlert {
  id: string;
  type: 'performance' | 'availability' | 'capacity' | 'error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  metric: string;
  threshold: number;
  currentValue: number;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
  autoResolved: boolean;
}

export interface CacheMetricsAggregation {
  timeRange: string;
  granularity: string;
  summary: {
    totalOperations: number;
    avgHitRate: number;
    avgResponseTime: number;
    totalErrors: number;
    errorRate: number;
    peakMemoryUsage: number;
    peakOperationsPerSecond: number;
  };
  trends: CacheMetricsTrend[];
  alerts: CachePerformanceAlert[];
  recommendations: CacheRecommendation[];
}

export interface CacheRecommendation {
  type: 'optimization' | 'scaling' | 'configuration' | 'maintenance';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  impact: string;
  implementation: string;
  estimatedSavings?: {
    responseTime?: number;
    memoryUsage?: number;
    operationalCost?: number;
  };
}

// ====================
// CACHE METRICS COLLECTOR
// ====================

export class CacheMetricsCollector {
  private static instance: CacheMetricsCollector;
  private snapshots: CacheMetricsSnapshot[] = [];
  private alerts: Map<string, CachePerformanceAlert> = new Map();
  private collectionInterval: NodeJS.Timeout | null = null;
  private alertCheckInterval: NodeJS.Timeout | null = null;
  private maxSnapshots: number = 1440; // 24 hours of minute-level data
  private isCollecting: boolean = false;

  private constructor() {
    this.startCollection();
  }

  public static getInstance(): CacheMetricsCollector {
    if (!CacheMetricsCollector.instance) {
      CacheMetricsCollector.instance = new CacheMetricsCollector();
    }
    return CacheMetricsCollector.instance;
  }

  /**
   * Start metrics collection
   */
  public startCollection(): void {
    if (this.isCollecting) return;

    console.log('📊 Starting cache metrics collection...');
    
    // Collect metrics every minute
    this.collectionInterval = setInterval(async () => {
      await this.collectSnapshot();
    }, 60000);

    // Check for alerts every 30 seconds
    this.alertCheckInterval = setInterval(async () => {
      await this.checkAlerts();
    }, 30000);

    this.isCollecting = true;
    console.log('✅ Cache metrics collection started');
  }

  /**
   * Stop metrics collection
   */
  public stopCollection(): void {
    if (!this.isCollecting) return;

    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
    }
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
    }

    this.isCollecting = false;
    console.log('🛑 Cache metrics collection stopped');
  }

  /**
   * Collect current metrics snapshot
   */
  public async collectSnapshot(): Promise<CacheMetricsSnapshot> {
    try {
      const timestamp = Date.now();

      // Collect metrics from all cache systems
      const [
        distributedMetrics,
        memoryStats,
        sessionStats,
        contentStats,
        redisMetrics
      ] = await Promise.allSettled([
        Promise.resolve(distributedCache.getMetrics()),
        Promise.resolve(cacheManager.getStats()),
        sessionCache.getSessionStats(),
        contentCache.getContentStats(),
        Promise.resolve(redisManager.getMetrics())
      ]);

      const snapshot: CacheMetricsSnapshot = {
        timestamp,
        distributedCache: this.extractDistributedCacheMetrics(distributedMetrics),
        memoryCache: this.extractMemoryCacheMetrics(memoryStats),
        sessionCache: this.extractSessionCacheMetrics(sessionStats),
        contentCache: this.extractContentCacheMetrics(contentStats),
        redis: this.extractRedisMetrics(redisMetrics),
      };

      // Store snapshot
      this.snapshots.push(snapshot);

      // Maintain maximum number of snapshots
      if (this.snapshots.length > this.maxSnapshots) {
        this.snapshots = this.snapshots.slice(-this.maxSnapshots);
      }

      return snapshot;
    } catch (error) {
      console.error('❌ Failed to collect cache metrics snapshot:', error);
      throw error;
    }
  }

  /**
   * Get metrics for a specific time range
   */
  public getMetrics(
    startTime: number = Date.now() - 3600000, // Last hour
    endTime: number = Date.now()
  ): CacheMetricsSnapshot[] {
    return this.snapshots.filter(
      snapshot => snapshot.timestamp >= startTime && snapshot.timestamp <= endTime
    );
  }

  /**
   * Get aggregated metrics with trends and recommendations
   */
  public getAggregatedMetrics(
    timeRange: string = '1h',
    granularity: string = '1m'
  ): CacheMetricsAggregation {
    const { startTime, endTime } = this.parseTimeRange(timeRange);
    const metrics = this.getMetrics(startTime, endTime);

    if (metrics.length === 0) {
      return this.getEmptyAggregation(timeRange, granularity);
    }

    const summary = this.calculateSummary(metrics);
    const trends = this.calculateTrends(metrics, timeRange);
    const alerts = this.getActiveAlerts();
    const recommendations = this.generateRecommendations(summary, trends, alerts);

    return {
      timeRange,
      granularity,
      summary,
      trends,
      alerts,
      recommendations,
    };
  }

  /**
   * Get performance trends for specific metrics
   */
  public getTrends(
    metricPaths: string[],
    timeRange: string = '1h'
  ): CacheMetricsTrend[] {
    const { startTime, endTime } = this.parseTimeRange(timeRange);
    const metrics = this.getMetrics(startTime, endTime);

    return metricPaths.map(metricPath => 
      this.calculateTrendForMetric(metrics, metricPath, timeRange)
    );
  }

  /**
   * Get active performance alerts
   */
  public getActiveAlerts(): CachePerformanceAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Get all alerts within time range
   */
  public getAlerts(
    startTime: number = Date.now() - 3600000,
    endTime: number = Date.now()
  ): CachePerformanceAlert[] {
    return Array.from(this.alerts.values()).filter(
      alert => alert.timestamp >= startTime && alert.timestamp <= endTime
    );
  }

  /**
   * Acknowledge an alert
   */
  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      alert.autoResolved = false;
      console.log(`✅ Alert acknowledged: ${alert.title}`);
      return true;
    }
    return false;
  }

  /**
   * Get real-time metrics dashboard data
   */
  public getDashboardData(): {
    current: CacheMetricsSnapshot | null;
    recent: CacheMetricsSnapshot[];
    trends: CacheMetricsTrend[];
    alerts: CachePerformanceAlert[];
    healthScore: number;
  } {
    const current = this.snapshots[this.snapshots.length - 1] || null;
    const recent = this.snapshots.slice(-60); // Last hour
    const trends = this.getTrends([
      'memoryCache.hitRate',
      'memoryCache.avgResponseTime',
      'redis.memoryUsage',
      'distributedCache.avgResponseTime'
    ], '1h');
    const alerts = this.getActiveAlerts();
    const healthScore = this.calculateHealthScore(current, alerts);

    return {
      current,
      recent,
      trends,
      alerts,
      healthScore,
    };
  }

  // ====================
  // PRIVATE METHODS
  // ====================

  private extractDistributedCacheMetrics(result: PromiseSettledResult<any>): CacheMetricsSnapshot['distributedCache'] {
    if (result.status === 'fulfilled' && result.value) {
      const metrics = result.value;
      return {
        totalOperations: metrics.totalOperations || 0,
        successfulOperations: metrics.successfulOperations || 0,
        failedOperations: metrics.failedOperations || 0,
        avgResponseTime: metrics.avgResponseTime || 0,
        hitRate: metrics.hitRate || 0,
        missRate: metrics.missRate || 0,
        compressionRatio: metrics.compressionRatio || 0,
        networkLatency: metrics.networkLatency || 0,
        shardsHealth: Object.values(metrics.shardMetrics || {}).filter(
          (shard: any) => shard.status === 'active'
        ).length,
        nodesHealth: Object.values(metrics.nodeMetrics || {}).filter(
          (node: any) => node.status === 'connected'
        ).length,
      };
    }
    return this.getDefaultDistributedCacheMetrics();
  }

  private extractMemoryCacheMetrics(result: PromiseSettledResult<any>): CacheMetricsSnapshot['memoryCache'] {
    if (result.status === 'fulfilled' && result.value) {
      const stats = result.value;
      return {
        hits: stats.hits || 0,
        misses: stats.misses || 0,
        sets: stats.sets || 0,
        deletes: stats.deletes || 0,
        evictions: stats.evictions || 0,
        hitRate: stats.hitRate || 0,
        avgResponseTime: stats.avgResponseTime || 0,
        totalKeys: stats.totalKeys || 0,
        totalSize: stats.totalSize || 0,
        memoryUsage: stats.memoryUsage || 0,
      };
    }
    return this.getDefaultMemoryCacheMetrics();
  }

  private extractSessionCacheMetrics(result: PromiseSettledResult<any>): CacheMetricsSnapshot['sessionCache'] {
    if (result.status === 'fulfilled' && result.value) {
      const stats = result.value;
      return {
        totalSessions: stats.totalSessions || 0,
        activeSessions: stats.activeSessions || 0,
        expiredSessions: stats.expiredSessions || 0,
        averageSessionDuration: stats.averageSessionDuration || 0,
        totalSessionTime: stats.totalSessionTime || 0,
        uniqueUsers: stats.uniqueUsers || 0,
        peakConcurrentSessions: stats.peakConcurrentSessions || 0,
      };
    }
    return this.getDefaultSessionCacheMetrics();
  }

  private extractContentCacheMetrics(result: PromiseSettledResult<any>): CacheMetricsSnapshot['contentCache'] {
    if (result.status === 'fulfilled' && result.value) {
      const stats = result.value;
      return {
        totalContent: stats.totalContent || 0,
        cachedContent: stats.cachedContent || 0,
        adaptations: stats.adaptations || 0,
        hitRate: stats.hitRate || 0,
        avgAdaptationTime: stats.avgAdaptationTime || 0,
        cacheSize: stats.cacheSize || 0,
        compressionRatio: stats.compressionRatio || 0,
        invalidationCount: stats.invalidationCount || 0,
      };
    }
    return this.getDefaultContentCacheMetrics();
  }

  private extractRedisMetrics(result: PromiseSettledResult<any>): CacheMetricsSnapshot['redis'] {
    if (result.status === 'fulfilled' && result.value) {
      const metrics = result.value;
      return {
        connectionCount: metrics.connectionCount || 0,
        memoryUsage: metrics.memoryUsage || 0,
        hits: metrics.hits || 0,
        misses: metrics.misses || 0,
        totalConnectionsReceived: metrics.totalConnectionsReceived || 0,
        totalCommandsProcessed: metrics.totalCommandsProcessed || 0,
        instantaneousOpsPerSec: metrics.instantaneousOpsPerSec || 0,
        usedMemory: metrics.usedMemory || 0,
        usedMemoryPeak: metrics.usedMemoryPeak || 0,
        connectedClients: metrics.connectedClients || 0,
        evictedKeys: metrics.evictedKeys || 0,
        expiredKeys: metrics.expiredKeys || 0,
      };
    }
    return this.getDefaultRedisMetrics();
  }

  private getDefaultDistributedCacheMetrics(): CacheMetricsSnapshot['distributedCache'] {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      avgResponseTime: 0,
      hitRate: 0,
      missRate: 0,
      compressionRatio: 0,
      networkLatency: 0,
      shardsHealth: 0,
      nodesHealth: 0,
    };
  }

  private getDefaultMemoryCacheMetrics(): CacheMetricsSnapshot['memoryCache'] {
    return {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      hitRate: 0,
      avgResponseTime: 0,
      totalKeys: 0,
      totalSize: 0,
      memoryUsage: 0,
    };
  }

  private getDefaultSessionCacheMetrics(): CacheMetricsSnapshot['sessionCache'] {
    return {
      totalSessions: 0,
      activeSessions: 0,
      expiredSessions: 0,
      averageSessionDuration: 0,
      totalSessionTime: 0,
      uniqueUsers: 0,
      peakConcurrentSessions: 0,
    };
  }

  private getDefaultContentCacheMetrics(): CacheMetricsSnapshot['contentCache'] {
    return {
      totalContent: 0,
      cachedContent: 0,
      adaptations: 0,
      hitRate: 0,
      avgAdaptationTime: 0,
      cacheSize: 0,
      compressionRatio: 0,
      invalidationCount: 0,
    };
  }

  private getDefaultRedisMetrics(): CacheMetricsSnapshot['redis'] {
    return {
      connectionCount: 0,
      memoryUsage: 0,
      hits: 0,
      misses: 0,
      totalConnectionsReceived: 0,
      totalCommandsProcessed: 0,
      instantaneousOpsPerSec: 0,
      usedMemory: 0,
      usedMemoryPeak: 0,
      connectedClients: 0,
      evictedKeys: 0,
      expiredKeys: 0,
    };
  }

  private parseTimeRange(timeRange: string): { startTime: number; endTime: number } {
    const endTime = Date.now();
    let startTime: number;

    switch (timeRange) {
      case '5m':
        startTime = endTime - 5 * 60 * 1000;
        break;
      case '15m':
        startTime = endTime - 15 * 60 * 1000;
        break;
      case '1h':
        startTime = endTime - 60 * 60 * 1000;
        break;
      case '6h':
        startTime = endTime - 6 * 60 * 60 * 1000;
        break;
      case '24h':
        startTime = endTime - 24 * 60 * 60 * 1000;
        break;
      case '7d':
        startTime = endTime - 7 * 24 * 60 * 60 * 1000;
        break;
      default:
        startTime = endTime - 60 * 60 * 1000; // Default to 1 hour
    }

    return { startTime, endTime };
  }

  private calculateSummary(metrics: CacheMetricsSnapshot[]): CacheMetricsAggregation['summary'] {
    if (metrics.length === 0) {
      return {
        totalOperations: 0,
        avgHitRate: 0,
        avgResponseTime: 0,
        totalErrors: 0,
        errorRate: 0,
        peakMemoryUsage: 0,
        peakOperationsPerSecond: 0,
      };
    }

    const totalOperations = metrics.reduce((sum, m) => sum + m.distributedCache.totalOperations, 0);
    const avgHitRate = metrics.reduce((sum, m) => sum + m.memoryCache.hitRate, 0) / metrics.length;
    const avgResponseTime = metrics.reduce((sum, m) => sum + m.memoryCache.avgResponseTime, 0) / metrics.length;
    const totalErrors = metrics.reduce((sum, m) => sum + m.distributedCache.failedOperations, 0);
    const errorRate = totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0;
    const peakMemoryUsage = Math.max(...metrics.map(m => m.redis.usedMemory));
    const peakOperationsPerSecond = Math.max(...metrics.map(m => m.redis.instantaneousOpsPerSec));

    return {
      totalOperations,
      avgHitRate,
      avgResponseTime,
      totalErrors,
      errorRate,
      peakMemoryUsage,
      peakOperationsPerSecond,
    };
  }

  private calculateTrends(metrics: CacheMetricsSnapshot[], timeRange: string): CacheMetricsTrend[] {
    const keyMetrics = [
      'memoryCache.hitRate',
      'memoryCache.avgResponseTime',
      'redis.memoryUsage',
      'distributedCache.avgResponseTime',
      'sessionCache.activeSessions',
      'contentCache.hitRate'
    ];

    return keyMetrics.map(metric => this.calculateTrendForMetric(metrics, metric, timeRange));
  }

  private calculateTrendForMetric(
    metrics: CacheMetricsSnapshot[],
    metricPath: string,
    timeRange: string
  ): CacheMetricsTrend {
    const dataPoints = metrics.map(snapshot => ({
      timestamp: snapshot.timestamp,
      value: this.getMetricValue(snapshot, metricPath) || 0,
    }));

    if (dataPoints.length === 0) {
      return {
        metric: metricPath,
        timeframe: timeRange,
        dataPoints: [],
        trend: 'stable',
        changeRate: 0,
        variance: 0,
        min: 0,
        max: 0,
        avg: 0,
      };
    }

    const values = dataPoints.map(dp => dp.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    // Calculate trend direction
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const changeRate = firstAvg !== 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;

    let trend: CacheMetricsTrend['trend'] = 'stable';
    if (Math.abs(changeRate) > 5) {
      trend = changeRate > 0 ? 'increasing' : 'decreasing';
    }

    // Calculate variance
    const variance = values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / values.length;

    return {
      metric: metricPath,
      timeframe: timeRange,
      dataPoints,
      trend,
      changeRate,
      variance,
      min,
      max,
      avg,
    };
  }

  private getMetricValue(snapshot: CacheMetricsSnapshot, path: string): number | undefined {
    const parts = path.split('.');
    let current: any = snapshot;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }
    
    return typeof current === 'number' ? current : undefined;
  }

  private async checkAlerts(): Promise<void> {
    const latest = this.snapshots[this.snapshots.length - 1];
    if (!latest) return;

    const alertChecks = [
      this.checkHitRateAlert(latest),
      this.checkResponseTimeAlert(latest),
      this.checkMemoryUsageAlert(latest),
      this.checkErrorRateAlert(latest),
      this.checkConnectionAlert(latest),
    ];

    for (const check of alertChecks) {
      if (check) {
        this.alerts.set(check.id, check);
      }
    }

    // Auto-resolve alerts that are no longer triggered
    this.autoResolveAlerts(latest);
  }

  private checkHitRateAlert(snapshot: CacheMetricsSnapshot): CachePerformanceAlert | null {
    const hitRate = snapshot.memoryCache.hitRate;
    const alertId = 'hit_rate_low';

    if (hitRate < 70) {
      return {
        id: alertId,
        type: 'performance',
        severity: hitRate < 50 ? 'critical' : 'medium',
        title: 'Low Cache Hit Rate',
        description: `Cache hit rate is ${hitRate.toFixed(2)}%, which is below the recommended threshold of 70%`,
        metric: 'memoryCache.hitRate',
        threshold: 70,
        currentValue: hitRate,
        timestamp: snapshot.timestamp,
        resolved: false,
        autoResolved: false,
      };
    }

    return null;
  }

  private checkResponseTimeAlert(snapshot: CacheMetricsSnapshot): CachePerformanceAlert | null {
    const responseTime = snapshot.memoryCache.avgResponseTime;
    const alertId = 'response_time_high';

    if (responseTime > 100) {
      return {
        id: alertId,
        type: 'performance',
        severity: responseTime > 500 ? 'critical' : 'medium',
        title: 'High Cache Response Time',
        description: `Cache response time is ${responseTime.toFixed(2)}ms, which is above the recommended threshold of 100ms`,
        metric: 'memoryCache.avgResponseTime',
        threshold: 100,
        currentValue: responseTime,
        timestamp: snapshot.timestamp,
        resolved: false,
        autoResolved: false,
      };
    }

    return null;
  }

  private checkMemoryUsageAlert(snapshot: CacheMetricsSnapshot): CachePerformanceAlert | null {
    const memoryUsage = snapshot.redis.usedMemory;
    const maxMemory = 1024 * 1024 * 1024; // 1GB example threshold
    const usagePercent = (memoryUsage / maxMemory) * 100;
    const alertId = 'memory_usage_high';

    if (usagePercent > 80) {
      return {
        id: alertId,
        type: 'capacity',
        severity: usagePercent > 95 ? 'critical' : 'medium',
        title: 'High Memory Usage',
        description: `Redis memory usage is ${usagePercent.toFixed(2)}%, which is above the recommended threshold of 80%`,
        metric: 'redis.usedMemory',
        threshold: 80,
        currentValue: usagePercent,
        timestamp: snapshot.timestamp,
        resolved: false,
        autoResolved: false,
      };
    }

    return null;
  }

  private checkErrorRateAlert(snapshot: CacheMetricsSnapshot): CachePerformanceAlert | null {
    const totalOps = snapshot.distributedCache.totalOperations;
    const failedOps = snapshot.distributedCache.failedOperations;
    const errorRate = totalOps > 0 ? (failedOps / totalOps) * 100 : 0;
    const alertId = 'error_rate_high';

    if (errorRate > 5) {
      return {
        id: alertId,
        type: 'error',
        severity: errorRate > 15 ? 'critical' : 'medium',
        title: 'High Error Rate',
        description: `Cache error rate is ${errorRate.toFixed(2)}%, which is above the recommended threshold of 5%`,
        metric: 'distributedCache.errorRate',
        threshold: 5,
        currentValue: errorRate,
        timestamp: snapshot.timestamp,
        resolved: false,
        autoResolved: false,
      };
    }

    return null;
  }

  private checkConnectionAlert(snapshot: CacheMetricsSnapshot): CachePerformanceAlert | null {
    const connections = snapshot.redis.connectedClients;
    const maxConnections = 100; // Example threshold
    const alertId = 'connections_high';

    if (connections > maxConnections * 0.8) {
      return {
        id: alertId,
        type: 'capacity',
        severity: connections > maxConnections * 0.95 ? 'critical' : 'medium',
        title: 'High Connection Count',
        description: `Redis connection count is ${connections}, which is approaching the limit of ${maxConnections}`,
        metric: 'redis.connectedClients',
        threshold: maxConnections * 0.8,
        currentValue: connections,
        timestamp: snapshot.timestamp,
        resolved: false,
        autoResolved: false,
      };
    }

    return null;
  }

  private autoResolveAlerts(snapshot: CacheMetricsSnapshot): void {
    for (const alert of this.alerts.values()) {
      if (alert.resolved) continue;

      let shouldResolve = false;

      switch (alert.id) {
        case 'hit_rate_low':
          shouldResolve = snapshot.memoryCache.hitRate >= alert.threshold;
          break;
        case 'response_time_high':
          shouldResolve = snapshot.memoryCache.avgResponseTime <= alert.threshold;
          break;
        case 'memory_usage_high':
          const usagePercent = (snapshot.redis.usedMemory / (1024 * 1024 * 1024)) * 100;
          shouldResolve = usagePercent <= alert.threshold;
          break;
        case 'error_rate_high':
          const totalOps = snapshot.distributedCache.totalOperations;
          const failedOps = snapshot.distributedCache.failedOperations;
          const errorRate = totalOps > 0 ? (failedOps / totalOps) * 100 : 0;
          shouldResolve = errorRate <= alert.threshold;
          break;
        case 'connections_high':
          shouldResolve = snapshot.redis.connectedClients <= alert.threshold;
          break;
      }

      if (shouldResolve) {
        alert.resolved = true;
        alert.resolvedAt = snapshot.timestamp;
        alert.autoResolved = true;
      }
    }
  }

  private generateRecommendations(
    summary: CacheMetricsAggregation['summary'],
    trends: CacheMetricsTrend[],
    alerts: CachePerformanceAlert[]
  ): CacheRecommendation[] {
    const recommendations: CacheRecommendation[] = [];

    // Hit rate optimization
    if (summary.avgHitRate < 80) {
      recommendations.push({
        type: 'optimization',
        priority: 'high',
        title: 'Improve Cache Hit Rate',
        description: 'Cache hit rate is below optimal threshold. Consider adjusting TTL values or cache warming strategies.',
        impact: 'Reduce response times and database load',
        implementation: 'Review cache warming patterns and increase TTL for frequently accessed data',
        estimatedSavings: {
          responseTime: 30,
          operationalCost: 15,
        },
      });
    }

    // Response time optimization
    if (summary.avgResponseTime > 50) {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        title: 'Optimize Cache Response Time',
        description: 'Cache response times can be improved through compression and connection optimization.',
        impact: 'Faster application response times',
        implementation: 'Enable compression for large values and optimize Redis connection pooling',
        estimatedSavings: {
          responseTime: 25,
        },
      });
    }

    // Memory optimization
    if (summary.peakMemoryUsage > 800 * 1024 * 1024) { // 800MB
      recommendations.push({
        type: 'scaling',
        priority: 'medium',
        title: 'Consider Memory Scaling',
        description: 'Memory usage is approaching limits. Consider scaling Redis instances.',
        impact: 'Prevent memory-related performance issues',
        implementation: 'Add Redis replicas or increase memory allocation',
        estimatedSavings: {
          memoryUsage: 40,
        },
      });
    }

    // Error rate improvement
    if (summary.errorRate > 2) {
      recommendations.push({
        type: 'maintenance',
        priority: 'high',
        title: 'Investigate Error Sources',
        description: 'High error rate indicates potential connectivity or configuration issues.',
        impact: 'Improve system reliability and user experience',
        implementation: 'Review error logs and check Redis connectivity and configuration',
      });
    }

    return recommendations;
  }

  private calculateHealthScore(
    snapshot: CacheMetricsSnapshot | null,
    alerts: CachePerformanceAlert[]
  ): number {
    if (!snapshot) return 50;

    let score = 100;

    // Deduct points for low hit rate
    if (snapshot.memoryCache.hitRate < 90) {
      score -= (90 - snapshot.memoryCache.hitRate) * 0.5;
    }

    // Deduct points for high response time
    if (snapshot.memoryCache.avgResponseTime > 10) {
      score -= Math.min((snapshot.memoryCache.avgResponseTime - 10) * 0.1, 20);
    }

    // Deduct points for high memory usage
    const memoryUsagePercent = (snapshot.redis.usedMemory / (1024 * 1024 * 1024)) * 100;
    if (memoryUsagePercent > 50) {
      score -= (memoryUsagePercent - 50) * 0.3;
    }

    // Deduct points for alerts
    for (const alert of alerts) {
      switch (alert.severity) {
        case 'critical':
          score -= 15;
          break;
        case 'high':
          score -= 10;
          break;
        case 'medium':
          score -= 5;
          break;
        case 'low':
          score -= 2;
          break;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  private getEmptyAggregation(timeRange: string, granularity: string): CacheMetricsAggregation {
    return {
      timeRange,
      granularity,
      summary: {
        totalOperations: 0,
        avgHitRate: 0,
        avgResponseTime: 0,
        totalErrors: 0,
        errorRate: 0,
        peakMemoryUsage: 0,
        peakOperationsPerSecond: 0,
      },
      trends: [],
      alerts: [],
      recommendations: [],
    };
  }

  /**
   * Shutdown the metrics collector
   */
  public shutdown(): void {
    this.stopCollection();
    console.log('✅ Cache metrics collector shutdown complete');
  }
}

// ====================
// SINGLETON INSTANCE
// ====================

export const cacheMetricsCollector = CacheMetricsCollector.getInstance();

// ====================
// CONVENIENCE FUNCTIONS
// ====================

/**
 * Get current cache metrics
 */
export async function getCurrentCacheMetrics(): Promise<CacheMetricsSnapshot> {
  return cacheMetricsCollector.collectSnapshot();
}

/**
 * Get cache metrics dashboard data
 */
export function getCacheMetricsDashboard() {
  return cacheMetricsCollector.getDashboardData();
}

/**
 * Get cache performance trends
 */
export function getCachePerformanceTrends(timeRange: string = '1h'): CacheMetricsTrend[] {
  return cacheMetricsCollector.getTrends([
    'memoryCache.hitRate',
    'memoryCache.avgResponseTime',
    'redis.memoryUsage',
    'distributedCache.avgResponseTime'
  ], timeRange);
}

/**
 * Get cache performance alerts
 */
export function getCachePerformanceAlerts(): CachePerformanceAlert[] {
  return cacheMetricsCollector.getActiveAlerts();
}

export default cacheMetricsCollector;