# Learning Assistant Integrations Guide

## Overview

The Learning Assistant platform supports a wide range of integrations to enhance the learning experience, streamline workflows, and connect with external services. This comprehensive guide covers all available integrations, their setup processes, usage patterns, and best practices.

## Table of Contents

1. [AI & Language Models](#ai--language-models)
2. [Authentication Providers](#authentication-providers)
3. [Database Integrations](#database-integrations)
4. [Communication Services](#communication-services)
5. [Analytics & Monitoring](#analytics--monitoring)
6. [Content Management](#content-management)
7. [Learning Management Systems](#learning-management-systems)
8. [Third-Party APIs](#third-party-apis)
9. [Development Tools](#development-tools)
10. [Custom Integrations](#custom-integrations)

---

## AI & Language Models

### OpenAI Integration

**Purpose**: Primary AI service for chat assistance, content generation, and learning personalization.

#### Setup

```bash
# Environment Configuration
OPENAI_API_KEY="sk-your-openai-api-key"
OPENAI_MODEL="gpt-3.5-turbo"
OPENAI_MAX_TOKENS=2000
OPENAI_TEMPERATURE=0.7
```

#### Usage Patterns

```typescript
// AI Service Implementation
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Chat Completion
export async function generateResponse(prompt: string, context: LearningContext) {
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: `You are an educational tutor specializing in ${context.subject}. 
                 Adapt your responses to ${context.learningStyle} learning style.`
      },
      {
        role: "user",
        content: prompt
      }
    ],
    max_tokens: 2000,
    temperature: 0.7
  });
  
  return response.choices[0].message.content;
}

// Content Adaptation
export async function adaptContent(content: string, learningStyle: LearningStyleType) {
  const adaptationPrompt = `
    Adapt this educational content for a ${learningStyle} learner:
    ${content}
    
    Make it more engaging and suitable for their learning style.
  `;
  
  return await generateResponse(adaptationPrompt, { learningStyle });
}
```

#### Rate Limiting & Error Handling

```typescript
// Robust OpenAI Integration with Retry Logic
export class OpenAIService {
  private async callWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (error.status === 429 && attempt < maxRetries - 1) {
          // Rate limit hit, wait and retry
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Max retries exceeded');
  }
  
  async generateTutoringResponse(
    question: string,
    context: TutoringContext
  ): Promise<string> {
    return this.callWithRetry(async () => {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: this.buildSystemPrompt(context)
          },
          {
            role: "user",
            content: question
          }
        ],
        max_tokens: 1500,
        temperature: 0.6
      });
      
      return response.choices[0].message.content || '';
    });
  }
}
```

### Alternative AI Providers

#### Anthropic Claude

```typescript
// Anthropic Integration
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function generateClaudeResponse(prompt: string) {
  const response = await anthropic.messages.create({
    model: "claude-3-sonnet-20240229",
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: prompt
    }]
  });
  
  return response.content[0].text;
}
```

#### Hugging Face

```typescript
// Hugging Face Integration
export async function callHuggingFace(model: string, inputs: any) {
  const response = await fetch(
    `https://api-inference.huggingface.co/models/${model}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify({ inputs }),
    }
  );
  
  return await response.json();
}

// Text Classification Example
export async function classifyLearningDifficulty(text: string) {
  return await callHuggingFace(
    'distilbert-base-uncased-finetuned-sst-2-english',
    text
  );
}
```

---

## Authentication Providers

### Better Auth Configuration

**Purpose**: Comprehensive authentication system with multiple provider support.

#### Core Setup

```typescript
// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const auth = betterAuth({
  database: pool,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update every day
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL!,
});
```

### Google OAuth

#### Setup Process

1. **Google Cloud Console Configuration**
   ```
   1. Go to Google Cloud Console
   2. Create new project or select existing
   3. Enable Google+ API
   4. Create OAuth 2.0 credentials
   5. Add authorized redirect URIs
   ```

2. **Environment Variables**
   ```bash
   GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="your-google-client-secret"
   ```

3. **Callback URL Configuration**
   ```
   Development: http://localhost:3000/api/auth/callback/google
   Production: https://yourdomain.com/api/auth/callback/google
   ```

#### Usage Implementation

```typescript
// Google OAuth Button Component
export function GoogleSignInButton() {
  const handleGoogleSignIn = () => {
    window.location.href = '/api/auth/oauth/google';
  };
  
  return (
    <button
      onClick={handleGoogleSignIn}
      className="flex items-center gap-2 px-4 py-2 border rounded-lg"
    >
      <GoogleIcon />
      Continue with Google
    </button>
  );
}

// Server-side Google profile handling
export async function handleGoogleCallback(profile: GoogleProfile) {
  const existingUser = await findUserByEmail(profile.email);
  
  if (existingUser) {
    // Link Google account to existing user
    await linkGoogleAccount(existingUser.id, profile);
  } else {
    // Create new user from Google profile
    await createUserFromGoogleProfile(profile);
  }
}
```

### GitHub OAuth

#### Setup Process

1. **GitHub App Configuration**
   ```
   1. Go to GitHub Settings > Developer settings
   2. Create new OAuth App
   3. Set Homepage URL and Authorization callback URL
   4. Get Client ID and Client Secret
   ```

2. **Environment Variables**
   ```bash
   GITHUB_CLIENT_ID="your-github-client-id"
   GITHUB_CLIENT_SECRET="your-github-client-secret"
   ```

#### Advanced GitHub Integration

```typescript
// GitHub Profile Enhancement
export async function enrichGitHubProfile(accessToken: string) {
  const githubUser = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `token ${accessToken}`,
    },
  }).then(res => res.json());
  
  // Get additional profile information
  const repos = await fetch('https://api.github.com/user/repos', {
    headers: {
      Authorization: `token ${accessToken}`,
    },
  }).then(res => res.json());
  
  return {
    ...githubUser,
    repositories: repos,
    programmingLanguages: extractLanguages(repos),
  };
}
```

### Microsoft/Azure AD

```typescript
// Microsoft OAuth Configuration
export const microsoftAuth = {
  clientId: process.env.MICROSOFT_CLIENT_ID!,
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
  tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
  redirectUri: `${process.env.BETTER_AUTH_URL}/api/auth/callback/microsoft`,
};

// Microsoft Graph API Integration
export async function getMicrosoftProfile(accessToken: string) {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  
  return await response.json();
}
```

---

## Database Integrations

### PostgreSQL Primary Database

**Purpose**: Main application database for user data, learning progress, and analytics.

#### Connection Configuration

```typescript
// src/lib/database/connection.ts
import { Pool, PoolConfig } from 'pg';

const config: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
  max: 20, // Maximum number of clients in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

export const pool = new Pool(config);

// Connection health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}
```

#### Query Optimization

```typescript
// Optimized database queries with prepared statements
export class LearningProgressRepository {
  async getUserProgress(userId: string, limit = 50) {
    const query = `
      SELECT lp.*, lm.title as module_title, lm.difficulty
      FROM learning_progress lp
      JOIN learning_modules lm ON lp.module_id = lm.id
      WHERE lp.user_id = $1
      ORDER BY lp.last_accessed DESC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [userId, limit]);
    return result.rows;
  }
  
  async updateProgress(userId: string, moduleId: string, progress: ProgressUpdate) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Update progress
      await client.query(
        `UPDATE learning_progress 
         SET completed = $3, score = $4, time_spent = $5, last_accessed = NOW()
         WHERE user_id = $1 AND module_id = $2`,
        [userId, moduleId, progress.completed, progress.score, progress.timeSpent]
      );
      
      // Update user statistics
      await client.query(
        `UPDATE user_statistics 
         SET total_time_spent = total_time_spent + $2,
             modules_completed = modules_completed + $3
         WHERE user_id = $1`,
        [userId, progress.timeSpent, progress.completed ? 1 : 0]
      );
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
```

### Redis Caching

**Purpose**: Session storage, caching, and real-time features.

#### Configuration

```typescript
// src/lib/cache/redis.ts
import { createClient } from 'redis';

const redis = createClient({
  url: process.env.REDIS_URL,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
});

redis.on('error', (error) => {
  console.error('Redis connection error:', error);
});

redis.on('connect', () => {
  console.log('Connected to Redis');
});

export { redis };

// Cache service implementation
export class CacheService {
  async set(key: string, value: any, ttl = 3600): Promise<void> {
    await redis.setEx(key, ttl, JSON.stringify(value));
  }
  
  async get<T>(key: string): Promise<T | null> {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  }
  
  async del(key: string): Promise<void> {
    await redis.del(key);
  }
  
  async exists(key: string): Promise<boolean> {
    return (await redis.exists(key)) === 1;
  }
}
```

#### Usage Patterns

```typescript
// Caching learning content
export async function getCachedLearningModule(moduleId: string) {
  const cacheKey = `module:${moduleId}`;
  const cached = await cacheService.get(cacheKey);
  
  if (cached) {
    return cached;
  }
  
  const module = await database.getLearningModule(moduleId);
  await cacheService.set(cacheKey, module, 3600); // 1 hour cache
  
  return module;
}

// Session caching
export async function cacheUserSession(sessionId: string, sessionData: any) {
  const cacheKey = `session:${sessionId}`;
  await cacheService.set(cacheKey, sessionData, 1800); // 30 minutes
}

// Rate limiting
export async function checkRateLimit(userId: string, action: string): Promise<boolean> {
  const key = `rate_limit:${userId}:${action}`;
  const current = await redis.incr(key);
  
  if (current === 1) {
    await redis.expire(key, 60); // 1 minute window
  }
  
  return current <= 10; // Max 10 requests per minute
}
```

---

## Communication Services

### Email Integration

#### SMTP Configuration

```typescript
// Email service setup
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransporter({
  host: process.env.EMAIL_SERVER_HOST,
  port: parseInt(process.env.EMAIL_SERVER_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
});

export class EmailService {
  async sendVerificationEmail(to: string, verificationToken: string) {
    const verificationUrl = `${process.env.BETTER_AUTH_URL}/verify-email?token=${verificationToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to,
      subject: 'Verify your Learning Assistant account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Welcome to Learning Assistant!</h1>
          <p>Please verify your email address by clicking the button below:</p>
          <a href="${verificationUrl}" 
             style="background-color: #007bff; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Verify Email Address
          </a>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        </div>
      `,
    };
    
    return await transporter.sendMail(mailOptions);
  }
  
  async sendLearningReminder(to: string, userName: string, streakDays: number) {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to,
      subject: `Keep your ${streakDays}-day learning streak going!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Don't break your streak, ${userName}!</h1>
          <p>You've been learning for ${streakDays} days in a row. That's amazing!</p>
          <p>Take just 10 minutes today to continue your learning journey.</p>
          <a href="${process.env.BETTER_AUTH_URL}/dashboard" 
             style="background-color: #28a745; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Continue Learning
          </a>
        </div>
      `,
    };
    
    return await transporter.sendMail(mailOptions);
  }
}
```

#### SendGrid Integration

```typescript
// SendGrid alternative
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export class SendGridEmailService {
  async sendTemplateEmail(to: string, templateId: string, dynamicData: any) {
    const msg = {
      to,
      from: process.env.EMAIL_FROM!,
      templateId,
      dynamicTemplateData: dynamicData,
    };
    
    return await sgMail.send(msg);
  }
  
  async sendProgressReport(to: string, reportData: ProgressReport) {
    return this.sendTemplateEmail(to, 'weekly-progress-report', {
      userName: reportData.userName,
      totalTime: reportData.totalTime,
      modulesCompleted: reportData.modulesCompleted,
      averageScore: reportData.averageScore,
      nextGoal: reportData.nextGoal,
    });
  }
}
```

### Push Notifications

```typescript
// Web Push Notifications
import webpush from 'web-push';

webpush.setVapidDetails(
  `mailto:${process.env.EMAIL_FROM}`,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export class PushNotificationService {
  async sendNotification(subscription: any, payload: any) {
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
    } catch (error) {
      if (error.statusCode === 410 || error.statusCode === 404) {
        // Subscription expired, remove from database
        await this.removeSubscription(subscription.endpoint);
      }
      throw error;
    }
  }
  
  async sendLearningReminder(userId: string, message: string) {
    const subscriptions = await this.getUserSubscriptions(userId);
    
    const payload = {
      title: 'Learning Reminder',
      body: message,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: 'learning-reminder',
      actions: [
        {
          action: 'start-learning',
          title: 'Start Learning',
        },
        {
          action: 'snooze',
          title: 'Remind me later',
        },
      ],
    };
    
    const promises = subscriptions.map(subscription =>
      this.sendNotification(subscription, payload)
    );
    
    await Promise.allSettled(promises);
  }
}
```

---

## Analytics & Monitoring

### Application Performance Monitoring

#### Prometheus Integration

```typescript
// Metrics collection with Prometheus
import client from 'prom-client';

// Create metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

const activeUsers = new client.Gauge({
  name: 'learning_active_users',
  help: 'Number of active learning sessions',
});

const learningSessionsTotal = new client.Counter({
  name: 'learning_sessions_total',
  help: 'Total number of learning sessions started',
  labelNames: ['module_type', 'difficulty'],
});

// Middleware for request metrics
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode.toString())
      .observe(duration);
  });
  
  next();
}

// Learning-specific metrics
export class LearningMetrics {
  static recordSessionStart(moduleType: string, difficulty: string) {
    learningSessionsTotal.labels(moduleType, difficulty).inc();
  }
  
  static updateActiveUsers(count: number) {
    activeUsers.set(count);
  }
  
  static async getMetrics() {
    return await client.register.metrics();
  }
}
```

#### Custom Analytics

```typescript
// Learning Analytics Service
export class LearningAnalyticsService {
  async trackUserAction(userId: string, action: string, metadata: any) {
    const event = {
      userId,
      action,
      metadata,
      timestamp: new Date(),
      sessionId: await this.getCurrentSessionId(userId),
    };
    
    // Store in database
    await this.storeAnalyticsEvent(event);
    
    // Send to external analytics if configured
    if (process.env.ANALYTICS_SERVICE_URL) {
      await this.sendToExternalAnalytics(event);
    }
  }
  
  async generateLearningInsights(userId: string, timeRange: DateRange) {
    const events = await this.getAnalyticsEvents(userId, timeRange);
    
    return {
      totalTimeSpent: this.calculateTotalTime(events),
      averageSessionLength: this.calculateAverageSessionLength(events),
      learningPatterns: this.identifyLearningPatterns(events),
      difficultyProgression: this.analyzeDifficultyProgression(events),
      engagementScore: this.calculateEngagementScore(events),
      recommendations: await this.generateRecommendations(userId, events),
    };
  }
  
  private async generateRecommendations(userId: string, events: AnalyticsEvent[]) {
    const userProfile = await this.getUserLearningProfile(userId);
    const performance = this.analyzePerformance(events);
    
    const recommendations = [];
    
    // Time-based recommendations
    const optimalTimes = this.identifyOptimalLearningTimes(events);
    if (optimalTimes.length > 0) {
      recommendations.push({
        type: 'schedule',
        message: `You learn best during ${optimalTimes.join(', ')}`,
        confidence: 0.85,
      });
    }
    
    // Difficulty recommendations
    if (performance.averageScore > 0.9) {
      recommendations.push({
        type: 'difficulty',
        message: 'Consider increasing difficulty level for more challenge',
        confidence: 0.8,
      });
    }
    
    return recommendations;
  }
}
```

### Error Tracking

```typescript
// Error tracking and reporting
export class ErrorTrackingService {
  async reportError(error: Error, context: any) {
    const errorReport = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date(),
      userId: context.userId,
      sessionId: context.sessionId,
      userAgent: context.userAgent,
      url: context.url,
    };
    
    // Store in database
    await this.storeErrorReport(errorReport);
    
    // Send to external service (e.g., Sentry)
    if (process.env.SENTRY_DSN) {
      await this.sendToSentry(errorReport);
    }
    
    // Alert if critical error
    if (this.isCriticalError(error)) {
      await this.sendCriticalErrorAlert(errorReport);
    }
  }
  
  private isCriticalError(error: Error): boolean {
    return error.message.includes('Database') ||
           error.message.includes('Authentication') ||
           error.message.includes('Payment');
  }
}
```

---

## Content Management

### File Storage Integration

#### AWS S3 Integration

```typescript
// AWS S3 for file storage
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export class FileStorageService {
  async uploadFile(file: File, key: string): Promise<string> {
    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: key,
      Body: file,
      ContentType: file.type,
      Metadata: {
        uploadedBy: 'learning-assistant',
        uploadedAt: new Date().toISOString(),
      },
    };
    
    await s3Client.send(new PutObjectCommand(uploadParams));
    
    return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  }
  
  async getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: key,
    });
    
    return await getSignedUrl(s3Client, command, { expiresIn });
  }
  
  async uploadLearningContent(content: LearningContent): Promise<void> {
    const key = `content/${content.moduleId}/${content.id}`;
    
    // Upload main content
    if (content.videoFile) {
      content.videoUrl = await this.uploadFile(content.videoFile, `${key}/video.mp4`);
    }
    
    if (content.documents) {
      content.documentUrls = await Promise.all(
        content.documents.map((doc, index) =>
          this.uploadFile(doc, `${key}/document-${index}.pdf`)
        )
      );
    }
    
    // Upload thumbnails and images
    if (content.images) {
      content.imageUrls = await Promise.all(
        content.images.map((img, index) =>
          this.uploadFile(img, `${key}/image-${index}.${img.type.split('/')[1]}`)
        )
      );
    }
  }
}
```

#### Cloudflare R2 Alternative

```typescript
// Cloudflare R2 (S3-compatible)
export class CloudflareR2Service {
  private s3Client: S3Client;
  
  constructor() {
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  
  async uploadWithCDN(file: File, key: string): Promise<string> {
    await this.s3Client.send(new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET!,
      Key: key,
      Body: file,
      ContentType: file.type,
    }));
    
    // Return CDN URL instead of direct R2 URL
    return `https://${process.env.CLOUDFLARE_CDN_DOMAIN}/${key}`;
  }
}
```

### Content Delivery Network

```typescript
// CDN integration for optimal content delivery
export class CDNService {
  async optimizeImage(imageUrl: string, options: ImageOptimization): Promise<string> {
    const params = new URLSearchParams({
      url: imageUrl,
      w: options.width?.toString() || '',
      h: options.height?.toString() || '',
      q: options.quality?.toString() || '80',
      f: options.format || 'webp',
    });
    
    return `${process.env.CDN_BASE_URL}/image?${params}`;
  }
  
  async generateVideoThumbnail(videoUrl: string, timestamp = 0): Promise<string> {
    const params = new URLSearchParams({
      url: videoUrl,
      t: timestamp.toString(),
      w: '1280',
      h: '720',
      f: 'webp',
    });
    
    return `${process.env.CDN_BASE_URL}/video-thumbnail?${params}`;
  }
  
  async purgeCache(urls: string[]): Promise<void> {
    // Purge CDN cache for updated content
    await fetch(`${process.env.CDN_API_URL}/purge`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CDN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ urls }),
    });
  }
}
```

---

## Learning Management Systems

### Canvas LMS Integration

```typescript
// Canvas LMS API integration
export class CanvasLMSIntegration {
  private baseUrl: string;
  private apiKey: string;
  
