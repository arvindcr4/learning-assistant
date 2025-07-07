// Learning Engine - Core algorithms for adaptive learning
import { 
  LearningProfile, 
  LearningStyleType, 
  LearningStyle, 
  StyleAssessment, 
  BehavioralIndicator,
  PaceProfile,
  PaceAdjustment,
  LearningSession,
  AdaptiveChange,
  ContentVariant,
  LearningAnalytics,
  Recommendation
} from '@/types';
import { VARKAssessment, VARKResponse } from './vark-questionnaire';
import { AdaptiveAssessmentEngine, AssessmentState } from './adaptive-assessment';
import { PerformanceAnalyticsEngine, PerformanceMetrics, MLInsight } from './performance-analytics';
import { SpacedRepetitionEngine, SpacedRepetitionCard, RepetitionSchedule } from './spaced-repetition';
import { BehavioralTrackingEngine, BehavioralEvent, BehavioralPattern, RealTimeInsight } from './behavioral-tracking';
import { generateUUID } from '@/utils/uuid';
import { 
  ContentRecommendation, 
  LearningPathOptimization, 
  LearningEfficiencyMetrics 
} from './learning-algorithms';

/**
 * Learning Style Detection Engine Configuration
 */
interface LearningStyleConfig {
  CONFIDENCE_THRESHOLD: number;
  MIN_DATA_POINTS: number;
  MAX_WEIGHT_TIME_MINUTES: number;
  DEFAULT_WEIGHT: number;
  MIN_WEIGHT: number;
  MAX_WEIGHT: number;
  MULTIMODAL_THRESHOLD: number;
  MIN_ENGAGEMENT_SCORE: number;
  MAX_ENGAGEMENT_SCORE: number;
}

/**
 * Learning Style Detection Engine
 * Implements hybrid approach combining VARK questionnaire with behavioral analysis
 */
export class LearningStyleDetector {
  private readonly config: LearningStyleConfig = {
    CONFIDENCE_THRESHOLD: 0.7,
    MIN_DATA_POINTS: 10,
    MAX_WEIGHT_TIME_MINUTES: 30,
    DEFAULT_WEIGHT: 0.5,
    MIN_WEIGHT: 0.1,
    MAX_WEIGHT: 1.0,
    MULTIMODAL_THRESHOLD: 25,
    MIN_ENGAGEMENT_SCORE: 0,
    MAX_ENGAGEMENT_SCORE: 100
  };
  
  /**
   * Analyzes behavioral indicators to determine learning style preferences
   */
  public analyzeBehavioralPatterns(indicators: BehavioralIndicator[]): LearningStyle[] {
    const styleScores = this.calculateStyleScores(indicators);
    const confidence = this.calculateConfidence(indicators.length);
    
    return Object.entries(styleScores).map(([type, score]) => ({
      type: type as LearningStyleType,
      score: Math.round(score * 100),
      confidence,
      lastUpdated: new Date()
    }));
  }
  
  /**
   * Processes VARK questionnaire results using comprehensive assessment
   */
  public processVARKAssessment(responses: VARKResponse[]): StyleAssessment {
    const validation = VARKAssessment.validateResponses(responses);
    if (!validation.isValid) {
      throw new Error(`Invalid VARK responses: ${validation.errors.join(', ')}`);
    }
    
    const varkResults = VARKAssessment.calculateScores(responses);
    
    return {
      id: generateUUID(),
      type: 'questionnaire',
      results: {
        visual: varkResults.visual / 100,
        auditory: varkResults.auditory / 100,
        reading: varkResults.reading / 100,
        kinesthetic: varkResults.kinesthetic / 100
      },
      confidence: varkResults.confidence / 100,
      dataPoints: responses.length,
      completedAt: new Date()
    };
  }
  
