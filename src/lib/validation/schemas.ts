import { z } from 'zod';

// ====================
// COMMON/SHARED SCHEMAS
// ====================

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const emailSchema = z
  .string()
  .email('Invalid email format')
  .min(5, 'Email must be at least 5 characters')
  .max(254, 'Email must not exceed 254 characters')
  .toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character');

export const nameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must not exceed 100 characters')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
  .trim();

export const urlSchema = z
  .string()
  .url('Invalid URL format')
  .max(2048, 'URL must not exceed 2048 characters');

export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
  .optional();

export const paginationSchema = z.object({
  page: z.coerce.number().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce.number().min(1, 'Limit must be at least 1').max(100, 'Limit must not exceed 100').default(10),
  offset: z.coerce.number().min(0, 'Offset must be at least 0').default(0),
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime('Invalid start date format').optional(),
  endDate: z.string().datetime('Invalid end date format').optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
);

// ====================
// USER SCHEMAS
// ====================

export const userRegistrationSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  termsAccepted: z.boolean().refine(val => val === true, 'You must accept the terms and conditions'),
  marketing: z.boolean().default(false),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
);

export const userLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

export const userProfileUpdateSchema = z.object({
  name: nameSchema.optional(),
  email: emailSchema.optional(),
  avatar: urlSchema.optional(),
  phone: phoneSchema,
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'system']).default('system'),
    language: z.string().min(2).max(5).default('en'),
    notifications: z.object({
      email: z.boolean().default(true),
      push: z.boolean().default(true),
      reminders: z.boolean().default(true),
    }).default({}),
    learningGoals: z.array(z.string().min(1).max(200)).max(10, 'Maximum 10 learning goals allowed').default([]),
    preferredTopics: z.array(z.string().min(1).max(100)).max(20, 'Maximum 20 topics allowed').default([]),
    difficultyLevel: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
    studySchedule: z.object({
      dailyGoal: z.number().min(5, 'Daily goal must be at least 5 minutes').max(720, 'Daily goal must not exceed 12 hours').default(30),
      preferredTimes: z.array(z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)')).max(5, 'Maximum 5 preferred times').default([]),
      daysPerWeek: z.number().min(1, 'At least 1 day per week').max(7, 'Maximum 7 days per week').default(5),
    }).default({}),
  }).default({}),
}).refine(
  (data) => {
    if (data.email && data.name) {
      return true; // At least one field must be updated
    }
    return Object.keys(data).length > 0;
  },
  {
    message: 'At least one field must be updated',
    path: ['root'],
  }
);

