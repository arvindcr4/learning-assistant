import { env } from '../env-validation';
import LZString from 'lz-string';

// ====================
// TYPES AND INTERFACES
// ====================

export interface CompressionConfig {
  algorithm: 'lz-string' | 'gzip' | 'brotli' | 'zstd' | 'auto';
  level: number; // 1-9 for gzip/brotli, 1-22 for zstd
  threshold: number; // Minimum size in bytes to compress
  maxSize: number; // Maximum size to attempt compression
  enableChunking: boolean;
  chunkSize: number;
  enableAdaptive: boolean;
  performanceTarget: number; // Target compression time in ms
}

export interface CompressionResult {
  algorithm: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  compressionTime: number;
  chunks?: number;
  metadata: {
    version: string;
    timestamp: number;
    checksum?: string;
  };
}

export interface CompressionStats {
  totalCompressions: number;
  totalDecompressions: number;
  totalBytesSaved: number;
  averageCompressionRatio: number;
  averageCompressionTime: number;
  averageDecompressionTime: number;
  algorithmUsage: { [algorithm: string]: number };
  failureRate: number;
  adaptiveOptimizations: number;
}

export interface CompressionBenchmark {
  algorithm: string;
  level: number;
  dataSize: number;
  compressionTime: number;
  decompressionTime: number;
  compressionRatio: number;
  throughput: number; // MB/s
  efficiency: number; // ratio / time
}

// ====================
// COMPRESSION OPTIMIZER
// ====================

export class CompressionOptimizer {
  private static instance: CompressionOptimizer;
  private config: CompressionConfig;
  private stats: CompressionStats;
  private benchmarks: Map<string, CompressionBenchmark[]> = new Map();
  private adaptiveCache: Map<string, string> = new Map(); // Size range -> best algorithm
  private performanceHistory: Map<string, number[]> = new Map();

  private constructor() {
    this.config = {
      algorithm: 'auto',
      level: 6,
      threshold: env.CACHE_COMPRESSION_THRESHOLD || 1024,
      maxSize: 10 * 1024 * 1024, // 10MB
      enableChunking: true,
      chunkSize: 64 * 1024, // 64KB
      enableAdaptive: true,
      performanceTarget: 10, // 10ms target
    };

    this.stats = {
      totalCompressions: 0,
      totalDecompressions: 0,
      totalBytesSaved: 0,
      averageCompressionRatio: 0,
      averageCompressionTime: 0,
      averageDecompressionTime: 0,
      algorithmUsage: {},
      failureRate: 0,
      adaptiveOptimizations: 0,
    };

    this.initializeBenchmarks();
  }

  public static getInstance(): CompressionOptimizer {
    if (!CompressionOptimizer.instance) {
      CompressionOptimizer.instance = new CompressionOptimizer();
    }
    return CompressionOptimizer.instance;
  }

  // ====================
  // COMPRESSION METHODS
  // ====================

  /**
   * Compress data with optimal algorithm selection
   */
  public async compress(
    data: string | Buffer,
    options: Partial<CompressionConfig> = {}
  ): Promise<CompressionResult> {
    const startTime = Date.now();
    const config = { ...this.config, ...options };
    
    // Convert to buffer if needed
    const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    const originalSize = buffer.length;

    // Check if compression is worthwhile
    if (originalSize < config.threshold) {
      throw new Error(`Data size ${originalSize} below compression threshold ${config.threshold}`);
    }

    if (originalSize > config.maxSize) {
      throw new Error(`Data size ${originalSize} exceeds maximum compression size ${config.maxSize}`);
    }

    let algorithm = config.algorithm;
    
    // Auto-select algorithm if requested
    if (algorithm === 'auto') {
      algorithm = this.selectOptimalAlgorithm(originalSize);
    }

    let result: CompressionResult;

    try {
      if (config.enableChunking && originalSize > config.chunkSize) {
        result = await this.compressChunked(buffer, algorithm, config);
      } else {
        result = await this.compressSingle(buffer, algorithm, config);
      }

      // Update statistics
      this.updateCompressionStats(result, startTime);

      // Adaptive optimization
      if (config.enableAdaptive) {
        this.updateAdaptiveCache(originalSize, algorithm, result);
      }

      return result;
    } catch (error) {
      this.stats.failureRate = (this.stats.failureRate * this.stats.totalCompressions + 1) / (this.stats.totalCompressions + 1);
      console.error('Compression failed:', error);
      throw error;
    }
  }

