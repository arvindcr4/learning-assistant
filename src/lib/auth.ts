import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

import { env } from "./env-validation";
import { generateUUID } from "@/utils/uuid";

// Check if we're in build time to avoid database connection issues
const isBuildTime = process.env.SKIP_DB_CONNECTION === 'true' || 
  (process.env.NODE_ENV === 'production' && 
   process.env.VERCEL_ENV === undefined && 
   process.env.RAILWAY_ENVIRONMENT === undefined &&
   process.env.FLY_APP_NAME === undefined);

// Create auth configuration with conditional database setup
function createAuthConfig() {
  // During build time, use a minimal configuration to avoid database connection issues
  if (isBuildTime || process.env.SKIP_DB_CONNECTION === 'true') {
    return {
      database: {
        provider: "pg" as const,
        url: 'postgresql://localhost:5432/temp_build_db', // Temporary URL for build
      },
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
        autoSignIn: false,
      },
      session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // 1 day
      },
      secret: env.BETTER_AUTH_SECRET || "build-time-secret-key-32-chars-long",
      baseURL: env.BETTER_AUTH_URL || env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      trustedOrigins: [
        env.BETTER_AUTH_URL || env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      ],
      plugins: [
        nextCookies({
          secure: false,
          sameSite: "lax",
          httpOnly: true,
        }),
      ],
    };
  }

  // Runtime configuration with full database setup
  return {
    database: {
      provider: "pg" as const,
      url: env.DATABASE_URL || process.env.DATABASE_URL || 'postgresql://localhost:5432/learning_assistant',
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: env.NODE_ENV === "production", // Require email verification in production
      autoSignIn: env.NODE_ENV === "development", // Auto sign in during development
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minutes
      },
    },
    user: {
      additionalFields: {
        firstName: {
          type: "string",
          required: false,
        },
        lastName: {
          type: "string",
          required: false,
        },
        role: {
          type: "string",
          required: false,
          defaultValue: "user",
        },
        preferences: {
          type: "string", // JSON string for user preferences
          required: false,
        },
        lastLoginAt: {
          type: "date",
          required: false,
        },
        loginAttempts: {
          type: "number",
          required: false,
          defaultValue: 0,
        },
        lockedUntil: {
          type: "date",
          required: false,
        },
      },
    },
    plugins: [
      nextCookies({
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        httpOnly: true,
        domain: env.NODE_ENV === "production" ? undefined : "localhost",
      }),
    ],
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL || env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    trustedOrigins: [
      env.BETTER_AUTH_URL || env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      ...(env.CORS_ORIGIN ? env.CORS_ORIGIN.split(',') : []),
    ],
    advanced: {
      generateId: () => generateUUID(),
      crossSubDomainCookies: {
        enabled: env.NODE_ENV === "production",
        domain: env.NODE_ENV === "production" ? undefined : "localhost",
      },
    },
    rateLimit: {
      enabled: true,
      storage: "memory",
      tableName: "rate_limit",
      window: env.RATE_LIMIT_WINDOW / 1000, // Convert to seconds
      max: env.RATE_LIMIT_MAX,
    },
  };
}

// Create auth instance with error handling
let auth: any;
try {
  auth = betterAuth(createAuthConfig());
} catch (error) {
  console.warn('BetterAuth initialization failed during build time:', error instanceof Error ? error.message : error);
  // Create a minimal auth object for build time
  auth = {
    api: {
      getSession: () => Promise.resolve(null),
    },
    $Infer: {
      Session: {} as any,
      User: {} as any,
    },
  };
}

export { auth };
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.User;