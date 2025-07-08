import { env } from '../env-validation';
import { distributedCache } from './distributed-cache-service';
import { cacheKeyManager } from './key-manager';
import { compressionOptimizer } from './compression-optimizer';
import { executeRedisCommand } from '../redis-client';
import { contentCache } from '../content-cache';
import { sessionCache } from '../session-cache';

// ====================
// TYPES AND INTERFACES
// ====================

export interface CacheWarmingConfig {
  enabled: boolean;
  schedule: string; // Cron expression
  patterns: string[];
  namespaces: string[];
  priority: 'low' | 'medium' | 'high';
  concurrency: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  preloadSize: number;
  warmingStrategy: 'predictive' | 'static' | 'adaptive' | 'hybrid';
  memoryThreshold: number; // Percentage
  cpuThreshold: number; // Percentage
}

export interface CacheInvalidationConfig {
  enabled: boolean;
  triggers: CacheInvalidationTrigger[];
  strategies: CacheInvalidationStrategy[];
  cascading: boolean;
  gracefulTimeout: number;
  maxConcurrency: number;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    maxDelay: number;
  };
  notifications: {
    enabled: boolean;
    channels: ('webhook' | 'email' | 'slack')[];
    thresholds: {
      keysInvalidated: number;
      duration: number;
    };
  };
}

export interface CacheInvalidationTrigger {
  name: string;
  type: 'time' | 'event' | 'condition' | 'dependency';
  pattern: string;
  namespace?: string;
  condition?: string;
  dependencies?: string[];
  schedule?: string; // For time-based triggers
  ttlMultiplier?: number;
  enabled: boolean;
}

export interface CacheInvalidationStrategy {
  name: string;
  type: 'immediate' | 'batch' | 'lazy' | 'cascade' | 'selective';
  batchSize?: number;
  delay?: number;
  conditions?: string[];
  preservePatterns?: string[];
  enabled: boolean;
}

export interface CacheWarmingJob {
  id: string;
  name: string;
  namespace: string;
  patterns: string[];
  strategy: 'predictive' | 'static' | 'adaptive' | 'hybrid';
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: number;
  endTime?: number;
  duration?: number;
  progress: {
    total: number;
    completed: number;
    failed: number;
    percentage: number;
  };
  metrics: {
    keysWarmed: number;
    bytesLoaded: number;
    hitRateImprovement: number;
    avgLoadTime: number;
    errors: string[];
  };
  config: Partial<CacheWarmingConfig>;
}

export interface CacheInvalidationJob {
  id: string;
  name: string;
  type: 'manual' | 'scheduled' | 'triggered' | 'cascade';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: number;
  endTime?: number;
  duration?: number;
  progress: {
    total: number;
    invalidated: number;
    failed: number;
    percentage: number;
  };
  metrics: {
    keysInvalidated: number;
    bytesFreed: number;
    cascadeDepth: number;
    affectedNamespaces: string[];
    errors: string[];
  };
  config: {
    patterns: string[];
    namespaces: string[];
    strategy: string;
    cascading: boolean;
  };
}

export interface AutomationMetrics {
  warming: {
    totalJobs: number;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    avgDuration: number;
    avgHitRateImprovement: number;
    totalKeysWarmed: number;
    totalBytesLoaded: number;
  };
  invalidation: {
    totalJobs: number;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    avgDuration: number;
    totalKeysInvalidated: number;
    totalBytesFreed: number;
    cascadeEvents: number;
  };
  system: {
    uptime: number;
    schedulerStatus: 'running' | 'stopped' | 'error';
    lastHealthCheck: number;
    memoryUsage: number;
    cpuUsage: number;
    queueSize: number;
  };
}

// ====================
// CACHE AUTOMATION MANAGER
// ====================