  /**
   * Decompress data
   */
  public async decompress(compressedData: string | Buffer, metadata: CompressionResult): Promise<Buffer> {
    const startTime = Date.now();
    
    try {
      let result: Buffer;

      if (metadata.chunks && metadata.chunks > 1) {
        result = await this.decompressChunked(compressedData, metadata);
      } else {
        result = await this.decompressSingle(compressedData, metadata.algorithm);
      }

      // Update decompression statistics
      const decompressionTime = Date.now() - startTime;
      this.updateDecompressionStats(decompressionTime);

      // Verify integrity if checksum is available
      if (metadata.metadata.checksum) {
        const resultChecksum = this.calculateChecksum(result);
        if (resultChecksum !== metadata.metadata.checksum) {
          throw new Error('Data integrity check failed: checksum mismatch');
        }
      }

      return result;
    } catch (error) {
      console.error('Decompression failed:', error);
      throw error;
    }
  }

  /**
   * Benchmark compression algorithms
   */
  public async benchmarkAlgorithms(
    testData: Buffer[] = [],
    algorithms: string[] = ['lz-string', 'gzip', 'brotli']
  ): Promise<CompressionBenchmark[]> {
    if (testData.length === 0) {
      testData = this.generateTestData();
    }

    const benchmarks: CompressionBenchmark[] = [];

    for (const algorithm of algorithms) {
      for (const data of testData) {
        try {
          const benchmark = await this.benchmarkAlgorithm(algorithm, data);
          benchmarks.push(benchmark);
        } catch (error) {
          console.warn(`Benchmark failed for ${algorithm}:`, error);
        }
      }
    }

    // Store benchmarks
    this.storeBenchmarks(benchmarks);

    return benchmarks;
  }

  /**
   * Get compression statistics
   */
  public getStats(): CompressionStats {
    return { ...this.stats };
  }

  /**
   * Get algorithm recommendations for different data sizes
   */
  public getAlgorithmRecommendations(): {
    [sizeRange: string]: {
      algorithm: string;
      reason: string;
      performance: CompressionBenchmark;
    }
  } {
    const recommendations: any = {};
    const sizeRanges = [
      { name: 'small', min: 0, max: 10240 }, // 0-10KB
      { name: 'medium', min: 10240, max: 102400 }, // 10KB-100KB
      { name: 'large', min: 102400, max: 1048576 }, // 100KB-1MB
      { name: 'xlarge', min: 1048576, max: Infinity }, // 1MB+
    ];

    for (const range of sizeRanges) {
      const benchmark = this.findBestAlgorithm(range.min, range.max);
      if (benchmark) {
        recommendations[range.name] = {
          algorithm: benchmark.algorithm,
          reason: this.getRecommendationReason(benchmark, range),
          performance: benchmark,
        };
      }
    }

    return recommendations;
  }

  // ====================
  // PRIVATE METHODS
  // ====================

  private async compressSingle(
    buffer: Buffer,
    algorithm: string,
    config: CompressionConfig
  ): Promise<CompressionResult> {
    const startTime = Date.now();
    let compressed: Buffer;
    let actualAlgorithm = algorithm;

    switch (algorithm) {
      case 'lz-string':
        compressed = await this.compressLZString(buffer);
        break;
      case 'gzip':
        compressed = await this.compressGzip(buffer, config.level);
        break;
      case 'brotli':
        compressed = await this.compressBrotli(buffer, config.level);
        break;
      case 'zstd':
        compressed = await this.compressZstd(buffer, config.level);
        break;
      default:
        throw new Error(`Unsupported compression algorithm: ${algorithm}`);
    }

    const compressionTime = Date.now() - startTime;
    const compressionRatio = buffer.length / compressed.length;

    return {
      algorithm: actualAlgorithm,
      originalSize: buffer.length,
      compressedSize: compressed.length,
      compressionRatio,
      compressionTime,
      metadata: {
        version: '1.0',
        timestamp: Date.now(),
        checksum: this.calculateChecksum(buffer),
      },
    };
  }

