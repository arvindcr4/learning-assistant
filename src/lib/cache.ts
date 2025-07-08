import { redisManager, executeRedisCommand } from './redis-client';
import { env } from './env-validation';
import LZString from 'lz-string';
import { compressionManager, CompressionResult } from './cache-compression';

// ====================
// TYPES AND INTERFACES
// ====================

export interface CacheOptions {
  ttl?: number;
  compress?: boolean;
  compressThreshold?: number;
  namespace?: string;
  tags?: string[];
  version?: string;
}

export interface CacheEntry<T = any> {
  data: T;
  metadata: {
    key: string;
    namespace: string;
    tags: string[];
    version: string;
    compressed: boolean;
    compressionResult?: CompressionResult;
    createdAt: number;
    expiresAt: number;
    hits: number;
    lastAccessed: number;
    size: number;
    originalSize?: number;
  };
}

export interface CacheStats {
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
}

export interface CacheKeyPattern {
  pattern: string;
  description: string;
  ttl: number;
  namespace: string;
  tags: string[];
}

export type CacheLevel = 'L1' | 'L2' | 'L3';

export interface MultiLevelCacheConfig {
  levels: {
    [key in CacheLevel]?: {
      enabled: boolean;
      ttl: number;
      maxSize?: number;
      evictionPolicy?: 'lru' | 'lfu' | 'fifo';
    };
  };
}

// ====================
// CACHE MANAGER CLASS
// ====================

