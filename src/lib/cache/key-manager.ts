import { env } from '../env-validation';
import { executeRedisCommand } from '../redis-client';
import { distributedCache } from './distributed-cache-service';

// ====================
// TYPES AND INTERFACES
// ====================

export interface CacheKeyPattern {
  name: string;
  pattern: string;
  description: string;
  namespace: string;
  ttl: number;
  tags: string[];
  compression: boolean;
  versioning: boolean;
  encryption: boolean;
  accessPattern: 'read-heavy' | 'write-heavy' | 'balanced';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface CacheNamespace {
  name: string;
  description: string;
  prefix: string;
  defaultTTL: number;
  maxSize?: number;
  evictionPolicy: 'lru' | 'lfu' | 'fifo' | 'ttl';
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  replicationStrategy: 'sync' | 'async' | 'none';
  tags: string[];
  accessControl: {
    read: string[];
    write: string[];
    admin: string[];
  };
}

export interface KeyMetadata {
  key: string;
  namespace: string;
  pattern: string;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  size: number;
  ttl: number;
  tags: string[];
  version: string;
  compressed: boolean;
  encrypted: boolean;
  dependencies: string[];
}

export interface KeyValidationRule {
  name: string;
  pattern: RegExp;
  required: boolean;
  validator: (key: string) => boolean;
  sanitizer?: (key: string) => string;
  errorMessage: string;
}

export interface KeyGenerationStrategy {
  type: 'template' | 'hash' | 'uuid' | 'sequence' | 'custom';
  template?: string;
  hashAlgorithm?: 'md5' | 'sha1' | 'sha256';
  customGenerator?: (params: any) => string;
  includeTimestamp?: boolean;
  includeRandomSuffix?: boolean;
}

export interface KeyAnalytics {
  namespace: string;
  totalKeys: number;
  activeKeys: number;
  expiredKeys: number;
  averageSize: number;
  totalSize: number;
  accessPatterns: {
    pattern: string;
    count: number;
    avgAccessFrequency: number;
    lastAccessed: number;
  }[];
  hotKeys: {
    key: string;
    accessCount: number;
    lastAccessed: number;
  }[];
  coldKeys: {
    key: string;
    accessCount: number;
    lastAccessed: number;
  }[];
  memoryUsage: number;
}

// ====================
// CACHE KEY MANAGER
// ====================

export class CacheKeyManager {
  private static instance: CacheKeyManager;
  private namespaces: Map<string, CacheNamespace> = new Map();
  private keyPatterns: Map<string, CacheKeyPattern> = new Map();
  private validationRules: Map<string, KeyValidationRule> = new Map();
  private keyMetadata: Map<string, KeyMetadata> = new Map();
  private keyAnalytics: Map<string, KeyAnalytics> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private analyticsInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.initializeDefaultNamespaces();
    this.initializeDefaultPatterns();
    this.initializeValidationRules();
    this.startCleanupTasks();
    this.startAnalyticsCollection();
  }

  public static getInstance(): CacheKeyManager {
    if (!CacheKeyManager.instance) {
      CacheKeyManager.instance = new CacheKeyManager();
    }
    return CacheKeyManager.instance;
  }

  // ====================
  // NAMESPACE MANAGEMENT
  // ====================

  /**
   * Register a new cache namespace
   */
  public registerNamespace(namespace: CacheNamespace): void {
    this.namespaces.set(namespace.name, namespace);
    console.log(`✅ Registered cache namespace: ${namespace.name}`);
  }

  /**
   * Get namespace configuration
   */
  public getNamespace(name: string): CacheNamespace | null {
    return this.namespaces.get(name) || null;
  }

  /**
   * List all namespaces
   */
  public listNamespaces(): CacheNamespace[] {
    return Array.from(this.namespaces.values());
  }

  /**
   * Update namespace configuration
   */
  public updateNamespace(name: string, updates: Partial<CacheNamespace>): boolean {
    const namespace = this.namespaces.get(name);
    if (!namespace) return false;

    const updated = { ...namespace, ...updates };
    this.namespaces.set(name, updated);
    return true;
  }

  // ====================
  // KEY PATTERN MANAGEMENT
  // ====================

