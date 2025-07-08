# Monitoring & Alerting Setup Guide

## Quick Setup

This guide walks through setting up the comprehensive monitoring and alerting system for the Learning Assistant application.

## Prerequisites

- Node.js 20.x
- Redis (for caching)
- PostgreSQL (for data storage)
- External monitoring accounts (optional):
  - DataDog
  - New Relic
  - Sentry
  - PagerDuty

## Environment Configuration

Create a `.env.local` file with the following variables:

```bash
# Basic Configuration
NODE_ENV=production
BASE_URL=https://your-domain.com

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/learning_assistant

# Redis Cache
REDIS_URL=redis://localhost:6379

# APM Providers (Enable as needed)
PROMETHEUS_ENABLED=true
PROMETHEUS_PREFIX=learning_assistant

DATADOG_ENABLED=true
DATADOG_API_KEY=your_datadog_api_key
DATADOG_APP_KEY=your_datadog_app_key
DATADOG_SITE=datadoghq.com

NEW_RELIC_ENABLED=true
NEW_RELIC_API_KEY=your_newrelic_api_key
NEW_RELIC_ACCOUNT_ID=your_account_id
NEW_RELIC_APP_NAME=learning-assistant

SENTRY_DSN=your_sentry_dsn

# Alerting Configuration
ENABLE_ALERTING=true
SLACK_WEBHOOK_URL=your_slack_webhook_url
ALERT_EMAIL_RECIPIENTS=team@company.com,oncall@company.com
PAGERDUTY_API_KEY=your_pagerduty_api_key
PAGERDUTY_SERVICE_KEY=your_service_key

# Log Aggregation
LOG_AGGREGATION_ENABLED=true
LOG_ANALYSIS_ENABLED=true
LOG_STORAGE_TYPE=memory
ELASTICSEARCH_URL=http://localhost:9200
CLOUDWATCH_LOG_GROUP=learning-assistant-logs

# SLA Monitoring
SLA_MONITORING_ENABLED=true
UPTIME_MONITORING_ENABLED=true

# Anomaly Detection
ANOMALY_DETECTION_ENABLED=true
```

## Installation

1. **Install Dependencies**:
```bash
npm install
```

2. **Initialize Database**:
```bash
npm run db:migrate
```

3. **Start Application**:
```bash
npm run build
npm start
```

## Verification

### 1. Health Check

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "message": "All systems operational",
  "timestamp": "2024-01-08T12:00:00.000Z",
  "healthScore": 100
}
```

### 2. Metrics Endpoint

```bash
curl http://localhost:3000/api/metrics?format=prometheus
```

Should return Prometheus-formatted metrics.

### 3. Dashboard Data

```bash
curl http://localhost:3000/api/monitoring/dashboard
```

Should return comprehensive monitoring data.

## Configuration

### APM Providers

#### Prometheus
- Automatically enabled if `PROMETHEUS_ENABLED=true`
- Metrics available at `/api/metrics?format=prometheus`
- Default prefix: `learning_assistant`

#### DataDog
1. Create DataDog account
2. Get API and App keys
3. Set environment variables
4. Metrics will be sent automatically

#### New Relic
1. Create New Relic account
2. Get License Key and Account ID
3. Set environment variables
4. Install New Relic agent (optional)

#### Sentry
1. Create Sentry project
2. Get DSN
3. Set SENTRY_DSN environment variable
4. Error tracking will be automatic

### Alerting Setup

#### Slack Integration
1. Create Slack app
2. Add webhook integration
3. Set SLACK_WEBHOOK_URL
4. Alerts will be sent to configured channels

#### PagerDuty Integration
1. Create PagerDuty service
2. Get integration keys
3. Set PAGERDUTY_* environment variables
4. Critical alerts will trigger pages

#### Email Alerts
1. Configure email provider (SendGrid, AWS SES)
2. Set ALERT_EMAIL_RECIPIENTS
3. Implement email service in codebase

### Custom Metrics

Add custom metrics for your learning platform:

```typescript
import { learningMetrics } from '@/lib/learning-metrics';

