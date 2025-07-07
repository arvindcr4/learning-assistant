/**
 * Optimized Database Connection Module
 * 
 * This module provides a high-performance database connection system with:
 * - Connection pooling with intelligent sizing
 * - Query performance monitoring
 * - Automatic retry logic
 * - Health checking
 * - Connection lifecycle management
 * 
 * @module Database
 */

import { Pool, PoolConfig, PoolClient, QueryResult } from 'pg';
import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';

// Database configuration interface
export interface DatabaseConfig {
  connectionString: string;
  ssl?: boolean;
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  statementTimeout?: number;
  queryTimeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  healthCheckInterval?: number;
  slowQueryThreshold?: number;
  enableQueryLogging?: boolean;
  enablePerformanceMetrics?: boolean;
}

// Query performance metrics
export interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  rowCount?: number;
  error?: Error;
  parameters?: any[];
}

// Connection pool statistics
export interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingClients: number;
  totalQueries: number;
  slowQueries: number;
  averageQueryTime: number;
  errorRate: number;
  uptime: number;
}

// Database transaction options
export interface TransactionOptions {
  isolationLevel?: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
  readOnly?: boolean;
  deferrable?: boolean;
  timeout?: number;
}

class DatabaseConnection extends EventEmitter {
  private pool: Pool;
  private config: DatabaseConfig;
  private queryMetrics: QueryMetrics[] = [];
  private stats: PoolStats;
  private healthCheckTimer?: NodeJS.Timeout;
  private readonly startTime: Date;

  constructor(config: DatabaseConfig) {
    super();
    this.config = {
      maxConnections: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      statementTimeout: 30000,
      queryTimeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      healthCheckInterval: 60000,
      slowQueryThreshold: 1000,
      enableQueryLogging: process.env.NODE_ENV === 'development',
      enablePerformanceMetrics: true,
      ...config,
    };

    this.startTime = new Date();
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      totalQueries: 0,
      slowQueries: 0,
      averageQueryTime: 0,
      errorRate: 0,
      uptime: 0,
    };

