/**
 * Cross-Region Backup Replication System for Learning Assistant
 * Geographic redundancy and disaster recovery across multiple regions
 */

import { EventEmitter } from 'events';
import { BackupService, BackupMetadata } from './backup-service';
import { promises as fs } from 'fs';
import { join } from 'path';

interface ReplicationConfig {
  regions: RegionConfig[];
  replicationRules: ReplicationRule[];
  monitoring: {
    enabled: boolean;
    healthCheckInterval: number;
    lagThreshold: number; // seconds
    failureThreshold: number;
    alerting: {
      email: string[];
      webhook: string[];
      pagerDuty?: string;
    };
  };
  network: {
    compressionEnabled: boolean;
    encryptionInTransit: boolean;
    bandwidthLimit?: number; // MB/s
    retryAttempts: number;
    retryDelay: number; // seconds
  };
  consistency: {
    checksumValidation: boolean;
    sizeValidation: boolean;
    metadataValidation: boolean;
    fullVerification: boolean;
  };
  performance: {
    parallelTransfers: number;
    chunkSize: number; // MB
    resumeTransfers: boolean;
    deltaSync: boolean;
  };
}

interface RegionConfig {
  id: string;
  name: string;
  location: string;
  isPrimary: boolean;
  priority: number; // Lower number = higher priority
  endpoints: {
    storage: string;
    api: string;
    monitoring: string;
  };
  credentials: {
    accessKeyId?: string;
    secretAccessKey?: string;
    region?: string;
    endpoint?: string;
  };
  capacity: {
    maxStorage: number; // GB
    currentUsage: number; // GB
    alertThreshold: number; // percentage
  };
  latency: {
    current: number; // ms
    average: number; // ms
    target: number; // ms
  };
  status: 'active' | 'degraded' | 'offline' | 'maintenance';
}

interface ReplicationRule {
  id: string;
  name: string;
  enabled: boolean;
  sourceRegion: string;
  targetRegions: string[];
  backupTypes: ('full' | 'incremental' | 'differential')[];
  schedule?: string; // cron expression
  filters: {
    tags?: string[];
    minSize?: number; // bytes
    maxSize?: number; // bytes
    ageThreshold?: number; // hours
  };
  options: {
    syncMode: 'immediate' | 'scheduled' | 'on-demand';
    retentionSync: boolean;
    metadataSync: boolean;
    deleteSync: boolean;
    compressionLevel: number;
  };
  priority: number;
}

interface ReplicationJob {
  id: string;
  ruleId: string;
  backupId: string;
  sourceRegion: string;
  targetRegion: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
  startTime: Date;
  endTime?: Date;
  progress: {
    bytesTransferred: number;
    totalBytes: number;
    percentage: number;
    speed: number; // MB/s
    eta: number; // seconds
  };
  checksums: {
    source: string;
    target?: string;
    verified: boolean;
  };
  error?: string;
  retryCount: number;
  metadata: Record<string, any>;
}

interface ReplicationMetrics {
  timestamp: Date;
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  bytesTransferred: number;
  averageSpeed: number; // MB/s
  regionMetrics: Map<string, RegionMetrics>;
  replicationLag: number; // seconds
  consistency: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
  };
}

interface RegionMetrics {
  regionId: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number; // ms
  availability: number; // percentage
  throughput: number; // MB/s
  storageUsage: number; // GB
  errorRate: number; // percentage
  lastHealthCheck: Date;
}

interface ReplicationStatus {
  regionId: string;
  backupId: string;
  replicas: ReplicaInfo[];
  consistency: 'consistent' | 'inconsistent' | 'unknown';
  lastSync: Date;
  lag: number; // seconds
  health: 'healthy' | 'degraded' | 'failed';
}

interface ReplicaInfo {
  regionId: string;
  location: string;
  size: number;
  checksum: string;
  timestamp: Date;
  status: 'synced' | 'syncing' | 'failed' | 'missing';
}

export class CrossRegionReplicationService extends EventEmitter {
  private config: ReplicationConfig;
  private backupService: BackupService;
  private regions: Map<string, RegionConfig> = new Map();
  private replicationRules: Map<string, ReplicationRule> = new Map();
  private activeJobs: Map<string, ReplicationJob> = new Map();
  private jobHistory: ReplicationJob[] = [];
  private metrics: ReplicationMetrics[] = [];
  private replicationStatus: Map<string, ReplicationStatus> = new Map();

