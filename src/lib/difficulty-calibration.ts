// Advanced Content Difficulty Calibration Engine
import { LearningSession, LearningProfile, AdaptiveContent } from '@/types';

export interface DifficultyCalibration {
  contentId: string;
  baseDifficulty: number;
  calibratedDifficulty: number;
  userSpecificDifficulty: number;
  confidenceLevel: number;
  calibrationFactors: CalibrationFactor[];
  lastUpdated: Date;
}

export interface CalibrationFactor {
  factor: string;
  weight: number;
  impact: number;
  description: string;
}

export interface DifficultyAdaptation {
  originalDifficulty: number;
  adaptedDifficulty: number;
  adaptationReason: string;
  expectedAccuracy: number;
  adaptationStrength: number;
}

/**
 * Difficulty Calibration Configuration
 */
interface DifficultyCalibrationConfig {
  TARGET_ACCURACY: number;
  MIN_DIFFICULTY: number;
  MAX_DIFFICULTY: number;
  CALIBRATION_SENSITIVITY: number;
  MIN_SESSIONS_FOR_CALIBRATION: number;
  STATISTICAL_CONFIDENCE_LEVEL: number;
  OUTLIER_THRESHOLD: number;
  PRECISION_DECIMALS: number;
}

export class DifficultyCalibrationEngine {
  private readonly config: DifficultyCalibrationConfig = {
    TARGET_ACCURACY: 0.8,
    MIN_DIFFICULTY: 1,
    MAX_DIFFICULTY: 10,
    CALIBRATION_SENSITIVITY: 0.3,
    MIN_SESSIONS_FOR_CALIBRATION: 5,
    STATISTICAL_CONFIDENCE_LEVEL: 0.95,
    OUTLIER_THRESHOLD: 2.0, // Standard deviations
    PRECISION_DECIMALS: 4
  };

  /**
   * Calibrates content difficulty based on user performance data
   */
  public calibrateDifficulty(
    content: AdaptiveContent,
    userSessions: LearningSession[],
    learningProfile: LearningProfile,
    populationData?: LearningSession[]
  ): DifficultyCalibration {
    const calibrationFactors = this.calculateCalibrationFactors(
      content,
      userSessions,
      learningProfile,
      populationData
    );

    const baseDifficulty = content.difficulty;
    const calibratedDifficulty = this.applyCalibrationFactors(baseDifficulty, calibrationFactors);
    const userSpecificDifficulty = this.personalizeForUser(calibratedDifficulty, learningProfile);

    return {
      contentId: content.id,
      baseDifficulty,
      calibratedDifficulty,
      userSpecificDifficulty,
      confidenceLevel: this.calculateConfidenceLevel(userSessions, populationData),
      calibrationFactors,
      lastUpdated: new Date()
    };
  }

  /**
   * Adapts difficulty in real-time based on user performance
   */
  public adaptDifficultyRealTime(
    currentDifficulty: number,
    recentPerformance: LearningSession[],
    targetAccuracy: number = this.TARGET_ACCURACY
  ): DifficultyAdaptation {
    if (recentPerformance.length === 0) {
      return {
        originalDifficulty: currentDifficulty,
        adaptedDifficulty: currentDifficulty,
        adaptationReason: 'No performance data available',
        expectedAccuracy: targetAccuracy,
        adaptationStrength: 0
      };
    }

    const currentAccuracy = this.calculateCurrentAccuracy(recentPerformance);
    const accuracyDifference = currentAccuracy - targetAccuracy;
    
    let adaptedDifficulty = currentDifficulty;
    let adaptationReason = 'No adjustment needed';
    let adaptationStrength = 0;

    if (Math.abs(accuracyDifference) > 0.1) { // 10% threshold
      if (accuracyDifference > 0.15) {
        // User performing well above target - increase difficulty
        const increase = this.calculateDifficultyIncrease(accuracyDifference, currentDifficulty);
        adaptedDifficulty = Math.min(this.MAX_DIFFICULTY, currentDifficulty + increase);
        adaptationReason = `High accuracy (${Math.round(currentAccuracy * 100)}%) - increasing challenge`;
        adaptationStrength = increase / currentDifficulty;
      } else if (accuracyDifference < -0.15) {
        // User struggling - decrease difficulty
        const decrease = this.calculateDifficultyDecrease(Math.abs(accuracyDifference), currentDifficulty);
        adaptedDifficulty = Math.max(this.MIN_DIFFICULTY, currentDifficulty - decrease);
        adaptationReason = `Low accuracy (${Math.round(currentAccuracy * 100)}%) - reducing difficulty`;
        adaptationStrength = decrease / currentDifficulty;
      }
    }

    return {
      originalDifficulty: currentDifficulty,
      adaptedDifficulty,
      adaptationReason,
      expectedAccuracy: this.predictAccuracyAtDifficulty(adaptedDifficulty, recentPerformance),
      adaptationStrength
    };
  }

