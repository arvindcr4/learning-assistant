import { Pool, PoolClient } from 'pg';
import { performance } from 'perf_hooks';
import { getOptimizedDatabase } from './optimized-connection';
import { cacheStrategy } from './caching-strategy';

// Performance test configuration
interface TestConfig {
  name: string;
  description: string;
  iterations: number;
  concurrency: number;
  warmupIterations: number;
  timeout: number;
  expectedMaxTime: number;
  testData?: any;
}

// Performance test result
interface TestResult {
  testName: string;
  success: boolean;
  totalIterations: number;
  successfulIterations: number;
  failedIterations: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  medianTime: number;
  p95Time: number;
  p99Time: number;
  throughput: number; // operations per second
  errors: Array<{ message: string; count: number }>;
  memoryUsage: {
    before: number;
    after: number;
    peak: number;
  };
  cpuUsage?: number;
  cacheStats?: any;
}

// Load test scenario
interface LoadTestScenario {
  name: string;
  duration: number; // seconds
  rampUpTime: number; // seconds
  maxConcurrentUsers: number;
  operations: Array<{
    name: string;
    weight: number; // percentage
    operation: () => Promise<any>;
  }>;
}

export class DatabasePerformanceTester {
  private db = getOptimizedDatabase();
  private testResults: TestResult[] = [];
  
  // Basic performance tests
  public async runConnectionPoolTest(): Promise<TestResult> {
    const config: TestConfig = {
      name: 'Connection Pool Test',
      description: 'Test connection pool performance under load',
      iterations: 100,
      concurrency: 10,
      warmupIterations: 10,
      timeout: 5000,
      expectedMaxTime: 100,
    };

    return this.executeTest(config, async () => {
      const startTime = performance.now();
      await this.db.query('SELECT 1');
      return performance.now() - startTime;
    });
  }

  public async runSimpleQueryTest(): Promise<TestResult> {
    const config: TestConfig = {
      name: 'Simple Query Test',
      description: 'Test basic SELECT query performance',
      iterations: 1000,
      concurrency: 5,
      warmupIterations: 50,
      timeout: 1000,
      expectedMaxTime: 50,
    };

    return this.executeTest(config, async () => {
      const startTime = performance.now();
      await this.db.query('SELECT COUNT(*) FROM users');
      return performance.now() - startTime;
    });
  }

  public async runComplexQueryTest(): Promise<TestResult> {
    const config: TestConfig = {
      name: 'Complex Query Test',
      description: 'Test complex JOIN query performance',
      iterations: 100,
      concurrency: 3,
      warmupIterations: 10,
      timeout: 5000,
      expectedMaxTime: 500,
    };

    const complexQuery = `
      SELECT 
        u.id,
        u.name,
        lp.dominant_style,
        COUNT(DISTINCT ls.id) as session_count,
        AVG(CASE WHEN ls.total_questions > 0 THEN ls.correct_answers::DECIMAL / ls.total_questions * 100 ELSE 0 END) as avg_score
      FROM users u
      LEFT JOIN learning_profiles lp ON u.id = lp.user_id
      LEFT JOIN learning_sessions ls ON u.id = ls.user_id AND ls.start_time > CURRENT_DATE - INTERVAL '30 days'
      GROUP BY u.id, u.name, lp.dominant_style
      ORDER BY session_count DESC
      LIMIT 50
    `;

    return this.executeTest(config, async () => {
      const startTime = performance.now();
      await this.db.query(complexQuery);
      return performance.now() - startTime;
    });
  }

  public async runTransactionTest(): Promise<TestResult> {
    const config: TestConfig = {
      name: 'Transaction Test',
      description: 'Test transaction performance and rollback',
      iterations: 50,
      concurrency: 2,
      warmupIterations: 5,
      timeout: 3000,
      expectedMaxTime: 200,
    };

    return this.executeTest(config, async () => {
      const startTime = performance.now();
      
      await this.db.transaction(async (client) => {
        // Simulate a complex transaction
        await client.query('SELECT COUNT(*) FROM users');
        await client.query('SELECT COUNT(*) FROM learning_sessions WHERE start_time > CURRENT_DATE - INTERVAL \'7 days\'');
        await client.query('SELECT COUNT(*) FROM adaptive_content');
        
        // Intentionally rollback to test rollback performance
        throw new Error('Test rollback');
      }).catch(() => {
        // Expected error, ignore
      });
      
      return performance.now() - startTime;
    });
  }

