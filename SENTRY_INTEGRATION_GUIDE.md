# Sentry Integration Guide

## Overview

This document provides a comprehensive guide for the Sentry error monitoring integration in the Learning Assistant application. The implementation includes client-side error tracking, server-side monitoring, performance analytics, and user context management.

## Features Implemented

### ✅ Core Features
- **Error Boundaries**: React error boundaries with Sentry integration
- **API Error Handling**: Enhanced API route error handling with context
- **Performance Monitoring**: Transaction tracking and Core Web Vitals
- **User Context**: User identification and session tracking
- **Custom Tags**: Learning-specific categorization
- **Source Maps**: Production debugging support
- **Environment Configuration**: Development, staging, and production settings
- **Release Tracking**: Deployment and version tracking

### ✅ Advanced Features
- **Learning Analytics Integration**: Custom events for educational activities
- **Custom Metrics**: Performance and engagement tracking
- **Error Rate Limiting**: Prevents spam reporting
- **Data Privacy**: GDPR-compliant data scrubbing
- **Async Error Handling**: Unhandled promise rejection capture
- **Development Tools**: Testing dashboard and debugging utilities

## Files Created/Modified

### Configuration Files
- `sentry.client.config.ts` - Client-side Sentry configuration
- `sentry.server.config.ts` - Server-side Sentry configuration  
- `sentry.edge.config.ts` - Edge runtime Sentry configuration
- `next.config.js` - Next.js Sentry integration
- `.env.local` - Environment variables

### Core Implementation
- `src/lib/sentry.ts` - Centralized Sentry utilities and configuration
- `src/components/ErrorBoundary.tsx` - Enhanced error boundaries
- `src/middleware/sentry-error-handler.ts` - API error handling middleware
- `src/contexts/RootProvider.tsx` - Root provider with Sentry integration

### API Routes
- `app/api/monitoring/route.ts` - Sentry tunnel and testing endpoint

### Testing & Development
- `src/components/SentryTestDashboard.tsx` - Development testing interface

### Deployment Configuration
- `deploy/config/fly/production.env` - Fly.io environment variables
- `deploy/config/railway/production.env` - Railway environment variables

## Setup Instructions

### 1. Sentry Project Setup

