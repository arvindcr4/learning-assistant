// Database models and types for the Personal Learning Assistant

// ==========================================
// USER MODELS
// ==========================================

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  id: string;
  userId: string;
  learningGoals: string[];
  preferredTopics: string[];
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  dailyGoalMinutes: number;
  preferredTimes: string[];
  daysPerWeek: number;
  emailNotifications: boolean;
  pushNotifications: boolean;
  reminderNotifications: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// LEARNING STYLE MODELS
// ==========================================

export type LearningStyleType = 'visual' | 'auditory' | 'reading' | 'kinesthetic';

export interface LearningProfile {
  id: string;
  userId: string;
  dominantStyle: LearningStyleType;
  isMultimodal: boolean;
  adaptationLevel: number; // 0-100
  confidenceScore: number; // 0-1
  createdAt: Date;
  updatedAt: Date;
}

export interface LearningStyle {
  id: string;
  profileId: string;
  styleType: LearningStyleType;
  score: number; // 0-100
  confidence: number; // 0-1
  lastUpdated: Date;
}

export interface StyleAssessment {
  id: string;
  profileId: string;
  assessmentType: 'questionnaire' | 'behavioral' | 'hybrid';
  visualScore: number; // 0-1
  auditoryScore: number; // 0-1
  readingScore: number; // 0-1
  kinestheticScore: number; // 0-1
  confidence: number; // 0-1
  dataPoints: number;
  completedAt: Date;
}

export interface BehavioralIndicator {
  id: string;
  profileId: string;
  action: string;
  contentType: LearningStyleType;
  engagementLevel: number; // 0-100
  completionRate: number; // 0-100
  timeSpent: number; // minutes
  timestamp: Date;
}

// ==========================================
// PACE MANAGEMENT MODELS
// ==========================================

export interface PaceProfile {
  id: string;
  userId: string;
  currentPace: number; // items per hour
  optimalPace: number; // items per hour
  comprehensionRate: number; // 0-100
  retentionRate: number; // 0-100
  difficultyAdjustment: number; // 0.5-2.0
  fatigueLevel: number; // 0-100
  lastUpdated: Date;
}

export interface PaceAdjustment {
  id: string;
  paceProfileId: string;
  timestamp: Date;
  previousPace: number;
  newPace: number;
  reason: 'performance' | 'fatigue' | 'difficulty' | 'time_pressure';
  effectiveness?: number; // 0-100
}

// ==========================================
// LEARNING SESSION MODELS
// ==========================================

export interface LearningSession {
  id: string;
  userId: string;
  contentId: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // minutes
  itemsCompleted: number;
  correctAnswers: number;
  totalQuestions: number;
  completed: boolean;
  
  // Engagement metrics
  focusTime: number; // minutes
  distractionEvents: number;
  interactionRate: number; // interactions per minute
  scrollDepth: number; // 0-100 percentage
  videoWatchTime: number; // minutes
  pauseFrequency: number; // pauses per hour
  
  createdAt: Date;
}

export interface AdaptiveChange {
  id: string;
  sessionId: string;
  timestamp: Date;
  changeType: 'pace' | 'difficulty' | 'content_type' | 'break_suggestion';
  previousValue?: string;
  newValue?: string;
  reason: string;
  userResponse?: 'accepted' | 'declined' | 'ignored';
}

// ==========================================
// CONTENT MODELS
// ==========================================

export interface AdaptiveContent {
  id: string;
  title: string;
  description?: string;
  concept: string;
  learningObjectives: string[];
  difficulty: number; // 1-10
  estimatedDuration: number; // minutes
  prerequisites: string[];
  
  // Metadata
  tags: string[];
  language: string;
  bloomsTaxonomyLevel: string;
  cognitiveLoad: number; // 1-10
  estimatedEngagement: number; // 1-10
  successRate: number; // 0-100
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentVariant {
  id: string;
  contentId: string;
  styleType: LearningStyleType;
  format: 'text' | 'video' | 'audio' | 'interactive' | 'infographic' | 'simulation' | 'diagram' | 'quiz';
  contentData: string; // JSON or HTML content
  interactivityLevel: 'passive' | 'low' | 'medium' | 'high';
  
  // Accessibility features
  screenReaderSupport: boolean;
  highContrast: boolean;
  largeFonts: boolean;
  keyboardNavigation: boolean;
  audioDescription: boolean;
  signLanguage: boolean;
  
  createdAt: Date;
}

export interface MediaContent {
  id: string;
  variantId: string;
  mediaType: 'video' | 'audio' | 'image' | 'interactive' | 'simulation';
  url: string;
  duration?: number; // seconds for video/audio
  transcript?: string;
  captions?: string;
  alternativeText?: string;
  fileSize?: number; // bytes
  mimeType?: string;
  createdAt: Date;
}

// ==========================================
// ASSESSMENT MODELS
// ==========================================

export interface AdaptiveAssessment {
  id: string;
  contentId: string;
  assessmentType: 'formative' | 'summative' | 'diagnostic';
  title: string;
  description?: string;
  
