import fs from 'fs/promises';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';
import { executeRedisCommand } from './redis-client';
import { cacheManager } from './cache';
import { sessionCache } from './session-cache';
import { contentCache } from './content-cache';
import { env } from './env-validation';

// ====================
// TYPES AND INTERFACES
// ====================

export interface BackupConfig {
  enabled: boolean;
  strategies: BackupStrategy[];
  defaultStrategy: string;
  storage: StorageConfig;
  retention: RetentionConfig;
  scheduling: SchedulingConfig;
  encryption: EncryptionConfig;
  compression: CompressionConfig;
  monitoring: BackupMonitoringConfig;
}

export interface BackupStrategy {
  name: string;
  type: 'full' | 'incremental' | 'differential' | 'continuous';
  description: string;
  schedule: string;
  namespaces: string[];
  maxSize: number;
  timeout: number;
  enabled: boolean;
  priority: number;
  conditions: BackupCondition[];
}

export interface BackupCondition {
  type: 'time' | 'size' | 'changes' | 'memory_usage';
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
}

export interface StorageConfig {
  type: 'local' | 's3' | 'gcs' | 'azure' | 'ftp';
  local?: {
    basePath: string;
    permissions: string;
  };
  s3?: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    prefix?: string;
  };
  gcs?: {
    bucket: string;
    projectId: string;
    keyFilename: string;
    prefix?: string;
  };
  azure?: {
    connectionString: string;
    containerName: string;
    prefix?: string;
  };
}

export interface RetentionConfig {
  maxBackups: number;
  maxAge: number;
  policies: RetentionPolicy[];
}

export interface RetentionPolicy {
  name: string;
  strategy: string;
  keepDaily: number;
  keepWeekly: number;
  keepMonthly: number;
  keepYearly: number;
}

export interface SchedulingConfig {
  timezone: string;
  maxConcurrentBackups: number;
  backupWindow?: {
    start: string;
    end: string;
  };
  maintenanceWindow?: {
    start: string;
    end: string;
  };
}

export interface EncryptionConfig {
  enabled: boolean;
  algorithm: 'aes-256-gcm' | 'aes-256-cbc';
  keyDerivation: 'pbkdf2' | 'scrypt';
  keyFile?: string;
  password?: string;
}

export interface CompressionConfig {
  enabled: boolean;
  algorithm: 'gzip' | 'brotli' | 'lz4';
  level: number;
  threshold: number;
}

export interface BackupMonitoringConfig {
  enabled: boolean;
  notifications: {
    onSuccess: boolean;
    onFailure: boolean;
    onWarning: boolean;
    channels: string[];
  };
  healthChecks: {
    verifyAfterBackup: boolean;
    validateChecksums: boolean;
    testRestore: boolean;
  };
}

export interface BackupMetadata {
  id: string;
  strategy: string;
  type: 'full' | 'incremental' | 'differential';
  timestamp: number;
  size: number;
  compressedSize: number;
  duration: number;
  checksum: string;
  namespaces: string[];
  keyCount: number;
  version: string;
  redisVersion?: string;
  dependencies?: string[];
  encrypted: boolean;
  compressed: boolean;
}

export interface BackupFile {
  metadata: BackupMetadata;
  data: BackupData;
}

export interface BackupData {
  keys: BackupKeyData[];
  schemas: { [namespace: string]: any };
  statistics: BackupStatistics;
}

export interface BackupKeyData {
  key: string;
  namespace: string;
  type: string;
  ttl: number;
  value: any;
  metadata: any;
}

export interface BackupStatistics {
  totalKeys: number;
  totalSize: number;
  byNamespace: { [namespace: string]: NamespaceStats };
  byType: { [type: string]: number };
  compressionRatio: number;
  processingTime: number;
}

export interface NamespaceStats {
  keyCount: number;
  totalSize: number;
  averageKeySize: number;
  largestKey: string;
  oldestKey: string;
  newestKey: string;
}