  /**
   * Register a new key pattern
   */
  public registerKeyPattern(pattern: CacheKeyPattern): void {
    this.keyPatterns.set(pattern.name, pattern);
    console.log(`✅ Registered key pattern: ${pattern.name}`);
  }

  /**
   * Get key pattern
   */
  public getKeyPattern(name: string): CacheKeyPattern | null {
    return this.keyPatterns.get(name) || null;
  }

  /**
   * List all key patterns
   */
  public listKeyPatterns(): CacheKeyPattern[] {
    return Array.from(this.keyPatterns.values());
  }

  /**
   * Find patterns matching a namespace
   */
  public getPatternsByNamespace(namespace: string): CacheKeyPattern[] {
    return Array.from(this.keyPatterns.values()).filter(p => p.namespace === namespace);
  }

  // ====================
  // KEY GENERATION
  // ====================

  /**
   * Generate a cache key using a strategy
   */
  public generateKey(
    strategy: KeyGenerationStrategy,
    params: { [key: string]: any } = {},
    namespace?: string
  ): string {
    let key: string;

    switch (strategy.type) {
      case 'template':
        key = this.generateFromTemplate(strategy.template!, params);
        break;
      case 'hash':
        key = this.generateHashKey(params, strategy.hashAlgorithm || 'sha256');
        break;
      case 'uuid':
        key = this.generateUUIDKey();
        break;
      case 'sequence':
        key = this.generateSequenceKey(namespace);
        break;
      case 'custom':
        if (!strategy.customGenerator) {
          throw new Error('Custom generator function is required for custom strategy');
        }
        key = strategy.customGenerator(params);
        break;
      default:
        throw new Error(`Unknown key generation strategy: ${strategy.type}`);
    }

    // Add timestamp if requested
    if (strategy.includeTimestamp) {
      key = `${key}:${Date.now()}`;
    }

    // Add random suffix if requested
    if (strategy.includeRandomSuffix) {
      const suffix = Math.random().toString(36).substring(2, 8);
      key = `${key}:${suffix}`;
    }

    return this.sanitizeKey(key);
  }

  /**
   * Build a fully qualified key with namespace
   */
  public buildKey(
    key: string,
    namespace: string = 'default',
    options: {
      validate?: boolean;
      pattern?: string;
      tags?: string[];
    } = {}
  ): string {
    const ns = this.namespaces.get(namespace);
    if (!ns) {
      throw new Error(`Unknown namespace: ${namespace}`);
    }

    // Validate key if requested
    if (options.validate !== false) {
      this.validateKey(key, namespace, options.pattern);
    }

    // Build the full key
    const fullKey = `${ns.prefix}:${key}`;

    // Store metadata
    this.storeKeyMetadata(fullKey, {
      key,
      namespace,
      pattern: options.pattern || 'unknown',
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 0,
      size: 0,
      ttl: ns.defaultTTL,
      tags: options.tags || [],
      version: '1.0',
      compressed: ns.compressionEnabled,
      encrypted: ns.encryptionEnabled,
      dependencies: [],
    });

    return fullKey;
  }

  /**
   * Parse a full key into components
   */
  public parseKey(fullKey: string): {
    namespace: string;
    key: string;
    prefix: string;
  } | null {
    for (const namespace of this.namespaces.values()) {
      if (fullKey.startsWith(namespace.prefix + ':')) {
        return {
          namespace: namespace.name,
          key: fullKey.substring(namespace.prefix.length + 1),
          prefix: namespace.prefix,
        };
      }
    }
    return null;
  }

  // ====================
  // KEY VALIDATION
  // ====================

  /**
   * Validate a cache key
   */
  public validateKey(key: string, namespace?: string, pattern?: string): boolean {
    // Basic key validation
    if (!key || typeof key !== 'string') {
      throw new Error('Key must be a non-empty string');
    }

    if (key.length > 250) {
      throw new Error('Key length must not exceed 250 characters');
    }

    // Check for invalid characters
    if (/[\s\r\n\t]/.test(key)) {
      throw new Error('Key cannot contain whitespace characters');
    }

    // Apply validation rules
    for (const rule of this.validationRules.values()) {
      if (rule.required && !rule.validator(key)) {
        throw new Error(rule.errorMessage);
      }
    }

    // Pattern-specific validation
    if (pattern) {
      const keyPattern = this.keyPatterns.get(pattern);
      if (keyPattern) {
        const regex = new RegExp(keyPattern.pattern);
        if (!regex.test(key)) {
          throw new Error(`Key does not match pattern ${pattern}: ${keyPattern.pattern}`);
        }
      }
    }

    // Namespace-specific validation
    if (namespace) {
      const ns = this.namespaces.get(namespace);
      if (!ns) {
        throw new Error(`Unknown namespace: ${namespace}`);
      }
    }

    return true;
  }

