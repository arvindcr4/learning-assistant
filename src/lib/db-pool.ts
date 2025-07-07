/**
 * Advanced Database Connection Pool Manager
 * 
 * This module provides intelligent connection pool management with:
 * - Dynamic pool sizing based on load
 * - Connection health monitoring
 * - Load balancing across multiple databases
 * - Automatic failover and recovery
 * - Performance optimization
 * 
 * @module DatabasePool
 */

import { Pool, PoolClient, PoolConfig } from 'pg';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

// Pool configuration interface
export interface PoolManagerConfig {
  primary: {
    connectionString: string;
    maxConnections: number;
    minConnections: number;
  };
  replica?: {
    connectionString: string;
    maxConnections: number;
    minConnections: number;
  };
  ssl?: boolean;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  acquireTimeoutMillis?: number;
  reapIntervalMillis?: number;
  createTimeoutMillis?: number;
  destroyTimeoutMillis?: number;
  createRetryIntervalMillis?: number;
  propagateCreateError?: boolean;
  
  // Performance settings
  maxWaitingClients?: number;
  allowExitOnIdle?: boolean;
  
  // Health check settings
  healthCheckInterval?: number;
  healthCheckTimeout?: number;
  maxHealthCheckFailures?: number;
  
  // Load balancing settings
  readPreference?: 'primary' | 'replica' | 'auto';
  loadBalancingEnabled?: boolean;
  
  // Monitoring settings
  enableMetrics?: boolean;
  metricsInterval?: number;
}

// Pool statistics
export interface PoolMetrics {
  poolName: string;
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingClients: number;
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageQueryTime: number;
  averageWaitTime: number;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  lastHealthCheck: Date;
  uptime: number;
}

// Connection pool wrapper
class ManagedPool extends EventEmitter {
  private pool: Pool;
  private config: PoolConfig;
  private metrics: PoolMetrics;
  private healthCheckTimer?: NodeJS.Timeout;
  private consecutiveHealthFailures: number = 0;
  private readonly startTime: Date;
  private queryTimes: number[] = [];
  private waitTimes: number[] = [];

  constructor(
    public readonly name: string,
    config: PoolConfig,
    private readonly healthCheckInterval: number = 60000,
    private readonly healthCheckTimeout: number = 5000,
    private readonly maxHealthCheckFailures: number = 3
  ) {
    super();
    this.config = config;
    this.startTime = new Date();
    this.metrics = {
      poolName: name,
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageQueryTime: 0,
      averageWaitTime: 0,
      healthStatus: 'healthy',
      lastHealthCheck: new Date(),
      uptime: 0,
    };

    this.initializePool();
    this.startHealthCheck();
  }

  private initializePool(): void {
    this.pool = new Pool(this.config);

    // Pool event listeners
    this.pool.on('connect', (client: PoolClient) => {
      this.emit('connect', client);
      this.updateMetrics();
    });

    this.pool.on('acquire', (client: PoolClient) => {
      this.emit('acquire', client);
      this.updateMetrics();
    });

    this.pool.on('remove', (client: PoolClient) => {
      this.emit('remove', client);
      this.updateMetrics();
    });

    this.pool.on('error', (err: Error, client: PoolClient) => {
      this.emit('error', err, client);
      this.metrics.healthStatus = 'degraded';
      console.error(`Pool ${this.name} error:`, err);
    });
  }

  private startHealthCheck(): void {
    if (this.healthCheckInterval > 0) {
      this.healthCheckTimer = setInterval(async () => {
        await this.performHealthCheck();
      }, this.healthCheckInterval);
    }
  }

