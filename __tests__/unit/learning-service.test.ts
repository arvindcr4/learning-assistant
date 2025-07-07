import { LearningService } from '@/services/learning-service'
import {
  LearningStyleType,
  LearningProfile,
  LearningSession,
  BehavioralIndicator,
  AdaptiveContent,
  ContentVariant,
} from '@/types'

// Mock the learning engine modules
jest.mock('@/lib/learning-engine', () => ({
  LearningStyleDetector: jest.fn().mockImplementation(() => ({
    processVARKAssessment: jest.fn().mockReturnValue({
      id: 'test-assessment-id',
      type: 'questionnaire',
      results: { visual: 0.4, auditory: 0.3, reading: 0.2, kinesthetic: 0.1 },
      confidence: 0.8,
      dataPoints: 16,
      completedAt: new Date(),
    }),
    createLearningProfile: jest.fn().mockImplementation((userId) => ({
      id: 'test-profile-id',
      userId: userId || 'test-user-id',
      styles: [
        { type: 'visual', score: 80, confidence: 0.8, lastUpdated: new Date() },
        { type: 'auditory', score: 60, confidence: 0.7, lastUpdated: new Date() },
        { type: 'reading', score: 70, confidence: 0.6, lastUpdated: new Date() },
        { type: 'kinesthetic', score: 50, confidence: 0.5, lastUpdated: new Date() },
      ],
      dominantStyle: 'visual',
      isMultimodal: true,
      assessmentHistory: [],
      behavioralIndicators: [],
      adaptationLevel: 75,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    updateLearningProfile: jest.fn().mockImplementation((profile) => ({
      ...profile,
      updatedAt: new Date(),
    })),
    generateVARKRecommendations: jest.fn().mockReturnValue([
      {
        id: 'rec-vark-1',
        type: 'style',
        title: 'Visual Learning Recommendation',
        description: 'Focus on visual learning materials',
        reasoning: 'Based on VARK assessment results',
        confidence: 85,
        priority: 'medium',
        actionRequired: false,
        estimatedImpact: 70,
        createdAt: new Date(),
      },
    ]),
  })),
  AdaptivePaceManager: jest.fn().mockImplementation(() => ({
    createAdaptiveChange: jest.fn().mockReturnValue(null),
  })),
  ContentAdaptationEngine: jest.fn().mockImplementation(() => ({
    selectContentVariant: jest.fn().mockImplementation((variants) => variants[0]),
    adaptContentDifficulty: jest.fn().mockReturnValue(5),
  })),
  RecommendationEngine: jest.fn().mockImplementation(() => ({
    generateRecommendations: jest.fn().mockReturnValue([
      {
        id: 'rec-1',
        type: 'style',
        title: 'Test Recommendation',
        description: 'Test recommendation description',
        reasoning: 'Test reasoning',
        confidence: 80,
        priority: 'medium',
        actionRequired: false,
        estimatedImpact: 60,
        createdAt: new Date(),
      },
    ]),
  })),
  AdvancedLearningEngine: jest.fn().mockImplementation(() => ({})),
  AdaptiveAssessmentEngine: jest.fn().mockImplementation(() => ({})),
  PerformanceAnalyticsEngine: jest.fn().mockImplementation(() => ({})),
  SpacedRepetitionEngine: jest.fn().mockImplementation(() => ({})),
  LearningPathOptimizer: jest.fn().mockImplementation(() => ({})),
  FatigueDetector: jest.fn().mockImplementation(() => ({})),
  ErrorAnalyzer: jest.fn().mockImplementation(() => ({})),
  BehavioralTracker: jest.fn().mockImplementation(() => ({})),
  DifficultyCalibrator: jest.fn().mockImplementation(() => ({})),
}))

describe('LearningService', () => {
  let service: LearningService

  beforeEach(() => {
    service = new LearningService()
    jest.clearAllMocks()
  })

  describe('initializeLearningProfile', () => {
    it('should initialize learning profile with VARK responses', async () => {
      const userId = 'test-user-123'
      const varkResponses = {
        'q1': 'I prefer visual diagrams',
        'q2': 'I like audio explanations',
        'q3': 'I learn by reading',
        'q4': 'I prefer hands-on practice',
      }

      const profile = await service.initializeLearningProfile(userId, varkResponses)

      expect(profile).toBeDefined()
      expect(profile.userId).toBe(userId)
      expect(profile.styles).toHaveLength(4)
      expect(profile.dominantStyle).toBe('visual')
      expect(profile.isMultimodal).toBe(true)
    })

    it('should initialize learning profile without VARK responses', async () => {
      const userId = 'test-user-123'

      const profile = await service.initializeLearningProfile(userId)

      expect(profile).toBeDefined()
      expect(profile.userId).toBe(userId)
      expect(profile.styles).toHaveLength(4)
    })

    it('should handle errors gracefully', async () => {
      const userId = 'test-user-123'
      const mockError = new Error('Database error')

      // Mock the private method to throw an error
      const mockSaveLearningProfile = jest.fn().mockRejectedValue(mockError)
      ;(service as any).saveLearningProfile = mockSaveLearningProfile

      await expect(service.initializeLearningProfile(userId)).rejects.toThrow(
        'Failed to initialize learning profile'
      )
    })
  })

  describe('processLearningSession', () => {
    it('should process learning session and return updates', async () => {
      const sessionData: LearningSession = {
        id: 'session-123',
        userId: 'user-123',
        contentId: 'content-123',
        startTime: new Date(),
        duration: 30,
        itemsCompleted: 8,
        correctAnswers: 7,
        totalQuestions: 10,
        engagementMetrics: {
          focusTime: 25,
          distractionEvents: 2,
          interactionRate: 3,
          scrollDepth: 85,
          videoWatchTime: 20,
          pauseFrequency: 1,
        },
        adaptiveChanges: [],
        completed: true,
      }

      const userId = 'user-123'

      const result = await service.processLearningSession(sessionData, userId)

      expect(result).toBeDefined()
      expect(result.updatedProfile).toBeDefined()
      expect(result.paceAdjustments).toBeDefined()
      expect(result.recommendations).toBeDefined()
      expect(Array.isArray(result.recommendations)).toBe(true)
    })

    it('should handle pace adjustments', async () => {
      const sessionData: LearningSession = {
        id: 'session-123',
        userId: 'user-123',
        contentId: 'content-123',
        startTime: new Date(),
        duration: 30,
        itemsCompleted: 8,
        correctAnswers: 3, // Low accuracy
        totalQuestions: 10,
        engagementMetrics: {
          focusTime: 25,
          distractionEvents: 2,
          interactionRate: 3,
          scrollDepth: 85,
          videoWatchTime: 20,
          pauseFrequency: 1,
        },
        adaptiveChanges: [],
        completed: true,
      }

      // Mock pace adjustment
      const mockPaceAdjustment = {
        timestamp: new Date(),
        changeType: 'pace',
        previousValue: 3.5,
        newValue: 2.8,
        reason: 'Low accuracy detected',
        userResponse: 'accepted',
      }

      // Mock the private paceManager
      const mockPaceManager = {
        createAdaptiveChange: jest.fn().mockReturnValue(mockPaceAdjustment)
      }
      ;(service as any).paceManager = mockPaceManager

      const result = await service.processLearningSession(sessionData, 'user-123')

      expect(result.paceAdjustments).toHaveLength(1)
      expect(result.paceAdjustments[0]).toEqual(mockPaceAdjustment)
    })

    it('should handle errors during session processing', async () => {
      const sessionData: LearningSession = {
        id: 'session-123',
        userId: 'user-123',
        contentId: 'content-123',
        startTime: new Date(),
        duration: 30,
        itemsCompleted: 8,
        correctAnswers: 7,
        totalQuestions: 10,
        engagementMetrics: {
          focusTime: 25,
          distractionEvents: 2,
          interactionRate: 3,
          scrollDepth: 85,
          videoWatchTime: 20,
          pauseFrequency: 1,
        },
        adaptiveChanges: [],
        completed: true,
      }

      // Mock error in getLearningProfile
      const mockGetLearningProfile = jest.fn().mockRejectedValue(new Error('Database error'))
      ;(service as any).getLearningProfile = mockGetLearningProfile

      await expect(service.processLearningSession(sessionData, 'user-123')).rejects.toThrow(
        'Failed to process learning session'
      )
    })
  })

  describe('adaptContentForUser', () => {
    it('should adapt content for user successfully', async () => {
      const content: AdaptiveContent = {
        id: 'content-123',
        title: 'Test Content',
        description: 'Test description',
        concept: 'Test concept',
        learningObjectives: ['Objective 1', 'Objective 2'],
        difficulty: 5,
        estimatedDuration: 30,
        contentVariants: [
          {
            styleType: LearningStyleType.VISUAL,
            format: 'video' as any,
            content: 'Visual content',
            interactivity: 'medium' as any,
            accessibility: {
              screenReaderSupport: false,
              highContrast: false,
              largeFonts: false,
              keyboardNavigation: false,
              audioDescription: false,
              signLanguage: false,
            },
          },
          {
            styleType: LearningStyleType.AUDITORY,
            format: 'audio' as any,
            content: 'Audio content',
            interactivity: 'low' as any,
            accessibility: {
              screenReaderSupport: true,
              highContrast: false,
              largeFonts: false,
              keyboardNavigation: false,
              audioDescription: false,
              signLanguage: false,
            },
          },
        ],
        assessments: [],
        prerequisites: [],
        metadata: {
          tags: ['test'],
          language: 'en',
          difficulty: 5,
          bloomsTaxonomyLevel: 'Understanding',
          cognitiveLoad: 6,
          estimatedEngagement: 7,
          successRate: 85,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const userId = 'user-123'

      const result = await service.adaptContentForUser(content, userId)

      expect(result).toBeDefined()
      expect(result.selectedVariant).toBeDefined()
      expect(result.adaptedDifficulty).toBe(5)
      expect(result.reasoning).toBeDefined()
      expect(typeof result.reasoning).toBe('string')
    })

    it('should handle content adaptation errors', async () => {
      const content: AdaptiveContent = {
        id: 'content-123',
        title: 'Test Content',
        description: 'Test description',
        concept: 'Test concept',
        learningObjectives: ['Objective 1'],
        difficulty: 5,
        estimatedDuration: 30,
        contentVariants: [],
        assessments: [],
        prerequisites: [],
        metadata: {
          tags: ['test'],
          language: 'en',
          difficulty: 5,
          bloomsTaxonomyLevel: 'Understanding',
          cognitiveLoad: 6,
          estimatedEngagement: 7,
          successRate: 85,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Mock error in getLearningProfile
      const mockGetLearningProfile = jest.fn().mockRejectedValue(new Error('Database error'))
      ;(service as any).getLearningProfile = mockGetLearningProfile

      await expect(service.adaptContentForUser(content, 'user-123')).rejects.toThrow(
        'Failed to adapt content'
      )
    })
  })

  describe('generateLearningAnalytics', () => {
    it('should generate comprehensive analytics', async () => {
      const userId = 'user-123'

      const analytics = await service.generateLearningAnalytics(userId)

      expect(analytics).toBeDefined()
      expect(analytics.userId).toBe(userId)
      expect(analytics.timeRange).toBeDefined()
      expect(analytics.overallProgress).toBeDefined()
      expect(analytics.styleEffectiveness).toBeDefined()
      expect(analytics.paceAnalysis).toBeDefined()
      expect(analytics.contentEngagement).toBeDefined()
      expect(analytics.performanceTrends).toBeDefined()
      expect(analytics.recommendations).toBeDefined()
      expect(analytics.predictions).toBeDefined()
      expect(analytics.generatedAt).toBeDefined()
    })

    it('should handle analytics generation errors', async () => {
      const userId = 'user-123'

      // Mock error in getLearningProfile
      const mockGetLearningProfile = jest.fn().mockRejectedValue(new Error('Database error'))
      ;(service as any).getLearningProfile = mockGetLearningProfile

      await expect(service.generateLearningAnalytics(userId)).rejects.toThrow(
        'Failed to generate learning analytics'
      )
    })
  })

  describe('getPersonalizedRecommendations', () => {
    it('should return personalized recommendations', async () => {
      const userId = 'user-123'

      const recommendations = await service.getPersonalizedRecommendations(userId)

      expect(recommendations).toBeDefined()
      expect(Array.isArray(recommendations)).toBe(true)
      expect(recommendations.length).toBeGreaterThan(0)
      expect(recommendations[0]).toHaveProperty('id')
      expect(recommendations[0]).toHaveProperty('type')
      expect(recommendations[0]).toHaveProperty('title')
      expect(recommendations[0]).toHaveProperty('description')
    })

    it('should handle recommendation errors', async () => {
      const userId = 'user-123'

      // Mock error in generateLearningAnalytics
      jest.spyOn(service, 'generateLearningAnalytics').mockRejectedValue(new Error('Analytics error'))

      await expect(service.getPersonalizedRecommendations(userId)).rejects.toThrow(
        'Failed to get personalized recommendations'
      )
    })
  })

  describe('processVARKAssessment', () => {
    it('should process VARK assessment and update profile', async () => {
      const userId = 'user-123'
      const responses = {
        'q1': 'I prefer visual diagrams',
        'q2': 'I like audio explanations',
        'q3': 'I learn by reading',
        'q4': 'I prefer hands-on practice',
      }

      const assessment = await service.processVARKAssessment(userId, responses)

      expect(assessment).toBeDefined()
      expect(assessment.type).toBe('questionnaire')
      expect(assessment.results).toBeDefined()
      expect(assessment.confidence).toBeGreaterThan(0)
      expect(assessment.dataPoints).toBeGreaterThan(0)
    })

    it('should handle VARK assessment errors', async () => {
      const userId = 'user-123'
      const responses = { 'q1': 'test response' }

      // Mock error in getLearningProfile
      const mockGetLearningProfile = jest.fn().mockRejectedValue(new Error('Database error'))
      ;(service as any).getLearningProfile = mockGetLearningProfile

      await expect(service.processVARKAssessment(userId, responses)).rejects.toThrow(
        'Failed to process VARK assessment'
      )
    })
  })

  describe('trackUserInteraction', () => {
    it('should track user interaction successfully', async () => {
      const userId = 'user-123'
      const interaction = {
        action: 'video_watch',
        contentType: LearningStyleType.VISUAL,
        duration: 300,
        engagementLevel: 85,
        completionRate: 90,
      }

      await expect(service.trackUserInteraction(userId, interaction)).resolves.toBeUndefined()
    })

    it('should handle interaction tracking errors', async () => {
      const userId = 'user-123'
      const interaction = {
        action: 'video_watch',
        contentType: LearningStyleType.VISUAL,
        duration: 300,
        engagementLevel: 85,
        completionRate: 90,
      }

      // Mock error in saveBehavioralIndicator
      const mockSaveBehavioralIndicator = jest.fn().mockRejectedValue(new Error('Database error'))
      ;(service as any).saveBehavioralIndicator = mockSaveBehavioralIndicator

      await expect(service.trackUserInteraction(userId, interaction)).rejects.toThrow(
        'Failed to track user interaction'
      )
    })

    it('should update learning profile when enough indicators are collected', async () => {
      const userId = 'user-123'
      const interaction = {
        action: 'video_watch',
        contentType: LearningStyleType.VISUAL,
        duration: 300,
        engagementLevel: 85,
        completionRate: 90,
      }

      // Mock returning enough indicators
      const mockIndicators: BehavioralIndicator[] = Array(5).fill(null).map((_, i) => ({
        action: 'test_action',
        contentType: LearningStyleType.VISUAL,
        engagementLevel: 80,
        completionRate: 85,
        timeSpent: 20,
        timestamp: new Date(),
      }))

      const mockGetRecentBehavioralIndicators = jest.fn().mockResolvedValue(mockIndicators)
      ;(service as any).getRecentBehavioralIndicators = mockGetRecentBehavioralIndicators

      const mockSaveLearningProfile = jest.fn()
      ;(service as any).saveLearningProfile = mockSaveLearningProfile

      await service.trackUserInteraction(userId, interaction)

      expect(mockSaveLearningProfile).toHaveBeenCalled()
    })
  })

  describe('private helper methods', () => {
    it('should calculate engagement level correctly', () => {
      const session: LearningSession = {
        id: 'session-123',
        userId: 'user-123',
        contentId: 'content-123',
        startTime: new Date(),
        duration: 30,
        itemsCompleted: 8,
        correctAnswers: 7,
        totalQuestions: 10,
        engagementMetrics: {
          focusTime: 25,
          distractionEvents: 2,
          interactionRate: 3,
          scrollDepth: 85,
          videoWatchTime: 20,
          pauseFrequency: 1,
        },
        adaptiveChanges: [],
        completed: true,
      }

      const engagementLevel = service['calculateEngagementLevel'](session)

      expect(engagementLevel).toBeGreaterThanOrEqual(0)
      expect(engagementLevel).toBeLessThanOrEqual(100)
      expect(typeof engagementLevel).toBe('number')
    })

    it('should calculate progress metrics correctly', () => {
      const sessions: LearningSession[] = [
        {
          id: 'session-1',
          userId: 'user-123',
          contentId: 'content-123',
          startTime: new Date(),
          duration: 30,
          itemsCompleted: 8,
          correctAnswers: 7,
          totalQuestions: 10,
          engagementMetrics: {
            focusTime: 25,
            distractionEvents: 2,
            interactionRate: 3,
            scrollDepth: 85,
            videoWatchTime: 20,
            pauseFrequency: 1,
          },
          adaptiveChanges: [],
          completed: true,
        },
        {
          id: 'session-2',
          userId: 'user-123',
          contentId: 'content-124',
          startTime: new Date(),
          duration: 25,
          itemsCompleted: 6,
          correctAnswers: 5,
          totalQuestions: 8,
          engagementMetrics: {
            focusTime: 20,
            distractionEvents: 1,
            interactionRate: 4,
            scrollDepth: 90,
            videoWatchTime: 15,
            pauseFrequency: 0,
          },
          adaptiveChanges: [],
          completed: true,
        },
      ]

      const progressMetrics = service['calculateProgressMetrics'](sessions)

      expect(progressMetrics.totalTimeSpent).toBe(55)
      expect(progressMetrics.contentCompleted).toBe(2)
      expect(progressMetrics.averageScore).toBeCloseTo(66.67, 1)
      expect(progressMetrics.completionRate).toBe(100)
    })
  })
})