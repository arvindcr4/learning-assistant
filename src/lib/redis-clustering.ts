import IORedis, { Redis, Cluster, ClusterOptions } from 'ioredis';
import { env } from './env-validation';

// ====================
// TYPES AND INTERFACES
// ====================

export interface RedisClusterConfig {
  enabled: boolean;
  nodes: ClusterNode[];
  sentinel: SentinelConfig;
  options: ClusterOptions;
  healthCheck: HealthCheckConfig;
  failover: FailoverConfig;
  backup: BackupConfig;
  monitoring: MonitoringConfig;
}

export interface ClusterNode {
  host: string;
  port: number;
  role: 'master' | 'slave' | 'sentinel';
  priority: number;
  region?: string;
  datacenter?: string;
  availability_zone?: string;
}

export interface SentinelConfig {
  enabled: boolean;
  masters: SentinelMaster[];
  sentinels: SentinelNode[];
  options: {
    masterName: string;
    sentinelRetryDelayOnFailover: number;
    enableOfflineQueue: boolean;
    connectTimeout: number;
    commandTimeout: number;
    maxRetriesPerRequest: number;
    retryDelayOnFailover: number;
    role: 'master' | 'slave';
    preferredSlaves?: (slaves: any[]) => any;
  };
}

export interface SentinelMaster {
  name: string;
  host: string;
  port: number;
  authPass?: string;
  database?: number;
}

export interface SentinelNode {
  host: string;
  port: number;
  authPass?: string;
}

export interface HealthCheckConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  maxFailures: number;
  endpoints: string[];
  checks: HealthCheck[];
}

export interface HealthCheck {
  type: 'ping' | 'info' | 'memory' | 'replication' | 'custom';
  command?: string;
  threshold?: number;
  timeout?: number;
  critical?: boolean;
}

export interface FailoverConfig {
  enabled: boolean;
  automatic: boolean;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  notifications: {
    webhook?: string;
    email?: string[];
    slack?: string;
  };
  strategies: FailoverStrategy[];
}

export interface FailoverStrategy {
  name: string;
  conditions: FailoverCondition[];
  actions: FailoverAction[];
  priority: number;
  cooldown: number;
}

export interface FailoverCondition {
  type: 'node_down' | 'high_latency' | 'memory_usage' | 'connection_count';
  threshold: number;
  duration: number;
}

export interface FailoverAction {
  type: 'promote_slave' | 'redirect_traffic' | 'scale_up' | 'notify' | 'restart';
  parameters: { [key: string]: any };
  delay?: number;
}

export interface BackupConfig {
  enabled: boolean;
  strategy: 'snapshot' | 'replication' | 'incremental';
  schedule: string;
  retention: number;
  storage: {
    type: 's3' | 'gcs' | 'azure' | 'local';
    bucket?: string;
    path?: string;
    credentials?: { [key: string]: string };
  };
  compression: boolean;
  encryption: boolean;
}

export interface MonitoringConfig {
  enabled: boolean;
  metrics: {
    memory: boolean;
    connections: boolean;
    commands: boolean;
    replication: boolean;
    sentinel: boolean;
    cluster: boolean;
  };
  alerting: {
    thresholds: { [metric: string]: number };
    channels: string[];
  };
  exporters: {
    prometheus?: {
      enabled: boolean;
      port: number;
      endpoint: string;
    };
    datadog?: {
      enabled: boolean;
      apiKey: string;
      tags: string[];
    };
  };
}

export interface ClusterMetrics {
  totalNodes: number;
  activeNodes: number;
  masterNodes: number;
  slaveNodes: number;
  sentinelNodes: number;
  totalMemory: number;
  usedMemory: number;
  totalConnections: number;
  averageLatency: number;
  replicationLag: number;
  healthScore: number;
  lastFailover: number;
  uptimeSeconds: number;
}

