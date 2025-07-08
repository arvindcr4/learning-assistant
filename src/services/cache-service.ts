import { cacheManager, CacheStats } from '@/lib/cache';
import { sessionCache, SessionStats } from '@/lib/session-cache';
import { contentCache, ContentCacheStats } from '@/lib/content-cache';
import { redisManager, CacheMetrics, getRedisMetrics } from '@/lib/redis-client';
import { env } from '@/lib/env-validation';
import type { LearningProfile, AdaptiveContent, LearningSession } from '@/types';

// ====================
// TYPES AND INTERFACES
// ====================

export interface CacheServiceConfig {
  warmupEnabled: boolean;
  warmupPatterns: string[];
  monitoringEnabled: boolean;
  metricsRetention: number;
  alertThresholds: {
    hitRate: number;
    responseTime: number;
    errorRate: number;
    memoryUsage: number;
  };
  cleanupSchedule: {
    interval: number;
    maxAge: number;
    maxSize: number;
  };
  prefetchingEnabled: boolean;
  compressionEnabled: boolean;
}

export interface CacheHealthStatus {
  overall: 'healthy' | 'warning' | 'critical';
  redis: {
    status: 'connected' | 'disconnected' | 'error';
    connections: number;
    memory: number;
    hitRate: number;
    responseTime: number;
  };
  memory: {
    usage: number;
    hitRate: number;
    size: number;
    compression: number;
  };
  sessions: {
    active: number;
    total: number;
    avgDuration: number;
  };
  content: {
    cached: number;
    adaptations: number;
    effectiveness: number;
  };
  alerts: Alert[];
}

export interface Alert {
  id: string;
  type: 'warning' | 'critical';
  category: 'performance' | 'memory' | 'connection' | 'data';
  message: string;
  threshold: number;
  currentValue: number;
  timestamp: number;
  resolved: boolean;
}

export interface CacheOperation {
  type: 'get' | 'set' | 'delete' | 'invalidate' | 'warm' | 'cleanup';
  key?: string;
  pattern?: string;
  namespace?: string;
  duration: number;
  success: boolean;
  size?: number;
  timestamp: number;
}

export interface WarmupJob {
  id: string;
  name: string;
  patterns: string[];
  priority: number;
  schedule: string;
  lastRun: number;
  nextRun: number;
  enabled: boolean;
  stats: {
    runs: number;
    successes: number;
    failures: number;
    avgDuration: number;
    keysWarmed: number;
  };
}

export interface CacheStrategy {
  name: string;
  namespace: string;
  ttl: number;
  warmupPriority: number;
  invalidationRules: string[];
  compressionThreshold: number;
  prefetchRules: PrefetchRule[];
}

export interface PrefetchRule {
  trigger: 'user_action' | 'time_based' | 'popularity' | 'dependency';
  condition: any;
  patterns: string[];
  priority: number;
  maxAge: number;
}

// ====================
// CACHE SERVICE MANAGER
// ====================

export class CacheService {
  private static instance: CacheService;
  private config: CacheServiceConfig;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private warmupInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private alerts: Map<string, Alert> = new Map();
  private operations: CacheOperation[] = [];
  private warmupJobs: Map<string, WarmupJob> = new Map();
  private strategies: Map<string, CacheStrategy> = new Map();
  private isInitialized: boolean = false;

