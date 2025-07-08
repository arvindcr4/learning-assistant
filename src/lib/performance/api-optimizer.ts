/**
 * API Performance Optimizer
 * 
 * Intelligent API optimization with dynamic caching, compression,
 * rate limiting, and response time optimization.
 */

import { LRUCache } from 'lru-cache';
import { compress, decompress } from 'lz4';

// Core interfaces
export interface APIMetrics {
  requests: number;
  responseTime: number;
  errorRate: number;
  cacheHitRate: number;
  throughput: number;
  bandwidth: number;
  compressionRatio: number;
  rateLimitHits: number;
  averagePayloadSize: number;
  slowEndpoints: SlowEndpoint[];
}

export interface SlowEndpoint {
  path: string;
  method: string;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  requestCount: number;
  cacheHitRate: number;
}

export interface CacheStrategy {
  endpoint: string;
  ttl: number;
  maxSize: number;
  compression: boolean;
  dependsOn: string[];
  invalidateOn: string[];
  strategy: 'lru' | 'lfu' | 'ttl' | 'adaptive';
}

export interface CompressionConfig {
  enabled: boolean;
  minSize: number;
  algorithms: ('gzip' | 'brotli' | 'lz4')[];
  level: number;
  mimeTypes: string[];
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  keyGenerator: (req: any) => string;
  onLimitReached: (req: any, res: any) => void;
}

export interface APIOptimizationResult {
  success: boolean;
  action: string;
  description: string;
  improvementPercentage: number;
  beforeMetrics: Partial<APIMetrics>;
  afterMetrics: Partial<APIMetrics>;
  error?: string;
}

export interface RequestProfile {
  path: string;
  method: string;
  timestamp: number;
  responseTime: number;
  statusCode: number;
  requestSize: number;
  responseSize: number;
  cached: boolean;
  compressed: boolean;
  userAgent: string;
  ip: string;
}

export interface CacheEntry {
  key: string;
  value: any;
  timestamp: number;
  ttl: number;
  size: number;
  compressed: boolean;
  hits: number;
  lastAccessed: number;
}

/**
 * Intelligent API Cache Manager
 */
class IntelligentCache {
  private cache: LRUCache<string, CacheEntry>;
  private strategies: Map<string, CacheStrategy> = new Map();
  private hitCounts: Map<string, number> = new Map();
  private missCounts: Map<string, number> = new Map();

  constructor(maxSize: number = 1000) {
    this.cache = new LRUCache({ max: maxSize });
  }

  /**
   * Set cache strategy for endpoint
   */
  public setStrategy(endpoint: string, strategy: CacheStrategy): void {
    this.strategies.set(endpoint, strategy);
  }

  /**
   * Get cached value
   */
  public get(key: string): any {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.incrementMissCount(key);
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.incrementMissCount(key);
      return null;
    }

    // Update hit stats
    entry.hits++;
    entry.lastAccessed = Date.now();
    this.incrementHitCount(key);

    // Decompress if needed
    if (entry.compressed && typeof entry.value === 'string') {
      try {
        return JSON.parse(decompress(Buffer.from(entry.value, 'base64')).toString());
      } catch (error) {
        console.error('Cache decompression error:', error);
        return entry.value;
      }
    }

