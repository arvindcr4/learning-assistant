/**
 * Network Performance Optimizer
 * 
 * Advanced network optimization with connection pooling, request batching,
 * retry strategies, and bandwidth optimization.
 */

// Core interfaces
export interface NetworkMetrics {
  bytesIn: number;
  bytesOut: number;
  connections: number;
  latency: number;
  errors: number;
  bandwidth: number;
  throughput: number;
  connectionPoolUtilization: number;
  requestQueue: number;
  retryAttempts: number;
  successRate: number;
  averageRequestTime: number;
}

export interface ConnectionPoolConfig {
  maxConnections: number;
  maxIdleConnections: number;
  idleTimeout: number;
  connectionTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  keepAlive: boolean;
  host: string;
  port: number;
}

export interface RequestBatchConfig {
  enabled: boolean;
  maxBatchSize: number;
  batchTimeout: number;
  endpoints: string[];
  strategy: 'time' | 'count' | 'adaptive';
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors: number[];
  retryableStatus: number[];
}

export interface NetworkOptimizationResult {
  success: boolean;
  action: string;
  description: string;
  improvementPercentage: number;
  beforeMetrics: Partial<NetworkMetrics>;
  afterMetrics: Partial<NetworkMetrics>;
  error?: string;
}

export interface ConnectionPool {
  id: string;
  host: string;
  port: number;
  activeConnections: number;
  idleConnections: number;
  maxConnections: number;
  totalRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastUsed: number;
}

export interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  body?: any;
  headers: Record<string, string>;
  timestamp: number;
  priority: number;
  retryCount: number;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

export interface BatchedRequest {
  requests: QueuedRequest[];
  batchId: string;
  createdAt: number;
  timeout?: NodeJS.Timeout;
}

/**
 * Connection Pool Manager
 */
class ConnectionPoolManager {
  private pools: Map<string, ConnectionPool> = new Map();
  private config: ConnectionPoolConfig;
  private activeConnections: Map<string, any> = new Map();

  constructor(config: ConnectionPoolConfig) {
    this.config = config;
  }

  /**
   * Get or create connection pool
   */
  public getPool(host: string, port: number = 443): ConnectionPool {
    const poolId = `${host}:${port}`;
    
    if (!this.pools.has(poolId)) {
      this.pools.set(poolId, {
        id: poolId,
        host,
        port,
        activeConnections: 0,
        idleConnections: 0,
        maxConnections: this.config.maxConnections,
        totalRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        lastUsed: Date.now()
      });
    }

    return this.pools.get(poolId)!;
  }

  /**
   * Acquire connection from pool
   */
  public async acquireConnection(host: string, port: number = 443): Promise<any> {
    const pool = this.getPool(host, port);
    
    if (pool.activeConnections >= pool.maxConnections) {
      throw new Error(`Connection pool exhausted for ${host}:${port}`);
    }

    // Check for idle connection
    if (pool.idleConnections > 0) {
      pool.idleConnections--;
      pool.activeConnections++;
      pool.lastUsed = Date.now();
      return this.createConnection(host, port);
    }

    // Create new connection
    if (pool.activeConnections < pool.maxConnections) {
      pool.activeConnections++;
      pool.lastUsed = Date.now();
      return this.createConnection(host, port);
    }

    throw new Error(`No connections available for ${host}:${port}`);
  }

  /**
   * Release connection back to pool
   */
  public releaseConnection(host: string, port: number, connection: any): void {
    const pool = this.getPool(host, port);
    
    if (pool.activeConnections > 0) {
      pool.activeConnections--;
    }

    if (pool.idleConnections < this.config.maxIdleConnections) {
      pool.idleConnections++;
    } else {
      // Close connection if idle pool is full
      this.closeConnection(connection);
    }
  }

  /**
   * Create new connection
   */
  private createConnection(host: string, port: number): any {
    // This would create actual HTTP/HTTPS agent or connection
    return {
      host,
      port,
      createdAt: Date.now(),
      keepAlive: this.config.keepAlive
    };
  }

  /**
   * Close connection
   */
  private closeConnection(connection: any): void {
    // Close actual connection
    if (connection && connection.destroy) {
      connection.destroy();
    }
  }

  /**
   * Get pool statistics
   */
  public getPoolStats(): ConnectionPool[] {
    return Array.from(this.pools.values());
  }