export interface ClusterTopology {
  masters: ClusterMasterInfo[];
  slaves: ClusterSlaveInfo[];
  sentinels: ClusterSentinelInfo[];
  sharding: ShardInfo[];
}

export interface ClusterMasterInfo {
  nodeId: string;
  host: string;
  port: number;
  slots: number[];
  slaveCount: number;
  memory: number;
  connections: number;
  lastSeen: number;
  status: 'online' | 'offline' | 'fail';
}

export interface ClusterSlaveInfo {
  nodeId: string;
  host: string;
  port: number;
  masterId: string;
  replicationOffset: number;
  lag: number;
  priority: number;
  status: 'online' | 'offline' | 'fail';
}

export interface ClusterSentinelInfo {
  nodeId: string;
  host: string;
  port: number;
  masterName: string;
  numOtherSentinels: number;
  numSlaves: number;
  oDown: boolean;
  sDown: boolean;
  status: 'online' | 'offline';
}

export interface ShardInfo {
  shardId: string;
  startSlot: number;
  endSlot: number;
  master: ClusterMasterInfo;
  slaves: ClusterSlaveInfo[];
  keyCount: number;
  memoryUsage: number;
}

// ====================
// REDIS CLUSTER MANAGER
// ====================

export class RedisClusterManager {
  private static instance: RedisClusterManager;
  private config: RedisClusterConfig;
  private cluster: Cluster | null = null;
  private sentinel: Redis | null = null;
  private masterConnections: Map<string, Redis> = new Map();
  private slaveConnections: Map<string, Redis> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsCollectionInterval: NodeJS.Timeout | null = null;
  private backupInterval: NodeJS.Timeout | null = null;
  private metrics: ClusterMetrics;
  private isInitialized: boolean = false;

  private constructor() {
    this.config = this.loadConfiguration();
    this.metrics = this.initializeMetrics();
  }

  public static getInstance(): RedisClusterManager {
    if (!RedisClusterManager.instance) {
      RedisClusterManager.instance = new RedisClusterManager();
    }
    return RedisClusterManager.instance;
  }

  private loadConfiguration(): RedisClusterConfig {
    return {
      enabled: env.REDIS_CLUSTER_ENABLED || false,
      nodes: this.parseClusterNodes(),
      sentinel: {
        enabled: env.REDIS_SENTINEL_ENABLED || false,
        masters: this.parseSentinelMasters(),
        sentinels: this.parseSentinelNodes(),
        options: {
          masterName: env.REDIS_SENTINEL_MASTER_NAME || 'mymaster',
          sentinelRetryDelayOnFailover: 100,
          enableOfflineQueue: false,
          connectTimeout: 10000,
          commandTimeout: 5000,
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100,
          role: 'master',
        },
      },
      options: {
        enableOfflineQueue: false,
        redisOptions: {
          password: env.REDIS_PASSWORD,
          db: env.REDIS_DB || 0,
        },
        clusterRetryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        scaleReads: 'slave',
        enableReadyCheck: true,
        lazyConnect: true,
      },
      healthCheck: {
        enabled: true,
        interval: 30000,
        timeout: 5000,
        maxFailures: 3,
        endpoints: [],
        checks: [
          { type: 'ping', critical: true },
          { type: 'memory', threshold: 90, critical: false },
          { type: 'replication', critical: true },
        ],
      },
      failover: {
        enabled: true,
        automatic: true,
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 5000,
        notifications: {},
        strategies: [],
      },
      backup: {
        enabled: false,
        strategy: 'snapshot',
        schedule: '0 2 * * *', // Daily at 2 AM
        retention: 7,
        storage: {
          type: 'local',
          path: '/backup/redis',
        },
        compression: true,
        encryption: false,
      },
      monitoring: {
        enabled: true,
        metrics: {
          memory: true,
          connections: true,
          commands: true,
          replication: true,
          sentinel: true,
          cluster: true,
        },
        alerting: {
          thresholds: {
            memory_usage: 85,
            connection_count: 1000,
            replication_lag: 1000,
            response_time: 100,
          },
          channels: [],
        },
        exporters: {
          prometheus: {
            enabled: false,
            port: 9121,
            endpoint: '/metrics',
          },
        },
      },
    };
  }

