/**
 * Advanced Cache Strategies and Browser Caching Optimization
 * 
 * Implements intelligent caching strategies, cache invalidation,
 * and browser caching optimization for maximum performance.
 */

import { CDN_CONFIG } from './cdn';

// Cache Strategy Types
export type CacheStrategy = 
  | 'cache-first'
  | 'network-first'
  | 'cache-only'
  | 'network-only'
  | 'stale-while-revalidate';

// Cache Configuration
export interface CacheConfig {
  strategy: CacheStrategy;
  maxAge: number;
  staleWhileRevalidate?: number;
  maxEntries?: number;
  purgeOnQuotaError?: boolean;
  networkTimeoutSeconds?: number;
  cacheKeyWillBeUsed?: (params: { request: Request }) => string;
  cacheWillUpdate?: (params: { request: Request; response: Response }) => boolean;
}

// Cache Entry Metadata
export interface CacheEntryMetadata {
  url: string;
  timestamp: number;
  size: number;
  etag?: string;
  lastModified?: string;
  strategy: CacheStrategy;
  accessCount: number;
  lastAccessed: number;
}

// Cache Performance Metrics
export interface CachePerformanceMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  totalSize: number;
  entryCount: number;
  evictions: number;
  lastUpdated: number;
}

/**
 * Advanced Cache Strategy Manager
 */
