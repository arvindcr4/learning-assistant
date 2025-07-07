// Behavioral Tracking Engine - Real-time pattern recognition and analysis
import { BehavioralIndicator, LearningStyleType, LearningProfile } from '@/types';
import { generateUUID } from '@/utils/uuid';

export interface BehavioralEvent {
  id: string;
  userId: string;
  sessionId: string;
  eventType: BehavioralEventType;
  timestamp: Date;
  data: EventData;
  context: EventContext;
  processed: boolean;
}

export enum BehavioralEventType {
  MOUSE_MOVEMENT = 'mouse_movement',
  SCROLL_BEHAVIOR = 'scroll_behavior',
  CLICK_PATTERN = 'click_pattern',
  KEYSTROKE_DYNAMICS = 'keystroke_dynamics',
  FOCUS_CHANGE = 'focus_change',
  PAUSE_DURATION = 'pause_duration',
  NAVIGATION_PATTERN = 'navigation_pattern',
  RESPONSE_TIME = 'response_time',
  ERROR_PATTERN = 'error_pattern',
  HELP_SEEKING = 'help_seeking',
  CONTENT_INTERACTION = 'content_interaction',
  REVIEW_BEHAVIOR = 'review_behavior'
}

export interface EventData {
  [key: string]: any;
  coordinates?: { x: number; y: number };
  duration?: number;
  frequency?: number;
  accuracy?: number;
  content_id?: string;
  difficulty_level?: number;
  interaction_depth?: number;
}

export interface EventContext {
  contentType: LearningStyleType;
  currentDifficulty: number;
  sessionDuration: number;
  currentAccuracy: number;
  timeOfDay: string;
  deviceType: 'desktop' | 'tablet' | 'mobile';
  environmentContext: EnvironmentContext;
}

export interface EnvironmentContext {
  isFullscreen: boolean;
  hasNotifications: boolean;
  batteryLevel?: number;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
  ambientNoise?: 'quiet' | 'moderate' | 'noisy';
}

export interface BehavioralPattern {
  id: string;
  userId: string;
  patternType: PatternType;
  description: string;
  confidence: number;
  frequency: number;
  contextConditions: string[];
  indicativeEvents: BehavioralEventType[];
  learningImpact: LearningImpact;
  detectedAt: Date;
  lastSeen: Date;
  strengthTrend: 'increasing' | 'decreasing' | 'stable';
}

export enum PatternType {
  ENGAGEMENT_PATTERN = 'engagement_pattern',
  CONFUSION_PATTERN = 'confusion_pattern',
  MASTERY_PATTERN = 'mastery_pattern',
  FATIGUE_PATTERN = 'fatigue_pattern',
  DISTRACTION_PATTERN = 'distraction_pattern',
  EFFICIENCY_PATTERN = 'efficiency_pattern',
  LEARNING_STYLE_PATTERN = 'learning_style_pattern',
  DIFFICULTY_PREFERENCE = 'difficulty_preference',
  TIME_PREFERENCE = 'time_preference',
  CONTENT_PREFERENCE = 'content_preference'
}

export interface LearningImpact {
  impactType: 'positive' | 'negative' | 'neutral';
  magnitude: number; // 0-100
  affectedAreas: string[];
  recommendedActions: string[];
}

export interface RealTimeInsight {
  type: 'immediate_feedback' | 'intervention_suggestion' | 'pattern_alert' | 'performance_tip';
  message: string;
  confidence: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  suggestedActions: string[];
  triggerEvents: BehavioralEventType[];
  validUntil: Date;
}

export interface AttentionMetrics {
  focusScore: number; // 0-100
  distractionEvents: number;
  averageFocusDuration: number; // seconds
  focusStability: number; // variance in focus periods
  multitaskingIndicators: number;
  cognitiveLoadEstimate: number; // 0-100
}

export interface EngagementMetrics {
  activeInteractionRatio: number; // 0-1
  contentExplorationDepth: number; // 0-100
  voluntaryRevisitCount: number;
  questionAskedCount: number;
  selfInitiatedActivities: number;
  persistenceScore: number; // 0-100
}

export interface MotivationIndicators {
  challengeSeeking: number; // 0-100
  effortInvestment: number; // 0-100
  goalPersistence: number; // 0-100
  curiosityLevel: number; // 0-100
  intrinsicMotivation: number; // 0-100
  extrinsicResponsiveness: number; // 0-100
}