    this.initializePool();
    this.startHealthCheck();
  }

  private initializePool(): void {
    const poolConfig: PoolConfig = {
      connectionString: this.config.connectionString,
      max: this.config.maxConnections,
      min: Math.ceil(this.config.maxConnections! / 4), // 25% of max as minimum
      idleTimeoutMillis: this.config.idleTimeoutMillis,
      connectionTimeoutMillis: this.config.connectionTimeoutMillis,
      statement_timeout: this.config.statementTimeout,
      query_timeout: this.config.queryTimeout,
      ssl: this.config.ssl ? {
        rejectUnauthorized: false,
      } : false,
    };

    this.pool = new Pool(poolConfig);

    // Pool event listeners
    this.pool.on('connect', (client: PoolClient) => {
      this.emit('connect', client);
      this.updateStats();
    });

    this.pool.on('acquire', (client: PoolClient) => {
      this.emit('acquire', client);
      this.updateStats();
    });

    this.pool.on('remove', (client: PoolClient) => {
      this.emit('remove', client);
      this.updateStats();
    });

    this.pool.on('error', (err: Error, client: PoolClient) => {
      this.emit('error', err, client);
      console.error('Database pool error:', err);
    });
  }

  private startHealthCheck(): void {
    if (this.config.healthCheckInterval && this.config.healthCheckInterval > 0) {
      this.healthCheckTimer = setInterval(async () => {
        try {
          await this.healthCheck();
        } catch (error) {
          console.error('Health check failed:', error);
          this.emit('healthCheckFailed', error);
        }
      }, this.config.healthCheckInterval);
    }
  }

  private updateStats(): void {
    this.stats.totalConnections = this.pool.totalCount;
    this.stats.activeConnections = this.pool.totalCount - this.pool.idleCount;
    this.stats.idleConnections = this.pool.idleCount;
    this.stats.waitingClients = this.pool.waitingCount;
    this.stats.uptime = Date.now() - this.startTime.getTime();
    
    if (this.queryMetrics.length > 0) {
      const totalTime = this.queryMetrics.reduce((sum, metric) => sum + metric.duration, 0);
      this.stats.averageQueryTime = totalTime / this.queryMetrics.length;
      this.stats.errorRate = this.queryMetrics.filter(m => m.error).length / this.queryMetrics.length;
    }
  }

  private recordQueryMetrics(query: string, duration: number, rowCount?: number, error?: Error, parameters?: any[]): void {
    if (!this.config.enablePerformanceMetrics) return;

    const metrics: QueryMetrics = {
      query,
      duration,
      timestamp: new Date(),
      rowCount,
      error,
      parameters,
    };

    this.queryMetrics.push(metrics);
    this.stats.totalQueries++;

    if (duration > this.config.slowQueryThreshold!) {
      this.stats.slowQueries++;
      this.emit('slowQuery', metrics);
    }

    // Keep only last 1000 metrics to prevent memory leaks
    if (this.queryMetrics.length > 1000) {
      this.queryMetrics = this.queryMetrics.slice(-1000);
    }

    if (this.config.enableQueryLogging) {
      console.log(`Query executed in ${duration}ms: ${query.substring(0, 100)}...`);
    }
  }

  /**
   * Execute a query with performance monitoring and retry logic
   */
  async query<T = any>(text: string, params?: any[], options?: { timeout?: number }): Promise<QueryResult<T>> {
    const startTime = performance.now();
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt < this.config.maxRetries!) {
      try {
        const client = await this.pool.connect();
        
        try {
          // Set query timeout if specified
          if (options?.timeout) {
            await client.query(`SET statement_timeout = ${options.timeout}`);
          }

          const result = await client.query<T>(text, params);
          const duration = performance.now() - startTime;
          
          this.recordQueryMetrics(text, duration, result.rowCount, undefined, params);
          
          return result;
        } finally {
          client.release();
        }
      } catch (error) {
        lastError = error as Error;
        attempt++;
        
        if (attempt < this.config.maxRetries!) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay! * attempt));
        }
      }
    }

    const duration = performance.now() - startTime;
    this.recordQueryMetrics(text, duration, undefined, lastError!, params);
    
    throw lastError;
  }

  /**
   * Execute a transaction with proper error handling
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      if (options?.isolationLevel) {
        await client.query(`SET TRANSACTION ISOLATION LEVEL ${options.isolationLevel}`);
      }
      
      if (options?.readOnly) {
        await client.query('SET TRANSACTION READ ONLY');
      }
      
      if (options?.deferrable) {
        await client.query('SET TRANSACTION DEFERRABLE');
      }
      
      if (options?.timeout) {
        await client.query(`SET LOCAL statement_timeout = ${options.timeout}`);
      }

      const result = await callback(client);
      await client.query('COMMIT');
      
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Execute multiple queries in a batch
   */
  async batchQuery<T = any>(queries: { text: string; params?: any[] }[]): Promise<QueryResult<T>[]> {
    const results: QueryResult<T>[] = [];
    
    for (const query of queries) {
      const result = await this.query<T>(query.text, query.params);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Get connection pool statistics
   */
  getStats(): PoolStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get recent query metrics
   */
  getQueryMetrics(limit: number = 100): QueryMetrics[] {
    return this.queryMetrics.slice(-limit);
  }

  /**
   * Get slow queries
   */
  getSlowQueries(limit: number = 50): QueryMetrics[] {
    return this.queryMetrics
      .filter(m => m.duration > this.config.slowQueryThreshold!)
      .slice(-limit);
  }

  /**
   * Perform a health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as health_check');
      return result.rows[0].health_check === 1;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Get database information
   */
  async getDatabaseInfo(): Promise<any> {
    const queries = [
      'SELECT version() as version',
      'SELECT current_database() as database',
      'SELECT current_user as user',
      'SELECT inet_server_addr() as host',
      'SELECT inet_server_port() as port',
    ];

    const results = await Promise.all(
      queries.map(query => this.query(query))
    );

    return {
      version: results[0].rows[0].version,
      database: results[1].rows[0].database,
      user: results[2].rows[0].user,
      host: results[3].rows[0].host,
      port: results[4].rows[0].port,
    };
  }

  /**
   * Optimize database performance
   */
  async optimizeDatabase(): Promise<void> {
    const optimizationQueries = [
      'ANALYZE;',
      'VACUUM ANALYZE;',
      'REINDEX DATABASE ' + (await this.query('SELECT current_database()')).rows[0].current_database,
    ];

    for (const query of optimizationQueries) {
      try {
        await this.query(query);
        console.log(`Executed optimization query: ${query}`);
      } catch (error) {
        console.error(`Failed to execute optimization query: ${query}`, error);
      }
    }
  }

  /**
   * Close the database connection pool
   */
  async close(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    await this.pool.end();
    this.emit('close');
  }
}

// Create database instance
let dbInstance: DatabaseConnection | null = null;

export function createDatabase(config: DatabaseConfig): DatabaseConnection {
  if (dbInstance) {
    throw new Error('Database instance already exists. Use getDatabase() to get the existing instance.');
  }
  
  dbInstance = new DatabaseConnection(config);
  return dbInstance;
}

export function getDatabase(): DatabaseConnection {
  if (!dbInstance) {
    throw new Error('Database instance not initialized. Call createDatabase() first.');
  }
  
  return dbInstance;
}

// Database configuration from environment
export const getDatabaseConfig = (): DatabaseConfig => {
  const config: DatabaseConfig = {
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/learning_assistant',
    ssl: process.env.NODE_ENV === 'production',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
    statementTimeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'),
    queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
    maxRetries: parseInt(process.env.DB_MAX_RETRIES || '3'),
    retryDelay: parseInt(process.env.DB_RETRY_DELAY || '1000'),
    healthCheckInterval: parseInt(process.env.DB_HEALTH_CHECK_INTERVAL || '60000'),
    slowQueryThreshold: parseInt(process.env.DB_SLOW_QUERY_THRESHOLD || '1000'),
    enableQueryLogging: process.env.DB_ENABLE_QUERY_LOGGING === 'true',
    enablePerformanceMetrics: process.env.DB_ENABLE_PERFORMANCE_METRICS !== 'false',
  };

  return config;
};

// Export types
export type { DatabaseConfig, QueryMetrics, PoolStats, TransactionOptions };
export { DatabaseConnection };