  /**
   * Sanitize a cache key
   */
  public sanitizeKey(key: string): string {
    // Apply sanitization rules
    for (const rule of this.validationRules.values()) {
      if (rule.sanitizer) {
        key = rule.sanitizer(key);
      }
    }

    // Remove or replace invalid characters
    key = key.replace(/[\s\r\n\t]/g, '_');
    key = key.replace(/[^\w:.-]/g, '');

    // Ensure key starts with alphanumeric
    if (!/^[a-zA-Z0-9]/.test(key)) {
      key = 'k_' + key;
    }

    return key;
  }

  // ====================
  // KEY ANALYTICS
  // ====================

  /**
   * Track key access
   */
  public trackKeyAccess(fullKey: string, size?: number): void {
    const metadata = this.keyMetadata.get(fullKey);
    if (metadata) {
      metadata.lastAccessed = Date.now();
      metadata.accessCount++;
      if (size !== undefined) {
        metadata.size = size;
      }
    }
  }

  /**
   * Get key analytics for a namespace
   */
  public getKeyAnalytics(namespace: string): KeyAnalytics | null {
    return this.keyAnalytics.get(namespace) || null;
  }

  /**
   * Get hot keys (most frequently accessed)
   */
  public getHotKeys(namespace: string, limit: number = 10): KeyMetadata[] {
    const namespaceKeys = Array.from(this.keyMetadata.values())
      .filter(meta => meta.namespace === namespace)
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);