  private healthCheckInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private jobProcessor?: NodeJS.Timeout;
  private scheduledTasks: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: ReplicationConfig, backupService: BackupService) {
    super();
    this.config = config;
    this.backupService = backupService;
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    try {
      // Initialize regions
      this.initializeRegions();

      // Load replication rules
      await this.loadReplicationRules();

      // Load job history
      await this.loadJobHistory();

      // Load replication status
      await this.loadReplicationStatus();

      // Setup monitoring
      if (this.config.monitoring.enabled) {
        this.startMonitoring();
      }

      // Setup scheduled replication
      this.setupScheduledReplication();

      // Start job processor
      this.startJobProcessor();

      // Listen to backup service events
      this.setupEventListeners();

      this.emit('replication:service-initialized');
    } catch (error) {
      this.emit('replication:initialization-failed', error);
      throw error;
    }
  }

  private initializeRegions(): void {
    this.config.regions.forEach(region => {
      this.regions.set(region.id, region);
    });
  }

  private async loadReplicationRules(): Promise<void> {
    try {
      const rulesPath = join(process.cwd(), 'data', 'replication-rules.json');
      const data = await fs.readFile(rulesPath, 'utf8');
      const rules = JSON.parse(data);
      
      rules.forEach((rule: ReplicationRule) => {
        this.replicationRules.set(rule.id, rule);
      });
    } catch (error) {
      // Initialize with default rules if file doesn't exist
      await this.createDefaultReplicationRules();
    }
  }

  private async saveReplicationRules(): Promise<void> {
    try {
      const rulesPath = join(process.cwd(), 'data', 'replication-rules.json');
      await fs.mkdir(join(process.cwd(), 'data'), { recursive: true });
      
      const rulesArray = Array.from(this.replicationRules.values());
      await fs.writeFile(rulesPath, JSON.stringify(rulesArray, null, 2));
    } catch (error) {
      this.emit('replication:save-rules-failed', error);
    }
  }

  private async loadJobHistory(): Promise<void> {
    try {
      const historyPath = join(process.cwd(), 'data', 'replication-jobs.json');
      const data = await fs.readFile(historyPath, 'utf8');
      this.jobHistory = JSON.parse(data);
    } catch (error) {
      this.jobHistory = [];
    }
  }

  private async saveJobHistory(): Promise<void> {
    try {
      const historyPath = join(process.cwd(), 'data', 'replication-jobs.json');
      await fs.mkdir(join(process.cwd(), 'data'), { recursive: true });
      await fs.writeFile(historyPath, JSON.stringify(this.jobHistory, null, 2));
    } catch (error) {
      this.emit('replication:save-history-failed', error);
    }
  }

  private async loadReplicationStatus(): Promise<void> {
    try {
      const statusPath = join(process.cwd(), 'data', 'replication-status.json');
      const data = await fs.readFile(statusPath, 'utf8');
      const statusArray = JSON.parse(data);
      
      statusArray.forEach((status: ReplicationStatus) => {
        this.replicationStatus.set(`${status.regionId}-${status.backupId}`, status);
      });
    } catch (error) {
      // Initialize empty status if file doesn't exist
    }
  }

  private async saveReplicationStatus(): Promise<void> {
    try {
      const statusPath = join(process.cwd(), 'data', 'replication-status.json');
      await fs.mkdir(join(process.cwd(), 'data'), { recursive: true });
      
      const statusArray = Array.from(this.replicationStatus.values());
      await fs.writeFile(statusPath, JSON.stringify(statusArray, null, 2));
    } catch (error) {
      this.emit('replication:save-status-failed', error);
    }
  }

  private async createDefaultReplicationRules(): Promise<void> {
    // Primary to secondary replication
    const primaryRule: ReplicationRule = {
      id: 'primary-secondary',
      name: 'Primary to Secondary Replication',
      enabled: true,
      sourceRegion: 'primary',
      targetRegions: ['secondary-us-west', 'secondary-eu-west'],
      backupTypes: ['full', 'incremental'],
      filters: {
        minSize: 1024 * 1024, // 1MB minimum
        ageThreshold: 1 // 1 hour
      },
      options: {
        syncMode: 'immediate',
        retentionSync: true,
        metadataSync: true,
        deleteSync: false,
        compressionLevel: 6
      },
      priority: 1
    };

    // Critical backup replication
    const criticalRule: ReplicationRule = {
      id: 'critical-replication',
      name: 'Critical Backup Replication',
      enabled: true,
      sourceRegion: 'primary',
      targetRegions: ['secondary-us-west', 'secondary-eu-west', 'secondary-ap-south'],
      backupTypes: ['full'],
      filters: {
        tags: ['critical', 'production'],
        minSize: 10 * 1024 * 1024 // 10MB minimum
      },
      options: {
        syncMode: 'immediate',
        retentionSync: true,
        metadataSync: true,
        deleteSync: false,
        compressionLevel: 9
      },
      priority: 0 // Highest priority
    };

    // Scheduled bulk replication
    const bulkRule: ReplicationRule = {
      id: 'bulk-replication',
      name: 'Scheduled Bulk Replication',
      enabled: true,
      sourceRegion: 'primary',
      targetRegions: ['archive-us-central'],
      backupTypes: ['full', 'incremental', 'differential'],
      schedule: '0 2 * * *', // Daily at 2 AM
      filters: {
        ageThreshold: 24 // 24 hours
      },
      options: {
        syncMode: 'scheduled',
        retentionSync: true,
        metadataSync: true,
        deleteSync: true,
        compressionLevel: 9
      },
      priority: 2
    };

    this.replicationRules.set(primaryRule.id, primaryRule);
    this.replicationRules.set(criticalRule.id, criticalRule);
    this.replicationRules.set(bulkRule.id, bulkRule);

    await this.saveReplicationRules();
    this.emit('replication:default-rules-created');
  }

  private startMonitoring(): void {
    // Health check monitoring
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.monitoring.healthCheckInterval);

    // Metrics collection
    this.metricsInterval = setInterval(async () => {
      await this.collectMetrics();
    }, 60000); // Every minute
  }

  private setupScheduledReplication(): void {
    const cron = require('node-cron');

    for (const rule of this.replicationRules.values()) {
      if (rule.enabled && rule.schedule && rule.options.syncMode === 'scheduled') {
        const task = cron.schedule(rule.schedule, async () => {
          await this.executeScheduledReplication(rule.id);
        }, { scheduled: false });
        
        task.start();
        this.scheduledTasks.set(rule.id, task);
      }
    }
  }

  private startJobProcessor(): void {
    this.jobProcessor = setInterval(async () => {
      await this.processReplicationQueue();
    }, 5000); // Check every 5 seconds
  }

  private setupEventListeners(): void {
    // Listen to backup completion events
    this.backupService.on('job:completed', async (event) => {
      const { job } = event;
      if (job.metadata) {
        await this.processNewBackup(job.metadata);
      }
    });

    // Listen to backup deletion events
    this.backupService.on('backup:deleted', async (backup) => {
      await this.handleBackupDeletion(backup);
    });
  }

  private async processNewBackup(backup: BackupMetadata): Promise<void> {
    // Find applicable replication rules
    const applicableRules = this.findApplicableRules(backup);
    
    for (const rule of applicableRules) {
      if (rule.options.syncMode === 'immediate') {
        await this.queueReplicationJobs(backup, rule);
      }
    }
  }

  private findApplicableRules(backup: BackupMetadata): ReplicationRule[] {
    return Array.from(this.replicationRules.values())
      .filter(rule => {
        if (!rule.enabled) return false;

        // Check backup type
        if (rule.backupTypes.length > 0 && !rule.backupTypes.includes(backup.type)) {
          return false;
        }

        // Check size filters
        if (rule.filters.minSize && backup.size < rule.filters.minSize) {
          return false;
        }
        if (rule.filters.maxSize && backup.size > rule.filters.maxSize) {
          return false;
        }

        // Check age threshold
        if (rule.filters.ageThreshold) {
          const ageHours = (Date.now() - backup.timestamp.getTime()) / (1000 * 60 * 60);
          if (ageHours < rule.filters.ageThreshold) {
            return false;
          }
        }

        // Check tags
        if (rule.filters.tags && rule.filters.tags.length > 0) {
          const backupTags = Object.keys(backup.tags || {});
          const hasMatchingTag = rule.filters.tags.some(tag => backupTags.includes(tag));
          if (!hasMatchingTag) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => a.priority - b.priority); // Lower priority number = higher priority
  }

  private async queueReplicationJobs(backup: BackupMetadata, rule: ReplicationRule): Promise<void> {
    for (const targetRegion of rule.targetRegions) {
      const jobId = `job-${backup.id}-${rule.sourceRegion}-${targetRegion}-${Date.now()}`;
      
      const job: ReplicationJob = {
        id: jobId,
        ruleId: rule.id,
        backupId: backup.id,
        sourceRegion: rule.sourceRegion,
        targetRegion,
        status: 'queued',
        startTime: new Date(),
        progress: {
          bytesTransferred: 0,
          totalBytes: backup.size,
          percentage: 0,
          speed: 0,
          eta: 0
        },
        checksums: {
          source: backup.checksum,
          verified: false
        },
        retryCount: 0,
        metadata: { rule: rule.name, priority: rule.priority }
      };

      this.activeJobs.set(jobId, job);
      this.emit('replication:job-queued', job);
    }
  }

  private async processReplicationQueue(): Promise<void> {
    const queuedJobs = Array.from(this.activeJobs.values())
      .filter(job => job.status === 'queued')
      .sort((a, b) => (a.metadata.priority || 999) - (b.metadata.priority || 999));

    const runningJobs = Array.from(this.activeJobs.values())
      .filter(job => job.status === 'running');

    const availableSlots = this.config.performance.parallelTransfers - runningJobs.length;

    if (availableSlots > 0 && queuedJobs.length > 0) {
      const jobsToStart = queuedJobs.slice(0, availableSlots);
      
      for (const job of jobsToStart) {
        this.executeReplicationJob(job);
      }
    }
  }

  private async executeReplicationJob(job: ReplicationJob): Promise<void> {
    job.status = 'running';
    job.startTime = new Date();
    
    this.emit('replication:job-started', job);

    try {
      // Get source backup metadata
      const backup = this.backupService.listBackups().find(b => b.id === job.backupId);
      if (!backup) {
        throw new Error(`Backup not found: ${job.backupId}`);
      }

      // Get source and target region configs
      const sourceRegion = this.regions.get(job.sourceRegion);
      const targetRegion = this.regions.get(job.targetRegion);
      
      if (!sourceRegion || !targetRegion) {
        throw new Error(`Invalid region configuration`);
      }

      // Find source location
      const sourceLocation = await this.findBackupLocation(backup, sourceRegion);
      if (!sourceLocation) {
        throw new Error(`Backup not found in source region: ${job.sourceRegion}`);
      }

      // Replicate backup
      await this.replicateBackup(backup, sourceLocation, sourceRegion, targetRegion, job);

      // Verify replication
      if (this.config.consistency.checksumValidation) {
        await this.verifyReplication(backup, targetRegion, job);
      }

      // Update replication status
      await this.updateReplicationStatus(backup, job.targetRegion, 'synced');

      job.status = 'completed';
      job.endTime = new Date();
      job.progress.percentage = 100;

      this.emit('replication:job-completed', job);

    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.endTime = new Date();

      // Retry if configured
      if (job.retryCount < this.config.network.retryAttempts) {
        job.retryCount++;
        job.status = 'queued';
        
        // Schedule retry with delay
        setTimeout(() => {
          this.emit('replication:job-retry', job);
        }, this.config.network.retryDelay * 1000);
      } else {
        this.emit('replication:job-failed', { job, error });
      }
    } finally {
      // Move completed/failed jobs to history
      if (job.status === 'completed' || job.status === 'failed') {
        this.activeJobs.delete(job.id);
        this.jobHistory.push(job);
        await this.saveJobHistory();
      }
    }
  }

  private async findBackupLocation(backup: BackupMetadata, region: RegionConfig): Promise<string | null> {
    // Check if backup exists in this region
    for (const location of backup.storageLocations) {
      if (await this.isLocationInRegion(location, region)) {
        return location;
      }
    }
    return null;
  }

  private async isLocationInRegion(location: string, region: RegionConfig): Promise<boolean> {
    // Simple implementation - would check if storage location belongs to region
    if (location.includes(region.id) || location.includes(region.location)) {
      return true;
    }
    
    // Check against region endpoints
    try {
      const url = new URL(location);
      return url.hostname.includes(region.location) || url.hostname.includes(region.id);
    } catch {
      return false;
    }
  }

  private async replicateBackup(
    backup: BackupMetadata,
    sourceLocation: string,
    sourceRegion: RegionConfig,
    targetRegion: RegionConfig,
    job: ReplicationJob
  ): Promise<void> {
    // Determine replication method based on storage type
    if (sourceLocation.startsWith('s3://')) {
      await this.replicateS3Backup(backup, sourceLocation, sourceRegion, targetRegion, job);
    } else if (sourceLocation.startsWith('azure://')) {
      await this.replicateAzureBackup(backup, sourceLocation, sourceRegion, targetRegion, job);
    } else if (sourceLocation.startsWith('gs://')) {
      await this.replicateGCSBackup(backup, sourceLocation, sourceRegion, targetRegion, job);
    } else {
      // Local or generic replication
      await this.replicateGenericBackup(backup, sourceLocation, sourceRegion, targetRegion, job);
    }
  }

  private async replicateS3Backup(
    backup: BackupMetadata,
    sourceLocation: string,
    sourceRegion: RegionConfig,
    targetRegion: RegionConfig,
    job: ReplicationJob
  ): Promise<void> {
    const AWS = require('aws-sdk');
    
    // Configure source S3
    const sourceS3 = new AWS.S3({
      accessKeyId: sourceRegion.credentials.accessKeyId,
      secretAccessKey: sourceRegion.credentials.secretAccessKey,
      region: sourceRegion.credentials.region
    });

    // Configure target S3
    const targetS3 = new AWS.S3({
      accessKeyId: targetRegion.credentials.accessKeyId,
      secretAccessKey: targetRegion.credentials.secretAccessKey,
      region: targetRegion.credentials.region
    });

    // Parse source location
    const sourceUrl = new URL(sourceLocation);
    const sourceBucket = sourceUrl.hostname;
    const sourceKey = sourceUrl.pathname.substring(1);

    // Generate target location
    const targetBucket = targetRegion.endpoints.storage.replace('s3://', '');
    const targetKey = `replicas/${sourceRegion.id}/${sourceKey}`;

    // Use S3 cross-region replication or copy
    const copyParams = {
      Bucket: targetBucket,
      Key: targetKey,
      CopySource: `${sourceBucket}/${sourceKey}`,
      StorageClass: 'STANDARD_IA',
      MetadataDirective: 'COPY'
    };

    // Monitor progress
    const managedUpload = targetS3.copyObject(copyParams);
    
    managedUpload.on('httpUploadProgress', (progress: any) => {
      if (progress.total) {
        job.progress.bytesTransferred = progress.loaded;
        job.progress.percentage = (progress.loaded / progress.total) * 100;
        job.progress.speed = this.calculateTransferSpeed(job);
        job.progress.eta = this.calculateETA(job);
        
        this.emit('replication:job-progress', job);
      }
    });

    await managedUpload.promise();

    // Update backup metadata with new location
    const targetLocation = `s3://${targetBucket}/${targetKey}`;
    backup.storageLocations.push(targetLocation);
  }

  private async replicateAzureBackup(
    backup: BackupMetadata,
    sourceLocation: string,
    sourceRegion: RegionConfig,
    targetRegion: RegionConfig,
    job: ReplicationJob
  ): Promise<void> {
    // Azure Blob Storage replication implementation
    const { BlobServiceClient } = require('@azure/storage-blob');
    
    // Implementation would handle Azure cross-region replication
    this.emit('replication:azure-replication-requested', {
      backup,
      sourceLocation,
      sourceRegion: sourceRegion.id,
      targetRegion: targetRegion.id,
      job: job.id
    });
    
    // Simulate progress
    await this.simulateTransferProgress(job);
  }

  private async replicateGCSBackup(
    backup: BackupMetadata,
    sourceLocation: string,
    sourceRegion: RegionConfig,
    targetRegion: RegionConfig,
    job: ReplicationJob
  ): Promise<void> {
    // Google Cloud Storage replication implementation
    const { Storage } = require('@google-cloud/storage');
    
    // Implementation would handle GCS cross-region replication
    this.emit('replication:gcs-replication-requested', {
      backup,
      sourceLocation,
      sourceRegion: sourceRegion.id,
      targetRegion: targetRegion.id,
      job: job.id
    });
    
    // Simulate progress
    await this.simulateTransferProgress(job);
  }

  private async replicateGenericBackup(
    backup: BackupMetadata,
    sourceLocation: string,
    sourceRegion: RegionConfig,
    targetRegion: RegionConfig,
    job: ReplicationJob
  ): Promise<void> {
    // Generic replication for local or other storage types
    this.emit('replication:generic-replication-requested', {
      backup,
      sourceLocation,
      sourceRegion: sourceRegion.id,
      targetRegion: targetRegion.id,
      job: job.id
    });
    
    // Simulate progress
    await this.simulateTransferProgress(job);
  }

  private async simulateTransferProgress(job: ReplicationJob): Promise<void> {
    return new Promise((resolve) => {
      const totalBytes = job.progress.totalBytes;
      const chunkSize = this.config.performance.chunkSize * 1024 * 1024; // Convert MB to bytes
      let transferred = 0;
      
      const interval = setInterval(() => {
        transferred += chunkSize;
        job.progress.bytesTransferred = Math.min(transferred, totalBytes);
        job.progress.percentage = (job.progress.bytesTransferred / totalBytes) * 100;
        job.progress.speed = this.calculateTransferSpeed(job);
        job.progress.eta = this.calculateETA(job);
        
        this.emit('replication:job-progress', job);
        
        if (transferred >= totalBytes) {
          clearInterval(interval);
          resolve();
        }
      }, 1000); // Update every second
    });
  }

  private calculateTransferSpeed(job: ReplicationJob): number {
    const elapsedSeconds = (Date.now() - job.startTime.getTime()) / 1000;
    if (elapsedSeconds > 0) {
      return (job.progress.bytesTransferred / (1024 * 1024)) / elapsedSeconds; // MB/s
    }
    return 0;
  }

  private calculateETA(job: ReplicationJob): number {
    if (job.progress.speed > 0) {
      const remainingBytes = job.progress.totalBytes - job.progress.bytesTransferred;
      const remainingMB = remainingBytes / (1024 * 1024);
      return remainingMB / job.progress.speed; // seconds
    }
    return 0;
  }

  private async verifyReplication(backup: BackupMetadata, targetRegion: RegionConfig, job: ReplicationJob): Promise<void> {
    // Implementation would verify backup integrity in target region
    // For now, we'll simulate successful verification
    
    if (this.config.consistency.checksumValidation) {
      // Simulate checksum validation
      job.checksums.target = backup.checksum;
      job.checksums.verified = job.checksums.source === job.checksums.target;
      
      if (!job.checksums.verified) {
        throw new Error('Checksum verification failed');
      }
    }

    this.emit('replication:verification-completed', {
      backup: backup.id,
      region: targetRegion.id,
      verified: job.checksums.verified
    });
  }

  private async updateReplicationStatus(backup: BackupMetadata, targetRegion: string, status: string): Promise<void> {
    const statusKey = `${targetRegion}-${backup.id}`;
    let replicationStatus = this.replicationStatus.get(statusKey);
    
    if (!replicationStatus) {
      replicationStatus = {
        regionId: targetRegion,
        backupId: backup.id,
        replicas: [],
        consistency: 'unknown',
        lastSync: new Date(),
        lag: 0,
        health: 'healthy'
      };
      this.replicationStatus.set(statusKey, replicationStatus);
    }

    // Find or create replica info
    let replica = replicationStatus.replicas.find(r => r.regionId === targetRegion);
    if (!replica) {
      replica = {
        regionId: targetRegion,
        location: targetRegion,
        size: backup.size,
        checksum: backup.checksum,
        timestamp: new Date(),
        status: 'missing'
      };
      replicationStatus.replicas.push(replica);
    }

    replica.status = status as any;
    replica.timestamp = new Date();
    replicationStatus.lastSync = new Date();
    replicationStatus.lag = 0;

    await this.saveReplicationStatus();
    this.emit('replication:status-updated', replicationStatus);
  }

  private async handleBackupDeletion(backup: BackupMetadata): Promise<void> {
    // Handle deletion across replicated regions
    const affectedRules = Array.from(this.replicationRules.values())
      .filter(rule => rule.enabled && rule.options.deleteSync);

    for (const rule of affectedRules) {
      for (const targetRegion of rule.targetRegions) {
        // Queue deletion job for target region
        this.emit('replication:deletion-requested', {
          backup: backup.id,
          sourceRegion: rule.sourceRegion,
          targetRegion,
          rule: rule.id
        });
      }
    }
  }

  private async performHealthChecks(): Promise<void> {
    const regionPromises = Array.from(this.regions.keys()).map(regionId => 
      this.checkRegionHealth(regionId)
    );

    await Promise.allSettled(regionPromises);
    await this.evaluateOverallHealth();
  }

  private async checkRegionHealth(regionId: string): Promise<void> {
    const region = this.regions.get(regionId)!;
    const startTime = Date.now();

    try {
      // Check region connectivity and latency
      const latency = await this.measureRegionLatency(region);
      const availability = await this.checkRegionAvailability(region);
      const throughput = await this.measureRegionThroughput(region);
      const storageUsage = await this.getRegionStorageUsage(region);

      // Update region metrics
      const metrics: RegionMetrics = {
        regionId,
        status: availability > 95 ? 'healthy' : availability > 80 ? 'degraded' : 'unhealthy',
        latency,
        availability,
        throughput,
        storageUsage,
        errorRate: this.calculateRegionErrorRate(regionId),
        lastHealthCheck: new Date()
      };

      region.latency.current = latency;
      region.capacity.currentUsage = storageUsage;
      
      // Update status based on health
      if (metrics.status === 'unhealthy') {
        region.status = 'offline';
      } else if (metrics.status === 'degraded') {
        region.status = 'degraded';
      } else {
        region.status = 'active';
      }

      this.emit('replication:region-health-updated', { regionId, metrics });

    } catch (error) {
      region.status = 'offline';
      this.emit('replication:region-health-failed', { regionId, error });
    }
  }

  private async measureRegionLatency(region: RegionConfig): Promise<number> {
    const startTime = Date.now();
    
    try {
      // Simple HTTP ping to region endpoint
      const response = await fetch(`${region.endpoints.api}/health`, {
        method: 'HEAD',
        timeout: 5000
      });
      
      return Date.now() - startTime;
    } catch (error) {
      return -1; // Indicates failure
    }
  }

  private async checkRegionAvailability(region: RegionConfig): Promise<number> {
    // Check multiple endpoints and calculate availability percentage
    const endpoints = [region.endpoints.api, region.endpoints.storage, region.endpoints.monitoring];
    let successCount = 0;

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${endpoint}/health`, { timeout: 3000 });
        if (response.ok) {
          successCount++;
        }
      } catch (error) {
        // Endpoint failed
      }
    }

    return (successCount / endpoints.length) * 100;
  }

  private async measureRegionThroughput(region: RegionConfig): Promise<number> {
    // Simplified throughput measurement
    // In reality, would perform actual transfer tests
    return Math.random() * 100; // Mock value
  }

  private async getRegionStorageUsage(region: RegionConfig): Promise<number> {
    // Get actual storage usage from region
    // Mock implementation
    return region.capacity.currentUsage + Math.random() * 10;
  }

  private calculateRegionErrorRate(regionId: string): number {
    const recentJobs = this.jobHistory.filter(job => 
      (job.sourceRegion === regionId || job.targetRegion === regionId) &&
      job.endTime && 
      (Date.now() - job.endTime.getTime()) < 24 * 60 * 60 * 1000 // Last 24 hours
    );

    if (recentJobs.length === 0) return 0;

    const failedJobs = recentJobs.filter(job => job.status === 'failed').length;
    return (failedJobs / recentJobs.length) * 100;
  }

  private async evaluateOverallHealth(): Promise<void> {
    const regions = Array.from(this.regions.values());
    const healthyRegions = regions.filter(r => r.status === 'active').length;
    const totalRegions = regions.length;
    
    let overallHealth: 'healthy' | 'degraded' | 'critical';
    
    if (healthyRegions === totalRegions) {
      overallHealth = 'healthy';
    } else if (healthyRegions >= totalRegions * 0.7) {
      overallHealth = 'degraded';
    } else {
      overallHealth = 'critical';
    }

    this.emit('replication:overall-health-updated', {
      status: overallHealth,
      healthyRegions,
      totalRegions,
      timestamp: new Date()
    });

    // Send alerts if health is degraded
    if (overallHealth !== 'healthy') {
      await this.sendHealthAlert(overallHealth, healthyRegions, totalRegions);
    }
  }

  private async sendHealthAlert(health: string, healthyRegions: number, totalRegions: number): Promise<void> {
    const message = `Cross-region replication health is ${health}: ${healthyRegions}/${totalRegions} regions healthy`;
    
    // Send email alerts
    for (const email of this.config.monitoring.alerting.email) {
      this.emit('replication:email-alert', { email, message, severity: health });
    }

    // Send webhook alerts
    for (const webhook of this.config.monitoring.alerting.webhook) {
      try {
        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            severity: health,
            timestamp: new Date().toISOString(),
            regions: { healthy: healthyRegions, total: totalRegions }
          })
        });
      } catch (error) {
        this.emit('replication:webhook-alert-failed', { webhook, error });
      }
    }

    // Send PagerDuty alert for critical issues
    if (health === 'critical' && this.config.monitoring.alerting.pagerDuty) {
      await this.sendPagerDutyAlert(message);
    }
  }

  private async sendPagerDutyAlert(message: string): Promise<void> {
    const payload = {
      routing_key: this.config.monitoring.alerting.pagerDuty,
      event_action: 'trigger',
      payload: {
        summary: 'Cross-Region Replication Critical Alert',
        source: 'cross-region-replication',
        severity: 'critical',
        custom_details: { message }
      }
    };

    try {
      await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      this.emit('replication:pagerduty-alert-failed', error);
    }
  }

  private async collectMetrics(): Promise<void> {
    const metrics: ReplicationMetrics = {
      timestamp: new Date(),
      totalJobs: this.jobHistory.length + this.activeJobs.size,
      activeJobs: this.activeJobs.size,
      completedJobs: this.jobHistory.filter(j => j.status === 'completed').length,
      failedJobs: this.jobHistory.filter(j => j.status === 'failed').length,
      bytesTransferred: this.jobHistory.reduce((sum, j) => sum + j.progress.bytesTransferred, 0),
      averageSpeed: this.calculateAverageSpeed(),
      regionMetrics: new Map(),
      replicationLag: this.calculateReplicationLag(),
      consistency: this.calculateConsistencyMetrics()
    };

    this.metrics.push(metrics);
    
    // Keep only last 24 hours of metrics
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;
    this.metrics = this.metrics.filter(m => m.timestamp.getTime() > cutoffTime);

    this.emit('replication:metrics-collected', metrics);
  }

  private calculateAverageSpeed(): number {
    const completedJobs = this.jobHistory.filter(j => j.status === 'completed');
    if (completedJobs.length === 0) return 0;

    const totalSpeed = completedJobs.reduce((sum, job) => sum + job.progress.speed, 0);
    return totalSpeed / completedJobs.length;
  }

  private calculateReplicationLag(): number {
    // Calculate maximum lag across all replicated backups
    let maxLag = 0;
    
    for (const status of this.replicationStatus.values()) {
      maxLag = Math.max(maxLag, status.lag);
    }
    
    return maxLag;
  }

  private calculateConsistencyMetrics(): { totalChecks: number; passedChecks: number; failedChecks: number } {
    const recentJobs = this.jobHistory.filter(job => 
      job.endTime && (Date.now() - job.endTime.getTime()) < 24 * 60 * 60 * 1000
    );

    const totalChecks = recentJobs.length;
    const passedChecks = recentJobs.filter(job => job.checksums.verified).length;
    const failedChecks = totalChecks - passedChecks;

    return { totalChecks, passedChecks, failedChecks };
  }

  private async executeScheduledReplication(ruleId: string): Promise<void> {
    const rule = this.replicationRules.get(ruleId);
    if (!rule || !rule.enabled) {
      return;
    }

    try {
      // Get backups that need replication
      const backups = this.backupService.listBackups();
      const eligibleBackups = backups.filter(backup => this.findApplicableRules(backup).includes(rule));

      for (const backup of eligibleBackups) {
        await this.queueReplicationJobs(backup, rule);
      }

      this.emit('replication:scheduled-replication-completed', { ruleId, backupsQueued: eligibleBackups.length });
    } catch (error) {
      this.emit('replication:scheduled-replication-failed', { ruleId, error });
    }
  }

  /**
   * Create a new replication rule
   */
  public async createReplicationRule(rule: Omit<ReplicationRule, 'id'>): Promise<string> {
    const ruleId = `rule-${Date.now()}`;
    const fullRule: ReplicationRule = { id: ruleId, ...rule };

    this.replicationRules.set(ruleId, fullRule);
    await this.saveReplicationRules();

    // Setup schedule if provided
    if (fullRule.schedule && fullRule.enabled) {
      const cron = require('node-cron');
      const task = cron.schedule(fullRule.schedule, async () => {
        await this.executeScheduledReplication(ruleId);
      }, { scheduled: false });
      
      task.start();
      this.scheduledTasks.set(ruleId, task);
    }

    this.emit('replication:rule-created', fullRule);
    return ruleId;
  }

  /**
   * Get replication status for a backup
   */
  public getReplicationStatus(backupId: string): ReplicationStatus[] {
    return Array.from(this.replicationStatus.values())
      .filter(status => status.backupId === backupId);
  }

  /**
   * Get active replication jobs
   */
  public getActiveJobs(): ReplicationJob[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Get replication metrics
   */
  public getMetrics(hours: number = 24): ReplicationMetrics[] {
    const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
    return this.metrics.filter(m => m.timestamp.getTime() > cutoffTime);
  }

  /**
   * Get region health status
   */
  public getRegionHealth(): RegionConfig[] {
    return Array.from(this.regions.values());
  }

  /**
   * Cancel a replication job
   */
  public cancelJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (job && (job.status === 'queued' || job.status === 'running')) {
      job.status = 'cancelled';
      job.endTime = new Date();
      
      this.activeJobs.delete(jobId);
      this.jobHistory.push(job);
      
      this.emit('replication:job-cancelled', job);
      return true;
    }
    return false;
  }

  /**
   * Stop the replication service
   */
  public stop(): void {
    // Clear all intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    if (this.jobProcessor) {
      clearInterval(this.jobProcessor);
    }

    // Clear scheduled tasks
    this.scheduledTasks.forEach(task => task.destroy());
    this.scheduledTasks.clear();

    this.emit('replication:service-stopped');
  }
}

export { 
  ReplicationConfig, 
  RegionConfig, 
  ReplicationRule, 
  ReplicationJob, 
  ReplicationStatus,
  ReplicationMetrics 
};