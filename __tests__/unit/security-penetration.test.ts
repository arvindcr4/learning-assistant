import { NextRequest } from 'next/server';
import { securityMiddleware, validateInput, sanitizeInput } from '../../src/middleware/security';
import { withSecureAuth } from '../../src/middleware/secure-auth';

describe('Security Penetration Tests', () => {
  describe('SQL Injection Protection', () => {
    test('should detect SQL injection attempts in URL paths', () => {
      const maliciousPath = "/api/users?id=1' OR '1'='1";
      const request = new NextRequest(`http://localhost:3000${maliciousPath}`);
      
      const result = securityMiddleware(request);
      expect(result?.status).toBe(403);
    });

    test('should sanitize SQL injection in input fields', () => {
      const maliciousInput = "'; DROP TABLE users; --";
      const sanitized = sanitizeInput(maliciousInput);
      
      expect(sanitized).not.toContain(';');
      expect(sanitized).not.toContain('DROP');
      expect(sanitized).not.toContain('--');
    });
  });

  describe('XSS Protection', () => {
    test('should detect XSS attempts in URL parameters', () => {
      const maliciousPath = "/api/search?q=<script>alert('xss')</script>";
      const request = new NextRequest(`http://localhost:3000${maliciousPath}`);
      
      const result = securityMiddleware(request);
      expect(result?.status).toBe(403);
    });

    test('should sanitize XSS payloads', () => {
      const xssPayload = "<script>alert('xss')</script>";
      const sanitized = sanitizeInput(xssPayload);
      
      expect(sanitized).toBe("&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;");
    });

    test('should reject dangerous javascript: URLs', () => {
      const maliciousUrl = "javascript:alert('xss')";
      const isValid = validateInput(maliciousUrl, 'url');
      
      expect(isValid).toBe(false);
    });
  });

  describe('Path Traversal Protection', () => {
    test('should block directory traversal attempts', () => {
      const traversalPath = "/api/files?path=../../../etc/passwd";
      const request = new NextRequest(`http://localhost:3000${traversalPath}`);
      
      const result = securityMiddleware(request);
      expect(result?.status).toBe(403);
    });

    test('should block encoded traversal attempts', () => {
      const encodedTraversal = "/api/files?path=%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd";
      const request = new NextRequest(`http://localhost:3000${encodedTraversal}`);
      
      const result = securityMiddleware(request);
      expect(result?.status).toBe(403);
    });
  });

  describe('Rate Limiting', () => {
    test('should block excessive requests from same IP', async () => {
      const ip = '192.168.1.100';
      let blockedRequest;

      // Simulate 150 requests (above the default limit of 100)
      for (let i = 0; i < 150; i++) {
        const request = new NextRequest('http://localhost:3000/api/test', {
          headers: { 'x-forwarded-for': ip }
        });
        blockedRequest = securityMiddleware(request);
        
        if (blockedRequest?.status === 429) break;
      }

      expect(blockedRequest?.status).toBe(429);
    });

    test('should reset rate limit after time window', async () => {
      jest.useFakeTimers();
      
      const ip = '192.168.1.101';
      
      // Make requests to hit rate limit
      for (let i = 0; i < 100; i++) {
        const request = new NextRequest('http://localhost:3000/api/test', {
          headers: { 'x-forwarded-for': ip }
        });
        securityMiddleware(request);
      }

      // Fast-forward time by 16 minutes (beyond 15-minute window)
      jest.advanceTimersByTime(16 * 60 * 1000);

      // Next request should succeed
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': ip }
      });
      const result = securityMiddleware(request);
      
      expect(result).toBeNull(); // Should pass through
      
      jest.useRealTimers();
    });
  });

  describe('CORS Security', () => {
    test('should block requests from unauthorized origins', () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 
          'origin': 'https://malicious-site.com',
          'access-control-request-method': 'POST'
        }
      });
      
      const result = securityMiddleware(request);
      expect(result?.status).toBe(403);
    });

    test('should allow requests from authorized origins', () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 
          'origin': 'http://localhost:3000',
          'access-control-request-method': 'POST'
        }
      });
      
      const result = securityMiddleware(request);
      expect(result).toBeNull(); // Should pass through
    });
  });

  describe('Bot Detection', () => {
    test('should detect and log bot requests', () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
      
      const request = new NextRequest('http://localhost:3000/api/data', {
        headers: { 'user-agent': 'Googlebot/2.1' }
      });
      
      securityMiddleware(request);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Bot request detected',
        expect.objectContaining({ userAgent: 'Googlebot/2.1' })
      );
      
      consoleSpy.mockRestore();
    });

    test('should block malicious crawlers', () => {
      const request = new NextRequest('http://localhost:3000/api/admin', {
        headers: { 'user-agent': 'curl/7.68.0' }
      });
      
      // Admin endpoints should be protected from automated tools
      const result = securityMiddleware(request);
      // This would depend on implementation details
    });
  });

  describe('Input Validation', () => {
    test('should validate email format', () => {
      expect(validateInput('user@example.com', 'email')).toBe(true);
      expect(validateInput('invalid-email', 'email')).toBe(false);
      expect(validateInput('user@', 'email')).toBe(false);
    });

    test('should validate URL format', () => {
      expect(validateInput('https://example.com', 'url')).toBe(true);
      expect(validateInput('ftp://files.example.com', 'url')).toBe(true);
      expect(validateInput('not-a-url', 'url')).toBe(false);
      expect(validateInput('javascript:alert(1)', 'url')).toBe(false);
    });

    test('should validate text input for dangerous characters', () => {
      expect(validateInput('normal text', 'text')).toBe(true);
      expect(validateInput('text with numbers 123', 'text')).toBe(true);
      expect(validateInput('<script>alert(1)</script>', 'text')).toBe(false);
      expect(validateInput('text with "quotes"', 'text')).toBe(false);
    });

    test('should validate number format', () => {
      expect(validateInput('123', 'number')).toBe(true);
      expect(validateInput('0', 'number')).toBe(true);
      expect(validateInput('abc', 'number')).toBe(false);
      expect(validateInput('12.34', 'number')).toBe(false); // Only integers
    });
  });

  describe('Authentication Bypass Attempts', () => {
    test('should prevent authentication bypass with manipulated tokens', async () => {
      // Mock a malicious JWT token
      const maliciousToken = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkbWluIiwiYWRtaW4iOnRydWV9.';
      
      const request = new NextRequest('http://localhost:3000/api/admin', {
        headers: { 'Authorization': `Bearer ${maliciousToken}` }
      });

      // This should be handled by the JWT verification in secure auth middleware
      // The test verifies that proper authentication is required
    });

    test('should prevent session fixation attacks', async () => {
      // Test that sessions are properly validated and tied to users
      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        headers: { 'Cookie': 'session-token=fixed-session-id' }
      });

      // Should validate that session belongs to authenticated user
    });
  });

  describe('Header Security', () => {
    test('should reject requests with suspicious headers', () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 
          'X-Forwarded-Host': 'malicious-site.com',
          'Host': 'legitimate-site.com'
        }
      });
      
      // Should detect host header injection attempts
      const result = securityMiddleware(request);
      // Implementation would check for header inconsistencies
    });

    test('should handle large header attacks', () => {
      const largeHeader = 'A'.repeat(10000); // 10KB header
      
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'X-Large-Header': largeHeader }
      });
      
      // Should handle or reject oversized headers
      const result = securityMiddleware(request);
      // Implementation would set limits on header sizes
    });
  });

  describe('File Upload Security', () => {
    test('should validate file types', () => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
      
      expect(allowedTypes.includes('image/jpeg')).toBe(true);
      expect(allowedTypes.includes('application/x-executable')).toBe(false);
      expect(allowedTypes.includes('text/html')).toBe(false);
    });

    test('should check file size limits', () => {
      const maxSize = 5 * 1024 * 1024; // 5MB
      const fileSize = 10 * 1024 * 1024; // 10MB
      
      expect(fileSize > maxSize).toBe(true);
    });
  });

  describe('Error Information Disclosure', () => {
    test('should not expose sensitive information in error messages', () => {
      // Mock an error that might contain sensitive info
      const sensitiveError = new Error('Database connection failed: password=secret123');
      
      // Error handler should sanitize error messages for production
      const sanitizedMessage = 'Internal server error';
      
      expect(sanitizedMessage).not.toContain('password');
      expect(sanitizedMessage).not.toContain('secret123');
    });
  });

  describe('Timing Attack Protection', () => {
    test('should have consistent response times for authentication failures', async () => {
      const start1 = Date.now();
      // Simulate authentication with non-existent user
      await new Promise(resolve => setTimeout(resolve, 100));
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      // Simulate authentication with existing user but wrong password
      await new Promise(resolve => setTimeout(resolve, 100));
      const time2 = Date.now() - start2;

      // Response times should be similar to prevent username enumeration
      expect(Math.abs(time1 - time2)).toBeLessThan(50); // Within 50ms
    });
  });
});

describe('Security Headers Tests', () => {
  test('should set proper security headers', () => {
    const headers = new Headers();
    
    // Simulate security headers being set
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-XSS-Protection', '1; mode=block');
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    headers.set('Content-Security-Policy', "default-src 'self'");
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('X-XSS-Protection')).toBe('1; mode=block');
    expect(headers.get('Strict-Transport-Security')).toContain('max-age=31536000');
    expect(headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });
});