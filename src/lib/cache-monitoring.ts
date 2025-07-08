import { cacheManager, CacheStats } from './cache';
import { sessionCache, SessionStats } from './session-cache';
import { contentCache, ContentCacheStats } from './content-cache';
import { getRedisMetrics, CacheMetrics } from './redis-client';
import { getWarmupMetrics, WarmupMetrics } from './cache-warming';
import { getInvalidationMetrics, InvalidationMetrics } from './cache-invalidation';
import { env } from './env-validation';

// ====================
// TYPES AND INTERFACES
// ====================

export interface CacheMonitoringConfig {
  enabled: boolean;
  metricsRetention: number;
  alertThresholds: AlertThresholds;
  reportingInterval: number;
  healthCheckInterval: number;
  performanceTrackingEnabled: boolean;
  detailedLoggingEnabled: boolean;
}

export interface AlertThresholds {
  hitRate: { warning: number; critical: number };
  responseTime: { warning: number; critical: number };
  errorRate: { warning: number; critical: number };
  memoryUsage: { warning: number; critical: number };
  connectionCount: { warning: number; critical: number };
  queueLength: { warning: number; critical: number };
}

export interface CacheAlert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  category: 'performance' | 'availability' | 'capacity' | 'error';
  title: string;
  description: string;
  metric: string;
  threshold: number;
  currentValue: number;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
  severity: number;
  source: string;
}

export interface PerformanceMetric {
  timestamp: number;
  operation: string;
  duration: number;
  success: boolean;
  cacheHit: boolean;
  keySize: number;
  valueSize: number;
  namespace: string;
  source: string;
}

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    redis: ComponentHealth;
    memoryCache: ComponentHealth;
    sessionCache: ComponentHealth;
    contentCache: ComponentHealth;
    warming: ComponentHealth;
    invalidation: ComponentHealth;
  };
  lastChecked: number;
  uptime: number;
  totalRequests: number;
  errorCount: number;
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  errorRate: number;
  availability: number;
  lastError?: string;
  lastErrorTime?: number;
  metrics: { [key: string]: number };
}

export interface CacheReport {
  period: { start: number; end: number };
  summary: {
    totalRequests: number;
    cacheHits: number;
    cacheMisses: number;
    hitRate: number;
    avgResponseTime: number;
    errorsCount: number;
    errorRate: number;
  };
  performance: {
    operations: { [operation: string]: OperationStats };
    trends: TrendAnalysis[];
    bottlenecks: Bottleneck[];
  };
  capacity: {
    memoryUsage: number;
    keyCount: number;
    avgKeySize: number;
    avgValueSize: number;
    compressionRatio: number;
  };
  recommendations: Recommendation[];
}

export interface OperationStats {
  count: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
  cacheHitRate: number;
}

export interface TrendAnalysis {
  metric: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  magnitude: number;
  confidence: number;
  timeframe: string;
}

export interface Bottleneck {
  component: string;
  metric: string;
  impact: 'high' | 'medium' | 'low';
  description: string;
  suggestedAction: string;
}

export interface Recommendation {
  type: 'optimization' | 'configuration' | 'scaling' | 'maintenance';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  expectedImpact: string;
  implementation: string;
}

// ====================
// CACHE MONITORING MANAGER
// ====================

