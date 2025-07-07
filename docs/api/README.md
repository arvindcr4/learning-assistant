# Learning Assistant API Documentation

## Overview

The Learning Assistant API provides a comprehensive RESTful interface for managing user learning experiences, progress tracking, analytics, and AI-powered interactions. This documentation covers all available endpoints, authentication methods, and integration examples.

## Table of Contents

1. [Authentication](#authentication)
2. [API Endpoints](#api-endpoints)
3. [Request/Response Format](#requestresponse-format)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [Security](#security)
7. [SDK Examples](#sdk-examples)
8. [Webhook Integration](#webhook-integration)

## Authentication

### Overview

The Learning Assistant API uses [Better Auth](https://better-auth.com/) for authentication with support for multiple authentication methods including email/password, OAuth providers, and session-based authentication.

### Authentication Methods

#### 1. Session-Based Authentication

For web applications, the API uses secure session cookies:

```typescript
// Example login request
const response = await fetch('/api/auth/sign-in', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'your-password'
  })
});
```

#### 2. API Key Authentication

For server-to-server communications:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     https://api.learningassistant.com/api/learning/profile
```

#### 3. OAuth 2.0

Supported OAuth providers:
- Google
- GitHub
- Microsoft
- Apple

```typescript
// OAuth redirect example
window.location.href = '/api/auth/oauth/google';
```

### CSRF Protection

All state-changing operations require CSRF tokens:

```typescript
// Get CSRF token
const csrfResponse = await fetch('/api/csrf');
const { token } = await csrfResponse.json();

// Include in requests
const response = await fetch('/api/learning/profile', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': token
  },
  body: JSON.stringify(data)
});
```

## API Endpoints

### Authentication Endpoints

#### `POST /api/auth/sign-in`
User login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": true
  },
  "session": {
    "id": "session-456",
    "expiresAt": "2024-12-31T23:59:59Z"
  }
}
```

#### `POST /api/auth/sign-up`
User registration.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "your-password",
  "name": "John Doe"
}
```

#### `POST /api/auth/sign-out`
User logout.

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Learning Profile Endpoints

#### `GET /api/learning/profile`
Retrieve user's learning profile.

**Headers:**
- `Authorization: Bearer <token>` (if using API key)
- `Cookie: session=<session-id>` (for session auth)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "profile-123",
    "userId": "user-123",
    "learningStyle": "visual",
    "preferences": {
      "difficulty": "intermediate",
      "pace": "normal",
      "subjects": ["mathematics", "science"]
    },
    "progress": {
      "completedLessons": 45,
      "totalLessons": 100,
      "averageScore": 85
    },
    "lastActivity": "2024-01-07T12:00:00Z"
  }
}
```

#### `POST /api/learning/profile`
Update user's learning profile.

**Headers:**
- `Authorization: Bearer <token>`
- `X-CSRF-Token: <csrf-token>`

**Request Body:**
```json
{
  "learningStyle": "kinesthetic",
  "preferences": {
    "difficulty": "advanced",
    "pace": "fast",
    "subjects": ["mathematics", "physics", "chemistry"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "profile-123",
    "userId": "user-123",
    "learningStyle": "kinesthetic",
    "preferences": {
      "difficulty": "advanced",
      "pace": "fast",
      "subjects": ["mathematics", "physics", "chemistry"]
    },
    "updatedAt": "2024-01-07T12:00:00Z"
  },
  "message": "Profile updated successfully"
}
```

### Learning Session Endpoints

#### `POST /api/learning/session`
Create or update a learning session.

**Headers:**
- `Authorization: Bearer <token>`
- `X-CSRF-Token: <csrf-token>`

**Request Body:**
```json
{
  "sessionData": {
    "contentId": "lesson-456",
    "duration": 1800,
    "score": 85,
    "questionsCorrect": 8,
    "questionsTotal": 10,
    "engagementMetrics": {
      "focusTime": 1650,
      "distractionEvents": 2,
      "interactionRate": 0.8
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "session-789",
    "userId": "user-123",
    "contentId": "lesson-456",
    "duration": 1800,
    "score": 85,
    "completed": true,
    "processedAt": "2024-01-07T12:00:00Z",
    "insights": {
      "learningEfficiency": 85,
      "recommendedBreak": false,
      "nextDifficulty": "intermediate"
    }
  },
  "message": "Session processed successfully"
}
```

### Analytics Endpoints

#### `GET /api/analytics/dashboard`
Get comprehensive learning analytics.

**Query Parameters:**
- `userId` (required): User ID
- `timeRange` (optional): Number of days (default: 30)
- `metrics` (optional): Array of specific metrics to include

**Example Request:**
```bash
curl "https://api.learningassistant.com/api/analytics/dashboard?userId=user-123&timeRange=7&metrics=accuracy,engagement" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "metrics": {
      "totalSessions": 42,
      "averageAccuracy": 87.5,
      "averageEngagement": 78.2,
      "completionRate": 94.3,
      "dailyStats": {
        "2024-01-01": {
          "sessions": 3,
          "accuracy": 85,
          "engagement": 80,
          "completionRate": 100
        }
      },
      "timeSeriesData": [
        {
          "date": "2024-01-01",
          "sessions": 3,
          "accuracy": 85,
          "engagement": 80
        }
      ]
    },
    "trends": [
      {
        "metric": "accuracy",
        "direction": "improving",
        "confidence": 0.85
      }
    ],
    "outliers": [],
    "patterns": [
      {
        "type": "peak_performance",
        "time": "14:00-16:00",
        "confidence": 0.92
      }
    ],
    "timeRange": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-01-07T23:59:59Z"
    }
  },
  "metadata": {
    "userId": "user-123",
    "timeRange": 7,
    "sessionCount": 42,
    "generatedAt": "2024-01-07T12:00:00Z"
  }
}
```

#### `GET /api/analytics/performance`
Get detailed performance analytics.

**Query Parameters:**
- `userId` (required): User ID
- `subject` (optional): Filter by subject
- `startDate` (optional): Start date for analytics
- `endDate` (optional): End date for analytics

**Response:**
```json
{
  "success": true,
  "data": {
    "overallPerformance": {
      "accuracy": 87.5,
      "consistency": 92.1,
      "improvement": 15.3,
      "retention": 84.7
    },
    "subjectPerformance": {
      "mathematics": {
        "accuracy": 89.2,
        "timeSpent": 450,
        "difficulty": "intermediate"
      },
      "science": {
        "accuracy": 85.8,
        "timeSpent": 380,
        "difficulty": "beginner"
      }
    },
    "learningEfficiency": {
      "conceptsPerHour": 2.3,
      "optimalStudyTime": "14:00-16:00",
      "recommendedBreakFrequency": 45
    },
    "predictions": {
      "nextWeekPerformance": 89.5,
      "timeToMastery": 21,
      "difficultyReadiness": "advanced"
    }
  }
}
```

### Content Endpoints

#### `GET /api/content/paths`
Get available learning paths.

**Query Parameters:**
- `subject` (optional): Filter by subject
- `difficulty` (optional): Filter by difficulty level
- `limit` (optional): Number of results (default: 20)
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "success": true,
  "data": {
    "paths": [
      {
        "id": "path-123",
        "title": "Introduction to Machine Learning",
        "description": "Learn the fundamentals of ML",
        "difficulty": "beginner",
        "estimatedDuration": 2400,
        "subjects": ["computer-science", "mathematics"],
        "moduleCount": 12,
        "enrollmentCount": 1250,
        "rating": 4.8
      }
    ],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 20,
      "hasMore": true
    }
  }
}
```

#### `GET /api/content/modules/{moduleId}`
Get specific module content.

**Path Parameters:**
- `moduleId`: Module identifier

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "module-456",
    "title": "Linear Regression Basics",
    "description": "Understanding linear regression",
    "content": {
      "text": "Linear regression is...",
      "media": [
        {
          "type": "video",
          "url": "https://example.com/video.mp4",
          "duration": 600
        }
      ],
      "interactive": [
        {
          "type": "simulation",
          "url": "https://example.com/simulation"
        }
      ]
    },
    "assessments": [
      {
        "id": "quiz-789",
        "type": "adaptive",
        "questionCount": 10
      }
    ],
    "prerequisites": ["module-123"],
    "nextModules": ["module-789"]
  }
}
```

### Assessment Endpoints

#### `POST /api/assessment/start`
Start a new assessment.

**Request Body:**
```json
{
  "assessmentId": "assessment-123",
  "moduleId": "module-456",
  "settings": {
    "adaptive": true,
    "timeLimit": 1800,
    "maxQuestions": 15
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "assessment-session-789",
    "firstQuestion": {
      "id": "question-123",
      "text": "What is the slope of the line y = 2x + 3?",
      "type": "multiple-choice",
      "options": ["1", "2", "3", "4"],
      "timeLimit": 60
    },
    "progress": {
      "current": 1,
      "total": 15,
      "estimatedRemaining": 14
    }
  }
}
```

#### `POST /api/assessment/answer`
Submit an answer to an assessment question.

**Request Body:**
```json
{
  "sessionId": "assessment-session-789",
  "questionId": "question-123",
  "answer": "2",
  "timeSpent": 45
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "correct": true,
    "feedback": "Correct! The slope is the coefficient of x.",
    "nextQuestion": {
      "id": "question-124",
      "text": "What is the y-intercept of y = 2x + 3?",
      "type": "multiple-choice",
      "options": ["1", "2", "3", "4"]
    },
    "progress": {
      "current": 2,
      "total": 15,
      "score": 10,
      "accuracy": 100
    }
  }
}
```

### Chat/AI Assistant Endpoints

#### `POST /api/chat/sessions`
Create a new chat session.

**Request Body:**
```json
{
  "context": {
    "moduleId": "module-456",
    "learningObjective": "understand linear regression",
    "difficulty": "beginner"
  },
  "settings": {
    "persona": "educational_tutor",
    "adaptiveMode": true,
    "conversationStyle": "socratic"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "chat-session-123",
    "initialMessage": {
      "id": "message-456",
      "content": "Hello! I'm here to help you understand linear regression. What would you like to start with?",
      "role": "assistant",
      "timestamp": "2024-01-07T12:00:00Z"
    },
    "suggestions": [
      "What is linear regression?",
      "Show me an example",
      "How do I calculate slope?"
    ]
  }
}
```

#### `POST /api/chat/messages`
Send a message to the AI assistant.

**Request Body:**
```json
{
  "sessionId": "chat-session-123",
  "message": {
    "content": "What is linear regression?",
    "role": "user"
  },
  "context": {
    "currentModule": "module-456",
    "recentMistakes": ["slope-calculation"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": {
      "id": "message-789",
      "content": "Linear regression is a statistical method used to model the relationship between a dependent variable and one or more independent variables. It assumes a linear relationship between variables.",
      "role": "assistant",
      "timestamp": "2024-01-07T12:00:00Z",
      "metadata": {
        "confidence": 0.95,
        "sources": ["module-456", "textbook-chapter-3"],
        "followUpQuestions": [
          "Would you like to see an example?",
          "How is it different from correlation?"
        ]
      }
    },
    "adaptiveActions": [
      {
        "type": "difficulty_adjustment",
        "action": "maintain_current_level",
        "reason": "appropriate_comprehension"
      }
    ]
  }
}
```

### Health and Utility Endpoints

#### `GET /api/health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-07T12:00:00Z",
  "version": "1.0.0",
  "services": {
    "database": "healthy",
    "cache": "healthy",
    "ai_service": "healthy"
  }
}
```

#### `GET /api/csrf`
Get CSRF token for secure requests.

**Response:**
```json
{
  "token": "csrf-token-123456789",
  "expiresAt": "2024-01-07T13:00:00Z"
}
```

## Request/Response Format

### Standard Response Format

All API responses follow a consistent format:

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Optional message",
  "metadata": {
    // Optional metadata
  }
}
```

