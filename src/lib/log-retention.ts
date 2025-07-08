import { promises as fs } from 'fs';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';

// Log retention policy configuration
export interface LogRetentionPolicy {
  category: string;
  retentionDays: number;
  compressionEnabled: boolean;
  compressionAfterDays: number;
  archiveLocation?: string;
  deleteAfterArchive: boolean;
  maxTotalSize?: string; // e.g., "1GB", "500MB"
  maxFileSize?: string; // e.g., "100MB", "50MB"
}

// Default retention policies by log category
export const defaultRetentionPolicies: LogRetentionPolicy[] = [
  {
    category: 'security',
    retentionDays: 2555, // 7 years for compliance
    compressionEnabled: true,
    compressionAfterDays: 30,
    deleteAfterArchive: false,
    maxFileSize: '100MB',
  },
  {
    category: 'audit',
    retentionDays: 2555, // 7 years for compliance
    compressionEnabled: true,
    compressionAfterDays: 30,
    deleteAfterArchive: false,
    maxFileSize: '100MB',
  },
  {
    category: 'error',
    retentionDays: 365, // 1 year
    compressionEnabled: true,
    compressionAfterDays: 7,
    deleteAfterArchive: true,
    maxFileSize: '50MB',
  },
  {
    category: 'application',
    retentionDays: 90, // 3 months
    compressionEnabled: true,
    compressionAfterDays: 7,
    deleteAfterArchive: true,
    maxFileSize: '50MB',
  },
  {
    category: 'http',
    retentionDays: 30, // 1 month
    compressionEnabled: true,
    compressionAfterDays: 3,
    deleteAfterArchive: true,
    maxFileSize: '50MB',
  },
  {
    category: 'performance',
    retentionDays: 30, // 1 month
    compressionEnabled: true,
    compressionAfterDays: 7,
    deleteAfterArchive: true,
    maxFileSize: '25MB',
  },
  {
    category: 'debug',
    retentionDays: 7, // 1 week
    compressionEnabled: true,
    compressionAfterDays: 1,
    deleteAfterArchive: true,
    maxFileSize: '25MB',
  },
];

// File size utility functions
function parseSize(sizeStr: string): number {
  const units: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  };
  
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([A-Z]+)$/i);
  if (!match) {
    throw new Error(`Invalid size format: ${sizeStr}`);
  }
  
  const [, value, unit] = match;
  const multiplier = units[unit.toUpperCase()];
  
  if (!multiplier) {
    throw new Error(`Unknown size unit: ${unit}`);
  }
  
  return parseFloat(value) * multiplier;
}

async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

async function getDirectorySize(dirPath: string): Promise<number> {
  try {
    const files = await fs.readdir(dirPath);
    let totalSize = 0;
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile()) {
        totalSize += stats.size;
      } else if (stats.isDirectory()) {
        totalSize += await getDirectorySize(filePath);
      }
    }
    
    return totalSize;
  } catch {
    return 0;
  }
}

// Log retention manager
export class LogRetentionManager {
  private static instance: LogRetentionManager;
  private policies: Map<string, LogRetentionPolicy> = new Map();
  private logDirectory: string;
  private archiveDirectory: string;
  
  private constructor(logDir: string = 'logs', archiveDir: string = 'logs/archive') {
    this.logDirectory = logDir;
    this.archiveDirectory = archiveDir;
    this.loadDefaultPolicies();
  }
  
  static getInstance(logDir?: string, archiveDir?: string): LogRetentionManager {
    if (!LogRetentionManager.instance) {
      LogRetentionManager.instance = new LogRetentionManager(logDir, archiveDir);
    }
    return LogRetentionManager.instance;
  }
  
  // Load default retention policies
  private loadDefaultPolicies(): void {
    for (const policy of defaultRetentionPolicies) {
      this.policies.set(policy.category, policy);
    }
  }
  
  // Add or update retention policy
  setPolicy(policy: LogRetentionPolicy): void {
    this.policies.set(policy.category, policy);
  }
  
  // Get retention policy for category
  getPolicy(category: string): LogRetentionPolicy | undefined {
    return this.policies.get(category);
  }
  
  // Get all policies
  getAllPolicies(): LogRetentionPolicy[] {
    return Array.from(this.policies.values());
  }
  
