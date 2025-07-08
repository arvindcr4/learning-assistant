import { distributedCache } from './distributed-cache-service';
import { CacheOptions } from '../cache';
import { env } from '../env-validation';

// ====================
// CACHE PATTERN IMPLEMENTATIONS
// ====================

export interface CachePatternConfig {
  ttl: number;
  refreshThreshold: number;
  staleWhileRevalidate: boolean;
  maxStaleTime: number;
  backgroundRefresh: boolean;
  fallbackTimeout: number;
  retryConfig: {
    attempts: number;
    backoffMs: number;
    maxBackoffMs: number;
  };
}

export interface DataSource<T> {
  load: (key: string) => Promise<T>;
  save?: (key: string, value: T) => Promise<void>;
  delete?: (key: string) => Promise<boolean>;
}

// ====================
// CACHE-ASIDE PATTERN
// ====================

export class CacheAsidePattern<T> {
  private config: CachePatternConfig;
  private dataSource: DataSource<T>;
  private namespace: string;

  constructor(
    dataSource: DataSource<T>,
    namespace: string,
    config: Partial<CachePatternConfig> = {}
  ) {
    this.dataSource = dataSource;
    this.namespace = namespace;
    this.config = {
      ttl: config.ttl || env.CACHE_TTL_DEFAULT,
      refreshThreshold: config.refreshThreshold || 0.8,
      staleWhileRevalidate: config.staleWhileRevalidate || false,
      maxStaleTime: config.maxStaleTime || 300000, // 5 minutes
      backgroundRefresh: config.backgroundRefresh || false,
      fallbackTimeout: config.fallbackTimeout || 5000,
      retryConfig: {
        attempts: config.retryConfig?.attempts || 3,
        backoffMs: config.retryConfig?.backoffMs || 100,
        maxBackoffMs: config.retryConfig?.maxBackoffMs || 5000,
      },
    };
  }

  async get(key: string): Promise<T | null> {
    try {
      // Try cache first
      const cached = await distributedCache.get<CachedValue<T>>(key, {
        namespace: this.namespace,
      });

      if (cached && !this.isExpired(cached)) {
        // Check if refresh is needed
        if (this.needsRefresh(cached) && this.config.backgroundRefresh) {
          // Background refresh without blocking
          this.backgroundRefresh(key).catch(error => 
            console.warn(`Background refresh failed for ${key}:`, error)
          );
        }
        return cached.value;
      }

      // Stale-while-revalidate pattern
      if (cached && this.config.staleWhileRevalidate && this.isStale(cached)) {
        // Return stale data immediately
        this.backgroundRefresh(key).catch(error => 
          console.warn(`Stale refresh failed for ${key}:`, error)
        );
        return cached.value;
      }

      // Cache miss or expired - load from source
      return await this.loadAndCache(key);
    } catch (error) {
      console.error(`Cache-aside get failed for ${key}:`, error);
      
      // Try to load directly from source as fallback
      try {
        return await this.dataSource.load(key);
      } catch (sourceError) {
        console.error(`Data source load failed for ${key}:`, sourceError);
        return null;
      }
    }
  }

  async set(key: string, value: T): Promise<boolean> {
    try {
      const cachedValue: CachedValue<T> = {
        value,
        cachedAt: Date.now(),
        expiresAt: Date.now() + (this.config.ttl * 1000),
        version: 1,
      };

      return await distributedCache.set(key, cachedValue, {
        namespace: this.namespace,
        ttl: this.config.ttl,
      });
    } catch (error) {
      console.error(`Cache-aside set failed for ${key}:`, error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      return await distributedCache.delete(key, {
        namespace: this.namespace,
      });
    } catch (error) {
      console.error(`Cache-aside delete failed for ${key}:`, error);
      return false;
    }
  }

  private async loadAndCache(key: string): Promise<T | null> {
    try {
      const value = await this.withRetry(() => this.dataSource.load(key));
      if (value !== null) {
        await this.set(key, value);
      }
      return value;
    } catch (error) {
      console.error(`Load and cache failed for ${key}:`, error);
      return null;
    }
  }

  private async backgroundRefresh(key: string): Promise<void> {
    try {
      const value = await this.dataSource.load(key);
      if (value !== null) {
        await this.set(key, value);
      }
    } catch (error) {
      console.error(`Background refresh failed for ${key}:`, error);
    }
  }

  private isExpired(cached: CachedValue<T>): boolean {
    return Date.now() > cached.expiresAt;
  }

  private needsRefresh(cached: CachedValue<T>): boolean {
    const age = Date.now() - cached.cachedAt;
    const maxAge = cached.expiresAt - cached.cachedAt;
    return age / maxAge > this.config.refreshThreshold;
  }

  private isStale(cached: CachedValue<T>): boolean {
    const staleSince = Date.now() - cached.expiresAt;
    return staleSince < this.config.maxStaleTime;
  }

  private async withRetry<U>(operation: () => Promise<U>): Promise<U> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.retryConfig.attempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === this.config.retryConfig.attempts) {
          throw lastError;
        }
        
