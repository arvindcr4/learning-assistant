import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: false,
  environment: process.env.NODE_ENV,
  
  // Performance Monitoring for Edge Runtime
  integrations: [
    Sentry.httpIntegration({ tracing: true }),
  ],
  
  // Capture 100% of the transactions for development
  // Lower this in production
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  
  // Configure error filtering
  beforeSend(event, hint) {
    // Filter out specific errors
    if (event.exception) {
      const error = hint.originalException;
      if (error && error.message) {
        // Filter out edge runtime specific errors
        if (error.message.includes('Edge Runtime') ||
            error.message.includes('WebAssembly')) {
          return null;
        }
      }
    }
    
    // Add edge context
    event.server_name = 'edge-runtime';
    
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
      component: 'edge',
      platform: 'edge-runtime',
    },
  },
});