  /**
   * Validates difficulty assignments using cross-validation
   */
  public validateDifficultyAssignment(
    content: AdaptiveContent,
    testSessions: LearningSession[]
  ): DifficultyValidation {
    const actualDifficulty = this.inferDifficultyFromPerformance(testSessions);
    const assignedDifficulty = content.difficulty;
    const discrepancy = Math.abs(actualDifficulty - assignedDifficulty);
    
    return {
      contentId: content.id,
      assignedDifficulty,
      inferredDifficulty: actualDifficulty,
      discrepancy,
      isValid: discrepancy <= 1.5, // Allow 1.5 point tolerance
      recommendedAdjustment: actualDifficulty - assignedDifficulty,
      validationConfidence: this.calculateValidationConfidence(testSessions)
    };
  }

  private calculateCalibrationFactors(
    content: AdaptiveContent,
    userSessions: LearningSession[],
    learningProfile: LearningProfile,
    populationData?: LearningSession[]
  ): CalibrationFactor[] {
    const factors: CalibrationFactor[] = [];

    // User performance factor
    if (userSessions.length > 0) {
      const userAccuracy = this.calculateCurrentAccuracy(userSessions);
      const performanceImpact = this.calculatePerformanceImpact(userAccuracy);
      
      factors.push({
        factor: 'user_performance',
        weight: 0.4,
        impact: performanceImpact,
        description: `User accuracy: ${Math.round(userAccuracy * 100)}%`
      });
    }

    // Learning style factor
    const styleImpact = this.calculateStyleImpact(content, learningProfile);
    factors.push({
      factor: 'learning_style',
      weight: 0.2,
      impact: styleImpact,
      description: `Style alignment: ${learningProfile.dominantStyle}`
    });

    // Population benchmark factor
    if (populationData && populationData.length > 5) {
      const populationAccuracy = this.calculateCurrentAccuracy(populationData);
      const benchmarkImpact = this.calculateBenchmarkImpact(populationAccuracy);
      
      factors.push({
        factor: 'population_benchmark',
        weight: 0.3,
        impact: benchmarkImpact,
        description: `Population average: ${Math.round(populationAccuracy * 100)}%`
      });
    }

    // Content complexity factor
    const complexityImpact = this.calculateComplexityImpact(content);
    factors.push({
      factor: 'content_complexity',
      weight: 0.1,
      impact: complexityImpact,
      description: `Complexity analysis: ${content.metadata.cognitiveLoad}/10`
    });

    return factors;
  }

  private applyCalibrationFactors(baseDifficulty: number, factors: CalibrationFactor[]): number {
    if (typeof baseDifficulty !== 'number' || !isFinite(baseDifficulty)) {
      return this.config.MIN_DIFFICULTY;
    }

    if (!Array.isArray(factors) || factors.length === 0) {
      return Math.max(this.config.MIN_DIFFICULTY, Math.min(this.config.MAX_DIFFICULTY, baseDifficulty));
    }

    let adjustedDifficulty = baseDifficulty;
    let totalWeight = 0;
    let weightedAdjustment = 0;

    // Calculate weighted adjustment with proper bounds checking
    factors.forEach(factor => {
      if (factor && 
          typeof factor.impact === 'number' && 
          typeof factor.weight === 'number' &&
          isFinite(factor.impact) && 
          isFinite(factor.weight) &&
          factor.weight > 0) {
        
        // Bound impact and weight to reasonable ranges
        const boundedImpact = Math.max(-5, Math.min(5, factor.impact));
        const boundedWeight = Math.max(0, Math.min(1, factor.weight));
        
        const adjustment = boundedImpact * boundedWeight * this.config.CALIBRATION_SENSITIVITY;
        
        if (isFinite(adjustment)) {
          weightedAdjustment += adjustment * boundedWeight;
          totalWeight += boundedWeight;
        }
      }
    });

    // Apply weighted adjustment
    if (totalWeight > 0) {
      adjustedDifficulty += weightedAdjustment / totalWeight;
    }

    // Ensure result is within bounds and properly formatted
    const result = Math.max(this.config.MIN_DIFFICULTY, Math.min(this.config.MAX_DIFFICULTY, adjustedDifficulty));
    return parseFloat(result.toFixed(this.config.PRECISION_DECIMALS));
  }

