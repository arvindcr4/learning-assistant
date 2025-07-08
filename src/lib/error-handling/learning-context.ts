import * as Sentry from '@sentry/nextjs';
import { captureLearningError, setSentryUser, addLearningBreadcrumb } from './sentry-utils';

// Learning-specific context and error handling
export interface LearningContext {
  userId: string;
  sessionId: string;
  moduleId?: string;
  lessonId?: string;
  questionId?: string;
  learningStyle?: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  progress?: {
    completed: number;
    total: number;
    percentage: number;
  };
  performance?: {
    accuracy: number;
    timeSpent: number;
    attemptsCount: number;
  };
  metadata?: Record<string, any>;
}

export interface LearningEvent {
  type: 'session_start' | 'session_end' | 'question_answered' | 'lesson_completed' | 
        'module_completed' | 'error_occurred' | 'help_requested' | 'hint_used' |
        'quiz_started' | 'quiz_completed' | 'assessment_started' | 'assessment_completed';
  timestamp: number;
  data?: Record<string, any>;
}

// Learning session manager
export class LearningSessionManager {
  private static instance: LearningSessionManager;
  private currentContext: LearningContext | null = null;
  private events: LearningEvent[] = [];
  private sessionStartTime: number | null = null;

  static getInstance(): LearningSessionManager {
    if (!LearningSessionManager.instance) {
      LearningSessionManager.instance = new LearningSessionManager();
    }
    return LearningSessionManager.instance;
  }

  setContext(context: LearningContext) {
    this.currentContext = context;
    this.sessionStartTime = Date.now();
    
    // Set user context in Sentry
    setSentryUser({
      id: context.userId,
      learningStyle: context.learningStyle,
    });
    
    // Set learning context in Sentry
    Sentry.setContext('learning_session', {
      sessionId: context.sessionId,
      moduleId: context.moduleId,
      lessonId: context.lessonId,
      learningStyle: context.learningStyle,
      difficulty: context.difficulty,
      progress: context.progress,
    });
    
    // Set learning tags
    Sentry.setTags({
      learning_session_id: context.sessionId,
      learning_style: context.learningStyle || 'unknown',
      difficulty: context.difficulty || 'unknown',
      module_id: context.moduleId || 'unknown',
    });
    
    // Add session start breadcrumb
    addLearningBreadcrumb('Learning session started', {
      sessionId: context.sessionId,
      moduleId: context.moduleId,
      lessonId: context.lessonId,
    });
    
    // Track session start event
    this.trackEvent('session_start', {
      sessionId: context.sessionId,
      moduleId: context.moduleId,
      lessonId: context.lessonId,
      learningStyle: context.learningStyle,
    });
  }

  updateContext(updates: Partial<LearningContext>) {
    if (this.currentContext) {
      this.currentContext = { ...this.currentContext, ...updates };
      
      // Update Sentry context
      Sentry.setContext('learning_session', {
        ...this.currentContext,
        progress: this.currentContext.progress,
        performance: this.currentContext.performance,
      });
      
      // Update tags if relevant fields changed
      if (updates.moduleId) {
        Sentry.setTag('module_id', updates.moduleId);
      }
      if (updates.lessonId) {
        Sentry.setTag('lesson_id', updates.lessonId);
      }
      if (updates.questionId) {
        Sentry.setTag('question_id', updates.questionId);
      }
    }
  }

  trackEvent(type: LearningEvent['type'], data?: Record<string, any>) {
    const event: LearningEvent = {
      type,
      timestamp: Date.now(),
      data,
    };
    
    this.events.push(event);
    
    // Keep only last 100 events
    if (this.events.length > 100) {
      this.events = this.events.slice(-100);
    }
    
    // Add breadcrumb to Sentry
    addLearningBreadcrumb(`Learning event: ${type}`, data);
    
    // Special handling for certain events
    switch (type) {
      case 'question_answered':
        this.handleQuestionAnswered(data);
        break;
      case 'lesson_completed':
        this.handleLessonCompleted(data);
        break;
      case 'module_completed':
        this.handleModuleCompleted(data);
        break;
      case 'error_occurred':
        this.handleErrorOccurred(data);
        break;
    }
  }

  captureError(error: Error, context?: Record<string, any>) {
    if (!this.currentContext) {
      console.warn('No learning context set when capturing error');
      return;
    }
    
    // Capture learning-specific error
    const errorId = captureLearningError(error, {
      sessionId: this.currentContext.sessionId,
      moduleId: this.currentContext.moduleId,
      lessonId: this.currentContext.lessonId,
      progress: this.currentContext.progress?.percentage,
      learningStyle: this.currentContext.learningStyle,
      userId: this.currentContext.userId,
    });
    
    // Track error event
    this.trackEvent('error_occurred', {
      errorId,
      errorMessage: error.message,
      errorStack: error.stack,
      context,
    });
    
    return errorId;
  }

  getSessionDuration(): number | null {
    return this.sessionStartTime ? Date.now() - this.sessionStartTime : null;
  }

  getEvents(): LearningEvent[] {
    return [...this.events];
  }

  getCurrentContext(): LearningContext | null {
    return this.currentContext ? { ...this.currentContext } : null;
  }

  endSession() {
    if (this.currentContext) {
      const duration = this.getSessionDuration();
      
      // Track session end event
      this.trackEvent('session_end', {
        sessionId: this.currentContext.sessionId,
        duration,
        eventsCount: this.events.length,
        finalProgress: this.currentContext.progress,
        finalPerformance: this.currentContext.performance,
      });
      
      // Add session end breadcrumb
      addLearningBreadcrumb('Learning session ended', {
        sessionId: this.currentContext.sessionId,
        duration,
        eventsCount: this.events.length,
      });
      
      // Clear context
      this.currentContext = null;
      this.sessionStartTime = null;
      this.events = [];
      
      // Clear Sentry context
      Sentry.setContext('learning_session', null);
    }
  }

