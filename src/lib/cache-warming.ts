import { cacheManager } from './cache';
import { contentCache } from './content-cache';
import { sessionCache } from './session-cache';
import { executeRedisCommand } from './redis-client';
import { env } from './env-validation';

// ====================
// TYPES AND INTERFACES
// ====================

export interface WarmupStrategy {
  name: string;
  description: string;
  priority: number;
  schedule: string;
  patterns: string[];
  dependencies: string[];
  enabled: boolean;
  estimatedDuration: number;
  successCriteria: {
    minKeysWarmed: number;
    maxErrorRate: number;
    maxDuration: number;
  };
}

export interface WarmupExecution {
  strategyName: string;
  startTime: number;
  endTime: number;
  keysAttempted: number;
  keysWarmed: number;
  errors: number;
  success: boolean;
  errorDetails: string[];
  metrics: {
    avgResponseTime: number;
    cacheHitRate: number;
    memoryUsage: number;
  };
}

export interface WarmupSchedule {
  immediate: WarmupStrategy[];
  startup: WarmupStrategy[];
  periodic: WarmupStrategy[];
  onDemand: WarmupStrategy[];
}

export interface WarmupMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalKeysWarmed: number;
  totalDuration: number;
  averageDuration: number;
  successRate: number;
  lastExecution: number;
  strategiesStatus: { [strategyName: string]: 'idle' | 'running' | 'failed' | 'completed' };
}

// ====================
// CACHE WARMING MANAGER
// ====================

