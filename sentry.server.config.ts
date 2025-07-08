import * as Sentry from '@sentry/nextjs';
import { env } from './src/lib/env-validation';

// Initialize Sentry for server-side
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  // Environment configuration
  environment: env.NODE_ENV,
  
  // Performance monitoring
  tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Profiling
  profilesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Release information
  release: process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
  
  // Debug mode
  debug: env.NODE_ENV === 'development',
  
  // Integration configuration - use default integrations to avoid compatibility issues
  // Note: In Sentry v8 for Next.js, most integrations are auto-enabled by default
  // We'll let Sentry handle automatic instrumentation but with reduced scope
  integrations: [
    // Use the default integrations but filter them at runtime
    // This approach avoids webpack warnings while maintaining functionality
  ],
  
  // Server-specific configuration
  beforeSend: (event, hint) => {
    // Filter out sensitive information from server errors
    if (event.request?.data) {
      const data = event.request.data;
      if (typeof data === 'object' && data !== null) {
        // Remove sensitive fields
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
        const sanitizedData = { ...data };
        
        for (const field of sensitiveFields) {
          if (field in sanitizedData) {
            sanitizedData[field] = '***';
          }
        }
        
        event.request.data = sanitizedData;
      }
    }
    
    // Filter out headers with sensitive information
    if (event.request?.headers) {
      const sanitizedHeaders = { ...event.request.headers };
      const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
      
      for (const header of sensitiveHeaders) {
        if (header in sanitizedHeaders) {
          sanitizedHeaders[header] = '***';
        }
      }
      
      event.request.headers = sanitizedHeaders;
    }
    
    // Filter out database connection strings
    if (event.exception?.values) {
      event.exception.values = event.exception.values.map(value => ({
        ...value,
        value: value.value?.replace(/postgres:\/\/[^@]+@/, 'postgres://***@') || value.value,
      }));
    }
    
    // Filter out health check errors
    if (event.request?.url?.includes('/api/health')) {
      return null;
    }
    
    // Filter out common bot requests
    if (event.request?.headers?.['user-agent']) {
      const userAgent = event.request.headers['user-agent'];
      if (/bot|crawler|spider|scraper/i.test(userAgent)) {
        return null;
      }
    }
    
    // Filter out development-only errors
    if (env.NODE_ENV === 'development') {
      const ignoredErrors = [
        'ECONNREFUSED',
        'ENOTFOUND',
        'Module not found',
        'Can\'t resolve',
        'HMR',
        'Fast Refresh',
      ];
      
      if (event.exception?.values?.[0]?.value) {
        const errorMessage = event.exception.values[0].value;
        if (ignoredErrors.some(ignored => errorMessage.includes(ignored))) {
          return null;
        }
      }
    }
    
    return event;
  },
  
  // Tags for better error categorization
  initialScope: {
    tags: {
      component: 'server',
      runtime: 'nodejs',
    },
  },
  
  // Custom breadcrumb filtering
  beforeBreadcrumb: (breadcrumb) => {
    // Filter out sensitive breadcrumbs
    if (breadcrumb.category === 'http' && breadcrumb.data?.url) {
      breadcrumb.data.url = breadcrumb.data.url.replace(/token=[^&]+/, 'token=***');
    }
    
    // Filter out database queries with sensitive data
    if (breadcrumb.category === 'query' && breadcrumb.message) {
      breadcrumb.message = breadcrumb.message.replace(/password\s*=\s*'[^']*'/gi, "password='***'");
    }
    
    // Filter out noisy console logs
    if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
      return null;
    }
    
    return breadcrumb;
  },
  
  // Max breadcrumbs to keep
  maxBreadcrumbs: 100,
  
  // Capture unhandled promise rejections
  captureUnhandledRejections: true,
  
  // Capture uncaught exceptions
  captureUnhandledExceptions: true,
  
  // Disable automatic session tracking on server
  autoSessionTracking: false,
  
  // Server-specific transport options (using default transport)
  // Note: makeNodeTransport is used by default in Sentry v8
  // transport: Sentry.makeNodeTransport,
  
  // SDK metadata
  _metadata: {
    sdk: {
      name: 'sentry.javascript.nextjs',
      version: '8.46.0',
    },
  },
});

// Export configuration for external use
export const sentryServerConfig = {
  dsn: process.env.SENTRY_DSN,
  environment: env.NODE_ENV,
  tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
  profilesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
  debug: env.NODE_ENV === 'development',
};

// Server-specific error handling utilities
export function captureServerError(error: Error, context?: Record<string, any>) {
  return Sentry.captureException(error, {
    tags: {
      component: 'server',
      ...context?.tags,
    },
    extra: {
      timestamp: new Date().toISOString(),
      ...context?.extra,
    },
    contexts: {
      server: {
        runtime: 'nodejs',
        version: process.version,
        platform: process.platform,
        ...context?.server,
      },
      ...context?.contexts,
    },
  });
}

export function captureServerMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>) {
  return Sentry.captureMessage(message, {
    level,
    tags: {
      component: 'server',
      ...context?.tags,
    },
    extra: {
      timestamp: new Date().toISOString(),
      ...context?.extra,
    },
  });
}

export function withSentryServerTrace<T>(
  name: string,
  operation: () => T | Promise<T>,
  context?: Record<string, any>
): Promise<T> {
  return Sentry.startSpan(
    {
      name,
      op: 'function',
      tags: {
        component: 'server',
        ...context?.tags,
      },
      data: context?.data,
    },
    operation
  );
}

// Database error handling
export function captureDatabaseError(error: Error, query?: string, params?: any[]) {
  return captureServerError(error, {
    tags: {
      component: 'database',
      error_type: 'database',
    },
    extra: {
      query: query?.replace(/password\s*=\s*'[^']*'/gi, "password='***'"),
      params: params?.map(param => 
        typeof param === 'string' && param.length > 50 ? '[TRUNCATED]' : param
      ),
    },
  });
}

// API error handling
export function captureApiError(error: Error, request?: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
}) {
  return captureServerError(error, {
    tags: {
      component: 'api',
      error_type: 'api',
      method: request?.method,
    },
    extra: {
      url: request?.url,
      headers: request?.headers ? Object.keys(request.headers) : undefined,
      body: request?.body ? '[REDACTED]' : undefined,
    },
  });
}

// External service error handling
export function captureExternalServiceError(error: Error, service: string, operation?: string) {
  return captureServerError(error, {
    tags: {
      component: 'external_service',
      service,
      operation,
      error_type: 'external_service',
    },
    extra: {
      service,
      operation,
    },
  });
}

// Performance monitoring
export function startServerTransaction(name: string, op: string = 'http.server', context?: Record<string, any>) {
  return Sentry.startSpan({
    name,
    op,
    forceTransaction: true,
    attributes: {
      component: 'server',
      ...context?.data,
    },
  }, (span) => span);
}

// Custom context setters for server
export function setSentryServerContext(key: string, context: Record<string, any>) {
  Sentry.setContext(key, context);
}

export function setSentryServerUser(user: { id: string; email?: string; username?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });
}

export function setSentryServerTags(tags: Record<string, string>) {
  Sentry.setTags(tags);
}