  // Ensure directories exist
  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.logDirectory, { recursive: true });
      await fs.mkdir(this.archiveDirectory, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directories:', error);
    }
  }
  
  // Compress log file
  private async compressFile(filePath: string): Promise<string> {
    const compressedPath = `${filePath}.gz`;
    
    try {
      const readStream = createReadStream(filePath);
      const writeStream = createWriteStream(compressedPath);
      const gzipStream = createGzip();
      
      await pipeline(readStream, gzipStream, writeStream);
      
      // Remove original file after successful compression
      await fs.unlink(filePath);
      
      return compressedPath;
    } catch (error) {
      console.error(`Failed to compress ${filePath}:`, error);
      throw error;
    }
  }
  
  // Archive log file
  private async archiveFile(filePath: string, policy: LogRetentionPolicy): Promise<void> {
    const fileName = path.basename(filePath);
    const archivePath = path.join(
      policy.archiveLocation || this.archiveDirectory,
      policy.category,
      fileName
    );
    
    try {
      // Ensure archive directory exists
      await fs.mkdir(path.dirname(archivePath), { recursive: true });
      
      // Move file to archive
      await fs.rename(filePath, archivePath);
      
      console.log(`Archived log file: ${filePath} -> ${archivePath}`);
    } catch (error) {
      console.error(`Failed to archive ${filePath}:`, error);
      throw error;
    }
  }
  
  // Delete old log files
  private async deleteOldFiles(dirPath: string, maxAgeDays: number): Promise<string[]> {
    const deletedFiles: string[] = [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
    
    try {
      const files = await fs.readdir(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile() && stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          deletedFiles.push(filePath);
          console.log(`Deleted old log file: ${filePath}`);
        }
      }
    } catch (error) {
      console.error(`Failed to delete old files in ${dirPath}:`, error);
    }
    
    return deletedFiles;
  }
  
  // Clean up logs based on size limits
  private async cleanupBySize(dirPath: string, maxSize: number): Promise<string[]> {
    const deletedFiles: string[] = [];
    
    try {
      const files = await fs.readdir(dirPath);
      const fileStats = [];
      
      // Get file stats and sort by modification time (oldest first)
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          fileStats.push({ path: filePath, size: stats.size, mtime: stats.mtime });
        }
      }
      
      fileStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
      
      let totalSize = fileStats.reduce((sum, file) => sum + file.size, 0);
      
      // Delete oldest files until under size limit
      for (const file of fileStats) {
        if (totalSize <= maxSize) break;
        
        await fs.unlink(file.path);
        deletedFiles.push(file.path);
        totalSize -= file.size;
        console.log(`Deleted log file for size limit: ${file.path}`);
      }
    } catch (error) {
      console.error(`Failed to cleanup by size in ${dirPath}:`, error);
    }
    
    return deletedFiles;
  }
  
  // Apply retention policy to log files
  async applyRetentionPolicy(category: string): Promise<{
    compressed: string[];
    archived: string[];
    deleted: string[];
  }> {
    const policy = this.policies.get(category);
    if (!policy) {
      console.warn(`No retention policy found for category: ${category}`);
      return { compressed: [], archived: [], deleted: [] };
    }
    
    await this.ensureDirectories();
    
    const compressed: string[] = [];
    const archived: string[] = [];
    const deleted: string[] = [];
    
    const categoryDir = path.join(this.logDirectory, category);
    
    try {
      // Check if category directory exists
      await fs.access(categoryDir);
    } catch {
      // Directory doesn't exist, nothing to do
      return { compressed, archived, deleted };
    }
    
    try {
      const files = await fs.readdir(categoryDir);
      const now = new Date();
      
      for (const file of files) {
        const filePath = path.join(categoryDir, file);
        const stats = await fs.stat(filePath);
        
        if (!stats.isFile()) continue;
        
        const ageInDays = (now.getTime() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
        
        // Check if file should be deleted
        if (ageInDays > policy.retentionDays) {
          if (policy.archiveLocation && !policy.deleteAfterArchive) {
            await this.archiveFile(filePath, policy);
            archived.push(filePath);
          } else {
            await fs.unlink(filePath);
            deleted.push(filePath);
          }
          continue;
        }
        
        // Check if file should be compressed
        if (
          policy.compressionEnabled &&
          ageInDays > policy.compressionAfterDays &&
          !file.endsWith('.gz')
        ) {
          const compressedPath = await this.compressFile(filePath);
          compressed.push(compressedPath);
          continue;
        }
        
        // Check file size limits
        if (policy.maxFileSize) {
          const maxSize = parseSize(policy.maxFileSize);
          if (stats.size > maxSize) {
            // For oversized files, compress or archive them
            if (policy.compressionEnabled && !file.endsWith('.gz')) {
              const compressedPath = await this.compressFile(filePath);
              compressed.push(compressedPath);
            } else if (policy.archiveLocation) {
              await this.archiveFile(filePath, policy);
              archived.push(filePath);
            }
          }
        }
      }
      
      // Check total directory size
      if (policy.maxTotalSize) {
        const maxTotalSize = parseSize(policy.maxTotalSize);
        const currentSize = await getDirectorySize(categoryDir);
        
        if (currentSize > maxTotalSize) {
          const deletedBySizeLimit = await this.cleanupBySize(categoryDir, maxTotalSize);
          deleted.push(...deletedBySizeLimit);
        }
      }
    } catch (error) {
      console.error(`Failed to apply retention policy for ${category}:`, error);
    }
    
    return { compressed, archived, deleted };
  }
  
  // Apply all retention policies
  async applyAllPolicies(): Promise<Record<string, {
    compressed: string[];
    archived: string[];
    deleted: string[];
  }>> {
    const results: Record<string, any> = {};
    
    for (const [category] of this.policies) {
      try {
        results[category] = await this.applyRetentionPolicy(category);
      } catch (error) {
        console.error(`Failed to apply retention policy for ${category}:`, error);
        results[category] = { compressed: [], archived: [], deleted: [], error: error.message };
      }
    }
    
    return results;
  }
  
  // Get retention status
  async getRetentionStatus(): Promise<{
    categories: Record<string, {
      policy: LogRetentionPolicy;
      fileCount: number;
      totalSize: string;
      oldestFile?: string;
      newestFile?: string;
    }>;
    totalLogSize: string;
  }> {
    const categories: Record<string, any> = {};
    let totalLogSize = 0;
    
    for (const [category, policy] of this.policies) {
      const categoryDir = path.join(this.logDirectory, category);
      
      try {
        await fs.access(categoryDir);
        const files = await fs.readdir(categoryDir);
        const fileStats = [];
        
        for (const file of files) {
          const filePath = path.join(categoryDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.isFile()) {
            fileStats.push({ name: file, size: stats.size, mtime: stats.mtime });
          }
        }
        
        const categorySize = fileStats.reduce((sum, file) => sum + file.size, 0);
        totalLogSize += categorySize;
        
        fileStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
        
        categories[category] = {
          policy,
          fileCount: fileStats.length,
          totalSize: this.formatSize(categorySize),
          oldestFile: fileStats[0]?.name,
          newestFile: fileStats[fileStats.length - 1]?.name,
        };
      } catch {
        categories[category] = {
          policy,
          fileCount: 0,
          totalSize: '0 B',
        };
      }
    }
    
    return {
      categories,
      totalLogSize: this.formatSize(totalLogSize),
    };
  }
  
  // Format file size for display
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
  
  // Schedule automatic retention cleanup
  scheduleCleanup(intervalHours: number = 24): NodeJS.Timeout {
    const intervalMs = intervalHours * 60 * 60 * 1000;
    
    return setInterval(async () => {
      console.log('Running scheduled log retention cleanup...');
      try {
        const results = await this.applyAllPolicies();
        console.log('Log retention cleanup completed:', results);
      } catch (error) {
        console.error('Scheduled log retention cleanup failed:', error);
      }
    }, intervalMs);
  }
}

