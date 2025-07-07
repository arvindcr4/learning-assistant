import * as Sentry from '@sentry/nextjs';
import { sentryConfig } from './src/lib/sentry';

// Initialize Sentry for client-side with enhanced configuration
Sentry.init({
  ...sentryConfig,
  
  // Client-specific integrations
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
      maskAllInputs: true,
      networkDetailAllowUrls: [window.location.origin],
    }),
    Sentry.browserTracingIntegration({
      tracePropagationTargets: [
        'localhost',
        /^https:\/\/[^/]*\.vercel\.app/,
        /^https:\/\/[^/]*\.fly\.dev/,
      ],
    }),
    Sentry.httpIntegration({
      tracing: true,
    }),
  ],
  
  // Override tags for client
  initialScope: {
    ...sentryConfig.initialScope,
    tags: {
      ...sentryConfig.initialScope.tags,
      component: 'client',
      platform: 'web',
    },
  },
});