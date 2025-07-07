// Enhanced Database Connection Pool with Error Handling and Monitoring
const { Pool } = require('pg');
const fs = require('fs');

class DatabasePool {
  constructor(config) {
    this.config = config;
    this.pool = null;
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
    this.healthCheckInterval = null;
    this.isHealthy = true;
    this.lastHealthCheck = null;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = parseInt(process.env.DB_MAX_CONNECTION_ATTEMPTS || '5');
    this.connectionRetryDelay = parseInt(process.env.DB_CONNECTION_RETRY_DELAY || '5000');
  }

  // Initialize the connection pool
  async initialize() {
    try {
      await this.createPool();
      await this.validateConnection();
      this.setupHealthChecks();
      this.setupEventHandlers();
      console.log('Database pool initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize database pool:', error.message);
      throw error;
    }
  }

  // Create the connection pool with enhanced configuration
  createPool() {
    const poolConfig = {
      ...this.config,
      // Enhanced SSL configuration
      ssl: this.getSSLConfig(),
      // Connection pool settings
      max: this.config.pool?.max || 20,
      min: this.config.pool?.min || 0,
      idleTimeoutMillis: this.config.pool?.idle || 10000,
      connectionTimeoutMillis: this.config.pool?.acquire || 30000,
      acquireTimeoutMillis: this.config.pool?.acquire || 30000,
      createTimeoutMillis: parseInt(process.env.DB_CREATE_TIMEOUT || '5000'),
      destroyTimeoutMillis: parseInt(process.env.DB_DESTROY_TIMEOUT || '5000'),
      reapIntervalMillis: parseInt(process.env.DB_REAP_INTERVAL || '1000'),
      createRetryIntervalMillis: parseInt(process.env.DB_CREATE_RETRY_INTERVAL || '200'),
      // Application name for monitoring
      application_name: `learning-assistant-${process.env.NODE_ENV || 'development'}`,
      // Query timeout
      statement_timeout: this.config.dialectOptions?.statement_timeout || 30000,
      query_timeout: this.config.dialectOptions?.query_timeout || 30000,
      idle_in_transaction_session_timeout: this.config.dialectOptions?.idle_in_transaction_session_timeout || 10000
    };

    this.pool = new Pool(poolConfig);
    return this.pool;
  }

