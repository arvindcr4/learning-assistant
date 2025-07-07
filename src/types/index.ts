// Core types for the Personal Learning Assistant

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  preferences: UserPreferences;
  learningProfile: LearningProfile;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  learningGoals: string[];
  preferredTopics: string[];
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  studySchedule: {
    dailyGoal: number; // minutes
    preferredTimes: string[];
    daysPerWeek: number;
  };
  notifications: {
    email: boolean;
    push: boolean;
    reminders: boolean;
  };
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number; // minutes
  topics: string[];
  modules: LearningModule[];
  progress: number; // 0-100
  createdAt: Date;
  updatedAt: Date;
}

export interface LearningModule {
  id: string;
  pathId: string;
  title: string;
  description: string;
  content: string;
  type: 'reading' | 'video' | 'interactive' | 'quiz';
  duration: number; // minutes
  order: number;
  completed: boolean;
  resources: Resource[];
}

export interface Resource {
  id: string;
  title: string;
  type: 'link' | 'file' | 'video' | 'article';
  url: string;
  description?: string;
}

export interface Quiz {
  id: string;
  moduleId: string;
  title: string;
  description: string;
  questions: Question[];
  timeLimit?: number; // minutes
  passingScore: number; // percentage
}

export interface Question {
  id: string;
  text: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  options?: string[];
  correctAnswer: string | number;
  explanation?: string;
  points: number;
}

export interface StudySession {
  id: string;
  userId: string;
  moduleId: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // minutes
  completed: boolean;
  score?: number;
  notes?: string;
}

export interface Progress {
  userId: string;
  pathId: string;
  moduleId: string;
  completed: boolean;
  score?: number;
  timeSpent: number; // minutes
  lastAccessed: Date;
}

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  context?: LearningContext;
  metadata?: MessageMetadata;
  attachments?: MessageAttachment[];
  tokens?: number;
}

export interface LearningContext {
  userId: string;
  currentModule?: string;
  currentPath?: string;
  learningStyle?: LearningStyleType;
  difficultyLevel?: 'beginner' | 'intermediate' | 'advanced';
  sessionId?: string;
  progress?: {
    completedModules: string[];
    currentScore: number;
    timeSpent: number;
  };
  recentMistakes?: string[];
  strengths?: string[];
  weaknesses?: string[];
}

export interface MessageMetadata {
  isStreaming?: boolean;
  isTyping?: boolean;
  confidence?: number;
  sources?: string[];
  suggestions?: string[];
  followUpQuestions?: string[];
  tutorialPrompts?: TutorialPrompt[];
  assessmentTrigger?: boolean;
}

export interface MessageAttachment {
  id: string;
  type: 'image' | 'file' | 'code' | 'diagram' | 'quiz';
  url?: string;
  content?: string;
  metadata?: Record<string, any>;
}

export interface TutorialPrompt {
  id: string;
  title: string;
  description: string;
  action: string;
  priority: 'low' | 'medium' | 'high';
}

export interface APIResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
}

// ==========================================
// LEARNING STYLE DETECTION TYPES
// ==========================================

export enum LearningStyleType {
  VISUAL = 'visual',
  AUDITORY = 'auditory',
  READING = 'reading',
  KINESTHETIC = 'kinesthetic'
}

export interface LearningStyle {
  type: LearningStyleType;
  score: number; // 0-100 preference strength
  confidence: number; // 0-1 confidence level
  lastUpdated: Date;
}

export interface LearningProfile {
  id: string;
  userId: string;
  styles: LearningStyle[];
  dominantStyle: LearningStyleType;
  isMultimodal: boolean;
  assessmentHistory: StyleAssessment[];
  behavioralIndicators: BehavioralIndicator[];
  adaptationLevel: number; // 0-100 how well adapted the system is
  createdAt: Date;
  updatedAt: Date;
}