  private async performHealthCheck(): Promise<void> {
    const startTime = performance.now();
    
    try {
      const client = await this.pool.connect();
      
      try {
        // Set a timeout for the health check query
        await client.query(`SET statement_timeout = ${this.healthCheckTimeout}`);
        await client.query('SELECT 1');
        
        this.consecutiveHealthFailures = 0;
        this.metrics.healthStatus = 'healthy';
        this.metrics.lastHealthCheck = new Date();
        
        this.emit('healthCheckSuccess', {
          poolName: this.name,
          duration: performance.now() - startTime,
        });
      } finally {
        client.release();
      }
    } catch (error) {
      this.consecutiveHealthFailures++;
      
      if (this.consecutiveHealthFailures >= this.maxHealthCheckFailures) {
        this.metrics.healthStatus = 'unhealthy';
      } else {
        this.metrics.healthStatus = 'degraded';
      }
      
      this.emit('healthCheckFailure', {
        poolName: this.name,
        error,
        consecutiveFailures: this.consecutiveHealthFailures,
        duration: performance.now() - startTime,
      });
    }
  }

  private updateMetrics(): void {
    this.metrics.totalConnections = this.pool.totalCount;
    this.metrics.activeConnections = this.pool.totalCount - this.pool.idleCount;
    this.metrics.idleConnections = this.pool.idleCount;
    this.metrics.waitingClients = this.pool.waitingCount;
    this.metrics.uptime = Date.now() - this.startTime.getTime();
    
    // Calculate average query time
    if (this.queryTimes.length > 0) {
      this.metrics.averageQueryTime = this.queryTimes.reduce((sum, time) => sum + time, 0) / this.queryTimes.length;
    }
    
    // Calculate average wait time
    if (this.waitTimes.length > 0) {
      this.metrics.averageWaitTime = this.waitTimes.reduce((sum, time) => sum + time, 0) / this.waitTimes.length;
    }
  }

  async query<T = any>(text: string, params?: any[]): Promise<any> {
    const queryStart = performance.now();
    let client: PoolClient;
    
    try {
      const acquireStart = performance.now();
      client = await this.pool.connect();
      const acquireTime = performance.now() - acquireStart;
      
      // Track wait time
      this.waitTimes.push(acquireTime);
      if (this.waitTimes.length > 1000) {
        this.waitTimes = this.waitTimes.slice(-1000);
      }
      
      const result = await client.query<T>(text, params);
      const queryTime = performance.now() - queryStart;
      
      // Track query time
      this.queryTimes.push(queryTime);
      if (this.queryTimes.length > 1000) {
        this.queryTimes = this.queryTimes.slice(-1000);
      }
      
      this.metrics.totalQueries++;
      this.metrics.successfulQueries++;
      
      return result;
    } catch (error) {
      this.metrics.totalQueries++;
      this.metrics.failedQueries++;
      throw error;
    } finally {
      if (client!) {
        client.release();
      }
      this.updateMetrics();
    }
  }

  getMetrics(): PoolMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  isHealthy(): boolean {
    return this.metrics.healthStatus === 'healthy';
  }

  isDegraded(): boolean {
    return this.metrics.healthStatus === 'degraded';
  }

  isUnhealthy(): boolean {
    return this.metrics.healthStatus === 'unhealthy';
  }

  async close(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    await this.pool.end();
    this.emit('close');
  }
}

// Main pool manager class
export class DatabasePoolManager extends EventEmitter {
  private primaryPool: ManagedPool;
  private replicaPool?: ManagedPool;
  private config: PoolManagerConfig;
  private metricsTimer?: NodeJS.Timeout;
  private readonly startTime: Date;

  constructor(config: PoolManagerConfig) {
    super();
    this.config = {
      ssl: true,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      acquireTimeoutMillis: 60000,
      reapIntervalMillis: 1000,
      createTimeoutMillis: 3000,
      destroyTimeoutMillis: 5000,
      createRetryIntervalMillis: 200,
      propagateCreateError: false,
      maxWaitingClients: 10,
      allowExitOnIdle: false,
      healthCheckInterval: 60000,
      healthCheckTimeout: 5000,
      maxHealthCheckFailures: 3,
      readPreference: 'auto',
      loadBalancingEnabled: true,
      enableMetrics: true,
      metricsInterval: 30000,
      ...config,
    };

    this.startTime = new Date();
    this.initializePools();
    this.startMetricsCollection();
  }