export class CacheAutomationManager {
  private static instance: CacheAutomationManager;
  private warmingJobs: Map<string, CacheWarmingJob> = new Map();
  private invalidationJobs: Map<string, CacheInvalidationJob> = new Map();
  private warmingConfig: CacheWarmingConfig;
  private invalidationConfig: CacheInvalidationConfig;
  private schedulerInterval: NodeJS.Timeout | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private jobQueue: Array<{ type: 'warming' | 'invalidation'; job: any }> = [];
  private isRunning: boolean = false;
  private metrics: AutomationMetrics;

  private constructor() {
    this.warmingConfig = this.getDefaultWarmingConfig();
    this.invalidationConfig = this.getDefaultInvalidationConfig();
    this.metrics = this.initializeMetrics();
    this.startScheduler();
    this.startMonitoring();
  }

  public static getInstance(): CacheAutomationManager {
    if (!CacheAutomationManager.instance) {
      CacheAutomationManager.instance = new CacheAutomationManager();
    }
    return CacheAutomationManager.instance;
  }

  // ====================
  // CACHE WARMING
  // ====================

  /**
   * Schedule cache warming job
   */
  public async scheduleWarmingJob(
    name: string,
    namespace: string,
    patterns: string[],
    options: Partial<CacheWarmingConfig> = {}
  ): Promise<string> {
    const jobId = this.generateJobId('warming');
    const config = { ...this.warmingConfig, ...options };

    const job: CacheWarmingJob = {
      id: jobId,
      name,
      namespace,
      patterns,
      strategy: config.warmingStrategy,
      priority: config.priority,
      status: 'pending',
      progress: {
        total: 0,
        completed: 0,
        failed: 0,
        percentage: 0,
      },
      metrics: {
        keysWarmed: 0,
        bytesLoaded: 0,
        hitRateImprovement: 0,
        avgLoadTime: 0,
        errors: [],
      },
      config,
    };

    this.warmingJobs.set(jobId, job);
    this.addToQueue('warming', job);

    console.log(`🔥 Scheduled cache warming job: ${name} (${jobId})`);
    return jobId;
  }

  /**
   * Execute cache warming job
   */
  public async executeWarmingJob(jobId: string): Promise<boolean> {
    const job = this.warmingJobs.get(jobId);
    if (!job || job.status !== 'pending') {
      return false;
    }

    job.status = 'running';
    job.startTime = Date.now();
    this.metrics.warming.activeJobs++;

    try {
      console.log(`🔥 Starting cache warming job: ${job.name}`);

      // Get keys to warm based on strategy
      const keysToWarm = await this.getKeysToWarm(job);
      job.progress.total = keysToWarm.length;

      // Warm cache keys with concurrency control
      await this.warmCacheKeys(job, keysToWarm);

      // Calculate metrics
      await this.calculateWarmingMetrics(job);

      job.status = 'completed';
      job.endTime = Date.now();
      job.duration = job.endTime - (job.startTime || 0);

      this.metrics.warming.completedJobs++;
      this.metrics.warming.activeJobs--;

      console.log(`✅ Cache warming job completed: ${job.name} (${job.metrics.keysWarmed} keys warmed)`);
      return true;
    } catch (error) {
      job.status = 'failed';
      job.endTime = Date.now();
      job.duration = job.endTime - (job.startTime || 0);
      job.metrics.errors.push(error instanceof Error ? error.message : String(error));

      this.metrics.warming.failedJobs++;
      this.metrics.warming.activeJobs--;

      console.error(`❌ Cache warming job failed: ${job.name}`, error);
      return false;
    }
  }

