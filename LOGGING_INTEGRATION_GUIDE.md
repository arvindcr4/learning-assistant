# Centralized Logging Infrastructure Integration Guide

This guide demonstrates how to integrate and use the comprehensive logging infrastructure for the learning assistant application.

## Overview

The logging infrastructure consists of several interconnected components:

1. **Correlation ID Management** - Distributed tracing across requests
2. **Audit Logging** - Security and compliance event tracking
3. **Log Aggregation** - Centralized log collection and shipping
4. **Request Logging** - HTTP request/response monitoring with performance metrics
5. **Log Sampling** - High-volume event management
6. **Schema Validation** - Structured logging with type safety
7. **Log Retention** - Automated cleanup and archival policies
8. **Metrics & Alerting** - Real-time monitoring and notifications

## Quick Start

### 1. Basic Logger Usage

```typescript
import logger, { createContextualLogger } from '@/lib/logger';
import { correlationManager } from '@/lib/correlation';

// Basic logging
logger.info('Application started', { version: '1.0.0' });
logger.error('Database connection failed', { error: 'Connection timeout' });

// Contextual logging with correlation
const contextLogger = createContextualLogger({ 
  component: 'user-service',
  operation: 'user-registration' 
});
contextLogger.info('User registration initiated', { userId: 'user123' });
```

### 2. Request Logging Middleware

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { correlationMiddleware } from '@/lib/correlation';
import { requestLogger } from '@/middleware/logging';

export async function middleware(request: NextRequest) {
  // Add correlation context
  return correlationManager.runWithContext(
    correlationManager.createChildSpan('http-request'),
    async () => {
      // Log request start
      await requestLogger.logRequestStart(request);
      
      const response = NextResponse.next();
      
      // Log request completion
      requestLogger.logRequestComplete(request, response);
      
      return response;
    }
  );
}
```

### 3. API Route Integration

```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withCorrelation } from '@/lib/correlation';
import { auditLogger } from '@/lib/audit-logger';
import { performanceMonitor } from '@/middleware/logging';
import { logValidator } from '@/lib/log-schemas';

