import { redisManager, CacheMetrics } from '../redis-client';
import { cacheManager, CacheOptions, CacheStats } from '../cache';
import { env } from '../env-validation';
import { executeRedisCommand } from '../redis-client';
import LZString from 'lz-string';

// ====================
// TYPES AND INTERFACES
// ====================

export interface DistributedCacheConfig {
  keyPrefix: string;
  defaultTTL: number;
  enableCompression: boolean;
  compressionThreshold: number;
  enableDistribution: boolean;
  consistencyLevel: 'eventual' | 'strong' | 'session';
  replicationFactor: number;
  shardingStrategy: 'hash' | 'range' | 'directory';
  failoverStrategy: 'manual' | 'automatic';
  maxRetries: number;
}

export interface CacheOperation {
  id: string;
  type: 'get' | 'set' | 'delete' | 'exists' | 'expire';
  key: string;
  value?: any;
  options?: CacheOptions;
  timestamp: number;
  success: boolean;
  duration: number;
  retry: number;
  error?: string;
  metadata: {
    size: number;
    compressed: boolean;
    shard?: string;
    node?: string;
  };
}

export interface CacheShard {
  id: string;
  name: string;
  nodeIds: string[];
  keyPattern: string;
  weight: number;
  status: 'active' | 'degraded' | 'offline';
  isHealthy: boolean;
  lastHealthCheck: number;
  metrics: {
    operations: number;
    hits: number;
    misses: number;
    errors: number;
    avgResponseTime: number;
    load: number;
  };
}

export interface CacheNode {
  id: string;
  host: string;
  port: number;
  role: 'master' | 'replica' | 'sentinel';
  shard: string;
  status: 'connected' | 'disconnected' | 'reconnecting';
  priority: number;
  lastSeen: number;
  metrics: {
    connections: number;
    memory: number;
    operations: number;
    latency: number;
  };
}

export interface CacheReplicationConfig {
  enabled: boolean;
  syncMode: 'sync' | 'async';
  replicas: number;
  readPreference: 'primary' | 'secondary' | 'nearest';
  writeConsistency: 'majority' | 'all' | 'any';
  backupEnabled: boolean;
  backupSchedule: string;
}

export interface DistributedCacheMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  avgResponseTime: number;
  hitRate: number;
  missRate: number;
  compressionRatio: number;
  networkLatency: number;
  shardMetrics: { [shardId: string]: CacheShard };
  nodeMetrics: { [nodeId: string]: CacheNode };
  replicationLag: number;
  consistencyScore: number;
}

export type CachePatternStrategy = 
  | 'cache-aside' 
  | 'write-through' 
  | 'write-behind' 
  | 'refresh-ahead'
  | 'read-through';

// ====================
// DISTRIBUTED CACHE SERVICE
// ====================

export class DistributedCacheService {
  private static instance: DistributedCacheService;
  private config: DistributedCacheConfig;
  private operations: Map<string, CacheOperation> = new Map();
  private shards: Map<string, CacheShard> = new Map();
  private nodes: Map<string, CacheNode> = new Map();
  private replicationConfig: CacheReplicationConfig;
  private metrics: DistributedCacheMetrics;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsCollectionInterval: NodeJS.Timeout | null = null;
  private replicationMonitorInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.config = {
      keyPrefix: env.REDIS_KEY_PREFIX || 'learning-assistant',
      defaultTTL: env.CACHE_TTL_DEFAULT,
      enableCompression: env.CACHE_COMPRESSION_ENABLED,
      compressionThreshold: env.CACHE_COMPRESSION_THRESHOLD,
      enableDistribution: env.REDIS_CLUSTER_ENABLED,
      consistencyLevel: 'eventual',
      replicationFactor: 2,
      shardingStrategy: 'hash',
      failoverStrategy: 'automatic',
      maxRetries: 3,
    };

