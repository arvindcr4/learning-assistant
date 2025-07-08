# Learning Assistant Kubernetes Manifests

This directory contains all Kubernetes manifests and configurations for deploying the Learning Assistant application.

## Directory Structure

```
k8s/
├── base/                           # Base Kubernetes manifests
│   ├── namespace.yaml              # Namespace definition
│   ├── configmap.yaml              # Application configuration
│   ├── secret.yaml                 # Secret templates
│   ├── app-deployment.yaml         # Main application deployment
│   ├── postgres-deployment.yaml    # PostgreSQL database
│   ├── redis-deployment.yaml       # Redis cache
│   ├── services.yaml               # Service definitions
│   ├── ingress.yaml                # Ingress configuration
│   ├── persistent-volumes.yaml     # Storage configuration
│   ├── hpa.yaml                    # Auto-scaling configuration
│   ├── resource-quotas.yaml        # Resource limits and QoS
│   ├── deployment-strategy.yaml    # Advanced deployment strategies
│   └── init-scripts.yaml           # Database initialization
├── monitoring/                     # Monitoring stack
│   ├── prometheus-config.yaml      # Prometheus configuration
│   └── monitoring-stack.yaml       # Complete monitoring deployment
├── overlays/                       # Environment-specific overlays
│   ├── development/                # Development environment
│   ├── staging/                    # Staging environment
│   └── production/                 # Production environment
└── README.md                       # This file
```

## Quick Start

### Prerequisites

- Kubernetes cluster (v1.24+)
- kubectl configured and connected
- Container registry access
- Storage provisioner configured

### Basic Deployment

1. **Create secrets:**
```bash
# Copy and edit the environment file
cp .env.example .env.prod

# Create Kubernetes secrets
kubectl create secret generic learning-assistant-secrets \
  --from-env-file=.env.prod \
  --namespace=learning-assistant
```

2. **Deploy the application:**
```bash
# Use the deployment script (recommended)
./scripts/k8s/deploy.sh

# Or deploy manually
kubectl apply -f k8s/base/namespace.yaml
kubectl apply -f k8s/base/configmap.yaml
kubectl apply -f k8s/base/persistent-volumes.yaml
kubectl apply -f k8s/base/postgres-deployment.yaml
kubectl apply -f k8s/base/redis-deployment.yaml
kubectl apply -f k8s/base/app-deployment.yaml
kubectl apply -f k8s/base/services.yaml
kubectl apply -f k8s/base/hpa.yaml
kubectl apply -f k8s/base/ingress.yaml
```

3. **Deploy monitoring:**
```bash
kubectl apply -f k8s/monitoring/
```

## Configuration Details

### Environment Configuration

Edit the secret template in `base/secret.yaml` or create from environment file:

```yaml
# Required secrets
DATABASE_PASSWORD: <base64-encoded-password>
REDIS_PASSWORD: <base64-encoded-password>
JWT_SECRET: <base64-encoded-secret>
OPENAI_API_KEY: <base64-encoded-key>
# ... more secrets
```

### Resource Configuration

Default resource allocation can be modified in `app-deployment.yaml`:

```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "1Gi"
    cpu: "500m"
```

### Auto-scaling Configuration

HPA settings in `hpa.yaml`:

```yaml
spec:
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Storage Configuration

Persistent volumes are configured in `persistent-volumes.yaml`. Modify storage classes and sizes as needed:

```yaml
spec:
  storageClassName: fast-ssd
  capacity:
    storage: 10Gi
```

## Advanced Features

### Deployment Strategies

The application supports advanced deployment strategies using Argo Rollouts:

1. **Canary Deployment**: Gradual traffic shifting with automated analysis
2. **Blue-Green Deployment**: Zero-downtime deployments with instant rollback
3. **Rolling Updates**: Default Kubernetes rolling updates

### Monitoring and Observability

Complete monitoring stack includes:
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Visualization and dashboards
- **Node Exporter**: System metrics
- **Application Metrics**: Custom business metrics

### Security Features

- **Pod Security Policies**: Enforce security standards
- **Network Policies**: Control traffic flow
- **RBAC**: Role-based access control
- **Secret Management**: Encrypted secrets at rest

## Customization

### Environment-Specific Configurations

Use Kustomize overlays for different environments:

```bash
# Development
kubectl apply -k k8s/overlays/development

# Staging
kubectl apply -k k8s/overlays/staging

# Production
kubectl apply -k k8s/overlays/production
```

### Custom Resource Limits

Modify `resource-quotas.yaml` for your cluster:

```yaml
spec:
  hard:
    requests.cpu: "4"
    requests.memory: "8Gi"
    limits.cpu: "8"
    limits.memory: "16Gi"
```

### Custom Monitoring

Add custom metrics and alerts in `monitoring/prometheus-config.yaml`:

```yaml
- alert: CustomAlert
  expr: custom_metric > threshold
  for: 5m
  labels:
    severity: warning