  constructor() {
    this.baseUrl = process.env.CANVAS_BASE_URL!;
    this.apiKey = process.env.CANVAS_API_KEY!;
  }
  
  async getCourses(userId: string): Promise<CanvasCourse[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/users/${userId}/courses`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });
    
    return await response.json();
  }
  
  async getAssignments(courseId: string): Promise<CanvasAssignment[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/courses/${courseId}/assignments`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });
    
    return await response.json();
  }
  
  async syncGrades(userId: string): Promise<GradeSyncResult> {
    const courses = await this.getCourses(userId);
    const gradeSyncResults = [];
    
    for (const course of courses) {
      const assignments = await this.getAssignments(course.id);
      
      for (const assignment of assignments) {
        const grade = await this.getGrade(userId, assignment.id);
        
        if (grade) {
          await this.updateLearningProgress(userId, {
            moduleId: this.mapAssignmentToModule(assignment),
            score: grade.score,
            completed: grade.submitted,
            lastUpdated: new Date(grade.updated_at),
          });
          
          gradeSyncResults.push({
            assignmentId: assignment.id,
            score: grade.score,
            synced: true,
          });
        }
      }
    }
    
    return {
      totalSynced: gradeSyncResults.length,
      results: gradeSyncResults,
    };
  }
}
```

### Moodle Integration

```typescript
// Moodle web services integration
export class MoodleIntegration {
  async callMoodleAPI(functionName: string, parameters: any) {
    const params = new URLSearchParams({
      wstoken: process.env.MOODLE_TOKEN!,
      wsfunction: functionName,
      moodlewsrestformat: 'json',
      ...parameters,
    });
    
    const response = await fetch(`${process.env.MOODLE_URL}/webservice/rest/server.php`, {
      method: 'POST',
      body: params,
    });
    
    return await response.json();
  }
  