export interface CognitiveLevels {
  remember: number; // Bloom's taxonomy levels 0-100
  understand: number;
  apply: number;
  analyze: number;
  evaluate: number;
  create: number;
  workingMemoryLoad: number;
  processingSpeed: number;
}

export class BehavioralTrackingEngine {
  private eventBuffer: BehavioralEvent[] = [];
  private patternCache: Map<string, BehavioralPattern[]> = new Map();
  private readonly BUFFER_SIZE = 1000;
  private readonly PATTERN_UPDATE_INTERVAL = 30000; // 30 seconds
  private readonly CONFIDENCE_THRESHOLD = 0.7;

  /**
   * Processes real-time behavioral events and updates patterns
   */
  public processEvent(event: BehavioralEvent): RealTimeInsight[] {
    this.eventBuffer.push(event);
    
    // Maintain buffer size
    if (this.eventBuffer.length > this.BUFFER_SIZE) {
      this.eventBuffer.shift();
    }

    // Generate immediate insights
    const insights = this.generateRealTimeInsights(event);
    
    // Update patterns asynchronously
    this.updatePatternsAsync(event);

    return insights;
  }

  /**
   * Analyzes user attention patterns in real-time
   */
  public analyzeAttention(events: BehavioralEvent[], windowSize: number = 60): AttentionMetrics {
    const recentEvents = this.getEventsInWindow(events, windowSize);
    
    const focusEvents = recentEvents.filter(e => 
      e.eventType === BehavioralEventType.FOCUS_CHANGE ||
      e.eventType === BehavioralEventType.CONTENT_INTERACTION
    );

    const distractionEvents = recentEvents.filter(e =>
      e.eventType === BehavioralEventType.FOCUS_CHANGE &&
      e.data.focused === false
    );

    const focusScore = this.calculateFocusScore(focusEvents, windowSize);
    const averageFocusDuration = this.calculateAverageFocusDuration(focusEvents);
    const focusStability = this.calculateFocusStability(focusEvents);
    const multitaskingIndicators = this.detectMultitasking(recentEvents);
    const cognitiveLoadEstimate = this.estimateCognitiveLoad(recentEvents);

    return {
      focusScore,
      distractionEvents: distractionEvents.length,
      averageFocusDuration,
      focusStability,
      multitaskingIndicators,
      cognitiveLoadEstimate
    };
  }

  /**
   * Measures real-time engagement levels
   */
  public measureEngagement(events: BehavioralEvent[], sessionDuration: number): EngagementMetrics {
    const interactionEvents = events.filter(e => 
      e.eventType === BehavioralEventType.CONTENT_INTERACTION ||
      e.eventType === BehavioralEventType.CLICK_PATTERN ||
      e.eventType === BehavioralEventType.SCROLL_BEHAVIOR
    );

    const totalActiveTime = this.calculateActiveTime(events);
    const activeInteractionRatio = totalActiveTime / (sessionDuration * 1000); // Convert to ms

    const explorationEvents = events.filter(e => 
      e.eventType === BehavioralEventType.NAVIGATION_PATTERN &&
      e.data.exploration_type === 'voluntary'
    );

    const contentExplorationDepth = this.calculateExplorationDepth(explorationEvents);
    const voluntaryRevisitCount = this.countVoluntaryRevisits(events);
    const questionAskedCount = this.countQuestions(events);
    const selfInitiatedActivities = this.countSelfInitiated(events);
    const persistenceScore = this.calculatePersistence(events);

    return {
      activeInteractionRatio,
      contentExplorationDepth,
      voluntaryRevisitCount,
      questionAskedCount,
      selfInitiatedActivities,
      persistenceScore
    };
  }

  /**
   * Detects motivation indicators from behavioral patterns
   */
  public detectMotivation(events: BehavioralEvent[], historicalPatterns: BehavioralPattern[]): MotivationIndicators {
    const challengeSeekingEvents = events.filter(e => 
      e.data.difficulty_level && e.data.difficulty_level > e.context.currentDifficulty
    );

    const effortIndicators = events.filter(e => 
      e.eventType === BehavioralEventType.RESPONSE_TIME &&
      e.data.duration > this.getExpectedResponseTime(e.context)
    );

    const persistenceEvents = events.filter(e => 
      e.eventType === BehavioralEventType.ERROR_PATTERN &&
      e.data.retry_count > 0
    );

    const curiosityEvents = events.filter(e => 
      e.eventType === BehavioralEventType.HELP_SEEKING ||
      e.eventType === BehavioralEventType.NAVIGATION_PATTERN &&
      e.data.exploration_type === 'curiosity'
    );

    return {
      challengeSeeking: this.calculateChallengeSeeking(challengeSeekingEvents),
      effortInvestment: this.calculateEffortInvestment(effortIndicators),
      goalPersistence: this.calculateGoalPersistence(persistenceEvents),
      curiosityLevel: this.calculateCuriosity(curiosityEvents),
      intrinsicMotivation: this.calculateIntrinsicMotivation(events),
      extrinsicResponsiveness: this.calculateExtrinsicResponsiveness(events)
    };
  }

