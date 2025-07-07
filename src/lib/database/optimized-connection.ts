import { Pool, PoolClient, QueryResult, QueryResultRow, PoolConfig } from 'pg';
import { getDatabaseConfig, getPoolConfig, getCurrentEnvironment, getEnvironmentSettings } from './config';

// Enhanced connection pool with monitoring and optimization
export class OptimizedDatabaseConnection {
  private static instance: OptimizedDatabaseConnection;
  private pool: Pool;
  private readonly config = getDatabaseConfig();
  private readonly environment = getCurrentEnvironment();
  private readonly settings = getEnvironmentSettings(this.environment);
  
  // Performance monitoring
  private queryCount = 0;
  private totalExecutionTime = 0;
  private slowQueryThreshold = 5000; // 5 seconds
  private slowQueries: Array<{
    query: string;
    executionTime: number;
    timestamp: Date;
  }> = [];
  
  // Connection pool statistics
  private connectionStats = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    waitingClients: 0,
    connectTime: 0,
    lastError: null as Error | null,
    lastErrorTime: null as Date | null,
  };

  private constructor() {
    this.pool = new Pool(this.getOptimizedPoolConfig());
    this.setupPoolEventHandlers();
    this.setupHealthMonitoring();
  }

  public static getInstance(): OptimizedDatabaseConnection {
    if (!OptimizedDatabaseConnection.instance) {
      OptimizedDatabaseConnection.instance = new OptimizedDatabaseConnection();
    }
    return OptimizedDatabaseConnection.instance;
  }

  private getOptimizedPoolConfig(): PoolConfig {
    const baseConfig = getPoolConfig(this.config);
    
    // Environment-specific optimizations
    const optimizations = {
      development: {
        max: 10,
        min: 2,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 5000,
        acquireTimeoutMillis: 10000,
        statement_timeout: 10000,
        query_timeout: 10000,
      },
      staging: {
        max: 20,
        min: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        acquireTimeoutMillis: 15000,
        statement_timeout: 30000,
        query_timeout: 30000,
      },
      production: {
        max: 50,
        min: 10,
        idleTimeoutMillis: 60000,
        connectionTimeoutMillis: 15000,
        acquireTimeoutMillis: 20000,
        statement_timeout: 60000,
        query_timeout: 60000,
      },
      test: {
        max: 5,
        min: 1,
        idleTimeoutMillis: 5000,
        connectionTimeoutMillis: 3000,
        acquireTimeoutMillis: 5000,
        statement_timeout: 5000,
        query_timeout: 5000,
      },
    };

    const envOptimizations = optimizations[this.environment];
    
    return {
      ...baseConfig,
      ...envOptimizations,
      // Connection optimization settings
      keepAlive: true,
      keepAliveInitialDelayMillis: 0,
      // Application name for monitoring
      application_name: `learning-assistant-${this.environment}`,
      // Additional PostgreSQL settings
      options: '--search_path=public',
    };
  }

  private setupPoolEventHandlers(): void {
    this.pool.on('connect', (client: PoolClient) => {
      this.connectionStats.totalConnections++;
      this.connectionStats.activeConnections++;
      
      // Set session-level optimizations
      client.query(`
        SET statement_timeout = ${this.getOptimizedPoolConfig().statement_timeout};
        SET lock_timeout = 30000;
        SET idle_in_transaction_session_timeout = 60000;
        SET default_transaction_isolation = 'read committed';
        SET synchronous_commit = off;
      `).catch(err => {
        console.warn('Failed to set session optimizations:', err);
      });
      
      if (this.settings.logQueries) {
        console.log(`[DB] New connection established (Total: ${this.connectionStats.totalConnections})`);
      }
    });

    this.pool.on('acquire', (client: PoolClient) => {
      this.connectionStats.activeConnections++;
      this.connectionStats.idleConnections--;
      
      if (this.settings.logQueries) {
        console.log(`[DB] Connection acquired (Active: ${this.connectionStats.activeConnections})`);
      }
    });

    this.pool.on('release', (client: PoolClient) => {
      this.connectionStats.activeConnections--;
      this.connectionStats.idleConnections++;
      
      if (this.settings.logQueries) {
        console.log(`[DB] Connection released (Active: ${this.connectionStats.activeConnections})`);
      }
    });

    this.pool.on('error', (err: Error, client: PoolClient) => {
      this.connectionStats.lastError = err;
      this.connectionStats.lastErrorTime = new Date();
      
      console.error('[DB] Pool error:', err);
      
      // Log connection pool stats on error
      console.error('[DB] Pool stats:', this.getDetailedPoolStats());
    });

    this.pool.on('remove', (client: PoolClient) => {
      this.connectionStats.totalConnections--;
      
      if (this.settings.logQueries) {
        console.log(`[DB] Connection removed (Total: ${this.connectionStats.totalConnections})`);
      }
    });
  }

  private setupHealthMonitoring(): void {
    // Periodic health checks
    setInterval(async () => {
      try {
        await this.healthCheck();
      } catch (error) {
        console.error('[DB] Health check failed:', error);
      }
    }, 30000); // Every 30 seconds

    // Periodic stats logging
    if (this.settings.logQueries) {
      setInterval(() => {
        const stats = this.getDetailedPoolStats();
        console.log('[DB] Pool Statistics:', stats);
      }, 60000); // Every minute
    }

    // Slow query cleanup
    setInterval(() => {
      // Keep only last 100 slow queries
      this.slowQueries = this.slowQueries.slice(-100);
    }, 300000); // Every 5 minutes
  }

  public async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
    options: {
      timeout?: number;
      retries?: number;
      logQuery?: boolean;
      useReadReplica?: boolean;
    } = {}
  ): Promise<QueryResult<T>> {
    const {
      timeout = this.getOptimizedPoolConfig().query_timeout,
      retries = this.settings.retryAttempts,
      logQuery = this.settings.logQueries,
      useReadReplica = false,
    } = options;

    const startTime = Date.now();
    let lastError: Error | null = null;
    
    // Generate query hash for monitoring
    const queryHash = this.generateQueryHash(text, params);
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this.executeQuery<T>(text, params, timeout, logQuery);
        const executionTime = Date.now() - startTime;
        
        // Update statistics
        this.updateQueryStats(text, executionTime, result.rowCount || 0);
        
        // Log performance metrics
        if (logQuery || executionTime > this.slowQueryThreshold) {
          this.logQueryPerformance(text, params, executionTime, result.rowCount || 0);
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < retries && this.isRetryableError(error as Error)) {
          const backoffTime = Math.min(1000 * Math.pow(2, attempt), 10000);
          
          if (logQuery) {
            console.warn(`[DB] Query attempt ${attempt + 1} failed, retrying in ${backoffTime}ms:`, (error as Error).message);
          }
          
          await this.delay(backoffTime);
        } else {
          // Log final error
          const executionTime = Date.now() - startTime;
          this.logQueryError(text, params, error as Error, executionTime);
          break;
        }
      }
    }

    throw lastError;
  }

  private async executeQuery<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
    timeout?: number,
    logQuery?: boolean
  ): Promise<QueryResult<T>> {
    const client = await this.pool.connect();
    
    try {
      // Set query timeout if specified
      if (timeout) {
        await client.query(`SET statement_timeout = ${timeout}`);
      }
      
      const result = await client.query<T>(text, params);
      
      return result;
    } finally {
      client.release();
    }
  }

  private updateQueryStats(query: string, executionTime: number, rowCount: number): void {
    this.queryCount++;
    this.totalExecutionTime += executionTime;
    
    // Track slow queries
    if (executionTime > this.slowQueryThreshold) {
      this.slowQueries.push({
        query: query.substring(0, 200), // Truncate for storage
        executionTime,
        timestamp: new Date(),
      });
    }
  }

  private logQueryPerformance(query: string, params: any[], executionTime: number, rowCount: number): void {
    const logLevel = executionTime > this.slowQueryThreshold ? 'warn' : 'info';
    
    console[logLevel](`[DB] Query executed in ${executionTime}ms, returned ${rowCount} rows`);
    
    if (this.settings.logQueries) {
      console[logLevel](`[DB] Query: ${query}`);
      if (params && params.length > 0) {
        console[logLevel](`[DB] Parameters:`, params);
      }
    }
  }

  private logQueryError(query: string, params: any[], error: Error, executionTime: number): void {
    console.error(`[DB] Query failed after ${executionTime}ms:`, error.message);
    
    if (this.settings.logQueries) {
      console.error(`[DB] Failed query: ${query}`);
      if (params && params.length > 0) {
        console.error(`[DB] Parameters:`, params);
      }
    }
  }

  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'connection terminated',
      'connection closed',
      'connection lost',
      'timeout',
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ENETUNREACH',
    ];
    
    return retryableErrors.some(errType => 
      error.message.toLowerCase().includes(errType.toLowerCase())
    );
  }

  private generateQueryHash(query: string, params?: any[]): string {
    // Simple hash generation for query identification
    const crypto = require('crypto');
    const queryString = query + JSON.stringify(params || []);
    return crypto.createHash('md5').update(queryString).digest('hex');
  }

  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
    options: {
      isolationLevel?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
      timeout?: number;
      retries?: number;
    } = {}
  ): Promise<T> {
    const {
      isolationLevel = 'READ COMMITTED',
      timeout = 30000,
      retries = 3,
    } = options;

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      const client = await this.pool.connect();
      
      try {
        // Set transaction timeout
        await client.query(`SET statement_timeout = ${timeout}`);
        
        // Begin transaction with specified isolation level
        await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`);
        
        const result = await callback(client);
        
        await client.query('COMMIT');
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('[DB] Rollback failed:', rollbackError);
        }
        
        if (attempt < retries && this.isRetryableError(error as Error)) {
          const backoffTime = Math.min(1000 * Math.pow(2, attempt), 5000);
          console.warn(`[DB] Transaction attempt ${attempt + 1} failed, retrying in ${backoffTime}ms:`, (error as Error).message);
          await this.delay(backoffTime);
        } else {
          break;
        }
      } finally {
        client.release();
      }
    }

    throw lastError;
  }

  public async healthCheck(): Promise<{
    database: boolean;
    responseTime: number;
    poolStats: any;
  }> {
    const startTime = Date.now();
    
    try {
      await this.pool.query('SELECT 1 as health_check');
      const responseTime = Date.now() - startTime;
      
      return {
        database: true,
        responseTime,
        poolStats: this.getDetailedPoolStats(),
      };
    } catch (error) {
      console.error('[DB] Health check failed:', error);
      const responseTime = Date.now() - startTime;
      
      return {
        database: false,
        responseTime,
        poolStats: this.getDetailedPoolStats(),
      };
    }
  }

  public getDetailedPoolStats(): any {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      maxConnections: this.config.maxConnections || 20,
      
      // Custom statistics
      queryCount: this.queryCount,
      averageExecutionTime: this.queryCount > 0 ? this.totalExecutionTime / this.queryCount : 0,
      slowQueryCount: this.slowQueries.length,
      
      // Connection health
      lastError: this.connectionStats.lastError?.message || null,
      lastErrorTime: this.connectionStats.lastErrorTime,
      
      // Pool utilization
      utilizationPercent: (this.pool.totalCount / (this.config.maxConnections || 20)) * 100,
      activePercent: this.pool.totalCount > 0 ? (this.pool.idleCount / this.pool.totalCount) * 100 : 0,
    };
  }

  public getSlowQueries(): Array<{
    query: string;
    executionTime: number;
    timestamp: Date;
  }> {
    return [...this.slowQueries];
  }

  public async getQueryPerformanceStats(): Promise<{
    totalQueries: number;
    averageExecutionTime: number;
    slowQueries: number;
    connectionPoolStats: any;
  }> {
    return {
      totalQueries: this.queryCount,
      averageExecutionTime: this.queryCount > 0 ? this.totalExecutionTime / this.queryCount : 0,
      slowQueries: this.slowQueries.length,
      connectionPoolStats: this.getDetailedPoolStats(),
    };
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      console.log('[DB] Database connection pool closed');
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance getter
export const getOptimizedDatabase = (): OptimizedDatabaseConnection => {
  return OptimizedDatabaseConnection.getInstance();
};

// Global optimized query function
export const optimizedQuery = async <T extends QueryResultRow = any>(
  text: string,
  params?: any[],
  options?: {
    timeout?: number;
    retries?: number;
    logQuery?: boolean;
    useReadReplica?: boolean;
  }
): Promise<QueryResult<T>> => {
  const db = getOptimizedDatabase();
  return db.query<T>(text, params, options);
};

// Global optimized transaction function
export const optimizedTransaction = async <T>(
  callback: (client: PoolClient) => Promise<T>,
  options?: {
    isolationLevel?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
    timeout?: number;
    retries?: number;
  }
): Promise<T> => {
  const db = getOptimizedDatabase();
  return db.transaction(callback, options);
};

// Connection health check
export const checkOptimizedDatabaseHealth = async (): Promise<{
  database: boolean;
  responseTime: number;
  poolStats: any;
}> => {
  const db = getOptimizedDatabase();
  return db.healthCheck();
};

// Performance monitoring
export const getDatabasePerformanceStats = async (): Promise<{
  totalQueries: number;
  averageExecutionTime: number;
  slowQueries: number;
  connectionPoolStats: any;
}> => {
  const db = getOptimizedDatabase();
  return db.getQueryPerformanceStats();
};

// Initialize optimized database connection
export const initializeOptimizedDatabase = async (): Promise<void> => {
  const db = getOptimizedDatabase();
  const health = await db.healthCheck();
  
  if (!health.database) {
    throw new Error('Failed to establish optimized database connection');
  }
  
  console.log('[DB] Optimized database connection initialized successfully');
  console.log('[DB] Initial pool stats:', health.poolStats);
};

// Graceful shutdown
export const shutdownOptimizedDatabase = async (): Promise<void> => {
  const db = getOptimizedDatabase();
  await db.close();
  console.log('[DB] Optimized database connections closed');
};