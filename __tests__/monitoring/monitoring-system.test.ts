/**
 * Comprehensive test suite for the monitoring and alerting system
 */
import { monitoring, businessMetrics, alertManager } from '@/lib/monitoring';
import { healthCheckManager } from '@/lib/health-checks';
import { syntheticMonitoring } from '@/lib/synthetic-monitoring';
import { apm } from '@/lib/apm';
import { prometheus } from '@/lib/metrics/prometheus';

// Mock external dependencies
jest.mock('@/lib/logger');
jest.mock('prom-client');

describe('Monitoring System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Monitoring Configuration', () => {
    it('should initialize with default configuration', () => {
      const config = monitoring.getConfig();
      
      expect(config).toBeDefined();
      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('provider');
      expect(config).toHaveProperty('sampleRate');
      expect(config).toHaveProperty('alerting');
      expect(config).toHaveProperty('customMetrics');
      expect(config).toHaveProperty('tracing');
    });

    it('should allow configuration updates', () => {
      const updates = {
        sampleRate: 0.5,
        performanceThreshold: 3000,
      };

      monitoring.updateConfig(updates);
      const config = monitoring.getConfig();

      expect(config.sampleRate).toBe(0.5);
      expect(config.performanceThreshold).toBe(3000);
    });
  });

  describe('Business Metrics', () => {
    it('should track user engagement metrics', () => {
      const userId = 'test-user-123';
      const sessionDuration = 1200000; // 20 minutes
      const contentViews = 5;
      const interactions = 15;

      expect(() => {
        businessMetrics.trackUserEngagement(userId, sessionDuration, contentViews, interactions);
      }).not.toThrow();
    });

    it('should track learning effectiveness metrics', () => {
      const userId = 'test-user-123';
      const contentId = 'content-456';
      const completionRate = 85;
      const scoreImprovement = 12;
      const timeSpent = 900; // 15 minutes

      expect(() => {
        businessMetrics.trackLearningEffectiveness(userId, contentId, completionRate, scoreImprovement, timeSpent);
      }).not.toThrow();
    });

    it('should track content performance metrics', () => {
      const contentId = 'content-789';
      const contentType = 'quiz';
      const avgRating = 4.2;
      const completionRate = 78;
      const timeToComplete = 600; // 10 minutes

      expect(() => {
        businessMetrics.trackContentPerformance(contentId, contentType, avgRating, completionRate, timeToComplete);
      }).not.toThrow();
    });

    it('should track system performance metrics', () => {
      const cpuUsage = 45;
      const memoryUsage = 512;
      const activeUsers = 120;
      const responseTime = 250;

      expect(() => {
        businessMetrics.trackSystemPerformance(cpuUsage, memoryUsage, activeUsers, responseTime);
      }).not.toThrow();
    });

    it('should track business KPIs', () => {
      const newUsers = 25;
      const retainedUsers = 95;
      const conversionRate = 18.5;
      const revenue = 2500;

      expect(() => {
        businessMetrics.trackBusinessKPIs(newUsers, retainedUsers, conversionRate, revenue);
      }).not.toThrow();
    });
  });

  describe('Alert Management', () => {
    it('should create and store alerts', async () => {
      const alert = {
        title: 'Test Alert',
        message: 'This is a test alert',
        severity: 'warning' as const,
        category: 'performance' as const,
        source: 'test',
        metadata: { testData: 'value' },
      };

      const createdAlert = await alertManager.createAlert(alert);

      expect(createdAlert).toBeDefined();
      expect(createdAlert?.title).toBe(alert.title);
      expect(createdAlert?.severity).toBe(alert.severity);
      expect(createdAlert?.id).toBeDefined();
      expect(createdAlert?.timestamp).toBeDefined();
    });

    it('should resolve alerts', async () => {
      const alert = {
        title: 'Test Alert for Resolution',
        message: 'This alert will be resolved',
        severity: 'error' as const,
        category: 'infrastructure' as const,
        source: 'test',
      };

      const createdAlert = await alertManager.createAlert(alert);
      expect(createdAlert).toBeDefined();

      if (createdAlert) {
        const resolved = await alertManager.resolveAlert(createdAlert.id, 'test-user');
        expect(resolved).toBe(true);

        const activeAlerts = alertManager.getActiveAlerts();
        expect(activeAlerts.find(a => a.id === createdAlert.id)).toBeUndefined();
      }
    });

    it('should filter alert history', async () => {
      // Create test alerts
      await alertManager.createAlert({
        title: 'Performance Alert',
        message: 'Performance issue',
        severity: 'warning',
        category: 'performance',
        source: 'test',
      });

      await alertManager.createAlert({
        title: 'Security Alert',
        message: 'Security issue',
        severity: 'critical',
        category: 'security',
        source: 'test',
      });

      // Test filtering
      const performanceAlerts = alertManager.getAlertHistory({ category: 'performance' });
      const securityAlerts = alertManager.getAlertHistory({ category: 'security' });
      const criticalAlerts = alertManager.getAlertHistory({ severity: 'critical' });

      expect(performanceAlerts.length).toBeGreaterThan(0);
      expect(securityAlerts.length).toBeGreaterThan(0);
      expect(criticalAlerts.length).toBeGreaterThan(0);

      expect(performanceAlerts.every(a => a.category === 'performance')).toBe(true);
      expect(securityAlerts.every(a => a.category === 'security')).toBe(true);
      expect(criticalAlerts.every(a => a.severity === 'critical')).toBe(true);
    });

    it('should evaluate metrics against rules', async () => {
      const testMetrics = {
        error_rate: 8, // Above threshold of 5
        response_time: 1500, // Below threshold of 2000
        memory_usage: 90, // Above threshold of 85
      };

      const triggeredRules = await alertManager.evaluateMetrics(testMetrics);

      expect(Array.isArray(triggeredRules)).toBe(true);
      // Should trigger at least the error rate and memory usage rules
      expect(triggeredRules.length).toBeGreaterThan(0);
    });

    it('should provide alert statistics', async () => {
      // Create some test alerts
      await alertManager.createAlert({
        title: 'Stats Test Alert 1',
        message: 'Test',
        severity: 'info',
        category: 'business',
        source: 'test',
      });

      await alertManager.createAlert({
        title: 'Stats Test Alert 2',
        message: 'Test',
        severity: 'critical',
        category: 'infrastructure',
        source: 'test',
      });

      const stats = alertManager.getAlertStats();

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('active');
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('resolved');
      expect(stats).toHaveProperty('byCategory');
      expect(stats).toHaveProperty('bySeverity');
      expect(typeof stats.total).toBe('number');
      expect(stats.total).toBeGreaterThan(0);
    });
  });

  describe('Health Checks', () => {
    it('should run all health checks', async () => {
      const healthChecks = await healthCheckManager.runAll();

      expect(Array.isArray(healthChecks)).toBe(true);
      expect(healthChecks.length).toBeGreaterThan(0);

      healthChecks.forEach(check => {
        expect(check).toHaveProperty('name');
        expect(check).toHaveProperty('status');
        expect(check).toHaveProperty('responseTime');
        expect(check).toHaveProperty('timestamp');
        expect(['healthy', 'unhealthy', 'degraded']).toContain(check.status);
      });
    });

    it('should determine overall health status', async () => {
      const healthChecks = await healthCheckManager.runAll();
      const overallStatus = healthCheckManager.getOverallStatus(healthChecks);

      expect(overallStatus).toBeDefined();
      expect(overallStatus).toHaveProperty('status');
      expect(overallStatus).toHaveProperty('message');
      expect(['healthy', 'unhealthy', 'degraded', 'unknown']).toContain(overallStatus.status);
    });

    it('should cache health check results', async () => {
      await healthCheckManager.runAll();
      const cachedResults = healthCheckManager.getCached();

      expect(Array.isArray(cachedResults)).toBe(true);
      expect(cachedResults.length).toBeGreaterThan(0);
    });
  });

  describe('APM (Application Performance Monitoring)', () => {
    it('should start and end traces', () => {
      const traceId = apm.startTrace('test-operation', { testMetadata: 'value' });
      expect(typeof traceId).toBe('string');
      expect(traceId.length).toBeGreaterThan(0);

      const duration = apm.endTrace(traceId, { success: true });
      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should track API requests', () => {
      expect(() => {
        apm.trackApiRequest('GET', '/api/test', 200, 150, 'test-user');
      }).not.toThrow();
    });

    it('should track database queries', () => {
      expect(() => {
        apm.trackDbQuery('SELECT * FROM users WHERE id = ?', 45, 'users');
      }).not.toThrow();
    });

    it('should track learning sessions', () => {
      expect(() => {
        apm.trackLearningSession('user-123', 'quiz', 300, 'visual', 85);
      }).not.toThrow();
    });

    it('should provide performance metrics', () => {
      const metrics = apm.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('requests');
      expect(metrics).toHaveProperty('errors');
      expect(metrics).toHaveProperty('slowRequests');
      expect(metrics).toHaveProperty('averageResponseTime');
      expect(metrics).toHaveProperty('activeTraces');
    });

    it('should perform health check', () => {
      const isHealthy = apm.healthCheck();
      expect(typeof isHealthy).toBe('boolean');
    });

    it('should reset metrics', () => {
      apm.resetMetrics();
      const metrics = apm.getMetrics();

      expect(metrics.requests).toBe(0);
      expect(metrics.errors).toBe(0);
      expect(metrics.slowRequests).toBe(0);
      expect(metrics.averageResponseTime).toBe(0);
    });
  });

  describe('Prometheus Metrics', () => {
    it('should record counter metrics', () => {
      expect(() => {
        prometheus.recordCounter('test_counter', 1, { label: 'value' });
      }).not.toThrow();
    });

    it('should record gauge metrics', () => {
      expect(() => {
        prometheus.recordGauge('test_gauge', 42, { label: 'value' });
      }).not.toThrow();
    });

    it('should record histogram metrics', () => {
      expect(() => {
        prometheus.recordHistogram('test_histogram', 0.5, { label: 'value' });
      }).not.toThrow();
    });

    it('should provide metrics output', async () => {
      const metrics = await prometheus.getMetrics();
      expect(typeof metrics).toBe('string');
    });

    it('should perform health check', () => {
      const isHealthy = prometheus.healthCheck();
      expect(typeof isHealthy).toBe('boolean');
    });

    it('should clear metrics', () => {
      expect(() => {
        prometheus.clear();
      }).not.toThrow();
    });
  });

  describe('Synthetic Monitoring', () => {
    it('should provide available journeys', () => {
      const journeys = syntheticMonitoring.getJourneys();

      expect(Array.isArray(journeys)).toBe(true);
      expect(journeys.length).toBeGreaterThan(0);

      journeys.forEach(journey => {
        expect(journey).toHaveProperty('id');
        expect(journey).toHaveProperty('name');
        expect(journey).toHaveProperty('description');
        expect(journey).toHaveProperty('steps');
        expect(journey).toHaveProperty('enabled');
        expect(Array.isArray(journey.steps)).toBe(true);
      });
    });

    it('should provide configuration', () => {
      const config = syntheticMonitoring.getConfig();

      expect(config).toBeDefined();
      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('baseUrl');
      expect(config).toHaveProperty('timeout');
      expect(config).toHaveProperty('retries');
    });

    it('should allow configuration updates', () => {
      const updates = {
        timeout: 45000,
        retries: 5,
      };

      syntheticMonitoring.updateConfig(updates);
      const config = syntheticMonitoring.getConfig();

      expect(config.timeout).toBe(45000);
      expect(config.retries).toBe(5);
    });

    it('should get journey results', () => {
      const results = syntheticMonitoring.getAllResults();
      expect(results instanceof Map).toBe(true);
    });

    it('should get journey statistics', () => {
      const journeys = syntheticMonitoring.getJourneys();
      if (journeys.length > 0) {
        const stats = syntheticMonitoring.getJourneyStats(journeys[0].id);
        // Stats might be null if no runs have been executed
        if (stats) {
          expect(stats).toHaveProperty('totalRuns');
          expect(stats).toHaveProperty('successfulRuns');
          expect(stats).toHaveProperty('failedRuns');
          expect(stats).toHaveProperty('successRate');
          expect(stats).toHaveProperty('averageDuration');
        }
      }
    });
  });

  describe('Integration Tests', () => {
    it('should integrate monitoring with health checks', async () => {
      const health = monitoring.getHealth();
      const healthChecks = await healthCheckManager.runAll();

      expect(health).toBeDefined();
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('metrics');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('config');

      expect(healthChecks.length).toBeGreaterThan(0);
    });

    it('should integrate APM with monitoring', () => {
      const apmMetrics = apm.getMetrics();
      const monitoringHealth = monitoring.getHealth();

      expect(apmMetrics).toBeDefined();
      expect(monitoringHealth.metrics).toBeDefined();
    });

    it('should integrate alerts with health checks', async () => {
      // Simulate a health check failure
      const mockUnhealthyCheck = {
        name: 'test-service',
        status: 'unhealthy' as const,
        responseTime: 5000,
        message: 'Service is down',
        timestamp: new Date().toISOString(),
      };

      const overallStatus = healthCheckManager.getOverallStatus([mockUnhealthyCheck]);
      expect(overallStatus.status).toBe('unhealthy');

      // This would trigger an alert in a real scenario
      const alert = await alertManager.createAlert({
        title: 'Health Check Failed',
        message: 'Service health check failed',
        severity: 'critical',
        category: 'infrastructure',
        source: 'health-check-integration-test',
        metadata: overallStatus,
      });

      expect(alert).toBeDefined();
      expect(alert?.severity).toBe('critical');
    });
  });

  describe('Performance Tests', () => {
    it('should handle high-frequency metric recording', () => {
      const startTime = Date.now();
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        businessMetrics.trackSystemPerformance(
          Math.random() * 100,
          Math.random() * 1000,
          Math.floor(Math.random() * 200),
          Math.random() * 2000
        );
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent health checks', async () => {
      const promises = Array(10).fill(null).map(() => healthCheckManager.runAll());
      const results = await Promise.all(promises);

      expect(results.length).toBe(10);
      results.forEach(healthChecks => {
        expect(Array.isArray(healthChecks)).toBe(true);
        expect(healthChecks.length).toBeGreaterThan(0);
      });
    });

    it('should handle trace cleanup', () => {
      // Create many traces
      const traceIds = [];
      for (let i = 0; i < 100; i++) {
        const traceId = apm.startTrace(`test-trace-${i}`);
        traceIds.push(traceId);
      }

      // End half of them
      for (let i = 0; i < 50; i++) {
        apm.endTrace(traceIds[i]);
      }

      // Cleanup should handle remaining traces
      expect(() => {
        apm.cleanupOldTraces();
      }).not.toThrow();

      const metrics = apm.getMetrics();
      expect(metrics.activeTraces).toBeLessThan(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle monitoring failures gracefully', () => {
      // Test with invalid configuration
      expect(() => {
        monitoring.updateConfig({
          sampleRate: -1, // Invalid value
        });
      }).not.toThrow();
    });

    it('should handle alert creation failures', async () => {
      // Test with invalid alert data
      const invalidAlert = {
        title: '', // Empty title
        message: '',
        severity: 'invalid' as any,
        category: 'invalid' as any,
        source: 'test',
      };

      // Should not crash the system
      try {
        await alertManager.createAlert(invalidAlert);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle health check timeouts', async () => {
      // This test would need to mock slow services
      // For now, just ensure the function exists and returns properly
      const healthChecks = await healthCheckManager.runAll();
      expect(Array.isArray(healthChecks)).toBe(true);
    });
  });
});

describe('Monitoring System Configuration Validation', () => {
  it('should validate required environment variables', () => {
    const config = monitoring.getConfig();

    // Test that configuration has reasonable defaults
    expect(config.enabled).toBeDefined();
    expect(config.sampleRate).toBeGreaterThanOrEqual(0);
    expect(config.sampleRate).toBeLessThanOrEqual(1);
    expect(config.performanceThreshold).toBeGreaterThan(0);
    expect(config.errorThreshold).toBeGreaterThan(0);
  });

  it('should handle missing optional configuration', () => {
    // Test that system works without optional configs like API keys
    const config = monitoring.getConfig();
    
    // Should not crash if optional alert channels are not configured
    expect(() => {
      monitoring.getHealth();
    }).not.toThrow();
  });
});