  /**
   * Combines multiple assessment sources for comprehensive learning profile
   */
  public createLearningProfile(
    userId: string,
    assessments: StyleAssessment[],
    behavioralIndicators: BehavioralIndicator[]
  ): LearningProfile {
    const styles = this.synthesizeStyles(assessments, behavioralIndicators);
    const dominantStyle = this.determineDominantStyle(styles);
    const isMultimodal = this.isMultimodalLearner(styles);
    
    return {
      id: generateUUID(),
      userId,
      styles,
      dominantStyle,
      isMultimodal,
      assessmentHistory: assessments,
      behavioralIndicators,
      adaptationLevel: this.calculateAdaptationLevel(behavioralIndicators),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
  
  /**
   * Updates learning profile based on new interactions
   */
  public updateLearningProfile(
    profile: LearningProfile,
    newIndicators: BehavioralIndicator[]
  ): LearningProfile {
    const allIndicators = [...profile.behavioralIndicators, ...newIndicators];
    const updatedStyles = this.analyzeBehavioralPatterns(allIndicators);
    
    return {
      ...profile,
      styles: this.mergeStyles(profile.styles, updatedStyles),
      behavioralIndicators: allIndicators,
      adaptationLevel: this.calculateAdaptationLevel(allIndicators),
      updatedAt: new Date()
    };
  }
  
  private calculateStyleScores(indicators: BehavioralIndicator[]): Record<string, number> {
    if (indicators.length === 0) {
      // Return equal distribution if no indicators
      return {
        visual: 0.25,
        auditory: 0.25,
        reading: 0.25,
        kinesthetic: 0.25
      };
    }

    const scores: Record<string, number> = {
      visual: 0,
      auditory: 0,
      reading: 0,
      kinesthetic: 0
    };
    
    // Validate and sanitize indicators
    const validIndicators = indicators.filter(indicator => 
      indicator &&
      typeof indicator.engagementLevel === 'number' &&
      indicator.engagementLevel >= 0 &&
      indicator.engagementLevel <= 100 &&
      indicator.contentType &&
      scores.hasOwnProperty(indicator.contentType)
    );

    if (validIndicators.length === 0) {
      // Return equal distribution if no valid indicators
      return {
        visual: 0.25,
        auditory: 0.25,
        reading: 0.25,
        kinesthetic: 0.25
      };
    }
    
    validIndicators.forEach(indicator => {
      try {
        const weight = this.calculateIndicatorWeight(indicator);
        if (weight > 0 && weight <= 1) { // Validate weight
          scores[indicator.contentType] += indicator.engagementLevel * weight;
        }
      } catch (error) {
        console.warn('Error calculating indicator weight:', error);
      }
    });
    
    // Normalize scores with division by zero protection
    const total = Object.values(scores).reduce((sum, score) => sum + score, 0);
    if (total <= 0) {
      // Return equal distribution if total is zero
      return {
        visual: 0.25,
        auditory: 0.25,
        reading: 0.25,
        kinesthetic: 0.25
      };
    }

    return Object.fromEntries(
      Object.entries(scores).map(([type, score]) => {
        const normalizedScore = score / total;
        return [type, Math.max(0, Math.min(1, normalizedScore))];
      })
    );
  }
  
  private calculateIndicatorWeight(indicator: BehavioralIndicator): number {
    try {
      // Validate input parameters
      const completionRate = Math.max(0, Math.min(100, indicator.completionRate || 0));
      const timeSpent = Math.max(0, indicator.timeSpent || 0);
      
      // Weight based on completion rate and time spent
      const completionWeight = completionRate / 100;
      const timeWeight = Math.min(timeSpent / (this.config.MAX_WEIGHT_TIME_MINUTES * 60), 1); // Cap at configured minutes (in seconds)
      
      // Ensure weights are valid
      if (isNaN(completionWeight) || isNaN(timeWeight)) {
        return this.config.DEFAULT_WEIGHT;
      }
      
      const weight = (completionWeight + timeWeight) / 2;
      return Math.max(this.config.MIN_WEIGHT, Math.min(this.config.MAX_WEIGHT, weight));
    } catch (error) {
      console.warn('Error calculating indicator weight:', error);
      return this.config.DEFAULT_WEIGHT;
    }
  }
  
  /**
   * Generates detailed VARK recommendations for learners
   */
  public generateVARKRecommendations(assessment: StyleAssessment): string[] {
    const varkResults = {
      visual: Math.round(assessment.results.visual * 100),
      auditory: Math.round(assessment.results.auditory * 100),
      reading: Math.round(assessment.results.reading * 100),
      kinesthetic: Math.round(assessment.results.kinesthetic * 100),
      dominantStyle: '',
      isMultimodal: false,
      confidence: Math.round(assessment.confidence * 100),
      totalResponses: assessment.dataPoints
    };
    
    return VARKAssessment.generateRecommendations(varkResults);
  }
  
  private calculateConfidence(dataPoints: number): number {
    if (typeof dataPoints !== 'number' || dataPoints < 0) {
      return 0;
    }
    return Math.min(dataPoints / this.config.MIN_DATA_POINTS, 1);
  }
  
  private assessQuestionnaireConfidence(responses: Record<string, string>): number {
    // Assess confidence based on response consistency and completeness
    const completeness = Object.keys(responses).length / 16; // Assuming 16 questions
    return Math.min(completeness, 1);
  }
  
  private synthesizeStyles(assessments: StyleAssessment[], indicators: BehavioralIndicator[]): LearningStyle[] {
    const behavioralStyles = this.analyzeBehavioralPatterns(indicators);
    const questionnaireStyles = this.extractQuestionnaireStyles(assessments);
    
    return this.mergeStyles(behavioralStyles, questionnaireStyles);
  }
  
  private extractQuestionnaireStyles(assessments: StyleAssessment[]): LearningStyle[] {
    if (assessments.length === 0) return [];
    
    const latestAssessment = assessments[assessments.length - 1];
    return Object.entries(latestAssessment.results).map(([type, score]) => ({
      type: type as LearningStyleType,
      score: Math.round((score as number) * 100),
      confidence: latestAssessment.confidence,
      lastUpdated: latestAssessment.completedAt
    }));
  }
  
  private mergeStyles(styles1: LearningStyle[], styles2: LearningStyle[]): LearningStyle[] {
    const mergedStyles: Record<string, LearningStyle> = {};
    
    // Add styles from first set
    styles1.forEach(style => {
      mergedStyles[style.type] = style;
    });
    
    // Merge or add styles from second set
    styles2.forEach(style => {
      if (mergedStyles[style.type]) {
        // Weighted average based on confidence
        const existing = mergedStyles[style.type];
        const totalConfidence = existing.confidence + style.confidence;
        mergedStyles[style.type] = {
          type: style.type,
          score: Math.round(
            (existing.score * existing.confidence + style.score * style.confidence) / totalConfidence
          ),
          confidence: totalConfidence / 2,
          lastUpdated: new Date()
        };
      } else {
        mergedStyles[style.type] = style;
      }
    });
    
    return Object.values(mergedStyles);
  }
  
  private determineDominantStyle(styles: LearningStyle[]): LearningStyleType {
    return styles.reduce((dominant, current) => 
      current.score > dominant.score ? current : dominant
    ).type;
  }
  
  private isMultimodalLearner(styles: LearningStyle[]): boolean {
    if (!Array.isArray(styles) || styles.length === 0) {
      return false;
    }
    
    const validStyles = styles.filter(style => 
      style && typeof style.score === 'number' && style.score >= 0
    );
    
    const highScores = validStyles.filter(style => style.score > this.config.MULTIMODAL_THRESHOLD);
    return highScores.length > 1;
  }
  
  private calculateAdaptationLevel(indicators: BehavioralIndicator[]): number {
    if (!Array.isArray(indicators) || indicators.length === 0) {
      return 0;
    }
    
    const validIndicators = indicators.filter(indicator => 
      indicator &&
      typeof indicator.engagementLevel === 'number' &&
      typeof indicator.completionRate === 'number' &&
      indicator.engagementLevel >= 0 &&
      indicator.completionRate >= 0
    );

    if (validIndicators.length === 0) {
      return 0;
    }
    
    const avgEngagement = validIndicators.reduce((sum, indicator) => {
      const engagement = Math.max(0, Math.min(100, indicator.engagementLevel));
      return sum + engagement;
    }, 0) / validIndicators.length;
    
    const avgCompletion = validIndicators.reduce((sum, indicator) => {
      const completion = Math.max(0, Math.min(100, indicator.completionRate));
      return sum + completion;
    }, 0) / validIndicators.length;
    
    const adaptationLevel = (avgEngagement + avgCompletion) / 2;
    return Math.round(Math.max(0, Math.min(100, adaptationLevel)));
  }
}

/**
 * Adaptive Pace Management Engine
 * Manages learning pace based on performance and engagement
 */
export class AdaptivePaceManager {
  private readonly OPTIMAL_ACCURACY = 0.8;
  private readonly MIN_PACE = 0.5; // items per hour
  private readonly MAX_PACE = 10; // items per hour
  
  /**
   * Calculates optimal learning pace based on performance metrics
   */
  public calculateOptimalPace(
    currentPerformance: number,
    retentionRate: number,
    fatigueLevel: number
  ): number {
    const performanceAdjustment = this.getPerformanceAdjustment(currentPerformance);
    const retentionAdjustment = this.getRetentionAdjustment(retentionRate);
    const fatigueAdjustment = this.getFatigueAdjustment(fatigueLevel);
    
    const basePace = 3; // items per hour
    const adjustedPace = basePace * performanceAdjustment * retentionAdjustment * fatigueAdjustment;
    
    return Math.max(this.MIN_PACE, Math.min(this.MAX_PACE, adjustedPace));
  }
  
  /**
   * Determines if pace adjustment is needed based on recent performance
   */
  public shouldAdjustPace(
    currentPace: number,
    recentSessions: LearningSession[]
  ): { shouldAdjust: boolean; reason: string; suggestedPace: number } {
    if (recentSessions.length < 3) {
      return { shouldAdjust: false, reason: 'Insufficient data', suggestedPace: currentPace };
    }
    
    const avgAccuracy = this.calculateAverageAccuracy(recentSessions);
    const avgEngagement = this.calculateAverageEngagement(recentSessions);
    const trend = this.calculatePerformanceTrend(recentSessions);
    
    if (avgAccuracy < 0.6) {
      return {
        shouldAdjust: true,
        reason: 'Low accuracy detected',
        suggestedPace: currentPace * 0.8
      };
    }
    
    if (avgAccuracy > 0.9 && avgEngagement > 0.8) {
      return {
        shouldAdjust: true,
        reason: 'High performance detected',
        suggestedPace: currentPace * 1.2
      };
    }
    
    if (trend === 'declining') {
      return {
        shouldAdjust: true,
        reason: 'Performance declining',
        suggestedPace: currentPace * 0.9
      };
    }
    
    return { shouldAdjust: false, reason: 'Performance stable', suggestedPace: currentPace };
  }
  
  /**
   * Creates adaptive changes based on real-time performance
   */
  public createAdaptiveChange(
    sessionData: LearningSession,
    currentPace: number
  ): AdaptiveChange | null {
    const accuracy = sessionData.correctAnswers / sessionData.totalQuestions;
    const engagement = this.calculateSessionEngagement(sessionData);
    
    if (accuracy < 0.5) {
      return {
        timestamp: new Date(),
        changeType: 'pace',
        previousValue: currentPace,
        newValue: currentPace * 0.7,
        reason: 'Low accuracy requiring pace reduction',
        userResponse: 'accepted' // Will be updated based on user interaction
      };
    }
    
    if (engagement < 0.3) {
      return {
        timestamp: new Date(),
        changeType: 'break_suggestion',
        previousValue: 'active',
        newValue: 'break',
        reason: 'Low engagement suggesting fatigue',
        userResponse: 'accepted'
      };
    }
    
    return null;
  }
  
  private getPerformanceAdjustment(accuracy: number): number {
    if (accuracy > 0.9) return 1.3;
    if (accuracy > 0.8) return 1.1;
    if (accuracy > 0.7) return 1.0;
    if (accuracy > 0.6) return 0.9;
    return 0.7;
  }
  
  private getRetentionAdjustment(retentionRate: number): number {
    if (retentionRate > 0.8) return 1.2;
    if (retentionRate > 0.6) return 1.0;
    return 0.8;
  }
  
  private getFatigueAdjustment(fatigueLevel: number): number {
    if (fatigueLevel > 0.8) return 0.7;
    if (fatigueLevel > 0.6) return 0.85;
    if (fatigueLevel > 0.4) return 0.95;
    return 1.0;
  }
  
  private calculateAverageAccuracy(sessions: LearningSession[]): number {
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

    const accuracies = validSessions.map(session => {
      if (session.totalQuestions === 0) {
        return 0;
      }
      return session.correctAnswers / session.totalQuestions;
    });
    
    const sum = accuracies.reduce((sum, acc) => sum + acc, 0);
    return sum / accuracies.length;
  }
  
  private calculateAverageEngagement(sessions: LearningSession[]): number {
    if (!Array.isArray(sessions) || sessions.length === 0) {
      return 0;
    }

    const validSessions = sessions.filter(session => 
      session &&
      session.engagementMetrics &&
      typeof session.engagementMetrics.focusTime === 'number' &&
      typeof session.duration === 'number' &&
      session.duration > 0 &&
      session.engagementMetrics.focusTime >= 0
    );

    if (validSessions.length === 0) {
      return 0;
    }

    const engagements = validSessions.map(session => {
      const focusRatio = session.engagementMetrics.focusTime / session.duration;
      return Math.max(0, Math.min(1, focusRatio)); // Bound between 0 and 1
    });
    
    const sum = engagements.reduce((sum, eng) => sum + eng, 0);
    return sum / engagements.length;
  }
  
  private calculatePerformanceTrend(sessions: LearningSession[]): 'improving' | 'declining' | 'stable' {
    const accuracies = sessions.map(session => 
      session.totalQuestions > 0 ? session.correctAnswers / session.totalQuestions : 0
    );
    
    const firstHalf = accuracies.slice(0, Math.floor(accuracies.length / 2));
    const secondHalf = accuracies.slice(Math.floor(accuracies.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, acc) => sum + acc, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, acc) => sum + acc, 0) / secondHalf.length;
    
    const difference = secondAvg - firstAvg;
    
    if (difference > 0.1) return 'improving';
    if (difference < -0.1) return 'declining';
    return 'stable';
  }
  
  private calculateSessionEngagement(session: LearningSession): number {
    const metrics = session.engagementMetrics;
    const focusRatio = metrics.focusTime / session.duration;
    const interactionScore = Math.min(metrics.interactionRate / 5, 1); // Normalize to 5 interactions per minute
    const attentionScore = Math.max(0, 1 - (metrics.distractionEvents / 10)); // Penalize distractions
    
    return (focusRatio + interactionScore + attentionScore) / 3;
  }
}

/**
 * Content Adaptation Engine
 * Adapts content delivery based on learning style and performance
 */
export class ContentAdaptationEngine {
  /**
   * Selects optimal content variant based on learning profile
   */
  public selectContentVariant(
    variants: ContentVariant[],
    learningProfile: LearningProfile,
    performanceHistory: LearningSession[]
  ): ContentVariant {
    if (variants.length === 1) return variants[0];
    
    const styleScores = this.calculateStyleScores(learningProfile);
    const performanceScores = this.calculatePerformanceScores(variants, performanceHistory);
    
    let bestVariant = variants[0];
    let bestScore = 0;
    
    for (const variant of variants) {
      const styleScore = styleScores[variant.styleType] || 0;
      const performanceScore = performanceScores[variant.styleType] || 0;
      const totalScore = styleScore * 0.7 + performanceScore * 0.3;
      
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestVariant = variant;
      }
    }
    
