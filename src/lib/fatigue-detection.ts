// Fatigue Detection and Break Recommendation Engine
import { LearningSession, BehavioralIndicator } from '@/types';
import { BehavioralEvent } from './behavioral-tracking';

export interface FatigueIndicators {
  performanceDecline: number; // 0-100
  responseTimeIncrease: number; // 0-100
  errorRateIncrease: number; // 0-100
  attentionDecline: number; // 0-100
  motivationDrop: number; // 0-100
  physicalSigns: number; // 0-100
  overallFatigueLevel: number; // 0-100
}

export interface FatiguePattern {
  id: string;
  userId: string;
  patternType: 'cognitive' | 'physical' | 'emotional' | 'mixed';
  onsetTime: number; // minutes into session
  duration: number; // minutes
  severity: 'mild' | 'moderate' | 'severe';
  triggerFactors: string[];
  recoveryTime: number; // estimated minutes needed
  detectedAt: Date;
}

export interface BreakRecommendation {
  id: string;
  type: 'micro' | 'short' | 'long' | 'extended';
  duration: number; // minutes
  urgency: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  activities: BreakActivity[];
  timing: 'immediate' | 'after_current_task' | 'scheduled';
  expectedBenefit: string;
  confidence: number;
}

export interface BreakActivity {
  activity: string;
  duration: number; // minutes
  category: 'physical' | 'mental' | 'visual' | 'social';
  description: string;
  restorative_value: number; // 0-100
}

export interface RecoveryMetrics {
  preBreakFatigue: number;
  postBreakFatigue: number;
  recoveryEffectiveness: number;
  timeToFullRecovery: number;
  residualFatigue: number;
}

export interface CircadianPattern {
  peakAlertnessPeriods: TimeWindow[];
  lowAlertnessPeriods: TimeWindow[];
  optimalStudyWindows: TimeWindow[];
  naturalBreakPoints: number[]; // hours of day
  energyPattern: EnergyLevel[];
}

export interface TimeWindow {
  startHour: number;
  endHour: number;
  intensity: number; // 0-100
  confidence: number;
}

export interface EnergyLevel {
  hour: number;
  energyScore: number; // 0-100
  consistency: number; // 0-100
  dataPoints: number;
}

export class FatigueDetectionEngine {
  private readonly FATIGUE_THRESHOLD = 60;
  private readonly PERFORMANCE_DECLINE_THRESHOLD = 0.15;
  private readonly RESPONSE_TIME_INCREASE_THRESHOLD = 1.5;
  private readonly ERROR_RATE_INCREASE_THRESHOLD = 2.0;

  /**
   * Analyzes multiple indicators to detect fatigue levels
   */
  public detectFatigue(
    currentSession: LearningSession,
    recentSessions: LearningSession[],
    behavioralEvents: BehavioralEvent[]
  ): FatigueIndicators {
    const performanceDecline = this.analyzePerformanceDecline(currentSession, recentSessions);
    const responseTimeIncrease = this.analyzeResponseTimeIncrease(currentSession, recentSessions);
    const errorRateIncrease = this.analyzeErrorRateIncrease(currentSession, recentSessions);
    const attentionDecline = this.analyzeAttentionDecline(behavioralEvents);
    const motivationDrop = this.analyzeMotivationDrop(behavioralEvents);
    const physicalSigns = this.analyzePhysicalSigns(behavioralEvents);

    const overallFatigueLevel = this.calculateOverallFatigue([
      performanceDecline,
      responseTimeIncrease,
      errorRateIncrease,
      attentionDecline,
      motivationDrop,
      physicalSigns
    ]);

    return {
      performanceDecline,
      responseTimeIncrease,
      errorRateIncrease,
      attentionDecline,
      motivationDrop,
      physicalSigns,
      overallFatigueLevel
    };
  }

  /**
   * Identifies fatigue patterns for proactive intervention
   */
  public identifyFatiguePatterns(
    sessions: LearningSession[],
    userId: string
  ): FatiguePattern[] {
    const patterns: FatiguePattern[] = [];

    // Analyze session-based patterns
    const sessionPatterns = this.analyzeSessionBasedPatterns(sessions, userId);
    patterns.push(...sessionPatterns);

    // Analyze time-based patterns
    const timePatterns = this.analyzeTimeBasedPatterns(sessions, userId);
    patterns.push(...timePatterns);

    // Analyze workload patterns
    const workloadPatterns = this.analyzeWorkloadPatterns(sessions, userId);
    patterns.push(...workloadPatterns);

    return patterns;
  }

