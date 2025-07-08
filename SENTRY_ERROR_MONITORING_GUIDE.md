# Sentry Error Monitoring Implementation Guide

This guide provides comprehensive instructions for the Sentry error monitoring system implemented in the Learning Assistant application.

## Table of Contents

1. [Overview](#overview)
2. [Installation and Setup](#installation-and-setup)
3. [Configuration](#configuration)
4. [Error Boundaries](#error-boundaries)
5. [Performance Monitoring](#performance-monitoring)
6. [Learning Context Integration](#learning-context-integration)
7. [Error Filtering](#error-filtering)
8. [Middleware Integration](#middleware-integration)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

## Overview

The Sentry error monitoring implementation provides:

- **Comprehensive error tracking** for both client and server-side errors
- **Performance monitoring** with Core Web Vitals and custom metrics
- **Learning session context** for better debugging of educational features
- **Smart error filtering** to reduce noise and focus on actionable errors
- **Enhanced error boundaries** with fallback UIs and retry mechanisms
- **Real-time alerts** and notifications for critical issues

## Installation and Setup

### 1. Environment Variables

Add the following environment variables to your `.env.local` file:

```bash
# Required
SENTRY_DSN="https://your-dsn@sentry.io/project-id"

# Optional but recommended
SENTRY_ORG="your-org"
SENTRY_PROJECT="your-project"
SENTRY_AUTH_TOKEN="your-auth-token"
SENTRY_ENVIRONMENT="development"
SENTRY_RELEASE="1.0.0"

# Performance monitoring
SENTRY_TRACES_SAMPLE_RATE="1.0"  # 1.0 for dev, 0.1 for prod
SENTRY_PROFILES_SAMPLE_RATE="1.0"
SENTRY_REPLAY_SESSION_SAMPLE_RATE="1.0"
SENTRY_REPLAY_ERROR_SAMPLE_RATE="1.0"

# Error filtering
SENTRY_IGNORE_ERRORS="Network request failed,Script error"
SENTRY_DENY_URLS="chrome-extension,moz-extension"
SENTRY_ALLOW_URLS="localhost,your-domain.com"

# Debug mode
SENTRY_DEBUG="true"  # true for dev, false for prod
```

### 2. Next.js Configuration

The Sentry configuration is automatically loaded through:
- `sentry.client.config.ts` - Client-side configuration
- `sentry.server.config.ts` - Server-side configuration  
- `instrumentation.ts` - Next.js instrumentation

## Configuration

### Client Configuration (sentry.client.config.ts)

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // ... other configuration
});
```

### Server Configuration (sentry.server.config.ts)

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // ... server-specific configuration
});
```

## Error Boundaries

### Enhanced Error Boundary

The `EnhancedErrorBoundary` component provides:

- **Automatic error reporting** to Sentry
- **Retry mechanisms** with configurable max attempts
- **Context-aware fallback UIs** based on error level
- **User-friendly error messages**
- **Error report downloads** for debugging

```typescript
import { EnhancedErrorBoundary } from '@/components/error';

function App() {
  return (
    <EnhancedErrorBoundary
      level="application"
      name="App"
      maxRetries={3}
      showDetails={process.env.NODE_ENV === 'development'}
    >
      <YourAppContent />
    </EnhancedErrorBoundary>
  );
}
```

### Learning Session Error Boundary

For learning-specific components:

```typescript
import { LearningSessionErrorBoundary } from '@/components/error';

function LearningModule({ sessionId, userId }) {
  return (
    <LearningSessionErrorBoundary sessionId={sessionId} userId={userId}>
      <LearningContent />
    </LearningSessionErrorBoundary>
  );
}
```

### Error Boundary Levels

- **`application`** - Full-screen errors affecting the entire app
- **`learning`** - Learning session specific errors
- **`feature`** - Feature-level errors with graceful degradation
- **`component`** - Component-level errors with minimal UI impact

## Performance Monitoring

### Automatic Monitoring

The system automatically tracks:

- **Core Web Vitals** (LCP, FID, CLS)
- **Navigation timing**
- **API response times**
- **Memory usage**
- **Component render times**

### Custom Performance Tracking

```typescript
import { usePerformanceMonitoring } from '@/lib/error-handling';

function LearningComponent({ sessionId }) {
  const { measureLearningSessionLoad, measureQuizResponse } = usePerformanceMonitoring();
  
  useEffect(() => {
    const measurement = measureLearningSessionLoad(sessionId);
    
    // Load learning content
    loadContent().then(() => {
      measurement.complete();
    });
  }, []);
}
```

### Performance Thresholds

The system monitors against these thresholds:

```typescript
export const PERFORMANCE_THRESHOLDS = {
  LCP: 2500,                    // Largest Contentful Paint (ms)
  FID: 100,                     // First Input Delay (ms)
  CLS: 0.1,                     // Cumulative Layout Shift
  API_RESPONSE: 1000,           // API response time (ms)
  LEARNING_SESSION_LOAD: 2000,  // Learning session load time (ms)
  QUIZ_RESPONSE: 200,           // Quiz response time (ms)
  MEMORY_USAGE: 50 * 1024 * 1024, // 50MB
};
```

## Learning Context Integration

### Setting Learning Context

```typescript
import { useLearningContext } from '@/lib/error-handling';

function LearningSession() {
  const { setContext, trackEvent, captureError } = useLearningContext();
  
  useEffect(() => {
    setContext({
      userId: 'user-123',
      sessionId: 'session-456',
      moduleId: 'math-101',
      learningStyle: 'visual',
      difficulty: 'intermediate',
    });
  }, []);
  
  const handleQuestionAnswer = (correct: boolean) => {
    trackEvent('question_answered', { correct, timeSpent: 30 });
  };
}
```

### Tracking Learning Events

Available event types:
- `session_start` / `session_end`
- `question_answered`
- `lesson_completed`
- `module_completed`
- `error_occurred`
- `help_requested`
- `hint_used`

### Error Context Enhancement

Learning errors include additional context:

```typescript
// Automatic context added to errors
{
  learning_session: {
    sessionId: 'session-456',
    moduleId: 'math-101',
    progress: 75,
    performance: {
      accuracy: 0.85,
      timeSpent: 1800,
      attemptsCount: 12
    }
  }
}
```

## Error Filtering

### Automatic Filtering

The system automatically filters:

- **Network errors** (connection issues, timeouts)
- **Browser extension errors**
- **Bot/crawler requests**
- **Development-only errors**
- **Ad blocker interference**
- **Known browser quirks**

### Custom Filtering

```typescript
import { shouldCaptureError } from '@/lib/error-handling';

// Custom error filtering logic
const shouldReport = shouldCaptureError(error, {
  url: window.location.href,
  userAgent: navigator.userAgent,
  userId: currentUserId,
});

if (shouldReport) {
  Sentry.captureException(error);
}
```

### Rate Limiting

Errors are rate-limited to prevent spam:

- **50 errors per minute** maximum
- **5 similar errors** before deduplication
- **Automatic cleanup** of old error counts

## Middleware Integration

### Enhanced Middleware

```typescript
import { withEnhancedErrorHandling } from '@/lib/error-handling';

export const middleware = withEnhancedErrorHandling(
  async (request: NextRequest) => {
    // Your middleware logic
    return NextResponse.next();
  }
);
```

### API Route Integration

```typescript
import { withApiErrorHandling } from '@/lib/error-handling';

export const POST = withApiErrorHandling(
  async (request: NextRequest) => {
    // Your API route logic
    return NextResponse.json({ success: true });
  }
);
```

## Best Practices

### 1. Error Context

Always provide meaningful context:

```typescript
Sentry.withScope((scope) => {
  scope.setTag('component', 'QuizComponent');
  scope.setContext('quiz', {
    questionId: 'q-123',
    difficulty: 'hard',
    timeLimit: 60
  });
  Sentry.captureException(error);
});
```

### 2. User Privacy

Sensitive data is automatically filtered:

- **Passwords and tokens** → `[TOKEN_REDACTED]`
- **Email addresses** → `[EMAIL_REDACTED]`
- **Credit card numbers** → `[SENSITIVE_DATA_REDACTED]`

### 3. Performance Impact

- **Sampling rates** are optimized for production
- **Error filtering** reduces noise
- **Breadcrumbs** are limited to 50-100 items
- **Session replay** is sampled appropriately

### 4. Alerting

Configure alerts for:

- **High error rates** (>5% of requests)
- **Performance degradation** (>2s response times)
- **Learning session failures** (>10% failure rate)
- **Memory leaks** (>100MB usage)

## Troubleshooting

### Common Issues

#### 1. Sentry Not Initializing

**Problem**: No errors appearing in Sentry dashboard

**Solutions**:
- Verify `SENTRY_DSN` is set correctly
- Check network connectivity to Sentry
- Ensure instrumentation is properly configured
- Verify environment variables are loaded

#### 2. Too Many Errors

**Problem**: Sentry quota exceeded due to noise

**Solutions**:
- Review error filtering configuration
- Adjust sampling rates
- Add more specific ignore patterns
- Check for infinite error loops

#### 3. Performance Issues

**Problem**: App slowdown after Sentry integration

**Solutions**:
- Reduce `tracesSampleRate` in production
- Disable session replay if not needed
- Optimize breadcrumb collection
- Use error filtering to reduce volume

#### 4. Missing Context

**Problem**: Errors lack sufficient debugging context

**Solutions**:
- Ensure learning context is properly set
- Add custom tags and context
- Verify user identification is working
- Check breadcrumb collection

### Debug Mode

Enable debug mode in development:

```bash
SENTRY_DEBUG="true"
```

This will log Sentry operations to the console for debugging.

### Error Boundary Testing

Test error boundaries in development:

```typescript
// Trigger test error
throw new Error('Test error for boundary');
```

### Performance Testing

Monitor performance metrics:

```typescript
import { PerformanceMonitor } from '@/lib/error-handling';

const monitor = PerformanceMonitor.getInstance();
console.log(monitor.getMetrics());
```

## Production Checklist

Before deploying to production:

- [ ] Set appropriate sampling rates (0.1 for traces/profiles)
- [ ] Configure error filtering for your domain
- [ ] Set up alerting rules
- [ ] Test error boundaries
- [ ] Verify performance monitoring
- [ ] Configure release tracking
- [ ] Set up proper GDPR compliance
- [ ] Test learning context integration
- [ ] Verify sensitive data filtering
- [ ] Configure proper user identification

## Support

For issues with the Sentry integration:

1. Check the [Sentry documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
2. Review error logs in the console
3. Verify environment configuration
4. Test with simplified reproduction cases
5. Contact the development team with specific error details

## Updates and Maintenance

The Sentry configuration should be reviewed:

- **Monthly** for performance and error patterns
- **Quarterly** for sampling rate optimization
- **After major releases** for new error patterns
- **When adding new features** for context integration

Remember to update the Sentry SDK regularly and review release notes for breaking changes.