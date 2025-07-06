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
} as const;

export type Config = typeof config;