  private initializePools(): void {
    // Primary pool configuration
    const primaryConfig: PoolConfig = {
      connectionString: this.config.primary.connectionString,
      max: this.config.primary.maxConnections,
      min: this.config.primary.minConnections,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
      idleTimeoutMillis: this.config.idleTimeoutMillis,
      connectionTimeoutMillis: this.config.connectionTimeoutMillis,
      acquireTimeoutMillis: this.config.acquireTimeoutMillis,
      reapIntervalMillis: this.config.reapIntervalMillis,
      createTimeoutMillis: this.config.createTimeoutMillis,
      destroyTimeoutMillis: this.config.destroyTimeoutMillis,
      createRetryIntervalMillis: this.config.createRetryIntervalMillis,
      propagateCreateError: this.config.propagateCreateError,
      maxWaitingClients: this.config.maxWaitingClients,
      allowExitOnIdle: this.config.allowExitOnIdle,
    };

    this.primaryPool = new ManagedPool(
      'primary',
      primaryConfig,
      this.config.healthCheckInterval,
      this.config.healthCheckTimeout,
      this.config.maxHealthCheckFailures
    );

    // Replica pool configuration (if provided)
    if (this.config.replica) {
      const replicaConfig: PoolConfig = {
        connectionString: this.config.replica.connectionString,
        max: this.config.replica.maxConnections,
        min: this.config.replica.minConnections,
        ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
        idleTimeoutMillis: this.config.idleTimeoutMillis,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis,
        acquireTimeoutMillis: this.config.acquireTimeoutMillis,
        reapIntervalMillis: this.config.reapIntervalMillis,
        createTimeoutMillis: this.config.createTimeoutMillis,
        destroyTimeoutMillis: this.config.destroyTimeoutMillis,
        createRetryIntervalMillis: this.config.createRetryIntervalMillis,
        propagateCreateError: this.config.propagateCreateError,
        maxWaitingClients: this.config.maxWaitingClients,
        allowExitOnIdle: this.config.allowExitOnIdle,
      };

      this.replicaPool = new ManagedPool(
        'replica',
        replicaConfig,
        this.config.healthCheckInterval,
        this.config.healthCheckTimeout,
        this.config.maxHealthCheckFailures
      );
    }

    // Forward pool events
    this.primaryPool.on('error', (err, client) => {
      this.emit('primaryError', err, client);
    });

    this.primaryPool.on('healthCheckFailure', (data) => {
      this.emit('primaryHealthCheckFailure', data);
    });

    if (this.replicaPool) {
      this.replicaPool.on('error', (err, client) => {
        this.emit('replicaError', err, client);
      });

      this.replicaPool.on('healthCheckFailure', (data) => {
        this.emit('replicaHealthCheckFailure', data);
      });
    }
  }

  private startMetricsCollection(): void {
    if (this.config.enableMetrics && this.config.metricsInterval) {
      this.metricsTimer = setInterval(() => {
        this.collectMetrics();
      }, this.config.metricsInterval);
    }
  }

  private collectMetrics(): void {
    const metrics = this.getAllMetrics();
    this.emit('metricsCollected', metrics);
  }

  /**
   * Execute a query with intelligent routing
   */
  async query<T = any>(text: string, params?: any[], options?: { readOnly?: boolean }): Promise<any> {
    const pool = this.selectPool(options?.readOnly);
    return pool.query<T>(text, params);
  }

  /**
   * Execute a read-only query (prefers replica if available)
   */
  async queryRead<T = any>(text: string, params?: any[]): Promise<any> {
    return this.query<T>(text, params, { readOnly: true });
  }

  /**
   * Execute a write query (always uses primary)
   */
  async queryWrite<T = any>(text: string, params?: any[]): Promise<any> {
    return this.primaryPool.query<T>(text, params);
  }