  async getUserCourses(userId: string) {
    return await this.callMoodleAPI('core_enrol_get_users_courses', {
      userid: userId,
    });
  }
  
  async getCourseContent(courseId: string) {
    return await this.callMoodleAPI('core_course_get_contents', {
      courseid: courseId,
    });
  }
  
  async submitAssignment(assignmentId: string, userId: string, submission: any) {
    return await this.callMoodleAPI('mod_assign_save_submission', {
      assignmentid: assignmentId,
      userid: userId,
      ...submission,
    });
  }
}
```

---

## Third-Party APIs

### Video Platform Integration

#### YouTube API

```typescript
// YouTube Data API integration
export class YouTubeIntegration {
  private apiKey: string;
  
  constructor() {
    this.apiKey = process.env.YOUTUBE_API_KEY!;
  }
  
  async searchEducationalVideos(query: string, maxResults = 10): Promise<YouTubeVideo[]> {
    const params = new URLSearchParams({
      part: 'snippet,statistics',
      q: query,
      type: 'video',
      videoDefinition: 'high',
      videoSyndicated: 'true',
      maxResults: maxResults.toString(),
      key: this.apiKey,
    });
    
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    const data = await response.json();
    
    return data.items.map(this.mapYouTubeVideo);
  }
  
  async getVideoDetails(videoId: string): Promise<YouTubeVideoDetails> {
    const params = new URLSearchParams({
      part: 'snippet,statistics,contentDetails',
      id: videoId,
      key: this.apiKey,
    });
    
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
    const data = await response.json();
    
    return this.mapYouTubeVideoDetails(data.items[0]);
  }
  