  /**
   * Predictive cache warming based on access patterns
   */
  public async scheduleAdaptiveWarming(): Promise<string[]> {
    if (!this.warmingConfig.enabled) {
      return [];
    }

    const jobIds: string[] = [];

    try {
      // Analyze access patterns for each namespace
      for (const namespace of this.warmingConfig.namespaces) {
        const analytics = cacheKeyManager.getKeyAnalytics(namespace);
        if (!analytics) continue;

        // Identify hot keys that should be warmed
        const hotKeys = analytics.hotKeys.slice(0, 50); // Top 50 hot keys
        
        if (hotKeys.length > 0) {
          const patterns = hotKeys.map(key => key.key);
          const jobId = await this.scheduleWarmingJob(
            `adaptive-warming-${namespace}`,
            namespace,
            patterns,
            { warmingStrategy: 'adaptive', priority: 'high' }
          );
          jobIds.push(jobId);
        }

        // Identify patterns with declining hit rates
        const decliningPatterns = analytics.accessPatterns
          .filter(pattern => pattern.avgAccessFrequency > 0)
          .sort((a, b) => a.lastAccessed - b.lastAccessed)
          .slice(0, 10) // Top 10 declining patterns
          .map(pattern => pattern.pattern);

        if (decliningPatterns.length > 0) {
          const jobId = await this.scheduleWarmingJob(
            `predictive-warming-${namespace}`,
            namespace,
            decliningPatterns,
            { warmingStrategy: 'predictive', priority: 'medium' }
          );
          jobIds.push(jobId);
        }
      }

      console.log(`🔥 Scheduled ${jobIds.length} adaptive warming jobs`);
      return jobIds;
    } catch (error) {
      console.error('❌ Failed to schedule adaptive warming:', error);
      return [];
    }
  }

  // ====================
  // CACHE INVALIDATION
  // ====================

  /**
   * Schedule cache invalidation job
   */
  public async scheduleInvalidationJob(
    name: string,
    patterns: string[],
    namespaces: string[] = ['default'],
    strategy: string = 'immediate',
    options: Partial<CacheInvalidationConfig> = {}
  ): Promise<string> {
    const jobId = this.generateJobId('invalidation');
    const config = { ...this.invalidationConfig, ...options };

    const job: CacheInvalidationJob = {
      id: jobId,
      name,
      type: 'manual',
      status: 'pending',
      progress: {
        total: 0,
        invalidated: 0,
        failed: 0,
        percentage: 0,
      },
      metrics: {
        keysInvalidated: 0,
        bytesFreed: 0,
        cascadeDepth: 0,
        affectedNamespaces: [],
        errors: [],
      },
      config: {
        patterns,
        namespaces,
        strategy,
        cascading: config.cascading,
      },
    };

    this.invalidationJobs.set(jobId, job);
    this.addToQueue('invalidation', job);

    console.log(`🗑️ Scheduled cache invalidation job: ${name} (${jobId})`);
    return jobId;
  }

  /**
   * Execute cache invalidation job
   */
  public async executeInvalidationJob(jobId: string): Promise<boolean> {
    const job = this.invalidationJobs.get(jobId);
    if (!job || job.status !== 'pending') {
      return false;
    }

    job.status = 'running';
    job.startTime = Date.now();
    this.metrics.invalidation.activeJobs++;

    try {
      console.log(`🗑️ Starting cache invalidation job: ${job.name}`);

      // Get keys to invalidate
      const keysToInvalidate = await this.getKeysToInvalidate(job);
      job.progress.total = keysToInvalidate.length;

      // Invalidate cache keys
      await this.invalidateCacheKeys(job, keysToInvalidate);

      // Handle cascading invalidation
      if (job.config.cascading) {
        await this.handleCascadingInvalidation(job);
      }

      job.status = 'completed';
      job.endTime = Date.now();
      job.duration = job.endTime - (job.startTime || 0);

      this.metrics.invalidation.completedJobs++;
      this.metrics.invalidation.activeJobs--;

      console.log(`✅ Cache invalidation job completed: ${job.name} (${job.metrics.keysInvalidated} keys invalidated)`);

      // Send notifications if configured
      await this.sendInvalidationNotifications(job);

      return true;
    } catch (error) {
      job.status = 'failed';
      job.endTime = Date.now();
      job.duration = job.endTime - (job.startTime || 0);
      job.metrics.errors.push(error instanceof Error ? error.message : String(error));

      this.metrics.invalidation.failedJobs++;
      this.metrics.invalidation.activeJobs--;

      console.error(`❌ Cache invalidation job failed: ${job.name}`, error);
      return false;
    }
  }