  /**
   * Estimates cognitive processing levels using Bloom's taxonomy
   */
  public estimateCognitiveLevels(events: BehavioralEvent[], contentMetadata: any): CognitiveLevels {
    const analysisEvents = events.filter(e => 
      e.eventType === BehavioralEventType.CONTENT_INTERACTION &&
      e.data.interaction_type === 'analysis'
    );

    const applicationEvents = events.filter(e => 
      e.eventType === BehavioralEventType.CONTENT_INTERACTION &&
      e.data.interaction_type === 'application'
    );

    const creationEvents = events.filter(e => 
      e.eventType === BehavioralEventType.CONTENT_INTERACTION &&
      e.data.interaction_type === 'creation'
    );

    const responseTimeEvents = events.filter(e => 
      e.eventType === BehavioralEventType.RESPONSE_TIME
    );

    return {
      remember: this.calculateRememberLevel(events),
      understand: this.calculateUnderstandLevel(events),
      apply: this.calculateApplyLevel(applicationEvents),
      analyze: this.calculateAnalyzeLevel(analysisEvents),
      evaluate: this.calculateEvaluateLevel(events),
      create: this.calculateCreateLevel(creationEvents),
      workingMemoryLoad: this.estimateWorkingMemoryLoad(events),
      processingSpeed: this.calculateProcessingSpeed(responseTimeEvents)
    };
  }

  /**
   * Identifies learning style preferences from behavioral data
   */
  public identifyLearningStylePatterns(events: BehavioralEvent[]): Map<LearningStyleType, number> {
    const stylePreferences = new Map<LearningStyleType, number>();

    // Visual learning indicators
    const visualEvents = events.filter(e => 
      e.eventType === BehavioralEventType.SCROLL_BEHAVIOR ||
      (e.eventType === BehavioralEventType.CONTENT_INTERACTION && 
       e.context.contentType === LearningStyleType.VISUAL)
    );

    // Auditory learning indicators
    const auditoryEvents = events.filter(e => 
      e.context.contentType === LearningStyleType.AUDITORY ||
      e.data.audio_interaction === true
    );

    // Reading/writing learning indicators
    const readingEvents = events.filter(e => 
      e.eventType === BehavioralEventType.KEYSTROKE_DYNAMICS ||
      e.context.contentType === LearningStyleType.READING
    );

    // Kinesthetic learning indicators
    const kinestheticEvents = events.filter(e => 
      e.eventType === BehavioralEventType.CLICK_PATTERN ||
      e.context.contentType === LearningStyleType.KINESTHETIC
    );

    stylePreferences.set(LearningStyleType.VISUAL, this.calculateStyleAffinity(visualEvents, events.length));
    stylePreferences.set(LearningStyleType.AUDITORY, this.calculateStyleAffinity(auditoryEvents, events.length));
    stylePreferences.set(LearningStyleType.READING, this.calculateStyleAffinity(readingEvents, events.length));
    stylePreferences.set(LearningStyleType.KINESTHETIC, this.calculateStyleAffinity(kinestheticEvents, events.length));

    return stylePreferences;
  }

  /**
   * Detects complex behavioral patterns using machine learning techniques
   */
  public detectComplexPatterns(events: BehavioralEvent[], userId: string): BehavioralPattern[] {
    const patterns: BehavioralPattern[] = [];

    // Temporal patterns
    patterns.push(...this.detectTemporalPatterns(events, userId));

    // Sequential patterns
    patterns.push(...this.detectSequentialPatterns(events, userId));

    // Clustering patterns
    patterns.push(...this.detectClusteringPatterns(events, userId));

    // Anomaly patterns
    patterns.push(...this.detectAnomalyPatterns(events, userId));

    return patterns.filter(pattern => pattern.confidence > this.CONFIDENCE_THRESHOLD);
  }