  /**
   * Generates personalized break recommendations
   */
  public generateBreakRecommendations(
    fatigueIndicators: FatigueIndicators,
    currentSessionDuration: number,
    userPreferences?: BreakPreferences
  ): BreakRecommendation[] {
    const recommendations: BreakRecommendation[] = [];

    if (fatigueIndicators.overallFatigueLevel >= 80) {
      // Critical fatigue - extended break needed
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'extended',
        duration: 30,
        urgency: 'critical',
        reason: 'Severe fatigue detected - extended recovery needed',
        activities: this.getExtendedBreakActivities(),
        timing: 'immediate',
        expectedBenefit: 'Full cognitive restoration',
        confidence: 0.9
      });
    } else if (fatigueIndicators.overallFatigueLevel >= 60) {
      // Moderate fatigue - long break
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'long',
        duration: 15,
        urgency: 'high',
        reason: 'Moderate fatigue - significant break needed',
        activities: this.getLongBreakActivities(),
        timing: 'after_current_task',
        expectedBenefit: 'Substantial cognitive recovery',
        confidence: 0.8
      });
    } else if (fatigueIndicators.overallFatigueLevel >= 40) {
      // Mild fatigue - short break
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'short',
        duration: 5,
        urgency: 'medium',
        reason: 'Early fatigue signs - preventive break',
        activities: this.getShortBreakActivities(),
        timing: 'after_current_task',
        expectedBenefit: 'Prevent fatigue accumulation',
        confidence: 0.7
      });
    }

    // Micro-breaks for long sessions
    if (currentSessionDuration > 25 && fatigueIndicators.attentionDecline > 30) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'micro',
        duration: 2,
        urgency: 'low',
        reason: 'Long session - attention maintenance',
        activities: this.getMicroBreakActivities(),
        timing: 'immediate',
        expectedBenefit: 'Maintain attention and focus',
        confidence: 0.6
      });
    }

    return recommendations.sort((a, b) => {
      const urgencyOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
      return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
    });
  }

  /**
   * Analyzes circadian patterns to optimize study timing
   */
  public analyzeCircadianPatterns(
    sessions: LearningSession[],
    behavioralIndicators: BehavioralIndicator[]
  ): CircadianPattern {
    const hourlyPerformance = this.calculateHourlyPerformance(sessions);
    const hourlyEnergy = this.calculateHourlyEnergy(behavioralIndicators);

    const peakAlertnessPeriods = this.identifyPeakPeriods(hourlyPerformance);
    const lowAlertnessPeriods = this.identifyLowPeriods(hourlyPerformance);
    const optimalStudyWindows = this.identifyOptimalWindows(hourlyPerformance, hourlyEnergy);
    const naturalBreakPoints = this.identifyNaturalBreakPoints(hourlyEnergy);

    return {
      peakAlertnessPeriods,
      lowAlertnessPeriods,
      optimalStudyWindows,
      naturalBreakPoints,
      energyPattern: hourlyEnergy
    };
  }

  /**
   * Tracks recovery effectiveness from breaks
   */
  public trackRecoveryEffectiveness(
    preBreakFatigue: FatigueIndicators,
    postBreakFatigue: FatigueIndicators,
    breakDuration: number,
    breakActivities: BreakActivity[]
  ): RecoveryMetrics {
    const fatigueReduction = preBreakFatigue.overallFatigueLevel - postBreakFatigue.overallFatigueLevel;
    const recoveryEffectiveness = Math.max(0, (fatigueReduction / preBreakFatigue.overallFatigueLevel) * 100);

    const timeToFullRecovery = this.estimateFullRecoveryTime(
      postBreakFatigue.overallFatigueLevel,
      recoveryEffectiveness
    );

    return {
      preBreakFatigue: preBreakFatigue.overallFatigueLevel,
      postBreakFatigue: postBreakFatigue.overallFatigueLevel,
      recoveryEffectiveness,
      timeToFullRecovery,
      residualFatigue: Math.max(0, postBreakFatigue.overallFatigueLevel)
    };
  }

  // Private helper methods

  private analyzePerformanceDecline(
    currentSession: LearningSession,
    recentSessions: LearningSession[]
  ): number {
    if (recentSessions.length === 0) return 0;

    const currentAccuracy = currentSession.totalQuestions > 0 
      ? currentSession.correctAnswers / currentSession.totalQuestions 
      : 0;

    const baselineAccuracy = recentSessions.reduce((sum, session) => 
      sum + (session.totalQuestions > 0 ? session.correctAnswers / session.totalQuestions : 0), 0
    ) / recentSessions.length;

    if (baselineAccuracy === 0) return 0;

    const decline = (baselineAccuracy - currentAccuracy) / baselineAccuracy;
    return Math.max(0, Math.min(100, decline * 100));
  }

  private analyzeResponseTimeIncrease(
    currentSession: LearningSession,
    recentSessions: LearningSession[]
  ): number {
    if (recentSessions.length === 0) return 0;

    // This would need response time data from sessions
    // For now, estimate based on engagement metrics
    const currentEngagement = currentSession.engagementMetrics.focusTime / currentSession.duration;
    const baselineEngagement = recentSessions.reduce((sum, session) => 
      sum + (session.engagementMetrics.focusTime / session.duration), 0
    ) / recentSessions.length;

    if (baselineEngagement === 0) return 0;

    // Lower engagement often correlates with slower response times
    const engagementDecline = (baselineEngagement - currentEngagement) / baselineEngagement;
    return Math.max(0, Math.min(100, engagementDecline * 100));
  }

  private analyzeErrorRateIncrease(
    currentSession: LearningSession,
    recentSessions: LearningSession[]
  ): number {
    if (recentSessions.length === 0) return 0;

    const currentErrorRate = currentSession.totalQuestions > 0 
      ? (currentSession.totalQuestions - currentSession.correctAnswers) / currentSession.totalQuestions 
      : 0;

    const baselineErrorRate = recentSessions.reduce((sum, session) => 
      sum + (session.totalQuestions > 0 ? 
        (session.totalQuestions - session.correctAnswers) / session.totalQuestions : 0), 0
    ) / recentSessions.length;

    if (baselineErrorRate === 0) return currentErrorRate > 0 ? 100 : 0;

    const increase = (currentErrorRate - baselineErrorRate) / baselineErrorRate;
    return Math.max(0, Math.min(100, increase * 100));
  }

  private analyzeAttentionDecline(behavioralEvents: BehavioralEvent[]): number {
    const focusEvents = behavioralEvents.filter(e => e.eventType === 'focus_change');
    const distractionEvents = focusEvents.filter(e => e.data && e.data.focused === false);

    if (focusEvents.length === 0) return 0;

    const distractionRate = distractionEvents.length / focusEvents.length;
    return Math.min(100, distractionRate * 100);
  }

  private analyzeMotivationDrop(behavioralEvents: BehavioralEvent[]): number {
    const helpSeekingEvents = behavioralEvents.filter(e => e.eventType === 'help_seeking');
    const interactionEvents = behavioralEvents.filter(e => e.eventType === 'content_interaction');

    // Declining motivation often shows as reduced help-seeking and interactions
    if (behavioralEvents.length === 0) return 0;

    const engagementRate = (helpSeekingEvents.length + interactionEvents.length) / behavioralEvents.length;
    const motivationScore = Math.max(0, 100 - engagementRate * 200); // Inverse relationship

    return Math.min(100, motivationScore);
  }

  private analyzePhysicalSigns(behavioralEvents: BehavioralEvent[]): number {
    // Look for physical indicators in behavioral data
    const longPauses = behavioralEvents.filter(e => 
      e.eventType === 'pause_duration' && e.data && e.data.duration && e.data.duration > 10000 // 10+ seconds
    );

    const slowMouseMovements = behavioralEvents.filter(e => 
      e.eventType === 'mouse_movement' && e.data && e.data.speed && e.data.speed < 50 // Slow movement
    );

    if (behavioralEvents.length === 0) return 0;

    const physicalIndicatorRate = (longPauses.length + slowMouseMovements.length) / behavioralEvents.length;
    return Math.min(100, physicalIndicatorRate * 150);
  }

  private calculateOverallFatigue(indicators: number[]): number {
    // Weighted average with emphasis on performance and attention
    const weights = [0.25, 0.2, 0.2, 0.2, 0.1, 0.05]; // Performance, response time, errors, attention, motivation, physical
    
    let weightedSum = 0;
    let totalWeight = 0;

    indicators.forEach((indicator, index) => {
      if (index < weights.length) {
        weightedSum += indicator * weights[index];
        totalWeight += weights[index];
      }
    });

    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  }

  private analyzeSessionBasedPatterns(sessions: LearningSession[], userId: string): FatiguePattern[] {
    const patterns: FatiguePattern[] = [];

    // Look for patterns within sessions
    sessions.forEach(session => {
      if (session.duration > 45) { // Long sessions
        const fatigueOnset = this.estimateFatigueOnset(session);
        
        if (fatigueOnset > 0) {
          patterns.push({
            id: crypto.randomUUID(),
            userId,
            patternType: 'cognitive',
            onsetTime: fatigueOnset,
            duration: session.duration - fatigueOnset,
            severity: this.calculateSeverity(session),
            triggerFactors: ['long_session_duration'],
            recoveryTime: this.estimateRecoveryTime(session),
            detectedAt: new Date()
          });
        }
      }
    });

    return patterns;
  }

  private analyzeTimeBasedPatterns(sessions: LearningSession[], userId: string): FatiguePattern[] {
    const patterns: FatiguePattern[] = [];

    // Group sessions by hour of day
    const hourlyPerformance = new Map<number, number[]>();
    
    sessions.forEach(session => {
      const hour = session.startTime.getHours();
      const accuracy = session.totalQuestions > 0 ? session.correctAnswers / session.totalQuestions : 0;
      
      if (!hourlyPerformance.has(hour)) {
        hourlyPerformance.set(hour, []);
      }
      hourlyPerformance.get(hour)!.push(accuracy);
    });

    // Identify low-performance time periods
    hourlyPerformance.forEach((accuracies, hour) => {
      if (accuracies.length >= 3) {
        const avgAccuracy = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
        
        if (avgAccuracy < 0.6) { // Low performance threshold
          patterns.push({
            id: crypto.randomUUID(),
            userId,
            patternType: 'mixed',
            onsetTime: hour * 60, // Convert to minutes
            duration: 60, // 1 hour window
            severity: avgAccuracy < 0.4 ? 'severe' : 'moderate',
            triggerFactors: ['circadian_low'],
            recoveryTime: 15,
            detectedAt: new Date()
          });
        }
      }
    });

    return patterns;
  }

  private analyzeWorkloadPatterns(sessions: LearningSession[], userId: string): FatiguePattern[] {
    const patterns: FatiguePattern[] = [];

    // Analyze consecutive session impacts
    for (let i = 1; i < sessions.length; i++) {
      const currentSession = sessions[i];
      const previousSession = sessions[i - 1];
      
      const currentAccuracy = currentSession.totalQuestions > 0 
        ? currentSession.correctAnswers / currentSession.totalQuestions 
        : 0;
      const previousAccuracy = previousSession.totalQuestions > 0 
        ? previousSession.correctAnswers / previousSession.totalQuestions 
        : 0;

      // Check for cumulative fatigue
      if (currentAccuracy < previousAccuracy * 0.8) {
        patterns.push({
          id: crypto.randomUUID(),
          userId,
          patternType: 'cognitive',
          onsetTime: 0,
          duration: currentSession.duration,
          severity: 'moderate',
          triggerFactors: ['cumulative_workload'],
          recoveryTime: 20,
          detectedAt: new Date()
        });
      }
    }

    return patterns;
  }

  private getMicroBreakActivities(): BreakActivity[] {
    return [
      {
        activity: 'Deep breathing (30 seconds)',
        duration: 0.5,
        category: 'physical',
        description: 'Take 5 deep breaths to reset focus',
        restorative_value: 30
      },
      {
        activity: 'Eye movement exercises',
        duration: 1,
        category: 'visual',
        description: 'Look away from screen and focus on distant objects',
        restorative_value: 40
      },
      {
        activity: 'Neck and shoulder stretch',
        duration: 0.5,
        category: 'physical',
        description: 'Simple stretches to relieve tension',
        restorative_value: 35
      }
    ];
  }

  private getShortBreakActivities(): BreakActivity[] {
    return [
      {
        activity: 'Walk around',
        duration: 3,
        category: 'physical',
        description: 'Light physical movement to boost circulation',
        restorative_value: 60
      },
      {
        activity: 'Hydration break',
        duration: 1,
        category: 'physical',
        description: 'Drink water and do light stretching',
        restorative_value: 45
      },
      {
        activity: 'Mindfulness moment',
        duration: 2,
        category: 'mental',
        description: 'Brief meditation or mindful observation',
        restorative_value: 55
      }
    ];
  }

  private getLongBreakActivities(): BreakActivity[] {
    return [
      {
        activity: 'Physical exercise',
        duration: 10,
        category: 'physical',
        description: 'Light exercise or yoga to re-energize',
        restorative_value: 80
      },
      {
        activity: 'Social interaction',
        duration: 5,
        category: 'social',
        description: 'Brief conversation or call with friend/family',
        restorative_value: 70
      },
      {
        activity: 'Nature exposure',
        duration: 10,
        category: 'mental',
        description: 'Step outside or look at nature scenes',
        restorative_value: 75
      },
      {
        activity: 'Snack and hydration',
        duration: 5,
        category: 'physical',
        description: 'Healthy snack and proper hydration',
        restorative_value: 65
      }
    ];
  }

  private getExtendedBreakActivities(): BreakActivity[] {
    return [
      {
        activity: 'Complete rest',
        duration: 15,
        category: 'physical',
        description: 'Lie down or sit comfortably without stimulation',
        restorative_value: 90
      },
      {
        activity: 'Nap (if appropriate)',
        duration: 20,
        category: 'physical',
        description: 'Power nap to restore cognitive function',
        restorative_value: 95
      },
      {
        activity: 'Meal break',
        duration: 20,
        category: 'physical',
        description: 'Proper meal to restore energy levels',
        restorative_value: 85
      },
      {
        activity: 'Exercise session',
        duration: 25,
        category: 'physical',
        description: 'Moderate exercise to reset energy',
        restorative_value: 88
      }
    ];
  }

  private calculateHourlyPerformance(sessions: LearningSession[]): EnergyLevel[] {
    const hourlyData = new Map<number, number[]>();

    sessions.forEach(session => {
      const hour = session.startTime.getHours();
      const accuracy = session.totalQuestions > 0 ? session.correctAnswers / session.totalQuestions : 0;
      
      if (!hourlyData.has(hour)) {
        hourlyData.set(hour, []);
      }
      hourlyData.get(hour)!.push(accuracy * 100);
    });

    const energyLevels: EnergyLevel[] = [];

    for (let hour = 0; hour < 24; hour++) {
      const data = hourlyData.get(hour) || [];
      const energyScore = data.length > 0 
        ? data.reduce((sum, score) => sum + score, 0) / data.length
        : 0;
      
      const consistency = data.length > 1 
        ? 100 - this.calculateStandardDeviation(data)
        : 0;

      energyLevels.push({
        hour,
        energyScore,
        consistency,
        dataPoints: data.length
      });
    }

    return energyLevels;
  }

  private calculateHourlyEnergy(behavioralIndicators: BehavioralIndicator[]): EnergyLevel[] {
    const hourlyEngagement = new Map<number, number[]>();

    behavioralIndicators.forEach(indicator => {
      const hour = indicator.timestamp.getHours();
      
      if (!hourlyEngagement.has(hour)) {
        hourlyEngagement.set(hour, []);
      }
      hourlyEngagement.get(hour)!.push(indicator.engagementLevel);
    });

    const energyLevels: EnergyLevel[] = [];

    for (let hour = 0; hour < 24; hour++) {
      const data = hourlyEngagement.get(hour) || [];
      const energyScore = data.length > 0 
        ? data.reduce((sum, score) => sum + score, 0) / data.length
        : 0;
      
      const consistency = data.length > 1 
        ? 100 - this.calculateStandardDeviation(data)
        : 0;

      energyLevels.push({
        hour,
        energyScore,
        consistency,
        dataPoints: data.length
      });
    }

    return energyLevels;
  }

  private identifyPeakPeriods(energyLevels: EnergyLevel[]): TimeWindow[] {
    const threshold = 70; // Energy score threshold for peak periods
    const peaks: TimeWindow[] = [];

    let startHour = -1;

    energyLevels.forEach((level, index) => {
      if (level.energyScore >= threshold && level.dataPoints >= 3) {
        if (startHour === -1) {
          startHour = level.hour;
        }
      } else {
        if (startHour !== -1) {
          peaks.push({
            startHour,
            endHour: level.hour - 1,
            intensity: level.energyScore,
            confidence: level.consistency / 100
          });
          startHour = -1;
        }
      }
    });

    return peaks;
  }

  private identifyLowPeriods(energyLevels: EnergyLevel[]): TimeWindow[] {
    const threshold = 40; // Energy score threshold for low periods
    const lows: TimeWindow[] = [];

    energyLevels.forEach(level => {
      if (level.energyScore <= threshold && level.dataPoints >= 3) {
        lows.push({
          startHour: level.hour,
          endHour: level.hour,
          intensity: level.energyScore,
          confidence: level.consistency / 100
        });
      }
    });

    return lows;
  }

  private identifyOptimalWindows(
    performance: EnergyLevel[],
    energy: EnergyLevel[]
  ): TimeWindow[] {
    const windows: TimeWindow[] = [];

    performance.forEach((perfLevel, index) => {
      const energyLevel = energy[index];
      
      if (perfLevel.energyScore >= 65 && energyLevel.energyScore >= 65 &&
          perfLevel.dataPoints >= 3 && energyLevel.dataPoints >= 3) {
        
        const combinedScore = (perfLevel.energyScore + energyLevel.energyScore) / 2;
        const combinedConfidence = (perfLevel.consistency + energyLevel.consistency) / 200;

        windows.push({
          startHour: perfLevel.hour,
          endHour: perfLevel.hour,
          intensity: combinedScore,
          confidence: combinedConfidence
        });
      }
    });

    return windows;
  }

  private identifyNaturalBreakPoints(energyLevels: EnergyLevel[]): number[] {
    const breakPoints: number[] = [];

    for (let i = 1; i < energyLevels.length - 1; i++) {
      const prev = energyLevels[i - 1];
      const current = energyLevels[i];
      const next = energyLevels[i + 1];

      // Look for energy dips (local minima)
      if (current.energyScore < prev.energyScore && current.energyScore < next.energyScore) {
        breakPoints.push(current.hour);
      }
    }

    return breakPoints;
  }

  private estimateFatigueOnset(session: LearningSession): number {
    // Estimate when fatigue likely started based on session metrics
    const engagementDecline = session.engagementMetrics.focusTime / session.duration;
    
    if (engagementDecline < 0.6) {
      return Math.round(session.duration * 0.6); // Estimate 60% through session
    }
    
    return 0; // No clear fatigue onset
  }

  private calculateSeverity(session: LearningSession): 'mild' | 'moderate' | 'severe' {
    const accuracy = session.totalQuestions > 0 ? session.correctAnswers / session.totalQuestions : 0;
    const engagement = session.engagementMetrics.focusTime / session.duration;

    if (accuracy < 0.5 || engagement < 0.4) return 'severe';
    if (accuracy < 0.7 || engagement < 0.6) return 'moderate';
    return 'mild';
  }

  private estimateRecoveryTime(session: LearningSession): number {
    const severity = this.calculateSeverity(session);
    
    switch (severity) {
      case 'severe': return 30;
      case 'moderate': return 15;
      case 'mild': return 10;
      default: return 5;
    }
  }

  private estimateFullRecoveryTime(currentFatigue: number, recoveryRate: number): number {
    if (recoveryRate <= 0) return 60; // Default if no recovery detected
    
    return Math.round(currentFatigue / recoveryRate * 2); // Estimate based on recovery rate
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length < 2) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance);
  }
}

export interface BreakPreferences {
  preferredBreakTypes: ('micro' | 'short' | 'long' | 'extended')[];
  preferredActivities: string[];
  maxBreakDuration: number;
  breakFrequency: number; // minutes between breaks
  environmentRestrictions: string[];
}