export class CacheStrategyManager {
  private static instance: CacheStrategyManager;
  private strategies: Map<string, CacheConfig> = new Map();
  private metadata: Map<string, CacheEntryMetadata> = new Map();
  private metrics: CachePerformanceMetrics = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalSize: 0,
    entryCount: 0,
    evictions: 0,
    lastUpdated: Date.now(),
  };
  private quotaManager: StorageQuotaManager;

  private constructor() {
    this.quotaManager = new StorageQuotaManager();
    this.initializeStrategies();
    this.setupQuotaManagement();
  }

  public static getInstance(): CacheStrategyManager {
    if (!CacheStrategyManager.instance) {
      CacheStrategyManager.instance = new CacheStrategyManager();
    }
    return CacheStrategyManager.instance;
  }

  /**
   * Initialize default cache strategies
   */
  private initializeStrategies(): void {
    // Static assets - cache first with long TTL
    this.strategies.set('static', {
      strategy: 'cache-first',
      maxAge: CDN_CONFIG.PERFORMANCE_BUDGETS.INITIAL_BUNDLE_SIZE, // 1 year
      maxEntries: 100,
      purgeOnQuotaError: true,
      cacheWillUpdate: ({ response }) => response.status === 200,
    });

    // API responses - network first with fallback
    this.strategies.set('api', {
      strategy: 'network-first',
      maxAge: 5 * 60 * 1000, // 5 minutes
      networkTimeoutSeconds: 3,
      maxEntries: 50,
      purgeOnQuotaError: false,
    });

    // Images - cache first with revalidation
    this.strategies.set('images', {
      strategy: 'stale-while-revalidate',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      staleWhileRevalidate: 7 * 24 * 60 * 60 * 1000, // 7 days
      maxEntries: 200,
      purgeOnQuotaError: true,
    });

    // Documents - network first with caching
    this.strategies.set('documents', {
      strategy: 'network-first',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      networkTimeoutSeconds: 5,
      maxEntries: 30,
      purgeOnQuotaError: false,
    });

    // Fonts - cache first (rarely change)
    this.strategies.set('fonts', {
      strategy: 'cache-first',
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      maxEntries: 20,
      purgeOnQuotaError: true,
    });
  }

  /**
   * Setup storage quota management
   */
  private setupQuotaManagement(): void {
    // Monitor storage quota and manage cache size
    setInterval(async () => {
      await this.quotaManager.checkQuota();
      await this.cleanupExpiredEntries();
      await this.enforceMaxEntries();
      this.updateMetrics();
    }, 60000); // Check every minute
  }

  /**
   * Get cache strategy for a request
   */
  public getCacheStrategy(request: Request): CacheConfig {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Determine strategy based on URL patterns
    if (pathname.startsWith('/api/')) {
      return this.strategies.get('api')!;
    }

    if (pathname.match(/\.(png|jpg|jpeg|gif|webp|avif|svg)$/i)) {
      return this.strategies.get('images')!;
    }

    if (pathname.match(/\.(js|css|woff|woff2|ttf|otf)$/i)) {
      return this.strategies.get('static')!;
    }

    if (pathname.match(/\.(html|pdf|txt|doc|docx)$/i)) {
      return this.strategies.get('documents')!;
    }

    if (pathname.match(/\.(woff|woff2|ttf|otf|eot)$/i)) {
      return this.strategies.get('fonts')!;
    }

    // Default to network-first for unknown resources
    return this.strategies.get('api')!;
  }

  /**
   * Execute cache strategy for a request
   */
  public async executeStrategy(
    request: Request,
    cacheName: string = 'default'
  ): Promise<Response> {
    const strategy = this.getCacheStrategy(request);
    const cache = await caches.open(cacheName);

    switch (strategy.strategy) {
      case 'cache-first':
        return this.cacheFirst(request, cache, strategy);
      
      case 'network-first':
        return this.networkFirst(request, cache, strategy);
      
      case 'cache-only':
        return this.cacheOnly(request, cache, strategy);
      
      case 'network-only':
        return this.networkOnly(request, cache, strategy);
      
      case 'stale-while-revalidate':
        return this.staleWhileRevalidate(request, cache, strategy);
      
      default:
        return this.networkFirst(request, cache, strategy);
    }
  }

  /**
   * Cache-first strategy implementation
   */
  private async cacheFirst(
    request: Request,
    cache: Cache,
    config: CacheConfig
  ): Promise<Response> {
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse && this.isCacheValid(cachedResponse, config)) {
      this.trackCacheHit(request);
      return cachedResponse;
    }

    try {
      const networkResponse = await this.fetchWithTimeout(request, config);
      
      if (this.shouldCache(networkResponse, config)) {
        await this.putInCache(cache, request, networkResponse.clone(), config);
      }
      
      this.trackCacheMiss(request);
      return networkResponse;
    } catch (error) {
      if (cachedResponse) {
        this.trackCacheHit(request);
        return cachedResponse;
      }
      throw error;
    }
  }

  /**
   * Network-first strategy implementation
   */
  private async networkFirst(
    request: Request,
    cache: Cache,
    config: CacheConfig
  ): Promise<Response> {
    try {
      const networkResponse = await this.fetchWithTimeout(request, config);
      
      if (this.shouldCache(networkResponse, config)) {
        await this.putInCache(cache, request, networkResponse.clone(), config);
      }
      
      this.trackCacheMiss(request);
      return networkResponse;
    } catch (error) {
      const cachedResponse = await cache.match(request);
      
      if (cachedResponse) {
        this.trackCacheHit(request);
        return cachedResponse;
      }
      
      throw error;
    }
  }

  /**
   * Cache-only strategy implementation
   */
  private async cacheOnly(
    request: Request,
    cache: Cache,
    config: CacheConfig
  ): Promise<Response> {
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      this.trackCacheHit(request);
      return cachedResponse;
    }
    
    this.trackCacheMiss(request);
    throw new Error('No cached response available');
  }

  /**
   * Network-only strategy implementation
   */
  private async networkOnly(
    request: Request,
    cache: Cache,
    config: CacheConfig
  ): Promise<Response> {
    const networkResponse = await this.fetchWithTimeout(request, config);
    this.trackCacheMiss(request);
    return networkResponse;
  }

  /**
   * Stale-while-revalidate strategy implementation
   */
  private async staleWhileRevalidate(
    request: Request,
    cache: Cache,
    config: CacheConfig
  ): Promise<Response> {
    const cachedResponse = await cache.match(request);
    
    // Fetch from network in the background
    const networkPromise = this.fetchWithTimeout(request, config)
      .then(response => {
        if (this.shouldCache(response, config)) {
          this.putInCache(cache, request, response.clone(), config);
        }
        return response;
      })
      .catch(() => {
        // Ignore network errors for background revalidation
      });

    if (cachedResponse && this.isCacheValid(cachedResponse, config)) {
      // Return cached response immediately
      this.trackCacheHit(request);
      
      // Don't await the network request (background revalidation)
      networkPromise;
      
      return cachedResponse;
    }

    // If no valid cache, wait for network
    try {
      const networkResponse = await networkPromise;
      this.trackCacheMiss(request);
      return networkResponse as Response;
    } catch (error) {
      if (cachedResponse) {
        this.trackCacheHit(request);
        return cachedResponse;
      }
      throw error;
    }
  }

  /**
   * Check if cached response is still valid
   */
  private isCacheValid(response: Response, config: CacheConfig): boolean {
    const dateHeader = response.headers.get('Date');
    if (!dateHeader) return false;

    const cacheDate = new Date(dateHeader).getTime();
    const now = Date.now();
    
    return (now - cacheDate) < config.maxAge;
  }

  /**
   * Determine if response should be cached
   */
  private shouldCache(response: Response, config: CacheConfig): boolean {
    if (!response || response.status !== 200) return false;
    
    if (config.cacheWillUpdate) {
      return config.cacheWillUpdate({ request: new Request(response.url), response });
    }
    
    return true;
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(request: Request, config: CacheConfig): Promise<Response> {
    if (!config.networkTimeoutSeconds) {
      return fetch(request);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.networkTimeoutSeconds * 1000);

    try {
      const response = await fetch(request, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Put response in cache with metadata
   */
  private async putInCache(
    cache: Cache,
    request: Request,
    response: Response,
    config: CacheConfig
  ): Promise<void> {
    const url = request.url;
    const now = Date.now();
    
    // Create enhanced response with metadata
    const enhancedResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers),
    });
    
    // Add cache metadata headers
    enhancedResponse.headers.set('X-Cache-Timestamp', now.toString());
    enhancedResponse.headers.set('X-Cache-Strategy', config.strategy);
    enhancedResponse.headers.set('X-Cache-Max-Age', config.maxAge.toString());

    await cache.put(request, enhancedResponse);

    // Update metadata
    const size = this.estimateResponseSize(response);
    const metadata: CacheEntryMetadata = {
      url,
      timestamp: now,
      size,
      etag: response.headers.get('etag') || undefined,
      lastModified: response.headers.get('last-modified') || undefined,
      strategy: config.strategy,
      accessCount: 1,
      lastAccessed: now,
    };

    this.metadata.set(url, metadata);
  }

  /**
   * Estimate response size
   */
  private estimateResponseSize(response: Response): number {
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      return parseInt(contentLength, 10);
    }
    
    // Estimate based on content type
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('text/html')) return 50000; // 50KB
    if (contentType.includes('application/json')) return 10000; // 10KB
    if (contentType.includes('text/css')) return 20000; // 20KB
    if (contentType.includes('application/javascript')) return 100000; // 100KB
    if (contentType.includes('image/')) return 200000; // 200KB
    
    return 10000; // Default 10KB
  }

  /**
   * Track cache metrics
   */
  private trackCacheHit(request: Request): void {
    this.metrics.hits++;
    this.updateHitRate();
    
    const metadata = this.metadata.get(request.url);
    if (metadata) {
      metadata.accessCount++;
      metadata.lastAccessed = Date.now();
    }
  }

  private trackCacheMiss(request: Request): void {
    this.metrics.misses++;
    this.updateHitRate();
  }

  private updateHitRate(): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;
    this.metrics.lastUpdated = Date.now();
  }

  /**
   * Cache maintenance operations
   */
  private async cleanupExpiredEntries(): Promise<void> {
    const now = Date.now();
    const expiredUrls: string[] = [];

    this.metadata.forEach((metadata, url) => {
      const strategy = this.strategies.get(this.getStrategyName(metadata.strategy));
      if (!strategy) return;

      if ((now - metadata.timestamp) > strategy.maxAge) {
        expiredUrls.push(url);
      }
    });

    // Remove expired entries from all caches
    const cacheNames = await caches.keys();
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      
      for (const url of expiredUrls) {
        await cache.delete(url);
        this.metadata.delete(url);
        this.metrics.evictions++;
      }
    }
  }

  private async enforceMaxEntries(): Promise<void> {
    const strategyCounts = new Map<string, number>();
    const strategyEntries = new Map<string, CacheEntryMetadata[]>();

    // Group entries by strategy
    this.metadata.forEach((metadata) => {
      const strategyName = this.getStrategyName(metadata.strategy);
      
      if (!strategyCounts.has(strategyName)) {
        strategyCounts.set(strategyName, 0);
        strategyEntries.set(strategyName, []);
      }
      
      strategyCounts.set(strategyName, strategyCounts.get(strategyName)! + 1);
      strategyEntries.get(strategyName)!.push(metadata);
    });

    // Enforce max entries per strategy
    for (const [strategyName, count] of strategyCounts) {
      const strategy = this.strategies.get(strategyName);
      if (!strategy || !strategy.maxEntries || count <= strategy.maxEntries) continue;

      const entries = strategyEntries.get(strategyName)!;
      
      // Sort by last accessed time (LRU eviction)
      entries.sort((a, b) => a.lastAccessed - b.lastAccessed);
      
      const entriesToRemove = entries.slice(0, count - strategy.maxEntries);
      
      // Remove from caches
      const cacheNames = await caches.keys();
      
      for (const entry of entriesToRemove) {
        for (const cacheName of cacheNames) {
          const cache = await caches.open(cacheName);
          await cache.delete(entry.url);
        }
        
        this.metadata.delete(entry.url);
        this.metrics.evictions++;
      }
    }
  }

  private getStrategyName(strategy: CacheStrategy): string {
    for (const [name, config] of this.strategies) {
      if (config.strategy === strategy) return name;
    }
    return 'default';
  }

  /**
   * Cache invalidation
   */
  public async invalidateCache(pattern?: string | RegExp): Promise<void> {
    const cacheNames = await caches.keys();
    
    if (!pattern) {
      // Clear all caches
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
      }
      this.metadata.clear();
      return;
    }

    // Clear matching entries
    const urlsToDelete: string[] = [];
    
    this.metadata.forEach((metadata, url) => {
      const matches = typeof pattern === 'string' 
        ? url.includes(pattern)
        : pattern.test(url);
      
      if (matches) {
        urlsToDelete.push(url);
      }
    });

    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      
      for (const url of urlsToDelete) {
        await cache.delete(url);
        this.metadata.delete(url);
      }
    }
  }

  /**
   * Update cache entry
   */
  public async updateCacheEntry(request: Request, cacheName: string = 'default'): Promise<void> {
    const cache = await caches.open(cacheName);
    const strategy = this.getCacheStrategy(request);
    
    try {
      const networkResponse = await this.fetchWithTimeout(request, strategy);
      
      if (this.shouldCache(networkResponse, strategy)) {
        await this.putInCache(cache, request, networkResponse, strategy);
      }
    } catch (error) {
      console.warn('Failed to update cache entry:', error);
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    this.metrics.entryCount = this.metadata.size;
    this.metrics.totalSize = Array.from(this.metadata.values())
      .reduce((total, metadata) => total + metadata.size, 0);
  }

  /**
   * Public API methods
   */
  public getMetrics(): CachePerformanceMetrics {
    return { ...this.metrics };
  }

  public getCacheInfo(): Map<string, CacheEntryMetadata> {
    return new Map(this.metadata);
  }

  public async getCacheSize(): Promise<number> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return estimate.usage || 0;
    }
    return this.metrics.totalSize;
  }

  public setStrategy(name: string, config: CacheConfig): void {
    this.strategies.set(name, config);
  }
}