  /**
   * Generates adaptive recommendations based on behavioral patterns
   */
  public generateAdaptiveRecommendations(
    patterns: BehavioralPattern[],
    currentContext: EventContext
  ): AdaptiveRecommendation[] {
    const recommendations: AdaptiveRecommendation[] = [];

    patterns.forEach(pattern => {
      if (pattern.learningImpact.impactType === 'negative') {
        recommendations.push({
          type: 'intervention',
          title: `Address ${pattern.patternType}`,
          description: pattern.description,
          urgency: this.calculateUrgency(pattern),
          actions: pattern.learningImpact.recommendedActions,
          confidenceLevel: pattern.confidence,
          expectedImpact: pattern.learningImpact.magnitude,
          triggerConditions: pattern.contextConditions
        });
      } else if (pattern.learningImpact.impactType === 'positive') {
        recommendations.push({
          type: 'amplification',
          title: `Leverage ${pattern.patternType}`,
          description: `Optimize for ${pattern.description}`,
          urgency: 'low',
          actions: [`Continue current approach for ${pattern.patternType}`],
          confidenceLevel: pattern.confidence,
          expectedImpact: pattern.learningImpact.magnitude,
          triggerConditions: pattern.contextConditions
        });
      }
    });

    return recommendations.sort((a, b) => b.expectedImpact - a.expectedImpact);
  }

  // Private helper methods

  private generateRealTimeInsights(event: BehavioralEvent): RealTimeInsight[] {
    const insights: RealTimeInsight[] = [];

    // Immediate feedback based on event type
    switch (event.eventType) {
      case BehavioralEventType.ERROR_PATTERN:
        if (event.data.consecutive_errors > 2) {
          insights.push({
            type: 'intervention_suggestion',
            message: 'Consider taking a short break or reviewing the material',
            confidence: 0.8,
            urgency: 'medium',
            suggestedActions: ['Take a 5-minute break', 'Review previous concepts', 'Ask for help'],
            triggerEvents: [BehavioralEventType.ERROR_PATTERN],
            validUntil: new Date(Date.now() + 300000) // 5 minutes
          });
        }
        break;

      case BehavioralEventType.PAUSE_DURATION:
        if (event.data.duration > 30000) { // 30 seconds
          insights.push({
            type: 'pattern_alert',
            message: 'Extended pause detected - possible confusion or distraction',
            confidence: 0.7,
            urgency: 'low',
            suggestedActions: ['Provide hint', 'Check understanding', 'Offer alternative explanation'],
            triggerEvents: [BehavioralEventType.PAUSE_DURATION],
            validUntil: new Date(Date.now() + 120000) // 2 minutes
          });
        }
        break;

      case BehavioralEventType.RESPONSE_TIME:
        if (event.data.duration < this.getExpectedResponseTime(event.context) * 0.5) {
          insights.push({
            type: 'performance_tip',
            message: 'Very quick response - excellent mastery!',
            confidence: 0.9,
            urgency: 'low',
            suggestedActions: ['Consider advancing difficulty', 'Try challenge mode'],
            triggerEvents: [BehavioralEventType.RESPONSE_TIME],
            validUntil: new Date(Date.now() + 60000) // 1 minute
          });
        }
        break;
    }

    return insights;
  }

  private updatePatternsAsync(event: BehavioralEvent): void {
    // This would typically be handled by a background process
    setTimeout(() => {
      this.updatePatterns(event);
    }, 0);
  }

  private updatePatterns(event: BehavioralEvent): void {
    const userId = event.userId;
    const existingPatterns = this.patternCache.get(userId) || [];
    
    // Update existing patterns or create new ones
    const updatedPatterns = this.analyzeEventForPatterns(event, existingPatterns);
    
    this.patternCache.set(userId, updatedPatterns);
  }

  private analyzeEventForPatterns(event: BehavioralEvent, existingPatterns: BehavioralPattern[]): BehavioralPattern[] {
    const patterns = [...existingPatterns];

    // Look for patterns in the recent event sequence
    const recentEvents = this.eventBuffer.slice(-50); // Last 50 events
    
    // Check for emerging patterns
    const newPatterns = this.identifyEmergingPatterns(recentEvents, event);
    
    return [...patterns, ...newPatterns];
  }

