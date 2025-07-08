import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required').optional(),
  
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL').optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required if using Supabase').optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required for server-side Supabase operations').optional(),
  
  // Better Auth
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters long').optional(),
  BETTER_AUTH_URL: z.string().url('BETTER_AUTH_URL must be a valid URL').optional(),
  
  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long').optional(),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters long').optional(),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  
  // Environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  
  // Application
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  
  // Security
  CSRF_SECRET: z.string().min(32, 'CSRF_SECRET must be at least 32 characters long').optional(),
  CORS_ORIGIN: z.string().optional(),
  
  // Third-party Services
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required for email functionality').optional(),
  RESEND_FROM_NAME: z.string().default('Learning Assistant'),
  RESEND_FROM_EMAIL: z.string().email('RESEND_FROM_EMAIL must be a valid email address').optional(),
  RESEND_REPLY_TO: z.string().email('RESEND_REPLY_TO must be a valid email address').optional(),
  TAMBO_API_KEY: z.string().min(1, 'TAMBO_API_KEY is required for AI audio features').optional(),
  LINGO_DEV_API_KEY: z.string().min(1, 'LINGO_DEV_API_KEY is required for localization').optional(),
  FIRECRAWL_API_KEY: z.string().min(1, 'FIRECRAWL_API_KEY is required for web scraping').optional(),
  
  // Rate Limiting
  RATE_LIMIT_MAX: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1)).default('100'),
  RATE_LIMIT_WINDOW: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1)).default('60000'),
  
  // Redis Configuration
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1)).default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(0)).default('0'),
  REDIS_USERNAME: z.string().optional(),
  REDIS_TLS: z.string().transform((val) => val === 'true').optional(),
  REDIS_CLUSTER_ENABLED: z.string().transform((val) => val === 'true').default('false'),
  REDIS_CLUSTER_NODES: z.string().optional(),
  REDIS_CONNECTION_TIMEOUT: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1)).default('10000'),
  REDIS_COMMAND_TIMEOUT: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1)).default('5000'),
  REDIS_RETRY_ATTEMPTS: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1)).default('3'),
  REDIS_RETRY_DELAY: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1)).default('100'),
  REDIS_MAX_RETRIES_PER_REQUEST: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1)).default('3'),
  REDIS_POOL_MIN: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1)).default('2'),
  REDIS_POOL_MAX: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1)).default('10'),
  
  // Cache Configuration
  CACHE_TTL_DEFAULT: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1)).default('3600'),
  CACHE_TTL_SHORT: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1)).default('300'),
  CACHE_TTL_MEDIUM: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1)).default('1800'),
  CACHE_TTL_LONG: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1)).default('7200'),
  CACHE_COMPRESSION_ENABLED: z.string().transform((val) => val === 'true').default('true'),
  CACHE_COMPRESSION_THRESHOLD: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1)).default('1024'),
  CACHE_WARMING_ENABLED: z.string().transform((val) => val === 'true').default('true'),
  CACHE_METRICS_ENABLED: z.string().transform((val) => val === 'true').default('true'),
  
  // CDN Configuration (optional)
  CDN_DOMAIN: z.string().optional(),
  CLOUDFLARE_ZONE_ID: z.string().optional(),
  CLOUDFLARE_API_TOKEN: z.string().optional(),
  CLOUDFLARE_DOMAIN: z.string().optional(),
  CLOUDFRONT_DISTRIBUTION_ID: z.string().optional(),
  CLOUDFRONT_DOMAIN: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  
  // Performance Configuration (optional)
  ENABLE_CDN: z.string().transform((val) => val === 'true').default('false'),
  ENABLE_IMAGE_OPTIMIZATION: z.string().transform((val) => val === 'true').default('true'),
  ENABLE_PWA: z.string().transform((val) => val === 'true').default('true'),
  ENABLE_PERFORMANCE_MONITORING: z.string().transform((val) => val === 'true').default('true'),
  IMAGE_OPTIMIZATION_ENABLED: z.string().transform((val) => val === 'true').default('true'),
  IMAGE_CDN_ENABLED: z.string().transform((val) => val === 'true').default('false'),
  IMAGE_QUALITY_DEFAULT: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1).max(100)).default('85'),
  IMAGE_QUALITY_WEBP: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1).max(100)).default('80'),
  IMAGE_QUALITY_AVIF: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1).max(100)).default('75'),
  
  // PWA Configuration (optional)
  PWA_ENABLED: z.string().transform((val) => val === 'true').default('true'),
  SW_ENABLED: z.string().transform((val) => val === 'true').default('true'),
  OFFLINE_ENABLED: z.string().transform((val) => val === 'true').default('true'),
  PUSH_NOTIFICATIONS_ENABLED: z.string().transform((val) => val === 'true').default('false'),
  BACKGROUND_SYNC_ENABLED: z.string().transform((val) => val === 'true').default('true'),
  
  // Performance Monitoring (optional)
  PERF_MONITORING_ENABLED: z.string().transform((val) => val === 'true').default('true'),
  CORE_WEB_VITALS_ENABLED: z.string().transform((val) => val === 'true').default('true'),
  ANALYTICS_ENDPOINT: z.string().optional(),
  PERF_SAMPLE_RATE: z.string().transform((val) => parseFloat(val)).pipe(z.number().min(0).max(1)).default('0.1'),
  
  // Sentry Configuration
  SENTRY_DSN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_RELEASE: z.string().optional(),
  SENTRY_TUNNEL: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.string().transform((val) => parseFloat(val)).pipe(z.number().min(0).max(1)).default('0.1'),
  SENTRY_PROFILES_SAMPLE_RATE: z.string().transform((val) => parseFloat(val)).pipe(z.number().min(0).max(1)).default('0.1'),
  SENTRY_REPLAY_SESSION_SAMPLE_RATE: z.string().transform((val) => parseFloat(val)).pipe(z.number().min(0).max(1)).default('0.1'),
  SENTRY_REPLAY_ERROR_SAMPLE_RATE: z.string().transform((val) => parseFloat(val)).pipe(z.number().min(0).max(1)).default('1.0'),
  SENTRY_DEBUG: z.string().transform((val) => val === 'true').default('false'),
  SENTRY_IGNORE_ERRORS: z.string().optional(),
  SENTRY_DENY_URLS: z.string().optional(),
  SENTRY_ALLOW_URLS: z.string().optional(),
  
  // Application Version
  NEXT_PUBLIC_APP_VERSION: z.string().optional(),
  BUILD_TIME: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

function validateEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    console.error('❌ Environment validation failed:');
    result.error.issues.forEach((issue) => {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    });
    throw new Error('Invalid environment configuration');
  }
  
  return result.data;
}

// Generate secure secrets if not provided in development
function generateSecureSecret(): string {
  // Fallback - functional for development
  console.warn('⚠️  Using fallback secret generation method');
  return 'dev-' + Date.now().toString(36) + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
}

export function getValidatedEnv(): EnvConfig {
  // Skip validation if explicitly disabled (for build processes)
  if (process.env.SKIP_ENV_VALIDATION === 'true') {
    console.warn('⚠️  Environment validation skipped');
    return process.env as any;
  }

  // Also skip strict validation if we're skipping database connections (build time)
  if (process.env.SKIP_DB_CONNECTION === 'true') {
    console.warn('⚠️  Database connection skipped, using relaxed validation');
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      // In build mode, just log warnings instead of throwing
      console.warn('⚠️  Environment validation warnings (build mode):');
      result.error.issues.forEach((issue) => {
        console.warn(`  - ${issue.path.join('.')}: ${issue.message}`);
      });
    }
    return process.env as any;
  }

  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  // In development, generate secure secrets if not provided
  if (isDevelopment) {
    const secrets = [
      { key: 'BETTER_AUTH_SECRET', description: 'Better Auth authentication' },
      { key: 'JWT_SECRET', description: 'JWT token signing' },
      { key: 'JWT_REFRESH_SECRET', description: 'JWT refresh token signing' },
      { key: 'CSRF_SECRET', description: 'CSRF protection' }
    ];
    
    secrets.forEach(({ key, description }) => {
      if (!process.env[key]) {
        process.env[key] = generateSecureSecret();
        console.warn(`⚠️  Generated ${key} for ${description}. Add to .env.local for persistence.`);
      }
    });
  }

  // In production, validate required secrets are present (unless explicitly skipped)
  if (isProduction && process.env.SKIP_DB_CONNECTION !== 'true') {
    const requiredSecrets = [
      'BETTER_AUTH_SECRET',
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'CSRF_SECRET'
    ];
    
    const missingSecrets = requiredSecrets.filter(key => !process.env[key]);
    if (missingSecrets.length > 0) {
      console.error('❌ Missing required secrets in production:');
      missingSecrets.forEach(key => console.error(`  - ${key}`));
      throw new Error(`Missing required secrets in production: ${missingSecrets.join(', ')}`);
    }
  }
  
  return validateEnv();
}

// Export singleton instance
export const env = getValidatedEnv();