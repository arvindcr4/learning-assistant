import { createClient, RedisClientType, RedisDefaultModules, RedisFunctions, RedisModules, RedisScripts } from 'redis';
import IORedis, { Cluster, ClusterOptions } from 'ioredis';
import { env } from './env-validation';

// ====================
// TYPES AND INTERFACES
// ====================

export interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  username?: string;
  tls?: boolean;
  clusterEnabled?: boolean;
  clusterNodes?: string;
  connectionTimeout?: number;
  commandTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  maxRetriesPerRequest?: number;
  poolMin?: number;
  poolMax?: number;
}

export interface RedisConnection {
  client: RedisClientType<RedisDefaultModules & RedisModules, RedisFunctions, RedisScripts> | IORedis.Redis | IORedis.Cluster;
  isConnected: boolean;
  isCluster: boolean;
  connectionId: string;
  stats: {
    connectTime: number;
    totalCommands: number;
    errorCount: number;
    lastError?: Error;
    lastActivity: number;
  };
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  avgResponseTime: number;
  connectionCount: number;
  memoryUsage: number;
  keyspaceHits: number;
  keyspaceMisses: number;
  totalConnectionsReceived: number;
  totalCommandsProcessed: number;
  instantaneousOpsPerSec: number;
  usedMemory: number;
  usedMemoryHuman: string;
  usedMemoryRss: number;
  usedMemoryPeak: number;
  maxMemory: number;
  maxMemoryHuman: string;
  memoryFragmentationRatio: number;
  role: string;
  connectedClients: number;
  blockedClients: number;
  evictedKeys: number;
  expiredKeys: number;
}

// ====================
// REDIS CLIENT MANAGER
// ====================