// Track user session
learningMetrics.startSession(userId, sessionId, {
  deviceType: 'desktop',
  learningStyle: 'visual'
});

// Track content interaction
learningMetrics.trackContentView(userId, sessionId, contentId);
learningMetrics.trackContentComplete(userId, sessionId, contentId, {
  timeSpent: 300000, // 5 minutes
  score: 85
});

// Track quiz performance
learningMetrics.trackQuizComplete(userId, sessionId, quizId, 85, {
  timeSpent: 180000, // 3 minutes
  totalQuestions: 10,
  correctAnswers: 8
});
```

## Monitoring Dashboards

### System Health Dashboard

Access: `http://localhost:3000/api/monitoring/dashboard?category=health`

Metrics:
- Overall system status
- Component health checks
- Response times
- Error rates

### Learning Analytics Dashboard

Access: `http://localhost:3000/api/monitoring/dashboard?category=learning`

Metrics:
- Active learning sessions
- Content completion rates
- Quiz performance
- User engagement scores

### Performance Dashboard

Access: `http://localhost:3000/api/monitoring/dashboard?category=performance`

Metrics:
- API response times
- Database query performance
- Memory and CPU usage
- Cache hit rates

### SLA Dashboard

Access: `http://localhost:3000/api/sla/status`

Metrics:
- Uptime percentage
- SLA compliance status
- Incident history
- Performance trends

## Alert Rules

### Default Alert Rules

1. **High Error Rate**
   - Condition: Error rate > 5% for 5 minutes
   - Severity: High
   - Channels: Slack, Email

2. **Critical Memory Usage**
   - Condition: Memory usage > 90% for 2 minutes
   - Severity: Critical
   - Channels: Slack, Email, PagerDuty

3. **Database Connection Failure**
   - Condition: Database health = unhealthy
   - Severity: Critical
   - Channels: Slack, Email, PagerDuty

4. **Slow Response Time**
   - Condition: P95 response time > 2000ms for 10 minutes
   - Severity: Medium
   - Channels: Slack

### Custom Alert Rules

Create custom alerts:

```typescript
import { alertingEngine } from '@/lib/alerting-engine';

alertingEngine.addRule({
  id: 'low_quiz_completion',
  name: 'Low Quiz Completion Rate',
  description: 'Quiz completion rate has dropped below acceptable threshold',
  severity: 'medium',
  condition: {
    metric: 'quiz_completion_rate',
    operator: 'lt',
    threshold: 70,
    duration: 15,
    timeWindow: 30
  },
  channels: ['slack'],
  recipients: {
    slack: ['#learning-alerts']
  }
});
```

## Anomaly Detection

### Enable Anomaly Detection

Set environment variable:
```bash
ANOMALY_DETECTION_ENABLED=true
```

### Default Detectors

1. **Response Time Anomalies**
   - Algorithm: Seasonal Hybrid
   - Detects unusual response time patterns
   - Considers daily/weekly seasonality

2. **Error Rate Anomalies**
   - Algorithm: Statistical
   - Detects sudden spikes in error rates
   - High sensitivity for quick detection

3. **Memory Usage Anomalies**
   - Algorithm: Seasonal Hybrid
   - Predicts memory leaks and unusual usage
   - Includes trend analysis

### Custom Anomaly Detectors

```typescript
import { anomalyDetectionService } from '@/lib/anomaly-detection';

anomalyDetectionService.addDetector({
  id: 'user_engagement_anomaly',
  name: 'User Engagement Anomaly Detection',
  metric: 'user_engagement_score',
  algorithm: 'seasonal_hybrid',
  sensitivity: 0.7,
  seasonality: {
    enabled: true,
    period: 168, // weekly pattern
  },
  prediction: {
    enabled: true,
    horizon: 60, // 1 hour prediction
  }
});
```

