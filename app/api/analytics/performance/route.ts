// Performance Analytics API Route with comprehensive null/undefined safety
import { NextRequest, NextResponse } from 'next/server';
import { PerformanceAnalyticsEngine } from '@/lib/performance-analytics';
import { LearningService } from '@/services/learning-service';
import { validateQueryParams, AnalyticsValidationRules } from '@/utils/validation';
import { apm } from '@/lib/apm';
import databaseMonitoring from '@/lib/monitoring/database-monitoring';
import logger from '@/lib/logger';

interface PerformanceMetrics {
  [metricName: string]: {
    value: number;
    trend: 'up' | 'down' | 'stable';
    change: number;
    confidence: number;
  };
}

interface SafeSessionMetrics {
  [sessionId: string]: {
    accuracy: number;
    speed: number;
    engagement: number;
    completion: boolean;
    timestamp: Date;
    duration: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Validate query parameters
    const validation = validateQueryParams(searchParams, [
      { field: 'userId', required: true, type: 'uuid' },
      { field: 'timeframe', required: false, type: 'number', min: 1, max: 365 },
      { field: 'includeML', required: false, type: 'boolean' }
    ]);

    if (!validation.isValid) {
      return validation.response;
    }

    const { userId, timeframe = 30, includeML = false } = validation.validatedData || {};

    const learningService = new LearningService();
    const analyticsEngine = new PerformanceAnalyticsEngine();

    // Get user data with error handling
    const [sessions, learningProfile] = await Promise.allSettled([
      learningService.getLearningSessions(userId, { limit: 100 }),
      learningService.updateLearningProfile(userId, {}) // Using public method to get profile
    ]);

    const sessionData = sessions.status === 'fulfilled' && Array.isArray(sessions.value) 
      ? sessions.value 
      : [];

    const profileData = learningProfile.status === 'fulfilled' 
      ? learningProfile.value 
      : null;

    // Generate performance analysis with comprehensive safety checks
    const performanceData = await generateSafePerformanceAnalysis(
      sessionData,
      profileData,
      analyticsEngine,
      { timeframe, includeML }
    );

    return NextResponse.json({
      success: true,
      data: performanceData,
      metadata: {
        userId,
        timeframe,
        sessionCount: sessionData.length,
        hasProfile: !!profileData,
        analysisDate: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Performance analytics error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to generate performance analytics'
      },
      { status: 500 }
    );
  }
}

/**
 * Generates performance analysis with extensive null/undefined protection
 */
async function generateSafePerformanceAnalysis(
  sessions: any[],
  learningProfile: any,
  analyticsEngine: PerformanceAnalyticsEngine,
  options: { timeframe: number; includeML: boolean }
): Promise<{
  metrics: PerformanceMetrics;
  insights: any[];
  patterns: any[];
  sessionMetrics: SafeSessionMetrics;
  recommendations: string[];
}> {
  
  // Initialize safe metrics object
  const metrics: PerformanceMetrics = initializeSafeMetrics();
  
  // Process session metrics with comprehensive validation
  const sessionMetrics: SafeSessionMetrics = {};
  
  if (Array.isArray(sessions)) {
    sessions.forEach((session, index) => {
      if (!session || typeof session !== 'object') {
        return; // Skip invalid sessions
      }

      // Create safe session ID
      const sessionId = (typeof session.id === 'string' && session.id.length > 0) 
        ? session.id 
        : `session_${index}_${Date.now()}`;

      // Validate and extract session data with defaults
      const accuracy = calculateSafeSessionAccuracy(session);
      const speed = calculateSafeSessionSpeed(session);
      const engagement = calculateSafeSessionEngagement(session);
      const completion = session.completed === true;
      const timestamp = parseSessionTimestamp(session.startTime);
      const duration = parseSafeDuration(session.duration);

      // Only add sessions with valid data
      if (timestamp && !isNaN(timestamp.getTime()) && sessionId) {
        sessionMetrics[sessionId] = {
          accuracy,
          speed,
          engagement,
          completion,
          timestamp,
          duration
        };
      }
    });
  }

  // Calculate comprehensive metrics with error handling
  try {
    if (Object.keys(sessionMetrics).length > 0) {
      const sessionValues = Object.values(sessionMetrics);
      
      // Calculate accuracy metrics
      const accuracyValues = sessionValues.map(s => s.accuracy).filter(v => isFinite(v));
      if (accuracyValues.length > 0) {
        metrics.accuracy = {
          value: calculateSafeAverage(accuracyValues),
          trend: calculateTrend(accuracyValues),
          change: calculateChange(accuracyValues),
          confidence: Math.min(1.0, accuracyValues.length / 10)
        };
      }

      // Calculate speed metrics
      const speedValues = sessionValues.map(s => s.speed).filter(v => isFinite(v) && v > 0);
      if (speedValues.length > 0) {
        metrics.speed = {
          value: calculateSafeAverage(speedValues),
          trend: calculateTrend(speedValues),
          change: calculateChange(speedValues),
          confidence: Math.min(1.0, speedValues.length / 10)
        };
      }

      // Calculate engagement metrics
      const engagementValues = sessionValues.map(s => s.engagement).filter(v => isFinite(v));
      if (engagementValues.length > 0) {
        metrics.engagement = {
          value: calculateSafeAverage(engagementValues),
          trend: calculateTrend(engagementValues),
          change: calculateChange(engagementValues),
          confidence: Math.min(1.0, engagementValues.length / 10)
        };
      }

      // Calculate completion rate
      const completionValues = sessionValues.map(s => s.completion ? 100 : 0);
      metrics.completion = {
        value: calculateSafeAverage(completionValues),
        trend: calculateTrend(completionValues),
        change: calculateChange(completionValues),
        confidence: Math.min(1.0, completionValues.length / 5)
      };
    }
  } catch (error) {
    console.error('Error calculating metrics:', error);
    // Metrics remain with default values
  }

  // Generate insights and patterns with error handling
  let insights: any[] = [];
  let patterns: any[] = [];
  let recommendations: string[] = [];

  try {
    if (sessions.length > 5) {
      // Generate ML insights if requested and sufficient data
      if (options.includeML && sessions.length >= 20) {
        const mlInsights = analyticsEngine.generateMLInsights(
          sessions.filter(s => s && typeof s === 'object'),
          learningProfile || {},
          sessions
        );
        insights = Array.isArray(mlInsights) ? mlInsights : [];
      }

      // Detect learning patterns
      const detectedPatterns = analyticsEngine.detectLearningPatterns(
        sessions.filter(s => s && typeof s === 'object'),
        learningProfile || {}
      );
      patterns = Array.isArray(detectedPatterns) ? detectedPatterns : [];

      // Generate recommendations based on performance
      recommendations = generateSafeRecommendations(metrics, sessionMetrics);
    }
  } catch (error) {
    console.error('Error generating insights:', error);
    // Continue with empty arrays
  }

  return {
    metrics,
    insights,
    patterns,
    sessionMetrics,
    recommendations
  };
}

/**
 * Initialize metrics with safe defaults to prevent undefined access
 */
function initializeSafeMetrics(): PerformanceMetrics {
  const defaultMetric = {
    value: 0,
    trend: 'stable' as const,
    change: 0,
    confidence: 0
  };

  return {
    accuracy: { ...defaultMetric },
    speed: { ...defaultMetric },
    engagement: { ...defaultMetric },
    completion: { ...defaultMetric },
    consistency: { ...defaultMetric }
  };
}

/**
 * Safely calculate session accuracy with null checks
 */
function calculateSafeSessionAccuracy(session: any): number {
  if (!session || typeof session !== 'object') {
    return 0;
  }

  const correctAnswers = typeof session.correctAnswers === 'number' && !isNaN(session.correctAnswers) 
    ? session.correctAnswers : 0;
  const totalQuestions = typeof session.totalQuestions === 'number' && !isNaN(session.totalQuestions) 
    ? session.totalQuestions : 0;

  if (totalQuestions <= 0) {
    return 0;
  }

  const accuracy = (correctAnswers / totalQuestions) * 100;
  return isFinite(accuracy) ? Math.max(0, Math.min(100, accuracy)) : 0;
}

/**
 * Safely calculate session speed with null checks
 */
function calculateSafeSessionSpeed(session: any): number {
  if (!session || typeof session !== 'object') {
    return 0;
  }

  const totalQuestions = typeof session.totalQuestions === 'number' && !isNaN(session.totalQuestions) 
    ? session.totalQuestions : 0;
  const duration = typeof session.duration === 'number' && !isNaN(session.duration) 
    ? session.duration : 0;

  if (duration <= 0 || totalQuestions <= 0) {
    return 0;
  }

  const questionsPerMinute = totalQuestions / (duration / 60);
  return isFinite(questionsPerMinute) ? Math.max(0, questionsPerMinute) : 0;
}

/**
 * Safely calculate session engagement with null checks
 */
function calculateSafeSessionEngagement(session: any): number {
  if (!session || typeof session !== 'object' || !session.engagementMetrics) {
    return 0;
  }

  const metrics = session.engagementMetrics;
  const duration = typeof session.duration === 'number' && !isNaN(session.duration) 
    ? session.duration : 0;

  if (duration <= 0) {
    return 0;
  }

  const focusTime = typeof metrics.focusTime === 'number' && !isNaN(metrics.focusTime) 
    ? metrics.focusTime : 0;

  const engagementScore = (focusTime / duration) * 100;
  return isFinite(engagementScore) ? Math.max(0, Math.min(100, engagementScore)) : 0;
}

/**
 * Parse session timestamp safely
 */
function parseSessionTimestamp(timestamp: any): Date | null {
  if (!timestamp) {
    return null;
  }

  if (timestamp instanceof Date) {
    return isNaN(timestamp.getTime()) ? null : timestamp;
  }

  if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    const parsed = new Date(timestamp);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

/**
 * Parse duration safely
 */
function parseSafeDuration(duration: any): number {
  if (typeof duration === 'number' && !isNaN(duration) && duration >= 0) {
    return duration;
  }
  return 0;
}

/**
 * Calculate safe average
 */
function calculateSafeAverage(values: number[]): number {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }

  const validValues = values.filter(v => typeof v === 'number' && isFinite(v));
  if (validValues.length === 0) {
    return 0;
  }

  const sum = validValues.reduce((acc, val) => acc + val, 0);
  const average = sum / validValues.length;
  return isFinite(average) ? Math.round(average * 100) / 100 : 0;
}

/**
 * Calculate trend direction
 */
function calculateTrend(values: number[]): 'up' | 'down' | 'stable' {
  if (!Array.isArray(values) || values.length < 2) {
    return 'stable';
  }

  const validValues = values.filter(v => typeof v === 'number' && isFinite(v));
  if (validValues.length < 2) {
    return 'stable';
  }

  const firstHalf = validValues.slice(0, Math.floor(validValues.length / 2));
  const secondHalf = validValues.slice(Math.floor(validValues.length / 2));

  const firstAvg = calculateSafeAverage(firstHalf);
  const secondAvg = calculateSafeAverage(secondHalf);

  const change = secondAvg - firstAvg;
  const threshold = Math.max(1, firstAvg * 0.05); // 5% threshold

  if (change > threshold) return 'up';
  if (change < -threshold) return 'down';
  return 'stable';
}

/**
 * Calculate percentage change
 */
function calculateChange(values: number[]): number {
  if (!Array.isArray(values) || values.length < 2) {
    return 0;
  }

  const validValues = values.filter(v => typeof v === 'number' && isFinite(v));
  if (validValues.length < 2) {
    return 0;
  }

  const firstValue = validValues[0]!;
  const lastValue = validValues[validValues.length - 1]!;

  if (firstValue === 0) {
    return lastValue > 0 ? 100 : 0;
  }

  const change = ((lastValue - firstValue) / firstValue) * 100;
  return isFinite(change) ? Math.round(change * 100) / 100 : 0;
}

/**
 * Generate safe recommendations
 */
function generateSafeRecommendations(
  metrics: PerformanceMetrics, 
  sessionMetrics: SafeSessionMetrics
): string[] {
  const recommendations: string[] = [];

  try {
    // Check accuracy
    if (metrics.accuracy && typeof metrics.accuracy.value === 'number') {
      if (metrics.accuracy.value < 70) {
        recommendations.push('Focus on improving accuracy through additional practice');
      } else if (metrics.accuracy.value > 90) {
        recommendations.push('Consider advancing to more challenging content');
      }
    }

    // Check engagement
    if (metrics.engagement && typeof metrics.engagement.value === 'number') {
      if (metrics.engagement.value < 60) {
        recommendations.push('Try varying content types to improve engagement');
      }
    }

    // Check completion rate
    if (metrics.completion && typeof metrics.completion.value === 'number') {
      if (metrics.completion.value < 80) {
        recommendations.push('Work on completing more learning sessions');
      }
    }

    // Default recommendation if none generated
    if (recommendations.length === 0) {
      recommendations.push('Continue your current learning approach');
    }

  } catch (error) {
    console.error('Error generating recommendations:', error);
    recommendations.push('Unable to generate specific recommendations at this time');
  }

  return recommendations;
}