/**
 * Storage Quota Manager
 */
class StorageQuotaManager {
  private quotaThreshold = 0.8; // 80% of available quota
  private lastQuotaCheck = 0;
  private quotaCheckInterval = 300000; // 5 minutes

  public async checkQuota(): Promise<void> {
    const now = Date.now();
    if (now - this.lastQuotaCheck < this.quotaCheckInterval) return;

    this.lastQuotaCheck = now;

    if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
      return;
    }

    try {
      const estimate = await navigator.storage.estimate();
      const { usage = 0, quota = 0 } = estimate;
      
      if (quota > 0 && usage / quota > this.quotaThreshold) {
        await this.freeUpSpace(usage, quota);
      }
    } catch (error) {
      console.warn('Failed to check storage quota:', error);
    }
  }

  private async freeUpSpace(usage: number, quota: number): Promise<void> {
    const targetUsage = quota * 0.7; // Target 70% usage
    const spaceToFree = usage - targetUsage;
    
    console.log(`Storage quota exceeded. Freeing up ${Math.round(spaceToFree / 1024 / 1024)}MB`);
    
    // Get cache manager instance
    const cacheManager = CacheStrategyManager.getInstance();
    
    // Remove oldest entries until we free enough space
    const metadata = Array.from(cacheManager.getCacheInfo().values())
      .sort((a, b) => a.lastAccessed - b.lastAccessed);
    
    let freedSpace = 0;
    const cacheNames = await caches.keys();
    
    for (const entry of metadata) {
      if (freedSpace >= spaceToFree) break;
      
      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        await cache.delete(entry.url);
      }
      
      freedSpace += entry.size;
    }
    
    console.log(`Freed up ${Math.round(freedSpace / 1024 / 1024)}MB of cache storage`);
  }
}