  private parseClusterNodes(): ClusterNode[] {
    const nodesString = env.REDIS_CLUSTER_NODES;
    if (!nodesString) return [];

    return nodesString.split(',').map((nodeString, index) => {
      const [host, port] = nodeString.trim().split(':');
      return {
        host,
        port: parseInt(port, 10),
        role: index === 0 ? 'master' : 'slave',
        priority: index === 0 ? 1 : 2,
      };
    });
  }

  private parseSentinelMasters(): SentinelMaster[] {
    const mastersString = env.REDIS_SENTINEL_MASTERS;
    if (!mastersString) return [];

    return mastersString.split(',').map(masterString => {
      const [name, host, port] = masterString.trim().split(':');
      return {
        name,
        host,
        port: parseInt(port, 10),
        authPass: env.REDIS_PASSWORD,
        database: env.REDIS_DB || 0,
      };
    });
  }

  private parseSentinelNodes(): SentinelNode[] {
    const sentinelsString = env.REDIS_SENTINEL_NODES;
    if (!sentinelsString) return [];

    return sentinelsString.split(',').map(sentinelString => {
      const [host, port] = sentinelString.trim().split(':');
      return {
        host,
        port: parseInt(port, 10),
        authPass: env.REDIS_SENTINEL_PASSWORD,
      };
    });
  }

  private initializeMetrics(): ClusterMetrics {
    return {
      totalNodes: 0,
      activeNodes: 0,
      masterNodes: 0,
      slaveNodes: 0,
      sentinelNodes: 0,
      totalMemory: 0,
      usedMemory: 0,
      totalConnections: 0,
      averageLatency: 0,
      replicationLag: 0,
      healthScore: 100,
      lastFailover: 0,
      uptimeSeconds: 0,
    };
  }

  /**
   * Initialize Redis cluster
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('🔄 Initializing Redis cluster...');

      if (this.config.sentinel.enabled) {
        await this.initializeSentinel();
      } else if (this.config.enabled) {
        await this.initializeCluster();
      }

      if (this.config.healthCheck.enabled) {
        this.startHealthChecks();
      }

      if (this.config.monitoring.enabled) {
        this.startMetricsCollection();
      }

      if (this.config.backup.enabled) {
        this.scheduleBackups();
      }

      this.isInitialized = true;
      console.log('✅ Redis cluster initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Redis cluster:', error);
      throw error;
    }
  }

  /**
   * Initialize Redis Sentinel
   */
  private async initializeSentinel(): Promise<void> {
    try {
      console.log('🔄 Initializing Redis Sentinel...');

      const sentinelOptions = {
        sentinels: this.config.sentinel.sentinels,
        name: this.config.sentinel.options.masterName,
        ...this.config.sentinel.options,
      };

      this.sentinel = new IORedis(sentinelOptions);

      this.sentinel.on('connect', () => {
        console.log('✅ Connected to Redis Sentinel');
      });

      this.sentinel.on('error', (error) => {
        console.error('❌ Redis Sentinel error:', error);
      });

      this.sentinel.on('+switch-master', (masterName, oldHost, oldPort, newHost, newPort) => {
        console.log(`🔄 Master switched: ${masterName} from ${oldHost}:${oldPort} to ${newHost}:${newPort}`);
        this.metrics.lastFailover = Date.now();
        this.handleFailoverEvent(masterName, oldHost, oldPort, newHost, newPort);
      });

      await this.sentinel.ping();
      console.log('✅ Redis Sentinel initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Redis Sentinel:', error);
      throw error;
    }
  }

