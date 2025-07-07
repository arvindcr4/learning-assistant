import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: false,
  environment: process.env.NODE_ENV,
  
  // Performance Monitoring
  integrations: [
    Sentry.nodeProfilingIntegration(),
    Sentry.httpIntegration({ tracing: true }),
  ],
  
  // Capture 100% of the transactions for development
  // Lower this in production
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  
  // Set sample rate for profiling
  profilesSampleRate: 1.0,
  
  // Configure error filtering
  beforeSend(event, hint) {
    // Filter out specific errors
    if (event.exception) {
      const error = hint.originalException;
      if (error && error.message) {
        // Filter out database connection errors in development
        if (process.env.NODE_ENV === 'development' && 
            error.message.includes('connect ECONNREFUSED')) {
          return null;
        }
      }
    }
    
    // Add server context
    event.server_name = process.env.HOSTNAME || 'learning-assistant';
    
    // Remove sensitive data
    if (event.request) {
      delete event.request.headers?.authorization;
      delete event.request.headers?.cookie;
      delete event.request.data?.password;
      delete event.request.data?.token;
    }
    
    return event;
  },
  
  // Configure tags
  initialScope: {
    tags: {
      component: 'server',
      platform: 'node',
    },
  },
});