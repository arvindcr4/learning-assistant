import {
  User,
  LearningProfile,
  LearningSession,
  LearningPath,
  LearningModule,
  Quiz,
  Question,
  BehavioralIndicator,
  StyleAssessment,
  AdaptiveContent,
  ContentVariant,
  LearningAnalytics,
  Recommendation,
  LearningStyleType,
  ContentFormat,
  InteractivityLevel,
} from '@/types'

export const mockUser: User = {
  id: 'user-123',
  name: 'John Doe',
  email: 'john.doe@example.com',
  avatar: 'https://example.com/avatar.jpg',
  preferences: {
    learningGoals: ['Master JavaScript', 'Learn React', 'Understand AI'],
    preferredTopics: ['Programming', 'Web Development', 'Machine Learning'],
    difficultyLevel: 'intermediate',
    studySchedule: {
      dailyGoal: 60,
      preferredTimes: ['09:00', '14:00', '19:00'],
      daysPerWeek: 5,
    },
    notifications: {
      email: true,
      push: true,
      reminders: true,
    },
  },
  learningProfile: {} as LearningProfile, // Will be filled separately
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-15'),
}

export const mockLearningProfile: LearningProfile = {
  id: 'profile-123',
  userId: 'user-123',
  styles: [
    {
      type: LearningStyleType.VISUAL,
      score: 85,
      confidence: 0.9,
      lastUpdated: new Date('2024-01-15'),
    },
    {
      type: LearningStyleType.AUDITORY,
      score: 60,
      confidence: 0.7,
      lastUpdated: new Date('2024-01-15'),
    },
    {
      type: LearningStyleType.READING,
      score: 70,
      confidence: 0.8,
      lastUpdated: new Date('2024-01-15'),
    },
    {
      type: LearningStyleType.KINESTHETIC,
      score: 45,
      confidence: 0.6,
      lastUpdated: new Date('2024-01-15'),
    },
  ],
  dominantStyle: LearningStyleType.VISUAL,
  isMultimodal: true,
  assessmentHistory: [],
  behavioralIndicators: [],
  adaptationLevel: 78,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-15'),
}

export const mockStyleAssessment: StyleAssessment = {
  id: 'assessment-123',
  type: 'questionnaire',
  results: {
    visual: 0.4,
    auditory: 0.25,
    reading: 0.25,
    kinesthetic: 0.1,
  },
  confidence: 0.85,
  dataPoints: 16,
  completedAt: new Date('2024-01-10'),
}

export const mockBehavioralIndicators: BehavioralIndicator[] = [
  {
    action: 'video_watch',
    contentType: LearningStyleType.VISUAL,
    engagementLevel: 88,
    completionRate: 95,
    timeSpent: 25,
    timestamp: new Date('2024-01-15T10:00:00Z'),
  },
  {
    action: 'read_content',
    contentType: LearningStyleType.READING,
    engagementLevel: 72,
    completionRate: 85,
    timeSpent: 15,
    timestamp: new Date('2024-01-15T11:00:00Z'),
  },
  {
    action: 'audio_listen',
    contentType: LearningStyleType.AUDITORY,
    engagementLevel: 65,
    completionRate: 80,
    timeSpent: 20,
    timestamp: new Date('2024-01-15T12:00:00Z'),
  },
]

export const mockLearningSession: LearningSession = {
  id: 'session-123',
  userId: 'user-123',
  contentId: 'content-123',
  startTime: new Date('2024-01-15T10:00:00Z'),
  endTime: new Date('2024-01-15T10:30:00Z'),
  duration: 30,
  itemsCompleted: 8,
  correctAnswers: 7,
  totalQuestions: 10,
  engagementMetrics: {
    focusTime: 25,
    distractionEvents: 2,
    interactionRate: 3.5,
    scrollDepth: 85,
    videoWatchTime: 20,
    pauseFrequency: 1,
  },
  adaptiveChanges: [
    {
      timestamp: new Date('2024-01-15T10:15:00Z'),
      changeType: 'difficulty',
      previousValue: 5,
      newValue: 6,
      reason: 'High accuracy detected',
      userResponse: 'accepted',
    },
  ],
  completed: true,
}

export const mockLearningPath: LearningPath = {
  id: 'path-123',
  title: 'JavaScript Fundamentals',
  description: 'Learn the basics of JavaScript programming',
  difficulty: 'intermediate',
  estimatedDuration: 1200, // 20 hours
  topics: ['Variables', 'Functions', 'Objects', 'Arrays', 'DOM Manipulation'],
  modules: [],
  progress: 65,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-15'),
}