  /**
   * Initialize Redis Cluster
   */
  private async initializeCluster(): Promise<void> {
    try {
      console.log('🔄 Initializing Redis Cluster...');

      const nodes = this.config.nodes.map(node => ({
        host: node.host,
        port: node.port,
      }));

      this.cluster = new Cluster(nodes, this.config.options);

      this.cluster.on('connect', () => {
        console.log('✅ Connected to Redis Cluster');
      });

      this.cluster.on('ready', () => {
        console.log('✅ Redis Cluster ready');
      });

      this.cluster.on('error', (error) => {
        console.error('❌ Redis Cluster error:', error);
      });

      this.cluster.on('node error', (error, node) => {
        console.error(`❌ Redis Cluster node error (${node.options.host}:${node.options.port}):`, error);
      });

      this.cluster.on('+node', (node) => {
        console.log(`➕ Redis Cluster node added: ${node.options.host}:${node.options.port}`);
        this.updateTopology();
      });

      this.cluster.on('-node', (node) => {
        console.log(`➖ Redis Cluster node removed: ${node.options.host}:${node.options.port}`);
        this.updateTopology();
      });

      await this.cluster.ping();
      console.log('✅ Redis Cluster initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Redis Cluster:', error);
      throw error;
    }
  }

  /**
   * Get cluster topology
   */
  public async getTopology(): Promise<ClusterTopology> {
    try {
      const masters: ClusterMasterInfo[] = [];
      const slaves: ClusterSlaveInfo[] = [];
      const sentinels: ClusterSentinelInfo[] = [];
      const sharding: ShardInfo[] = [];

      if (this.cluster) {
        const nodes = this.cluster.nodes('all');
        
        for (const node of nodes) {
          const nodeInfo = await this.getNodeInfo(node);
          
          if (nodeInfo.role === 'master') {
            masters.push(nodeInfo as ClusterMasterInfo);
          } else {
            slaves.push(nodeInfo as ClusterSlaveInfo);
          }
        }

        // Get sharding information
        const clusterSlots = await this.cluster.cluster('slots');
        if (clusterSlots) {
          // Parse cluster slots response to create shard info
          // This would need proper parsing of the Redis CLUSTER SLOTS response
        }
      }

      if (this.sentinel) {
        // Get sentinel information
        const sentinelMasters = await this.sentinel.sentinel('masters');
        // Parse sentinel masters to create sentinel info
      }

      return { masters, slaves, sentinels, sharding };
    } catch (error) {
      console.error('❌ Failed to get cluster topology:', error);
      return { masters: [], slaves: [], sentinels: [], sharding: [] };
    }
  }

