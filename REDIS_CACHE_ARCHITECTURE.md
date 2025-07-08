# Redis Caching Layer Architecture

This document provides comprehensive documentation for the Redis caching layer implementation in the Learning Assistant application.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Components](#components)
4. [Cache Patterns](#cache-patterns)
5. [Configuration](#configuration)
6. [Usage Guide](#usage-guide)
7. [Production Deployment](#production-deployment)
8. [Monitoring & Metrics](#monitoring--metrics)
9. [Performance Optimization](#performance-optimization)
10. [Troubleshooting](#troubleshooting)

## Overview

The Redis caching layer provides comprehensive caching capabilities for the Learning Assistant application, including:

- **Distributed Caching**: Multi-node Redis cluster support with failover
- **Cache Patterns**: Implementation of cache-aside, write-through, write-behind, and refresh-ahead patterns
- **Intelligent Key Management**: Namespace-based organization with validation and analytics
- **Compression Optimization**: Adaptive compression for large payloads
- **Health Monitoring**: Real-time health checks and performance metrics
- **Cache Automation**: Automated warming and invalidation for production deployments
- **Metrics Collection**: Comprehensive performance analytics and alerting

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Application Layer                            │
├─────────────────────────────────────────────────────────────────┤
│ Cache Patterns │ Key Management │ Automation │ Monitoring      │
├─────────────────────────────────────────────────────────────────┤
│              Distributed Cache Service                         │
├─────────────────────────────────────────────────────────────────┤
│ Compression │ Health Checks │ Metrics Collection              │
├─────────────────────────────────────────────────────────────────┤
│                    Redis Cluster                               │
└─────────────────────────────────────────────────────────────────┘
```

### Core Components

1. **Distributed Cache Service** (`src/lib/cache/distributed-cache-service.ts`)
2. **Cache Patterns** (`src/lib/cache/cache-patterns.ts`)
3. **Key Manager** (`src/lib/cache/key-manager.ts`)
4. **Compression Optimizer** (`src/lib/cache/compression-optimizer.ts`)
5. **Metrics Collector** (`src/lib/cache/metrics-collector.ts`)
6. **Cache Automation** (`src/lib/cache/cache-automation.ts`)
7. **Health Monitoring** (`app/api/health/cache/route.ts`)

## Components

### 1. Distributed Cache Service

The central caching service that provides:

```typescript
import { distributedCache } from '@/src/lib/cache/distributed-cache-service';

// Basic operations
await distributedCache.set('key', 'value', { ttl: 3600 });
const value = await distributedCache.get('key');
await distributedCache.delete('key');

// Batch operations
await distributedCache.setMultiple({
  'key1': 'value1',
  'key2': 'value2'
}, { ttl: 3600 });

// Pattern operations
await distributedCache.deleteByPattern('user:*');
```

**Features:**
- Redis cluster support with automatic failover
- Connection pooling and load balancing
- Automatic serialization/deserialization
- TTL management and expiration
- Batch operations for improved performance
- Pattern-based operations

### 2. Cache Patterns

Implementation of enterprise caching patterns:

```typescript
import { 
  CacheAsidePattern, 
  WriteThroughPattern, 
  WriteBehindPattern, 
  RefreshAheadPattern 
} from '@/src/lib/cache/cache-patterns';

// Cache-aside pattern
const cacheAside = new CacheAsidePattern();
const userData = await cacheAside.get('user:123', async () => {
  return await database.getUser(123);
});

// Write-through pattern
const writeThrough = new WriteThroughPattern();
await writeThrough.set('user:123', userData, async (key, value) => {
  await database.saveUser(value);
});

// Refresh-ahead pattern
const refreshAhead = new RefreshAheadPattern();
await refreshAhead.configure({
  refreshThreshold: 0.8, // Refresh when 80% of TTL elapsed
  refreshCallback: async (key) => await database.getUser(key)
});
```

**Available Patterns:**
- **Cache-Aside**: Application manages cache and data store separately
- **Write-Through**: Writes go through cache to data store
- **Write-Behind**: Asynchronous writes to data store
- **Refresh-Ahead**: Proactive cache refresh before expiration

### 3. Key Manager

Advanced key management with namespacing and analytics:

```typescript
import { cacheKeyManager } from '@/src/lib/cache/key-manager';

// Register namespace
cacheKeyManager.registerNamespace({
  name: 'users',
  description: 'User profile data',
  prefix: 'user',
  defaultTTL: 3600,
  compressionEnabled: true,
  encryptionEnabled: true
});

// Build structured keys
const key = cacheKeyManager.buildKey('profile:123', 'users', {
  tags: ['profile', 'active'],
  pattern: 'user_profile'
});

// Analytics
const analytics = cacheKeyManager.getKeyAnalytics('users');
const hotKeys = cacheKeyManager.getHotKeys('users', 10);
```

**Features:**
- Namespace-based organization
- Key validation and sanitization
- Access pattern analytics
- Hot/cold key identification
- Tag-based key management
- Key lifecycle management

### 4. Compression Optimizer

Intelligent compression for large payloads:

```typescript
import { compressionOptimizer } from '@/src/lib/cache/compression-optimizer';

// Auto-compression with optimal algorithm selection
const result = await compressionOptimizer.compress(largeData, {
  algorithm: 'auto', // Automatically selects best algorithm
  enableChunking: true,
  enableAdaptive: true
});

// Decompression
const decompressed = await compressionOptimizer.decompress(
  result.compressed, 
  result.metadata
);

// Get recommendations
const recommendations = compressionOptimizer.getAlgorithmRecommendations();
```

**Features:**
- Multiple compression algorithms (LZ-String, gzip, brotli, zstd)
- Automatic algorithm selection based on data characteristics
- Chunked compression for large payloads
- Performance benchmarking and optimization
- Adaptive algorithm learning

### 5. Metrics Collector

Real-time performance monitoring:

```typescript
import { cacheMetricsCollector } from '@/src/lib/cache/metrics-collector';

// Get current metrics
const snapshot = await cacheMetricsCollector.collectSnapshot();

// Get dashboard data
const dashboard = cacheMetricsCollector.getDashboardData();

// Get performance trends
const trends = cacheMetricsCollector.getTrends(['memoryCache.hitRate'], '1h');

// Get active alerts
const alerts = cacheMetricsCollector.getActiveAlerts();
```

**Metrics Collected:**
- Hit/miss rates
- Response times
- Memory usage
- Error rates
- Connection health
- Performance trends

### 6. Cache Automation

Production deployment automation:

```typescript
import { cacheAutomation } from '@/src/lib/cache/cache-automation';

// Schedule cache warming
const jobId = await cacheAutomation.scheduleWarmingJob(
  'user-profiles',
  'users',
  ['profile:*'],
  { strategy: 'adaptive', priority: 'high' }
);

// Adaptive warming based on access patterns
const adaptiveJobs = await cacheAutomation.scheduleAdaptiveWarming();

// Cache invalidation
const invalidated = await cacheAutomation.invalidateByPatterns(
  ['content:*'],
  ['content'],
  { cascading: true }
);

// Get automation health
const health = cacheAutomation.getHealthSummary();
```

**Automation Features:**
- Scheduled cache warming
- Adaptive warming based on access patterns
- Intelligent cache invalidation
- Cascading invalidation for dependencies
- Production deployment automation
- Job monitoring and management

## Cache Patterns

### Cache-Aside (Lazy Loading)

```typescript
class UserService {
  async getUser(userId: string) {
    const cacheKey = `user:profile:${userId}`;
    
    // Try cache first
    let user = await distributedCache.get(cacheKey);
    
    if (!user) {
      // Cache miss - load from database
      user = await this.database.findUser(userId);
      
      if (user) {
        // Store in cache for future requests
        await distributedCache.set(cacheKey, user, { ttl: 3600 });
      }
    }
    
    return user;
  }
}
```

### Write-Through

```typescript
class UserService {
  async updateUser(userId: string, userData: User) {
    const cacheKey = `user:profile:${userId}`;
    
    // Write to database first
    await this.database.updateUser(userId, userData);
    
    // Then update cache
    await distributedCache.set(cacheKey, userData, { ttl: 3600 });
    
    return userData;
  }
}
```

### Write-Behind (Write-Back)

```typescript
class UserService {
  constructor() {
    this.writeQueue = new Queue();
    this.startBatchWriter();
  }
  
  async updateUser(userId: string, userData: User) {
    const cacheKey = `user:profile:${userId}`;
    
    // Update cache immediately
    await distributedCache.set(cacheKey, userData, { ttl: 3600 });
    
    // Queue for batch write to database
    this.writeQueue.add({ userId, userData });
    
    return userData;
  }
  
  private startBatchWriter() {
    setInterval(async () => {
      const batch = this.writeQueue.drain();
      if (batch.length > 0) {
        await this.database.batchUpdateUsers(batch);
      }
    }, 5000); // Write every 5 seconds
  }
}
```

### Refresh-Ahead

```typescript
class ContentService {
  async getContent(contentId: string) {
    const cacheKey = `content:${contentId}`;
    const content = await distributedCache.get(cacheKey);
    
    if (content) {
      // Check if refresh is needed (80% of TTL elapsed)
      const ttl = await distributedCache.getTTL(cacheKey);
      const originalTTL = 3600; // 1 hour
      
      if (ttl < originalTTL * 0.2) {
        // Refresh in background
        this.refreshContentInBackground(contentId, cacheKey);
      }
      
      return content;
    }
    
    // Cache miss - load synchronously
    return this.loadAndCacheContent(contentId, cacheKey);
  }
  
  private async refreshContentInBackground(contentId: string, cacheKey: string) {
    try {
      const freshContent = await this.database.findContent(contentId);
      await distributedCache.set(cacheKey, freshContent, { ttl: 3600 });
    } catch (error) {
      console.error('Background refresh failed:', error);
    }
  }
}
```

## Configuration

### Environment Variables

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_CLUSTER_NODES=node1:6379,node2:6379,node3:6379
REDIS_PASSWORD=your-password
REDIS_KEY_PREFIX=app
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=1000

# Cache Configuration
CACHE_TTL_DEFAULT=3600
CACHE_TTL_SHORT=300
CACHE_TTL_MEDIUM=1800
CACHE_TTL_LONG=7200
CACHE_COMPRESSION_ENABLED=true
CACHE_COMPRESSION_THRESHOLD=1024
CACHE_WARMING_ENABLED=true

# Monitoring
CACHE_METRICS_ENABLED=true
CACHE_HEALTH_CHECK_INTERVAL=30000
CACHE_ALERT_THRESHOLDS='{"hitRate":70,"responseTime":100,"errorRate":5}'
```

### Cache Namespaces

Default namespaces are configured in the key manager:

```typescript
const namespaces = [
  {
    name: 'default',
    prefix: 'app',
    defaultTTL: 3600,
    compressionEnabled: true,
    encryptionEnabled: false
  },
  {
    name: 'sessions',
    prefix: 'sess',
    defaultTTL: 1800,
    compressionEnabled: false,
    encryptionEnabled: true
  },
  {
    name: 'content',
    prefix: 'content',
    defaultTTL: 7200,
    compressionEnabled: true,
    encryptionEnabled: false
  },
  {
    name: 'analytics',
    prefix: 'analytics',
    defaultTTL: 300,
    compressionEnabled: true,
    encryptionEnabled: false
  }
];
```

## Usage Guide

### Basic Usage

```typescript
// Import the distributed cache service
import { distributedCache } from '@/src/lib/cache/distributed-cache-service';

// Set a value
await distributedCache.set('user:123', userData, { ttl: 3600 });

// Get a value
const user = await distributedCache.get('user:123');

// Delete a value
await distributedCache.delete('user:123');

// Check if key exists
const exists = await distributedCache.exists('user:123');
```

### Advanced Usage

```typescript
// Use with specific cache pattern
import { CacheAsidePattern } from '@/src/lib/cache/cache-patterns';

const cacheAside = new CacheAsidePattern({
  namespace: 'users',
  defaultTTL: 3600,
  compressionEnabled: true
});

// Get or load data
const userData = await cacheAside.get('profile:123', async () => {
  return await userDatabase.findById(123);
});

// Set with tags for easier invalidation
await cacheAside.set('profile:123', userData, {
  tags: ['user', 'profile', 'active'],
  ttl: 7200
});
```

### Batch Operations

```typescript
// Set multiple values
await distributedCache.setMultiple({
  'user:123': userData1,
  'user:124': userData2,
  'user:125': userData3
}, { ttl: 3600 });

// Get multiple values
const users = await distributedCache.getMultiple([
  'user:123',
  'user:124',
  'user:125'
]);

// Delete by pattern
await distributedCache.deleteByPattern('user:*');
```

### Using Key Manager

```typescript
import { cacheKeyManager } from '@/src/lib/cache/key-manager';

// Generate structured keys
const userKey = cacheKeyManager.buildKey('profile:123', 'users', {
  tags: ['profile', 'active'],
  validate: true
});

// Get analytics
const analytics = cacheKeyManager.getKeyAnalytics('users');
console.log(`Hit rate: ${analytics.accessPatterns[0].avgAccessFrequency}`);

// Find hot keys
const hotKeys = cacheKeyManager.getHotKeys('users', 10);
console.log('Hot keys:', hotKeys.map(k => k.key));
```

## Production Deployment

### Automated Deployment Script

Use the provided deployment script for production cache management:

```bash
# Blue-green deployment with cache warming
node scripts/cache-deployment.js deploy blue-green

# Rolling deployment
node scripts/cache-deployment.js deploy rolling

# Canary deployment
node scripts/cache-deployment.js deploy canary

# Maintenance window deployment
node scripts/cache-deployment.js deploy maintenance

# Manual cache warming
node scripts/cache-deployment.js warm

# Cache invalidation
node scripts/cache-deployment.js invalidate

# Verify cache health
node scripts/cache-deployment.js verify
```

### Environment-Specific Configuration

#### Development
```bash
NODE_ENV=development
REDIS_URL=redis://localhost:6379
CACHE_TTL_DEFAULT=300
CACHE_COMPRESSION_ENABLED=false
CACHE_WARMING_ENABLED=false
```

#### Staging
```bash
NODE_ENV=staging
REDIS_URL=redis://staging-redis:6379
CACHE_TTL_DEFAULT=1800
CACHE_COMPRESSION_ENABLED=true
CACHE_WARMING_ENABLED=true
```

#### Production
```bash
NODE_ENV=production
REDIS_CLUSTER_NODES=prod-redis-1:6379,prod-redis-2:6379,prod-redis-3:6379
REDIS_PASSWORD=${REDIS_PASSWORD}
CACHE_TTL_DEFAULT=3600
CACHE_COMPRESSION_ENABLED=true
CACHE_WARMING_ENABLED=true
CACHE_METRICS_ENABLED=true
```

### CI/CD Integration

#### GitHub Actions Example

```yaml
name: Deploy with Cache Management

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm install
        
      - name: Pre-deployment cache warming
        run: |
          export CACHE_API_URL=${{ secrets.CACHE_API_URL }}
          export CACHE_API_KEY=${{ secrets.CACHE_API_KEY }}
          node scripts/cache-deployment.js deploy blue-green
        
      - name: Deploy application
        run: npm run deploy
        
      - name: Post-deployment cache verification
        run: node scripts/cache-deployment.js verify
```

### Docker Integration

```dockerfile
# Add cache deployment script to container
COPY scripts/cache-deployment.js /app/scripts/
RUN chmod +x /app/scripts/cache-deployment.js

# Set environment variables
ENV CACHE_API_URL=http://cache-api:3000/api
ENV CACHE_WARMING_ENABLED=true

# Add deployment hooks
COPY docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]
```

## Monitoring & Metrics

### Health Check Endpoints

```bash
# Basic cache health
GET /api/health/cache

# Detailed health with metrics
GET /api/health/cache?detailed=true&metrics=true

# Automation status
GET /api/cache/automation?action=health

# Performance metrics
GET /api/cache/automation?action=metrics
```

### Key Metrics

1. **Performance Metrics**
   - Hit Rate: Percentage of requests served from cache
   - Miss Rate: Percentage of requests requiring data store access
   - Response Time: Average cache operation latency
   - Throughput: Operations per second

2. **System Metrics**
   - Memory Usage: Redis memory consumption
   - Connection Count: Active Redis connections
   - Error Rate: Percentage of failed operations
   - Network Latency: Redis cluster communication latency

3. **Business Metrics**
   - Cache Effectiveness: Impact on application performance
   - Cost Savings: Reduced database load
   - User Experience: Improved response times

### Alerting Thresholds

Default alert thresholds:

```javascript
const alertThresholds = {
  hitRate: {
    warning: 70,  // < 70% hit rate
    critical: 50  // < 50% hit rate
  },
  responseTime: {
    warning: 100,   // > 100ms response time
    critical: 500   // > 500ms response time
  },
  errorRate: {
    warning: 5,     // > 5% error rate
    critical: 15    // > 15% error rate
  },
  memoryUsage: {
    warning: 80,    // > 80% memory usage
    critical: 95    // > 95% memory usage
  }
};
```

### Dashboard Integration

The metrics collector provides data for dashboards:

```typescript
// Get dashboard data
const dashboardData = cacheMetricsCollector.getDashboardData();

// Data structure:
{
  current: CacheMetricsSnapshot,     // Current metrics
  recent: CacheMetricsSnapshot[],    // Last hour of data
  trends: CacheMetricsTrend[],       // Performance trends
  alerts: CachePerformanceAlert[],   // Active alerts
  healthScore: number                // Overall health score (0-100)
}
```

## Performance Optimization

### Best Practices

1. **Key Design**
   - Use hierarchical naming: `namespace:type:id`
   - Keep keys short but descriptive
   - Use consistent naming conventions
   - Avoid spaces and special characters

2. **TTL Management**
   - Set appropriate TTLs based on data volatility
   - Use different TTLs for different data types
   - Consider refresh-ahead for frequently accessed data
   - Monitor and adjust TTLs based on access patterns

3. **Compression**
   - Enable compression for large payloads (>1KB)
   - Use adaptive compression algorithm selection
   - Consider data characteristics when choosing algorithms
   - Monitor compression ratio and performance

4. **Connection Management**
   - Use connection pooling
   - Configure appropriate pool sizes
   - Monitor connection health
   - Implement circuit breakers for resilience

### Performance Tuning

#### Redis Configuration

```redis
# Memory optimization
maxmemory 2gb
maxmemory-policy allkeys-lru

# Network optimization
tcp-keepalive 60
timeout 0

# Persistence optimization (for cache workloads)
save ""
appendonly no

# Client connection optimization
maxclients 10000
```

#### Application Configuration

```typescript
// Optimize batch operations
const BATCH_SIZE = 100;
const batchResults = await distributedCache.pipeline()
  .set('key1', 'value1')
  .set('key2', 'value2')
  // ... up to BATCH_SIZE operations
  .exec();

// Use streaming for large datasets
const stream = distributedCache.scanStream({
  match: 'user:*',
  count: 100
});

stream.on('data', (keys) => {
  // Process keys in batches
});
```

## Troubleshooting

### Common Issues

#### 1. High Memory Usage

**Symptoms:**
- Redis memory usage approaching limits
- Increased evictions
- Performance degradation

**Solutions:**
- Review TTL settings
- Enable compression for large values
- Implement cache size limits per namespace
- Use more efficient data structures

```typescript
// Check memory usage
const metrics = await cacheMetricsCollector.collectSnapshot();
console.log('Memory usage:', metrics.redis.usedMemory);

// Enable compression for large namespaces
cacheKeyManager.updateNamespace('content', {
  compressionEnabled: true,
  maxSize: 1000000 // 1MB limit
});
```

#### 2. Low Hit Rate

**Symptoms:**
- Hit rate below 70%
- High database load
- Poor application performance

**Solutions:**
- Analyze access patterns
- Adjust TTL values
- Implement cache warming
- Review cache invalidation logic

```typescript
// Analyze key patterns
const analytics = cacheKeyManager.getKeyAnalytics('content');
console.log('Access patterns:', analytics.accessPatterns);

// Schedule adaptive warming
await cacheAutomation.scheduleAdaptiveWarming();
```

#### 3. Connection Issues

**Symptoms:**
- Connection timeouts
- High error rates
- Intermittent failures

**Solutions:**
- Check Redis cluster health
- Verify network connectivity
- Review connection pool settings
- Implement circuit breakers

```typescript
// Check connection health
const health = await distributedCache.getHealthStatus();
console.log('Connection status:', health.cluster.status);

// Get connection metrics
const metrics = await distributedCache.getMetrics();
console.log('Active connections:', metrics.connections.active);
```

#### 4. Performance Issues

**Symptoms:**
- High response times
- Timeouts
- Slow cache operations

**Solutions:**
- Enable compression
- Use batch operations
- Optimize key patterns
- Review Redis configuration

```typescript
// Enable compression for specific patterns
compressionOptimizer.configure({
  threshold: 512,
  enableAdaptive: true,
  performanceTarget: 10
});

// Use batch operations
const values = await distributedCache.getMultiple([
  'user:1', 'user:2', 'user:3'
]);
```

### Debugging Tools

#### 1. Cache Inspector

```typescript
// Get detailed cache information
const inspector = {
  namespace: 'users',
  keys: cacheKeyManager.getKeysByPattern('user:*', 'users'),
  analytics: cacheKeyManager.getKeyAnalytics('users'),
  hotKeys: cacheKeyManager.getHotKeys('users', 10),
  coldKeys: cacheKeyManager.getColdKeys('users', 10)
};

console.log('Cache inspector:', inspector);
```

#### 2. Performance Profiler

```typescript
// Profile cache operations
const profiler = {
  startTime: Date.now(),
  operations: []
};

// Wrap cache operations with profiling
const originalGet = distributedCache.get;
distributedCache.get = async function(key) {
  const start = Date.now();
  const result = await originalGet.call(this, key);
  const duration = Date.now() - start;
  
  profiler.operations.push({
    operation: 'get',
    key,
    duration,
    hit: result !== null
  });
  
  return result;
};
```

#### 3. Metrics Dashboard

```typescript
// Get comprehensive metrics for debugging
const debugMetrics = {
  health: cacheAutomation.getHealthSummary(),
  metrics: cacheMetricsCollector.getDashboardData(),
  compression: compressionOptimizer.getStats(),
  keyAnalytics: Object.fromEntries(
    ['default', 'content', 'sessions'].map(ns => [
      ns, 
      cacheKeyManager.getKeyAnalytics(ns)
    ])
  )
};

console.log('Debug metrics:', debugMetrics);
```

### Error Handling

#### 1. Circuit Breaker Pattern

```typescript
class CacheCircuitBreaker {
  constructor() {
    this.failureCount = 0;
    this.failureThreshold = 5;
    this.timeout = 60000; // 1 minute
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}
```

#### 2. Graceful Degradation

```typescript
async function getCachedData(key, fallbackLoader) {
  try {
    // Try cache first
    const cached = await distributedCache.get(key);
    if (cached) return cached;
    
    // Cache miss - load from source
    const data = await fallbackLoader();
    
    // Try to cache the result (but don't fail if caching fails)
    try {
      await distributedCache.set(key, data, { ttl: 3600 });
    } catch (cacheError) {
      console.warn('Failed to cache data:', cacheError);
    }
    
    return data;
  } catch (error) {
    console.error('Cache operation failed, falling back to direct load:', error);
    
    // Fallback to direct data loading
    return await fallbackLoader();
  }
}
```

---

## API Reference

### Distributed Cache Service

#### Methods

- `set(key, value, options?)`: Store a value
- `get(key)`: Retrieve a value
- `delete(key)`: Remove a value
- `exists(key)`: Check if key exists
- `setMultiple(keyValuePairs, options?)`: Batch set
- `getMultiple(keys)`: Batch get
- `deleteByPattern(pattern)`: Delete by pattern
- `getTTL(key)`: Get time to live
- `expire(key, ttl)`: Set expiration

#### Options

```typescript
interface CacheOptions {
  ttl?: number;           // Time to live in seconds
  namespace?: string;     // Cache namespace
  compress?: boolean;     // Enable compression
  tags?: string[];        // Tags for invalidation
}
```

### Cache Patterns

#### CacheAsidePattern

```typescript
const pattern = new CacheAsidePattern(options);
await pattern.get(key, loader);
await pattern.set(key, value, options);
await pattern.delete(key);
```

#### WriteThroughPattern

```typescript
const pattern = new WriteThroughPattern(options);
await pattern.set(key, value, writer);
await pattern.get(key);
await pattern.delete(key, deleter);
```

### Key Manager

#### Methods

- `buildKey(key, namespace, options?)`: Build structured key
- `validateKey(key, namespace?, pattern?)`: Validate key format
- `getKeyAnalytics(namespace)`: Get usage analytics
- `getHotKeys(namespace, limit?)`: Get frequently accessed keys
- `getColdKeys(namespace, limit?)`: Get rarely accessed keys

### Cache Automation

#### Methods

- `scheduleWarmingJob(name, namespace, patterns, options?)`: Schedule warming
- `scheduleAdaptiveWarming()`: Auto-schedule based on patterns
- `invalidateByPatterns(patterns, namespaces?, options?)`: Invalidate by pattern
- `invalidateByTags(tags, namespaces?)`: Invalidate by tags
- `getHealthSummary()`: Get automation health

---

This documentation provides a comprehensive guide to the Redis caching layer implementation. For additional support or questions, please refer to the inline code documentation or contact the development team.