  async createLearningModule(videoId: string, additionalContent?: any): Promise<LearningModule> {
    const videoDetails = await this.getVideoDetails(videoId);
    
    return {
      id: `youtube-${videoId}`,
      title: videoDetails.title,
      description: videoDetails.description,
      type: 'video',
      duration: this.parseDuration(videoDetails.duration),
      content: {
        videoUrl: `https://www.youtube.com/embed/${videoId}`,
        transcript: await this.getVideoTranscript(videoId),
        ...additionalContent,
      },
      difficulty: await this.estimateDifficulty(videoDetails),
    };
  }
  
  private async getVideoTranscript(videoId: string): Promise<string> {
    // Implementation would use YouTube Transcript API or similar service
    // This is a simplified version
    try {
      const response = await fetch(`/api/transcript/${videoId}`);
      return await response.text();
    } catch {
      return ''; // Transcript not available
    }
  }
}
```

#### Vimeo Integration

```typescript
// Vimeo API integration
export class VimeoIntegration {
  private accessToken: string;
  
  constructor() {
    this.accessToken = process.env.VIMEO_ACCESS_TOKEN!;
  }
  
  async uploadVideo(file: File, title: string, description: string): Promise<VimeoVideo> {
    // Create video entry
    const createResponse = await fetch('https://api.vimeo.com/me/videos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: title,
        description,
        privacy: { view: 'unlisted' },
        embed: {
          buttons: {
            like: false,
            watchlater: false,
            share: false,
          },
        },
      }),
    });
    
    const videoData = await createResponse.json();
    
    // Upload video file
    const uploadUrl = videoData.upload.upload_link;
    await fetch(uploadUrl, {
      method: 'PATCH',
      body: file,
      headers: {
        'Tus-Resumable': '1.0.0',
        'Upload-Offset': '0',
        'Content-Type': 'application/offset+octet-stream',
      },
    });
    
    return {
      id: videoData.uri.split('/').pop(),
      url: videoData.link,
      embedUrl: `https://player.vimeo.com/video/${videoData.uri.split('/').pop()}`,
      duration: 0, // Will be populated after processing
    };
  }
}
```

### Translation Services

```typescript
// Google Translate API integration
export class TranslationService {
  private apiKey: string;
  
