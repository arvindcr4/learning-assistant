import LZString from 'lz-string';
import zlib from 'zlib';
import { promisify } from 'util';
import { env } from './env-validation';

// ====================
// TYPES AND INTERFACES
// ====================

export interface CompressionConfig {
  enabled: boolean;
  defaultAlgorithm: CompressionAlgorithm;
  thresholds: {
    minSize: number;
    adaptiveThreshold: number;
    maxSize: number;
  };
  algorithms: {
    [key in CompressionAlgorithm]: CompressionAlgorithmConfig;
  };
  adaptiveMode: boolean;
  performanceTracking: boolean;
}

export type CompressionAlgorithm = 'lz-string' | 'gzip' | 'deflate' | 'brotli' | 'none';

export interface CompressionAlgorithmConfig {
  enabled: boolean;
  level?: number;
  threshold: number;
  priority: number;
  maxConcurrency: number;
  performanceWeight: number;
}

export interface CompressionResult {
  algorithm: CompressionAlgorithm;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  compressionTime: number;
  data: string | Buffer;
  metadata: {
    version: string;
    timestamp: number;
    checksum?: string;
  };
}

export interface CompressionMetrics {
  totalCompressions: number;
  totalDecompressions: number;
  totalBytesProcessed: number;
  totalBytesSaved: number;
  averageCompressionRatio: number;
  averageCompressionTime: number;
  algorithmStats: {
    [key in CompressionAlgorithm]: AlgorithmStats;
  };
  adaptiveDecisions: {
    total: number;
    correct: number;
    accuracy: number;
  };
}

export interface AlgorithmStats {
  usage: number;
  totalSize: number;
  totalCompressed: number;
  averageRatio: number;
  averageTime: number;
  errorCount: number;
  effectiveness: number;
}

export interface CompressionBenchmark {
  algorithm: CompressionAlgorithm;
  dataSize: number;
  compressionTime: number;
  decompressionTime: number;
  compressionRatio: number;
  memoryUsage: number;
  score: number;
}

// ====================
// COMPRESSION MANAGER
// ====================

export class CompressionManager {
  private static instance: CompressionManager;
  private config: CompressionConfig;
  private metrics: CompressionMetrics;
  private benchmarks: Map<string, CompressionBenchmark[]> = new Map();
  private gzipCompress = promisify(zlib.gzip);
  private gzipDecompress = promisify(zlib.gunzip);
  private deflateCompress = promisify(zlib.deflate);
  private deflateDecompress = promisify(zlib.inflate);
  private brotliCompress = promisify(zlib.brotliCompress);
  private brotliDecompress = promisify(zlib.brotliDecompress);

  private constructor() {
    this.config = {
      enabled: env.CACHE_COMPRESSION_ENABLED,
      defaultAlgorithm: 'lz-string',
      thresholds: {
        minSize: env.CACHE_COMPRESSION_THRESHOLD,
        adaptiveThreshold: 10240, // 10KB
        maxSize: 10 * 1024 * 1024, // 10MB
      },
      algorithms: {
        'lz-string': {
          enabled: true,
          threshold: 1024,
          priority: 1,
          maxConcurrency: 100,
          performanceWeight: 0.9,
        },
        'gzip': {
          enabled: true,
          level: 6,
          threshold: 2048,
          priority: 2,
          maxConcurrency: 50,
          performanceWeight: 0.8,
        },
        'deflate': {
          enabled: true,
          level: 6,
          threshold: 2048,
          priority: 3,
          maxConcurrency: 50,
          performanceWeight: 0.75,
        },
        'brotli': {
          enabled: true,
          level: 4,
          threshold: 4096,
          priority: 4,
          maxConcurrency: 25,
          performanceWeight: 0.7,
        },
        'none': {
          enabled: true,
          threshold: 0,
          priority: 999,
          maxConcurrency: 1000,
          performanceWeight: 1.0,
        },
      },
      adaptiveMode: true,
      performanceTracking: true,
    };

    this.metrics = {
      totalCompressions: 0,
      totalDecompressions: 0,
      totalBytesProcessed: 0,
      totalBytesSaved: 0,
      averageCompressionRatio: 0,
      averageCompressionTime: 0,
      algorithmStats: {
        'lz-string': this.createEmptyAlgorithmStats(),
        'gzip': this.createEmptyAlgorithmStats(),
        'deflate': this.createEmptyAlgorithmStats(),
        'brotli': this.createEmptyAlgorithmStats(),
        'none': this.createEmptyAlgorithmStats(),
      },
      adaptiveDecisions: {
        total: 0,
        correct: 0,
        accuracy: 0,
      },
    };

    this.startPerformanceMonitoring();
  }

