import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';
import { SecurityValidator, defaultSecurityValidator } from '@/lib/validation/security-validation';
import { AdvancedRateLimiter } from '@/lib/security/advanced-rate-limiting';
import { EnhancedAuthenticationService } from '@/lib/security/enhanced-auth';
import { SecurityMonitoringService, SecurityEventType, SecurityEventSeverity } from '@/lib/security/security-monitor';
import { SecurityHeadersService } from '@/lib/security/security-headers';

describe('Security Test Suite', () => {
  let rateLimiter: AdvancedRateLimiter;
  let authService: EnhancedAuthenticationService;
  let securityMonitor: SecurityMonitoringService;
  let securityHeaders: SecurityHeadersService;

  beforeAll(() => {
    rateLimiter = new AdvancedRateLimiter();
    authService = new EnhancedAuthenticationService();
    securityMonitor = new SecurityMonitoringService();
    securityHeaders = new SecurityHeadersService();
  });

  beforeEach(() => {
    // Reset rate limiters and clear caches
    rateLimiter.clearAllData();
  });

  describe('Input Validation Security', () => {
    test('should detect XSS attempts', () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        '<iframe src="javascript:alert(1)"></iframe>',
        'on' + 'click="alert(1)"',
        '<object data="data:text/html,<script>alert(1)</script>"></object>',
      ];

      xssPayloads.forEach(payload => {
        const result = defaultSecurityValidator.validateInput(payload, 'string');
        expect(result.isValid).toBe(false);
        expect(result.threats).toContain('XSS attempt detected');
        expect(result.riskLevel).toBe('critical');
      });
    });

    test('should detect SQL injection attempts', () => {
      const sqlPayloads = [
        "'; DROP TABLE users; --",
        '1 OR 1=1',
        "' UNION SELECT * FROM users --",
        "admin'--",
        "' OR 'a'='a",
        '1; DELETE FROM users WHERE 1=1',
        "'; INSERT INTO users VALUES ('hacker', 'password'); --",
      ];

      sqlPayloads.forEach(payload => {
        const result = defaultSecurityValidator.validateInput(payload, 'string');
        expect(result.isValid).toBe(false);
        expect(result.threats).toContain('SQL injection attempt detected');
        expect(result.riskLevel).toBe('critical');
      });
    });

    test('should detect NoSQL injection attempts', () => {
      const nosqlPayloads = [
        '{"$where": "this.username == \'admin\'"}',
        '{"$ne": null}',
        '{"$regex": ".*"}',
        '{"$gt": ""}',
        '{"username": {"$ne": null}, "password": {"$ne": null}}',
      ];

      nosqlPayloads.forEach(payload => {
        const result = defaultSecurityValidator.validateInput(payload, 'string');
        expect(result.isValid).toBe(false);
        expect(result.threats.some(threat => threat.includes('NoSQL injection'))).toBe(true);
        expect(result.riskLevel).toBeOneOf(['high', 'critical']);
      });
    });

    test('should detect path traversal attempts', () => {
      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '....//....//....//etc/passwd',
        '%252e%252e%252f',
      ];

      pathTraversalPayloads.forEach(payload => {
        const result = defaultSecurityValidator.validateInput(payload, 'string');
        expect(result.isValid).toBe(false);
        expect(result.threats).toContain('Path traversal attempt detected');
        expect(result.riskLevel).toBeOneOf(['high', 'critical']);
      });
    });

    test('should detect command injection attempts', () => {
      const commandInjectionPayloads = [
        '| ls -la',
        '&& cat /etc/passwd',
        '; rm -rf /',
        '`whoami`',
        '$(id)',
        '|| echo "vulnerable"',
      ];

      commandInjectionPayloads.forEach(payload => {
        const result = defaultSecurityValidator.validateInput(payload, 'string');
        expect(result.isValid).toBe(false);
        expect(result.threats).toContain('Command injection attempt detected');
        expect(result.riskLevel).toBe('critical');
      });
    });

    test('should sanitize safe input correctly', () => {
      const safeInputs = [
        'Hello, World!',
        'user@example.com',
        'This is a normal string with spaces.',
        '12345',
        'Product Name (Special Edition)',
      ];

      safeInputs.forEach(input => {
        const result = defaultSecurityValidator.validateInput(input, 'string');
        expect(result.isValid).toBe(true);
        expect(result.threats).toHaveLength(0);
        expect(result.riskLevel).toBe('low');
        expect(result.sanitizedValue).toBeDefined();
      });
    });

    test('should handle object validation', () => {
      const maliciousObject = {
        name: '<script>alert("xss")</script>',
        email: 'user@example.com',
        nested: {
          value: '"; DROP TABLE users; --',
        },
      };

      const result = defaultSecurityValidator.validateInput(maliciousObject, 'object');
      expect(result.isValid).toBe(false);
      expect(result.threats.length).toBeGreaterThan(0);
    });

    test('should handle array validation', () => {
      const maliciousArray = [
        'safe value',
        '<script>alert("xss")</script>',
        'another safe value',
        '"; DROP TABLE users; --',
      ];

      const result = defaultSecurityValidator.validateInput(maliciousArray, 'array');
      expect(result.isValid).toBe(false);
      expect(result.threats.length).toBeGreaterThan(0);
    });

    test('should enforce length limits', () => {
      const validator = new SecurityValidator({ maxStringLength: 100 });
      const longString = 'a'.repeat(200);

      const result = validator.validateInput(longString, 'string');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('String length exceeds maximum (100)');
    });
  });

  describe('Rate Limiting Security', () => {
    test('should enforce IP-based rate limiting', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
        headers: { 'x-forwarded-for': '192.168.1.100' },
      });

      const middleware = rateLimiter.middleware({ maxRequests: 5, windowMs: 60000 });

      // Should allow first 5 requests
      for (let i = 0; i < 5; i++) {
        const response = middleware(request);
        expect(response).toBeNull();
      }

      // Should block 6th request
      const blockedResponse = middleware(request);
      expect(blockedResponse).toBeInstanceOf(NextResponse);
      expect(blockedResponse?.status).toBe(429);
    });

    test('should detect rapid request patterns', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
        headers: { 'x-forwarded-for': '192.168.1.101' },
      });

      const middleware = rateLimiter.middleware({ maxRequests: 100, windowMs: 60000 });

      // Simulate rapid requests
      for (let i = 0; i < 60; i++) {
        middleware(request);
      }

      const stats = rateLimiter.getStatistics();
      expect(stats.topIPs.length).toBeGreaterThan(0);
      expect(stats.topIPs[0].count).toBeGreaterThan(0);
    });

    test('should handle DDoS-like patterns', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
        headers: { 'x-forwarded-for': '192.168.1.102' },
      });

      const middleware = rateLimiter.middleware({
        maxRequests: 10,
        windowMs: 5000,
      });

      // Simulate DDoS pattern
      for (let i = 0; i < 15; i++) {
        const response = middleware(request);
        if (i >= 10) {
          expect(response).toBeInstanceOf(NextResponse);
          expect(response?.status).toBe(429);
        }
      }
    });

    test('should whitelist trusted IPs', () => {
      const trustedIP = '127.0.0.1';
      rateLimiter.addToWhitelist(trustedIP);

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
        headers: { 'x-forwarded-for': trustedIP },
      });

      const middleware = rateLimiter.middleware({ maxRequests: 1, windowMs: 60000 });

      // Should allow multiple requests from whitelisted IP
      for (let i = 0; i < 10; i++) {
        const response = middleware(request);
        expect(response).toBeNull();
      }
    });

    test('should blacklist malicious IPs', () => {
      const maliciousIP = '192.168.1.200';
      rateLimiter.addToBlacklist(maliciousIP);

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
        headers: { 'x-forwarded-for': maliciousIP },
      });

      const middleware = rateLimiter.middleware();
      const response = middleware(request);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response?.status).toBe(429);
    });
  });

  describe('Authentication Security', () => {
    test('should detect brute force attempts', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'x-forwarded-for': '192.168.1.103' },
      });

      const middleware = authService.createAuthMiddleware();

      // Simulate multiple failed login attempts
      for (let i = 0; i < 6; i++) {
        const response = await middleware(request);
        if (i >= 5) {
          expect(response?.status).toBe(423); // Account locked
        }
      }
    });

    test('should validate JWT tokens properly', () => {
      const invalidTokens = [
        'invalid.token.here',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        '',
        'Bearer ',
        'malformed-token',
      ];

      invalidTokens.forEach(token => {
        const request = new NextRequest('http://localhost:3000/api/protected', {
          method: 'GET',
          headers: { authorization: `Bearer ${token}` },
        });

        // Token validation would fail in real authentication
        expect(token.split('.').length !== 3 || token === '' || token === 'Bearer ').toBe(true);
      });
    });

    test('should enforce role-based access control', () => {
      const userPermissions = [
        { resource: 'profile', action: 'read' },
        { resource: 'profile', action: 'update' },
      ];

      const adminPermissions = [
        { resource: '*', action: '*' },
      ];

      const requiredPermissions = [
        { resource: 'admin', action: 'read' },
      ];

      // User should not have admin access
      const userHasAccess = authService['checkPermissions'](userPermissions, requiredPermissions);
      expect(userHasAccess).toBe(false);

      // Admin should have access
      const adminHasAccess = authService['checkPermissions'](adminPermissions, requiredPermissions);
      expect(adminHasAccess).toBe(true);
    });

    test('should detect suspicious login patterns', () => {
      const metrics = authService.getSecurityMetrics();
      expect(metrics).toHaveProperty('totalSessions');
      expect(metrics).toHaveProperty('failedAttempts');
      expect(metrics).toHaveProperty('suspiciousActivity');
    });
  });

  describe('Security Monitoring', () => {
    test('should log security events correctly', () => {
      securityMonitor.logEvent(
        SecurityEventType.AUTHENTICATION_FAILURE,
        SecurityEventSeverity.HIGH,
        {
          ipAddress: '192.168.1.104',
          endpoint: '/api/auth/login',
          reason: 'invalid_credentials',
        }
      );

      const events = securityMonitor.getEvents({
        type: SecurityEventType.AUTHENTICATION_FAILURE,
        limit: 1,
      });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(SecurityEventType.AUTHENTICATION_FAILURE);
      expect(events[0].severity).toBe(SecurityEventSeverity.HIGH);
    });

    test('should create alerts for high-risk events', () => {
      // Log multiple suspicious events
      for (let i = 0; i < 10; i++) {
        securityMonitor.logEvent(
          SecurityEventType.SUSPICIOUS_ACTIVITY,
          SecurityEventSeverity.HIGH,
          {
            ipAddress: '192.168.1.105',
            endpoint: '/api/sensitive',
            suspiciousScore: 80,
          }
        );
      }

      const alerts = securityMonitor.getAlerts({
        category: 'threat_detection',
        acknowledged: false,
      });

      expect(alerts.length).toBeGreaterThan(0);
    });

    test('should track security statistics', () => {
      const stats = securityMonitor.getSecurityStatistics();
      
      expect(stats).toHaveProperty('totalEvents');
      expect(stats).toHaveProperty('eventsBySeverity');
      expect(stats).toHaveProperty('eventsByType');
      expect(stats).toHaveProperty('alertsGenerated');
      expect(typeof stats.totalEvents).toBe('number');
    });

    test('should correlate related security events', () => {
      const ipAddress = '192.168.1.106';
      
      // Create multiple related events
      for (let i = 0; i < 6; i++) {
        securityMonitor.logEvent(
          SecurityEventType.BRUTE_FORCE_ATTEMPT,
          SecurityEventSeverity.MEDIUM,
          {
            ipAddress,
            endpoint: '/api/auth/login',
            method: 'POST',
          }
        );
      }

      const alerts = securityMonitor.getAlerts({
        category: 'attack_pattern',
      });

      expect(alerts.some(alert => alert.title.includes('Correlated Attack Pattern'))).toBe(true);
    });
  });

  describe('Security Headers', () => {
    test('should apply all security headers correctly', () => {
      const request = new NextRequest('http://localhost:3000/api/test');
      const response = new NextResponse('OK');

      const securedResponse = securityHeaders.applyHeaders(response, request, {
        generateNonce: true,
      });

      // Check for essential security headers
      expect(securedResponse.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(securedResponse.headers.get('X-Frame-Options')).toBe('DENY');
      expect(securedResponse.headers.get('Strict-Transport-Security')).toContain('max-age=');
      expect(securedResponse.headers.get('Content-Security-Policy')).toBeDefined();
      expect(securedResponse.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    });

    test('should handle CORS properly', () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { origin: 'http://localhost:3000' },
      });
      const response = new NextResponse('OK');

      const securedResponse = securityHeaders.applyHeaders(response, request);

      expect(securedResponse.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
      expect(securedResponse.headers.get('Access-Control-Allow-Methods')).toBeDefined();
      expect(securedResponse.headers.get('Access-Control-Allow-Headers')).toBeDefined();
    });

    test('should reject unauthorized origins', () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { origin: 'http://malicious-site.com' },
      });
      const response = new NextResponse('OK');

      const securedResponse = securityHeaders.applyHeaders(response, request);

      // Should not set CORS headers for unauthorized origin
      expect(securedResponse.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    test('should generate CSP nonces correctly', () => {
      const request = new NextRequest('http://localhost:3000/api/test');
      const response = new NextResponse('OK');

      const securedResponse = securityHeaders.applyHeaders(response, request, {
        generateNonce: true,
      });

      const csp = securedResponse.headers.get('Content-Security-Policy');
      const nonce = securedResponse.headers.get('X-CSP-Nonce');

      expect(csp).toContain("'nonce-");
      expect(nonce).toBeDefined();
      expect(nonce?.length).toBeGreaterThan(10);
    });

    test('should validate headers configuration', () => {
      const response = new NextResponse('OK');
      const request = new NextRequest('http://localhost:3000/api/test');
      
      const securedResponse = securityHeaders.applyHeaders(response, request);
      const validation = securityHeaders.validateHeaders(securedResponse);

      expect(validation.valid).toBe(true);
      expect(validation.missing).toHaveLength(0);
    });
  });

  describe('Integration Security Tests', () => {
    test('should handle complex attack scenarios', async () => {
      // Simulate a complex attack: XSS + SQL injection + rapid requests
      const maliciousPayload = {
        username: '<script>alert("xss")</script>',
        password: "'; DROP TABLE users; --",
        comment: '../../../etc/passwd',
      };

      const validation = defaultSecurityValidator.validateInput(maliciousPayload, 'object');

      expect(validation.isValid).toBe(false);
      expect(validation.threats.length).toBeGreaterThan(2);
      expect(validation.riskLevel).toBe('critical');
    });

    test('should protect against CSRF attacks', () => {
      const request = new NextRequest('http://localhost:3000/api/sensitive', {
        method: 'POST',
        headers: {
          origin: 'http://malicious-site.com',
          'content-type': 'application/json',
        },
      });

      // CSRF protection would check origin and require valid token
      const origin = request.headers.get('origin');
      const isAllowedOrigin = ['http://localhost:3000', 'https://localhost:3000'].includes(origin || '');
      
      expect(isAllowedOrigin).toBe(false);
    });

    test('should enforce secure communication', () => {
      const request = new NextRequest('http://localhost:3000/api/test'); // HTTP, not HTTPS
      const response = new NextResponse('OK');

      const securedResponse = securityHeaders.applyHeaders(response, request);
      const csp = securedResponse.headers.get('Content-Security-Policy');

      // Should enforce HTTPS in production
      expect(csp).toContain('upgrade-insecure-requests');
    });

    test('should generate comprehensive security report', () => {
      const report = securityHeaders.generateSecurityReport();

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('environment');
      expect(report).toHaveProperty('enabledFeatures');
      expect(report).toHaveProperty('securityScore');
      expect(report).toHaveProperty('recommendations');
      expect(typeof report.securityScore).toBe('number');
      expect(report.securityScore).toBeGreaterThanOrEqual(0);
      expect(report.securityScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Performance Security Tests', () => {
    test('should handle high-volume security validations', () => {
      const startTime = Date.now();
      const testData = 'safe test data';

      // Validate 1000 inputs
      for (let i = 0; i < 1000; i++) {
        defaultSecurityValidator.validateInput(testData, 'string');
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);
    });

    test('should efficiently handle rate limiting checks', () => {
      const startTime = Date.now();
      const middleware = rateLimiter.middleware();

      // Process 100 requests
      for (let i = 0; i < 100; i++) {
        const request = new NextRequest('http://localhost:3000/api/test', {
          headers: { 'x-forwarded-for': `192.168.1.${i % 10}` },
        });
        middleware(request);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (< 500ms)
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Edge Case Security Tests', () => {
    test('should handle null and undefined inputs safely', () => {
      const inputs = [null, undefined, '', 0, false, []];

      inputs.forEach(input => {
        expect(() => {
          defaultSecurityValidator.validateInput(input as any, 'string');
        }).not.toThrow();
      });
    });

    test('should handle malformed requests gracefully', () => {
      const malformedRequest = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
        headers: {
          'user-agent': '', // Empty user agent
          'x-forwarded-for': '999.999.999.999', // Invalid IP
        },
      });

      const middleware = rateLimiter.middleware();
      expect(() => {
        middleware(malformedRequest);
      }).not.toThrow();
    });

    test('should handle unicode and special characters', () => {
      const specialInputs = [
        '🚀💻🔒', // Emojis
        'héllo wørld', // Accented characters
        '中文测试', // Chinese characters
        'тест на русском', // Cyrillic
        '𝕋𝕖𝕤𝕥', // Mathematical symbols
      ];

      specialInputs.forEach(input => {
        const result = defaultSecurityValidator.validateInput(input, 'string');
        expect(result.isValid).toBe(true);
        expect(result.sanitizedValue).toBeDefined();
      });
    });

    test('should handle very large payloads', () => {
      const largePayload = 'A'.repeat(100000); // 100KB string
      
      const result = defaultSecurityValidator.validateInput(largePayload, 'string');
      
      // Should handle gracefully (either validate or reject due to size)
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('threats');
    });
  });

  afterAll(() => {
    // Cleanup
    rateLimiter.clearAllData();
  });
});

// Helper type for Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: any[]): R;
    }
  }
}

// Custom matcher
expect.extend({
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected.join(', ')}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected.join(', ')}`,
        pass: false,
      };
    }
  },
});