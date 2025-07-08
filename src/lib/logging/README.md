# Centralized Logging Infrastructure

A comprehensive logging system for the Learning Assistant application with production-ready features including structured logging, performance monitoring, security auditing, and external service integrations.

## Features

- **Multi-transport Winston logger** with console, file, and cloud service support
- **Structured JSON logging** with consistent formatting and metadata
- **Log rotation and archival** with configurable retention policies
- **Performance metrics collection** with operation timing and resource monitoring
- **Security audit logging** with threat detection and compliance features
- **Log aggregation** for production environments (Elasticsearch, DataDog, Splunk, etc.)
- **Sensitive data scrubbing** to protect PII and credentials
- **Request/response logging middleware** for API monitoring
- **Sentry integration** for error tracking and alerting
- **Correlation ID tracking** for request tracing across services
- **Configurable sampling** for high-volume environments
- **Health monitoring** and metrics collection

## Quick Start

### Basic Usage

```typescript
import { logger, initializeLogging } from '@/lib/logging';

// Initialize the logging system (typically in app startup)
await initializeLogging();

// Basic logging
logger.info('Application started successfully');
logger.error('Something went wrong', { error: 'details' });
logger.warn('Performance degraded', { responseTime: 5000 });

// Structured logging with context
logger.info('User action performed', {
  userId: 'user123',
  action: 'login',
  ip: '192.168.1.100',
  userAgent: 'Mozilla/5.0...',
  category: 'authentication'
});
```

### Performance Logging

```typescript
import { performanceLogger } from '@/lib/logging';

// Manual performance logging
const startTime = Date.now();
// ... perform operation
const duration = Date.now() - startTime;
performanceLogger.logPerformance('user-registration', duration, {
  userId: 'user123',
  success: true
});

// Automatic measurement with decorators
@measurePerformance('database-query')
async function getUserData(userId: string) {
  // Database operation
  return userData;
}

// Async operation measurement
const { result, metric } = await performanceLogger.measureAsync(
  'api-call',
  async () => {
    const response = await fetch('/api/data');
    return response.json();
  },
  { endpoint: '/api/data' }
);
```

### Security Audit Logging

```typescript
import { securityAuditLogger, SecurityEventType, SecurityEventSeverity } from '@/lib/logging';

// Authentication events
securityAuditLogger.logAuthenticationSuccess(
  'user123',
  '192.168.1.100',
  'Mozilla/5.0...',
  'password'
);

securityAuditLogger.logAuthenticationFailure(
  'user123',
  '192.168.1.100',
  'Mozilla/5.0...',
  'Invalid password'
);

// Security threats
securityAuditLogger.logSQLInjectionAttempt(
  '192.168.1.100',
  'Mozilla/5.0...',
  "'; DROP TABLE users; --",
  '/api/search'
);

// Custom security events
securityAuditLogger.logSecurityEvent({
  type: SecurityEventType.SUSPICIOUS_ACTIVITY,
  severity: SecurityEventSeverity.HIGH,
  message: 'Multiple failed login attempts detected',
  userId: 'user123',
  ip: '192.168.1.100',
  outcome: 'blocked',
  details: { attemptCount: 5, timeWindow: '5 minutes' }
});
```

### Request Logging Middleware

```typescript
import { expressRequestLogger, nextRequestLogger } from '@/lib/logging';

// Express.js middleware
app.use(expressRequestLogger);

// Next.js middleware
export { nextRequestLogger as middleware };

// Custom middleware configuration
import { createRequestLoggingMiddleware } from '@/lib/logging';

const customRequestLogger = createRequestLoggingMiddleware({
  includeRequestBody: true,
  includeHeaders: false,
  maxBodySize: 5120, // 5KB
  ignorePaths: ['/health', '/metrics']
});
```

### Contextual Loggers

```typescript
import { createModuleLogger, createUserLogger, createRequestLogger } from '@/lib/logging';

// Module-specific logger
const authLogger = createModuleLogger('authentication', 'login-service');
authLogger.info('Login attempt started', { username: 'user123' });

// User-specific logger
const userLogger = createUserLogger('user123', 'session456');
userLogger.info('Profile updated', { field: 'email' });

// Request-specific logger
const requestLogger = createRequestLogger('req123', 'POST', '/api/users', 'user123');
requestLogger.info('Processing user creation request');
```

## Configuration

### Environment Variables

```bash
# Core logging
LOG_LEVEL=info
LOGGING_ENABLED=true
LOG_SAMPLING_ENABLED=true
LOG_SAMPLING_RATE=0.1
LOG_BUFFERING_ENABLED=true
LOG_BUFFER_SIZE=1000
LOG_FLUSH_INTERVAL=5000

# File logging
LOG_MAX_SIZE=20m
LOG_MAX_FILES=30

# Performance thresholds
PERF_RESPONSE_WARN=1000
PERF_RESPONSE_CRITICAL=5000
PERF_DB_WARN=500
PERF_DB_CRITICAL=2000

# Security
SECURITY_REAL_TIME_ALERTS=true
COMPLIANCE_MODE=true

# External services
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project
LOGZIO_TOKEN=your-logzio-token
ELASTICSEARCH_URL=https://your-elasticsearch-cluster
DATADOG_API_KEY=your-datadog-api-key
```