  private identifyEmergingPatterns(events: BehavioralEvent[], currentEvent: BehavioralEvent): BehavioralPattern[] {
    const patterns: BehavioralPattern[] = [];

    // Pattern: Decreasing response times (mastery)
    const responseTimeEvents = events.filter(e => e.eventType === BehavioralEventType.RESPONSE_TIME);
    if (responseTimeEvents.length >= 5) {
      const times = responseTimeEvents.map(e => e.data.duration);
      const trend = this.calculateTrend(times);
      
      if (trend < -0.1) { // Decreasing trend
        patterns.push({
          id: generateUUID(),
          userId: currentEvent.userId,
          patternType: PatternType.MASTERY_PATTERN,
          description: 'Decreasing response times indicate improving mastery',
          confidence: 0.8,
          frequency: responseTimeEvents.length,
          contextConditions: [`content_type: ${currentEvent.context.contentType}`],
          indicativeEvents: [BehavioralEventType.RESPONSE_TIME],
          learningImpact: {
            impactType: 'positive',
            magnitude: 75,
            affectedAreas: ['efficiency', 'confidence'],
            recommendedActions: ['Increase difficulty', 'Introduce new concepts']
          },
          detectedAt: new Date(),
          lastSeen: new Date(),
          strengthTrend: 'increasing'
        });
      }
    }

    // Pattern: Frequent help-seeking (confusion)
    const helpEvents = events.filter(e => e.eventType === BehavioralEventType.HELP_SEEKING);
    if (helpEvents.length >= 3 && events.length <= 20) { // High frequency
      patterns.push({
        id: generateUUID(),
        userId: currentEvent.userId,
        patternType: PatternType.CONFUSION_PATTERN,
        description: 'Frequent help-seeking indicates confusion or difficulty',
        confidence: 0.85,
        frequency: helpEvents.length,
        contextConditions: [`difficulty: ${currentEvent.context.currentDifficulty}`],
        indicativeEvents: [BehavioralEventType.HELP_SEEKING],
        learningImpact: {
          impactType: 'negative',
          magnitude: 60,
          affectedAreas: ['comprehension', 'confidence'],
          recommendedActions: ['Reduce difficulty', 'Provide additional explanation', 'Offer scaffolding']
        },
        detectedAt: new Date(),
        lastSeen: new Date(),
        strengthTrend: 'increasing'
      });
    }

    return patterns;
  }

  private getEventsInWindow(events: BehavioralEvent[], windowSize: number): BehavioralEvent[] {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowSize * 1000);
    
