/**
 * Database Integration Layer
 * 
 * This module provides a unified interface for database operations with:
 * - Automatic connection management
 * - Built-in monitoring and alerting
 * - Query optimization and caching
 * - Error handling and retry logic
 * 
 * @module DatabaseIntegration
 */

import { createDatabase, getDatabaseConfig, DatabaseConnection } from './database';
import { createPoolManager, getPoolManagerConfig, DatabasePoolManager } from './db-pool';
import { DatabaseMonitor } from './db-monitoring';
import { EventEmitter } from 'events';

// Global database instances
let dbInstance: DatabaseConnection | null = null;
let poolManagerInstance: DatabasePoolManager | null = null;
let monitorInstance: DatabaseMonitor | null = null;
let integrationInstance: DatabaseIntegration | null = null;

// Database integration configuration
export interface DatabaseIntegrationConfig {
  enableMonitoring?: boolean;
  enableReplication?: boolean;
  enableQueryCache?: boolean;
  cacheSize?: number;
  cacheTTL?: number;
  enableMetrics?: boolean;
  metricsInterval?: number;
  autoOptimize?: boolean;
  optimizationInterval?: number;
}

// Query cache entry
interface CacheEntry {
  result: any;
  timestamp: number;
  ttl: number;
  queryHash: string;
}

// Database metrics
export interface DatabaseMetrics {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  averageQueryTime: number;
  slowQueries: number;
  errorRate: number;
  connectionUtilization: number;
  replicationLag?: number;
}

export class DatabaseIntegration extends EventEmitter {
  private database: DatabaseConnection;
  private poolManager?: DatabasePoolManager;
  private monitor?: DatabaseMonitor;
  private config: DatabaseIntegrationConfig;
  private queryCache: Map<string, CacheEntry> = new Map();
  private metrics: DatabaseMetrics;
  private metricsInterval?: NodeJS.Timeout;
  private optimizationInterval?: NodeJS.Timeout;

  constructor(config: DatabaseIntegrationConfig = {}) {
    super();
    
    this.config = {
      enableMonitoring: true,
      enableReplication: false,
      enableQueryCache: true,
      cacheSize: 1000,
      cacheTTL: 300000, // 5 minutes
      enableMetrics: true,
      metricsInterval: 60000, // 1 minute
      autoOptimize: true,
      optimizationInterval: 3600000, // 1 hour
      ...config,
    };

    this.metrics = {
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageQueryTime: 0,
      slowQueries: 0,
      errorRate: 0,
      connectionUtilization: 0,
    };

    this.initializeDatabase();
    this.setupEventListeners();
    this.startMetricsCollection();
    this.startAutoOptimization();
  }

  private initializeDatabase(): void {
    // Initialize core database connection
    const dbConfig = getDatabaseConfig();
    this.database = createDatabase(dbConfig);

    // Initialize pool manager if replication is enabled
    if (this.config.enableReplication) {
      const poolConfig = getPoolManagerConfig();
      this.poolManager = createPoolManager(poolConfig);
    }

    // Initialize monitoring if enabled
    if (this.config.enableMonitoring) {
      this.monitor = new DatabaseMonitor(
        this.database,
        this.poolManager,
        {
          slowQueryThreshold: 1000,
          enableSlowQueryAlerts: true,
          enableConnectionAlerts: true,
          enableErrorRateAlerts: true,
        }
      );
    }
  }

  private setupEventListeners(): void {
    // Listen for database events
    this.database.on('slowQuery', (metrics) => {
      this.metrics.slowQueries++;
      this.emit('slowQuery', metrics);
    });

    this.database.on('error', (error) => {
      this.emit('error', error);
    });

    // Listen for pool manager events if available
    if (this.poolManager) {
      this.poolManager.on('primaryError', (error) => {
        this.emit('primaryError', error);
      });

      this.poolManager.on('replicaError', (error) => {
        this.emit('replicaError', error);
      });
    }

    // Listen for monitor events if available
    if (this.monitor) {
      this.monitor.on('alert', (alert) => {
        this.emit('alert', alert);
      });

      this.monitor.on('metricsCollected', (metrics) => {
        this.updateMetrics(metrics);
      });
    }
  }