export class CacheManager {
  private static instance: CacheManager;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private stats: CacheStats = {
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
  private keyPatterns: Map<string, CacheKeyPattern> = new Map();
  private compressionEnabled: boolean;
  private compressionThreshold: number;
  private defaultTTL: number;
  private ttlConfig: {
    short: number;
    medium: number;
    long: number;
    default: number;
  };

  private constructor() {
    this.compressionEnabled = env.CACHE_COMPRESSION_ENABLED;
    this.compressionThreshold = env.CACHE_COMPRESSION_THRESHOLD;
    this.defaultTTL = env.CACHE_TTL_DEFAULT;
    this.ttlConfig = {
      short: env.CACHE_TTL_SHORT,
      medium: env.CACHE_TTL_MEDIUM,
      long: env.CACHE_TTL_LONG,
      default: env.CACHE_TTL_DEFAULT,
    };
    
    this.initializeKeyPatterns();
    this.startCleanupJob();
  }

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  private initializeKeyPatterns(): void {
    // Define cache key patterns for different data types
    this.keyPatterns.set('user:profile', {
      pattern: 'user:profile:{userId}',
      description: 'User learning profiles',
      ttl: this.ttlConfig.medium,
      namespace: 'users',
      tags: ['user', 'profile'],
    });

    this.keyPatterns.set('user:session', {
      pattern: 'user:session:{userId}:{sessionId}',
      description: 'Learning sessions',
      ttl: this.ttlConfig.short,
      namespace: 'sessions',
      tags: ['user', 'session'],
    });

    this.keyPatterns.set('content:adaptive', {
      pattern: 'content:adaptive:{contentId}',
      description: 'Adaptive learning content',
      ttl: this.ttlConfig.long,
      namespace: 'content',
      tags: ['content', 'adaptive'],
    });

    this.keyPatterns.set('content:variant', {
      pattern: 'content:variant:{contentId}:{userId}',
      description: 'User-specific content variants',
      ttl: this.ttlConfig.medium,
      namespace: 'content',
      tags: ['content', 'variant', 'user'],
    });

    this.keyPatterns.set('analytics:user', {
      pattern: 'analytics:user:{userId}',
      description: 'User analytics data',
      ttl: this.ttlConfig.short,
      namespace: 'analytics',
      tags: ['analytics', 'user'],
    });

    this.keyPatterns.set('recommendations:user', {
      pattern: 'recommendations:user:{userId}',
      description: 'Personalized recommendations',
      ttl: this.ttlConfig.short,
      namespace: 'recommendations',
      tags: ['recommendations', 'user'],
    });

    this.keyPatterns.set('assessment:result', {
      pattern: 'assessment:result:{assessmentId}:{userId}',
      description: 'Assessment results',
      ttl: this.ttlConfig.long,
      namespace: 'assessments',
      tags: ['assessment', 'result', 'user'],
    });

    this.keyPatterns.set('rate:limit', {
      pattern: 'rate:limit:{type}:{identifier}',
      description: 'Rate limiting counters',
      ttl: this.ttlConfig.short,
      namespace: 'limits',
      tags: ['rate', 'limit'],
    });
  }

  /**
   * Get a value from cache
   */
  public async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const startTime = Date.now();
    const fullKey = this.buildKey(key, options.namespace);

    try {
      // Try L1 cache (memory) first
      const memoryResult = this.getFromMemory<T>(fullKey);
      if (memoryResult !== null) {
        this.updateStats(Date.now() - startTime, true);
        return memoryResult;
      }

      // Try L2 cache (Redis)
      const redisResult = await this.getFromRedis<T>(fullKey);
      if (redisResult !== null) {
        // Store in memory cache for faster access
        this.setInMemory(fullKey, redisResult, options);
        this.updateStats(Date.now() - startTime, true);
        return redisResult;
      }

      this.updateStats(Date.now() - startTime, false);
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      this.updateStats(Date.now() - startTime, false);
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  public async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    const startTime = Date.now();
    const fullKey = this.buildKey(key, options.namespace);

    try {
      // Set in both L1 and L2 cache
      const memorySuccess = this.setInMemory(fullKey, value, options);
      const redisSuccess = await this.setInRedis(fullKey, value, options);

      this.stats.sets++;
      this.updateStats(Date.now() - startTime, true);
      return memorySuccess && redisSuccess;
    } catch (error) {
      console.error('Cache set error:', error);
      this.updateStats(Date.now() - startTime, false);
      return false;
    }
  }

  /**
   * Delete a value from cache
   */
  public async delete(key: string, options: CacheOptions = {}): Promise<boolean> {
    const startTime = Date.now();
    const fullKey = this.buildKey(key, options.namespace);

    try {
      // Delete from both L1 and L2 cache
      const memorySuccess = this.deleteFromMemory(fullKey);
      const redisSuccess = await this.deleteFromRedis(fullKey);

      this.stats.deletes++;
      this.updateStats(Date.now() - startTime, true);
      return memorySuccess || redisSuccess;
    } catch (error) {
      console.error('Cache delete error:', error);
      this.updateStats(Date.now() - startTime, false);
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  public async deleteByPattern(pattern: string, options: CacheOptions = {}): Promise<number> {
    const startTime = Date.now();
    const fullPattern = this.buildKey(pattern, options.namespace);

    try {
      let deletedCount = 0;

      // Delete from memory cache
      for (const [key] of this.memoryCache) {
        if (this.matchesPattern(key, fullPattern)) {
          this.deleteFromMemory(key);
          deletedCount++;
        }
      }

      // Delete from Redis
      const redisKeys = await executeRedisCommand<string[]>('keys', [fullPattern]);
      if (redisKeys && redisKeys.length > 0) {
        const redisDeletedCount = await executeRedisCommand<number>('del', redisKeys);
        deletedCount += redisDeletedCount || 0;
      }

      this.stats.deletes += deletedCount;
      this.updateStats(Date.now() - startTime, true);
      return deletedCount;
    } catch (error) {
      console.error('Cache delete by pattern error:', error);
      this.updateStats(Date.now() - startTime, false);
      return 0;
    }
  }

  /**
   * Delete by tags
   */
  public async deleteByTags(tags: string[], options: CacheOptions = {}): Promise<number> {
    const startTime = Date.now();
    let deletedCount = 0;

    try {
      // Delete from memory cache
      for (const [key, entry] of this.memoryCache) {
        if (this.hasAnyTag(entry.metadata.tags, tags)) {
          this.deleteFromMemory(key);
          deletedCount++;
        }
      }

      // For Redis, we need to maintain a separate index of tags
      // This is a simplified implementation
      for (const tag of tags) {
        const tagKey = this.buildKey(`tag:${tag}`, options.namespace);
        const taggedKeys = await executeRedisCommand<string[]>('smembers', [tagKey]);
        
        if (taggedKeys && taggedKeys.length > 0) {
          const redisDeletedCount = await executeRedisCommand<number>('del', taggedKeys);
          deletedCount += redisDeletedCount || 0;
          
          // Remove the tag set
          await executeRedisCommand('del', [tagKey]);
        }
      }

      this.stats.deletes += deletedCount;
      this.updateStats(Date.now() - startTime, true);
      return deletedCount;
    } catch (error) {
      console.error('Cache delete by tags error:', error);
      this.updateStats(Date.now() - startTime, false);
      return 0;
    }
  }

  /**
   * Check if key exists in cache
   */
  public async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    const fullKey = this.buildKey(key, options.namespace);

    try {
      // Check memory cache first
      if (this.memoryCache.has(fullKey)) {
        const entry = this.memoryCache.get(fullKey);
        if (entry && entry.metadata.expiresAt > Date.now()) {
          return true;
        }
      }

      // Check Redis
      const exists = await executeRedisCommand<number>('exists', [fullKey]);
      return exists === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Get TTL for a key
   */
  public async getTTL(key: string, options: CacheOptions = {}): Promise<number> {
    const fullKey = this.buildKey(key, options.namespace);

    try {
      // Check memory cache first
      if (this.memoryCache.has(fullKey)) {
        const entry = this.memoryCache.get(fullKey);
        if (entry) {
          return Math.max(0, entry.metadata.expiresAt - Date.now());
        }
      }

      // Check Redis
      const ttl = await executeRedisCommand<number>('ttl', [fullKey]);
      return ttl || 0;
    } catch (error) {
      console.error('Cache TTL error:', error);
      return 0;
    }
  }

  /**
   * Extend TTL for a key
   */
  public async extendTTL(key: string, ttl: number, options: CacheOptions = {}): Promise<boolean> {
    const fullKey = this.buildKey(key, options.namespace);

    try {
      // Update memory cache
      if (this.memoryCache.has(fullKey)) {
        const entry = this.memoryCache.get(fullKey);
        if (entry) {
          entry.metadata.expiresAt = Date.now() + (ttl * 1000);
        }
      }

      // Update Redis
      const success = await executeRedisCommand<number>('expire', [fullKey, ttl]);
      return success === 1;
    } catch (error) {
      console.error('Cache extend TTL error:', error);
      return false;
    }
  }

  /**
   * Get multiple keys at once
   */
  public async getMultiple<T>(keys: string[], options: CacheOptions = {}): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();
    const startTime = Date.now();

    try {
      // Try to get from memory cache first
      const memoryMisses: string[] = [];
      for (const key of keys) {
        const fullKey = this.buildKey(key, options.namespace);
        const memoryResult = this.getFromMemory<T>(fullKey);
        
        if (memoryResult !== null) {
          result.set(key, memoryResult);
        } else {
          memoryMisses.push(key);
        }
      }

      // Get remaining keys from Redis
      if (memoryMisses.length > 0) {
        const redisKeys = memoryMisses.map(key => this.buildKey(key, options.namespace));
        const redisResults = await executeRedisCommand<(string | null)[]>('mget', redisKeys);
        
        if (redisResults) {
          for (let i = 0; i < memoryMisses.length; i++) {
            const key = memoryMisses[i];
            const redisResult = redisResults[i];
            
            if (redisResult !== null) {
              const parsed = this.deserializeValue<T>(redisResult);
              result.set(key, parsed);
              
              // Store in memory cache
              this.setInMemory(redisKeys[i], parsed, options);
            } else {
              result.set(key, null);
            }
          }
        }
      }

      this.updateStats(Date.now() - startTime, true);
      return result;
    } catch (error) {
      console.error('Cache get multiple error:', error);
      this.updateStats(Date.now() - startTime, false);
      return result;
    }
  }

  /**
   * Set multiple keys at once
   */
  public async setMultiple<T>(entries: Map<string, T>, options: CacheOptions = {}): Promise<boolean> {
    const startTime = Date.now();

    try {
      // Set in memory cache
      for (const [key, value] of entries) {
        const fullKey = this.buildKey(key, options.namespace);
        this.setInMemory(fullKey, value, options);
      }

      // Set in Redis
      const redisEntries: string[] = [];
      for (const [key, value] of entries) {
        const fullKey = this.buildKey(key, options.namespace);
        const serialized = this.serializeValue(value, options);
        redisEntries.push(fullKey, serialized);
      }

      if (redisEntries.length > 0) {
        await executeRedisCommand('mset', redisEntries);
        
        // Set TTL for each key
        const ttl = options.ttl || this.defaultTTL;
        for (const [key] of entries) {
          const fullKey = this.buildKey(key, options.namespace);
          await executeRedisCommand('expire', [fullKey, ttl]);
        }
      }

      this.stats.sets += entries.size;
      this.updateStats(Date.now() - startTime, true);
      return true;
    } catch (error) {
      console.error('Cache set multiple error:', error);
      this.updateStats(Date.now() - startTime, false);
      return false;
    }
  }

  /**
   * Increment a numeric value
   */
  public async increment(key: string, amount: number = 1, options: CacheOptions = {}): Promise<number> {
    const fullKey = this.buildKey(key, options.namespace);

    try {
      // Use Redis for atomic increment
      const result = await executeRedisCommand<number>('incrby', [fullKey, amount]);
      
      if (result !== null) {
        // Set TTL if this is a new key
        const ttl = options.ttl || this.defaultTTL;
        await executeRedisCommand('expire', [fullKey, ttl]);
        
        // Update memory cache
        this.setInMemory(fullKey, result, options);
        
        return result;
      }
      
      return 0;
    } catch (error) {
      console.error('Cache increment error:', error);
      return 0;
    }
  }

  /**
   * Decrement a numeric value
   */
  public async decrement(key: string, amount: number = 1, options: CacheOptions = {}): Promise<number> {
    return this.increment(key, -amount, options);
  }

  // ====================
  // PRIVATE METHODS
  // ====================

  private getFromMemory<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.metadata.expiresAt <= Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }

    // Update access metadata
    entry.metadata.hits++;
    entry.metadata.lastAccessed = Date.now();
    
    return entry.data as T;
  }

  private async setInMemory<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    try {
      const ttl = options.ttl || this.defaultTTL;
      const shouldCompress = this.shouldCompress(value, options);
      
      let finalData: T = value;
      let compressionResult: CompressionResult | undefined;
      let originalSize = this.calculateSize(value);
      
      if (shouldCompress) {
        try {
          const serialized = await this.serializeValue(value, options);
          if (serialized.compressionResult) {
            finalData = serialized.data as T;
            compressionResult = serialized.compressionResult;
          } else {
            finalData = this.compressValue(value) as T;
          }
        } catch (error) {
          console.warn('⚠️ Compression failed, storing uncompressed:', error);
          finalData = value;
        }
      }
      
      const entry: CacheEntry<T> = {
        data: finalData,
        metadata: {
          key,
          namespace: options.namespace || 'default',
          tags: options.tags || [],
          version: options.version || '1.0',
          compressed: shouldCompress,
          compressionResult,
          createdAt: Date.now(),
          expiresAt: Date.now() + (ttl * 1000),
          hits: 0,
          lastAccessed: Date.now(),
          size: this.calculateSize(finalData),
          originalSize,
        },
      };

      this.memoryCache.set(key, entry);
      return true;
    } catch (error) {
      console.error('Memory cache set error:', error);
      return false;
    }
  }