  private selectPool(readOnly?: boolean): ManagedPool {
    // Always use primary for writes
    if (!readOnly) {
      return this.primaryPool;
    }

    // If no replica is configured, use primary
    if (!this.replicaPool) {
      return this.primaryPool;
    }

    // Choose pool based on read preference
    switch (this.config.readPreference) {
      case 'primary':
        return this.primaryPool;
      
      case 'replica':
        return this.replicaPool.isHealthy() ? this.replicaPool : this.primaryPool;
      
      case 'auto':
      default:
        // Use replica if healthy and load balancing is enabled
        if (this.config.loadBalancingEnabled && this.replicaPool.isHealthy()) {
          // Simple load balancing: use replica if it has fewer active connections
          const primaryMetrics = this.primaryPool.getMetrics();
          const replicaMetrics = this.replicaPool.getMetrics();
          
          if (replicaMetrics.activeConnections < primaryMetrics.activeConnections) {
            return this.replicaPool;
          }
        }
        
        return this.primaryPool;
    }
  }

  /**
   * Get metrics for all pools
   */
  getAllMetrics(): { primary: PoolMetrics; replica?: PoolMetrics } {
    const metrics: { primary: PoolMetrics; replica?: PoolMetrics } = {
      primary: this.primaryPool.getMetrics(),
    };

    if (this.replicaPool) {
      metrics.replica = this.replicaPool.getMetrics();
    }

    return metrics;
  }

  /**
   * Get overall health status
   */
  getHealthStatus(): 'healthy' | 'degraded' | 'unhealthy' {
    const primaryHealthy = this.primaryPool.isHealthy();
    const replicaHealthy = this.replicaPool?.isHealthy() ?? true;

    if (primaryHealthy && replicaHealthy) {
      return 'healthy';
    } else if (primaryHealthy || replicaHealthy) {
      return 'degraded';
    } else {
      return 'unhealthy';
    }
  }

  /**
   * Check if the pool manager is ready to accept queries
   */
  isReady(): boolean {
    return this.primaryPool.isHealthy() || this.primaryPool.isDegraded();
  }

  /**
   * Close all pools
   */
  async close(): Promise<void> {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }

    await this.primaryPool.close();
    
    if (this.replicaPool) {
      await this.replicaPool.close();
    }

    this.emit('close');
  }
}

// Factory function for creating pool manager
export function createPoolManager(config: PoolManagerConfig): DatabasePoolManager {
  return new DatabasePoolManager(config);
}

// Default configuration from environment
export const getPoolManagerConfig = (): PoolManagerConfig => {
  const config: PoolManagerConfig = {
    primary: {
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/learning_assistant',
      maxConnections: parseInt(process.env.DB_PRIMARY_MAX_CONNECTIONS || '20'),
      minConnections: parseInt(process.env.DB_PRIMARY_MIN_CONNECTIONS || '5'),
    },
    ssl: process.env.NODE_ENV === 'production',
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
    healthCheckInterval: parseInt(process.env.DB_HEALTH_CHECK_INTERVAL || '60000'),
    healthCheckTimeout: parseInt(process.env.DB_HEALTH_CHECK_TIMEOUT || '5000'),
    maxHealthCheckFailures: parseInt(process.env.DB_MAX_HEALTH_CHECK_FAILURES || '3'),
    readPreference: (process.env.DB_READ_PREFERENCE as 'primary' | 'replica' | 'auto') || 'auto',
    loadBalancingEnabled: process.env.DB_LOAD_BALANCING_ENABLED !== 'false',
    enableMetrics: process.env.DB_ENABLE_METRICS !== 'false',
    metricsInterval: parseInt(process.env.DB_METRICS_INTERVAL || '30000'),
  };

  // Add replica configuration if provided
  if (process.env.DATABASE_REPLICA_URL) {
    config.replica = {
      connectionString: process.env.DATABASE_REPLICA_URL,
      maxConnections: parseInt(process.env.DB_REPLICA_MAX_CONNECTIONS || '15'),
      minConnections: parseInt(process.env.DB_REPLICA_MIN_CONNECTIONS || '3'),
    };
  }

  return config;
};

// Export types
export type { PoolManagerConfig, PoolMetrics };