    return events.filter(event => event.timestamp >= windowStart);
  }

  private calculateFocusScore(focusEvents: BehavioralEvent[], windowSize: number): number {
    if (focusEvents.length === 0) return 0;

    const focusedTime = focusEvents
      .filter(e => e.data.focused === true)
      .reduce((sum, e) => sum + (e.data.duration || 0), 0);

    return Math.min(100, (focusedTime / (windowSize * 1000)) * 100);
  }

  private calculateAverageFocusDuration(focusEvents: BehavioralEvent[]): number {
    const focusedEvents = focusEvents.filter(e => e.data.focused === true);
    
    if (focusedEvents.length === 0) return 0;

    const totalDuration = focusedEvents.reduce((sum, e) => sum + (e.data.duration || 0), 0);
    return totalDuration / focusedEvents.length / 1000; // Convert to seconds
  }

  private calculateFocusStability(focusEvents: BehavioralEvent[]): number {
    const durations = focusEvents
      .filter(e => e.data.focused === true)
      .map(e => e.data.duration || 0);

    if (durations.length < 2) return 0;

    const mean = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / durations.length;
    const standardDeviation = Math.sqrt(variance);

    // Lower variance = higher stability
    return Math.max(0, 100 - (standardDeviation / mean) * 100);
  }

  private detectMultitasking(events: BehavioralEvent[]): number {
    const focusChanges = events.filter(e => e.eventType === BehavioralEventType.FOCUS_CHANGE);
    const rapidSwitches = focusChanges.filter((event, index) => {
      if (index === 0) return false;
      const timeDiff = event.timestamp.getTime() - focusChanges[index - 1].timestamp.getTime();
      return timeDiff < 5000; // Less than 5 seconds between switches
    });

    return rapidSwitches.length;
  }

  private estimateCognitiveLoad(events: BehavioralEvent[]): number {
    // Combine multiple indicators for cognitive load
    const responseTimeEvents = events.filter(e => e.eventType === BehavioralEventType.RESPONSE_TIME);
    const errorEvents = events.filter(e => e.eventType === BehavioralEventType.ERROR_PATTERN);
    const pauseEvents = events.filter(e => e.eventType === BehavioralEventType.PAUSE_DURATION);

    const avgResponseTime = responseTimeEvents.length > 0 
      ? responseTimeEvents.reduce((sum, e) => sum + e.data.duration, 0) / responseTimeEvents.length
      : 0;

    const errorRate = events.length > 0 ? errorEvents.length / events.length : 0;
    const avgPauseTime = pauseEvents.length > 0
      ? pauseEvents.reduce((sum, e) => sum + e.data.duration, 0) / pauseEvents.length
      : 0;

    // Normalize and combine indicators (0-100 scale)
    const timeScore = Math.min(100, (avgResponseTime / 30000) * 100); // 30 seconds = 100
    const errorScore = errorRate * 100;
    const pauseScore = Math.min(100, (avgPauseTime / 60000) * 100); // 60 seconds = 100

    return Math.round((timeScore + errorScore + pauseScore) / 3);
  }

  private calculateActiveTime(events: BehavioralEvent[]): number {
    const interactionEvents = events.filter(e => 
      e.eventType === BehavioralEventType.CONTENT_INTERACTION ||
      e.eventType === BehavioralEventType.CLICK_PATTERN ||
      e.eventType === BehavioralEventType.KEYSTROKE_DYNAMICS
    );

    return interactionEvents.reduce((sum, e) => sum + (e.data.duration || 1000), 0); // Default 1 second per interaction
  }

  private calculateExplorationDepth(explorationEvents: BehavioralEvent[]): number {
    if (explorationEvents.length === 0) return 0;

    const uniqueContent = new Set(explorationEvents.map(e => e.data.content_id));
    const averageDepth = explorationEvents.reduce((sum, e) => sum + (e.data.interaction_depth || 1), 0) / explorationEvents.length;

    return Math.min(100, (uniqueContent.size * averageDepth * 10));
  }

  private countVoluntaryRevisits(events: BehavioralEvent[]): number {
    const revisitEvents = events.filter(e => 
      e.eventType === BehavioralEventType.NAVIGATION_PATTERN &&
      e.data.action === 'revisit' &&
      e.data.voluntary === true
    );

    return revisitEvents.length;
  }

  private countQuestions(events: BehavioralEvent[]): number {
    return events.filter(e => e.eventType === BehavioralEventType.HELP_SEEKING).length;
  }

  private countSelfInitiated(events: BehavioralEvent[]): number {
    return events.filter(e => e.data.self_initiated === true).length;
  }

  private calculatePersistence(events: BehavioralEvent[]): number {
    const errorEvents = events.filter(e => e.eventType === BehavioralEventType.ERROR_PATTERN);
    const retryEvents = errorEvents.filter(e => e.data.retry_count > 0);

    return errorEvents.length > 0 ? (retryEvents.length / errorEvents.length) * 100 : 100;
  }

  private getExpectedResponseTime(context: EventContext): number {
    // Base time adjusted for difficulty and content type
    const baseTime = 10000; // 10 seconds
    const difficultyMultiplier = 1 + (context.currentDifficulty / 10);
    
    return baseTime * difficultyMultiplier;
  }

  private calculateChallengeSeeking(events: BehavioralEvent[]): number {
    if (events.length === 0) return 0;
    return Math.min(100, events.length * 20); // Scale based on frequency
  }

  private calculateEffortInvestment(events: BehavioralEvent[]): number {
    if (events.length === 0) return 0;
    
    const totalExtraTime = events.reduce((sum, e) => {
      const expected = this.getExpectedResponseTime(e.context);
      const actual = e.data.duration;
      return sum + Math.max(0, actual - expected);
    }, 0);

    return Math.min(100, (totalExtraTime / 60000) * 10); // Scale per minute of extra effort
  }

  private calculateGoalPersistence(events: BehavioralEvent[]): number {
    return this.calculatePersistence(events);
  }

  private calculateCuriosity(events: BehavioralEvent[]): number {
    if (events.length === 0) return 0;
    return Math.min(100, events.length * 25); // Scale based on curiosity indicators
  }

  private calculateIntrinsicMotivation(events: BehavioralEvent[]): number {
    const intrinsicIndicators = events.filter(e => 
      e.data.self_initiated === true || 
      e.eventType === BehavioralEventType.HELP_SEEKING ||
      (e.eventType === BehavioralEventType.NAVIGATION_PATTERN && e.data.exploration_type === 'curiosity')
    );

    return events.length > 0 ? (intrinsicIndicators.length / events.length) * 100 : 0;
  }

  private calculateExtrinsicResponsiveness(events: BehavioralEvent[]): number {
    const extrinsicIndicators = events.filter(e => 
      e.data.triggered_by_reward === true ||
      e.data.triggered_by_feedback === true
    );

    return events.length > 0 ? (extrinsicIndicators.length / events.length) * 100 : 0;
  }

  private calculateRememberLevel(events: BehavioralEvent[]): number {
    const recallEvents = events.filter(e => 
      e.data.cognitive_level === 'remember' ||
      e.eventType === BehavioralEventType.RESPONSE_TIME && e.data.duration < 5000
    );

    return events.length > 0 ? (recallEvents.length / events.length) * 100 : 0;
  }

  private calculateUnderstandLevel(events: BehavioralEvent[]): number {
    const understandEvents = events.filter(e => 
      e.data.cognitive_level === 'understand' ||
      (e.eventType === BehavioralEventType.CONTENT_INTERACTION && e.data.interaction_type === 'explanation')
    );

    return events.length > 0 ? (understandEvents.length / events.length) * 100 : 0;
  }

  private calculateApplyLevel(events: BehavioralEvent[]): number {
    return events.length > 0 ? (events.length / 10) * 100 : 0; // Scaled by frequency
  }

  private calculateAnalyzeLevel(events: BehavioralEvent[]): number {
    return events.length > 0 ? (events.length / 5) * 100 : 0; // Scaled by frequency
  }

  private calculateEvaluateLevel(events: BehavioralEvent[]): number {
    const evaluateEvents = events.filter(e => 
      e.data.cognitive_level === 'evaluate' ||
      e.data.comparison_made === true
    );

    return events.length > 0 ? (evaluateEvents.length / events.length) * 100 : 0;
  }

  private calculateCreateLevel(events: BehavioralEvent[]): number {
    return events.length > 0 ? (events.length / 3) * 100 : 0; // Scaled by frequency
  }

  private estimateWorkingMemoryLoad(events: BehavioralEvent[]): number {
    const complexEvents = events.filter(e => 
      e.context.currentDifficulty > 6 ||
      e.data.multistep_process === true
    );

    return events.length > 0 ? (complexEvents.length / events.length) * 100 : 0;
  }

  private calculateProcessingSpeed(events: BehavioralEvent[]): number {
    if (events.length === 0) return 0;

    const avgResponseTime = events.reduce((sum, e) => sum + e.data.duration, 0) / events.length;
    
    // Faster response = higher processing speed (inverse relationship)
    const normalizedSpeed = Math.max(0, 100 - (avgResponseTime / 1000)); // Normalize to 0-100
    
    return Math.min(100, normalizedSpeed);
  }

  private calculateStyleAffinity(styleEvents: BehavioralEvent[], totalEvents: number): number {
    if (totalEvents === 0) return 0;

    const affinityScore = (styleEvents.length / totalEvents) * 100;
    
    // Weight by engagement quality
    const avgEngagement = styleEvents.length > 0 
      ? styleEvents.reduce((sum, e) => sum + (e.data.engagement_score || 50), 0) / styleEvents.length
      : 50;

    return Math.round((affinityScore + avgEngagement) / 2);
  }

  private detectTemporalPatterns(events: BehavioralEvent[], userId: string): BehavioralPattern[] {
    // Analyze time-based patterns (e.g., performance by time of day)
    const patterns: BehavioralPattern[] = [];

    const hourlyPerformance = new Map<number, number[]>();
    events.forEach(event => {
      const hour = event.timestamp.getHours();
      const performance = event.data.accuracy || event.context.currentAccuracy || 0;
      
      if (!hourlyPerformance.has(hour)) {
        hourlyPerformance.set(hour, []);
      }
      hourlyPerformance.get(hour)!.push(performance);
    });

    // Find peak performance hours
    let bestHour = -1;
    let bestAverage = 0;

    hourlyPerformance.forEach((performances, hour) => {
      if (performances.length >= 3) {
        const average = performances.reduce((sum, p) => sum + p, 0) / performances.length;
        if (average > bestAverage) {
          bestAverage = average;
          bestHour = hour;
        }
      }
    });

    if (bestHour !== -1) {
      patterns.push({
        id: generateUUID(),
        userId,
        patternType: PatternType.TIME_PREFERENCE,
        description: `Peak performance observed at ${bestHour}:00`,
        confidence: 0.8,
        frequency: hourlyPerformance.get(bestHour)!.length,
        contextConditions: [`time_of_day: ${bestHour}`],
        indicativeEvents: [BehavioralEventType.RESPONSE_TIME],
        learningImpact: {
          impactType: 'positive',
          magnitude: 70,
          affectedAreas: ['performance', 'efficiency'],
          recommendedActions: [`Schedule challenging content around ${bestHour}:00`]
        },
        detectedAt: new Date(),
        lastSeen: new Date(),
        strengthTrend: 'stable'
      });
    }

    return patterns;
  }

  private detectSequentialPatterns(events: BehavioralEvent[], userId: string): BehavioralPattern[] {
    // Analyze sequential event patterns
    const patterns: BehavioralPattern[] = [];

    // Look for error -> help -> success sequences
    for (let i = 0; i < events.length - 2; i++) {
      if (events[i].eventType === BehavioralEventType.ERROR_PATTERN &&
          events[i + 1].eventType === BehavioralEventType.HELP_SEEKING &&
          events[i + 2].data.success === true) {
        
        patterns.push({
          id: generateUUID(),
          userId,
          patternType: PatternType.EFFICIENCY_PATTERN,
          description: 'Effective help-seeking after errors leads to success',
          confidence: 0.85,
          frequency: 1,
          contextConditions: ['after_error'],
          indicativeEvents: [BehavioralEventType.ERROR_PATTERN, BehavioralEventType.HELP_SEEKING],
          learningImpact: {
            impactType: 'positive',
            magnitude: 80,
            affectedAreas: ['problem_solving', 'self_regulation'],
            recommendedActions: ['Encourage help-seeking', 'Provide accessible help resources']
          },
          detectedAt: new Date(),
          lastSeen: new Date(),
          strengthTrend: 'increasing'
        });
      }
    }

    return patterns;
  }

  private detectClusteringPatterns(events: BehavioralEvent[], userId: string): BehavioralPattern[] {
    // This would implement clustering algorithms to find behavioral clusters
    return [];
  }

  private detectAnomalyPatterns(events: BehavioralEvent[], userId: string): BehavioralPattern[] {
    // Detect unusual behavioral patterns
    const patterns: BehavioralPattern[] = [];

    // Check for sudden performance drops
    const recentEvents = events.slice(-20);
    const olderEvents = events.slice(-40, -20);

    if (recentEvents.length >= 10 && olderEvents.length >= 10) {
      const recentAccuracy = recentEvents.reduce((sum, e) => sum + (e.data.accuracy || e.context.currentAccuracy || 0), 0) / recentEvents.length;
      const olderAccuracy = olderEvents.reduce((sum, e) => sum + (e.data.accuracy || e.context.currentAccuracy || 0), 0) / olderEvents.length;

      if (recentAccuracy < olderAccuracy * 0.8) {
        patterns.push({
          id: generateUUID(),
          userId,
          patternType: PatternType.FATIGUE_PATTERN,
          description: 'Significant performance drop detected',
          confidence: 0.9,
          frequency: 1,
          contextConditions: ['recent_performance_drop'],
          indicativeEvents: [BehavioralEventType.ERROR_PATTERN, BehavioralEventType.RESPONSE_TIME],
          learningImpact: {
            impactType: 'negative',
            magnitude: 85,
            affectedAreas: ['accuracy', 'confidence'],
            recommendedActions: ['Suggest break', 'Reduce difficulty', 'Check for external factors']
          },
          detectedAt: new Date(),
          lastSeen: new Date(),
          strengthTrend: 'increasing'
        });
      }
    }

    return patterns;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, index) => sum + val * index, 0);
    const sumXX = values.reduce((sum, val, index) => sum + index * index, 0);

    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  private calculateUrgency(pattern: BehavioralPattern): 'low' | 'medium' | 'high' {
    if (pattern.learningImpact.magnitude > 80) return 'high';
    if (pattern.learningImpact.magnitude > 60) return 'medium';
    return 'low';
  }
}

// Supporting interfaces
export interface AdaptiveRecommendation {
  type: 'intervention' | 'amplification' | 'optimization';
  title: string;
  description: string;
  urgency: 'low' | 'medium' | 'high';
  actions: string[];
  confidenceLevel: number;
  expectedImpact: number;
  triggerConditions: string[];
}