export const mockLearningModule: LearningModule = {
  id: 'module-123',
  pathId: 'path-123',
  title: 'Variables and Data Types',
  description: 'Understanding JavaScript variables and data types',
  content: 'JavaScript variables are containers for storing data values...',
  type: 'interactive',
  duration: 45,
  order: 1,
  completed: true,
  resources: [
    {
      id: 'resource-1',
      title: 'MDN Variables Guide',
      type: 'link',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Grammar_and_types',
      description: 'Comprehensive guide to JavaScript variables',
    },
    {
      id: 'resource-2',
      title: 'Variables Exercise',
      type: 'file',
      url: '/exercises/variables.js',
      description: 'Practice exercises for variables',
    },
  ],
}

export const mockQuiz: Quiz = {
  id: 'quiz-123',
  moduleId: 'module-123',
  title: 'Variables Quiz',
  description: 'Test your knowledge of JavaScript variables',
  questions: [],
  timeLimit: 15,
  passingScore: 70,
}

export const mockQuestions: Question[] = [
  {
    id: 'q1',
    text: 'Which keyword is used to declare a variable in JavaScript?',
    type: 'multiple-choice',
    options: ['var', 'let', 'const', 'All of the above'],
    correctAnswer: 'All of the above',
    explanation: 'JavaScript has three keywords for declaring variables: var, let, and const.',
    points: 10,
  },
  {
    id: 'q2',
    text: 'JavaScript is a dynamically typed language.',
    type: 'true-false',
    correctAnswer: 'true',
    explanation: 'JavaScript is indeed dynamically typed, meaning variable types are determined at runtime.',
    points: 5,
  },
  {
    id: 'q3',
    text: 'What is the output of: console.log(typeof null)?',
    type: 'short-answer',
    correctAnswer: 'object',
    explanation: 'In JavaScript, typeof null returns "object" due to a historical bug in the language.',
    points: 15,
  },
]

export const mockContentVariants: ContentVariant[] = [
  {
    styleType: LearningStyleType.VISUAL,
    format: ContentFormat.VIDEO,
    content: {
      type: 'video',
      url: 'https://example.com/visual-content.mp4',
      duration: 600,
      transcript: 'This video explains variables...',
      captions: 'SRT format captions',
    },
    interactivity: InteractivityLevel.MEDIUM,
    accessibility: {
      screenReaderSupport: true,
      highContrast: true,
      largeFonts: false,
      keyboardNavigation: true,
      audioDescription: true,
      signLanguage: false,
    },
  },
  {
    styleType: LearningStyleType.AUDITORY,
    format: ContentFormat.AUDIO,
    content: {
      type: 'audio',
      url: 'https://example.com/audio-content.mp3',
      duration: 480,
      transcript: 'Listen to this explanation of variables...',
    },
    interactivity: InteractivityLevel.LOW,
    accessibility: {
      screenReaderSupport: true,
      highContrast: false,
      largeFonts: false,
      keyboardNavigation: true,
      audioDescription: false,
      signLanguage: false,
    },
  },
  {
    styleType: LearningStyleType.READING,
    format: ContentFormat.TEXT,
    content: 'Variables in JavaScript are containers for storing data values. You can think of them as labeled boxes...',
    interactivity: InteractivityLevel.LOW,
    accessibility: {
      screenReaderSupport: true,
      highContrast: true,
      largeFonts: true,
      keyboardNavigation: true,
      audioDescription: false,
      signLanguage: false,
    },
  },
  {
    styleType: LearningStyleType.KINESTHETIC,
    format: ContentFormat.INTERACTIVE,
    content: {
      type: 'interactive',
      url: 'https://example.com/interactive-variables',
    },
    interactivity: InteractivityLevel.HIGH,
    accessibility: {
      screenReaderSupport: true,
      highContrast: true,
      largeFonts: false,
      keyboardNavigation: true,
      audioDescription: false,
      signLanguage: false,
    },
  },
]

export const mockAdaptiveContent: AdaptiveContent = {
  id: 'content-123',
  title: 'JavaScript Variables',
  description: 'Learn about JavaScript variables and data types',
  concept: 'Variables',
  learningObjectives: [
    'Understand what variables are',
    'Learn different ways to declare variables',
    'Understand variable scope',
    'Practice using variables in code',
  ],
  difficulty: 3,
  estimatedDuration: 45,
  contentVariants: mockContentVariants,
  assessments: [],
  prerequisites: ['Basic programming concepts'],
  metadata: {
    tags: ['javascript', 'variables', 'programming', 'fundamentals'],
    language: 'en',
    difficulty: 3,
    bloomsTaxonomyLevel: 'Understanding',
    cognitiveLoad: 5,
    estimatedEngagement: 8,
    successRate: 78,
  },
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-10'),
}

