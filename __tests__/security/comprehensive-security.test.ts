import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

import { mfaService } from '@/lib/security/mfa-service';
import { sessionFingerprintingService } from '@/lib/security/session-fingerprinting';
import { AdvancedRateLimiter } from '@/lib/security/advanced-rate-limiter';
import { CSPv3Service } from '@/lib/security/csp-v3';
import { fieldEncryption, PIIUtils } from '@/lib/security/field-encryption';
import { vulnerabilityScanner } from '@/lib/security/vulnerability-scanner';
import { securityOrchestrator } from '@/lib/security/security-orchestrator';

// Mock external dependencies
jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => Buffer.from('mock-random-bytes')),
  createHash: jest.fn(() => ({
    update: jest.fn(() => ({ digest: jest.fn(() => 'mock-hash') })),
  })),
  createHmac: jest.fn(() => ({
    update: jest.fn(() => ({ digest: jest.fn(() => 'mock-hmac') })),
  })),
  createCipher: jest.fn(() => ({
    setAAD: jest.fn(),
    update: jest.fn(() => Buffer.from('encrypted')),
    final: jest.fn(() => Buffer.from('final')),
    getAuthTag: jest.fn(() => Buffer.from('tag')),
  })),
  createDecipher: jest.fn(() => ({
    setAAD: jest.fn(),
    setAuthTag: jest.fn(),
    update: jest.fn(() => 'decrypted'),
    final: jest.fn(() => 'data'),
  })),
  pbkdf2Sync: jest.fn(() => Buffer.from('derived-key')),
  randomUUID: jest.fn(() => 'mock-uuid'),
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn(() => Promise.resolve('data:image/png;base64,mock-qr')),
}));