  public async runIndexPerformanceTest(): Promise<TestResult> {
    const config: TestConfig = {
      name: 'Index Performance Test',
      description: 'Test index usage and performance',
      iterations: 200,
      concurrency: 5,
      warmupIterations: 20,
      timeout: 2000,
      expectedMaxTime: 100,
    };

    const queries = [
      'SELECT * FROM users WHERE email = $1',
      'SELECT * FROM learning_sessions WHERE user_id = $1 ORDER BY start_time DESC LIMIT 10',
      'SELECT * FROM adaptive_content WHERE difficulty = $1',
      'SELECT * FROM behavioral_indicators WHERE profile_id = $1 AND timestamp > $2',
    ];

    return this.executeTest(config, async () => {
      const startTime = performance.now();
      const query = queries[Math.floor(Math.random() * queries.length)];
      
      switch (query) {
        case queries[0]:
          await this.db.query(query, ['test@example.com']);
          break;
        case queries[1]:
          await this.db.query(query, ['550e8400-e29b-41d4-a716-446655440000']);
          break;
        case queries[2]:
          await this.db.query(query, [5]);
          break;
        case queries[3]:
          await this.db.query(query, ['550e8400-e29b-41d4-a716-446655440000', new Date(Date.now() - 86400000)]);
          break;
      }
      
      return performance.now() - startTime;
    });
  }

  public async runCachePerformanceTest(): Promise<TestResult> {
    const config: TestConfig = {
      name: 'Cache Performance Test',
      description: 'Test caching strategy effectiveness',
      iterations: 500,
      concurrency: 10,
      warmupIterations: 50,
      timeout: 1000,
      expectedMaxTime: 10,
    };

    // Populate cache with test data
    for (let i = 0; i < 100; i++) {
      await cacheStrategy.cacheUser(`user-${i}`, { id: `user-${i}`, name: `User ${i}` });
    }

    return this.executeTest(config, async () => {
      const startTime = performance.now();
      const userId = `user-${Math.floor(Math.random() * 100)}`;
      await cacheStrategy.getCachedUser(userId);
      return performance.now() - startTime;
    });
  }

  // Load testing scenarios
  public async runUserActivityLoadTest(): Promise<TestResult> {
    const scenario: LoadTestScenario = {
      name: 'User Activity Load Test',
      duration: 60, // 1 minute
      rampUpTime: 10, // 10 seconds
      maxConcurrentUsers: 50,
      operations: [
        {
          name: 'Get User Profile',
          weight: 30,
          operation: async () => {
            const userId = this.generateRandomUserId();
            return this.db.query('SELECT * FROM users WHERE id = $1', [userId]);
          }
        },
        {
          name: 'Get Learning Sessions',
          weight: 25,
          operation: async () => {
            const userId = this.generateRandomUserId();
            return this.db.query(
              'SELECT * FROM learning_sessions WHERE user_id = $1 ORDER BY start_time DESC LIMIT 10',
              [userId]
            );
          }
        },
        {
          name: 'Get Recommendations',
          weight: 20,
          operation: async () => {
            const userId = this.generateRandomUserId();
            return this.db.query(
              'SELECT * FROM recommendations WHERE user_id = $1 AND status = $2',
              [userId, 'active']
            );
          }
        },
        {
          name: 'Insert Session Data',
          weight: 15,
          operation: async () => {
            const userId = this.generateRandomUserId();
            const contentId = this.generateRandomContentId();
            return this.db.query(
              'INSERT INTO learning_sessions (user_id, content_id, duration, items_completed) VALUES ($1, $2, $3, $4)',
              [userId, contentId, Math.floor(Math.random() * 60), Math.floor(Math.random() * 10)]
            );
          }
        },
        {
          name: 'Update User Progress',
          weight: 10,
          operation: async () => {
            const userId = this.generateRandomUserId();
            return this.db.query(
              'UPDATE pace_profiles SET current_pace = $1 WHERE user_id = $2',
              [Math.random() * 10, userId]
            );
          }
        },
      ]
    };

    return this.executeLoadTest(scenario);
  }

