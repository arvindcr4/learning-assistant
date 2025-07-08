import { jest } from '@jest/globals';

// Mock dependencies
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

jest.mock('@/lib/cache', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));

// Import the modules to test
import { LearningEngine } from '@/lib/learning-engine';
import { AdaptiveAssessment } from '@/lib/adaptive-assessment';
import { DifficultyCalibration } from '@/lib/difficulty-calibration';
import { SpacedRepetition } from '@/lib/spaced-repetition';
import { ContentRecommendation } from '@/lib/content-recommendation';
import { db } from '@/lib/database';
import { logger } from '@/lib/logger';
import { cache } from '@/lib/cache';

const mockDb = db as jest.Mocked<typeof db>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockCache = cache as jest.Mocked<typeof cache>;

describe('Learning Algorithms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('LearningEngine', () => {
    let learningEngine: LearningEngine;

    beforeEach(() => {
      learningEngine = new LearningEngine();
    });

    describe('analyzeUserPerformance', () => {
      it('should analyze user performance correctly', async () => {
        const userId = 'user-123';
        const performanceData = [
          { topic: 'JavaScript', score: 85, timeSpent: 1800, difficulty: 'intermediate' },
          { topic: 'React', score: 92, timeSpent: 2400, difficulty: 'advanced' },
          { topic: 'CSS', score: 78, timeSpent: 1200, difficulty: 'beginner' },
        ];

        mockDb.query.mockResolvedValue({
          rows: performanceData,
          rowCount: 3,
        });

        const result = await learningEngine.analyzeUserPerformance(userId);

        expect(result).toEqual({
          averageScore: 85,
          totalTimeSpent: 5400,
          strengthAreas: ['React'],
          weaknessAreas: ['CSS'],
          recommendedDifficulty: 'intermediate',
          learningVelocity: expect.any(Number),
        });

        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM user_performance'),
          [userId]
        );
      });

      it('should handle empty performance data', async () => {
        const userId = 'user-123';

        mockDb.query.mockResolvedValue({
          rows: [],
          rowCount: 0,
        });

        const result = await learningEngine.analyzeUserPerformance(userId);

        expect(result).toEqual({
          averageScore: 0,
          totalTimeSpent: 0,
          strengthAreas: [],
          weaknessAreas: [],
          recommendedDifficulty: 'beginner',
          learningVelocity: 0,
        });
      });

      it('should cache performance analysis results', async () => {
        const userId = 'user-123';
        const cacheKey = `performance:${userId}`;
        const cachedResult = { averageScore: 85, cached: true };

        mockCache.get.mockResolvedValue(cachedResult);

        const result = await learningEngine.analyzeUserPerformance(userId);

        expect(result).toEqual(cachedResult);
        expect(mockCache.get).toHaveBeenCalledWith(cacheKey);
        expect(mockDb.query).not.toHaveBeenCalled();
      });

      it('should handle database errors gracefully', async () => {
        const userId = 'user-123';

        mockDb.query.mockRejectedValue(new Error('Database connection failed'));

        const result = await learningEngine.analyzeUserPerformance(userId);

        expect(result).toEqual({
          averageScore: 0,
          totalTimeSpent: 0,
          strengthAreas: [],
          weaknessAreas: [],
          recommendedDifficulty: 'beginner',
          learningVelocity: 0,
        });

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Error analyzing user performance',
          expect.any(Error)
        );
      });
    });

    describe('generatePersonalizedContent', () => {
      it('should generate content based on user profile', async () => {
        const userId = 'user-123';
        const userProfile = {
          learningStyle: 'visual',
          preferences: { difficulty: 'intermediate', pace: 'normal' },
          strengths: ['JavaScript', 'React'],
          weaknesses: ['Testing', 'Performance'],
        };

        mockDb.query.mockResolvedValueOnce({
          rows: [userProfile],
          rowCount: 1,
        });

        mockDb.query.mockResolvedValueOnce({
          rows: [
            { id: 'content-1', title: 'Advanced Testing', difficulty: 'intermediate' },
            { id: 'content-2', title: 'Performance Optimization', difficulty: 'intermediate' },
          ],
          rowCount: 2,
        });

        const result = await learningEngine.generatePersonalizedContent(userId);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
          id: 'content-1',
          title: 'Advanced Testing',
          difficulty: 'intermediate',
          adaptations: expect.any(Object),
        });

        expect(mockDb.query).toHaveBeenCalledTimes(2);
      });

      it('should adapt content for different learning styles', async () => {
        const userId = 'user-123';
        const visualProfile = {
          learningStyle: 'visual',
          preferences: { difficulty: 'beginner' },
        };

        mockDb.query.mockResolvedValueOnce({
          rows: [visualProfile],
          rowCount: 1,
        });

        mockDb.query.mockResolvedValueOnce({
          rows: [{ id: 'content-1', title: 'JavaScript Basics', type: 'text' }],
          rowCount: 1,
        });

        const result = await learningEngine.generatePersonalizedContent(userId);

        expect(result[0].adaptations).toEqual({
          visualElements: expect.any(Array),
          interactiveComponents: expect.any(Array),
          mediaType: 'video',
        });
      });

      it('should handle kinesthetic learning style', async () => {
        const userId = 'user-123';
        const kinestheticProfile = {
          learningStyle: 'kinesthetic',
          preferences: { difficulty: 'intermediate' },
        };

        mockDb.query.mockResolvedValueOnce({
          rows: [kinestheticProfile],
          rowCount: 1,
        });

        mockDb.query.mockResolvedValueOnce({
          rows: [{ id: 'content-1', title: 'Hands-on Coding', type: 'practical' }],
          rowCount: 1,
        });

        const result = await learningEngine.generatePersonalizedContent(userId);

        expect(result[0].adaptations).toEqual({
          interactiveExercises: expect.any(Array),
          practicalProjects: expect.any(Array),
          mediaType: 'interactive',
        });
      });
    });

    describe('updateLearningPath', () => {
      it('should update learning path based on progress', async () => {
        const userId = 'user-123';
        const progressData = {
          completedLessons: 15,
          averageScore: 88,
          timeSpent: 7200,
          strugglingAreas: ['Async Programming'],
        };

        mockDb.query.mockResolvedValue({
          rows: [{ id: 'path-1', topics: ['JavaScript', 'React', 'Node.js'] }],
          rowCount: 1,
        });

        const result = await learningEngine.updateLearningPath(userId, progressData);

        expect(result).toEqual({
          pathId: 'path-1',
          updatedTopics: expect.any(Array),
          nextRecommendations: expect.any(Array),
          adjustedDifficulty: expect.any(String),
        });

        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE learning_paths'),
          expect.any(Array)
        );
      });

      it('should create new learning path for new users', async () => {
        const userId = 'user-456';
        const progressData = {
          completedLessons: 0,
          averageScore: 0,
          timeSpent: 0,
          strugglingAreas: [],
        };

        mockDb.query.mockResolvedValue({
          rows: [],
          rowCount: 0,
        });

        mockDb.query.mockResolvedValueOnce({
          rows: [{ id: 'path-new', topics: ['JavaScript Basics'] }],
          rowCount: 1,
        });

        const result = await learningEngine.updateLearningPath(userId, progressData);

        expect(result.pathId).toBe('path-new');
        expect(result.updatedTopics).toContain('JavaScript Basics');
      });
    });
  });

  describe('AdaptiveAssessment', () => {
    let adaptiveAssessment: AdaptiveAssessment;

    beforeEach(() => {
      adaptiveAssessment = new AdaptiveAssessment();
    });

    describe('generateQuestions', () => {
      it('should generate questions based on difficulty level', async () => {
        const topic = 'JavaScript';
        const difficulty = 'intermediate';
        const questionCount = 5;

        mockDb.query.mockResolvedValue({
          rows: [
            { id: 'q1', question: 'What is closure?', difficulty: 'intermediate' },
            { id: 'q2', question: 'Explain hoisting', difficulty: 'intermediate' },
            { id: 'q3', question: 'What is prototype?', difficulty: 'intermediate' },
            { id: 'q4', question: 'Async vs Sync', difficulty: 'intermediate' },
            { id: 'q5', question: 'Event loop', difficulty: 'intermediate' },
          ],
          rowCount: 5,
        });

        const result = await adaptiveAssessment.generateQuestions(topic, difficulty, questionCount);

        expect(result).toHaveLength(5);
        expect(result[0]).toEqual({
          id: 'q1',
          question: 'What is closure?',
          difficulty: 'intermediate',
          metadata: expect.any(Object),
        });
      });

      it('should adapt question difficulty based on user performance', async () => {
        const userId = 'user-123';
        const currentScore = 0.9; // 90% correct
        const topic = 'JavaScript';

        mockDb.query.mockResolvedValue({
          rows: [
            { id: 'q1', question: 'Advanced concepts', difficulty: 'advanced' },
          ],
          rowCount: 1,
        });

        const result = await adaptiveAssessment.generateAdaptiveQuestions(userId, topic, currentScore);

        expect(result[0].difficulty).toBe('advanced');
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('difficulty >= $1'),
          expect.arrayContaining(['advanced'])
        );
      });

      it('should simplify questions for poor performance', async () => {
        const userId = 'user-123';
        const currentScore = 0.4; // 40% correct
        const topic = 'JavaScript';

        mockDb.query.mockResolvedValue({
          rows: [
            { id: 'q1', question: 'Basic concepts', difficulty: 'beginner' },
          ],
          rowCount: 1,
        });

        const result = await adaptiveAssessment.generateAdaptiveQuestions(userId, topic, currentScore);

        expect(result[0].difficulty).toBe('beginner');
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('difficulty <= $1'),
          expect.arrayContaining(['beginner'])
        );
      });
    });

    describe('evaluateResponse', () => {
      it('should evaluate correct answers', async () => {
        const questionId = 'q1';
        const userAnswer = 'A closure is a function that has access to outer scope';
        const correctAnswer = 'A closure is a function that has access to outer scope';

        mockDb.query.mockResolvedValue({
          rows: [{ id: 'q1', correct_answer: correctAnswer, points: 10 }],
          rowCount: 1,
        });

        const result = await adaptiveAssessment.evaluateResponse(questionId, userAnswer);

        expect(result).toEqual({
          isCorrect: true,
          score: 10,
          feedback: expect.any(String),
          explanation: expect.any(String),
        });
      });

      it('should evaluate incorrect answers with feedback', async () => {
        const questionId = 'q1';
        const userAnswer = 'Wrong answer';
        const correctAnswer = 'Correct answer';

        mockDb.query.mockResolvedValue({
          rows: [{ id: 'q1', correct_answer: correctAnswer, points: 10 }],
          rowCount: 1,
        });

        const result = await adaptiveAssessment.evaluateResponse(questionId, userAnswer);

        expect(result).toEqual({
          isCorrect: false,
          score: 0,
          feedback: expect.stringContaining('incorrect'),
          explanation: expect.stringContaining('correct answer'),
        });
      });

      it('should handle partial credit for essay questions', async () => {
        const questionId = 'q1';
        const userAnswer = 'Partially correct answer with some key concepts';
        const correctAnswer = 'Complete answer with all key concepts';

        mockDb.query.mockResolvedValue({
          rows: [{ id: 'q1', correct_answer: correctAnswer, points: 10, type: 'essay' }],
          rowCount: 1,
        });

        const result = await adaptiveAssessment.evaluateResponse(questionId, userAnswer);

        expect(result.score).toBeGreaterThan(0);
        expect(result.score).toBeLessThan(10);
        expect(result.feedback).toContain('partial credit');
      });
    });
  });

  describe('DifficultyCalibration', () => {
    let difficultyCalibration: DifficultyCalibration;

    beforeEach(() => {
      difficultyCalibration = new DifficultyCalibration();
    });

    describe('calibrateDifficulty', () => {
      it('should calibrate difficulty based on user performance', async () => {
        const userId = 'user-123';
        const performanceHistory = [
          { difficulty: 'beginner', score: 0.95, timeSpent: 300 },
          { difficulty: 'intermediate', score: 0.85, timeSpent: 600 },
          { difficulty: 'advanced', score: 0.60, timeSpent: 900 },
        ];

        mockDb.query.mockResolvedValue({
          rows: performanceHistory,
          rowCount: 3,
        });

        const result = await difficultyCalibration.calibrateDifficulty(userId);

        expect(result).toEqual({
          recommendedDifficulty: 'intermediate',
          confidenceLevel: expect.any(Number),
          reasoningFactors: expect.any(Array),
        });
      });

      it('should recommend easier content for struggling users', async () => {
        const userId = 'user-123';
        const poorPerformance = [
          { difficulty: 'intermediate', score: 0.45, timeSpent: 1200 },
          { difficulty: 'intermediate', score: 0.40, timeSpent: 1500 },
          { difficulty: 'beginner', score: 0.80, timeSpent: 600 },
        ];

        mockDb.query.mockResolvedValue({
          rows: poorPerformance,
          rowCount: 3,
        });

        const result = await difficultyCalibration.calibrateDifficulty(userId);

        expect(result.recommendedDifficulty).toBe('beginner');
        expect(result.reasoningFactors).toContain('low_intermediate_scores');
      });

      it('should recommend harder content for excelling users', async () => {
        const userId = 'user-123';
        const excellentPerformance = [
          { difficulty: 'beginner', score: 0.98, timeSpent: 200 },
          { difficulty: 'intermediate', score: 0.95, timeSpent: 400 },
          { difficulty: 'advanced', score: 0.85, timeSpent: 600 },
        ];

        mockDb.query.mockResolvedValue({
          rows: excellentPerformance,
          rowCount: 3,
        });

        const result = await difficultyCalibration.calibrateDifficulty(userId);

        expect(result.recommendedDifficulty).toBe('advanced');
        expect(result.reasoningFactors).toContain('high_scores_all_levels');
      });
    });

    describe('adjustDifficultyInRealTime', () => {
      it('should adjust difficulty during active session', async () => {
        const sessionId = 'session-123';
        const currentDifficulty = 'intermediate';
        const recentPerformance = [
          { isCorrect: true, timeSpent: 30 },
          { isCorrect: true, timeSpent: 25 },
          { isCorrect: true, timeSpent: 20 },
        ];

        const result = await difficultyCalibration.adjustDifficultyInRealTime(
          sessionId,
          currentDifficulty,
          recentPerformance
        );

        expect(result).toEqual({
          newDifficulty: 'advanced',
          shouldAdjust: true,
          adjustmentReason: 'consecutive_correct_answers',
        });
      });

      it('should not adjust too frequently', async () => {
        const sessionId = 'session-123';
        const currentDifficulty = 'intermediate';
        const recentPerformance = [
          { isCorrect: false, timeSpent: 120 },
        ];

        // Mock recent adjustment
        mockCache.get.mockResolvedValue(Date.now() - 30000); // 30 seconds ago

        const result = await difficultyCalibration.adjustDifficultyInRealTime(
          sessionId,
          currentDifficulty,
          recentPerformance
        );

        expect(result.shouldAdjust).toBe(false);
        expect(result.adjustmentReason).toBe('too_recent_adjustment');
      });
    });
  });

  describe('SpacedRepetition', () => {
    let spacedRepetition: SpacedRepetition;

    beforeEach(() => {
      spacedRepetition = new SpacedRepetition();
    });

    describe('calculateNextReview', () => {
      it('should calculate next review date based on performance', async () => {
        const cardId = 'card-123';
        const quality = 4; // Good performance
        const previousInterval = 1; // 1 day
        const repetitions = 2;

        const result = await spacedRepetition.calculateNextReview(
          cardId,
          quality,
          previousInterval,
          repetitions
        );

        expect(result).toEqual({
          nextReviewDate: expect.any(Date),
          interval: expect.any(Number),
          easinessFactor: expect.any(Number),
          repetitions: repetitions + 1,
        });

        expect(result.interval).toBeGreaterThan(previousInterval);
      });

      it('should reset interval for poor performance', async () => {
        const cardId = 'card-123';
        const quality = 1; // Poor performance
        const previousInterval = 7; // 7 days
        const repetitions = 3;

        const result = await spacedRepetition.calculateNextReview(
          cardId,
          quality,
          previousInterval,
          repetitions
        );

        expect(result.interval).toBe(1); // Reset to 1 day
        expect(result.repetitions).toBe(0); // Reset repetitions
      });

      it('should handle first review correctly', async () => {
        const cardId = 'card-123';
        const quality = 3; // Average performance
        const previousInterval = 0; // First review
        const repetitions = 0;

        const result = await spacedRepetition.calculateNextReview(
          cardId,
          quality,
          previousInterval,
          repetitions
        );

        expect(result.interval).toBe(1); // First interval is always 1 day
        expect(result.repetitions).toBe(1);
      });
    });

    describe('getDueCards', () => {
      it('should return cards due for review', async () => {
        const userId = 'user-123';
        const dueCards = [
          { id: 'card-1', title: 'JavaScript Closures', nextReview: new Date(Date.now() - 86400000) },
          { id: 'card-2', title: 'React Hooks', nextReview: new Date(Date.now() - 3600000) },
        ];

        mockDb.query.mockResolvedValue({
          rows: dueCards,
          rowCount: 2,
        });

        const result = await spacedRepetition.getDueCards(userId);

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('card-1');
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('next_review_date <= NOW()'),
          [userId]
        );
      });

      it('should limit number of due cards', async () => {
        const userId = 'user-123';
        const limit = 10;

        mockDb.query.mockResolvedValue({
          rows: Array.from({ length: 5 }, (_, i) => ({
            id: `card-${i}`,
            title: `Card ${i}`,
          })),
          rowCount: 5,
        });

        const result = await spacedRepetition.getDueCards(userId, limit);

        expect(result).toHaveLength(5);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('LIMIT $2'),
          [userId, limit]
        );
      });
    });
  });

  describe('ContentRecommendation', () => {
    let contentRecommendation: ContentRecommendation;

    beforeEach(() => {
      contentRecommendation = new ContentRecommendation();
    });

    describe('generateRecommendations', () => {
      it('should generate personalized content recommendations', async () => {
        const userId = 'user-123';
        const userProfile = {
          interests: ['JavaScript', 'React'],
          skillLevel: 'intermediate',
          learningGoals: ['Get a job', 'Build projects'],
        };

        mockDb.query.mockResolvedValueOnce({
          rows: [userProfile],
          rowCount: 1,
        });

        mockDb.query.mockResolvedValueOnce({
          rows: [
            { id: 'content-1', title: 'Advanced React Patterns', relevanceScore: 0.9 },
            { id: 'content-2', title: 'JavaScript Performance', relevanceScore: 0.8 },
          ],
          rowCount: 2,
        });

        const result = await contentRecommendation.generateRecommendations(userId);

        expect(result).toEqual([
          {
            id: 'content-1',
            title: 'Advanced React Patterns',
            relevanceScore: 0.9,
            reasons: expect.any(Array),
          },
          {
            id: 'content-2',
            title: 'JavaScript Performance',
            relevanceScore: 0.8,
            reasons: expect.any(Array),
          },
        ]);
      });

      it('should use collaborative filtering for recommendations', async () => {
        const userId = 'user-123';
        const similarUsers = ['user-456', 'user-789'];

        mockDb.query.mockResolvedValueOnce({
          rows: [{ similar_users: similarUsers }],
          rowCount: 1,
        });

        mockDb.query.mockResolvedValueOnce({
          rows: [
            { id: 'content-1', title: 'Recommended by similar users', score: 0.85 },
          ],
          rowCount: 1,
        });

        const result = await contentRecommendation.generateRecommendations(userId);

        expect(result[0].reasons).toContain('similar_users_liked');
      });

      it('should consider trending content', async () => {
        const userId = 'user-123';

        mockDb.query.mockResolvedValueOnce({
          rows: [
            { id: 'content-1', title: 'Trending Topic', engagement_score: 0.95 },
          ],
          rowCount: 1,
        });

        const result = await contentRecommendation.generateRecommendations(userId);

        expect(result[0].reasons).toContain('trending_content');
      });
    });

    describe('updateRecommendationModel', () => {
      it('should update recommendation model based on user feedback', async () => {
        const userId = 'user-123';
        const feedback = {
          contentId: 'content-1',
          rating: 5,
          completed: true,
          timeSpent: 1800,
        };

        mockDb.query.mockResolvedValue({
          rows: [{ id: 'feedback-1' }],
          rowCount: 1,
        });

        const result = await contentRecommendation.updateRecommendationModel(userId, feedback);

        expect(result).toBe(true);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO recommendation_feedback'),
          expect.arrayContaining([userId, feedback.contentId, feedback.rating])
        );
      });

      it('should handle negative feedback', async () => {
        const userId = 'user-123';
        const negativeFeedback = {
          contentId: 'content-1',
          rating: 1,
          completed: false,
          timeSpent: 30,
        };

        mockDb.query.mockResolvedValue({
          rows: [{ id: 'feedback-1' }],
          rowCount: 1,
        });

        const result = await contentRecommendation.updateRecommendationModel(userId, negativeFeedback);

        expect(result).toBe(true);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Negative feedback received',
          expect.objectContaining({
            userId,
            contentId: negativeFeedback.contentId,
            rating: negativeFeedback.rating,
          })
        );
      });
    });
  });

  describe('Performance Optimization', () => {
    it('should cache expensive computation results', async () => {
      const learningEngine = new LearningEngine();
      const userId = 'user-123';
      const cacheKey = `analysis:${userId}`;

      // First call - should hit database
      mockCache.get.mockResolvedValueOnce(null);
      mockDb.query.mockResolvedValueOnce({
        rows: [{ score: 85 }],
        rowCount: 1,
      });

      await learningEngine.analyzeUserPerformance(userId);

      expect(mockCache.set).toHaveBeenCalledWith(
        cacheKey,
        expect.any(Object),
        expect.any(Number)
      );

      // Second call - should hit cache
      mockCache.get.mockResolvedValueOnce({ score: 85, cached: true });
      
      const result = await learningEngine.analyzeUserPerformance(userId);

      expect(result.cached).toBe(true);
      expect(mockDb.query).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should handle concurrent requests efficiently', async () => {
      const learningEngine = new LearningEngine();
      const userId = 'user-123';

      mockDb.query.mockResolvedValue({
        rows: [{ score: 85 }],
        rowCount: 1,
      });

      // Simulate concurrent requests
      const promises = Array.from({ length: 5 }, () =>
        learningEngine.analyzeUserPerformance(userId)
      );

      const results = await Promise.all(promises);

      // All should return the same result
      expect(results).toHaveLength(5);
      expect(results.every(r => r.averageScore === 85)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection failures', async () => {
      const learningEngine = new LearningEngine();
      const userId = 'user-123';

      mockDb.query.mockRejectedValue(new Error('Connection timeout'));

      const result = await learningEngine.analyzeUserPerformance(userId);

      expect(result.averageScore).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error analyzing user performance',
        expect.any(Error)
      );
    });

    it('should handle malformed data gracefully', async () => {
      const adaptiveAssessment = new AdaptiveAssessment();
      const userId = 'user-123';

      mockDb.query.mockResolvedValue({
        rows: [
          { id: null, question: undefined, difficulty: 'invalid' },
        ],
        rowCount: 1,
      });

      const result = await adaptiveAssessment.generateQuestions('JavaScript', 'intermediate', 5);

      expect(result).toHaveLength(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Malformed question data detected',
        expect.any(Object)
      );
    });
  });
});