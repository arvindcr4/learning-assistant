import { z } from 'zod';

// Base validation schemas
export const UserIdSchema = z.string().uuid('Invalid user ID format');
export const SessionIdSchema = z.string().uuid('Invalid session ID format');
export const TimestampSchema = z.date().or(z.string().datetime());

// Input sanitization
export const SanitizedStringSchema = z.string()
  .min(1, 'Field cannot be empty')
  .max(10000, 'Field too long')
  .trim()
  .refine((val) => !/<script|javascript:|on\w+=/i.test(val), 'Invalid characters detected');

export const SanitizedOptionalStringSchema = z.string()
  .max(10000, 'Field too long')
  .trim()
  .refine((val) => !/<script|javascript:|on\w+=/i.test(val), 'Invalid characters detected')
  .optional();

// Learning Context Schema
export const LearningContextSchema = z.object({
  userId: UserIdSchema,
  subject: SanitizedStringSchema,
  topic: SanitizedStringSchema,
  difficultyLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  learningStyle: z.enum(['visual', 'auditory', 'kinesthetic', 'reading']).optional(),
  goals: z.array(SanitizedStringSchema).max(10, 'Too many goals'),
  timeframe: z.number().min(1).max(1440).optional(), // max 24 hours in minutes
  preferences: z.object({
    pace: z.enum(['slow', 'medium', 'fast']).optional(),
    interactivity: z.enum(['low', 'medium', 'high']).optional(),
    feedback: z.enum(['minimal', 'moderate', 'extensive']).optional()
  }).optional()
});

// Chat Message Schema
export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  content: SanitizedStringSchema.max(5000, 'Message too long'),
  role: z.enum(['user', 'assistant', 'system']),
  timestamp: TimestampSchema,
  context: LearningContextSchema.optional(),
  metadata: z.object({
    confidence: z.number().min(0).max(1).optional(),
    sources: z.array(z.string()).max(10).optional(),
    suggestions: z.array(SanitizedStringSchema).max(5).optional(),
    followUpQuestions: z.array(SanitizedStringSchema).max(5).optional(),
    tutorialPrompts: z.array(SanitizedStringSchema).max(3).optional(),
    assessmentTrigger: z.boolean().optional()
  }).optional(),
  tokens: z.number().min(0).optional()
});

// Session Management Schema
export const SessionCreateSchema = z.object({
  userId: UserIdSchema,
  learningContext: LearningContextSchema,
  settings: z.object({
    aiPersona: z.enum(['tutor', 'mentor', 'peer', 'expert']).default('tutor'),
    maxMessages: z.number().min(1).max(1000).default(100),
    retentionDays: z.number().min(1).max(365).default(30)
  }).optional()
});

export const SessionUpdateSchema = z.object({
  title: SanitizedOptionalStringSchema,
  settings: z.object({
    aiPersona: z.enum(['tutor', 'mentor', 'peer', 'expert']).optional(),
    maxMessages: z.number().min(1).max(1000).optional(),
    retentionDays: z.number().min(1).max(365).optional()
  }).optional(),
  isActive: z.boolean().optional()
});

// Chat Request Schema
export const ChatRequestSchema = z.object({
  message: SanitizedStringSchema.max(2000, 'Message too long'),
  sessionId: SessionIdSchema.optional(),
  userId: UserIdSchema,
  learningContext: LearningContextSchema,
  streamResponse: z.boolean().default(false),
  persona: z.enum(['tutor', 'mentor', 'peer', 'expert']).optional(),
  generateResponse: z.boolean().default(true)
});

// Learning Profile Schema
export const LearningProfileSchema = z.object({
  userId: UserIdSchema,
  varkResponses: z.record(z.string().max(500, 'Response too long')).optional(),
  assessmentData: z.object({
    completedAt: TimestampSchema,
    responses: z.record(z.string().max(500)),
    duration: z.number().min(0).max(3600) // max 1 hour
  }).optional()
});

// Learning Session Schema
export const LearningSessionSchema = z.object({
  sessionData: z.object({
    id: SessionIdSchema,
    userId: UserIdSchema,
    contentId: z.string().uuid(),
    startTime: TimestampSchema,
    endTime: TimestampSchema.optional(),
    duration: z.number().min(0).max(28800), // max 8 hours in seconds
    itemsCompleted: z.number().min(0).max(1000),
    correctAnswers: z.number().min(0).max(1000),
    totalQuestions: z.number().min(0).max(1000),
    engagementMetrics: z.object({
      focusTime: z.number().min(0).max(28800),
      distractionEvents: z.number().min(0).max(1000),
      interactionRate: z.number().min(0).max(100),
      scrollDepth: z.number().min(0).max(100),
      videoWatchTime: z.number().min(0).max(28800),
      pauseFrequency: z.number().min(0).max(1000)
    }).optional(),
    adaptiveChanges: z.array(z.object({
      type: z.string(),
      timestamp: TimestampSchema,
      change: z.string(),
      reason: z.string()
    })).max(100),
    completed: z.boolean()
  }),
  userId: UserIdSchema
});

