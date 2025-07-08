# Learning Assistant - Google Cloud Platform Infrastructure

This directory contains Terraform configurations for deploying the Learning Assistant application on Google Cloud Platform (GCP). The infrastructure is designed for production use with high availability, security, and scalability in mind.

## 🏗️ Architecture Overview

The infrastructure includes:

- **VPC Network**: Custom VPC with private and public subnets
- **Google Kubernetes Engine (GKE)**: Managed Kubernetes cluster with auto-scaling
- **Cloud SQL PostgreSQL**: Managed database with high availability and backups
- **Memorystore Redis**: Managed Redis cache for performance
- **Cloud Load Balancing**: Global load balancer with SSL termination
- **Cloud DNS**: Managed DNS with health checks
- **Cloud Monitoring**: Comprehensive monitoring and alerting
- **Cloud Storage**: Buckets for static assets and backups
- **Secret Manager**: Secure storage for sensitive configuration
- **IAM**: Least-privilege service accounts and roles
- **Security**: Firewall rules, Cloud Armor, and encryption

## 📋 Prerequisites

### Required Tools

1. **Terraform** (>= 1.0)
   ```bash
   # Install using package manager or download from terraform.io
   terraform --version
   ```

2. **Google Cloud SDK**
   ```bash
   # Install gcloud CLI
   curl https://sdk.cloud.google.com | bash
   exec -l $SHELL
   gcloud init
   ```

3. **kubectl**
   ```bash
   # Install kubectl for Kubernetes management
   gcloud components install kubectl
   ```

### GCP Setup

1. **Create or Select a GCP Project**
   ```bash
   # Create a new project
   gcloud projects create your-project-id --name="Learning Assistant"
   
   # Set as default project
   gcloud config set project your-project-id
   ```

2. **Enable Billing**
   ```bash
   # Link billing account (replace with your billing account ID)
   gcloud beta billing projects link your-project-id --billing-account=ABCDEF-123456-GHIJKL
   ```

3. **Enable Required APIs**
   ```bash
   gcloud services enable compute.googleapis.com \
     container.googleapis.com \
     sqladmin.googleapis.com \
     redis.googleapis.com \
     dns.googleapis.com \
     monitoring.googleapis.com \
     logging.googleapis.com \
     secretmanager.googleapis.com \
     certificatemanager.googleapis.com \
     cloudbuild.googleapis.com \
     storage.googleapis.com
   ```

4. **Set Up Authentication**
   ```bash
   # For local development
   gcloud auth application-default login
   
   # For production/CI-CD (create service account)
   gcloud iam service-accounts create terraform-sa \
     --display-name="Terraform Service Account"
   
   gcloud projects add-iam-policy-binding your-project-id \
     --member="serviceAccount:terraform-sa@your-project-id.iam.gserviceaccount.com" \
     --role="roles/editor"
   
   gcloud iam service-accounts keys create terraform-key.json \
     --iam-account=terraform-sa@your-project-id.iam.gserviceaccount.com
   
   export GOOGLE_APPLICATION_CREDENTIALS="./terraform-key.json"
   ```

## 🚀 Quick Start

### 1. Clone and Configure

```bash
# Clone the repository
git clone <your-repo-url>
cd learning-assistant/infrastructure/gcp

# Copy example variables file
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars with your values
nano terraform.tfvars
```

### 2. Initialize Terraform

```bash
# Initialize Terraform
terraform init

# Validate configuration
terraform validate

# Plan deployment
terraform plan
```

### 3. Deploy Infrastructure

```bash
# Apply configuration
terraform apply

# Confirm by typing 'yes' when prompted
```

### 4. Configure kubectl

```bash
# Get cluster credentials
gcloud container clusters get-credentials learning-assistant-cluster \
  --region us-central1 \
  --project your-project-id

# Verify connection
kubectl get nodes
```

## 📁 File Structure

