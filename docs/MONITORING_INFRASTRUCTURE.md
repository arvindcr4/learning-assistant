# Comprehensive Monitoring Infrastructure

## Overview

This document describes the comprehensive monitoring and observability infrastructure for the Learning Assistant application. The infrastructure provides unified monitoring across multiple cloud providers with automated alerting, incident response, and optimization capabilities.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Components](#components)
3. [Deployment](#deployment)
4. [Configuration](#configuration)
5. [Monitoring Targets](#monitoring-targets)
6. [Alerting](#alerting)
7. [Dashboards](#dashboards)
8. [SLI/SLO Monitoring](#slislo-monitoring)
9. [Cost Monitoring](#cost-monitoring)
10. [Troubleshooting](#troubleshooting)
11. [Maintenance](#maintenance)

## Architecture Overview

The monitoring infrastructure is built on Kubernetes and consists of several integrated components:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Monitoring Infrastructure                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │ Prometheus  │  │   Grafana   │  │ AlertManager│  │  Jaeger │ │
│  │   Metrics   │  │ Dashboards  │  │   Alerts    │  │ Tracing │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │Elasticsearch│  │   Logstash  │  │   Kibana    │  │OpenCost │ │
│  │    Logs     │  │ Processing  │  │ Log Analysis│  │ Costs   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │  Blackbox   │  │   Sloth     │  │ Lighthouse  │  │Victoria │ │
│  │ Monitoring  │  │ SLO Engine  │  │  Web Vitals │  │Metrics  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Key Features

- **Multi-Cloud Support**: Monitors resources across AWS, GCP, and Azure
- **High Availability**: Redundant components with automatic failover
- **Scalable Architecture**: Horizontally scalable components
- **Unified Observability**: Metrics, logs, and traces in one platform
- **Automated Alerting**: Intelligent alerting with escalation policies
- **Cost Optimization**: Real-time cost monitoring and optimization
- **SLO Management**: Service Level Objective tracking and reporting
- **Synthetic Monitoring**: User experience and uptime monitoring

## Components

### Core Monitoring Stack

#### Prometheus
- **Purpose**: Metrics collection and storage
- **Configuration**: `/infrastructure/monitoring/prometheus.tf`
- **Storage**: Victoria Metrics for long-term retention
- **HA Setup**: 2+ replicas with shared storage
- **Retention**: Configurable (default: 30 days)

#### Grafana
- **Purpose**: Visualization and dashboards
- **Configuration**: `/infrastructure/monitoring/grafana.tf`
- **Features**: 
  - Custom dashboards for all services
  - Alerting integration
  - Multi-datasource support
  - User management and RBAC

#### AlertManager
- **Purpose**: Alert routing and notification
- **Configuration**: `/infrastructure/monitoring/alertmanager.tf`
- **Channels**: Email, Slack, PagerDuty
- **Features**:
  - Intelligent routing
  - Alert grouping and silencing
  - Escalation policies

### Distributed Tracing

#### Jaeger
- **Purpose**: Distributed tracing and request flow analysis
- **Configuration**: `/infrastructure/monitoring/jaeger.tf`
- **Storage**: Elasticsearch backend
- **Features**:
  - OpenTelemetry compatibility
  - Service dependency mapping
  - Performance bottleneck identification

#### OpenTelemetry Collector
- **Purpose**: Trace collection and processing
- **Configuration**: Deployed with Jaeger
- **Protocols**: OTLP, Jaeger, Zipkin

### Log Management

#### Elasticsearch
- **Purpose**: Log storage and indexing
- **Configuration**: `/infrastructure/monitoring/elasticsearch.tf`
- **Architecture**: Multi-node cluster with dedicated roles
- **Features**:
  - Full-text search
  - Real-time indexing
  - Data lifecycle management

#### Logstash
- **Purpose**: Log processing and enrichment
- **Configuration**: Deployed with Elasticsearch
- **Features**:
  - Multi-format parsing
  - Data transformation
  - Output routing

#### Kibana
- **Purpose**: Log visualization and analysis
- **Configuration**: Deployed with Elasticsearch
- **Features**:
  - Interactive dashboards
  - Search and filtering
  - Machine learning capabilities

#### Filebeat
- **Purpose**: Log shipping from Kubernetes nodes
- **Deployment**: DaemonSet on all nodes
- **Features**:
  - Automatic container log discovery
  - Kubernetes metadata enrichment
  - Multiline log handling

### Synthetic Monitoring

#### Blackbox Exporter
- **Purpose**: External service monitoring
- **Configuration**: `/infrastructure/monitoring/synthetic.tf`
- **Targets**: All public endpoints
- **Checks**: HTTP, HTTPS, DNS, TCP

#### Lighthouse CI
- **Purpose**: Web performance monitoring
- **Configuration**: Deployed with synthetic monitoring
- **Metrics**: Core Web Vitals, performance scores
- **Reports**: Automated performance reports

### Cost Monitoring

#### OpenCost
- **Purpose**: Kubernetes cost allocation
- **Configuration**: `/infrastructure/monitoring/cost-monitoring.tf`
- **Features**:
  - Resource cost attribution
  - Team/project cost allocation
  - Historical cost tracking

#### Cloud Cost Exporters
- **Purpose**: Multi-cloud cost monitoring
- **Supported**: GCP, AWS, Azure
- **Features**:
  - Real-time cost data
  - Budget alerts
  - Cost optimization recommendations

### SLO Monitoring

#### Sloth
- **Purpose**: SLO definition and tracking
- **Configuration**: `/infrastructure/monitoring/slo.tf`
- **Features**:
  - Multi-window, multi-burn alerts
  - Error budget tracking
  - SLO reporting

## Deployment

### Prerequisites

1. **Tools Required**:
   ```bash
   terraform >= 1.0.0
   kubectl >= 1.24.0
   helm >= 3.8.0
   gcloud >= 400.0.0
   ```

2. **Permissions**:
   - Kubernetes cluster admin access
   - Cloud provider permissions for resource creation
   - DNS management for ingress endpoints

3. **Environment Variables**:
   ```bash
   export PROJECT_ID="your-gcp-project"
   export DOMAIN_NAME="monitoring.example.com"
   export NOTIFICATION_EMAIL="alerts@example.com"
   export SLACK_WEBHOOK_URL="https://hooks.slack.com/..."
   export PAGERDUTY_INTEGRATION_KEY="your-key"
   ```

### Quick Start

1. **Validate Configuration**:
   ```bash
   ./scripts/monitoring/setup-monitoring.sh \
     --project-id your-project \
     --domain-name monitoring.example.com \
     --notification-email alerts@example.com \
     validate
   ```

2. **Plan Deployment**:
   ```bash
   ./scripts/monitoring/setup-monitoring.sh \
     --environment prod \
     --project-id your-project \
     plan
   ```

3. **Deploy Infrastructure**:
   ```bash
   ./scripts/monitoring/setup-monitoring.sh \
     --environment prod \
     --project-id your-project \
     apply
   ```

4. **Check Status**:
   ```bash
   ./scripts/monitoring/setup-monitoring.sh status
   ```

### Manual Deployment

If you prefer manual deployment:

1. **Initialize Terraform**:
   ```bash
   cd infrastructure/monitoring
   terraform init
   ```

2. **Create Variables File**:
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars with your values
   ```

3. **Plan and Apply**:
   ```bash
   terraform plan -var-file=terraform.tfvars
   terraform apply -var-file=terraform.tfvars
   ```

## Configuration

### Environment-Specific Settings

#### Development
```hcl
environment = "dev"
high_availability = false
retention_days = 7
replica_count = 1
```

#### Staging
```hcl
environment = "staging"
high_availability = true
retention_days = 15
replica_count = 2
```

#### Production
```hcl
environment = "prod"
high_availability = true
retention_days = 30
replica_count = 3
```

### Resource Allocation

#### Small Environment (Dev)
- Prometheus: 2Gi memory, 1 CPU
- Grafana: 512Mi memory, 0.5 CPU
- Elasticsearch: 4Gi memory, 2 CPU
- Storage: 50Gi per component

#### Medium Environment (Staging)
- Prometheus: 4Gi memory, 2 CPU
- Grafana: 1Gi memory, 1 CPU
- Elasticsearch: 8Gi memory, 4 CPU
- Storage: 100Gi per component

#### Large Environment (Production)
- Prometheus: 8Gi memory, 4 CPU
- Grafana: 2Gi memory, 2 CPU
- Elasticsearch: 16Gi memory, 8 CPU
- Storage: 200Gi per component

### Security Configuration

#### Authentication
- Grafana: Admin user with strong password
- Prometheus: Basic auth protection
- Kibana: Elasticsearch security integration
- AlertManager: Basic auth protection

#### Network Security
- All services behind ingress with TLS
- Network policies restricting inter-pod communication
- Service accounts with minimal permissions

#### Data Protection
- Encryption at rest for all storage
- TLS for all inter-service communication
- Regular security updates

## Monitoring Targets

### Application Metrics
- **Learning Assistant API**: Response times, error rates, throughput
- **Database**: Query performance, connection pool, replication lag
- **Cache**: Hit rates, memory usage, eviction rates
- **Authentication**: Login rates, failures, token lifecycle

### Infrastructure Metrics
- **Kubernetes**: Pod status, resource usage, events
- **Nodes**: CPU, memory, disk, network utilization
- **Load Balancers**: Request distribution, health checks
- **DNS**: Query latency, success rates

### Business Metrics
- **User Engagement**: Active users, session duration, feature usage
- **Learning Progress**: Completion rates, quiz scores, recommendations
- **System Health**: Availability, performance, errors

## Alerting

### Alert Severity Levels

#### Critical (Immediate Response)
- Service completely down
- Data loss risk
- Security incidents
- SLO budget exhausted

#### High (Response within 1 hour)
- Degraded performance
- High error rates
- Resource exhaustion approaching
- Failed backups

#### Warning (Response within 4 hours)
- Performance degradation
- Resource usage trending high
- Non-critical component failures
- SLO budget burning fast

#### Info (Response within 24 hours)
- Deployment notifications
- Capacity planning alerts
- Maintenance reminders
- Cost optimization opportunities

### Alert Routing

```yaml
Routes:
  - Critical → PagerDuty + Email + Slack (#critical-alerts)
  - High → Email + Slack (#alerts-prod)
  - Warning → Slack (#alerts-prod)
  - Info → Slack (#info-alerts)
```

### Common Alert Rules

#### Application Alerts
```promql
# High error rate
rate(http_requests_total{code=~"5.."}[5m]) > 0.1

# High latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.5

# Service down
up{job="learning-assistant"} == 0
```

#### Infrastructure Alerts
```promql
# High CPU usage
rate(cpu_usage_total[5m]) > 0.8

# High memory usage
memory_usage_ratio > 0.9

# Disk space low
disk_free_ratio < 0.1
```

## Dashboards

### Executive Dashboard
- **Purpose**: High-level business and operational metrics
- **Audience**: Leadership, product managers
- **Metrics**: 
  - User engagement trends
  - System availability
  - Cost trends
  - Revenue impact

### Operations Dashboard
- **Purpose**: Detailed system health and performance
- **Audience**: DevOps, SRE teams
- **Metrics**:
  - Service health status
  - Resource utilization
  - Alert status
  - Deployment progress

### Application Dashboard
- **Purpose**: Application-specific metrics
- **Audience**: Development teams
- **Metrics**:
  - Request rates and latency
  - Error rates and types
  - Database performance
  - Feature usage

### Security Dashboard
- **Purpose**: Security monitoring and compliance
- **Audience**: Security team
- **Metrics**:
  - Authentication events
  - Failed login attempts
  - Security policy violations
  - Vulnerability scan results

## SLI/SLO Monitoring

### Defined SLOs

#### Learning Assistant API
- **Availability**: 99.9% (production), 99.5% (staging)
- **Latency**: 95% of requests < 500ms
- **Error Rate**: < 0.1% of requests result in 5xx errors

#### Database
- **Availability**: 99.9% uptime
- **Performance**: 95% of queries < 100ms
- **Consistency**: 99.99% data consistency

#### Authentication Service
- **Availability**: 99.95% uptime
- **Latency**: 99% of logins < 2 seconds
- **Security**: 0 unauthorized access incidents

### Error Budget Management

#### Budget Calculation
```
Error Budget = (100% - SLO) × Time Period
Example: (100% - 99.9%) × 30 days = 43.2 minutes/month
```

#### Burn Rate Alerts
- **Fast Burn**: 2% budget consumed in 1 hour
- **Medium Burn**: 5% budget consumed in 6 hours
- **Slow Burn**: 10% budget consumed in 3 days

### SLO Reporting

#### Daily Reports
- SLO compliance status
- Error budget consumption
- Trend analysis
- Action items

#### Monthly Reviews
- SLO performance summary
- Error budget analysis
- Service improvements
- SLO adjustments

## Cost Monitoring

### Cost Allocation

#### By Service
- Learning Assistant API: 40%
- Database: 25%
- Monitoring: 15%
- Authentication: 10%
- Other: 10%

#### By Environment
- Production: 60%
- Staging: 25%
- Development: 15%

### Budget Alerts

#### Thresholds
- Daily: > $35 (production), > $20 (non-production)
- Monthly: > $1000 (production), > $500 (non-production)
- Forecast: > 120% of monthly budget

#### Optimization Recommendations
- Unused resources identification
- Right-sizing suggestions
- Reserved instance opportunities
- Storage optimization

## Troubleshooting

### Common Issues

#### Prometheus Not Scraping Targets
```bash
# Check service discovery
kubectl get servicemonitor -A

# Check Prometheus configuration
kubectl get prometheus -o yaml

# Check network policies
kubectl get networkpolicy -A
```

#### Grafana Dashboard Not Loading
```bash
# Check Grafana pods
kubectl get pods -n monitoring -l app=grafana

# Check persistent volume
kubectl get pvc -n monitoring

# Check configuration
kubectl get configmap -n monitoring grafana-config
```

#### AlertManager Not Sending Alerts
```bash
# Check AlertManager configuration
kubectl get secret -n monitoring alertmanager-main

# Check notification channels
kubectl logs -n monitoring alertmanager-main-0

# Test webhook endpoints
curl -X POST "webhook-url" -d "test message"
```

### Log Analysis

#### Application Errors
```bash
# Query application logs
kubectl logs -n default deployment/learning-assistant --tail=100

# Search in Kibana
GET /logs-*/_search
{
  "query": {
    "bool": {
      "must": [
        { "match": { "kubernetes.labels.app": "learning-assistant" }},
        { "range": { "@timestamp": { "gte": "now-1h" }}}
      ]
    }
  }
}
```

#### Performance Issues
```bash
# Check resource usage
kubectl top pods -n default

# Query performance metrics
rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m])

# Analyze traces in Jaeger
# Navigate to Jaeger UI and search for slow requests
```

### Emergency Procedures

#### Service Down
1. Check service status in Grafana
2. Review recent deployments
3. Check logs for errors
4. Analyze traces for issues
5. Scale up if resource constrained
6. Rollback if deployment related

#### High Resource Usage
1. Identify resource bottleneck
2. Check for memory leaks
3. Scale horizontally if possible
4. Optimize queries if database related
5. Implement caching if appropriate

## Maintenance

### Regular Tasks

#### Daily
- Review critical alerts
- Check SLO compliance
- Monitor cost trends
- Verify backup completion

#### Weekly
- Review dashboard metrics
- Update alert rules if needed
- Check for security updates
- Analyze performance trends

#### Monthly
- SLO review and adjustment
- Cost optimization review
- Security audit
- Capacity planning update

### Upgrades

#### Prometheus Stack
```bash
helm repo update
helm upgrade prometheus-operator prometheus-community/kube-prometheus-stack
```

#### Elasticsearch
```bash
# Follow ECK upgrade procedure
kubectl apply -f elasticsearch-upgrade.yaml
```

#### Grafana
```bash
helm upgrade grafana grafana/grafana
```

### Backup Procedures

#### Configuration Backup
```bash
# Backup monitoring configuration
./scripts/monitoring/setup-monitoring.sh backup
```

#### Data Backup
- Prometheus: Automated snapshots to cloud storage
- Elasticsearch: Daily snapshots with retention policy
- Grafana: Dashboard and configuration export

### Disaster Recovery

#### Recovery Procedures
1. Restore infrastructure with Terraform
2. Restore configuration from backups
3. Restore data from snapshots
4. Verify all services are operational
5. Test alerting functionality

#### RTO/RPO Targets
- **RTO (Recovery Time Objective)**: 2 hours
- **RPO (Recovery Point Objective)**: 15 minutes

## Support and Documentation

### Additional Resources
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [Elasticsearch Documentation](https://www.elastic.co/guide/)

### Team Contacts
- **DevOps Team**: devops@example.com
- **SRE Team**: sre@example.com
- **Security Team**: security@example.com
- **On-Call**: oncall@example.com

### Emergency Contacts
- **Primary On-Call**: +1-555-0123
- **Secondary On-Call**: +1-555-0124
- **Management Escalation**: +1-555-0125

---

*This document is maintained by the DevOps team and updated with each infrastructure change.*