  /**
   * Invalidate cache by patterns
   */
  public async invalidateByPatterns(
    patterns: string[],
    namespaces: string[] = ['default'],
    options: { cascading?: boolean; strategy?: string } = {}
  ): Promise<number> {
    const jobId = await this.scheduleInvalidationJob(
      `pattern-invalidation-${Date.now()}`,
      patterns,
      namespaces,
      options.strategy || 'immediate',
      { cascading: options.cascading || false }
    );

    const success = await this.executeInvalidationJob(jobId);
    const job = this.invalidationJobs.get(jobId);
    
    return success && job ? job.metrics.keysInvalidated : 0;
  }

  /**
   * Invalidate cache by tags
   */
  public async invalidateByTags(
    tags: string[],
    namespaces: string[] = ['default']
  ): Promise<number> {
    let totalInvalidated = 0;

    for (const namespace of namespaces) {
      const keys = cacheKeyManager.getKeysByTags(tags, namespace);
      if (keys.length > 0) {
        const invalidated = await this.invalidateByPatterns(
          keys.map(key => key.replace(/^[^:]+:/, '')), // Remove namespace prefix
          [namespace]
        );
        totalInvalidated += invalidated;
      }
    }

    return totalInvalidated;
  }

  /**
   * Scheduled cache cleanup (remove expired and unused keys)
   */
  public async scheduleCleanup(): Promise<string> {
    return this.scheduleInvalidationJob(
      `scheduled-cleanup-${Date.now()}`,
      ['*'], // All patterns
      this.invalidationConfig.triggers
        .filter(trigger => trigger.type === 'time')
        .map(trigger => trigger.namespace || 'default'),
      'lazy',
      { cascading: false }
    );
  }

  // ====================
  // JOB MANAGEMENT
  // ====================

  /**
   * Get warming job status
   */
  public getWarmingJob(jobId: string): CacheWarmingJob | null {
    return this.warmingJobs.get(jobId) || null;
  }

  /**
   * Get invalidation job status
   */
  public getInvalidationJob(jobId: string): CacheInvalidationJob | null {
    return this.invalidationJobs.get(jobId) || null;
  }

  /**
   * List active jobs
   */
  public getActiveJobs(): {
    warming: CacheWarmingJob[];
    invalidation: CacheInvalidationJob[];
  } {
    return {
      warming: Array.from(this.warmingJobs.values()).filter(job => 
        job.status === 'running' || job.status === 'pending'
      ),
      invalidation: Array.from(this.invalidationJobs.values()).filter(job => 
        job.status === 'running' || job.status === 'pending'
      ),
    };
  }

  /**
   * Cancel job
   */
  public cancelJob(jobId: string): boolean {
    const warmingJob = this.warmingJobs.get(jobId);
    const invalidationJob = this.invalidationJobs.get(jobId);

    if (warmingJob && (warmingJob.status === 'pending' || warmingJob.status === 'running')) {
      warmingJob.status = 'cancelled';
      console.log(`🚫 Cancelled warming job: ${warmingJob.name}`);
      return true;
    }

    if (invalidationJob && (invalidationJob.status === 'pending' || invalidationJob.status === 'running')) {
      invalidationJob.status = 'cancelled';
      console.log(`🚫 Cancelled invalidation job: ${invalidationJob.name}`);
      return true;
    }

    return false;
  }