  private personalizeForUser(calibratedDifficulty: number, learningProfile: LearningProfile): number {
    let personalizedDifficulty = calibratedDifficulty;

    // Adjust based on adaptation level
    const adaptationFactor = (learningProfile.adaptationLevel - 50) / 100; // -0.5 to +0.5
    personalizedDifficulty += adaptationFactor;

    // Adjust based on multimodal learning
    if (learningProfile.isMultimodal) {
      personalizedDifficulty += 0.2; // Multimodal learners can handle slightly higher difficulty
    }

    return Math.max(this.MIN_DIFFICULTY, Math.min(this.MAX_DIFFICULTY, personalizedDifficulty));
  }

  private calculateCurrentAccuracy(sessions: LearningSession[]): number {
    if (!Array.isArray(sessions) || sessions.length === 0) {
      return 0;
    }

    const validSessions = sessions.filter(session => 
      session &&
      typeof session.totalQuestions === 'number' &&
      typeof session.correctAnswers === 'number' &&
      session.totalQuestions >= 0 &&
      session.correctAnswers >= 0 &&
      session.correctAnswers <= session.totalQuestions
    );

    if (validSessions.length === 0) {
      return 0;
    }

    const totalQuestions = validSessions.reduce((sum, session) => sum + session.totalQuestions, 0);
    const correctAnswers = validSessions.reduce((sum, session) => sum + session.correctAnswers, 0);
    
    if (totalQuestions === 0) {
      return 0;
    }

    const accuracy = correctAnswers / totalQuestions;
    return Math.max(0, Math.min(1, parseFloat(accuracy.toFixed(this.config.PRECISION_DECIMALS))));
  }

  private calculatePerformanceImpact(accuracy: number): number {
    // Convert accuracy to difficulty adjustment
    // High accuracy = positive impact (increase difficulty)
    // Low accuracy = negative impact (decrease difficulty)
    return (accuracy - this.TARGET_ACCURACY) * 2; // Scale factor of 2
  }

  private calculateStyleImpact(content: AdaptiveContent, learningProfile: LearningProfile): number {
    // Check if content has variants matching user's learning style
    const hasMatchingVariant = content.contentVariants.some(
      variant => variant.styleType === learningProfile.dominantStyle
    );

    if (hasMatchingVariant) {
      // Content matches style - can be slightly more difficult
      return 0.3;
    } else {
      // Content doesn't match style - should be easier
      return -0.5;
    }
  }

  private calculateBenchmarkImpact(populationAccuracy: number): number {
    // Compare to target accuracy
    return (populationAccuracy - this.TARGET_ACCURACY) * 1.5;
  }

  private calculateComplexityImpact(content: AdaptiveContent): number {
    const cognitiveLoad = content.metadata.cognitiveLoad;
    const bloomsLevel = this.getBloomsLevel(content.metadata.bloomsTaxonomyLevel);
    
    // Higher cognitive load and Bloom's level = more difficult
    return (cognitiveLoad / 10 + bloomsLevel / 6 - 1) * 0.5;
  }

  private getBloomsLevel(bloomsLevel: string): number {
    const levels: Record<string, number> = {
      'remember': 1,
      'understand': 2,
      'apply': 3,
      'analyze': 4,
      'evaluate': 5,
      'create': 6
    };

    return levels[bloomsLevel.toLowerCase()] || 3; // Default to 'apply'
  }