    return bestVariant;
  }
  
  /**
   * Adapts content difficulty based on recent performance
   */
  public adaptContentDifficulty(
    baseDifficulty: number,
    recentPerformance: LearningSession[]
  ): number {
    if (recentPerformance.length === 0) return baseDifficulty;
    
    const avgAccuracy = recentPerformance.reduce((sum, session) => 
      sum + (session.correctAnswers / session.totalQuestions), 0
    ) / recentPerformance.length;
    
    let adjustment = 0;
    if (avgAccuracy > 0.9) adjustment = 1;
    else if (avgAccuracy > 0.8) adjustment = 0.5;
    else if (avgAccuracy < 0.6) adjustment = -1;
    else if (avgAccuracy < 0.7) adjustment = -0.5;
    
    return Math.max(1, Math.min(10, baseDifficulty + adjustment));
  }
  
  private calculateStyleScores(learningProfile: LearningProfile): Record<string, number> {
    const scores: Record<string, number> = {};
    
    learningProfile.styles.forEach(style => {
      scores[style.type] = (style.score / 100) * style.confidence;
    });
    
    return scores;
  }
  
  private calculatePerformanceScores(
    variants: ContentVariant[],
    performanceHistory: LearningSession[]
  ): Record<string, number> {
    const scores: Record<string, number> = {};
    
    // This would require tracking which variants were used in previous sessions
    // For now, return neutral scores
    variants.forEach(variant => {
      scores[variant.styleType] = 0.5;
    });
    
    return scores;
  }
}