  constructor() {
    this.apiKey = process.env.GOOGLE_TRANSLATE_API_KEY!;
  }
  
  async translateText(text: string, targetLanguage: string, sourceLanguage = 'auto'): Promise<string> {
    const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${this.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        source: sourceLanguage,
        target: targetLanguage,
        format: 'text',
      }),
    });
    
    const data = await response.json();
    return data.data.translations[0].translatedText;
  }
  
  async translateLearningContent(content: LearningContent, targetLanguage: string): Promise<LearningContent> {
    const translatedContent = { ...content };
    
    // Translate text fields
    if (content.title) {
      translatedContent.title = await this.translateText(content.title, targetLanguage);
    }
    
    if (content.description) {
      translatedContent.description = await this.translateText(content.description, targetLanguage);
    }
    
    if (content.textContent) {
      translatedContent.textContent = await this.translateText(content.textContent, targetLanguage);
    }
    
    // Translate quiz questions
    if (content.quiz) {
      translatedContent.quiz = await this.translateQuiz(content.quiz, targetLanguage);
    }
    
    return translatedContent;
  }
  
  private async translateQuiz(quiz: Quiz, targetLanguage: string): Promise<Quiz> {
    const translatedQuiz = { ...quiz };
    
    translatedQuiz.questions = await Promise.all(
      quiz.questions.map(async (question) => ({
        ...question,
        text: await this.translateText(question.text, targetLanguage),
        options: question.options ? await Promise.all(
          question.options.map(option => this.translateText(option, targetLanguage))
        ) : undefined,
        explanation: question.explanation ? 
          await this.translateText(question.explanation, targetLanguage) : undefined,
      }))
    );
    
    return translatedQuiz;
  }
}
```

---

## Development Tools

### GitHub Integration

```typescript
// GitHub API integration for development workflow
export class GitHubIntegration {
  private octokit: Octokit;
  
  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
  }
  
  async createIssueFromFeedback(feedback: UserFeedback): Promise<string> {
    const { data } = await this.octokit.rest.issues.create({
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO!,
      title: `User Feedback: ${feedback.title}`,
      body: `
## User Feedback

**Type**: ${feedback.type}
**Priority**: ${feedback.priority}
**User ID**: ${feedback.userId}
**Timestamp**: ${feedback.timestamp}

### Description
${feedback.description}

### Additional Context
${feedback.context}

### User Environment
- Browser: ${feedback.userAgent}
- Platform: ${feedback.platform}
- Version: ${feedback.appVersion}
      `,
      labels: ['user-feedback', `priority-${feedback.priority}`, `type-${feedback.type}`],
    });
    
    return data.html_url;
  }
  
  async deploymentWebhook(payload: GitHubWebhookPayload): Promise<void> {
    if (payload.action === 'completed' && payload.deployment_status.state === 'success') {
      // Notify users of new features
      await this.notifyUsersOfDeployment(payload.deployment);
      
      // Update application version
      await this.updateApplicationVersion(payload.deployment.sha);
    }
  }
}
```

### CI/CD Integration

```typescript
// Continuous Integration/Deployment hooks
export class CICDIntegration {
  async handleDeploymentSuccess(environment: string, version: string): Promise<void> {
    // Update database with new version
    await this.updateSystemVersion(version);
    
    // Run post-deployment health checks
    await this.runHealthChecks();
    
    // Notify monitoring systems
    await this.notifyMonitoring({
      event: 'deployment_success',
      environment,
      version,
      timestamp: new Date(),
    });
    
    // Send notifications to stakeholders
    if (environment === 'production') {
      await this.notifyStakeholders(version);
    }
  }
  