### Error Response Format

Error responses include detailed error information:

```json
{
  "success": false,
  "error": "Error type",
  "message": "Human-readable error message",
  "details": {
    "code": "VALIDATION_ERROR",
    "field": "email",
    "constraint": "required"
  },
  "timestamp": "2024-01-07T12:00:00Z"
}
```

### Content Types

- **Request**: `application/json`
- **Response**: `application/json`
- **File Upload**: `multipart/form-data`

## Error Handling

### HTTP Status Codes

- **200 OK**: Successful request
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request data
- **401 Unauthorized**: Authentication required
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

### Common Error Codes

```typescript
// TypeScript error handling example
try {
  const response = await fetch('/api/learning/profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify(profileData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Request failed');
  }

  const data = await response.json();
  return data;
} catch (error) {
  console.error('API Error:', error);
  // Handle specific error types
  if (error.status === 401) {
    // Redirect to login
  } else if (error.status === 429) {
    // Handle rate limiting
  }
}
```

## Rate Limiting

### Rate Limit Headers

All responses include rate limiting headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1641564000
```

### Rate Limit Tiers

| Endpoint Category | Requests/Minute (User) | Requests/Minute (IP) |
|-------------------|------------------------|----------------------|
| Authentication    | 10                     | 50                   |
| Profile           | 50                     | 25                   |
| Learning Session  | 200                    | 100                  |
| Analytics         | 30                     | 15                   |
| Content           | 100                    | 50                   |
| Chat/AI           | 60                     | 30                   |

### Handling Rate Limits

```typescript
// Example rate limit handling
async function makeAPIRequest(url: string, options: RequestInit) {
  const response = await fetch(url, options);
  
  if (response.status === 429) {
    const resetTime = response.headers.get('X-RateLimit-Reset');
    const waitTime = parseInt(resetTime!) * 1000 - Date.now();
    
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return makeAPIRequest(url, options); // Retry
    }
  }
  
  return response;
}
```

## Security

### Authentication Security

- **Session Security**: HTTPOnly, Secure, SameSite cookies
- **Token Expiration**: Sessions expire after 24 hours of inactivity
- **CSRF Protection**: Required for all state-changing operations
- **Rate Limiting**: Prevents abuse and brute force attacks

### Data Protection

- **Encryption**: All data encrypted at rest and in transit
- **Input Validation**: Comprehensive input sanitization
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Content Security Policy headers

### API Security Best Practices

```typescript
// Secure API client example
class SecureAPIClient {
  private baseURL: string;
  private csrfToken: string | null = null;
  
  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }
  
  async getCSRFToken(): Promise<string> {
    if (!this.csrfToken) {
      const response = await fetch(`${this.baseURL}/api/csrf`);
      const data = await response.json();
      this.csrfToken = data.token;
    }
    return this.csrfToken;
  }
  
  async secureRequest(endpoint: string, options: RequestInit = {}) {
    const token = await this.getCSRFToken();
    
    return fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': token,
        ...options.headers
      }
    });
  }
}
```

## SDK Examples

### JavaScript/TypeScript SDK

```typescript
// Learning Assistant SDK
class LearningAssistantSDK {
  private client: SecureAPIClient;
  