export const passwordResetSchema = z.object({
  email: emailSchema,
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine(
  (data) => data.newPassword === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
).refine(
  (data) => data.currentPassword !== data.newPassword,
  {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  }
);

// ====================
// LEARNING SCHEMAS
// ====================

export const learningStyleSchema = z.enum(['visual', 'auditory', 'reading', 'kinesthetic']);

export const difficultyLevelSchema = z.enum(['beginner', 'intermediate', 'advanced']);

export const contentTypeSchema = z.enum(['reading', 'video', 'interactive', 'quiz', 'simulation', 'audio']);

export const learningSessionSchema = z.object({
  userId: uuidSchema,
  contentId: z.string().min(1, 'Content ID is required').max(100),
  moduleId: z.string().min(1, 'Module ID is required').max(100).optional(),
  pathId: z.string().min(1, 'Path ID is required').max(100).optional(),
  startTime: z.string().datetime('Invalid start time format'),
  endTime: z.string().datetime('Invalid end time format').optional(),
  duration: z.number().min(0, 'Duration must be non-negative').max(14400, 'Duration must not exceed 4 hours (in seconds)').optional(),
  itemsCompleted: z.number().min(0, 'Items completed must be non-negative').max(1000, 'Items completed seems too high').default(0),
  correctAnswers: z.number().min(0, 'Correct answers must be non-negative').max(1000, 'Correct answers seems too high').default(0),
  totalQuestions: z.number().min(0, 'Total questions must be non-negative').max(1000, 'Total questions seems too high').default(0),
  score: z.number().min(0, 'Score must be non-negative').max(100, 'Score must not exceed 100').optional(),
  completed: z.boolean().default(false),
  notes: z.string().max(2000, 'Notes must not exceed 2000 characters').optional(),
  engagementMetrics: z.object({
    focusTime: z.number().min(0).max(14400).default(0),
    distractionEvents: z.number().min(0).max(1000).default(0),
    interactionRate: z.number().min(0).max(100).default(0),
    scrollDepth: z.number().min(0).max(100).default(0),
    videoWatchTime: z.number().min(0).max(14400).default(0),
    pauseFrequency: z.number().min(0).max(100).default(0),
  }).default({}),
}).refine(
  (data) => {
    if (data.correctAnswers && data.totalQuestions) {
      return data.correctAnswers <= data.totalQuestions;
    }
    return true;
  },
  {
    message: 'Correct answers cannot exceed total questions',
    path: ['correctAnswers'],
  }
).refine(
  (data) => {
    if (data.startTime && data.endTime) {
      return new Date(data.startTime) <= new Date(data.endTime);
    }
    return true;
  },
  {
    message: 'End time must be after start time',
    path: ['endTime'],
  }
);

export const learningProgressSchema = z.object({
  userId: uuidSchema,
  pathId: z.string().min(1, 'Path ID is required').max(100),
  moduleId: z.string().min(1, 'Module ID is required').max(100),
  completed: z.boolean().default(false),
  score: z.number().min(0, 'Score must be non-negative').max(100, 'Score must not exceed 100').optional(),
  timeSpent: z.number().min(0, 'Time spent must be non-negative').max(86400, 'Time spent must not exceed 24 hours (in seconds)').default(0),
  lastAccessed: z.string().datetime('Invalid last accessed time format'),
  attempts: z.number().min(1, 'Attempts must be at least 1').max(10, 'Maximum 10 attempts allowed').default(1),
});

export const varkAssessmentSchema = z.object({
  userId: uuidSchema,
  responses: z.record(
    z.string().regex(/^q\d+$/, 'Question ID must be in format q1, q2, etc.'),
    z.string().min(1, 'Response cannot be empty').max(10, 'Response too long')
  ).refine(
    (data) => Object.keys(data).length >= 16,
    'All 16 questions must be answered'
  ),
  completedAt: z.string().datetime('Invalid completion time format').optional(),
});

export const learningPathSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200, 'Title must not exceed 200 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000, 'Description must not exceed 2000 characters'),
  difficulty: difficultyLevelSchema,
  estimatedDuration: z.number().min(1, 'Estimated duration must be at least 1 minute').max(10080, 'Estimated duration must not exceed 1 week (in minutes)'),
  topics: z.array(z.string().min(1).max(100)).min(1, 'At least one topic is required').max(20, 'Maximum 20 topics allowed'),
  prerequisites: z.array(z.string().min(1).max(100)).max(10, 'Maximum 10 prerequisites allowed').default([]),
  learningObjectives: z.array(z.string().min(10).max(500)).min(1, 'At least one learning objective is required').max(10, 'Maximum 10 learning objectives allowed'),
  isPublic: z.boolean().default(false),
  tags: z.array(z.string().min(1).max(50)).max(10, 'Maximum 10 tags allowed').default([]),
});

// ====================
// ASSESSMENT SCHEMAS
// ====================

export const questionTypeSchema = z.enum(['multiple-choice', 'true-false', 'short-answer', 'essay', 'drag-drop', 'simulation']);

export const questionSchema = z.object({
  id: z.string().min(1, 'Question ID is required').max(100),
  text: z.string().min(5, 'Question text must be at least 5 characters').max(2000, 'Question text must not exceed 2000 characters'),
  type: questionTypeSchema,
  difficulty: z.number().min(1, 'Difficulty must be at least 1').max(10, 'Difficulty must not exceed 10'),
  points: z.number().min(0.1, 'Points must be at least 0.1').max(100, 'Points must not exceed 100'),
  timeLimit: z.number().min(10, 'Time limit must be at least 10 seconds').max(3600, 'Time limit must not exceed 1 hour').optional(),
  options: z.array(z.object({
    id: z.string().min(1).max(100),
    text: z.string().min(1, 'Option text is required').max(500, 'Option text must not exceed 500 characters'),
    isCorrect: z.boolean().default(false),
    explanation: z.string().max(1000, 'Explanation must not exceed 1000 characters').optional(),
  })).min(2, 'At least 2 options are required for multiple choice questions').max(10, 'Maximum 10 options allowed').optional(),
  correctAnswer: z.union([z.string(), z.number(), z.array(z.string())]).optional(),
  explanation: z.string().max(2000, 'Explanation must not exceed 2000 characters').optional(),
  hints: z.array(z.string().min(1).max(500)).max(5, 'Maximum 5 hints allowed').default([]),
  tags: z.array(z.string().min(1).max(50)).max(10, 'Maximum 10 tags allowed').default([]),
});