## SLA Monitoring

### Default SLAs

1. **Service Availability**: 99.9% uptime
2. **Response Time**: <2s for 95% of requests
3. **Error Rate**: <1% of all requests

### Custom SLAs

```typescript
import { slaTracker } from '@/lib/sla-tracker';

slaTracker.addSLA({
  id: 'learning_content_availability',
  name: 'Learning Content Availability',
  service: 'content-service',
  targets: [{
    metric: 'content_availability',
    target: 99.5,
    operator: 'gte'
  }],
  timeWindow: {
    type: 'rolling',
    period: 'day',
    duration: 30
  }
});
```

## Troubleshooting

### Common Issues

#### Metrics Not Appearing

1. Check environment variables
2. Verify provider credentials
3. Check network connectivity
4. Review application logs

```bash
# Check APM provider health
curl http://localhost:3000/api/apm/providers/health

# Check metrics buffer
curl http://localhost:3000/api/metrics/buffer
```

#### Alerts Not Firing

1. Verify alerting is enabled
2. Check alert rule configuration
3. Verify notification channels
4. Check cooldown periods

```bash
# Test alert system
curl -X POST http://localhost:3000/api/alerts/test \
  -H "Content-Type: application/json" \
  -d '{"type": "test", "severity": "low"}'
```

#### High Memory Usage

1. Check for memory leaks
2. Review buffer sizes
3. Optimize data retention
4. Consider scaling

```bash
# Check memory metrics
curl http://localhost:3000/api/health | jq '.system.memory'

# Force garbage collection (if enabled)
kill -USR2 $(pgrep node)
```

### Debug Mode

Enable debug logging:

```bash
DEBUG=learning-assistant:* npm start
```

### Log Analysis

Check logs for issues:

```bash
# Search error logs
curl -X GET "http://localhost:3000/api/logs/search?level=error&timeRange=1h"

# Get log analytics
curl -X GET "http://localhost:3000/api/logs/analytics"
```

## Performance Optimization

### Metrics Collection

- Use sampling for high-volume metrics
- Buffer metrics before sending
- Implement circuit breakers for external services

### Alert Optimization

- Set appropriate cooldown periods
- Use escalation policies effectively
- Avoid alert storms with grouping

### Storage Optimization

- Configure appropriate retention periods
- Use compression for log storage
- Implement data archiving strategies

## Security Considerations

### API Endpoints

- Secure monitoring endpoints with authentication
- Use HTTPS for external communications
- Implement rate limiting

### Sensitive Data

- Avoid logging sensitive information
- Sanitize metrics and alerts
- Use secure credential storage

### Access Control

- Limit access to monitoring data
- Implement role-based permissions
- Audit monitoring system access

## Scaling

### Horizontal Scaling

- Multiple application instances supported
- Shared metrics collection
- Distributed alerting

### Metrics Volume

- Implement sampling strategies
- Use metric aggregation
- Consider metric cardinality

### Storage Scaling

- External time series databases
- Log rotation and archiving
- Cloud storage integration

## Backup and Recovery

### Configuration Backup

```bash
# Export alert rules
curl -X GET http://localhost:3000/api/alerts/rules > alert-rules-backup.json

# Export SLA configurations
curl -X GET http://localhost:3000/api/sla/config > sla-config-backup.json

# Export anomaly detectors
curl -X GET http://localhost:3000/api/anomalies/detectors > detectors-backup.json
```

### Restore Configuration

```bash
# Restore alert rules
curl -X POST http://localhost:3000/api/alerts/rules/restore \
  -H "Content-Type: application/json" \
  -d @alert-rules-backup.json
```

---

## Support

For issues with the monitoring system:

1. Check the [Runbook](./MONITORING_RUNBOOK.md)
2. Review application logs
3. Contact the platform team
4. Create an issue in the repository

---

*Last Updated: January 8, 2024*