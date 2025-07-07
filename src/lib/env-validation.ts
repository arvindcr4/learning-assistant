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