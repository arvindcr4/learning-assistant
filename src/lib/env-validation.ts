import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL').optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required if using Supabase').optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required for server-side Supabase operations').optional(),
  
  // Better Auth
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters long'),
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
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

export function getValidatedEnv(): EnvConfig {
  // Skip validation if explicitly disabled (for build processes)
  if (process.env.SKIP_ENV_VALIDATION === 'true') {
    console.warn('⚠️  Environment validation skipped');
    return process.env as any;
  }

  // In development, generate secure secrets if not provided
  if (process.env.NODE_ENV === 'development') {
    if (!process.env.BETTER_AUTH_SECRET) {
      process.env.BETTER_AUTH_SECRET = generateSecureSecret();
      console.warn('⚠️  Generated BETTER_AUTH_SECRET for development. Add to .env.local for persistence.');
    }
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = generateSecureSecret();
      console.warn('⚠️  Generated JWT_SECRET for development. Add to .env.local for persistence.');
    }
    if (!process.env.JWT_REFRESH_SECRET) {
      process.env.JWT_REFRESH_SECRET = generateSecureSecret();
      console.warn('⚠️  Generated JWT_REFRESH_SECRET for development. Add to .env.local for persistence.');
    }
    if (!process.env.CSRF_SECRET) {
      process.env.CSRF_SECRET = generateSecureSecret();
      console.warn('⚠️  Generated CSRF_SECRET for development. Add to .env.local for persistence.');
    }
  }
  
  return validateEnv();
}

// Export singleton instance
export const env = getValidatedEnv();