  // Adaptive settings
  minimumQuestions: number;
  maximumQuestions: number;
  targetAccuracy: number; // 0-100
  confidenceThreshold: number; // 0-1
  timeLimit?: number; // minutes
  
  // Scoring
  totalPoints: number;
  passingScore: number; // 0-100
  
  createdAt: Date;
  updatedAt: Date;
}

export interface AdaptiveQuestion {
  id: string;
  assessmentId: string;
  questionText: string;
  questionType: 'multiple-choice' | 'true-false' | 'short-answer' | 'drag-drop' | 'simulation';
  difficulty: number; // 1-10
  learningObjective?: string;
  correctAnswer: string;
  explanation?: string;
  hints: string[];
  points: number;
  timeLimit?: number; // seconds
  createdAt: Date;
}

export interface QuestionOption {
  id: string;
  questionId: string;
  optionText: string;
  isCorrect: boolean;
  feedback?: string;
  orderIndex: number;
}

export interface AssessmentAttempt {
  id: string;
  userId: string;
  assessmentId: string;
  startedAt: Date;
  completedAt?: Date;
  score?: number; // 0-100
  passed: boolean;
  timeSpent?: number; // minutes
  questionsAnswered: number;
  correctAnswers: number;
}

export interface QuestionResponse {
  id: string;
  attemptId: string;
  questionId: string;
  userAnswer?: string;
  isCorrect: boolean;
  pointsEarned: number;
  timeSpent?: number; // seconds
  hintsUsed: number;
  responseTime: Date;
}

// ==========================================
// ANALYTICS MODELS
// ==========================================

export interface LearningAnalytics {
  id: string;
  userId: string;
  timeRangeStart: Date;
  timeRangeEnd: Date;
  
  // Overall progress metrics
  totalTimeSpent: number; // minutes
  contentCompleted: number;
  averageScore: number;
  completionRate: number;
  retentionRate: number;
  streakDays: number;
  goalsAchieved: number;
  totalGoals: number;
  
  // Pace analysis
  averagePace: number;
  optimalPace: number;
  paceConsistency: number;
  peakPerformanceTime?: string;
  recommendedBreaks: number;
  
  generatedAt: Date;
}

export interface StyleEffectiveness {
  id: string;
  analyticsId: string;
  styleType: LearningStyleType;
  engagementScore: number; // 0-100
  comprehensionScore: number; // 0-100
  completionRate: number; // 0-100
  timeToMastery: number; // minutes
  preferenceStrength: number; // 0-100
}

export interface ContentEngagement {
  id: string;
  analyticsId: string;
  contentId: string;
  contentType: string;
  engagementScore: number; // 0-100
  completionRate: number; // 0-100
  revisitRate: number; // 0-100
  timeSpent: number; // minutes
  userRating?: number; // 1-5
}

export interface PerformanceTrend {
  id: string;
  analyticsId: string;
  metric: string;
  timeRangeStart: Date;
  timeRangeEnd: Date;
  values: number[];
  trend: 'improving' | 'declining' | 'stable';
  significance: number; // 0-1
  factors: string[];
}

// ==========================================
// RECOMMENDATION MODELS
// ==========================================

export interface Recommendation {
  id: string;
  userId: string;
  recommendationType: 'content' | 'pace' | 'style' | 'schedule' | 'goal';
  title: string;
  description: string;
  reasoning: string;
  confidence: number; // 0-100
  priority: 'low' | 'medium' | 'high';
  actionRequired: boolean;
  estimatedImpact: number; // 0-100
  
  // Status tracking
  status: 'active' | 'accepted' | 'declined' | 'expired';
  userFeedback?: string;
  feedbackRating?: number; // 1-5
  
  createdAt: Date;
  expiresAt?: Date;
  respondedAt?: Date;
}

export interface LearningPrediction {
  id: string;
  userId: string;
  metric: string;
  predictedValue: number;
  confidence: number; // 0-100
  timeframe: number; // days
  factors: Record<string, any>;
  recommendations: string[];
  
  // Validation
  actualValue?: number;
  accuracy?: number;
  