// Browser cache headers optimization
export class BrowserCacheOptimizer {
  /**
   * Generate optimal cache headers for different resource types
   */
  public static generateCacheHeaders(
    resourceType: 'static' | 'dynamic' | 'api' | 'image' | 'font',
    options: {
      maxAge?: number;
      immutable?: boolean;
      staleWhileRevalidate?: number;
      mustRevalidate?: boolean;
    } = {}
  ): Record<string, string> {
    const headers: Record<string, string> = {};

    switch (resourceType) {
      case 'static':
        headers['Cache-Control'] = this.buildCacheControl({
          maxAge: options.maxAge || 31536000, // 1 year
          immutable: options.immutable !== false,
          public: true,
        });
        break;

      case 'dynamic':
        headers['Cache-Control'] = this.buildCacheControl({
          maxAge: options.maxAge || 300, // 5 minutes
          staleWhileRevalidate: options.staleWhileRevalidate || 86400, // 1 day
          public: true,
        });
        break;

      case 'api':
        headers['Cache-Control'] = this.buildCacheControl({
          maxAge: options.maxAge || 60, // 1 minute
          mustRevalidate: options.mustRevalidate !== false,
          public: false,
        });
        break;

      case 'image':
        headers['Cache-Control'] = this.buildCacheControl({
          maxAge: options.maxAge || 2592000, // 30 days
          immutable: options.immutable !== false,
          public: true,
        });
        break;

      case 'font':
        headers['Cache-Control'] = this.buildCacheControl({
          maxAge: options.maxAge || 31536000, // 1 year
          immutable: true,
          public: true,
        });
        headers['Access-Control-Allow-Origin'] = '*';
        break;
    }

    // Add ETag for better cache validation
    headers['ETag'] = `"${Date.now()}-${Math.random().toString(36).substr(2, 9)}"`;
    
    // Add Vary header for content negotiation
    headers['Vary'] = 'Accept-Encoding, Accept';

    return headers;
  }