export interface StyleAssessment {
  id: string;
  type: 'questionnaire' | 'behavioral' | 'hybrid';
  results: {
    visual: number;
    auditory: number;
    reading: number;
    kinesthetic: number;
  };
  confidence: number;
  dataPoints: number;
  completedAt: Date;
}

export interface BehavioralIndicator {
  action: string;
  contentType: LearningStyleType;
  engagementLevel: number; // 0-100
  completionRate: number; // 0-100
  timeSpent: number; // minutes
  timestamp: Date;
}

// ==========================================
// ADAPTIVE PACE MANAGEMENT TYPES
// ==========================================

export interface PaceProfile {
  id: string;
  userId: string;
  currentPace: number; // items per hour
  optimalPace: number; // calculated optimal rate
  comprehensionRate: number; // 0-100
  retentionRate: number; // 0-100
  difficultyAdjustment: number; // multiplier 0.5-2.0
  fatigueLevel: number; // 0-100
  adaptationHistory: PaceAdjustment[];
  lastUpdated: Date;
}

export interface PaceAdjustment {
  timestamp: Date;
  previousPace: number;
  newPace: number;
  reason: 'performance' | 'fatigue' | 'difficulty' | 'time_pressure';
  effectiveness: number; // 0-100 how well the adjustment worked
}

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
  engagementMetrics: EngagementMetrics;
  adaptiveChanges: AdaptiveChange[];
  completed: boolean;
}

export interface EngagementMetrics {
  focusTime: number; // minutes of active engagement
  distractionEvents: number;
  interactionRate: number; // interactions per minute
  scrollDepth: number; // 0-100 for reading content
  videoWatchTime: number; // for video content
  pauseFrequency: number; // pauses per hour
}

export interface AdaptiveChange {
  timestamp: Date;
  changeType: 'pace' | 'difficulty' | 'content_type' | 'break_suggestion';
  previousValue: any;
  newValue: any;
  reason: string;
  userResponse: 'accepted' | 'declined' | 'ignored';
}

// ==========================================
// CONTENT ADAPTATION TYPES
// ==========================================