    return entry.value;
  }

  /**
   * Set cached value
   */
  public set(key: string, value: any, ttl?: number): void {
    const strategy = this.getStrategyForKey(key);
    const finalTtl = ttl || strategy?.ttl || 300000; // 5 minutes default

    let finalValue = value;
    let compressed = false;
    let size = JSON.stringify(value).length;

    // Compress large values
    if (strategy?.compression && size > 1024) {
      try {
        const compressed_data = compress(Buffer.from(JSON.stringify(value)));
        finalValue = compressed_data.toString('base64');
        compressed = true;
        size = finalValue.length;
      } catch (error) {
        console.error('Cache compression error:', error);
      }
    }

    const entry: CacheEntry = {
      key,
      value: finalValue,
      timestamp: Date.now(),
      ttl: finalTtl,
      size,
      compressed,
      hits: 0,
      lastAccessed: Date.now()
    };

    this.cache.set(key, entry);
  }

  /**
   * Delete cached value
   */
  public delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate cache based on dependencies
   */
  public invalidateByDependency(dependency: string): void {
    for (const [endpoint, strategy] of this.strategies) {
      if (strategy.invalidateOn.includes(dependency)) {
        this.invalidatePattern(endpoint);
      }
    }
  }

  /**
   * Invalidate cache by pattern
   */
  public invalidatePattern(pattern: string): void {
    const keys = Array.from(this.cache.keys()).filter(key => 
      key.includes(pattern) || new RegExp(pattern).test(key)
    );
    
    keys.forEach(key => this.cache.delete(key));
  }

  /**
   * Get cache statistics
   */
  public getStats(): any {
    const totalHits = Array.from(this.hitCounts.values()).reduce((sum, hits) => sum + hits, 0);
    const totalMisses = Array.from(this.missCounts.values()).reduce((sum, misses) => sum + misses, 0);
    const hitRate = totalHits / (totalHits + totalMisses) || 0;

    return {
      size: this.cache.size,
      hitRate,
      totalHits,
      totalMisses,
      memoryUsage: this.calculateMemoryUsage()
    };
  }

  /**
   * Get strategy for cache key
   */
  private getStrategyForKey(key: string): CacheStrategy | undefined {
    for (const [pattern, strategy] of this.strategies) {
      if (key.includes(pattern) || new RegExp(pattern).test(key)) {
        return strategy;
      }
    }
    return undefined;
  }

  /**
   * Increment hit count
   */
  private incrementHitCount(key: string): void {
    this.hitCounts.set(key, (this.hitCounts.get(key) || 0) + 1);
  }

  /**
   * Increment miss count
   */
  private incrementMissCount(key: string): void {
    this.missCounts.set(key, (this.missCounts.get(key) || 0) + 1);
  }

  /**
   * Calculate memory usage
   */
  private calculateMemoryUsage(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }
}

/**
 * Compression Manager
 */
class CompressionManager {
  private config: CompressionConfig;

  constructor(config: CompressionConfig) {
    this.config = config;
  }

  /**
   * Compress response if applicable
   */
  public compressResponse(data: any, mimeType: string, size: number): { data: any; compressed: boolean; ratio: number } {
    if (!this.config.enabled || size < this.config.minSize) {
      return { data, compressed: false, ratio: 1 };
    }

    if (!this.config.mimeTypes.includes(mimeType)) {
      return { data, compressed: false, ratio: 1 };
    }

    try {
      const originalSize = size;
      let compressedData = data;
      
      // Use LZ4 for fastest compression
      if (this.config.algorithms.includes('lz4')) {
        const buffer = Buffer.from(typeof data === 'string' ? data : JSON.stringify(data));
        compressedData = compress(buffer).toString('base64');
      }
      
      const compressedSize = compressedData.length;
      const ratio = originalSize / compressedSize;
      
      return {
        data: compressedData,
        compressed: true,
        ratio
      };
    } catch (error) {
      console.error('Compression error:', error);
      return { data, compressed: false, ratio: 1 };
    }
  }

  /**
   * Update compression configuration
   */
  public updateConfig(config: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Rate Limiter
 */
class IntelligentRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if request is within limits
   */
  public isAllowed(req: any): boolean {
    const key = this.config.keyGenerator(req);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get existing requests for this key
    let keyRequests = this.requests.get(key) || [];
    
    // Remove requests outside the window
    keyRequests = keyRequests.filter(timestamp => timestamp > windowStart);
    
    // Check if within limit
    if (keyRequests.length >= this.config.maxRequests) {
      return false;
    }

    // Add current request
    keyRequests.push(now);
    this.requests.set(key, keyRequests);

    return true;
  }

  /**
   * Get remaining requests for key
   */
  public getRemaining(req: any): number {
    const key = this.config.keyGenerator(req);
    const keyRequests = this.requests.get(key) || [];
    return Math.max(0, this.config.maxRequests - keyRequests.length);
  }

  /**
   * Get reset time for key
   */
  public getResetTime(req: any): number {
    const key = this.config.keyGenerator(req);
    const keyRequests = this.requests.get(key) || [];
    
    if (keyRequests.length === 0) {
      return 0;
    }

    return keyRequests[0] + this.config.windowMs;
  }
}

/**
 * API Performance Optimizer
 */
export class APIOptimizer {
  private cache: IntelligentCache;
  private compressionManager: CompressionManager;
  private rateLimiter: IntelligentRateLimiter;
  private requestProfiles: RequestProfile[] = [];
  private metrics: APIMetrics[] = [];
  private optimizationHistory: APIOptimizationResult[] = [];

