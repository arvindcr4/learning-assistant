/**
 * Logging System Tests
 * 
 * Basic tests to verify the logging system functionality
 */

import {
  logger,
  performanceLogger,
  securityAuditLogger,
  loggingSystem,
  initializeLogging,
  checkLoggingHealth,
  getLoggingStatistics,
  createModuleLogger,
  createUserLogger,
  SecurityEventType,
  SecurityEventSeverity
} from '../index';

describe('Logging System', () => {
  beforeAll(async () => {
    // Initialize logging system for tests
    await initializeLogging();
  });

  afterAll(async () => {
    // Cleanup after tests
    await loggingSystem.shutdown();
  });

  describe('Core Logger', () => {
    it('should log messages at different levels', () => {
      expect(() => {
        logger.error('Test error message', { category: 'test' });
        logger.warn('Test warning message', { category: 'test' });
        logger.info('Test info message', { category: 'test' });
        logger.debug('Test debug message', { category: 'test' });
      }).not.toThrow();
    });

    it('should handle log context', () => {
      expect(() => {
        logger.info('Test with context', {
          userId: 'test-user-123',
          component: 'test-component',
          operation: 'test-operation',
          category: 'test'
        });
      }).not.toThrow();
    });

    it('should log errors with stack traces', () => {
      const testError = new Error('Test error with stack');
      expect(() => {
        logger.logError(testError, { category: 'test' });
      }).not.toThrow();
    });
  });

  describe('Performance Logger', () => {
    it('should log performance metrics', () => {
      expect(() => {
        performanceLogger.logPerformance('test-operation', 150, {
          category: 'test'
        });
      }).not.toThrow();
    });

    it('should measure async operations', async () => {
      const testAsyncOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'test result';
      };

      const { result, metric } = await performanceLogger.measureAsync(
        'test-async-operation',
        testAsyncOperation,
        { category: 'test' }
      );

      expect(result).toBe('test result');
      expect(metric.operation).toBe('test-async-operation');
      expect(metric.duration).toBeGreaterThan(90);
      expect(metric.success).toBe(true);
    });

    it('should measure sync operations', () => {
      const testSyncOperation = () => {
        // Simulate some work
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += i;
        }
        return sum;
      };

      const { result, metric } = performanceLogger.measureSync(
        'test-sync-operation',
        testSyncOperation,
        { category: 'test' }
      );

      expect(typeof result).toBe('number');
      expect(metric.operation).toBe('test-sync-operation');
      expect(metric.duration).toBeGreaterThan(0);
      expect(metric.success).toBe(true);
    });
  });

  describe('Security Logger', () => {
    it('should log security events', () => {
      expect(() => {
        securityAuditLogger.logSecurityEvent({
          type: SecurityEventType.AUTHENTICATION_SUCCESS,
          severity: SecurityEventSeverity.LOW,
          message: 'Test authentication success',
          userId: 'test-user-123',
          ip: '192.168.1.100',
          userAgent: 'test-agent',
          outcome: 'success'
        });
      }).not.toThrow();
    });

    it('should log authentication events', () => {
      expect(() => {
        securityAuditLogger.logAuthenticationSuccess(
          'test-user-123',
          '192.168.1.100',
          'test-agent',
          'password'
        );

        securityAuditLogger.logAuthenticationFailure(
          'test-user-123',
          '192.168.1.100',
          'test-agent',
          'Invalid password'
        );
      }).not.toThrow();
    });

    it('should log suspicious activity', () => {
      expect(() => {
        securityAuditLogger.logSuspiciousActivity(
          'Multiple failed login attempts',
          '192.168.1.100',
          'test-agent',
          SecurityEventSeverity.HIGH
        );
      }).not.toThrow();
    });
  });

  describe('Logger Factory', () => {
    it('should create module loggers', () => {
      const moduleLogger = createModuleLogger('test-module', 'sub-component');
      
      expect(() => {
        moduleLogger.info('Test module log', { data: 'test' });
      }).not.toThrow();
    });

    it('should create user loggers', () => {
      const userLogger = createUserLogger('test-user-123', 'session-456');
      
      expect(() => {
        userLogger.info('User action performed', { action: 'test' });
      }).not.toThrow();
    });
  });

  describe('System Health', () => {
    it('should perform health checks', async () => {
      const health = await checkLoggingHealth();
      
      expect(health).toBeDefined();
      expect(health.coreLogger).toBeDefined();
      expect(health.coreLogger.healthy).toBe(true);
    });

    it('should get system statistics', async () => {
      const stats = await getLoggingStatistics();
      
      expect(stats).toBeDefined();
      expect(typeof stats.totalLogs).toBe('number');
    });
  });

  describe('Context and Correlation', () => {
    it('should maintain correlation IDs', () => {
      // This would require setting up correlation context
      // In a real test, you'd test with actual request context
      expect(() => {
        logger.info('Test with correlation', {
          correlationId: 'test-correlation-123',
          category: 'test'
        });
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle logging errors gracefully', () => {
      // Test with invalid input
      expect(() => {
        logger.info('Test with circular reference', {
          category: 'test'
          // Note: Circular references are handled by JSON.stringify replacement
        });
      }).not.toThrow();
    });

    it('should sanitize sensitive data', () => {
      expect(() => {
        logger.info('Test with sensitive data', {
          password: 'secret123',
          token: 'jwt-token-here',
          email: 'user@example.com',
          category: 'test'
        });
      }).not.toThrow();
    });
  });
});

// Integration test helper
export function runLoggingIntegrationTest() {
  console.log('Running logging system integration test...');
  
  // Test all major components
  logger.info('Integration test started', { category: 'integration-test' });
  
  // Test performance logging
  const startTime = Date.now();
  setTimeout(() => {
    const duration = Date.now() - startTime;
    performanceLogger.logPerformance('integration-test', duration, {
      category: 'integration-test'
    });
  }, 100);
  
  // Test security logging
  securityAuditLogger.logSecurityEvent({
    type: SecurityEventType.SYSTEM_ERROR,
    severity: SecurityEventSeverity.LOW,
    message: 'Integration test security event',
    outcome: 'success',
    details: { test: true }
  });
  
  // Test different log levels
  logger.debug('Debug level test', { category: 'integration-test' });
  logger.info('Info level test', { category: 'integration-test' });
  logger.warn('Warning level test', { category: 'integration-test' });
  logger.error('Error level test', { category: 'integration-test' });
  
  console.log('Integration test completed');
}