export interface AdaptiveContent {
  id: string;
  title: string;
  description: string;
  concept: string;
  learningObjectives: string[];
  difficulty: number; // 1-10 scale
  estimatedDuration: number; // minutes
  contentVariants: ContentVariant[];
  assessments: AdaptiveAssessment[];
  prerequisites: string[];
  metadata: ContentMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentVariant {
  styleType: LearningStyleType;
  format: ContentFormat;
  content: string | MediaContent;
  interactivity: InteractivityLevel;
  accessibility: AccessibilityFeatures;
}

export interface MediaContent {
  type: 'video' | 'audio' | 'image' | 'interactive' | 'simulation';
  url: string;
  duration?: number; // for video/audio
  transcript?: string;
  captions?: string;
  alternativeText?: string;
}

export enum ContentFormat {
  TEXT = 'text',
  VIDEO = 'video',
  AUDIO = 'audio',
  INTERACTIVE = 'interactive',
  INFOGRAPHIC = 'infographic',
  SIMULATION = 'simulation',
  DIAGRAM = 'diagram',
  QUIZ = 'quiz'
}

export enum InteractivityLevel {
  PASSIVE = 'passive',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export interface AccessibilityFeatures {
  screenReaderSupport: boolean;
  highContrast: boolean;
  largeFonts: boolean;
  keyboardNavigation: boolean;
  audioDescription: boolean;
  signLanguage: boolean;
}

export interface ContentMetadata {
  tags: string[];
  language: string;
  difficulty: number;
  bloomsTaxonomyLevel: string;
  cognitiveLoad: number; // 1-10
  estimatedEngagement: number; // 1-10
  successRate: number; // 0-100 historical success rate
}

// ==========================================
// ASSESSMENT AND FEEDBACK TYPES
// ==========================================

export interface AdaptiveAssessment {
  id: string;
  contentId: string;
  type: 'formative' | 'summative' | 'diagnostic';
  questions: AdaptiveQuestion[];
  adaptiveSettings: AssessmentAdaptiveSettings;
  scoringRubric: ScoringRubric;
  feedbackRules: FeedbackRule[];
}

export interface AdaptiveQuestion {
  id: string;
  text: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'drag-drop' | 'simulation';
  difficulty: number; // 1-10
  learningObjective: string;
  options?: QuestionOption[];
  correctAnswer: string | number | string[];
  explanation: string;
  hints: string[];
  points: number;
  timeLimit?: number; // seconds
  adaptiveRules: QuestionAdaptiveRules;
}

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
  feedback: string;
}

export interface QuestionAdaptiveRules {
  nextQuestionLogic: NextQuestionLogic;
  difficultyAdjustment: DifficultyAdjustment;
  hintTriggers: HintTrigger[];
}

export interface NextQuestionLogic {
  correctAnswer: string; // next question ID
  incorrectAnswer: string; // next question ID
  partialCredit: string; // next question ID
}

export interface DifficultyAdjustment {
  increaseOn: 'correct' | 'streak' | 'time';
  decreaseOn: 'incorrect' | 'multiple_attempts' | 'time_expired';
  adjustmentAmount: number; // +/- difficulty points
}

export interface HintTrigger {
  condition: 'time_elapsed' | 'attempts_exceeded' | 'request';
  threshold: number;
  hintLevel: number; // 1-3 (subtle to explicit)
}

export interface AssessmentAdaptiveSettings {
  minimumQuestions: number;
  maximumQuestions: number;
  targetAccuracy: number; // 0-100
  confidenceThreshold: number; // 0-1
  terminationCriteria: TerminationCriteria;
}

export interface TerminationCriteria {
  accuracyAchieved: boolean;
  confidenceReached: boolean;
  timeLimit: number; // minutes
  questionsCompleted: number;
}

export interface ScoringRubric {
  totalPoints: number;
  passingScore: number;
  gradingScale: GradingScale[];
  weightedCategories: WeightedCategory[];
}

export interface GradingScale {
  grade: string;
  minPercent: number;
  maxPercent: number;
  description: string;
}

export interface WeightedCategory {
  category: string;
  weight: number; // 0-1
  description: string;
}

export interface FeedbackRule {
  condition: string;
  message: string;
  type: 'encouragement' | 'correction' | 'hint' | 'explanation';
  priority: number;
}

// ==========================================
// ANALYTICS AND INSIGHTS TYPES
// ==========================================

export interface LearningAnalytics {
  id: string;
  userId: string;
  timeRange: DateRange;
  overallProgress: ProgressMetrics;
  styleEffectiveness: StyleEffectiveness[];
  paceAnalysis: PaceAnalysis;
  contentEngagement: ContentEngagement[];
  performanceTrends: PerformanceTrend[];
  recommendations: Recommendation[];
  predictions: LearningPrediction[];
  generatedAt: Date;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ProgressMetrics {
  totalTimeSpent: number; // minutes
  contentCompleted: number;
  averageScore: number; // 0-100
  completionRate: number; // 0-100
  retentionRate: number; // 0-100
  streakDays: number;
  goalsAchieved: number;
  totalGoals: number;
}

export interface StyleEffectiveness {
  style: LearningStyleType;
  engagementScore: number; // 0-100
  comprehensionScore: number; // 0-100
  completionRate: number; // 0-100
  timeToMastery: number; // minutes
  preferenceStrength: number; // 0-100
}

export interface PaceAnalysis {
  averagePace: number; // items per hour
  optimalPace: number; // calculated optimal
  paceConsistency: number; // 0-100
  fatiguePattern: FatiguePattern;
  peakPerformanceTime: string; // time of day
  recommendedBreaks: number; // per hour
}

export interface FatiguePattern {
  onsetTime: number; // minutes into session
  recoveryTime: number; // minutes needed for recovery
  indicators: string[];
  severity: 'low' | 'medium' | 'high';
}

export interface ContentEngagement {
  contentId: string;
  contentType: ContentFormat;
  engagementScore: number; // 0-100
  completionRate: number; // 0-100
  revisitRate: number; // 0-100
  timeSpent: number; // minutes
  userRating?: number; // 1-5
}

export interface PerformanceTrend {
  metric: string;
  timeRange: DateRange;
  values: number[];
  trend: 'improving' | 'declining' | 'stable';
  significance: number; // 0-1
  factors: string[];
}

export interface Recommendation {
  id: string;
  type: 'content' | 'pace' | 'style' | 'schedule' | 'goal';
  title: string;
  description: string;
  reasoning: string;
  confidence: number; // 0-100
  priority: 'low' | 'medium' | 'high';
  actionRequired: boolean;
  estimatedImpact: number; // 0-100
  createdAt: Date;
  expiresAt?: Date;
}

export interface LearningPrediction {
  metric: string;
  predictedValue: number;
  confidence: number; // 0-100
  timeframe: number; // days
  factors: PredictionFactor[];
  recommendations: string[];
}

export interface PredictionFactor {
  factor: string;
  importance: number; // 0-100
  currentValue: number;
  optimalValue: number;
}

// ==========================================
// SYSTEM CONFIGURATION TYPES
// ==========================================

export interface SystemConfig {
  adaptationSettings: AdaptationSettings;
  contentSettings: ContentSettings;
  assessmentSettings: AssessmentSettings;
  analyticsSettings: AnalyticsSettings;
  privacySettings: PrivacySettings;
}

export interface AdaptationSettings {
  minDataPoints: number;
  confidenceThreshold: number;
  adaptationSpeed: 'slow' | 'medium' | 'fast';
  maxDifficultyChange: number;
  enableRealTimeAdaptation: boolean;
}

export interface ContentSettings {
  defaultLanguage: string;
  supportedLanguages: string[];
  maxContentLength: number;
  enableMultimodal: boolean;
  accessibilityLevel: 'basic' | 'enhanced' | 'full';
}

export interface AssessmentSettings {
  defaultQuestionCount: number;
  minPassingScore: number;
  enableAdaptiveQuestioning: boolean;
  maxAttempts: number;
  timeouts: {
    question: number; // seconds
    assessment: number; // minutes
  };
}

export interface AnalyticsSettings {
  dataRetentionDays: number;
  enablePredictiveAnalytics: boolean;
  privacyLevel: 'minimal' | 'standard' | 'detailed';
  reportingFrequency: 'daily' | 'weekly' | 'monthly';
}

export interface PrivacySettings {
  dataCollection: 'minimal' | 'standard' | 'comprehensive';
  shareWithEducators: boolean;
  anonymizeData: boolean;
  dataExportEnabled: boolean;
  retentionPolicy: string;
}

// ==========================================
// AI CHAT SYSTEM TYPES
// ==========================================

export interface AIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
  temperature: number;
  persona: AIPersona;
  language: string;
}

export interface AIPersona {
  name: string;
  type: 'educational_tutor' | 'learning_companion' | 'subject_expert' | 'mentor';
  personality: string;
  expertise: string[];
  communicationStyle: 'formal' | 'casual' | 'encouraging' | 'professional';
  adaptiveLevel: number; // 0-10 how adaptive the AI is
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  description?: string;
  messages: ChatMessage[];
  context: LearningContext;
  settings: ChatSettings;
  status: 'active' | 'paused' | 'completed' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
  totalTokens: number;
  totalMessages: number;
}

export interface ChatSettings {
  aiPersona: AIPersona;
  adaptiveMode: boolean;
  tutorialMode: boolean;
  assessmentMode: boolean;
  conversationStyle: 'socratic' | 'direct' | 'guided' | 'exploratory';
  difficultyAdjustment: boolean;
  contextAwareness: boolean;
  proactiveHints: boolean;
  encouragementLevel: 'minimal' | 'moderate' | 'high';
}

export interface ConversationState {
  currentTopic?: string;
  understandingLevel: number; // 0-100
  engagementLevel: number; // 0-100
  frustrationLevel: number; // 0-100
  needsHelp: boolean;
  lastInteraction: Date;
  conversationFlow: ConversationFlowStep[];
  adaptiveActions: AdaptiveAction[];
}

export interface ConversationFlowStep {
  id: string;
  type: 'question' | 'explanation' | 'assessment' | 'encouragement' | 'summary';
  content: string;
  timestamp: Date;
  userResponse?: string;
  effectiveness?: number; // 0-100
}

export interface AdaptiveAction {
  id: string;
  type: 'difficulty_adjustment' | 'explanation_style' | 'encouragement' | 'assessment_trigger';
  action: string;
  reason: string;
  timestamp: Date;
  applied: boolean;
  effectiveness?: number; // 0-100
}

export interface LearningPrompt {
  id: string;
  category: 'assessment' | 'explanation' | 'encouragement' | 'correction' | 'guidance';
  template: string;
  variables: PromptVariable[];
  context: LearningContext;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  learningStyle: LearningStyleType;
  effectiveness: number; // 0-100 based on historical data
}

export interface PromptVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  value: any;
  description: string;
}