  async handleDeploymentFailure(environment: string, error: string): Promise<void> {
    // Alert development team
    await this.alertDevTeam({
      environment,
      error,
      timestamp: new Date(),
    });
    
    // Create incident report
    await this.createIncidentReport({
      type: 'deployment_failure',
      environment,
      error,
      severity: environment === 'production' ? 'critical' : 'high',
    });
  }
}
```

---

## Custom Integrations

### Webhook System

```typescript
// Generic webhook system for custom integrations
export class WebhookService {
  async registerWebhook(config: WebhookConfig): Promise<string> {
    const webhook = {
      id: generateId(),
      url: config.url,
      events: config.events,
      secret: config.secret || generateSecret(),
      active: true,
      createdAt: new Date(),
    };
    
    await this.storeWebhook(webhook);
    return webhook.id;
  }
  
  async triggerWebhooks(event: string, data: any): Promise<void> {
    const webhooks = await this.getActiveWebhooks(event);
    
    const promises = webhooks.map(webhook => 
      this.deliverWebhook(webhook, event, data)
    );
    
    await Promise.allSettled(promises);
  }
  
  private async deliverWebhook(webhook: Webhook, event: string, data: any): Promise<void> {
    const payload = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };
    
    const signature = this.generateSignature(JSON.stringify(payload), webhook.secret);
    
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event,
        },
        body: JSON.stringify(payload),
        timeout: 30000, // 30 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`Webhook delivery failed: ${response.status}`);
      }
      
      await this.logWebhookDelivery(webhook.id, event, 'success');
    } catch (error) {
      await this.logWebhookDelivery(webhook.id, event, 'failed', error.message);
      await this.handleWebhookFailure(webhook, error);
    }
  }
  
  private async handleWebhookFailure(webhook: Webhook, error: Error): Promise<void> {
    const failureCount = await this.getWebhookFailureCount(webhook.id);
    
    if (failureCount >= 5) {
      // Disable webhook after 5 consecutive failures
      await this.disableWebhook(webhook.id);
      await this.notifyWebhookOwner(webhook, 'disabled_due_to_failures');
    } else {
      // Schedule retry with exponential backoff
      const delay = Math.pow(2, failureCount) * 1000; // 1s, 2s, 4s, 8s, 16s
      setTimeout(() => this.retryWebhook(webhook), delay);
    }
  }
}
```

### Plugin System

```typescript
// Extensible plugin system
export interface LearningAssistantPlugin {
  name: string;
  version: string;
  description: string;
  dependencies?: string[];
  
