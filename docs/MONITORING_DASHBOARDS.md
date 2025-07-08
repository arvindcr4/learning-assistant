# Monitoring Dashboards Documentation

## Overview

This document provides comprehensive guidance on the Learning Assistant's advanced monitoring dashboard system. The system includes role-specific dashboards, intelligent alerting, real-time data visualization, and embeddable widgets for different stakeholder needs.

## Table of Contents

1. [Dashboard Architecture](#dashboard-architecture)
2. [Dashboard Types](#dashboard-types)
3. [Installation & Setup](#installation--setup)
4. [Configuration](#configuration)
5. [Role-Based Access](#role-based-access)
6. [Intelligent Alerting](#intelligent-alerting)
7. [Embeddable Widgets](#embeddable-widgets)
8. [API Integration](#api-integration)
9. [Mobile Support](#mobile-support)
10. [Troubleshooting](#troubleshooting)
11. [Best Practices](#best-practices)

## Dashboard Architecture

The monitoring system is built on a modern, scalable architecture that supports:

- **Multi-tenant dashboards** for different stakeholder roles
- **Real-time data streaming** with WebSocket connections
- **Intelligent alerting** with machine learning-based thresholds
- **Predictive analytics** for proactive monitoring
- **Mobile-responsive design** for on-call engineers
- **API-first approach** for custom integrations

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Layer                           │
├─────────────────────────────────────────────────────────────┤
│  • React Dashboard Components                               │
│  • Embeddable Widgets                                       │
│  • Real-time Chart Libraries                                │
│  • Mobile-responsive UI                                     │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    API Layer                                │
├─────────────────────────────────────────────────────────────┤
│  • Dashboard API (/src/lib/dashboard-api.ts)               │
│  • WebSocket Real-time Updates                             │
│  • Authentication & Authorization                          │
│  • Data Transformation & Aggregation                       │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                   Data Sources                              │
├─────────────────────────────────────────────────────────────┤
│  • Prometheus Metrics                                       │
│  • Application Logs                                         │
│  • Business Analytics                                       │
│  • Security Events                                          │
│  • Learning Analytics                                       │
└─────────────────────────────────────────────────────────────┘
```

## Dashboard Types

### 1. Technical Operations Dashboard
**File:** `monitoring/dashboards/technical-operations.json`

**Target Audience:** DevOps, SRE, Engineering teams

**Key Features:**
- Real-time system health monitoring
- Performance metrics with predictive analytics
- Infrastructure resource utilization
- Database performance tracking
- Network and I/O monitoring
- Active alerts and incident management
- SLA tracking and availability metrics

**Key Panels:**
- System Health Overview
- Response Time P95/P99
- Error Rate Analysis
- Memory & CPU Usage
- Database Performance
- Network I/O
- Alert Status Table
- Predictive Resource Forecasting

### 2. Business Intelligence Dashboard
**File:** `monitoring/dashboards/business-intelligence.json`

**Target Audience:** Executives, Product Managers, Business Analysts

**Key Features:**
- Revenue tracking and forecasting
- User growth metrics
- Conversion funnel analysis
- Geographic distribution
- Feature adoption tracking
- Customer satisfaction metrics
- Marketing campaign ROI

**Key Panels:**
- Revenue KPIs
- User Growth Metrics
- Conversion Funnel
- Geographic User Distribution
- Feature Usage Analytics
- NPS & Satisfaction Scores
- Cohort Analysis
- Marketing Campaign Performance

### 3. Learning Analytics Dashboard
**File:** `monitoring/dashboards/learning-analytics.json`

**Target Audience:** Educators, Learning Specialists, Content Creators

**Key Features:**
- Learning effectiveness tracking
- Student progress monitoring
- Adaptive learning performance
- Content effectiveness analysis
- Competency gap identification
- AI tutor interaction metrics

**Key Panels:**
- Learning Effectiveness Overview
- Student Engagement Metrics
- Progress Tracking
- Assessment Performance
- Learning Style Distribution
- Time-to-Mastery Analysis
- Spaced Repetition Effectiveness
- AI Tutor Performance

### 4. Security Monitoring Dashboard
**File:** `monitoring/dashboards/security-monitoring.json`

**Target Audience:** Security Teams, CISO, Compliance Officers

**Key Features:**
- Threat detection and analysis
- Security incident tracking
- Vulnerability management
- Compliance monitoring
- Authentication events
- Geographic attack distribution

**Key Panels:**
- Security Status Overview
- Active Threats
- Failed Login Attempts
- Attack Source Mapping
- Vulnerability Assessment
- Incident Response Tracking
- Compliance Metrics
- Security Controls Effectiveness

## Installation & Setup

### Prerequisites

1. **Node.js 18+** with npm/yarn
2. **Docker & Docker Compose** for monitoring stack
3. **Prometheus** for metrics collection
4. **Grafana** for dashboard visualization
5. **PostgreSQL** for data storage

### Quick Start

1. **Clone and install dependencies:**
```bash
git clone https://github.com/your-org/learning-assistant.git
cd learning-assistant
npm install
```

2. **Set up monitoring stack:**
```bash
# Start monitoring services
docker-compose -f monitoring/docker-compose.monitoring.yml up -d

# Wait for services to be ready
sleep 30

# Import dashboards
npm run import-dashboards
```

3. **Configure environment variables:**
```bash
# Copy environment template
cp .env.example .env.local

# Configure monitoring settings
DASHBOARD_API_URL=http://localhost:9090
GRAFANA_URL=http://localhost:3000
PROMETHEUS_URL=http://localhost:9090
ALERTMANAGER_URL=http://localhost:9093
```

4. **Start the application:**
```bash
npm run dev
```

### Advanced Setup

For production environments, additional configuration is required:

1. **SSL/TLS Configuration**
2. **Authentication Setup**
3. **Data Retention Policies**
4. **Backup and Recovery**
5. **High Availability Setup**

See [Production Deployment Guide](./PRODUCTION_DEPLOYMENT.md) for detailed instructions.

## Configuration

### Dashboard Configuration

Dashboards are stored as JSON files in the `monitoring/dashboards/` directory. Each dashboard follows the Grafana dashboard schema with Learning Assistant-specific extensions.

#### Dashboard Structure

```json
{
  "dashboard": {
    "id": "unique-dashboard-id",
    "title": "Dashboard Title",
    "description": "Dashboard description",
    "tags": ["tag1", "tag2"],
    "refresh": "30s",
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "variables": [...],
    "panels": [...],
    "annotations": [...]
  }
}
```

#### Panel Types

| Panel Type | Use Case | Configuration |
|------------|----------|---------------|
| `stat` | Single value metrics | Value, thresholds, units |
| `timeseries` | Time-based data | Multiple queries, legends |
| `table` | Tabular data | Columns, sorting, filtering |
| `gauge` | Progress indicators | Min/max values, thresholds |
| `heatmap` | Density visualization | Buckets, color schemes |
| `geomap` | Geographic data | Map layers, markers |

#### Variables

Dashboard variables enable dynamic filtering and customization:

```json
{
  "name": "environment",
  "type": "query",
  "query": "label_values(up{job=\"learning-assistant\"}, environment)",
  "includeAll": true,
  "multi": true
}
```

### Alert Configuration

Intelligent alerting is configured in `monitoring/alerts/intelligent-alerting.yml`:

#### Alert Types

1. **Static Thresholds** - Fixed values
2. **Dynamic Thresholds** - Based on historical data
3. **Anomaly Detection** - ML-based pattern recognition
4. **Predictive Alerts** - Forecast-based warnings

#### Example Alert Rule

```yaml
- alert: DynamicHighErrorRate
  expr: |
    (rate(learning_assistant_http_requests_total{status=~"5.."}[5m]) / 
     rate(learning_assistant_http_requests_total[5m]) * 100) > 
    (quantile_over_time(0.95, 
      rate(learning_assistant_http_requests_total{status=~"5.."}[5m]) / 
      rate(learning_assistant_http_requests_total[5m]) * 100
    [7d]) * 1.5)
  for: 5m
  labels:
    severity: critical
    category: infrastructure
    alert_type: dynamic
```

## Role-Based Access

### Authentication & Authorization

The system supports multiple authentication methods:

1. **OAuth 2.0** with Google, GitHub, Microsoft
2. **SAML 2.0** for enterprise SSO
3. **JWT tokens** for API access
4. **API keys** for service accounts

### Role Definitions

| Role | Permissions | Dashboard Access |
|------|-------------|------------------|
| `executive` | Business metrics only | Business Intelligence |
| `technical` | Infrastructure & app metrics | Technical Operations |
| `security` | Security events & compliance | Security Monitoring |
| `learning` | Educational analytics | Learning Analytics |
| `admin` | All dashboards & configuration | All Dashboards |

### Access Control Implementation

```typescript
// Role-based dashboard filtering
export const getDashboardsForRole = (role: StakeholderRole): Dashboard[] => {
  return dashboards.filter(dashboard => 
    dashboard.tags.includes(role) || 
    hasPermission(role, dashboard.permissions)
  );
};
```

## Intelligent Alerting

### Machine Learning Features

1. **Adaptive Thresholds**
   - Automatically adjust based on historical patterns
   - Reduce false positives
   - Account for seasonal variations

2. **Anomaly Detection**
   - Statistical analysis of time series data
   - Pattern recognition for unusual behavior
   - Multi-dimensional anomaly detection

3. **Predictive Alerts**
   - Forecast potential issues 1-2 hours ahead
   - Proactive capacity planning
   - Early warning system

### Alert Escalation

```yaml
# Escalation chain
routes:
  - match:
      severity: critical
    receiver: 'immediate-response'
    group_wait: 0s
    repeat_interval: 5m
  - match:
      severity: warning
    receiver: 'standard-response'
    group_wait: 2m
    repeat_interval: 1h
```

### Notification Channels

1. **Email** - Standard alerts and summaries
2. **Slack/Teams** - Real-time team notifications
3. **PagerDuty** - Critical incident escalation
4. **Webhooks** - Custom integrations
5. **SMS** - Emergency notifications

## Embeddable Widgets

### Widget System Architecture

The embeddable widget system allows dashboard panels to be embedded in:

- Internal applications
- Customer-facing dashboards
- Executive reports
- Mobile applications

### Widget Types

```typescript
export type WidgetType = 
  | 'stat'           // Single metric display
  | 'timeseries'     // Time-based charts
  | 'gauge'          // Progress indicators
  | 'table'          // Data tables
  | 'alert-status'   // Alert summaries
  | 'trend-indicator'; // Trend arrows
```

### Usage Example

```tsx
import { MonitoringWidget, STAKEHOLDER_WIDGETS } from '@/components/MonitoringWidget';

// Single widget
<MonitoringWidget 
  config={{
    id: 'response-time',
    title: 'Response Time P95',
    type: 'stat',
    size: 'medium',
    query: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))',
    refreshInterval: 30
  }}
/>

// Role-based dashboard
<WidgetDashboard role="executive" />
```

### Widget Configuration

```typescript
interface MetricWidgetConfig {
  id: string;
  title: string;
  type: 'stat' | 'gauge' | 'progress-bar';
  size: 'small' | 'medium' | 'large';
  query: string;
  refreshInterval?: number;
  thresholds?: {
    low: number;
    medium: number;
    high: number;
  };
  format?: 'number' | 'percentage' | 'currency' | 'time';
}
```

## API Integration

### Dashboard API

The Dashboard API provides programmatic access to all monitoring functionality:

```typescript
import { dashboardAPI } from '@/lib/dashboard-api';

// Execute queries
const metrics = await dashboardAPI.query(
  'up{job="learning-assistant"}'
);

// Get dashboard data
const dashboard = await dashboardAPI.getDashboard('technical-operations');

// Real-time panel data
const panelData = await dashboardAPI.getPanelData(
  'panel-1',
  [{ expr: 'rate(http_requests_total[5m])', refId: 'A' }],
  { from: 'now-1h', to: 'now' }
);
```

### WebSocket Integration

Real-time updates are provided via WebSocket connections:

```typescript
// Subscribe to real-time updates
const ws = new WebSocket('ws://localhost:3000/api/realtime');

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  updateWidget(update.widgetId, update.data);
};
```

### REST API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dashboards` | GET | List all dashboards |
| `/api/dashboards/:id` | GET | Get specific dashboard |
| `/api/dashboards` | POST | Create dashboard |
| `/api/dashboards/:id` | PUT | Update dashboard |
| `/api/dashboards/:id` | DELETE | Delete dashboard |
| `/api/query` | POST | Execute metric query |
| `/api/alerts` | GET | Get active alerts |
| `/api/health` | GET | System health check |

## Mobile Support

### Responsive Design

All dashboards are optimized for mobile devices:

1. **Collapsible panels** for small screens
2. **Touch-friendly controls** for navigation
3. **Simplified layouts** for mobile viewing
4. **Offline capability** for critical metrics

### Mobile-Specific Features

```json
{
  "id": "mobile-executive-summary",
  "title": "Mobile - Executive KPIs",
  "type": "row",
  "collapsed": true,
  "gridPos": { "h": 1, "w": 24, "x": 0, "y": 38 },
  "panels": [...]
}
```

### Progressive Web App (PWA)

The dashboard system supports PWA features:

- **Offline access** to cached dashboards
- **Push notifications** for critical alerts
- **Home screen installation**
- **Background sync** for data updates

## Troubleshooting

### Common Issues

#### 1. Dashboard Not Loading

**Symptoms:** Dashboard shows loading spinner indefinitely

**Solutions:**
```bash
# Check service status
docker-compose ps

# Verify Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check application logs
docker-compose logs learning-assistant
```

#### 2. Missing Metrics

**Symptoms:** Panels show "No data available"

**Solutions:**
1. Verify metric names in Prometheus
2. Check time range settings
3. Validate query syntax
4. Review application instrumentation

#### 3. Alert Not Firing

**Symptoms:** Expected alerts are not triggering

**Solutions:**
```bash
# Check alert rules
curl http://localhost:9090/api/v1/rules

# Validate AlertManager configuration
curl http://localhost:9093/api/v1/status

# Test alert rule manually
curl -G http://localhost:9090/api/v1/query \
  --data-urlencode 'query=ALERTS{alertname="YourAlert"}'
```

#### 4. Performance Issues

**Symptoms:** Slow dashboard loading or high resource usage

**Solutions:**
1. Optimize query complexity
2. Adjust refresh intervals
3. Implement query caching
4. Use recording rules for expensive queries

### Debug Mode

Enable debug mode for detailed logging:

```bash
export DEBUG=dashboard:*
npm run dev
```

### Log Analysis

Dashboard API logs are structured for easy analysis:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "error",
  "message": "Dashboard query failed",
  "context": {
    "dashboardId": "technical-operations",
    "panelId": "response-time",
    "query": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
    "error": "connection timeout"
  }
}
```

## Best Practices

### Dashboard Design

1. **Information Hierarchy**
   - Most critical metrics at the top
   - Related metrics grouped together
   - Consistent color schemes

2. **Performance Optimization**
   - Limit number of panels per dashboard
   - Use appropriate refresh intervals
   - Optimize Prometheus queries

3. **User Experience**
   - Clear panel titles and descriptions
   - Intuitive navigation
   - Responsive design for all devices

### Metric Collection

1. **Instrumentation Strategy**
   - Use standard metric types (counter, gauge, histogram)
   - Follow Prometheus naming conventions
   - Include relevant labels

2. **Data Retention**
   - Configure appropriate retention periods
   - Use recording rules for long-term storage
   - Archive historical data

### Alert Management

1. **Alert Design**
   - Clear, actionable alert messages
   - Appropriate severity levels
   - Runbook links for resolution

2. **Noise Reduction**
   - Use intelligent thresholds
   - Implement alert suppression
   - Regular alert rule review

### Security

1. **Access Control**
   - Implement role-based permissions
   - Regular access reviews
   - API key rotation

2. **Data Protection**
   - Encrypt sensitive metrics
   - Audit dashboard access
   - Secure communication channels

### Maintenance

1. **Regular Tasks**
   - Dashboard performance review
   - Alert rule optimization
   - User feedback collection

2. **Updates & Upgrades**
   - Test changes in staging environment
   - Version control for dashboard configurations
   - Rollback procedures

## Support & Resources

### Documentation Links

- [Grafana Documentation](https://grafana.com/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [AlertManager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)

### Community Resources

- [Learning Assistant Discord](https://discord.gg/learning-assistant)
- [GitHub Issues](https://github.com/your-org/learning-assistant/issues)
- [Stack Overflow Tag](https://stackoverflow.com/questions/tagged/learning-assistant)

### Getting Help

For technical support:

1. **Check this documentation** for common solutions
2. **Search existing issues** on GitHub
3. **Create a detailed issue** with:
   - Dashboard configuration
   - Error messages
   - Steps to reproduce
   - Expected vs. actual behavior

### Contributing

We welcome contributions to improve the monitoring system:

1. **Dashboard Templates** - New dashboard designs
2. **Widget Components** - Additional visualization types
3. **Alert Rules** - Intelligent alerting improvements
4. **Documentation** - Improvements and examples

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

---

**Last Updated:** January 2025  
**Version:** 1.0.0  
**Maintainer:** Learning Assistant Team