// Spaced Repetition Engine - Advanced memory retention optimization
import type { LearningSession, LearningProfile, LearningStyleType } from '@/types';

export interface SpacedRepetitionCard {
  id: string;
  contentId: string;
  userId: string;
  question: string;
  answer: string;
  topic: string;
  difficulty: number; // 1-10
  easeFactor: number; // 1.3-2.5 (SM-2 algorithm)
  interval: number; // days until next review
  repetitions: number; // number of successful reviews
  lastReviewDate: Date;
  nextReviewDate: Date;
  reviews: ReviewHistory[];
  learningObjective: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewHistory {
  reviewDate: Date;
  quality: number; // 0-5 (0=blackout, 5=perfect)
  responseTime: number; // seconds
  previousInterval: number;
  newInterval: number;
  easeFactor: number;
  wasCorrect: boolean;
}

export interface RepetitionSchedule {
  cardId: string;
  nextReviewDate: Date;
  priority: 'overdue' | 'due_today' | 'due_soon' | 'future';
  urgency: number; // 0-100
  estimatedDifficulty: number;
  reviewType: 'new' | 'review' | 'relearn';
}

export interface StudySession {
  id: string;
  userId: string;
  plannedCards: string[];
  completedCards: string[];
  sessionMetrics: SessionMetrics;
  adaptiveChanges: AdaptiveScheduleChange[];
  startTime: Date;
  endTime?: Date;
}

export interface SessionMetrics {
  totalCards: number;
  correctCards: number;
  averageResponseTime: number;
  averageQuality: number;
  difficultyDistribution: { [key: number]: number };
  retentionRate: number;
  learningEfficiency: number;
}

export interface AdaptiveScheduleChange {
  type: 'interval_adjustment' | 'difficulty_calibration' | 'priority_boost' | 'ease_modification';
  reason: string;
  cardId: string;
  previousValue: number;
  newValue: number;
  timestamp: Date;
}

export interface RetentionAnalysis {
  overallRetentionRate: number;
  retentionByDifficulty: { [key: number]: number };
  retentionByTopic: { [key: string]: number };
  retentionTrends: RetentionTrend[];
  forgettingCurve: ForgettingCurvePoint[];
  recommendedIntervals: { [key: string]: number };
}

export interface RetentionTrend {
  period: string;
  retentionRate: number;
  cardCount: number;
  trend: 'improving' | 'declining' | 'stable';
}

export interface ForgettingCurvePoint {
  interval: number; // days
  retentionRate: number;
  confidence: number;
  sampleSize: number;
}

export interface LeitnerBoxSystem {
  boxes: LeitnerBox[];
  promotionRules: PromotionRule[];
  demotionRules: DemotionRule[];
  maxBoxLevel: number;
}

export interface LeitnerBox {
  level: number;
  name: string;
  reviewInterval: number; // days
  cardIds: string[];
  promotionThreshold: number; // consecutive correct answers needed
  description: string;
}

export interface PromotionRule {
  fromLevel: number;
  toLevel: number;
  condition: 'consecutive_correct' | 'accuracy_threshold' | 'time_based';
  threshold: number;
}

export interface DemotionRule {
  fromLevel: number;
  toLevel: number;
  condition: 'incorrect_answer' | 'accuracy_below' | 'difficult_recall';
  threshold: number;
}

/**
 * Spaced Repetition Configuration
 */
interface SpacedRepetitionConfig {
  DEFAULT_EASE_FACTOR: number;
  MIN_EASE_FACTOR: number;
  MAX_EASE_FACTOR: number;
  INITIAL_INTERVAL: number;
  GRADUATION_INTERVAL: number;
  EASY_BONUS: number;
  HARD_PENALTY: number;
  MIN_INTERVAL: number;
  MAX_INTERVAL: number;
  QUALITY_THRESHOLD: number;
  MIN_SAMPLE_SIZE: number;
}

export class SpacedRepetitionEngine {
  private readonly config: SpacedRepetitionConfig = {
    DEFAULT_EASE_FACTOR: 2.5,
    MIN_EASE_FACTOR: 1.3,
    MAX_EASE_FACTOR: 2.5,
    INITIAL_INTERVAL: 1, // days
    GRADUATION_INTERVAL: 4, // days
    EASY_BONUS: 1.3,
    HARD_PENALTY: 0.85,
    MIN_INTERVAL: 1,
    MAX_INTERVAL: 365,
    QUALITY_THRESHOLD: 3,
    MIN_SAMPLE_SIZE: 5
  };

