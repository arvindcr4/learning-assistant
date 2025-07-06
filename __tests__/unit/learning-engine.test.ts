import {
  LearningStyleDetector,
  AdaptivePaceManager,
  ContentAdaptationEngine,
  RecommendationEngine,
} from '@/lib/learning-engine'
import {
  LearningStyleType,
  BehavioralIndicator,
  StyleAssessment,
  LearningProfile,
  LearningSession,
  ContentVariant,
  LearningAnalytics,
  AdaptiveContent,
} from '@/types'

describe('LearningStyleDetector', () => {
  let detector: LearningStyleDetector

  beforeEach(() => {
    detector = new LearningStyleDetector()
  })

  describe('analyzeBehavioralPatterns', () => {
    it('should analyze behavioral patterns correctly', () => {
      const indicators: BehavioralIndicator[] = [
        {
          action: 'video_watch',
          contentType: LearningStyleType.VISUAL,
          engagementLevel: 85,
          completionRate: 90,
          timeSpent: 25,
          timestamp: new Date(),
        },
        {
          action: 'read_content',
          contentType: LearningStyleType.READING,
          engagementLevel: 70,
          completionRate: 80,
          timeSpent: 15,
          timestamp: new Date(),
        },
        {
          action: 'hands_on_exercise',
          contentType: LearningStyleType.KINESTHETIC,
          engagementLevel: 95,
          completionRate: 100,
          timeSpent: 35,
          timestamp: new Date(),
        },
      ]

      const result = detector.analyzeBehavioralPatterns(indicators)

      expect(result).toBeDefined()
      expect(result.length).toBe(4) // Should return all 4 VARK styles
      expect(result.every(style => style.score >= 0 && style.score <= 100)).toBe(true)
      expect(result.every(style => style.confidence >= 0 && style.confidence <= 1)).toBe(true)
    })

    it('should handle empty indicators array', () => {
      const result = detector.analyzeBehavioralPatterns([])
      
      expect(result).toBeDefined()
      expect(result.length).toBe(4)
      expect(result.every(style => style.score === 0)).toBe(true)
    })

    it('should calculate correct confidence based on data points', () => {
      const singleIndicator: BehavioralIndicator[] = [
        {
          action: 'test',
          contentType: LearningStyleType.VISUAL,
          engagementLevel: 80,
          completionRate: 90,
          timeSpent: 20,
          timestamp: new Date(),
        },
      ]

      const result = detector.analyzeBehavioralPatterns(singleIndicator)
      expect(result[0].confidence).toBe(0.1) // 1/10 minimum data points
    })
  })

  describe('processVARKAssessment', () => {
    it('should process VARK questionnaire responses correctly', () => {
      const responses = {
        'q1': 'I prefer visual diagrams when learning',
        'q2': 'I like to listen to explanations',
        'q3': 'I learn best by reading text',
        'q4': 'I prefer hands-on practice',
        'q5': 'Charts and graphs help me understand',
        'q6': 'I like to discuss topics with others',
        'q7': 'I prefer written instructions',
        'q8': 'I learn by doing experiments',
      }

      const result = detector.processVARKAssessment(responses)

      expect(result).toBeDefined()
      expect(result.type).toBe('questionnaire')
      expect(result.results).toHaveProperty('visual')
      expect(result.results).toHaveProperty('auditory')
      expect(result.results).toHaveProperty('reading')
      expect(result.results).toHaveProperty('kinesthetic')
      expect(result.confidence).toBeGreaterThan(0)
      expect(result.dataPoints).toBe(8)
    })

    it('should handle empty responses', () => {
      const result = detector.processVARKAssessment({})
      
      expect(result.confidence).toBe(0)
      expect(result.dataPoints).toBe(0)
    })
  })

  describe('createLearningProfile', () => {
    it('should create a complete learning profile', () => {
      const userId = 'test-user-123'
      const assessments: StyleAssessment[] = [
        {
          id: 'assessment-1',
          type: 'questionnaire',
          results: { visual: 0.4, auditory: 0.2, reading: 0.3, kinesthetic: 0.1 },
          confidence: 0.8,
          dataPoints: 16,
          completedAt: new Date(),
        },
      ]
      const indicators: BehavioralIndicator[] = [
        {
          action: 'video_watch',
          contentType: LearningStyleType.VISUAL,
          engagementLevel: 85,
          completionRate: 90,
          timeSpent: 25,
          timestamp: new Date(),
        },
      ]

      const profile = detector.createLearningProfile(userId, assessments, indicators)

      expect(profile.userId).toBe(userId)
      expect(profile.styles.length).toBe(4)
      expect(profile.dominantStyle).toBeDefined()
      expect(profile.isMultimodal).toBeDefined()
      expect(profile.assessmentHistory).toEqual(assessments)
      expect(profile.behavioralIndicators).toEqual(indicators)
      expect(profile.adaptationLevel).toBeGreaterThanOrEqual(0)
      expect(profile.adaptationLevel).toBeLessThanOrEqual(100)
    })

    it('should determine multimodal learner correctly', () => {
      const assessments: StyleAssessment[] = [
        {
          id: 'assessment-1',
          type: 'questionnaire',
          results: { visual: 0.3, auditory: 0.3, reading: 0.3, kinesthetic: 0.1 },
          confidence: 0.8,
          dataPoints: 16,
          completedAt: new Date(),
        },
      ]

      const profile = detector.createLearningProfile('user-123', assessments, [])
      expect(profile.isMultimodal).toBe(true)
    })
  })

  describe('updateLearningProfile', () => {
    it('should update learning profile with new indicators', () => {
      const originalProfile: LearningProfile = {
        id: 'profile-1',
        userId: 'user-123',
        styles: [
          { type: LearningStyleType.VISUAL, score: 70, confidence: 0.8, lastUpdated: new Date() },
          { type: LearningStyleType.AUDITORY, score: 50, confidence: 0.6, lastUpdated: new Date() },
          { type: LearningStyleType.READING, score: 60, confidence: 0.7, lastUpdated: new Date() },
          { type: LearningStyleType.KINESTHETIC, score: 40, confidence: 0.5, lastUpdated: new Date() },
        ],
        dominantStyle: LearningStyleType.VISUAL,
        isMultimodal: false,
        assessmentHistory: [],
        behavioralIndicators: [],
        adaptationLevel: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const newIndicators: BehavioralIndicator[] = [
        {
          action: 'audio_listen',
          contentType: LearningStyleType.AUDITORY,
          engagementLevel: 95,
          completionRate: 100,
          timeSpent: 30,
          timestamp: new Date(),
        },
      ]

      const updatedProfile = detector.updateLearningProfile(originalProfile, newIndicators)

      expect(updatedProfile.behavioralIndicators.length).toBe(1)
      expect(updatedProfile.updatedAt).not.toEqual(originalProfile.updatedAt)
      expect(updatedProfile.styles.length).toBe(4)
    })
  })
})

describe('AdaptivePaceManager', () => {
  let paceManager: AdaptivePaceManager

  beforeEach(() => {
    paceManager = new AdaptivePaceManager()
  })

  describe('calculateOptimalPace', () => {
    it('should calculate optimal pace correctly', () => {
      const pace = paceManager.calculateOptimalPace(0.8, 0.85, 0.3)
      
      expect(pace).toBeGreaterThan(0)
      expect(pace).toBeLessThanOrEqual(10) // MAX_PACE
      expect(pace).toBeGreaterThanOrEqual(0.5) // MIN_PACE
    })

    it('should handle high fatigue levels', () => {
      const highFatiguePace = paceManager.calculateOptimalPace(0.8, 0.85, 0.9)
      const lowFatiguePace = paceManager.calculateOptimalPace(0.8, 0.85, 0.1)
      
      expect(highFatiguePace).toBeLessThan(lowFatiguePace)
    })

    it('should handle low performance', () => {
      const lowPerformancePace = paceManager.calculateOptimalPace(0.4, 0.85, 0.3)
      const highPerformancePace = paceManager.calculateOptimalPace(0.95, 0.85, 0.3)
      
      expect(lowPerformancePace).toBeLessThan(highPerformancePace)
    })
  })

  describe('shouldAdjustPace', () => {
    it('should not adjust pace with insufficient data', () => {
      const sessions: LearningSession[] = [
        createMockSession(0.8, 0.9),
        createMockSession(0.7, 0.8),
      ]

      const result = paceManager.shouldAdjustPace(3.0, sessions)
      
      expect(result.shouldAdjust).toBe(false)
      expect(result.reason).toBe('Insufficient data')
    })

    it('should suggest pace reduction for low accuracy', () => {
      const sessions: LearningSession[] = [
        createMockSession(0.5, 0.8),
        createMockSession(0.4, 0.7),
        createMockSession(0.3, 0.6),
      ]

      const result = paceManager.shouldAdjustPace(3.0, sessions)
      
      expect(result.shouldAdjust).toBe(true)
      expect(result.reason).toBe('Low accuracy detected')
      expect(result.suggestedPace).toBeLessThan(3.0)
    })

    it('should suggest pace increase for high performance', () => {
      const sessions: LearningSession[] = [
        createMockSession(0.95, 0.9),
        createMockSession(0.92, 0.85),
        createMockSession(0.94, 0.88),
      ]

      const result = paceManager.shouldAdjustPace(3.0, sessions)
      
      expect(result.shouldAdjust).toBe(true)
      expect(result.reason).toBe('High performance detected')
      expect(result.suggestedPace).toBeGreaterThan(3.0)
    })
  })

  describe('createAdaptiveChange', () => {
    it('should create adaptive change for low accuracy', () => {
      const session = createMockSession(0.4, 0.8)
      const change = paceManager.createAdaptiveChange(session, 3.0)
      
      expect(change).toBeDefined()
      expect(change?.changeType).toBe('pace')
      expect(change?.newValue).toBeLessThan(3.0)
      expect(change?.reason).toContain('Low accuracy')
    })

    it('should create break suggestion for low engagement', () => {
      const session = createMockSession(0.8, 0.2)
      const change = paceManager.createAdaptiveChange(session, 3.0)
      
      expect(change).toBeDefined()
      expect(change?.changeType).toBe('break_suggestion')
      expect(change?.reason).toContain('Low engagement')
    })

    it('should return null for normal performance', () => {
      const session = createMockSession(0.8, 0.8)
      const change = paceManager.createAdaptiveChange(session, 3.0)
      
      expect(change).toBeNull()
    })
  })

  function createMockSession(accuracy: number, engagement: number): LearningSession {
    const correctAnswers = Math.floor(accuracy * 10)
    const totalQuestions = 10
    
    return {
      id: 'session-' + Math.random(),
      userId: 'user-123',
      contentId: 'content-123',
      startTime: new Date(),
      duration: 30,
      itemsCompleted: 8,
      correctAnswers,
      totalQuestions,
      engagementMetrics: {
        focusTime: 30 * engagement,
        distractionEvents: Math.floor((1 - engagement) * 10),
        interactionRate: engagement * 5,
        scrollDepth: 80,
        videoWatchTime: 20,
        pauseFrequency: 2,
      },
      adaptiveChanges: [],
      completed: true,
    }
  }
})

describe('ContentAdaptationEngine', () => {
  let engine: ContentAdaptationEngine

  beforeEach(() => {
    engine = new ContentAdaptationEngine()
  })

  describe('selectContentVariant', () => {
    it('should select best content variant based on learning profile', () => {
      const variants: ContentVariant[] = [
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
      ]

      const profile: LearningProfile = {
        id: 'profile-1',
        userId: 'user-123',
        styles: [
          { type: LearningStyleType.VISUAL, score: 90, confidence: 0.9, lastUpdated: new Date() },
          { type: LearningStyleType.AUDITORY, score: 40, confidence: 0.7, lastUpdated: new Date() },
          { type: LearningStyleType.READING, score: 50, confidence: 0.6, lastUpdated: new Date() },
          { type: LearningStyleType.KINESTHETIC, score: 30, confidence: 0.5, lastUpdated: new Date() },
        ],
        dominantStyle: LearningStyleType.VISUAL,
        isMultimodal: false,
        assessmentHistory: [],
        behavioralIndicators: [],
        adaptationLevel: 75,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const selected = engine.selectContentVariant(variants, profile, [])
      
      expect(selected.styleType).toBe(LearningStyleType.VISUAL)
    })

    it('should return single variant when only one available', () => {
      const variants: ContentVariant[] = [
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
      ]

      const profile: LearningProfile = {
        id: 'profile-1',
        userId: 'user-123',
        styles: [],
        dominantStyle: LearningStyleType.AUDITORY,
        isMultimodal: false,
        assessmentHistory: [],
        behavioralIndicators: [],
        adaptationLevel: 75,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const selected = engine.selectContentVariant(variants, profile, [])
      
      expect(selected).toBe(variants[0])
    })
  })

  describe('adaptContentDifficulty', () => {
    it('should increase difficulty for high performance', () => {
      const sessions: LearningSession[] = [
        createMockSession(0.95, 0.9),
        createMockSession(0.92, 0.85),
        createMockSession(0.94, 0.88),
      ]

      const adaptedDifficulty = engine.adaptContentDifficulty(5, sessions)
      
      expect(adaptedDifficulty).toBeGreaterThan(5)
      expect(adaptedDifficulty).toBeLessThanOrEqual(10)
    })

    it('should decrease difficulty for low performance', () => {
      const sessions: LearningSession[] = [
        createMockSession(0.5, 0.8),
        createMockSession(0.4, 0.7),
        createMockSession(0.3, 0.6),
      ]

      const adaptedDifficulty = engine.adaptContentDifficulty(5, sessions)
      
      expect(adaptedDifficulty).toBeLessThan(5)
      expect(adaptedDifficulty).toBeGreaterThanOrEqual(1)
    })

    it('should maintain difficulty for average performance', () => {
      const sessions: LearningSession[] = [
        createMockSession(0.75, 0.8),
        createMockSession(0.78, 0.7),
        createMockSession(0.77, 0.6),
      ]

      const adaptedDifficulty = engine.adaptContentDifficulty(5, sessions)
      
      expect(adaptedDifficulty).toBe(5)
    })

    it('should return base difficulty with no sessions', () => {
      const adaptedDifficulty = engine.adaptContentDifficulty(5, [])
      
      expect(adaptedDifficulty).toBe(5)
    })
  })

  function createMockSession(accuracy: number, engagement: number): LearningSession {
    const correctAnswers = Math.floor(accuracy * 10)
    const totalQuestions = 10
    
    return {
      id: 'session-' + Math.random(),
      userId: 'user-123',
      contentId: 'content-123',
      startTime: new Date(),
      duration: 30,
      itemsCompleted: 8,
      correctAnswers,
      totalQuestions,
      engagementMetrics: {
        focusTime: 30 * engagement,
        distractionEvents: Math.floor((1 - engagement) * 10),
        interactionRate: engagement * 5,
        scrollDepth: 80,
        videoWatchTime: 20,
        pauseFrequency: 2,
      },
      adaptiveChanges: [],
      completed: true,
    }
  }
})

describe('RecommendationEngine', () => {
  let engine: RecommendationEngine

  beforeEach(() => {
    engine = new RecommendationEngine()
  })

  describe('generateRecommendations', () => {
    it('should generate comprehensive recommendations', () => {
      const analytics: LearningAnalytics = {
        id: 'analytics-1',
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
        styleEffectiveness: [
          {
            style: LearningStyleType.VISUAL,
            engagementScore: 85,
            comprehensionScore: 65, // Below 70 threshold
            completionRate: 90,
            timeToMastery: 45,
            preferenceStrength: 80,
          },
          {
            style: LearningStyleType.AUDITORY,
            engagementScore: 70,
            comprehensionScore: 75,
            completionRate: 85,
            timeToMastery: 50,
            preferenceStrength: 60,
          },
        ],
        paceAnalysis: {
          averagePace: 3.5,
          optimalPace: 4.0,
          paceConsistency: 45, // Below 60 threshold
          fatiguePattern: {
            onsetTime: 45,
            recoveryTime: 15,
            indicators: ['decreased_accuracy'],
            severity: 'medium',
          },
          peakPerformanceTime: '10:00 AM',
          recommendedBreaks: 2,
        },
        contentEngagement: [
          {
            contentId: 'content-1',
            contentType: 'video' as any,
            engagementScore: 45, // Below 60 threshold
            completionRate: 80,
            revisitRate: 20,
            timeSpent: 120,
            userRating: 3,
          },
        ],
        performanceTrends: [],
        recommendations: [],
        predictions: [],
        generatedAt: new Date(),
      }

      const recommendations = engine.generateRecommendations(analytics)
      
      expect(recommendations.length).toBeGreaterThan(0)
      
      // Should have style recommendation for low comprehension
      const styleRec = recommendations.find(r => r.type === 'style')
      expect(styleRec).toBeDefined()
      expect(styleRec?.title).toContain('visual')
      
      // Should have pace recommendation for low consistency
      const paceRec = recommendations.find(r => r.type === 'pace')
      expect(paceRec).toBeDefined()
      expect(paceRec?.priority).toBe('high')
      
      // Should have content recommendation for low engagement
      const contentRec = recommendations.find(r => r.type === 'content')
      expect(contentRec).toBeDefined()
      
      // Should have schedule recommendation
      const scheduleRec = recommendations.find(r => r.type === 'schedule')
      expect(scheduleRec).toBeDefined()
      expect(scheduleRec?.description).toContain('10:00 AM')
      
      // Should be sorted by priority
      expect(recommendations[0].priority).toBe('high')
    })

    it('should handle empty analytics gracefully', () => {
      const analytics: LearningAnalytics = {
        id: 'analytics-1',
        userId: 'user-123',
        timeRange: {
          start: new Date(),
          end: new Date(),
        },
        overallProgress: {
          totalTimeSpent: 0,
          contentCompleted: 0,
          averageScore: 0,
          completionRate: 0,
          retentionRate: 0,
          streakDays: 0,
          goalsAchieved: 0,
          totalGoals: 0,
        },
        styleEffectiveness: [],
        paceAnalysis: {
          averagePace: 0,
          optimalPace: 0,
          paceConsistency: 100,
          fatiguePattern: {
            onsetTime: 0,
            recoveryTime: 0,
            indicators: [],
            severity: 'low',
          },
          peakPerformanceTime: '',
          recommendedBreaks: 0,
        },
        contentEngagement: [],
        performanceTrends: [],
        recommendations: [],
        predictions: [],
        generatedAt: new Date(),
      }

      const recommendations = engine.generateRecommendations(analytics)
      
      expect(recommendations).toBeDefined()
      expect(Array.isArray(recommendations)).toBe(true)
    })
  })
})