    this.replicationConfig = {
      enabled: env.REDIS_CLUSTER_ENABLED,
      syncMode: 'async',
      replicas: 2,
      readPreference: 'primary',
      writeConsistency: 'majority',
      backupEnabled: true,
      backupSchedule: '0 2 * * *', // Daily at 2 AM
    };

    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      avgResponseTime: 0,
      hitRate: 0,
      missRate: 0,
      compressionRatio: 0,
      networkLatency: 0,
      shardMetrics: {},
      nodeMetrics: {},
      replicationLag: 0,
      consistencyScore: 100,
    };

    this.initializeSharding();
    this.startHealthMonitoring();
    this.startMetricsCollection();
    this.startReplicationMonitoring();
  }

  public static getInstance(): DistributedCacheService {
    if (!DistributedCacheService.instance) {
      DistributedCacheService.instance = new DistributedCacheService();
    }
    return DistributedCacheService.instance;
  }

  // ====================
  // DISTRIBUTED CACHE OPERATIONS
  // ====================

  /**
   * Get value with distributed caching support
   */
  public async get<T>(
    key: string, 
    options: CacheOptions & { 
      strategy?: CachePatternStrategy;
      readFromReplica?: boolean;
    } = {}
  ): Promise<T | null> {
    const operationId = this.generateOperationId();
    const operation = this.initializeOperation(operationId, 'get', key, undefined, options);
    
    try {
      const fullKey = this.buildDistributedKey(key, options.namespace);
      const shard = this.selectShard(fullKey);
      
      if (!shard || shard.status === 'offline') {
        throw new Error(`Shard unavailable for key: ${key}`);
      }

      let result: T | null = null;
      
      // Choose read strategy based on configuration
      if (options.readFromReplica && this.replicationConfig.readPreference === 'secondary') {
        result = await this.readFromReplica<T>(fullKey, shard, options);
      } else {
        result = await this.readFromPrimary<T>(fullKey, shard, options);
      }

      // Apply cache pattern strategy
      if (!result && options.strategy === 'read-through') {
        result = await this.readThroughFallback<T>(key, options);
      }

      this.completeOperation(operation, true, result !== null);
      return result;
    } catch (error) {
      this.completeOperation(operation, false, false, (error as Error).message);
      
      // Attempt failover if enabled
      if (this.config.failoverStrategy === 'automatic') {
        return this.failoverRead<T>(key, options);
      }
      
      throw error;
    }
  }

  /**
   * Set value with distributed caching support
   */
  public async set<T>(
    key: string,
    value: T,
    options: CacheOptions & { 
      strategy?: CachePatternStrategy;
      writeToReplicas?: boolean;
      consistency?: 'eventual' | 'strong';
    } = {}
  ): Promise<boolean> {
    const operationId = this.generateOperationId();
    const operation = this.initializeOperation(operationId, 'set', key, value, options);
    
    try {
      const fullKey = this.buildDistributedKey(key, options.namespace);
      const shard = this.selectShard(fullKey);
      
      if (!shard || shard.status === 'offline') {
        throw new Error(`Shard unavailable for key: ${key}`);
      }

      // Compress value if needed
      const { processedValue, metadata } = await this.processValueForStorage(value, options);
      operation.metadata = { ...operation.metadata, ...metadata };

      // Apply cache pattern strategy
      let success = false;
      
      switch (options.strategy) {
        case 'write-through':
          success = await this.writeThroughStrategy(fullKey, processedValue, shard, options);
          break;
        case 'write-behind':
          success = await this.writeBehindStrategy(fullKey, processedValue, shard, options);
          break;
        default:
          success = await this.writeToPrimary(fullKey, processedValue, shard, options);
      }

      // Replicate to other nodes if needed
      if (success && (options.writeToReplicas ?? this.replicationConfig.enabled)) {
        await this.replicateToSecondaries(fullKey, processedValue, shard, options);
      }

      this.completeOperation(operation, success, true);
      return success;
    } catch (error) {
      this.completeOperation(operation, false, false, (error as Error).message);
      
      // Attempt failover if enabled
      if (this.config.failoverStrategy === 'automatic') {
        return this.failoverWrite(key, value, options);
      }
      
      throw error;
    }
  }

  /**
   * Delete value with distributed caching support
   */
  public async delete(
    key: string,
    options: CacheOptions & { 
      deleteFromReplicas?: boolean;
    } = {}
  ): Promise<boolean> {
    const operationId = this.generateOperationId();
    const operation = this.initializeOperation(operationId, 'delete', key, undefined, options);
    
    try {
      const fullKey = this.buildDistributedKey(key, options.namespace);
      const shard = this.selectShard(fullKey);
      
      if (!shard || shard.status === 'offline') {
        throw new Error(`Shard unavailable for key: ${key}`);
      }

      // Delete from primary
      const success = await this.deleteFromPrimary(fullKey, shard, options);

      // Delete from replicas if needed
      if (success && (options.deleteFromReplicas ?? this.replicationConfig.enabled)) {
        await this.deleteFromReplicas(fullKey, shard, options);
      }

      this.completeOperation(operation, success, true);
      return success;
    } catch (error) {
      this.completeOperation(operation, false, false, (error as Error).message);
      throw error;
    }
  }

  /**
   * Check if key exists with distributed support
   */
  public async exists(
    key: string,
    options: CacheOptions = {}
  ): Promise<boolean> {
    const operationId = this.generateOperationId();
    const operation = this.initializeOperation(operationId, 'exists', key, undefined, options);
    
    try {
      const fullKey = this.buildDistributedKey(key, options.namespace);
      const shard = this.selectShard(fullKey);
      
      if (!shard || shard.status === 'offline') {
        return false;
      }

      const exists = await executeRedisCommand<number>('exists', [fullKey]);
      const result = exists === 1;

      this.completeOperation(operation, true, result);
      return result;
    } catch (error) {
      this.completeOperation(operation, false, false, (error as Error).message);
      return false;
    }
  }

  /**
   * Extend TTL for distributed keys
   */
  public async expire(
    key: string,
    ttl: number,
    options: CacheOptions = {}
  ): Promise<boolean> {
    const operationId = this.generateOperationId();
    const operation = this.initializeOperation(operationId, 'expire', key, ttl, options);
    
    try {
      const fullKey = this.buildDistributedKey(key, options.namespace);
      const shard = this.selectShard(fullKey);
      
      if (!shard || shard.status === 'offline') {
        throw new Error(`Shard unavailable for key: ${key}`);
      }

      const success = await executeRedisCommand<number>('expire', [fullKey, ttl]);
      const result = success === 1;

      this.completeOperation(operation, true, result);
      return result;
    } catch (error) {
      this.completeOperation(operation, false, false, (error as Error).message);
      return false;
    }
  }

  // ====================
  // BATCH OPERATIONS
  // ====================

  /**
   * Get multiple keys efficiently
   */
  public async mget<T>(keys: string[], options: CacheOptions = {}): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();
    
    // Group keys by shard for efficient batch operations
    const shardGroups = this.groupKeysByShard(keys, options.namespace);
    
    const promises = Array.from(shardGroups.entries()).map(async ([shardId, shardKeys]) => {
      const shard = this.shards.get(shardId);
      if (!shard || shard.status === 'offline') {
        // Mark all keys in this shard as null
        shardKeys.forEach(key => result.set(key, null));
        return;
      }

      try {
        const fullKeys = shardKeys.map(key => this.buildDistributedKey(key, options.namespace));
        const values = await executeRedisCommand<(string | null)[]>('mget', fullKeys);
        
        if (values) {
          shardKeys.forEach((key, index) => {
            const value = values[index];
            if (value !== null) {
              try {
                const parsed = this.deserializeValue<T>(value);
                result.set(key, parsed);
              } catch (error) {
                console.warn(`Failed to deserialize value for key ${key}:`, error);
                result.set(key, null);
              }
            } else {
              result.set(key, null);
            }
          });
        }
      } catch (error) {
        console.error(`Batch get failed for shard ${shardId}:`, error);
        shardKeys.forEach(key => result.set(key, null));
      }
    });

    await Promise.allSettled(promises);
    return result;
  }

  /**
   * Set multiple keys efficiently
   */
  public async mset<T>(
    entries: Map<string, T>,
    options: CacheOptions = {}
  ): Promise<boolean> {
    // Group entries by shard
    const shardGroups = new Map<string, Map<string, T>>();
    
    for (const [key, value] of entries) {
      const fullKey = this.buildDistributedKey(key, options.namespace);
      const shard = this.selectShard(fullKey);
      
      if (shard && shard.status !== 'offline') {
        if (!shardGroups.has(shard.id)) {
          shardGroups.set(shard.id, new Map());
        }
        shardGroups.get(shard.id)!.set(key, value);
      }
    }

    const promises = Array.from(shardGroups.entries()).map(async ([shardId, shardEntries]) => {
      try {
        const redisArgs: string[] = [];
        
        for (const [key, value] of shardEntries) {
          const fullKey = this.buildDistributedKey(key, options.namespace);
          const { processedValue } = await this.processValueForStorage(value, options);
          redisArgs.push(fullKey, processedValue);
        }

        await executeRedisCommand('mset', redisArgs);
        
        // Set TTL for each key if specified
        if (options.ttl) {
          const expirePromises = Array.from(shardEntries.keys()).map(key => {
            const fullKey = this.buildDistributedKey(key, options.namespace);
            return executeRedisCommand('expire', [fullKey, options.ttl!]);
          });
          await Promise.all(expirePromises);
        }
        
        return true;
      } catch (error) {
        console.error(`Batch set failed for shard ${shardId}:`, error);
        return false;
      }
    });

    const results = await Promise.allSettled(promises);
    return results.every(result => result.status === 'fulfilled' && result.value === true);
  }

  // ====================
  // PATTERN-BASED OPERATIONS
  // ====================

  /**
   * Delete keys by pattern across all shards
   */
  public async deleteByPattern(pattern: string, options: CacheOptions = {}): Promise<number> {
    const fullPattern = this.buildDistributedKey(pattern, options.namespace);
    let totalDeleted = 0;

    for (const shard of this.shards.values()) {
      if (shard.status === 'offline') continue;

      try {
        const keys = await executeRedisCommand<string[]>('keys', [fullPattern]);
        if (keys && keys.length > 0) {
          const deleted = await executeRedisCommand<number>('del', keys);
          totalDeleted += deleted || 0;
        }
      } catch (error) {
        console.error(`Pattern delete failed for shard ${shard.id}:`, error);
      }
    }

    return totalDeleted;
  }

  /**
   * Get keys by pattern across all shards
   */
  public async getKeysByPattern(pattern: string, options: CacheOptions = {}): Promise<string[]> {
    const fullPattern = this.buildDistributedKey(pattern, options.namespace);
    const allKeys: string[] = [];

    for (const shard of this.shards.values()) {
      if (shard.status === 'offline') continue;

      try {
        const keys = await executeRedisCommand<string[]>('keys', [fullPattern]);
        if (keys) {
          allKeys.push(...keys);
        }
      } catch (error) {
        console.error(`Pattern scan failed for shard ${shard.id}:`, error);
      }
    }

    return allKeys;
  }

  // ====================
  // DISTRIBUTED MONITORING
  // ====================

  /**
   * Get comprehensive distributed cache metrics
   */
  public getMetrics(): DistributedCacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Get shard information
   */
  public getShards(): Map<string, CacheShard> {
    return new Map(this.shards);
  }

  /**
   * Get node information
   */
  public getNodes(): Map<string, CacheNode> {
    return new Map(this.nodes);
  }

  /**
   * Get operation history
   */
  public getOperationHistory(limit: number = 100): CacheOperation[] {
    return Array.from(this.operations.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Check overall health of distributed cache
   */
  public async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    shards: { [id: string]: string };
    nodes: { [id: string]: string };
    replication: {
      enabled: boolean;
      lag: number;
      consistency: number;
    };
    metrics: DistributedCacheMetrics;
  }> {
    const healthyShards = Array.from(this.shards.values()).filter(s => s.status === 'active').length;
    const totalShards = this.shards.size;
    const healthyNodes = Array.from(this.nodes.values()).filter(n => n.status === 'connected').length;
    const totalNodes = this.nodes.size;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (healthyShards < totalShards * 0.5 || healthyNodes < totalNodes * 0.5) {
      status = 'unhealthy';
    } else if (healthyShards < totalShards * 0.8 || healthyNodes < totalNodes * 0.8) {
      status = 'degraded';
    }

    return {
      status,
      shards: Object.fromEntries(
        Array.from(this.shards.entries()).map(([id, shard]) => [id, shard.status])
      ),
      nodes: Object.fromEntries(
        Array.from(this.nodes.entries()).map(([id, node]) => [id, node.status])
      ),
      replication: {
        enabled: this.replicationConfig.enabled,
        lag: this.metrics.replicationLag,
        consistency: this.metrics.consistencyScore,
      },
      metrics: this.metrics,
    };
  }

  // ====================
  // PRIVATE METHODS
  // ====================

  private initializeSharding(): void {
    if (!this.config.enableDistribution) {
      // Single shard for non-distributed setup
      this.shards.set('main', {
        id: 'main',
        name: 'Main Shard',
        nodeIds: ['main'],
        keyPattern: '*',
        weight: 1.0,
        status: 'active',
        isHealthy: true,
        lastHealthCheck: Date.now(),
        metrics: {
          operations: 0,
          hits: 0,
          misses: 0,
          errors: 0,
          avgResponseTime: 0,
          load: 0,
        },
      });

      this.nodes.set('main', {
        id: 'main',
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        role: 'master',
        shard: 'main',
        status: 'connected',
        priority: 1,
        lastSeen: Date.now(),
        metrics: {
          connections: 0,
          memory: 0,
          operations: 0,
          latency: 0,
        },
      });
    } else {
      // Initialize multiple shards based on cluster configuration
      this.initializeClusterShards();
    }
  }

  private initializeClusterShards(): void {
    // This would be configured based on your Redis cluster setup
    const shardCount = 3; // Example: 3 shards
    
    for (let i = 0; i < shardCount; i++) {
      const shardId = `shard-${i}`;
      this.shards.set(shardId, {
        id: shardId,
        name: `Shard ${i}`,
        nodeIds: [`node-${i}-master`, `node-${i}-replica`],
        keyPattern: `*:${i}:*`,
        weight: 1.0 / shardCount,
        status: 'active',
        isHealthy: true,
        lastHealthCheck: Date.now(),
        metrics: {
          operations: 0,
          hits: 0,
          misses: 0,
          errors: 0,
          avgResponseTime: 0,
          load: 0,
        },
      });
    }
  }

  private selectShard(key: string): CacheShard | null {
    if (this.shards.size === 1) {
      return this.shards.get('main') || null;
    }

    // Hash-based sharding
    const hash = this.hashKey(key);
    const shardIndex = hash % this.shards.size;
    const shardId = `shard-${shardIndex}`;
    
    return this.shards.get(shardId) || null;
  }

  private hashKey(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private groupKeysByShard(keys: string[], namespace?: string): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    
    for (const key of keys) {
      const fullKey = this.buildDistributedKey(key, namespace);
      const shard = this.selectShard(fullKey);
      
      if (shard) {
        if (!groups.has(shard.id)) {
          groups.set(shard.id, []);
        }
        groups.get(shard.id)!.push(key);
      }
    }
    
    return groups;
  }

  private buildDistributedKey(key: string, namespace?: string): string {
    const ns = namespace || 'default';
    return `${this.config.keyPrefix}:${ns}:${key}`;
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeOperation(
    id: string,
    type: CacheOperation['type'],
    key: string,
    value?: any,
    options?: any
  ): CacheOperation {
    const operation: CacheOperation = {
      id,
      type,
      key,
      value,
      options,
      timestamp: Date.now(),
      success: false,
      duration: 0,
      retry: 0,
      metadata: {
        size: value ? this.calculateSize(value) : 0,
        compressed: false,
      },
    };

    this.operations.set(id, operation);
    return operation;
  }

  private completeOperation(
    operation: CacheOperation,
    success: boolean,
    hit: boolean,
    error?: string
  ): void {
    operation.success = success;
    operation.duration = Date.now() - operation.timestamp;
    if (error) operation.error = error;

    // Update metrics
    this.metrics.totalOperations++;
    if (success) {
      this.metrics.successfulOperations++;
      if (hit) {
        this.metrics.hitRate = (this.metrics.hitRate * (this.metrics.totalOperations - 1) + 100) / this.metrics.totalOperations;
      } else {
        this.metrics.missRate = (this.metrics.missRate * (this.metrics.totalOperations - 1) + 100) / this.metrics.totalOperations;
      }
    } else {
      this.metrics.failedOperations++;
    }

    this.metrics.avgResponseTime = (this.metrics.avgResponseTime * (this.metrics.totalOperations - 1) + operation.duration) / this.metrics.totalOperations;

    // Clean up old operations
    if (this.operations.size > 1000) {
      const oldestOperations = Array.from(this.operations.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)
        .slice(0, 500);
      
      oldestOperations.forEach(([id]) => this.operations.delete(id));
    }
  }

  private async processValueForStorage(value: any, options: CacheOptions): Promise<{
    processedValue: string;
    metadata: { size: number; compressed: boolean };
  }> {
    let processedValue = JSON.stringify(value);
    let compressed = false;
    const originalSize = Buffer.byteLength(processedValue, 'utf8');

    if (this.config.enableCompression && 
        originalSize > this.config.compressionThreshold) {
      try {
        const compressedValue = LZString.compress(processedValue);
        if (compressedValue && compressedValue.length < processedValue.length) {
          processedValue = compressedValue;
          compressed = true;
        }
      } catch (error) {
        console.warn('Compression failed:', error);
      }
    }

    const finalSize = Buffer.byteLength(processedValue, 'utf8');
    
    return {
      processedValue,
      metadata: {
        size: finalSize,
        compressed,
      },
    };
  }

  private deserializeValue<T>(value: string): T | null {
    try {
      // Try decompression first
      let jsonString = value;
      try {
        const decompressed = LZString.decompress(value);
        if (decompressed) {
          jsonString = decompressed;
        }
      } catch {
        // If decompression fails, assume it's not compressed
      }

      return JSON.parse(jsonString) as T;
    } catch (error) {
      console.error('Deserialization error:', error);
      return null;
    }
  }

  private calculateSize(value: any): number {
    try {
      return Buffer.byteLength(JSON.stringify(value), 'utf8');
    } catch {
      return 0;
    }
  }

  // Cache Pattern Implementations
  private async readFromPrimary<T>(
    key: string,
    shard: CacheShard,
    options: CacheOptions
  ): Promise<T | null> {
    const result = await executeRedisCommand<string>('get', [key]);
    return result ? this.deserializeValue<T>(result) : null;
  }

  private async readFromReplica<T>(
    key: string,
    shard: CacheShard,
    options: CacheOptions
  ): Promise<T | null> {
    // In a real implementation, this would read from replica nodes
    return this.readFromPrimary<T>(key, shard, options);
  }

  private async readThroughFallback<T>(
    key: string,
    options: CacheOptions
  ): Promise<T | null> {
    // This would implement read-through logic
    // For now, return null
    return null;
  }

  private async writeToPrimary(
    key: string,
    value: string,
    shard: CacheShard,
    options: CacheOptions
  ): Promise<boolean> {
    const ttl = options.ttl || this.config.defaultTTL;
    const result = await executeRedisCommand<string>('setex', [key, ttl, value]);
    return result === 'OK';
  }

  private async writeThroughStrategy(
    key: string,
    value: string,
    shard: CacheShard,
    options: CacheOptions
  ): Promise<boolean> {
    // Write-through: write to cache and database simultaneously
    const cacheSuccess = await this.writeToPrimary(key, value, shard, options);
    // TODO: Also write to database
    return cacheSuccess;
  }

  private async writeBehindStrategy(
    key: string,
    value: string,
    shard: CacheShard,
    options: CacheOptions
  ): Promise<boolean> {
    // Write-behind: write to cache immediately, database asynchronously
    const cacheSuccess = await this.writeToPrimary(key, value, shard, options);
    // TODO: Queue database write
    return cacheSuccess;
  }

  private async replicateToSecondaries(
    key: string,
    value: string,
    shard: CacheShard,
    options: CacheOptions
  ): Promise<void> {
    // In a real implementation, this would replicate to secondary nodes
    // For now, this is a placeholder
  }

  private async deleteFromPrimary(
    key: string,
    shard: CacheShard,
    options: CacheOptions
  ): Promise<boolean> {
    const result = await executeRedisCommand<number>('del', [key]);
    return result === 1;
  }

  private async deleteFromReplicas(
    key: string,
    shard: CacheShard,
    options: CacheOptions
  ): Promise<void> {
    // In a real implementation, this would delete from replica nodes
    // For now, this is a placeholder
  }

  private async failoverRead<T>(
    key: string,
    options: CacheOptions
  ): Promise<T | null> {
    // Implement failover logic
    console.warn(`Failover read attempted for key: ${key}`);
    return null;
  }

  private async failoverWrite<T>(
    key: string,
    value: T,
    options: CacheOptions
  ): Promise<boolean> {
    // Implement failover logic
    console.warn(`Failover write attempted for key: ${key}`);
    return false;
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 30000); // Every 30 seconds
  }

  private startMetricsCollection(): void {
    this.metricsCollectionInterval = setInterval(async () => {
      await this.collectMetrics();
    }, 60000); // Every minute
  }

  private startReplicationMonitoring(): void {
    if (!this.replicationConfig.enabled) return;

    this.replicationMonitorInterval = setInterval(async () => {
      await this.monitorReplication();
    }, 10000); // Every 10 seconds
  }

  private async performHealthChecks(): Promise<void> {
    for (const shard of this.shards.values()) {
      try {
        const startTime = Date.now();
        await executeRedisCommand('ping');
        const responseTime = Date.now() - startTime;
        
        shard.isHealthy = true;
        shard.status = 'active';
        shard.lastHealthCheck = Date.now();
        shard.metrics.avgResponseTime = responseTime;
      } catch (error) {
        shard.isHealthy = false;
        shard.status = 'offline';
        console.error(`Health check failed for shard ${shard.id}:`, error);
      }
    }
  }

  private async collectMetrics(): Promise<void> {
    try {
      // Collect Redis metrics
      const redisMetrics = redisManager.getMetrics();
      
      // Update distributed cache metrics
      this.metrics.networkLatency = redisMetrics.avgResponseTime || 0;
      this.metrics.compressionRatio = 0.3; // Estimated
      
      // Update shard metrics
      for (const shard of this.shards.values()) {
        this.metrics.shardMetrics[shard.id] = { ...shard };
      }
      
      // Update node metrics
      for (const node of this.nodes.values()) {
        this.metrics.nodeMetrics[node.id] = { ...node };
      }
    } catch (error) {
      console.error('Failed to collect distributed cache metrics:', error);
    }
  }

  private async monitorReplication(): Promise<void> {
    try {
      // Monitor replication lag and consistency
      // This would be implemented based on your Redis setup
      this.metrics.replicationLag = 0; // Placeholder
      this.metrics.consistencyScore = 100; // Placeholder
    } catch (error) {
      console.error('Replication monitoring failed:', error);
    }
  }

  /**
   * Shutdown the distributed cache service
   */
  public shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
    }
    if (this.replicationMonitorInterval) {
      clearInterval(this.replicationMonitorInterval);
    }
    
    console.log('✅ Distributed cache service shutdown complete');
  }
}