  public async runContentDeliveryLoadTest(): Promise<TestResult> {
    const scenario: LoadTestScenario = {
      name: 'Content Delivery Load Test',
      duration: 45,
      rampUpTime: 5,
      maxConcurrentUsers: 30,
      operations: [
        {
          name: 'Get Content by Difficulty',
          weight: 40,
          operation: async () => {
            const difficulty = Math.floor(Math.random() * 10) + 1;
            return this.db.query(
              'SELECT * FROM adaptive_content WHERE difficulty = $1 LIMIT 10',
              [difficulty]
            );
          }
        },
        {
          name: 'Get Content Variants',
          weight: 30,
          operation: async () => {
            const contentId = this.generateRandomContentId();
            return this.db.query(
              'SELECT * FROM content_variants WHERE content_id = $1',
              [contentId]
            );
          }
        },
        {
          name: 'Search Content',
          weight: 20,
          operation: async () => {
            const searchTerm = ['math', 'science', 'history', 'english'][Math.floor(Math.random() * 4)];
            return this.db.query(
              'SELECT * FROM adaptive_content WHERE title ILIKE $1 OR concept ILIKE $1 LIMIT 20',
              [`%${searchTerm}%`]
            );
          }
        },
        {
          name: 'Get Assessment Questions',
          weight: 10,
          operation: async () => {
            const assessmentId = this.generateRandomAssessmentId();
            return this.db.query(
              'SELECT * FROM adaptive_questions WHERE assessment_id = $1',
              [assessmentId]
            );
          }
        },
      ]
    };

    return this.executeLoadTest(scenario);
  }

  // Test execution framework
  private async executeTest(
    config: TestConfig,
    testFunction: () => Promise<number>
  ): Promise<TestResult> {
    console.log(`Starting test: ${config.name}`);
    
    const memoryBefore = process.memoryUsage();
    let memoryPeak = memoryBefore;
    
    // Warmup
    console.log(`Warming up with ${config.warmupIterations} iterations...`);
    for (let i = 0; i < config.warmupIterations; i++) {
      try {
        await testFunction();
      } catch (error) {
        // Ignore warmup errors
      }
    }

    const executionTimes: number[] = [];
    const errors: Map<string, number> = new Map();
    let successfulIterations = 0;
    let failedIterations = 0;

    // Create concurrent workers
    const workers: Promise<void>[] = [];
    const iterationsPerWorker = Math.ceil(config.iterations / config.concurrency);

    for (let worker = 0; worker < config.concurrency; worker++) {
      workers.push(
        (async () => {
          for (let iteration = 0; iteration < iterationsPerWorker && successfulIterations + failedIterations < config.iterations; iteration++) {
            try {
              const executionTime = await Promise.race([
                testFunction(),
                new Promise<never>((_, reject) => 
                  setTimeout(() => reject(new Error('Timeout')), config.timeout)
                )
              ]);

              executionTimes.push(executionTime);
              successfulIterations++;

              // Track memory usage
              const currentMemory = process.memoryUsage();
              if (currentMemory.heapUsed > memoryPeak.heapUsed) {
                memoryPeak = currentMemory;
              }
            } catch (error) {
              failedIterations++;
              const errorMessage = (error as Error).message;
              errors.set(errorMessage, (errors.get(errorMessage) || 0) + 1);
            }
          }
        })()
      );
    }

    // Wait for all workers to complete
    await Promise.all(workers);

    const memoryAfter = process.memoryUsage();

    // Calculate statistics
    executionTimes.sort((a, b) => a - b);
    const totalTime = executionTimes.reduce((sum, time) => sum + time, 0);

    const result: TestResult = {
      testName: config.name,
      success: failedIterations === 0 && executionTimes.length > 0,
      totalIterations: config.iterations,
      successfulIterations,
      failedIterations,
      averageTime: totalTime / executionTimes.length,
      minTime: executionTimes[0] || 0,
      maxTime: executionTimes[executionTimes.length - 1] || 0,
      medianTime: executionTimes[Math.floor(executionTimes.length / 2)] || 0,
      p95Time: executionTimes[Math.floor(executionTimes.length * 0.95)] || 0,
      p99Time: executionTimes[Math.floor(executionTimes.length * 0.99)] || 0,
      throughput: successfulIterations / (totalTime / 1000),
      errors: Array.from(errors.entries()).map(([message, count]) => ({ message, count })),
      memoryUsage: {
        before: memoryBefore.heapUsed,
        after: memoryAfter.heapUsed,
        peak: memoryPeak.heapUsed,
      },
      cacheStats: cacheStrategy.getStats(),
    };

    this.testResults.push(result);
    console.log(`Test completed: ${config.name}`);
    console.log(`Success rate: ${(successfulIterations / config.iterations * 100).toFixed(2)}%`);
    console.log(`Average time: ${result.averageTime.toFixed(2)}ms`);
    console.log(`P95 time: ${result.p95Time.toFixed(2)}ms`);

    return result;
  }

