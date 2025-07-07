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

export class DifficultyCalibrationEngine {
  private readonly TARGET_ACCURACY = 0.8;
  private readonly MIN_DIFFICULTY = 1;
  private readonly MAX_DIFFICULTY = 10;
  private readonly CALIBRATION_SENSITIVITY = 0.3;

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
    let adjustedDifficulty = baseDifficulty;

    factors.forEach(factor => {
      const adjustment = factor.impact * factor.weight * this.CALIBRATION_SENSITIVITY;
      adjustedDifficulty += adjustment;
    });

    return Math.max(this.MIN_DIFFICULTY, Math.min(this.MAX_DIFFICULTY, adjustedDifficulty));
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
    const totalQuestions = sessions.reduce((sum, session) => sum + session.totalQuestions, 0);
    const correctAnswers = sessions.reduce((sum, session) => sum + session.correctAnswers, 0);
    
    return totalQuestions > 0 ? correctAnswers / totalQuestions : 0;
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
    if (recentPerformance.length === 0) return this.TARGET_ACCURACY;

    const currentAccuracy = this.calculateCurrentAccuracy(recentPerformance);
    const currentDifficulties = recentPerformance.map(session => {
      // This would need to be stored with each session
      return 5; // Default difficulty placeholder
    });

    const averageCurrentDifficulty = currentDifficulties.reduce((sum, d) => sum + d, 0) / currentDifficulties.length;
    const difficultyChange = difficulty - averageCurrentDifficulty;

    // Estimate accuracy change based on difficulty change
    // Assume roughly 5% accuracy drop per difficulty level increase
    const estimatedAccuracyChange = -difficultyChange * 0.05;
    
    return Math.max(0, Math.min(1, currentAccuracy + estimatedAccuracyChange));
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
    let confidence = 0;

    // Base confidence on amount of user data
    if (userSessions.length >= 10) confidence += 0.4;
    else if (userSessions.length >= 5) confidence += 0.2;
    else confidence += userSessions.length * 0.04;

    // Add confidence from population data
    if (populationData && populationData.length >= 20) confidence += 0.3;
    else if (populationData && populationData.length >= 10) confidence += 0.2;

    // Add confidence from consistency
    if (userSessions.length >= 3) {
      const accuracies = userSessions.map(session => 
        session.totalQuestions > 0 ? session.correctAnswers / session.totalQuestions : 0
      );
      const stdDev = this.calculateStandardDeviation(accuracies);
      const consistency = Math.max(0, 1 - stdDev); // Lower std dev = higher consistency
      confidence += consistency * 0.3;
    }

    return Math.min(1, confidence);
  }

  private calculateValidationConfidence(testSessions: LearningSession[]): number {
    if (testSessions.length < 5) return 0.3;
    if (testSessions.length < 10) return 0.6;
    if (testSessions.length < 20) return 0.8;
    return 0.95;
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length < 2) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance);
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