export interface TutoringSession {
  id: string;
  chatSessionId: string;
  userId: string;
  subject: string;
  topic: string;
  objectives: string[];
  startTime: Date;
  endTime?: Date;
  duration: number; // minutes
  progress: TutoringProgress;
  assessments: TutoringAssessment[];
  adaptiveActions: AdaptiveAction[];
  outcome: TutoringOutcome;
  feedback: TutoringFeedback;
}

export interface TutoringProgress {
  conceptsIntroduced: string[];
  conceptsUnderstood: string[];
  conceptsNeedsWork: string[];
  questionsAsked: number;
  questionsAnswered: number;
  correctAnswers: number;
  hintsProvided: number;
  explanationsGiven: number;
  currentUnderstanding: number; // 0-100
}

export interface TutoringAssessment {
  id: string;
  type: 'formative' | 'diagnostic' | 'checkpoint';
  questions: TutoringQuestion[];
  responses: TutoringResponse[];
  score: number; // 0-100
  feedback: string;
  timestamp: Date;
}

export interface TutoringQuestion {
  id: string;
  text: string;
  type: 'multiple-choice' | 'short-answer' | 'explanation' | 'problem-solving';
  options?: string[];
  correctAnswer?: string;
  difficulty: number; // 1-10
  concept: string;
  hints: string[];
}