  private constructor() {
    this.config = {
      warmupEnabled: env.CACHE_WARMING_ENABLED,
      warmupPatterns: [
        'content:popular:*',
        'user:profile:*',
        'content:static:*',
        'analytics:dashboard:*',
      ],
      monitoringEnabled: env.CACHE_METRICS_ENABLED,
      metricsRetention: 7 * 24 * 60 * 60 * 1000, // 7 days
      alertThresholds: {
        hitRate: 80,
        responseTime: 100,
        errorRate: 5,
        memoryUsage: 80,
      },
      cleanupSchedule: {
        interval: 60 * 60 * 1000, // 1 hour
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        maxSize: 1000000, // 1MB
      },
      prefetchingEnabled: true,
      compressionEnabled: env.CACHE_COMPRESSION_ENABLED,
    };

    this.initializeStrategies();
    this.initializeWarmupJobs();
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Initialize the cache service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('🔄 Initializing Cache Service...');

      // Initialize Redis connection
      await redisManager.initialize();

      // Start monitoring and maintenance jobs
      if (this.config.monitoringEnabled) {
        this.startHealthMonitoring();
        this.startMetricsCollection();
      }

      this.startCleanupJobs();

      if (this.config.warmupEnabled) {
        await this.executeInitialWarmup();
        this.startWarmupScheduler();
      }

      this.isInitialized = true;
      console.log('✅ Cache Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Cache Service:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive cache health status
   */
  public async getHealthStatus(): Promise<CacheHealthStatus> {
    try {
      const redisMetrics = getRedisMetrics();
      const memoryStats = cacheManager.getStats();
      const sessionStats = await sessionCache.getSessionStats();
      const contentStats = await contentCache.getContentStats();

      const redisConnections = redisManager.getConnectionStatus();
      const redisHealthy = Object.values(redisConnections).every(conn => conn.isConnected);

      return {
        overall: this.calculateOverallHealth(redisMetrics, memoryStats),
        redis: {
          status: redisHealthy ? 'connected' : 'disconnected',
          connections: Object.keys(redisConnections).length,
          memory: redisMetrics.usedMemory,
          hitRate: redisMetrics.keyspaceHits > 0 ? 
            (redisMetrics.keyspaceHits / (redisMetrics.keyspaceHits + redisMetrics.keyspaceMisses)) * 100 : 0,
          responseTime: redisMetrics.avgResponseTime || 0,
        },
        memory: {
          usage: memoryStats.memoryUsage,
          hitRate: memoryStats.hitRate,
          size: memoryStats.totalSize,
          compression: this.calculateCompressionRatio(),
        },
        sessions: {
          active: sessionStats.activeSessions,
          total: sessionStats.totalSessions,
          avgDuration: sessionStats.averageSessionDuration,
        },
        content: {
          cached: contentStats.cachedContent,
          adaptations: contentStats.adaptations,
          effectiveness: this.calculateContentEffectiveness(contentStats),
        },
        alerts: Array.from(this.alerts.values()).filter(alert => !alert.resolved),
      };
    } catch (error) {
      console.error('❌ Failed to get health status:', error);
      return this.getEmptyHealthStatus();
    }
  }

  /**
   * Execute cache warmup for critical data
   */
  public async warmupCache(patterns?: string[]): Promise<{ success: boolean; keysWarmed: number; duration: number }> {
    const startTime = Date.now();
    let keysWarmed = 0;

    try {
      console.log('🔥 Starting cache warmup...');
      
      const warmupPatterns = patterns || this.config.warmupPatterns;
      
      for (const pattern of warmupPatterns) {
        const warmed = await this.warmupPattern(pattern);
        keysWarmed += warmed;
      }

      // Execute strategy-specific warmups
      for (const [strategyName, strategy] of this.strategies) {
        if (strategy.warmupPriority > 0) {
          console.log(`🔥 Warming up strategy: ${strategyName}`);
          const warmed = await this.warmupStrategy(strategy);
          keysWarmed += warmed;
        }
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Cache warmup completed: ${keysWarmed} keys in ${duration}ms`);

      return {
        success: true,
        keysWarmed,
        duration,
      };
    } catch (error) {
      console.error('❌ Cache warmup failed:', error);
      return {
        success: false,
        keysWarmed,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Invalidate cache strategically
   */
  public async invalidateCache(options: {
    namespace?: string;
    pattern?: string;
    tags?: string[];
    cascade?: boolean;
    strategy?: string;
  }): Promise<{ success: boolean; keysInvalidated: number }> {
    const startTime = Date.now();
    let keysInvalidated = 0;

    try {
      console.log('🗑️ Starting cache invalidation...');

      if (options.pattern) {
        keysInvalidated += await cacheManager.deleteByPattern(options.pattern);
      }

      if (options.tags) {
        keysInvalidated += await cacheManager.deleteByTags(options.tags);
      }

      if (options.namespace) {
        await cacheManager.clear(options.namespace);
        keysInvalidated += 1; // Approximate
      }

      if (options.strategy) {
        const strategy = this.strategies.get(options.strategy);
        if (strategy) {
          keysInvalidated += await this.invalidateStrategy(strategy);
        }
      }

      this.recordOperation({
        type: 'invalidate',
        pattern: options.pattern,
        namespace: options.namespace,
        duration: Date.now() - startTime,
        success: true,
        timestamp: Date.now(),
      });

      console.log(`✅ Cache invalidation completed: ${keysInvalidated} keys`);
      return { success: true, keysInvalidated };
    } catch (error) {
      console.error('❌ Cache invalidation failed:', error);
      return { success: false, keysInvalidated };
    }
  }

  /**
   * Clean up expired and stale data
   */
  public async cleanupCache(): Promise<{ 
    success: boolean; 
    itemsRemoved: number; 
    spaceFreed: number; 
  }> {
    const startTime = Date.now();
    let itemsRemoved = 0;
    let spaceFreed = 0;

    try {
      console.log('🧹 Starting cache cleanup...');

      // Clean up expired operations
      const beforeCount = this.operations.length;
      const cutoff = Date.now() - this.config.metricsRetention;
      this.operations = this.operations.filter(op => op.timestamp > cutoff);
      itemsRemoved += beforeCount - this.operations.length;

      // Clean up resolved alerts
      const beforeAlerts = this.alerts.size;
      for (const [alertId, alert] of this.alerts) {
        if (alert.resolved && (Date.now() - alert.timestamp) > (24 * 60 * 60 * 1000)) {
          this.alerts.delete(alertId);
        }
      }
      itemsRemoved += beforeAlerts - this.alerts.size;

      // Execute strategy cleanups
      for (const [strategyName, strategy] of this.strategies) {
        const cleaned = await this.cleanupStrategy(strategy);
        itemsRemoved += cleaned.items;
        spaceFreed += cleaned.space;
      }

      console.log(`✅ Cache cleanup completed: ${itemsRemoved} items removed, ${spaceFreed} bytes freed`);
      
      return {
        success: true,
        itemsRemoved,
        spaceFreed,
      };
    } catch (error) {
      console.error('❌ Cache cleanup failed:', error);
      return {
        success: false,
        itemsRemoved,
        spaceFreed,
      };
    }
  }

  /**
   * Get comprehensive cache metrics
   */
  public async getMetrics(): Promise<{
    redis: CacheMetrics;
    memory: CacheStats;
    sessions: SessionStats;
    content: ContentCacheStats;
    operations: CacheOperation[];
    alerts: Alert[];
  }> {
    return {
      redis: getRedisMetrics(),
      memory: cacheManager.getStats(),
      sessions: await sessionCache.getSessionStats(),
      content: await contentCache.getContentStats(),
      operations: this.operations.slice(-100), // Last 100 operations
      alerts: Array.from(this.alerts.values()),
    };
  }

  /**
   * Prefetch content based on user behavior
   */
  public async prefetchForUser(
    userId: string,
    learningProfile: LearningProfile,
    recentSessions: LearningSession[]
  ): Promise<{ success: boolean; itemsPrefetched: number }> {
    if (!this.config.prefetchingEnabled) {
      return { success: false, itemsPrefetched: 0 };
    }

    try {
      console.log(`🔮 Prefetching content for user ${userId}...`);
      let itemsPrefetched = 0;

      // Prefetch based on learning style
      const stylePatterns = this.getPrefetchPatternsForStyle(learningProfile.dominantStyle);
      for (const pattern of stylePatterns) {
        const prefetched = await this.prefetchPattern(pattern, userId);
        itemsPrefetched += prefetched;
      }

      // Prefetch based on recent activity
      const activityPatterns = this.getPrefetchPatternsForActivity(recentSessions);
      for (const pattern of activityPatterns) {
        const prefetched = await this.prefetchPattern(pattern, userId);
        itemsPrefetched += prefetched;
      }

      console.log(`✅ Prefetched ${itemsPrefetched} items for user ${userId}`);
      return { success: true, itemsPrefetched };
    } catch (error) {
      console.error('❌ Prefetching failed:', error);
      return { success: false, itemsPrefetched: 0 };
    }
  }

  /**
   * Register a caching strategy
   */
  public registerStrategy(strategy: CacheStrategy): void {
    this.strategies.set(strategy.name, strategy);
    console.log(`✅ Registered caching strategy: ${strategy.name}`);
  }

  /**
   * Get strategy performance report
   */
  public getStrategyReport(): { [strategyName: string]: any } {
    const report: { [strategyName: string]: any } = {};

    for (const [name, strategy] of this.strategies) {
      const operations = this.operations.filter(op => 
        op.namespace === strategy.namespace
      );

      report[name] = {
        namespace: strategy.namespace,
        ttl: strategy.ttl,
        operations: operations.length,
        successRate: operations.length > 0 ? 
          (operations.filter(op => op.success).length / operations.length) * 100 : 0,
        avgDuration: operations.length > 0 ?
          operations.reduce((sum, op) => sum + op.duration, 0) / operations.length : 0,
        lastActivity: operations.length > 0 ?
          Math.max(...operations.map(op => op.timestamp)) : 0,
      };
    }

    return report;
  }

  // ====================
  // PRIVATE METHODS
  // ====================

  private initializeStrategies(): void {
    // User data strategy
    this.strategies.set('user_data', {
      name: 'user_data',
      namespace: 'users',
      ttl: env.CACHE_TTL_MEDIUM,
      warmupPriority: 1,
      invalidationRules: ['user_update', 'session_end'],
      compressionThreshold: 1024,
      prefetchRules: [
        {
          trigger: 'user_action',
          condition: { action: 'login' },
          patterns: ['user:profile:*', 'user:preferences:*'],
          priority: 1,
          maxAge: 3600,
        },
      ],
    });

    // Content strategy
    this.strategies.set('learning_content', {
      name: 'learning_content',
      namespace: 'content',
      ttl: env.CACHE_TTL_LONG,
      warmupPriority: 2,
      invalidationRules: ['content_update', 'version_change'],
      compressionThreshold: 2048,
      prefetchRules: [
        {
          trigger: 'popularity',
          condition: { threshold: 100 },
          patterns: ['content:popular:*'],
          priority: 2,
          maxAge: 7200,
        },
      ],
    });

    // Session strategy
    this.strategies.set('session_data', {
      name: 'session_data',
      namespace: 'sessions',
      ttl: env.CACHE_TTL_SHORT,
      warmupPriority: 0,
      invalidationRules: ['session_timeout', 'user_logout'],
      compressionThreshold: 512,
      prefetchRules: [],
    });

    // Analytics strategy
    this.strategies.set('analytics', {
      name: 'analytics',
      namespace: 'analytics',
      ttl: env.CACHE_TTL_MEDIUM,
      warmupPriority: 3,
      invalidationRules: ['data_update', 'time_window'],
      compressionThreshold: 4096,
      prefetchRules: [
        {
          trigger: 'time_based',
          condition: { schedule: 'hourly' },
          patterns: ['analytics:dashboard:*'],
          priority: 3,
          maxAge: 1800,
        },
      ],
    });
  }

  private initializeWarmupJobs(): void {
    this.warmupJobs.set('popular_content', {
      id: 'popular_content',
      name: 'Popular Content Warmup',
      patterns: ['content:popular:*', 'content:trending:*'],
      priority: 1,
      schedule: '*/30 * * * *', // Every 30 minutes
      lastRun: 0,
      nextRun: Date.now() + 30 * 60 * 1000,
      enabled: true,
      stats: {
        runs: 0,
        successes: 0,
        failures: 0,
        avgDuration: 0,
        keysWarmed: 0,
      },
    });

    this.warmupJobs.set('user_profiles', {
      id: 'user_profiles',
      name: 'Active User Profiles Warmup',
      patterns: ['user:profile:*', 'user:preferences:*'],
      priority: 2,
      schedule: '0 * * * *', // Every hour
      lastRun: 0,
      nextRun: Date.now() + 60 * 60 * 1000,
      enabled: true,
      stats: {
        runs: 0,
        successes: 0,
        failures: 0,
        avgDuration: 0,
        keysWarmed: 0,
      },
    });
  }

  private async executeInitialWarmup(): Promise<void> {
    console.log('🔥 Executing initial cache warmup...');
    
    // Warmup critical data first
    const criticalPatterns = [
      'content:static:*',
      'config:*',
      'translations:*',
    ];

    for (const pattern of criticalPatterns) {
      await this.warmupPattern(pattern);
    }
  }

  private async warmupPattern(pattern: string): Promise<number> {
    try {
      await cacheManager.warmup([pattern]);
      return 1; // Simplified count
    } catch (error) {
      console.error(`❌ Failed to warmup pattern ${pattern}:`, error);
      return 0;
    }
  }

  private async warmupStrategy(strategy: CacheStrategy): Promise<number> {
    let keysWarmed = 0;
    
    for (const rule of strategy.prefetchRules) {
      for (const pattern of rule.patterns) {
        keysWarmed += await this.warmupPattern(pattern);
      }
    }
    
    return keysWarmed;
  }

  private async invalidateStrategy(strategy: CacheStrategy): Promise<number> {
    return await cacheManager.deleteByPattern(`${strategy.namespace}:*`);
  }

  private async cleanupStrategy(strategy: CacheStrategy): Promise<{ items: number; space: number }> {
    // Simplified cleanup - in production would be more sophisticated
    return { items: 0, space: 0 };
  }

  private getPrefetchPatternsForStyle(dominantStyle: string): string[] {
    const styleMap: { [key: string]: string[] } = {
      visual: ['content:image:*', 'content:diagram:*', 'content:chart:*'],
      auditory: ['content:audio:*', 'content:podcast:*', 'content:lecture:*'],
      kinesthetic: ['content:interactive:*', 'content:simulation:*', 'content:lab:*'],
      reading: ['content:text:*', 'content:article:*', 'content:document:*'],
    };

    return styleMap[dominantStyle.toLowerCase()] || [];
  }

  private getPrefetchPatternsForActivity(sessions: LearningSession[]): string[] {
    const patterns: string[] = [];
    
    // Analyze recent activity to predict next content
    const recentTopics = sessions
      .slice(-5) // Last 5 sessions
      .map(session => session.contentId)
      .filter(Boolean);

    for (const topic of recentTopics) {
      patterns.push(`content:related:${topic}:*`);
      patterns.push(`content:next:${topic}:*`);
    }

    return patterns;
  }

  private async prefetchPattern(pattern: string, userId: string): Promise<number> {
    // Simplified prefetching - would implement actual logic
    return 0;
  }

  private calculateOverallHealth(redis: CacheMetrics, memory: CacheStats): 'healthy' | 'warning' | 'critical' {
    const redisHealthy = redis.errors < 10;
    const memoryHealthy = memory.hitRate > this.config.alertThresholds.hitRate;
    const responseHealthy = redis.avgResponseTime < this.config.alertThresholds.responseTime;

    if (redisHealthy && memoryHealthy && responseHealthy) {
      return 'healthy';
    } else if (!redisHealthy || memory.hitRate < 50) {
      return 'critical';
    } else {
      return 'warning';
    }
  }

  private calculateCompressionRatio(): number {
    // Simplified calculation - would track actual compression
    return this.config.compressionEnabled ? 0.3 : 0;
  }

  private calculateContentEffectiveness(stats: ContentCacheStats): number {
    return stats.cachedContent > 0 ? stats.hitRate : 0;
  }

  private getEmptyHealthStatus(): CacheHealthStatus {
    return {
      overall: 'critical',
      redis: { status: 'error', connections: 0, memory: 0, hitRate: 0, responseTime: 0 },
      memory: { usage: 0, hitRate: 0, size: 0, compression: 0 },
      sessions: { active: 0, total: 0, avgDuration: 0 },
      content: { cached: 0, adaptations: 0, effectiveness: 0 },
      alerts: [],
    };
  }

  private recordOperation(operation: CacheOperation): void {
    this.operations.push(operation);
    
    // Keep only recent operations
    if (this.operations.length > 1000) {
      this.operations = this.operations.slice(-500);
    }
  }

  private checkAlertThresholds(): void {
    // This would implement actual threshold checking
    // For now, it's a placeholder
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getHealthStatus();
        this.checkAlertThresholds();
        
        if (health.overall !== 'healthy') {
          console.warn(`⚠️ Cache health: ${health.overall}`);
        }
      } catch (error) {
        console.error('❌ Health check failed:', error);
      }
    }, 60000); // Every minute
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      try {
        const metrics = await this.getMetrics();
        // In production, you'd store these metrics
        console.log(`📊 Cache metrics collected - Redis hit rate: ${metrics.redis.keyspaceHits}`);
      } catch (error) {
        console.error('❌ Metrics collection failed:', error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private startCleanupJobs(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupCache();
    }, this.config.cleanupSchedule.interval);
  }

  private startWarmupScheduler(): void {
    this.warmupInterval = setInterval(async () => {
      const now = Date.now();
      
      for (const [jobId, job] of this.warmupJobs) {
        if (job.enabled && now >= job.nextRun) {
          try {
            console.log(`🔥 Running warmup job: ${job.name}`);
            const result = await this.warmupCache(job.patterns);
            
            job.stats.runs++;
            if (result.success) {
              job.stats.successes++;
              job.stats.keysWarmed += result.keysWarmed;
            } else {
              job.stats.failures++;
            }
            
            job.stats.avgDuration = (job.stats.avgDuration * (job.stats.runs - 1) + result.duration) / job.stats.runs;
            job.lastRun = now;
            job.nextRun = this.calculateNextRun(job.schedule, now);
            
          } catch (error) {
            console.error(`❌ Warmup job ${job.name} failed:`, error);
            job.stats.failures++;
          }
        }
      }
    }, 60000); // Check every minute
  }

  private calculateNextRun(schedule: string, from: number): number {
    // Simplified schedule parsing - would implement proper cron parsing
    if (schedule.includes('*/30')) {
      return from + 30 * 60 * 1000; // 30 minutes
    } else if (schedule.includes('0 *')) {
      return from + 60 * 60 * 1000; // 1 hour
    }
    return from + 60 * 60 * 1000; // Default to 1 hour
  }

  /**
   * Shutdown cleanup
   */
  public async shutdown(): Promise<void> {
    console.log('🔄 Shutting down Cache Service...');
    
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.warmupInterval) clearInterval(this.warmupInterval);
    if (this.metricsInterval) clearInterval(this.metricsInterval);

    // Shutdown sub-services
    sessionCache.shutdown();
    contentCache.shutdown();
    await redisManager.shutdown();
    
    this.isInitialized = false;
    console.log('✅ Cache Service shutdown complete');
  }
}

// ====================
// SINGLETON INSTANCE
// ====================

export const cacheService = CacheService.getInstance();

// ====================
// CONVENIENCE FUNCTIONS
// ====================

/**
 * Initialize cache service
 */
export async function initializeCacheService(): Promise<void> {
  return cacheService.initialize();
}

/**
 * Get cache health status
 */
export async function getCacheHealth(): Promise<CacheHealthStatus> {
  return cacheService.getHealthStatus();
}

/**
 * Warm up cache
 */
export async function warmupCache(patterns?: string[]): Promise<{ success: boolean; keysWarmed: number; duration: number }> {
  return cacheService.warmupCache(patterns);
}

/**
 * Clean up cache
 */
export async function cleanupCache(): Promise<{ success: boolean; itemsRemoved: number; spaceFreed: number }> {
  return cacheService.cleanupCache();
}

/**
 * Get cache metrics
 */
export async function getCacheMetrics(): Promise<any> {
  return cacheService.getMetrics();
}

/**
 * Shutdown cache service
 */
export async function shutdownCacheService(): Promise<void> {
  return cacheService.shutdown();
}

export default cacheService;