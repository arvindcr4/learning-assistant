import { jest } from '@jest/globals';
import { performance } from 'perf_hooks';

// Mock dependencies for performance testing
jest.mock('@/lib/database', () => ({
  db: {
    query: jest.fn(),
    transaction: jest.fn(),
    pool: {
      totalCount: 20,
      idleCount: 15,
      waitingCount: 0,
    },
  },
}));

jest.mock('@/lib/cache', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    mget: jest.fn(),
    mset: jest.fn(),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import modules to test
import { LearningEngine } from '@/lib/learning-engine';
import { ContentRecommendation } from '@/lib/content-recommendation';
import { SpacedRepetition } from '@/lib/spaced-repetition';
import { db } from '@/lib/database';
import { cache } from '@/lib/cache';
import { logger } from '@/lib/logger';

const mockDb = db as jest.Mocked<typeof db>;
const mockCache = cache as jest.Mocked<typeof cache>;
const mockLogger = logger as jest.Mocked<typeof logger>;

// Performance measurement utilities
const measureExecutionTime = async (fn: () => Promise<any>): Promise<{
  result: any;
  executionTime: number;
  memoryUsage: NodeJS.MemoryUsage;
}> => {
  const startTime = performance.now();
  const startMemory = process.memoryUsage();
  
  const result = await fn();
  
  const endTime = performance.now();
  const endMemory = process.memoryUsage();
  
  return {
    result,
    executionTime: endTime - startTime,
    memoryUsage: {
      rss: endMemory.rss - startMemory.rss,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      external: endMemory.external - startMemory.external,
      arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers,
    },
  };
};

const runConcurrentTest = async (
  testFunction: () => Promise<any>,
  concurrency: number,
  iterations: number = 1
): Promise<{
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  successCount: number;
  errorCount: number;
  throughput: number;
}> => {
  const results: number[] = [];
  const errors: Error[] = [];
  const startTime = performance.now();

  const runIteration = async () => {
    for (let i = 0; i < iterations; i++) {
      try {
        const iterationStart = performance.now();
        await testFunction();
        const iterationEnd = performance.now();
        results.push(iterationEnd - iterationStart);
      } catch (error) {
        errors.push(error as Error);
      }
    }
  };

  // Run concurrent batches
  const batches = Array.from({ length: concurrency }, () => runIteration());
  await Promise.all(batches);

  const endTime = performance.now();
  const totalTime = endTime - startTime;

  return {
    totalTime,
    averageTime: results.length > 0 ? results.reduce((a, b) => a + b, 0) / results.length : 0,
    minTime: results.length > 0 ? Math.min(...results) : 0,
    maxTime: results.length > 0 ? Math.max(...results) : 0,
    successCount: results.length,
    errorCount: errors.length,
    throughput: (results.length / totalTime) * 1000, // operations per second
  };
};

describe('Performance and Load Testing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Database Performance', () => {
    it('should handle high-frequency database queries efficiently', async () => {
      // Mock database response time
      mockDb.query.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            rows: [{ id: 1, data: 'test' }],
            rowCount: 1,
          }), Math.random() * 10) // 0-10ms response time
        )
      );

      const queryTest = async () => {
        return await mockDb.query('SELECT * FROM users WHERE id = $1', [1]);
      };

      const results = await runConcurrentTest(queryTest, 50, 10);

      expect(results.successCount).toBe(500); // 50 concurrent * 10 iterations
      expect(results.errorCount).toBe(0);
      expect(results.averageTime).toBeLessThan(50); // Should be fast
      expect(results.throughput).toBeGreaterThan(100); // At least 100 ops/sec

      console.log('Database Query Performance:', results);
    });

    it('should maintain performance under connection pool pressure', async () => {
      let connectionCount = 0;
      const maxConnections = 20;

      mockDb.query.mockImplementation(() => {
        connectionCount++;
        
        if (connectionCount > maxConnections) {
          return Promise.reject(new Error('Connection pool exhausted'));
        }

        return new Promise(resolve => {
          setTimeout(() => {
            connectionCount--;
            resolve({
              rows: [{ id: 1, data: 'test' }],
              rowCount: 1,
            });
          }, 50); // Simulate work
        });
      });

      const poolTest = async () => {
        return await mockDb.query('SELECT * FROM large_table LIMIT 100');
      };

      const results = await runConcurrentTest(poolTest, 25, 5); // Push beyond pool limit

      expect(results.successCount).toBeGreaterThan(0);
      expect(results.errorCount).toBeGreaterThan(0); // Some should fail due to pool limits
      
      console.log('Connection Pool Performance:', results);
    });

    it('should handle large result sets efficiently', async () => {
      const largeDataSet = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        data: 'x'.repeat(100), // 100 chars per record
      }));

      mockDb.query.mockResolvedValue({
        rows: largeDataSet,
        rowCount: largeDataSet.length,
      });

      const measurement = await measureExecutionTime(async () => {
        return await mockDb.query('SELECT * FROM users ORDER BY created_at DESC');
      });

      expect(measurement.executionTime).toBeLessThan(1000); // Should complete within 1 second
      expect(measurement.memoryUsage.heapUsed).toBeLessThan(100 * 1024 * 1024); // < 100MB

      console.log('Large Dataset Performance:', {
        executionTime: measurement.executionTime,
        memoryUsage: Math.round(measurement.memoryUsage.heapUsed / 1024 / 1024),
        recordCount: largeDataSet.length,
      });
    });
  });

  describe('Cache Performance', () => {
    it('should provide significant performance improvement over database', async () => {
      const testData = { id: 1, complexData: 'x'.repeat(1000) };

      // Simulate slow database query
      mockDb.query.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            rows: [testData],
            rowCount: 1,
          }), 100) // 100ms database query
        )
      );

      // Simulate fast cache retrieval
      mockCache.get.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve(testData), 1) // 1ms cache retrieval
        )
      );

      // Test database query performance
      const dbMeasurement = await measureExecutionTime(async () => {
        return await mockDb.query('SELECT * FROM expensive_view WHERE id = $1', [1]);
      });

      // Test cache performance
      const cacheMeasurement = await measureExecutionTime(async () => {
        return await mockCache.get('expensive_view:1');
      });

      const speedupRatio = dbMeasurement.executionTime / cacheMeasurement.executionTime;

      expect(speedupRatio).toBeGreaterThan(10); // Cache should be at least 10x faster
      expect(cacheMeasurement.executionTime).toBeLessThan(10); // Cache should be very fast

      console.log('Cache vs Database Performance:', {
        databaseTime: dbMeasurement.executionTime,
        cacheTime: cacheMeasurement.executionTime,
        speedupRatio: Math.round(speedupRatio),
      });
    });

    it('should handle cache misses and regeneration efficiently', async () => {
      let cacheHitCount = 0;
      let cacheMissCount = 0;

      mockCache.get.mockImplementation((key: string) => {
        if (Math.random() < 0.8) { // 80% cache hit rate
          cacheHitCount++;
          return Promise.resolve({ data: 'cached', key });
        } else {
          cacheMissCount++;
          return Promise.resolve(null); // Cache miss
        }
      });

      mockCache.set.mockResolvedValue(true);
      mockDb.query.mockResolvedValue({
        rows: [{ data: 'fresh from db' }],
        rowCount: 1,
      });

      const cacheTest = async () => {
        const key = `test:${Math.random()}`;
        let result = await mockCache.get(key);
        
        if (!result) {
          result = await mockDb.query('SELECT * FROM data WHERE key = $1', [key]);
          await mockCache.set(key, result);
        }
        
        return result;
      };

      const results = await runConcurrentTest(cacheTest, 20, 10);

      expect(results.successCount).toBe(200);
      expect(results.errorCount).toBe(0);
      expect(cacheHitCount).toBeGreaterThan(cacheMissCount * 3); // Should have more hits than misses

      console.log('Cache Performance with Misses:', {
        ...results,
        cacheHitCount,
        cacheMissCount,
        hitRate: cacheHitCount / (cacheHitCount + cacheMissCount),
      });
    });

    it('should handle bulk cache operations efficiently', async () => {
      const bulkKeys = Array.from({ length: 1000 }, (_, i) => `key:${i}`);
      const bulkData = bulkKeys.map(key => ({ [key]: `data:${key}` }));

      mockCache.mget.mockResolvedValue(bulkData);
      mockCache.mset.mockResolvedValue(true);

      const bulkGetMeasurement = await measureExecutionTime(async () => {
        return await mockCache.mget(bulkKeys);
      });

      const bulkSetMeasurement = await measureExecutionTime(async () => {
        return await mockCache.mset(bulkData.reduce((acc, item) => ({ ...acc, ...item }), {}));
      });

      expect(bulkGetMeasurement.executionTime).toBeLessThan(100);
      expect(bulkSetMeasurement.executionTime).toBeLessThan(100);

      console.log('Bulk Cache Operations:', {
        getMeasurement: bulkGetMeasurement.executionTime,
        setMeasurement: bulkSetMeasurement.executionTime,
        operationCount: bulkKeys.length,
      });
    });
  });

  describe('Learning Algorithm Performance', () => {
    it('should handle learning profile analysis at scale', async () => {
      const learningEngine = new LearningEngine();
      
      // Mock performance data for multiple users
      const performanceData = Array.from({ length: 1000 }, (_, i) => ({
        userId: `user-${i}`,
        sessions: Array.from({ length: 10 }, (_, j) => ({
          topic: `topic-${j}`,
          score: Math.random() * 100,
          timeSpent: Math.random() * 3600,
          difficulty: ['beginner', 'intermediate', 'advanced'][Math.floor(Math.random() * 3)],
        })),
      }));

      mockDb.query.mockImplementation((query, params) => {
        const userId = params?.[0];
        const userData = performanceData.find(u => u.userId === userId);
        return Promise.resolve({
          rows: userData?.sessions || [],
          rowCount: userData?.sessions.length || 0,
        });
      });

      const analyzeUser = async (userId: string) => {
        return await learningEngine.analyzeUserPerformance(userId);
      };

      const results = await runConcurrentTest(
        () => analyzeUser(`user-${Math.floor(Math.random() * 1000)}`),
        10,
        20
      );

      expect(results.successCount).toBe(200);
      expect(results.averageTime).toBeLessThan(500); // Should analyze within 500ms
      expect(results.throughput).toBeGreaterThan(10); // At least 10 analyses per second

      console.log('Learning Analysis Performance:', results);
    });

    it('should handle content recommendation generation efficiently', async () => {
      const contentRecommendation = new ContentRecommendation();
      
      const userProfiles = Array.from({ length: 500 }, (_, i) => ({
        userId: `user-${i}`,
        interests: ['javascript', 'react', 'nodejs'].slice(0, Math.floor(Math.random() * 3) + 1),
        skillLevel: ['beginner', 'intermediate', 'advanced'][Math.floor(Math.random() * 3)],
        completedContent: Array.from({ length: Math.floor(Math.random() * 20) }, (_, j) => `content-${j}`),
      }));

      const availableContent = Array.from({ length: 10000 }, (_, i) => ({
        id: `content-${i}`,
        title: `Content ${i}`,
        tags: ['javascript', 'react', 'nodejs', 'css', 'html'].slice(0, Math.floor(Math.random() * 3) + 1),
        difficulty: ['beginner', 'intermediate', 'advanced'][Math.floor(Math.random() * 3)],
        relevanceScore: Math.random(),
      }));

      mockDb.query.mockImplementation((query, params) => {
        if (query.includes('user_profiles')) {
          const userId = params?.[0];
          const profile = userProfiles.find(p => p.userId === userId);
          return Promise.resolve({
            rows: profile ? [profile] : [],
            rowCount: profile ? 1 : 0,
          });
        } else if (query.includes('content')) {
          return Promise.resolve({
            rows: availableContent.slice(0, 50), // Return top 50 content items
            rowCount: 50,
          });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      });

      const generateRecommendations = async (userId: string) => {
        return await contentRecommendation.generateRecommendations(userId);
      };

      const results = await runConcurrentTest(
        () => generateRecommendations(`user-${Math.floor(Math.random() * 500)}`),
        15,
        10
      );

      expect(results.successCount).toBe(150);
      expect(results.averageTime).toBeLessThan(1000); // Should generate within 1 second
      expect(results.throughput).toBeGreaterThan(5); // At least 5 recommendations per second

      console.log('Recommendation Generation Performance:', results);
    });

    it('should handle spaced repetition calculations efficiently', async () => {
      const spacedRepetition = new SpacedRepetition();
      
      // Mock large number of cards for spaced repetition
      const cards = Array.from({ length: 5000 }, (_, i) => ({
        id: `card-${i}`,
        userId: `user-${Math.floor(i / 100)}`, // 100 cards per user
        lastReview: new Date(Date.now() - Math.random() * 7 * 24 * 3600 * 1000), // Within last week
        interval: Math.floor(Math.random() * 30) + 1,
        easinessFactor: 2.5 + (Math.random() - 0.5) * 0.6,
        repetitions: Math.floor(Math.random() * 10),
      }));

      mockDb.query.mockImplementation((query, params) => {
        const userId = params?.[0];
        const userCards = cards.filter(c => c.userId === userId);
        const dueCards = userCards.filter(c => {
          const nextReview = new Date(c.lastReview.getTime() + c.interval * 24 * 3600 * 1000);
          return nextReview <= new Date();
        });
        
        return Promise.resolve({
          rows: dueCards,
          rowCount: dueCards.length,
        });
      });

      const getDueCards = async (userId: string) => {
        return await spacedRepetition.getDueCards(userId);
      };

      const results = await runConcurrentTest(
        () => getDueCards(`user-${Math.floor(Math.random() * 50)}`),
        20,
        5
      );

      expect(results.successCount).toBe(100);
      expect(results.averageTime).toBeLessThan(200); // Should calculate within 200ms
      expect(results.throughput).toBeGreaterThan(20); // At least 20 calculations per second

      console.log('Spaced Repetition Performance:', results);
    });
  });

  describe('Memory Usage and Leak Detection', () => {
    it('should not have memory leaks during repeated operations', async () => {
      const learningEngine = new LearningEngine();
      const initialMemory = process.memoryUsage();

      mockDb.query.mockResolvedValue({
        rows: Array.from({ length: 100 }, (_, i) => ({ id: i, data: 'test' })),
        rowCount: 100,
      });

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        await learningEngine.analyzeUserPerformance(`user-${i % 10}`);
        
        // Force garbage collection periodically
        if (i % 100 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      // Memory increase should be reasonable (less than 50MB for 1000 operations)
      expect(memoryIncreaseMB).toBeLessThan(50);

      console.log('Memory Usage Analysis:', {
        initialHeapMB: Math.round(initialMemory.heapUsed / 1024 / 1024),
        finalHeapMB: Math.round(finalMemory.heapUsed / 1024 / 1024),
        increaseMB: Math.round(memoryIncreaseDB),
        operationsCount: 1000,
      });
    });

    it('should handle large object processing without excessive memory usage', async () => {
      const largeObject = {
        userData: Array.from({ length: 10000 }, (_, i) => ({
          id: i,
          name: `User ${i}`,
          preferences: {
            topics: Array.from({ length: 50 }, (_, j) => `topic-${j}`),
            history: Array.from({ length: 100 }, (_, k) => ({
              session: k,
              score: Math.random() * 100,
              timestamp: new Date(),
            })),
          },
        })),
      };

      const measurement = await measureExecutionTime(async () => {
        // Simulate processing large object
        const processed = largeObject.userData.map(user => ({
          id: user.id,
          name: user.name,
          averageScore: user.preferences.history.reduce((sum, h) => sum + h.score, 0) / user.preferences.history.length,
          topTopics: user.preferences.topics.slice(0, 5),
        }));

        return processed;
      });

      expect(measurement.executionTime).toBeLessThan(5000); // Should process within 5 seconds
      expect(measurement.memoryUsage.heapUsed).toBeLessThan(500 * 1024 * 1024); // < 500MB

      console.log('Large Object Processing:', {
        executionTime: measurement.executionTime,
        memoryUsageMB: Math.round(measurement.memoryUsage.heapUsed / 1024 / 1024),
        objectCount: largeObject.userData.length,
      });
    });
  });

  describe('Response Time Under Load', () => {
    it('should maintain acceptable response times under concurrent load', async () => {
      const responseTimeRequirements = {
        p50: 200, // 50th percentile: 200ms
        p90: 500, // 90th percentile: 500ms
        p95: 1000, // 95th percentile: 1000ms
        p99: 2000, // 99th percentile: 2000ms
      };

      mockDb.query.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            rows: [{ id: 1, data: 'test' }],
            rowCount: 1,
          }), Math.random() * 100 + 50) // 50-150ms response time
        )
      );

      const testOperation = async () => {
        const learningEngine = new LearningEngine();
        return await learningEngine.analyzeUserPerformance(`user-${Math.random()}`);
      };

      // Collect response times from multiple concurrent tests
      const responseTimes: number[] = [];
      const concurrentTests = Array.from({ length: 20 }, async () => {
        for (let i = 0; i < 10; i++) {
          const start = performance.now();
          await testOperation();
          const end = performance.now();
          responseTimes.push(end - start);
        }
      });

      await Promise.all(concurrentTests);

      // Calculate percentiles
      responseTimes.sort((a, b) => a - b);
      const p50 = responseTimes[Math.floor(responseTimes.length * 0.5)];
      const p90 = responseTimes[Math.floor(responseTimes.length * 0.9)];
      const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
      const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)];

      expect(p50).toBeLessThan(responseTimeRequirements.p50);
      expect(p90).toBeLessThan(responseTimeRequirements.p90);
      expect(p95).toBeLessThan(responseTimeRequirements.p95);
      expect(p99).toBeLessThan(responseTimeRequirements.p99);

      console.log('Response Time Percentiles:', {
        p50: Math.round(p50),
        p90: Math.round(p90),
        p95: Math.round(p95),
        p99: Math.round(p99),
        totalRequests: responseTimes.length,
      });
    });
  });
});