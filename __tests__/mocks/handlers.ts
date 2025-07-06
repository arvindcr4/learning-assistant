import { http, HttpResponse } from 'msw'
import {
  mockUser,
  mockLearningProfile,
  mockLearningAnalytics,
  mockRecommendations,
  mockStyleAssessment,
  mockLearningSession,
  mockAdaptiveContent,
  createMockAPIResponse,
} from './test-data'

// Define the API base URL
const API_BASE = '/api'

export const handlers = [
  // Learning Profile endpoints
  http.post(`${API_BASE}/learning/profile`, async ({ request }) => {
    const body = await request.json() as any
    
    if (!body.userId) {
      return HttpResponse.json(
        createMockAPIResponse(null, false, undefined, 'User ID is required'),
        { status: 400 }
      )
    }
    
    return HttpResponse.json(
      createMockAPIResponse(mockLearningProfile, true, 'Profile created successfully')
    )
  }),

  http.get(`${API_BASE}/learning/profile`, ({ request }) => {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    
    if (!userId) {
      return HttpResponse.json(
        createMockAPIResponse(null, false, undefined, 'User ID is required'),
        { status: 400 }
      )
    }
    
    return HttpResponse.json(
      createMockAPIResponse(mockLearningProfile, true, 'Profile retrieved successfully')
    )
  }),

  // Learning Session endpoints
  http.post(`${API_BASE}/learning/session`, async ({ request }) => {
    const body = await request.json() as any
    
    if (!body.userId || !body.sessionData) {
      return HttpResponse.json(
        createMockAPIResponse(null, false, undefined, 'Session data and user ID are required'),
        { status: 400 }
      )
    }
    
    const mockResult = {
      updatedProfile: mockLearningProfile,
      paceAdjustments: [],
      recommendations: mockRecommendations.slice(0, 2),
    }
    
    return HttpResponse.json(
      createMockAPIResponse(mockResult, true, 'Session processed successfully')
    )
  }),

  // Analytics endpoints
  http.get(`${API_BASE}/learning/analytics`, ({ request }) => {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    
    if (!userId) {
      return HttpResponse.json(
        createMockAPIResponse(null, false, undefined, 'User ID is required'),
        { status: 400 }
      )
    }
    
    return HttpResponse.json(
      createMockAPIResponse(mockLearningAnalytics, true, 'Analytics generated successfully')
    )
  }),

  // Recommendations endpoints
  http.get(`${API_BASE}/learning/recommendations`, ({ request }) => {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    
    if (!userId) {
      return HttpResponse.json(
        createMockAPIResponse(null, false, undefined, 'User ID is required'),
        { status: 400 }
      )
    }
    
    return HttpResponse.json(
      createMockAPIResponse(mockRecommendations, true, 'Recommendations retrieved successfully')
    )
  }),

  // VARK Assessment endpoints
  http.post(`${API_BASE}/learning/assessment/vark`, async ({ request }) => {
    const body = await request.json() as any
    
    if (!body.userId || !body.responses) {
      return HttpResponse.json(
        createMockAPIResponse(null, false, undefined, 'User ID and responses are required'),
        { status: 400 }
      )
    }
    
    return HttpResponse.json(
      createMockAPIResponse(mockStyleAssessment, true, 'VARK assessment processed successfully')
    )
  }),

  // Content Adaptation endpoints
  http.post(`${API_BASE}/learning/content/adapt`, async ({ request }) => {
    const body = await request.json() as any
    
    if (!body.userId || !body.content) {
      return HttpResponse.json(
        createMockAPIResponse(null, false, undefined, 'User ID and content are required'),
        { status: 400 }
      )
    }
    
    const mockAdaptedContent = {
      selectedVariant: mockAdaptiveContent.contentVariants[0],
      adaptedDifficulty: 6,
      reasoning: 'Selected visual content variant based on user preference. Increased difficulty due to high recent performance.',
    }
    
    return HttpResponse.json(
      createMockAPIResponse(mockAdaptedContent, true, 'Content adapted successfully')
    )
  }),

  // User management endpoints
  http.get(`${API_BASE}/users/:userId`, ({ params }) => {
    const { userId } = params
    
    if (!userId) {
      return HttpResponse.json(
        createMockAPIResponse(null, false, undefined, 'User ID is required'),
        { status: 400 }
      )
    }
    
    return HttpResponse.json(
      createMockAPIResponse(mockUser, true, 'User retrieved successfully')
    )
  }),

  http.put(`${API_BASE}/users/:userId`, async ({ params, request }) => {
    const { userId } = params
    const body = await request.json() as any
    
    if (!userId) {
      return HttpResponse.json(
        createMockAPIResponse(null, false, undefined, 'User ID is required'),
        { status: 400 }
      )
    }
    
    const updatedUser = { ...mockUser, ...body, updatedAt: new Date() }
    
    return HttpResponse.json(
      createMockAPIResponse(updatedUser, true, 'User updated successfully')
    )
  }),

  // Learning Path endpoints
  http.get(`${API_BASE}/learning-paths`, ({ request }) => {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    
    if (!userId) {
      return HttpResponse.json(
        createMockAPIResponse(null, false, undefined, 'User ID is required'),
        { status: 400 }
      )
    }
    
    const mockPaths = [
      {
        id: 'path-1',
        title: 'JavaScript Fundamentals',
        description: 'Learn the basics of JavaScript',
        difficulty: 'beginner',
        estimatedDuration: 1200,
        progress: 65,
      },
      {
        id: 'path-2',
        title: 'React Development',
        description: 'Build modern web applications with React',
        difficulty: 'intermediate',
        estimatedDuration: 1800,
        progress: 30,
      },
    ]
    
    return HttpResponse.json(
      createMockAPIResponse(mockPaths, true, 'Learning paths retrieved successfully')
    )
  }),

  // Quiz endpoints
  http.get(`${API_BASE}/quizzes/:quizId`, ({ params }) => {
    const { quizId } = params
    
    const mockQuiz = {
      id: quizId,
      title: 'JavaScript Variables Quiz',
      description: 'Test your knowledge of JavaScript variables',
      questions: [
        {
          id: 'q1',
          text: 'Which keyword is used to declare a variable?',
          type: 'multiple-choice',
          options: ['var', 'let', 'const', 'All of the above'],
          correctAnswer: 'All of the above',
        },
      ],
      timeLimit: 15,
      passingScore: 70,
    }
    
    return HttpResponse.json(
      createMockAPIResponse(mockQuiz, true, 'Quiz retrieved successfully')
    )
  }),

  http.post(`${API_BASE}/quizzes/:quizId/submit`, async ({ params, request }) => {
    const { quizId } = params
    const body = await request.json() as any
    
    if (!body.userId || !body.answers) {
      return HttpResponse.json(
        createMockAPIResponse(null, false, undefined, 'User ID and answers are required'),
        { status: 400 }
      )
    }
    
    const mockResult = {
      score: 85,
      totalQuestions: 10,
      correctAnswers: 8,
      timeSpent: 12,
      passed: true,
      feedback: [
        {
          questionId: 'q1',
          correct: true,
          explanation: 'Correct! All three keywords can be used to declare variables.',
        },
      ],
    }
    
    return HttpResponse.json(
      createMockAPIResponse(mockResult, true, 'Quiz submitted successfully')
    )
  }),

  // Error simulation endpoints for testing error handling
  http.get(`${API_BASE}/test/server-error`, () => {
    return HttpResponse.json(
      createMockAPIResponse(null, false, undefined, 'Internal server error'),
      { status: 500 }
    )
  }),

  http.get(`${API_BASE}/test/timeout`, async () => {
    // Simulate a slow response
    await new Promise(resolve => setTimeout(resolve, 5000))
    return HttpResponse.json(
      createMockAPIResponse(null, false, undefined, 'Request timeout'),
      { status: 408 }
    )
  }),

  http.get(`${API_BASE}/test/network-error`, () => {
    return HttpResponse.error()
  }),

  // Catch-all handler for unmocked requests
  http.all('*', ({ request }) => {
    console.warn(`Unmocked ${request.method} request to ${request.url}`)
    return HttpResponse.json(
      createMockAPIResponse(null, false, undefined, 'Endpoint not mocked'),
      { status: 404 }
    )
  }),
]

// Error handlers for specific test scenarios
export const errorHandlers = [
  http.post(`${API_BASE}/learning/profile`, () => {
    return HttpResponse.json(
      createMockAPIResponse(null, false, undefined, 'Database connection failed'),
      { status: 500 }
    )
  }),

  http.get(`${API_BASE}/learning/analytics`, () => {
    return HttpResponse.json(
      createMockAPIResponse(null, false, undefined, 'Analytics service unavailable'),
      { status: 503 }
    )
  }),

  http.post(`${API_BASE}/learning/session`, () => {
    return HttpResponse.json(
      createMockAPIResponse(null, false, undefined, 'Session processing failed'),
      { status: 500 }
    )
  }),
]

// Delayed response handlers for performance testing
export const slowHandlers = [
  http.get(`${API_BASE}/learning/analytics`, async ({ request }) => {
    await new Promise(resolve => setTimeout(resolve, 2000)) // 2 second delay
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    
    if (!userId) {
      return HttpResponse.json(
        createMockAPIResponse(null, false, undefined, 'User ID is required'),
        { status: 400 }
      )
    }
    
    return HttpResponse.json(
      createMockAPIResponse(mockLearningAnalytics, true, 'Analytics generated successfully')
    )
  }),
]