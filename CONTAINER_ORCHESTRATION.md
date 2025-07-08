# Container Orchestration and Auto-scaling Documentation

## Overview

This document provides comprehensive guidance for deploying and managing the Learning Assistant application using container orchestration technologies. The application supports both Kubernetes and Docker Compose deployments with auto-scaling capabilities, high availability, and production-ready configurations.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Docker Compose Deployment](#docker-compose-deployment)
- [Auto-scaling Configuration](#auto-scaling-configuration)
- [Monitoring and Observability](#monitoring-and-observability)
- [Security Considerations](#security-considerations)
- [Backup and Recovery](#backup-and-recovery)
- [Troubleshooting](#troubleshooting)
- [Maintenance Procedures](#maintenance-procedures)

## Architecture Overview

### System Components

The Learning Assistant application consists of the following components:

1. **Application Tier**
   - Next.js application with Node.js runtime
   - Supports horizontal scaling
   - Health checks and graceful shutdown
   - Metrics collection

2. **Database Tier**
   - PostgreSQL 15 with performance tuning
   - Persistent storage with backups
   - Connection pooling and monitoring

3. **Cache Tier**
   - Redis 7 with persistence
   - Session storage and application caching
   - Memory optimization

4. **Monitoring Stack**
   - Prometheus for metrics collection
   - Grafana for visualization
   - Node Exporter for system metrics
   - Custom application metrics

5. **Load Balancing**
   - NGINX Ingress (Kubernetes)
   - Traefik (Docker Compose)
   - SSL/TLS termination
   - Health-based routing

### Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer                            │
│                 (NGINX/Traefik)                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                Application Tier                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │    App 1    │ │    App 2    │ │    App 3    │           │
│  │ (Replica)   │ │ (Replica)   │ │ (Replica)   │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                 Data Tier                                   │
│  ┌─────────────┐                    ┌─────────────┐        │
│  │ PostgreSQL  │                    │   Redis     │        │
│  │ (Primary)   │                    │  (Cache)    │        │
│  └─────────────┘                    └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (v1.24+)
- kubectl configured
- Helm (optional, for package management)
- Container registry access
- Storage provisioner

### Quick Start

1. **Clone the repository and navigate to the project**:
   ```bash
   git clone <repository-url>
   cd learning-assistant
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env.prod
   # Edit .env.prod with your configuration
   ```

3. **Deploy to Kubernetes**:
   ```bash
   ./scripts/k8s/deploy.sh
   ```

### Detailed Deployment Steps

#### 1. Prepare the Environment

Create the necessary secrets:
```bash
# Create namespace
kubectl apply -f k8s/base/namespace.yaml

# Create secrets from environment file
kubectl create secret generic learning-assistant-secrets \
  --from-env-file=.env.prod \
  --namespace=learning-assistant
```

#### 2. Deploy Infrastructure Components

```bash
# Apply storage configurations
kubectl apply -f k8s/base/persistent-volumes.yaml

# Apply ConfigMaps
kubectl apply -f k8s/base/configmap.yaml
kubectl apply -f k8s/base/init-scripts.yaml

# Apply resource quotas and policies
kubectl apply -f k8s/base/resource-quotas.yaml
```

#### 3. Deploy Database and Cache

```bash
# Deploy PostgreSQL
kubectl apply -f k8s/base/postgres-deployment.yaml

# Deploy Redis
kubectl apply -f k8s/base/redis-deployment.yaml

# Wait for databases to be ready
kubectl wait --for=condition=available deployment/postgres --timeout=300s -n learning-assistant
kubectl wait --for=condition=available deployment/redis --timeout=300s -n learning-assistant
```

#### 4. Deploy Application

```bash
# Deploy application
kubectl apply -f k8s/base/app-deployment.yaml
kubectl apply -f k8s/base/services.yaml

# Apply auto-scaling
kubectl apply -f k8s/base/hpa.yaml

# Configure ingress
kubectl apply -f k8s/base/ingress.yaml
```

#### 5. Deploy Monitoring

```bash
# Deploy monitoring stack
kubectl apply -f k8s/monitoring/prometheus-config.yaml
kubectl apply -f k8s/monitoring/monitoring-stack.yaml
```

### Advanced Deployment Options

#### Using the Deployment Script

The deployment script provides advanced options:

```bash
# Deploy to staging environment
./scripts/k8s/deploy.sh -e staging

# Perform dry run
./scripts/k8s/deploy.sh -d

# Upgrade existing deployment
./scripts/k8s/deploy.sh -u

# Check deployment status
./scripts/k8s/deploy.sh -c

# Rollback deployment
./scripts/k8s/deploy.sh -r
```

#### Custom Resource Configuration

Modify resource limits in `k8s/base/app-deployment.yaml`:

```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "1Gi"
    cpu: "500m"
```

## Docker Compose Deployment

### Prerequisites

- Docker Engine (v20.10+)
- Docker Compose (v2.0+)
- Sufficient system resources
- Access to required ports

### Quick Start

1. **Configure environment**:
   ```bash
   cp .env.example .env.prod
   # Edit .env.prod with your configuration
   ```

2. **Deploy with Docker Compose**:
   ```bash
   ./scripts/docker/deploy-compose.sh deploy
   ```

### Detailed Deployment Steps

#### 1. Prepare the Environment

```bash
# Create necessary directories
sudo mkdir -p /opt/learning-assistant/{data,logs,backups}
sudo chown -R $USER:$USER /opt/learning-assistant
```

#### 2. Configure Environment Variables

Edit `.env.prod` with your configuration:

```bash
# Database
POSTGRES_PASSWORD=your_secure_postgres_password

# Redis
REDIS_PASSWORD=your_secure_redis_password

# JWT and Authentication
JWT_SECRET=your_jwt_secret_key_here
NEXTAUTH_SECRET=your_nextauth_secret_here

# External APIs
OPENAI_API_KEY=your_openai_api_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
RESEND_API_KEY=your_resend_api_key
TAMBO_API_KEY=your_tambo_api_key

# Monitoring
GRAFANA_PASSWORD=your_grafana_admin_password
```

#### 3. Deploy Services

```bash
# Deploy all services
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Or use the deployment script
./scripts/docker/deploy-compose.sh deploy -d
```

#### 4. Verify Deployment

```bash
# Check service status
./scripts/docker/deploy-compose.sh status

# Check application health
./scripts/docker/deploy-compose.sh health

# View logs
./scripts/docker/deploy-compose.sh logs
```

### Management Commands

The Docker Compose deployment script provides comprehensive management:

```bash
# Start services
./scripts/docker/deploy-compose.sh start

# Stop services
./scripts/docker/deploy-compose.sh stop

# Restart services
./scripts/docker/deploy-compose.sh restart

# Update services
./scripts/docker/deploy-compose.sh update

# Scale application (up to 3 replicas)
./scripts/docker/deploy-compose.sh scale --replicas 3

# Create backup
./scripts/docker/deploy-compose.sh backup

# Restore from backup
./scripts/docker/deploy-compose.sh restore /path/to/backup

# View specific service logs
./scripts/docker/deploy-compose.sh logs app-1
```

## Auto-scaling Configuration

### Kubernetes Auto-scaling

#### Horizontal Pod Autoscaler (HPA)

The application includes HPA configuration for automatic scaling:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: learning-assistant-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: learning-assistant
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

#### Vertical Pod Autoscaler (VPA)

For PostgreSQL vertical scaling:

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: postgres-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: postgres
  updatePolicy:
    updateMode: "Auto"
```

#### Custom Metrics Scaling

Scale based on application-specific metrics:

```yaml
- type: Pods
  pods:
    metric:
      name: http_requests_per_second
    target:
      type: AverageValue
      averageValue: "100"
```

### Docker Compose Scaling

Manual scaling with Docker Compose:

```bash
# Scale to 5 replicas (limited by compose file)
docker-compose -f docker-compose.prod.yml up -d --scale app-1=1 --scale app-2=1 --scale app-3=1

# Using the deployment script
./scripts/docker/deploy-compose.sh scale --replicas 3
```

### Scaling Policies

#### Scale-up Policy
- **Trigger**: CPU > 70% or Memory > 80%
- **Stabilization**: 60 seconds
- **Max increase**: 100% of current replicas (up to 4 pods)
- **Period**: 15 seconds

#### Scale-down Policy
- **Trigger**: CPU < 50% and Memory < 60%
- **Stabilization**: 300 seconds (5 minutes)
- **Max decrease**: 10% of current replicas or 2 pods
- **Period**: 60 seconds

## Monitoring and Observability

### Metrics Collection

#### Application Metrics
- Request rate and latency
- Error rates
- Business metrics (user sessions, quiz completions)
- Custom application metrics

#### Infrastructure Metrics
- CPU, memory, disk usage
- Network performance
- Container metrics
- Kubernetes cluster metrics

### Monitoring Stack

#### Prometheus Configuration

```yaml
scrape_configs:
  - job_name: 'learning-assistant'
    kubernetes_sd_configs:
      - role: endpoints
        namespaces:
          names:
            - learning-assistant
    metrics_path: /api/metrics
    scrape_interval: 15s
```

#### Grafana Dashboards

Pre-configured dashboards for:
- Application performance
- Infrastructure monitoring
- Business metrics
- Alerting overview

### Alerting Rules

Critical alerts configured:
- Application downtime
- High error rates
- Database connectivity issues
- Resource exhaustion
- Security incidents

Example alert rule:
```yaml
- alert: LearningAssistantDown
  expr: up{job="learning-assistant"} == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Learning Assistant is down"
```

### Log Aggregation

#### Kubernetes Logging
- Centralized logging with Fluent Bit
- Structured JSON logs
- Log rotation and retention
- Integration with monitoring stack

#### Docker Compose Logging
- Fluentd for log aggregation
- File-based logging with rotation
- Application and infrastructure logs

## Security Considerations

### Container Security

#### Image Security
- Multi-stage builds for minimal attack surface
- Non-root user execution
- Security scanning in CI/CD
- Regular base image updates

#### Runtime Security
- Read-only root filesystem where possible
- Dropped capabilities
- Resource limits
- Network policies

### Kubernetes Security

#### Pod Security Policies
```yaml
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  runAsUser:
    rule: 'MustRunAsNonRoot'
```

#### Network Policies
- Ingress/egress traffic control
- Service-to-service communication
- External API access restrictions

#### RBAC Configuration
- Service accounts with minimal permissions
- Role-based access control
- Regular permission audits

### Secrets Management

#### Kubernetes Secrets
- Encrypted at rest
- Automatic rotation capabilities
- Integration with external secret managers
- Least privilege access

#### Environment Variables
- Sensitive data in secrets only
- No hardcoded credentials
- Regular secret rotation

## Backup and Recovery

### Database Backup Strategy

#### Automated Backups
- Daily full backups
- Point-in-time recovery capability
- Remote storage (S3/GCS)
- Backup verification

#### Backup Configuration
```bash
# Create backup using script
./scripts/docker/deploy-compose.sh backup

# Kubernetes backup (using external tools)
kubectl exec deployment/postgres -- pg_dump -U learning_user learning_assistant_db > backup.sql
```

### Disaster Recovery

#### Recovery Procedures
1. **Infrastructure Recovery**
   - Restore cluster/containers
   - Verify network connectivity
   - Check storage availability

2. **Data Recovery**
   - Restore database from backup
   - Restore Redis data if needed
   - Verify data integrity

3. **Application Recovery**
   - Deploy application components
   - Run health checks
   - Verify functionality

#### Recovery Time Objectives (RTO)
- **Critical**: < 15 minutes
- **Important**: < 1 hour
- **Standard**: < 4 hours

#### Recovery Point Objectives (RPO)
- **Critical data**: < 1 hour
- **Standard data**: < 24 hours

## Troubleshooting

### Common Issues

#### Deployment Issues

**Issue**: Pods stuck in Pending state
```bash
# Check node resources
kubectl describe nodes

# Check pod events
kubectl describe pod <pod-name> -n learning-assistant

# Check storage
kubectl get pv,pvc -n learning-assistant
```

**Issue**: Database connection failures
```bash
# Check database pod status
kubectl get pods -l app.kubernetes.io/name=postgres -n learning-assistant

# Check database logs
kubectl logs deployment/postgres -n learning-assistant

# Test connectivity
kubectl exec -it deployment/learning-assistant -n learning-assistant -- nc -zv postgres-service 5432
```

#### Performance Issues

**Issue**: High response times
```bash
# Check HPA status
kubectl get hpa -n learning-assistant

# Check resource usage
kubectl top pods -n learning-assistant

# Check application metrics
curl http://localhost:9090/api/v1/query?query=http_request_duration_seconds
```

#### Scaling Issues

**Issue**: HPA not scaling
```bash
# Check metrics server
kubectl get --raw /apis/metrics.k8s.io/v1beta1/nodes

# Check HPA conditions
kubectl describe hpa learning-assistant-hpa -n learning-assistant

# Check resource requests/limits
kubectl describe deployment learning-assistant -n learning-assistant
```

### Debugging Commands

#### Kubernetes
```bash
# Check cluster status
kubectl cluster-info

# Check all resources
kubectl get all -n learning-assistant

# Check events
kubectl get events -n learning-assistant --sort-by='.lastTimestamp'

# Check resource usage
kubectl top nodes
kubectl top pods -n learning-assistant

# Access pod shell
kubectl exec -it deployment/learning-assistant -n learning-assistant -- /bin/sh
```

#### Docker Compose
```bash
# Check container status
docker-compose -f docker-compose.prod.yml ps

# Check logs
docker-compose -f docker-compose.prod.yml logs

# Check resource usage
docker stats

# Access container shell
docker-compose -f docker-compose.prod.yml exec app-1 /bin/sh
```

## Maintenance Procedures

### Regular Maintenance Tasks

#### Weekly
- [ ] Review monitoring dashboards
- [ ] Check backup integrity
- [ ] Review log aggregation
- [ ] Update security patches

#### Monthly
- [ ] Update base images
- [ ] Review resource utilization
- [ ] Test disaster recovery procedures
- [ ] Security audit

#### Quarterly
- [ ] Performance optimization review
- [ ] Capacity planning assessment
- [ ] Update dependencies
- [ ] Review and update documentation

### Update Procedures

#### Application Updates

**Kubernetes (Blue-Green/Canary)**:
```bash
# Update image tag
kubectl set image deployment/learning-assistant learning-assistant=learning-assistant:v2.0.0 -n learning-assistant

# Monitor rollout
kubectl rollout status deployment/learning-assistant -n learning-assistant

# Rollback if needed
kubectl rollout undo deployment/learning-assistant -n learning-assistant
```

**Docker Compose**:
```bash
# Update with new image
./scripts/docker/deploy-compose.sh update

# Or manual update
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d --force-recreate
```

#### Infrastructure Updates

1. **Plan maintenance window**
2. **Create pre-update backup**
3. **Update components in order**:
   - Monitoring stack
   - Database (if needed)
   - Application
4. **Verify functionality**
5. **Document changes**

### Monitoring Health

#### Health Check Endpoints
- `/api/health` - Basic health check
- `/api/health/ready` - Readiness check
- `/api/health/live` - Liveness check
- `/api/metrics` - Prometheus metrics

#### Key Metrics to Monitor
- Response time (p95 < 500ms)
- Error rate (< 1%)
- Availability (> 99.9%)
- CPU usage (< 70%)
- Memory usage (< 80%)
- Database connections (< 80% of max)

## Performance Tuning

### Application Optimization

#### Node.js Configuration
```bash
NODE_OPTIONS="--max-old-space-size=1024"
UV_THREADPOOL_SIZE=16
```

#### Database Optimization
- Connection pooling
- Query optimization
- Index management
- Regular VACUUM/ANALYZE

#### Redis Optimization
- Memory policy configuration
- Persistence settings
- Connection pooling

### Infrastructure Optimization

#### Resource Allocation
- Right-sizing containers
- Resource requests vs limits
- Quality of Service classes

#### Network Optimization
- Service mesh (Istio) for advanced traffic management
- Connection pooling
- Keep-alive connections

## Conclusion

This container orchestration setup provides a robust, scalable, and production-ready deployment for the Learning Assistant application. The combination of Kubernetes and Docker Compose options allows for flexibility in deployment environments while maintaining consistency in configuration and monitoring.

For additional support or questions, please refer to the project documentation or contact the development team.

## Quick Reference

### Important Commands

```bash
# Kubernetes deployment
./scripts/k8s/deploy.sh

# Docker Compose deployment
./scripts/docker/deploy-compose.sh deploy

# Check status
kubectl get all -n learning-assistant
./scripts/docker/deploy-compose.sh status

# View logs
kubectl logs -f deployment/learning-assistant -n learning-assistant
./scripts/docker/deploy-compose.sh logs

# Scale application
kubectl scale deployment/learning-assistant --replicas=5 -n learning-assistant
./scripts/docker/deploy-compose.sh scale --replicas 3
```

### Important URLs

- **Application**: http://localhost:3000 (or configured domain)
- **Grafana**: http://localhost:3001
- **Prometheus**: http://localhost:9090
- **Traefik Dashboard**: http://localhost:8080 (Docker Compose)

### Configuration Files

- **Kubernetes**: `k8s/base/`
- **Docker Compose**: `docker-compose.prod.yml`
- **Environment**: `.env.prod`
- **Monitoring**: `monitoring/`
- **Scripts**: `scripts/k8s/` and `scripts/docker/`