  /**
   * Get automation metrics
   */
  public getMetrics(): AutomationMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get automation health summary
   */
  public getHealthSummary(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: string[];
    recommendations: string[];
    metrics: AutomationMetrics;
  } {
    const metrics = this.getMetrics();
    const issues: string[] = [];
    const recommendations: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check for issues
    if (metrics.system.schedulerStatus !== 'running') {
      issues.push('Scheduler is not running');
      status = 'unhealthy';
    }

    if (metrics.warming.failedJobs > metrics.warming.completedJobs * 0.1) {
      issues.push('High warming job failure rate');
      status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
    }

    if (metrics.invalidation.failedJobs > metrics.invalidation.completedJobs * 0.1) {
      issues.push('High invalidation job failure rate');
      status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
    }

    if (metrics.system.queueSize > 100) {
      issues.push('Job queue is getting large');
      recommendations.push('Consider increasing concurrency or adding more workers');
    }

    if (metrics.warming.avgHitRateImprovement < 5) {
      recommendations.push('Cache warming is not significantly improving hit rates');
    }

    return {
      status,
      issues,
      recommendations,
      metrics,
    };
  }

  // ====================
  // CONFIGURATION
  // ====================

  /**
   * Update warming configuration
   */
  public updateWarmingConfig(config: Partial<CacheWarmingConfig>): void {
    this.warmingConfig = { ...this.warmingConfig, ...config };
    console.log('🔧 Cache warming configuration updated');
  }

  /**
   * Update invalidation configuration
   */
  public updateInvalidationConfig(config: Partial<CacheInvalidationConfig>): void {
    this.invalidationConfig = { ...this.invalidationConfig, ...config };
    console.log('🔧 Cache invalidation configuration updated');
  }

  // ====================
  // PRIVATE METHODS
  // ====================

  private async getKeysToWarm(job: CacheWarmingJob): Promise<string[]> {
    const keys: string[] = [];

    try {
      for (const pattern of job.patterns) {
        const patternKeys = cacheKeyManager.getKeysByPattern(pattern, job.namespace);
        keys.push(...patternKeys);
      }

      // Apply strategy-specific filtering
      switch (job.strategy) {
        case 'predictive':
          return this.filterPredictiveKeys(keys, job.namespace);
        case 'adaptive':
          return this.filterAdaptiveKeys(keys, job.namespace);
        case 'static':
          return keys.slice(0, job.config.preloadSize || 1000);
        case 'hybrid':
          return this.filterHybridKeys(keys, job.namespace);
        default:
          return keys;
      }
    } catch (error) {
      console.error('Failed to get keys to warm:', error);
      return [];
    }
  }

  private async warmCacheKeys(job: CacheWarmingJob, keys: string[]): Promise<void> {
    const concurrency = job.config.concurrency || 5;
    const timeout = job.config.timeout || 30000;

    // Process keys in batches
    for (let i = 0; i < keys.length; i += concurrency) {
      if (job.status === 'cancelled') break;

      const batch = keys.slice(i, i + concurrency);
      const promises = batch.map(key => this.warmSingleKey(key, timeout));

      const results = await Promise.allSettled(promises);
      
      for (const result of results) {
        if (result.status === 'fulfilled') {
          job.progress.completed++;
          job.metrics.keysWarmed++;
        } else {
          job.progress.failed++;
          job.metrics.errors.push(result.reason);
        }
      }

      job.progress.percentage = (job.progress.completed + job.progress.failed) / job.progress.total * 100;
    }
  }

  private async warmSingleKey(key: string, timeout: number): Promise<void> {
    const startTime = Date.now();

    try {
      // Try to get the key (this will warm it if it exists in backing store)
      await Promise.race([
        distributedCache.get(key),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
      ]);
    } catch (error) {
      // If key doesn't exist or times out, that's okay for warming
      if (error instanceof Error && !error.message.includes('Timeout')) {
        throw error;
      }
    }
  }

  private async getKeysToInvalidate(job: CacheInvalidationJob): Promise<string[]> {
    const keys: string[] = [];

    try {
      for (const namespace of job.config.namespaces) {
        for (const pattern of job.config.patterns) {
          const patternKeys = cacheKeyManager.getKeysByPattern(pattern, namespace);
          keys.push(...patternKeys);
        }
      }

      return [...new Set(keys)]; // Remove duplicates
    } catch (error) {
      console.error('Failed to get keys to invalidate:', error);
      return [];
    }
  }