export const assessmentSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200, 'Title must not exceed 200 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000, 'Description must not exceed 2000 characters'),
  type: z.enum(['quiz', 'test', 'exam', 'practice', 'diagnostic']).default('quiz'),
  questions: z.array(questionSchema).min(1, 'At least one question is required').max(100, 'Maximum 100 questions allowed'),
  timeLimit: z.number().min(1, 'Time limit must be at least 1 minute').max(480, 'Time limit must not exceed 8 hours (in minutes)').optional(),
  passingScore: z.number().min(0, 'Passing score must be at least 0').max(100, 'Passing score must not exceed 100').default(70),
  maxAttempts: z.number().min(1, 'Max attempts must be at least 1').max(10, 'Maximum 10 attempts allowed').default(3),
  isPublic: z.boolean().default(false),
  tags: z.array(z.string().min(1).max(50)).max(10, 'Maximum 10 tags allowed').default([]),
  difficulty: difficultyLevelSchema.default('beginner'),
});

export const assessmentSubmissionSchema = z.object({
  userId: uuidSchema,
  assessmentId: z.string().min(1, 'Assessment ID is required').max(100),
  answers: z.record(
    z.string().min(1, 'Question ID is required'),
    z.union([z.string(), z.number(), z.array(z.string()), z.boolean()])
  ).refine(
    (data) => Object.keys(data).length > 0,
    'At least one answer is required'
  ),
  timeSpent: z.number().min(1, 'Time spent must be at least 1 second').max(28800, 'Time spent must not exceed 8 hours (in seconds)'),
  startTime: z.string().datetime('Invalid start time format'),
  endTime: z.string().datetime('Invalid end time format'),
  attempt: z.number().min(1, 'Attempt number must be at least 1').max(10, 'Maximum 10 attempts allowed').default(1),
});

// ====================
// CHAT SCHEMAS
// ====================

export const chatMessageSchema = z.object({
  content: z.string().min(1, 'Message content is required').max(4000, 'Message content must not exceed 4000 characters'),
  role: z.enum(['user', 'assistant', 'system']).default('user'),
  sessionId: z.string().min(1, 'Session ID is required').max(100).optional(),
  context: z.object({
    currentModule: z.string().max(100).optional(),
    currentPath: z.string().max(100).optional(),
    learningStyle: learningStyleSchema.optional(),
    difficultyLevel: difficultyLevelSchema.optional(),
    recentMistakes: z.array(z.string().max(200)).max(10, 'Maximum 10 recent mistakes').default([]),
    strengths: z.array(z.string().max(200)).max(10, 'Maximum 10 strengths').default([]),
    weaknesses: z.array(z.string().max(200)).max(10, 'Maximum 10 weaknesses').default([]),
  }).optional(),
  attachments: z.array(z.object({
    type: z.enum(['image', 'file', 'code', 'diagram', 'link']),
    url: urlSchema.optional(),
    content: z.string().max(10000, 'Attachment content must not exceed 10000 characters').optional(),
    metadata: z.record(z.any()).optional(),
  })).max(5, 'Maximum 5 attachments allowed').default([]),
});