export interface TutoringResponse {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  confidence: number; // 0-100
  timeSpent: number; // seconds
  hintsUsed: number;
  reasoning?: string;
  feedback: string;
}

export interface TutoringOutcome {
  conceptsMastered: string[];
  conceptsToReview: string[];
  recommendedNextSteps: string[];
  overallScore: number; // 0-100
  engagement: number; // 0-100
  satisfaction: number; // 0-100
  timeToMastery: number; // minutes
}

export interface TutoringFeedback {
  positive: string[];
  constructive: string[];
  encouragement: string;
  nextSession: string;
  resources: Resource[];
}

export interface ChatAnalytics {
  sessionId: string;
  userId: string;
  totalMessages: number;
  totalTokens: number;
  averageResponseTime: number; // seconds
  topics: TopicAnalysis[];
  sentimentAnalysis: SentimentAnalysis;
  engagementMetrics: ChatEngagementMetrics;
  learningProgress: ChatLearningProgress;
  adaptiveEffectiveness: AdaptiveEffectivenessMetrics;
  generatedAt: Date;
}

export interface TopicAnalysis {
  topic: string;
  frequency: number;
  sentiment: number; // -1 to 1
  understanding: number; // 0-100
  engagement: number; // 0-100
  timeSpent: number; // minutes
}

