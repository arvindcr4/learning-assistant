# Learning Assistant Monitoring & Alerting Runbook

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Components](#components)
4. [Health Checks](#health-checks)
5. [Alerting System](#alerting-system)
6. [SLA Monitoring](#sla-monitoring)
7. [Anomaly Detection](#anomaly-detection)
8. [Troubleshooting](#troubleshooting)
9. [Incident Response](#incident-response)
10. [Maintenance](#maintenance)

## Overview

The Learning Assistant monitoring system provides comprehensive observability through multi-provider APM, real-time alerting, SLA tracking, and ML-based anomaly detection. This runbook covers operational procedures, troubleshooting steps, and maintenance tasks.

### Key Features

- **Multi-Provider APM**: Prometheus, DataDog, New Relic, Sentry integration
- **Real-time Health Monitoring**: System, application, and dependency health checks
- **Learning Analytics**: Custom metrics for educational effectiveness
- **Intelligent Alerting**: Rule-based alerts with escalation procedures
- **SLA Tracking**: Uptime monitoring with 99.9% availability target
- **Anomaly Detection**: ML-based predictive alerting
- **Log Aggregation**: Centralized logging with pattern analysis

## Architecture

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Application   │  │   Health Checks │  │  Learning       │
│   Metrics       │  │   & Monitoring  │  │  Analytics      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
         ┌─────────────────────▼─────────────────────┐
         │          Multi-Provider APM               │
         │   ┌─────────────┐ ┌─────────────┐        │
         │   │ Prometheus  │ │  DataDog    │        │
         │   └─────────────┘ └─────────────┘        │
         │   ┌─────────────┐ ┌─────────────┐        │
         │   │ New Relic   │ │   Sentry    │        │
         │   └─────────────┘ └─────────────┘        │
         └─────────────────────┬─────────────────────┘
                               │
         ┌─────────────────────▼─────────────────────┐
         │         Alerting Engine                   │
         │  ┌─────────────┐ ┌─────────────┐         │
         │  │   Rules     │ │ Escalation  │         │
         │  │  Engine     │ │  Policies   │         │
         │  └─────────────┘ └─────────────┘         │
         └─────────────────────┬─────────────────────┘
                               │
         ┌─────────────────────▼─────────────────────┐
         │       Notification Channels               │
         │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐         │
         │  │Slack│ │Email│ │ SMS │ │P.Duty│         │
         │  └─────┘ └─────┘ └─────┘ └─────┘         │
         └───────────────────────────────────────────┘
```

## Components

### 1. Multi-Provider APM (`/src/lib/apm-providers.ts`)

**Purpose**: Unified metrics collection across multiple monitoring providers

**Configuration**:
```typescript
// Environment variables
PROMETHEUS_ENABLED=true
DATADOG_ENABLED=true
DATADOG_API_KEY=your_api_key
NEW_RELIC_ENABLED=true
NEW_RELIC_API_KEY=your_api_key
SENTRY_DSN=your_dsn
```

**Key Methods**:
- `recordMetric(name, value, type, tags)` - Record metrics
- `recordEvent(name, attributes)` - Record events
- `startTrace(name, metadata)` - Start distributed trace
- `healthCheck()` - Check provider health

### 2. Health Monitoring (`/src/lib/health-monitoring.ts`)

**Purpose**: Comprehensive health checks for all system components

**Health Checks**:
- Database connectivity
- Cache availability
- External API status
- File system access
- Memory/CPU usage
- Network connectivity
- APM provider health
- Application services

**Endpoints**:
- `GET /api/health` - Complete health status
- `GET /api/metrics` - Prometheus metrics
- `GET /api/monitoring/dashboard` - Dashboard data

### 3. Learning Metrics (`/src/lib/learning-metrics.ts`)

**Purpose**: Educational effectiveness and user engagement tracking

**Key Metrics**:
- Session duration and completion rates
- Content engagement and quiz performance
- User learning velocity and streaks
- Content effectiveness metrics
- Error tracking and performance issues

**Event Types**:
- `SESSION_START/END` - Learning session tracking
- `CONTENT_VIEW/COMPLETE` - Content interaction
- `QUIZ_START/COMPLETE` - Assessment tracking
- `ACHIEVEMENT_UNLOCK` - Gamification events

### 4. Alerting Engine (`/src/lib/alerting-engine.ts`)

**Purpose**: Intelligent alerting with escalation procedures

**Alert Rules**:
- High error rate (>5% for 5 minutes)
- Critical memory usage (>90% for 2 minutes)
- Database connection failure
- Slow response time (>2s P95 for 10 minutes)

**Notification Channels**:
- Slack (`#alerts`, `#critical-alerts`)
- Email (team distribution lists)
- PagerDuty (for critical alerts)
- Webhook (custom integrations)

### 5. SLA Tracker (`/src/lib/sla-tracker.ts`)

**Purpose**: Service level agreement monitoring and reporting

**SLA Targets**:
- **Availability**: 99.9% uptime
- **Response Time**: <2s for 95% of requests
- **Error Rate**: <1% of all requests

**Uptime Checks**:
- Health endpoint monitoring (60s interval)
- Application availability (5min interval)
- API endpoint functionality

### 6. Anomaly Detection (`/src/lib/anomaly-detection.ts`)

**Purpose**: ML-based anomaly detection with predictive capabilities

**Algorithms**:
- Statistical (Z-score, IQR, Modified Z-score)
- Seasonal Hybrid (trend + seasonal decomposition)
- Predictive modeling (linear regression forecasting)

**Detectors**:
- Response time anomalies (seasonal patterns)
- Error rate spikes (statistical analysis)
- Memory usage trends (predictive alerts)

## Health Checks

### Manual Health Check

```bash
# Check overall system health
curl -X GET http://localhost:3000/api/health

# Check specific service health
curl -X GET http://localhost:3000/api/health?service=database

# Get Prometheus metrics
curl -X GET http://localhost:3000/api/metrics?format=prometheus
```

### Health Check Response

```json
{
  "status": "healthy|degraded|unhealthy",
  "message": "System status description",
  "timestamp": "2024-01-08T12:00:00.000Z",
  "responseTime": 150,
  "healthScore": 95,
  "system": {
    "memory": "512MB",
    "cpu": "15%",
    "uptime": 3600,
    "nodeVersion": "v18.17.0"
  },
  "checks": [
    {
      "name": "database",
      "status": "healthy",
      "responseTime": 25,
      "message": "Database connection successful"
    }
  ]
}
```

### Troubleshooting Health Issues

#### Database Health Issues
```bash
# Check database connection
psql -h localhost -U username -d database_name -c "SELECT 1;"

# Check connection pool status
curl -X GET http://localhost:3000/api/health/database/metrics

# Restart database connection pool
# (Application restart may be required)
```

#### Memory Issues
```bash
# Check memory usage
free -h
ps aux --sort=-%mem | head -10

# Check Node.js heap usage
curl -X GET http://localhost:3000/api/health | jq '.system.memory'

# Force garbage collection (if enabled)
kill -USR2 <node_process_id>
```

#### Cache Issues
```bash
# Check Redis connection
redis-cli ping

# Check cache hit rates
redis-cli info stats | grep hit_rate

# Clear cache if needed
redis-cli flushdb
```

## Alerting System

### Alert Severity Levels

1. **LOW**: Informational alerts, no immediate action required
2. **MEDIUM**: Warning conditions, investigate during business hours
3. **HIGH**: Urgent issues, investigate within 30 minutes
4. **CRITICAL**: Service-affecting issues, immediate response required

### Escalation Procedures

#### Level 1 (0-15 minutes)
- Slack notification to `#alerts`
- Auto-retry failed operations
- Enable enhanced monitoring

#### Level 2 (15-30 minutes)
- Email to on-call engineer
- PagerDuty notification (critical alerts)
- Auto-scaling if applicable

#### Level 3 (30+ minutes)
- Escalate to senior engineer
- Create incident in incident management system
- Notify stakeholders

### Alert Configuration

```typescript
// Example alert rule
{
  id: 'high_error_rate',
  name: 'High Error Rate',
  condition: {
    metric: 'error_rate',
    operator: 'gt',
    threshold: 5,
    duration: 5,
    timeWindow: 10
  },
  escalation: {
    levels: [
      {
        level: 1,
        timeout: 15,
        channels: ['slack'],
        recipients: ['#alerts']
      },
      {
        level: 2,
        timeout: 30,
        channels: ['email', 'pagerduty'],
        recipients: ['oncall@company.com']
      }
    ]
  }
}
```

### Managing Alerts

```bash
# Acknowledge alert
curl -X POST http://localhost:3000/api/alerts/acknowledge \
  -H "Content-Type: application/json" \
  -d '{"alertId": "alert_123", "acknowledgedBy": "engineer@company.com"}'

# Resolve alert
curl -X POST http://localhost:3000/api/alerts/resolve \
  -H "Content-Type: application/json" \
  -d '{"alertId": "alert_123"}'

# Suppress alert temporarily
curl -X POST http://localhost:3000/api/alerts/suppress \
  -H "Content-Type: application/json" \
  -d '{"alertId": "alert_123", "duration": 60, "reason": "Planned maintenance"}'
```

## SLA Monitoring

### SLA Targets

| Metric | Target | Warning Threshold | Critical Threshold |
|--------|---------|-------------------|-------------------|
| Availability | 99.9% | 99.5% | 99.0% |
| Response Time (P95) | <2000ms | >1600ms | >2400ms |
| Error Rate | <1% | >0.8% | >1.5% |

### SLA Reports

```bash
# Generate SLA report for last 30 days
curl -X GET "http://localhost:3000/api/sla/report?period=30d"

# Get current SLA status
curl -X GET http://localhost:3000/api/sla/status

# Create incident for SLA breach
curl -X POST http://localhost:3000/api/incidents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Service Degradation",
    "severity": "high",
    "affectedServices": ["learning-assistant"],
    "impact": "Users experiencing slow response times"
  }'
```

### SLA Breach Response

1. **Immediate Response** (0-2 minutes):
   - Automated alerts sent to on-call
   - Health checks intensified
   - Auto-scaling triggered if applicable

2. **Investigation** (2-15 minutes):
   - Check system metrics and logs
   - Identify root cause
   - Implement immediate fixes

3. **Communication** (15-30 minutes):
   - Update status page
   - Notify affected customers
   - Post updates to incident channel

4. **Resolution & Follow-up**:
   - Implement permanent fix
   - Conduct post-incident review
   - Update monitoring/alerting as needed

## Anomaly Detection

### Anomaly Types

1. **Point Anomalies**: Single unusual data point
2. **Contextual Anomalies**: Unusual in specific context
3. **Collective Anomalies**: Group of points forming anomaly
4. **Seasonal Anomalies**: Deviation from seasonal patterns

### Detector Configuration

```typescript
// Response time anomaly detector
{
  id: 'response_time_anomaly',
  algorithm: 'seasonal_hybrid',
  sensitivity: 0.7,
  seasonality: {
    enabled: true,
    period: 24, // hourly pattern
  },
  thresholds: {
    low: 0.3,
    medium: 0.5,
    high: 0.7,
    critical: 0.9
  }
}
```

### Managing Anomalies

```bash
# Get recent anomalies
curl -X GET "http://localhost:3000/api/anomalies?timeRange=24h"

# Get anomalies by severity
curl -X GET "http://localhost:3000/api/anomalies?severity=critical"

# Get predictions for next hour
curl -X GET "http://localhost:3000/api/anomalies/predict?detector=response_time&horizon=60"

# Update detector sensitivity
curl -X PUT http://localhost:3000/api/anomalies/detectors/response_time \
  -H "Content-Type: application/json" \
  -d '{"sensitivity": 0.8}'
```

## Troubleshooting

### Common Issues

#### High Response Times

**Symptoms**: P95 response time >2000ms, slow user experience

**Investigation**:
```bash
# Check current response times
curl -X GET http://localhost:3000/api/metrics | grep response_time

# Check database query performance
curl -X GET http://localhost:3000/api/health/database/slow-queries

# Check memory usage
curl -X GET http://localhost:3000/api/health | jq '.system.memory'

# Check active connections
curl -X GET http://localhost:3000/api/health/database/connections
```

**Resolution**:
1. Scale up application instances
2. Optimize slow database queries
3. Enable/optimize caching
4. Restart application if memory leak suspected

#### High Error Rate

**Symptoms**: Error rate >1%, 5xx responses increasing

**Investigation**:
```bash
# Check error distribution
curl -X GET http://localhost:3000/api/logs/search \
  -G -d 'level=error' -d 'timeRange=1h'

# Check recent deployments
git log --oneline -10

# Check external service health
curl -X GET http://localhost:3000/api/health/external
```

**Resolution**:
1. Rollback recent deployment if correlated
2. Check external service dependencies
3. Increase error handling/retries
4. Scale infrastructure if needed

#### Database Connectivity Issues

**Symptoms**: Database health checks failing, connection timeouts

**Investigation**:
```bash
# Test direct database connection
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT NOW();"

# Check connection pool status
curl -X GET http://localhost:3000/api/health/database/pool

# Check database server status
# (depends on your database setup)
```

**Resolution**:
1. Restart application to reset connection pool
2. Check database server health
3. Verify network connectivity
4. Check database connection limits

#### Memory Leaks

**Symptoms**: Memory usage continuously increasing, OOM errors

**Investigation**:
```bash
# Monitor memory usage over time
curl -X GET http://localhost:3000/api/metrics | grep memory_usage

# Check for memory leaks in logs
curl -X GET http://localhost:3000/api/logs/search \
  -G -d 'query=memory' -d 'level=error'

# Generate heap dump (if enabled)
kill -USR2 <node_process_id>
```

**Resolution**:
1. Restart application immediately
2. Analyze heap dump for memory leaks
3. Review recent code changes
4. Implement memory monitoring alerts

## Incident Response

### Incident Severity Levels

- **P1 (Critical)**: Complete service outage
- **P2 (High)**: Major functionality impacted
- **P3 (Medium)**: Minor functionality impacted
- **P4 (Low)**: Cosmetic issues or minor bugs

### Incident Response Process

#### 1. Detection & Initial Response (0-5 minutes)
- Alert received via monitoring system
- On-call engineer acknowledges alert
- Initial assessment of impact
- Create incident if service-affecting

#### 2. Investigation & Diagnosis (5-15 minutes)
- Check health dashboards and metrics
- Review recent changes and deployments
- Identify potential root cause
- Engage additional team members if needed

#### 3. Mitigation & Resolution (15-60 minutes)
- Implement immediate fixes
- Rollback changes if necessary
- Scale resources if applicable
- Monitor for improvement

#### 4. Communication & Updates
- Update status page
- Notify stakeholders
- Provide regular updates
- Post-incident communication

#### 5. Post-Incident Review
- Document timeline and actions taken
- Identify root cause
- Create action items for prevention
- Update monitoring/alerting as needed

### Incident Commands

```bash
# Create new incident
curl -X POST http://localhost:3000/api/incidents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Database Connection Issues",
    "severity": "high",
    "affectedServices": ["learning-assistant"],
    "impact": "Users unable to access learning content",
    "creator": "oncall@company.com"
  }'

# Update incident
curl -X PUT http://localhost:3000/api/incidents/incident_123 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "investigating",
    "update": "Identified database connection pool exhaustion",
    "author": "engineer@company.com"
  }'

# Resolve incident
curl -X PUT http://localhost:3000/api/incidents/incident_123 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "resolved",
    "resolution": "Increased connection pool size and restarted application",
    "author": "engineer@company.com"
  }'
```

## Maintenance

### Daily Tasks
- [ ] Review overnight alerts and incidents
- [ ] Check SLA compliance dashboard
- [ ] Monitor error rates and response times
- [ ] Review anomaly detection results

### Weekly Tasks
- [ ] Generate and review SLA reports
- [ ] Analyze trending metrics and patterns
- [ ] Review and tune alert thresholds
- [ ] Update runbooks based on incidents

### Monthly Tasks
- [ ] Comprehensive health check of monitoring infrastructure
- [ ] Review and update escalation procedures
- [ ] Performance tune anomaly detection models
- [ ] Conduct disaster recovery testing

### Configuration Updates

```bash
# Update alert thresholds
curl -X PUT http://localhost:3000/api/alerts/rules/high_error_rate \
  -H "Content-Type: application/json" \
  -d '{"condition": {"threshold": 3}}'

# Update SLA targets
curl -X PUT http://localhost:3000/api/sla/targets \
  -H "Content-Type: application/json" \
  -d '{"availability": 99.95, "responseTime": 1500}'

# Retrain anomaly detection models
curl -X POST http://localhost:3000/api/anomalies/retrain

# Update uptime check intervals
curl -X PUT http://localhost:3000/api/uptime/checks/health_check \
  -H "Content-Type: application/json" \
  -d '{"interval": 30}'
```

### Monitoring System Health

```bash
# Check monitoring system metrics
curl -X GET http://localhost:3000/api/monitoring/health

# Verify all providers are healthy
curl -X GET http://localhost:3000/api/apm/providers/health

# Check log aggregation status
curl -X GET http://localhost:3000/api/logs/health

# Verify alerting system functionality
curl -X POST http://localhost:3000/api/alerts/test \
  -H "Content-Type: application/json" \
  -d '{"type": "test", "severity": "low"}'
```

---

## Emergency Contacts

- **On-Call Engineer**: [PagerDuty rotation]
- **Platform Team**: platform-team@company.com
- **DevOps Team**: devops@company.com
- **Infrastructure Provider**: [Provider support channels]

## Additional Resources

- [Monitoring Dashboard](http://localhost:3000/api/monitoring/dashboard)
- [Health Check Status](http://localhost:3000/api/health)
- [SLA Reports](http://localhost:3000/api/sla/reports)
- [Incident Management](http://localhost:3000/api/incidents)

---

*Last Updated: January 8, 2024*
*Version: 1.0*