  private static buildCacheControl(options: {
    maxAge?: number;
    sMaxAge?: number;
    staleWhileRevalidate?: number;
    immutable?: boolean;
    mustRevalidate?: boolean;
    noCache?: boolean;
    noStore?: boolean;
    public?: boolean;
    private?: boolean;
  }): string {
    const directives: string[] = [];

    if (options.public) directives.push('public');
    if (options.private) directives.push('private');
    if (options.noCache) directives.push('no-cache');
    if (options.noStore) directives.push('no-store');
    if (options.mustRevalidate) directives.push('must-revalidate');
    if (options.immutable) directives.push('immutable');

    if (options.maxAge !== undefined) {
      directives.push(`max-age=${options.maxAge}`);
    }

    if (options.sMaxAge !== undefined) {
      directives.push(`s-maxage=${options.sMaxAge}`);
    }

    if (options.staleWhileRevalidate !== undefined) {
      directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
    }

    return directives.join(', ');
  }
}

// Singleton instance
export const cacheStrategyManager = CacheStrategyManager.getInstance();

// React hooks
export function useCacheStrategies() {
  const [metrics, setMetrics] = React.useState<CachePerformanceMetrics | null>(null);
  const [cacheSize, setCacheSize] = React.useState<number>(0);

  React.useEffect(() => {
    const updateData = async () => {
      const manager = CacheStrategyManager.getInstance();
      setMetrics(manager.getMetrics());
      setCacheSize(await manager.getCacheSize());
    };

    updateData();
    const interval = setInterval(updateData, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const invalidateCache = React.useCallback(async (pattern?: string | RegExp) => {
    await cacheStrategyManager.invalidateCache(pattern);
  }, []);

  const updateCacheEntry = React.useCallback(async (url: string, cacheName?: string) => {
    const request = new Request(url);
    await cacheStrategyManager.updateCacheEntry(request, cacheName);
  }, []);

  return {
    metrics,
    cacheSize,
    invalidateCache,
    updateCacheEntry,
  };
}

// React import for hooks
import React from 'react';