  private deleteFromMemory(key: string): boolean {
    return this.memoryCache.delete(key);
  }

  private async getFromRedis<T>(key: string): Promise<T | null> {
    try {
      const result = await executeRedisCommand<string>('get', [key]);
      
      if (result === null) {
        return null;
      }

      return this.deserializeValue<T>(result);
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  private async setInRedis<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    try {
      const serialized = this.serializeValue(value, options);
      const ttl = options.ttl || this.defaultTTL;
      
      const result = await executeRedisCommand<string>('setex', [key, ttl, serialized]);
      
      // Add to tag sets if tags are provided
      if (options.tags && options.tags.length > 0) {
        for (const tag of options.tags) {
          const tagKey = this.buildKey(`tag:${tag}`, options.namespace);
          await executeRedisCommand('sadd', [tagKey, key]);
          await executeRedisCommand('expire', [tagKey, ttl + 3600]); // Tag index expires later
        }
      }
      
      return result === 'OK';
    } catch (error) {
      console.error('Redis set error:', error);
      return false;
    }
  }

  private async deleteFromRedis(key: string): Promise<boolean> {
    try {
      const result = await executeRedisCommand<number>('del', [key]);
      return result === 1;
    } catch (error) {
      console.error('Redis delete error:', error);
      return false;
    }
  }

  private async serializeValue<T>(value: T, options: CacheOptions = {}): Promise<{ data: string; compressionResult?: CompressionResult }> {
    try {
      const json = JSON.stringify(value);
      
      if (this.shouldCompress(value, options)) {
        try {
          const compressionResult = await compressionManager.compress(json);
          return {
            data: typeof compressionResult.data === 'string' ? compressionResult.data : compressionResult.data.toString('base64'),
            compressionResult,
          };
        } catch (error) {
          console.warn('⚠️ Advanced compression failed, falling back to LZ-String:', error);
          const compressed = LZString.compress(json);
          return {
            data: compressed || json,
          };
        }
      }
      
      return { data: json };
    } catch (error) {
      console.error('Serialization error:', error);
      return { data: JSON.stringify(null) };
    }
  }

  private async deserializeValue<T>(value: string | CacheEntry<T>): Promise<T | null> {
    try {
      // Handle new format with compression metadata
      if (typeof value === 'object' && value.metadata?.compressionResult) {
        try {
          const decompressed = await compressionManager.decompress(value.metadata.compressionResult);
          return JSON.parse(decompressed) as T;
        } catch (error) {
          console.warn('⚠️ Advanced decompression failed:', error);
        }
      }

      // Handle string value (legacy or uncompressed)
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      // Try legacy LZ-String decompression
      let json = stringValue;
      try {
        const decompressed = LZString.decompress(stringValue);
        if (decompressed) {
          json = decompressed;
        }
      } catch {
        // If decompression fails, assume it's not compressed
      }
      
      return JSON.parse(json) as T;
    } catch (error) {
      console.error('Deserialization error:', error);
      return null;
    }
  }

  private shouldCompress<T>(value: T, options: CacheOptions = {}): boolean {
    if (!this.compressionEnabled || options.compress === false) {
      return false;
    }

    const size = this.calculateSize(value);
    const threshold = options.compressThreshold || this.compressionThreshold;
    
    return size > threshold;
  }

  private compressValue<T>(value: T): string {
    try {
      const json = JSON.stringify(value);
      return LZString.compress(json) || json;
    } catch (error) {
      console.error('Compression error:', error);
      return JSON.stringify(value);
    }
  }

  private calculateSize(value: any): number {
    try {
      return Buffer.byteLength(JSON.stringify(value), 'utf8');
    } catch {
      return 0;
    }
  }

  private buildKey(key: string, namespace?: string): string {
    const ns = namespace || 'default';
    return `${ns}:${key}`;
  }

  private matchesPattern(key: string, pattern: string): boolean {
    const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
    return regex.test(key);
  }

  private hasAnyTag(entryTags: string[], searchTags: string[]): boolean {
    return searchTags.some(tag => entryTags.includes(tag));
  }

  private updateStats(responseTime: number, success: boolean): void {
    if (success) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    
    const totalOps = this.stats.hits + this.stats.misses;
    if (totalOps > 0) {
      this.stats.hitRate = (this.stats.hits / totalOps) * 100;
      this.stats.avgResponseTime = (this.stats.avgResponseTime * (totalOps - 1) + responseTime) / totalOps;
    }
    
    this.stats.totalKeys = this.memoryCache.size;
  }

  private startCleanupJob(): void {
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 5 * 60 * 1000);
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, entry] of this.memoryCache) {
      if (entry.metadata.expiresAt <= now) {
        this.memoryCache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired cache entries`);
      this.stats.evictions += cleanedCount;
    }
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    // Update dynamic stats
    this.stats.totalKeys = this.memoryCache.size;
    this.stats.totalSize = Array.from(this.memoryCache.values())
      .reduce((sum, entry) => sum + entry.metadata.size, 0);
    this.stats.memoryUsage = process.memoryUsage().heapUsed;
    
    return { ...this.stats };
  }

  /**
   * Clear all cache entries
   */
  public async clear(namespace?: string): Promise<void> {
    try {
      if (namespace) {
        // Clear specific namespace
        const pattern = `${namespace}:*`;
        
        // Clear from memory
        for (const [key] of this.memoryCache) {
          if (key.startsWith(`${namespace}:`)) {
            this.memoryCache.delete(key);
          }
        }
        
        // Clear from Redis
        await this.deleteByPattern(pattern);
      } else {
        // Clear all
        this.memoryCache.clear();
        await executeRedisCommand('flushdb');
      }
      
      console.log(`🧹 Cache cleared${namespace ? ` for namespace: ${namespace}` : ''}`);
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Warm up cache with frequently accessed data
   */
  public async warmup(patterns: string[]): Promise<void> {
    console.log('🔥 Starting cache warmup...');
    
    try {
      for (const pattern of patterns) {
        const keys = await executeRedisCommand<string[]>('keys', [pattern]);
        if (keys && keys.length > 0) {
          console.log(`🔥 Warming up ${keys.length} keys for pattern: ${pattern}`);
          
          // Batch load keys into memory cache
          const values = await executeRedisCommand<(string | null)[]>('mget', keys);
          if (values) {
            for (let i = 0; i < keys.length; i++) {
              const key = keys[i];
              const value = values[i];
              
              if (value !== null) {
                const parsed = this.deserializeValue(value);
                if (parsed !== null) {
                  this.setInMemory(key, parsed);
                }
              }
            }
          }
        }
      }
      
      console.log('✅ Cache warmup completed');
    } catch (error) {
      console.error('❌ Cache warmup failed:', error);
    }
  }

  /**
   * Get cache key patterns
   */
  public getKeyPatterns(): Map<string, CacheKeyPattern> {
    return new Map(this.keyPatterns);
  }

  /**
   * Register a new key pattern
   */
  public registerKeyPattern(name: string, pattern: CacheKeyPattern): void {
    this.keyPatterns.set(name, pattern);
  }
}

// ====================
// SINGLETON INSTANCE
// ====================

export const cacheManager = CacheManager.getInstance();

// ====================
// CONVENIENCE FUNCTIONS
// ====================

/**
 * Get a value from cache
 */
export async function get<T>(key: string, options?: CacheOptions): Promise<T | null> {
  return cacheManager.get<T>(key, options);
}

/**
 * Set a value in cache
 */
export async function set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
  return cacheManager.set(key, value, options);
}

/**
 * Delete a value from cache
 */
export async function del(key: string, options?: CacheOptions): Promise<boolean> {
  return cacheManager.delete(key, options);
}

/**
 * Check if key exists
 */
export async function exists(key: string, options?: CacheOptions): Promise<boolean> {
  return cacheManager.exists(key, options);
}

/**
 * Get cache statistics
 */
export function getStats(): CacheStats {
  return cacheManager.getStats();
}

/**
 * Clear cache
 */
export async function clear(namespace?: string): Promise<void> {
  return cacheManager.clear(namespace);
}

/**
 * Warm up cache
 */
export async function warmup(patterns: string[]): Promise<void> {
  return cacheManager.warmup(patterns);
}

export default cacheManager;