export interface SentimentAnalysis {
  overall: number; // -1 to 1
  frustration: number; // 0-100
  confidence: number; // 0-100
  satisfaction: number; // 0-100
  engagement: number; // 0-100
  timeline: SentimentPoint[];
}

export interface SentimentPoint {
  timestamp: Date;
  sentiment: number; // -1 to 1
  confidence: number; // 0-100
  trigger?: string;
}

export interface ChatEngagementMetrics {
  averageMessageLength: number;
  responseLatency: number; // seconds
  questionsAsked: number;
  questionsAnswered: number;
  initiativeTaken: number; // times user started new topics
  helpRequested: number;
  sessionDuration: number; // minutes
  attentionSpan: number; // minutes
}

export interface ChatLearningProgress {
  conceptsDiscussed: string[];
  conceptsLearned: string[];
  mistakesCorreected: string[];
  questionsResolved: string[];
  skillsImproved: string[];
  knowledgeGaps: string[];
  progressRate: number; // concepts per hour
  retentionRate: number; // 0-100
}

export interface AdaptiveEffectivenessMetrics {
  adaptationsTriggered: number;
  adaptationsSuccessful: number;
  difficultyAdjustments: number;
  styleAdaptations: number;
  engagementInterventions: number;
  averageEffectiveness: number; // 0-100
  userSatisfaction: number; // 0-100
}

export interface AIResponse {
  id: string;
  content: string;
  confidence: number; // 0-100
  sources: string[];
  suggestions: string[];
  followUpQuestions: string[];
  metadata: {
    model: string;
    tokens: number;
    processingTime: number; // ms
    temperature: number;
    context: LearningContext;
  };
  adaptiveActions: AdaptiveAction[];
  tutorialPrompts: TutorialPrompt[];
  assessmentTrigger?: boolean;
}

export interface StreamingResponse {
  id: string;
  content: string;
  isComplete: boolean;
  timestamp: Date;
  metadata?: {
    chunkIndex: number;
    totalChunks?: number;
    confidence?: number;
  };
}

// ==========================================
// STATE MANAGEMENT TYPES
// ==========================================

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  token: string | null;
  refreshToken: string | null;
  sessionExpiry: Date | null;
}

export interface LearningState {
  currentPath: LearningPath | null;
  allPaths: LearningPath[];
  activeSession: StudySession | null;
  progress: Progress[];
  learningProfile: LearningProfile | null;
  paceProfile: PaceProfile | null;
  analytics: LearningAnalytics | null;
  isLoading: boolean;
  error: string | null;
}

export interface QuizState {
  currentQuiz: Quiz | null;
  activeAssessment: AdaptiveAssessment | null;
  currentQuestion: AdaptiveQuestion | null;
  answers: Record<string, any>;
  score: number;
  timeRemaining: number;
  isSubmitting: boolean;
  results: QuizResults | null;
  error: string | null;
}

export interface QuizResults {
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  percentage: number;
  timeSpent: number;
  feedback: string;
  recommendations: string[];
  passedThreshold: boolean;
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  conversationId: string | null;
  context: ChatContext | null;
  suggestions: string[];
}

export interface ChatContext {
  currentModule: string | null;
  learningObjective: string | null;
  userProgress: number;
  strugglingConcepts: string[];
  recentActivities: string[];
}

export interface NotificationState {
  notifications: Notification[];
  alerts: Alert[];
  unreadCount: number;
  settings: NotificationSettings;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actions?: NotificationActionItem[];
  expiresAt?: Date;
}

export interface Alert {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  persistent: boolean;
  actions?: NotificationActionItem[];
  timestamp: Date;
}

export interface NotificationActionItem {
  id: string;
  label: string;
  action: string;
  primary?: boolean;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  inApp: boolean;
  studyReminders: boolean;
  goalReminders: boolean;
  progressUpdates: boolean;
  systemAlerts: boolean;
}

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSync: Date | null;
  pendingChanges: PendingChange[];
  syncError: string | null;
  conflicts: SyncConflict[];
}