// Progress Schema
export const ProgressUpdateSchema = z.object({
  userId: UserIdSchema,
  contentId: z.string().uuid(),
  progress: z.number().min(0).max(100),
  timeSpent: z.number().min(0).max(28800), // max 8 hours
  score: z.number().min(0).max(100).optional(),
  completed: z.boolean().default(false),
  notes: SanitizedOptionalStringSchema
});

// Assessment Schema
export const AssessmentSubmissionSchema = z.object({
  userId: UserIdSchema,
  assessmentId: z.string().uuid(),
  responses: z.record(z.union([
    z.string().max(1000),
    z.number(),
    z.boolean(),
    z.array(z.string())
  ])).refine((responses) => Object.keys(responses).length <= 100, 'Too many responses'),
  timeSpent: z.number().min(0).max(7200), // max 2 hours
  startedAt: TimestampSchema,
  submittedAt: TimestampSchema
});

// VARK Assessment Schema
export const VarkAssessmentSchema = z.object({
  userId: UserIdSchema,
  responses: z.record(z.string().max(500)).refine(
    (responses) => Object.keys(responses).length >= 4 && Object.keys(responses).length <= 50,
    'Invalid number of responses'
  )
});

// Content Adaptation Schema
export const ContentAdaptationSchema = z.object({
  userId: UserIdSchema,
  content: z.object({
    id: z.string().uuid(),
    title: SanitizedStringSchema,
    description: SanitizedStringSchema,
    concept: SanitizedStringSchema,
    difficulty: z.number().min(1).max(10),
    estimatedDuration: z.number().min(1).max(480), // max 8 hours in minutes
    contentType: z.enum(['text', 'video', 'interactive', 'quiz', 'exercise']),
    metadata: z.object({
      tags: z.array(z.string()).max(20),
      language: z.string().length(2),
      bloomsTaxonomyLevel: z.enum([
        'Remembering', 'Understanding', 'Applying', 
        'Analyzing', 'Evaluating', 'Creating'
      ]),
      cognitiveLoad: z.number().min(1).max(10)
    })
  }),
  userContext: z.object({
    currentLevel: z.number().min(1).max(10),
    recentPerformance: z.array(z.number().min(0).max(100)).max(10),
    learningStyle: z.enum(['visual', 'auditory', 'kinesthetic', 'reading']).optional(),
    preferences: z.object({
      difficulty: z.enum(['adaptive', 'fixed']).default('adaptive'),
      pace: z.enum(['self-paced', 'guided']).default('adaptive')
    }).optional()
  })
});

// Analytics Request Schema
export const AnalyticsRequestSchema = z.object({
  userId: UserIdSchema,
  timeRange: z.object({
    start: TimestampSchema,
    end: TimestampSchema
  }).optional(),
  metrics: z.array(z.enum([
    'progress', 'engagement', 'performance', 'style_effectiveness',
    'pace_analysis', 'content_engagement', 'predictions'
  ])).max(10).optional()
});

// Rate limiting and pagination
export const PaginationSchema = z.object({
  page: z.number().min(1).max(1000).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// Recommendation filters
export const RecommendationFiltersSchema = z.object({
  userId: UserIdSchema,
  types: z.array(z.enum(['content', 'style', 'pace', 'difficulty'])).max(10).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  limit: z.number().min(1).max(50).default(10)
});

// Goal management
export const GoalSchema = z.object({
  id: z.string().uuid().optional(),
  userId: UserIdSchema,
  title: SanitizedStringSchema.max(200),
  description: SanitizedOptionalStringSchema,
  targetValue: z.number().min(0).max(1000000),
  currentValue: z.number().min(0).max(1000000).default(0),
  unit: z.enum(['hours', 'modules', 'assessments', 'points']),
  deadline: TimestampSchema.optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  category: z.enum(['learning', 'performance', 'engagement', 'completion']),
  isActive: z.boolean().default(true)
});

// Error response schema
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.any()).optional(),
  timestamp: z.date().default(() => new Date())
});

// Success response schema
export const SuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.any(),
  metadata: z.object({
    timestamp: z.date().default(() => new Date()),
    version: z.string().default('1.0.0'),
    requestId: z.string().optional()
  }).optional()
});

// Validation helper functions
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`Validation failed: ${result.error.issues.map(i => i.message).join(', ')}`);
  }
  return result.data;
}

export function createErrorResponse(error: string, code?: string, details?: Record<string, any>) {
  return {
    success: false as const,
    error,
    code,
    details,
    timestamp: new Date()
  };
}

export function createSuccessResponse<T>(data: T, metadata?: { requestId?: string; version?: string }) {
  return {
    success: true as const,
    data,
    metadata: {
      timestamp: new Date(),
      version: '1.0.0',
      ...metadata
    }
  };
}