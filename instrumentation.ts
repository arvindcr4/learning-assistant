import { env } from './src/lib/env-validation';

export async function register() {
  // Server-side instrumentation
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Import server Sentry config
    await import('./sentry.server.config');
    
    // Additional server-side monitoring
    if (env.NODE_ENV === 'production') {
      console.log('✅ Server-side monitoring initialized');
    }
  }

  // Edge runtime instrumentation
  if (process.env.NEXT_RUNTIME === 'edge') {
    // Import server Sentry config for edge
    await import('./sentry.server.config');
    
    if (env.NODE_ENV === 'production') {
      console.log('✅ Edge runtime monitoring initialized');
    }
  }

  // Client-side instrumentation happens in sentry.client.config.ts
  if (typeof window !== 'undefined') {
    console.log('✅ Client-side monitoring will be initialized');
  }
}