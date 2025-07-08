/**
 * Learning Analytics Metrics Collection System
 * Comprehensive metrics for learning effectiveness and user engagement
 */
import { createLogger } from './logger';
import { multiProviderAPM } from './apm-providers';

const logger = createLogger('learning-metrics');

// Learning event types
export enum LearningEventType {
  SESSION_START = 'session_start',
  SESSION_END = 'session_end',
  CONTENT_VIEW = 'content_view',
  CONTENT_COMPLETE = 'content_complete',
  QUIZ_START = 'quiz_start',
  QUIZ_COMPLETE = 'quiz_complete',
  QUIZ_ANSWER = 'quiz_answer',
  LEARNING_PATH_START = 'learning_path_start',
  LEARNING_PATH_COMPLETE = 'learning_path_complete',
  INTERACTION = 'interaction',
  FEEDBACK_SUBMIT = 'feedback_submit',
  ACHIEVEMENT_UNLOCK = 'achievement_unlock',
  RECOMMENDATION_VIEW = 'recommendation_view',
  RECOMMENDATION_CLICK = 'recommendation_click',
  ERROR_OCCURRED = 'error_occurred',
  PERFORMANCE_ISSUE = 'performance_issue',
}

// Learning metrics interfaces
interface LearningEvent {
  eventType: LearningEventType;
  userId: string;
  sessionId: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

interface LearningSession {
  sessionId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  contentViewed: string[];
  quizzesTaken: string[];
  interactions: number;
  completions: number;
  score?: number;
  learningStyle?: string;
  deviceType?: string;
  userAgent?: string;
}

interface ContentMetrics {
  contentId: string;
  contentType: string;
  title: string;
  views: number;
  completions: number;
  averageTimeSpent: number;
  averageScore: number;
  dropoffRate: number;
  engagementRate: number;
  difficultyRating: number;
  satisfaction: number;
}

interface UserMetrics {
  userId: string;
  totalSessions: number;
  totalTimeSpent: number;
  averageSessionDuration: number;
  contentCompleted: number;
  quizzesCompleted: number;
  averageScore: number;
  streakDays: number;
  learningVelocity: number;
  engagementLevel: 'low' | 'medium' | 'high';
  preferredLearningStyle: string;
  strongSubjects: string[];
  improvementAreas: string[];
}

interface QuizMetrics {
  quizId: string;
  title: string;
  attempts: number;
  completions: number;
  averageScore: number;
  averageTimeSpent: number;
  difficultyLevel: number;
  passRate: number;
  dropoffRate: number;
  commonMistakes: Array<{
    questionId: string;
    incorrectAnswer: string;
    frequency: number;
  }>;
}

interface LearningPathMetrics {
  pathId: string;
  title: string;
  enrollments: number;
  completions: number;
  averageCompletionTime: number;
  completionRate: number;
  averageScore: number;
  satisfaction: number;
  bottlenecks: Array<{
    contentId: string;
    dropoffRate: number;
  }>;
}

class LearningMetricsService {
  private events: LearningEvent[] = [];
  private sessions: Map<string, LearningSession> = new Map();
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL_MS = 30000; // 30 seconds
  private readonly MAX_EVENTS_BUFFER = 1000;

  constructor() {
    this.startFlushInterval();
  }

  private startFlushInterval() {
    this.flushInterval = setInterval(() => {
      this.flushEvents();
    }, this.FLUSH_INTERVAL_MS);
  }

  private flushEvents() {
    if (this.events.length === 0) return;

    try {
      // Process events and send to APM providers
      this.processEvents();
      
      // Clear events buffer
      this.events = [];
      
      logger.debug(`Flushed ${this.events.length} learning events`);
    } catch (error) {
      logger.error('Error flushing learning events:', error);
    }
  }

  private processEvents() {
    const eventCounts = new Map<string, number>();
    const userEvents = new Map<string, LearningEvent[]>();
    const contentEvents = new Map<string, LearningEvent[]>();

    // Group events by type and user
    for (const event of this.events) {
      // Count event types
      const eventType = event.eventType;
      eventCounts.set(eventType, (eventCounts.get(eventType) || 0) + 1);

      // Group by user
      if (!userEvents.has(event.userId)) {
        userEvents.set(event.userId, []);
      }
      userEvents.get(event.userId)!.push(event);

      // Group by content
      if (event.metadata.contentId) {
        const contentId = event.metadata.contentId;
        if (!contentEvents.has(contentId)) {
          contentEvents.set(contentId, []);
        }
        contentEvents.get(contentId)!.push(event);
      }
    }

    // Send metrics to APM providers
    for (const [eventType, count] of eventCounts) {
      multiProviderAPM.recordMetric(
        'learning_events_total',
        count,
        'counter',
        { event_type: eventType }
      );
    }

    // Process user-specific metrics
    for (const [userId, events] of userEvents) {
      this.processUserMetrics(userId, events);
    }

    // Process content-specific metrics
    for (const [contentId, events] of contentEvents) {
      this.processContentMetrics(contentId, events);
    }
  }