  constructor(baseURL: string) {
    this.client = new SecureAPIClient(baseURL);
  }
  
  // Profile management
  async getProfile(): Promise<UserProfile> {
    const response = await this.client.secureRequest('/api/learning/profile');
    return response.json();
  }
  
  async updateProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
    const response = await this.client.secureRequest('/api/learning/profile', {
      method: 'POST',
      body: JSON.stringify(profile)
    });
    return response.json();
  }
  
  // Session management
  async createSession(sessionData: SessionData): Promise<LearningSession> {
    const response = await this.client.secureRequest('/api/learning/session', {
      method: 'POST',
      body: JSON.stringify({ sessionData })
    });
    return response.json();
  }
  
  // Analytics
  async getAnalytics(options: AnalyticsOptions): Promise<AnalyticsData> {
    const params = new URLSearchParams(options);
    const response = await this.client.secureRequest(
      `/api/analytics/dashboard?${params}`
    );
    return response.json();
  }
  
  // Chat integration
  async startChatSession(context: ChatContext): Promise<ChatSession> {
    const response = await this.client.secureRequest('/api/chat/sessions', {
      method: 'POST',
      body: JSON.stringify(context)
    });
    return response.json();
  }
  
  async sendMessage(sessionId: string, message: string): Promise<ChatResponse> {
    const response = await this.client.secureRequest('/api/chat/messages', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        message: { content: message, role: 'user' }
      })
    });
    return response.json();
  }
}

