import * as Sentry from '@sentry/nextjs';
import { sentryConfig } from './src/lib/sentry';

// Initialize Sentry for server-side with enhanced configuration
Sentry.init({
  ...sentryConfig,
  dsn: process.env.SENTRY_DSN,
  
  // Server-specific integrations
  integrations: [
    Sentry.nodeProfilingIntegration(),
    Sentry.httpIntegration({ tracing: true }),
    // Add database monitoring (uncomment if using PostgreSQL)
    // Sentry.postgresIntegration(),
  ],
  
  // Server-specific error filtering
  beforeSend(event, hint) {
    // First apply base filtering
    const filteredEvent = sentryConfig.beforeSend ? sentryConfig.beforeSend(event, hint) : event;
    if (!filteredEvent) return null;
    
    // Server-specific filtering
    if (filteredEvent.exception) {
      const error = hint.originalException;
      if (error && error.message) {
        // Filter out database connection errors in development
        if (process.env.NODE_ENV === 'development' && 
            error.message.includes('connect ECONNREFUSED')) {
          return null;
        }
        
        // Filter out common server errors
        if (error.message.includes('ECONNRESET') ||
            error.message.includes('socket hang up')) {
          return null;
        }
      }
    }
    
    // Add server context
    filteredEvent.server_name = process.env.HOSTNAME || 'learning-assistant';
    
    // Remove sensitive server data
    if (filteredEvent.request) {
      delete filteredEvent.request.headers?.authorization;
      delete filteredEvent.request.headers?.cookie;
      delete filteredEvent.request.data?.password;
      delete filteredEvent.request.data?.token;
      delete filteredEvent.request.data?.api_key;
    }
    
    return filteredEvent;
  },
  
  // Override tags for server
  initialScope: {
    ...sentryConfig.initialScope,
    tags: {
      ...sentryConfig.initialScope.tags,
      component: 'server',
      platform: 'node',
    },
  },
});