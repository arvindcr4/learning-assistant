# Learning Assistant - Monitoring & Observability System

A comprehensive monitoring and alerting system designed specifically for the Learning Assistant application, providing full-stack observability with actionable insights.

## 🎯 Overview

This monitoring system provides:

- **Application Performance Monitoring (APM)** with multiple provider support
- **Custom metrics** for learning system KPIs and business intelligence
- **Comprehensive health checks** for all critical components
- **Intelligent alerting** with escalation policies and multiple notification channels
- **Distributed tracing** for complex learning workflows
- **Business metrics monitoring** for educational effectiveness
- **Synthetic monitoring** for critical user journeys
- **Real-time dashboards** for different stakeholder roles

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │────│   Monitoring    │────│   Dashboards    │
│   Components    │    │     Layer       │    │  & Alerting     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ├── Health Checks       ├── Metrics Collection  ├── Grafana
         ├── APM Traces          ├── Alert Management    ├── Datadog
         ├── Custom Metrics      ├── Data Aggregation    ├── New Relic
         └── Request Monitoring  └── Synthetic Checks    └── Custom UI
```

## 🚀 Quick Start

### 1. Configuration

Copy the environment configuration:
```bash
cp .env.monitoring.example .env.local
```

Update the configuration with your actual values:

```env
# Enable monitoring
ENABLE_MONITORING=true

# Choose your APM provider
MONITORING_PROVIDER=prometheus  # or datadog, newrelic, sentry

# Configure alerting
ENABLE_ALERTING=true
SLACK_WEBHOOK_URL=your-slack-webhook
ALERT_EMAIL_FROM=alerts@your-domain.com
```

### 2. Install Dependencies

The monitoring system requires these additional packages:
```bash
npm install prom-client hot-shots newrelic nodemailer
npm install --save-dev @types/nodemailer
```

### 3. Start Monitoring

The monitoring system auto-initializes when enabled:

```typescript
import { monitoring } from '@/lib/monitoring';

// Monitoring starts automatically if ENABLE_MONITORING=true
// Access health status
const health = monitoring.getHealth();
console.log('System health:', health.healthy);
```

## 📊 Features

### Application Performance Monitoring (APM)

**Supported Providers:**
- Prometheus (with Grafana)
- Datadog
- New Relic
- Sentry (built-in)
- Custom metrics

**Key Metrics:**
- Request/response times
- Error rates and patterns
- Database query performance
- Memory and CPU usage
- Custom business metrics

### Health Checks

**Components Monitored:**
- Database connectivity
- External API services (Supabase, Tambo, Resend)
- Redis/caching layers
- System resources (memory, CPU, disk)
- Application-specific components
- Learning system algorithms

**Endpoints:**
- `GET /api/health` - Comprehensive health status
- `GET /api/metrics` - Prometheus metrics endpoint

### Business Metrics

**Learning System KPIs:**
- User engagement rates
- Learning effectiveness scores
- Content performance metrics
- Assessment completion rates
- Adaptive algorithm accuracy
- VARK learning style distribution

**Example Usage:**
```typescript
import { businessMetrics } from '@/lib/monitoring';

// Track user engagement
businessMetrics.trackUserEngagement(userId, sessionDuration, contentViews, interactions);

// Track learning effectiveness
businessMetrics.trackLearningEffectiveness(userId, contentId, completionRate, scoreImprovement, timeSpent);
```

### Intelligent Alerting

**Alert Categories:**
- Infrastructure (CPU, memory, disk)
- Performance (response times, throughput)
- Errors (error rates, exceptions)
- Security (failed logins, suspicious activity)
- Business (conversion rates, churn)
- Learning System (algorithm failures, low accuracy)

**Notification Channels:**
- Email (SMTP)
- Slack
- Webhooks
- PagerDuty
- Custom integrations

**Example Alert Configuration:**
```typescript
import { alertManager } from '@/lib/monitoring';

// Create custom alert
await alertManager.createAlert({
  title: 'High Response Time',
  message: 'API response time exceeded threshold',
  severity: 'warning',
  category: 'performance',
  metadata: { threshold: 2000, actual: 3500 }
});
```

### Synthetic Monitoring

**Critical User Journeys:**
- User registration flow
- Learning session completion
- API health checks
- Content delivery performance

**Configuration:**
```typescript
// Journeys run automatically based on schedule
// View results:
const journeyStats = syntheticMonitoring.getJourneyStats('user-registration');
console.log('Success rate:', journeyStats.successRate);
```

### Distributed Tracing

**Usage:**
```typescript
import { tracing } from '@/lib/monitoring';

// Start trace
const trace = tracing.startTrace('learning-session', { userId, contentType });

// Add spans for sub-operations
const span = tracing.addSpan(trace, 'content-recommendation', { algorithm: 'collaborative' });

