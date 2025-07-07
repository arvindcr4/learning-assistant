// Shared types for Supabase Edge Functions
// These types are compatible with Deno and the edge runtime

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LearningProfile {
  id: string;
  userId: string;
  dominantStyle: LearningStyleType;
  styles: LearningStyle[];
  isMultimodal: boolean;
  adaptationLevel: number;
  createdAt: string;
  updatedAt: string;
}

export type LearningStyleType = 'visual' | 'auditory' | 'reading' | 'kinesthetic';

export interface LearningStyle {
  type: LearningStyleType;
  strength: number;
  confidence: number;
  evidence: string[];
}

export interface LearningSession {
  id: string;
  userId: string;
  contentId: string;
  startTime: string;
  endTime?: string;
  duration: number;
  itemsCompleted: number;
  correctAnswers: number;
  totalQuestions: number;
  completed: boolean;
  engagementMetrics: {
    timeSpent: number;
    interactionCount: number;
    focusScore: number;
    completionRate: number;
  };
  createdAt: string;
}

export interface AdaptiveContent {
  id: string;
  title: string;
  description: string;
  concept: string;
  difficulty: number;
  estimatedDuration: number;
  prerequisites: string[];
  learningObjectives: string[];
  contentVariants: ContentVariant[];
  metadata: ContentMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface ContentVariant {
  id: string;
  contentId: string;
  styleType: LearningStyleType;
  format: 'text' | 'video' | 'audio' | 'interactive' | 'infographic' | 'simulation' | 'diagram' | 'quiz';
  content: string;
  accessibility: {
    highContrast: boolean;
    largeFonts: boolean;
    keyboardNavigation: boolean;
    audioDescription: boolean;
    signLanguage: boolean;
  };
  createdAt: string;
}

export interface ContentMetadata {
  tags: string[];
  category: string;
  bloomsTaxonomyLevel: string;
  cognitiveLoad: number;
  estimatedEngagement: number;
  successRate: number;
}

export interface ContentRecommendation {
  id: string;
  contentId: string;
  title: string;
  description: string;
  type: 'reading' | 'video' | 'interactive' | 'practice' | 'assessment';
  difficulty: number;
  estimatedTime: number;
  relevanceScore: number;
  diversityScore: number;
  personalizedReason: string;
  prerequisites: string[];
  learningObjectives: string[];
  tags: string[];
  adaptationFactors: {
    styleMatch: number;
    difficultyFit: number;
    interestAlignment: number;
    skillGapAddress: number;
    noveltyFactor: number;
  };
  metadata: {
    popularity: number;
    averageRating: number;
    completionRate: number;
    engagementScore: number;
  };
  createdAt: string;
  expiresAt?: string;
}

export interface RecommendationRequest {
  userId: string;
  maxRecommendations?: number;
  contentTypes?: string[];
  difficultyRange?: [number, number];
  timeLimit?: number;
  excludeContentIds?: string[];
  includeExploration?: boolean;
}

export interface RecommendationResponse {
  recommendations: ContentRecommendation[];
  strategy: 'cold_start' | 'personalized' | 'hybrid';
  confidence: number;
  generatedAt: string;
  expiresAt: string;
}

export interface LearningAnalytics {
  id: string;
  userId: string;
  timeRangeStart: string;
  timeRangeEnd: string;
  totalSessions: number;
  totalTime: number;
  averageSessionDuration: number;
  completionRate: number;
  averageScore: number;
  skillProgress: Record<string, number>;
  learningVelocity: number;
  engagementLevel: number;
  retentionRate: number;
  difficultyAdaptation: number;
  styleEffectiveness: StyleEffectiveness[];
  contentEngagement: ContentEngagement[];
  performanceTrends: PerformanceTrend[];
  generatedAt: string;
}

export interface StyleEffectiveness {
  styleType: LearningStyleType;
  engagementScore: number;
  comprehensionScore: number;
  completionRate: number;
  timeToMastery: number;
  preferenceStrength: number;
}

export interface ContentEngagement {
  contentId: string;
  contentType: string;
  engagementScore: number;
  completionRate: number;
  revisitRate: number;
  timeSpent: number;
  userRating?: number;
}

export interface PerformanceTrend {
  metric: string;
  timeRangeStart: string;
  timeRangeEnd: string;
  values: number[];
  trend: 'improving' | 'declining' | 'stable';
  significance: number;
  factors: string[];
}

export interface AnalyticsRequest {
  userId: string;
  timeRange?: {
    start: string;
    end: string;
  };
  metrics?: string[];
  includeComparisons?: boolean;
  includePredictions?: boolean;
}

export interface AnalyticsResponse {
  analytics: LearningAnalytics;
  insights: AnalyticsInsight[];
  recommendations: string[];
  generatedAt: string;
}

export interface AnalyticsInsight {
  type: 'performance' | 'engagement' | 'style' | 'content' | 'prediction';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  actionable: boolean;
  suggestedActions: string[];
  confidence: number;
}

// Database response interfaces
export interface DatabaseUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseLearningProfile {
  id: string;
  user_id: string;
  dominant_style: LearningStyleType;
  adaptation_level: number;
  created_at: string;
  updated_at: string;
}

export interface DatabaseLearningSession {
  id: string;
  user_id: string;
  content_id: string;
  start_time: string;
  end_time?: string;
  duration: number;
  items_completed: number;
  correct_answers: number;
  total_questions: number;
  completed: boolean;
  created_at: string;
}

// Utility types for Deno environment
export interface RequestContext {
  request: Request;
  url: URL;
  headers: Headers;
  method: string;
}

export interface ResponseData<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface CorsHeaders {
  'Access-Control-Allow-Origin': string;
  'Access-Control-Allow-Headers': string;
  'Access-Control-Allow-Methods': string;
}

// Error types
export class EdgeFunctionError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'EdgeFunctionError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class ValidationError extends EdgeFunctionError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends EdgeFunctionError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends EdgeFunctionError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}