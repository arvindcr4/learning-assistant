const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

class FileSystemCache {
  constructor(options = {}) {
    this.cacheDir = options.cacheDir || path.join(process.cwd(), '.next/cache/custom');
    this.maxAge = options.maxAge || 1000 * 60 * 60 * 24; // 24 hours
    this.maxSize = options.maxSize || 100 * 1024 * 1024; // 100MB
    this.currentSize = 0;
    
    this.ensureCacheDir();
  }

  async ensureCacheDir() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }

  generateKey(key) {
    return crypto.createHash('md5').update(key).digest('hex');
  }

  async get(key) {
    try {
      const hashedKey = this.generateKey(key);
      const filePath = path.join(this.cacheDir, hashedKey);
      
      const stats = await fs.stat(filePath);
      const now = Date.now();
      
      // Check if cache is expired
      if (now - stats.mtime.getTime() > this.maxAge) {
        await this.delete(key);
        return null;
      }
      
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  async set(key, value) {
    try {
      const hashedKey = this.generateKey(key);
      const filePath = path.join(this.cacheDir, hashedKey);
      
      const data = JSON.stringify(value);
      const size = Buffer.byteLength(data, 'utf8');
      
      // Check if adding this entry would exceed max size
      if (this.currentSize + size > this.maxSize) {
        await this.cleanup();
      }
      
      await fs.writeFile(filePath, data, 'utf8');
      this.currentSize += size;
      
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  async delete(key) {
    try {
      const hashedKey = this.generateKey(key);
      const filePath = path.join(this.cacheDir, hashedKey);
      
      const stats = await fs.stat(filePath);
      await fs.unlink(filePath);
      this.currentSize -= stats.size;
      
      return true;
    } catch (error) {
      return false;
    }
  }

  async cleanup() {
    try {
      const files = await fs.readdir(this.cacheDir);
      const fileStats = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(this.cacheDir, file);
          const stats = await fs.stat(filePath);
          return { file, path: filePath, mtime: stats.mtime.getTime(), size: stats.size };
        })
      );
      
      // Sort by modification time (oldest first)
      fileStats.sort((a, b) => a.mtime - b.mtime);
      
      // Remove oldest files until we're under the size limit
      let removedSize = 0;
      for (const { path: filePath, size } of fileStats) {
        if (this.currentSize - removedSize <= this.maxSize * 0.8) {
          break;
        }
        
        await fs.unlink(filePath);
        removedSize += size;
      }
      
      this.currentSize -= removedSize;
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }

  async clear() {
    try {
      const files = await fs.readdir(this.cacheDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(this.cacheDir, file)))
      );
      this.currentSize = 0;
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  async getStats() {
    try {
      const files = await fs.readdir(this.cacheDir);
      const totalSize = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(this.cacheDir, file);
          const stats = await fs.stat(filePath);
          return stats.size;
        })
      );
      
      return {
        fileCount: files.length,
        totalSize: totalSize.reduce((a, b) => a + b, 0),
        maxSize: this.maxSize,
        hitRate: this.hitRate || 0,
        missRate: this.missRate || 0
      };
    } catch (error) {
      return { fileCount: 0, totalSize: 0, maxSize: this.maxSize };
    }
  }
}

class IncrementalCacheHandler {
  constructor(options = {}) {
    this.cache = new FileSystemCache(options);
    this.hits = 0;
    this.misses = 0;
  }

  async get(key, fetchValue) {
    const cached = await this.cache.get(key);
    
    if (cached !== null) {
      this.hits++;
      return cached;
    }
    
    this.misses++;
    
    if (fetchValue) {
      const value = await fetchValue();
      await this.cache.set(key, value);
      return value;
    }
    
    return null;
  }

  async set(key, value, options = {}) {
    return await this.cache.set(key, value);
  }

  async delete(key) {
    return await this.cache.delete(key);
  }

  async clear() {
    return await this.cache.clear();
  }

  async getStats() {
    const cacheStats = await this.cache.getStats();
    return {
      ...cacheStats,
      hitRate: this.hits / (this.hits + this.misses) || 0,
      missRate: this.misses / (this.hits + this.misses) || 0,
      totalRequests: this.hits + this.misses
    };
  }
}

module.exports = IncrementalCacheHandler;