  public static getInstance(): CompressionManager {
    if (!CompressionManager.instance) {
      CompressionManager.instance = new CompressionManager();
    }
    return CompressionManager.instance;
  }

  /**
   * Compress data using the optimal algorithm
   */
  public async compress(data: any, forceAlgorithm?: CompressionAlgorithm): Promise<CompressionResult> {
    if (!this.config.enabled) {
      return this.createNoCompressionResult(data);
    }

    const serializedData = typeof data === 'string' ? data : JSON.stringify(data);
    const originalSize = Buffer.byteLength(serializedData, 'utf8');

    // Skip compression for small data
    if (originalSize < this.config.thresholds.minSize) {
      return this.createNoCompressionResult(serializedData);
    }

    // Skip compression for very large data
    if (originalSize > this.config.thresholds.maxSize) {
      console.warn(`⚠️ Data size ${originalSize} exceeds max compression size, skipping compression`);
      return this.createNoCompressionResult(serializedData);
    }

    const algorithm = forceAlgorithm || await this.selectOptimalAlgorithm(serializedData, originalSize);
    const startTime = Date.now();

    try {
      const compressedData = await this.executeCompression(serializedData, algorithm);
      const compressionTime = Date.now() - startTime;
      const compressedSize = this.getDataSize(compressedData);
      const compressionRatio = originalSize / compressedSize;

      const result: CompressionResult = {
        algorithm,
        originalSize,
        compressedSize,
        compressionRatio,
        compressionTime,
        data: compressedData,
        metadata: {
          version: '1.0',
          timestamp: Date.now(),
          checksum: this.generateChecksum(serializedData),
        },
      };

      this.updateCompressionMetrics(result);
      return result;
    } catch (error) {
      console.error(`❌ Compression failed with ${algorithm}:`, error);
      this.updateAlgorithmStats(algorithm, originalSize, originalSize, 0, true);
      return this.createNoCompressionResult(serializedData);
    }
  }

  /**
   * Decompress data
   */
  public async decompress(compressedResult: CompressionResult): Promise<string> {
    if (compressedResult.algorithm === 'none') {
      return compressedResult.data as string;
    }

    const startTime = Date.now();

    try {
      const decompressedData = await this.executeDecompression(
        compressedResult.data,
        compressedResult.algorithm
      );
      
      const decompressionTime = Date.now() - startTime;
      
      // Verify checksum if available
      if (compressedResult.metadata.checksum) {
        const calculatedChecksum = this.generateChecksum(decompressedData);
        if (calculatedChecksum !== compressedResult.metadata.checksum) {
          throw new Error('Checksum verification failed');
        }
      }

      this.metrics.totalDecompressions++;
      return decompressedData;
    } catch (error) {
      console.error(`❌ Decompression failed with ${compressedResult.algorithm}:`, error);
      throw error;
    }
  }

  /**
   * Select optimal compression algorithm based on data characteristics
   */
  public async selectOptimalAlgorithm(data: string, size: number): Promise<CompressionAlgorithm> {
    if (!this.config.adaptiveMode) {
      return this.config.defaultAlgorithm;
    }

    // Use cached benchmark results if available
    const dataProfile = this.analyzeDataProfile(data);
    const cachedBenchmark = this.getBestAlgorithmFromCache(dataProfile, size);
    
    if (cachedBenchmark) {
      this.metrics.adaptiveDecisions.total++;
      this.metrics.adaptiveDecisions.correct++; // Assume cached decision is correct
      this.updateAdaptiveAccuracy();
      return cachedBenchmark.algorithm;
    }

    // Perform quick benchmark for small samples
    if (size < this.config.thresholds.adaptiveThreshold) {
      const benchmark = await this.quickBenchmark(data);
      this.cacheBenchmarkResult(dataProfile, benchmark);
      this.metrics.adaptiveDecisions.total++;
      return benchmark.algorithm;
    }

    // Use heuristics for larger data
    const algorithm = this.selectAlgorithmByHeuristics(data, size);
    this.metrics.adaptiveDecisions.total++;
    return algorithm;
  }