  private startMetricsCollection(): void {
    if (!this.config.enableMetrics || !this.config.metricsInterval) return;

    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.metricsInterval);
  }

  private startAutoOptimization(): void {
    if (!this.config.autoOptimize || !this.config.optimizationInterval) return;

    this.optimizationInterval = setInterval(async () => {
      await this.optimizeDatabase();
    }, this.config.optimizationInterval);
  }

  private collectMetrics(): void {
    // Get database stats
    const dbStats = this.database.getStats();
    
    // Update connection utilization
    this.metrics.connectionUtilization = dbStats.totalConnections / 20; // Assuming max 20 connections

    // Calculate cache hit ratio
    const totalCacheRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
    const cacheHitRatio = totalCacheRequests > 0 ? this.metrics.cacheHits / totalCacheRequests : 0;

    // Update average query time
    this.metrics.averageQueryTime = dbStats.averageQueryTime;

    // Calculate error rate
    this.metrics.errorRate = dbStats.errorRate;

    // Get replication lag if available
    if (this.poolManager) {
      const poolMetrics = this.poolManager.getAllMetrics();
      if (poolMetrics.replica) {
        // This would need to be implemented based on actual replication metrics
        this.metrics.replicationLag = 0; // Placeholder
      }
    }

    this.emit('metricsUpdated', this.metrics);
  }

  private updateMetrics(healthMetrics: any): void {
    // Update metrics from health monitoring
    if (healthMetrics.connectionUtilization !== undefined) {
      this.metrics.connectionUtilization = healthMetrics.connectionUtilization;
    }
    
    if (healthMetrics.averageQueryTime !== undefined) {
      this.metrics.averageQueryTime = healthMetrics.averageQueryTime;
    }
  }

  private generateCacheKey(query: string, params?: any[]): string {
    const paramString = params ? JSON.stringify(params) : '';
    return Buffer.from(query + paramString).toString('base64');
  }

  private getCachedResult(cacheKey: string): any | null {
    if (!this.config.enableQueryCache) return null;

    const entry = this.queryCache.get(cacheKey);
    if (!entry) {
      this.metrics.cacheMisses++;
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.queryCache.delete(cacheKey);
      this.metrics.cacheMisses++;
      return null;
    }

    this.metrics.cacheHits++;
    return entry.result;
  }

  private setCachedResult(cacheKey: string, result: any, ttl?: number): void {
    if (!this.config.enableQueryCache) return;

    // Check cache size limit
    if (this.queryCache.size >= this.config.cacheSize!) {
      // Remove oldest entries
      const entries = Array.from(this.queryCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Remove oldest 10% of entries
      const removeCount = Math.floor(this.config.cacheSize! * 0.1);
      for (let i = 0; i < removeCount; i++) {
        this.queryCache.delete(entries[i][0]);
      }
    }

    const entry: CacheEntry = {
      result,
      timestamp: Date.now(),
      ttl: ttl || this.config.cacheTTL!,
      queryHash: cacheKey,
    };

    this.queryCache.set(cacheKey, entry);
  }

  /**
   * Execute a query with caching, monitoring, and optimization
   */
  async query<T = any>(
    text: string, 
    params?: any[], 
    options?: { 
      timeout?: number; 
      cache?: boolean; 
      cacheTTL?: number;
      readOnly?: boolean;
    }
  ): Promise<any> {
    const startTime = Date.now();
    const enableCache = options?.cache !== false && this.config.enableQueryCache;
    
    this.metrics.totalQueries++;

    // Check cache for read-only queries
    if (enableCache && (options?.readOnly || text.trim().toUpperCase().startsWith('SELECT'))) {
      const cacheKey = this.generateCacheKey(text, params);
      const cachedResult = this.getCachedResult(cacheKey);
      
      if (cachedResult) {
        return cachedResult;
      }
    }

    try {
      let result;

      // Use pool manager for query routing if available
      if (this.poolManager) {
        if (options?.readOnly || text.trim().toUpperCase().startsWith('SELECT')) {
          result = await this.poolManager.queryRead(text, params);
        } else {
          result = await this.poolManager.queryWrite(text, params);
        }
      } else {
        result = await this.database.query<T>(text, params, { timeout: options?.timeout });
      }

      // Cache the result if applicable
      if (enableCache && (options?.readOnly || text.trim().toUpperCase().startsWith('SELECT'))) {
        const cacheKey = this.generateCacheKey(text, params);
        this.setCachedResult(cacheKey, result, options?.cacheTTL);
      }

      return result;
    } catch (error) {
      this.emit('queryError', { query: text, params, error, duration: Date.now() - startTime });
      throw error;
    }
  }

  /**
   * Execute a transaction with monitoring
   */
  async transaction<T>(
    callback: (client: any) => Promise<T>,
    options?: { timeout?: number; isolationLevel?: string }
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await this.database.transaction(callback, {
        timeout: options?.timeout,
        isolationLevel: options?.isolationLevel as any,
      });

      this.emit('transactionCompleted', { duration: Date.now() - startTime });
      return result;
    } catch (error) {
      this.emit('transactionError', { error, duration: Date.now() - startTime });
      throw error;
    }
  }

  /**
   * Execute multiple queries in batch
   */
  async batchQuery<T = any>(
    queries: Array<{ text: string; params?: any[] }>,
    options?: { timeout?: number }
  ): Promise<any[]> {
    const startTime = Date.now();
    
    try {
      const results = await this.database.batchQuery<T>(queries);
      
      this.emit('batchCompleted', { 
        queryCount: queries.length,
        duration: Date.now() - startTime 
      });
      
      return results;
    } catch (error) {
      this.emit('batchError', { 
        queryCount: queries.length,
        error, 
        duration: Date.now() - startTime 
      });
      throw error;
    }
  }

  /**
   * Get current database metrics
   */
  getMetrics(): DatabaseMetrics {
    return { ...this.metrics };
  }

  /**
   * Get database health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    try {
      const isHealthy = await this.database.healthCheck();
      const stats = this.database.getStats();
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (!isHealthy) {
        status = 'unhealthy';
      } else if (stats.errorRate > 0.05 || stats.averageQueryTime > 2000) {
        status = 'degraded';
      }

      return {
        status,
        details: {
          isHealthy,
          stats,
          poolStatus: this.poolManager?.getHealthStatus(),
          replicationLag: this.metrics.replicationLag,
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error.message }
      };
    }
  }

  /**
   * Clear query cache
   */
  clearCache(): void {
    this.queryCache.clear();
    this.emit('cacheCleared');
  }

  /**
   * Optimize database performance
   */
  async optimizeDatabase(): Promise<void> {
    try {
      await this.database.optimizeDatabase();
      this.emit('optimizationCompleted');
    } catch (error) {
      this.emit('optimizationError', error);
    }
  }

  /**
   * Get query cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRatio: number;
    totalHits: number;
    totalMisses: number;
  } {
    const totalRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
    
    return {
      size: this.queryCache.size,
      hitRatio: totalRequests > 0 ? this.metrics.cacheHits / totalRequests : 0,
      totalHits: this.metrics.cacheHits,
      totalMisses: this.metrics.cacheMisses,
    };
  }

  /**
   * Close all database connections
   */
  async close(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
    }

    if (this.monitor) {
      this.monitor.stop();
    }

    if (this.poolManager) {
      await this.poolManager.close();
    }

    await this.database.close();
    
    this.emit('closed');
  }
}

