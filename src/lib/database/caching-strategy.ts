import { createHash } from 'crypto';
import { getCurrentEnvironment, getEnvironmentSettings } from './config';

// Types for caching strategy
interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  size: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  memoryUsage: number;
  hitRate: number;
}

interface CacheConfig {
  maxMemoryMB: number;
  defaultTTL: number;
  maxKeyLength: number;
  enableCompression: boolean;
  enableStats: boolean;
  evictionPolicy: 'LRU' | 'LFU' | 'TTL';
}

// Multi-level caching system
export class DatabaseCachingStrategy {
  private static instance: DatabaseCachingStrategy;
  private memoryCache = new Map<string, CacheEntry>();
  private accessOrder = new Map<string, number>(); // For LRU
  private accessTime = 0;
  
  // Configuration
  private readonly config: CacheConfig;
  private readonly environment = getCurrentEnvironment();
  private readonly settings = getEnvironmentSettings(this.environment);
  
  // Statistics
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    memoryUsage: 0,
    hitRate: 0,
  };

  // Cache patterns for different data types
  private readonly cachePatterns = {
    // User data - long TTL, high priority
    user: { ttl: 1800, priority: 'high' },
    userProfile: { ttl: 900, priority: 'high' },
    userPreferences: { ttl: 600, priority: 'medium' },
    
    // Learning data - medium TTL
    learningProfile: { ttl: 300, priority: 'high' },
    paceProfile: { ttl: 300, priority: 'high' },
    learningStyles: { ttl: 600, priority: 'medium' },
    
    // Content data - long TTL, cacheable
    content: { ttl: 3600, priority: 'medium' },
    contentVariants: { ttl: 1800, priority: 'medium' },
    assessments: { ttl: 1800, priority: 'medium' },
    questions: { ttl: 3600, priority: 'low' },
    
    // Session data - short TTL
    sessions: { ttl: 300, priority: 'low' },
    attempts: { ttl: 600, priority: 'low' },
    
    // Analytics - medium TTL
    analytics: { ttl: 900, priority: 'medium' },
    recommendations: { ttl: 300, priority: 'medium' },
    
    // System data - long TTL
    config: { ttl: 7200, priority: 'high' },
    
    // Query results - short TTL
    queryResult: { ttl: 180, priority: 'low' },
  };

  private constructor() {
    this.config = this.getEnvironmentConfig();
    this.setupCacheMonitoring();
  }

  public static getInstance(): DatabaseCachingStrategy {
    if (!DatabaseCachingStrategy.instance) {
      DatabaseCachingStrategy.instance = new DatabaseCachingStrategy();
    }
    return DatabaseCachingStrategy.instance;
  }

  private getEnvironmentConfig(): CacheConfig {
    const configs = {
      development: {
        maxMemoryMB: 64,
        defaultTTL: 300,
        maxKeyLength: 250,
        enableCompression: false,
        enableStats: true,
        evictionPolicy: 'LRU' as const,
      },
      staging: {
        maxMemoryMB: 128,
        defaultTTL: 600,
        maxKeyLength: 250,
        enableCompression: true,
        enableStats: true,
        evictionPolicy: 'LRU' as const,
      },
      production: {
        maxMemoryMB: 256,
        defaultTTL: 900,
        maxKeyLength: 250,
        enableCompression: true,
        enableStats: true,
        evictionPolicy: 'LRU' as const,
      },
      test: {
        maxMemoryMB: 32,
        defaultTTL: 60,
        maxKeyLength: 250,
        enableCompression: false,
        enableStats: false,
        evictionPolicy: 'LRU' as const,
      },
    };

    return configs[this.environment];
  }

  private setupCacheMonitoring(): void {
    if (!this.config.enableStats) return;

    // Update stats every 30 seconds
    setInterval(() => {
      this.updateStats();
    }, 30000);

    // Log cache performance every 5 minutes
    setInterval(() => {
      const stats = this.getStats();
      console.log('[Cache] Performance Stats:', {
        hitRate: `${stats.hitRate.toFixed(2)}%`,
        memoryUsage: `${(stats.memoryUsage / 1024 / 1024).toFixed(2)} MB`,
        totalKeys: this.memoryCache.size,
        hits: stats.hits,
        misses: stats.misses,
      });
    }, 300000);

    // Cleanup expired entries every minute
    setInterval(() => {
      this.cleanupExpired();
    }, 60000);
  }

  // Cache key generation
  public generateCacheKey(
    type: keyof typeof this.cachePatterns,
    identifier: string | number,
    params?: Record<string, any>
  ): string {
    const baseKey = `${type}:${identifier}`;
    
    if (params) {
      const paramString = Object.keys(params)
        .sort()
        .map(key => `${key}=${JSON.stringify(params[key])}`)
        .join('&');
      
      const paramHash = createHash('md5').update(paramString).digest('hex').substring(0, 8);
      return `${baseKey}:${paramHash}`;
    }
    
    return baseKey;
  }

  // Cache operations
  public async get<T = any>(key: string): Promise<T | null> {
    if (key.length > this.config.maxKeyLength) {
      key = this.hashLongKey(key);
    }

    const entry = this.memoryCache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.timestamp + entry.ttl * 1000) {
      this.memoryCache.delete(key);
      this.accessOrder.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access tracking
    entry.hits++;
    this.accessOrder.set(key, this.accessTime++);
    this.stats.hits++;

    return entry.data as T;
  }

  public async set<T = any>(
    key: string,
    data: T,
    options: {
      ttl?: number;
      type?: keyof typeof this.cachePatterns;
      priority?: 'high' | 'medium' | 'low';
    } = {}
  ): Promise<void> {
    if (key.length > this.config.maxKeyLength) {
      key = this.hashLongKey(key);
    }

    const { type, priority } = options;
    let { ttl } = options;

    // Use pattern-based TTL if type is specified
    if (type && this.cachePatterns[type]) {
      ttl = ttl || this.cachePatterns[type].ttl;
    } else {
      ttl = ttl || this.config.defaultTTL;
    }

    // Calculate entry size
    const entrySize = this.calculateSize(data);
    
    // Check memory limits and evict if necessary
    await this.ensureMemoryLimit(entrySize);

    // Create cache entry
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      size: entrySize,
    };

    this.memoryCache.set(key, entry);
    this.accessOrder.set(key, this.accessTime++);
    this.stats.sets++;
    this.updateMemoryUsage();
  }

  public async delete(key: string): Promise<boolean> {
    if (key.length > this.config.maxKeyLength) {
      key = this.hashLongKey(key);
    }

    const existed = this.memoryCache.has(key);
    this.memoryCache.delete(key);
    this.accessOrder.delete(key);
    
    if (existed) {
      this.stats.deletes++;
      this.updateMemoryUsage();
    }

    return existed;
  }

  public async clear(): Promise<void> {
    this.memoryCache.clear();
    this.accessOrder.clear();
    this.stats.memoryUsage = 0;
  }

  // Specialized cache methods for common database patterns
  public async cacheUser(userId: string, userData: any): Promise<void> {
    await this.set(`user:${userId}`, userData, { type: 'user' });
  }

  public async getCachedUser(userId: string): Promise<any | null> {
    return this.get(`user:${userId}`);
  }

  public async cacheUserProfile(userId: string, profile: any): Promise<void> {
    await this.set(`userProfile:${userId}`, profile, { type: 'userProfile' });
  }

  public async getCachedUserProfile(userId: string): Promise<any | null> {
    return this.get(`userProfile:${userId}`);
  }

  public async cacheContent(contentId: string, content: any): Promise<void> {
    await this.set(`content:${contentId}`, content, { type: 'content' });
  }

  public async getCachedContent(contentId: string): Promise<any | null> {
    return this.get(`content:${contentId}`);
  }

  public async cacheQueryResult(
    queryHash: string,
    result: any,
    ttl?: number
  ): Promise<void> {
    await this.set(
      `query:${queryHash}`,
      result,
      { type: 'queryResult', ttl }
    );
  }

  public async getCachedQueryResult(queryHash: string): Promise<any | null> {
    return this.get(`query:${queryHash}`);
  }

  public async cacheLearningSession(
    sessionId: string,
    session: any
  ): Promise<void> {
    await this.set(`session:${sessionId}`, session, { type: 'sessions' });
  }

  public async getCachedLearningSession(sessionId: string): Promise<any | null> {
    return this.get(`session:${sessionId}`);
  }

  public async cacheRecommendations(
    userId: string,
    recommendations: any[]
  ): Promise<void> {
    await this.set(
      `recommendations:${userId}`,
      recommendations,
      { type: 'recommendations' }
    );
  }

  public async getCachedRecommendations(userId: string): Promise<any[] | null> {
    return this.get(`recommendations:${userId}`);
  }

  // Cache invalidation patterns
  public async invalidateUserCache(userId: string): Promise<void> {
    const patterns = [
      `user:${userId}`,
      `userProfile:${userId}`,
      `userPreferences:${userId}`,
      `learningProfile:${userId}`,
      `paceProfile:${userId}`,
      `recommendations:${userId}`,
    ];

    for (const pattern of patterns) {
      await this.delete(pattern);
    }
  }

  public async invalidateContentCache(contentId: string): Promise<void> {
    const patterns = [
      `content:${contentId}`,
      `contentVariants:${contentId}`,
    ];

    for (const pattern of patterns) {
      await this.delete(pattern);
    }
  }

  public async invalidateSessionCache(sessionId: string): Promise<void> {
    await this.delete(`session:${sessionId}`);
  }

  // Cache warming for frequently accessed data
  public async warmCache(): Promise<void> {
    console.log('[Cache] Starting cache warming...');
    
    try {
      // This would be implemented with actual database queries
      // For now, we'll just log the warming process
      console.log('[Cache] Cache warming completed');
    } catch (error) {
      console.error('[Cache] Cache warming failed:', error);
    }
  }

  // Memory management
  private async ensureMemoryLimit(newEntrySize: number): Promise<void> {
    const maxMemoryBytes = this.config.maxMemoryMB * 1024 * 1024;
    const currentMemory = this.stats.memoryUsage;
    
    if (currentMemory + newEntrySize <= maxMemoryBytes) {
      return;
    }

    // Evict entries based on policy
    const targetMemory = maxMemoryBytes * 0.8; // Keep 80% after eviction
    
    while (this.stats.memoryUsage > targetMemory) {
      const evicted = this.evictEntry();
      if (!evicted) break;
    }
  }

  private evictEntry(): boolean {
    if (this.memoryCache.size === 0) return false;

    let keyToEvict: string | null = null;

    switch (this.config.evictionPolicy) {
      case 'LRU':
        keyToEvict = this.findLRUKey();
        break;
      case 'LFU':
        keyToEvict = this.findLFUKey();
        break;
      case 'TTL':
        keyToEvict = this.findShortestTTLKey();
        break;
    }

    if (keyToEvict) {
      this.memoryCache.delete(keyToEvict);
      this.accessOrder.delete(keyToEvict);
      this.stats.evictions++;
      this.updateMemoryUsage();
      return true;
    }

    return false;
  }

  private findLRUKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, accessTime] of this.accessOrder) {
      if (accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  private findLFUKey(): string | null {
    let leastUsedKey: string | null = null;
    let leastHits = Infinity;

    for (const [key, entry] of this.memoryCache) {
      if (entry.hits < leastHits) {
        leastHits = entry.hits;
        leastUsedKey = key;
      }
    }

    return leastUsedKey;
  }

  private findShortestTTLKey(): string | null {
    let shortestTTLKey: string | null = null;
    let shortestRemainingTime = Infinity;
    const now = Date.now();

    for (const [key, entry] of this.memoryCache) {
      const remainingTime = (entry.timestamp + entry.ttl * 1000) - now;
      if (remainingTime < shortestRemainingTime) {
        shortestRemainingTime = remainingTime;
        shortestTTLKey = key;
      }
    }

    return shortestTTLKey;
  }

  private cleanupExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.memoryCache) {
      if (now > entry.timestamp + entry.ttl * 1000) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.memoryCache.delete(key);
      this.accessOrder.delete(key);
    }

    if (expiredKeys.length > 0) {
      this.updateMemoryUsage();
    }
  }

  // Utility methods
  private calculateSize(data: any): number {
    return JSON.stringify(data).length * 2; // Rough estimate in bytes
  }

  private hashLongKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  private updateMemoryUsage(): void {
    let totalSize = 0;
    for (const entry of this.memoryCache.values()) {
      totalSize += entry.size;
    }
    this.stats.memoryUsage = totalSize;
  }

  private updateStats(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  // Public API for monitoring
  public getStats(): CacheStats {
    return { ...this.stats };
  }

  public getCacheInfo(): {
    size: number;
    memoryUsage: string;
    hitRate: string;
    topKeys: Array<{ key: string; hits: number; size: number }>;
  } {
    const topKeys = Array.from(this.memoryCache.entries())
      .map(([key, entry]) => ({
        key: key.substring(0, 50),
        hits: entry.hits,
        size: entry.size,
      }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10);

    return {
      size: this.memoryCache.size,
      memoryUsage: `${(this.stats.memoryUsage / 1024 / 1024).toFixed(2)} MB`,
      hitRate: `${this.stats.hitRate.toFixed(2)}%`,
      topKeys,
    };
  }

  public async healthCheck(): Promise<{
    healthy: boolean;
    memoryUsage: number;
    hitRate: number;
    size: number;
  }> {
    const maxMemoryBytes = this.config.maxMemoryMB * 1024 * 1024;
    const memoryHealthy = this.stats.memoryUsage < maxMemoryBytes * 0.9;
    const hitRateHealthy = this.stats.hitRate > 50 || this.stats.hits + this.stats.misses < 100;

    return {
      healthy: memoryHealthy && hitRateHealthy,
      memoryUsage: this.stats.memoryUsage,
      hitRate: this.stats.hitRate,
      size: this.memoryCache.size,
    };
  }
}

// Export singleton instance
export const cacheStrategy = DatabaseCachingStrategy.getInstance();

// Convenience functions
export const cacheUser = (userId: string, userData: any) => 
  cacheStrategy.cacheUser(userId, userData);

export const getCachedUser = (userId: string) => 
  cacheStrategy.getCachedUser(userId);

export const cacheContent = (contentId: string, content: any) => 
  cacheStrategy.cacheContent(contentId, content);

export const getCachedContent = (contentId: string) => 
  cacheStrategy.getCachedContent(contentId);

export const invalidateUserCache = (userId: string) => 
  cacheStrategy.invalidateUserCache(userId);

export const getCacheStats = () => 
  cacheStrategy.getStats();

export const getCacheInfo = () => 
  cacheStrategy.getCacheInfo();

// Query result caching wrapper
export function withCache<T>(
  key: string,
  queryFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    try {
      // Try to get from cache first
      const cached = await cacheStrategy.get<T>(key);
      if (cached !== null) {
        resolve(cached);
        return;
      }

      // Execute query
      const result = await queryFn();
      
      // Cache the result
      await cacheStrategy.set(key, result, { ttl });
      
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
}