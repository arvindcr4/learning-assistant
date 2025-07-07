// Learning Algorithm Type Definitions
// Comprehensive type definitions for all learning algorithms and ML components

export interface MLInsight {
  id: string;
  type: 'pattern_detection' | 'prediction' | 'recommendation' | 'anomaly';
  description: string;
  confidence: number; // 0-1
  actionable_insights: string[];
  data_points: number;
  algorithm_used: string;
  generatedAt: Date;
  expiresAt?: Date;
}

export interface PerformanceMetrics {
  accuracy: number; // 0-100
  speed: number; // items per hour
  consistency: number; // 0-100
  retention: number; // 0-100
  engagement: number; // 0-100
  improvement_rate: number; // percentage change
  learning_velocity: number; // concepts per hour
  error_patterns: ErrorPattern[];
  strengths: string[];
  weaknesses: string[];
}

export interface ErrorPattern {
  pattern_type: string;
  frequency: number;
  severity: 'low' | 'medium' | 'high';
  affected_concepts: string[];
  suggested_remediation: string[];
  pattern_confidence: number; // 0-1
}

export interface BehavioralPattern {
  id: string;
  userId: string;
  patternType: 'engagement' | 'fatigue' | 'learning_style' | 'performance' | 'attention';
  description: string;
  frequency: number;
  confidence: number; // 0-1
  timeframe: {
    start: Date;
    end: Date;
  };
  triggers: string[];
  learningImpact: {
    impactType: 'positive' | 'negative' | 'neutral';
    magnitude: number; // 0-100
    affectedAreas: string[];
  };
  detectedAt: Date;
}

export interface AssessmentState {
  currentQuestionIndex: number;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  timeElapsed: number; // seconds
  confidenceLevel: number; // 0-1
  adaptiveAdjustments: number;
  difficultyProgression: number[];
  terminated: boolean;
  terminationReason?: string;
}

export interface ContentRecommendation {
  contentId: string;
  title: string;
  type: 'reading' | 'video' | 'interactive' | 'practice';
  difficulty: number; // 1-10
  estimatedTime: number; // minutes
  relevanceScore: number; // 0-100
  personalizedReason: string;
  prerequisites: string[];
  learningObjectives: string[];
  adaptationFactors: {
    style_match: number; // 0-100
    difficulty_fit: number; // 0-100
    interest_alignment: number; // 0-100
    skill_gap_address: number; // 0-100
  };
}

export interface LearningPathOptimization {
  originalPath: string[];
  optimizedPath: string[];
  optimizationReason: string;
  expectedImprovement: {
    time_savings: number; // percentage
    engagement_increase: number; // percentage
    retention_improvement: number; // percentage
  };
  personalizationFactors: string[];
  confidence: number; // 0-1
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

export interface LearningEfficiencyMetrics {
  conceptsLearnedPerHour: number;
  retentionDecayRate: number; // percentage per day
  transferLearningScore: number; // 0-100
  metacognitionLevel: number; // 0-100
  self_regulation_score: number; // 0-100
  motivation_persistence: number; // 0-100
}

export interface PersonalizationProfile {
  learningStyle: string;
  cognitiveLoad_preference: number; // 1-10
  feedback_preference: 'immediate' | 'delayed' | 'summary';
  difficulty_preference: 'challenging' | 'moderate' | 'gradual';
  pacing_preference: 'self_paced' | 'guided' | 'structured';
  content_format_preferences: string[];
  interaction_style: 'active' | 'reflective' | 'mixed';
}

export interface PredictiveModel {
  model_type: 'performance' | 'retention' | 'engagement' | 'completion';
  algorithm: string;
  accuracy: number; // 0-1
  last_trained: Date;
  features_used: string[];
  prediction_horizon: number; // days
  confidence_intervals: {
    lower: number;
    upper: number;
  };
}