        const backoff = Math.min(
          this.config.retryConfig.backoffMs * Math.pow(2, attempt - 1),
          this.config.retryConfig.maxBackoffMs
        );
        
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }
    
    throw lastError;
  }
}

// ====================
// WRITE-THROUGH PATTERN
// ====================

export class WriteThroughPattern<T> {
  private config: CachePatternConfig;
  private dataSource: DataSource<T>;
  private namespace: string;

  constructor(
    dataSource: DataSource<T>,
    namespace: string,
    config: Partial<CachePatternConfig> = {}
  ) {
    this.dataSource = dataSource;
    this.namespace = namespace;
    this.config = {
      ttl: config.ttl || env.CACHE_TTL_DEFAULT,
      refreshThreshold: config.refreshThreshold || 0.8,
      staleWhileRevalidate: config.staleWhileRevalidate || false,
      maxStaleTime: config.maxStaleTime || 300000,
      backgroundRefresh: config.backgroundRefresh || false,
      fallbackTimeout: config.fallbackTimeout || 5000,
      retryConfig: {
        attempts: config.retryConfig?.attempts || 3,
        backoffMs: config.retryConfig?.backoffMs || 100,
        maxBackoffMs: config.retryConfig?.maxBackoffMs || 5000,
      },
    };
  }