export const mockLearningAnalytics: LearningAnalytics = {
  id: 'analytics-123',
  userId: 'user-123',
  timeRange: {
    start: new Date('2024-01-01'),
    end: new Date('2024-01-15'),
  },
  overallProgress: {
    totalTimeSpent: 1350, // 22.5 hours
    contentCompleted: 18,
    averageScore: 78,
    completionRate: 85,
    retentionRate: 82,
    streakDays: 7,
    goalsAchieved: 4,
    totalGoals: 6,
  },
  styleEffectiveness: [
    {
      style: LearningStyleType.VISUAL,
      engagementScore: 88,
      comprehensionScore: 85,
      completionRate: 92,
      timeToMastery: 42,
      preferenceStrength: 85,
    },
    {
      style: LearningStyleType.AUDITORY,
      engagementScore: 65,
      comprehensionScore: 70,
      completionRate: 78,
      timeToMastery: 58,
      preferenceStrength: 60,
    },
    {
      style: LearningStyleType.READING,
      engagementScore: 75,
      comprehensionScore: 80,
      completionRate: 85,
      timeToMastery: 48,
      preferenceStrength: 70,
    },
    {
      style: LearningStyleType.KINESTHETIC,
      engagementScore: 55,
      comprehensionScore: 65,
      completionRate: 70,
      timeToMastery: 65,
      preferenceStrength: 45,
    },
  ],
  paceAnalysis: {
    averagePace: 3.8,
    optimalPace: 4.2,
    paceConsistency: 82,
    fatiguePattern: {
      onsetTime: 45,
      recoveryTime: 12,
      indicators: ['decreased_accuracy', 'increased_response_time'],
      severity: 'low',
    },
    peakPerformanceTime: '10:00 AM',
    recommendedBreaks: 2,
  },
  contentEngagement: [
    {
      contentId: 'content-123',
      contentType: ContentFormat.VIDEO,
      engagementScore: 88,
      completionRate: 95,
      revisitRate: 25,
      timeSpent: 180,
      userRating: 4,
    },
    {
      contentId: 'content-124',
      contentType: ContentFormat.INTERACTIVE,
      engagementScore: 92,
      completionRate: 88,
      revisitRate: 15,
      timeSpent: 240,
      userRating: 5,
    },
  ],
  performanceTrends: [
    {
      metric: 'accuracy',
      timeRange: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-15'),
      },
      values: [0.65, 0.68, 0.72, 0.75, 0.78, 0.82, 0.85],
      trend: 'improving',
      significance: 0.85,
      factors: ['consistent_practice', 'adaptive_difficulty'],
    },
  ],
  recommendations: [],
  predictions: [
    {
      metric: 'completion_rate',
      predictedValue: 88,
      confidence: 78,
      timeframe: 7,
      factors: [
        {
          factor: 'current_pace',
          importance: 85,
          currentValue: 3.8,
          optimalValue: 4.2,
        },
        {
          factor: 'engagement_level',
          importance: 75,
          currentValue: 82,
          optimalValue: 85,
        },
      ],
      recommendations: [
        'Increase daily study time by 10 minutes',
        'Focus on visual learning materials',
      ],
    },
  ],
  generatedAt: new Date('2024-01-15'),
}

export const mockRecommendations: Recommendation[] = [
  {
    id: 'rec-1',
    type: 'style',
    title: 'Optimize Visual Learning',
    description: 'Your visual learning style shows the highest engagement. Consider focusing more on video content and diagrams.',
    reasoning: 'Visual content shows 88% engagement vs 65% average for other styles',
    confidence: 92,
    priority: 'medium',
    actionRequired: false,
    estimatedImpact: 78,
    createdAt: new Date('2024-01-15'),
    expiresAt: new Date('2024-01-22'),
  },
  {
    id: 'rec-2',
    type: 'pace',
    title: 'Increase Learning Pace',
    description: 'Your performance indicates you can handle a faster learning pace. Consider increasing your daily study time.',
    reasoning: 'Accuracy above 80% and low fatigue levels detected',
    confidence: 85,
    priority: 'low',
    actionRequired: false,
    estimatedImpact: 65,
    createdAt: new Date('2024-01-15'),
  },
  {
    id: 'rec-3',
    type: 'schedule',
    title: 'Optimize Study Schedule',
    description: 'Your peak performance time is 10:00 AM. Schedule challenging content during this time.',
    reasoning: 'Performance analytics show 25% higher accuracy at 10:00 AM',
    confidence: 88,
    priority: 'high',
    actionRequired: true,
    estimatedImpact: 82,
    createdAt: new Date('2024-01-15'),
  },
]