1. Create a new project in [Sentry.io](https://sentry.io)
2. Note down the following values:
   - DSN (Data Source Name)
   - Organization slug
   - Project name
   - Auth token (for releases)

### 2. Environment Configuration

Update your `.env.local` file with Sentry configuration:

```env
# Sentry Configuration
SENTRY_DSN=https://your-dsn@sentry.io/project-id
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=learning-assistant
SENTRY_AUTH_TOKEN=your-auth-token
NEXT_PUBLIC_APP_VERSION=1.0.0
```

### 3. Production Deployment

For production deployments, add these environment variables to your hosting platform:

```env
SENTRY_DSN=https://your-dsn@sentry.io/project-id
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=learning-assistant
SENTRY_AUTH_TOKEN=your-auth-token
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=1.0.0
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
SENTRY_REPLAY_SESSION_SAMPLE_RATE=0.1
SENTRY_REPLAY_ERROR_SAMPLE_RATE=1.0
```

## Usage Examples

### Basic Error Reporting

```typescript
import { reportError } from '@/lib/sentry';

try {
  // Your code here
} catch (error) {
  reportError(error as Error, {
    feature: 'learning_module',
    lessonId: 'lesson-123'
  });
}
```

### User Context Management

```typescript
import { setUserContext, clearUserContext } from '@/lib/sentry';

// Set user context when user logs in
setUserContext({
  id: user.id,
  email: user.email,
  username: user.username,
  role: user.role
});

// Clear context on logout
clearUserContext();
```

### Learning Event Tracking

```typescript
import { trackLearningEvent } from '@/lib/sentry';

// Track lesson start
trackLearningEvent({
  type: 'lesson_start',
  lessonId: 'lesson-123',
  userId: user.id,
  difficulty: 'intermediate'
});

// Track quiz completion
trackLearningEvent({
  type: 'quiz_attempt',
  lessonId: 'lesson-123',
  score: 85,
  duration: 30000,
  userId: user.id
});
```

### Performance Monitoring

```typescript
import { measurePerformance } from '@/lib/sentry';

const result = await measurePerformance('data-processing', async () => {
  // Your performance-critical code
  return await processLearningData();
});
```

### API Error Handling

```typescript
import { withSentryErrorHandler } from '@/middleware/sentry-error-handler';

const handler = async (request: NextRequest) => {
  // Your API logic
  return NextResponse.json({ success: true });
};

export const GET = withSentryErrorHandler(handler);
```

### Error Boundaries

```typescript
import { EnhancedErrorBoundary } from '@/components/ErrorBoundary';

function MyComponent() {
  return (
    <EnhancedErrorBoundary
      level="feature"
      name="LearningModule"
      showDetails={process.env.NODE_ENV === 'development'}
    >
      <YourComponent />
    </EnhancedErrorBoundary>
  );
}
```

## Configuration Options

### Sampling Rates

- **Development**: 100% error and performance tracking
- **Production**: 10% performance tracking, 100% error tracking
- **Session Replay**: 10% normal sessions, 100% error sessions

### Error Filtering

The implementation filters out:
- Network errors (timeouts, connection issues)
- Browser extension errors
- Non-actionable ResizeObserver errors
- Development-specific errors in production

### Data Privacy

- Automatically scrubs sensitive headers (authorization, cookies)
- Masks all form inputs in session replay
- Removes sensitive URL parameters
- GDPR-compliant data handling

## Testing

### Development Testing Dashboard

In development mode, you can access the Sentry testing dashboard:

```typescript
import { SentryTestDashboard } from '@/components/SentryTestDashboard';

// Add to your development page
<SentryTestDashboard />
```

### API Testing Endpoints

```bash
# Test error reporting
curl "http://localhost:3000/api/monitoring?action=test-error"

# Test performance monitoring
curl "http://localhost:3000/api/monitoring?action=test-performance"

# Test warning messages
curl "http://localhost:3000/api/monitoring?action=test-warning"

# Health check
curl "http://localhost:3000/api/monitoring?action=health"
```

## Monitoring & Alerts

### Recommended Alerts

Set up alerts in Sentry for:

1. **High Error Rate**: > 5% error rate in 5 minutes
2. **Performance Degradation**: P95 response time > 2 seconds
3. **Critical Errors**: Any error with severity "critical"
4. **New Release Issues**: Error spike after deployment
5. **User Impact**: Errors affecting > 10 users

### Dashboard Metrics

Monitor these key metrics:
- Error rate by feature
- Performance by API endpoint
- User-affected errors
- Learning module completion rates
- Quiz performance correlation with errors

## Best Practices

### Error Reporting
- Include relevant context (user ID, lesson ID, etc.)
- Use appropriate error levels (info, warning, error, fatal)
- Avoid reporting expected errors (validation failures)
- Include enough context for debugging

### Performance Monitoring
- Track key user journeys
- Monitor API response times
- Track Core Web Vitals
- Measure learning-specific metrics

### User Privacy
- Never log sensitive data (passwords, tokens)
- Use user IDs instead of email addresses
- Implement proper data retention policies
- Respect user consent preferences

## Troubleshooting

### Common Issues

1. **No errors appearing in Sentry**
   - Check DSN configuration
   - Verify environment variables
   - Test with monitoring endpoint

2. **Source maps not working**
   - Ensure auth token is configured
   - Check build process includes source maps
   - Verify organization/project settings

3. **Performance data missing**
   - Check sampling rates
   - Verify tracing configuration
   - Ensure performance is enabled in Sentry project

4. **Too many errors**
   - Review error filtering rules
   - Implement rate limiting
   - Check for error loops

### Debug Mode

Enable debug mode in development:

```env
SENTRY_DEBUG=true
```

This will log Sentry operations to the console.

## Release Management

### Automatic Release Tracking

Releases are automatically tracked with:
- Version from `package.json` or environment variable
- Git commit hash (if available)
- Deploy timestamp
- Environment information

### Manual Release Creation

```bash
# Install Sentry CLI
npm install -g @sentry/cli

# Create release
sentry-cli releases new $VERSION

# Upload source maps
sentry-cli releases files $VERSION upload-sourcemaps ./build

# Finalize release
sentry-cli releases finalize $VERSION
```

## Security Considerations

### Data Scrubbing
- All sensitive headers are automatically filtered
- Form inputs are masked in session replay
- PII is removed from error contexts
- API keys and tokens are never logged

### Network Security
- Uses tunnel endpoint to bypass ad blockers
- HTTPS-only communication
- Rate limiting prevents abuse
- IP-based filtering available

## Performance Impact

### Client-Side
- Minimal bundle size increase (~50KB gzipped)
- Lazy loading of session replay
- Efficient error deduplication
- Optimized for Core Web Vitals

### Server-Side
- Minimal latency overhead (<5ms)
- Async error reporting
- Connection pooling
- Graceful degradation on Sentry outages

## Support & Resources

### Documentation
- [Official Sentry Docs](https://docs.sentry.io/)
- [Next.js Integration Guide](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Performance Monitoring](https://docs.sentry.io/product/performance/)

### Internal Resources
- Sentry Test Dashboard: `/api/monitoring` (dev mode)
- Error Boundary Examples: `src/components/ErrorBoundary.tsx`
- API Error Handler: `src/middleware/sentry-error-handler.ts`

---

**Last Updated**: January 2025  
**Version**: 1.0.0  
**Maintainer**: Learning Assistant Development Team