import * as Sentry from '@sentry/nextjs';
import { env } from './src/lib/env-validation';

// Initialize Sentry for client-side
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  // Environment configuration
  environment: env.NODE_ENV,
  
  // Performance monitoring
  tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Session replay for debugging
  replaysSessionSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,
  
  // Release information
  release: process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
  
  // Debug mode
  debug: env.NODE_ENV === 'development',
  
  // Integration configuration
  integrations: [
    // Sentry.replayIntegration({
    //   maskAllText: true,
    //   blockAllMedia: true,
    //   maskAllInputs: true,
    //   blockClass: 'sentry-block',
    //   ignoreClass: 'sentry-ignore',
    // }),
    // Sentry.browserTracingIntegration({
    //   // Enable automatic route change tracking
    //   routingInstrumentation: Sentry.nextRouterInstrumentation,
    //   
    //   // Capture interactions
    //   enableInp: true,
    //   enableUserInteractionTracing: true,
    //   
    //   // Custom transaction names
    //   beforeNavigate: (context) => {
    //     const { pathname, search } = context.location;
    //     
    //     // Sanitize sensitive data from URLs
    //     const sanitizedPathname = pathname.replace(/\/users\/\d+/, '/users/[id]');
    //     const sanitizedSearch = search.replace(/token=[^&]+/, 'token=***');
    //     
    //     return {
    //       ...context,
    //       name: `${sanitizedPathname}${sanitizedSearch}`,
    //     };
    //   },
    // }),
  ],
  
  // Performance monitoring configuration
  profilesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Error filtering
  beforeSend: (event, hint) => {
    // Filter out sensitive information
    if (event.request?.url) {
      event.request.url = event.request.url.replace(/token=[^&]+/, 'token=***');
    }
    
    // Filter out known bot errors
    if (event.request?.headers?.['user-agent']) {
      const userAgent = event.request.headers['user-agent'];
      if (/bot|crawler|spider|scraper/i.test(userAgent)) {
        return null;
      }
    }
    
    // Filter out development-only errors
    if (env.NODE_ENV === 'development') {
      const ignoredErrors = [
        'Non-Error promise rejection captured',
        'Network request failed',
        'Load failed',
        'Script error',
        'ResizeObserver loop limit exceeded',
        'ChunkLoadError',
      ];
      
      if (event.exception?.values?.[0]?.value) {
        const errorMessage = event.exception.values[0].value;
        if (ignoredErrors.some(ignored => errorMessage.includes(ignored))) {
          return null;
        }
      }
    }
    
    // Filter out CORS errors
    if (event.exception?.values?.[0]?.type === 'SecurityError') {
      return null;
    }
    
    // Filter out network errors that are not actionable
    if (event.exception?.values?.[0]?.value?.includes('fetch')) {
      const errorMessage = event.exception.values[0].value;
      if (errorMessage.includes('NetworkError') || errorMessage.includes('ERR_NETWORK')) {
        return null;
      }
    }
    
    return event;
  },
  
  // Tags for better error categorization
  initialScope: {
    tags: {
      component: 'client',
      runtime: 'browser',
    },
  },
  
  // Custom error boundaries
  beforeBreadcrumb: (breadcrumb) => {
    // Filter out sensitive breadcrumbs
    if (breadcrumb.category === 'fetch' && breadcrumb.data?.url) {
      breadcrumb.data.url = breadcrumb.data.url.replace(/token=[^&]+/, 'token=***');
    }
    
    // Filter out noisy console logs
    if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
      return null;
    }
    
    return breadcrumb;
  },
  
  // Transport options for better delivery (using default transport)
  // Note: Default transport is used automatically in Sentry v8
  // transport: Sentry.makeBrowserOfflineTransport(Sentry.makeFetchTransport),
  
  // Max breadcrumbs to keep
  maxBreadcrumbs: 50,
  
  // Capture unhandled promise rejections
  captureUnhandledRejections: true,
  
  // Capture uncaught exceptions
  captureUnhandledExceptions: true,
  
  // Tunnel for ad-blocker bypass (optional)
  tunnel: process.env.SENTRY_TUNNEL,
  
  // Disable automatic session tracking if not needed
  autoSessionTracking: true,
  
  // SDK metadata
  _metadata: {
    sdk: {
      name: 'sentry.javascript.nextjs',
      version: '8.46.0',
    },
  },
});

// Export configuration for external use
export const sentryClientConfig = {
  dsn: process.env.SENTRY_DSN,
  environment: env.NODE_ENV,
  tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
  debug: env.NODE_ENV === 'development',
};

// Custom hooks for React components
export function useSentryUser() {
  return {
    setUser: (user: { id: string; email?: string; username?: string }) => {
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.username,
      });
    },
    clearUser: () => {
      Sentry.setUser(null);
    },
  };
}

export function useSentryTags() {
  return {
    setTag: (key: string, value: string) => {
      Sentry.setTag(key, value);
    },
    setTags: (tags: Record<string, string>) => {
      Sentry.setTags(tags);
    },
  };
}

export function useSentryContext() {
  return {
    setContext: (key: string, context: Record<string, any>) => {
      Sentry.setContext(key, context);
    },
    addBreadcrumb: (breadcrumb: Parameters<typeof Sentry.addBreadcrumb>[0]) => {
      Sentry.addBreadcrumb(breadcrumb);
    },
  };
}