  private processUserMetrics(userId: string, events: LearningEvent[]) {
    const sessionEvents = events.filter(e => 
      e.eventType === LearningEventType.SESSION_START || 
      e.eventType === LearningEventType.SESSION_END
    );

    const contentEvents = events.filter(e => 
      e.eventType === LearningEventType.CONTENT_VIEW || 
      e.eventType === LearningEventType.CONTENT_COMPLETE
    );

    const quizEvents = events.filter(e => 
      e.eventType === LearningEventType.QUIZ_START || 
      e.eventType === LearningEventType.QUIZ_COMPLETE
    );

    const interactionEvents = events.filter(e => 
      e.eventType === LearningEventType.INTERACTION
    );

    // Record user engagement metrics
    multiProviderAPM.recordMetric(
      'user_session_count',
      sessionEvents.length / 2, // Start and end events
      'gauge',
      { user_id: userId }
    );

    multiProviderAPM.recordMetric(
      'user_content_views',
      contentEvents.length,
      'counter',
      { user_id: userId }
    );

    multiProviderAPM.recordMetric(
      'user_quiz_attempts',
      quizEvents.length / 2, // Start and complete events
      'counter',
      { user_id: userId }
    );

    multiProviderAPM.recordMetric(
      'user_interactions',
      interactionEvents.length,
      'counter',
      { user_id: userId }
    );

    // Calculate engagement level
    const engagementScore = this.calculateEngagementScore(events);
    multiProviderAPM.recordMetric(
      'user_engagement_score',
      engagementScore,
      'gauge',
      { user_id: userId }
    );
  }

  private processContentMetrics(contentId: string, events: LearningEvent[]) {
    const views = events.filter(e => e.eventType === LearningEventType.CONTENT_VIEW).length;
    const completions = events.filter(e => e.eventType === LearningEventType.CONTENT_COMPLETE).length;
    const interactions = events.filter(e => e.eventType === LearningEventType.INTERACTION).length;

    // Record content performance metrics
    multiProviderAPM.recordMetric(
      'content_views',
      views,
      'counter',
      { content_id: contentId }
    );

    multiProviderAPM.recordMetric(
      'content_completions',
      completions,
      'counter',
      { content_id: contentId }
    );

    multiProviderAPM.recordMetric(
      'content_interactions',
      interactions,
      'counter',
      { content_id: contentId }
    );

    // Calculate completion rate
    const completionRate = views > 0 ? (completions / views) * 100 : 0;
    multiProviderAPM.recordMetric(
      'content_completion_rate',
      completionRate,
      'gauge',
      { content_id: contentId }
    );

    // Calculate engagement rate
    const engagementRate = views > 0 ? (interactions / views) : 0;
    multiProviderAPM.recordMetric(
      'content_engagement_rate',
      engagementRate,
      'gauge',
      { content_id: contentId }
    );
  }

  private calculateEngagementScore(events: LearningEvent[]): number {
    let score = 0;
    const weights = {
      [LearningEventType.SESSION_START]: 1,
      [LearningEventType.CONTENT_VIEW]: 2,
      [LearningEventType.CONTENT_COMPLETE]: 5,
      [LearningEventType.QUIZ_START]: 3,
      [LearningEventType.QUIZ_COMPLETE]: 7,
      [LearningEventType.INTERACTION]: 1,
      [LearningEventType.FEEDBACK_SUBMIT]: 4,
      [LearningEventType.ACHIEVEMENT_UNLOCK]: 8,
    };

    for (const event of events) {
      const weight = weights[event.eventType] || 0;
      score += weight;
    }

    return Math.min(100, score); // Cap at 100
  }

  // Public API methods
  public trackEvent(event: Omit<LearningEvent, 'timestamp'>) {
    const fullEvent: LearningEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.events.push(fullEvent);

    // Flush if buffer is full
    if (this.events.length >= this.MAX_EVENTS_BUFFER) {
      this.flushEvents();
    }

    logger.debug('Learning event tracked:', {
      eventType: event.eventType,
      userId: event.userId,
      sessionId: event.sessionId,
    });
  }

