import {
  LearningStyleDetector,
  AdaptivePaceManager,
  ContentAdaptationEngine,
  RecommendationEngine,
} from '@/lib/learning-engine'
import { LearningService } from '@/services/learning-service'
import { createLargeDataset } from '../mocks/test-data'

describe('Learning Algorithms Performance Tests', () => {
  let detector: LearningStyleDetector
  let paceManager: AdaptivePaceManager
  let contentEngine: ContentAdaptationEngine
  let recommendationEngine: RecommendationEngine
  let learningService: LearningService

  beforeEach(() => {
    detector = new LearningStyleDetector()
    paceManager = new AdaptivePaceManager()
    contentEngine = new ContentAdaptationEngine()
    recommendationEngine = new RecommendationEngine()
    learningService = new LearningService()
  })

  describe('LearningStyleDetector Performance', () => {
    it('should handle large behavioral indicator datasets efficiently', () => {
      const { indicators } = createLargeDataset(1000)
      
      const startTime = performance.now()
      const result = detector.analyzeBehavioralPatterns(indicators)
      const endTime = performance.now()
      
      const executionTime = endTime - startTime
      
      expect(result).toBeDefined()
      expect(result.length).toBe(4)
      expect(executionTime).toBeLessThan(100) // Should complete in under 100ms
    })

    it('should scale linearly with dataset size', () => {
      const sizes = [100, 500, 1000, 2000]
      const times: number[] = []
      
      sizes.forEach(size => {
        const { indicators } = createLargeDataset(size)
        
        const startTime = performance.now()
        detector.analyzeBehavioralPatterns(indicators)
        const endTime = performance.now()
        
        times.push(endTime - startTime)
      })
      
      // Check that execution time scales reasonably (not exponentially)
      const timeRatio = times[3] / times[0] // 2000 vs 100 items
      const sizeRatio = sizes[3] / sizes[0] // 20x data
      
      expect(timeRatio).toBeLessThan(sizeRatio * 2) // Should not be more than 2x the size ratio
    })

    it('should process VARK assessment quickly', () => {
      const varkResponses: Record<string, string> = {}
      for (let i = 1; i <= 16; i++) {
        varkResponses[`q${i}`] = `Answer for question ${i}`
      }
      
      const startTime = performance.now()
      const result = detector.processVARKAssessment(varkResponses)
      const endTime = performance.now()
      
      expect(result).toBeDefined()
      expect(endTime - startTime).toBeLessThan(10) // Should be very fast
    })

    it('should handle concurrent profile updates efficiently', async () => {
      const { indicators } = createLargeDataset(100)
      const profile = detector.createLearningProfile('user-123', [], indicators.slice(0, 50))
      
      const promises = []
      const startTime = performance.now()
      
      // Simulate concurrent updates
      for (let i = 0; i < 10; i++) {
        const promise = new Promise(resolve => {
          setTimeout(() => {
            const updatedProfile = detector.updateLearningProfile(profile, indicators.slice(i * 5, (i + 1) * 5))
            resolve(updatedProfile)
          }, Math.random() * 10)
        })
        promises.push(promise)
      }
      
      await Promise.all(promises)
      const endTime = performance.now()
      
      expect(endTime - startTime).toBeLessThan(200) // Should handle concurrency well
    })
  })

  describe('AdaptivePaceManager Performance', () => {
    it('should calculate optimal pace quickly with large session history', () => {
      const { sessions } = createLargeDataset(500)
      
      const startTime = performance.now()
      const paceAdjustment = paceManager.shouldAdjustPace(3.5, sessions)
      const endTime = performance.now()
      
      expect(paceAdjustment).toBeDefined()
      expect(endTime - startTime).toBeLessThan(50) // Should be fast
    })

    it('should handle performance trend analysis efficiently', () => {
      const { sessions } = createLargeDataset(200)
      
      const calculations = []
      const startTime = performance.now()
      
      for (let i = 0; i < 100; i++) {
        const sessionSubset = sessions.slice(i, i + 10)
        const adjustment = paceManager.shouldAdjustPace(3.5, sessionSubset)
        calculations.push(adjustment)
      }
      
      const endTime = performance.now()
      
      expect(calculations.length).toBe(100)
      expect(endTime - startTime).toBeLessThan(100) // Batch processing should be efficient
    })
  })

  describe('ContentAdaptationEngine Performance', () => {
    it('should select content variants quickly', () => {
      const variants = Array(50).fill(null).map((_, i) => ({
        styleType: ['visual', 'auditory', 'reading', 'kinesthetic'][i % 4] as any,
        format: 'text' as any,
        content: `Content variant ${i}`,
        interactivity: 'medium' as any,
        accessibility: {
          screenReaderSupport: false,
          highContrast: false,
          largeFonts: false,
          keyboardNavigation: false,
          audioDescription: false,
          signLanguage: false,
        },
      }))
      
      const profile = detector.createLearningProfile('user-123', [], [])
      const { sessions } = createLargeDataset(100)
      
      const startTime = performance.now()
      const selectedVariant = contentEngine.selectContentVariant(variants, profile, sessions)
      const endTime = performance.now()
      
      expect(selectedVariant).toBeDefined()
      expect(endTime - startTime).toBeLessThan(20) // Should be very fast
    })

    it('should adapt difficulty efficiently for large performance history', () => {
      const { sessions } = createLargeDataset(300)
      
      const adaptations = []
      const startTime = performance.now()
      
      for (let i = 1; i <= 10; i++) {
        const adapted = contentEngine.adaptContentDifficulty(i, sessions)
        adaptations.push(adapted)
      }
      
      const endTime = performance.now()
      
      expect(adaptations.length).toBe(10)
      expect(endTime - startTime).toBeLessThan(50)
    })
  })

  describe('RecommendationEngine Performance', () => {
    it('should generate recommendations quickly from complex analytics', () => {
      const analytics = {
        id: 'analytics-123',
        userId: 'user-123',
        timeRange: { start: new Date(), end: new Date() },
        overallProgress: {
          totalTimeSpent: 5000,
          contentCompleted: 100,
          averageScore: 80,
          completionRate: 85,
          retentionRate: 82,
          streakDays: 15,
          goalsAchieved: 8,
          totalGoals: 10,
        },
        styleEffectiveness: Array(4).fill(null).map((_, i) => ({
          style: ['visual', 'auditory', 'reading', 'kinesthetic'][i] as any,
          engagementScore: Math.random() * 100,
          comprehensionScore: Math.random() * 100,
          completionRate: Math.random() * 100,
          timeToMastery: Math.random() * 100,
          preferenceStrength: Math.random() * 100,
        })),
        paceAnalysis: {
          averagePace: 3.5,
          optimalPace: 4.0,
          paceConsistency: 75,
          fatiguePattern: {
            onsetTime: 45,
            recoveryTime: 15,
            indicators: ['fatigue'],
            severity: 'medium' as const,
          },
          peakPerformanceTime: '10:00 AM',
          recommendedBreaks: 2,
        },
        contentEngagement: Array(20).fill(null).map((_, i) => ({
          contentId: `content-${i}`,
          contentType: 'text' as any,
          engagementScore: Math.random() * 100,
          completionRate: Math.random() * 100,
          revisitRate: Math.random() * 100,
          timeSpent: Math.random() * 100,
          userRating: Math.floor(Math.random() * 5) + 1,
        })),
        performanceTrends: [],
        recommendations: [],
        predictions: [],
        generatedAt: new Date(),
      }
      
      const startTime = performance.now()
      const recommendations = recommendationEngine.generateRecommendations(analytics)
      const endTime = performance.now()
      
      expect(recommendations).toBeDefined()
      expect(Array.isArray(recommendations)).toBe(true)
      expect(endTime - startTime).toBeLessThan(100) // Should generate quickly
    })
  })

  describe('LearningService Integration Performance', () => {
    it('should handle analytics generation efficiently', async () => {
      const startTime = performance.now()
      
      try {
        await learningService.generateLearningAnalytics('user-123')
      } catch (error) {
        // Expected to fail in test environment, but we measure the execution time
      }
      
      const endTime = performance.now()
      
      // Even with database errors, the computation should not take too long
      expect(endTime - startTime).toBeLessThan(500)
    })

    it('should process multiple learning sessions concurrently', async () => {
      const { sessions } = createLargeDataset(10)
      
      const promises = sessions.map(async (session, index) => {
        const startTime = performance.now()
        
        try {
          await learningService.processLearningSession(session, `user-${index}`)
        } catch (error) {
          // Expected to fail in test environment
        }
        
        return performance.now() - startTime
      })
      
      const times = await Promise.all(promises)
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length
      
      expect(avgTime).toBeLessThan(200) // Average processing time should be reasonable
    })
  })

  describe('Memory Usage Tests', () => {
    it('should not cause memory leaks with large datasets', () => {
      const initialMemory = process.memoryUsage().heapUsed
      
      // Process large datasets multiple times
      for (let i = 0; i < 10; i++) {
        const { indicators } = createLargeDataset(500)
        detector.analyzeBehavioralPatterns(indicators)
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc()
        }
      }
      
      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
    })

    it('should handle object creation efficiently', () => {
      const startMemory = process.memoryUsage().heapUsed
      
      const profiles = []
      for (let i = 0; i < 1000; i++) {
        const profile = detector.createLearningProfile(`user-${i}`, [], [])
        profiles.push(profile)
      }
      
      const endMemory = process.memoryUsage().heapUsed
      const memoryPerProfile = (endMemory - startMemory) / 1000
      
      // Each profile should use a reasonable amount of memory (less than 10KB)
      expect(memoryPerProfile).toBeLessThan(10 * 1024)
      
      // Cleanup
      profiles.length = 0
    })
  })

  describe('Algorithmic Complexity Tests', () => {
    it('should maintain O(n) complexity for behavioral analysis', () => {
      const sizes = [100, 200, 400, 800]
      const times: number[] = []
      
      sizes.forEach(size => {
        const { indicators } = createLargeDataset(size)
        
        const iterations = 10
        let totalTime = 0
        
        for (let i = 0; i < iterations; i++) {
          const startTime = performance.now()
          detector.analyzeBehavioralPatterns(indicators)
          totalTime += performance.now() - startTime
        }
        
        times.push(totalTime / iterations)
      })
      
      // Check that time complexity is roughly linear
      for (let i = 1; i < times.length; i++) {
        const timeRatio = times[i] / times[i - 1]
        const sizeRatio = sizes[i] / sizes[i - 1]
        
        // Time ratio should not exceed size ratio by more than 50%
        expect(timeRatio).toBeLessThan(sizeRatio * 1.5)
      }
    })

    it('should handle edge cases efficiently', () => {
      // Test empty dataset
      const startTime1 = performance.now()
      detector.analyzeBehavioralPatterns([])
      const emptyTime = performance.now() - startTime1
      
      // Test single item
      const { indicators } = createLargeDataset(1)
      const startTime2 = performance.now()
      detector.analyzeBehavioralPatterns(indicators)
      const singleTime = performance.now() - startTime2
      
      // Test duplicate items
      const duplicates = Array(100).fill(indicators[0])
      const startTime3 = performance.now()
      detector.analyzeBehavioralPatterns(duplicates)
      const duplicateTime = performance.now() - startTime3
      
      expect(emptyTime).toBeLessThan(5)
      expect(singleTime).toBeLessThan(5)
      expect(duplicateTime).toBeLessThan(20)
    })
  })
})