  initialize(context: PluginContext): Promise<void>;
  destroy(): Promise<void>;
  
  // Optional lifecycle hooks
  onUserRegistration?(user: User): Promise<void>;
  onSessionStart?(session: LearningSession): Promise<void>;
  onSessionEnd?(session: LearningSession): Promise<void>;
  onProgressUpdate?(progress: ProgressUpdate): Promise<void>;
}

export class PluginManager {
  private plugins: Map<string, LearningAssistantPlugin> = new Map();
  
  async loadPlugin(plugin: LearningAssistantPlugin): Promise<void> {
    // Validate plugin
    await this.validatePlugin(plugin);
    
    // Check dependencies
    await this.checkDependencies(plugin);
    
    // Initialize plugin
    const context = this.createPluginContext(plugin);
    await plugin.initialize(context);
    
    // Register plugin
    this.plugins.set(plugin.name, plugin);
    
    console.log(`Plugin ${plugin.name} v${plugin.version} loaded successfully`);
  }
  
  async triggerHook(hookName: string, data: any): Promise<void> {
    const promises = Array.from(this.plugins.values())
      .filter(plugin => plugin[hookName as keyof LearningAssistantPlugin])
      .map(plugin => {
        const hook = plugin[hookName as keyof LearningAssistantPlugin] as Function;
        return hook.call(plugin, data);
      });
    
    await Promise.allSettled(promises);
  }
  
  private createPluginContext(plugin: LearningAssistantPlugin): PluginContext {
    return {
      database: this.getDatabaseAccess(plugin),
      cache: this.getCacheAccess(plugin),
      api: this.getAPIAccess(plugin),
      logger: this.getLogger(plugin.name),
      config: this.getPluginConfig(plugin.name),
    };
  }
}

// Example plugin implementation
export class NotificationPlugin implements LearningAssistantPlugin {
  name = 'notification-plugin';
  version = '1.0.0';
  description = 'Enhanced notification system';
  
