import * as Sentry from '@sentry/nextjs';
import { sentryConfig } from './src/lib/sentry';

// Initialize Sentry for edge runtime with enhanced configuration
Sentry.init({
  ...sentryConfig,
  dsn: process.env.SENTRY_DSN,
  
  // Edge-specific integrations (limited in edge runtime)
  integrations: [
    Sentry.httpIntegration({ tracing: true }),
  ],
  
  // Edge-specific error filtering
  beforeSend(event, hint) {
    // First apply base filtering
    const filteredEvent = sentryConfig.beforeSend ? sentryConfig.beforeSend(event, hint) : event;
    if (!filteredEvent) return null;
    
    // Edge-specific filtering
    if (filteredEvent.exception) {
      const error = hint.originalException;
      if (error && error.message) {
        // Filter out edge runtime specific errors
        if (error.message.includes('Edge Runtime') ||
            error.message.includes('WebAssembly') ||
            error.message.includes('Dynamic Code Evaluation')) {
          return null;
        }
      }
    }
    
    // Add edge context
    filteredEvent.server_name = 'edge-runtime';
    
    // Remove sensitive edge data
    if (filteredEvent.request) {
      delete filteredEvent.request.headers?.authorization;
      delete filteredEvent.request.headers?.cookie;
      delete filteredEvent.request.data?.password;
      delete filteredEvent.request.data?.token;
      delete filteredEvent.request.data?.api_key;
    }
    
    return filteredEvent;
  },
  
  // Override tags for edge
  initialScope: {
    ...sentryConfig.initialScope,
    tags: {
      ...sentryConfig.initialScope.tags,
      component: 'edge',
      platform: 'edge-runtime',
    },
  },
});