```
infrastructure/gcp/
├── README.md                    # This file
├── versions.tf                  # Provider versions and backend config
├── variables.tf                 # Input variables
├── main.tf                     # Main resources and configuration
├── vpc.tf                      # VPC, subnets, and networking
├── gke.tf                      # GKE cluster and node pools
├── cloudsql.tf                 # PostgreSQL database
├── memorystore.tf              # Redis cache
├── load-balancer.tf            # Load balancer and SSL
├── dns.tf                      # DNS zones and records
├── monitoring.tf               # Monitoring and alerting
├── iam.tf                      # Service accounts and IAM
├── firewall.tf                 # Firewall rules
├── outputs.tf                  # Output values
└── terraform.tfvars.example    # Example variables file
```

## ⚙️ Configuration

### Environment Variables

Key variables to customize in `terraform.tfvars`:

| Variable | Description | Example |
|----------|-------------|---------|
| `project_id` | GCP Project ID | `"learning-assistant-prod"` |
| `region` | Primary region | `"us-central1"` |
| `domain_name` | Your domain | `"learning-assistant.com"` |
| `environment` | Environment name | `"prod"` |
| `notification_email` | Alert email | `"admin@company.com"` |

### Multi-Environment Setup

Create separate variable files for each environment:

```bash
# Development
cp terraform.tfvars.example terraform.tfvars.dev
# Edit for development values

# Staging
cp terraform.tfvars.example terraform.tfvars.staging
# Edit for staging values

# Production
cp terraform.tfvars.example terraform.tfvars.prod
# Edit for production values
```

Deploy with environment-specific variables:

```bash
# Development
terraform plan -var-file="terraform.tfvars.dev"
terraform apply -var-file="terraform.tfvars.dev"

# Staging
terraform plan -var-file="terraform.tfvars.staging"
terraform apply -var-file="terraform.tfvars.staging"

# Production
terraform plan -var-file="terraform.tfvars.prod"
terraform apply -var-file="terraform.tfvars.prod"
```

## 🔒 Security Features

### Network Security
- Private GKE nodes with no external IPs
- VPC with custom subnets and routing
- Cloud NAT for outbound internet access
- Firewall rules with least privilege access
- Cloud Armor security policies

### Data Security
- Encryption at rest using Cloud KMS
- Encryption in transit with TLS 1.2+
- Secret Manager for sensitive data
- Private IP addresses for databases
- VPC Service Controls (in production)

### Access Control
- Workload Identity for secure pod access
- Least privilege IAM service accounts
- Conditional IAM policies
- Binary authorization for container images
- Audit logging for all API calls

## 📊 Monitoring and Alerting

### Built-in Monitoring
- Application uptime checks
- Database performance monitoring
- Redis cache monitoring
- Load balancer metrics
- GKE cluster health
- DNS query monitoring

### Alert Policies
- Application downtime
- High error rates
- Resource utilization
- Security events
- Performance degradation

### Dashboards
- Main application dashboard
- Database performance dashboard
- Redis cache dashboard
- DNS monitoring dashboard

## 💾 Backup and Disaster Recovery

### Automated Backups
- Daily database backups with point-in-time recovery
- Redis persistence with RDB snapshots
- Application data backups to Cloud Storage
- Cross-region backup replication (production)

### Backup Testing
```bash
# Test database backup restoration
gcloud sql backups create --instance=learning-assistant-db

# Test Redis backup
# Backups are automatically handled by Cloud Functions
```

## 🔧 Operations

### Scaling

#### Manual Scaling
```bash
# Scale GKE nodes
gcloud container clusters resize learning-assistant-cluster \
  --num-nodes=5 --region=us-central1

# Scale application pods
kubectl scale deployment learning-assistant --replicas=5
```

#### Auto-scaling
- GKE cluster auto-scaling (1-10 nodes)
- Horizontal Pod Autoscaler (HPA)
- Vertical Pod Autoscaler (VPA)
- Database read replicas

### Updates

#### Infrastructure Updates
```bash
# Update Terraform configuration
terraform plan
terraform apply

# Update GKE cluster
gcloud container clusters upgrade learning-assistant-cluster \
  --region=us-central1
```

#### Application Updates
```bash
# Update container image
kubectl set image deployment/learning-assistant \
  app=gcr.io/your-project/learning-assistant:v2.0.0

# Rolling update
kubectl rollout status deployment/learning-assistant
```

### Troubleshooting

#### Common Issues

1. **GKE Nodes Not Ready**
   ```bash
   kubectl get nodes
   kubectl describe node <node-name>
   ```

