import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { readFileSync } from 'fs';

import { getDatabaseConfig, getPoolConfig, getCurrentEnvironment, getEnvironmentSettings } from './config';

// Global connection pool instance
let globalPool: Pool | null = null;

// Connection pool statistics
interface PoolStats {
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
  maxConnections: number;
}

// Query execution options
interface QueryOptions {
  timeout?: number;
  retries?: number;
  logQuery?: boolean;
}

// Enhanced database connection manager with monitoring and recovery
export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool: Pool;
  private readonly config = getDatabaseConfig();
  private readonly environment = getCurrentEnvironment();
  private readonly settings = getEnvironmentSettings(this.environment);
  private metrics: {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    waitingClients: number;
    totalQueries: number;
    errorCount: number;
    lastError: string | null;
    lastErrorTime: Date | null;
    connectionErrors: number;
    queryErrors: number;
    timeouts: number;
    retries: number;
  };
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isHealthy: boolean = true;
  private lastHealthCheck: Date | null = null;
  private connectionAttempts: number = 0;
  private readonly maxConnectionAttempts = parseInt(process.env.DB_MAX_CONNECTION_ATTEMPTS || '5');
  private readonly connectionRetryDelay = parseInt(process.env.DB_CONNECTION_RETRY_DELAY || '5000');

  private constructor() {
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      totalQueries: 0,
      errorCount: 0,
      lastError: null,
      lastErrorTime: null,
      connectionErrors: 0,
      queryErrors: 0,
      timeouts: 0,
      retries: 0
    };
    this.pool = new Pool(this.getEnhancedPoolConfig());
    this.setupPoolEventHandlers();
    this.setupHealthChecks();
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  // Enhanced pool configuration with advanced settings
  private getEnhancedPoolConfig() {
    const baseConfig = getPoolConfig(this.config);
    
    return {
      ...baseConfig,
      // Enhanced SSL configuration
      ssl: this.getSSLConfig(),
      // Application name for monitoring
      application_name: `learning-assistant-${this.environment}`,
      // Advanced timeouts
      acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '30000'),
      createTimeoutMillis: parseInt(process.env.DB_CREATE_TIMEOUT || '5000'),
      destroyTimeoutMillis: parseInt(process.env.DB_DESTROY_TIMEOUT || '5000'),
      reapIntervalMillis: parseInt(process.env.DB_REAP_INTERVAL || '1000'),
      createRetryIntervalMillis: parseInt(process.env.DB_CREATE_RETRY_INTERVAL || '200'),
      // Query timeouts
      statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'),
      query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
      idle_in_transaction_session_timeout: parseInt(process.env.DB_IDLE_TRANSACTION_TIMEOUT || '10000')
    };
  }

  // Enhanced SSL configuration
  private getSSLConfig() {
    if (!this.config.ssl) {
      return false;
    }

    const sslConfig: any = {
      rejectUnauthorized: this.environment === 'production'
    };

    // Load SSL certificates if paths are provided
    const certPaths = {
      ca: process.env.DB_SSL_CA_PATH,
      cert: process.env.DB_SSL_CERT_PATH,
      key: process.env.DB_SSL_KEY_PATH
    };

    Object.entries(certPaths).forEach(([key, path]) => {
      if (path) {
        try {
          sslConfig[key] = readFileSync(path);
        } catch (error) {
          console.warn(`Warning: Could not read SSL ${key} from ${path}:`, error);
        }
      }
    });

    return sslConfig;
  }

  private setupPoolEventHandlers(): void {
    this.pool.on('connect', (client: PoolClient) => {
      this.metrics.totalConnections++;
      if (this.settings.logQueries) {
        console.log('New database connection established');
      }
    });

    this.pool.on('acquire', (client: PoolClient) => {
      this.metrics.activeConnections++;
      if (this.settings.logQueries) {
        console.log('Database connection acquired from pool');
      }
    });

    this.pool.on('release', (client: PoolClient) => {
      this.metrics.activeConnections--;
    });

    this.pool.on('error', (err: Error) => {
      this.metrics.errorCount++;
      this.metrics.lastError = err.message;
      this.metrics.lastErrorTime = new Date();
      this.isHealthy = false;
      
      console.error('Database pool error:', err);
      
      // Attempt to recover from connection errors
      if (this.isConnectionError(err)) {
        this.handleConnectionError(err);
      }
    });

    this.pool.on('remove', (client: PoolClient) => {
      if (this.settings.logQueries) {
        console.log('Database connection removed from pool');
      }
    });

    // Monitor pool metrics
    setInterval(() => {
      this.updatePoolMetrics();
    }, parseInt(process.env.DB_METRICS_INTERVAL || '10000'));
  }

  // Update pool metrics
  private updatePoolMetrics(): void {
    if (this.pool) {
      this.metrics.totalConnections = this.pool.totalCount;
      this.metrics.idleConnections = this.pool.idleCount;
      this.metrics.waitingClients = this.pool.waitingCount;
    }
  }

  // Setup health checks
  private setupHealthChecks(): void {
    const healthCheckInterval = parseInt(process.env.DB_HEALTH_CHECK_INTERVAL || '30000');
    
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, healthCheckInterval);
  }

  // Perform health check
  private async performHealthCheck(): Promise<void> {
    try {
      const client = await this.pool.connect();
      const start = Date.now();
      
      await client.query('SELECT 1');
      
      const duration = Date.now() - start;
      client.release();
      
      this.isHealthy = true;
      this.lastHealthCheck = new Date();
      
      // Warn about slow health checks
      if (duration > 5000) {
        console.warn(`Slow database health check: ${duration}ms`);
      }
    } catch (error) {
      this.isHealthy = false;
      this.metrics.errorCount++;
      console.error('Database health check failed:', error);
      
      // Attempt recovery
      if (this.isConnectionError(error as Error)) {
        await this.attemptRecovery();
      }
    }
  }

  // Check if error is connection-related
  private isConnectionError(error: Error): boolean {
    const connectionErrorCodes = [
      'ECONNRESET',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNABORTED',
      'EHOSTUNREACH',
      'ENETDOWN',
      'ENETUNREACH'
    ];
    
    return connectionErrorCodes.some(code => 
      error.message?.includes(code) || (error as any).code === code
    );
  }

  // Handle connection errors
  private async handleConnectionError(error: Error): Promise<void> {
    console.log('Attempting to recover from connection error...');
    this.metrics.connectionErrors++;
    
    // Implement exponential backoff
    const backoffDelay = Math.min(
      this.connectionRetryDelay * Math.pow(2, this.metrics.connectionErrors - 1),
      60000 // Max 1 minute
    );
    
    await this.sleep(backoffDelay);
    await this.attemptRecovery();
  }

  // Attempt recovery
  private async attemptRecovery(): Promise<void> {
    try {
      // Validate connection
      await this.validateConnection();
      console.log('Database connection recovered successfully');
      this.isHealthy = true;
    } catch (error) {
      console.error('Recovery attempt failed:', error);
    }
  }

  // Validate connection
  private async validateConnection(): Promise<void> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= this.maxConnectionAttempts; attempt++) {
      try {
        const client = await this.pool.connect();
        const result = await client.query('SELECT NOW() as current_time, version() as version');
        client.release();
        
        if (this.settings.logQueries) {
          console.log('Database connection validated successfully');
          console.log(`Connected to: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`);
        }
        
        this.connectionAttempts = 0;
        return;
      } catch (error) {
        lastError = error as Error;
        this.connectionAttempts = attempt;
        this.metrics.connectionErrors++;
        
        if (this.settings.logQueries) {
          console.warn(`Connection attempt ${attempt} failed:`, error);
        }
        
        if (attempt < this.maxConnectionAttempts) {
          await this.sleep(this.connectionRetryDelay);
        }
      }
    }
    
    throw new Error(`Failed to connect after ${this.maxConnectionAttempts} attempts. Last error: ${lastError?.message}`);
  }

  // Utility function for sleep
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Execute a query with enhanced retry logic and monitoring
  public async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const {
      timeout = 30000,
      retries = this.settings.retryAttempts,
      logQuery = this.settings.logQueries,
    } = options;

    if (logQuery) {
      console.log('Executing query:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
      if (params) {
        console.log('Query parameters:', params);
      }
    }

    const start = Date.now();
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this.pool.query<T>(text, params);
        const executionTime = Date.now() - start;
        
        this.metrics.totalQueries++;
        
        // Log slow queries
        const slowQueryThreshold = parseInt(process.env.DB_SLOW_QUERY_THRESHOLD || '1000');
        if (executionTime > slowQueryThreshold) {
          console.warn(`Slow query detected (${executionTime}ms):`, text.substring(0, 100));
        }
        
        if (logQuery) {
          console.log(`Query completed in ${executionTime}ms, returned ${result.rowCount} rows`);
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        this.metrics.errorCount++;
        this.metrics.queryErrors++;
        
        if (this.isRetryableError(lastError) && attempt < retries) {
          this.metrics.retries++;
          
          const retryDelay = Math.min(
            1000 * Math.pow(2, attempt),
            5000 // Max 5 seconds
          );
          
          if (logQuery) {
            console.warn(`Query failed, retrying in ${retryDelay}ms (attempt ${attempt + 1}/${retries}):`, lastError.message);
          }
          await this.delay(retryDelay);
        } else {
          break;
        }
      }
    }

    throw lastError;
  }

  // Check if error is retryable
  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'connection terminated',
      'connection reset',
      'connection timeout',
      'pool is draining',
      'ECONNRESET',
      'ETIMEDOUT',
      'TimeoutError'
    ];
    
    return retryableErrors.some(errorType => 
      error.message.toLowerCase().includes(errorType.toLowerCase()) ||
      (error as any).code === errorType
    );
  }

  // Execute a query with a specific client (for transactions)
  public async queryWithClient<T extends QueryResultRow = any>(
    client: PoolClient,
    text: string,
    params?: any[],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const { logQuery = this.settings.logQueries } = options;

    if (logQuery) {
      console.log('Executing query with client:', text);
      if (params) {
        console.log('Query parameters:', params);
      }
    }

    const startTime = Date.now();
    const result = await client.query<T>(text, params);
    const executionTime = Date.now() - startTime;

    if (logQuery) {
      console.log(`Query completed in ${executionTime}ms, returned ${result.rowCount} rows`);
    }

    return result;
  }

  // Get a client from the pool for transactions
  public async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  // Execute a transaction
  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
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

  // Get comprehensive pool statistics
  public getPoolStats(): PoolStats {
    this.updatePoolMetrics();
    return {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingClients: this.pool.waitingCount,
      maxConnections: this.config.maxConnections || 20,
    };
  }

  // Get detailed metrics
  public getMetrics() {
    this.updatePoolMetrics();
    return {
      ...this.metrics,
      isHealthy: this.isHealthy,
      lastHealthCheck: this.lastHealthCheck,
      connectionAttempts: this.connectionAttempts,
      poolConfig: {
        max: this.config.maxConnections || 20,
        min: 0,
        idleTimeoutMillis: this.config.idleTimeoutMillis || 30000,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis || 10000
      }
    };
  }

  // Get pool health status
  public getHealthStatus() {
    return {
      isHealthy: this.isHealthy,
      lastHealthCheck: this.lastHealthCheck,
      totalConnections: this.metrics.totalConnections,
      activeConnections: this.metrics.activeConnections,
      idleConnections: this.metrics.idleConnections,
      waitingClients: this.metrics.waitingClients,
      errorCount: this.metrics.errorCount,
      lastError: this.metrics.lastError,
      lastErrorTime: this.metrics.lastErrorTime
    };
  }

  // Check database connection health
  public async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as health_check');
      return result.rows[0]?.health_check === 1;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  // Close all connections gracefully
  public async close(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.pool) {
      console.log('Closing database pool...');
      await this.pool.end();
      console.log('Database pool closed');
    }
  }

  // Utility function for delays
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance getter
export const getDatabase = (): DatabaseConnection => {
  return DatabaseConnection.getInstance();
};

// Global query function for convenience
export const query = async <T extends QueryResultRow = any>(
  text: string,
  params?: any[],
  options?: QueryOptions
): Promise<QueryResult<T>> => {
  const db = getDatabase();
  return db.query<T>(text, params, options);
};

// Global transaction function for convenience
export const transaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const db = getDatabase();
  return db.transaction(callback);
};

// Connection health check
export const checkDatabaseHealth = async (): Promise<boolean> => {
  const db = getDatabase();
  return db.healthCheck();
};

// Get connection statistics
export const getConnectionStats = (): PoolStats => {
  const db = getDatabase();
  return db.getPoolStats();
};

// Initialize database connection (should be called during app startup)
export const initializeDatabase = async (): Promise<void> => {
  const db = getDatabase();
  const isHealthy = await db.healthCheck();
  
  if (!isHealthy) {
    throw new Error('Failed to establish database connection');
  }
  
  console.log('Database connection initialized successfully');
};

// Graceful shutdown
export const shutdownDatabase = async (): Promise<void> => {
  const db = getDatabase();
  await db.close();
  console.log('Database connections closed');
};