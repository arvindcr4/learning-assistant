// Configuration for the Personal Learning Assistant

export const config = {
  app: {
    name: 'Personal Learning Assistant',
    version: '1.0.0',
    description: 'Your AI-powered companion for personalized learning',
  },
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
    timeout: 10000,
  },
  features: {
    chat: {
      enabled: true,
      maxMessages: 100,
      typingDelay: 1000,
    },
    quiz: {
      defaultTimeLimit: 30, // minutes
      maxQuestions: 50,
      passingScore: 80,
    },
    progress: {
      trackingEnabled: true,
      syncInterval: 5000, // milliseconds
    },
  },
  storage: {
    prefix: 'learning-assistant',
    version: '1.0',
  },
  ui: {
    theme: {
      default: 'light',
      storageKey: 'theme',
    },
    animations: {
      enabled: true,
      duration: 300,
    },
  },
  email: {
    service: 'resend',
    enabled: process.env.NODE_ENV === 'production' || process.env.ENABLE_EMAIL === 'true',
    fromName: process.env.RESEND_FROM_NAME || 'Learning Assistant',
    fromEmail: process.env.RESEND_FROM_EMAIL || 'noreply@learningassistant.com',
    replyTo: process.env.RESEND_REPLY_TO,
    rateLimiting: {
      enabled: true,
      maxPerMinute: 10,
      maxPerHour: 100,
    },
  },
} as const;

export type Config = typeof config;