  private handleQuestionAnswered(data?: Record<string, any>) {
    if (this.currentContext && data) {
      // Update performance metrics
      const performance = this.currentContext.performance || {
        accuracy: 0,
        timeSpent: 0,
        attemptsCount: 0,
      };
      
      if (data.correct) {
        performance.accuracy = ((performance.accuracy * performance.attemptsCount) + 1) / (performance.attemptsCount + 1);
      } else {
        performance.accuracy = (performance.accuracy * performance.attemptsCount) / (performance.attemptsCount + 1);
      }
      
      performance.timeSpent += data.timeSpent || 0;
      performance.attemptsCount += 1;
      
      this.updateContext({ performance });
      
      // Set performance context in Sentry
      Sentry.setContext('learning_performance', performance);
    }
  }

  private handleLessonCompleted(data?: Record<string, any>) {
    if (this.currentContext && data) {
      // Update progress
      const progress = this.currentContext.progress || { completed: 0, total: 1, percentage: 0 };
      progress.completed += 1;
      progress.percentage = (progress.completed / progress.total) * 100;
      
      this.updateContext({ progress });
      
      // Track significant milestone
      Sentry.addBreadcrumb({
        message: 'Lesson completed',
        category: 'learning.milestone',
        level: 'info',
        data: {
          lessonId: this.currentContext.lessonId,
          progress: progress.percentage,
          performance: this.currentContext.performance,
        },
      });
    }
  }

  private handleModuleCompleted(data?: Record<string, any>) {
    if (this.currentContext) {
      // Track major milestone
      Sentry.addBreadcrumb({
        message: 'Module completed',
        category: 'learning.milestone',
        level: 'info',
        data: {
          moduleId: this.currentContext.moduleId,
          sessionDuration: this.getSessionDuration(),
          totalEvents: this.events.length,
          finalPerformance: this.currentContext.performance,
        },
      });
      
      // Send completion metrics to analytics
      if (typeof window !== 'undefined' && 'gtag' in window) {
        (window as any).gtag('event', 'module_completed', {
          module_id: this.currentContext.moduleId,
          learning_style: this.currentContext.learningStyle,
          difficulty: this.currentContext.difficulty,
          session_duration: this.getSessionDuration(),
          accuracy: this.currentContext.performance?.accuracy,
        });
      }
    }
  }

  private handleErrorOccurred(data?: Record<string, any>) {
    // Additional error context tracking
    if (this.currentContext) {
      Sentry.setContext('error_learning_context', {
        sessionId: this.currentContext.sessionId,
        moduleId: this.currentContext.moduleId,
        lessonId: this.currentContext.lessonId,
        questionId: this.currentContext.questionId,
        sessionDuration: this.getSessionDuration(),
        eventsCount: this.events.length,
        recentEvents: this.events.slice(-5), // Last 5 events for context
      });
    }
  }

  exportSessionData(): string {
    return JSON.stringify({
      context: this.currentContext,
      events: this.events,
      sessionDuration: this.getSessionDuration(),
      timestamp: new Date().toISOString(),
    }, null, 2);
  }
}

// React hooks for learning context
export function useLearningContext() {
  const manager = LearningSessionManager.getInstance();
  
  return {
    setContext: (context: LearningContext) => manager.setContext(context),
    updateContext: (updates: Partial<LearningContext>) => manager.updateContext(updates),
    trackEvent: (type: LearningEvent['type'], data?: Record<string, any>) => manager.trackEvent(type, data),
    captureError: (error: Error, context?: Record<string, any>) => manager.captureError(error, context),
    endSession: () => manager.endSession(),
    getCurrentContext: () => manager.getCurrentContext(),
    getSessionDuration: () => manager.getSessionDuration(),
    getEvents: () => manager.getEvents(),
    exportSessionData: () => manager.exportSessionData(),
  };
}

// HOC for learning context
export function withLearningContext<P extends object>(
  Component: React.ComponentType<P>,
  contextLoader?: (props: P) => LearningContext | Promise<LearningContext>
) {
  const WrappedComponent = (props: P) => {
    const { setContext } = useLearningContext();
    
    React.useEffect(() => {
      if (contextLoader) {
        const loadContext = async () => {
          try {
            const context = await contextLoader(props);
            setContext(context);
          } catch (error) {
            console.error('Failed to load learning context:', error);
          }
        };
        
        loadContext();
      }
    }, []);
    
    return React.createElement(Component, props);
  };
  
  WrappedComponent.displayName = `withLearningContext(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

// Utility functions
export function createLearningContext(
  userId: string,
  sessionId: string,
  options?: Partial<LearningContext>
): LearningContext {
  return {
    userId,
    sessionId,
    progress: { completed: 0, total: 1, percentage: 0 },
    performance: { accuracy: 0, timeSpent: 0, attemptsCount: 0 },
    ...options,
  };
}

export function initializeLearningMonitoring() {
  const manager = LearningSessionManager.getInstance();
  
  // Set up global learning event tracking
  if (typeof window !== 'undefined') {
    // Track page visibility for learning sessions
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        manager.trackEvent('session_end', { reason: 'page_hidden' });
      } else {
        manager.trackEvent('session_start', { reason: 'page_visible' });
      }
    });
    
    // Track before unload
    window.addEventListener('beforeunload', () => {
      manager.trackEvent('session_end', { reason: 'page_unload' });
    });
  }
  
  return manager;
}

export default LearningSessionManager;