2. **Database Connection Issues**
   ```bash
   # Check Cloud SQL proxy
   cloud_sql_proxy -instances=your-project:region:instance=tcp:5432
   
   # Test connection
   psql -h 127.0.0.1 -p 5432 -U app_user learning_assistant
   ```

3. **DNS Resolution Issues**
   ```bash
   # Check DNS records
   nslookup app.learning-assistant.com
   
   # Check Cloud DNS
   gcloud dns record-sets list --zone=learning-assistant-zone
   ```

4. **Load Balancer Issues**
   ```bash
   # Check backend health
   gcloud compute backend-services get-health learning-assistant-backend \
     --global
   ```

#### Logs and Debugging
```bash
# View GKE cluster logs
gcloud logging read "resource.type=k8s_cluster" --limit=50

# View application logs
kubectl logs -f deployment/learning-assistant

# View database logs
gcloud logging read "resource.type=cloudsql_database" --limit=50
```

## 💰 Cost Optimization

### Cost Monitoring
- Budget alerts configured
- Committed use discounts recommended
- Rightsizing recommendations enabled
- Preemptible nodes for development

### Cost Reduction Tips
1. Use preemptible nodes for non-production
2. Enable cluster autoscaling
3. Set appropriate resource requests/limits
4. Use regional persistent disks
5. Clean up unused resources regularly

### Estimated Costs (Monthly)
| Component | Development | Production |
|-----------|-------------|------------|
| GKE Cluster | $50-100 | $200-400 |
| Cloud SQL | $30-60 | $100-300 |
| Redis | $15-30 | $50-150 |
| Load Balancer | $10-20 | $20-50 |
| Storage | $5-15 | $10-50 |
| Monitoring | $10-20 | $20-100 |
| **Total** | **$120-245** | **$400-1050** |

## 🔄 CI/CD Integration

### Cloud Build Integration
The infrastructure includes Cloud Build triggers for automated deployments.

### GitHub Actions Example
```yaml
name: Deploy to GCP
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Cloud SDK
      uses: google-github-actions/setup-gcloud@v0
      with:
        service_account_key: ${{ secrets.GCP_SA_KEY }}
        project_id: ${{ secrets.GCP_PROJECT_ID }}
    
    - name: Deploy infrastructure
      run: |
        cd infrastructure/gcp
        terraform init
        terraform apply -auto-approve
```

## 🧪 Testing

### Infrastructure Testing
```bash
# Validate Terraform configuration
terraform validate

# Check formatting
terraform fmt -check

# Security scanning with Checkov
pip install checkov
checkov -f main.tf

# Test deployment in development
terraform plan -var-file="terraform.tfvars.dev"
```

### Application Testing
```bash
# Health check
curl https://app.learning-assistant.com/health

# Load testing
ab -n 1000 -c 10 https://app.learning-assistant.com/

# Database connectivity test
kubectl run postgres-test --image=postgres:13 --rm -it -- \
  psql -h <db-ip> -U app_user learning_assistant
```

## 📚 Additional Resources

### Documentation
- [GCP Best Practices](https://cloud.google.com/docs/enterprise/best-practices-for-enterprise-organizations)
- [GKE Security Best Practices](https://cloud.google.com/kubernetes-engine/docs/how-to/hardening-your-cluster)
- [Terraform GCP Provider](https://registry.terraform.io/providers/hashicorp/google/latest/docs)

### Support
- Create GitHub issues for infrastructure problems
- Check GCP Console for service status
- Monitor alerts in Cloud Monitoring
- Review logs in Cloud Logging

## 🚨 Emergency Procedures

### Incident Response
1. Check monitoring dashboards
2. Review recent changes in Cloud Logging
3. Scale resources if needed
4. Contact on-call engineer
5. Document incident in post-mortem

### Rollback Procedures
```bash
# Rollback Terraform changes
terraform plan -destroy
terraform apply -target=resource.name

# Rollback Kubernetes deployment
kubectl rollout undo deployment/learning-assistant

# Restore database from backup
gcloud sql backups restore BACKUP_ID \
  --restore-instance=learning-assistant-db
```

---

For questions or support, please contact the platform team or create an issue in the repository.