// Usage example
const sdk = new LearningAssistantSDK('https://api.learningassistant.com');

// Get user profile
const profile = await sdk.getProfile();

// Update learning preferences
await sdk.updateProfile({
  learningStyle: 'kinesthetic',
  preferences: {
    difficulty: 'advanced',
    subjects: ['mathematics', 'physics']
  }
});

// Create learning session
const session = await sdk.createSession({
  contentId: 'lesson-123',
  duration: 1800,
  score: 85
});
```

### Python SDK

```python
import requests
from typing import Dict, Any, Optional

class LearningAssistantSDK:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.csrf_token = None
    
    def get_csrf_token(self) -> str:
        """Get CSRF token for secure requests"""
        if not self.csrf_token:
            response = self.session.get(f"{self.base_url}/api/csrf")
            self.csrf_token = response.json()["token"]
        return self.csrf_token
    
    def secure_request(self, endpoint: str, method: str = "GET", data: Optional[Dict] = None) -> Dict:
        """Make secure API request with CSRF protection"""
        url = f"{self.base_url}{endpoint}"
        headers = {
            "Content-Type": "application/json",
            "X-CSRF-Token": self.get_csrf_token()
        }
        
        if method == "GET":
            response = self.session.get(url, headers=headers)
        elif method == "POST":
            response = self.session.post(url, json=data, headers=headers)
        
        response.raise_for_status()
        return response.json()
    
    def get_profile(self) -> Dict[str, Any]:
        """Get user learning profile"""
        return self.secure_request("/api/learning/profile")
    
    def update_profile(self, profile_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update user learning profile"""
        return self.secure_request("/api/learning/profile", "POST", profile_data)
    
    def create_session(self, session_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create learning session"""
        return self.secure_request("/api/learning/session", "POST", {"sessionData": session_data})
    
    def get_analytics(self, **kwargs) -> Dict[str, Any]:
        """Get learning analytics"""
        params = "&".join([f"{k}={v}" for k, v in kwargs.items()])
        return self.secure_request(f"/api/analytics/dashboard?{params}")

# Usage example
sdk = LearningAssistantSDK("https://api.learningassistant.com")

# Get analytics
analytics = sdk.get_analytics(userId="user-123", timeRange=7)

# Create learning session
session = sdk.create_session({
    "contentId": "lesson-123",
    "duration": 1800,
    "score": 85
})
```

## Webhook Integration

### Setting Up Webhooks

Webhooks allow your application to receive real-time notifications about learning events.

#### Webhook Configuration

```typescript
// Configure webhook endpoints
const webhookConfig = {
  url: "https://your-app.com/webhooks/learning-assistant",
  events: [
    "session.completed",
    "assessment.finished",
    "milestone.achieved",
    "profile.updated"
  ],
  secret: "your-webhook-secret"
};

// Register webhook
await fetch("/api/webhooks/register", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify(webhookConfig)
});
```

#### Webhook Event Types

| Event | Description | Payload |
|-------|-------------|---------|
| `session.completed` | Learning session finished | Session data with results |
| `assessment.finished` | Assessment completed | Assessment results and analytics |
| `milestone.achieved` | Learning milestone reached | Milestone details and progress |
| `profile.updated` | User profile changed | Updated profile data |
| `chat.session.started` | New chat session created | Chat session details |
| `analytics.generated` | New analytics report available | Analytics summary |

#### Webhook Payload Example

```json
{
  "event": "session.completed",
  "timestamp": "2024-01-07T12:00:00Z",
  "data": {
    "sessionId": "session-789",
    "userId": "user-123",
    "contentId": "lesson-456",
    "duration": 1800,
    "score": 85,
    "completed": true,
    "insights": {
      "learningEfficiency": 85,
      "recommendedBreak": false,
      "nextDifficulty": "intermediate"
    }
  },
  "signature": "sha256=webhook-signature"
}
```

#### Webhook Verification

```typescript
// Verify webhook signature
import crypto from 'crypto';

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return signature === `sha256=${expectedSignature}`;
}

