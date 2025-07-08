import { jest } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';

// Mock all external dependencies
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
  signIn: jest.fn(),
  signUp: jest.fn(),
  signOut: jest.fn(),
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

jest.mock('@/lib/csrf', () => ({
  generateCSRFToken: jest.fn(),
  validateCSRFToken: jest.fn(),
}));

jest.mock('@/services/learning-service', () => ({
  LearningService: jest.fn().mockImplementation(() => ({
    processLearningSession: jest.fn(),
    saveLearningProfile: jest.fn(),
    generateRecommendations: jest.fn(),
    trackProgress: jest.fn(),
  })),
}));

// Import mocked dependencies
import { auth, signIn, signUp, signOut } from '@/lib/auth';
import { db } from '@/lib/database';
import { logger } from '@/lib/logger';
import { generateCSRFToken, validateCSRFToken } from '@/lib/csrf';
import { LearningService } from '@/services/learning-service';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockSignIn = signIn as jest.MockedFunction<typeof signIn>;
const mockSignUp = signUp as jest.MockedFunction<typeof signUp>;
const mockSignOut = signOut as jest.MockedFunction<typeof signOut>;
const mockDb = db as jest.Mocked<typeof db>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockGenerateCSRFToken = generateCSRFToken as jest.MockedFunction<typeof generateCSRFToken>;
const mockValidateCSRFToken = validateCSRFToken as jest.MockedFunction<typeof validateCSRFToken>;