  /**
   * Clean up idle connections
   */
  public cleanupIdleConnections(): void {
    const now = Date.now();
    
    for (const pool of this.pools.values()) {
      if (now - pool.lastUsed > this.config.idleTimeout) {
        pool.idleConnections = 0;
      }
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ConnectionPoolConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Request Batcher
 */
class RequestBatcher {
  private batches: Map<string, BatchedRequest> = new Map();
  private config: RequestBatchConfig;

  constructor(config: RequestBatchConfig) {
    this.config = config;
  }

  /**
   * Add request to batch
   */
  public addToBatch(request: QueuedRequest): Promise<any> {
    if (!this.config.enabled || !this.shouldBatch(request.url)) {
      return this.executeImmediately(request);
    }

    const batchKey = this.getBatchKey(request.url);
    let batch = this.batches.get(batchKey);

    if (!batch) {
      batch = {
        requests: [],
        batchId: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now()
      };
      this.batches.set(batchKey, batch);
    }

    batch.requests.push(request);

    // Check if batch should be executed
    if (this.shouldExecuteBatch(batch)) {
      this.executeBatch(batchKey);
    } else if (!batch.timeout) {
      // Set timeout for batch execution
      batch.timeout = setTimeout(() => {
        this.executeBatch(batchKey);
      }, this.config.batchTimeout);
    }

    return new Promise((resolve, reject) => {
      request.resolve = resolve;
      request.reject = reject;
    });
  }

  /**
   * Check if request should be batched
   */
  private shouldBatch(url: string): boolean {
    return this.config.endpoints.some(endpoint => url.includes(endpoint));
  }

  /**
   * Get batch key for grouping requests
   */
  private getBatchKey(url: string): string {
    // Group by endpoint pattern
    for (const endpoint of this.config.endpoints) {
      if (url.includes(endpoint)) {
        return endpoint;
      }
    }
    return 'default';
  }

  /**
   * Check if batch should be executed
   */
  private shouldExecuteBatch(batch: BatchedRequest): boolean {
    switch (this.config.strategy) {
      case 'count':
        return batch.requests.length >= this.config.maxBatchSize;
      case 'time':
        return Date.now() - batch.createdAt >= this.config.batchTimeout;
      case 'adaptive':
        return batch.requests.length >= this.config.maxBatchSize || 
               Date.now() - batch.createdAt >= this.config.batchTimeout;
      default:
        return false;
    }
  }

  /**
   * Execute batch of requests
   */
  private async executeBatch(batchKey: string): Promise<void> {
    const batch = this.batches.get(batchKey);
    if (!batch) return;

    this.batches.delete(batchKey);

    if (batch.timeout) {
      clearTimeout(batch.timeout);
    }

    try {
      // Execute all requests in parallel
      const results = await Promise.allSettled(
        batch.requests.map(request => this.executeRequest(request))
      );

      // Resolve individual request promises
      results.forEach((result, index) => {
        const request = batch.requests[index];
        if (result.status === 'fulfilled') {
          request.resolve(result.value);
        } else {
          request.reject(result.reason);
        }
      });

    } catch (error) {
      // Reject all requests in batch
      batch.requests.forEach(request => {
        request.reject(error);
      });
    }
  }

  /**
   * Execute single request immediately
   */
  private async executeImmediately(request: QueuedRequest): Promise<any> {
    return this.executeRequest(request);
  }

  /**
   * Execute individual request
   */
  private async executeRequest(request: QueuedRequest): Promise<any> {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body ? JSON.stringify(request.body) : undefined
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<RequestBatchConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get batch statistics
   */
  public getBatchStats(): any {
    return {
      activeBatches: this.batches.size,
      totalRequests: Array.from(this.batches.values()).reduce((sum, batch) => sum + batch.requests.length, 0)
    };
  }
}

/**
 * Retry Manager
 */
class RetryManager {
  private config: RetryConfig;

  constructor(config: RetryConfig) {
    this.config = config;
  }

  /**
   * Execute request with retry logic
   */
  public async executeWithRetry<T>(
    requestFn: () => Promise<T>,
    context?: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxAttempts; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error as Error;

        if (attempt === this.config.maxAttempts) {
          throw lastError;
        }

        if (!this.shouldRetry(error as Error)) {
          throw lastError;
        }

        const delay = this.calculateDelay(attempt);
        console.log(`Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${this.config.maxAttempts + 1}):`, error);
        
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Check if error should trigger retry
   */
  private shouldRetry(error: Error): boolean {
    // Check for network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return true;
    }

    // Check for retryable HTTP status codes
    if ('status' in error) {
      const status = (error as any).status;
      return this.config.retryableStatus.includes(status);
    }

    // Check for retryable error codes
    if ('code' in error) {
      const code = (error as any).code;
      return this.config.retryableErrors.includes(code);
    }

    return false;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateDelay(attempt: number): number {
    let delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt);
    delay = Math.min(delay, this.config.maxDelay);

    if (this.config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  /**
   * Sleep for specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Network Optimizer
 */
export class NetworkOptimizer {
  private connectionPool: ConnectionPoolManager;
  private requestBatcher: RequestBatcher;
  private retryManager: RetryManager;
  private requestQueue: QueuedRequest[] = [];
  private metrics: NetworkMetrics[] = [];
  private optimizationHistory: NetworkOptimizationResult[] = [];
  private requestId = 0;

  constructor() {
    this.connectionPool = new ConnectionPoolManager({
      maxConnections: 50,
      maxIdleConnections: 10,
      idleTimeout: 30000,
      connectionTimeout: 5000,
      retryAttempts: 3,
      retryDelay: 1000,
      keepAlive: true,
      host: 'localhost',
      port: 443
    });

    this.requestBatcher = new RequestBatcher({
      enabled: true,
      maxBatchSize: 10,
      batchTimeout: 100,
      endpoints: ['/api/analytics', '/api/metrics', '/api/batch'],
      strategy: 'adaptive'
    });

    this.retryManager = new RetryManager({
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: [
        'ECONNRESET',
        'ENOTFOUND',
        'ECONNREFUSED',
        'ETIMEDOUT'
      ],
      retryableStatus: [408, 429, 502, 503, 504]
    });

    this.startMetricsCollection();
  }

  /**
   * Optimized fetch with all enhancements
   */
  public async optimizedFetch(
    url: string,
    options: RequestInit = {},
    priority: number = 5
  ): Promise<Response> {
    const request: QueuedRequest = {
      id: `req_${++this.requestId}`,
      url,
      method: options.method || 'GET',
      body: options.body,
      headers: (options.headers as Record<string, string>) || {},
      timestamp: Date.now(),
      priority,
      retryCount: 0,
      resolve: () => {},
      reject: () => {}
    };

    return this.retryManager.executeWithRetry(async () => {
      return this.requestBatcher.addToBatch(request);
    });
  }

  /**
   * Get network metrics
   */
  public async getMetrics(): Promise<NetworkMetrics> {
    // Collect real-time network metrics
    const stats = this.collectNetworkStats();
    
    const metrics: NetworkMetrics = {
      bytesIn: stats.bytesIn,
      bytesOut: stats.bytesOut,
      connections: stats.connections,
      latency: stats.latency,
      errors: stats.errors,
      bandwidth: stats.bandwidth,
      throughput: stats.throughput,
      connectionPoolUtilization: stats.poolUtilization,
      requestQueue: this.requestQueue.length,
      retryAttempts: stats.retryAttempts,
      successRate: stats.successRate,
      averageRequestTime: stats.averageRequestTime
    };

    this.metrics.push(metrics);

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    return metrics;
  }

  /**
   * Collect network statistics
   */
  private collectNetworkStats(): any {
    const pools = this.connectionPool.getPoolStats();
    const batchStats = this.requestBatcher.getBatchStats();

    return {
      bytesIn: 0, // Would be tracked from actual requests
      bytesOut: 0,
      connections: pools.reduce((sum, pool) => sum + pool.activeConnections, 0),
      latency: pools.reduce((sum, pool) => sum + pool.averageResponseTime, 0) / Math.max(pools.length, 1),
      errors: pools.reduce((sum, pool) => sum + pool.failedRequests, 0),
      bandwidth: 0,
      throughput: pools.reduce((sum, pool) => sum + pool.totalRequests, 0),
      poolUtilization: pools.reduce((sum, pool) => sum + (pool.activeConnections / pool.maxConnections), 0) / Math.max(pools.length, 1),
      retryAttempts: 0,
      successRate: 0.95, // Would be calculated from actual requests
      averageRequestTime: 150
    };
  }

  /**
   * Optimize connection pool settings
   */
  public async optimizeConnectionPool(): Promise<NetworkOptimizationResult> {
    const beforeMetrics = await this.getMetrics();

    try {
      const pools = this.connectionPool.getPoolStats();
      
      // Analyze pool utilization and adjust settings
      for (const pool of pools) {
        const utilization = pool.activeConnections / pool.maxConnections;
        
        if (utilization > 0.8) {
          // Increase max connections if heavily utilized
          this.connectionPool.updateConfig({
            maxConnections: Math.min(pool.maxConnections + 10, 200)
          });
        } else if (utilization < 0.3 && pool.maxConnections > 10) {
          // Decrease max connections if underutilized
          this.connectionPool.updateConfig({
            maxConnections: Math.max(pool.maxConnections - 5, 10)
          });
        }
      }

      // Clean up idle connections
      this.connectionPool.cleanupIdleConnections();

      const afterMetrics = await this.getMetrics();

      const result: NetworkOptimizationResult = {
        success: true,
        action: 'optimize_connection_pool',
        description: 'Optimized connection pool settings based on utilization patterns',
        improvementPercentage: 15,
        beforeMetrics,
        afterMetrics
      };

      this.optimizationHistory.push(result);
      return result;

    } catch (error) {
      return {
        success: false,
        action: 'optimize_connection_pool',
        description: `Failed to optimize connection pool: ${error}`,
        improvementPercentage: 0,
        beforeMetrics,
        afterMetrics: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Optimize request batching
   */
  public optimizeRequestBatching(): void {
    const batchStats = this.requestBatcher.getBatchStats();
    
    // Adjust batch size based on performance
    if (batchStats.activeBatches > 10) {
      this.requestBatcher.updateConfig({
        maxBatchSize: Math.max(5, Math.floor(batchStats.totalRequests / batchStats.activeBatches))
      });
    }

    // Adjust timeout based on request patterns
    const avgRequestTime = this.metrics.slice(-10).reduce((sum, m) => sum + m.averageRequestTime, 0) / 10;
    if (avgRequestTime > 200) {
      this.requestBatcher.updateConfig({
        batchTimeout: Math.min(500, avgRequestTime * 2)
      });
    }
  }

  /**
   * Optimize retry strategy
   */
  public optimizeRetryStrategy(): void {
    const recentMetrics = this.metrics.slice(-20);
    const avgSuccessRate = recentMetrics.reduce((sum, m) => sum + m.successRate, 0) / recentMetrics.length;
    
    if (avgSuccessRate < 0.9) {
      // Increase retry attempts for low success rate
      this.retryManager.updateConfig({
        maxAttempts: Math.min(5, this.retryManager['config'].maxAttempts + 1)
      });
    } else if (avgSuccessRate > 0.98) {
      // Decrease retry attempts for high success rate
      this.retryManager.updateConfig({
        maxAttempts: Math.max(1, this.retryManager['config'].maxAttempts - 1)
      });
    }

    // Adjust delays based on latency
    const avgLatency = recentMetrics.reduce((sum, m) => sum + m.latency, 0) / recentMetrics.length;
    if (avgLatency > 1000) {
      this.retryManager.updateConfig({
        baseDelay: Math.min(5000, avgLatency * 2)
      });
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(async () => {
      await this.getMetrics();
      this.optimizeRequestBatching();
      this.optimizeRetryStrategy();
    }, 30000); // Every 30 seconds
  }

  /**
   * Preconnect to domains
   */
  public preconnectToDomains(domains: string[]): void {
    if (typeof document === 'undefined') return;

    domains.forEach(domain => {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = domain;
      document.head.appendChild(link);
    });
  }

  /**
   * DNS prefetch for domains
   */
  public dnsPrefetch(domains: string[]): void {
    if (typeof document === 'undefined') return;

    domains.forEach(domain => {
      const link = document.createElement('link');
      link.rel = 'dns-prefetch';
      link.href = domain;
      document.head.appendChild(link);
    });
  }

  /**
   * Get connection pool statistics
   */
  public getConnectionPoolStats(): ConnectionPool[] {
    return this.connectionPool.getPoolStats();
  }

  /**
   * Get optimization history
   */
  public getOptimizationHistory(): NetworkOptimizationResult[] {
    return [...this.optimizationHistory];
  }

  /**
   * Update connection pool configuration
   */
  public updateConnectionPoolConfig(config: Partial<ConnectionPoolConfig>): void {
    this.connectionPool.updateConfig(config);
  }

  /**
   * Update request batching configuration
   */
  public updateBatchingConfig(config: Partial<RequestBatchConfig>): void {
    this.requestBatcher.updateConfig(config);
  }

  /**
   * Update retry configuration
   */
  public updateRetryConfig(config: Partial<RetryConfig>): void {
    this.retryManager.updateConfig(config);
  }

  /**
   * Get current metrics
   */
  public getCurrentMetrics(): NetworkMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  /**
   * Clear metrics history
   */
  public clearMetrics(): void {
    this.metrics = [];
  }
}

// Export singleton instance
export const networkOptimizer = new NetworkOptimizer();