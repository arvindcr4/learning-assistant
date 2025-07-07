import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: false,
  environment: process.env.NODE_ENV,
  
  // Performance Monitoring
  integrations: [
    Sentry.replayIntegration({
      // Session Replay configuration
      maskAllText: true,
      blockAllMedia: true,
      networkDetailAllowUrls: [window.location.origin]
    }),
    Sentry.browserTracingIntegration(),
  ],
  
  // Capture 100% of the transactions for development
  // Lower this in production
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  
  // Set sample rate for profiling
  profilesSampleRate: 1.0,
  
  // Capture 100% of the Session Replay sessions
  replaysSessionSampleRate: 0.1,
  
  // If you're not already capturing the entire session, change the sample rate
  // when an error occurs.
  replaysOnErrorSampleRate: 1.0,
  
  // Configure error filtering
  beforeSend(event, hint) {
    // Filter out specific errors
    if (event.exception) {
      const error = hint.originalException;
      if (error && error.message) {
        // Filter out non-critical errors
        if (error.message.includes('Network Error') || 
            error.message.includes('ChunkLoadError') ||
            error.message.includes('Loading CSS chunk')) {
          return null;
        }
      }
    }
    
    // Add user context
    if (event.user) {
      event.user.id = event.user.id || 'anonymous';
      // Remove sensitive data
      delete event.user.email;
      delete event.user.username;
    }
    
    return event;
  },
  
  // Configure tags
  initialScope: {
    tags: {
      component: 'client',
      platform: 'web',
    },
  },
});