  /**
   * Implements the SM-2 algorithm with proper error handling and validation
   */
  public calculateNextReview(card: SpacedRepetitionCard, quality: number): SpacedRepetitionCard {
    try {
      // Input validation
      if (!card || !card.id) {
        throw new Error('Invalid card provided');
      }

      if (typeof quality !== 'number') {
        throw new Error('Quality must be a number');
      }

      // Create deep copy to avoid mutations
      const newCard: SpacedRepetitionCard = {
        ...card,
        reviews: [...(card.reviews || [])],
        updatedAt: new Date()
      };

      const now = new Date();

      // Validate and normalize quality score (0-5)
      const normalizedQuality = Math.max(0, Math.min(5, Math.round(quality)));

      // Validate current ease factor
      if (typeof newCard.easeFactor !== 'number' || 
          newCard.easeFactor < this.config.MIN_EASE_FACTOR || 
          newCard.easeFactor > this.config.MAX_EASE_FACTOR) {
        newCard.easeFactor = this.config.DEFAULT_EASE_FACTOR;
      }

      // Validate repetition count
      if (typeof newCard.repetitions !== 'number' || newCard.repetitions < 0) {
        newCard.repetitions = 0;
      }

      // Validate current interval
      if (typeof newCard.interval !== 'number' || newCard.interval < 1) {
        newCard.interval = this.config.INITIAL_INTERVAL;
      }

      // Update ease factor based on quality (SM-2 algorithm)
      if (normalizedQuality >= this.config.QUALITY_THRESHOLD) {
        const easeDelta = 0.1 - (5 - normalizedQuality) * (0.08 + (5 - normalizedQuality) * 0.02);
        newCard.easeFactor = Math.min(
          this.config.MAX_EASE_FACTOR,
          Math.max(this.config.MIN_EASE_FACTOR, newCard.easeFactor + easeDelta)
        );
      } else {
        newCard.easeFactor = Math.max(
          this.config.MIN_EASE_FACTOR,
          newCard.easeFactor - 0.2
        );
      }

      // Calculate new interval
      let newInterval: number;
      
      if (normalizedQuality < this.config.QUALITY_THRESHOLD) {
        // Failed review - reset to initial interval
        newInterval = this.config.INITIAL_INTERVAL;
        newCard.repetitions = 0;
      } else {
        // Successful review
        newCard.repetitions += 1;
        
        if (newCard.repetitions === 1) {
          newInterval = this.config.INITIAL_INTERVAL;
        } else if (newCard.repetitions === 2) {
          newInterval = this.config.GRADUATION_INTERVAL;
        } else {
          // Ensure proper multiplication
          const baseInterval = Math.max(this.config.INITIAL_INTERVAL, newCard.interval);
          const easeFactor = Math.max(this.config.MIN_EASE_FACTOR, newCard.easeFactor);
          newInterval = Math.round(baseInterval * easeFactor);
        }

        // Apply quality-based adjustments
        if (normalizedQuality === 5) {
          newInterval = Math.round(newInterval * this.config.EASY_BONUS);
        } else if (normalizedQuality === 3) {
          newInterval = Math.round(newInterval * this.config.HARD_PENALTY);
        }
      }

      // Apply minimum and maximum interval constraints
      newInterval = Math.max(this.config.MIN_INTERVAL, Math.min(this.config.MAX_INTERVAL, newInterval));

      // Record review history
      const reviewRecord: ReviewHistory = {
        reviewDate: now,
        quality: normalizedQuality,
        responseTime: 0, // This would come from the review session
        previousInterval: newCard.interval,
        newInterval,
        easeFactor: newCard.easeFactor,
        wasCorrect: normalizedQuality >= this.config.QUALITY_THRESHOLD
      };

      newCard.reviews.push(reviewRecord);

      // Update card properties
      newCard.interval = newInterval;
      newCard.lastReviewDate = now;
      newCard.nextReviewDate = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000);

      return newCard;
    } catch (error) {
      console.error('Error calculating next review:', error);
      // Return original card with minimal update on error
      return {
        ...card,
        lastReviewDate: new Date(),
        nextReviewDate: new Date(Date.now() + this.config.INITIAL_INTERVAL * 24 * 60 * 60 * 1000),
        updatedAt: new Date()
      };
    }
  }

