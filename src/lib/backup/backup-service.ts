/**
 * Comprehensive Backup Service for Learning Assistant
 * Handles database backups, file system backups, encryption, compression, and cloud storage
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { createHash, createCipher, createDecipher } from 'crypto';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';

interface BackupConfig {
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  storage: {
    localPath: string;
    s3?: {
      bucket: string;
      region: string;
      accessKeyId: string;
      secretAccessKey: string;
      prefix?: string;
    };
    azure?: {
      storageAccount: string;
      accessKey: string;
      container: string;
    };
    gcs?: {
      projectId: string;
      keyFilename: string;
      bucket: string;
    };
  };
  encryption: {
    enabled: boolean;
    algorithm: string;
    keyPath: string;
    keyRotationDays: number;
  };
  compression: {
    enabled: boolean;
    level: number;
    algorithm: 'gzip' | 'brotli' | 'zstd';
  };
  retention: {
    dailyBackups: number;
    weeklyBackups: number;
    monthlyBackups: number;
    yearlyBackups: number;
  };
  monitoring: {
    enabled: boolean;
    alertsEnabled: boolean;
    metricsEndpoint?: string;
    healthCheckInterval: number;
  };
  security: {
    checksumAlgorithm: string;
    integrityCheckEnabled: boolean;
    accessControlEnabled: boolean;
  };
}

interface BackupMetadata {
  id: string;
  timestamp: Date;
  type: 'full' | 'incremental' | 'differential';
  size: number;
  compressedSize?: number;
  checksum: string;
  encrypted: boolean;
  storageLocations: string[];
  duration: number;
  status: 'success' | 'failed' | 'partial';
  error?: string;
  retentionDate: Date;
  pitrEnabled: boolean;
  schemaVersion: string;
  tags: Record<string, string>;
}

interface BackupJob {
  id: string;
  type: 'database' | 'filesystem' | 'application';
  config: Partial<BackupConfig>;
  schedule?: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  metadata?: BackupMetadata;
}

interface RestoreOptions {
  backupId: string;
  targetTimestamp?: Date;
  targetLocation?: string;
  validateOnly?: boolean;
  skipDataValidation?: boolean;
  parallelRestores?: number;
}

interface BackupStatus {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  stage: string;
  startTime: Date;
  endTime?: Date;
  error?: string;
  metadata?: Partial<BackupMetadata>;
}

export class BackupService extends EventEmitter {
  private config: BackupConfig;
  private activeJobs: Map<string, BackupStatus> = new Map();
  private backupHistory: BackupMetadata[] = [];
  private scheduledJobs: Map<string, BackupJob> = new Map();
  private encryptionKeys: Map<string, Buffer> = new Map();
  
  constructor(config: BackupConfig) {
    super();
    this.config = config;
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    try {
      // Create backup directories
      await fs.mkdir(this.config.storage.localPath, { recursive: true });
      await fs.mkdir(join(this.config.storage.localPath, 'database'), { recursive: true });
      await fs.mkdir(join(this.config.storage.localPath, 'filesystem'), { recursive: true });
      await fs.mkdir(join(this.config.storage.localPath, 'logs'), { recursive: true });
      await fs.mkdir(join(this.config.storage.localPath, 'temp'), { recursive: true });

      // Initialize encryption keys
      if (this.config.encryption.enabled) {
        await this.initializeEncryption();
      }

      // Load backup history
      await this.loadBackupHistory();

      // Start monitoring if enabled
      if (this.config.monitoring.enabled) {
        this.startMonitoring();
      }

      this.emit('service:initialized');
    } catch (error) {
      this.emit('service:error', error);
      throw error;
    }
  }

  private async initializeEncryption(): Promise<void> {
    try {
      const keyPath = this.config.encryption.keyPath;
      
      // Check if key file exists
      try {
        const keyData = await fs.readFile(keyPath);
        this.encryptionKeys.set('primary', keyData);
      } catch (error) {
        // Generate new key if not exists
        const key = Buffer.from(require('crypto').randomBytes(32));
        await fs.writeFile(keyPath, key);
        await fs.chmod(keyPath, 0o600);
        this.encryptionKeys.set('primary', key);
      }

      // Schedule key rotation
      setInterval(async () => {
        await this.rotateEncryptionKey();
      }, this.config.encryption.keyRotationDays * 24 * 60 * 60 * 1000);

    } catch (error) {
      throw new Error(`Encryption initialization failed: ${error.message}`);
    }
  }

  private async rotateEncryptionKey(): Promise<void> {
    try {
      const newKey = Buffer.from(require('crypto').randomBytes(32));
      const timestamp = Date.now();
      
      // Store old key for decryption of existing backups
      this.encryptionKeys.set(`backup-${timestamp}`, this.encryptionKeys.get('primary')!);
      
      // Set new primary key
      this.encryptionKeys.set('primary', newKey);
      
      // Update key file
      await fs.writeFile(this.config.encryption.keyPath, newKey);
      
      // Clean up old keys (keep last 5 rotations)
      const keyEntries = Array.from(this.encryptionKeys.entries());
      const backupKeys = keyEntries.filter(([key]) => key.startsWith('backup-'));
      
      if (backupKeys.length > 5) {
        backupKeys.sort((a, b) => parseInt(a[0].split('-')[1]) - parseInt(b[0].split('-')[1]));
        const keysToRemove = backupKeys.slice(0, backupKeys.length - 5);
        keysToRemove.forEach(([key]) => this.encryptionKeys.delete(key));
      }

      this.emit('encryption:key-rotated', { timestamp });
    } catch (error) {
      this.emit('encryption:key-rotation-failed', error);
      throw error;
    }
  }

  private async loadBackupHistory(): Promise<void> {
    try {
      const historyPath = join(this.config.storage.localPath, 'backup-history.json');
      const data = await fs.readFile(historyPath, 'utf8');
      this.backupHistory = JSON.parse(data);
    } catch (error) {
      // Initialize empty history if file doesn't exist
      this.backupHistory = [];
    }
  }

  private async saveBackupHistory(): Promise<void> {
    try {
      const historyPath = join(this.config.storage.localPath, 'backup-history.json');
      await fs.writeFile(historyPath, JSON.stringify(this.backupHistory, null, 2));
    } catch (error) {
      this.emit('backup:history-save-failed', error);
    }
  }

  private startMonitoring(): Promise<void> {
    // Start health check monitoring
    setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.monitoring.healthCheckInterval);

    // Monitor active jobs
    setInterval(() => {
      this.monitorActiveJobs();
    }, 30000); // Check every 30 seconds

    return Promise.resolve();
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const healthStatus = {
        timestamp: new Date(),
        service: 'backup-service',
        status: 'healthy',
        checks: {
          diskSpace: await this.checkDiskSpace(),
          databaseConnectivity: await this.checkDatabaseConnectivity(),
          cloudStorage: await this.checkCloudStorageConnectivity(),
          encryption: this.checkEncryptionStatus(),
          activeJobs: this.activeJobs.size,
          lastBackup: this.getLastBackupStatus()
        }
      };

      // Emit health status
      this.emit('health:status', healthStatus);

      // Send to monitoring endpoint if configured
      if (this.config.monitoring.metricsEndpoint) {
        await this.sendHealthMetrics(healthStatus);
      }
    } catch (error) {
      this.emit('health:check-failed', error);
    }
  }

  private async checkDiskSpace(): Promise<{ available: number; total: number; percentage: number }> {
    const { execSync } = require('child_process');
    const output = execSync(`df -h ${this.config.storage.localPath}`).toString();
    const lines = output.split('\n');
    const data = lines[1].split(/\s+/);
    
    const total = this.parseSize(data[1]);
    const available = this.parseSize(data[3]);
    const percentage = (available / total) * 100;
    
    return { available, total, percentage };
  }

  private parseSize(sizeStr: string): number {
    const units = { 'K': 1024, 'M': 1024**2, 'G': 1024**3, 'T': 1024**4 };
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)(K|M|G|T)?$/);
    if (!match) return 0;
    
    const size = parseFloat(match[1]);
    const unit = match[2] || '';
    return size * (units[unit] || 1);
  }

  private async checkDatabaseConnectivity(): Promise<boolean> {
    try {
      const { Client } = require('pg');
      const client = new Client({
        host: this.config.database.host,
        port: this.config.database.port,
        database: this.config.database.name,
        user: this.config.database.user,
        password: this.config.database.password,
        connectionTimeoutMillis: 5000,
      });

      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkCloudStorageConnectivity(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    // Check S3 connectivity
    if (this.config.storage.s3) {
      try {
        const AWS = require('aws-sdk');
        const s3 = new AWS.S3({
          accessKeyId: this.config.storage.s3.accessKeyId,
          secretAccessKey: this.config.storage.s3.secretAccessKey,
          region: this.config.storage.s3.region,
        });
        
        await s3.headBucket({ Bucket: this.config.storage.s3.bucket }).promise();
        results.s3 = true;
      } catch (error) {
        results.s3 = false;
      }
    }

    // Check Azure connectivity
    if (this.config.storage.azure) {
      try {
        const { BlobServiceClient } = require('@azure/storage-blob');
        const blobServiceClient = BlobServiceClient.fromConnectionString(
          `DefaultEndpointsProtocol=https;AccountName=${this.config.storage.azure.storageAccount};AccountKey=${this.config.storage.azure.accessKey};EndpointSuffix=core.windows.net`
        );
        
        await blobServiceClient.getContainerClient(this.config.storage.azure.container).getProperties();
        results.azure = true;
      } catch (error) {
        results.azure = false;
      }
    }

    // Check GCS connectivity
    if (this.config.storage.gcs) {
      try {
        const { Storage } = require('@google-cloud/storage');
        const storage = new Storage({
          projectId: this.config.storage.gcs.projectId,
          keyFilename: this.config.storage.gcs.keyFilename,
        });
        
        await storage.bucket(this.config.storage.gcs.bucket).getMetadata();
        results.gcs = true;
      } catch (error) {
        results.gcs = false;
      }
    }

    return results;
  }

  private checkEncryptionStatus(): boolean {
    return this.config.encryption.enabled && this.encryptionKeys.has('primary');
  }

  private getLastBackupStatus(): { timestamp?: Date; status?: string; size?: number } {
    const lastBackup = this.backupHistory[this.backupHistory.length - 1];
    return lastBackup ? {
      timestamp: new Date(lastBackup.timestamp),
      status: lastBackup.status,
      size: lastBackup.size
    } : {};
  }

  private async sendHealthMetrics(healthStatus: any): Promise<void> {
    try {
      const response = await fetch(this.config.monitoring.metricsEndpoint!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(healthStatus),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      this.emit('monitoring:metrics-send-failed', error);
    }
  }

  private monitorActiveJobs(): void {
    const now = Date.now();
    const staleJobTimeout = 30 * 60 * 1000; // 30 minutes

    for (const [jobId, job] of this.activeJobs.entries()) {
      const jobAge = now - job.startTime.getTime();
      
      if (jobAge > staleJobTimeout && job.status === 'running') {
        job.status = 'failed';
        job.error = 'Job timeout - exceeded maximum execution time';
        job.endTime = new Date();
        
        this.emit('job:timeout', { jobId, job });
      }
    }
  }

  /**
   * Create a database backup
   */
  public async createDatabaseBackup(options: {
    type?: 'full' | 'incremental' | 'differential';
    tags?: Record<string, string>;
    retention?: Partial<BackupConfig['retention']>;
  } = {}): Promise<string> {
    const jobId = `db-backup-${Date.now()}`;
    const backupType = options.type || 'full';
    
    const job: BackupStatus = {
      jobId,
      status: 'queued',
      progress: 0,
      stage: 'initialization',
      startTime: new Date(),
    };

    this.activeJobs.set(jobId, job);
    this.emit('job:started', { jobId, job });

    try {
      // Update job status
      job.status = 'running';
      job.stage = 'preparing';
      job.progress = 5;
      this.emit('job:progress', { jobId, job });

      // Generate backup metadata
      const backupId = `${backupType}-${Date.now()}`;
      const timestamp = new Date();
      const backupPath = join(this.config.storage.localPath, 'database', `${backupId}.backup`);

      // Create database backup
      job.stage = 'dumping';
      job.progress = 20;
      this.emit('job:progress', { jobId, job });

      const dumpCommand = this.buildDumpCommand(backupPath, backupType);
      const dumpResult = await this.executeCommand(dumpCommand);

      if (dumpResult.code !== 0) {
        throw new Error(`Database dump failed: ${dumpResult.stderr}`);
      }

      // Get backup size
      const stats = await fs.stat(backupPath);
      const originalSize = stats.size;

      // Compress backup if enabled
      let compressedSize = originalSize;
      let finalPath = backupPath;

      if (this.config.compression.enabled) {
        job.stage = 'compressing';
        job.progress = 40;
        this.emit('job:progress', { jobId, job });

        const compressedPath = `${backupPath}.gz`;
        await this.compressFile(backupPath, compressedPath);
        
        const compressedStats = await fs.stat(compressedPath);
        compressedSize = compressedStats.size;
        
        // Remove original file
        await fs.unlink(backupPath);
        finalPath = compressedPath;
      }

      // Encrypt backup if enabled
      if (this.config.encryption.enabled) {
        job.stage = 'encrypting';
        job.progress = 60;
        this.emit('job:progress', { jobId, job });

        const encryptedPath = `${finalPath}.enc`;
        await this.encryptFile(finalPath, encryptedPath);
        
        // Remove unencrypted file
        await fs.unlink(finalPath);
        finalPath = encryptedPath;
      }

      // Calculate checksum
      job.stage = 'validating';
      job.progress = 70;
      this.emit('job:progress', { jobId, job });

      const checksum = await this.calculateChecksum(finalPath);

      // Upload to cloud storage
      const storageLocations: string[] = [finalPath];
      
      if (this.config.storage.s3 || this.config.storage.azure || this.config.storage.gcs) {
        job.stage = 'uploading';
        job.progress = 80;
        this.emit('job:progress', { jobId, job });

        const cloudLocations = await this.uploadToCloudStorage(finalPath, backupId);
        storageLocations.push(...cloudLocations);
      }

      // Create backup metadata
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp,
        type: backupType,
        size: originalSize,
        compressedSize: this.config.compression.enabled ? compressedSize : undefined,
        checksum,
        encrypted: this.config.encryption.enabled,
        storageLocations,
        duration: Date.now() - job.startTime.getTime(),
        status: 'success',
        retentionDate: this.calculateRetentionDate(timestamp, backupType),
        pitrEnabled: backupType === 'full',
        schemaVersion: await this.getDatabaseSchemaVersion(),
        tags: options.tags || {},
      };

      // Save metadata
      this.backupHistory.push(metadata);
      await this.saveBackupHistory();

      // Update job status
      job.status = 'completed';
      job.progress = 100;
      job.stage = 'completed';
      job.endTime = new Date();
      job.metadata = metadata;
      this.emit('job:completed', { jobId, job });

      // Clean up old backups
      await this.cleanupOldBackups();

      return backupId;

    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.endTime = new Date();
      this.emit('job:failed', { jobId, job, error });
      throw error;
    } finally {
      // Keep job in memory for a while for status queries
      setTimeout(() => {
        this.activeJobs.delete(jobId);
      }, 5 * 60 * 1000); // 5 minutes
    }
  }

  private buildDumpCommand(backupPath: string, backupType: string): string {
    const { database } = this.config;
    
    let command = `pg_dump -h ${database.host} -p ${database.port} -U ${database.user} -d ${database.name}`;
    command += ` --format=custom --verbose --no-owner --no-privileges`;
    command += ` --file="${backupPath}"`;
    
    if (backupType === 'full') {
      command += ' --jobs=4'; // Parallel jobs for faster backup
    }
    
    return command;
  }

  private async executeCommand(command: string): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const process = spawn('bash', ['-c', command], {
        env: {
          ...process.env,
          PGPASSWORD: this.config.database.password,
        },
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        resolve({ code: code || 0, stdout, stderr });
      });
    });
  }

  private async compressFile(inputPath: string, outputPath: string): Promise<void> {
    const input = createReadStream(inputPath);
    const output = createWriteStream(outputPath);
    const gzip = createGzip({ level: this.config.compression.level });

    await pipeline(input, gzip, output);
  }

  private async encryptFile(inputPath: string, outputPath: string): Promise<void> {
    const input = createReadStream(inputPath);
    const output = createWriteStream(outputPath);
    
    const key = this.encryptionKeys.get('primary')!;
    const cipher = createCipher(this.config.encryption.algorithm, key);

    await pipeline(input, cipher, output);
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const hash = createHash(this.config.security.checksumAlgorithm);
    const stream = createReadStream(filePath);

    return new Promise((resolve, reject) => {
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private async uploadToCloudStorage(filePath: string, backupId: string): Promise<string[]> {
    const locations: string[] = [];
    
    // Upload to S3
    if (this.config.storage.s3) {
      const s3Location = await this.uploadToS3(filePath, backupId);
      locations.push(s3Location);
    }

    // Upload to Azure
    if (this.config.storage.azure) {
      const azureLocation = await this.uploadToAzure(filePath, backupId);
      locations.push(azureLocation);
    }

    // Upload to GCS
    if (this.config.storage.gcs) {
      const gcsLocation = await this.uploadToGCS(filePath, backupId);
      locations.push(gcsLocation);
    }

    return locations;
  }

  private async uploadToS3(filePath: string, backupId: string): Promise<string> {
    const AWS = require('aws-sdk');
    const s3 = new AWS.S3({
      accessKeyId: this.config.storage.s3!.accessKeyId,
      secretAccessKey: this.config.storage.s3!.secretAccessKey,
      region: this.config.storage.s3!.region,
    });

    const fileName = `${this.config.storage.s3!.prefix || ''}${backupId}.backup`;
    const fileStream = createReadStream(filePath);

    await s3.upload({
      Bucket: this.config.storage.s3!.bucket,
      Key: fileName,
      Body: fileStream,
      StorageClass: 'STANDARD_IA',
    }).promise();

    return `s3://${this.config.storage.s3!.bucket}/${fileName}`;
  }

  private async uploadToAzure(filePath: string, backupId: string): Promise<string> {
    const { BlobServiceClient } = require('@azure/storage-blob');
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      `DefaultEndpointsProtocol=https;AccountName=${this.config.storage.azure!.storageAccount};AccountKey=${this.config.storage.azure!.accessKey};EndpointSuffix=core.windows.net`
    );

    const containerClient = blobServiceClient.getContainerClient(this.config.storage.azure!.container);
    const blobName = `${backupId}.backup`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadFile(filePath, {
      tier: 'Cool',
    });

    return `azure://${this.config.storage.azure!.storageAccount}/${this.config.storage.azure!.container}/${blobName}`;
  }

  private async uploadToGCS(filePath: string, backupId: string): Promise<string> {
    const { Storage } = require('@google-cloud/storage');
    const storage = new Storage({
      projectId: this.config.storage.gcs!.projectId,
      keyFilename: this.config.storage.gcs!.keyFilename,
    });

    const bucket = storage.bucket(this.config.storage.gcs!.bucket);
    const fileName = `${backupId}.backup`;
    const file = bucket.file(fileName);

    await bucket.upload(filePath, {
      destination: fileName,
      metadata: {
        cacheControl: 'no-cache',
        metadata: {
          backupId,
          timestamp: new Date().toISOString(),
        },
      },
    });

    return `gs://${this.config.storage.gcs!.bucket}/${fileName}`;
  }

  private async getDatabaseSchemaVersion(): Promise<string> {
    try {
      const { Client } = require('pg');
      const client = new Client({
        host: this.config.database.host,
        port: this.config.database.port,
        database: this.config.database.name,
        user: this.config.database.user,
        password: this.config.database.password,
      });

      await client.connect();
      const result = await client.query('SELECT version()');
      await client.end();
      
      return result.rows[0].version;
    } catch (error) {
      return 'unknown';
    }
  }

  private calculateRetentionDate(timestamp: Date, backupType: string): Date {
    const retention = this.config.retention;
    const retentionDate = new Date(timestamp);
    
    switch (backupType) {
      case 'full':
        retentionDate.setDate(retentionDate.getDate() + retention.monthlyBackups * 30);
        break;
      case 'incremental':
        retentionDate.setDate(retentionDate.getDate() + retention.dailyBackups);
        break;
      case 'differential':
        retentionDate.setDate(retentionDate.getDate() + retention.weeklyBackups * 7);
        break;
    }
    
    return retentionDate;
  }

  private async cleanupOldBackups(): Promise<void> {
    const now = new Date();
    const expiredBackups = this.backupHistory.filter(backup => backup.retentionDate < now);
    
    for (const backup of expiredBackups) {
      try {
        // Remove local files
        for (const location of backup.storageLocations) {
          if (location.startsWith('/')) {
            await fs.unlink(location).catch(() => {}); // Ignore errors
          }
        }
        
        // Remove from cloud storage
        await this.removeFromCloudStorage(backup);
        
        // Remove from history
        const index = this.backupHistory.indexOf(backup);
        if (index > -1) {
          this.backupHistory.splice(index, 1);
        }
        
        this.emit('backup:cleanup', { backupId: backup.id });
      } catch (error) {
        this.emit('backup:cleanup-failed', { backupId: backup.id, error });
      }
    }
    
    await this.saveBackupHistory();
  }

  private async removeFromCloudStorage(backup: BackupMetadata): Promise<void> {
    // Remove from S3
    if (this.config.storage.s3) {
      const s3Locations = backup.storageLocations.filter(loc => loc.startsWith('s3://'));
      for (const location of s3Locations) {
        await this.removeFromS3(location);
      }
    }

    // Remove from Azure
    if (this.config.storage.azure) {
      const azureLocations = backup.storageLocations.filter(loc => loc.startsWith('azure://'));
      for (const location of azureLocations) {
        await this.removeFromAzure(location);
      }
    }

    // Remove from GCS
    if (this.config.storage.gcs) {
      const gcsLocations = backup.storageLocations.filter(loc => loc.startsWith('gs://'));
      for (const location of gcsLocations) {
        await this.removeFromGCS(location);
      }
    }
  }

  private async removeFromS3(location: string): Promise<void> {
    try {
      const AWS = require('aws-sdk');
      const s3 = new AWS.S3({
        accessKeyId: this.config.storage.s3!.accessKeyId,
        secretAccessKey: this.config.storage.s3!.secretAccessKey,
        region: this.config.storage.s3!.region,
      });

      const url = new URL(location);
      const bucket = url.hostname;
      const key = url.pathname.substring(1);

      await s3.deleteObject({ Bucket: bucket, Key: key }).promise();
    } catch (error) {
      this.emit('cloud:s3-delete-failed', { location, error });
    }
  }

  private async removeFromAzure(location: string): Promise<void> {
    try {
      const { BlobServiceClient } = require('@azure/storage-blob');
      const blobServiceClient = BlobServiceClient.fromConnectionString(
        `DefaultEndpointsProtocol=https;AccountName=${this.config.storage.azure!.storageAccount};AccountKey=${this.config.storage.azure!.accessKey};EndpointSuffix=core.windows.net`
      );

      // Parse azure://account/container/blob
      const parts = location.replace('azure://', '').split('/');
      const containerName = parts[1];
      const blobName = parts[2];

      const containerClient = blobServiceClient.getContainerClient(containerName);
      await containerClient.deleteBlob(blobName);
    } catch (error) {
      this.emit('cloud:azure-delete-failed', { location, error });
    }
  }

  private async removeFromGCS(location: string): Promise<void> {
    try {
      const { Storage } = require('@google-cloud/storage');
      const storage = new Storage({
        projectId: this.config.storage.gcs!.projectId,
        keyFilename: this.config.storage.gcs!.keyFilename,
      });

      const url = new URL(location);
      const bucketName = url.hostname;
      const fileName = url.pathname.substring(1);

      const bucket = storage.bucket(bucketName);
      await bucket.file(fileName).delete();
    } catch (error) {
      this.emit('cloud:gcs-delete-failed', { location, error });
    }
  }

  /**
   * Restore from backup
   */
  public async restoreFromBackup(backupId: string, options: RestoreOptions = {}): Promise<void> {
    const backup = this.backupHistory.find(b => b.id === backupId);
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    const jobId = `restore-${Date.now()}`;
    const job: BackupStatus = {
      jobId,
      status: 'running',
      progress: 0,
      stage: 'preparing',
      startTime: new Date(),
    };

    this.activeJobs.set(jobId, job);
    this.emit('job:started', { jobId, job });

    try {
      // Download backup from cloud if needed
      job.stage = 'downloading';
      job.progress = 10;
      this.emit('job:progress', { jobId, job });

      const localPath = await this.ensureLocalBackup(backup);

      // Decrypt if needed
      if (backup.encrypted) {
        job.stage = 'decrypting';
        job.progress = 30;
        this.emit('job:progress', { jobId, job });

        const decryptedPath = await this.decryptBackup(localPath, backup);
        localPath = decryptedPath;
      }

      // Decompress if needed
      if (backup.compressedSize) {
        job.stage = 'decompressing';
        job.progress = 50;
        this.emit('job:progress', { jobId, job });

        const decompressedPath = await this.decompressBackup(localPath);
        localPath = decompressedPath;
      }

      // Validate backup integrity
      if (this.config.security.integrityCheckEnabled && !options.skipDataValidation) {
        job.stage = 'validating';
        job.progress = 70;
        this.emit('job:progress', { jobId, job });

        const isValid = await this.validateBackupIntegrity(localPath, backup);
        if (!isValid) {
          throw new Error('Backup integrity validation failed');
        }
      }

      if (options.validateOnly) {
        job.status = 'completed';
        job.progress = 100;
        job.stage = 'validated';
        job.endTime = new Date();
        this.emit('job:completed', { jobId, job });
        return;
      }

      // Restore database
      job.stage = 'restoring';
      job.progress = 80;
      this.emit('job:progress', { jobId, job });

      await this.restoreDatabase(localPath, options);

      job.status = 'completed';
      job.progress = 100;
      job.stage = 'completed';
      job.endTime = new Date();
      this.emit('job:completed', { jobId, job });

    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.endTime = new Date();
      this.emit('job:failed', { jobId, job, error });
      throw error;
    } finally {
      setTimeout(() => {
        this.activeJobs.delete(jobId);
      }, 5 * 60 * 1000);
    }
  }

  private async ensureLocalBackup(backup: BackupMetadata): Promise<string> {
    // Check if backup exists locally
    const localLocation = backup.storageLocations.find(loc => loc.startsWith('/'));
    if (localLocation) {
      try {
        await fs.access(localLocation);
        return localLocation;
      } catch (error) {
        // Local file doesn't exist, download from cloud
      }
    }

    // Download from cloud storage
    const cloudLocation = backup.storageLocations.find(loc => 
      loc.startsWith('s3://') || loc.startsWith('azure://') || loc.startsWith('gs://')
    );

    if (!cloudLocation) {
      throw new Error('No available backup location found');
    }

    const localPath = join(this.config.storage.localPath, 'temp', `${backup.id}.backup`);
    
    if (cloudLocation.startsWith('s3://')) {
      await this.downloadFromS3(cloudLocation, localPath);
    } else if (cloudLocation.startsWith('azure://')) {
      await this.downloadFromAzure(cloudLocation, localPath);
    } else if (cloudLocation.startsWith('gs://')) {
      await this.downloadFromGCS(cloudLocation, localPath);
    }

    return localPath;
  }

  private async downloadFromS3(location: string, localPath: string): Promise<void> {
    const AWS = require('aws-sdk');
    const s3 = new AWS.S3({
      accessKeyId: this.config.storage.s3!.accessKeyId,
      secretAccessKey: this.config.storage.s3!.secretAccessKey,
      region: this.config.storage.s3!.region,
    });

    const url = new URL(location);
    const bucket = url.hostname;
    const key = url.pathname.substring(1);

    const object = await s3.getObject({ Bucket: bucket, Key: key }).promise();
    await fs.writeFile(localPath, object.Body);
  }

  private async downloadFromAzure(location: string, localPath: string): Promise<void> {
    const { BlobServiceClient } = require('@azure/storage-blob');
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      `DefaultEndpointsProtocol=https;AccountName=${this.config.storage.azure!.storageAccount};AccountKey=${this.config.storage.azure!.accessKey};EndpointSuffix=core.windows.net`
    );

    const parts = location.replace('azure://', '').split('/');
    const containerName = parts[1];
    const blobName = parts[2];

    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);

    await blobClient.downloadToFile(localPath);
  }

  private async downloadFromGCS(location: string, localPath: string): Promise<void> {
    const { Storage } = require('@google-cloud/storage');
    const storage = new Storage({
      projectId: this.config.storage.gcs!.projectId,
      keyFilename: this.config.storage.gcs!.keyFilename,
    });

    const url = new URL(location);
    const bucketName = url.hostname;
    const fileName = url.pathname.substring(1);

    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);

    await file.download({ destination: localPath });
  }

  private async decryptBackup(encryptedPath: string, backup: BackupMetadata): Promise<string> {
    const decryptedPath = `${encryptedPath}.decrypted`;
    const input = createReadStream(encryptedPath);
    const output = createWriteStream(decryptedPath);

    // Find the appropriate decryption key
    const key = this.findDecryptionKey(backup.timestamp);
    if (!key) {
      throw new Error('Decryption key not found for backup');
    }

    const decipher = createDecipher(this.config.encryption.algorithm, key);
    await pipeline(input, decipher, output);

    return decryptedPath;
  }

  private findDecryptionKey(backupTimestamp: Date): Buffer | null {
    // Try primary key first
    const primaryKey = this.encryptionKeys.get('primary');
    if (primaryKey) {
      return primaryKey;
    }

    // Try backup keys
    const backupKeys = Array.from(this.encryptionKeys.entries())
      .filter(([key]) => key.startsWith('backup-'))
      .sort((a, b) => parseInt(b[0].split('-')[1]) - parseInt(a[0].split('-')[1]));

    for (const [, key] of backupKeys) {
      return key; // Return the first (most recent) backup key
    }

    return null;
  }

  private async decompressBackup(compressedPath: string): Promise<string> {
    const decompressedPath = compressedPath.replace('.gz', '');
    const input = createReadStream(compressedPath);
    const output = createWriteStream(decompressedPath);
    const gunzip = createGunzip();

    await pipeline(input, gunzip, output);
    return decompressedPath;
  }

  private async validateBackupIntegrity(backupPath: string, backup: BackupMetadata): Promise<boolean> {
    const checksum = await this.calculateChecksum(backupPath);
    return checksum === backup.checksum;
  }

  private async restoreDatabase(backupPath: string, options: RestoreOptions): Promise<void> {
    const { database } = this.config;
    const targetDb = options.targetLocation || database.name;
    
    const restoreCommand = `pg_restore -h ${database.host} -p ${database.port} -U ${database.user} -d ${targetDb} --clean --if-exists --jobs=${options.parallelRestores || 4} "${backupPath}"`;
    
    const result = await this.executeCommand(restoreCommand);
    
    if (result.code !== 0) {
      throw new Error(`Database restore failed: ${result.stderr}`);
    }
  }

  /**
   * List available backups
   */
  public listBackups(filters?: {
    type?: 'full' | 'incremental' | 'differential';
    dateRange?: { start: Date; end: Date };
    status?: 'success' | 'failed' | 'partial';
  }): BackupMetadata[] {
    let backups = [...this.backupHistory];

    if (filters) {
      if (filters.type) {
        backups = backups.filter(b => b.type === filters.type);
      }
      if (filters.dateRange) {
        backups = backups.filter(b => 
          b.timestamp >= filters.dateRange!.start && 
          b.timestamp <= filters.dateRange!.end
        );
      }
      if (filters.status) {
        backups = backups.filter(b => b.status === filters.status);
      }
    }

    return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get backup job status
   */
  public getJobStatus(jobId: string): BackupStatus | undefined {
    return this.activeJobs.get(jobId);
  }

  /**
   * Get service health status
   */
  public async getHealthStatus(): Promise<any> {
    return {
      service: 'backup-service',
      status: 'healthy',
      timestamp: new Date(),
      activeJobs: this.activeJobs.size,
      totalBackups: this.backupHistory.length,
      lastBackup: this.getLastBackupStatus(),
      diskSpace: await this.checkDiskSpace(),
      cloudStorage: await this.checkCloudStorageConnectivity(),
    };
  }

  /**
   * Schedule backup job
   */
  public scheduleBackup(job: BackupJob): void {
    this.scheduledJobs.set(job.id, job);
    this.emit('job:scheduled', { jobId: job.id, job });
  }

  /**
   * Cancel backup job
   */
  public cancelJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (job && job.status === 'running') {
      job.status = 'cancelled';
      job.endTime = new Date();
      this.emit('job:cancelled', { jobId, job });
      return true;
    }
    return false;
  }

  /**
   * Export backup metadata
   */
  public exportBackupMetadata(): BackupMetadata[] {
    return JSON.parse(JSON.stringify(this.backupHistory));
  }

  /**
   * Import backup metadata
   */
  public async importBackupMetadata(metadata: BackupMetadata[]): Promise<void> {
    this.backupHistory = metadata;
    await this.saveBackupHistory();
    this.emit('metadata:imported', { count: metadata.length });
  }
}

export { BackupConfig, BackupMetadata, BackupJob, RestoreOptions, BackupStatus };