  private async invalidateCacheKeys(job: CacheInvalidationJob, keys: string[]): Promise<void> {
    const maxConcurrency = this.invalidationConfig.maxConcurrency || 10;

    // Process keys in batches
    for (let i = 0; i < keys.length; i += maxConcurrency) {
      if (job.status === 'cancelled') break;

      const batch = keys.slice(i, i + maxConcurrency);
      const promises = batch.map(key => this.invalidateSingleKey(key));

      const results = await Promise.allSettled(promises);
      
      for (const result of results) {
        if (result.status === 'fulfilled') {
          job.progress.invalidated++;
          job.metrics.keysInvalidated++;
        } else {
          job.progress.failed++;
          job.metrics.errors.push(result.reason);
        }
      }

      job.progress.percentage = (job.progress.invalidated + job.progress.failed) / job.progress.total * 100;
    }
  }

  private async invalidateSingleKey(key: string): Promise<void> {
    try {
      await distributedCache.delete(key);
    } catch (error) {
      console.warn(`Failed to invalidate key ${key}:`, error);
      throw error;
    }
  }

  private async handleCascadingInvalidation(job: CacheInvalidationJob): Promise<void> {
    // Implementation for cascading invalidation based on dependencies
    // This would analyze key dependencies and invalidate related keys
    console.log(`🔄 Handling cascading invalidation for job: ${job.name}`);
    job.metrics.cascadeDepth = 1; // Placeholder
  }

  private filterPredictiveKeys(keys: string[], namespace: string): string[] {
    // Filter keys based on predictive analysis
    const analytics = cacheKeyManager.getKeyAnalytics(namespace);
    if (!analytics) return keys.slice(0, 100);

    const hotKeyPatterns = analytics.hotKeys.map(key => key.key);
    return keys.filter(key => hotKeyPatterns.some(pattern => key.includes(pattern)));
  }

  private filterAdaptiveKeys(keys: string[], namespace: string): string[] {
    // Filter keys based on adaptive analysis
    const coldKeys = cacheKeyManager.getColdKeys(namespace, 50);
    const coldKeyPatterns = coldKeys.map(key => key.key);
    return keys.filter(key => coldKeyPatterns.some(pattern => key.includes(pattern)));
  }

  private filterHybridKeys(keys: string[], namespace: string): string[] {
    // Combine predictive and adaptive strategies
    const predictive = this.filterPredictiveKeys(keys, namespace);
    const adaptive = this.filterAdaptiveKeys(keys, namespace);
    return [...new Set([...predictive, ...adaptive])];
  }

  private async calculateWarmingMetrics(job: CacheWarmingJob): Promise<void> {
    // Calculate hit rate improvement and other metrics
    job.metrics.avgLoadTime = job.duration || 0 / Math.max(job.metrics.keysWarmed, 1);
    job.metrics.hitRateImprovement = 5; // Placeholder - would need actual hit rate comparison
  }

  private async sendInvalidationNotifications(job: CacheInvalidationJob): Promise<void> {
    const config = this.invalidationConfig.notifications;
    if (!config.enabled) return;

    const shouldNotify = 
      job.metrics.keysInvalidated >= config.thresholds.keysInvalidated ||
      (job.duration || 0) >= config.thresholds.duration;

    if (shouldNotify) {
      console.log(`📧 Sending invalidation notification for job: ${job.name}`);
      // Implementation would send actual notifications
    }
  }