```

## Operations

### Scaling

```bash
# Manual scaling
kubectl scale deployment/learning-assistant --replicas=5 -n learning-assistant

# Check HPA status
kubectl get hpa -n learning-assistant

# Describe HPA for details
kubectl describe hpa learning-assistant-hpa -n learning-assistant
```

### Monitoring

```bash
# Check pod status
kubectl get pods -n learning-assistant

# View logs
kubectl logs -f deployment/learning-assistant -n learning-assistant

# Check resource usage
kubectl top pods -n learning-assistant
```

### Updates

```bash
# Update image
kubectl set image deployment/learning-assistant \
  learning-assistant=learning-assistant:v2.0.0 \
  -n learning-assistant

# Monitor rollout
kubectl rollout status deployment/learning-assistant -n learning-assistant

# Rollback if needed
kubectl rollout undo deployment/learning-assistant -n learning-assistant
```

### Backup and Recovery

```bash
# Database backup
kubectl exec deployment/postgres -n learning-assistant -- \
  pg_dump -U learning_user learning_assistant_db > backup.sql

# Redis backup
kubectl exec deployment/redis -n learning-assistant -- \
  redis-cli BGSAVE
```

## Troubleshooting

### Common Issues

1. **Pods stuck in Pending:**
   ```bash
   kubectl describe pod <pod-name> -n learning-assistant
   kubectl get events -n learning-assistant
   ```

2. **Database connection issues:**
   ```bash
   kubectl logs deployment/postgres -n learning-assistant
   kubectl exec -it deployment/learning-assistant -n learning-assistant -- \
     nc -zv postgres-service 5432
   ```

3. **Storage issues:**
   ```bash
   kubectl get pv,pvc -n learning-assistant
   kubectl describe pvc <pvc-name> -n learning-assistant
   ```

### Debugging Commands

```bash
# Get all resources
kubectl get all -n learning-assistant

# Check events
kubectl get events --sort-by='.lastTimestamp' -n learning-assistant

# Access pod shell
kubectl exec -it deployment/learning-assistant -n learning-assistant -- /bin/sh

# Port forward for local access
kubectl port-forward service/learning-assistant-service 3000:80 -n learning-assistant
```

## Security Considerations

### Network Security
- Ingress with TLS termination
- Network policies for traffic control
- Service mesh integration ready

### Pod Security
- Non-root containers
- Read-only filesystems where possible
- Security context constraints
- Regular security scanning

### Secret Management
- Kubernetes secrets with encryption at rest
- External secret manager integration ready
- Regular secret rotation

## Performance Tuning

### Application Performance
- Resource requests and limits tuned for workload
- JVM/Node.js optimization
- Connection pooling

### Database Performance
- PostgreSQL configuration optimized
- Connection limits and pooling
- Query performance monitoring

### Cache Performance
- Redis memory optimization
- Eviction policies configured
- Connection pooling

## Migration Guide

### From Docker Compose

1. **Export environment variables:**
   ```bash
   # Convert .env to Kubernetes secrets
   kubectl create secret generic learning-assistant-secrets \
     --from-env-file=.env.prod \
     --namespace=learning-assistant
   ```

2. **Migrate data:**
   ```bash
   # Export from Docker volumes
   docker run --rm -v learning-assistant_postgres_data:/data -v $(pwd):/backup alpine \
     tar czf /backup/postgres.tar.gz -C /data .
   
   # Import to Kubernetes PVC
   kubectl cp postgres.tar.gz postgres-pod:/tmp/
   kubectl exec postgres-pod -- tar xzf /tmp/postgres.tar.gz -C /var/lib/postgresql/data
   ```

3. **Deploy to Kubernetes:**
   ```bash
   ./scripts/k8s/deploy.sh
   ```

### From Other Orchestrators

Contact the team for specific migration guides for:
- Docker Swarm
- Nomad
- OpenShift
- Cloud-specific services (ECS, Cloud Run, etc.)

## Contributing

When contributing to the Kubernetes manifests:

1. **Test changes locally** using minikube or kind
2. **Validate YAML** syntax and Kubernetes API versions
3. **Update documentation** for any configuration changes
4. **Test deployment scripts** with your changes
5. **Verify monitoring** and alerting still work

## Support

For additional help:
- Check the main [CONTAINER_ORCHESTRATION.md](../CONTAINER_ORCHESTRATION.md) documentation
- Review troubleshooting guides
- Contact the development team
- Open an issue with detailed error information

## Security Recommendations

### Production Checklist

- [ ] All secrets properly configured
- [ ] TLS certificates installed
- [ ] Network policies applied
- [ ] Resource limits set
- [ ] Monitoring configured
- [ ] Backups tested
- [ ] Security scanning enabled
- [ ] RBAC properly configured
- [ ] Pod security policies applied
- [ ] Ingress access controls configured