/**
 * Advanced Learning Analytics Engine
 * Integrates all learning components for comprehensive analytics
 */
export class AdvancedLearningEngine {
  private performanceAnalytics: PerformanceAnalyticsEngine;
  private behavioralTracking: BehavioralTrackingEngine;
  private spacedRepetition: SpacedRepetitionEngine;
  private adaptiveAssessment: AdaptiveAssessmentEngine;
  
  constructor() {
    this.performanceAnalytics = new PerformanceAnalyticsEngine();
    this.behavioralTracking = new BehavioralTrackingEngine();
    this.spacedRepetition = new SpacedRepetitionEngine();
    this.adaptiveAssessment = new AdaptiveAssessmentEngine();
  }
  
  /**
   * Comprehensive learning analysis with ML insights
   */
  public async analyzeCompletelearningProfile(
    sessions: LearningSession[],
    learningProfile: LearningProfile,
    behavioralEvents: BehavioralEvent[],
    spacedRepetitionCards: SpacedRepetitionCard[]
  ): Promise<ComprehensiveLearningAnalysis> {
    // Performance analytics
    const performanceMetrics = this.performanceAnalytics.analyzePerformance(
      sessions, 
      learningProfile, 
      learningProfile.behavioralIndicators
    );
    
    // ML insights
    const mlInsights = this.performanceAnalytics.generateMLInsights(
      sessions, 
      learningProfile, 
      sessions // All user sessions for comparison
    );
    
    // Behavioral patterns
    const behavioralPatterns = this.behavioralTracking.detectComplexPatterns(
      behavioralEvents, 
      learningProfile.userId
    );
    
    // Spaced repetition analysis
    const retentionAnalysis = this.spacedRepetition.analyzeRetentionPatterns(
      spacedRepetitionCards
    );
    
    // Anomaly detection
    const anomalyDetection = this.performanceAnalytics.detectAnomalies(
      sessions, 
      learningProfile
    );
    
    return {
      performanceMetrics,
      mlInsights,
      behavioralPatterns,
      retentionAnalysis,
      anomalyDetection,
      generatedAt: new Date(),
      recommendations: this.generateComprehensiveRecommendations(
        performanceMetrics,
        mlInsights,
        behavioralPatterns,
        retentionAnalysis
      )
    };
  }
  
