import * as Sentry from '@sentry/nextjs';
import { env } from '../env-validation';

// Enhanced error reporting utilities for Sentry integration
export interface SentryErrorContext {
  user?: {
    id: string;
    email?: string;
    username?: string;
  };
  session?: {
    id: string;
    type?: 'learning' | 'assessment' | 'practice';
    duration?: number;
  };
  learning?: {
    sessionId?: string;
    moduleId?: string;
    lessonId?: string;
    progress?: number;
    learningStyle?: string;
  };
  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  };
  performance?: {
    loadTime?: number;
    memoryUsage?: number;
    networkSpeed?: string;
  };
  feature?: {
    name: string;
    version?: string;
    enabled?: boolean;
  };
  tags?: Record<string, string>;
  extra?: Record<string, any>;
}

// Main error reporting function
export function captureEnhancedError(
  error: Error,
  context?: SentryErrorContext,
  level: Sentry.SeverityLevel = 'error'
) {
  const errorId = `sentry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  return Sentry.withScope((scope) => {
    // Set error ID for tracking
    scope.setTag('error_id', errorId);
    scope.setTag('app_version', process.env.NEXT_PUBLIC_APP_VERSION || 'unknown');
    scope.setTag('environment', env.NODE_ENV);
    
    // Set user context
    if (context?.user) {
      scope.setUser(context.user);
    }
    
    // Set session context
    if (context?.session) {
      scope.setContext('session', context.session);
      scope.setTag('session_type', context.session.type || 'unknown');
    }
    
    // Set learning context
    if (context?.learning) {
      scope.setContext('learning', context.learning);
      if (context.learning.sessionId) {
        scope.setTag('learning_session_id', context.learning.sessionId);
      }
      if (context.learning.learningStyle) {
        scope.setTag('learning_style', context.learning.learningStyle);
      }
    }
    
    // Set request context
    if (context?.request) {
      scope.setContext('request', {
        ...context.request,
        headers: context.request.headers ? 
          Object.keys(context.request.headers) : undefined, // Don't include header values
        body: context.request.body ? '[REDACTED]' : undefined,
      });
      
      if (context.request.method) {
        scope.setTag('request_method', context.request.method);
      }
    }
    
    // Set performance context
    if (context?.performance) {
      scope.setContext('performance', context.performance);
    }
    
    // Set feature context
    if (context?.feature) {
      scope.setContext('feature', context.feature);
      scope.setTag('feature_name', context.feature.name);
    }
    
    // Set custom tags
    if (context?.tags) {
      scope.setTags(context.tags);
    }
    
    // Set extra context
    if (context?.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    
    // Set breadcrumb
    scope.addBreadcrumb({
      message: `Error captured: ${error.message}`,
      category: 'error',
      level: level,
      timestamp: Date.now() / 1000,
    });
    
    Sentry.captureException(error, { level });
    return errorId;
  });
}

// Specialized error functions
export function captureLearningError(
  error: Error,
  learningContext: {
    sessionId: string;
    moduleId?: string;
    lessonId?: string;
    progress?: number;
    learningStyle?: string;
    userId?: string;
  }
) {
  return captureEnhancedError(error, {
    user: learningContext.userId ? { id: learningContext.userId } : undefined,
    learning: {
      sessionId: learningContext.sessionId,
      moduleId: learningContext.moduleId,
      lessonId: learningContext.lessonId,
      progress: learningContext.progress,
      learningStyle: learningContext.learningStyle,
    },
    tags: {
      error_type: 'learning_error',
      component: 'learning_system',
    },
  });
}

export function captureApiError(
  error: Error,
  requestContext: {
    url: string;
    method: string;
    statusCode?: number;
    duration?: number;
    userId?: string;
  }
) {
  return captureEnhancedError(error, {
    user: requestContext.userId ? { id: requestContext.userId } : undefined,
    request: {
      url: requestContext.url,
      method: requestContext.method,
    },
    performance: {
      loadTime: requestContext.duration,
    },
    tags: {
      error_type: 'api_error',
      component: 'api',
      status_code: requestContext.statusCode?.toString(),
    },
  });
}

export function captureAuthError(
  error: Error,
  authContext: {
    action: 'login' | 'logout' | 'register' | 'refresh' | 'verify';
    userId?: string;
    provider?: string;
  }
) {
  return captureEnhancedError(error, {
    user: authContext.userId ? { id: authContext.userId } : undefined,
    tags: {
      error_type: 'auth_error',
      component: 'authentication',
      auth_action: authContext.action,
      auth_provider: authContext.provider || 'unknown',
    },
  });
}

export function capturePerformanceError(
  error: Error,
  performanceContext: {
    metric: string;
    value: number;
    threshold: number;
    url?: string;
    userId?: string;
  }
) {
  return captureEnhancedError(error, {
    user: performanceContext.userId ? { id: performanceContext.userId } : undefined,
    performance: {
      [performanceContext.metric]: performanceContext.value,
    },
    tags: {
      error_type: 'performance_error',
      component: 'performance',
      metric: performanceContext.metric,
      threshold_exceeded: 'true',
    },
    extra: {
      value: performanceContext.value,
      threshold: performanceContext.threshold,
      url: performanceContext.url,
    },
  });
}

// Performance monitoring functions
export function startSentryTransaction(
  name: string,
  operation: string = 'navigation',
  context?: SentryErrorContext
) {
  if (context?.user) {
    Sentry.setUser(context.user);
  }
  
  if (context?.learning) {
    Sentry.setContext('learning', context.learning);
  }
  
  return Sentry.startSpan({
    name,
    op: operation,
    forceTransaction: true,
    attributes: {
      ...context?.tags,
      app_version: process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
    },
  }, (span) => span);
}

export function startSentrySpan(
  name: string,
  operation: string = 'function',
  parentSpan?: any
) {
  return Sentry.startSpan({
    name,
    op: operation,
    parentSpan,
  }, (span) => span);
}

// User context management
export function setSentryUser(user: {
  id: string;
  email?: string;
  username?: string;
  learningStyle?: string;
  subscription?: string;
}) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });
  
  Sentry.setTags({
    learning_style: user.learningStyle || 'unknown',
    subscription: user.subscription || 'free',
  });
}

export function clearSentryUser() {
  Sentry.setUser(null);
}

// Breadcrumb helpers
export function addLearningBreadcrumb(
  message: string,
  data?: Record<string, any>
) {
  Sentry.addBreadcrumb({
    message,
    category: 'learning',
    level: 'info',
    data,
    timestamp: Date.now() / 1000,
  });
}

export function addNavigationBreadcrumb(
  from: string,
  to: string,
  data?: Record<string, any>
) {
  Sentry.addBreadcrumb({
    message: `Navigation: ${from} → ${to}`,
    category: 'navigation',
    level: 'info',
    data,
    timestamp: Date.now() / 1000,
  });
}

export function addUserActionBreadcrumb(
  action: string,
  target: string,
  data?: Record<string, any>
) {
  Sentry.addBreadcrumb({
    message: `User ${action}: ${target}`,
    category: 'user',
    level: 'info',
    data,
    timestamp: Date.now() / 1000,
  });
}

// Error filtering utilities
export function shouldCaptureError(error: Error): boolean {
  const ignoredErrors = [
    'Network request failed',
    'Load failed',
    'Script error',
    'ResizeObserver loop limit exceeded',
    'ChunkLoadError',
    'Non-Error promise rejection captured',
  ];
  
  // Check if error message contains any ignored patterns
  const errorMessage = error.message || error.toString();
  return !ignoredErrors.some(ignored => errorMessage.includes(ignored));
}

export function shouldCaptureUserAgentError(userAgent: string): boolean {
  const botPatterns = [
    /bot|crawler|spider|scraper/i,
    /curl|wget|python|java|perl/i,
  ];
  
  return !botPatterns.some(pattern => pattern.test(userAgent));
}

// Configuration helpers
export function configureSentryForLearningApp() {
  // Set up global error handlers that understand learning context
  if (typeof window !== 'undefined') {
    // Monitor learning session timeouts
    window.addEventListener('beforeunload', () => {
      addUserActionBreadcrumb('page_unload', window.location.pathname);
    });
    
    // Monitor learning interactions
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.dataset.learning) {
        addUserActionBreadcrumb('learning_interaction', target.dataset.learning);
      }
    });
  }
}

// Release management
export function setSentryRelease(version: string, environment: string) {
  Sentry.setTag('release', version);
  Sentry.setTag('environment', environment);
  Sentry.setContext('app', {
    version,
    environment,
    buildTime: process.env.BUILD_TIME,
  });
}

export default {
  captureEnhancedError,
  captureLearningError,
  captureApiError,
  captureAuthError,
  capturePerformanceError,
  startSentryTransaction,
  startSentrySpan,
  setSentryUser,
  clearSentryUser,
  addLearningBreadcrumb,
  addNavigationBreadcrumb,
  addUserActionBreadcrumb,
  shouldCaptureError,
  shouldCaptureUserAgentError,
  configureSentryForLearningApp,
  setSentryRelease,
};