export interface RestoreOptions {
  backupId: string;
  namespaces?: string[];
  keyPatterns?: string[];
  overwrite: boolean;
  dryRun: boolean;
  batchSize: number;
  skipErrors: boolean;
  preserveTTL: boolean;
  targetNamespace?: string;
  transformKeys?: (key: string) => string;
}

export interface RestoreResult {
  success: boolean;
  keysRestored: number;
  keysSkipped: number;
  keysErrored: number;
  duration: number;
  errors: RestoreError[];
  summary: RestoreSummary;
}

export interface RestoreError {
  key: string;
  error: string;
  timestamp: number;
}

export interface RestoreSummary {
  totalKeys: number;
  restoredKeys: number;
  skippedKeys: number;
  erroredKeys: number;
  namespaces: string[];
  dataIntegrityVerified: boolean;
}

// ====================
// CACHE BACKUP MANAGER
// ====================

export class CacheBackupManager {
  private static instance: CacheBackupManager;
  private config: BackupConfig;
  private activeBackups: Map<string, BackupProcess> = new Map();
  private backupHistory: BackupMetadata[] = [];
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map();
  private gzipCompress = promisify(zlib.gzip);
  private gzipDecompress = promisify(zlib.gunzip);

  private constructor() {
    this.config = this.loadConfiguration();
    this.scheduleBackups();
  }

  public static getInstance(): CacheBackupManager {
    if (!CacheBackupManager.instance) {
      CacheBackupManager.instance = new CacheBackupManager();
    }
    return CacheBackupManager.instance;
  }

  private loadConfiguration(): BackupConfig {
    return {
      enabled: env.CACHE_BACKUP_ENABLED || false,
      strategies: [
        {
          name: 'full_daily',
          type: 'full',
          description: 'Full backup performed daily',
          schedule: '0 2 * * *', // Daily at 2 AM
          namespaces: ['*'],
          maxSize: 1024 * 1024 * 1024, // 1GB
          timeout: 30 * 60 * 1000, // 30 minutes
          enabled: true,
          priority: 1,
          conditions: [],
        },
        {
          name: 'incremental_hourly',
          type: 'incremental',
          description: 'Incremental backup performed hourly',
          schedule: '0 * * * *', // Hourly
          namespaces: ['sessions', 'content', 'analytics'],
          maxSize: 100 * 1024 * 1024, // 100MB
          timeout: 10 * 60 * 1000, // 10 minutes
          enabled: true,
          priority: 2,
          conditions: [
            { type: 'changes', threshold: 100, operator: 'gt' },
          ],
        },
        {
          name: 'critical_continuous',
          type: 'continuous',
          description: 'Continuous backup for critical data',
          schedule: '*/5 * * * *', // Every 5 minutes
          namespaces: ['sessions', 'user_data'],
          maxSize: 10 * 1024 * 1024, // 10MB
          timeout: 5 * 60 * 1000, // 5 minutes
          enabled: false,
          priority: 3,
          conditions: [
            { type: 'memory_usage', threshold: 80, operator: 'gt' },
          ],
        },
      ],
      defaultStrategy: 'full_daily',
      storage: {
        type: 'local',
        local: {
          basePath: env.CACHE_BACKUP_PATH || '/var/cache/redis-backup',
          permissions: '0755',
        },
      },
      retention: {
        maxBackups: 50,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        policies: [
          {
            name: 'default',
            strategy: 'full_daily',
            keepDaily: 7,
            keepWeekly: 4,
            keepMonthly: 6,
            keepYearly: 2,
          },
        ],
      },
      scheduling: {
        timezone: 'UTC',
        maxConcurrentBackups: 2,
        backupWindow: {
          start: '02:00',
          end: '06:00',
        },
      },
      encryption: {
        enabled: false,
        algorithm: 'aes-256-gcm',
        keyDerivation: 'pbkdf2',
      },
      compression: {
        enabled: true,
        algorithm: 'gzip',
        level: 6,
        threshold: 1024,
      },
      monitoring: {
        enabled: true,
        notifications: {
          onSuccess: false,
          onFailure: true,
          onWarning: true,
          channels: [],
        },
        healthChecks: {
          verifyAfterBackup: true,
          validateChecksums: true,
          testRestore: false,
        },
      },
    };
  }