// Singleton instance
export const logRetentionManager = LogRetentionManager.getInstance();

// Utility functions
export const retentionUtils = {
  // Validate retention policy
  validatePolicy: (policy: LogRetentionPolicy): string[] => {
    const errors: string[] = [];
    
    if (!policy.category) {
      errors.push('Category is required');
    }
    
    if (policy.retentionDays <= 0) {
      errors.push('Retention days must be positive');
    }
    
    if (policy.compressionAfterDays < 0) {
      errors.push('Compression after days cannot be negative');
    }
    
    if (policy.compressionAfterDays >= policy.retentionDays) {
      errors.push('Compression after days must be less than retention days');
    }
    
    try {
      if (policy.maxFileSize) {
        parseSize(policy.maxFileSize);
      }
      if (policy.maxTotalSize) {
        parseSize(policy.maxTotalSize);
      }
    } catch (error) {
      errors.push(`Invalid size format: ${error.message}`);
    }
    
    return errors;
  },
  
  // Create policy from environment variables
  createPolicyFromEnv: (category: string): LogRetentionPolicy | null => {
    const envPrefix = `LOG_RETENTION_${category.toUpperCase()}`;
    
    const retentionDays = process.env[`${envPrefix}_DAYS`];
    if (!retentionDays) return null;
    
    return {
      category,
      retentionDays: parseInt(retentionDays, 10),
      compressionEnabled: process.env[`${envPrefix}_COMPRESSION`] === 'true',
      compressionAfterDays: parseInt(
        process.env[`${envPrefix}_COMPRESSION_AFTER`] || '7',
        10
      ),
      archiveLocation: process.env[`${envPrefix}_ARCHIVE_PATH`],
      deleteAfterArchive: process.env[`${envPrefix}_DELETE_AFTER_ARCHIVE`] !== 'false',
      maxTotalSize: process.env[`${envPrefix}_MAX_TOTAL_SIZE`],
      maxFileSize: process.env[`${envPrefix}_MAX_FILE_SIZE`],
    };
  },
  
  // Initialize policies from environment
  initializePoliciesFromEnv: (): void => {
    const categories = ['security', 'audit', 'error', 'application', 'http', 'performance', 'debug'];
    
    for (const category of categories) {
      const policy = retentionUtils.createPolicyFromEnv(category);
      if (policy) {
        const errors = retentionUtils.validatePolicy(policy);
        if (errors.length === 0) {
          logRetentionManager.setPolicy(policy);
        } else {
          console.error(`Invalid retention policy for ${category}:`, errors);
        }
      }
    }
  },
};

// Export types
export type { LogRetentionPolicy };