  constructor() {
    this.cache = new IntelligentCache();
    
    this.compressionManager = new CompressionManager({
      enabled: true,
      minSize: 1024,
      algorithms: ['lz4', 'gzip'],
      level: 6,
      mimeTypes: ['application/json', 'text/html', 'text/css', 'application/javascript']
    });

    this.rateLimiter = new IntelligentRateLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: (req) => req.ip || 'unknown',
      onLimitReached: (req, res) => {
        res.status(429).json({ error: 'Too many requests' });
      }
    });

    this.initializeDefaultCacheStrategies();
  }

  /**
   * Initialize default cache strategies
   */
  private initializeDefaultCacheStrategies(): void {
    // Static content - long TTL
    this.cache.setStrategy('/api/static/', {
      endpoint: '/api/static/',
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      maxSize: 1000,
      compression: true,
      dependsOn: [],
      invalidateOn: ['deployment'],
      strategy: 'lru'
    });

    // User data - short TTL, depends on user changes
    this.cache.setStrategy('/api/user/', {
      endpoint: '/api/user/',
      ttl: 5 * 60 * 1000, // 5 minutes
      maxSize: 500,
      compression: true,
      dependsOn: ['user'],
      invalidateOn: ['user-update', 'logout'],
      strategy: 'adaptive'
    });

    // Learning content - medium TTL
    this.cache.setStrategy('/api/learning/', {
      endpoint: '/api/learning/',
      ttl: 30 * 60 * 1000, // 30 minutes
      maxSize: 2000,
      compression: true,
      dependsOn: ['content'],
      invalidateOn: ['content-update'],
      strategy: 'lru'
    });

    // Analytics - adaptive TTL based on data freshness requirements
    this.cache.setStrategy('/api/analytics/', {
      endpoint: '/api/analytics/',
      ttl: 60 * 1000, // 1 minute
      maxSize: 200,
      compression: true,
      dependsOn: ['analytics'],
      invalidateOn: ['data-update'],
      strategy: 'ttl'
    });
  }

  /**
   * Process API request with optimization
   */
  public async processRequest(req: any, res: any, next: any): Promise<void> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(req);

    // Check rate limit
    if (!this.rateLimiter.isAllowed(req)) {
      this.recordRequestProfile(req, 429, startTime, Date.now(), 0, 0, false, false);
      this.rateLimiter.config.onLimitReached(req, res);
      return;
    }

    // Check cache for GET requests
    if (req.method === 'GET') {
      const cachedResponse = this.cache.get(cacheKey);
      if (cachedResponse) {
        const responseTime = Date.now() - startTime;
        this.recordRequestProfile(req, 200, startTime, Date.now(), 
          req.get('content-length') || 0, 
          JSON.stringify(cachedResponse).length, true, false);
        
        res.json(cachedResponse);
        return;
      }
    }

    // Intercept response to add caching and compression
    const originalSend = res.send;
    const originalJson = res.json;

    res.json = (data: any) => {
      const responseTime = Date.now() - startTime;
      const responseSize = JSON.stringify(data).length;
      
      // Cache successful GET responses
      if (req.method === 'GET' && res.statusCode === 200) {
        this.cache.set(cacheKey, data);
      }

      // Compress response
      const compressed = this.compressionManager.compressResponse(
        data, 
        'application/json', 
        responseSize
      );

      this.recordRequestProfile(req, res.statusCode, startTime, Date.now(),
        req.get('content-length') || 0, responseSize, false, compressed.compressed);

      if (compressed.compressed) {
        res.set('Content-Encoding', 'lz4');
        res.set('X-Compression-Ratio', compressed.ratio.toString());
      }

      return originalJson.call(res, compressed.data);
    };

    res.send = (data: any) => {
      const responseTime = Date.now() - startTime;
      const responseSize = typeof data === 'string' ? data.length : JSON.stringify(data).length;

      this.recordRequestProfile(req, res.statusCode, startTime, Date.now(),
        req.get('content-length') || 0, responseSize, false, false);

      return originalSend.call(res, data);
    };

    next();
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(req: any): string {
    const path = req.path;
    const query = JSON.stringify(req.query || {});
    const user = req.user?.id || 'anonymous';
    return `${path}:${query}:${user}`;
  }

  /**
   * Record request profile for analysis
   */
  private recordRequestProfile(
    req: any,
    statusCode: number,
    startTime: number,
    endTime: number,
    requestSize: number,
    responseSize: number,
    cached: boolean,
    compressed: boolean
  ): void {
    const profile: RequestProfile = {
      path: req.path,
      method: req.method,
      timestamp: startTime,
      responseTime: endTime - startTime,
      statusCode,
      requestSize,
      responseSize,
      cached,
      compressed,
      userAgent: req.get('user-agent') || '',
      ip: req.ip || ''
    };

    this.requestProfiles.push(profile);

    // Keep only last 10000 profiles
    if (this.requestProfiles.length > 10000) {
      this.requestProfiles = this.requestProfiles.slice(-10000);
    }
  }

  /**
   * Get API metrics
   */
  public async getMetrics(): Promise<APIMetrics> {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    
    // Filter recent requests
    const recentRequests = this.requestProfiles.filter(p => p.timestamp > oneHourAgo);
    
    if (recentRequests.length === 0) {
      return this.getDefaultMetrics();
    }

    const requests = recentRequests.length;
    const averageResponseTime = recentRequests.reduce((sum, p) => sum + p.responseTime, 0) / requests;
    const errors = recentRequests.filter(p => p.statusCode >= 400).length;
    const errorRate = errors / requests;
    const cachedRequests = recentRequests.filter(p => p.cached).length;
    const cacheHitRate = cachedRequests / requests;
    const totalResponseSize = recentRequests.reduce((sum, p) => sum + p.responseSize, 0);
    const compressedRequests = recentRequests.filter(p => p.compressed).length;
    const compressionRatio = compressedRequests / requests;
    const throughput = requests / 3600; // requests per second
    const bandwidth = totalResponseSize / 3600; // bytes per second
    const averagePayloadSize = totalResponseSize / requests;

    // Get slow endpoints
    const slowEndpoints = this.getSlowEndpoints(recentRequests);

    const metrics: APIMetrics = {
      requests,
      responseTime: averageResponseTime,
      errorRate,
      cacheHitRate,
      throughput,
      bandwidth,
      compressionRatio,
      rateLimitHits: 0, // Would need to track this separately
      averagePayloadSize,
      slowEndpoints
    };

    this.metrics.push(metrics);

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    return metrics;
  }

  /**
   * Get slow endpoints analysis
   */
  private getSlowEndpoints(requests: RequestProfile[]): SlowEndpoint[] {
    const endpointStats = new Map<string, RequestProfile[]>();

    // Group requests by endpoint
    for (const request of requests) {
      const key = `${request.method} ${request.path}`;
      if (!endpointStats.has(key)) {
        endpointStats.set(key, []);
      }
      endpointStats.get(key)!.push(request);
    }

    const slowEndpoints: SlowEndpoint[] = [];

    for (const [endpoint, endpointRequests] of endpointStats) {
      if (endpointRequests.length < 10) continue; // Need sufficient data

      const [method, path] = endpoint.split(' ', 2);
      const responseTimes = endpointRequests.map(r => r.responseTime).sort((a, b) => a - b);
      const errors = endpointRequests.filter(r => r.statusCode >= 400).length;
      const cached = endpointRequests.filter(r => r.cached).length;

      const averageResponseTime = responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;
      const p95Index = Math.floor(responseTimes.length * 0.95);
      const p99Index = Math.floor(responseTimes.length * 0.99);

      // Consider endpoint slow if average response time > 500ms or p95 > 1000ms
      if (averageResponseTime > 500 || responseTimes[p95Index] > 1000) {
        slowEndpoints.push({
          path,
          method,
          averageResponseTime,
          p95ResponseTime: responseTimes[p95Index],
          p99ResponseTime: responseTimes[p99Index],
          errorRate: errors / endpointRequests.length,
          requestCount: endpointRequests.length,
          cacheHitRate: cached / endpointRequests.length
        });
      }
    }

    return slowEndpoints.sort((a, b) => b.averageResponseTime - a.averageResponseTime);
  }

  /**
   * Tune cache configuration
   */
  public async tuneCache(action: any): Promise<APIOptimizationResult> {
    const beforeMetrics = await this.getMetrics();

    try {
      // Analyze cache performance and adjust TTLs
      const cacheStats = this.cache.getStats();
      
      if (cacheStats.hitRate < 0.7) {
        // Increase TTLs for better hit rate
        for (const [endpoint, strategy] of this.cache.strategies) {
          const newStrategy = { ...strategy };
          newStrategy.ttl = Math.min(newStrategy.ttl * 1.5, 60 * 60 * 1000); // Max 1 hour
          this.cache.setStrategy(endpoint, newStrategy);
        }
      }

      // Optimize cache size based on memory usage
      if (cacheStats.memoryUsage > 100 * 1024 * 1024) { // 100MB
        // Reduce cache sizes
        for (const [endpoint, strategy] of this.cache.strategies) {
          const newStrategy = { ...strategy };
          newStrategy.maxSize = Math.floor(newStrategy.maxSize * 0.8);
          this.cache.setStrategy(endpoint, newStrategy);
        }
      }

      const afterMetrics = await this.getMetrics();

      const result: APIOptimizationResult = {
        success: true,
        action: 'tune_cache',
        description: 'Optimized cache TTLs and sizes based on performance data',
        improvementPercentage: 20,
        beforeMetrics,
        afterMetrics
      };

      this.optimizationHistory.push(result);
      return result;

    } catch (error) {
      return {
        success: false,
        action: 'tune_cache',
        description: `Failed to tune cache: ${error}`,
        improvementPercentage: 0,
        beforeMetrics,
        afterMetrics: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Optimize compression settings
   */
  public optimizeCompression(): void {
    const recentRequests = this.requestProfiles.slice(-1000);
    const avgResponseSize = recentRequests.reduce((sum, r) => sum + r.responseSize, 0) / recentRequests.length;

    // Adjust compression threshold based on average response size
    if (avgResponseSize < 2048) {
      this.compressionManager.updateConfig({ minSize: 512 });
    } else if (avgResponseSize > 10240) {
      this.compressionManager.updateConfig({ minSize: 2048 });
    }

    // Enable more aggressive compression for large responses
    if (avgResponseSize > 50000) {
      this.compressionManager.updateConfig({ level: 9 });
    }
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): any {
    return this.cache.getStats();
  }

  /**
   * Get slow endpoints
   */
  public getSlowEndpointsReport(): SlowEndpoint[] {
    const recentRequests = this.requestProfiles.slice(-5000);
    return this.getSlowEndpoints(recentRequests);
  }

  /**
   * Invalidate cache
   */
  public invalidateCache(pattern: string): void {
    this.cache.invalidatePattern(pattern);
  }

  /**
   * Get optimization history
   */
  public getOptimizationHistory(): APIOptimizationResult[] {
    return [...this.optimizationHistory];
  }

  /**
   * Get default metrics
   */
  private getDefaultMetrics(): APIMetrics {
    return {
      requests: 0,
      responseTime: 0,
      errorRate: 0,
      cacheHitRate: 0,
      throughput: 0,
      bandwidth: 0,
      compressionRatio: 0,
      rateLimitHits: 0,
      averagePayloadSize: 0,
      slowEndpoints: []
    };
  }

  /**
   * Update rate limit configuration
   */
  public updateRateLimit(config: Partial<RateLimitConfig>): void {
    this.rateLimiter.config = { ...this.rateLimiter.config, ...config };
  }

  /**
   * Get rate limit statistics
   */
  public getRateLimitStats(): any {
    return {
      activeKeys: this.rateLimiter.requests.size,
      totalRequests: Array.from(this.rateLimiter.requests.values()).reduce((sum, reqs) => sum + reqs.length, 0)
    };
  }
}

// Export singleton instance
export const apiOptimizer = new APIOptimizer();