    return namespaceKeys;
  }

  /**
   * Get cold keys (least frequently accessed)
   */
  public getColdKeys(namespace: string, limit: number = 10): KeyMetadata[] {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    const namespaceKeys = Array.from(this.keyMetadata.values())
      .filter(meta => 
        meta.namespace === namespace && 
        meta.lastAccessed < cutoffTime
      )
      .sort((a, b) => a.accessCount - b.accessCount)
      .slice(0, limit);

    return namespaceKeys;
  }

  /**
   * Get keys by pattern
   */
  public getKeysByPattern(pattern: string, namespace?: string): string[] {
    const keys: string[] = [];
    
    for (const [fullKey, metadata] of this.keyMetadata) {
      if (namespace && metadata.namespace !== namespace) {
        continue;
      }
      
      const regex = new RegExp(pattern);
      if (regex.test(metadata.key)) {
        keys.push(fullKey);
      }
    }
    
    return keys;
  }

  /**
   * Get keys by tags
   */
  public getKeysByTags(tags: string[], namespace?: string): string[] {
    const keys: string[] = [];
    
    for (const [fullKey, metadata] of this.keyMetadata) {
      if (namespace && metadata.namespace !== namespace) {
        continue;
      }
      
      const hasAllTags = tags.every(tag => metadata.tags.includes(tag));
      if (hasAllTags) {
        keys.push(fullKey);
      }
    }
    
    return keys;
  }

  // ====================
  // KEY LIFECYCLE MANAGEMENT
  // ====================

  /**
   * Expire keys based on pattern
   */
  public async expireKeysByPattern(
    pattern: string,
    ttl: number,
    namespace?: string
  ): Promise<number> {
    const keys = await this.findKeysByPattern(pattern, namespace);
    let expiredCount = 0;

    for (const key of keys) {
      try {
        await executeRedisCommand('expire', [key, ttl]);
        expiredCount++;
      } catch (error) {
        console.warn(`Failed to expire key ${key}:`, error);
      }
    }

    return expiredCount;
  }

  /**
   * Rename keys based on pattern
   */
  public async renameKeysByPattern(
    pattern: string,
    newPattern: string,
    namespace?: string
  ): Promise<number> {
    const keys = await this.findKeysByPattern(pattern, namespace);
    let renamedCount = 0;

    for (const key of keys) {
      try {
        const newKey = key.replace(new RegExp(pattern), newPattern);
        await executeRedisCommand('rename', [key, newKey]);
        
        // Update metadata
        const metadata = this.keyMetadata.get(key);
        if (metadata) {
          this.keyMetadata.delete(key);
          this.keyMetadata.set(newKey, metadata);
        }
        
        renamedCount++;
      } catch (error) {
        console.warn(`Failed to rename key ${key}:`, error);
      }
    }

    return renamedCount;
  }

  /**
   * Archive old keys
   */
  public async archiveOldKeys(
    maxAge: number,
    namespace?: string,
    archiveNamespace: string = 'archive'
  ): Promise<number> {
    const cutoffTime = Date.now() - maxAge;
    const oldKeys = Array.from(this.keyMetadata.entries())
      .filter(([key, metadata]) => {
        if (namespace && metadata.namespace !== namespace) {
          return false;
        }
        return metadata.lastAccessed < cutoffTime;
      })
      .map(([key]) => key);

    let archivedCount = 0;

    for (const key of oldKeys) {
      try {
        // Get the value
        const value = await executeRedisCommand('get', [key]);
        if (value) {
          // Store in archive namespace
          const archiveKey = this.buildKey(
            `archived:${Date.now()}:${key}`,
            archiveNamespace
          );
          await executeRedisCommand('set', [archiveKey, value]);
          
          // Delete original key
          await executeRedisCommand('del', [key]);
          archivedCount++;
        }
      } catch (error) {
        console.warn(`Failed to archive key ${key}:`, error);
      }
    }

    return archivedCount;
  }

  // ====================
  // PRIVATE METHODS
  // ====================

  private initializeDefaultNamespaces(): void {
    const defaultNamespaces: CacheNamespace[] = [
      {
        name: 'default',
        description: 'Default cache namespace',
        prefix: env.REDIS_KEY_PREFIX || 'app',
        defaultTTL: env.CACHE_TTL_DEFAULT,
        evictionPolicy: 'lru',
        compressionEnabled: env.CACHE_COMPRESSION_ENABLED,
        encryptionEnabled: false,
        replicationStrategy: 'async',
        tags: ['default'],
        accessControl: {
          read: ['*'],
          write: ['*'],
          admin: ['admin'],
        },
      },
      {
        name: 'sessions',
        description: 'User session data',
        prefix: 'sess',
        defaultTTL: env.CACHE_TTL_MEDIUM,
        evictionPolicy: 'ttl',
        compressionEnabled: false,
        encryptionEnabled: true,
        replicationStrategy: 'sync',
        tags: ['session', 'user'],
        accessControl: {
          read: ['user', 'admin'],
          write: ['user', 'admin'],
          admin: ['admin'],
        },
      },
      {
        name: 'content',
        description: 'Learning content cache',
        prefix: 'content',
        defaultTTL: env.CACHE_TTL_LONG,
        evictionPolicy: 'lfu',
        compressionEnabled: true,
        encryptionEnabled: false,
        replicationStrategy: 'async',
        tags: ['content', 'learning'],
        accessControl: {
          read: ['*'],
          write: ['content-admin', 'admin'],
          admin: ['admin'],
        },
      },
      {
        name: 'analytics',
        description: 'Analytics and metrics data',
        prefix: 'analytics',
        defaultTTL: env.CACHE_TTL_SHORT,
        evictionPolicy: 'fifo',
        compressionEnabled: true,
        encryptionEnabled: false,
        replicationStrategy: 'none',
        tags: ['analytics', 'metrics'],
        accessControl: {
          read: ['analytics', 'admin'],
          write: ['analytics', 'admin'],
          admin: ['admin'],
        },
      },
    ];

    defaultNamespaces.forEach(ns => this.namespaces.set(ns.name, ns));
  }

  private initializeDefaultPatterns(): void {
    const defaultPatterns: CacheKeyPattern[] = [
      {
        name: 'user_profile',
        pattern: 'user:profile:[0-9a-f-]+',
        description: 'User profile cache keys',
        namespace: 'default',
        ttl: env.CACHE_TTL_MEDIUM,
        tags: ['user', 'profile'],
        compression: false,
        versioning: true,
        encryption: true,
        accessPattern: 'read-heavy',
        priority: 'high',
      },
      {
        name: 'content_item',
        pattern: 'content:[a-zA-Z0-9_-]+:[0-9a-f-]+',
        description: 'Learning content items',
        namespace: 'content',
        ttl: env.CACHE_TTL_LONG,
        tags: ['content', 'learning'],
        compression: true,
        versioning: true,
        encryption: false,
        accessPattern: 'read-heavy',
        priority: 'medium',
      },
      {
        name: 'session_data',
        pattern: 'session:[0-9a-f-]+',
        description: 'User session data',
        namespace: 'sessions',
        ttl: env.CACHE_TTL_MEDIUM,
        tags: ['session', 'user'],
        compression: false,
        versioning: false,
        encryption: true,
        accessPattern: 'balanced',
        priority: 'critical',
      },
      {
        name: 'analytics_metric',
        pattern: 'metric:[a-zA-Z0-9_]+:[0-9]+',
        description: 'Analytics metrics',
        namespace: 'analytics',
        ttl: env.CACHE_TTL_SHORT,
        tags: ['analytics', 'metric'],
        compression: true,
        versioning: false,
        encryption: false,
        accessPattern: 'write-heavy',
        priority: 'low',
      },
    ];

    defaultPatterns.forEach(pattern => this.keyPatterns.set(pattern.name, pattern));
  }

  private initializeValidationRules(): void {
    const rules: KeyValidationRule[] = [
      {
        name: 'no_spaces',
        pattern: /^\S+$/,
        required: true,
        validator: (key: string) => !/\s/.test(key),
        sanitizer: (key: string) => key.replace(/\s/g, '_'),
        errorMessage: 'Key cannot contain spaces',
      },
      {
        name: 'max_length',
        pattern: /^.{1,250}$/,
        required: true,
        validator: (key: string) => key.length <= 250,
        errorMessage: 'Key length cannot exceed 250 characters',
      },
      {
        name: 'alphanumeric_start',
        pattern: /^[a-zA-Z0-9]/,
        required: true,
        validator: (key: string) => /^[a-zA-Z0-9]/.test(key),
        sanitizer: (key: string) => /^[a-zA-Z0-9]/.test(key) ? key : 'k_' + key,
        errorMessage: 'Key must start with alphanumeric character',
      },
    ];

    rules.forEach(rule => this.validationRules.set(rule.name, rule));
  }

  private generateFromTemplate(template: string, params: { [key: string]: any }): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key]?.toString() || match;
    });
  }

  private generateHashKey(params: any, algorithm: string): string {
    const crypto = require('crypto');
    const data = JSON.stringify(params);
    return crypto.createHash(algorithm).update(data).digest('hex');
  }

  private generateUUIDKey(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private generateSequenceKey(namespace?: string): string {
    const prefix = namespace || 'seq';
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${prefix}_${timestamp}_${random}`;
  }

  private storeKeyMetadata(fullKey: string, metadata: KeyMetadata): void {
    this.keyMetadata.set(fullKey, metadata);
    
    // Limit metadata storage
    if (this.keyMetadata.size > 10000) {
      const oldestKeys = Array.from(this.keyMetadata.entries())
        .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)
        .slice(0, 1000)
        .map(([key]) => key);
      
      oldestKeys.forEach(key => this.keyMetadata.delete(key));
    }
  }

  private async findKeysByPattern(pattern: string, namespace?: string): Promise<string[]> {
    try {
      let searchPattern = pattern;
      
      if (namespace) {
        const ns = this.namespaces.get(namespace);
        if (ns) {
          searchPattern = `${ns.prefix}:${pattern}`;
        }
      }
      
      const keys = await executeRedisCommand<string[]>('keys', [searchPattern]);
      return keys || [];
    } catch (error) {
      console.error('Failed to find keys by pattern:', error);
      return [];
    }
  }

  private startCleanupTasks(): void {
    // Clean up expired metadata every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredMetadata();
    }, 60 * 60 * 1000);
  }

  private startAnalyticsCollection(): void {
    // Collect analytics every 5 minutes
    this.analyticsInterval = setInterval(() => {
      this.collectAnalytics();
    }, 5 * 60 * 1000);
  }

  private cleanupExpiredMetadata(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    let cleanedCount = 0;

    for (const [key, metadata] of this.keyMetadata) {
      if (metadata.lastAccessed < cutoffTime) {
        this.keyMetadata.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired key metadata entries`);
    }
  }

  private collectAnalytics(): void {
    // Collect analytics for each namespace
    for (const namespace of this.namespaces.keys()) {
      const analytics = this.calculateNamespaceAnalytics(namespace);
      this.keyAnalytics.set(namespace, analytics);
    }
  }

  private calculateNamespaceAnalytics(namespace: string): KeyAnalytics {
    const namespaceKeys = Array.from(this.keyMetadata.values())
      .filter(meta => meta.namespace === namespace);

    const totalKeys = namespaceKeys.length;
    const activeKeys = namespaceKeys.filter(meta => 
      meta.lastAccessed > Date.now() - (60 * 60 * 1000) // Active in last hour
    ).length;
    const expiredKeys = namespaceKeys.filter(meta =>
      meta.createdAt + (meta.ttl * 1000) < Date.now()
    ).length;

    const totalSize = namespaceKeys.reduce((sum, meta) => sum + meta.size, 0);
    const averageSize = totalKeys > 0 ? totalSize / totalKeys : 0;

    // Calculate access patterns
    const patternCounts = namespaceKeys.reduce((counts, meta) => {
      counts[meta.pattern] = (counts[meta.pattern] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const accessPatterns = Object.entries(patternCounts).map(([pattern, count]) => {
      const patternKeys = namespaceKeys.filter(meta => meta.pattern === pattern);
      const avgAccessFrequency = patternKeys.reduce((sum, meta) => sum + meta.accessCount, 0) / patternKeys.length;
      const lastAccessed = Math.max(...patternKeys.map(meta => meta.lastAccessed));
      
      return {
        pattern,
        count,
        avgAccessFrequency,
        lastAccessed,
      };
    });

    // Hot and cold keys
    const sortedByAccess = [...namespaceKeys].sort((a, b) => b.accessCount - a.accessCount);
    const hotKeys = sortedByAccess.slice(0, 10).map(meta => ({
      key: meta.key,
      accessCount: meta.accessCount,
      lastAccessed: meta.lastAccessed,
    }));

    const coldKeys = sortedByAccess.slice(-10).reverse().map(meta => ({
      key: meta.key,
      accessCount: meta.accessCount,
      lastAccessed: meta.lastAccessed,
    }));

    return {
      namespace,
      totalKeys,
      activeKeys,
      expiredKeys,
      averageSize,
      totalSize,
      accessPatterns,
      hotKeys,
      coldKeys,
      memoryUsage: totalSize,
    };
  }

  /**
   * Shutdown the key manager
   */
  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.analyticsInterval) {
      clearInterval(this.analyticsInterval);
    }
    console.log('✅ Cache key manager shutdown complete');
  }
}