export class CacheWarmingManager {
  private static instance: CacheWarmingManager;
  private strategies: Map<string, WarmupStrategy> = new Map();
  private executions: WarmupExecution[] = [];
  private runningStrategies: Set<string> = new Set();
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map();
  private metrics: WarmupMetrics = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    totalKeysWarmed: 0,
    totalDuration: 0,
    averageDuration: 0,
    successRate: 0,
    lastExecution: 0,
    strategiesStatus: {},
  };

  private constructor() {
    this.initializeStrategies();
  }

  public static getInstance(): CacheWarmingManager {
    if (!CacheWarmingManager.instance) {
      CacheWarmingManager.instance = new CacheWarmingManager();
    }
    return CacheWarmingManager.instance;
  }

  private initializeStrategies(): void {
    // Critical system data warmup
    this.strategies.set('critical_system', {
      name: 'critical_system',
      description: 'Warm up critical system configuration and static data',
      priority: 1,
      schedule: 'startup',
      patterns: [
        'config:*',
        'translations:*',
        'content:static:*',
        'system:*',
      ],
      dependencies: [],
      enabled: true,
      estimatedDuration: 5000,
      successCriteria: {
        minKeysWarmed: 10,
        maxErrorRate: 5,
        maxDuration: 10000,
      },
    });

    // Popular content warmup
    this.strategies.set('popular_content', {
      name: 'popular_content',
      description: 'Warm up frequently accessed learning content',
      priority: 2,
      schedule: 'periodic',
      patterns: [
        'content:popular:*',
        'content:trending:*',
        'content:featured:*',
      ],
      dependencies: ['critical_system'],
      enabled: true,
      estimatedDuration: 15000,
      successCriteria: {
        minKeysWarmed: 50,
        maxErrorRate: 10,
        maxDuration: 30000,
      },
    });

    // User session data warmup
    this.strategies.set('active_users', {
      name: 'active_users',
      description: 'Warm up data for active users',
      priority: 3,
      schedule: 'periodic',
      patterns: [
        'user:profile:*',
        'user:preferences:*',
        'user:progress:*',
        'sessions:active:*',
      ],
      dependencies: [],
      enabled: true,
      estimatedDuration: 10000,
      successCriteria: {
        minKeysWarmed: 20,
        maxErrorRate: 15,
        maxDuration: 20000,
      },
    });

    // Analytics dashboard warmup
    this.strategies.set('analytics_dashboard', {
      name: 'analytics_dashboard',
      description: 'Warm up analytics and dashboard data',
      priority: 4,
      schedule: 'periodic',
      patterns: [
        'analytics:dashboard:*',
        'analytics:summary:*',
        'metrics:*',
        'reports:*',
      ],
      dependencies: ['active_users'],
      enabled: true,
      estimatedDuration: 8000,
      successCriteria: {
        minKeysWarmed: 15,
        maxErrorRate: 20,
        maxDuration: 15000,
      },
    });

    // Search indices warmup
    this.strategies.set('search_indices', {
      name: 'search_indices',
      description: 'Warm up search indices and related data',
      priority: 5,
      schedule: 'periodic',
      patterns: [
        'search:index:*',
        'search:suggestions:*',
        'content:tags:*',
        'content:categories:*',
      ],
      dependencies: ['popular_content'],
      enabled: true,
      estimatedDuration: 12000,
      successCriteria: {
        minKeysWarmed: 30,
        maxErrorRate: 15,
        maxDuration: 25000,
      },
    });

    // Learning paths warmup
    this.strategies.set('learning_paths', {
      name: 'learning_paths',
      description: 'Warm up learning paths and progression data',
      priority: 6,
      schedule: 'on-demand',
      patterns: [
        'paths:*',
        'progression:*',
        'recommendations:*',
        'adaptive:*',
      ],
      dependencies: ['popular_content', 'active_users'],
      enabled: true,
      estimatedDuration: 20000,
      successCriteria: {
        minKeysWarmed: 40,
        maxErrorRate: 10,
        maxDuration: 35000,
      },
    });

    // Assessment data warmup
    this.strategies.set('assessments', {
      name: 'assessments',
      description: 'Warm up assessment and quiz data',
      priority: 7,
      schedule: 'on-demand',
      patterns: [
        'assessments:*',
        'quizzes:*',
        'questions:*',
        'results:*',
      ],
      dependencies: ['learning_paths'],
      enabled: true,
      estimatedDuration: 18000,
      successCriteria: {
        minKeysWarmed: 35,
        maxErrorRate: 12,
        maxDuration: 30000,
      },
    });

    // Initialize all strategies as idle
    for (const [name] of this.strategies) {
      this.metrics.strategiesStatus[name] = 'idle';
    }
  }

  /**
   * Execute startup warmup strategies
   */
  public async executeStartupWarmup(): Promise<WarmupMetrics> {
    console.log('🔥 Starting application warmup...');
    
    const startupStrategies = Array.from(this.strategies.values())
      .filter(strategy => strategy.schedule === 'startup' && strategy.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const strategy of startupStrategies) {
      await this.executeStrategy(strategy);
    }

    console.log('✅ Application warmup completed');
    return this.getMetrics();
  }

  /**
   * Execute a specific warmup strategy
   */
  public async executeStrategy(strategy: WarmupStrategy): Promise<WarmupExecution> {
    if (this.runningStrategies.has(strategy.name)) {
      throw new Error(`Strategy ${strategy.name} is already running`);
    }

    console.log(`🔥 Executing warmup strategy: ${strategy.name}`);
    this.runningStrategies.add(strategy.name);
    this.metrics.strategiesStatus[strategy.name] = 'running';

    const execution: WarmupExecution = {
      strategyName: strategy.name,
      startTime: Date.now(),
      endTime: 0,
      keysAttempted: 0,
      keysWarmed: 0,
      errors: 0,
      success: false,
      errorDetails: [],
      metrics: {
        avgResponseTime: 0,
        cacheHitRate: 0,
        memoryUsage: 0,
      },
    };

    try {
      // Check dependencies
      await this.checkDependencies(strategy);

      // Execute warmup for each pattern
      for (const pattern of strategy.patterns) {
        try {
          const { attempted, warmed } = await this.warmupPattern(pattern);
          execution.keysAttempted += attempted;
          execution.keysWarmed += warmed;
        } catch (error) {
          execution.errors++;
          execution.errorDetails.push(`Pattern ${pattern}: ${(error as Error).message}`);
        }
      }

      // Collect metrics
      execution.metrics = await this.collectWarmupMetrics();
      execution.endTime = Date.now();

      // Check success criteria
      const duration = execution.endTime - execution.startTime;
      const errorRate = execution.errors > 0 ? (execution.errors / execution.keysAttempted) * 100 : 0;

      execution.success = 
        execution.keysWarmed >= strategy.successCriteria.minKeysWarmed &&
        errorRate <= strategy.successCriteria.maxErrorRate &&
        duration <= strategy.successCriteria.maxDuration;

      // Update metrics
      this.updateMetrics(execution);

      if (execution.success) {
        this.metrics.strategiesStatus[strategy.name] = 'completed';
        console.log(`✅ Strategy ${strategy.name} completed successfully: ${execution.keysWarmed} keys warmed`);
      } else {
        this.metrics.strategiesStatus[strategy.name] = 'failed';
        console.warn(`⚠️ Strategy ${strategy.name} failed to meet success criteria`);
      }

    } catch (error) {
      execution.errors++;
      execution.errorDetails.push(`Strategy execution failed: ${(error as Error).message}`);
      execution.endTime = Date.now();
      execution.success = false;
      this.metrics.strategiesStatus[strategy.name] = 'failed';
      
      console.error(`❌ Strategy ${strategy.name} failed:`, error);
    } finally {
      this.runningStrategies.delete(strategy.name);
      this.executions.push(execution);
      
      // Keep only last 100 executions
      if (this.executions.length > 100) {
        this.executions = this.executions.slice(-50);
      }
    }

    return execution;
  }

  /**
   * Schedule periodic warmup strategies
   */
  public schedulePeriodicWarmup(): void {
    const periodicStrategies = Array.from(this.strategies.values())
      .filter(strategy => strategy.schedule === 'periodic' && strategy.enabled);

    for (const strategy of periodicStrategies) {
      this.scheduleStrategy(strategy);
    }

    console.log(`📅 Scheduled ${periodicStrategies.length} periodic warmup strategies`);
  }

  /**
   * Execute on-demand warmup for specific patterns
   */
  public async executeOnDemandWarmup(patterns: string[]): Promise<WarmupExecution> {
    const strategy: WarmupStrategy = {
      name: 'on_demand',
      description: 'On-demand warmup for specific patterns',
      priority: 0,
      schedule: 'on-demand',
      patterns,
      dependencies: [],
      enabled: true,
      estimatedDuration: 5000,
      successCriteria: {
        minKeysWarmed: 1,
        maxErrorRate: 25,
        maxDuration: 15000,
      },
    };

    return this.executeStrategy(strategy);
  }

  /**
   * Get warmup metrics
   */
  public getMetrics(): WarmupMetrics {
    return { ...this.metrics };
  }

  /**
   * Get execution history
   */
  public getExecutionHistory(limit: number = 20): WarmupExecution[] {
    return this.executions.slice(-limit);
  }

  /**
   * Get strategy schedule
   */
  public getSchedule(): WarmupSchedule {
    const strategies = Array.from(this.strategies.values());
    
    return {
      immediate: strategies.filter(s => s.schedule === 'immediate'),
      startup: strategies.filter(s => s.schedule === 'startup'),
      periodic: strategies.filter(s => s.schedule === 'periodic'),
      onDemand: strategies.filter(s => s.schedule === 'on-demand'),
    };
  }

  // ====================
  // PRIVATE METHODS
  // ====================

  private async checkDependencies(strategy: WarmupStrategy): Promise<void> {
    for (const dependency of strategy.dependencies) {
      const depStrategy = this.strategies.get(dependency);
      if (!depStrategy) {
        throw new Error(`Dependency strategy not found: ${dependency}`);
      }

      const status = this.metrics.strategiesStatus[dependency];
      if (status !== 'completed') {
        throw new Error(`Dependency strategy ${dependency} is not completed (status: ${status})`);
      }
    }
  }

  private async warmupPattern(pattern: string): Promise<{ attempted: number; warmed: number }> {
    try {
      console.log(`🔥 Warming pattern: ${pattern}`);
      
      // Get keys matching the pattern
      const keys = await executeRedisCommand<string[]>('keys', [pattern]);
      
      if (!keys || keys.length === 0) {
        console.log(`📭 No keys found for pattern: ${pattern}`);
        return { attempted: 0, warmed: 0 };
      }

      const attempted = keys.length;
      let warmed = 0;

      // Warm up keys in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        
        const promises = batch.map(async (key) => {
          try {
            // Extract namespace and key from full Redis key
            const parts = key.split(':');
            const namespace = parts[0];
            const cacheKey = parts.slice(1).join(':');
            
            // Warm up the key by getting it
            const value = await cacheManager.get(cacheKey, { namespace });
            return value !== null;
          } catch (error) {
            console.warn(`⚠️ Failed to warm key ${key}:`, error);
            return false;
          }
        });

        const results = await Promise.allSettled(promises);
        warmed += results.filter(result => 
          result.status === 'fulfilled' && result.value
        ).length;

        // Small delay between batches
        if (i + batchSize < keys.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`✅ Warmed ${warmed}/${attempted} keys for pattern: ${pattern}`);
      return { attempted, warmed };
    } catch (error) {
      console.error(`❌ Failed to warm pattern ${pattern}:`, error);
      throw error;
    }
  }

  private async collectWarmupMetrics(): Promise<WarmupExecution['metrics']> {
    try {
      const cacheStats = cacheManager.getStats();
      
      return {
        avgResponseTime: cacheStats.avgResponseTime,
        cacheHitRate: cacheStats.hitRate,
        memoryUsage: cacheStats.memoryUsage,
      };
    } catch (error) {
      console.warn('⚠️ Failed to collect warmup metrics:', error);
      return {
        avgResponseTime: 0,
        cacheHitRate: 0,
        memoryUsage: 0,
      };
    }
  }

  private updateMetrics(execution: WarmupExecution): void {
    this.metrics.totalExecutions++;
    this.metrics.totalKeysWarmed += execution.keysWarmed;
    this.metrics.totalDuration += (execution.endTime - execution.startTime);
    this.metrics.lastExecution = execution.endTime;

    if (execution.success) {
      this.metrics.successfulExecutions++;
    } else {
      this.metrics.failedExecutions++;
    }

    this.metrics.averageDuration = this.metrics.totalDuration / this.metrics.totalExecutions;
    this.metrics.successRate = (this.metrics.successfulExecutions / this.metrics.totalExecutions) * 100;
  }

  private scheduleStrategy(strategy: WarmupStrategy): void {
    // Clear existing schedule
    const existingJob = this.scheduledJobs.get(strategy.name);
    if (existingJob) {
      clearInterval(existingJob);
    }

    // Calculate interval based on priority and estimated duration
    let interval: number;
    
    if (strategy.priority <= 2) {
      interval = 30 * 60 * 1000; // 30 minutes for high priority
    } else if (strategy.priority <= 4) {
      interval = 60 * 60 * 1000; // 1 hour for medium priority
    } else {
      interval = 2 * 60 * 60 * 1000; // 2 hours for low priority
    }

    // Schedule the strategy
    const job = setInterval(async () => {
      try {
        if (!this.runningStrategies.has(strategy.name)) {
          await this.executeStrategy(strategy);
        }
      } catch (error) {
        console.error(`❌ Scheduled warmup failed for ${strategy.name}:`, error);
      }
    }, interval);

    this.scheduledJobs.set(strategy.name, job);
    console.log(`📅 Scheduled strategy ${strategy.name} to run every ${interval / 1000 / 60} minutes`);
  }

  /**
   * Stop all scheduled warmup jobs
   */
  public stopScheduledWarmup(): void {
    for (const [strategyName, job] of this.scheduledJobs) {
      clearInterval(job);
      console.log(`🛑 Stopped scheduled warmup for ${strategyName}`);
    }
    this.scheduledJobs.clear();
  }

  /**
   * Shutdown the warmup manager
   */
  public shutdown(): void {
    this.stopScheduledWarmup();
    this.runningStrategies.clear();
    console.log('✅ Cache warming manager shutdown complete');
  }
}

// ====================
// SINGLETON INSTANCE
// ====================

export const cacheWarming = CacheWarmingManager.getInstance();

// ====================
// CONVENIENCE FUNCTIONS
// ====================

/**
 * Execute startup warmup
 */
export async function executeStartupWarmup(): Promise<WarmupMetrics> {
  return cacheWarming.executeStartupWarmup();
}

/**
 * Schedule periodic warmup
 */
export function schedulePeriodicWarmup(): void {
  return cacheWarming.schedulePeriodicWarmup();
}

/**
 * Execute on-demand warmup
 */
export async function executeOnDemandWarmup(patterns: string[]): Promise<WarmupExecution> {
  return cacheWarming.executeOnDemandWarmup(patterns);
}

/**
 * Get warmup metrics
 */
export function getWarmupMetrics(): WarmupMetrics {
  return cacheWarming.getMetrics();
}

/**
 * Stop warmup
 */
export function stopWarmup(): void {
  return cacheWarming.shutdown();
}

export default cacheWarming;