  private async compressChunked(
    buffer: Buffer,
    algorithm: string,
    config: CompressionConfig
  ): Promise<CompressionResult> {
    const chunks: Buffer[] = [];
    const chunkSize = config.chunkSize;
    const totalChunks = Math.ceil(buffer.length / chunkSize);

    let totalCompressedSize = 0;
    const startTime = Date.now();

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, buffer.length);
      const chunk = buffer.slice(start, end);
      
      const compressedChunk = await this.compressSingleChunk(chunk, algorithm, config.level);
      chunks.push(compressedChunk);
      totalCompressedSize += compressedChunk.length;
    }

    const compressionTime = Date.now() - startTime;
    const compressionRatio = buffer.length / totalCompressedSize;

    // Combine chunks with headers
    const combinedBuffer = this.combineChunks(chunks, totalChunks);

    return {
      algorithm,
      originalSize: buffer.length,
      compressedSize: combinedBuffer.length,
      compressionRatio,
      compressionTime,
      chunks: totalChunks,
      metadata: {
        version: '1.0',
        timestamp: Date.now(),
        checksum: this.calculateChecksum(buffer),
      },
    };
  }

  private async decompressSingle(
    compressedData: string | Buffer,
    algorithm: string
  ): Promise<Buffer> {
    const buffer = typeof compressedData === 'string' ? 
      Buffer.from(compressedData, 'base64') : compressedData;

    switch (algorithm) {
      case 'lz-string':
        return this.decompressLZString(buffer);
      case 'gzip':
        return this.decompressGzip(buffer);
      case 'brotli':
        return this.decompressBrotli(buffer);
      case 'zstd':
        return this.decompressZstd(buffer);
      default:
        throw new Error(`Unsupported decompression algorithm: ${algorithm}`);
    }
  }

  private async decompressChunked(
    compressedData: string | Buffer,
    metadata: CompressionResult
  ): Promise<Buffer> {
    const buffer = typeof compressedData === 'string' ? 
      Buffer.from(compressedData, 'base64') : compressedData;

    const chunks = this.extractChunks(buffer, metadata.chunks!);
    const decompressedChunks: Buffer[] = [];

    for (const chunk of chunks) {
      const decompressed = await this.decompressSingle(chunk, metadata.algorithm);
      decompressedChunks.push(decompressed);
    }

    return Buffer.concat(decompressedChunks);
  }

  private async compressLZString(buffer: Buffer): Promise<Buffer> {
    const text = buffer.toString('utf8');
    const compressed = LZString.compress(text);
    if (!compressed) {
      throw new Error('LZ-String compression failed');
    }
    return Buffer.from(compressed, 'utf8');
  }

  private async decompressLZString(buffer: Buffer): Promise<Buffer> {
    const compressed = buffer.toString('utf8');
    const decompressed = LZString.decompress(compressed);
    if (!decompressed) {
      throw new Error('LZ-String decompression failed');
    }
    return Buffer.from(decompressed, 'utf8');
  }

  private async compressGzip(buffer: Buffer, level: number): Promise<Buffer> {
    const zlib = require('zlib');
    return new Promise((resolve, reject) => {
      zlib.gzip(buffer, { level }, (err: Error | null, result: Buffer) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  private async decompressGzip(buffer: Buffer): Promise<Buffer> {
    const zlib = require('zlib');
    return new Promise((resolve, reject) => {
      zlib.gunzip(buffer, (err: Error | null, result: Buffer) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  private async compressBrotli(buffer: Buffer, level: number): Promise<Buffer> {
    const zlib = require('zlib');
    return new Promise((resolve, reject) => {
      zlib.brotliCompress(buffer, { 
        params: { [zlib.constants.BROTLI_PARAM_QUALITY]: level } 
      }, (err: Error | null, result: Buffer) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  private async decompressBrotli(buffer: Buffer): Promise<Buffer> {
    const zlib = require('zlib');
    return new Promise((resolve, reject) => {
      zlib.brotliDecompress(buffer, (err: Error | null, result: Buffer) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  private async compressZstd(buffer: Buffer, level: number): Promise<Buffer> {
    // Note: This would require a zstd library like '@mongodb-js/zstd'
    // For now, fall back to gzip
    console.warn('Zstd compression not available, falling back to gzip');
    return this.compressGzip(buffer, level);
  }

  private async decompressZstd(buffer: Buffer): Promise<Buffer> {
    // Note: This would require a zstd library
    // For now, fall back to gzip
    console.warn('Zstd decompression not available, falling back to gzip');
    return this.decompressGzip(buffer);
  }

  private async compressSingleChunk(
    chunk: Buffer,
    algorithm: string,
    level: number
  ): Promise<Buffer> {
    switch (algorithm) {
      case 'lz-string':
        return this.compressLZString(chunk);
      case 'gzip':
        return this.compressGzip(chunk, level);
      case 'brotli':
        return this.compressBrotli(chunk, level);
      case 'zstd':
        return this.compressZstd(chunk, level);
      default:
        throw new Error(`Unsupported algorithm: ${algorithm}`);
    }
  }

  private combineChunks(chunks: Buffer[], totalChunks: number): Buffer {
    // Create header with chunk count and chunk sizes
    const header = Buffer.alloc(4 + (totalChunks * 4));
    header.writeUInt32BE(totalChunks, 0);
    
    let offset = 4;
    for (let i = 0; i < chunks.length; i++) {
      header.writeUInt32BE(chunks[i].length, offset);
      offset += 4;
    }

    return Buffer.concat([header, ...chunks]);
  }

  private extractChunks(buffer: Buffer, expectedChunks: number): Buffer[] {
    const chunks: Buffer[] = [];
    const chunkCount = buffer.readUInt32BE(0);
    
    if (chunkCount !== expectedChunks) {
      throw new Error(`Chunk count mismatch: expected ${expectedChunks}, got ${chunkCount}`);
    }

    let offset = 4;
    const chunkSizes: number[] = [];
    
    // Read chunk sizes
    for (let i = 0; i < chunkCount; i++) {
      chunkSizes.push(buffer.readUInt32BE(offset));
      offset += 4;
    }

    // Extract chunks
    for (const size of chunkSizes) {
      chunks.push(buffer.slice(offset, offset + size));
      offset += size;
    }

    return chunks;
  }

  private calculateChecksum(buffer: Buffer): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private selectOptimalAlgorithm(dataSize: number): string {
    // Check adaptive cache first
    const sizeRange = this.getSizeRange(dataSize);
    const cachedAlgorithm = this.adaptiveCache.get(sizeRange);
    if (cachedAlgorithm) {
      return cachedAlgorithm;
    }

    // Use benchmarks to select algorithm
    const bestBenchmark = this.findBestAlgorithm(dataSize, dataSize + 1);
    if (bestBenchmark) {
      return bestBenchmark.algorithm;
    }

    // Default algorithm selection based on size
    if (dataSize < 10240) { // < 10KB
      return 'lz-string'; // Fast for small data
    } else if (dataSize < 102400) { // < 100KB
      return 'gzip'; // Good balance
    } else {
      return 'brotli'; // Better compression for large data
    }
  }

  private getSizeRange(size: number): string {
    if (size < 10240) return 'small';
    if (size < 102400) return 'medium';
    if (size < 1048576) return 'large';
    return 'xlarge';
  }

  private findBestAlgorithm(minSize: number, maxSize: number): CompressionBenchmark | null {
    let bestBenchmark: CompressionBenchmark | null = null;
    let bestScore = 0;

    for (const benchmarks of this.benchmarks.values()) {
      for (const benchmark of benchmarks) {
        if (benchmark.dataSize >= minSize && benchmark.dataSize <= maxSize) {
          // Score based on efficiency (compression ratio / time)
          const score = benchmark.efficiency;
          if (score > bestScore) {
            bestScore = score;
            bestBenchmark = benchmark;
          }
        }
      }
    }

    return bestBenchmark;
  }

  private async benchmarkAlgorithm(algorithm: string, data: Buffer): Promise<CompressionBenchmark> {
    const startCompress = Date.now();
    const compressed = await this.compressSingleChunk(data, algorithm, this.config.level);
    const compressionTime = Date.now() - startCompress;

    const startDecompress = Date.now();
    await this.decompressSingle(compressed, algorithm);
    const decompressionTime = Date.now() - startDecompress;

    const compressionRatio = data.length / compressed.length;
    const throughput = (data.length / 1024 / 1024) / (compressionTime / 1000); // MB/s
    const efficiency = compressionRatio / (compressionTime + decompressionTime);

    return {
      algorithm,
      level: this.config.level,
      dataSize: data.length,
      compressionTime,
      decompressionTime,
      compressionRatio,
      throughput,
      efficiency,
    };
  }

  private generateTestData(): Buffer[] {
    const testData: Buffer[] = [];
    
    // Generate different types of test data
    const sizes = [1024, 10240, 102400, 1048576]; // 1KB, 10KB, 100KB, 1MB
    const patterns = ['random', 'repetitive', 'text', 'json'];

    for (const size of sizes) {
      for (const pattern of patterns) {
        testData.push(this.generateTestDataPattern(size, pattern));
      }
    }

    return testData;
  }

  private generateTestDataPattern(size: number, pattern: string): Buffer {
    switch (pattern) {
      case 'random':
        return Buffer.from(Array.from({ length: size }, () => 
          Math.floor(Math.random() * 256)
        ));
      
      case 'repetitive':
        const repeatStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        return Buffer.from(repeatStr.repeat(Math.ceil(size / repeatStr.length)).slice(0, size));
      
      case 'text':
        const text = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ';
        return Buffer.from(text.repeat(Math.ceil(size / text.length)).slice(0, size));
      
      case 'json':
        const obj = {
          id: Math.random().toString(36),
          name: 'Test Object',
          data: Array.from({ length: 100 }, (_, i) => ({
            index: i,
            value: Math.random(),
            text: 'Sample text data for testing compression',
          }))
        };
        const json = JSON.stringify(obj);
        return Buffer.from(json.repeat(Math.ceil(size / json.length)).slice(0, size));
      
      default:
        return Buffer.alloc(size, 0);
    }
  }

  private storeBenchmarks(benchmarks: CompressionBenchmark[]): void {
    for (const benchmark of benchmarks) {
      const key = `${benchmark.algorithm}_${benchmark.level}`;
      if (!this.benchmarks.has(key)) {
        this.benchmarks.set(key, []);
      }
      this.benchmarks.get(key)!.push(benchmark);
    }
  }

  private updateCompressionStats(result: CompressionResult, startTime: number): void {
    this.stats.totalCompressions++;
    this.stats.totalBytesSaved += (result.originalSize - result.compressedSize);
    
    // Update averages
    this.stats.averageCompressionRatio = 
      (this.stats.averageCompressionRatio * (this.stats.totalCompressions - 1) + result.compressionRatio) / 
      this.stats.totalCompressions;
    
    this.stats.averageCompressionTime = 
      (this.stats.averageCompressionTime * (this.stats.totalCompressions - 1) + result.compressionTime) / 
      this.stats.totalCompressions;

    // Update algorithm usage
    this.stats.algorithmUsage[result.algorithm] = 
      (this.stats.algorithmUsage[result.algorithm] || 0) + 1;
  }

  private updateDecompressionStats(decompressionTime: number): void {
    this.stats.totalDecompressions++;
    this.stats.averageDecompressionTime = 
      (this.stats.averageDecompressionTime * (this.stats.totalDecompressions - 1) + decompressionTime) / 
      this.stats.totalDecompressions;
  }

  private updateAdaptiveCache(
    originalSize: number,
    algorithm: string,
    result: CompressionResult
  ): void {
    const sizeRange = this.getSizeRange(originalSize);
    const performanceKey = `${sizeRange}_${algorithm}`;
    
    if (!this.performanceHistory.has(performanceKey)) {
      this.performanceHistory.set(performanceKey, []);
    }
    
    const history = this.performanceHistory.get(performanceKey)!;
    const efficiency = result.compressionRatio / result.compressionTime;
    history.push(efficiency);
    
    // Keep only recent history
    if (history.length > 10) {
      history.shift();
    }
    
    // Update adaptive cache with best performing algorithm
    const avgEfficiency = history.reduce((a, b) => a + b, 0) / history.length;
    const currentBest = this.adaptiveCache.get(sizeRange);
    
    if (!currentBest) {
      this.adaptiveCache.set(sizeRange, algorithm);
      this.stats.adaptiveOptimizations++;
    } else {
      const currentBestKey = `${sizeRange}_${currentBest}`;
      const currentBestHistory = this.performanceHistory.get(currentBestKey);
      
      if (currentBestHistory) {
        const currentBestEfficiency = 
          currentBestHistory.reduce((a, b) => a + b, 0) / currentBestHistory.length;
        
        if (avgEfficiency > currentBestEfficiency) {
          this.adaptiveCache.set(sizeRange, algorithm);
          this.stats.adaptiveOptimizations++;
        }
      }
    }
  }

  private getRecommendationReason(
    benchmark: CompressionBenchmark,
    range: { name: string; min: number; max: number }
  ): string {
    if (benchmark.efficiency > 1.0) {
      return `Best efficiency (${benchmark.efficiency.toFixed(2)}) for ${range.name} data`;
    } else if (benchmark.compressionRatio > 2.0) {
      return `Best compression ratio (${benchmark.compressionRatio.toFixed(2)}:1) for ${range.name} data`;
    } else if (benchmark.throughput > 10) {
      return `Best throughput (${benchmark.throughput.toFixed(2)} MB/s) for ${range.name} data`;
    } else {
      return `Balanced performance for ${range.name} data`;
    }
  }

  private initializeBenchmarks(): void {
    // Run initial benchmarks asynchronously
    setTimeout(async () => {
      try {
        console.log('🔧 Running compression algorithm benchmarks...');
        await this.benchmarkAlgorithms();
        console.log('✅ Compression benchmarks completed');
      } catch (error) {
        console.warn('⚠️ Compression benchmarks failed:', error);
      }
    }, 1000);
  }

  /**
   * Configure compression settings
   */
  public configure(config: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('🔧 Compression configuration updated');
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      totalCompressions: 0,
      totalDecompressions: 0,
      totalBytesSaved: 0,
      averageCompressionRatio: 0,
      averageCompressionTime: 0,
      averageDecompressionTime: 0,
      algorithmUsage: {},
      failureRate: 0,
      adaptiveOptimizations: 0,
    };
  }
}

// ====================
// SINGLETON INSTANCE
// ====================

export const compressionOptimizer = CompressionOptimizer.getInstance();

// ====================
// CONVENIENCE FUNCTIONS
// ====================

/**
 * Compress data with optimal settings
 */
export async function compressData(
  data: string | Buffer,
  options?: Partial<CompressionConfig>
): Promise<{ compressed: string; metadata: CompressionResult }> {
  const result = await compressionOptimizer.compress(data, options);
  const compressed = typeof data === 'string' ? 
    result.compressedSize.toString() : 
    Buffer.from(data).toString('base64');
  
  return { compressed, metadata: result };
}

/**
 * Decompress data
 */
export async function decompressData(
  compressedData: string,
  metadata: CompressionResult
): Promise<string> {
  const buffer = await compressionOptimizer.decompress(compressedData, metadata);
  return buffer.toString('utf8');
}

/**
 * Check if data should be compressed
 */
export function shouldCompress(data: string | Buffer, threshold?: number): boolean {
  const size = typeof data === 'string' ? Buffer.byteLength(data, 'utf8') : data.length;
  const compressionThreshold = threshold || env.CACHE_COMPRESSION_THRESHOLD || 1024;
  return size >= compressionThreshold;
}

/**
 * Get compression statistics
 */
export function getCompressionStats(): CompressionStats {
  return compressionOptimizer.getStats();
}

export default compressionOptimizer;