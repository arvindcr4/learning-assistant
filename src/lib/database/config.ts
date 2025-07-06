import { Pool, PoolConfig } from 'pg';

// Database configuration interface
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

// Environment-based configuration
export const getDatabaseConfig = (): DatabaseConfig => {
  const config: DatabaseConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'learning_assistant',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10),
  };

  // Validate required configuration
  if (!config.database) {
    throw new Error('Database name is required');
  }

  if (!config.username) {
    throw new Error('Database username is required');
  }

  return config;
};

// PostgreSQL pool configuration
export const getPoolConfig = (config: DatabaseConfig): PoolConfig => {
  const poolConfig: PoolConfig = {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    max: config.maxConnections || 20,
    idleTimeoutMillis: config.idleTimeoutMillis || 30000,
    connectionTimeoutMillis: config.connectionTimeoutMillis || 10000,
    statement_timeout: 30000,
    query_timeout: 30000,
    application_name: 'learning-assistant',
  };

  // SSL configuration for production
  if (config.ssl) {
    poolConfig.ssl = {
      rejectUnauthorized: false,
    };
  }

  return poolConfig;
};

// Connection string builder for migrations
export const getConnectionString = (config: DatabaseConfig): string => {
  const sslParam = config.ssl ? '?ssl=true' : '';
  return `postgresql://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}${sslParam}`;
};

// Database environments
export const DATABASE_ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
  TEST: 'test',
} as const;

export type DatabaseEnvironment = (typeof DATABASE_ENVIRONMENTS)[keyof typeof DATABASE_ENVIRONMENTS];

// Get current environment
export const getCurrentEnvironment = (): DatabaseEnvironment => {
  const env = process.env.NODE_ENV || 'development';
  return env as DatabaseEnvironment;
};

// Environment-specific settings
export const getEnvironmentSettings = (env: DatabaseEnvironment) => {
  const settings = {
    development: {
      logQueries: true,
      enableQueryAnalysis: true,
      cacheTTL: 300, // 5 minutes
      retryAttempts: 3,
    },
    staging: {
      logQueries: true,
      enableQueryAnalysis: true,
      cacheTTL: 600, // 10 minutes
      retryAttempts: 3,
    },
    production: {
      logQueries: false,
      enableQueryAnalysis: false,
      cacheTTL: 1800, // 30 minutes
      retryAttempts: 5,
    },
    test: {
      logQueries: false,
      enableQueryAnalysis: false,
      cacheTTL: 60, // 1 minute
      retryAttempts: 1,
    },
  };

  return settings[env] || settings.development;
};