  // Enhanced SSL configuration
  getSSLConfig() {
    if (!this.config.dialectOptions?.ssl) {
      return false;
    }

    const sslConfig = {
      rejectUnauthorized: this.config.dialectOptions.ssl.rejectUnauthorized !== false
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
          sslConfig[key] = fs.readFileSync(path);
        } catch (error) {
          console.warn(`Warning: Could not read SSL ${key} from ${path}:`, error.message);
        }
      }
    });

    return sslConfig;
  }

  // Validate initial connection
  async validateConnection() {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxConnectionAttempts; attempt++) {
      try {
        const client = await this.pool.connect();
        const result = await client.query('SELECT NOW() as current_time, version() as version');
        client.release();
        
        console.log('Database connection validated successfully');
        console.log(`Connected to: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`);
        
        this.connectionAttempts = 0;
        return true;
      } catch (error) {
        lastError = error;
        this.connectionAttempts = attempt;
        this.metrics.connectionErrors++;
        
        console.warn(`Connection attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.maxConnectionAttempts) {
          console.log(`Retrying in ${this.connectionRetryDelay}ms...`);
          await this.sleep(this.connectionRetryDelay);
        }
      }
    }
    
    throw new Error(`Failed to connect after ${this.maxConnectionAttempts} attempts. Last error: ${lastError.message}`);
  }

  // Setup event handlers for monitoring
  setupEventHandlers() {
    this.pool.on('connect', (client) => {
      this.metrics.totalConnections++;
      console.log('New database connection established');
    });

    this.pool.on('acquire', (client) => {
      this.metrics.activeConnections++;
    });

    this.pool.on('release', (client) => {
      this.metrics.activeConnections--;
    });

    this.pool.on('remove', (client) => {
      console.log('Database connection removed from pool');
    });

    this.pool.on('error', (error, client) => {
      this.metrics.errorCount++;
      this.metrics.lastError = error.message;
      this.metrics.lastErrorTime = new Date();
      this.isHealthy = false;
      
      console.error('Database pool error:', error.message);
      
      // Attempt to recover from connection errors
      if (this.isConnectionError(error)) {
        this.handleConnectionError(error);
      }
    });

    // Monitor pool metrics
    setInterval(() => {
      this.updatePoolMetrics();
    }, parseInt(process.env.DB_METRICS_INTERVAL || '10000'));
  }

  // Update pool metrics
  updatePoolMetrics() {
    if (this.pool) {
      this.metrics.totalConnections = this.pool.totalCount;
      this.metrics.idleConnections = this.pool.idleCount;
      this.metrics.waitingClients = this.pool.waitingCount;
    }
  }

  // Setup health checks
  setupHealthChecks() {
    const healthCheckInterval = parseInt(process.env.DB_HEALTH_CHECK_INTERVAL || '30000');
    
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, healthCheckInterval);
  }

  // Perform health check
  async performHealthCheck() {
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
      console.error('Database health check failed:', error.message);
      
      // Attempt recovery
      if (this.isConnectionError(error)) {
        await this.attemptRecovery();
      }
    }
  }

  // Check if error is connection-related
  isConnectionError(error) {
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
      error.code === code || error.message.includes(code)
    );
  }

  // Handle connection errors
  async handleConnectionError(error) {
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
  async attemptRecovery() {
    try {
      // Recreate pool if necessary
      if (this.pool.ended) {
        console.log('Recreating database pool...');
        this.pool = this.createPool();
        this.setupEventHandlers();
      }
      
      await this.validateConnection();
      console.log('Database connection recovered successfully');
      this.isHealthy = true;
    } catch (error) {
      console.error('Recovery attempt failed:', error.message);
    }
  }

  // Execute query with retry logic and monitoring
  async query(text, params = []) {
    const start = Date.now();
    let retries = 0;
    const maxRetries = parseInt(process.env.DB_QUERY_MAX_RETRIES || '3');
    let lastError;

    while (retries <= maxRetries) {
      try {
        const client = await this.pool.connect();
        const result = await client.query(text, params);
        client.release();
        
        this.metrics.totalQueries++;
        const duration = Date.now() - start;
        
        // Log slow queries
        const slowQueryThreshold = parseInt(process.env.DB_SLOW_QUERY_THRESHOLD || '1000');
        if (duration > slowQueryThreshold) {
          console.warn(`Slow query detected (${duration}ms):`, text.substring(0, 100));
        }
        
        return result;
      } catch (error) {
        lastError = error;
        this.metrics.errorCount++;
        this.metrics.queryErrors++;
        
        if (this.isRetryableError(error) && retries < maxRetries) {
          retries++;
          this.metrics.retries++;
          
          const retryDelay = Math.min(
            1000 * Math.pow(2, retries - 1),
            5000 // Max 5 seconds
          );
          
          console.warn(`Query failed, retrying in ${retryDelay}ms (attempt ${retries}/${maxRetries}):`, error.message);
          await this.sleep(retryDelay);
        } else {
          throw error;
        }
      }
    }
    
    throw lastError;
  }

  // Check if error is retryable
  isRetryableError(error) {
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
      error.code === errorType
    );
  }

  // Get pool metrics
  getMetrics() {
    this.updatePoolMetrics();
    return {
      ...this.metrics,
      isHealthy: this.isHealthy,
      lastHealthCheck: this.lastHealthCheck,
      connectionAttempts: this.connectionAttempts,
      poolConfig: {
        max: this.pool?.options?.max || 0,
        min: this.pool?.options?.min || 0,
        idleTimeoutMillis: this.pool?.options?.idleTimeoutMillis || 0,
        connectionTimeoutMillis: this.pool?.options?.connectionTimeoutMillis || 0
      }
    };
  }

  // Get pool status
  getStatus() {
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

  // Close the pool gracefully
  async close() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.pool) {
      console.log('Closing database pool...');
      await this.pool.end();
      console.log('Database pool closed');
    }
  }

  // Utility function for sleep
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = DatabasePool;