  createdAt: Date;
  targetDate: Date;
  validatedAt?: Date;
}

// ==========================================
// SYSTEM MODELS
// ==========================================

export interface SystemConfig {
  id: string;
  configKey: string;
  configValue: Record<string, any>;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// COMPOSITE MODELS
// ==========================================

export interface UserWithProfiles extends User {
  preferences?: UserPreferences;
  learningProfile?: LearningProfile;
  paceProfile?: PaceProfile;
  learningStyles?: LearningStyle[];
}

export interface ContentWithVariants extends AdaptiveContent {
  variants: ContentVariant[];
  mediaContent?: MediaContent[];
}

export interface AssessmentWithQuestions extends AdaptiveAssessment {
  questions: AdaptiveQuestion[];
}

export interface QuestionWithOptions extends AdaptiveQuestion {
  options: QuestionOption[];
}

export interface SessionWithChanges extends LearningSession {
  adaptiveChanges: AdaptiveChange[];
}

export interface AnalyticsWithMetrics extends LearningAnalytics {
  styleEffectiveness: StyleEffectiveness[];
  contentEngagement: ContentEngagement[];
  performanceTrends: PerformanceTrend[];
}

// ==========================================
// VIEW MODELS
// ==========================================

export interface UserLearningOverview {
  userId: string;
  name: string;
  email: string;
  dominantStyle?: LearningStyleType;
  isMultimodal?: boolean;
  adaptationLevel?: number;
  currentPace?: number;
  optimalPace?: number;
  comprehensionRate?: number;
  totalSessions: number;
  totalTimeSpent: number;
  averageScore: number;
}

export interface ContentEffectiveness {
  contentId: string;
  title: string;
  concept: string;
  difficulty: number;
  totalSessions: number;
  averageScore: number;
  averageDuration: number;
  uniqueUsers: number;
}

export interface RecentUserActivity {
  userId: string;
  name: string;
  lastSession?: Date;
  activeDaysLast30: number;
  sessionsLast30: number;
  totalTimeLast30: number;
}

export interface UserProgressSummary {
  userId: string;
  name: string;
  totalSessions: number;
  totalLearningTime: number;
  overallAccuracy: number;
  totalAssessments: number;
  passedAssessments: number;
  lastActivity?: Date;
}

// ==========================================
// CREATE DATA MODELS
// ==========================================

export interface CreateUserData {
  email: string;
  name: string;
  avatar_url?: string;
}

export interface CreateLearningProfileData {
  user_id: string;
  dominant_style: LearningStyleType;
  is_multimodal?: boolean;
  adaptation_level?: number;
  confidence_score?: number;
}

export interface CreateSessionData {
  user_id: string;
  content_id: string;
  duration: number;
  items_completed?: number;
  correct_answers?: number;
  total_questions?: number;
  completed?: boolean;
  focus_time?: number;
  distraction_events?: number;
  interaction_rate?: number;
  scroll_depth?: number;
  video_watch_time?: number;
  pause_frequency?: number;
}

export interface CreateAssessmentAttemptData {
  user_id: string;
  assessment_id: string;
  score?: number;
  passed?: boolean;
  time_spent?: number;
  questions_answered?: number;
  correct_answers?: number;
}

// ==========================================
// REQUEST/RESPONSE MODELS
// ==========================================

export interface CreateUserRequest {
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface UpdateLearningStyleRequest {
  visualScore: number;
  auditoryScore: number;
  readingScore: number;
  kinestheticScore: number;
  confidence: number;
  assessmentType: 'questionnaire' | 'behavioral' | 'hybrid';
}

export interface CreateSessionRequest {
  contentId: string;
  estimatedDuration?: number;
}

export interface CompleteSessionRequest {
  sessionId: string;
  itemsCompleted?: number;
  correctAnswers?: number;
  totalQuestions?: number;
  focusTime?: number;
  distractionEvents?: number;
  interactionRate?: number;
  scrollDepth?: number;
}

export interface CreateRecommendationRequest {
  type: 'content' | 'pace' | 'style' | 'schedule' | 'goal';
  title: string;
  description: string;
  reasoning: string;
  confidence: number;
  priority: 'low' | 'medium' | 'high';
  actionRequired?: boolean;
  estimatedImpact: number;
  expiresAt?: Date;
}

export interface AnalyticsRequest {
  userId: string;
  startDate: Date;
  endDate: Date;
  includeMetrics?: boolean;
}

// ==========================================
// UTILITY TYPES
// ==========================================

export type DatabaseError = {
  code: string;
  message: string;
  detail?: string;
  hint?: string;
};

export type QueryOptions = {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
};

export type FilterOptions = {
  userId?: string;
  contentId?: string;
  startDate?: Date;
  endDate?: Date;
  difficulty?: number;
  learningStyle?: LearningStyleType;
  status?: string;
};

// ==========================================
// CONSTANTS
// ==========================================

export const LEARNING_STYLES = ['visual', 'auditory', 'reading', 'kinesthetic'] as const;
export const DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export const CONTENT_FORMATS = ['text', 'video', 'audio', 'interactive', 'infographic', 'simulation', 'diagram', 'quiz'] as const;
export const ASSESSMENT_TYPES = ['formative', 'summative', 'diagnostic'] as const;
export const QUESTION_TYPES = ['multiple-choice', 'true-false', 'short-answer', 'drag-drop', 'simulation'] as const;
export const RECOMMENDATION_TYPES = ['content', 'pace', 'style', 'schedule', 'goal'] as const;
export const PRIORITY_LEVELS = ['low', 'medium', 'high'] as const;
export const TREND_TYPES = ['improving', 'declining', 'stable'] as const;