export const chatSessionSchema = z.object({
  userId: uuidSchema,
  title: z.string().min(1, 'Session title is required').max(200, 'Session title must not exceed 200 characters'),
  description: z.string().max(1000, 'Session description must not exceed 1000 characters').optional(),
  type: z.enum(['general', 'tutoring', 'assessment', 'review']).default('general'),
  settings: z.object({
    aiPersona: z.enum(['educational_tutor', 'learning_companion', 'subject_expert', 'mentor']).default('educational_tutor'),
    adaptiveMode: z.boolean().default(true),
    tutorialMode: z.boolean().default(false),
    assessmentMode: z.boolean().default(false),
    conversationStyle: z.enum(['socratic', 'direct', 'guided', 'exploratory']).default('guided'),
    difficultyAdjustment: z.boolean().default(true),
    contextAwareness: z.boolean().default(true),
    proactiveHints: z.boolean().default(true),
    encouragementLevel: z.enum(['minimal', 'moderate', 'high']).default('moderate'),
  }).default({}),
});

// ====================
// CONTENT SCHEMAS
// ====================

export const contentSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200, 'Title must not exceed 200 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000, 'Description must not exceed 2000 characters'),
  content: z.string().min(50, 'Content must be at least 50 characters').max(50000, 'Content must not exceed 50000 characters'),
  type: contentTypeSchema,
  difficulty: z.number().min(1, 'Difficulty must be at least 1').max(10, 'Difficulty must not exceed 10'),
  estimatedDuration: z.number().min(1, 'Estimated duration must be at least 1 minute').max(240, 'Estimated duration must not exceed 4 hours (in minutes)'),
  learningObjectives: z.array(z.string().min(10).max(500)).min(1, 'At least one learning objective is required').max(10, 'Maximum 10 learning objectives allowed'),
  prerequisites: z.array(z.string().min(1).max(100)).max(10, 'Maximum 10 prerequisites allowed').default([]),
  tags: z.array(z.string().min(1).max(50)).max(20, 'Maximum 20 tags allowed').default([]),
  language: z.string().min(2, 'Language code must be at least 2 characters').max(5, 'Language code must not exceed 5 characters').default('en'),
  isPublic: z.boolean().default(false),
  metadata: z.record(z.any()).optional(),
  resources: z.array(z.object({
    title: z.string().min(1, 'Resource title is required').max(200, 'Resource title must not exceed 200 characters'),
    type: z.enum(['link', 'file', 'video', 'article', 'book', 'tool']),
    url: urlSchema,
    description: z.string().max(1000, 'Resource description must not exceed 1000 characters').optional(),
  })).max(20, 'Maximum 20 resources allowed').default([]),
});

export const contentAdaptationSchema = z.object({
  userId: uuidSchema,
  contentId: z.string().min(1, 'Content ID is required').max(100),
  learningStyle: learningStyleSchema,
  difficultyLevel: difficultyLevelSchema,
  personalizations: z.object({
    pace: z.enum(['slow', 'normal', 'fast']).default('normal'),
    interactivity: z.enum(['low', 'medium', 'high']).default('medium'),
    examples: z.boolean().default(true),
    exercises: z.boolean().default(true),
    feedback: z.enum(['minimal', 'standard', 'detailed']).default('standard'),
  }).default({}),
});

// ====================
// ANALYTICS SCHEMAS
// ====================

export const analyticsEventSchema = z.object({
  userId: uuidSchema,
  eventType: z.enum(['page_view', 'interaction', 'completion', 'error', 'engagement', 'assessment']),
  eventData: z.object({
    page: z.string().max(200).optional(),
    action: z.string().max(100).optional(),
    category: z.string().max(100).optional(),
    label: z.string().max(200).optional(),
    value: z.number().optional(),
    duration: z.number().min(0).max(86400).optional(),
    metadata: z.record(z.any()).optional(),
  }).optional(),
  timestamp: z.string().datetime('Invalid timestamp format').optional(),
  sessionId: z.string().max(100).optional(),
  ip: z.string().max(45).optional(),
  userAgent: z.string().max(500).optional(),
});

export const analyticsQuerySchema = z.object({
  userId: uuidSchema,
  timeRange: z.object({
    start: z.string().datetime('Invalid start time format'),
    end: z.string().datetime('Invalid end time format'),
  }).refine(
    (data) => new Date(data.start) <= new Date(data.end),
    {
      message: 'End time must be after start time',
      path: ['end'],
    }
  ),
  metrics: z.array(z.enum(['progress', 'engagement', 'performance', 'time_spent', 'completion_rate'])).min(1, 'At least one metric is required').max(10, 'Maximum 10 metrics allowed'),
  granularity: z.enum(['hourly', 'daily', 'weekly', 'monthly']).default('daily'),
  filters: z.object({
    contentType: contentTypeSchema.optional(),
    difficulty: difficultyLevelSchema.optional(),
    topics: z.array(z.string().max(100)).max(10, 'Maximum 10 topics filter').optional(),
  }).optional(),
});

