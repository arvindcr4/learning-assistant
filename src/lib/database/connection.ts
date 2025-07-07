import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

import { getDatabaseConfig, getPoolConfig, getCurrentEnvironment, getEnvironmentSettings } from './config';

// Global connection pool instance
const pool: Pool | null = null;

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

// Database connection manager
export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool: Pool;
  private readonly config = getDatabaseConfig();
  private readonly environment = getCurrentEnvironment();
  private readonly settings = getEnvironmentSettings(this.environment);

  private constructor() {
    this.pool = new Pool(getPoolConfig(this.config));
    this.setupPoolEventHandlers();
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  private setupPoolEventHandlers(): void {
    this.pool.on('connect', (client: PoolClient) => {
      if (this.settings.logQueries) {
        console.log('New database connection established');
      }
    });

    this.pool.on('acquire', (client: PoolClient) => {
      if (this.settings.logQueries) {
        console.log('Database connection acquired from pool');
      }
    });

    this.pool.on('error', (err: Error) => {
      console.error('Database pool error:', err);
    });

    this.pool.on('remove', (client: PoolClient) => {
      if (this.settings.logQueries) {
        console.log('Database connection removed from pool');
      }
    });
  }

  // Execute a query with automatic retry and logging
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
      console.log('Executing query:', text);
      if (params) {
        console.log('Query parameters:', params);
      }
    }

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const startTime = Date.now();
        const result = await this.pool.query<T>(text, params);
        const executionTime = Date.now() - startTime;

        if (logQuery) {
          console.log(`Query completed in ${executionTime}ms, returned ${result.rowCount} rows`);
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < retries) {
          if (logQuery) {
            console.warn(`Query attempt ${attempt + 1} failed, retrying:`, (error as Error).message);
          }
          await this.delay(Math.pow(2, attempt) * 1000); // Exponential backoff
        }
      }
    }

    throw lastError;
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

  // Get connection pool statistics
  public getPoolStats(): PoolStats {
    return {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingClients: this.pool.waitingCount,
      maxConnections: this.config.maxConnections || 20,
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

  // Close all connections
  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
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