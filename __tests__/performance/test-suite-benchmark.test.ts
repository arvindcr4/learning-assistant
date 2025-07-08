/**
 * Test Suite Performance Benchmarks
 * Measures and optimizes test execution performance
 */

import { performance, PerformanceObserver } from 'perf_hooks';

describe('Test Suite Performance Benchmarks', () => {
  let performanceData: Array<{ name: string; duration: number; timestamp: number }> = [];
  let observer: PerformanceObserver;

  beforeAll(() => {
    // Set up performance monitoring
    observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.entryType === 'measure') {
          performanceData.push({
            name: entry.name,
            duration: entry.duration,
            timestamp: Date.now(),
          });
        }
      });
    });
    
    observer.observe({ entryTypes: ['measure'] });
    performance.mark('benchmark-suite-start');
  });

  afterAll(() => {
    performance.mark('benchmark-suite-end');
    performance.measure('total-benchmark-time', 'benchmark-suite-start', 'benchmark-suite-end');
    
    // Generate performance report
    const report = {
      totalTests: performanceData.length,
      totalDuration: performanceData.reduce((sum, entry) => sum + entry.duration, 0),
      averageDuration: performanceData.length > 0 ? 
        performanceData.reduce((sum, entry) => sum + entry.duration, 0) / performanceData.length : 0,
      slowestTests: performanceData
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5),
      fastestTests: performanceData
        .sort((a, b) => a.duration - b.duration)
        .slice(0, 5),
      timestamp: new Date().toISOString(),
    };

    console.log('\n📊 Performance Benchmark Report:');
    console.log(`   Total Tests: ${report.totalTests}`);
    console.log(`   Total Duration: ${report.totalDuration.toFixed(2)}ms`);
    console.log(`   Average Duration: ${report.averageDuration.toFixed(2)}ms`);
    console.log('\n🐌 Slowest Tests:');
    report.slowestTests.forEach((test, index) => {
      console.log(`   ${index + 1}. ${test.name}: ${test.duration.toFixed(2)}ms`);
    });
    console.log('\n⚡ Fastest Tests:');
    report.fastestTests.forEach((test, index) => {
      console.log(`   ${index + 1}. ${test.name}: ${test.duration.toFixed(2)}ms`);
    });

    observer.disconnect();
  });

  describe('Test Execution Speed Benchmarks', () => {
    test('benchmark: Simple assertion performance', async () => {
      performance.mark('simple-assertion-start');
      
      // Simple assertion that should be very fast
      expect(1 + 1).toBe(2);
      expect('hello').toMatch(/hello/);
      expect([1, 2, 3]).toHaveLength(3);
      
      performance.mark('simple-assertion-end');
      performance.measure('simple-assertion', 'simple-assertion-start', 'simple-assertion-end');
    });

    test('benchmark: Array operations performance', async () => {
      performance.mark('array-ops-start');
      
      const largeArray = Array.from({ length: 10000 }, (_, i) => i);
      const filtered = largeArray.filter(n => n % 2 === 0);
      const mapped = filtered.map(n => n * 2);
      const reduced = mapped.reduce((sum, n) => sum + n, 0);
      
      expect(filtered).toHaveLength(5000);
      expect(mapped[0]).toBe(0);
      expect(reduced).toBeGreaterThan(0);
      
      performance.mark('array-ops-end');
      performance.measure('array-operations', 'array-ops-start', 'array-ops-end');
    });

    test('benchmark: Object manipulation performance', async () => {
      performance.mark('object-ops-start');
      
      const baseObject = { id: 1, name: 'test', data: { nested: true } };
      
      // Clone operations
      const shallowClone = { ...baseObject };
      const deepClone = JSON.parse(JSON.stringify(baseObject));
      
      // Property operations
      const withNewProp = { ...baseObject, newProp: 'value' };
      const { data, ...withoutData } = baseObject;
      
      expect(shallowClone).toEqual(baseObject);
      expect(deepClone).toEqual(baseObject);
      expect(withNewProp.newProp).toBe('value');
      expect(withoutData.data).toBeUndefined();
      
      performance.mark('object-ops-end');
      performance.measure('object-operations', 'object-ops-start', 'object-ops-end');
    });

    test('benchmark: Promise handling performance', async () => {
      performance.mark('promise-ops-start');
      
      const promises = Array.from({ length: 100 }, (_, i) => 
        Promise.resolve(i * 2)
      );
      
      const results = await Promise.all(promises);
      const sequentialResults: number[] = [];
      
      for (const promise of promises) {
        sequentialResults.push(await promise);
      }
      
      expect(results).toHaveLength(100);
      expect(sequentialResults).toEqual(results);
      
      performance.mark('promise-ops-end');
      performance.measure('promise-operations', 'promise-ops-start', 'promise-ops-end');
    });

    test('benchmark: Regular expression performance', async () => {
      performance.mark('regex-ops-start');
      
      const text = 'This is a test string with various patterns like email@test.com and phone 123-456-7890';
      const patterns = [
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
        /\b\d{3}-\d{3}-\d{4}\b/g, // Phone
        /\b\w+\b/g, // Words
        /\d+/g, // Numbers
      ];
      
      const matches = patterns.map(pattern => {
        const matches = text.match(pattern);
        return matches ? matches.length : 0;
      });
      
      expect(matches[0]).toBe(1); // Email count
      expect(matches[1]).toBe(1); // Phone count
      expect(matches[2]).toBeGreaterThan(0); // Word count
      
      performance.mark('regex-ops-end');
      performance.measure('regex-operations', 'regex-ops-start', 'regex-ops-end');
    });
  });

  describe('Memory Usage Benchmarks', () => {
    test('benchmark: Memory allocation patterns', () => {
      performance.mark('memory-test-start');
      
      const initialMemory = process.memoryUsage();
      
      // Create various data structures
      const largeArray = new Array(50000).fill(0).map((_, i) => ({ id: i, data: `item-${i}` }));
      const largeMap = new Map(largeArray.map(item => [item.id, item]));
      const largeSet = new Set(largeArray.map(item => item.id));
      
      const midMemory = process.memoryUsage();
      
      // Clean up
      largeArray.length = 0;
      largeMap.clear();
      largeSet.clear();
      
      const finalMemory = process.memoryUsage();
      
      const memoryIncrease = midMemory.heapUsed - initialMemory.heapUsed;
      const memoryDecrease = midMemory.heapUsed - finalMemory.heapUsed;
      
      console.log(`Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
      console.log(`Memory decrease: ${Math.round(memoryDecrease / 1024 / 1024)}MB`);
      
      expect(memoryIncrease).toBeGreaterThan(0);
      expect(memoryDecrease).toBeGreaterThan(0);
      
      performance.mark('memory-test-end');
      performance.measure('memory-test', 'memory-test-start', 'memory-test-end');
    });

    test('benchmark: Garbage collection impact', async () => {
      performance.mark('gc-test-start');
      
      const iterations = 1000;
      let allocatedObjects: any[] = [];
      
      // Allocate and deallocate objects
      for (let i = 0; i < iterations; i++) {
        allocatedObjects.push({
          id: i,
          data: new Array(100).fill(i),
          nested: { value: i, array: new Array(50).fill(i) }
        });
        
        // Periodically clear to trigger GC
        if (i % 100 === 0) {
          allocatedObjects = [];
        }
      }
      
      // Force cleanup
      allocatedObjects = [];
      
      // Give GC time to run
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(allocatedObjects).toHaveLength(0);
      
      performance.mark('gc-test-end');
      performance.measure('gc-test', 'gc-test-start', 'gc-test-end');
    });
  });

  describe('Test Environment Performance', () => {
    test('benchmark: Setup and teardown overhead', async () => {
      performance.mark('setup-teardown-start');
      
      // Simulate common test setup operations
      const mockData = {
        users: Array.from({ length: 100 }, (_, i) => ({ id: i, name: `user-${i}` })),
        settings: { theme: 'dark', language: 'en' },
        cache: new Map(),
      };
      
      // Simulate test execution
      expect(mockData.users).toHaveLength(100);
      expect(mockData.settings.theme).toBe('dark');
      expect(mockData.cache.size).toBe(0);
      
      // Simulate cleanup
      mockData.users.length = 0;
      mockData.cache.clear();
      
      performance.mark('setup-teardown-end');
      performance.measure('setup-teardown', 'setup-teardown-start', 'setup-teardown-end');
    });

    test('benchmark: Mock function performance', () => {
      performance.mark('mock-function-start');
      
      const mockFn = jest.fn();
      const iterations = 1000;
      
      // Call mock function many times
      for (let i = 0; i < iterations; i++) {
        mockFn(`call-${i}`, { data: i });
      }
      
      expect(mockFn).toHaveBeenCalledTimes(iterations);
      expect(mockFn).toHaveBeenLastCalledWith(`call-${iterations - 1}`, { data: iterations - 1 });
      
      // Clear mock
      mockFn.mockClear();
      expect(mockFn).toHaveBeenCalledTimes(0);
      
      performance.mark('mock-function-end');
      performance.measure('mock-function', 'mock-function-start', 'mock-function-end');
    });
  });

  describe('Optimization Validation', () => {
    test('benchmark: Test execution should be under performance threshold', () => {
      performance.mark('threshold-test-start');
      
      // This test should complete quickly
      const start = Date.now();
      
      // Perform operations that should be fast
      const result = Array.from({ length: 1000 }, (_, i) => i)
        .filter(n => n % 2 === 0)
        .map(n => n * 2)
        .reduce((sum, n) => sum + n, 0);
      
      const duration = Date.now() - start;
      
      expect(result).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
      
      performance.mark('threshold-test-end');
      performance.measure('threshold-test', 'threshold-test-start', 'threshold-test-end');
    });

    test('benchmark: Validate test sharding effectiveness', () => {
      performance.mark('sharding-test-start');
      
      const shard = process.env.JEST_SHARD || '1';
      const testId = `shard-${shard}-test`;
      
      // Each shard should handle different test data
      const shardData = {
        '1': { start: 0, end: 250 },
        '2': { start: 250, end: 500 },
        '3': { start: 500, end: 750 },
        '4': { start: 750, end: 1000 },
      };
      
      const config = shardData[shard as keyof typeof shardData] || shardData['1'];
      const data = Array.from({ length: config.end - config.start }, (_, i) => config.start + i);
      
      expect(data).toHaveLength(config.end - config.start);
      expect(data[0]).toBe(config.start);
      expect(data[data.length - 1]).toBe(config.end - 1);
      
      console.log(`Running on shard ${shard} with data range ${config.start}-${config.end}`);
      
      performance.mark('sharding-test-end');
      performance.measure('sharding-test', 'sharding-test-start', 'sharding-test-end');
    });
  });
});