// ====================
// SYSTEM SCHEMAS
// ====================

export const systemConfigSchema = z.object({
  adaptationSettings: z.object({
    minDataPoints: z.number().min(1).max(1000).default(10),
    confidenceThreshold: z.number().min(0).max(1).default(0.7),
    adaptationSpeed: z.enum(['slow', 'medium', 'fast']).default('medium'),
    maxDifficultyChange: z.number().min(0.1).max(5).default(1),
    enableRealTimeAdaptation: z.boolean().default(true),
  }).default({}),
  contentSettings: z.object({
    defaultLanguage: z.string().min(2).max(5).default('en'),
    supportedLanguages: z.array(z.string().min(2).max(5)).default(['en']),
    maxContentLength: z.number().min(100).max(100000).default(50000),
    enableMultimodal: z.boolean().default(true),
    accessibilityLevel: z.enum(['basic', 'enhanced', 'full']).default('enhanced'),
  }).default({}),
  assessmentSettings: z.object({
    defaultQuestionCount: z.number().min(1).max(100).default(10),
    minPassingScore: z.number().min(0).max(100).default(60),
    enableAdaptiveQuestioning: z.boolean().default(true),
    maxAttempts: z.number().min(1).max(10).default(3),
    timeouts: z.object({
      question: z.number().min(10).max(3600).default(300),
      assessment: z.number().min(60).max(14400).default(1800),
    }).default({}),
  }).default({}),
  privacySettings: z.object({
    dataCollection: z.enum(['minimal', 'standard', 'comprehensive']).default('standard'),
    shareWithEducators: z.boolean().default(false),
    anonymizeData: z.boolean().default(true),
    dataExportEnabled: z.boolean().default(true),
    retentionDays: z.number().min(30).max(2555).default(365),
  }).default({}),
});

// ====================
// ERROR SCHEMAS
// ====================

export const errorResponseSchema = z.object({
  error: z.string().min(1, 'Error message is required'),
  message: z.string().min(1, 'Error description is required'),
  code: z.string().min(1, 'Error code is required'),
  details: z.record(z.any()).optional(),
  timestamp: z.string().datetime().optional(),
  requestId: z.string().optional(),
});

// ====================
// RATE LIMITING SCHEMAS
// ====================

export const rateLimitSchema = z.object({
  windowMs: z.number().min(1000).max(3600000).default(900000), // 15 minutes
  maxRequests: z.number().min(1).max(10000).default(100),
  message: z.string().min(1).max(200).default('Too many requests from this IP'),
  standardHeaders: z.boolean().default(true),
  legacyHeaders: z.boolean().default(false),
});

// ====================
// EXPORT TYPES
// ====================

export type UserRegistration = z.infer<typeof userRegistrationSchema>;
export type UserLogin = z.infer<typeof userLoginSchema>;
export type UserProfileUpdate = z.infer<typeof userProfileUpdateSchema>;
export type PasswordReset = z.infer<typeof passwordResetSchema>;
export type PasswordChange = z.infer<typeof passwordChangeSchema>;
export type LearningSession = z.infer<typeof learningSessionSchema>;
export type LearningProgress = z.infer<typeof learningProgressSchema>;
export type VARKAssessment = z.infer<typeof varkAssessmentSchema>;
export type LearningPath = z.infer<typeof learningPathSchema>;
export type Question = z.infer<typeof questionSchema>;
export type Assessment = z.infer<typeof assessmentSchema>;
export type AssessmentSubmission = z.infer<typeof assessmentSubmissionSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatSession = z.infer<typeof chatSessionSchema>;
export type Content = z.infer<typeof contentSchema>;
export type ContentAdaptation = z.infer<typeof contentAdaptationSchema>;
export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
export type SystemConfig = z.infer<typeof systemConfigSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type RateLimit = z.infer<typeof rateLimitSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
export type DateRange = z.infer<typeof dateRangeSchema>;