// Express.js webhook handler
app.post('/webhooks/learning-assistant', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = JSON.stringify(req.body);
  
  if (!verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process webhook event
  const { event, data } = req.body;
  
  switch (event) {
    case 'session.completed':
      handleSessionCompleted(data);
      break;
    case 'assessment.finished':
      handleAssessmentFinished(data);
      break;
    default:
      console.log(`Unhandled event: ${event}`);
  }
  
  res.json({ received: true });
});
```

## Best Practices

### API Integration Best Practices

1. **Authentication**: Always use secure authentication methods
2. **Rate Limiting**: Implement proper rate limiting handling
3. **Error Handling**: Comprehensive error handling with retry logic
4. **Data Validation**: Validate all input data on client side
5. **Security**: Use HTTPS, validate SSL certificates
6. **Monitoring**: Log API calls and monitor for errors

### Performance Optimization

1. **Caching**: Cache frequently accessed data
2. **Pagination**: Use pagination for large datasets
3. **Compression**: Enable gzip compression
4. **CDN**: Use CDN for static assets
5. **Connection Pooling**: Reuse HTTP connections

### Testing

```typescript
// API testing example with Jest
describe('Learning Assistant API', () => {
  let sdk: LearningAssistantSDK;
  
  beforeEach(() => {
    sdk = new LearningAssistantSDK('http://localhost:3000');
  });
  
  test('should get user profile', async () => {
    const profile = await sdk.getProfile();
    expect(profile.success).toBe(true);
    expect(profile.data.userId).toBeDefined();
  });
  
  test('should create learning session', async () => {
    const sessionData = {
      contentId: 'test-lesson',
      duration: 1800,
      score: 85
    };
    
    const session = await sdk.createSession(sessionData);
    expect(session.success).toBe(true);
    expect(session.data.id).toBeDefined();
  });
});
```

## Support

- **API Documentation**: https://docs.learningassistant.com/api
- **Support Email**: api-support@learningassistant.com
- **Developer Discord**: https://discord.gg/learning-assistant
- **GitHub Issues**: https://github.com/learning-assistant/api/issues

---

*API Version: 1.0.0*
*Last Updated: 2025-01-07*