  /**
   * Create a backup using specified strategy
   */
  public async createBackup(
    strategyName?: string,
    options: Partial<BackupStrategy> = {}
  ): Promise<BackupMetadata> {
    const strategy = strategyName 
      ? this.config.strategies.find(s => s.name === strategyName)
      : this.config.strategies.find(s => s.name === this.config.defaultStrategy);

    if (!strategy) {
      throw new Error(`Backup strategy not found: ${strategyName || this.config.defaultStrategy}`);
    }

    const mergedStrategy = { ...strategy, ...options };
    const backupId = this.generateBackupId(mergedStrategy);

    if (this.activeBackups.has(backupId)) {
      throw new Error(`Backup ${backupId} is already in progress`);
    }

    console.log(`🔄 Starting ${mergedStrategy.type} backup: ${backupId}`);
    const startTime = Date.now();

    try {
      // Check conditions
      if (mergedStrategy.conditions.length > 0) {
        const conditionsMet = await this.checkBackupConditions(mergedStrategy.conditions);
        if (!conditionsMet) {
          console.log(`⏭️ Backup conditions not met for strategy: ${mergedStrategy.name}`);
          throw new Error('Backup conditions not met');
        }
      }

      // Create backup process
      const backupProcess = new BackupProcess(backupId, mergedStrategy);
      this.activeBackups.set(backupId, backupProcess);

      // Execute backup
      const backupData = await this.executeBackup(mergedStrategy);
      const backupFile = await this.processBackupData(backupData, mergedStrategy);
      
      // Store backup
      const storagePath = await this.storeBackup(backupFile, backupId);
      
      // Create metadata
      const metadata: BackupMetadata = {
        id: backupId,
        strategy: mergedStrategy.name,
        type: mergedStrategy.type,
        timestamp: startTime,
        size: backupFile.data.statistics.totalSize,
        compressedSize: this.config.compression.enabled ? 
          Math.floor(backupFile.data.statistics.totalSize * 0.3) : 
          backupFile.data.statistics.totalSize,
        duration: Date.now() - startTime,
        checksum: await this.calculateChecksum(JSON.stringify(backupFile)),
        namespaces: mergedStrategy.namespaces,
        keyCount: backupFile.data.statistics.totalKeys,
        version: '1.0',
        encrypted: this.config.encryption.enabled,
        compressed: this.config.compression.enabled,
      };

      // Save metadata
      await this.saveBackupMetadata(metadata);
      this.backupHistory.push(metadata);

      // Cleanup old backups
      await this.cleanupOldBackups();

      // Verify backup if enabled
      if (this.config.monitoring.healthChecks.verifyAfterBackup) {
        await this.verifyBackup(metadata);
      }

      console.log(`✅ Backup completed successfully: ${backupId} (${metadata.duration}ms)`);
      return metadata;

    } catch (error) {
      console.error(`❌ Backup failed: ${backupId}`, error);
      throw error;
    } finally {
      this.activeBackups.delete(backupId);
    }
  }

