// Constants for the Personal Learning Assistant

export const APP_NAME = 'Personal Learning Assistant';
export const APP_DESCRIPTION = 'Your AI-powered companion for personalized learning and skill development';

export const DIFFICULTY_LEVELS = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
} as const;

export const CONTENT_TYPES = {
  READING: 'reading',
  VIDEO: 'video',
  INTERACTIVE: 'interactive',
  QUIZ: 'quiz',
} as const;

export const QUESTION_TYPES = {
  MULTIPLE_CHOICE: 'multiple-choice',
  TRUE_FALSE: 'true-false',
  SHORT_ANSWER: 'short-answer',
} as const;

export const RESOURCE_TYPES = {
  LINK: 'link',
  FILE: 'file',
  VIDEO: 'video',
  ARTICLE: 'article',
} as const;

export const DEFAULT_STUDY_GOAL = 30; // minutes per day
export const DEFAULT_PASSING_SCORE = 80; // percentage
export const MAX_QUIZ_TIME = 60; // minutes
export const DEBOUNCE_DELAY = 300; // milliseconds

export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  LEARNING_PATHS: '/learning-paths',
  QUIZ: '/quiz',
  PROGRESS: '/progress',
  CHAT: '/chat',
  SETTINGS: '/settings',
  PROFILE: '/profile',
} as const;

export const API_ENDPOINTS = {
  AUTH: '/api/auth',
  USERS: '/api/users',
  LEARNING_PATHS: '/api/learning-paths',
  MODULES: '/api/modules',
  QUIZ: '/api/quiz',
  PROGRESS: '/api/progress',
  CHAT: '/api/chat',
} as const;

export const STORAGE_KEYS = {
  USER_PREFERENCES: 'user-preferences',
  STUDY_PROGRESS: 'study-progress',
  THEME: 'theme',
  LANGUAGE: 'language',
} as const;

export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
} as const;

export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
} as const;