  private context: PluginContext;
  
  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    context.logger.info('Notification plugin initialized');
  }
  
  async destroy(): Promise<void> {
    this.context.logger.info('Notification plugin destroyed');
  }
  
  async onSessionEnd(session: LearningSession): Promise<void> {
    if (session.duration > 1800) { // 30 minutes
      await this.sendAchievementNotification(session.userId, {
        type: 'long_session',
        duration: session.duration,
      });
    }
  }
  
  private async sendAchievementNotification(userId: string, achievement: any): Promise<void> {
    // Implementation for sending achievement notifications
  }
}
```

---

## Integration Best Practices

### Security

1. **API Key Management**
   ```typescript
   // Use environment variables for sensitive data
   // Rotate keys regularly
   // Implement key validation
   
   class SecureAPIClient {
     private validateApiKey(key: string): boolean {
       return key.length >= 32 && key.startsWith('sk-');
     }
     
     private async refreshTokenIfNeeded(): Promise<void> {
       if (this.tokenExpiresAt && this.tokenExpiresAt < new Date()) {
         await this.refreshToken();
       }
     }
   }
   ```

2. **Rate Limiting**
   ```typescript
   // Implement rate limiting for external APIs
   class RateLimitedClient {
     private async callWithRateLimit<T>(operation: () => Promise<T>): Promise<T> {
       await this.waitForRateLimit();
       try {
         return await operation();
       } catch (error) {
         if (this.isRateLimitError(error)) {
           await this.handleRateLimit(error);
           return this.callWithRateLimit(operation);
         }
         throw error;
       }
     }
   }
   ```

### Error Handling

```typescript
// Comprehensive error handling for integrations
export class IntegrationErrorHandler {
  async handleIntegrationError(error: Error, integration: string): Promise<void> {
    const errorInfo = {
      integration,
      error: error.message,
      stack: error.stack,
      timestamp: new Date(),
    };
    
    // Log error
    console.error(`Integration error in ${integration}:`, errorInfo);
    
    // Store error for analysis
    await this.storeIntegrationError(errorInfo);
    
    // Send alert if critical
    if (this.isCriticalIntegration(integration)) {
      await this.sendCriticalAlert(errorInfo);
    }
    
    // Attempt graceful degradation
    await this.enableFallbackMode(integration);
  }
  
  private async enableFallbackMode(integration: string): Promise<void> {
    switch (integration) {
      case 'openai':
        // Fall back to simpler responses
        await this.enableSimpleResponseMode();
        break;
      case 'email':
        // Queue emails for later delivery
        await this.queueEmailsForRetry();
        break;
      case 'storage':
        // Use local storage temporarily
        await this.enableLocalStorageMode();
        break;
    }
  }
}
```

### Performance Optimization

```typescript
// Connection pooling and caching for integrations
export class IntegrationOptimizer {
  private connectionPools: Map<string, any> = new Map();
  private cache: Map<string, CacheEntry> = new Map();
  
  async getOptimizedClient(service: string): Promise<any> {
    if (!this.connectionPools.has(service)) {
      this.connectionPools.set(service, this.createConnectionPool(service));
    }
    
    return this.connectionPools.get(service);
  }
  
  async cachedApiCall<T>(
    key: string,
    operation: () => Promise<T>,
    ttl = 300 // 5 minutes
  ): Promise<T> {
    const cached = this.cache.get(key);
    
    if (cached && cached.expiresAt > new Date()) {
      return cached.data;
    }
    
    const result = await operation();
    
    this.cache.set(key, {
      data: result,
      expiresAt: new Date(Date.now() + ttl * 1000),
    });
    
    return result;
  }
}
```

### Monitoring & Observability

```typescript
// Integration monitoring and health checks
export class IntegrationMonitor {
  async runHealthChecks(): Promise<HealthCheckResults> {
    const checks = [
      { name: 'database', check: () => this.checkDatabase() },
      { name: 'redis', check: () => this.checkRedis() },
      { name: 'openai', check: () => this.checkOpenAI() },
      { name: 'email', check: () => this.checkEmail() },
      { name: 'storage', check: () => this.checkStorage() },
    ];
    
    const results = await Promise.allSettled(
      checks.map(async ({ name, check }) => ({
        name,
        status: await check() ? 'healthy' : 'unhealthy',
        timestamp: new Date(),
      }))
    );
    
    return {
      overall: results.every(r => r.status === 'fulfilled' && r.value.status === 'healthy'),
      services: results.map(r => r.status === 'fulfilled' ? r.value : {
        name: 'unknown',
        status: 'error',
        timestamp: new Date(),
      }),
    };
  }
  
  async trackIntegrationMetrics(): Promise<void> {
    const metrics = await this.collectMetrics();
    
    // Send to monitoring service
    await this.sendMetrics(metrics);
    
    // Check for anomalies
    const anomalies = this.detectAnomalies(metrics);
    if (anomalies.length > 0) {
      await this.alertOnAnomalies(anomalies);
    }
  }
}
```

---

## Support & Resources

### Integration Support

- **Documentation**: Comprehensive guides for each integration
- **API References**: Detailed API documentation with examples
- **Community**: Discord server for integration discussions
- **GitHub**: Issues and feature requests for integrations

### Getting Help with Integrations

1. **Check Documentation**: Start with integration-specific guides
2. **Review Examples**: Use provided code examples as starting points
3. **Test in Development**: Always test integrations thoroughly
4. **Monitor Performance**: Set up monitoring for integration health
5. **Plan for Failures**: Implement fallback mechanisms

### Contributing New Integrations

1. **Follow Plugin System**: Use the plugin architecture for new integrations
2. **Add Documentation**: Include comprehensive setup and usage guides
3. **Provide Examples**: Include working code examples
4. **Add Tests**: Include unit and integration tests
5. **Update This Guide**: Add your integration to this documentation

---

*Last Updated: 2025-01-07*
*Version: 1.0.0*