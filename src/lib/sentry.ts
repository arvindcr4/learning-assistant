import * as Sentry from '@sentry/nextjs';
import { User } from '@sentry/types';

// Environment-specific configuration
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Sentry configuration
export const sentryConfig = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
  
  // Performance monitoring
  tracesSampleRate: isDevelopment ? 1.0 : 0.1,
  profilesSampleRate: isDevelopment ? 1.0 : 0.1,
  
  // Session replay
  replaysSessionSampleRate: isDevelopment ? 1.0 : 0.1,
  replaysOnErrorSampleRate: 1.0,
  
  // Data privacy and filtering
  beforeSend: (event, hint) => {
    // Filter out development errors in production
    if (isProduction && event.environment === 'development') {
      return null;
    }
    
    // Filter out specific error types
    if (event.exception) {
      const error = hint.originalException;
      if (error instanceof Error) {
        // Filter out network errors that are not actionable
        if (error.message.includes('NetworkError') || 
            error.message.includes('fetch')) {
          return null;
        }
        
        // Filter out ResizeObserver errors (common browser issue)
        if (error.message.includes('ResizeObserver')) {
          return null;
        }
      }
    }
    
    return event;
  },
  
  // Strip sensitive data
  beforeSendTransaction: (event) => {
    // Remove sensitive URL parameters
    if (event.request?.url) {
      const url = new URL(event.request.url);
      const sensitiveParams = ['token', 'api_key', 'password', 'secret'];
      
      sensitiveParams.forEach(param => {
        if (url.searchParams.has(param)) {
          url.searchParams.set(param, '[Filtered]');
        }
      });
      
      event.request.url = url.toString();
    }
    
    return event;
  },
  
  // Integration configuration
  integrations: [
    // Disable problematic integrations for build compatibility
    // Sentry.replayIntegration({
    //   maskAllText: true,
    //   blockAllMedia: true,
    //   maskAllInputs: true,
    // }),
    // Sentry.browserTracingIntegration({
    //   tracePropagationTargets: [
    //     'localhost',
    //     /^https:\/\/yourapp\.com/,
    //     /^https:\/\/api\.yourapp\.com/,
    //   ],
    // }),
    // Sentry.httpIntegration({
    //   tracing: true,
    // }),
  ],
  
  // Debug settings
  debug: isDevelopment,
  
  // Tunnel for bypassing ad blockers
  tunnel: '/monitoring',
  
  // Ignore specific URLs
  ignoreErrors: [
    // Browser extensions
    'top.GLOBALS',
    'chrome-extension://',
    'moz-extension://',
    
    // Network errors
    'NetworkError',
    'ChunkLoadError',
    'Loading chunk',
    'Loading CSS chunk',
    
    // Third-party scripts
    'Script error.',
    'Non-Error promise rejection captured',
    
    // Common browser issues
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
  ],
  
  // Ignore specific transaction names
  ignoreTransactions: [
    '/api/health',
    '/api/metrics',
    '/monitoring',
  ],
  
  // Set initial scope
  initialScope: {
    tags: {
      component: 'learning-assistant',
      version: process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
    },
    contexts: {
      app: {
        name: 'Learning Assistant',
        version: process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
      },
    },
  },
};

// Initialize Sentry
export const initSentry = () => {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    console.warn('Sentry DSN not configured');
    return;
  }
  
  Sentry.init(sentryConfig);
};

// User context management
export const setUserContext = (user: {
  id: string;
  email?: string;
  username?: string;
  role?: string;
}) => {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  } as User);
};

export const clearUserContext = () => {
  Sentry.setUser(null);
};

// Custom tag management
export const setSentryTags = (tags: Record<string, string>) => {
  Sentry.setTags(tags);
};

export const setSentryTag = (key: string, value: string) => {
  Sentry.setTag(key, value);
};

// Context management
export const setSentryContext = (context: string, data: Record<string, any>) => {
  Sentry.setContext(context, data);
};

// Custom error reporting
export const reportError = (error: Error, context?: Record<string, any>) => {
  Sentry.withScope((scope) => {
    if (context) {
      Object.keys(context).forEach(key => {
        scope.setContext(key, context[key]);
      });
    }
    
    Sentry.captureException(error);
  });
};

// Performance monitoring
export const startTransaction = (name: string, description?: string) => {
  return Sentry.startSpan({
    name,
    description,
    op: 'navigation',
    forceTransaction: true,
  }, (span) => span);
};

export const measurePerformance = async <T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> => {
  return await Sentry.startSpan({
    name,
    op: 'function',
  }, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: 1 }); // OK status
      return result;
    } catch (error) {
      span.setStatus({ code: 2 }); // Error status
      throw error;
    }
  });
};

// Learning-specific context
export const setLearningContext = (context: {
  sessionId?: string;
  userId?: string;
  lessonId?: string;
  moduleId?: string;
  difficulty?: string;
  learningStyle?: string;
}) => {
  Sentry.setContext('learning', context);
};

// Performance metrics for learning actions
export const trackLearningPerformance = (action: string, metadata?: Record<string, any>) => {
  Sentry.addBreadcrumb({
    message: `Learning Action: ${action}`,
    category: 'learning',
    level: 'info',
    data: metadata,
  });
};

// API error tracking
export const trackApiError = (endpoint: string, error: Error, response?: Response) => {
  Sentry.withScope((scope) => {
    scope.setTag('api.endpoint', endpoint);
    scope.setContext('api', {
      endpoint,
      status: response?.status,
      statusText: response?.statusText,
      headers: response?.headers ? Object.fromEntries(response.headers.entries()) : undefined,
    });
    
    Sentry.captureException(error);
  });
};

// Feature flag tracking
export const trackFeatureFlag = (flagName: string, value: boolean, userId?: string) => {
  Sentry.setContext('feature_flags', {
    [flagName]: value,
    userId,
  });
};

// Custom metrics
export const trackCustomMetric = (name: string, value: number, tags?: Record<string, string>) => {
  Sentry.setMeasurement(name, value, 'millisecond');
  
  if (tags) {
    Object.keys(tags).forEach(key => {
      Sentry.setTag(`metric.${key}`, tags[key]);
    });
  }
};

// Learning analytics integration
export const trackLearningEvent = (event: {
  type: 'lesson_start' | 'lesson_complete' | 'quiz_attempt' | 'progress_update';
  lessonId?: string;
  score?: number;
  duration?: number;
  difficulty?: string;
  userId?: string;
}) => {
  Sentry.addBreadcrumb({
    message: `Learning Event: ${event.type}`,
    category: 'learning_analytics',
    level: 'info',
    data: event,
  });
  
  // Track custom metrics for learning events
  if (event.duration) {
    trackCustomMetric('learning.duration', event.duration);
  }
  
  if (event.score !== undefined) {
    trackCustomMetric('learning.score', event.score);
  }
};

// Error boundary helpers
export const captureErrorBoundary = (error: Error, errorInfo: { componentStack: string }) => {
  Sentry.withScope((scope) => {
    scope.setTag('error.boundary', true);
    scope.setContext('react', {
      componentStack: errorInfo.componentStack,
    });
    
    Sentry.captureException(error);
  });
};

// Export Sentry for direct use
export { Sentry };