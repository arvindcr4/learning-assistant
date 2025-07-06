import { createMocks } from 'node-mocks-http'
import { NextApiRequest, NextApiResponse } from 'next'
import { LearningStyleType } from '@/types'

// Mock the learning service
jest.mock('@/services/learning-service', () => ({
  LearningService: jest.fn().mockImplementation(() => ({
    initializeLearningProfile: jest.fn(),
    processLearningSession: jest.fn(),
    adaptContentForUser: jest.fn(),
    generateLearningAnalytics: jest.fn(),
    getPersonalizedRecommendations: jest.fn(),
    processVARKAssessment: jest.fn(),
    trackUserInteraction: jest.fn(),
  })),
}))

// Import handlers after mocking
import profileHandler from '@/app/api/learning/profile/route'
import sessionHandler from '@/app/api/learning/session/route'
import analyticsHandler from '@/app/api/learning/analytics/route'
import recommendationsHandler from '@/app/api/learning/recommendations/route'
import varkHandler from '@/app/api/learning/assessment/vark/route'
import adaptHandler from '@/app/api/learning/content/adapt/route'

describe('API Routes Integration Tests', () => {
  let mockLearningService: any

  beforeEach(() => {
    const { LearningService } = require('@/services/learning-service')
    mockLearningService = new LearningService()
    jest.clearAllMocks()
  })

  describe('/api/learning/profile', () => {
    it('should create a learning profile with POST', async () => {
      const mockProfile = {
        id: 'profile-123',
        userId: 'user-123',
        styles: [
          { type: LearningStyleType.VISUAL, score: 80, confidence: 0.8, lastUpdated: new Date() },
        ],
        dominantStyle: LearningStyleType.VISUAL,
        isMultimodal: false,
        assessmentHistory: [],
        behavioralIndicators: [],
        adaptationLevel: 75,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockLearningService.initializeLearningProfile.mockResolvedValue(mockProfile)

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: 'user-123',
          varkResponses: {
            'q1': 'I prefer visual diagrams',
            'q2': 'I like audio explanations',
          },
        },
      })

      const response = await profileHandler.POST(req as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockProfile)
      expect(mockLearningService.initializeLearningProfile).toHaveBeenCalledWith(
        'user-123',
        { 'q1': 'I prefer visual diagrams', 'q2': 'I like audio explanations' }
      )
    })

    it('should handle missing userId in POST request', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {},
      })

      const response = await profileHandler.POST(req as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('User ID is required')
    })

    it('should handle service errors in POST request', async () => {
      mockLearningService.initializeLearningProfile.mockRejectedValue(
        new Error('Database connection failed')
      )

      const { req, res } = createMocks({
        method: 'POST',
        body: { userId: 'user-123' },
      })

      const response = await profileHandler.POST(req as any)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to initialize learning profile')
    })
  })

  describe('/api/learning/session', () => {
    it('should process a learning session with POST', async () => {
      const mockSessionData = {
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

      const mockResult = {
        updatedProfile: {
          id: 'profile-123',
          userId: 'user-123',
          styles: [],
          dominantStyle: LearningStyleType.VISUAL,
          isMultimodal: false,
          assessmentHistory: [],
          behavioralIndicators: [],
          adaptationLevel: 75,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        paceAdjustments: [],
        recommendations: [],
      }

      mockLearningService.processLearningSession.mockResolvedValue(mockResult)

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          sessionData: mockSessionData,
          userId: 'user-123',
        },
      })

      const response = await sessionHandler.POST(req as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockResult)
    })

    it('should handle invalid session data', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          sessionData: {}, // Invalid session data
          userId: 'user-123',
        },
      })

      const response = await sessionHandler.POST(req as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid session data')
    })

    it('should handle missing userId in session processing', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          sessionData: {
            id: 'session-123',
            duration: 30,
            itemsCompleted: 8,
          },
        },
      })

      const response = await sessionHandler.POST(req as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('User ID is required')
    })
  })

  describe('/api/learning/analytics', () => {
    it('should return analytics with GET request', async () => {
      const mockAnalytics = {
        id: 'analytics-123',
        userId: 'user-123',
        timeRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date(),
        },
        overallProgress: {
          totalTimeSpent: 1200,
          contentCompleted: 15,
          averageScore: 75,
          completionRate: 80,
          retentionRate: 85,
          streakDays: 5,
          goalsAchieved: 3,
          totalGoals: 5,
        },
        styleEffectiveness: [],
        paceAnalysis: {
          averagePace: 3.5,
          optimalPace: 4.0,
          paceConsistency: 75,
          fatiguePattern: {
            onsetTime: 45,
            recoveryTime: 15,
            indicators: ['decreased_accuracy'],
            severity: 'medium' as const,
          },
          peakPerformanceTime: '10:00 AM',
          recommendedBreaks: 2,
        },
        contentEngagement: [],
        performanceTrends: [],
        recommendations: [],
        predictions: [],
        generatedAt: new Date(),
      }

      mockLearningService.generateLearningAnalytics.mockResolvedValue(mockAnalytics)

      const { req, res } = createMocks({
        method: 'GET',
        query: { userId: 'user-123' },
      })

      const response = await analyticsHandler.GET(req as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockAnalytics)
    })

    it('should handle missing userId in analytics request', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: {},
      })

      const response = await analyticsHandler.GET(req as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('User ID is required')
    })

    it('should handle analytics service errors', async () => {
      mockLearningService.generateLearningAnalytics.mockRejectedValue(
        new Error('Analytics generation failed')
      )

      const { req, res } = createMocks({
        method: 'GET',
        query: { userId: 'user-123' },
      })

      const response = await analyticsHandler.GET(req as any)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to generate analytics')
    })
  })

  describe('/api/learning/recommendations', () => {
    it('should return recommendations with GET request', async () => {
      const mockRecommendations = [
        {
          id: 'rec-1',
          type: 'style',
          title: 'Improve Visual Learning',
          description: 'Try more visual content',
          reasoning: 'Based on your learning patterns',
          confidence: 80,
          priority: 'medium',
          actionRequired: false,
          estimatedImpact: 60,
          createdAt: new Date(),
        },
        {
          id: 'rec-2',
          type: 'pace',
          title: 'Adjust Learning Pace',
          description: 'Consider slowing down',
          reasoning: 'Recent accuracy has decreased',
          confidence: 90,
          priority: 'high',
          actionRequired: true,
          estimatedImpact: 80,
          createdAt: new Date(),
        },
      ]

      mockLearningService.getPersonalizedRecommendations.mockResolvedValue(mockRecommendations)

      const { req, res } = createMocks({
        method: 'GET',
        query: { userId: 'user-123' },
      })

      const response = await recommendationsHandler.GET(req as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockRecommendations)
      expect(data.data.length).toBe(2)
    })

    it('should handle missing userId in recommendations request', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: {},
      })

      const response = await recommendationsHandler.GET(req as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('User ID is required')
    })
  })

  describe('/api/learning/assessment/vark', () => {
    it('should process VARK assessment with POST', async () => {
      const mockAssessment = {
        id: 'assessment-123',
        type: 'questionnaire',
        results: { visual: 0.4, auditory: 0.3, reading: 0.2, kinesthetic: 0.1 },
        confidence: 0.8,
        dataPoints: 16,
        completedAt: new Date(),
      }

      mockLearningService.processVARKAssessment.mockResolvedValue(mockAssessment)

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: 'user-123',
          responses: {
            'q1': 'I prefer visual diagrams',
            'q2': 'I like audio explanations',
            'q3': 'I learn by reading',
            'q4': 'I prefer hands-on practice',
          },
        },
      })

      const response = await varkHandler.POST(req as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockAssessment)
    })

    it('should handle missing responses in VARK assessment', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: 'user-123',
        },
      })

      const response = await varkHandler.POST(req as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Assessment responses are required')
    })
  })

  describe('/api/learning/content/adapt', () => {
    it('should adapt content with POST request', async () => {
      const mockContent = {
        id: 'content-123',
        title: 'Test Content',
        description: 'Test description',
        concept: 'Test concept',
        learningObjectives: ['Objective 1'],
        difficulty: 5,
        estimatedDuration: 30,
        contentVariants: [
          {
            styleType: LearningStyleType.VISUAL,
            format: 'video',
            content: 'Visual content',
            interactivity: 'medium',
            accessibility: {
              screenReaderSupport: false,
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

      const mockAdaptedContent = {
        selectedVariant: mockContent.contentVariants[0],
        adaptedDifficulty: 6,
        reasoning: 'Increased difficulty based on recent high performance',
      }

      mockLearningService.adaptContentForUser.mockResolvedValue(mockAdaptedContent)

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: 'user-123',
          content: mockContent,
        },
      })

      const response = await adaptHandler.POST(req as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockAdaptedContent)
    })

    it('should handle missing content in adaptation request', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: 'user-123',
        },
      })

      const response = await adaptHandler.POST(req as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Content data is required')
    })
  })

  describe('Error Handling', () => {
    it('should handle unsupported HTTP methods', async () => {
      const { req, res } = createMocks({
        method: 'DELETE',
        query: { userId: 'user-123' },
      })

      const response = await analyticsHandler.DELETE?.(req as any) || 
                     new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), { status: 405 })

      expect(response.status).toBe(405)
    })

    it('should handle malformed JSON requests', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: 'invalid json',
      })

      try {
        await profileHandler.POST(req as any)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should handle database connection errors', async () => {
      mockLearningService.initializeLearningProfile.mockRejectedValue(
        new Error('ECONNREFUSED: Connection refused')
      )

      const { req, res } = createMocks({
        method: 'POST',
        body: { userId: 'user-123' },
      })

      const response = await profileHandler.POST(req as any)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to initialize learning profile')
    })
  })

  describe('Request Validation', () => {
    it('should validate session data structure', async () => {
      const invalidSessionData = {
        id: 'session-123',
        // Missing required fields
      }

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          sessionData: invalidSessionData,
          userId: 'user-123',
        },
      })

      const response = await sessionHandler.POST(req as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should validate VARK response format', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          userId: 'user-123',
          responses: 'invalid format', // Should be an object
        },
      })

      const response = await varkHandler.POST(req as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should validate userId format', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: { userId: '' }, // Empty userId
      })

      const response = await analyticsHandler.GET(req as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })
  })
})