  /**
   * Real-time learning optimization
   */
  public processRealTimeEvent(
    event: BehavioralEvent,
    currentSession: LearningSession
  ): RealTimeOptimization {
    const insights = this.behavioralTracking.processEvent(event);
    const attentionMetrics = this.behavioralTracking.analyzeAttention([event]);
    const engagementMetrics = this.behavioralTracking.measureEngagement(
      [event], 
      currentSession.duration
    );
    
    return {
      insights,
      attentionMetrics,
      engagementMetrics,
      adaptiveActions: this.generateRealTimeActions(insights, attentionMetrics),
      timestamp: new Date()
    };
  }
  
  /**
   * Generates optimal study schedule with spaced repetition
   */
  public generateOptimalStudySchedule(
    spacedRepetitionCards: SpacedRepetitionCard[],
    targetStudyTime: number,
    learningProfile: LearningProfile
  ): StudyScheduleOptimization {
    const schedule = this.spacedRepetition.generateStudySchedule(
      spacedRepetitionCards,
      targetStudyTime,
      learningProfile
    );
    
    const recommendations = this.spacedRepetition.generateReviewRecommendations(
      spacedRepetitionCards,
      learningProfile,
      targetStudyTime
    );
    
    return {
      schedule,
      recommendations,
      estimatedEffectiveness: this.calculateScheduleEffectiveness(schedule),
      adaptiveAdjustments: this.spacedRepetition.adaptiveIntervalOptimization(
        spacedRepetitionCards,
        learningProfile,
        [] // Recent study sessions
      )
    };
  }
  