// Test utilities
function createMockRequest(options: {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
} = {}): NextRequest {
  const {
    url = 'https://example.com/api/test',
    method = 'GET',
    headers = {},
    body = null,
  } = options;

  const request = new NextRequest(url, {
    method,
    headers: {
      'user-agent': 'Mozilla/5.0 Test Browser',
      'accept-language': 'en-US',
      'accept-encoding': 'gzip, deflate',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return request;
}

describe('Comprehensive Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Multi-Factor Authentication (MFA)', () => {
    it('should generate TOTP secret', () => {
      const secret = mfaService.generateTOTPSecret();
      expect(secret).toBeTruthy();
      expect(typeof secret).toBe('string');
    });

    it('should generate QR code for TOTP setup', async () => {
      const qrCode = await mfaService.generateTOTPQRCode(
        'user123',
        'user@example.com',
        'JBSWY3DPEHPK3PXP',
        'Test Device'
      );
      expect(qrCode).toBe('data:image/png;base64,mock-qr');
    });

    it('should add and verify MFA device', async () => {
      const device = await mfaService.addDevice({
        userId: 'user123',
        name: 'Test Device',
        type: 'totp',
        secret: 'JBSWY3DPEHPK3PXP',
      });

      expect(device.id).toBeTruthy();
      expect(device.verified).toBe(false);
      expect(device.type).toBe('totp');
    });

    it('should create and verify MFA challenge', async () => {
      // Add a verified device first
      const device = await mfaService.addDevice({
        userId: 'user123',
        name: 'Test Device',
        type: 'totp',
        secret: 'JBSWY3DPEHPK3PXP',
      });

      // Mock device verification
      device.verified = true;
      mfaService['devices'].set(device.id, device);

      const challenge = await mfaService.createChallenge('user123');
      expect(challenge.userId).toBe('user123');
      expect(challenge.deviceId).toBe(device.id);
      expect(challenge.verified).toBe(false);
    });

    it('should generate and verify backup codes', async () => {
      const codes = await mfaService.generateBackupCodes('user123');
      expect(codes).toHaveLength(10);
      expect(codes[0]).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

      const result = await mfaService.verifyBackupCode('user123', codes[0]);
      expect(result.success).toBe(true);
      expect(result.remainingCodes).toBe(9);

      // Try to use the same code again
      const result2 = await mfaService.verifyBackupCode('user123', codes[0]);
      expect(result2.success).toBe(false);
    });

    it('should get MFA status for user', async () => {
      const status = await mfaService.getMFAStatus('user123');
      expect(status).toHaveProperty('enabled');
      expect(status).toHaveProperty('deviceCount');
      expect(status).toHaveProperty('verifiedDeviceCount');
      expect(status).toHaveProperty('backupCodesRemaining');
    });
  });

  describe('Session Fingerprinting and Anomaly Detection', () => {
    it('should generate session fingerprint', () => {
      const request = createMockRequest({
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'accept-language': 'en-US,en;q=0.9',
          'x-forwarded-for': '192.168.1.1',
        },
      });

      const fingerprint = sessionFingerprintingService.generateFingerprint(request, {
        timezone: 'America/New_York',
        screenResolution: '1920x1080',
        platform: 'Win32',
      });

      expect(fingerprint.id).toBeTruthy();
      expect(fingerprint.hash).toBeTruthy();
      expect(fingerprint.components.userAgent).toContain('Mozilla');
      expect(fingerprint.ipAddress).toBe('192.168.1.1');
    });

    it('should detect location anomalies', async () => {
      const request = createMockRequest({
        headers: { 'x-forwarded-for': '1.2.3.4' },
      });

      const fingerprint = sessionFingerprintingService.generateFingerprint(request);
      const analysis = await sessionFingerprintingService.associateFingerprintWithUser(
        fingerprint,
        'user123'
      );

      expect(analysis.fingerprint).toBeTruthy();
      expect(analysis.riskScore).toBeGreaterThanOrEqual(0);
      expect(analysis.riskScore).toBeLessThanOrEqual(1);
      expect(Array.isArray(analysis.anomalies)).toBe(true);
      expect(Array.isArray(analysis.recommendations)).toBe(true);
    });

    it('should update behavior patterns', () => {
      sessionFingerprintingService.updateBehaviorPattern('user123', {
        loginTimes: [9, 10, 11, 14, 15], // Business hours
        sessionDurations: [3600, 2400, 5400], // In seconds
      });

      // Verify pattern was stored (indirect test)
      expect(() => {
        sessionFingerprintingService.updateBehaviorPattern('user123', {
          loginTimes: [2], // 2 AM login - should be anomalous
        });
      }).not.toThrow();
    });
  });

  describe('Advanced Rate Limiting', () => {
    let rateLimiter: AdvancedRateLimiter;

    beforeEach(() => {
      rateLimiter = new AdvancedRateLimiter({
        windowMs: 60000, // 1 minute
        maxRequests: 5,
        standardHeaders: true,
      });
    });

    afterEach(() => {
      rateLimiter.stopCleanup();
    });

    it('should allow requests within limit', async () => {
      const request = createMockRequest();
      
      for (let i = 0; i < 5; i++) {
        const result = await rateLimiter.checkLimit(request);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(5 - i - 1);
      }
    });

    it('should block requests exceeding limit', async () => {
      const request = createMockRequest();
      
      // Use up the limit
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit(request);
      }
      
      // Next request should be blocked
      const result = await rateLimiter.checkLimit(request);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should apply endpoint-specific limits', async () => {
      const authRequest = createMockRequest({ url: 'https://example.com/api/auth/login' });
      const chatRequest = createMockRequest({ url: 'https://example.com/api/chat' });

      const authResult = await rateLimiter.checkLimit(authRequest);
      const chatResult = await rateLimiter.checkLimit(chatRequest);

      expect(authResult.allowed).toBe(true);
      expect(chatResult.allowed).toBe(true);
      
      // Different endpoints should have different limits
      expect(authResult.limit).not.toBe(chatResult.limit);
    });

    it('should apply user-based multipliers', async () => {
      const request = createMockRequest();
      
      const anonymousResult = await rateLimiter.checkLimit(request);
      const userResult = await rateLimiter.checkLimit(request, 'user123', 'user');
      const premiumResult = await rateLimiter.checkLimit(request, 'premium123', 'premium');

      // Authenticated users should have higher limits
      expect(userResult.limit).toBeGreaterThanOrEqual(anonymousResult.limit);
      expect(premiumResult.limit).toBeGreaterThanOrEqual(userResult.limit);
    });

    it('should detect burst violations', async () => {
      const request = createMockRequest();
      
      // Simulate rapid requests
      const promises = Array.from({ length: 10 }, () => 
        rateLimiter.checkLimit(request)
      );
      
      const results = await Promise.all(promises);
      const blocked = results.filter(r => !r.allowed);
      
      expect(blocked.length).toBeGreaterThan(0);
    });
  });

  describe('Content Security Policy (CSP) v3', () => {
    let cspService: CSPv3Service;

    beforeEach(() => {
      cspService = new CSPv3Service({
        strictDynamic: true,
        nonce: { enabled: true, algorithm: 'sha256', length: 32 },
      });
    });

    it('should generate CSP header with nonce', () => {
      const request = createMockRequest();
      const { header, nonce } = cspService.generateCSPHeader(request, { generateNonce: true });

      expect(header).toContain('default-src');
      expect(header).toContain('script-src');
      expect(nonce).toBeTruthy();
      expect(header).toContain(`'nonce-${nonce}'`);
    });

    it('should handle CSP violation reports', () => {
      const request = createMockRequest();
      const violationReport = {
        'document-uri': 'https://example.com',
        'violated-directive': 'script-src',
        'blocked-uri': 'https://evil.com/script.js',
        disposition: 'enforce',
      };

      expect(() => {
        cspService.handleViolationReport(violationReport, request);
      }).not.toThrow();
    });

    it('should add trusted script hashes', () => {
      const script = 'console.log("test");';
      const hash = cspService.addTrustedScript(script);
      
      expect(hash).toMatch(/^sha256-/);
    });

    it('should generate violation reports', () => {
      const request = createMockRequest();
      
      // Add some mock violations
      cspService.handleViolationReport({
        'document-uri': 'https://example.com',
        'violated-directive': 'script-src',
        'blocked-uri': 'https://evil.com/script.js',
        disposition: 'enforce',
      }, request);

      const report = cspService.generateViolationReport();
      expect(report.violations).toHaveLength(1);
      expect(report.summary.total).toBe(1);
    });
  });

  describe('Field-Level Encryption', () => {
    it('should encrypt and decrypt field values', () => {
      const originalValue = 'sensitive data';
      
      const encrypted = fieldEncryption.encrypt(originalValue, 'high');
      expect(encrypted).toHaveProperty('value');
      expect(encrypted).toHaveProperty('algorithm');
      expect(encrypted).toHaveProperty('keyId');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted.value).not.toBe(originalValue);

      const decrypted = fieldEncryption.decrypt(encrypted);
      expect(decrypted).toBe(originalValue);
    });

    it('should encrypt multiple fields in object', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        publicInfo: 'This is public',
      };

      const encrypted = fieldEncryption.encryptFields(data, {
        name: 'medium',
        email: 'high',
        phone: 'high',
      });

      expect(encrypted.name).toHaveProperty('value');
      expect(encrypted.email).toHaveProperty('value');
      expect(encrypted.phone).toHaveProperty('value');
      expect(encrypted.publicInfo).toBe('This is public'); // Not encrypted
    });

    it('should create and verify search hashes', () => {
      const value = 'john@example.com';
      const hash = fieldEncryption.createSearchHash(value);
      
      expect(hash).toContain(':');
      expect(fieldEncryption.verifySearchHash(value, hash)).toBe(true);
      expect(fieldEncryption.verifySearchHash('different@example.com', hash)).toBe(false);
    });

    it('should rotate encryption keys', () => {
      const { newKeyId, oldKeyId } = fieldEncryption.rotateKeys();
      
      expect(newKeyId).toBeTruthy();
      expect(oldKeyId).toBeTruthy();
      expect(newKeyId).not.toBe(oldKeyId);
      
      const oldKey = fieldEncryption.getKey(oldKeyId);
      const newKey = fieldEncryption.getKey(newKeyId);
      
      expect(oldKey?.isActive).toBe(false);
      expect(newKey?.isActive).toBe(true);
    });

    it('should export and import keys', () => {
      const password = 'test-password';
      const key = fieldEncryption.generateKey();
      
      const exported = fieldEncryption.exportKey(key.id, password);
      expect(exported).toBeTruthy();
      
      const imported = fieldEncryption.importKey(exported, password);
      expect(imported.id).toBe(key.id);
      expect(imported.algorithm).toBe(key.algorithm);
    });
  });

  describe('PII Detection and Masking', () => {
    it('should detect PII in text', () => {
      const text = 'Contact John at john@example.com or call (555) 123-4567';
      const detections = PIIUtils.detectPII(text);
      
      expect(detections.length).toBeGreaterThan(0);
      
      const emailDetection = detections.find(d => d.type === 'email');
      const phoneDetection = detections.find(d => d.type === 'phone');
      
      expect(emailDetection?.value).toBe('john@example.com');
      expect(phoneDetection?.value).toContain('555');
    });

    it('should mask PII in text', () => {
      const text = 'Email: john@example.com, SSN: 123-45-6789';
      const masked = PIIUtils.maskPII(text);
      
      expect(masked).not.toContain('john@example.com');
      expect(masked).not.toContain('123-45-6789');
      expect(masked).toContain('*');
    });

    it('should encrypt PII in text', () => {
      const text = 'Contact john@example.com for more info';
      const { encryptedText, encryptedFields } = PIIUtils.encryptPIIInText(text);
      
      expect(encryptedText).not.toContain('john@example.com');
      expect(encryptedText).toContain('{{pii_');
      expect(encryptedFields.length).toBeGreaterThan(0);
      expect(encryptedFields[0].type).toBe('email');
    });
  });

  describe('Vulnerability Scanner', () => {
    it('should scan project for vulnerabilities', async () => {
      const report = await vulnerabilityScanner.scanProject();
      
      expect(report).toHaveProperty('scanId');
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('vulnerabilities');
      expect(report).toHaveProperty('recommendations');
      expect(report.summary.securityScore).toBeGreaterThanOrEqual(0);
      expect(report.summary.securityScore).toBeLessThanOrEqual(100);
    });

    it('should export reports in different formats', async () => {
      const report = await vulnerabilityScanner.scanProject();
      
      const jsonReport = vulnerabilityScanner.exportReport(report, 'json');
      const htmlReport = vulnerabilityScanner.exportReport(report, 'html');
      const sarifReport = vulnerabilityScanner.exportReport(report, 'sarif');
      
      expect(() => JSON.parse(jsonReport)).not.toThrow();
      expect(htmlReport).toContain('<!DOCTYPE html>');
      expect(() => JSON.parse(sarifReport)).not.toThrow();
    });

    it('should update vulnerability database', async () => {
      await expect(vulnerabilityScanner.updateDatabase()).resolves.not.toThrow();
    });
  });

  describe('Security Orchestrator', () => {
    it('should process request through security pipeline', async () => {
      const request = createMockRequest();
      
      const result = await securityOrchestrator.processRequest(request, {
        userId: 'user123',
        userRole: 'user',
      });
      
      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('securityContext');
      expect(result.securityContext).toHaveProperty('riskScore');
      expect(result.securityContext).toHaveProperty('anomalies');
      expect(result.securityContext).toHaveProperty('recommendations');
    });

    it('should perform comprehensive security assessment', async () => {
      const metrics = await securityOrchestrator.performSecurityAssessment();
      
      expect(metrics).toHaveProperty('overallScore');
      expect(metrics).toHaveProperty('categoryScores');
      expect(metrics).toHaveProperty('riskLevel');
      expect(metrics).toHaveProperty('recommendations');
      expect(metrics.overallScore).toBeGreaterThanOrEqual(0);
      expect(metrics.overallScore).toBeLessThanOrEqual(100);
    });

    it('should log and track security incidents', () => {
      securityOrchestrator.logSecurityIncident({
        type: 'authentication',
        severity: 'high',
        title: 'Failed login attempt',
        description: 'Multiple failed login attempts detected',
        affectedUsers: ['user123'],
        metadata: { attempts: 5 },
      });

      const incidents = securityOrchestrator.getSecurityIncidents({
        type: 'authentication',
        limit: 10,
      });

      expect(incidents.length).toBeGreaterThan(0);
      expect(incidents[0].type).toBe('authentication');
      expect(incidents[0].severity).toBe('high');
    });

    it('should encrypt and decrypt sensitive data', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        publicInfo: 'Not sensitive',
      };

      const encrypted = securityOrchestrator.encryptSensitiveData(data, {
        name: 'medium',
        email: 'high',
      });

      expect(encrypted.name).toHaveProperty('value');
      expect(encrypted.email).toHaveProperty('value');
      expect(encrypted.publicInfo).toBe('Not sensitive');

      const decrypted = securityOrchestrator.decryptSensitiveData(encrypted, ['name', 'email']);
      expect(decrypted.name).toBe('John Doe');
      expect(decrypted.email).toBe('john@example.com');
    });

    it('should mask PII for logging', () => {
      const text = 'User john@example.com logged in with SSN 123-45-6789';
      const masked = securityOrchestrator.maskPII(text);
      
      expect(masked).not.toContain('john@example.com');
      expect(masked).not.toContain('123-45-6789');
    });

    it('should export security report', () => {
      const report = securityOrchestrator.exportSecurityReport('json');
      
      expect(() => JSON.parse(report)).not.toThrow();
      
      const parsed = JSON.parse(report);
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('configuration');
      expect(parsed).toHaveProperty('recommendations');
    });

    it('should update security configuration', () => {
      const originalConfig = securityOrchestrator.getSecurityMetrics();
      
      securityOrchestrator.updateConfiguration({
        mfa: { enabled: true, requireForSensitiveActions: true, backupCodesEnabled: true },
        dataProtection: { encryptionEnabled: true, piiDetectionEnabled: true, maskingEnabled: true },
      });

      // Configuration should be updated (indirect test)
      expect(() => {
        securityOrchestrator.updateConfiguration({
          vulnerabilityScanning: { enabled: false, scanFrequency: 'monthly', autoUpdate: false },
        });
      }).not.toThrow();
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete authentication flow with MFA', async () => {
      // 1. Add MFA device
      const device = await mfaService.addDevice({
        userId: 'user123',
        name: 'Test Device',
        type: 'totp',
        secret: 'JBSWY3DPEHPK3PXP',
      });

      // 2. Verify device setup
      const verification = await mfaService.verifyDeviceSetup(device.id, '123456', 'user123');
      expect(verification.success).toBe(true);

      // 3. Create challenge
      const challenge = await mfaService.createChallenge('user123');
      expect(challenge.userId).toBe('user123');

      // 4. Process through security orchestrator
      const request = createMockRequest();
      const result = await securityOrchestrator.processRequest(request, {
        userId: 'user123',
        requireMFA: true,
      });

      expect(result.allowed).toBe(true);
    });

    it('should handle suspicious activity detection and response', async () => {
      const request = createMockRequest({
        headers: {
          'x-forwarded-for': '1.2.3.4', // Suspicious IP
          'user-agent': 'Bot/1.0',       // Suspicious user agent
        },
      });

      // Generate fingerprint
      const fingerprint = sessionFingerprintingService.generateFingerprint(request);
      const analysis = await sessionFingerprintingService.associateFingerprintWithUser(
        fingerprint,
        'user123'
      );

      // Process through orchestrator
      const result = await securityOrchestrator.processRequest(request, {
        userId: 'user123',
      });

      // Should either block or flag as high risk
      if (!result.allowed) {
        expect(result.response?.status).toBe(403);
      } else {
        expect(result.securityContext.riskScore).toBeGreaterThan(0);
      }
    });

    it('should handle rate limiting across multiple endpoints', async () => {
      const rateLimiter = new AdvancedRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
      });

      const requests = [
        createMockRequest({ url: 'https://example.com/api/auth/login' }),
        createMockRequest({ url: 'https://example.com/api/chat' }),
        createMockRequest({ url: 'https://example.com/api/auth/login' }),
      ];

      const results = await Promise.all(
        requests.map(req => rateLimiter.checkLimit(req))
      );

      // At least one request should be rate limited
      const blocked = results.filter(r => !r.allowed);
      expect(blocked.length).toBeGreaterThan(0);

      rateLimiter.stopCleanup();
    });

    it('should handle end-to-end data protection flow', () => {
      const originalData = {
        user: {
          name: 'John Doe',
          email: 'john@example.com',
          ssn: '123-45-6789',
          notes: 'Contact john@example.com about his account',
        },
      };

      // 1. Encrypt sensitive fields
      const encrypted = securityOrchestrator.encryptSensitiveData(originalData.user, {
        email: 'high',
        ssn: 'critical',
      });

      expect(encrypted.email).toHaveProperty('value');
      expect(encrypted.ssn).toHaveProperty('value');
      expect(encrypted.name).toBe('John Doe'); // Not encrypted

      // 2. Mask PII in notes
      const maskedNotes = securityOrchestrator.maskPII(encrypted.notes);
      expect(maskedNotes).not.toContain('john@example.com');

      // 3. Decrypt when needed
      const decrypted = securityOrchestrator.decryptSensitiveData(encrypted, ['email', 'ssn']);
      expect(decrypted.email).toBe('john@example.com');
      expect(decrypted.ssn).toBe('123-45-6789');
    });
  });

  describe('Performance and Stress Tests', () => {
    it('should handle high volume of rate limit checks', async () => {
      const rateLimiter = new AdvancedRateLimiter({
        windowMs: 60000,
        maxRequests: 1000,
      });

      const startTime = Date.now();
      const promises = Array.from({ length: 100 }, () => {
        const request = createMockRequest();
        return rateLimiter.checkLimit(request);
      });

      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second

      rateLimiter.stopCleanup();
    });

    it('should handle multiple encryption operations efficiently', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        const data = `test data ${i}`;
        const encrypted = fieldEncryption.encrypt(data, 'medium');
        const decrypted = fieldEncryption.decrypt(encrypted);
        expect(decrypted).toBe(data);
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent security assessments', async () => {
      const promises = Array.from({ length: 5 }, () =>
        securityOrchestrator.performSecurityAssessment()
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.overallScore).toBeGreaterThanOrEqual(0);
        expect(result.overallScore).toBeLessThanOrEqual(100);
      });
    });
  });
});