export const mockVARKResponses = {
  'q1': 'I prefer to see diagrams, charts, and visual representations',
  'q2': 'I like to listen to explanations and discuss topics with others',
  'q3': 'I learn best by reading detailed text and taking notes',
  'q4': 'I prefer hands-on activities and learning by doing',
  'q5': 'Visual aids like maps and graphs help me understand concepts',
  'q6': 'I remember information better when I hear it explained',
  'q7': 'I like to read instructions and reference materials',
  'q8': 'I learn best through physical activities and experiments',
  'q9': 'I prefer presentations with lots of visual elements',
  'q10': 'I enjoy group discussions and verbal explanations',
  'q11': 'I like to take detailed written notes during lectures',
  'q12': 'I prefer interactive demonstrations and hands-on practice',
  'q13': 'Flowcharts and diagrams help me organize information',
  'q14': 'I remember things better when I hear them multiple times',
  'q15': 'I prefer reading textbooks and written materials',
  'q16': 'I learn best when I can manipulate objects and materials',
}

// Helper functions for creating test data
export const createMockUser = (overrides: Partial<User> = {}): User => ({
  ...mockUser,
  ...overrides,
})

export const createMockLearningProfile = (overrides: Partial<LearningProfile> = {}): LearningProfile => ({
  ...mockLearningProfile,
  ...overrides,
})

export const createMockLearningSession = (overrides: Partial<LearningSession> = {}): LearningSession => ({
  ...mockLearningSession,
  ...overrides,
})

export const createMockBehavioralIndicator = (overrides: Partial<BehavioralIndicator> = {}): BehavioralIndicator => ({
  action: 'test_action',
  contentType: LearningStyleType.VISUAL,
  engagementLevel: 75,
  completionRate: 80,
  timeSpent: 20,
  timestamp: new Date(),
  ...overrides,
})

export const createMockRecommendation = (overrides: Partial<Recommendation> = {}): Recommendation => ({
  id: 'rec-' + Math.random().toString(36).substr(2, 9),
  type: 'style',
  title: 'Test Recommendation',
  description: 'Test recommendation description',
  reasoning: 'Test reasoning',
  confidence: 80,
  priority: 'medium',
  actionRequired: false,
  estimatedImpact: 60,
  createdAt: new Date(),
  ...overrides,
})

// Mock API responses
export const createMockAPIResponse = <T>(data: T, success = true, message?: string, error?: string) => ({
  data,
  success,
  message,
  error,
})

// Performance test data
export const createLargeDataset = (size: number) => {
  const sessions: LearningSession[] = []
  const indicators: BehavioralIndicator[] = []
  
  for (let i = 0; i < size; i++) {
    sessions.push(createMockLearningSession({
      id: `session-${i}`,
      startTime: new Date(Date.now() - i * 24 * 60 * 60 * 1000), // i days ago
      correctAnswers: Math.floor(Math.random() * 10),
      totalQuestions: 10,
      engagementMetrics: {
        focusTime: Math.random() * 30,
        distractionEvents: Math.floor(Math.random() * 5),
        interactionRate: Math.random() * 10,
        scrollDepth: Math.random() * 100,
        videoWatchTime: Math.random() * 25,
        pauseFrequency: Math.floor(Math.random() * 3),
      },
    }))
    
    indicators.push(createMockBehavioralIndicator({
      engagementLevel: Math.floor(Math.random() * 100),
      completionRate: Math.floor(Math.random() * 100),
      timeSpent: Math.random() * 60,
      timestamp: new Date(Date.now() - i * 60 * 60 * 1000), // i hours ago
    }))
  }
  
  return { sessions, indicators }
}

// VARK Test Data Generator
export const generateVARKResponses = (count = 64): VARKResponse[] => {
  const responses: VARKResponse[] = []
  
  for (let i = 1; i <= count; i++) {
    const questionId = `q${i}`
    const optionIndex = Math.floor(Math.random() * 4) // Random option a, b, c, or d
    const optionId = `${questionId}${String.fromCharCode(97 + optionIndex)}` // 97 is 'a'
    
    responses.push({
      questionId,
      selectedOptions: [optionId],
    })
  }
  
  return responses
}

export const generateValidVARKResponses = (): VARKResponse[] => {
  // Generate responses that will pass validation (at least 80% of 80 questions = 64 responses)
  return generateVARKResponses(64)
}

export const generatePartialVARKResponses = (): VARKResponse[] => {
  // Generate responses that will fail validation (less than 80%)
  return generateVARKResponses(30)
}

// Import VARKResponse type
import { VARKResponse } from '@/lib/vark-questionnaire'