export class CacheMonitoringManager {
  private static instance: CacheMonitoringManager;
  private config: CacheMonitoringConfig;
  private alerts: Map<string, CacheAlert> = new Map();
  private performanceMetrics: PerformanceMetric[] = [];
  private healthHistory: HealthStatus[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertCheckInterval: NodeJS.Timeout | null = null;
  private reportingInterval: NodeJS.Timeout | null = null;
  private startTime: number = Date.now();

  private constructor() {
    this.config = {
      enabled: env.CACHE_METRICS_ENABLED,
      metricsRetention: 7 * 24 * 60 * 60 * 1000, // 7 days
      alertThresholds: {
        hitRate: { warning: 80, critical: 60 },
        responseTime: { warning: 100, critical: 500 },
        errorRate: { warning: 5, critical: 15 },
        memoryUsage: { warning: 80, critical: 95 },
        connectionCount: { warning: 80, critical: 95 },
        queueLength: { warning: 100, critical: 500 },
      },
      reportingInterval: 60000, // 1 minute
      healthCheckInterval: 30000, // 30 seconds
      performanceTrackingEnabled: true,
      detailedLoggingEnabled: false,
    };
    
    if (this.config.enabled) {
      this.startMonitoring();
    }
  }

  public static getInstance(): CacheMonitoringManager {
    if (!CacheMonitoringManager.instance) {
      CacheMonitoringManager.instance = new CacheMonitoringManager();
    }
    return CacheMonitoringManager.instance;
  }

  /**
   * Start monitoring services
   */
  public startMonitoring(): void {
    if (!this.config.enabled) {
      console.log('📊 Cache monitoring is disabled');
      return;
    }

    console.log('📊 Starting cache monitoring...');

    // Start health checks
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);

    // Start alert checks
    this.alertCheckInterval = setInterval(() => {
      this.checkAlerts();
    }, this.config.reportingInterval);

    // Start reporting
    this.reportingInterval = setInterval(() => {
      this.generatePeriodicReport();
    }, this.config.reportingInterval * 5); // Every 5 minutes

    console.log('✅ Cache monitoring started');
  }

  /**
   * Record a performance metric
   */
  public recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    if (!this.config.performanceTrackingEnabled) return;

    const performanceMetric: PerformanceMetric = {
      ...metric,
      timestamp: Date.now(),
    };

    this.performanceMetrics.push(performanceMetric);

    // Keep only recent metrics
    const cutoff = Date.now() - this.config.metricsRetention;
    this.performanceMetrics = this.performanceMetrics.filter(m => m.timestamp > cutoff);