  /**
   * Restore from backup
   */
  public async restoreFromBackup(options: RestoreOptions): Promise<RestoreResult> {
    console.log(`🔄 Starting restore from backup: ${options.backupId}`);
    const startTime = Date.now();

    try {
      // Load backup metadata
      const metadata = await this.loadBackupMetadata(options.backupId);
      if (!metadata) {
        throw new Error(`Backup metadata not found: ${options.backupId}`);
      }

      // Load backup data
      const backupFile = await this.loadBackup(options.backupId);
      if (!backupFile) {
        throw new Error(`Backup data not found: ${options.backupId}`);
      }

      // Verify backup integrity
      if (this.config.monitoring.healthChecks.validateChecksums) {
        const isValid = await this.verifyBackupIntegrity(backupFile, metadata);
        if (!isValid) {
          throw new Error('Backup integrity verification failed');
        }
      }

      // Filter keys based on options
      const filteredKeys = this.filterKeysForRestore(backupFile.data.keys, options);

      if (options.dryRun) {
        return this.createDryRunResult(filteredKeys, Date.now() - startTime);
      }

      // Execute restore
      const result = await this.executeRestore(filteredKeys, options);
      result.duration = Date.now() - startTime;

      console.log(`✅ Restore completed: ${result.keysRestored} keys restored in ${result.duration}ms`);
      return result;

    } catch (error) {
      console.error(`❌ Restore failed: ${options.backupId}`, error);
      return {
        success: false,
        keysRestored: 0,
        keysSkipped: 0,
        keysErrored: 0,
        duration: Date.now() - startTime,
        errors: [{ key: 'restore', error: (error as Error).message, timestamp: Date.now() }],
        summary: {
          totalKeys: 0,
          restoredKeys: 0,
          skippedKeys: 0,
          erroredKeys: 0,
          namespaces: [],
          dataIntegrityVerified: false,
        },
      };
    }
  }