### Programmatic Configuration

```typescript
import { loggingSystem, config } from '@/lib/logging';

// Update system configuration
loggingSystem.updateConfig({
  enablePerformanceLogging: true,
  enableSecurityLogging: true,
  healthCheckInterval: 300000, // 5 minutes
  metricsInterval: 60000 // 1 minute
});

// Validate configuration
const validation = config.validateConfiguration();
if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
}
```

## Advanced Features

### Correlation ID Tracking

```typescript
import { correlationManager } from '@/lib/correlation';

// Generate and set correlation ID
const correlationId = correlationManager.generateCorrelationId();
correlationManager.setCorrelationId(correlationId);

// All subsequent logs will include this correlation ID
logger.info('Processing request'); // Automatically includes correlation ID

// Manual correlation ID
logger.info('Custom operation', {
  correlationId: 'custom-correlation-123'
});
```

### Custom Log Transports

```typescript
import { logger, HttpTransport } from '@/lib/logging';

// Add custom HTTP transport
const customTransport = new HttpTransport({
  endpoint: 'https://your-log-endpoint.com/logs',
  headers: {
    'Authorization': 'Bearer your-token',
    'Content-Type': 'application/json'
  },
  batchSize: 50,
  batchTimeout: 10000
});

logger.addTransport(customTransport);
```

### Sensitive Data Scrubbing

```typescript
import { sensitiveDataScrubber } from '@/lib/logging';

const userData = {
  id: 'user123',
  email: 'user@example.com',
  password: 'secret123', // This will be scrubbed
  creditCard: '4111-1111-1111-1111' // This will be masked
};

const scrubbedData = sensitiveDataScrubber(userData);
logger.info('User data processed', scrubbedData);
// Output: { id: 'user123', email: 'use***@example.com', password: '[REDACTED]', creditCard: '****-****-****-1111' }
```

### Health Monitoring

```typescript
import { checkLoggingHealth, getLoggingStatistics } from '@/lib/logging';

// Health check
const health = await checkLoggingHealth();
console.log('Logging system health:', health);

// System statistics
const stats = await getLoggingStatistics();
console.log('Logging statistics:', stats);
```

## Integration with Existing Systems

### Error Handling Integration

```typescript
import { logger } from '@/lib/logging';

// Enhanced error handling
function handleError(error: Error, context?: any) {
  logger.logError(error, {
    ...context,
    category: 'error-handler',
    component: 'global-handler'
  });
  
  // Additional error handling logic
}
```

### API Route Integration

```typescript
// app/api/users/route.ts
import { logger, performanceLogger } from '@/lib/logging';

export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    logger.info('User creation request started', {
      category: 'api',
      endpoint: '/api/users'
    });
    
    // Process request
    const userData = await request.json();
    const user = await createUser(userData);
    
    const duration = Date.now() - startTime;
    performanceLogger.logHttpRequest('POST', '/api/users', 201, duration);
    
    return Response.json(user, { status: 201 });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    performanceLogger.logHttpRequest('POST', '/api/users', 500, duration);
    
    logger.logError(error as Error, {
      category: 'api',
      endpoint: '/api/users'
    });
    
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

## Production Deployment

### Docker Configuration

```dockerfile
# Ensure log directory exists
RUN mkdir -p /app/logs

# Set logging environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV LOGGING_ENABLED=true
ENV SENTRY_DSN=your-production-sentry-dsn
```

### Kubernetes Configuration

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: logging-config
data:
  LOG_LEVEL: "info"
  LOGGING_ENABLED: "true"
  SENTRY_DSN: "your-sentry-dsn"
  ELASTICSEARCH_URL: "https://elasticsearch.cluster"
```

### Log Aggregation Setup

The system supports multiple log aggregation services:

- **Elasticsearch**: Full-text search and analytics
- **DataDog**: Comprehensive monitoring and alerting
- **Splunk**: Enterprise log management
- **LogZ.io**: Cloud-based ELK stack
- **New Relic**: Application performance monitoring

Configure the appropriate environment variables to enable these services.

## Troubleshooting

### Common Issues

1. **Logs not appearing**: Check `LOGGING_ENABLED` environment variable
2. **Performance issues**: Enable sampling with `LOG_SAMPLING_ENABLED=true`
3. **Disk space**: Configure log rotation with appropriate `LOG_MAX_SIZE` and `LOG_MAX_FILES`
4. **Security alerts**: Check firewall rules for external log services

### Debug Mode

```typescript
import { logger } from '@/lib/logging';

// Enable debug logging
logger.setLevel('debug');

// Check logger health
const isHealthy = await logger.healthCheck();
console.log('Logger healthy:', isHealthy);
```

## Contributing

When adding new logging features:

1. Follow the existing patterns for log structure
2. Add appropriate tests
3. Update configuration as needed
4. Document new environment variables
5. Consider security implications of logged data

## License

This logging infrastructure is part of the Learning Assistant project and follows the same license terms.