  public startSession(userId: string, sessionId: string, metadata: Record<string, any> = {}) {
    const session: LearningSession = {
      sessionId,
      userId,
      startTime: new Date(),
      contentViewed: [],
      quizzesTaken: [],
      interactions: 0,
      completions: 0,
      deviceType: metadata.deviceType,
      userAgent: metadata.userAgent,
      learningStyle: metadata.learningStyle,
    };

    this.sessions.set(sessionId, session);

    this.trackEvent({
      eventType: LearningEventType.SESSION_START,
      userId,
      sessionId,
      metadata: {
        ...metadata,
        startTime: session.startTime.toISOString(),
      },
    });

    multiProviderAPM.recordMetric(
      'sessions_started',
      1,
      'counter',
      { user_id: userId }
    );
  }

  public endSession(sessionId: string, metadata: Record<string, any> = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`Session ${sessionId} not found`);
      return;
    }

    session.endTime = new Date();
    session.duration = session.endTime.getTime() - session.startTime.getTime();

    this.trackEvent({
      eventType: LearningEventType.SESSION_END,
      userId: session.userId,
      sessionId,
      metadata: {
        ...metadata,
        duration: session.duration,
        contentViewed: session.contentViewed.length,
        quizzesTaken: session.quizzesTaken.length,
        interactions: session.interactions,
        completions: session.completions,
      },
    });

    multiProviderAPM.recordMetric(
      'sessions_completed',
      1,
      'counter',
      { user_id: session.userId }
    );

    multiProviderAPM.recordMetric(
      'session_duration',
      session.duration,
      'histogram',
      { user_id: session.userId }
    );

