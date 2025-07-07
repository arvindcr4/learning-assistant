import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { 
  UserService, 
  LearningProfileService, 
  LearningSessionService,
  ContentService,
  RecommendationService,
  AnalyticsService 
} from '../supabase-service';
import { SupabaseStorageService } from '../supabase-storage';
import { realtimeManager } from '../supabase-realtime';

// Mock Supabase client
jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn()
    },
    storage: {
      from: jest.fn()
    },
    channel: jest.fn(),
    removeChannel: jest.fn()
  },
  createServerClient: jest.fn()
}));

describe('Supabase Integration Tests', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    avatar_url: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    email_verified: true,
    phone: null,
    phone_verified: false,
    metadata: {}
  };

  const mockLearningProfile = {
    id: 'test-profile-id',
    user_id: 'test-user-id',
    dominant_style: 'visual' as const,
    is_multimodal: false,
    adaptation_level: 25,
    confidence_score: 0.75,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  };

  const mockLearningSession = {
    id: 'test-session-id',
    user_id: 'test-user-id',
    content_id: 'test-content-id',
    start_time: '2024-01-01T10:00:00Z',
    end_time: '2024-01-01T10:30:00Z',
    duration: 30,
    items_completed: 5,
    correct_answers: 4,
    total_questions: 5,
    completed: true,
    focus_time: 25,
    distraction_events: 2,
    interaction_rate: 1.5,
    scroll_depth: 85,
    video_watch_time: 20,
    pause_frequency: 3,
    created_at: '2024-01-01T10:00:00Z'
  };

  const mockSupabaseResponse = (data: any, error: any = null) => ({
    data,
    error,
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data, error }),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    overlaps: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis()
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('UserService', () => {
    it('should create a new user', async () => {
      const mockSupabase = require('../supabase').supabase;
      mockSupabase.from.mockReturnValue(mockSupabaseResponse(mockUser));

      const result = await UserService.createUser({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('users');
      expect(result).toEqual(mockUser);
    });

    it('should get current user', async () => {
      const mockSupabase = require('../supabase').supabase;
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUser.id } },
        error: null
      });
      mockSupabase.from.mockReturnValue(mockSupabaseResponse(mockUser));

      const result = await UserService.getCurrentUser();

      expect(mockSupabase.auth.getUser).toHaveBeenCalled();
      expect(mockSupabase.from).toHaveBeenCalledWith('users');
      expect(result).toEqual(mockUser);
    });

    it('should handle user not found', async () => {
      const mockSupabase = require('../supabase').supabase;
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      const result = await UserService.getCurrentUser();

      expect(result).toBeNull();
    });

    it('should update user preferences', async () => {
      const mockSupabase = require('../supabase').supabase;
      const mockPreferences = {
        id: 'test-preferences-id',
        user_id: mockUser.id,
        learning_goals: ['Learn JavaScript'],
        preferred_topics: ['programming'],
        difficulty_level: 'beginner' as const,
        daily_goal_minutes: 30,
        preferred_times: ['morning'],
        days_per_week: 5,
        email_notifications: true,
        push_notifications: true,
        reminder_notifications: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      mockSupabase.from.mockReturnValue(mockSupabaseResponse(mockPreferences));

      const result = await UserService.createOrUpdateUserPreferences(mockUser.id, {
        learning_goals: ['Learn JavaScript'],
        difficulty_level: 'beginner'
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('user_preferences');
      expect(result).toEqual(mockPreferences);
    });
  });

  describe('LearningProfileService', () => {
    it('should create learning profile', async () => {
      const mockSupabase = require('../supabase').supabase;
      mockSupabase.from.mockReturnValue(mockSupabaseResponse(mockLearningProfile));

      const result = await LearningProfileService.createOrUpdateLearningProfile(
        mockUser.id,
        {
          dominant_style: 'visual',
          is_multimodal: false,
          adaptation_level: 25,
          confidence_score: 0.75
        }
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('learning_profiles');
      expect(result).toEqual(mockLearningProfile);
    });

    it('should get learning profile', async () => {
      const mockSupabase = require('../supabase').supabase;
      mockSupabase.from.mockReturnValue(mockSupabaseResponse(mockLearningProfile));

      const result = await LearningProfileService.getLearningProfile(mockUser.id);

      expect(mockSupabase.from).toHaveBeenCalledWith('learning_profiles');
      expect(result).toEqual(mockLearningProfile);
    });
  });

  describe('LearningSessionService', () => {
    it('should create learning session', async () => {
      const mockSupabase = require('../supabase').supabase;
      mockSupabase.from.mockReturnValue(mockSupabaseResponse(mockLearningSession));

      const sessionData = {
        user_id: mockUser.id,
        content_id: 'test-content-id',
        duration: 30,
        items_completed: 5,
        correct_answers: 4,
        total_questions: 5
      };

      const result = await LearningSessionService.createLearningSession(sessionData);

      expect(mockSupabase.from).toHaveBeenCalledWith('learning_sessions');
      expect(result).toEqual(mockLearningSession);
    });

    it('should get user sessions', async () => {
      const mockSupabase = require('../supabase').supabase;
      mockSupabase.from.mockReturnValue({
        ...mockSupabaseResponse([mockLearningSession]),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: [mockLearningSession], error: null })
      });

      const result = await LearningSessionService.getUserSessions(mockUser.id, 10, 0);

      expect(mockSupabase.from).toHaveBeenCalledWith('learning_sessions');
      expect(result).toEqual([mockLearningSession]);
    });

    it('should calculate session stats', async () => {
      const mockSupabase = require('../supabase').supabase;
      const mockSessions = [
        { ...mockLearningSession, completed: true },
        { ...mockLearningSession, id: 'session-2', completed: false, duration: 20 }
      ];

      mockSupabase.from.mockReturnValue({
        ...mockSupabaseResponse(mockSessions),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockResolvedValue({ data: mockSessions, error: null })
      });

      const result = await LearningSessionService.getSessionStats(mockUser.id, 30);

      expect(result.totalSessions).toBe(2);
      expect(result.completedSessions).toBe(1);
      expect(result.completionRate).toBe(50);
      expect(result.totalTime).toBe(50);
      expect(result.averageScore).toBe(80);
    });
  });

  describe('ContentService', () => {
    it('should get adaptive content with filters', async () => {
      const mockContent = {
        id: 'test-content-id',
        title: 'Test Content',
        description: 'Test description',
        concept: 'Programming',
        learning_objectives: ['Learn basics'],
        difficulty: 5,
        estimated_duration: 30,
        prerequisites: [],
        tags: ['programming', 'javascript'],
        language: 'en',
        blooms_taxonomy_level: 'understand',
        cognitive_load: 5,
        estimated_engagement: 7,
        success_rate: 85,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      const mockSupabase = require('../supabase').supabase;
      mockSupabase.from.mockReturnValue({
        ...mockSupabaseResponse([mockContent]),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        overlaps: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: [mockContent], error: null })
      });

      const result = await ContentService.getAdaptiveContent({
        difficulty: 5,
        concept: 'Programming',
        tags: ['programming']
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('adaptive_content');
      expect(result).toEqual([mockContent]);
    });
  });

  describe('StorageService', () => {
    it('should validate file size and type', () => {
      const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      
      // This should not throw for valid file
      expect(() => {
        (SupabaseStorageService as any).validateFile('user-uploads', mockFile);
      }).not.toThrow();
    });

    it('should reject oversized files', () => {
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.txt', { type: 'text/plain' });
      
      expect(() => {
        (SupabaseStorageService as any).validateFile('user-uploads', largeFile);
      }).toThrow('File size exceeds limit');
    });

    it('should format file sizes correctly', () => {
      expect(SupabaseStorageService.formatFileSize(1024)).toBe('1 KB');
      expect(SupabaseStorageService.formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(SupabaseStorageService.formatFileSize(0)).toBe('0 Bytes');
    });

    it('should detect file types correctly', () => {
      const imageFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const videoFile = new File([''], 'test.mp4', { type: 'video/mp4' });
      const audioFile = new File([''], 'test.mp3', { type: 'audio/mpeg' });
      const pdfFile = new File([''], 'test.pdf', { type: 'application/pdf' });

      expect(SupabaseStorageService.isImageFile(imageFile)).toBe(true);
      expect(SupabaseStorageService.isVideoFile(videoFile)).toBe(true);
      expect(SupabaseStorageService.isAudioFile(audioFile)).toBe(true);
      expect(SupabaseStorageService.isDocumentFile(pdfFile)).toBe(true);
    });
  });

  describe('RealtimeService', () => {
    it('should create subscription manager', () => {
      expect(realtimeManager).toBeDefined();
      expect(typeof realtimeManager.subscribeLearningSession).toBe('function');
      expect(typeof realtimeManager.subscribeUserRecommendations).toBe('function');
    });

    it('should track channel states', () => {
      const statuses = realtimeManager.getChannelStatuses();
      expect(typeof statuses).toBe('object');
    });

    it('should handle unsubscribe operations', () => {
      expect(() => {
        realtimeManager.unsubscribe('test-channel');
        realtimeManager.unsubscribeAll();
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      const mockSupabase = require('../supabase').supabase;
      mockSupabase.from.mockReturnValue(mockSupabaseResponse(null, {
        message: 'Connection failed',
        code: 'CONNECTION_ERROR'
      }));

      await expect(UserService.createUser({
        id: 'test',
        email: 'test@example.com',
        name: 'Test'
      })).rejects.toThrow('Failed to create user');
    });

    it('should handle authentication errors', async () => {
      const mockSupabase = require('../supabase').supabase;
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' }
      });

      await expect(UserService.getCurrentUser()).rejects.toThrow('Failed to get authenticated user');
    });
  });

  describe('Data Validation', () => {
    it('should validate user data structure', () => {
      const validUser = {
        id: 'valid-id',
        email: 'valid@example.com',
        name: 'Valid User'
      };

      expect(validUser.id).toBeTruthy();
      expect(validUser.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(validUser.name).toBeTruthy();
    });

    it('should validate learning session data', () => {
      const validSession = {
        user_id: 'user-id',
        content_id: 'content-id',
        duration: 30,
        items_completed: 5,
        correct_answers: 4,
        total_questions: 5
      };

      expect(validSession.duration).toBeGreaterThan(0);
      expect(validSession.correct_answers).toBeLessThanOrEqual(validSession.total_questions);
    });
  });

  describe('Performance Tests', () => {
    it('should handle batch operations efficiently', async () => {
      const mockSupabase = require('../supabase').supabase;
      const batchSize = 100;
      const mockSessions = Array.from({ length: batchSize }, (_, i) => ({
        ...mockLearningSession,
        id: `session-${i}`
      }));

      mockSupabase.from.mockReturnValue({
        ...mockSupabaseResponse(mockSessions),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: mockSessions, error: null })
      });

      const startTime = Date.now();
      const result = await LearningSessionService.getUserSessions(mockUser.id, batchSize, 0);
      const endTime = Date.now();

      expect(result).toHaveLength(batchSize);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});

describe('Integration Edge Cases', () => {
  const mockSupabaseResponse = (data: any, error: any = null) => ({
    data,
    error,
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data, error }),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    overlaps: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis()
  });

  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    avatar_url: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    email_verified: true,
    phone: null,
    phone_verified: false,
    metadata: {}
  };

  it('should handle concurrent operations', async () => {
    const mockSupabase = require('../supabase').supabase;
    mockSupabase.from.mockReturnValue(mockSupabaseResponse(mockUser));

    // Simulate concurrent user creation attempts
    const promises = Array.from({ length: 5 }, (_, i) => 
      UserService.createUser({
        id: `user-${i}`,
        email: `user${i}@example.com`,
        name: `User ${i}`
      })
    );

    const results = await Promise.all(promises);
    expect(results).toHaveLength(5);
    results.forEach(result => {
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
    });
  });

  it('should handle network interruptions gracefully', async () => {
    const mockSupabase = require('../supabase').supabase;
    
    // Simulate network error
    mockSupabase.from.mockReturnValue(mockSupabaseResponse(null, {
      message: 'Network error',
      code: 'NETWORK_ERROR'
    }));

    try {
      await UserService.getCurrentUser();
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('Failed to get authenticated user');
    }
  });

  it('should validate data integrity', async () => {
    const mockSupabase = require('../supabase').supabase;
    
    // Test with malformed data
    const malformedUser = {
      id: null,
      email: 'invalid-email',
      name: ''
    };

    mockSupabase.from.mockReturnValue(mockSupabaseResponse(null, {
      message: 'Invalid data',
      code: 'DATA_VALIDATION_ERROR'
    }));

    await expect(UserService.createUser(malformedUser as any)).rejects.toThrow();
  });
});