// End operations
tracing.endSpan(span);
tracing.endTrace(trace, { success: true, duration: 1500 });
```

## 📈 Dashboards

### Technical Operations Dashboard
- System health overview
- Performance metrics
- Error tracking
- Infrastructure monitoring
- Real-time alerts

**File:** `monitoring/dashboards/technical-dashboard.json`

### Business Metrics Dashboard
- User engagement metrics
- Learning effectiveness
- Content performance
- Revenue and conversion tracking
- Retention analysis

**File:** `monitoring/dashboards/business-dashboard.json`

### Learning System Dashboard
- Adaptive algorithm performance
- Learning style distribution
- Assessment effectiveness
- Content recommendation accuracy
- AI model health

**File:** `monitoring/dashboards/learning-system-dashboard.json`

## 🔔 Alert Rules

### Infrastructure Alerts
```yaml
- alert: HighErrorRate
  expr: rate(learning_assistant_http_requests_total{status=~"5.."}[5m]) / rate(learning_assistant_http_requests_total[5m]) * 100 > 5
  for: 5m
  labels:
    severity: critical
```

### Business Alerts
```yaml
- alert: LowConversionRate
  expr: learning_assistant_conversion_rate < 10
  for: 30m
  labels:
    severity: warning
```

**Full Configuration:** `monitoring/alerts/alert-rules.yml`

## 🧪 Testing

Run comprehensive monitoring tests:

```bash
# Unit tests
npm run test __tests__/monitoring/monitoring-system.test.ts

# Integration tests
npm run test:integration

# Load testing
npm run test:performance
```

## 🔧 Configuration Reference

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ENABLE_MONITORING` | Enable/disable monitoring | `false` | Yes |
| `MONITORING_PROVIDER` | APM provider | `custom` | No |
| `MONITORING_SAMPLE_RATE` | Metrics sample rate | `1.0` | No |
| `ENABLE_ALERTING` | Enable alerting | `false` | No |
| `ALERT_EMAIL_FROM` | Alert sender email | - | No |
| `SLACK_WEBHOOK_URL` | Slack notifications | - | No |
| `DATADOG_API_KEY` | Datadog integration | - | No |
| `NEW_RELIC_API_KEY` | New Relic integration | - | No |

### APM Provider Configuration

#### Datadog
```env
MONITORING_PROVIDER=datadog
DATADOG_API_KEY=your-api-key
DATADOG_APP_KEY=your-app-key
DATADOG_SITE=datadoghq.com
```

#### New Relic
```env
MONITORING_PROVIDER=newrelic
NEW_RELIC_API_KEY=your-api-key
NEW_RELIC_ACCOUNT_ID=your-account-id
NEW_RELIC_REGION=US
```

#### Prometheus
```env
MONITORING_PROVIDER=prometheus
# Metrics available at /api/metrics
```

## 📚 Advanced Usage

### Custom Metrics

```typescript
import { metricsUtils } from '@/lib/metrics';

// Record custom counter
metricsUtils.recordCounter('custom_event_total', 1, {
  event_type: 'user_action',
  user_segment: 'premium'
});

// Record custom gauge
metricsUtils.recordGauge('custom_value', 42, {
  component: 'learning_engine'
});
```

### Custom Health Checks

```typescript
import { healthCheckManager } from '@/lib/health-checks';

// Add custom health check
const customCheck = async () => {
  // Your custom health logic
  return {
    name: 'custom-service',
    status: 'healthy' as const,
    responseTime: 100,
    message: 'Service is operational',
    timestamp: new Date().toISOString(),
  };
};

// Register and run
const results = await healthCheckManager.runAll();
```

### Request Monitoring Middleware

```typescript
import { monitoringMiddleware } from '@/middleware/monitoring';

// Apply to API routes (automatically included in middleware.ts)
export { monitoringMiddleware as middleware };
```

## 🔍 Troubleshooting

### Common Issues

1. **Metrics Not Appearing**
   - Check `ENABLE_MONITORING=true`
   - Verify APM provider configuration
   - Check logs for connection errors

2. **Alerts Not Firing**
   - Verify `ENABLE_ALERTING=true`
   - Check notification channel configuration
   - Review alert rule thresholds

3. **High Memory Usage**
   - Check trace cleanup in APM
   - Verify metrics retention settings
   - Monitor alert history size

### Debug Mode

Enable detailed logging:
```env
DEBUG=monitoring:*
LOG_LEVEL=debug
```

## 🤝 Contributing

When adding new monitoring features:

1. Add appropriate tests in `__tests__/monitoring/`
2. Update configuration documentation
3. Add dashboard panels if relevant
4. Create alert rules for new metrics
5. Update this README

## 📄 License

This monitoring system is part of the Learning Assistant project and follows the same license terms.

---

For support and questions, please refer to the main project documentation or create an issue in the repository.