  /**
   * Get cluster metrics
   */
  public async getMetrics(): Promise<ClusterMetrics> {
    await this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Perform manual failover
   */
  public async performFailover(
    masterName?: string,
    targetSlave?: string
  ): Promise<{ success: boolean; newMaster?: string; error?: string }> {
    try {
      console.log(`🔄 Performing manual failover${masterName ? ` for master: ${masterName}` : ''}...`);

      if (this.sentinel) {
        const result = await this.sentinel.sentinel('failover', masterName || this.config.sentinel.options.masterName);
        
        if (result === 'OK') {
          this.metrics.lastFailover = Date.now();
          console.log('✅ Manual failover completed successfully');
          return { success: true };
        } else {
          return { success: false, error: `Failover command returned: ${result}` };
        }
      } else if (this.cluster) {
        // Cluster failover is more complex and depends on the specific scenario
        console.log('⚠️ Cluster failover not implemented yet');
        return { success: false, error: 'Cluster failover not implemented' };
      } else {
        return { success: false, error: 'No cluster or sentinel configuration found' };
      }
    } catch (error) {
      console.error('❌ Manual failover failed:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Add node to cluster
   */
  public async addNode(
    host: string,
    port: number,
    role: 'master' | 'slave' = 'slave',
    masterId?: string
  ): Promise<{ success: boolean; nodeId?: string; error?: string }> {
    try {
      console.log(`🔄 Adding ${role} node: ${host}:${port}...`);

      if (!this.cluster) {
        return { success: false, error: 'Cluster not initialized' };
      }

      // Add node to cluster
      const result = await this.cluster.cluster('meet', host, port);
      
      if (result === 'OK') {
        // If adding as slave, replicate from master
        if (role === 'slave' && masterId) {
          const newNode = new IORedis({ host, port });
          await newNode.cluster('replicate', masterId);
          await newNode.disconnect();
        }

        console.log(`✅ Node ${host}:${port} added successfully`);
        this.updateTopology();
        return { success: true };
      } else {
        return { success: false, error: `Add node command returned: ${result}` };
      }
    } catch (error) {
      console.error(`❌ Failed to add node ${host}:${port}:`, error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Remove node from cluster
   */
  public async removeNode(nodeId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🔄 Removing node: ${nodeId}...`);

      if (!this.cluster) {
        return { success: false, error: 'Cluster not initialized' };
      }

      const result = await this.cluster.cluster('forget', nodeId);
      
      if (result === 'OK') {
        console.log(`✅ Node ${nodeId} removed successfully`);
        this.updateTopology();
        return { success: true };
      } else {
        return { success: false, error: `Remove node command returned: ${result}` };
      }
    } catch (error) {
      console.error(`❌ Failed to remove node ${nodeId}:`, error);
      return { success: false, error: (error as Error).message };
    }
  }

  // ====================
  // PRIVATE METHODS
  // ====================

  private async getNodeInfo(node: Redis): Promise<Partial<ClusterMasterInfo & ClusterSlaveInfo>> {
    try {
      const info = await node.info('replication');
      const host = node.options.host || 'unknown';
      const port = node.options.port || 6379;
      
      // Parse replication info to determine role and other details
      const lines = info.split('\r\n');
      let role = 'master';
      
      for (const line of lines) {
        if (line.startsWith('role:')) {
          role = line.split(':')[1];
          break;
        }
      }

      return {
        nodeId: `${host}:${port}`,
        host,
        port,
        status: 'online',
        lastSeen: Date.now(),
      };
    } catch (error) {
      console.error('❌ Failed to get node info:', error);
      return {
        nodeId: 'unknown',
        host: 'unknown',
        port: 0,
        status: 'offline',
        lastSeen: Date.now(),
      };
    }
  }

  private async updateMetrics(): Promise<void> {
    try {
      if (this.cluster) {
        const nodes = this.cluster.nodes('all');
        this.metrics.totalNodes = nodes.length;
        this.metrics.activeNodes = nodes.filter(node => node.status === 'ready').length;
        
        // Update other metrics based on node information
        // This would involve querying each node for detailed metrics
      }

      if (this.sentinel) {
        // Update sentinel-specific metrics
        const masters = await this.sentinel.sentinel('masters');
        this.metrics.sentinelNodes = this.config.sentinel.sentinels.length;
      }
    } catch (error) {
      console.error('❌ Failed to update metrics:', error);
    }
  }

  private async updateTopology(): Promise<void> {
    try {
      // Update internal topology representation
      // This would be called when nodes are added/removed
      console.log('🔄 Updating cluster topology...');
    } catch (error) {
      console.error('❌ Failed to update topology:', error);
    }
  }

  private handleFailoverEvent(
    masterName: string,
    oldHost: string,
    oldPort: number,
    newHost: string,
    newPort: number
  ): void {
    // Handle failover notifications and cleanup
    console.log(`🔄 Handling failover for ${masterName}...`);
    
    // Update connections
    // Send notifications
    // Update monitoring
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheck.interval);
  }

  private async performHealthChecks(): Promise<void> {
    try {
      if (this.cluster) {
        const nodes = this.cluster.nodes('all');
        
        for (const node of nodes) {
          for (const check of this.config.healthCheck.checks) {
            await this.performSingleHealthCheck(node, check);
          }
        }
      }
    } catch (error) {
      console.error('❌ Health check failed:', error);
    }
  }

  private async performSingleHealthCheck(node: Redis, check: HealthCheck): Promise<void> {
    try {
      switch (check.type) {
        case 'ping':
          await node.ping();
          break;
        case 'info':
          await node.info();
          break;
        case 'memory':
          const info = await node.info('memory');
          // Parse memory usage and check against threshold
          break;
        case 'replication':
          await node.info('replication');
          break;
      }
    } catch (error) {
      console.error(`❌ Health check ${check.type} failed for node:`, error);
      
      if (check.critical) {
        // Handle critical failure
        this.handleCriticalFailure(node, check, error);
      }
    }
  }

  private handleCriticalFailure(node: Redis, check: HealthCheck, error: any): void {
    console.error(`🚨 Critical failure detected for node:`, error);
    
    if (this.config.failover.automatic) {
      // Trigger automatic failover if configured
      this.triggerAutomaticFailover(node, error);
    }
  }

  private async triggerAutomaticFailover(node: Redis, error: any): Promise<void> {
    try {
      console.log('🔄 Triggering automatic failover...');
      
      if (this.sentinel) {
        await this.performFailover();
      }
    } catch (failoverError) {
      console.error('❌ Automatic failover failed:', failoverError);
    }
  }

  private startMetricsCollection(): void {
    this.metricsCollectionInterval = setInterval(async () => {
      await this.updateMetrics();
    }, 60000); // Every minute
  }

  private scheduleBackups(): void {
    if (this.config.backup.enabled) {
      // Schedule backups based on cron expression
      console.log('📅 Backup scheduling not implemented yet');
    }
  }

  /**
   * Shutdown cluster manager
   */
  public async shutdown(): Promise<void> {
    console.log('🔄 Shutting down Redis cluster manager...');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
    }

    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }

    if (this.cluster) {
      await this.cluster.disconnect();
    }

    if (this.sentinel) {
      await this.sentinel.disconnect();
    }

    for (const connection of this.masterConnections.values()) {
      await connection.disconnect();
    }

    for (const connection of this.slaveConnections.values()) {
      await connection.disconnect();
    }

    this.masterConnections.clear();
    this.slaveConnections.clear();
    this.isInitialized = false;

    console.log('✅ Redis cluster manager shutdown complete');
  }
}

// ====================
// SINGLETON INSTANCE
// ====================

export const redisClusterManager = RedisClusterManager.getInstance();

// ====================
// CONVENIENCE FUNCTIONS
// ====================

/**
 * Initialize Redis cluster
 */
export async function initializeRedisCluster(): Promise<void> {
  return redisClusterManager.initialize();
}

/**
 * Get cluster topology
 */
export async function getClusterTopology(): Promise<ClusterTopology> {
  return redisClusterManager.getTopology();
}

/**
 * Get cluster metrics
 */
export async function getClusterMetrics(): Promise<ClusterMetrics> {
  return redisClusterManager.getMetrics();
}

/**
 * Perform manual failover
 */
export async function performManualFailover(
  masterName?: string,
  targetSlave?: string
): Promise<{ success: boolean; newMaster?: string; error?: string }> {
  return redisClusterManager.performFailover(masterName, targetSlave);
}

/**
 * Add node to cluster
 */
export async function addClusterNode(
  host: string,
  port: number,
  role?: 'master' | 'slave',
  masterId?: string
): Promise<{ success: boolean; nodeId?: string; error?: string }> {
  return redisClusterManager.addNode(host, port, role, masterId);
}

/**
 * Remove node from cluster
 */
export async function removeClusterNode(nodeId: string): Promise<{ success: boolean; error?: string }> {
  return redisClusterManager.removeNode(nodeId);
}

export default redisClusterManager;