  private generateComprehensiveRecommendations(
    performanceMetrics: PerformanceMetrics,
    mlInsights: MLInsight[],
    behavioralPatterns: BehavioralPattern[],
    retentionAnalysis: any
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    // Performance-based recommendations
    if (performanceMetrics.accuracy < 70) {
      recommendations.push({
        id: generateUUID(),
        type: 'content',
        title: 'Focus on Accuracy Improvement',
        description: 'Your accuracy could benefit from additional practice on foundational concepts',
        reasoning: `Current accuracy: ${performanceMetrics.accuracy}%`,
        confidence: 85,
        priority: 'high',
        actionRequired: true,
        estimatedImpact: 75,
        createdAt: new Date()
      });
    }
    
    // ML insight-based recommendations
    mlInsights.forEach(insight => {
      insight.actionable_insights.forEach(actionableInsight => {
        recommendations.push({
          id: generateUUID(),
          type: 'style',
          title: 'AI-Powered Learning Optimization',
          description: actionableInsight,
          reasoning: insight.description,
          confidence: Math.round(insight.confidence * 100),
          priority: 'medium',
          actionRequired: false,
          estimatedImpact: 60,
          createdAt: new Date()
        });
      });
    });
    
    // Behavioral pattern recommendations
    behavioralPatterns
      .filter(pattern => pattern.learningImpact.impactType === 'negative')
      .forEach(pattern => {
        recommendations.push({
          id: generateUUID(),
          type: 'pace',
          title: `Address ${pattern.patternType.replace('_', ' ')}`,
          description: pattern.description,
          reasoning: `Detected pattern affecting: ${pattern.learningImpact.affectedAreas.join(', ')}`,
          confidence: Math.round(pattern.confidence * 100),
          priority: pattern.learningImpact.magnitude > 75 ? 'high' : 'medium',
          actionRequired: true,
          estimatedImpact: pattern.learningImpact.magnitude,
          createdAt: new Date()
        });
      });
    
    return recommendations.sort((a, b) => b.estimatedImpact - a.estimatedImpact);
  }
  