// Factory function to create or get database integration instance
export function createDatabaseIntegration(config?: DatabaseIntegrationConfig): DatabaseIntegration {
  if (integrationInstance) {
    throw new Error('Database integration instance already exists. Use getDatabaseIntegration() to get the existing instance.');
  }
  
  integrationInstance = new DatabaseIntegration(config);
  return integrationInstance;
}

export function getDatabaseIntegration(): DatabaseIntegration {
  if (!integrationInstance) {
    throw new Error('Database integration instance not initialized. Call createDatabaseIntegration() first.');
  }
  
  return integrationInstance;
}

// Convenience functions for common operations
export async function query<T = any>(text: string, params?: any[], options?: any): Promise<any> {
  const integration = getDatabaseIntegration();
  return integration.query<T>(text, params, options);
}

export async function queryRead<T = any>(text: string, params?: any[]): Promise<any> {
  const integration = getDatabaseIntegration();
  return integration.query<T>(text, params, { readOnly: true });
}

export async function queryWrite<T = any>(text: string, params?: any[]): Promise<any> {
  const integration = getDatabaseIntegration();
  return integration.query<T>(text, params, { readOnly: false });
}

export async function transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
  const integration = getDatabaseIntegration();
  return integration.transaction(callback);
}

// Export types
export type { DatabaseIntegrationConfig, DatabaseMetrics };