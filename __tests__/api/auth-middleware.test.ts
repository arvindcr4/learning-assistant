import { NextRequest, NextResponse } from 'next/server';
import { GET as authGET, POST as authPOST } from '@/app/api/auth/[...all]/route';
import { jest } from '@jest/globals';

// Mock external dependencies
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  signUp: jest.fn(),
  validateCredentials: jest.fn(),
  generateSession: jest.fn(),
  refreshSession: jest.fn(),
}));

jest.mock('@/lib/password', () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
}));

jest.mock('@/lib/csrf', () => ({
  generateCSRFToken: jest.fn(),
  validateCSRFToken: jest.fn(),
}));

jest.mock('@/lib/database', () => ({
  db: {
    query: jest.fn(),
    transaction: jest.fn(),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    audit: jest.fn(),
  },
}));

// Import mocked dependencies
import { auth, signIn, signOut, signUp, validateCredentials, generateSession, refreshSession } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/password';
import { generateCSRFToken, validateCSRFToken } from '@/lib/csrf';
import { db } from '@/lib/database';
import { logger } from '@/lib/logger';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockSignIn = signIn as jest.MockedFunction<typeof signIn>;
const mockSignOut = signOut as jest.MockedFunction<typeof signOut>;
const mockSignUp = signUp as jest.MockedFunction<typeof signUp>;
const mockValidateCredentials = validateCredentials as jest.MockedFunction<typeof validateCredentials>;
const mockGenerateSession = generateSession as jest.MockedFunction<typeof generateSession>;
const mockRefreshSession = refreshSession as jest.MockedFunction<typeof refreshSession>;
const mockHashPassword = hashPassword as jest.MockedFunction<typeof hashPassword>;
const mockVerifyPassword = verifyPassword as jest.MockedFunction<typeof verifyPassword>;
const mockGenerateCSRFToken = generateCSRFToken as jest.MockedFunction<typeof generateCSRFToken>;
const mockValidateCSRFToken = validateCSRFToken as jest.MockedFunction<typeof validateCSRFToken>;
const mockDb = db as jest.Mocked<typeof db>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('Authentication Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should authenticate user with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        token: 'jwt-token',
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockValidateCredentials.mockResolvedValue(mockUser);
      mockGenerateSession.mockResolvedValue(mockSession);
      mockValidateCSRFToken.mockReturnValue(true);

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginData),
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'valid-csrf-token',
        },
      });

      const response = await authPOST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
        user: mockUser,
        session: mockSession,
      });
      expect(mockValidateCredentials).toHaveBeenCalledWith(loginData.email, loginData.password);
      expect(mockGenerateSession).toHaveBeenCalledWith(mockUser.id);
      expect(mockLogger.audit).toHaveBeenCalledWith('User login successful', {
        userId: mockUser.id,
        email: mockUser.email,
      });
    });

    it('should reject invalid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      mockValidateCredentials.mockResolvedValue(null);
      mockValidateCSRFToken.mockReturnValue(true);

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginData),
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'valid-csrf-token',
        },
      });

      const response = await authPOST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({ error: 'Invalid credentials' });
      expect(mockLogger.warn).toHaveBeenCalledWith('Failed login attempt', {
        email: loginData.email,
        ip: expect.any(String),
      });
    });

    it('should reject requests without CSRF token', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
      };

      mockValidateCSRFToken.mockReturnValue(false);

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginData),
        headers: { 
          'Content-Type': 'application/json',
        },
      });

      const response = await authPOST(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data).toEqual({ error: 'CSRF token required' });
    });

    it('should implement rate limiting for login attempts', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      mockValidateCredentials.mockResolvedValue(null);
      mockValidateCSRFToken.mockReturnValue(true);

      // Simulate multiple failed attempts
      const requests = Array.from({ length: 10 }, () => 
        new NextRequest('http://localhost:3000/api/auth/login', {
          method: 'POST',
          body: JSON.stringify(loginData),
          headers: { 
            'Content-Type': 'application/json',
            'X-CSRF-Token': 'valid-csrf-token',
          },
        })
      );

      const responses = await Promise.all(
        requests.map(request => authPOST(request))
      );

      // Should have rate limited responses after threshold
      const rateLimitedResponses = responses.filter(response => response.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should handle account lockout after multiple failed attempts', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      mockValidateCredentials.mockResolvedValue(null);
      mockValidateCSRFToken.mockReturnValue(true);
      mockDb.query.mockResolvedValue({
        rows: [{ failed_attempts: 5, locked_until: new Date(Date.now() + 900000) }],
        rowCount: 1,
      });

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginData),
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'valid-csrf-token',
        },
      });

      const response = await authPOST(request);

      expect(response.status).toBe(423);
      const data = await response.json();
      expect(data).toEqual({ 
        error: 'Account temporarily locked',
        lockedUntil: expect.any(String),
      });
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register new user with valid data', async () => {
      const registerData = {
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        name: 'New User',
      };

      const mockUser = {
        id: 'user-456',
        email: 'newuser@example.com',
        name: 'New User',
        role: 'user',
      };

      mockSignUp.mockResolvedValue(mockUser);
      mockHashPassword.mockResolvedValue('hashed-password');
      mockValidateCSRFToken.mockReturnValue(true);

      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(registerData),
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'valid-csrf-token',
        },
      });

      const response = await authPOST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toEqual({ user: mockUser });
      expect(mockHashPassword).toHaveBeenCalledWith(registerData.password);
      expect(mockSignUp).toHaveBeenCalledWith({
        ...registerData,
        password: 'hashed-password',
      });
    });

    it('should reject weak passwords', async () => {
      const registerData = {
        email: 'newuser@example.com',
        password: '123',
        name: 'New User',
      };

      mockValidateCSRFToken.mockReturnValue(true);

      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(registerData),
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'valid-csrf-token',
        },
      });

      const response = await authPOST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({ 
        error: 'Password does not meet requirements',
        requirements: expect.any(Array),
      });
    });

    it('should reject duplicate email addresses', async () => {
      const registerData = {
        email: 'existing@example.com',
        password: 'SecurePassword123!',
        name: 'New User',
      };

      mockSignUp.mockRejectedValue(new Error('User already exists'));
      mockValidateCSRFToken.mockReturnValue(true);

      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(registerData),
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'valid-csrf-token',
        },
      });

      const response = await authPOST(request);

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data).toEqual({ error: 'Email already registered' });
    });

    it('should validate email format', async () => {
      const registerData = {
        email: 'invalid-email',
        password: 'SecurePassword123!',
        name: 'New User',
      };

      mockValidateCSRFToken.mockReturnValue(true);

      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(registerData),
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'valid-csrf-token',
        },
      });

      const response = await authPOST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({ error: 'Invalid email format' });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout user and invalidate session', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockAuth.mockResolvedValue({ user: mockUser });
      mockSignOut.mockResolvedValue(true);

      const request = new NextRequest('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        headers: { 
          'Authorization': 'Bearer valid-token',
        },
      });

      const response = await authPOST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ message: 'Logout successful' });
      expect(mockSignOut).toHaveBeenCalledWith(mockUser.id);
      expect(mockLogger.audit).toHaveBeenCalledWith('User logout', {
        userId: mockUser.id,
      });
    });

    it('should handle logout for unauthenticated user', async () => {
      mockAuth.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/auth/logout', {
        method: 'POST',
      });

      const response = await authPOST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({ error: 'Not authenticated' });
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh valid session token', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      const mockNewSession = {
        id: 'session-456',
        userId: 'user-123',
        token: 'new-jwt-token',
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockAuth.mockResolvedValue({ user: mockUser });
      mockRefreshSession.mockResolvedValue(mockNewSession);

      const request = new NextRequest('http://localhost:3000/api/auth/refresh', {
        method: 'POST',
        headers: { 
          'Authorization': 'Bearer valid-token',
        },
      });

      const response = await authPOST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ session: mockNewSession });
      expect(mockRefreshSession).toHaveBeenCalledWith(mockUser.id);
    });

    it('should reject expired or invalid tokens', async () => {
      mockAuth.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/auth/refresh', {
        method: 'POST',
        headers: { 
          'Authorization': 'Bearer expired-token',
        },
      });

      const response = await authPOST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({ error: 'Invalid or expired token' });
    });
  });

  describe('Session Management', () => {
    it('should enforce session timeout', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      const expiredSession = {
        id: 'session-123',
        userId: 'user-123',
        token: 'expired-token',
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      };

      mockAuth.mockResolvedValue(null); // Should return null for expired session

      const request = new NextRequest('http://localhost:3000/api/auth/profile', {
        method: 'GET',
        headers: { 
          'Authorization': 'Bearer expired-token',
        },
      });

      const response = await authGET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({ error: 'Session expired' });
    });

    it('should handle concurrent sessions', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockAuth.mockResolvedValue({ user: mockUser });
      mockDb.query.mockResolvedValue({
        rows: [
          { id: 'session-1', token: 'token-1' },
          { id: 'session-2', token: 'token-2' },
          { id: 'session-3', token: 'token-3' },
        ],
        rowCount: 3,
      });

      const request = new NextRequest('http://localhost:3000/api/auth/sessions', {
        method: 'GET',
        headers: { 
          'Authorization': 'Bearer valid-token',
        },
      });

      const response = await authGET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.sessions).toHaveLength(3);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in all responses', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/csrf', {
        method: 'GET',
      });

      const response = await authGET(request);

      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
      expect(response.headers.get('Strict-Transport-Security')).toBeTruthy();
      expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
    });

    it('should generate CSRF tokens', async () => {
      const mockToken = 'csrf-token-123';
      mockGenerateCSRFToken.mockReturnValue(mockToken);

      const request = new NextRequest('http://localhost:3000/api/auth/csrf', {
        method: 'GET',
      });

      const response = await authGET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ csrfToken: mockToken });
    });
  });

  describe('Input Validation', () => {
    it('should sanitize input data', async () => {
      const maliciousData = {
        email: 'test@example.com<script>alert("xss")</script>',
        password: 'password',
        name: 'Test<img src=x onerror=alert("xss")>',
      };

      mockValidateCSRFToken.mockReturnValue(true);

      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(maliciousData),
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'valid-csrf-token',
        },
      });

      const response = await authPOST(request);

      // Should either reject or sanitize the input
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should validate request size limits', async () => {
      const largeData = {
        email: 'test@example.com',
        password: 'A'.repeat(10000), // Very long password
        name: 'Test User',
      };

      mockValidateCSRFToken.mockReturnValue(true);

      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(largeData),
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'valid-csrf-token',
        },
      });

      const response = await authPOST(request);

      expect(response.status).toBe(413);
      const data = await response.json();
      expect(data).toEqual({ error: 'Request entity too large' });
    });
  });
});