  private generateRealTimeActions(insights: RealTimeInsight[], attentionMetrics: any): string[] {
    const actions: string[] = [];
    
    insights.forEach(insight => {
      actions.push(...insight.suggestedActions);
    });
    
    if (attentionMetrics.focusScore < 50) {
      actions.push('Consider taking a short break to restore focus');
    }
    
    if (attentionMetrics.cognitiveLoadEstimate > 80) {
      actions.push('Reduce task complexity to prevent cognitive overload');
    }
    
    return Array.from(new Set(actions)); // Remove duplicates
  }
  
  private calculateScheduleEffectiveness(schedule: RepetitionSchedule[]): number {
    // Calculate effectiveness based on schedule optimization
    const overdueCards = schedule.filter(s => s.priority === 'overdue').length;
    const totalCards = schedule.length;
    
    if (totalCards === 0) return 100;
    
    // Higher effectiveness when fewer overdue cards
    return Math.round((1 - overdueCards / totalCards) * 100);
  }
}

/**
 * Recommendation Engine
 * Generates personalized recommendations based on learning analytics
 */
export class RecommendationEngine {
  /**
   * Generates personalized recommendations based on learning analytics
   */
  public generateRecommendations(analytics: LearningAnalytics): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    // Style-based recommendations
    recommendations.push(...this.generateStyleRecommendations(analytics));
    