  private async executeLoadTest(scenario: LoadTestScenario): Promise<TestResult> {
    console.log(`Starting load test: ${scenario.name}`);
    
    const memoryBefore = process.memoryUsage();
    let memoryPeak = memoryBefore;
    
    const executionTimes: number[] = [];
    const errors: Map<string, number> = new Map();
    let successfulIterations = 0;
    let failedIterations = 0;

    const startTime = Date.now();
    const endTime = startTime + scenario.duration * 1000;
    const rampUpEndTime = startTime + scenario.rampUpTime * 1000;

    // Active workers tracking
    const activeWorkers = new Set<Promise<void>>();

    while (Date.now() < endTime) {
      const currentTime = Date.now();
      
      // Calculate current user count (ramp up)
      let currentUsers: number;
      if (currentTime < rampUpEndTime) {
        const rampUpProgress = (currentTime - startTime) / (scenario.rampUpTime * 1000);
        currentUsers = Math.floor(scenario.maxConcurrentUsers * rampUpProgress);
      } else {
        currentUsers = scenario.maxConcurrentUsers;
      }

      // Add workers up to current user count
      while (activeWorkers.size < currentUsers && Date.now() < endTime) {
        const worker = (async () => {
          try {
            // Select random operation based on weights
            const operation = this.selectWeightedOperation(scenario.operations);
            const operationStartTime = performance.now();
            
            await operation.operation();
            
            const operationTime = performance.now() - operationStartTime;
            executionTimes.push(operationTime);
            successfulIterations++;

            // Track memory usage
            const currentMemory = process.memoryUsage();
            if (currentMemory.heapUsed > memoryPeak.heapUsed) {
              memoryPeak = currentMemory;
            }
          } catch (error) {
            failedIterations++;
            const errorMessage = (error as Error).message;
            errors.set(errorMessage, (errors.get(errorMessage) || 0) + 1);
          }
        })();

        activeWorkers.add(worker);
        worker.finally(() => activeWorkers.delete(worker));

        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Wait briefly before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Wait for all remaining workers to complete
    await Promise.all(Array.from(activeWorkers));

    const memoryAfter = process.memoryUsage();

    // Calculate statistics
    executionTimes.sort((a, b) => a - b);
    const totalTime = executionTimes.reduce((sum, time) => sum + time, 0);
    const testDuration = (Date.now() - startTime) / 1000;

    const result: TestResult = {
      testName: scenario.name,
      success: failedIterations === 0 && executionTimes.length > 0,
      totalIterations: successfulIterations + failedIterations,
      successfulIterations,
      failedIterations,
      averageTime: totalTime / executionTimes.length,
      minTime: executionTimes[0] || 0,
      maxTime: executionTimes[executionTimes.length - 1] || 0,
      medianTime: executionTimes[Math.floor(executionTimes.length / 2)] || 0,
      p95Time: executionTimes[Math.floor(executionTimes.length * 0.95)] || 0,
      p99Time: executionTimes[Math.floor(executionTimes.length * 0.99)] || 0,
      throughput: successfulIterations / testDuration,
      errors: Array.from(errors.entries()).map(([message, count]) => ({ message, count })),
      memoryUsage: {
        before: memoryBefore.heapUsed,
        after: memoryAfter.heapUsed,
        peak: memoryPeak.heapUsed,
      },
      cacheStats: cacheStrategy.getStats(),
    };

    this.testResults.push(result);
    console.log(`Load test completed: ${scenario.name}`);
    console.log(`Total operations: ${result.totalIterations}`);
    console.log(`Success rate: ${(successfulIterations / result.totalIterations * 100).toFixed(2)}%`);
    console.log(`Throughput: ${result.throughput.toFixed(2)} ops/sec`);

    return result;
  }

  private selectWeightedOperation(operations: Array<{ name: string; weight: number; operation: () => Promise<any> }>) {
    const totalWeight = operations.reduce((sum, op) => sum + op.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const operation of operations) {
      random -= operation.weight;
      if (random <= 0) {
        return operation;
      }
    }
    
    return operations[0]; // Fallback
  }

  // Utility methods for generating test data
  private generateRandomUserId(): string {
    const userIds = [
      '550e8400-e29b-41d4-a716-446655440000',
      '550e8400-e29b-41d4-a716-446655440001',
      '550e8400-e29b-41d4-a716-446655440002',
      '550e8400-e29b-41d4-a716-446655440003',
      '550e8400-e29b-41d4-a716-446655440004',
    ];
    return userIds[Math.floor(Math.random() * userIds.length)];
  }

  private generateRandomContentId(): string {
    const contentIds = [
      '660e8400-e29b-41d4-a716-446655440000',
      '660e8400-e29b-41d4-a716-446655440001',
      '660e8400-e29b-41d4-a716-446655440002',
      '660e8400-e29b-41d4-a716-446655440003',
      '660e8400-e29b-41d4-a716-446655440004',
    ];
    return contentIds[Math.floor(Math.random() * contentIds.length)];
  }

  private generateRandomAssessmentId(): string {
    const assessmentIds = [
      '770e8400-e29b-41d4-a716-446655440000',
      '770e8400-e29b-41d4-a716-446655440001',
      '770e8400-e29b-41d4-a716-446655440002',
    ];
    return assessmentIds[Math.floor(Math.random() * assessmentIds.length)];
  }

  // Test suite execution
  public async runFullTestSuite(): Promise<TestResult[]> {
    console.log('Starting full database performance test suite...');
    
    const tests = [
      () => this.runConnectionPoolTest(),
      () => this.runSimpleQueryTest(),
      () => this.runComplexQueryTest(),
      () => this.runTransactionTest(),
      () => this.runIndexPerformanceTest(),
      () => this.runCachePerformanceTest(),
      () => this.runUserActivityLoadTest(),
      () => this.runContentDeliveryLoadTest(),
    ];

    const results: TestResult[] = [];
    
    for (const test of tests) {
      try {
        const result = await test();
        results.push(result);
        
        // Brief pause between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error('Test failed:', error);
      }
    }

    console.log('Full test suite completed');
    this.generateTestReport(results);
    
    return results;
  }

  public generateTestReport(results: TestResult[]): void {
    console.log('\n=== DATABASE PERFORMANCE TEST REPORT ===\n');
    
    results.forEach(result => {
      console.log(`Test: ${result.testName}`);
      console.log(`Success: ${result.success ? 'PASS' : 'FAIL'}`);
      console.log(`Iterations: ${result.totalIterations} (${result.successfulIterations} successful, ${result.failedIterations} failed)`);
      console.log(`Average Time: ${result.averageTime.toFixed(2)}ms`);
      console.log(`P95 Time: ${result.p95Time.toFixed(2)}ms`);
      console.log(`P99 Time: ${result.p99Time.toFixed(2)}ms`);
      console.log(`Throughput: ${result.throughput.toFixed(2)} ops/sec`);
      console.log(`Memory Usage: ${(result.memoryUsage.peak / 1024 / 1024).toFixed(2)} MB peak`);
      
      if (result.errors.length > 0) {
        console.log('Errors:');
        result.errors.forEach(error => {
          console.log(`  - ${error.message}: ${error.count} occurrences`);
        });
      }
      
      console.log('---');
    });

    // Summary
    const totalTests = results.length;
    const passedTests = results.filter(r => r.success).length;
    const overallSuccess = passedTests === totalTests;
    
    console.log(`\nOVERALL RESULT: ${overallSuccess ? 'PASS' : 'FAIL'}`);
    console.log(`Tests Passed: ${passedTests}/${totalTests}`);
    
    if (results.length > 0) {
      const avgThroughput = results.reduce((sum, r) => sum + r.throughput, 0) / results.length;
      const avgResponseTime = results.reduce((sum, r) => sum + r.averageTime, 0) / results.length;
      
      console.log(`Average Throughput: ${avgThroughput.toFixed(2)} ops/sec`);
      console.log(`Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    }
    
    console.log('\n=== END REPORT ===\n');
  }

  public getTestResults(): TestResult[] {
    return [...this.testResults];
  }

  public clearTestResults(): void {
    this.testResults = [];
  }
}

// Export singleton instance
export const performanceTester = new DatabasePerformanceTester();

// Convenience functions
export const runDatabasePerformanceTests = () => performanceTester.runFullTestSuite();
export const runConnectionPoolTest = () => performanceTester.runConnectionPoolTest();
export const runLoadTest = () => performanceTester.runUserActivityLoadTest();