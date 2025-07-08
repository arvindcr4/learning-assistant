import { cacheManager } from './cache';
import { contentCache } from './content-cache';
import { sessionCache } from './session-cache';
import { executeRedisCommand } from './redis-client';
import { env } from './env-validation';

// ====================
// TYPES AND INTERFACES
// ====================

export interface InvalidationRule {
  id: string;
  name: string;
  description: string;
  triggers: InvalidationTrigger[];
  targets: InvalidationTarget[];
  strategy: InvalidationStrategy;
  cascade: boolean;
  priority: number;
  enabled: boolean;
  cooldown: number;
  lastTriggered: number;
  conditions: InvalidationCondition[];
}

export interface InvalidationTrigger {
  type: 'time' | 'event' | 'threshold' | 'dependency' | 'manual';
  condition: any;
  metadata: { [key: string]: any };
}

export interface InvalidationTarget {
  type: 'pattern' | 'tags' | 'namespace' | 'key' | 'user';
  value: string | string[];
  scope: 'local' | 'distributed' | 'all';
}

export interface InvalidationStrategy {
  mode: 'immediate' | 'lazy' | 'scheduled' | 'batch';
  batchSize?: number;
  delay?: number;
  retries?: number;
  gracePeriod?: number;
}

export interface InvalidationCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'nin' | 'regex';
  value: any;
  logical?: 'and' | 'or';
}

export interface InvalidationExecution {
  ruleId: string;
  triggerType: string;
  startTime: number;
  endTime: number;
  keysTargeted: number;
  keysInvalidated: number;
  success: boolean;
  error?: string;
  metrics: {
    duration: number;
    cacheHitRateBefore: number;
    cacheHitRateAfter: number;
    memoryFreed: number;
  };
}

export interface InvalidationMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalKeysInvalidated: number;
  totalMemoryFreed: number;
  averageDuration: number;
  successRate: number;
  lastExecution: number;
  ruleMetrics: { [ruleId: string]: RuleMetrics };
}

export interface RuleMetrics {
  executions: number;
  successes: number;
  failures: number;
  keysInvalidated: number;
  averageDuration: number;
  lastTriggered: number;
  effectiveness: number;
}

// ====================
// CACHE INVALIDATION MANAGER
// ====================