export const GET = withCorrelation(async (request: NextRequest) => {
  try {
    // Log API access for audit
    auditLogger.logApiAccess(
      'GET /api/users',
      '/api/users',
      request.headers.get('user-id') || undefined,
      'success'
    );
    
    // Track database query performance
    const start = Date.now();
    const users = await getUsersFromDatabase();
    const duration = Date.now() - start;
    
    performanceMonitor.trackDatabaseQuery(
      'SELECT * FROM users WHERE active = true',
      duration
    );
    
    return NextResponse.json({ users });
  } catch (error) {
    // Log error with correlation context
    const errorLog = logValidator.validateCategory('error', {
      level: 'error',
      message: 'Failed to fetch users',
      category: 'error',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      operation: 'fetch-users',
    });
    
    if (errorLog.isValid) {
      logger.error('API Error', errorLog.sanitized);
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
```

### 4. Security Audit Logging

```typescript
import { auditUtils, AuditSeverity } from '@/lib/audit-logger';

// Authentication events
auditUtils.logLogin('user123', true, {
  method: 'email',
  ip: '192.168.1.100',
  userAgent: 'Mozilla/5.0...',
});

// Security violations
auditLogger.logSecurityViolation(
  'Multiple failed login attempts',
  AuditSeverity.HIGH,
  {
    userId: 'user123',
    attemptCount: 5,
    timeWindow: '5 minutes',
    ip: '192.168.1.100',
  }
);

// Data access logging
auditLogger.logDataAccess(
  'user_profile_view',
  'user:user123',
  'admin456',
  'success',
  {
    fields: ['email', 'name', 'preferences'],
    reason: 'support_request',
  }
);
```

### 5. Log Aggregation Configuration

```typescript
// Environment variables for log aggregation
process.env.DATADOG_API_KEY = 'your-datadog-api-key';
process.env.SPLUNK_TOKEN = 'your-splunk-token';
process.env.SPLUNK_ENDPOINT = 'https://your-splunk-instance.com';
process.env.ELASTICSEARCH_ENDPOINT = 'https://your-elasticsearch-cluster.com';

// Configuration will be automatically loaded
import { initializeLogAggregation, logAggregationManager } from '@/lib/log-aggregation';

// Initialize log aggregation
initializeLogAggregation();

// Check health
const health = await logAggregationManager.healthCheck();
console.log('Log aggregation health:', health);
```

### 6. Log Sampling for High-Volume Events

```typescript
import { createSampledLogger } from '@/lib/logger';

// Create sampled logger for high-frequency events
const httpSampler = createSampledLogger(0.1, 'http-requests'); // 10% sampling
const apiSampler = createSampledLogger(0.05, 'api-calls'); // 5% sampling

// Use sampled logging for high-volume events
httpSampler.info('HTTP request processed', {
  method: 'GET',
  path: '/api/health',
  duration: 5,
});

apiSampler.debug('External API call', {
  provider: 'third-party-service',
  endpoint: '/api/data',
  responseTime: 150,
});
```

### 7. Structured Logging with Validation

```typescript
import { createValidatedLog, logValidator } from '@/lib/log-schemas';

// Create validated log entries
const httpLog = createValidatedLog.http({
  level: 'info',
  message: 'Request processed',
  method: 'POST',
  path: '/api/users',
  statusCode: 201,
  duration: 150,
  correlationId: 'req-123',
});

const performanceLog = createValidatedLog.performance({
  level: 'warn',
  message: 'Slow operation detected',
  operation: 'database-query',
  duration: 5000,
  slowOperation: true,
  threshold: 1000,
});

// Manual validation
const result = logValidator.validate({
  level: 'error',
  message: 'Database error',
  category: 'database',
  operation: 'INSERT',
  table: 'users',
  duration: 100,
});

if (!result.isValid) {
  console.error('Invalid log entry:', result.errors);
}
```

### 8. Log Retention Management

```typescript
import { logRetentionManager, retentionUtils } from '@/lib/log-retention';

// Apply retention policies
const results = await logRetentionManager.applyAllPolicies();
console.log('Retention cleanup results:', results);

// Schedule automatic cleanup (daily)
const cleanupTimer = logRetentionManager.scheduleCleanup(24);

// Custom retention policy
logRetentionManager.setPolicy({
  category: 'custom-logs',
  retentionDays: 60,
  compressionEnabled: true,
  compressionAfterDays: 7,
  deleteAfterArchive: true,
  maxFileSize: '100MB',
  maxTotalSize: '1GB',
});

// Get retention status
const status = await logRetentionManager.getRetentionStatus();
console.log('Retention status:', status);
```

## Advanced Usage

### Business Event Logging

```typescript
import { businessLogger } from '@/lib/logger';

// Track business events
businessLogger.info('User completed course', {
  userId: 'user123',
  courseId: 'course456',
  completionTime: 3600, // seconds
  score: 95,
  businessEvent: true,
});

// E-commerce events
businessLogger.info('Purchase completed', {
  userId: 'user123',
  orderId: 'order789',
  amount: 99.99,
  currency: 'USD',
  paymentMethod: 'credit_card',
  businessEvent: true,
});
```

### Performance Monitoring

```typescript
import { performanceTracker, withCorrelationContext } from '@/lib/correlation';

// Track operation performance
await withCorrelationContext(
  'user-registration',
  async () => {
    // Validation
    performanceTracker.start('validation');
    await validateUserData(userData);
    const validationTime = performanceTracker.end('validation');
    
    // Database operation
    performanceTracker.start('database-insert');
    await createUser(userData);
    const dbTime = performanceTracker.end('database-insert');
    
    // Email sending
    performanceTracker.start('email-send');
    await sendWelcomeEmail(userData.email);
    const emailTime = performanceTracker.end('email-send');
    
    logger.info('User registration completed', {
      validationTime,
      dbTime,
      emailTime,
      totalTime: validationTime + dbTime + emailTime,
    });
  },
  { userId: userData.id, operation: 'registration' }
);
```

### Custom Alerting

```typescript
import { metricsCollector } from '@/lib/logger';

// Add custom alert conditions
metricsCollector.addAlert(
  'high_api_error_rate',
  (log) => {
    return log.category === 'http' && 
           log.statusCode >= 500 && 
           log.level === 'error';
  },
  (log) => {
    // Send alert to monitoring system
    console.error('HIGH API ERROR RATE ALERT:', {
      path: log.path,
      statusCode: log.statusCode,
      correlationId: log.correlationId,
      timestamp: log.timestamp,
    });
    
    // Could integrate with PagerDuty, Slack, etc.
    // await sendSlackAlert(log);
  }
);

// Memory usage alert
metricsCollector.addAlert(
  'high_memory_usage',
  (log) => {
    return log.category === 'system' && 
           log.metric === 'memory_usage' && 
           log.value > 800; // MB
  },
  (log) => {
    console.warn('HIGH MEMORY USAGE ALERT:', {
      value: log.value,
      unit: log.unit,
      timestamp: log.timestamp,
    });
  }
);
```

### Health Check Integration

```typescript
import { loggingHealthCheck } from '@/lib/logger';

// Health check endpoint
export async function GET() {
  const health = await loggingHealthCheck();
  
  return NextResponse.json({
    status: health.status,
    components: health.components,
    details: health.details,
    timestamp: new Date().toISOString(),
  });
}
```

## Environment Configuration

Create a `.env.local` file with the following logging configuration:

```bash
# General logging
LOG_LEVEL=info
NODE_ENV=production

# Log aggregation services
DATADOG_API_KEY=your-datadog-api-key
DATADOG_ENDPOINT=https://http-intake.logs.datadoghq.com
DATADOG_SOURCE=nodejs

SPLUNK_TOKEN=your-splunk-token
SPLUNK_ENDPOINT=https://your-splunk-instance.com
SPLUNK_INDEX=main
SPLUNK_SOURCE=nodejs

ELASTICSEARCH_ENDPOINT=https://your-elasticsearch-cluster.com
ELASTICSEARCH_API_KEY=your-elasticsearch-api-key
ELASTICSEARCH_INDEX=logs

LOGZIO_TOKEN=your-logzio-token
LOGZIO_ENDPOINT=https://listener.logz.io

# Log retention policies
LOG_RETENTION_SECURITY_DAYS=2555
LOG_RETENTION_SECURITY_COMPRESSION=true
LOG_RETENTION_SECURITY_COMPRESSION_AFTER=30
LOG_RETENTION_SECURITY_MAX_FILE_SIZE=100MB

LOG_RETENTION_HTTP_DAYS=30
LOG_RETENTION_HTTP_COMPRESSION=true
LOG_RETENTION_HTTP_COMPRESSION_AFTER=3
LOG_RETENTION_HTTP_MAX_FILE_SIZE=50MB
LOG_RETENTION_HTTP_MAX_TOTAL_SIZE=1GB
```

## Best Practices

### 1. Correlation ID Usage
- Always use correlation IDs for request tracing
- Propagate correlation IDs to external service calls
- Include correlation IDs in error messages

### 2. Security Logging
- Log all authentication and authorization events
- Never log sensitive data (passwords, tokens, etc.)
- Use appropriate severity levels for security events
- Implement real-time alerting for critical security events

### 3. Performance Monitoring
- Log slow operations with thresholds
- Track external API call performance
- Monitor database query performance
- Set up alerts for performance degradation

### 4. Log Sampling
- Use sampling for high-volume, low-value events
- Always log errors and warnings without sampling
- Adjust sampling rates based on traffic patterns
- Monitor sampling effectiveness

### 5. Structured Logging
- Use consistent log schemas across the application
- Validate log entries before writing
- Include relevant context in log messages
- Use appropriate log levels

### 6. Retention Management
- Set appropriate retention periods for different log types
- Enable compression for older logs
- Archive critical logs (security, audit) for compliance
- Monitor disk usage and set size limits

## Monitoring and Alerting

The logging infrastructure includes built-in monitoring and alerting capabilities:

- **Error Rate Monitoring** - Alerts on high error rates
- **Performance Monitoring** - Alerts on slow operations
- **Security Monitoring** - Alerts on security violations
- **System Monitoring** - Alerts on resource usage
- **Log Aggregation Health** - Monitors external log services

## Troubleshooting

### Common Issues

1. **Missing Correlation IDs**
   - Ensure middleware is properly configured
   - Check async context propagation
   - Verify header extraction logic

2. **Log Aggregation Failures**
   - Check API keys and endpoints
   - Verify network connectivity
   - Monitor aggregation service health checks

3. **High Disk Usage**
   - Review retention policies
   - Check compression settings
   - Monitor log volume and adjust sampling

4. **Performance Impact**
   - Adjust log levels in production
   - Use appropriate sampling rates
   - Monitor logging overhead

5. **Schema Validation Errors**
   - Check log entry structure
   - Review validation error logs
   - Update schemas as needed

## Integration Checklist

- [ ] Configure environment variables
- [ ] Set up middleware for correlation IDs
- [ ] Configure log aggregation services
- [ ] Set up retention policies
- [ ] Configure alerting rules
- [ ] Test end-to-end logging flow
- [ ] Monitor performance impact
- [ ] Verify compliance requirements
- [ ] Set up log monitoring dashboards
- [ ] Document custom log categories

This comprehensive logging infrastructure provides production-ready observability, security audit trails, and compliance features while maintaining high performance and scalability.