export class RedisClientManager {
  private static instance: RedisClientManager;
  private connections: Map<string, RedisConnection> = new Map();
  private config: RedisConfig;
  private isInitialized: boolean = false;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsCollectionInterval: NodeJS.Timeout | null = null;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    avgResponseTime: 0,
    connectionCount: 0,
    memoryUsage: 0,
    keyspaceHits: 0,
    keyspaceMisses: 0,
    totalConnectionsReceived: 0,
    totalCommandsProcessed: 0,
    instantaneousOpsPerSec: 0,
    usedMemory: 0,
    usedMemoryHuman: '',
    usedMemoryRss: 0,
    usedMemoryPeak: 0,
    maxMemory: 0,
    maxMemoryHuman: '',
    memoryFragmentationRatio: 0,
    role: '',
    connectedClients: 0,
    blockedClients: 0,
    evictedKeys: 0,
    expiredKeys: 0,
  };

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): RedisClientManager {
    if (!RedisClientManager.instance) {
      RedisClientManager.instance = new RedisClientManager();
    }
    return RedisClientManager.instance;
  }

  private loadConfig(): RedisConfig {
    return {
      url: env.REDIS_URL,
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
      db: env.REDIS_DB,
      username: env.REDIS_USERNAME,
      tls: env.REDIS_TLS,
      clusterEnabled: env.REDIS_CLUSTER_ENABLED,
      clusterNodes: env.REDIS_CLUSTER_NODES,
      connectionTimeout: env.REDIS_CONNECTION_TIMEOUT,
      commandTimeout: env.REDIS_COMMAND_TIMEOUT,
      retryAttempts: env.REDIS_RETRY_ATTEMPTS,
      retryDelay: env.REDIS_RETRY_DELAY,
      maxRetriesPerRequest: env.REDIS_MAX_RETRIES_PER_REQUEST,
      poolMin: env.REDIS_POOL_MIN,
      poolMax: env.REDIS_POOL_MAX,
    };
  }

  /**
   * Initialize Redis connection(s)
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('🔄 Initializing Redis connections...');
      
      if (this.config.clusterEnabled) {
        await this.initializeClusterConnection();
      } else {
        await this.initializeSingleConnection();
      }

      this.startHealthCheck();
      this.startMetricsCollection();
      this.isInitialized = true;
      
      console.log('✅ Redis connections initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Redis connections:', error);
      throw error;
    }
  }

  private async initializeSingleConnection(): Promise<void> {
    const connectionId = 'main';
    const startTime = Date.now();

    try {
      let client: RedisClientType<RedisDefaultModules & RedisModules, RedisFunctions, RedisScripts>;

      if (this.config.url) {
        client = createClient({
          url: this.config.url,
          socket: {
            connectTimeout: this.config.connectionTimeout,
            commandTimeout: this.config.commandTimeout,
            reconnectStrategy: (retries) => {
              if (retries > (this.config.retryAttempts || 3)) {
                return new Error('Max retries exceeded');
              }
              return Math.min(retries * (this.config.retryDelay || 100), 3000);
            },
          },
          database: this.config.db,
          username: this.config.username,
          password: this.config.password,
        });
      } else {
        client = createClient({
          socket: {
            host: this.config.host,
            port: this.config.port,
            tls: this.config.tls,
            connectTimeout: this.config.connectionTimeout,
            commandTimeout: this.config.commandTimeout,
            reconnectStrategy: (retries) => {
              if (retries > (this.config.retryAttempts || 3)) {
                return new Error('Max retries exceeded');
              }
              return Math.min(retries * (this.config.retryDelay || 100), 3000);
            },
          },
          database: this.config.db,
          username: this.config.username,
          password: this.config.password,
        });
      }

      this.setupClientEventHandlers(client, connectionId);
      await client.connect();

      const connection: RedisConnection = {
        client,
        isConnected: true,
        isCluster: false,
        connectionId,
        stats: {
          connectTime: Date.now() - startTime,
          totalCommands: 0,
          errorCount: 0,
          lastActivity: Date.now(),
        },
      };

      this.connections.set(connectionId, connection);
      console.log(`✅ Single Redis connection established (${connection.stats.connectTime}ms)`);
    } catch (error) {
      console.error('❌ Failed to establish single Redis connection:', error);
      throw error;
    }
  }

  private async initializeClusterConnection(): Promise<void> {
    const connectionId = 'cluster';
    const startTime = Date.now();

    try {
      if (!this.config.clusterNodes) {
        throw new Error('Cluster nodes configuration is required for cluster mode');
      }

      const nodes = this.config.clusterNodes.split(',').map(node => {
        const [host, port] = node.trim().split(':');
        return { host, port: parseInt(port, 10) };
      });

      const clusterOptions: ClusterOptions = {
        connectTimeout: this.config.connectionTimeout,
        commandTimeout: this.config.commandTimeout,
        maxRetriesPerRequest: this.config.maxRetriesPerRequest,
        retryDelayOnFailover: this.config.retryDelay,
        redisOptions: {
          password: this.config.password,
          username: this.config.username,
          db: this.config.db,
          ...(this.config.tls && { 
            tls: {} 
          }),
        },
        scaleReads: 'slave',
        enableOfflineQueue: false,
        lazyConnect: true,
      };

      const cluster = new Cluster(nodes, clusterOptions);
      
      this.setupClusterEventHandlers(cluster, connectionId);
      await cluster.connect();

      const connection: RedisConnection = {
        client: cluster,
        isConnected: true,
        isCluster: true,
        connectionId,
        stats: {
          connectTime: Date.now() - startTime,
          totalCommands: 0,
          errorCount: 0,
          lastActivity: Date.now(),
        },
      };

      this.connections.set(connectionId, connection);
      console.log(`✅ Redis cluster connection established (${connection.stats.connectTime}ms)`);
    } catch (error) {
      console.error('❌ Failed to establish Redis cluster connection:', error);
      throw error;
    }
  }

  private setupClientEventHandlers(client: RedisClientType<RedisDefaultModules & RedisModules, RedisFunctions, RedisScripts>, connectionId: string): void {
    client.on('error', (error) => {
      console.error(`❌ Redis client error (${connectionId}):`, error);
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.isConnected = false;
        connection.stats.errorCount++;
        connection.stats.lastError = error;
        this.metrics.errors++;
      }
    });

    client.on('connect', () => {
      console.log(`✅ Redis client connected (${connectionId})`);
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.isConnected = true;
      }
    });

    client.on('ready', () => {
      console.log(`✅ Redis client ready (${connectionId})`);
    });

    client.on('end', () => {
      console.log(`🔌 Redis client disconnected (${connectionId})`);
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.isConnected = false;
      }
    });

    client.on('reconnecting', () => {
      console.log(`🔄 Redis client reconnecting (${connectionId})`);
    });
  }

  private setupClusterEventHandlers(cluster: Cluster, connectionId: string): void {
    cluster.on('error', (error) => {
      console.error(`❌ Redis cluster error (${connectionId}):`, error);
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.isConnected = false;
        connection.stats.errorCount++;
        connection.stats.lastError = error;
        this.metrics.errors++;
      }
    });

    cluster.on('connect', () => {
      console.log(`✅ Redis cluster connected (${connectionId})`);
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.isConnected = true;
      }
    });

    cluster.on('ready', () => {
      console.log(`✅ Redis cluster ready (${connectionId})`);
    });

    cluster.on('close', () => {
      console.log(`🔌 Redis cluster disconnected (${connectionId})`);
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.isConnected = false;
      }
    });

    cluster.on('reconnecting', () => {
      console.log(`🔄 Redis cluster reconnecting (${connectionId})`);
    });

    cluster.on('+node', (node) => {
      console.log(`➕ Redis cluster node added: ${node.options.host}:${node.options.port}`);
    });

    cluster.on('-node', (node) => {
      console.log(`➖ Redis cluster node removed: ${node.options.host}:${node.options.port}`);
    });
  }

  /**
   * Get the primary Redis connection
   */
  public getConnection(connectionId: string = 'main'): RedisConnection | null {
    if (this.config.clusterEnabled) {
      connectionId = 'cluster';
    }
    return this.connections.get(connectionId) || null;
  }

  /**
   * Get the primary Redis client
   */
  public getClient(connectionId: string = 'main'): RedisClientType<RedisDefaultModules & RedisModules, RedisFunctions, RedisScripts> | IORedis.Redis | IORedis.Cluster | null {
    const connection = this.getConnection(connectionId);
    return connection?.client || null;
  }

  /**
   * Execute a Redis command with error handling and metrics
   */
  public async executeCommand<T>(
    command: string,
    args: any[] = [],
    connectionId: string = 'main'
  ): Promise<T | null> {
    const connection = this.getConnection(connectionId);
    if (!connection || !connection.isConnected) {
      throw new Error(`Redis connection not available: ${connectionId}`);
    }

    const startTime = Date.now();
    
    try {
      const result = await (connection.client as any)[command](...args);
      const responseTime = Date.now() - startTime;
      
      // Update metrics
      connection.stats.totalCommands++;
      connection.stats.lastActivity = Date.now();
      this.updateMetrics(responseTime, true);
      
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Update error metrics
      connection.stats.errorCount++;
      connection.stats.lastError = error as Error;
      this.updateMetrics(responseTime, false);
      
      console.error(`❌ Redis command error (${command}):`, error);
      throw error;
    }
  }

  private updateMetrics(responseTime: number, success: boolean): void {
    if (success) {
      this.metrics.hits++;
    } else {
      this.metrics.errors++;
    }
    
    // Update average response time
    const totalOps = this.metrics.hits + this.metrics.misses + this.metrics.errors;
    this.metrics.avgResponseTime = (this.metrics.avgResponseTime * (totalOps - 1) + responseTime) / totalOps;
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      for (const [connectionId, connection] of this.connections) {
        try {
          await this.executeCommand('ping', [], connectionId);
        } catch (error) {
          console.error(`❌ Health check failed for connection ${connectionId}:`, error);
          connection.isConnected = false;
          
          // Attempt to reconnect
          if (connection.isCluster) {
            await this.reconnectCluster(connectionId);
          } else {
            await this.reconnectSingle(connectionId);
          }
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
    }

    this.metricsCollectionInterval = setInterval(async () => {
      await this.collectServerMetrics();
    }, 60000); // Collect every minute
  }

  private async collectServerMetrics(): Promise<void> {
    try {
      const connection = this.getConnection();
      if (!connection || !connection.isConnected) {
        return;
      }

      const info = await this.executeCommand('info', ['stats', 'memory', 'clients'], connection.connectionId);
      if (info) {
        this.parseServerInfo(info as string);
      }
    } catch (error) {
      console.error('❌ Failed to collect server metrics:', error);
    }
  }

  private parseServerInfo(info: string): void {
    const lines = info.split('\r\n');
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        
        switch (key) {
          case 'keyspace_hits':
            this.metrics.keyspaceHits = parseInt(value, 10);
            break;
          case 'keyspace_misses':
            this.metrics.keyspaceMisses = parseInt(value, 10);
            break;
          case 'total_connections_received':
            this.metrics.totalConnectionsReceived = parseInt(value, 10);
            break;
          case 'total_commands_processed':
            this.metrics.totalCommandsProcessed = parseInt(value, 10);
            break;
          case 'instantaneous_ops_per_sec':
            this.metrics.instantaneousOpsPerSec = parseInt(value, 10);
            break;
          case 'used_memory':
            this.metrics.usedMemory = parseInt(value, 10);
            break;
          case 'used_memory_human':
            this.metrics.usedMemoryHuman = value;
            break;
          case 'used_memory_rss':
            this.metrics.usedMemoryRss = parseInt(value, 10);
            break;
          case 'used_memory_peak':
            this.metrics.usedMemoryPeak = parseInt(value, 10);
            break;
          case 'maxmemory':
            this.metrics.maxMemory = parseInt(value, 10);
            break;
          case 'maxmemory_human':
            this.metrics.maxMemoryHuman = value;
            break;
          case 'mem_fragmentation_ratio':
            this.metrics.memoryFragmentationRatio = parseFloat(value);
            break;
          case 'role':
            this.metrics.role = value;
            break;
          case 'connected_clients':
            this.metrics.connectedClients = parseInt(value, 10);
            break;
          case 'blocked_clients':
            this.metrics.blockedClients = parseInt(value, 10);
            break;
          case 'evicted_keys':
            this.metrics.evictedKeys = parseInt(value, 10);
            break;
          case 'expired_keys':
            this.metrics.expiredKeys = parseInt(value, 10);
            break;
        }
      }
    }
  }

  private async reconnectSingle(connectionId: string): Promise<void> {
    console.log(`🔄 Attempting to reconnect single Redis connection: ${connectionId}`);
    
    try {
      const connection = this.connections.get(connectionId);
      if (connection) {
        await (connection.client as any).connect();
        connection.isConnected = true;
        console.log(`✅ Reconnected single Redis connection: ${connectionId}`);
      }
    } catch (error) {
      console.error(`❌ Failed to reconnect single Redis connection ${connectionId}:`, error);
    }
  }

  private async reconnectCluster(connectionId: string): Promise<void> {
    console.log(`🔄 Attempting to reconnect Redis cluster: ${connectionId}`);
    
    try {
      const connection = this.connections.get(connectionId);
      if (connection) {
        await (connection.client as IORedis.Cluster).connect();
        connection.isConnected = true;
        console.log(`✅ Reconnected Redis cluster: ${connectionId}`);
      }
    } catch (error) {
      console.error(`❌ Failed to reconnect Redis cluster ${connectionId}:`, error);
    }
  }

  /**
   * Get current metrics
   */
  public getMetrics(): CacheMetrics {
    this.metrics.connectionCount = this.connections.size;
    return { ...this.metrics };
  }

  /**
   * Get connection status
   */
  public getConnectionStatus(): { [key: string]: any } {
    const status: { [key: string]: any } = {};
    
    for (const [connectionId, connection] of this.connections) {
      status[connectionId] = {
        isConnected: connection.isConnected,
        isCluster: connection.isCluster,
        stats: connection.stats,
      };
    }
    
    return status;
  }

  /**
   * Test connection
   */
  public async testConnection(connectionId: string = 'main'): Promise<boolean> {
    try {
      const result = await this.executeCommand('ping', [], connectionId);
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    console.log('🔄 Shutting down Redis connections...');
    
    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
    }
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }

    // Close all connections
    for (const [connectionId, connection] of this.connections) {
      try {
        if (connection.isConnected) {
          if (connection.isCluster) {
            await (connection.client as IORedis.Cluster).disconnect();
          } else {
            await (connection.client as RedisClientType<RedisDefaultModules & RedisModules, RedisFunctions, RedisScripts>).disconnect();
          }
        }
        console.log(`✅ Closed Redis connection: ${connectionId}`);
      } catch (error) {
        console.error(`❌ Error closing Redis connection ${connectionId}:`, error);
      }
    }

    this.connections.clear();
    this.isInitialized = false;
    console.log('✅ Redis connections shutdown complete');
  }
}

// ====================
// SINGLETON INSTANCE
// ====================

export const redisManager = RedisClientManager.getInstance();

// ====================
// HELPER FUNCTIONS
// ====================

/**
 * Initialize Redis connections
 */
export async function initializeRedis(): Promise<void> {
  await redisManager.initialize();
}

/**
 * Get Redis client
 */
export function getRedisClient(): RedisClientType<RedisDefaultModules & RedisModules, RedisFunctions, RedisScripts> | IORedis.Redis | IORedis.Cluster | null {
  return redisManager.getClient();
}

/**
 * Execute Redis command
 */
export async function executeRedisCommand<T>(
  command: string,
  args: any[] = [],
  connectionId?: string
): Promise<T | null> {
  return redisManager.executeCommand<T>(command, args, connectionId);
}

/**
 * Test Redis connection
 */
export async function testRedisConnection(): Promise<boolean> {
  return redisManager.testConnection();
}

/**
 * Get Redis metrics
 */
export function getRedisMetrics(): CacheMetrics {
  return redisManager.getMetrics();
}

/**
 * Shutdown Redis connections
 */
export async function shutdownRedis(): Promise<void> {
  await redisManager.shutdown();
}

export default redisManager;