export class CacheInvalidationManager {
  private static instance: CacheInvalidationManager;
  private rules: Map<string, InvalidationRule> = new Map();
  private executions: InvalidationExecution[] = [];
  private metrics: InvalidationMetrics = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    totalKeysInvalidated: 0,
    totalMemoryFreed: 0,
    averageDuration: 0,
    successRate: 0,
    lastExecution: 0,
    ruleMetrics: {},
  };
  private eventListeners: Map<string, Function[]> = new Map();
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    this.initializeRules();
    this.startPeriodicChecks();
  }

  public static getInstance(): CacheInvalidationManager {
    if (!CacheInvalidationManager.instance) {
      CacheInvalidationManager.instance = new CacheInvalidationManager();
    }
    return CacheInvalidationManager.instance;
  }

  private initializeRules(): void {
    // User data invalidation rule
    this.rules.set('user_data_change', {
      id: 'user_data_change',
      name: 'User Data Change',
      description: 'Invalidate user-related cache when user data changes',
      triggers: [
        { type: 'event', condition: { event: 'user:profile:updated' }, metadata: {} },
        { type: 'event', condition: { event: 'user:preferences:changed' }, metadata: {} },
        { type: 'event', condition: { event: 'user:progress:updated' }, metadata: {} },
      ],
      targets: [
        { type: 'pattern', value: 'user:profile:{userId}', scope: 'distributed' },
        { type: 'pattern', value: 'user:preferences:{userId}', scope: 'distributed' },
        { type: 'pattern', value: 'analytics:user:{userId}', scope: 'distributed' },
        { type: 'tags', value: ['user:{userId}'], scope: 'distributed' },
      ],
      strategy: { mode: 'immediate' },
      cascade: true,
      priority: 1,
      enabled: true,
      cooldown: 1000,
      lastTriggered: 0,
      conditions: [],
    });

    // Content update invalidation rule
    this.rules.set('content_updated', {
      id: 'content_updated',
      name: 'Content Updated',
      description: 'Invalidate content cache when content is modified',
      triggers: [
        { type: 'event', condition: { event: 'content:updated' }, metadata: {} },
        { type: 'event', condition: { event: 'content:published' }, metadata: {} },
        { type: 'event', condition: { event: 'content:deleted' }, metadata: {} },
      ],
      targets: [
        { type: 'pattern', value: 'content:*:{contentId}', scope: 'all' },
        { type: 'pattern', value: 'adaptations:{contentId}:*', scope: 'all' },
        { type: 'tags', value: ['content:{contentId}'], scope: 'all' },
      ],
      strategy: { mode: 'immediate' },
      cascade: true,
      priority: 1,
      enabled: true,
      cooldown: 500,
      lastTriggered: 0,
      conditions: [],
    });

    // Session expiration rule
    this.rules.set('session_expired', {
      id: 'session_expired',
      name: 'Session Expired',
      description: 'Clean up expired session data',
      triggers: [
        { type: 'time', condition: { interval: 300000 }, metadata: {} }, // Every 5 minutes
        { type: 'threshold', condition: { metric: 'expired_sessions', threshold: 100 }, metadata: {} },
      ],
      targets: [
        { type: 'pattern', value: 'sessions:*', scope: 'distributed' },
      ],
      strategy: { mode: 'batch', batchSize: 50, delay: 1000 },
      cascade: false,
      priority: 3,
      enabled: true,
      cooldown: 60000,
      lastTriggered: 0,
      conditions: [
        { field: 'expiresAt', operator: 'lt', value: 'now' },
      ],
    });

    // Cache size threshold rule
    this.rules.set('cache_size_threshold', {
      id: 'cache_size_threshold',
      name: 'Cache Size Threshold',
      description: 'Invalidate least recently used items when cache size exceeds threshold',
      triggers: [
        { type: 'threshold', condition: { metric: 'memory_usage', threshold: 80 }, metadata: {} },
        { type: 'threshold', condition: { metric: 'cache_size', threshold: 1000000 }, metadata: {} },
      ],
      targets: [
        { type: 'pattern', value: '*', scope: 'local' },
      ],
      strategy: { mode: 'lazy', gracePeriod: 60000 },
      cascade: false,
      priority: 4,
      enabled: true,
      cooldown: 120000,
      lastTriggered: 0,
      conditions: [
        { field: 'lastAccessed', operator: 'lt', value: 'one_hour_ago' },
      ],
    });

    // Analytics refresh rule
    this.rules.set('analytics_refresh', {
      id: 'analytics_refresh',
      name: 'Analytics Refresh',
      description: 'Refresh analytics data periodically',
      triggers: [
        { type: 'time', condition: { interval: 1800000 }, metadata: {} }, // Every 30 minutes
      ],
      targets: [
        { type: 'namespace', value: 'analytics', scope: 'distributed' },
        { type: 'pattern', value: 'dashboard:*', scope: 'distributed' },
        { type: 'pattern', value: 'reports:*', scope: 'distributed' },
      ],
      strategy: { mode: 'scheduled', delay: 5000 },
      cascade: false,
      priority: 5,
      enabled: true,
      cooldown: 300000,
      lastTriggered: 0,
      conditions: [],
    });

    // Content popularity update rule
    this.rules.set('content_popularity', {
      id: 'content_popularity',
      name: 'Content Popularity Update',
      description: 'Update popular content cache based on access patterns',
      triggers: [
        { type: 'threshold', condition: { metric: 'content_views', threshold: 1000 }, metadata: {} },
        { type: 'time', condition: { interval: 3600000 }, metadata: {} }, // Every hour
      ],
      targets: [
        { type: 'pattern', value: 'content:popular:*', scope: 'all' },
        { type: 'pattern', value: 'content:trending:*', scope: 'all' },
        { type: 'tags', value: ['popular', 'trending'], scope: 'all' },
      ],
      strategy: { mode: 'batch', batchSize: 20, delay: 2000 },
      cascade: false,
      priority: 6,
      enabled: true,
      cooldown: 1800000,
      lastTriggered: 0,
      conditions: [],
    });

    // Initialize rule metrics
    for (const [ruleId] of this.rules) {
      this.metrics.ruleMetrics[ruleId] = {
        executions: 0,
        successes: 0,
        failures: 0,
        keysInvalidated: 0,
        averageDuration: 0,
        lastTriggered: 0,
        effectiveness: 0,
      };
    }
  }

  /**
   * Register an event listener for invalidation events
   */
  public onEvent(eventType: string, callback: Function): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(callback);
  }

  /**
   * Trigger an invalidation event
   */
  public async triggerEvent(eventType: string, eventData: any): Promise<void> {
    console.log(`🔔 Triggering invalidation event: ${eventType}`);
    
    // Find rules that match this event
    const matchingRules = Array.from(this.rules.values()).filter(rule =>
      rule.enabled && 
      rule.triggers.some(trigger => 
        trigger.type === 'event' && 
        trigger.condition.event === eventType
      )
    );

    // Execute matching rules
    for (const rule of matchingRules) {
      if (this.shouldExecuteRule(rule)) {
        await this.executeRule(rule, eventType, eventData);
      }
    }

    // Notify event listeners
    const listeners = this.eventListeners.get(eventType) || [];
    for (const listener of listeners) {
      try {
        listener(eventData);
      } catch (error) {
        console.error(`❌ Event listener error for ${eventType}:`, error);
      }
    }
  }

  /**
   * Manually trigger invalidation rule
   */
  public async executeRule(
    rule: InvalidationRule, 
    triggerType: string = 'manual',
    eventData: any = {}
  ): Promise<InvalidationExecution> {
    const execution: InvalidationExecution = {
      ruleId: rule.id,
      triggerType,
      startTime: Date.now(),
      endTime: 0,
      keysTargeted: 0,
      keysInvalidated: 0,
      success: false,
      metrics: {
        duration: 0,
        cacheHitRateBefore: 0,
        cacheHitRateAfter: 0,
        memoryFreed: 0,
      },
    };

    try {
      console.log(`🗑️ Executing invalidation rule: ${rule.name}`);
      
      // Collect pre-execution metrics
      execution.metrics.cacheHitRateBefore = await this.getCacheHitRate();
      const memoryBefore = await this.getMemoryUsage();

      // Execute invalidation based on strategy
      switch (rule.strategy.mode) {
        case 'immediate':
          await this.executeImmediate(rule, execution, eventData);
          break;
        case 'lazy':
          await this.executeLazy(rule, execution, eventData);
          break;
        case 'scheduled':
          await this.executeScheduled(rule, execution, eventData);
          break;
        case 'batch':
          await this.executeBatch(rule, execution, eventData);
          break;
      }

      // Collect post-execution metrics
      execution.metrics.cacheHitRateAfter = await this.getCacheHitRate();
      const memoryAfter = await this.getMemoryUsage();
      execution.metrics.memoryFreed = memoryBefore - memoryAfter;

      execution.success = true;
      rule.lastTriggered = Date.now();

      console.log(`✅ Rule ${rule.name} executed: ${execution.keysInvalidated} keys invalidated`);

    } catch (error) {
      execution.error = (error as Error).message;
      execution.success = false;
      console.error(`❌ Rule ${rule.name} failed:`, error);
    } finally {
      execution.endTime = Date.now();
      execution.metrics.duration = execution.endTime - execution.startTime;
      
      this.recordExecution(execution);
    }

    return execution;
  }

  /**
   * Get invalidation metrics
   */
  public getMetrics(): InvalidationMetrics {
    return { ...this.metrics };
  }

  /**
   * Get execution history
   */
  public getExecutionHistory(ruleId?: string, limit: number = 50): InvalidationExecution[] {
    let executions = this.executions;
    
    if (ruleId) {
      executions = executions.filter(exec => exec.ruleId === ruleId);
    }
    
    return executions.slice(-limit);
  }

  /**
   * Enable or disable a rule
   */
  public setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
      console.log(`${enabled ? '✅' : '🛑'} Rule ${rule.name} ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Add custom invalidation rule
   */
  public addRule(rule: InvalidationRule): void {
    this.rules.set(rule.id, rule);
    this.metrics.ruleMetrics[rule.id] = {
      executions: 0,
      successes: 0,
      failures: 0,
      keysInvalidated: 0,
      averageDuration: 0,
      lastTriggered: 0,
      effectiveness: 0,
    };
    console.log(`✅ Added custom invalidation rule: ${rule.name}`);
  }

  // ====================
  // PRIVATE METHODS
  // ====================

  private shouldExecuteRule(rule: InvalidationRule): boolean {
    // Check cooldown
    if (Date.now() - rule.lastTriggered < rule.cooldown) {
      return false;
    }

    // Check conditions if any
    if (rule.conditions.length > 0) {
      return this.evaluateConditions(rule.conditions);
    }

    return true;
  }

  private evaluateConditions(conditions: InvalidationCondition[]): boolean {
    // Simplified condition evaluation
    // In production, you'd implement proper expression evaluation
    return true;
  }

  private async executeImmediate(
    rule: InvalidationRule, 
    execution: InvalidationExecution,
    eventData: any
  ): Promise<void> {
    for (const target of rule.targets) {
      const invalidated = await this.invalidateTarget(target, eventData);
      execution.keysTargeted += invalidated.targeted;
      execution.keysInvalidated += invalidated.invalidated;
    }
  }

  private async executeLazy(
    rule: InvalidationRule, 
    execution: InvalidationExecution,
    eventData: any
  ): Promise<void> {
    // For lazy invalidation, mark keys for future cleanup
    for (const target of rule.targets) {
      await this.markForLazyInvalidation(target, rule.strategy.gracePeriod || 60000);
    }
  }

  private async executeScheduled(
    rule: InvalidationRule, 
    execution: InvalidationExecution,
    eventData: any
  ): Promise<void> {
    const delay = rule.strategy.delay || 0;
    
    setTimeout(async () => {
      for (const target of rule.targets) {
        const invalidated = await this.invalidateTarget(target, eventData);
        execution.keysTargeted += invalidated.targeted;
        execution.keysInvalidated += invalidated.invalidated;
      }
    }, delay);
  }

  private async executeBatch(
    rule: InvalidationRule, 
    execution: InvalidationExecution,
    eventData: any
  ): Promise<void> {
    const batchSize = rule.strategy.batchSize || 10;
    const delay = rule.strategy.delay || 100;

    for (const target of rule.targets) {
      const keys = await this.getKeysForTarget(target, eventData);
      
      // Process in batches
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        
        for (const key of batch) {
          try {
            await this.invalidateKey(key, target.scope);
            execution.keysInvalidated++;
          } catch (error) {
            console.warn(`⚠️ Failed to invalidate key ${key}:`, error);
          }
        }
        
        execution.keysTargeted += batch.length;
        
        // Delay between batches
        if (i + batchSize < keys.length) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
  }

  private async invalidateTarget(
    target: InvalidationTarget, 
    eventData: any
  ): Promise<{ targeted: number; invalidated: number }> {
    let targeted = 0;
    let invalidated = 0;

    try {
      switch (target.type) {
        case 'pattern':
          const patternValue = this.interpolateValue(target.value as string, eventData);
          invalidated = await cacheManager.deleteByPattern(patternValue);
          targeted = invalidated; // Approximation
          break;

        case 'tags':
          const tags = Array.isArray(target.value) ? target.value : [target.value as string];
          const interpolatedTags = tags.map(tag => this.interpolateValue(tag, eventData));
          invalidated = await cacheManager.deleteByTags(interpolatedTags);
          targeted = invalidated; // Approximation
          break;

        case 'namespace':
          await cacheManager.clear(target.value as string);
          invalidated = 1; // Approximation
          targeted = 1;
          break;

        case 'key':
          const keyValue = this.interpolateValue(target.value as string, eventData);
          const deleted = await cacheManager.delete(keyValue);
          invalidated = deleted ? 1 : 0;
          targeted = 1;
          break;

        case 'user':
          const userId = this.interpolateValue(target.value as string, eventData);
          invalidated = await this.invalidateUserData(userId);
          targeted = invalidated;
          break;
      }
    } catch (error) {
      console.error(`❌ Failed to invalidate target:`, error);
    }

    return { targeted, invalidated };
  }

  private interpolateValue(template: string, data: any): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return data[key] || match;
    });
  }

  private async getKeysForTarget(target: InvalidationTarget, eventData: any): Promise<string[]> {
    const value = this.interpolateValue(target.value as string, eventData);
    
    try {
      return await executeRedisCommand<string[]>('keys', [value]) || [];
    } catch (error) {
      console.error('❌ Failed to get keys for target:', error);
      return [];
    }
  }

  private async invalidateKey(key: string, scope: string): Promise<void> {
    const parts = key.split(':');
    const namespace = parts[0];
    const cacheKey = parts.slice(1).join(':');
    
    await cacheManager.delete(cacheKey, { namespace });
  }

  private async markForLazyInvalidation(target: InvalidationTarget, gracePeriod: number): Promise<void> {
    // Implementation would mark keys for lazy cleanup
    console.log(`📝 Marked target for lazy invalidation: ${JSON.stringify(target)}`);
  }

  private async invalidateUserData(userId: string): Promise<number> {
    let invalidated = 0;
    
    // Invalidate user sessions
    invalidated += await sessionCache.invalidateUserSessions(userId);
    
    // Invalidate user-specific content adaptations
    const userPattern = `adaptations:*:${userId}`;
    invalidated += await cacheManager.deleteByPattern(userPattern);
    
    // Invalidate user analytics
    const analyticsPattern = `analytics:user:${userId}`;
    invalidated += await cacheManager.deleteByPattern(analyticsPattern);
    
    return invalidated;
  }

  private async getCacheHitRate(): Promise<number> {
    try {
      const stats = cacheManager.getStats();
      return stats.hitRate;
    } catch (error) {
      return 0;
    }
  }

  private async getMemoryUsage(): Promise<number> {
    try {
      const stats = cacheManager.getStats();
      return stats.memoryUsage;
    } catch (error) {
      return 0;
    }
  }

  private recordExecution(execution: InvalidationExecution): void {
    this.executions.push(execution);
    
    // Keep only last 200 executions
    if (this.executions.length > 200) {
      this.executions = this.executions.slice(-100);
    }

    // Update metrics
    this.metrics.totalExecutions++;
    this.metrics.totalKeysInvalidated += execution.keysInvalidated;
    this.metrics.lastExecution = execution.endTime;

    if (execution.success) {
      this.metrics.successfulExecutions++;
    } else {
      this.metrics.failedExecutions++;
    }

    this.metrics.averageDuration = this.metrics.totalExecutions > 0 ?
      this.executions.reduce((sum, exec) => sum + exec.metrics.duration, 0) / this.executions.length : 0;

    this.metrics.successRate = this.metrics.totalExecutions > 0 ?
      (this.metrics.successfulExecutions / this.metrics.totalExecutions) * 100 : 0;

    // Update rule-specific metrics
    const ruleMetrics = this.metrics.ruleMetrics[execution.ruleId];
    if (ruleMetrics) {
      ruleMetrics.executions++;
      ruleMetrics.keysInvalidated += execution.keysInvalidated;
      ruleMetrics.lastTriggered = execution.endTime;

      if (execution.success) {
        ruleMetrics.successes++;
      } else {
        ruleMetrics.failures++;
      }

      ruleMetrics.averageDuration = ruleMetrics.executions > 0 ?
        this.executions
          .filter(exec => exec.ruleId === execution.ruleId)
          .reduce((sum, exec) => sum + exec.metrics.duration, 0) / ruleMetrics.executions : 0;

      ruleMetrics.effectiveness = ruleMetrics.executions > 0 ?
        ruleMetrics.keysInvalidated / ruleMetrics.executions : 0;
    }
  }

  private startPeriodicChecks(): void {
    // Check time-based triggers every minute
    setInterval(() => {
      this.checkTimeBasedTriggers();
    }, 60000);

    // Check threshold-based triggers every 5 minutes
    setInterval(() => {
      this.checkThresholdTriggers();
    }, 300000);
  }

  private async checkTimeBasedTriggers(): Promise<void> {
    const now = Date.now();
    
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      for (const trigger of rule.triggers) {
        if (trigger.type === 'time') {
          const interval = trigger.condition.interval;
          if (interval && (now - rule.lastTriggered) >= interval) {
            if (this.shouldExecuteRule(rule)) {
              await this.executeRule(rule, 'time');
            }
          }
        }
      }
    }
  }

  private async checkThresholdTriggers(): Promise<void> {
    const cacheStats = cacheManager.getStats();
    const sessionStats = await sessionCache.getSessionStats();
    
    const metrics = {
      memory_usage: (cacheStats.memoryUsage / (1024 * 1024 * 1024)) * 100, // Convert to percentage
      cache_size: cacheStats.totalSize,
      expired_sessions: sessionStats.expiredSessions,
      hit_rate: cacheStats.hitRate,
    };

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      for (const trigger of rule.triggers) {
        if (trigger.type === 'threshold') {
          const metric = trigger.condition.metric;
          const threshold = trigger.condition.threshold;
          
          if (metrics[metric as keyof typeof metrics] >= threshold) {
            if (this.shouldExecuteRule(rule)) {
              await this.executeRule(rule, 'threshold', { metric, value: metrics[metric as keyof typeof metrics] });
            }
          }
        }
      }
    }
  }

  /**
   * Shutdown the invalidation manager
   */
  public shutdown(): void {
    // Clear scheduled jobs
    for (const job of this.scheduledJobs.values()) {
      clearTimeout(job);
    }
    this.scheduledJobs.clear();
    
    // Clear event listeners
    this.eventListeners.clear();
    
    console.log('✅ Cache invalidation manager shutdown complete');
  }
}

// ====================
// SINGLETON INSTANCE
// ====================

export const cacheInvalidation = CacheInvalidationManager.getInstance();

// ====================
// CONVENIENCE FUNCTIONS
// ====================

/**
 * Trigger an invalidation event
 */
export async function triggerInvalidationEvent(eventType: string, eventData: any): Promise<void> {
  return cacheInvalidation.triggerEvent(eventType, eventData);
}

/**
 * Manually execute an invalidation rule
 */
export async function executeInvalidationRule(ruleId: string): Promise<InvalidationExecution> {
  const rule = cacheInvalidation['rules'].get(ruleId);
  if (!rule) {
    throw new Error(`Invalidation rule not found: ${ruleId}`);
  }
  return cacheInvalidation.executeRule(rule);
}

/**
 * Get invalidation metrics
 */
export function getInvalidationMetrics(): InvalidationMetrics {
  return cacheInvalidation.getMetrics();
}

/**
 * Enable or disable invalidation rule
 */
export function setInvalidationRuleEnabled(ruleId: string, enabled: boolean): void {
  return cacheInvalidation.setRuleEnabled(ruleId, enabled);
}

/**
 * Add custom invalidation rule
 */
export function addInvalidationRule(rule: InvalidationRule): void {
  return cacheInvalidation.addRule(rule);
}

export default cacheInvalidation;