  async get(key: string): Promise<T | null> {
    try {
      const cached = await distributedCache.get<CachedValue<T>>(key, {
        namespace: this.namespace,
      });

      if (cached && !this.isExpired(cached)) {
        return cached.value;
      }

      // Cache miss - load from source
      const value = await this.dataSource.load(key);
      if (value !== null) {
        await this.set(key, value);
      }
      return value;
    } catch (error) {
      console.error(`Write-through get failed for ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: T): Promise<boolean> {
    try {
      // Write to data source first
      if (this.dataSource.save) {
        await this.dataSource.save(key, value);
      }

      // Then write to cache
      const cachedValue: CachedValue<T> = {
        value,
        cachedAt: Date.now(),
        expiresAt: Date.now() + (this.config.ttl * 1000),
        version: 1,
      };

      return await distributedCache.set(key, cachedValue, {
        namespace: this.namespace,
        ttl: this.config.ttl,
        strategy: 'write-through',
      });
    } catch (error) {
      console.error(`Write-through set failed for ${key}:`, error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      // Delete from data source first
      if (this.dataSource.delete) {
        await this.dataSource.delete(key);
      }

      // Then delete from cache
      return await distributedCache.delete(key, {
        namespace: this.namespace,
      });
    } catch (error) {
      console.error(`Write-through delete failed for ${key}:`, error);
      return false;
    }
  }

  private isExpired(cached: CachedValue<T>): boolean {
    return Date.now() > cached.expiresAt;
  }
}

// ====================
// WRITE-BEHIND PATTERN
// ====================

export class WriteBehindPattern<T> {
  private config: CachePatternConfig & {
    batchSize: number;
    flushInterval: number;
    maxPendingWrites: number;
  };
  private dataSource: DataSource<T>;
  private namespace: string;
  private pendingWrites: Map<string, PendingWrite<T>> = new Map();
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(
    dataSource: DataSource<T>,
    namespace: string,
    config: Partial<CachePatternConfig & {
      batchSize: number;
      flushInterval: number;
      maxPendingWrites: number;
    }> = {}
  ) {
    this.dataSource = dataSource;
    this.namespace = namespace;
    this.config = {
      ttl: config.ttl || env.CACHE_TTL_DEFAULT,
      refreshThreshold: config.refreshThreshold || 0.8,
      staleWhileRevalidate: config.staleWhileRevalidate || false,
      maxStaleTime: config.maxStaleTime || 300000,
      backgroundRefresh: config.backgroundRefresh || false,
      fallbackTimeout: config.fallbackTimeout || 5000,
      retryConfig: {
        attempts: config.retryConfig?.attempts || 3,
        backoffMs: config.retryConfig?.backoffMs || 100,
        maxBackoffMs: config.retryConfig?.maxBackoffMs || 5000,
      },
      batchSize: config.batchSize || 10,
      flushInterval: config.flushInterval || 5000, // 5 seconds
      maxPendingWrites: config.maxPendingWrites || 1000,
    };

    this.startFlushTimer();
  }

  async get(key: string): Promise<T | null> {
    try {
      // Check pending writes first
      const pending = this.pendingWrites.get(key);
      if (pending) {
        return pending.value;
      }

      // Check cache
      const cached = await distributedCache.get<CachedValue<T>>(key, {
        namespace: this.namespace,
      });

      if (cached && !this.isExpired(cached)) {
        return cached.value;
      }

      // Load from source
      const value = await this.dataSource.load(key);
      if (value !== null) {
        await this.cacheOnly(key, value);
      }
      return value;
    } catch (error) {
      console.error(`Write-behind get failed for ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: T): Promise<boolean> {
    try {
      // Write to cache immediately
      const success = await this.cacheOnly(key, value);

      // Queue write to data source
      if (this.pendingWrites.size < this.config.maxPendingWrites) {
        this.pendingWrites.set(key, {
          key,
          value,
          timestamp: Date.now(),
          retries: 0,
        });
      } else {
        console.warn(`Max pending writes exceeded, forcing flush`);
        await this.flushPendingWrites();
        this.pendingWrites.set(key, {
          key,
          value,
          timestamp: Date.now(),
          retries: 0,
        });
      }

      return success;
    } catch (error) {
      console.error(`Write-behind set failed for ${key}:`, error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      // Remove from pending writes
      this.pendingWrites.delete(key);

      // Delete from cache
      const cacheSuccess = await distributedCache.delete(key, {
        namespace: this.namespace,
      });

      // Queue delete to data source
      if (this.dataSource.delete) {
        this.pendingWrites.set(key, {
          key,
          value: null as any,
          timestamp: Date.now(),
          retries: 0,
          isDelete: true,
        });
      }

      return cacheSuccess;
    } catch (error) {
      console.error(`Write-behind delete failed for ${key}:`, error);
      return false;
    }
  }

  async flush(): Promise<void> {
    await this.flushPendingWrites();
  }

  private async cacheOnly(key: string, value: T): Promise<boolean> {
    const cachedValue: CachedValue<T> = {
      value,
      cachedAt: Date.now(),
      expiresAt: Date.now() + (this.config.ttl * 1000),
      version: 1,
    };

    return await distributedCache.set(key, cachedValue, {
      namespace: this.namespace,
      ttl: this.config.ttl,
      strategy: 'write-behind',
    });
  }

  private startFlushTimer(): void {
    this.flushInterval = setInterval(async () => {
      await this.flushPendingWrites();
    }, this.config.flushInterval);
  }

  private async flushPendingWrites(): Promise<void> {
    if (this.pendingWrites.size === 0) return;

    const writes = Array.from(this.pendingWrites.values());
    const batches = this.chunkArray(writes, this.config.batchSize);

    for (const batch of batches) {
      await this.processBatch(batch);
    }
  }

  private async processBatch(batch: PendingWrite<T>[]): Promise<void> {
    const promises = batch.map(async (write) => {
      try {
        if (write.isDelete && this.dataSource.delete) {
          await this.dataSource.delete(write.key);
        } else if (!write.isDelete && this.dataSource.save) {
          await this.dataSource.save(write.key, write.value);
        }
        
        // Remove from pending writes on success
        this.pendingWrites.delete(write.key);
      } catch (error) {
        console.error(`Failed to flush write for ${write.key}:`, error);
        
        // Increment retry count
        write.retries++;
        if (write.retries >= this.config.retryConfig.attempts) {
          console.error(`Max retries exceeded for ${write.key}, dropping write`);
          this.pendingWrites.delete(write.key);
        }
      }
    });

    await Promise.allSettled(promises);
  }

  private chunkArray<U>(array: U[], chunkSize: number): U[][] {
    const chunks: U[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private isExpired(cached: CachedValue<T>): boolean {
    return Date.now() > cached.expiresAt;
  }

  shutdown(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    // Flush remaining writes
    this.flushPendingWrites().catch(error => 
      console.error('Error flushing writes during shutdown:', error)
    );
  }
}

// ====================
// REFRESH-AHEAD PATTERN
// ====================

export class RefreshAheadPattern<T> {
  private config: CachePatternConfig;
  private dataSource: DataSource<T>;
  private namespace: string;
  private refreshJobs: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    dataSource: DataSource<T>,
    namespace: string,
    config: Partial<CachePatternConfig> = {}
  ) {
    this.dataSource = dataSource;
    this.namespace = namespace;
    this.config = {
      ttl: config.ttl || env.CACHE_TTL_DEFAULT,
      refreshThreshold: config.refreshThreshold || 0.7, // Refresh at 70% of TTL
      staleWhileRevalidate: config.staleWhileRevalidate || true,
      maxStaleTime: config.maxStaleTime || 300000,
      backgroundRefresh: config.backgroundRefresh || true,
      fallbackTimeout: config.fallbackTimeout || 5000,
      retryConfig: {
        attempts: config.retryConfig?.attempts || 3,
        backoffMs: config.retryConfig?.backoffMs || 100,
        maxBackoffMs: config.retryConfig?.maxBackoffMs || 5000,
      },
    };
  }

  async get(key: string): Promise<T | null> {
    try {
      const cached = await distributedCache.get<CachedValue<T>>(key, {
        namespace: this.namespace,
      });

      if (cached && !this.isExpired(cached)) {
        // Schedule refresh if needed
        if (this.needsRefresh(cached)) {
          this.scheduleRefresh(key, cached);
        }
        return cached.value;
      }

      // Cache miss or expired - load from source
      const value = await this.dataSource.load(key);
      if (value !== null) {
        await this.set(key, value);
      }
      return value;
    } catch (error) {
      console.error(`Refresh-ahead get failed for ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: T): Promise<boolean> {
    try {
      const cachedValue: CachedValue<T> = {
        value,
        cachedAt: Date.now(),
        expiresAt: Date.now() + (this.config.ttl * 1000),
        version: 1,
      };

      const success = await distributedCache.set(key, cachedValue, {
        namespace: this.namespace,
        ttl: this.config.ttl,
      });

      if (success) {
        this.scheduleRefresh(key, cachedValue);
      }

      return success;
    } catch (error) {
      console.error(`Refresh-ahead set failed for ${key}:`, error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      // Cancel any scheduled refresh
      this.cancelRefresh(key);

      return await distributedCache.delete(key, {
        namespace: this.namespace,
      });
    } catch (error) {
      console.error(`Refresh-ahead delete failed for ${key}:`, error);
      return false;
    }
  }

  private scheduleRefresh(key: string, cached: CachedValue<T>): void {
    // Cancel existing refresh job
    this.cancelRefresh(key);

    const age = Date.now() - cached.cachedAt;
    const maxAge = cached.expiresAt - cached.cachedAt;
    const refreshTime = maxAge * this.config.refreshThreshold;
    const delay = Math.max(0, refreshTime - age);

    const timeout = setTimeout(async () => {
      try {
        const value = await this.dataSource.load(key);
        if (value !== null) {
          await this.set(key, value);
        }
      } catch (error) {
        console.error(`Scheduled refresh failed for ${key}:`, error);
      } finally {
        this.refreshJobs.delete(key);
      }
    }, delay);

    this.refreshJobs.set(key, timeout);
  }

  private cancelRefresh(key: string): void {
    const timeout = this.refreshJobs.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.refreshJobs.delete(key);
    }
  }

  private isExpired(cached: CachedValue<T>): boolean {
    return Date.now() > cached.expiresAt;
  }

  private needsRefresh(cached: CachedValue<T>): boolean {
    const age = Date.now() - cached.cachedAt;
    const maxAge = cached.expiresAt - cached.cachedAt;
    return age / maxAge > this.config.refreshThreshold;
  }

  shutdown(): void {
    // Cancel all refresh jobs
    for (const timeout of this.refreshJobs.values()) {
      clearTimeout(timeout);
    }
    this.refreshJobs.clear();
  }
}

// ====================
// UTILITY TYPES
// ====================

interface CachedValue<T> {
  value: T;
  cachedAt: number;
  expiresAt: number;
  version: number;
}

interface PendingWrite<T> {
  key: string;
  value: T;
  timestamp: number;
  retries: number;
  isDelete?: boolean;
}

// ====================
// PATTERN FACTORY
// ====================

export class CachePatternFactory {
  static createCacheAside<T>(
    dataSource: DataSource<T>,
    namespace: string,
    config?: Partial<CachePatternConfig>
  ): CacheAsidePattern<T> {
    return new CacheAsidePattern(dataSource, namespace, config);
  }

  static createWriteThrough<T>(
    dataSource: DataSource<T>,
    namespace: string,
    config?: Partial<CachePatternConfig>
  ): WriteThroughPattern<T> {
    return new WriteThroughPattern(dataSource, namespace, config);
  }

  static createWriteBehind<T>(
    dataSource: DataSource<T>,
    namespace: string,
    config?: Partial<CachePatternConfig>
  ): WriteBehindPattern<T> {
    return new WriteBehindPattern(dataSource, namespace, config);
  }

  static createRefreshAhead<T>(
    dataSource: DataSource<T>,
    namespace: string,
    config?: Partial<CachePatternConfig>
  ): RefreshAheadPattern<T> {
    return new RefreshAheadPattern(dataSource, namespace, config);
  }
}

export default CachePatternFactory;