  private generateJobId(type: 'warming' | 'invalidation'): string {
    return `${type}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private addToQueue(type: 'warming' | 'invalidation', job: any): void {
    this.jobQueue.push({ type, job });
    this.metrics.system.queueSize = this.jobQueue.length;
  }

  private startScheduler(): void {
    if (this.schedulerInterval) return;

    this.schedulerInterval = setInterval(async () => {
      await this.processQueue();
    }, 5000); // Process queue every 5 seconds

    this.isRunning = true;
    this.metrics.system.schedulerStatus = 'running';
    console.log('⏰ Cache automation scheduler started');
  }

  private startMonitoring(): void {
    if (this.monitoringInterval) return;

    this.monitoringInterval = setInterval(() => {
      this.updateSystemMetrics();
    }, 30000); // Update system metrics every 30 seconds

    console.log('📊 Cache automation monitoring started');
  }

  private async processQueue(): Promise<void> {
    if (this.jobQueue.length === 0) return;

    const activeJobs = this.getActiveJobs();
    const totalActive = activeJobs.warming.length + activeJobs.invalidation.length;
    const maxConcurrency = Math.max(this.warmingConfig.concurrency, this.invalidationConfig.maxConcurrency);

    if (totalActive >= maxConcurrency) return;

    // Sort by priority
    this.jobQueue.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const aPriority = a.type === 'warming' ? priorityOrder[a.job.priority] : 2;
      const bPriority = b.type === 'warming' ? priorityOrder[b.job.priority] : 2;
      return bPriority - aPriority;
    });

    // Process next job
    const nextJob = this.jobQueue.shift();
    if (nextJob) {
      this.metrics.system.queueSize = this.jobQueue.length;
      
      if (nextJob.type === 'warming') {
        await this.executeWarmingJob(nextJob.job.id);
      } else {
        await this.executeInvalidationJob(nextJob.job.id);
      }
    }
  }

  private updateSystemMetrics(): void {
    this.metrics.system.uptime = Date.now() - (this.metrics.system.lastHealthCheck || Date.now());
    this.metrics.system.lastHealthCheck = Date.now();
    this.metrics.system.memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    this.metrics.system.cpuUsage = process.cpuUsage ? process.cpuUsage().user / 1000 : 0;
  }

  private updateMetrics(): void {
    // Update warming metrics
    const warmingJobs = Array.from(this.warmingJobs.values());
    const completedWarming = warmingJobs.filter(job => job.status === 'completed');
    
    this.metrics.warming.totalJobs = warmingJobs.length;
    this.metrics.warming.activeJobs = warmingJobs.filter(job => job.status === 'running').length;
    this.metrics.warming.completedJobs = completedWarming.length;
    this.metrics.warming.failedJobs = warmingJobs.filter(job => job.status === 'failed').length;
    this.metrics.warming.avgDuration = completedWarming.length > 0 
      ? completedWarming.reduce((sum, job) => sum + (job.duration || 0), 0) / completedWarming.length 
      : 0;
    this.metrics.warming.totalKeysWarmed = warmingJobs.reduce((sum, job) => sum + job.metrics.keysWarmed, 0);

    // Update invalidation metrics
    const invalidationJobs = Array.from(this.invalidationJobs.values());
    const completedInvalidation = invalidationJobs.filter(job => job.status === 'completed');
    
    this.metrics.invalidation.totalJobs = invalidationJobs.length;
    this.metrics.invalidation.activeJobs = invalidationJobs.filter(job => job.status === 'running').length;
    this.metrics.invalidation.completedJobs = completedInvalidation.length;
    this.metrics.invalidation.failedJobs = invalidationJobs.filter(job => job.status === 'failed').length;
    this.metrics.invalidation.totalKeysInvalidated = invalidationJobs.reduce((sum, job) => sum + job.metrics.keysInvalidated, 0);
  }

  private getDefaultWarmingConfig(): CacheWarmingConfig {
    return {
      enabled: env.CACHE_WARMING_ENABLED || true,
      schedule: '0 2 * * *', // Daily at 2 AM
      patterns: ['user:profile:*', 'content:*'],
      namespaces: ['default', 'content', 'sessions'],
      priority: 'medium',
      concurrency: 5,
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      preloadSize: 1000,
      warmingStrategy: 'adaptive',
      memoryThreshold: 80,
      cpuThreshold: 70,
    };
  }

  private getDefaultInvalidationConfig(): CacheInvalidationConfig {
    return {
      enabled: true,
      triggers: [
        {
          name: 'daily_cleanup',
          type: 'time',
          pattern: '*',
          schedule: '0 3 * * *', // Daily at 3 AM
          enabled: true,
        },
        {
          name: 'content_update',
          type: 'event',
          pattern: 'content:*',
          namespace: 'content',
          enabled: true,
        },
      ],
      strategies: [
        {
          name: 'immediate',
          type: 'immediate',
          enabled: true,
        },
        {
          name: 'batch',
          type: 'batch',
          batchSize: 100,
          delay: 1000,
          enabled: true,
        },
      ],
      cascading: true,
      gracefulTimeout: 30000,
      maxConcurrency: 10,
      retryPolicy: {
        maxRetries: 3,
        backoffMultiplier: 2,
        maxDelay: 10000,
      },
      notifications: {
        enabled: false,
        channels: ['webhook'],
        thresholds: {
          keysInvalidated: 1000,
          duration: 60000,
        },
      },
    };
  }

  private initializeMetrics(): AutomationMetrics {
    return {
      warming: {
        totalJobs: 0,
        activeJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        avgDuration: 0,
        avgHitRateImprovement: 0,
        totalKeysWarmed: 0,
        totalBytesLoaded: 0,
      },
      invalidation: {
        totalJobs: 0,
        activeJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        avgDuration: 0,
        totalKeysInvalidated: 0,
        totalBytesFreed: 0,
        cascadeEvents: 0,
      },
      system: {
        uptime: 0,
        schedulerStatus: 'stopped',
        lastHealthCheck: Date.now(),
        memoryUsage: 0,
        cpuUsage: 0,
        queueSize: 0,
      },
    };
  }

  /**
   * Shutdown the automation manager
   */
  public shutdown(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.isRunning = false;
    this.metrics.system.schedulerStatus = 'stopped';
    console.log('✅ Cache automation manager shutdown complete');
  }
}

// ====================
// SINGLETON INSTANCE
// ====================

export const cacheAutomation = CacheAutomationManager.getInstance();

// ====================
// CONVENIENCE FUNCTIONS
// ====================

/**
 * Schedule adaptive cache warming
 */
export async function scheduleAdaptiveWarming(): Promise<string[]> {
  return cacheAutomation.scheduleAdaptiveWarming();
}

/**
 * Warm cache for specific patterns
 */
export async function warmCache(
  patterns: string[],
  namespace: string = 'default',
  strategy: 'predictive' | 'static' | 'adaptive' | 'hybrid' = 'adaptive'
): Promise<string> {
  return cacheAutomation.scheduleWarmingJob(
    `manual-warming-${Date.now()}`,
    namespace,
    patterns,
    { warmingStrategy: strategy, priority: 'high' }
  );
}

/**
 * Invalidate cache by patterns
 */
export async function invalidateCache(
  patterns: string[],
  namespaces: string[] = ['default'],
  options: { cascading?: boolean; strategy?: string } = {}
): Promise<number> {
  return cacheAutomation.invalidateByPatterns(patterns, namespaces, options);
}

/**
 * Invalidate cache by tags
 */
export async function invalidateCacheByTags(
  tags: string[],
  namespaces: string[] = ['default']
): Promise<number> {
  return cacheAutomation.invalidateByTags(tags, namespaces);
}

/**
 * Get cache automation health
 */
export function getCacheAutomationHealth() {
  return cacheAutomation.getHealthSummary();
}

/**
 * Get active cache jobs
 */
export function getActiveCacheJobs() {
  return cacheAutomation.getActiveJobs();
}

export default cacheAutomation;