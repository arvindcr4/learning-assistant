import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import logger from '../logger';
import { getDatabase } from './connection';
import { getDatabaseConfig } from './config';

const execAsync = promisify(exec);

export interface BackupConfig {
  backupPath: string;
  retentionDays: number;
  compression: boolean;
  encryption: boolean;
  encryptionKey?: string;
  includeData: boolean;
  includeSchema: boolean;
  excludeTables?: string[];
  customOptions?: string[];
}

export interface BackupResult {
  success: boolean;
  backupPath: string;
  size: number;
  duration: number;
  timestamp: string;
  checksum?: string;
  error?: string;
}

export interface RestoreOptions {
  backupPath: string;
  targetDatabase?: string;
  dropExisting: boolean;
  dataOnly: boolean;
  schemaOnly: boolean;
  tablesToRestore?: string[];
  customOptions?: string[];
}

export interface RestoreResult {
  success: boolean;
  duration: number;
  timestamp: string;
  tablesRestored: number;
  error?: string;
}

export class DatabaseBackupManager {
  private static instance: DatabaseBackupManager;
  private db = getDatabase();
  private config = getDatabaseConfig();
  
  private readonly defaultBackupConfig: BackupConfig = {
    backupPath: process.env.DB_BACKUP_PATH || './backups',
    retentionDays: parseInt(process.env.DB_BACKUP_RETENTION_DAYS || '30'),
    compression: process.env.DB_BACKUP_COMPRESSION === 'true',
    encryption: process.env.DB_BACKUP_ENCRYPTION === 'true',
    encryptionKey: process.env.DB_BACKUP_ENCRYPTION_KEY,
    includeData: true,
    includeSchema: true,
    excludeTables: [],
    customOptions: []
  };

  private constructor() {
    this.ensureBackupDirectory();
  }

  public static getInstance(): DatabaseBackupManager {
    if (!DatabaseBackupManager.instance) {
      DatabaseBackupManager.instance = new DatabaseBackupManager();
    }
    return DatabaseBackupManager.instance;
  }

  // Ensure backup directory exists
  private ensureBackupDirectory(): void {
    if (!existsSync(this.defaultBackupConfig.backupPath)) {
      mkdirSync(this.defaultBackupConfig.backupPath, { recursive: true });
    }
  }

  // Create full database backup
  public async createFullBackup(options?: Partial<BackupConfig>): Promise<BackupResult> {
    const config = { ...this.defaultBackupConfig, ...options };
    const startTime = Date.now();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `full_backup_${timestamp}.sql`;
    const backupPath = join(config.backupPath, backupFileName);

    logger.info('Starting full database backup', {
      backupPath,
      includeData: config.includeData,
      includeSchema: config.includeSchema,
      category: 'database',
      operation: 'backup'
    });

    try {
      // Build pg_dump command
      const pgDumpCmd = this.buildPgDumpCommand(backupPath, config);
      
      // Execute backup
      const { stdout, stderr } = await execAsync(pgDumpCmd);
      
      if (stderr && !stderr.includes('WARNING')) {
        throw new Error(`pg_dump error: ${stderr}`);
      }

      // Get backup file size
      const stats = require('fs').statSync(backupPath);
      const size = stats.size;

      // Calculate checksum
      const checksum = this.calculateFileChecksum(backupPath);

      // Compress if requested
      let finalPath = backupPath;
      if (config.compression) {
        finalPath = await this.compressBackup(backupPath);
      }

      // Encrypt if requested
      if (config.encryption && config.encryptionKey) {
        finalPath = await this.encryptBackup(finalPath, config.encryptionKey);
      }

      const duration = Date.now() - startTime;
      
      const result: BackupResult = {
        success: true,
        backupPath: finalPath,
        size,
        duration,
        timestamp: new Date().toISOString(),
        checksum
      };

      // Log backup completion
      logger.info('Database backup completed successfully', {
        ...result,
        category: 'database',
        operation: 'backup'
      });

      // Cleanup old backups
      await this.cleanupOldBackups(config);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const result: BackupResult = {
        success: false,
        backupPath,
        size: 0,
        duration,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      };

      logger.error('Database backup failed', {
        ...result,
        category: 'database',
        operation: 'backup'
      });

      return result;
    }
  }

  // Create incremental backup (using WAL files)
  public async createIncrementalBackup(baseBackupPath: string): Promise<BackupResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `incremental_backup_${timestamp}.tar`;
    const backupPath = join(this.defaultBackupConfig.backupPath, backupFileName);