// ====================
// SINGLETON INSTANCE
// ====================

export const distributedCache = DistributedCacheService.getInstance();

// ====================
// CONVENIENCE FUNCTIONS
// ====================

/**
 * Get value with cache-aside pattern
 */
export async function getCacheAside<T>(
  key: string,
  fallbackFn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  // Try cache first
  let value = await distributedCache.get<T>(key, { ...options, strategy: 'cache-aside' });
  
  if (value === null) {
    // Cache miss - get from source
    value = await fallbackFn();
    
    // Store in cache
    await distributedCache.set(key, value, options);
  }
  
  return value;
}

/**
 * Set value with write-through pattern
 */
export async function setWriteThrough<T>(
  key: string,
  value: T,
  persistFn: (value: T) => Promise<void>,
  options: CacheOptions = {}
): Promise<boolean> {
  // Write to database first
  await persistFn(value);
  
  // Then write to cache
  return distributedCache.set(key, value, { ...options, strategy: 'write-through' });
}

/**
 * Set value with write-behind pattern
 */
export async function setWriteBehind<T>(
  key: string,
  value: T,
  options: CacheOptions = {}
): Promise<boolean> {
  // Write to cache immediately
  return distributedCache.set(key, value, { ...options, strategy: 'write-behind' });
}

export default distributedCache;