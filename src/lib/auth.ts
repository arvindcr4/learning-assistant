import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

import { env } from "./env-validation";
import { generateUUID } from "@/utils/uuid";

export const auth = betterAuth({
  database: {
    provider: "pg", // Changed from sqlite to pg for PostgreSQL/Supabase
    url: env.DATABASE_URL,
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
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.User;