export interface PendingChange {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: string;
  data: any;
  timestamp: Date;
  attempts: number;
}

export interface SyncConflict {
  id: string;
  entity: string;
  local: any;
  remote: any;
  timestamp: Date;
  resolved: boolean;
}

export interface AppState {
  auth: AuthState;
  learning: LearningState;
  quiz: QuizState;
  chat: ChatState;
  notifications: NotificationState;
  sync: SyncState;
  ui: UIState;
}

export interface UIState {
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
  loading: boolean;
  modal: ModalState | null;
  toast: ToastState | null;
}

export interface ModalState {
  type: string;
  props: Record<string, any>;
  onClose?: () => void;
}

export interface ToastState {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  actions?: ToastAction[];
}

export interface ToastAction {
  label: string;
  action: () => void;
  variant?: 'primary' | 'secondary';
}

// Action types for reducers
export type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; token: string; refreshToken: string } }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'REFRESH_TOKEN_SUCCESS'; payload: { token: string; refreshToken: string } }
  | { type: 'SET_USER'; payload: User }
  | { type: 'CLEAR_ERROR' };

export type LearningAction =
  | { type: 'SET_CURRENT_PATH'; payload: LearningPath | null }
  | { type: 'SET_ALL_PATHS'; payload: LearningPath[] }
  | { type: 'SET_ACTIVE_SESSION'; payload: StudySession | null }
  | { type: 'UPDATE_PROGRESS'; payload: Progress[] }
  | { type: 'SET_LEARNING_PROFILE'; payload: LearningProfile | null }
  | { type: 'SET_PACE_PROFILE'; payload: PaceProfile | null }
  | { type: 'SET_ANALYTICS'; payload: LearningAnalytics | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET' };

export type QuizAction =
  | { type: 'START_QUIZ'; payload: Quiz }
  | { type: 'START_ASSESSMENT'; payload: AdaptiveAssessment }
  | { type: 'SET_CURRENT_QUESTION'; payload: AdaptiveQuestion | null }
  | { type: 'SET_ANSWER'; payload: { questionId: string; answer: any } }
  | { type: 'UPDATE_SCORE'; payload: number }
  | { type: 'UPDATE_TIME'; payload: number }
  | { type: 'SET_SUBMITTING'; payload: boolean }
  | { type: 'SET_RESULTS'; payload: QuizResults | null }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET_QUIZ' };

export type ChatAction =
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CONVERSATION_ID'; payload: string | null }
  | { type: 'SET_CONTEXT'; payload: ChatContext | null }
  | { type: 'SET_SUGGESTIONS'; payload: string[] }
  | { type: 'CLEAR_MESSAGES' };

export type NotificationAction =
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'MARK_AS_READ'; payload: string }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'ADD_ALERT'; payload: Alert }
  | { type: 'REMOVE_ALERT'; payload: string }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<NotificationSettings> }
  | { type: 'CLEAR_ALL' };

export type SyncAction =
  | { type: 'SET_ONLINE'; payload: boolean }
  | { type: 'SET_SYNCING'; payload: boolean }
  | { type: 'SET_LAST_SYNC'; payload: Date }
  | { type: 'ADD_PENDING_CHANGE'; payload: PendingChange }
  | { type: 'REMOVE_PENDING_CHANGE'; payload: string }
  | { type: 'SET_SYNC_ERROR'; payload: string | null }
  | { type: 'ADD_CONFLICT'; payload: SyncConflict }
  | { type: 'RESOLVE_CONFLICT'; payload: string };

export type UIAction =
  | { type: 'SET_THEME'; payload: 'light' | 'dark' | 'system' }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SHOW_MODAL'; payload: ModalState }
  | { type: 'HIDE_MODAL' }
  | { type: 'SHOW_TOAST'; payload: ToastState }
  | { type: 'HIDE_TOAST' };