    if (this.config.detailedLoggingEnabled) {
      console.log(`📈 Recorded metric: ${metric.operation} - ${metric.duration}ms (${metric.success ? 'success' : 'failure'})`);
    }
  }

  /**
   * Get current health status
   */
  public async getHealthStatus(): Promise<HealthStatus> {
    const redisMetrics = getRedisMetrics();
    const memoryStats = cacheManager.getStats();
    const sessionStats = await sessionCache.getSessionStats();
    const contentStats = await contentCache.getContentStats();
    const warmupMetrics = getWarmupMetrics();
    const invalidationMetrics = getInvalidationMetrics();

    const components = {
      redis: await this.checkRedisHealth(redisMetrics),
      memoryCache: this.checkMemoryCacheHealth(memoryStats),
      sessionCache: this.checkSessionCacheHealth(sessionStats),
      contentCache: this.checkContentCacheHealth(contentStats),
      warming: this.checkWarmupHealth(warmupMetrics),
      invalidation: this.checkInvalidationHealth(invalidationMetrics),
    };

    const overall = this.calculateOverallHealth(components);
    const uptime = Date.now() - this.startTime;
    const totalRequests = this.performanceMetrics.length;
    const errorCount = this.performanceMetrics.filter(m => !m.success).length;

    const healthStatus: HealthStatus = {
      overall,
      components,
      lastChecked: Date.now(),
      uptime,
      totalRequests,
      errorCount,
    };

    return healthStatus;
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): CacheAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Get all alerts
   */
  public getAllAlerts(limit: number = 100): CacheAlert[] {
    return Array.from(this.alerts.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Acknowledge an alert
   */
  public acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = Date.now();
      console.log(`✅ Alert acknowledged: ${alert.title} by ${acknowledgedBy}`);
      return true;
    }
    return false;
  }

  /**
   * Resolve an alert
   */
  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      console.log(`✅ Alert resolved: ${alert.title}`);
      return true;
    }
    return false;
  }

  /**
   * Generate comprehensive cache report
   */
  public generateReport(
    startTime: number = Date.now() - 60 * 60 * 1000, // Last hour
    endTime: number = Date.now()
  ): CacheReport {
    const metrics = this.performanceMetrics.filter(
      m => m.timestamp >= startTime && m.timestamp <= endTime
    );

    const summary = this.calculateSummaryStats(metrics);
    const performance = this.analyzePerformance(metrics);
    const capacity = this.analyzeCapacity();
    const recommendations = this.generateRecommendations(summary, performance, capacity);

    return {
      period: { start: startTime, end: endTime },
      summary,
      performance,
      capacity,
      recommendations,
    };
  }

  /**
   * Get performance trends
   */
  public getPerformanceTrends(
    metric: string,
    timeframe: number = 60 * 60 * 1000 // Last hour
  ): TrendAnalysis {
    const cutoff = Date.now() - timeframe;
    const relevantMetrics = this.performanceMetrics.filter(m => m.timestamp > cutoff);
    
    if (relevantMetrics.length < 10) {
      return {
        metric,
        direction: 'stable',
        magnitude: 0,
        confidence: 0,
        timeframe: `${timeframe / 1000}s`,
      };
    }

    // Simple trend analysis
    const values = relevantMetrics.map(m => {
      switch (metric) {
        case 'duration': return m.duration;
        case 'success_rate': return m.success ? 1 : 0;
        case 'cache_hit_rate': return m.cacheHit ? 1 : 0;
        default: return 0;
      }
    });

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const change = secondAvg - firstAvg;
    const magnitude = Math.abs(change / firstAvg);

    let direction: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (magnitude > 0.05) {
      direction = change > 0 ? 'increasing' : 'decreasing';
    }

    return {
      metric,
      direction,
      magnitude,
      confidence: Math.min(values.length / 50, 1), // Higher confidence with more data
      timeframe: `${timeframe / 1000}s`,
    };
  }

  // ====================
  // PRIVATE METHODS
  // ====================

  private async performHealthCheck(): Promise<void> {
    try {
      const healthStatus = await this.getHealthStatus();
      this.healthHistory.push(healthStatus);

      // Keep only recent health history
      const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
      this.healthHistory = this.healthHistory.filter(h => h.lastChecked > cutoff);

      if (this.config.detailedLoggingEnabled) {
        console.log(`💓 Health check: ${healthStatus.overall} (${Object.values(healthStatus.components).filter(c => c.status === 'healthy').length}/6 components healthy)`);
      }
    } catch (error) {
      console.error('❌ Health check failed:', error);
    }
  }

  private async checkAlerts(): Promise<void> {
    try {
      const healthStatus = await this.getHealthStatus();
      const memoryStats = cacheManager.getStats();
      const redisMetrics = getRedisMetrics();

      // Check hit rate
      if (memoryStats.hitRate < this.config.alertThresholds.hitRate.critical) {
        this.createAlert('critical', 'performance', 'Low Cache Hit Rate', 
          `Cache hit rate is critically low at ${memoryStats.hitRate.toFixed(2)}%`,
          'hit_rate', this.config.alertThresholds.hitRate.critical, memoryStats.hitRate, 'cache');
      } else if (memoryStats.hitRate < this.config.alertThresholds.hitRate.warning) {
        this.createAlert('warning', 'performance', 'Declining Cache Hit Rate',
          `Cache hit rate is below warning threshold at ${memoryStats.hitRate.toFixed(2)}%`,
          'hit_rate', this.config.alertThresholds.hitRate.warning, memoryStats.hitRate, 'cache');
      }

      // Check response time
      if (memoryStats.avgResponseTime > this.config.alertThresholds.responseTime.critical) {
        this.createAlert('critical', 'performance', 'High Response Time',
          `Average response time is critically high at ${memoryStats.avgResponseTime.toFixed(2)}ms`,
          'response_time', this.config.alertThresholds.responseTime.critical, memoryStats.avgResponseTime, 'cache');
      }

      // Check error rate
      const errorRate = healthStatus.errorCount > 0 ? 
        (healthStatus.errorCount / healthStatus.totalRequests) * 100 : 0;
      
      if (errorRate > this.config.alertThresholds.errorRate.critical) {
        this.createAlert('critical', 'error', 'High Error Rate',
          `Error rate is critically high at ${errorRate.toFixed(2)}%`,
          'error_rate', this.config.alertThresholds.errorRate.critical, errorRate, 'cache');
      }

      // Check memory usage
      const memoryUsagePercent = (memoryStats.memoryUsage / (1024 * 1024 * 1024)) * 100; // Convert to GB percentage
      if (memoryUsagePercent > this.config.alertThresholds.memoryUsage.critical) {
        this.createAlert('critical', 'capacity', 'High Memory Usage',
          `Memory usage is critically high at ${memoryUsagePercent.toFixed(2)}%`,
          'memory_usage', this.config.alertThresholds.memoryUsage.critical, memoryUsagePercent, 'cache');
      }

    } catch (error) {
      console.error('❌ Alert check failed:', error);
    }
  }

  private createAlert(
    type: CacheAlert['type'],
    category: CacheAlert['category'],
    title: string,
    description: string,
    metric: string,
    threshold: number,
    currentValue: number,
    source: string
  ): void {
    const alertId = `${metric}_${type}_${Date.now()}`;
    
    // Check if similar alert already exists
    const existingAlert = Array.from(this.alerts.values()).find(
      alert => alert.metric === metric && alert.type === type && !alert.resolved
    );

    if (existingAlert) {
      // Update existing alert
      existingAlert.currentValue = currentValue;
      existingAlert.timestamp = Date.now();
      return;
    }

    const alert: CacheAlert = {
      id: alertId,
      type,
      category,
      title,
      description,
      metric,
      threshold,
      currentValue,
      timestamp: Date.now(),
      resolved: false,
      severity: type === 'critical' ? 1 : type === 'warning' ? 2 : 3,
      source,
    };

    this.alerts.set(alertId, alert);
    console.log(`🚨 Alert created: ${type.toUpperCase()} - ${title}`);

    // Auto-resolve opposite condition alerts
    this.autoResolveAlerts(metric, currentValue, threshold);
  }

  private autoResolveAlerts(metric: string, currentValue: number, threshold: number): void {
    for (const alert of this.alerts.values()) {
      if (alert.metric === metric && !alert.resolved) {
        // Check if the condition that triggered the alert is no longer true
        const shouldResolve = 
          (alert.type === 'critical' && currentValue < threshold) ||
          (alert.type === 'warning' && currentValue < threshold);
        
        if (shouldResolve) {
          this.resolveAlert(alert.id);
        }
      }
    }
  }

  private async checkRedisHealth(metrics: CacheMetrics): Promise<ComponentHealth> {
    try {
      const latency = metrics.avgResponseTime || 0;
      const errorRate = metrics.errors > 0 ? (metrics.errors / (metrics.hits + metrics.misses + metrics.errors)) * 100 : 0;
      const availability = metrics.connectionCount > 0 ? 100 : 0;

      let status: ComponentHealth['status'] = 'healthy';
      if (latency > 100 || errorRate > 10 || availability < 100) {
        status = 'degraded';
      }
      if (latency > 500 || errorRate > 25 || availability < 50) {
        status = 'unhealthy';
      }

      return {
        status,
        latency,
        errorRate,
        availability,
        metrics: {
          connections: metrics.connectionCount,
          memory: metrics.usedMemory,
          hits: metrics.hits,
          misses: metrics.misses,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: 0,
        errorRate: 100,
        availability: 0,
        lastError: (error as Error).message,
        lastErrorTime: Date.now(),
        metrics: {},
      };
    }
  }

  private checkMemoryCacheHealth(stats: CacheStats): ComponentHealth {
    const errorRate = stats.hits + stats.misses > 0 ? 
      (stats.errors / (stats.hits + stats.misses + stats.errors)) * 100 : 0;
    
    let status: ComponentHealth['status'] = 'healthy';
    if (stats.hitRate < 80 || errorRate > 5) {
      status = 'degraded';
    }
    if (stats.hitRate < 60 || errorRate > 15) {
      status = 'unhealthy';
    }

    return {
      status,
      latency: stats.avgResponseTime,
      errorRate,
      availability: 100, // Memory cache is always available
      metrics: {
        hitRate: stats.hitRate,
        totalKeys: stats.totalKeys,
        totalSize: stats.totalSize,
        memoryUsage: stats.memoryUsage,
      },
    };
  }

  private checkSessionCacheHealth(stats: SessionStats): ComponentHealth {
    let status: ComponentHealth['status'] = 'healthy';
    
    // Check if there are too many expired sessions
    const expiredRatio = stats.totalSessions > 0 ? stats.expiredSessions / stats.totalSessions : 0;
    if (expiredRatio > 0.5) {
      status = 'degraded';
    }
    if (expiredRatio > 0.8) {
      status = 'unhealthy';
    }

    return {
      status,
      latency: 0, // Sessions don't have direct latency metrics
      errorRate: 0,
      availability: 100,
      metrics: {
        activeSessions: stats.activeSessions,
        totalSessions: stats.totalSessions,
        expiredSessions: stats.expiredSessions,
        avgDuration: stats.averageSessionDuration,
      },
    };
  }

  private checkContentCacheHealth(stats: ContentCacheStats): ComponentHealth {
    let status: ComponentHealth['status'] = 'healthy';
    
    if (stats.hitRate < 70 || stats.ineffectiveContent.length > 10) {
      status = 'degraded';
    }
    if (stats.hitRate < 50 || stats.ineffectiveContent.length > 25) {
      status = 'unhealthy';
    }

    return {
      status,
      latency: stats.avgAdaptationTime,
      errorRate: 0,
      availability: 100,
      metrics: {
        cachedContent: stats.cachedContent,
        adaptations: stats.adaptations,
        hitRate: stats.hitRate,
        effectiveness: stats.ineffectiveContent.length,
      },
    };
  }

  private checkWarmupHealth(metrics: WarmupMetrics): ComponentHealth {
    let status: ComponentHealth['status'] = 'healthy';
    
    if (metrics.successRate < 80) {
      status = 'degraded';
    }
    if (metrics.successRate < 60) {
      status = 'unhealthy';
    }

    return {
      status,
      latency: metrics.averageDuration,
      errorRate: 100 - metrics.successRate,
      availability: 100,
      metrics: {
        successRate: metrics.successRate,
        totalExecutions: metrics.totalExecutions,
        keysWarmed: metrics.totalKeysWarmed,
        avgDuration: metrics.averageDuration,
      },
    };
  }

  private checkInvalidationHealth(metrics: InvalidationMetrics): ComponentHealth {
    let status: ComponentHealth['status'] = 'healthy';
    
    if (metrics.successRate < 90) {
      status = 'degraded';
    }
    if (metrics.successRate < 75) {
      status = 'unhealthy';
    }

    return {
      status,
      latency: metrics.averageDuration,
      errorRate: 100 - metrics.successRate,
      availability: 100,
      metrics: {
        successRate: metrics.successRate,
        totalExecutions: metrics.totalExecutions,
        keysInvalidated: metrics.totalKeysInvalidated,
        avgDuration: metrics.averageDuration,
      },
    };
  }

  private calculateOverallHealth(components: HealthStatus['components']): HealthStatus['overall'] {
    const componentStatuses = Object.values(components);
    const unhealthyCount = componentStatuses.filter(c => c.status === 'unhealthy').length;
    const degradedCount = componentStatuses.filter(c => c.status === 'degraded').length;

    if (unhealthyCount > 0) {
      return 'unhealthy';
    }
    if (degradedCount > 1) {
      return 'degraded';
    }
    return 'healthy';
  }

  private calculateSummaryStats(metrics: PerformanceMetric[]): CacheReport['summary'] {
    const totalRequests = metrics.length;
    const successfulRequests = metrics.filter(m => m.success).length;
    const cacheHits = metrics.filter(m => m.cacheHit).length;
    const cacheMisses = totalRequests - cacheHits;
    
    return {
      totalRequests,
      cacheHits,
      cacheMisses,
      hitRate: totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0,
      avgResponseTime: totalRequests > 0 ? 
        metrics.reduce((sum, m) => sum + m.duration, 0) / totalRequests : 0,
      errorsCount: totalRequests - successfulRequests,
      errorRate: totalRequests > 0 ? ((totalRequests - successfulRequests) / totalRequests) * 100 : 0,
    };
  }

  private analyzePerformance(metrics: PerformanceMetric[]): CacheReport['performance'] {
    const operations = this.analyzeOperations(metrics);
    const trends = this.analyzeTrends();
    const bottlenecks = this.identifyBottlenecks();

    return { operations, trends, bottlenecks };
  }

  private analyzeOperations(metrics: PerformanceMetric[]): { [operation: string]: OperationStats } {
    const operationGroups = metrics.reduce((groups, metric) => {
      if (!groups[metric.operation]) {
        groups[metric.operation] = [];
      }
      groups[metric.operation].push(metric);
      return groups;
    }, {} as { [operation: string]: PerformanceMetric[] });

    const operations: { [operation: string]: OperationStats } = {};

    for (const [operation, operationMetrics] of Object.entries(operationGroups)) {
      const count = operationMetrics.length;
      const durations = operationMetrics.map(m => m.duration);
      const successCount = operationMetrics.filter(m => m.success).length;
      const cacheHitCount = operationMetrics.filter(m => m.cacheHit).length;

      operations[operation] = {
        count,
        avgDuration: durations.reduce((a, b) => a + b, 0) / count,
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        successRate: (successCount / count) * 100,
        cacheHitRate: (cacheHitCount / count) * 100,
      };
    }

    return operations;
  }

  private analyzeTrends(): TrendAnalysis[] {
    return [
      this.getPerformanceTrends('duration'),
      this.getPerformanceTrends('success_rate'),
      this.getPerformanceTrends('cache_hit_rate'),
    ];
  }

  private identifyBottlenecks(): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    const memoryStats = cacheManager.getStats();

    if (memoryStats.hitRate < 70) {
      bottlenecks.push({
        component: 'cache',
        metric: 'hit_rate',
        impact: 'high',
        description: 'Low cache hit rate is causing performance degradation',
        suggestedAction: 'Review cache warming strategies and TTL settings',
      });
    }

    if (memoryStats.avgResponseTime > 100) {
      bottlenecks.push({
        component: 'cache',
        metric: 'response_time',
        impact: 'medium',
        description: 'High cache response times detected',
        suggestedAction: 'Check Redis connection and optimize queries',
      });
    }

    return bottlenecks;
  }

  private analyzeCapacity(): CacheReport['capacity'] {
    const memoryStats = cacheManager.getStats();
    
    return {
      memoryUsage: memoryStats.memoryUsage,
      keyCount: memoryStats.totalKeys,
      avgKeySize: memoryStats.totalKeys > 0 ? memoryStats.totalSize / memoryStats.totalKeys : 0,
      avgValueSize: 0, // Would need to track this separately
      compressionRatio: 0.3, // Estimated
    };
  }

  private generateRecommendations(
    summary: CacheReport['summary'],
    performance: CacheReport['performance'],
    capacity: CacheReport['capacity']
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    if (summary.hitRate < 80) {
      recommendations.push({
        type: 'optimization',
        priority: 'high',
        title: 'Improve Cache Hit Rate',
        description: 'Cache hit rate is below optimal threshold',
        expectedImpact: 'Improved response times and reduced backend load',
        implementation: 'Review cache warming strategies and adjust TTL values',
      });
    }

    if (summary.avgResponseTime > 50) {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        title: 'Optimize Cache Response Time',
        description: 'Cache response times can be improved',
        expectedImpact: 'Faster application response times',
        implementation: 'Enable compression for large values and optimize serialization',
      });
    }

    return recommendations;
  }

  private generatePeriodicReport(): void {
    if (!this.config.detailedLoggingEnabled) return;

    try {
      const report = this.generateReport();
      console.log(`📊 Cache Report - Hit Rate: ${report.summary.hitRate.toFixed(2)}%, Avg Response: ${report.summary.avgResponseTime.toFixed(2)}ms, Errors: ${report.summary.errorRate.toFixed(2)}%`);
    } catch (error) {
      console.error('❌ Failed to generate periodic report:', error);
    }
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
    }
    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
    }
    console.log('🛑 Cache monitoring stopped');
  }

  /**
   * Shutdown monitoring
   */
  public shutdown(): void {
    this.stopMonitoring();
    console.log('✅ Cache monitoring manager shutdown complete');
  }
}

// ====================
// SINGLETON INSTANCE
// ====================

export const cacheMonitoring = CacheMonitoringManager.getInstance();

// ====================
// CONVENIENCE FUNCTIONS
// ====================

/**
 * Record a performance metric
 */
export function recordCacheMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void {
  return cacheMonitoring.recordMetric(metric);
}

/**
 * Get cache health status
 */
export async function getCacheHealth(): Promise<HealthStatus> {
  return cacheMonitoring.getHealthStatus();
}

/**
 * Get active alerts
 */
export function getActiveAlerts(): CacheAlert[] {
  return cacheMonitoring.getActiveAlerts();
}

/**
 * Generate cache report
 */
export function generateCacheReport(startTime?: number, endTime?: number): CacheReport {
  return cacheMonitoring.generateReport(startTime, endTime);
}

/**
 * Start monitoring
 */
export function startCacheMonitoring(): void {
  return cacheMonitoring.startMonitoring();
}

/**
 * Stop monitoring
 */
export function stopCacheMonitoring(): void {
  return cacheMonitoring.stopMonitoring();
}

export default cacheMonitoring;