  private calculateDifficultyIncrease(accuracyExcess: number, currentDifficulty: number): number {
    // Increase more aggressively for higher accuracy
    const baseIncrease = accuracyExcess * 3; // Scale factor
    const difficultyFactor = (this.MAX_DIFFICULTY - currentDifficulty) / this.MAX_DIFFICULTY;
    
    return baseIncrease * difficultyFactor * 0.8; // Max 80% of potential increase
  }

  private calculateDifficultyDecrease(accuracyDeficit: number, currentDifficulty: number): number {
    // Decrease more conservatively to avoid frustration
    const baseDecrease = accuracyDeficit * 2; // Scale factor
    const difficultyFactor = currentDifficulty / this.MAX_DIFFICULTY;
    
    return baseDecrease * difficultyFactor * 0.6; // Max 60% of potential decrease
  }

  private predictAccuracyAtDifficulty(difficulty: number, recentPerformance: LearningSession[]): number {
    // Input validation
    if (typeof difficulty !== 'number' || !isFinite(difficulty)) {
      return this.config.TARGET_ACCURACY;
    }

    if (!Array.isArray(recentPerformance) || recentPerformance.length === 0) {
      return this.config.TARGET_ACCURACY;
    }

    const currentAccuracy = this.calculateCurrentAccuracy(recentPerformance);
    
    // Get difficulties from session metadata (with fallback)
    const sessionDifficulties = recentPerformance
      .map(session => {
        // Try to extract difficulty from session metadata
        if (session.metadata && typeof session.metadata.difficulty === 'number') {
          return session.metadata.difficulty;
        }
        // Fallback: estimate difficulty from performance
        if (session.totalQuestions > 0) {
          const sessionAccuracy = session.correctAnswers / session.totalQuestions;
          // Inverse relationship: lower accuracy suggests higher difficulty
          return Math.max(1, Math.min(10, 11 - (sessionAccuracy * 10)));
        }
        return 5; // Default middle difficulty
      })
      .filter(d => typeof d === 'number' && isFinite(d));

    if (sessionDifficulties.length === 0) {
      // No difficulty data available, use simple model
      const accuracyDeviation = currentAccuracy - this.config.TARGET_ACCURACY;
      const difficultyAdjustment = (difficulty - 5) * 0.05; // 5% per difficulty level from median
      return Math.max(0, Math.min(1, this.config.TARGET_ACCURACY + accuracyDeviation - difficultyAdjustment));
    }

    const averageCurrentDifficulty = sessionDifficulties.reduce((sum, d) => sum + d, 0) / sessionDifficulties.length;
    const difficultyChange = difficulty - averageCurrentDifficulty;

    // Use empirical model: accuracy decreases with difficulty
    // Rate depends on current performance level
    let accuracyDropRate = 0.05; // Base rate: 5% per difficulty level
    
    // Adjust rate based on current accuracy (adaptive model)
    if (currentAccuracy > 0.9) {
      accuracyDropRate = 0.04; // High performers more resilient
    } else if (currentAccuracy < 0.6) {
      accuracyDropRate = 0.07; // Struggling learners more sensitive
    }
    
    const estimatedAccuracyChange = -difficultyChange * accuracyDropRate;
    const predictedAccuracy = currentAccuracy + estimatedAccuracyChange;
    
    // Apply bounds and statistical confidence adjustment
    const bounded = Math.max(0, Math.min(1, predictedAccuracy));
    
    // Add confidence interval based on data quality
    const confidence = this.calculateStatisticalConfidence(recentPerformance.length);
    const uncertaintyAdjustment = (1 - confidence) * 0.1; // Max 10% uncertainty
    
    return parseFloat(Math.max(0, Math.min(1, bounded - uncertaintyAdjustment)).toFixed(this.config.PRECISION_DECIMALS));
  }

  private inferDifficultyFromPerformance(sessions: LearningSession[]): number {
    const accuracy = this.calculateCurrentAccuracy(sessions);
    
    // Infer difficulty based on accuracy using inverse relationship
    // 90%+ accuracy suggests difficulty 3-4
    // 80% accuracy suggests difficulty 5-6
    // 70% accuracy suggests difficulty 7-8
    // <70% accuracy suggests difficulty 9-10
    
    if (accuracy >= 0.9) return 3.5;
    if (accuracy >= 0.8) return 5.5;
    if (accuracy >= 0.7) return 7.5;
    return 9;
  }

