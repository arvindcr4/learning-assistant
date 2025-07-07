# Google Cloud Platform (GCP) Deployment Guide

## Overview

Google Cloud Platform offers multiple deployment options from serverless Cloud Run to full Kubernetes clusters with GKE. This guide covers the most effective deployment strategies for the Learning Assistant application.

## Prerequisites

### Required
- Google Cloud Account ([sign up](https://cloud.google.com/))
- Google Cloud SDK (gcloud CLI) installed
- Docker installed
- Git repository

### Optional
- Kubernetes knowledge (for GKE)
- Terraform knowledge

## Deployment Options

### 1. Cloud Run (Recommended)
- Serverless containers
- Pay-per-use pricing
- Automatic scaling
- Zero infrastructure management

### 2. Google Kubernetes Engine (GKE)
- Managed Kubernetes
- Auto-scaling
- Advanced networking
- Enterprise features

### 3. Compute Engine
- Virtual machines
- Full control
- Custom configuration
- Self-managed

### 4. App Engine
- Platform-as-a-Service
- Managed runtime
- Automatic scaling
- Language-specific

## Option 1: Cloud Run (5-10 minutes)

### 1. Setup Google Cloud
```bash
# Install gcloud CLI
# macOS
brew install google-cloud-sdk

# Initialize gcloud
gcloud init

# Set project
gcloud config set project your-project-id

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### 2. Build and Deploy
```bash
# Clone repository
git clone https://github.com/your-username/learning-assistant.git
cd learning-assistant

# Build with Cloud Build
gcloud builds submit --tag gcr.io/your-project-id/learning-assistant

# Deploy to Cloud Run
gcloud run deploy learning-assistant \
  --image gcr.io/your-project-id/learning-assistant \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production,PORT=3000,NEXT_TELEMETRY_DISABLED=1
```

### 3. Set Environment Variables
```bash
# Set environment variables
gcloud run services update learning-assistant \
  --region us-central1 \
  --set-env-vars \
  NODE_ENV=production,\
  PORT=3000,\
  NEXT_TELEMETRY_DISABLED=1,\
  DATABASE_URL=sqlite:./app.db,\
  BETTER_AUTH_SECRET=your-secure-secret,\
  FEATURE_ANALYTICS_ENABLED=true,\
  FEATURE_RECOMMENDATIONS_ENABLED=true,\
  FEATURE_CHAT_ENABLED=true
```

### 4. Configure Custom Domain
```bash
# Map custom domain
gcloud run domain-mappings create \
  --service learning-assistant \
  --domain your-domain.com \
  --region us-central1
```

## Option 2: GKE Deployment (15-20 minutes)

### 1. Create GKE Cluster
```bash
# Create cluster
gcloud container clusters create learning-assistant-cluster \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type e2-standard-2 \
  --enable-autoscaling \
  --min-nodes 1 \
  --max-nodes 10 \
  --enable-autorepair \
  --enable-autoupgrade

# Get credentials
gcloud container clusters get-credentials learning-assistant-cluster --zone us-central1-a
```

### 2. Build and Push Image
```bash
# Build image
docker build -t gcr.io/your-project-id/learning-assistant .

# Push to Container Registry
docker push gcr.io/your-project-id/learning-assistant
```

### 3. Kubernetes Manifests
```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: learning-assistant
---
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: learning-assistant
  namespace: learning-assistant
spec:
  replicas: 3
  selector:
    matchLabels:
      app: learning-assistant
  template:
    metadata:
      labels:
        app: learning-assistant
    spec:
      containers:
      - name: app
        image: gcr.io/your-project-id/learning-assistant:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
        - name: NEXT_TELEMETRY_DISABLED
          value: "1"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database-url
        - name: BETTER_AUTH_SECRET
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: auth-secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: learning-assistant-service
  namespace: learning-assistant
spec:
  selector:
    app: learning-assistant
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: learning-assistant-ingress
  namespace: learning-assistant
  annotations:
    kubernetes.io/ingress.class: "gce"
    kubernetes.io/ingress.global-static-ip-name: "learning-assistant-ip"
    networking.gke.io/managed-certificates: "learning-assistant-ssl"
spec:
  rules:
  - host: your-domain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: learning-assistant-service
            port:
              number: 80
```

### 4. Deploy to GKE
```bash
# Create secrets
kubectl create secret generic app-secrets \
  --from-literal=database-url="postgresql://user:pass@host:5432/database" \
  --from-literal=auth-secret="your-secure-secret" \
  -n learning-assistant

# Apply manifests
kubectl apply -f k8s/

# Check deployment
kubectl get pods -n learning-assistant
kubectl get services -n learning-assistant
```

## Option 3: Compute Engine

### 1. Create VM Instance
```bash
# Create instance
gcloud compute instances create learning-assistant-vm \
  --zone us-central1-a \
  --machine-type e2-standard-2 \
  --image-family ubuntu-2204-lts \
  --image-project ubuntu-os-cloud \
  --boot-disk-size 20GB \
  --tags http-server,https-server

# Create firewall rules
gcloud compute firewall-rules create allow-http \
  --allow tcp:80 \
  --target-tags http-server

gcloud compute firewall-rules create allow-https \
  --allow tcp:443 \
  --target-tags https-server
```

### 2. Setup Script
```bash
# SSH to instance
gcloud compute ssh learning-assistant-vm --zone us-central1-a

# Install dependencies
sudo apt update
sudo apt install -y docker.io docker-compose nodejs npm git

# Start Docker
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER

# Clone and deploy
git clone https://github.com/your-username/learning-assistant.git
cd learning-assistant

# Set environment variables
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
NEXT_TELEMETRY_DISABLED=1
DATABASE_URL=sqlite:./app.db
BETTER_AUTH_SECRET=your-secure-secret
FEATURE_ANALYTICS_ENABLED=true
FEATURE_RECOMMENDATIONS_ENABLED=true
FEATURE_CHAT_ENABLED=true
EOF

# Deploy
sudo docker-compose up -d
```

## Option 4: App Engine

### 1. App Engine Configuration
```yaml
# app.yaml
runtime: nodejs20
service: default
instance_class: F2
automatic_scaling:
  min_instances: 1
  max_instances: 10
  target_cpu_utilization: 0.6

env_variables:
  NODE_ENV: production
  PORT: 8080
  NEXT_TELEMETRY_DISABLED: 1
  DATABASE_URL: sqlite:./app.db
  BETTER_AUTH_SECRET: your-secure-secret
  FEATURE_ANALYTICS_ENABLED: true
  FEATURE_RECOMMENDATIONS_ENABLED: true
  FEATURE_CHAT_ENABLED: true

handlers:
- url: /.*
  script: auto
```

### 2. Deploy to App Engine
```bash
# Deploy
gcloud app deploy app.yaml

# View logs
gcloud app logs tail -s default
```

## Database Setup

### 1. Cloud SQL (PostgreSQL)
```bash
# Create Cloud SQL instance
gcloud sql instances create learning-assistant-db \
  --database-version POSTGRES_15 \
  --tier db-f1-micro \
  --region us-central1 \
  --root-password your-secure-password \
  --storage-size 10GB \
  --storage-type SSD

# Create database
gcloud sql databases create learning_assistant --instance learning-assistant-db

# Create user
gcloud sql users create learning_user \
  --instance learning-assistant-db \
  --password user-password

# Get connection string
gcloud sql instances describe learning-assistant-db --format="value(connectionName)"
```

### 2. Cloud Firestore (NoSQL)
```bash
# Enable Firestore
gcloud firestore databases create --region us-central1

# Set up Firestore rules
gcloud firestore rules update firestore.rules
```

### 3. Memory Store (Redis)
```bash
# Create Redis instance
gcloud redis instances create learning-assistant-redis \
  --size 1 \
  --region us-central1 \
  --redis-version redis_6_x

# Get connection details
gcloud redis instances describe learning-assistant-redis --region us-central1
```

## Environment Variables & Secrets

### 1. Secret Manager
```bash
# Enable Secret Manager
gcloud services enable secretmanager.googleapis.com

# Create secrets
echo "your-secure-secret" | gcloud secrets create auth-secret --data-file=-
echo "postgresql://user:pass@host:5432/database" | gcloud secrets create database-url --data-file=-

# Grant access to Cloud Run
gcloud secrets add-iam-policy-binding auth-secret \
  --member="serviceAccount:your-project-id@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 2. Use Secrets in Cloud Run
```bash
# Deploy with secrets
gcloud run deploy learning-assistant \
  --image gcr.io/your-project-id/learning-assistant \
  --set-secrets="/secrets/auth-secret=auth-secret:latest" \
  --set-secrets="/secrets/database-url=database-url:latest" \
  --region us-central1
```

## Domain & SSL

### 1. Cloud DNS
```bash
# Create DNS zone
gcloud dns managed-zones create learning-assistant-zone \
  --dns-name your-domain.com \
  --description "Learning Assistant DNS zone"

# Add A record
gcloud dns record-sets transaction start --zone learning-assistant-zone
gcloud dns record-sets transaction add \
  --zone learning-assistant-zone \
  --name your-domain.com \
  --type A \
  --ttl 300 \
  --rrdatas "your-ip-address"
gcloud dns record-sets transaction execute --zone learning-assistant-zone
```

### 2. SSL Certificate
```bash
# Create SSL certificate
gcloud compute ssl-certificates create learning-assistant-ssl \
  --domains your-domain.com

# For managed certificates (GKE)
kubectl apply -f - <<EOF
apiVersion: networking.gke.io/v1
kind: ManagedCertificate
metadata:
  name: learning-assistant-ssl
  namespace: learning-assistant
spec:
  domains:
  - your-domain.com
EOF
```

## Monitoring & Logging

### 1. Cloud Monitoring
```bash
# Enable monitoring
gcloud services enable monitoring.googleapis.com

# Create uptime check
gcloud alpha monitoring uptime create learning-assistant-uptime \
  --display-name "Learning Assistant Uptime" \
  --http-check-path "/api/health" \
  --hostname "your-domain.com" \
  --port 443 \
  --use-ssl
```

### 2. Cloud Logging
```bash
# View logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=learning-assistant"

# Create log-based metric
gcloud logging metrics create error_count \
  --description "Count of error logs" \
  --log-filter "resource.type=cloud_run_revision AND severity>=ERROR"
```

### 3. Error Reporting
```bash
# Enable Error Reporting
gcloud services enable clouderrorreporting.googleapis.com

# Add to your application
npm install @google-cloud/error-reporting
```

## Auto Scaling

### 1. Cloud Run Auto Scaling
```bash
# Configure auto scaling
gcloud run services update learning-assistant \
  --region us-central1 \
  --min-instances 1 \
  --max-instances 100 \
  --cpu 2 \
  --memory 1Gi \
  --concurrency 80
```

### 2. GKE Auto Scaling
```bash
# Horizontal Pod Autoscaler
kubectl autoscale deployment learning-assistant \
  --cpu-percent=50 \
  --min=1 \
  --max=10 \
  -n learning-assistant

# Vertical Pod Autoscaler
kubectl apply -f - <<EOF
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: learning-assistant-vpa
  namespace: learning-assistant
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: learning-assistant
  updatePolicy:
    updateMode: "Auto"
EOF
```

## Cost Optimization

### Estimated Monthly Costs
- **Cloud Run**: $0-25 (pay-per-use)
- **GKE**: $75+ (cluster) + nodes
- **Compute Engine**: $15-50 (e2-standard-2)
- **Cloud SQL**: $7-25 (db-f1-micro)
- **Memory Store**: $35+ (1GB Redis)

### Cost-Saving Tips
1. **Preemptible Instances**: For GKE nodes
2. **Committed Use Discounts**: For predictable workloads
3. **Auto-scaling**: Scale down during low usage
4. **Regional vs Multi-Regional**: Choose appropriate regions
5. **Storage Classes**: Use appropriate storage tiers

## Security Best Practices

### 1. IAM & Service Accounts
```bash
# Create service account
gcloud iam service-accounts create learning-assistant-sa \
  --display-name "Learning Assistant Service Account"

# Grant minimal permissions
gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:learning-assistant-sa@your-project-id.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

# Use service account
gcloud run services update learning-assistant \
  --service-account learning-assistant-sa@your-project-id.iam.gserviceaccount.com \
  --region us-central1
```

### 2. VPC Security
```bash
# Create VPC
gcloud compute networks create learning-assistant-vpc --subnet-mode custom

# Create subnet
gcloud compute networks subnets create learning-assistant-subnet \
  --network learning-assistant-vpc \
  --range 10.0.1.0/24 \
  --region us-central1

# Create firewall rules
gcloud compute firewall-rules create allow-internal \
  --network learning-assistant-vpc \
  --allow tcp,udp,icmp \
  --source-ranges 10.0.1.0/24
```

### 3. Security Scanner
```bash
# Enable Security Command Center
gcloud services enable securitycenter.googleapis.com

# Run security scan
gcloud app deploy --quiet
gcloud alpha web-security-scanner scan-runs start \
  --starting-urls "https://your-domain.com"
```

## CI/CD Pipeline

### 1. Cloud Build
```yaml
# cloudbuild.yaml
steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/learning-assistant:$COMMIT_SHA', '.']
    
  # Push the container image to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/learning-assistant:$COMMIT_SHA']
    
  # Deploy container image to Cloud Run
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'learning-assistant'
      - '--image'
      - 'gcr.io/$PROJECT_ID/learning-assistant:$COMMIT_SHA'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'

options:
  logging: CLOUD_LOGGING_ONLY
```

### 2. GitHub Actions
```yaml
# .github/workflows/gcp-deploy.yml
name: Deploy to GCP

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Google Cloud SDK
        uses: google-github-actions/setup-gcloud@v1
        with:
          project_id: ${{ secrets.GCP_PROJECT_ID }}
          service_account_key: ${{ secrets.GCP_SA_KEY }}
          export_default_credentials: true
      
      - name: Configure Docker
        run: gcloud auth configure-docker
      
      - name: Build and push Docker image
        run: |
          docker build -t gcr.io/${{ secrets.GCP_PROJECT_ID }}/learning-assistant:${{ github.sha }} .
          docker push gcr.io/${{ secrets.GCP_PROJECT_ID }}/learning-assistant:${{ github.sha }}
      
      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy learning-assistant \
            --image gcr.io/${{ secrets.GCP_PROJECT_ID }}/learning-assistant:${{ github.sha }} \
            --region us-central1 \
            --platform managed \
            --allow-unauthenticated
```

## Troubleshooting

### Common Issues

#### 1. Cloud Run Cold Starts
```bash
# Set minimum instances
gcloud run services update learning-assistant \
  --min-instances 1 \
  --region us-central1

# Check startup time
gcloud run services describe learning-assistant --region us-central1
```

#### 2. Database Connection Issues
```bash
# Check Cloud SQL connections
gcloud sql instances describe learning-assistant-db

# Test connection
gcloud sql connect learning-assistant-db --user postgres
```

#### 3. Build Failures
```bash
# Check build logs
gcloud builds log $(gcloud builds list --limit 1 --format="value(id)")

# Debug build
gcloud builds submit --config cloudbuild.yaml --substitutions=_ENV=debug
```

### Debugging Commands
```bash
# Cloud Run
gcloud run services list
gcloud run services describe learning-assistant --region us-central1
gcloud run revisions list --service learning-assistant --region us-central1

# GKE
kubectl get pods -n learning-assistant
kubectl logs -f deployment/learning-assistant -n learning-assistant
kubectl describe service learning-assistant-service -n learning-assistant

# Compute Engine
gcloud compute instances list
gcloud compute ssh learning-assistant-vm --zone us-central1-a
```

## Support Resources

### Official Documentation
- [Google Cloud Documentation](https://cloud.google.com/docs)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [GKE Documentation](https://cloud.google.com/kubernetes-engine/docs)
- [Google Cloud Support](https://cloud.google.com/support)

### Useful Commands
```bash
# General
gcloud config list
gcloud projects list
gcloud services list --enabled

# Cloud Run
gcloud run services list
gcloud run services describe SERVICE_NAME --region REGION

# GKE
gcloud container clusters list
kubectl cluster-info
```

## Next Steps

1. **Choose Method**: Cloud Run → GKE based on needs
2. **Set up Database**: Cloud SQL for production
3. **Configure Domain**: Cloud DNS and SSL
4. **Set up Monitoring**: Cloud Monitoring and Logging
5. **Implement CI/CD**: Cloud Build or GitHub Actions
6. **Optimize Performance**: Auto-scaling and caching

---

**Tip**: Start with Cloud Run for the simplest serverless deployment, then migrate to GKE if you need more control. Google Cloud's managed services handle most operational concerns, letting you focus on your application.