  /**
   * Generates optimized study schedule based on spaced repetition principles
   */
  public generateStudySchedule(
    cards: SpacedRepetitionCard[],
    targetStudyTime: number, // minutes
    learningProfile: LearningProfile,
    currentDate: Date = new Date()
  ): RepetitionSchedule[] {
    const schedule: RepetitionSchedule[] = [];

    // Categorize cards by review status
    const overdueCards = cards.filter(card => card.nextReviewDate < currentDate);
    const dueToday = cards.filter(card => 
      card.nextReviewDate.toDateString() === currentDate.toDateString()
    );
    const dueSoon = cards.filter(card => {
      const daysDiff = Math.ceil((card.nextReviewDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff > 0 && daysDiff <= 3;
    });

    // Process overdue cards (highest priority)
    overdueCards.forEach(card => {
      const daysPastDue = Math.ceil((currentDate.getTime() - card.nextReviewDate.getTime()) / (1000 * 60 * 60 * 24));
      schedule.push({
        cardId: card.id,
        nextReviewDate: card.nextReviewDate,
        priority: 'overdue',
        urgency: Math.min(100, 50 + daysPastDue * 10),
        estimatedDifficulty: this.estimateCardDifficulty(card),
        reviewType: card.repetitions === 0 ? 'new' : 'review'
      });
    });

    // Process due today cards
    dueToday.forEach(card => {
      schedule.push({
        cardId: card.id,
        nextReviewDate: card.nextReviewDate,
        priority: 'due_today',
        urgency: 75,
        estimatedDifficulty: this.estimateCardDifficulty(card),
        reviewType: card.repetitions === 0 ? 'new' : 'review'
      });
    });

    // Process due soon cards if time allows
    dueSoon.forEach(card => {
      schedule.push({
        cardId: card.id,
        nextReviewDate: card.nextReviewDate,
        priority: 'due_soon',
        urgency: 30,
        estimatedDifficulty: this.estimateCardDifficulty(card),
        reviewType: 'review'
      });
    });

    // Sort by priority and urgency
    schedule.sort((a, b) => {
      const priorityOrder = { 'overdue': 4, 'due_today': 3, 'due_soon': 2, 'future': 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return b.urgency - a.urgency;
    });

    // Optimize for learning style and available time
    return this.optimizeScheduleForLearner(schedule, targetStudyTime, learningProfile);
  }

  /**
   * Creates adaptive Leitner box system for supplementary review
   */
  public createLeitnerBoxSystem(): LeitnerBoxSystem {
    return {
      boxes: [
        {
          level: 1,
          name: 'Daily Review',
          reviewInterval: 1,
          cardIds: [],
          promotionThreshold: 2,
          description: 'New cards and frequent mistakes'
        },
        {
          level: 2,
          name: 'Every 3 Days',
          reviewInterval: 3,
          cardIds: [],
          promotionThreshold: 2,
          description: 'Cards gaining familiarity'
        },
        {
          level: 3,
          name: 'Weekly Review',
          reviewInterval: 7,
          cardIds: [],
          promotionThreshold: 3,
          description: 'Well-known cards'
        },
        {
          level: 4,
          name: 'Bi-weekly Review',
          reviewInterval: 14,
          cardIds: [],
          promotionThreshold: 3,
          description: 'Confident cards'
        },
        {
          level: 5,
          name: 'Monthly Review',
          reviewInterval: 30,
          cardIds: [],
          promotionThreshold: 4,
          description: 'Mastered cards'
        }
      ],
      promotionRules: [
        { fromLevel: 1, toLevel: 2, condition: 'consecutive_correct', threshold: 2 },
        { fromLevel: 2, toLevel: 3, condition: 'consecutive_correct', threshold: 2 },
        { fromLevel: 3, toLevel: 4, condition: 'consecutive_correct', threshold: 3 },
        { fromLevel: 4, toLevel: 5, condition: 'consecutive_correct', threshold: 3 }
      ],
      demotionRules: [
        { fromLevel: 2, toLevel: 1, condition: 'incorrect_answer', threshold: 1 },
        { fromLevel: 3, toLevel: 1, condition: 'incorrect_answer', threshold: 1 },
        { fromLevel: 4, toLevel: 2, condition: 'incorrect_answer', threshold: 1 },
        { fromLevel: 5, toLevel: 3, condition: 'incorrect_answer', threshold: 1 }
      ],
      maxBoxLevel: 5
    };
  }

  /**
   * Analyzes retention patterns and optimizes intervals
   */
  public analyzeRetentionPatterns(cards: SpacedRepetitionCard[]): RetentionAnalysis {
    const analysis: RetentionAnalysis = {
      overallRetentionRate: this.calculateOverallRetention(cards),
      retentionByDifficulty: this.calculateRetentionByDifficulty(cards),
      retentionByTopic: this.calculateRetentionByTopic(cards),
      retentionTrends: this.calculateRetentionTrends(cards),
      forgettingCurve: this.generateForgettingCurve(cards),
      recommendedIntervals: this.optimizeIntervals(cards)
    };

    return analysis;
  }

  /**
   * Adapts intervals based on user performance patterns
   */
  public adaptiveIntervalOptimization(
    cards: SpacedRepetitionCard[],
    learningProfile: LearningProfile,
    recentSessions: StudySession[]
  ): AdaptiveScheduleChange[] {
    const changes: AdaptiveScheduleChange[] = [];
    const performanceMetrics = this.analyzeSessionPerformance(recentSessions);

    cards.forEach(card => {
      // Analyze card-specific performance
      const cardPerformance = this.analyzeCardPerformance(card);
      
      // Check if interval adjustment is needed
      if (cardPerformance.retentionRate < 0.8 && card.interval > 7) {
        // Reduce interval for poor retention
        const newInterval = Math.max(1, Math.round(card.interval * 0.8));
        changes.push({
          type: 'interval_adjustment',
          reason: `Low retention rate (${Math.round(cardPerformance.retentionRate * 100)}%)`,
          cardId: card.id,
          previousValue: card.interval,
          newValue: newInterval,
          timestamp: new Date()
        });
      } else if (cardPerformance.retentionRate > 0.95 && card.easeFactor > 2.3) {
        // Increase interval for excellent retention
        const newInterval = Math.min(365, Math.round(card.interval * 1.2));
        changes.push({
          type: 'interval_adjustment',
          reason: `Excellent retention rate (${Math.round(cardPerformance.retentionRate * 100)}%)`,
          cardId: card.id,
          previousValue: card.interval,
          newValue: newInterval,
          timestamp: new Date()
        });
      }

      // Adjust ease factor based on learning style
      if (this.shouldAdjustEaseForStyle(card, learningProfile)) {
        const newEase = this.calculateStyleOptimizedEase(card, learningProfile);
        changes.push({
          type: 'ease_modification',
          reason: `Optimized for ${learningProfile.dominantStyle} learning style`,
          cardId: card.id,
          previousValue: card.easeFactor,
          newValue: newEase,
          timestamp: new Date()
        });
      }
    });

    return changes;
  }

  /**
   * Generates personalized review recommendations
   */
  public generateReviewRecommendations(
    cards: SpacedRepetitionCard[],
    learningProfile: LearningProfile,
    availableTime: number // minutes
  ): ReviewRecommendation[] {
    const recommendations: ReviewRecommendation[] = [];
    const retentionAnalysis = this.analyzeRetentionPatterns(cards);

    // Identify weak areas
    const weakTopics = Object.entries(retentionAnalysis.retentionByTopic)
      .filter(([topic, retention]) => retention < 0.7)
      .map(([topic, retention]) => topic);

    if (weakTopics.length > 0) {
      recommendations.push({
        type: 'focus_area',
        title: 'Focus on Weak Topics',
        description: `Consider additional review for: ${weakTopics.join(', ')}`,
        priority: 'high',
        estimatedTime: 15,
        cardIds: cards.filter(card => weakTopics.includes(card.topic)).map(card => card.id)
      });
    }

    // Suggest optimal study times
    if (learningProfile.behavioralIndicators.length > 0) {
      const optimalTimes = this.identifyOptimalStudyTimes(learningProfile);
      recommendations.push({
        type: 'timing',
        title: 'Optimize Study Schedule',
        description: `Best performance observed during: ${optimalTimes.join(', ')}`,
        priority: 'medium',
        estimatedTime: 0,
        cardIds: []
      });
    }

    // Learning style optimizations
    recommendations.push(...this.generateStyleOptimizations(learningProfile, cards));

    return recommendations;
  }

  /**
   * Implements active recall testing strategies
   */
  public generateActiveRecallTests(
    cards: SpacedRepetitionCard[],
    testType: 'recall' | 'recognition' | 'mixed' = 'mixed'
  ): ActiveRecallTest[] {
    const tests: ActiveRecallTest[] = [];

    cards.forEach(card => {
      if (testType === 'recall' || testType === 'mixed') {
        tests.push({
          cardId: card.id,
          type: 'free_recall',
          prompt: card.question,
          expectedAnswer: card.answer,
          difficulty: card.difficulty,
          hints: this.generateHints(card),
          timeLimit: this.calculateTimeLimit(card)
        });
      }

      if (testType === 'recognition' || testType === 'mixed') {
        tests.push({
          cardId: card.id,
          type: 'recognition',
          prompt: `Which of the following best answers: ${card.question}`,
          expectedAnswer: card.answer,
          difficulty: card.difficulty,
          options: this.generateDistractors(card),
          timeLimit: this.calculateTimeLimit(card) * 0.7 // Recognition is typically faster
        });
      }
    });

    return this.optimizeTestSequence(tests);
  }

  // Private helper methods

  private estimateCardDifficulty(card: SpacedRepetitionCard): number {
    // Combine intrinsic difficulty with historical performance
    const performanceAdjustment = card.reviews.length > 0 
      ? card.reviews.slice(-3).reduce((sum, review) => sum + (5 - review.quality), 0) / 15
      : 0;
    
    return Math.min(10, card.difficulty + performanceAdjustment);
  }

  private optimizeScheduleForLearner(
    schedule: RepetitionSchedule[],
    targetTime: number,
    learningProfile: LearningProfile
  ): RepetitionSchedule[] {
    // Estimate time per card based on difficulty and learning style
    const estimatedTimes = schedule.map(item => ({
      ...item,
      estimatedTime: this.estimateReviewTime(item, learningProfile)
    }));

    // Use knapsack-like algorithm to optimize for available time
    let totalTime = 0;
    const optimizedSchedule: RepetitionSchedule[] = [];

    for (const item of estimatedTimes) {
      if (totalTime + item.estimatedTime <= targetTime) {
        optimizedSchedule.push(item);
        totalTime += item.estimatedTime;
      } else if (item.priority === 'overdue') {
        // Always include overdue cards, even if it exceeds time
        optimizedSchedule.push(item);
      }
    }

    return optimizedSchedule;
  }

  private estimateReviewTime(item: RepetitionSchedule, learningProfile: LearningProfile): number {
    let baseTime = 2; // 2 minutes base time

    // Adjust for difficulty
    baseTime *= (1 + item.estimatedDifficulty / 10);

    // Adjust for learning style
    if (learningProfile.dominantStyle === LearningStyleType.READING) {
      baseTime *= 1.2; // Reading-style learners tend to take more time
    } else if (learningProfile.dominantStyle === LearningStyleType.KINESTHETIC) {
      baseTime *= 0.9; // Kinesthetic learners often work faster
    }

    // Adjust for review type
    if (item.reviewType === 'new') {
      baseTime *= 1.5; // New cards take longer
    }

    return Math.round(baseTime);
  }

  private calculateOverallRetention(cards: SpacedRepetitionCard[]): number {
    if (!Array.isArray(cards) || cards.length === 0) {
      return 0;
    }

    const validCards = cards.filter(card => 
      card && Array.isArray(card.reviews)
    );

    if (validCards.length === 0) {
      return 0;
    }

    let totalReviews = 0;
    let successfulReviews = 0;

    validCards.forEach(card => {
      const validReviews = card.reviews.filter(review => 
        review && 
        typeof review.quality === 'number' && 
        review.quality >= 0 && 
        review.quality <= 5
      );
      
      totalReviews += validReviews.length;
      successfulReviews += validReviews.filter(review => 
        review.quality >= this.config.QUALITY_THRESHOLD
      ).length;
    });

    return totalReviews > 0 ? Math.max(0, Math.min(1, successfulReviews / totalReviews)) : 0;
  }

  private calculateRetentionByDifficulty(cards: SpacedRepetitionCard[]): { [key: number]: number } {
    if (!Array.isArray(cards) || cards.length === 0) {
      return {};
    }

    const retentionByDifficulty: { [key: number]: number } = {};

    for (let difficulty = 1; difficulty <= 10; difficulty++) {
      const relevantCards = cards.filter(card => 
        card &&
        typeof card.difficulty === 'number' &&
        Math.round(card.difficulty) === difficulty &&
        Array.isArray(card.reviews) &&
        card.reviews.length > 0
      );

      if (relevantCards.length > 0) {
        let totalReviews = 0;
        let successfulReviews = 0;

        relevantCards.forEach(card => {
          const validReviews = card.reviews.filter(review => 
            review && 
            typeof review.quality === 'number' &&
            review.quality >= 0 &&
            review.quality <= 5
          );
          
          totalReviews += validReviews.length;
          successfulReviews += validReviews.filter(review => 
            review.quality >= this.config.QUALITY_THRESHOLD
          ).length;
        });

        if (totalReviews > 0) {
          retentionByDifficulty[difficulty] = Math.max(0, Math.min(1, successfulReviews / totalReviews));
        }
      }
    }

    return retentionByDifficulty;
  }

  private calculateRetentionByTopic(cards: SpacedRepetitionCard[]): { [key: string]: number } {
    const topicGroups = new Map<string, SpacedRepetitionCard[]>();

    cards.forEach(card => {
      if (!topicGroups.has(card.topic)) {
        topicGroups.set(card.topic, []);
      }
      topicGroups.get(card.topic)!.push(card);
    });

    const retentionByTopic: { [key: string]: number } = {};

    topicGroups.forEach((topicCards, topic) => {
      const totalReviews = topicCards.reduce((sum, card) => sum + card.reviews.length, 0);
      const successfulReviews = topicCards.reduce((sum, card) => 
        sum + card.reviews.filter(review => review.quality >= 3).length, 0
      );

      retentionByTopic[topic] = totalReviews > 0 ? successfulReviews / totalReviews : 0;
    });

    return retentionByTopic;
  }

  private calculateRetentionTrends(cards: SpacedRepetitionCard[]): RetentionTrend[] {
    // Simplified trend calculation - would be more sophisticated in practice
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const recentReviews = cards.flatMap(card => 
      card.reviews.filter(review => review.reviewDate >= oneWeekAgo)
    );
    const olderReviews = cards.flatMap(card => 
      card.reviews.filter(review => review.reviewDate >= twoWeeksAgo && review.reviewDate < oneWeekAgo)
    );

    const recentRetention = recentReviews.length > 0 
      ? recentReviews.filter(review => review.quality >= 3).length / recentReviews.length
      : 0;

    const olderRetention = olderReviews.length > 0 
      ? olderReviews.filter(review => review.quality >= 3).length / olderReviews.length
      : 0;

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentRetention > olderRetention + 0.05) trend = 'improving';
    else if (recentRetention < olderRetention - 0.05) trend = 'declining';

    return [{
      period: 'past_week',
      retentionRate: recentRetention,
      cardCount: recentReviews.length,
      trend
    }];
  }

  private generateForgettingCurve(cards: SpacedRepetitionCard[]): ForgettingCurvePoint[] {
    if (!Array.isArray(cards) || cards.length === 0) {
      return [];
    }

    const curve: ForgettingCurvePoint[] = [];
    const intervals = [1, 3, 7, 14, 30, 60, 120, 365];

    intervals.forEach(interval => {
      const relevantReviews = cards
        .filter(card => card && Array.isArray(card.reviews))
        .flatMap(card => 
          card.reviews.filter(review => {
            if (!review || typeof review.previousInterval !== 'number') {
              return false;
            }
            return Math.abs(review.previousInterval - interval) <= 1;
          })
        )
        .filter(review => 
          review &&
          typeof review.quality === 'number' &&
          review.quality >= 0 &&
          review.quality <= 5
        );

      if (relevantReviews.length >= this.config.MIN_SAMPLE_SIZE) {
        const successfulReviews = relevantReviews.filter(review => 
          review.quality >= this.config.QUALITY_THRESHOLD
        ).length;
        
        const retention = successfulReviews / relevantReviews.length;
        const confidence = Math.min(1, relevantReviews.length / 20);
        
        curve.push({
          interval,
          retentionRate: Math.max(0, Math.min(1, retention)),
          confidence: Math.max(0, Math.min(1, confidence)),
          sampleSize: relevantReviews.length
        });
      }
    });

    return curve;
  }

  private optimizeIntervals(cards: SpacedRepetitionCard[]): { [key: string]: number } {
    const recommendations: { [key: string]: number } = {};
    const retentionData = this.generateForgettingCurve(cards);

    // Find optimal intervals for 85% retention target
    retentionData.forEach(point => {
      if (point.retentionRate >= 0.85 && point.retentionRate <= 0.9) {
        recommendations[`difficulty_${Math.round(point.interval / 7)}`] = point.interval;
      }
    });

    return recommendations;
  }

  private analyzeSessionPerformance(sessions: StudySession[]): SessionMetrics {
    if (sessions.length === 0) {
      return {
        totalCards: 0,
        correctCards: 0,
        averageResponseTime: 0,
        averageQuality: 0,
        difficultyDistribution: {},
        retentionRate: 0,
        learningEfficiency: 0
      };
    }

    const allMetrics = sessions.map(session => session.sessionMetrics);
    
    return {
      totalCards: allMetrics.reduce((sum, metrics) => sum + metrics.totalCards, 0),
      correctCards: allMetrics.reduce((sum, metrics) => sum + metrics.correctCards, 0),
      averageResponseTime: allMetrics.reduce((sum, metrics) => sum + metrics.averageResponseTime, 0) / allMetrics.length,
      averageQuality: allMetrics.reduce((sum, metrics) => sum + metrics.averageQuality, 0) / allMetrics.length,
      difficultyDistribution: this.mergeDifficultyDistributions(allMetrics),
      retentionRate: allMetrics.reduce((sum, metrics) => sum + metrics.retentionRate, 0) / allMetrics.length,
      learningEfficiency: allMetrics.reduce((sum, metrics) => sum + metrics.learningEfficiency, 0) / allMetrics.length
    };
  }

  private analyzeCardPerformance(card: SpacedRepetitionCard): { retentionRate: number; averageQuality: number } {
    if (card.reviews.length === 0) {
      return { retentionRate: 0, averageQuality: 0 };
    }

    const successfulReviews = card.reviews.filter(review => review.quality >= 3).length;
    const retentionRate = successfulReviews / card.reviews.length;
    const averageQuality = card.reviews.reduce((sum, review) => sum + review.quality, 0) / card.reviews.length;

    return { retentionRate, averageQuality };
  }

  private shouldAdjustEaseForStyle(card: SpacedRepetitionCard, learningProfile: LearningProfile): boolean {
    // Check if card type aligns with learning style
    // This would need content metadata to determine if adjustment is beneficial
    return false; // Placeholder
  }

  private calculateStyleOptimizedEase(card: SpacedRepetitionCard, learningProfile: LearningProfile): number {
    let ease = card.easeFactor;
    
    // Adjust based on learning style preferences
    if (learningProfile.dominantStyle === LearningStyleType.VISUAL) {
      ease *= 1.05; // Slightly easier for visual learners with visual content
    }

    return Math.max(this.MIN_EASE_FACTOR, Math.min(this.MAX_EASE_FACTOR, ease));
  }

  private identifyOptimalStudyTimes(learningProfile: LearningProfile): string[] {
    // Analyze behavioral indicators to find peak performance times
    const hourlyPerformance = new Map<number, number[]>();

    learningProfile.behavioralIndicators.forEach(indicator => {
      const hour = indicator.timestamp.getHours();
      if (!hourlyPerformance.has(hour)) {
        hourlyPerformance.set(hour, []);
      }
      hourlyPerformance.get(hour)!.push(indicator.engagementLevel);
    });

    const optimalHours: string[] = [];
    let bestAverage = 0;

    hourlyPerformance.forEach((engagements, hour) => {
      if (engagements.length >= 3) {
        const average = engagements.reduce((sum, eng) => sum + eng, 0) / engagements.length;
        if (average > bestAverage) {
          bestAverage = average;
          optimalHours.length = 0; // Clear previous best
          optimalHours.push(`${hour}:00`);
        } else if (Math.abs(average - bestAverage) < 5) {
          optimalHours.push(`${hour}:00`);
        }
      }
    });

    return optimalHours;
  }

  private generateStyleOptimizations(learningProfile: LearningProfile, cards: SpacedRepetitionCard[]): ReviewRecommendation[] {
    const recommendations: ReviewRecommendation[] = [];

    if (learningProfile.dominantStyle === LearningStyleType.VISUAL) {
      recommendations.push({
        type: 'learning_style',
        title: 'Visual Learning Enhancement',
        description: 'Add visual elements like diagrams or mind maps to improve retention',
        priority: 'medium',
        estimatedTime: 10,
        cardIds: cards.filter(card => card.difficulty > 6).map(card => card.id)
      });
    }

    return recommendations;
  }

  private generateHints(card: SpacedRepetitionCard): string[] {
    // This would generate contextual hints based on card content
    return [
      'Think about the key concept...',
      'Remember the main category...',
      'Consider the relationship between...'
    ];
  }

  private calculateTimeLimit(card: SpacedRepetitionCard): number {
    // Base time limit based on difficulty
    return Math.max(30, 60 + card.difficulty * 15); // 30 seconds to 3 minutes
  }

  private generateDistractors(card: SpacedRepetitionCard): string[] {
    // This would generate plausible incorrect options
    return [
      card.answer, // Correct answer
      'Distractor 1',
      'Distractor 2',
      'Distractor 3'
    ];
  }

  private optimizeTestSequence(tests: ActiveRecallTest[]): ActiveRecallTest[] {
    // Optimize test order for cognitive load and retention
    return tests.sort((a, b) => {
      // Start with easier tests, gradually increase difficulty
      if (a.difficulty !== b.difficulty) {
        return a.difficulty - b.difficulty;
      }
      // Alternate between recall and recognition
      if (a.type !== b.type) {
        return a.type === 'free_recall' ? -1 : 1;
      }
      return 0;
    });
  }

  private mergeDifficultyDistributions(metrics: SessionMetrics[]): { [key: number]: number } {
    const merged: { [key: number]: number } = {};
    
    metrics.forEach(metric => {
      Object.entries(metric.difficultyDistribution).forEach(([difficulty, count]) => {
        const diff = parseInt(difficulty);
        merged[diff] = (merged[diff] || 0) + count;
      });
    });

    return merged;
  }
}

// Supporting interfaces
export interface ReviewRecommendation {
  type: 'focus_area' | 'timing' | 'learning_style' | 'difficulty_adjustment';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  estimatedTime: number; // minutes
  cardIds: string[];
}

export interface ActiveRecallTest {
  cardId: string;
  type: 'free_recall' | 'recognition' | 'cued_recall';
  prompt: string;
  expectedAnswer: string;
  difficulty: number;
  hints?: string[];
  options?: string[];
  timeLimit: number; // seconds
}