  /**
   * List available backups
   */
  public async listBackups(
    strategyName?: string,
    limit: number = 50
  ): Promise<BackupMetadata[]> {
    let backups = [...this.backupHistory];

    if (strategyName) {
      backups = backups.filter(backup => backup.strategy === strategyName);
    }

    return backups
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Delete backup
   */
  public async deleteBackup(backupId: string): Promise<boolean> {
    try {
      console.log(`🗑️ Deleting backup: ${backupId}`);

      // Remove backup file
      await this.removeBackupFile(backupId);

      // Remove metadata
      await this.removeBackupMetadata(backupId);

      // Remove from history
      this.backupHistory = this.backupHistory.filter(backup => backup.id !== backupId);

      console.log(`✅ Backup deleted: ${backupId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to delete backup ${backupId}:`, error);
      return false;
    }
  }

  /**
   * Get backup statistics
   */
  public getBackupStatistics(): {
    totalBackups: number;
    totalSize: number;
    oldestBackup?: number;
    newestBackup?: number;
    strategyCounts: { [strategy: string]: number };
    averageBackupSize: number;
  } {
    const totalBackups = this.backupHistory.length;
    const totalSize = this.backupHistory.reduce((sum, backup) => sum + backup.size, 0);
    const strategyCounts: { [strategy: string]: number } = {};

    for (const backup of this.backupHistory) {
      strategyCounts[backup.strategy] = (strategyCounts[backup.strategy] || 0) + 1;
    }

    const timestamps = this.backupHistory.map(backup => backup.timestamp);
    const oldestBackup = timestamps.length > 0 ? Math.min(...timestamps) : undefined;
    const newestBackup = timestamps.length > 0 ? Math.max(...timestamps) : undefined;

    return {
      totalBackups,
      totalSize,
      oldestBackup,
      newestBackup,
      strategyCounts,
      averageBackupSize: totalBackups > 0 ? totalSize / totalBackups : 0,
    };
  }

  // ====================
  // PRIVATE METHODS
  // ====================

  private generateBackupId(strategy: BackupStrategy): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${strategy.name}-${timestamp}`;
  }

  private async checkBackupConditions(conditions: BackupCondition[]): Promise<boolean> {
    for (const condition of conditions) {
      const currentValue = await this.getCurrentMetricValue(condition.type);
      
      if (!this.evaluateCondition(currentValue, condition.threshold, condition.operator)) {
        return false;
      }
    }
    return true;
  }

  private async getCurrentMetricValue(metricType: string): Promise<number> {
    switch (metricType) {
      case 'memory_usage':
        const stats = cacheManager.getStats();
        return (stats.memoryUsage / (1024 * 1024 * 1024)) * 100; // Convert to percentage
      case 'size':
        return cacheManager.getStats().totalSize;
      case 'changes':
        // This would require tracking changes since last backup
        return 0;
      default:
        return 0;
    }
  }

  private evaluateCondition(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'eq': return value === threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      default: return false;
    }
  }

  private async executeBackup(strategy: BackupStrategy): Promise<BackupData> {
    const keys: BackupKeyData[] = [];
    const schemas: { [namespace: string]: any } = {};
    const statistics: Partial<BackupStatistics> = {
      totalKeys: 0,
      totalSize: 0,
      byNamespace: {},
      byType: {},
    };

    // Get keys for each namespace
    for (const namespace of strategy.namespaces) {
      if (namespace === '*') {
        // Backup all namespaces
        await this.backupAllNamespaces(keys, statistics);
      } else {
        // Backup specific namespace
        await this.backupNamespace(namespace, keys, statistics);
      }
    }

    return {
      keys,
      schemas,
      statistics: statistics as BackupStatistics,
    };
  }

  private async backupAllNamespaces(keys: BackupKeyData[], statistics: Partial<BackupStatistics>): Promise<void> {
    // This would involve scanning all Redis keys
    const allKeys = await executeRedisCommand<string[]>('keys', ['*']);
    
    if (allKeys) {
      for (const key of allKeys) {
        const keyData = await this.backupKey(key);
        if (keyData) {
          keys.push(keyData);
          this.updateStatistics(statistics, keyData);
        }
      }
    }
  }

  private async backupNamespace(
    namespace: string, 
    keys: BackupKeyData[], 
    statistics: Partial<BackupStatistics>
  ): Promise<void> {
    const pattern = `${namespace}:*`;
    const namespaceKeys = await executeRedisCommand<string[]>('keys', [pattern]);
    
    if (namespaceKeys) {
      for (const key of namespaceKeys) {
        const keyData = await this.backupKey(key);
        if (keyData) {
          keys.push(keyData);
          this.updateStatistics(statistics, keyData);
        }
      }
    }
  }

  private async backupKey(redisKey: string): Promise<BackupKeyData | null> {
    try {
      const [namespace, ...keyParts] = redisKey.split(':');
      const key = keyParts.join(':');

      const value = await executeRedisCommand('get', [redisKey]);
      const ttl = await executeRedisCommand<number>('ttl', [redisKey]);
      const type = await executeRedisCommand<string>('type', [redisKey]);

      return {
        key,
        namespace,
        type: type || 'string',
        ttl: ttl || -1,
        value,
        metadata: {
          size: Buffer.byteLength(JSON.stringify(value), 'utf8'),
          timestamp: Date.now(),
        },
      };
    } catch (error) {
      console.warn(`⚠️ Failed to backup key ${redisKey}:`, error);
      return null;
    }
  }

  private updateStatistics(statistics: Partial<BackupStatistics>, keyData: BackupKeyData): void {
    statistics.totalKeys = (statistics.totalKeys || 0) + 1;
    statistics.totalSize = (statistics.totalSize || 0) + keyData.metadata.size;

    // Update namespace stats
    if (!statistics.byNamespace) statistics.byNamespace = {};
    if (!statistics.byNamespace[keyData.namespace]) {
      statistics.byNamespace[keyData.namespace] = {
        keyCount: 0,
        totalSize: 0,
        averageKeySize: 0,
        largestKey: keyData.key,
        oldestKey: keyData.key,
        newestKey: keyData.key,
      };
    }
    const nsStats = statistics.byNamespace[keyData.namespace];
    nsStats.keyCount++;
    nsStats.totalSize += keyData.metadata.size;
    nsStats.averageKeySize = nsStats.totalSize / nsStats.keyCount;

    // Update type stats
    if (!statistics.byType) statistics.byType = {};
    statistics.byType[keyData.type] = (statistics.byType[keyData.type] || 0) + 1;
  }

  private async processBackupData(data: BackupData, strategy: BackupStrategy): Promise<BackupFile> {
    const backupFile: BackupFile = {
      metadata: {
        id: '',
        strategy: strategy.name,
        type: strategy.type,
        timestamp: Date.now(),
        size: data.statistics.totalSize,
        compressedSize: 0,
        duration: 0,
        checksum: '',
        namespaces: strategy.namespaces,
        keyCount: data.statistics.totalKeys,
        version: '1.0',
        encrypted: this.config.encryption.enabled,
        compressed: this.config.compression.enabled,
      },
      data,
    };

    return backupFile;
  }

  private async storeBackup(backupFile: BackupFile, backupId: string): Promise<string> {
    const serializedData = JSON.stringify(backupFile);
    let finalData = serializedData;

    // Compress if enabled
    if (this.config.compression.enabled) {
      const compressed = await this.gzipCompress(Buffer.from(serializedData));
      finalData = compressed.toString('base64');
    }

    // Encrypt if enabled
    if (this.config.encryption.enabled) {
      finalData = await this.encryptData(finalData);
    }

    // Store based on storage type
    switch (this.config.storage.type) {
      case 'local':
        return await this.storeBackupLocal(finalData, backupId);
      case 's3':
        return await this.storeBackupS3(finalData, backupId);
      default:
        throw new Error(`Unsupported storage type: ${this.config.storage.type}`);
    }
  }

  private async storeBackupLocal(data: string, backupId: string): Promise<string> {
    const basePath = this.config.storage.local?.basePath || '/tmp/redis-backup';
    await fs.mkdir(basePath, { recursive: true });
    
    const filename = `${backupId}.backup`;
    const filepath = path.join(basePath, filename);
    
    await fs.writeFile(filepath, data, 'utf8');
    return filepath;
  }

  private async storeBackupS3(data: string, backupId: string): Promise<string> {
    // S3 implementation would go here
    throw new Error('S3 storage not implemented yet');
  }

  private async encryptData(data: string): Promise<string> {
    // Encryption implementation would go here
    console.warn('⚠️ Encryption not implemented yet');
    return data;
  }

  private async loadBackup(backupId: string): Promise<BackupFile | null> {
    try {
      const filepath = await this.getBackupFilePath(backupId);
      let data = await fs.readFile(filepath, 'utf8');

      // Decrypt if needed
      if (this.config.encryption.enabled) {
        data = await this.decryptData(data);
      }

      // Decompress if needed
      if (this.config.compression.enabled) {
        const buffer = Buffer.from(data, 'base64');
        const decompressed = await this.gzipDecompress(buffer);
        data = decompressed.toString('utf8');
      }

      return JSON.parse(data) as BackupFile;
    } catch (error) {
      console.error(`❌ Failed to load backup ${backupId}:`, error);
      return null;
    }
  }

  private async decryptData(data: string): Promise<string> {
    // Decryption implementation would go here
    console.warn('⚠️ Decryption not implemented yet');
    return data;
  }

  private async getBackupFilePath(backupId: string): Promise<string> {
    const basePath = this.config.storage.local?.basePath || '/tmp/redis-backup';
    return path.join(basePath, `${backupId}.backup`);
  }

  private filterKeysForRestore(keys: BackupKeyData[], options: RestoreOptions): BackupKeyData[] {
    let filteredKeys = keys;

    // Filter by namespaces
    if (options.namespaces && options.namespaces.length > 0) {
      filteredKeys = filteredKeys.filter(key => 
        options.namespaces!.includes(key.namespace)
      );
    }

    // Filter by key patterns
    if (options.keyPatterns && options.keyPatterns.length > 0) {
      filteredKeys = filteredKeys.filter(key => 
        options.keyPatterns!.some(pattern => 
          new RegExp(pattern).test(key.key)
        )
      );
    }

    return filteredKeys;
  }

  private async executeRestore(keys: BackupKeyData[], options: RestoreOptions): Promise<RestoreResult> {
    const result: RestoreResult = {
      success: true,
      keysRestored: 0,
      keysSkipped: 0,
      keysErrored: 0,
      duration: 0,
      errors: [],
      summary: {
        totalKeys: keys.length,
        restoredKeys: 0,
        skippedKeys: 0,
        erroredKeys: 0,
        namespaces: [...new Set(keys.map(k => k.namespace))],
        dataIntegrityVerified: false,
      },
    };

    const batchSize = options.batchSize || 100;
    
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      
      for (const keyData of batch) {
        try {
          const success = await this.restoreKey(keyData, options);
          
          if (success) {
            result.keysRestored++;
          } else {
            result.keysSkipped++;
          }
        } catch (error) {
          result.keysErrored++;
          result.errors.push({
            key: keyData.key,
            error: (error as Error).message,
            timestamp: Date.now(),
          });

          if (!options.skipErrors) {
            result.success = false;
            break;
          }
        }
      }

      // Small delay between batches to avoid overwhelming the system
      if (i + batchSize < keys.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    result.summary.restoredKeys = result.keysRestored;
    result.summary.skippedKeys = result.keysSkipped;
    result.summary.erroredKeys = result.keysErrored;

    return result;
  }

  private async restoreKey(keyData: BackupKeyData, options: RestoreOptions): Promise<boolean> {
    const namespace = options.targetNamespace || keyData.namespace;
    const key = options.transformKeys ? options.transformKeys(keyData.key) : keyData.key;
    const fullKey = `${namespace}:${key}`;

    // Check if key exists and handle overwrite
    const exists = await executeRedisCommand<number>('exists', [fullKey]);
    if (exists && !options.overwrite) {
      return false; // Skip existing key
    }

    // Restore the key
    await executeRedisCommand('set', [fullKey, keyData.value]);

    // Restore TTL if preserving it
    if (options.preserveTTL && keyData.ttl > 0) {
      await executeRedisCommand('expire', [fullKey, keyData.ttl]);
    }

    return true;
  }

  private createDryRunResult(keys: BackupKeyData[], duration: number): RestoreResult {
    return {
      success: true,
      keysRestored: 0,
      keysSkipped: 0,
      keysErrored: 0,
      duration,
      errors: [],
      summary: {
        totalKeys: keys.length,
        restoredKeys: 0,
        skippedKeys: 0,
        erroredKeys: 0,
        namespaces: [...new Set(keys.map(k => k.namespace))],
        dataIntegrityVerified: false,
      },
    };
  }

  private async verifyBackup(metadata: BackupMetadata): Promise<boolean> {
    try {
      const backupFile = await this.loadBackup(metadata.id);
      if (!backupFile) return false;

      return await this.verifyBackupIntegrity(backupFile, metadata);
    } catch (error) {
      console.error(`❌ Backup verification failed for ${metadata.id}:`, error);
      return false;
    }
  }

  private async verifyBackupIntegrity(backupFile: BackupFile, metadata: BackupMetadata): Promise<boolean> {
    const calculatedChecksum = await this.calculateChecksum(JSON.stringify(backupFile));
    return calculatedChecksum === metadata.checksum;
  }

  private async calculateChecksum(data: string): Promise<string> {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private async saveBackupMetadata(metadata: BackupMetadata): Promise<void> {
    const basePath = this.config.storage.local?.basePath || '/tmp/redis-backup';
    const metadataPath = path.join(basePath, `${metadata.id}.metadata.json`);
    
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
  }

  private async loadBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    try {
      const basePath = this.config.storage.local?.basePath || '/tmp/redis-backup';
      const metadataPath = path.join(basePath, `${backupId}.metadata.json`);
      
      const data = await fs.readFile(metadataPath, 'utf8');
      return JSON.parse(data) as BackupMetadata;
    } catch (error) {
      console.error(`❌ Failed to load backup metadata ${backupId}:`, error);
      return null;
    }
  }

  private async removeBackupFile(backupId: string): Promise<void> {
    const filepath = await this.getBackupFilePath(backupId);
    await fs.unlink(filepath);
  }

  private async removeBackupMetadata(backupId: string): Promise<void> {
    const basePath = this.config.storage.local?.basePath || '/tmp/redis-backup';
    const metadataPath = path.join(basePath, `${backupId}.metadata.json`);
    await fs.unlink(metadataPath);
  }

  private async cleanupOldBackups(): Promise<void> {
    const now = Date.now();
    const maxAge = this.config.retention.maxAge;
    const maxBackups = this.config.retention.maxBackups;

    // Remove backups older than maxAge
    const oldBackups = this.backupHistory.filter(backup => 
      (now - backup.timestamp) > maxAge
    );

    for (const backup of oldBackups) {
      await this.deleteBackup(backup.id);
    }

    // Remove excess backups if over maxBackups limit
    if (this.backupHistory.length > maxBackups) {
      const sortedBackups = this.backupHistory
        .sort((a, b) => a.timestamp - b.timestamp);
      
      const excessBackups = sortedBackups.slice(0, this.backupHistory.length - maxBackups);
      
      for (const backup of excessBackups) {
        await this.deleteBackup(backup.id);
      }
    }
  }

  private scheduleBackups(): void {
    if (!this.config.enabled) return;

    for (const strategy of this.config.strategies) {
      if (strategy.enabled) {
        this.scheduleStrategy(strategy);
      }
    }
  }

  private scheduleStrategy(strategy: BackupStrategy): void {
    // Simplified scheduling - would use proper cron parser in production
    const intervalMs = this.parseScheduleToInterval(strategy.schedule);
    
    if (intervalMs > 0) {
      const job = setInterval(async () => {
        try {
          await this.createBackup(strategy.name);
        } catch (error) {
          console.error(`❌ Scheduled backup failed for strategy ${strategy.name}:`, error);
        }
      }, intervalMs);

      this.scheduledJobs.set(strategy.name, job);
      console.log(`📅 Scheduled backup strategy: ${strategy.name} (every ${intervalMs}ms)`);
    }
  }

  private parseScheduleToInterval(schedule: string): number {
    // Simplified parser - would use proper cron library in production
    if (schedule === '0 2 * * *') return 24 * 60 * 60 * 1000; // Daily
    if (schedule === '0 * * * *') return 60 * 60 * 1000; // Hourly
    if (schedule === '*/5 * * * *') return 5 * 60 * 1000; // Every 5 minutes
    return 0;
  }

  /**
   * Shutdown backup manager
   */
  public shutdown(): void {
    console.log('🔄 Shutting down cache backup manager...');

    for (const job of this.scheduledJobs.values()) {
      clearInterval(job);
    }
    this.scheduledJobs.clear();

    console.log('✅ Cache backup manager shutdown complete');
  }
}

// ====================
// BACKUP PROCESS CLASS
// ====================

class BackupProcess {
  constructor(
    public id: string,
    public strategy: BackupStrategy,
    public startTime: number = Date.now()
  ) {}

  public getProgress(): number {
    // Calculate progress based on elapsed time vs estimated duration
    const elapsed = Date.now() - this.startTime;
    const estimatedDuration = this.strategy.timeout;
    return Math.min((elapsed / estimatedDuration) * 100, 100);
  }
}

// ====================
// SINGLETON INSTANCE
// ====================

export const cacheBackupManager = CacheBackupManager.getInstance();

// ====================
// CONVENIENCE FUNCTIONS
// ====================

/**
 * Create backup
 */
export async function createCacheBackup(
  strategyName?: string,
  options?: Partial<BackupStrategy>
): Promise<BackupMetadata> {
  return cacheBackupManager.createBackup(strategyName, options);
}

/**
 * Restore from backup
 */
export async function restoreCacheBackup(options: RestoreOptions): Promise<RestoreResult> {
  return cacheBackupManager.restoreFromBackup(options);
}

/**
 * List backups
 */
export async function listCacheBackups(strategyName?: string, limit?: number): Promise<BackupMetadata[]> {
  return cacheBackupManager.listBackups(strategyName, limit);
}

/**
 * Delete backup
 */
export async function deleteCacheBackup(backupId: string): Promise<boolean> {
  return cacheBackupManager.deleteBackup(backupId);
}

/**
 * Get backup statistics
 */
export function getCacheBackupStatistics() {
  return cacheBackupManager.getBackupStatistics();
}

export default cacheBackupManager;