import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { performance } from 'perf_hooks';
import { getDatabase, query, transaction } from '../connection';
import { databaseService } from '../service';
import { migrationManager } from '../migrations';

describe('Database Performance Tests', () => {
  let testUserIds: string[] = [];
  let testProfileIds: string[] = [];
  let testSessionIds: string[] = [];

  beforeAll(async () => {
    // Ensure database is connected and migrated
    const db = getDatabase();
    await db.healthCheck();
    
    // Run migrations if needed
    const status = await migrationManager.getStatus();
    if (status.pending.length > 0) {
      await migrationManager.migrate();
    }
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await cleanupTestData();
  });

  afterAll(async () => {
    // Clean up test data after all tests
    await cleanupTestData();
  });

  describe('Query Performance', () => {
    it('should execute simple queries within performance threshold', async () => {
      const start = performance.now();
      
      const result = await query('SELECT 1 as test');
      
      const duration = performance.now() - start;
      
      expect(result.rows[0].test).toBe(1);
      expect(duration).toBeLessThan(100); // Should complete within 100ms
    });

    it('should handle concurrent queries efficiently', async () => {
      const concurrentQueries = 10;
      const start = performance.now();
      
      const promises = Array.from({ length: concurrentQueries }, (_, i) =>
        query('SELECT $1 as query_id, NOW() as timestamp', [i])
      );
      
      const results = await Promise.all(promises);
      const duration = performance.now() - start;
      
      expect(results).toHaveLength(concurrentQueries);
      expect(duration).toBeLessThan(1000); // All queries should complete within 1 second
      
      // Verify all queries returned different results
      const queryIds = results.map(r => r.rows[0].query_id);
      const uniqueIds = new Set(queryIds);
      expect(uniqueIds.size).toBe(concurrentQueries);
    });

    it('should perform user lookups efficiently', async () => {
      // Create test users
      const testUsers = await createTestUsers(100);
      testUserIds = testUsers.map(u => u.id);
      
      const start = performance.now();
      
      // Test individual user lookup
      const user = await databaseService.getUserById(testUsers[0].id);
      
      const duration = performance.now() - start;
      
      expect(user).toBeDefined();
      expect(user?.id).toBe(testUsers[0].id);
      expect(duration).toBeLessThan(50); // Should be very fast with proper indexing
    });

    it('should handle batch operations efficiently', async () => {
      const batchSize = 50;
      const start = performance.now();
      
      // Create users in batch using transaction
      const users = await transaction(async (client) => {
        const createdUsers = [];
        for (let i = 0; i < batchSize; i++) {
          const result = await client.query(`
            INSERT INTO users (email, name)
            VALUES ($1, $2)
            RETURNING *
          `, [`batch-user-${i}@example.com`, `Batch User ${i}`]);
          createdUsers.push(result.rows[0]);
        }
        return createdUsers;
      });
      
      const duration = performance.now() - start;
      testUserIds = users.map(u => u.id);
      
      expect(users).toHaveLength(batchSize);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe('Index Performance', () => {
    it('should use indexes for user email lookups', async () => {
      // Create test users
      const testUsers = await createTestUsers(1000);
      testUserIds = testUsers.map(u => u.id);
      
      // Test email lookup performance
      const start = performance.now();
      
      const user = await databaseService.getUserByEmail(testUsers[500].email);
      
      const duration = performance.now() - start;
      
      expect(user).toBeDefined();
      expect(user?.email).toBe(testUsers[500].email);
      expect(duration).toBeLessThan(100); // Should be fast with email index
    });

    it('should efficiently query learning sessions by user', async () => {
      // Create test user and sessions
      const user = await createTestUser('session-performance@example.com');
      testUserIds.push(user.id);
      
      const sessionCount = 200;
      const sessions = await createTestSessions(user.id, sessionCount);
      testSessionIds = sessions.map(s => s.id);
      
      const start = performance.now();
      
      const userSessions = await databaseService.getUserSessions(user.id, 50);
      
      const duration = performance.now() - start;
      
      expect(userSessions).toHaveLength(50);
      expect(duration).toBeLessThan(200); // Should be fast with user_id index
    });

    it('should efficiently query sessions by date range', async () => {
      // Create test user and sessions
      const user = await createTestUser('date-range-test@example.com');
      testUserIds.push(user.id);
      
      const sessions = await createTestSessions(user.id, 100);
      testSessionIds = sessions.map(s => s.id);
      
      const start = performance.now();
      
      const recentSessions = await query(`
        SELECT * FROM learning_sessions
        WHERE user_id = $1
        AND start_time >= NOW() - INTERVAL '7 days'
        ORDER BY start_time DESC
      `, [user.id]);
      
      const duration = performance.now() - start;
      
      expect(recentSessions.rows.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(150); // Should be fast with composite index
    });
  });

  describe('Connection Pool Performance', () => {
    it('should handle connection pool under load', async () => {
      const concurrentConnections = 20;
      const queriesPerConnection = 5;
      
      const start = performance.now();
      
      const connectionPromises = Array.from({ length: concurrentConnections }, async (_, i) => {
        const queryPromises = Array.from({ length: queriesPerConnection }, (_, j) =>
          query('SELECT $1 as connection_id, $2 as query_id, pg_backend_pid() as backend_pid', [i, j])
        );
        return Promise.all(queryPromises);
      });
      
      const results = await Promise.all(connectionPromises);
      const duration = performance.now() - start;
      
      expect(results).toHaveLength(concurrentConnections);
      expect(results[0]).toHaveLength(queriesPerConnection);
      expect(duration).toBeLessThan(3000); // Should handle load efficiently
      
      // Verify we're using multiple backend processes
      const backendPids = new Set();
      results.forEach(connectionResults => {
        connectionResults.forEach(queryResult => {
          backendPids.add(queryResult.rows[0].backend_pid);
        });
      });
      
      expect(backendPids.size).toBeGreaterThan(1); // Should use multiple connections
    });

    it('should release connections properly', async () => {
      const db = getDatabase();
      const initialStats = db.getPoolStats();
      
      // Execute multiple queries
      const queries = Array.from({ length: 10 }, (_, i) =>
        query('SELECT $1 as query_number', [i])
      );
      
      await Promise.all(queries);
      
      // Wait a moment for connections to be released
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const finalStats = db.getPoolStats();
      
      // Should return to similar connection state
      expect(finalStats.idleConnections).toBeGreaterThanOrEqual(initialStats.idleConnections);
    });
  });

  describe('Complex Query Performance', () => {
    it('should handle analytics queries efficiently', async () => {
      // Create test data
      const user = await createTestUser('analytics-test@example.com');
      testUserIds.push(user.id);
      
      const profile = await databaseService.createLearningProfile({
        user_id: user.id,
        dominant_style: 'visual',
        adaptation_level: 75,
        confidence_score: 0.85
      });
      testProfileIds.push(profile.id);
      
      const sessions = await createTestSessions(user.id, 50);
      testSessionIds = sessions.map(s => s.id);
      
      const start = performance.now();
      
      // Complex analytics query
      const analyticsResult = await query(`
        SELECT 
          u.id,
          u.name,
          u.email,
          lp.dominant_style,
          lp.adaptation_level,
          COUNT(ls.id) as total_sessions,
          SUM(ls.duration) as total_time,
          AVG(CASE WHEN ls.total_questions > 0 THEN ls.correct_answers::DECIMAL / ls.total_questions * 100 ELSE 0 END) as avg_score,
          MIN(ls.start_time) as first_session,
          MAX(ls.start_time) as last_session
        FROM users u
        LEFT JOIN learning_profiles lp ON u.id = lp.user_id
        LEFT JOIN learning_sessions ls ON u.id = ls.user_id
        WHERE u.id = $1
        GROUP BY u.id, u.name, u.email, lp.dominant_style, lp.adaptation_level
      `, [user.id]);
      
      const duration = performance.now() - start;
      
      expect(analyticsResult.rows).toHaveLength(1);
      const analytics = analyticsResult.rows[0];
      expect(parseInt(analytics.total_sessions)).toBe(50);
      expect(duration).toBeLessThan(500); // Complex query should still be reasonable
    });

    it('should handle aggregation queries efficiently', async () => {
      // Create multiple users with sessions
      const users = await createTestUsers(10);
      testUserIds = users.map(u => u.id);
      
      // Create sessions for each user
      for (const user of users) {
        const sessions = await createTestSessions(user.id, 10);
        testSessionIds.push(...sessions.map(s => s.id));
      }
      
      const start = performance.now();
      
      // Aggregation across all users
      const aggregationResult = await query(`
        SELECT 
          COUNT(DISTINCT u.id) as total_users,
          COUNT(ls.id) as total_sessions,
          SUM(ls.duration) as total_time,
          AVG(ls.duration) as avg_session_duration,
          AVG(CASE WHEN ls.total_questions > 0 THEN ls.correct_answers::DECIMAL / ls.total_questions * 100 ELSE 0 END) as overall_avg_score
        FROM users u
        LEFT JOIN learning_sessions ls ON u.id = ls.user_id
        WHERE u.email LIKE '%performance-user-%'
      `);
      
      const duration = performance.now() - start;
      
      expect(aggregationResult.rows).toHaveLength(1);
      const stats = aggregationResult.rows[0];
      expect(parseInt(stats.total_users)).toBe(10);
      expect(parseInt(stats.total_sessions)).toBe(100);
      expect(duration).toBeLessThan(1000); // Should handle aggregation efficiently
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should handle large result sets efficiently', async () => {
      // Create test user with many sessions
      const user = await createTestUser('large-dataset@example.com');
      testUserIds.push(user.id);
      
      const sessions = await createTestSessions(user.id, 500);
      testSessionIds = sessions.map(s => s.id);
      
      const start = performance.now();
      
      // Query large result set with pagination
      const pageSize = 100;
      const firstPage = await query(`
        SELECT * FROM learning_sessions
        WHERE user_id = $1
        ORDER BY start_time DESC
        LIMIT $2
      `, [user.id, pageSize]);
      
      const duration = performance.now() - start;
      
      expect(firstPage.rows).toHaveLength(pageSize);
      expect(duration).toBeLessThan(300); // Should handle large datasets efficiently
    });

    it('should maintain performance under sustained load', async () => {
      const iterations = 50;
      const durations: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        
        await query('SELECT COUNT(*) FROM users WHERE email LIKE $1', ['%@example.com']);
        
        const duration = performance.now() - start;
        durations.push(duration);
      }
      
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      
      expect(avgDuration).toBeLessThan(100); // Average should be fast
      expect(maxDuration).toBeLessThan(500); // No single query should be too slow
      
      // Performance should be consistent (no major degradation)
      const firstTenAvg = durations.slice(0, 10).reduce((sum, d) => sum + d, 0) / 10;
      const lastTenAvg = durations.slice(-10).reduce((sum, d) => sum + d, 0) / 10;
      
      expect(lastTenAvg).toBeLessThan(firstTenAvg * 2); // Performance shouldn't degrade significantly
    });
  });

  // Helper functions
  async function createTestUser(email: string) {
    const userData = {
      email,
      name: `Test User ${Math.random().toString(36).substr(2, 9)}`,
      avatar_url: null
    };
    return await databaseService.createUser(userData);
  }

  async function createTestUsers(count: number) {
    const users = [];
    for (let i = 0; i < count; i++) {
      const user = await createTestUser(`performance-user-${i}@example.com`);
      users.push(user);
    }
    return users;
  }

  async function createTestSessions(userId: string, count: number) {
    const sessions = [];
    for (let i = 0; i < count; i++) {
      const sessionData = {
        user_id: userId,
        content_id: `test-content-${i}`,
        duration: Math.floor(Math.random() * 60) + 10, // 10-70 minutes
        items_completed: Math.floor(Math.random() * 10) + 1,
        correct_answers: Math.floor(Math.random() * 8) + 1,
        total_questions: 10,
        completed: Math.random() > 0.2, // 80% completion rate
        focus_time: Math.floor(Math.random() * 50) + 10,
        distraction_events: Math.floor(Math.random() * 5),
        interaction_rate: Math.random() * 5 + 1,
        scroll_depth: Math.floor(Math.random() * 100),
        video_watch_time: Math.floor(Math.random() * 30),
        pause_frequency: Math.floor(Math.random() * 10)
      };
      
      const session = await databaseService.createLearningSession(sessionData);
      sessions.push(session);
    }
    return sessions;
  }

  async function cleanupTestData() {
    try {
      // Delete in reverse dependency order
      if (testSessionIds.length > 0) {
        await query('DELETE FROM learning_sessions WHERE id = ANY($1)', [testSessionIds]);
        testSessionIds = [];
      }
      
      if (testProfileIds.length > 0) {
        await query('DELETE FROM learning_profiles WHERE id = ANY($1)', [testProfileIds]);
        testProfileIds = [];
      }
      
      if (testUserIds.length > 0) {
        await query('DELETE FROM users WHERE id = ANY($1)', [testUserIds]);
        testUserIds = [];
      }

      // Clean up any remaining test users
      await query(`
        DELETE FROM users 
        WHERE email LIKE '%@example.com'
        OR email LIKE '%performance-user-%'
        OR email LIKE '%batch-user-%'
      `);
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }
});