// ====================
// SINGLETON INSTANCE
// ====================

export const cacheKeyManager = CacheKeyManager.getInstance();

// ====================
// CONVENIENCE FUNCTIONS
// ====================

/**
 * Build a cache key with validation
 */
export function buildCacheKey(
  key: string,
  namespace: string = 'default',
  options?: {
    validate?: boolean;
    pattern?: string;
    tags?: string[];
  }
): string {
  return cacheKeyManager.buildKey(key, namespace, options);
}

/**
 * Generate a cache key using a strategy
 */
export function generateCacheKey(
  strategy: KeyGenerationStrategy,
  params?: { [key: string]: any },
  namespace?: string
): string {
  return cacheKeyManager.generateKey(strategy, params, namespace);
}

/**
 * Validate a cache key
 */
export function validateCacheKey(key: string, namespace?: string, pattern?: string): boolean {
  return cacheKeyManager.validateKey(key, namespace, pattern);
}

/**
 * Get hot keys for a namespace
 */
export function getHotKeys(namespace: string, limit?: number): KeyMetadata[] {
  return cacheKeyManager.getHotKeys(namespace, limit);
}

/**
 * Get key analytics for a namespace
 */
export function getKeyAnalytics(namespace: string): KeyAnalytics | null {
  return cacheKeyManager.getKeyAnalytics(namespace);
}

export default cacheKeyManager;