  private calculateConfidenceLevel(userSessions: LearningSession[], populationData?: LearningSession[]): number {
    if (!Array.isArray(userSessions)) {
      return 0;
    }

    let confidence = 0;
    const sessionCount = userSessions.length;

    // Base confidence on amount of user data (with diminishing returns)
    if (sessionCount >= 20) {
      confidence += 0.5;
    } else if (sessionCount >= 10) {
      confidence += 0.4;
    } else if (sessionCount >= this.config.MIN_SESSIONS_FOR_CALIBRATION) {
      confidence += 0.2 + (sessionCount - this.config.MIN_SESSIONS_FOR_CALIBRATION) * 0.04;
    } else {
      confidence += sessionCount * 0.04;
    }

    // Add confidence from population data
    if (populationData && Array.isArray(populationData)) {
      const popCount = populationData.length;
      if (popCount >= 50) {
        confidence += 0.3;
      } else if (popCount >= 20) {
        confidence += 0.25;
      } else if (popCount >= 10) {
        confidence += 0.15;
      }
    }

    // Add confidence from performance consistency
    if (sessionCount >= 3) {
      const accuracies = userSessions
        .filter(session => 
          session &&
          typeof session.totalQuestions === 'number' &&
          typeof session.correctAnswers === 'number' &&
          session.totalQuestions > 0
        )
        .map(session => session.correctAnswers / session.totalQuestions);
      
      if (accuracies.length >= 3) {
        const stdDev = this.calculateStandardDeviation(accuracies);
        // Convert std dev to consistency score (lower std dev = higher consistency)
        const consistency = Math.max(0, Math.min(1, 1 - (stdDev * 2))); // Scale appropriately
        confidence += consistency * 0.2;
      }
    }

    // Calculate statistical confidence based on sample size
    const statisticalConfidence = this.calculateStatisticalConfidence(sessionCount);
    confidence = Math.max(confidence, statisticalConfidence);

    return Math.max(0, Math.min(1, parseFloat(confidence.toFixed(this.config.PRECISION_DECIMALS))));
  }

  /**
   * Calculate statistical confidence based on sample size
   */
  private calculateStatisticalConfidence(sampleSize: number): number {
    if (sampleSize < 3) return 0.1;
    if (sampleSize < 5) return 0.3;
    if (sampleSize < 10) return 0.5;
    if (sampleSize < 20) return 0.7;
    if (sampleSize < 50) return 0.85;
    return 0.95;
  }

  private calculateValidationConfidence(testSessions: LearningSession[]): number {
    if (testSessions.length < 5) return 0.3;
    if (testSessions.length < 10) return 0.6;
    if (testSessions.length < 20) return 0.8;
    return 0.95;
  }

  private calculateStandardDeviation(values: number[]): number {
    if (!Array.isArray(values) || values.length < 2) {
      return 0;
    }

    // Filter out invalid values
    const validValues = values.filter(val => 
      typeof val === 'number' && 
      !isNaN(val) && 
      isFinite(val)
    );

    if (validValues.length < 2) {
      return 0;
    }

    // Calculate mean
    const mean = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
    
    if (!isFinite(mean)) {
      return 0;
    }

    // Calculate sample variance (using n-1 denominator for unbiased estimate)
    const variance = validValues.reduce((sum, val) => {
      const diff = val - mean;
      return sum + (diff * diff);
    }, 0) / (validValues.length - 1);
    
    if (variance < 0 || !isFinite(variance)) {
      return 0;
    }

    const stdDev = Math.sqrt(variance);
    return isFinite(stdDev) ? parseFloat(stdDev.toFixed(this.config.PRECISION_DECIMALS)) : 0;
  }
}

export interface DifficultyValidation {
  contentId: string;
  assignedDifficulty: number;
  inferredDifficulty: number;
  discrepancy: number;
  isValid: boolean;
  recommendedAdjustment: number;
  validationConfidence: number;
}