    // Pace-based recommendations
    recommendations.push(...this.generatePaceRecommendations(analytics));
    
    // Content recommendations
    recommendations.push(...this.generateContentRecommendations(analytics));
    
    // Schedule recommendations
    recommendations.push(...this.generateScheduleRecommendations(analytics));
    
    return recommendations.sort((a, b) => b.priority.localeCompare(a.priority));
  }
  
  private generateStyleRecommendations(analytics: LearningAnalytics): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    // Find underperforming styles
    const underperformingStyles = analytics.styleEffectiveness.filter(
      style => style.comprehensionScore < 70
    );
    
    underperformingStyles.forEach(style => {
      recommendations.push({
        id: generateUUID(),
        type: 'style',
        title: `Improve ${style.style} Learning Experience`,
        description: `Your ${style.style} learning content shows lower comprehension rates. Consider trying different ${style.style} formats.`,
        reasoning: `Comprehension score: ${style.comprehensionScore}% (target: 70%+)`,
        confidence: 80,
        priority: 'medium',
        actionRequired: false,
        estimatedImpact: 60,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });
    });
    
    return recommendations;
  }
  
  private generatePaceRecommendations(analytics: LearningAnalytics): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    if (analytics.paceAnalysis.paceConsistency < 60) {
      recommendations.push({
        id: generateUUID(),
        type: 'pace',
        title: 'Improve Learning Pace Consistency',
        description: 'Your learning pace varies significantly. Consider setting a regular study schedule.',
        reasoning: `Pace consistency: ${analytics.paceAnalysis.paceConsistency}% (target: 60%+)`,
        confidence: 75,
        priority: 'high',
        actionRequired: true,
        estimatedImpact: 70,
        createdAt: new Date()
      });
    }
    
    return recommendations;
  }
  
  private generateContentRecommendations(analytics: LearningAnalytics): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    // Find content types with low engagement
    const lowEngagementContent = analytics.contentEngagement.filter(
      content => content.engagementScore < 60
    );
    
    if (lowEngagementContent.length > 0) {
      recommendations.push({
        id: generateUUID(),
        type: 'content',
        title: 'Diversify Content Types',
        description: 'Some content types show lower engagement. Try exploring different formats.',
        reasoning: `${lowEngagementContent.length} content types below 60% engagement`,
        confidence: 70,
        priority: 'medium',
        actionRequired: false,
        estimatedImpact: 50,
        createdAt: new Date()
      });
    }
    
    return recommendations;
  }
  
  private generateScheduleRecommendations(analytics: LearningAnalytics): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    if (analytics.paceAnalysis.peakPerformanceTime) {
      recommendations.push({
        id: generateUUID(),
        type: 'schedule',
        title: 'Optimize Study Schedule',
        description: `Your peak performance time is ${analytics.paceAnalysis.peakPerformanceTime}. Consider scheduling challenging content during this time.`,
        reasoning: 'Based on performance analytics',
        confidence: 85,
        priority: 'low',
        actionRequired: false,
        estimatedImpact: 40,
        createdAt: new Date()
      });
    }
    
    return recommendations;
  }
}

// Supporting interfaces for the advanced engine
export interface ComprehensiveLearningAnalysis {
  performanceMetrics: PerformanceMetrics;
  mlInsights: MLInsight[];
  behavioralPatterns: BehavioralPattern[];
  retentionAnalysis: any;
  anomalyDetection: any;
  generatedAt: Date;
  recommendations: Recommendation[];
}

export interface RealTimeOptimization {
  insights: RealTimeInsight[];
  attentionMetrics: any;
  engagementMetrics: any;
  adaptiveActions: string[];
  timestamp: Date;
}

export interface StudyScheduleOptimization {
  schedule: RepetitionSchedule[];
  recommendations: any[];
  estimatedEffectiveness: number;
  adaptiveAdjustments: any[];
}