    this.sessions.delete(sessionId);
  }

  public trackContentView(userId: string, sessionId: string, contentId: string, metadata: Record<string, any> = {}) {
    const session = this.sessions.get(sessionId);
    if (session && !session.contentViewed.includes(contentId)) {
      session.contentViewed.push(contentId);
    }

    this.trackEvent({
      eventType: LearningEventType.CONTENT_VIEW,
      userId,
      sessionId,
      metadata: {
        contentId,
        ...metadata,
      },
    });
  }

  public trackContentComplete(userId: string, sessionId: string, contentId: string, metadata: Record<string, any> = {}) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.completions++;
    }

    this.trackEvent({
      eventType: LearningEventType.CONTENT_COMPLETE,
      userId,
      sessionId,
      metadata: {
        contentId,
        timeSpent: metadata.timeSpent,
        score: metadata.score,
        ...metadata,
      },
    });
  }

  public trackQuizStart(userId: string, sessionId: string, quizId: string, metadata: Record<string, any> = {}) {
    this.trackEvent({
      eventType: LearningEventType.QUIZ_START,
      userId,
      sessionId,
      metadata: {
        quizId,
        ...metadata,
      },
    });
  }

  public trackQuizComplete(userId: string, sessionId: string, quizId: string, score: number, metadata: Record<string, any> = {}) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.quizzesTaken.push(quizId);
      session.score = score;
    }

    this.trackEvent({
      eventType: LearningEventType.QUIZ_COMPLETE,
      userId,
      sessionId,
      metadata: {
        quizId,
        score,
        timeSpent: metadata.timeSpent,
        totalQuestions: metadata.totalQuestions,
        correctAnswers: metadata.correctAnswers,
        ...metadata,
      },
    });

    multiProviderAPM.recordMetric(
      'quiz_score',
      score,
      'histogram',
      { 
        user_id: userId,
        quiz_id: quizId,
      }
    );
  }

  public trackInteraction(userId: string, sessionId: string, interactionType: string, metadata: Record<string, any> = {}) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.interactions++;
    }

    this.trackEvent({
      eventType: LearningEventType.INTERACTION,
      userId,
      sessionId,
      metadata: {
        interactionType,
        ...metadata,
      },
    });
  }

  public trackLearningPathProgress(userId: string, sessionId: string, pathId: string, progress: number, metadata: Record<string, any> = {}) {
    this.trackEvent({
      eventType: progress >= 100 ? LearningEventType.LEARNING_PATH_COMPLETE : LearningEventType.LEARNING_PATH_START,
      userId,
      sessionId,
      metadata: {
        pathId,
        progress,
        ...metadata,
      },
    });

    multiProviderAPM.recordMetric(
      'learning_path_progress',
      progress,
      'gauge',
      { 
        user_id: userId,
        path_id: pathId,
      }
    );
  }

  public trackFeedback(userId: string, sessionId: string, contentId: string, rating: number, feedback: string, metadata: Record<string, any> = {}) {
    this.trackEvent({
      eventType: LearningEventType.FEEDBACK_SUBMIT,
      userId,
      sessionId,
      metadata: {
        contentId,
        rating,
        feedback,
        ...metadata,
      },
    });

    multiProviderAPM.recordMetric(
      'content_rating',
      rating,
      'histogram',
      { 
        content_id: contentId,
      }
    );
  }

  public trackAchievement(userId: string, sessionId: string, achievementId: string, metadata: Record<string, any> = {}) {
    this.trackEvent({
      eventType: LearningEventType.ACHIEVEMENT_UNLOCK,
      userId,
      sessionId,
      metadata: {
        achievementId,
        ...metadata,
      },
    });

    multiProviderAPM.recordMetric(
      'achievements_unlocked',
      1,
      'counter',
      { 
        user_id: userId,
        achievement_id: achievementId,
      }
    );
  }

  public trackRecommendation(userId: string, sessionId: string, recommendationId: string, action: 'view' | 'click', metadata: Record<string, any> = {}) {
    this.trackEvent({
      eventType: action === 'view' ? LearningEventType.RECOMMENDATION_VIEW : LearningEventType.RECOMMENDATION_CLICK,
      userId,
      sessionId,
      metadata: {
        recommendationId,
        ...metadata,
      },
    });

    multiProviderAPM.recordMetric(
      'recommendations_' + action,
      1,
      'counter',
      { 
        user_id: userId,
        recommendation_id: recommendationId,
      }
    );
  }

  public trackError(userId: string, sessionId: string, error: Error, metadata: Record<string, any> = {}) {
    this.trackEvent({
      eventType: LearningEventType.ERROR_OCCURRED,
      userId,
      sessionId,
      metadata: {
        errorType: error.name,
        errorMessage: error.message,
        stack: error.stack,
        ...metadata,
      },
    });

    multiProviderAPM.recordError(error, {
      user_id: userId,
      session_id: sessionId,
      ...metadata,
    });
  }

  public trackPerformanceIssue(userId: string, sessionId: string, issueType: string, duration: number, metadata: Record<string, any> = {}) {
    this.trackEvent({
      eventType: LearningEventType.PERFORMANCE_ISSUE,
      userId,
      sessionId,
      metadata: {
        issueType,
        duration,
        ...metadata,
      },
    });

    multiProviderAPM.recordMetric(
      'performance_issues',
      1,
      'counter',
      { 
        issue_type: issueType,
        user_id: userId,
      }
    );

    multiProviderAPM.recordMetric(
      'performance_issue_duration',
      duration,
      'histogram',
      { 
        issue_type: issueType,
      }
    );
  }

  // Analytics methods
  public async generateUserReport(userId: string, timeRange: { start: Date; end: Date }): Promise<UserMetrics> {
    // This would typically query a database
    // For now, return mock data structure
    return {
      userId,
      totalSessions: 0,
      totalTimeSpent: 0,
      averageSessionDuration: 0,
      contentCompleted: 0,
      quizzesCompleted: 0,
      averageScore: 0,
      streakDays: 0,
      learningVelocity: 0,
      engagementLevel: 'medium',
      preferredLearningStyle: 'visual',
      strongSubjects: [],
      improvementAreas: [],
    };
  }

  public async generateContentReport(contentId: string, timeRange: { start: Date; end: Date }): Promise<ContentMetrics> {
    // This would typically query a database
    // For now, return mock data structure
    return {
      contentId,
      contentType: 'lesson',
      title: 'Sample Content',
      views: 0,
      completions: 0,
      averageTimeSpent: 0,
      averageScore: 0,
      dropoffRate: 0,
      engagementRate: 0,
      difficultyRating: 0,
      satisfaction: 0,
    };
  }

  public getActiveSessionCount(): number {
    return this.sessions.size;
  }

  public getBufferSize(): number {
    return this.events.length;
  }

  public shutdown() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushEvents();
  }
}

// Create singleton instance
export const learningMetrics = new LearningMetricsService();

// Export types and service
export {
  LearningMetricsService,
  LearningEvent,
  LearningSession,
  ContentMetrics,
  UserMetrics,
  QuizMetrics,
  LearningPathMetrics,
};

export default learningMetrics;