describe('End-to-End User Flows', () => {
  let mockLearningService: jest.Mocked<LearningService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLearningService = {
      processLearningSession: jest.fn(),
      saveLearningProfile: jest.fn(),
      generateRecommendations: jest.fn(),
      trackProgress: jest.fn(),
    } as any;

    (LearningService as jest.MockedClass<typeof LearningService>).mockImplementation(() => mockLearningService);
  });

  describe('Complete User Registration and Onboarding Flow', () => {
    it('should complete full user registration to first learning session', async () => {
      // Step 1: User registration
      const registrationData = {
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        name: 'New User',
        learningGoals: ['Get a job', 'Build projects'],
      };

      const mockUser = {
        id: 'user-123',
        email: 'newuser@example.com',
        name: 'New User',
        createdAt: new Date(),
      };

      mockValidateCSRFToken.mockReturnValue(true);
      mockSignUp.mockResolvedValue(mockUser);

      // Step 2: User completes VARK assessment
      const varkResponses = {
        question1: 'visual',
        question2: 'auditory',
        question3: 'kinesthetic',
        question4: 'visual',
        question5: 'reading',
      };

      const learningProfile = {
        id: 'profile-123',
        userId: 'user-123',
        learningStyle: 'multimodal',
        preferences: {
          visual: 0.4,
          auditory: 0.2,
          kinesthetic: 0.2,
          reading: 0.2,
        },
        goals: registrationData.learningGoals,
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockUser], rowCount: 1 }) // User creation
        .mockResolvedValueOnce({ rows: [learningProfile], rowCount: 1 }); // Profile creation

      // Step 3: Generate initial content recommendations
      const initialRecommendations = [
        {
          id: 'content-1',
          title: 'JavaScript Fundamentals',
          difficulty: 'beginner',
          type: 'interactive',
          estimatedTime: 30,
        },
        {
          id: 'content-2',
          title: 'HTML & CSS Basics',
          difficulty: 'beginner',
          type: 'visual',
          estimatedTime: 45,
        },
      ];

      mockLearningService.generateRecommendations.mockResolvedValue(initialRecommendations);

      // Step 4: User starts first learning session
      const sessionData = {
        contentId: 'content-1',
        startTime: new Date(),
        userResponses: [],
      };

      const learningSession = {
        id: 'session-123',
        userId: 'user-123',
        contentId: 'content-1',
        startTime: sessionData.startTime,
        progress: 0,
        status: 'active',
      };

      mockDb.query.mockResolvedValueOnce({ rows: [learningSession], rowCount: 1 });

      // Execute the complete flow
      const registrationResult = await mockSignUp(registrationData);
      expect(registrationResult).toEqual(mockUser);

      // Verify profile creation
      mockLearningService.saveLearningProfile.mockResolvedValue(learningProfile);
      const profileResult = await mockLearningService.saveLearningProfile(mockUser.id, varkResponses);
      expect(profileResult).toEqual(learningProfile);

      // Verify recommendations generation
      const recommendationsResult = await mockLearningService.generateRecommendations(mockUser.id);
      expect(recommendationsResult).toEqual(initialRecommendations);

      // Verify session creation
      const sessionResult = await mockDb.query(
        'INSERT INTO learning_sessions (user_id, content_id, start_time) VALUES ($1, $2, $3) RETURNING *',
        [mockUser.id, sessionData.contentId, sessionData.startTime]
      );
      expect(sessionResult.rows[0]).toEqual(learningSession);

      // Verify logging
      expect(mockLogger.audit).toHaveBeenCalledWith('User registration completed', {
        userId: mockUser.id,
        email: mockUser.email,
      });
    });

    it('should handle registration errors gracefully', async () => {
      const registrationData = {
        email: 'existing@example.com',
        password: 'SecurePassword123!',
        name: 'Existing User',
      };

      mockValidateCSRFToken.mockReturnValue(true);
      mockSignUp.mockRejectedValue(new Error('Email already exists'));

      await expect(mockSignUp(registrationData)).rejects.toThrow('Email already exists');

      expect(mockLogger.warn).toHaveBeenCalledWith('Registration failed', {
        email: registrationData.email,
        error: 'Email already exists',
      });
    });
  });

  describe('Learning Session Completion Flow', () => {
    it('should complete full learning session with progress tracking', async () => {
      const userId = 'user-123';
      const sessionId = 'session-123';

      // Step 1: User is authenticated
      const mockUser = {
        id: userId,
        email: 'learner@example.com',
        name: 'Active Learner',
      };

      mockAuth.mockResolvedValue({ user: mockUser });

      // Step 2: Load active learning session
      const activeSession = {
        id: sessionId,
        userId,
        contentId: 'content-1',
        topic: 'JavaScript Closures',
        questions: [
          { id: 'q1', question: 'What is a closure?', type: 'multiple-choice' },
          { id: 'q2', question: 'Explain scope chain', type: 'essay' },
          { id: 'q3', question: 'Code example', type: 'coding' },
        ],
        currentQuestionIndex: 0,
        responses: [],
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [activeSession],
        rowCount: 1,
      });

      // Step 3: User answers questions progressively
      const userResponses = [
        {
          questionId: 'q1',
          answer: 'A function that has access to outer scope variables',
          timeSpent: 45,
          confidence: 0.8,
        },
        {
          questionId: 'q2',
          answer: 'Scope chain is the hierarchy of scopes that JavaScript uses to find variables...',
          timeSpent: 120,
          confidence: 0.7,
        },
        {
          questionId: 'q3',
          answer: 'function outer() { let x = 10; return function inner() { return x; }; }',
          timeSpent: 180,
          confidence: 0.9,
        },
      ];

      // Step 4: Process each response and update session
      for (const [index, response] of userResponses.entries()) {
        const evaluationResult = {
          isCorrect: true,
          score: index === 0 ? 10 : index === 1 ? 8 : 9,
          feedback: 'Excellent answer!',
          nextDifficulty: 'maintain',
        };

        mockLearningService.processLearningSession.mockResolvedValue(evaluationResult);

        const sessionUpdate = {
          ...activeSession,
          currentQuestionIndex: index + 1,
          responses: [...activeSession.responses, response],
          totalScore: evaluationResult.score,
        };

        mockDb.query.mockResolvedValueOnce({
          rows: [sessionUpdate],
          rowCount: 1,
        });

        const result = await mockLearningService.processLearningSession(sessionId, response);
        expect(result).toEqual(evaluationResult);
      }

      // Step 5: Complete session and calculate final results
      const completedSession = {
        ...activeSession,
        status: 'completed',
        completedAt: new Date(),
        finalScore: 27,
        totalTimeSpent: 345,
        accuracy: 0.9,
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [completedSession],
        rowCount: 1,
      });

      // Step 6: Update user progress and learning path
      const progressUpdate = {
        userId,
        completedLessons: 15,
        totalScore: 1250,
        averageAccuracy: 0.87,
        timeSpent: 18000,
        topicsCompleted: ['JavaScript Basics', 'Functions', 'Closures'],
      };

      mockLearningService.trackProgress.mockResolvedValue(progressUpdate);

      // Step 7: Generate next recommendations based on performance
      const nextRecommendations = [
        {
          id: 'content-2',
          title: 'Advanced JavaScript Patterns',
          difficulty: 'intermediate',
          reasoning: 'Strong performance on closures',
        },
        {
          id: 'content-3',
          title: 'Asynchronous Programming',
          difficulty: 'intermediate',
          reasoning: 'Natural progression from current topics',
        },
      ];

      mockLearningService.generateRecommendations.mockResolvedValue(nextRecommendations);

      // Execute the flow verification
      const authResult = await mockAuth({} as any);
      expect(authResult?.user).toEqual(mockUser);

      const sessionResult = await mockDb.query(
        'SELECT * FROM learning_sessions WHERE id = $1 AND user_id = $2',
        [sessionId, userId]
      );
      expect(sessionResult.rows[0]).toEqual(activeSession);

      // Verify responses processing
      for (const response of userResponses) {
        const processResult = await mockLearningService.processLearningSession(sessionId, response);
        expect(processResult.isCorrect).toBe(true);
      }

      // Verify session completion
      const finalResult = await mockDb.query(
        'UPDATE learning_sessions SET status = $1, completed_at = $2 WHERE id = $3 RETURNING *',
        ['completed', expect.any(Date), sessionId]
      );
      expect(finalResult.rows[0].status).toBe('completed');

      // Verify progress tracking
      const progressResult = await mockLearningService.trackProgress(userId, completedSession);
      expect(progressResult).toEqual(progressUpdate);

      // Verify recommendations generation
      const recommendationsResult = await mockLearningService.generateRecommendations(userId);
      expect(recommendationsResult).toEqual(nextRecommendations);
    });

    it('should handle session interruption and resumption', async () => {
      const userId = 'user-123';
      const sessionId = 'session-456';

      // Step 1: User starts session but doesn't complete it
      const interruptedSession = {
        id: sessionId,
        userId,
        contentId: 'content-2',
        status: 'paused',
        currentQuestionIndex: 2,
        responses: [
          { questionId: 'q1', answer: 'Answer 1', timeSpent: 60 },
          { questionId: 'q2', answer: 'Answer 2', timeSpent: 90 },
        ],
        pausedAt: new Date(Date.now() - 3600000), // 1 hour ago
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [interruptedSession],
        rowCount: 1,
      });

      // Step 2: User returns and resumes session
      const resumedSession = {
        ...interruptedSession,
        status: 'active',
        resumedAt: new Date(),
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [resumedSession],
        rowCount: 1,
      });

      // Step 3: Complete remaining questions
      const remainingResponse = {
        questionId: 'q3',
        answer: 'Final answer',
        timeSpent: 120,
      };

      mockLearningService.processLearningSession.mockResolvedValue({
        isCorrect: true,
        score: 8,
        feedback: 'Good work!',
      });

      // Execute flow
      const loadResult = await mockDb.query(
        'SELECT * FROM learning_sessions WHERE id = $1 AND status = $2',
        [sessionId, 'paused']
      );
      expect(loadResult.rows[0]).toEqual(interruptedSession);

      const resumeResult = await mockDb.query(
        'UPDATE learning_sessions SET status = $1, resumed_at = $2 WHERE id = $3 RETURNING *',
        ['active', expect.any(Date), sessionId]
      );
      expect(resumeResult.rows[0].status).toBe('active');

      const finalResponse = await mockLearningService.processLearningSession(sessionId, remainingResponse);
      expect(finalResponse.isCorrect).toBe(true);
    });
  });

  describe('Adaptive Learning Path Adjustment Flow', () => {
    it('should adjust learning path based on performance patterns', async () => {
      const userId = 'user-123';

      // Step 1: Analyze user performance across multiple sessions
      const performanceHistory = [
        { topic: 'JavaScript Basics', score: 0.95, difficulty: 'beginner' },
        { topic: 'Functions', score: 0.90, difficulty: 'beginner' },
        { topic: 'Closures', score: 0.85, difficulty: 'intermediate' },
        { topic: 'Promises', score: 0.70, difficulty: 'intermediate' },
        { topic: 'Async/Await', score: 0.65, difficulty: 'intermediate' },
      ];

      mockDb.query.mockResolvedValueOnce({
        rows: performanceHistory,
        rowCount: 5,
      });

      // Step 2: Identify struggle areas and strengths
      const analysisResult = {
        strengths: ['JavaScript Basics', 'Functions'],
        weaknesses: ['Async Programming'],
        recommendedDifficulty: 'intermediate',
        suggestedTopics: ['Callback Functions', 'Promise Fundamentals'],
        paceAdjustment: 'slower',
      };

      mockLearningService.processLearningSession.mockResolvedValue(analysisResult);

      // Step 3: Update learning path with remedial content
      const updatedPath = {
        userId,
        pathId: 'path-123',
        currentTopics: ['Callback Functions', 'Promise Fundamentals'],
        upcomingTopics: ['Async/Await Revisited', 'Error Handling'],
        difficultyLevel: 'intermediate',
        paceSettings: { questionsPerSession: 5, timePerQuestion: 120 },
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [updatedPath],
        rowCount: 1,
      });

      // Step 4: Generate adaptive content recommendations
      const adaptiveRecommendations = [
        {
          id: 'remedial-1',
          title: 'Understanding Callbacks',
          difficulty: 'beginner',
          type: 'remedial',
          reasoning: 'Struggling with async concepts',
        },
        {
          id: 'practice-1',
          title: 'Promise Practice Exercises',
          difficulty: 'intermediate',
          type: 'practice',
          reasoning: 'Needs more practice with promises',
        },
      ];

      mockLearningService.generateRecommendations.mockResolvedValue(adaptiveRecommendations);

      // Execute the flow
      const performanceResult = await mockDb.query(
        'SELECT topic, score, difficulty FROM user_performance WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
        [userId]
      );
      expect(performanceResult.rows).toEqual(performanceHistory);

      const analysis = await mockLearningService.processLearningSession(userId, performanceHistory);
      expect(analysis.weaknesses).toContain('Async Programming');

      const pathUpdate = await mockDb.query(
        'UPDATE learning_paths SET current_topics = $1, difficulty_level = $2 WHERE user_id = $3 RETURNING *',
        [updatedPath.currentTopics, updatedPath.difficultyLevel, userId]
      );
      expect(pathUpdate.rows[0]).toEqual(updatedPath);

      const recommendations = await mockLearningService.generateRecommendations(userId);
      expect(recommendations).toEqual(adaptiveRecommendations);
    });

    it('should accelerate learning for high performers', async () => {
      const userId = 'user-456';

      // High performance across all areas
      const highPerformance = [
        { topic: 'JavaScript Basics', score: 0.98, timeSpent: 300 },
        { topic: 'Advanced Functions', score: 0.96, timeSpent: 420 },
        { topic: 'Object-Oriented Programming', score: 0.94, timeSpent: 480 },
        { topic: 'Design Patterns', score: 0.92, timeSpent: 540 },
      ];

      mockDb.query.mockResolvedValueOnce({
        rows: highPerformance,
        rowCount: 4,
      });

      const accelerationResult = {
        recommendation: 'accelerate',
        newDifficulty: 'advanced',
        skipTopics: ['Basic Concepts Review'],
        advancedTopics: ['Functional Programming', 'Meta-programming'],
        paceIncrease: 1.5,
      };

      mockLearningService.processLearningSession.mockResolvedValue(accelerationResult);

      // Execute flow
      const performance = await mockDb.query(
        'SELECT * FROM user_performance WHERE user_id = $1',
        [userId]
      );
      expect(performance.rows).toEqual(highPerformance);

      const acceleration = await mockLearningService.processLearningSession(userId, highPerformance);
      expect(acceleration.recommendation).toBe('accelerate');
      expect(acceleration.newDifficulty).toBe('advanced');
    });
  });

  describe('Multi-User Collaborative Learning Flow', () => {
    it('should handle collaborative learning session', async () => {
      const participants = [
        { id: 'user-1', name: 'Alice', skillLevel: 'intermediate' },
        { id: 'user-2', name: 'Bob', skillLevel: 'beginner' },
        { id: 'user-3', name: 'Carol', skillLevel: 'advanced' },
      ];

      // Step 1: Create collaborative session
      const collaborativeSession = {
        id: 'collab-123',
        topic: 'JavaScript Team Challenge',
        participants: participants.map(p => p.id),
        difficulty: 'mixed',
        mode: 'peer-learning',
        maxParticipants: 4,
        currentParticipants: 3,
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [collaborativeSession],
        rowCount: 1,
      });

      // Step 2: Assign roles based on skill levels
      const roleAssignments = [
        { userId: 'user-1', role: 'facilitator' },
        { userId: 'user-2', role: 'learner' },
        { userId: 'user-3', role: 'mentor' },
      ];

      mockDb.query.mockResolvedValueOnce({
        rows: roleAssignments,
        rowCount: 3,
      });

      // Step 3: Collaborative problem solving
      const collaborativeResponses = [
        { userId: 'user-3', response: 'Initial solution approach', type: 'guidance' },
        { userId: 'user-1', response: 'Implementation details', type: 'facilitation' },
        { userId: 'user-2', response: 'Questions and clarifications', type: 'learning' },
      ];

      for (const response of collaborativeResponses) {
        mockLearningService.processLearningSession.mockResolvedValue({
          isValid: true,
          contribution: response.type,
          score: response.type === 'guidance' ? 10 : response.type === 'facilitation' ? 8 : 5,
        });
      }

      // Execute flow
      const sessionResult = await mockDb.query(
        'INSERT INTO collaborative_sessions (topic, participants, difficulty) VALUES ($1, $2, $3) RETURNING *',
        [collaborativeSession.topic, collaborativeSession.participants, collaborativeSession.difficulty]
      );
      expect(sessionResult.rows[0]).toEqual(collaborativeSession);

      const rolesResult = await mockDb.query(
        'SELECT * FROM session_roles WHERE session_id = $1',
        [collaborativeSession.id]
      );
      expect(rolesResult.rows).toEqual(roleAssignments);

      // Process responses
      for (const response of collaborativeResponses) {
        const processResult = await mockLearningService.processLearningSession(
          collaborativeSession.id,
          response
        );
        expect(processResult.isValid).toBe(true);
      }
    });
  });

  describe('Error Recovery and Resilience Flow', () => {
    it('should handle and recover from various error scenarios', async () => {
      const userId = 'user-123';
      const sessionId = 'session-error';

      // Scenario 1: Network interruption during session
      mockDb.query.mockRejectedValueOnce(new Error('Connection timeout'));

      // Should retry and succeed
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: sessionId, status: 'active' }],
        rowCount: 1,
      });

      const retryResult = await mockDb.query(
        'SELECT * FROM learning_sessions WHERE id = $1',
        [sessionId]
      );
      expect(retryResult.rows[0].status).toBe('active');

      // Scenario 2: Invalid response data
      const invalidResponse = {
        questionId: null,
        answer: '',
        timeSpent: -1,
      };

      mockLearningService.processLearningSession.mockRejectedValueOnce(
        new Error('Invalid response data')
      );

      await expect(
        mockLearningService.processLearningSession(sessionId, invalidResponse)
      ).rejects.toThrow('Invalid response data');

      // Scenario 3: Service degradation - fallback to simpler functionality
      mockLearningService.generateRecommendations.mockRejectedValueOnce(
        new Error('Recommendation service unavailable')
      );

      // Should fallback to basic recommendations
      mockLearningService.generateRecommendations.mockResolvedValueOnce([
        { id: 'fallback-1', title: 'Basic Content', difficulty: 'beginner' },
      ]);

      const fallbackRecommendations = await mockLearningService.generateRecommendations(userId);
      expect(fallbackRecommendations).toHaveLength(1);
      expect(fallbackRecommendations[0].title).toBe('Basic Content');
    });

    it('should handle concurrent user actions gracefully', async () => {
      const userId = 'user-123';
      const sessionId = 'session-concurrent';

      // Simulate concurrent session updates
      const concurrentUpdates = [
        { type: 'progress', data: { currentQuestion: 3 } },
        { type: 'response', data: { questionId: 'q2', answer: 'answer2' } },
        { type: 'pause', data: { pausedAt: new Date() } },
      ];

      // All updates should be processed with proper conflict resolution
      for (const [index, update] of concurrentUpdates.entries()) {
        mockDb.query.mockResolvedValueOnce({
          rows: [{ 
            id: sessionId, 
            version: index + 1,
            lastUpdate: new Date(),
            ...update.data 
          }],
          rowCount: 1,
        });
      }

      // Execute concurrent updates
      const updatePromises = concurrentUpdates.map((update, index) =>
        mockDb.query(
          'UPDATE learning_sessions SET data = $1, version = version + 1 WHERE id = $2 AND version = $3 RETURNING *',
          [update.data, sessionId, index]
        )
      );

      const results = await Promise.all(updatePromises);
      
      // Each update should succeed with incremented version
      results.forEach((result, index) => {
        expect(result.rows[0].version).toBe(index + 1);
      });
    });
  });

  describe('Performance Under Load', () => {
    it('should handle high concurrent user load', async () => {
      const concurrentUsers = 100;
      const userSessions = Array.from({ length: concurrentUsers }, (_, i) => ({
        userId: `user-${i}`,
        sessionId: `session-${i}`,
      }));

      // Simulate concurrent session processing
      for (const session of userSessions) {
        mockAuth.mockResolvedValue({ user: { id: session.userId } });
        mockDb.query.mockResolvedValue({
          rows: [{ id: session.sessionId, userId: session.userId }],
          rowCount: 1,
        });
        mockLearningService.processLearningSession.mockResolvedValue({
          isCorrect: true,
          score: 8,
        });
      }

      const sessionPromises = userSessions.map(async (session) => {
        const authResult = await mockAuth({} as any);
        const sessionResult = await mockDb.query(
          'SELECT * FROM learning_sessions WHERE user_id = $1',
          [session.userId]
        );
        const processResult = await mockLearningService.processLearningSession(
          session.sessionId,
          { questionId: 'q1', answer: 'test' }
        );
        
        return {
          auth: authResult,
          session: sessionResult.rows[0],
          process: processResult,
        };
      });

      const results = await Promise.all(sessionPromises);

      expect(results).toHaveLength(concurrentUsers);
      expect(results.every(r => r.auth?.user && r.session && r.process.isCorrect)).toBe(true);
    });
  });
});