  /**
   * Benchmark compression algorithms
   */
  public async benchmarkAlgorithms(testData: string[]): Promise<CompressionBenchmark[]> {
    const benchmarks: CompressionBenchmark[] = [];
    const algorithms = Object.keys(this.config.algorithms)
      .filter(alg => this.config.algorithms[alg as CompressionAlgorithm].enabled && alg !== 'none') as CompressionAlgorithm[];

    for (const algorithm of algorithms) {
      let totalScore = 0;
      let validTests = 0;

      for (const data of testData) {
        try {
          const benchmark = await this.benchmarkSingleAlgorithm(data, algorithm);
          benchmarks.push(benchmark);
          totalScore += benchmark.score;
          validTests++;
        } catch (error) {
          console.warn(`⚠️ Benchmark failed for ${algorithm}:`, error);
        }
      }

      // Calculate average effectiveness
      if (validTests > 0) {
        const avgScore = totalScore / validTests;
        this.config.algorithms[algorithm].performanceWeight = Math.max(0.1, avgScore);
      }
    }

    return benchmarks;
  }

  /**
   * Get compression metrics
   */
  public getMetrics(): CompressionMetrics {
    return { ...this.metrics };
  }

  /**
   * Get configuration
   */
  public getConfig(): CompressionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log('✅ Compression configuration updated');
  }

  // ====================
  // PRIVATE METHODS
  // ====================

  private async executeCompression(data: string, algorithm: CompressionAlgorithm): Promise<string | Buffer> {
    switch (algorithm) {
      case 'lz-string':
        const compressed = LZString.compress(data);
        if (!compressed) throw new Error('LZ-String compression failed');
        return compressed;

      case 'gzip':
        return await this.gzipCompress(Buffer.from(data, 'utf8'), {
          level: this.config.algorithms.gzip.level,
        });

      case 'deflate':
        return await this.deflateCompress(Buffer.from(data, 'utf8'), {
          level: this.config.algorithms.deflate.level,
        });

      case 'brotli':
        return await this.brotliCompress(Buffer.from(data, 'utf8'), {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: this.config.algorithms.brotli.level,
          },
        });

      case 'none':
        return data;

      default:
        throw new Error(`Unsupported compression algorithm: ${algorithm}`);
    }
  }

  private async executeDecompression(data: string | Buffer, algorithm: CompressionAlgorithm): Promise<string> {
    switch (algorithm) {
      case 'lz-string':
        const decompressed = LZString.decompress(data as string);
        if (!decompressed) throw new Error('LZ-String decompression failed');
        return decompressed;

      case 'gzip':
        const gzipResult = await this.gzipDecompress(data as Buffer);
        return gzipResult.toString('utf8');

      case 'deflate':
        const deflateResult = await this.deflateDecompress(data as Buffer);
        return deflateResult.toString('utf8');

      case 'brotli':
        const brotliResult = await this.brotliDecompress(data as Buffer);
        return brotliResult.toString('utf8');

      case 'none':
        return data as string;

      default:
        throw new Error(`Unsupported decompression algorithm: ${algorithm}`);
    }
  }

  private async quickBenchmark(data: string): Promise<CompressionBenchmark> {
    const algorithms = Object.keys(this.config.algorithms)
      .filter(alg => this.config.algorithms[alg as CompressionAlgorithm].enabled && alg !== 'none') as CompressionAlgorithm[];

    let bestBenchmark: CompressionBenchmark | null = null;
    let bestScore = 0;

    for (const algorithm of algorithms) {
      try {
        const benchmark = await this.benchmarkSingleAlgorithm(data, algorithm);
        if (benchmark.score > bestScore) {
          bestScore = benchmark.score;
          bestBenchmark = benchmark;
        }
      } catch (error) {
        console.warn(`⚠️ Quick benchmark failed for ${algorithm}:`, error);
      }
    }

    return bestBenchmark || { 
      algorithm: this.config.defaultAlgorithm,
      dataSize: data.length,
      compressionTime: 0,
      decompressionTime: 0,
      compressionRatio: 1,
      memoryUsage: 0,
      score: 0,
    };
  }

  private async benchmarkSingleAlgorithm(data: string, algorithm: CompressionAlgorithm): Promise<CompressionBenchmark> {
    const startMemory = process.memoryUsage().heapUsed;
    const originalSize = Buffer.byteLength(data, 'utf8');

    // Compression benchmark
    const compressStart = Date.now();
    const compressed = await this.executeCompression(data, algorithm);
    const compressionTime = Date.now() - compressStart;

    const compressedSize = this.getDataSize(compressed);
    const compressionRatio = originalSize / compressedSize;

    // Decompression benchmark
    const decompressStart = Date.now();
    await this.executeDecompression(compressed, algorithm);
    const decompressionTime = Date.now() - decompressStart;

    const endMemory = process.memoryUsage().heapUsed;
    const memoryUsage = endMemory - startMemory;

    // Calculate performance score
    const score = this.calculatePerformanceScore(
      compressionRatio,
      compressionTime,
      decompressionTime,
      memoryUsage,
      originalSize
    );

    return {
      algorithm,
      dataSize: originalSize,
      compressionTime,
      decompressionTime,
      compressionRatio,
      memoryUsage,
      score,
    };
  }

  private calculatePerformanceScore(
    ratio: number,
    compressTime: number,
    decompressTime: number,
    memory: number,
    dataSize: number
  ): number {
    // Normalize metrics
    const ratioScore = Math.min(ratio / 10, 1); // Cap at 10x compression
    const speedScore = Math.max(0, 1 - (compressTime + decompressTime) / 1000); // Penalty for slow compression
    const memoryScore = Math.max(0, 1 - memory / (dataSize * 2)); // Penalty for high memory usage

    // Weighted average
    return (ratioScore * 0.5 + speedScore * 0.3 + memoryScore * 0.2) * 100;
  }

  private analyzeDataProfile(data: string): string {
    const length = data.length;
    const entropy = this.calculateEntropy(data);
    const repetitionRatio = this.calculateRepetitionRatio(data);
    const jsonLike = data.trim().startsWith('{') || data.trim().startsWith('[');
    
    return `${Math.floor(length / 1024)}k_${entropy.toFixed(1)}_${repetitionRatio.toFixed(1)}_${jsonLike}`;
  }

  private calculateEntropy(data: string): number {
    const frequencies = new Map<string, number>();
    for (const char of data) {
      frequencies.set(char, (frequencies.get(char) || 0) + 1);
    }

    let entropy = 0;
    for (const frequency of frequencies.values()) {
      const p = frequency / data.length;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  private calculateRepetitionRatio(data: string): number {
    const chunks = [];
    for (let i = 0; i < data.length; i += 100) {
      chunks.push(data.slice(i, i + 100));
    }

    const uniqueChunks = new Set(chunks);
    return 1 - (uniqueChunks.size / chunks.length);
  }

  private getBestAlgorithmFromCache(profile: string, size: number): CompressionBenchmark | null {
    const benchmarks = this.benchmarks.get(profile);
    if (!benchmarks || benchmarks.length === 0) {
      return null;
    }

    // Find benchmark with similar data size
    const similarBenchmark = benchmarks.find(b => 
      Math.abs(b.dataSize - size) / size < 0.2 // Within 20% of size
    );

    return similarBenchmark || benchmarks[0];
  }

  private cacheBenchmarkResult(profile: string, benchmark: CompressionBenchmark): void {
    if (!this.benchmarks.has(profile)) {
      this.benchmarks.set(profile, []);
    }

    const benchmarks = this.benchmarks.get(profile)!;
    benchmarks.push(benchmark);

    // Keep only last 10 benchmarks per profile
    if (benchmarks.length > 10) {
      benchmarks.splice(0, benchmarks.length - 10);
    }
  }

  private selectAlgorithmByHeuristics(data: string, size: number): CompressionAlgorithm {
    const entropy = this.calculateEntropy(data);
    const repetitionRatio = this.calculateRepetitionRatio(data);

    // High entropy data (random-like) - use faster algorithms
    if (entropy > 7) {
      return size > 10240 ? 'gzip' : 'lz-string';
    }

    // High repetition - use better compression
    if (repetitionRatio > 0.3) {
      return size > 50000 ? 'brotli' : 'gzip';
    }

    // Medium entropy - balanced approach
    if (size > 20480) {
      return 'gzip';
    }

    return 'lz-string';
  }

  private createNoCompressionResult(data: string): CompressionResult {
    const size = Buffer.byteLength(data, 'utf8');
    return {
      algorithm: 'none',
      originalSize: size,
      compressedSize: size,
      compressionRatio: 1,
      compressionTime: 0,
      data,
      metadata: {
        version: '1.0',
        timestamp: Date.now(),
      },
    };
  }

  private getDataSize(data: string | Buffer): number {
    return Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data, 'utf8');
  }

  private generateChecksum(data: string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(data).digest('hex');
  }

  private updateCompressionMetrics(result: CompressionResult): void {
    this.metrics.totalCompressions++;
    this.metrics.totalBytesProcessed += result.originalSize;
    this.metrics.totalBytesSaved += (result.originalSize - result.compressedSize);

    // Update averages
    this.metrics.averageCompressionRatio = 
      ((this.metrics.averageCompressionRatio * (this.metrics.totalCompressions - 1)) + result.compressionRatio) / 
      this.metrics.totalCompressions;

    this.metrics.averageCompressionTime = 
      ((this.metrics.averageCompressionTime * (this.metrics.totalCompressions - 1)) + result.compressionTime) / 
      this.metrics.totalCompressions;

    this.updateAlgorithmStats(
      result.algorithm, 
      result.originalSize, 
      result.compressedSize, 
      result.compressionTime, 
      false
    );
  }

  private updateAlgorithmStats(
    algorithm: CompressionAlgorithm,
    originalSize: number,
    compressedSize: number,
    time: number,
    isError: boolean
  ): void {
    const stats = this.metrics.algorithmStats[algorithm];
    stats.usage++;
    stats.totalSize += originalSize;
    stats.totalCompressed += compressedSize;

    if (isError) {
      stats.errorCount++;
    } else {
      const ratio = originalSize / compressedSize;
      stats.averageRatio = ((stats.averageRatio * (stats.usage - 1)) + ratio) / stats.usage;
      stats.averageTime = ((stats.averageTime * (stats.usage - 1)) + time) / stats.usage;
    }

    // Calculate effectiveness (compression ratio weighted by speed)
    stats.effectiveness = stats.averageRatio * Math.max(0.1, 1 - (stats.averageTime / 1000));
  }

  private updateAdaptiveAccuracy(): void {
    this.metrics.adaptiveDecisions.accuracy = 
      this.metrics.adaptiveDecisions.total > 0 ? 
      this.metrics.adaptiveDecisions.correct / this.metrics.adaptiveDecisions.total : 0;
  }

  private createEmptyAlgorithmStats(): AlgorithmStats {
    return {
      usage: 0,
      totalSize: 0,
      totalCompressed: 0,
      averageRatio: 0,
      averageTime: 0,
      errorCount: 0,
      effectiveness: 0,
    };
  }

  private startPerformanceMonitoring(): void {
    if (!this.config.performanceTracking) return;

    // Monitor and adjust algorithm weights every 5 minutes
    setInterval(() => {
      this.optimizeAlgorithmWeights();
    }, 5 * 60 * 1000);
  }

  private optimizeAlgorithmWeights(): void {
    for (const [algorithm, stats] of Object.entries(this.metrics.algorithmStats)) {
      if (stats.usage > 10) {
        const config = this.config.algorithms[algorithm as CompressionAlgorithm];
        
        // Adjust performance weight based on actual effectiveness
        const newWeight = Math.max(0.1, Math.min(1.0, stats.effectiveness / 100));
        config.performanceWeight = (config.performanceWeight * 0.9) + (newWeight * 0.1);
      }
    }
  }

  /**
   * Shutdown cleanup
   */
  public shutdown(): void {
    this.benchmarks.clear();
    console.log('✅ Compression manager shutdown complete');
  }
}

// ====================
// SINGLETON INSTANCE
// ====================

export const compressionManager = CompressionManager.getInstance();

// ====================
// CONVENIENCE FUNCTIONS
// ====================

/**
 * Compress data
 */
export async function compressData(data: any, algorithm?: CompressionAlgorithm): Promise<CompressionResult> {
  return compressionManager.compress(data, algorithm);
}

/**
 * Decompress data
 */
export async function decompressData(compressedResult: CompressionResult): Promise<string> {
  return compressionManager.decompress(compressedResult);
}

/**
 * Get compression metrics
 */
export function getCompressionMetrics(): CompressionMetrics {
  return compressionManager.getMetrics();
}

/**
 * Benchmark compression algorithms
 */
export async function benchmarkCompression(testData: string[]): Promise<CompressionBenchmark[]> {
  return compressionManager.benchmarkAlgorithms(testData);
}

export default compressionManager;