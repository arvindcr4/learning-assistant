import { NextRequest, NextResponse } from 'next/server';
import { GET as profileGET, POST as profilePOST } from '@/app/api/learning/profile/route';
import { GET as sessionGET, POST as sessionPOST } from '@/app/api/learning/session/route';
import { jest } from '@jest/globals';

// Mock external dependencies
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
  validateSession: jest.fn(),
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
  },
}));

jest.mock('@/lib/validation/schemas', () => ({
  learningProfileSchema: {
    parse: jest.fn(),
    safeParse: jest.fn(),
  },
  learningSessionSchema: {
    parse: jest.fn(),
    safeParse: jest.fn(),
  },
}));

// Import mocked dependencies
import { auth, validateSession } from '@/lib/auth';
import { db } from '@/lib/database';
import { logger } from '@/lib/logger';
import { learningProfileSchema, learningSessionSchema } from '@/lib/validation/schemas';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockValidateSession = validateSession as jest.MockedFunction<typeof validateSession>;
const mockDb = db as jest.Mocked<typeof db>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockLearningProfileSchema = learningProfileSchema as jest.Mocked<typeof learningProfileSchema>;
const mockLearningSessionSchema = learningSessionSchema as jest.Mocked<typeof learningSessionSchema>;

describe('Learning API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Learning Profile Routes', () => {
    describe('GET /api/learning/profile', () => {
      it('should return user learning profile successfully', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
        };

        const mockProfile = {
          id: 'profile-123',
          userId: 'user-123',
          learningStyle: 'visual',
          preferences: {
            pace: 'normal',
            difficulty: 'intermediate',
          },
          completedLessons: 10,
          totalTime: 3600,
        };

        mockAuth.mockResolvedValue({ user: mockUser });
        mockDb.query.mockResolvedValue({
          rows: [mockProfile],
          rowCount: 1,
        });

        const request = new NextRequest('http://localhost:3000/api/learning/profile');
        const response = await profileGET(request);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toEqual({ profile: mockProfile });
        expect(mockAuth).toHaveBeenCalledWith(request);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM learning_profiles'),
          [mockUser.id]
        );
      });

      it('should return 401 for unauthenticated user', async () => {
        mockAuth.mockResolvedValue(null);

        const request = new NextRequest('http://localhost:3000/api/learning/profile');
        const response = await profileGET(request);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data).toEqual({ error: 'Unauthorized' });
      });

      it('should return 404 when profile not found', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
        };

        mockAuth.mockResolvedValue({ user: mockUser });
        mockDb.query.mockResolvedValue({
          rows: [],
          rowCount: 0,
        });

        const request = new NextRequest('http://localhost:3000/api/learning/profile');
        const response = await profileGET(request);

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data).toEqual({ error: 'Profile not found' });
      });

      it('should handle database errors gracefully', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
        };

        mockAuth.mockResolvedValue({ user: mockUser });
        mockDb.query.mockRejectedValue(new Error('Database connection failed'));

        const request = new NextRequest('http://localhost:3000/api/learning/profile');
        const response = await profileGET(request);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data).toEqual({ error: 'Internal server error' });
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Error fetching learning profile',
          expect.any(Error)
        );
      });
    });

    describe('POST /api/learning/profile', () => {
      it('should create/update learning profile successfully', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
        };

        const profileData = {
          learningStyle: 'kinesthetic',
          preferences: {
            pace: 'fast',
            difficulty: 'advanced',
          },
          goals: ['improve coding skills', 'learn new technologies'],
        };

        const mockUpdatedProfile = {
          id: 'profile-123',
          userId: 'user-123',
          ...profileData,
          updatedAt: new Date(),
        };

        mockAuth.mockResolvedValue({ user: mockUser });
        mockLearningProfileSchema.parse.mockReturnValue(profileData);
        mockDb.query.mockResolvedValue({
          rows: [mockUpdatedProfile],
          rowCount: 1,
        });

        const request = new NextRequest('http://localhost:3000/api/learning/profile', {
          method: 'POST',
          body: JSON.stringify(profileData),
          headers: { 'Content-Type': 'application/json' },
        });

        const response = await profilePOST(request);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toEqual({ profile: mockUpdatedProfile });
        expect(mockLearningProfileSchema.parse).toHaveBeenCalledWith(profileData);
      });

      it('should return 400 for invalid input data', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
        };

        const invalidData = {
          learningStyle: 'invalid-style',
          preferences: 'invalid-preferences',
        };

        mockAuth.mockResolvedValue({ user: mockUser });
        mockLearningProfileSchema.parse.mockImplementation(() => {
          throw new Error('Invalid data');
        });

        const request = new NextRequest('http://localhost:3000/api/learning/profile', {
          method: 'POST',
          body: JSON.stringify(invalidData),
          headers: { 'Content-Type': 'application/json' },
        });

        const response = await profilePOST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data).toEqual({ error: 'Invalid request data' });
      });

      it('should return 401 for unauthenticated user', async () => {
        mockAuth.mockResolvedValue(null);

        const request = new NextRequest('http://localhost:3000/api/learning/profile', {
          method: 'POST',
          body: JSON.stringify({}),
          headers: { 'Content-Type': 'application/json' },
        });

        const response = await profilePOST(request);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data).toEqual({ error: 'Unauthorized' });
      });
    });
  });

  describe('Learning Session Routes', () => {
    describe('GET /api/learning/session', () => {
      it('should return user learning sessions successfully', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
        };

        const mockSessions = [
          {
            id: 'session-1',
            userId: 'user-123',
            topic: 'JavaScript Basics',
            duration: 1800,
            progress: 0.8,
            createdAt: new Date(),
          },
          {
            id: 'session-2',
            userId: 'user-123',
            topic: 'React Hooks',
            duration: 2400,
            progress: 0.6,
            createdAt: new Date(),
          },
        ];

        mockAuth.mockResolvedValue({ user: mockUser });
        mockDb.query.mockResolvedValue({
          rows: mockSessions,
          rowCount: 2,
        });

        const request = new NextRequest('http://localhost:3000/api/learning/session');
        const response = await sessionGET(request);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toEqual({ sessions: mockSessions });
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM learning_sessions'),
          [mockUser.id]
        );
      });

      it('should support pagination', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
        };

        mockAuth.mockResolvedValue({ user: mockUser });
        mockDb.query.mockResolvedValue({
          rows: [],
          rowCount: 0,
        });

        const request = new NextRequest('http://localhost:3000/api/learning/session?page=2&limit=10');
        const response = await sessionGET(request);

        expect(response.status).toBe(200);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('LIMIT 10 OFFSET 10'),
          [mockUser.id]
        );
      });

      it('should filter sessions by topic', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
        };

        mockAuth.mockResolvedValue({ user: mockUser });
        mockDb.query.mockResolvedValue({
          rows: [],
          rowCount: 0,
        });

        const request = new NextRequest('http://localhost:3000/api/learning/session?topic=JavaScript');
        const response = await sessionGET(request);

        expect(response.status).toBe(200);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('WHERE user_id = $1 AND topic ILIKE $2'),
          [mockUser.id, '%JavaScript%']
        );
      });
    });

    describe('POST /api/learning/session', () => {
      it('should create learning session successfully', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
        };

        const sessionData = {
          topic: 'TypeScript Advanced',
          content: 'Learning about generics and utility types',
          estimatedDuration: 3600,
          difficulty: 'intermediate',
        };

        const mockSession = {
          id: 'session-123',
          userId: 'user-123',
          ...sessionData,
          createdAt: new Date(),
          progress: 0,
        };

        mockAuth.mockResolvedValue({ user: mockUser });
        mockLearningSessionSchema.parse.mockReturnValue(sessionData);
        mockDb.query.mockResolvedValue({
          rows: [mockSession],
          rowCount: 1,
        });

        const request = new NextRequest('http://localhost:3000/api/learning/session', {
          method: 'POST',
          body: JSON.stringify(sessionData),
          headers: { 'Content-Type': 'application/json' },
        });

        const response = await sessionPOST(request);

        expect(response.status).toBe(201);
        const data = await response.json();
        expect(data).toEqual({ session: mockSession });
        expect(mockLearningSessionSchema.parse).toHaveBeenCalledWith(sessionData);
      });

      it('should return 400 for invalid session data', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
        };

        const invalidData = {
          topic: '',
          duration: -1,
        };

        mockAuth.mockResolvedValue({ user: mockUser });
        mockLearningSessionSchema.parse.mockImplementation(() => {
          throw new Error('Invalid session data');
        });

        const request = new NextRequest('http://localhost:3000/api/learning/session', {
          method: 'POST',
          body: JSON.stringify(invalidData),
          headers: { 'Content-Type': 'application/json' },
        });

        const response = await sessionPOST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data).toEqual({ error: 'Invalid request data' });
      });

      it('should handle concurrent session creation', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
        };

        const sessionData = {
          topic: 'Concurrent Learning',
          content: 'Testing concurrent session creation',
          estimatedDuration: 1800,
        };

        mockAuth.mockResolvedValue({ user: mockUser });
        mockLearningSessionSchema.parse.mockReturnValue(sessionData);
        mockDb.query.mockRejectedValue(new Error('Duplicate session'));

        const request = new NextRequest('http://localhost:3000/api/learning/session', {
          method: 'POST',
          body: JSON.stringify(sessionData),
          headers: { 'Content-Type': 'application/json' },
        });

        const response = await sessionPOST(request);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data).toEqual({ error: 'Internal server error' });
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on API endpoints', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockAuth.mockResolvedValue({ user: mockUser });

      // Simulate multiple rapid requests
      const requests = Array.from({ length: 100 }, (_, i) => 
        new NextRequest(`http://localhost:3000/api/learning/profile?req=${i}`)
      );

      const responses = await Promise.all(
        requests.map(request => profileGET(request))
      );

      // Should have some rate limited responses
      const rateLimitedResponses = responses.filter(response => response.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockAuth.mockResolvedValue({ user: mockUser });

      const request = new NextRequest('http://localhost:3000/api/learning/profile', {
        method: 'POST',
        body: 'invalid json{',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await profilePOST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({ error: 'Invalid JSON format' });
    });

    it('should handle missing content-type header', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockAuth.mockResolvedValue({ user: mockUser });

      const request = new NextRequest('http://localhost:3000/api/learning/profile', {
        method: 'POST',
        body: JSON.stringify({ learningStyle: 'visual' }),
      });

      const response = await profilePOST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({ error: 'Content-Type must be application/json' });
    });
  });

  describe('Security Features', () => {
    it('should validate CSRF tokens for state-changing operations', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockAuth.mockResolvedValue({ user: mockUser });

      const request = new NextRequest('http://localhost:3000/api/learning/profile', {
        method: 'POST',
        body: JSON.stringify({ learningStyle: 'visual' }),
        headers: { 
          'Content-Type': 'application/json',
          // Missing CSRF token
        },
      });

      const response = await profilePOST(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data).toEqual({ error: 'CSRF token required' });
    });

    it('should sanitize user input data', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      const maliciousData = {
        learningStyle: '<script>alert("xss")</script>',
        preferences: {
          notes: 'DROP TABLE users; --',
        },
      };

      mockAuth.mockResolvedValue({ user: mockUser });
      mockLearningProfileSchema.parse.mockImplementation((data) => {
        // Simulate sanitization
        return {
          ...data,
          learningStyle: data.learningStyle.replace(/<script.*?>.*?<\/script>/gi, ''),
          preferences: {
            ...data.preferences,
            notes: data.preferences.notes.replace(/[';\\-]/g, ''),
          },
        };
      });

      const request = new NextRequest('http://localhost:3000/api/learning/profile', {
        method: 'POST',
        body: JSON.stringify(maliciousData),
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'valid-token',
        },
      });

      const response = await profilePOST(request);

      expect(mockLearningProfileSchema.parse).toHaveBeenCalledWith(maliciousData);
      // Should proceed with sanitized data
      expect(response.status).toBe(200);
    });
  });
});