    logger.info('Starting incremental database backup', {
      baseBackupPath,
      backupPath,
      category: 'database',
      operation: 'incremental_backup'
    });

    try {
      // Use pg_basebackup for incremental backup
      const pgBaseBackupCmd = this.buildPgBaseBackupCommand(backupPath);
      
      const { stdout, stderr } = await execAsync(pgBaseBackupCmd);
      
      if (stderr && !stderr.includes('WARNING')) {
        throw new Error(`pg_basebackup error: ${stderr}`);
      }

      const stats = require('fs').statSync(backupPath);
      const size = stats.size;
      const checksum = this.calculateFileChecksum(backupPath);
      const duration = Date.now() - startTime;

      const result: BackupResult = {
        success: true,
        backupPath,
        size,
        duration,
        timestamp: new Date().toISOString(),
        checksum
      };

      logger.info('Incremental database backup completed', {
        ...result,
        category: 'database',
        operation: 'incremental_backup'
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const result: BackupResult = {
        success: false,
        backupPath,
        size: 0,
        duration,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      };

      logger.error('Incremental database backup failed', {
        ...result,
        category: 'database',
        operation: 'incremental_backup'
      });

      return result;
    }
  }

  // Restore database from backup
  public async restoreFromBackup(options: RestoreOptions): Promise<RestoreResult> {
    const startTime = Date.now();
    
    logger.info('Starting database restore', {
      backupPath: options.backupPath,
      targetDatabase: options.targetDatabase,
      dropExisting: options.dropExisting,
      category: 'database',
      operation: 'restore'
    });

    try {
      // Validate backup file exists
      if (!existsSync(options.backupPath)) {
        throw new Error(`Backup file not found: ${options.backupPath}`);
      }

      // Decrypt if needed
      let restorePath = options.backupPath;
      if (options.backupPath.endsWith('.enc')) {
        restorePath = await this.decryptBackup(options.backupPath);
      }

      // Decompress if needed
      if (restorePath.endsWith('.gz') || restorePath.endsWith('.tar.gz')) {
        restorePath = await this.decompressBackup(restorePath);
      }

      // Drop existing database if requested
      if (options.dropExisting && options.targetDatabase) {
        await this.dropDatabase(options.targetDatabase);
        await this.createDatabase(options.targetDatabase);
      }

      // Build pg_restore or psql command
      const restoreCmd = this.buildRestoreCommand(restorePath, options);
      
      // Execute restore
      const { stdout, stderr } = await execAsync(restoreCmd);
      
      if (stderr && !stderr.includes('WARNING') && !stderr.includes('already exists')) {
        throw new Error(`Restore error: ${stderr}`);
      }

      // Count restored tables
      const tablesRestored = await this.countTables(options.targetDatabase);
      const duration = Date.now() - startTime;

      const result: RestoreResult = {
        success: true,
        duration,
        timestamp: new Date().toISOString(),
        tablesRestored
      };

      logger.info('Database restore completed successfully', {
        ...result,
        category: 'database',
        operation: 'restore'
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const result: RestoreResult = {
        success: false,
        duration,
        timestamp: new Date().toISOString(),
        tablesRestored: 0,
        error: error instanceof Error ? error.message : String(error)
      };

      logger.error('Database restore failed', {
        ...result,
        category: 'database',
        operation: 'restore'
      });

      return result;
    }
  }

  // Build pg_dump command
  private buildPgDumpCommand(backupPath: string, config: BackupConfig): string {
    const dbConfig = this.config;
    const parts = ['pg_dump'];

    // Connection parameters
    parts.push(`-h ${dbConfig.host}`);
    parts.push(`-p ${dbConfig.port}`);
    parts.push(`-U ${dbConfig.username}`);
    parts.push(`-d ${dbConfig.database}`);

    // Backup options
    if (!config.includeData) {
      parts.push('--schema-only');
    } else if (!config.includeSchema) {
      parts.push('--data-only');
    }

    // Exclude tables
    if (config.excludeTables && config.excludeTables.length > 0) {
      config.excludeTables.forEach(table => {
        parts.push(`--exclude-table=${table}`);
      });
    }

    // Custom options
    if (config.customOptions) {
      parts.push(...config.customOptions);
    }

    // Output format
    parts.push('--verbose');
    parts.push('--no-password');
    parts.push(`--file=${backupPath}`);

    // Set PGPASSWORD environment variable
    const command = `PGPASSWORD="${dbConfig.password}" ${parts.join(' ')}`;
    
    return command;
  }

  // Build pg_basebackup command
  private buildPgBaseBackupCommand(backupPath: string): string {
    const dbConfig = this.config;
    const parts = ['pg_basebackup'];

    parts.push(`-h ${dbConfig.host}`);
    parts.push(`-p ${dbConfig.port}`);
    parts.push(`-U ${dbConfig.username}`);
    parts.push('-D -'); // Output to stdout
    parts.push('-Ft'); // Tar format
    parts.push('-z'); // Compress
    parts.push('-P'); // Progress reporting
    parts.push(`> ${backupPath}`);

    const command = `PGPASSWORD="${dbConfig.password}" ${parts.join(' ')}`;
    
    return command;
  }

  // Build restore command
  private buildRestoreCommand(backupPath: string, options: RestoreOptions): string {
    const dbConfig = this.config;
    const targetDb = options.targetDatabase || dbConfig.database;
    
    // Determine if this is a custom format backup or SQL
    const isCustomFormat = backupPath.endsWith('.backup') || backupPath.endsWith('.tar');
    
    if (isCustomFormat) {
      // Use pg_restore for custom format
      const parts = ['pg_restore'];
      parts.push(`-h ${dbConfig.host}`);
      parts.push(`-p ${dbConfig.port}`);
      parts.push(`-U ${dbConfig.username}`);
      parts.push(`-d ${targetDb}`);
      
      if (options.dataOnly) {
        parts.push('--data-only');
      } else if (options.schemaOnly) {
        parts.push('--schema-only');
      }
      
      if (options.tablesToRestore) {
        options.tablesToRestore.forEach(table => {
          parts.push(`--table=${table}`);
        });
      }
      
      parts.push('--verbose');
      parts.push('--no-password');
      parts.push(backupPath);
      
      return `PGPASSWORD="${dbConfig.password}" ${parts.join(' ')}`;
    } else {
      // Use psql for SQL format
      const parts = ['psql'];
      parts.push(`-h ${dbConfig.host}`);
      parts.push(`-p ${dbConfig.port}`);
      parts.push(`-U ${dbConfig.username}`);
      parts.push(`-d ${targetDb}`);
      parts.push('-v ON_ERROR_STOP=1');
      parts.push(`-f ${backupPath}`);
      
      return `PGPASSWORD="${dbConfig.password}" ${parts.join(' ')}`;
    }
  }

  // Compress backup file
  private async compressBackup(filePath: string): Promise<string> {
    const compressedPath = `${filePath}.gz`;
    await execAsync(`gzip -c ${filePath} > ${compressedPath}`);
    
    // Remove original file
    require('fs').unlinkSync(filePath);
    
    return compressedPath;
  }

  // Decompress backup file
  private async decompressBackup(filePath: string): Promise<string> {
    const decompressedPath = filePath.replace(/\.(gz|tar\.gz)$/, '');
    
    if (filePath.endsWith('.tar.gz')) {
      await execAsync(`tar -xzf ${filePath} -O > ${decompressedPath}`);
    } else {
      await execAsync(`gunzip -c ${filePath} > ${decompressedPath}`);
    }
    
    return decompressedPath;
  }

  // Encrypt backup file (simple implementation)
  private async encryptBackup(filePath: string, encryptionKey: string): Promise<string> {
    const encryptedPath = `${filePath}.enc`;
    
    // Simple encryption using openssl (in production, use proper key management)
    await execAsync(`openssl enc -aes-256-cbc -salt -in ${filePath} -out ${encryptedPath} -pass pass:"${encryptionKey}"`);
    
    // Remove original file
    require('fs').unlinkSync(filePath);
    
    return encryptedPath;
  }

  // Decrypt backup file
  private async decryptBackup(filePath: string): Promise<string> {
    const decryptedPath = filePath.replace('.enc', '');
    const encryptionKey = this.defaultBackupConfig.encryptionKey;
    
    if (!encryptionKey) {
      throw new Error('Encryption key not provided for decryption');
    }
    
    await execAsync(`openssl enc -d -aes-256-cbc -in ${filePath} -out ${decryptedPath} -pass pass:"${encryptionKey}"`);
    
    return decryptedPath;
  }

  // Calculate file checksum
  private calculateFileChecksum(filePath: string): string {
    const crypto = require('crypto');
    const fileContent = readFileSync(filePath);
    return crypto.createHash('sha256').update(fileContent).digest('hex');
  }

  // Drop database
  private async dropDatabase(dbName: string): Promise<void> {
    const dbConfig = this.config;
    await execAsync(`PGPASSWORD="${dbConfig.password}" dropdb -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} --if-exists ${dbName}`);
  }

  // Create database
  private async createDatabase(dbName: string): Promise<void> {
    const dbConfig = this.config;
    await execAsync(`PGPASSWORD="${dbConfig.password}" createdb -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} ${dbName}`);
  }

  // Count tables in database
  private async countTables(dbName?: string): Promise<number> {
    const result = await this.db.query(`
      SELECT COUNT(*) as table_count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    return parseInt(result.rows[0].table_count) || 0;
  }

  // Cleanup old backups
  private async cleanupOldBackups(config: BackupConfig): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - config.retentionDays);
      
      const { stdout } = await execAsync(`find ${config.backupPath} -name "*.sql*" -type f -mtime +${config.retentionDays} -delete`);
      
      logger.info('Old backups cleaned up', {
        retentionDays: config.retentionDays,
        cutoffDate: cutoffDate.toISOString(),
        category: 'database',
        operation: 'cleanup'
      });
    } catch (error) {
      logger.warn('Failed to cleanup old backups', {
        error: error instanceof Error ? error.message : String(error),
        category: 'database',
        operation: 'cleanup'
      });
    }
  }

  // Schedule automated backups
  public scheduleAutomatedBackups(
    cronSchedule: string = '0 2 * * *', // Daily at 2 AM
    backupConfig?: Partial<BackupConfig>
  ): void {
    const cron = require('node-cron');
    
    cron.schedule(cronSchedule, async () => {
      logger.info('Starting scheduled backup', {
        schedule: cronSchedule,
        category: 'database',
        operation: 'scheduled_backup'
      });
      
      try {
        const result = await this.createFullBackup(backupConfig);
        if (result.success) {
          logger.info('Scheduled backup completed successfully', {
            backupPath: result.backupPath,
            size: result.size,
            duration: result.duration,
            category: 'database',
            operation: 'scheduled_backup'
          });
        } else {
          logger.error('Scheduled backup failed', {
            error: result.error,
            category: 'database',
            operation: 'scheduled_backup'
          });
        }
      } catch (error) {
        logger.error('Scheduled backup error', {
          error: error instanceof Error ? error.message : String(error),
          category: 'database',
          operation: 'scheduled_backup'
        });
      }
    });
    
    logger.info('Automated backup scheduling enabled', {
      schedule: cronSchedule,
      category: 'database',
      operation: 'schedule_setup'
    });
  }

  // Verify backup integrity
  public async verifyBackupIntegrity(backupPath: string): Promise<{
    valid: boolean;
    checksum: string;
    error?: string;
  }> {
    try {
      if (!existsSync(backupPath)) {
        return {
          valid: false,
          checksum: '',
          error: 'Backup file not found'
        };
      }

      const checksum = this.calculateFileChecksum(backupPath);
      
      // Basic validation - try to parse if it's SQL
      if (backupPath.endsWith('.sql')) {
        const content = readFileSync(backupPath, 'utf8');
        const hasCreateStatements = content.includes('CREATE TABLE') || content.includes('CREATE FUNCTION');
        
        if (!hasCreateStatements && content.length < 100) {
          return {
            valid: false,
            checksum,
            error: 'Backup file appears to be empty or corrupted'
          };
        }
      }

      return {
        valid: true,
        checksum
      };
    } catch (error) {
      return {
        valid: false,
        checksum: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

// Export singleton instance
export const databaseBackupManager = DatabaseBackupManager.getInstance();

// Convenience functions
export const createFullBackup = (options?: Partial<BackupConfig>) =>
  databaseBackupManager.createFullBackup(options);

export const createIncrementalBackup = (baseBackupPath: string) =>
  databaseBackupManager.createIncrementalBackup(baseBackupPath);

export const restoreFromBackup = (options: RestoreOptions) =>
  databaseBackupManager.restoreFromBackup(options);

export const verifyBackupIntegrity = (backupPath: string) =>
  databaseBackupManager.verifyBackupIntegrity(backupPath);

export const scheduleAutomatedBackups = (cronSchedule?: string, backupConfig?: Partial<BackupConfig>) =>
  databaseBackupManager.scheduleAutomatedBackups(cronSchedule, backupConfig);