# DigitalOcean Deployment Guide

## Overview

DigitalOcean provides multiple deployment options from simple App Platform deployments to full Kubernetes clusters. This guide covers App Platform (PaaS) and Droplet (VPS) deployment methods.

## Prerequisites

### Required
- DigitalOcean account ([sign up](https://cloud.digitalocean.com/registrations/new))
- GitHub/GitLab repository
- Git repository with your code

### Optional
- DigitalOcean CLI (`doctl`)
- Docker knowledge
- Kubernetes knowledge (for DOKS)

## Deployment Options

### 1. App Platform (Recommended)
- Managed PaaS solution
- Automatic scaling
- Integrated databases
- Easy deployment

### 2. Droplets (VPS)
- Full control over server
- Custom configuration
- Docker Compose deployment
- Cost-effective

### 3. Kubernetes (DOKS)
- Container orchestration
- High availability
- Advanced scaling
- Enterprise features

## Option 1: App Platform Deployment (5-8 minutes)

### Quick Web Deployment
1. **Go to DigitalOcean Console**: https://cloud.digitalocean.com/apps
2. **Create App**: Click "Create App"
3. **Connect Repository**: Choose GitHub and authorize access
4. **Select Repository**: Choose your `learning-assistant` repository
5. **Configure Build**: Set build and run commands

### App Configuration
```yaml
# .do/app.yaml
name: learning-assistant
services:
- name: web
  source_dir: /
  github:
    repo: your-username/learning-assistant
    branch: main
    deploy_on_push: true
  run_command: npm start
  build_command: npm run build
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  http_port: 3000
  routes:
  - path: /
  envs:
  - key: NODE_ENV
    value: production
  - key: PORT
    value: "3000"
  - key: NEXT_TELEMETRY_DISABLED
    value: "1"
  - key: DATABASE_URL
    value: sqlite:./app.db
  - key: BETTER_AUTH_SECRET
    value: your-secure-secret-key
  - key: NEXT_PUBLIC_API_URL
    value: https://learning-assistant-xxxxx.ondigitalocean.app
  - key: NEXT_PUBLIC_APP_URL
    value: https://learning-assistant-xxxxx.ondigitalocean.app
  - key: FEATURE_ANALYTICS_ENABLED
    value: "true"
  - key: FEATURE_RECOMMENDATIONS_ENABLED
    value: "true"
  - key: FEATURE_CHAT_ENABLED
    value: "true"
```

### Database Setup (App Platform)
```yaml
# Add to .do/app.yaml
databases:
- name: learning-assistant-db
  engine: PG
  version: "15"
  size: db-s-1vcpu-1gb
  num_nodes: 1
```

### Deploy via CLI
```bash
# Install doctl
# macOS
brew install doctl

# Linux
snap install doctl

# Login
doctl auth init

# Deploy
doctl apps create --spec .do/app.yaml
```

## Option 2: Droplet Deployment (10-15 minutes)

### 1. Create Droplet
```bash
# Using doctl
doctl compute droplet create learning-assistant \
  --image ubuntu-22-04-x64 \
  --size s-2vcpu-2gb \
  --region nyc3 \
  --ssh-keys your-ssh-key-id

# Or use the web interface
```

### 2. SSH and Setup
```bash
# SSH to droplet
ssh root@your-droplet-ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install Node.js (for direct deployment)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
```

### 3. Deploy Application
```bash
# Clone repository
git clone https://github.com/your-username/learning-assistant.git
cd learning-assistant

# Set environment variables
cp .env.example .env
nano .env

# Deploy with Docker Compose
docker-compose up -d

# Or build and run directly
npm install
npm run build
npm start
```

### 4. Configure Nginx (Optional)
```bash
# Install Nginx
apt install nginx -y

# Configure Nginx
cat > /etc/nginx/sites-available/learning-assistant << 'EOF'
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/learning-assistant /etc/nginx/sites-enabled/
systemctl restart nginx
```

## Option 3: Kubernetes (DOKS) Deployment

### 1. Create DOKS Cluster
```bash
# Create cluster
doctl kubernetes cluster create learning-assistant-cluster \
  --region nyc3 \
  --node-pool "name=worker-pool;size=s-2vcpu-2gb;count=2"

# Get credentials
doctl kubernetes cluster kubeconfig save learning-assistant-cluster
```

### 2. Kubernetes Manifests
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: learning-assistant
spec:
  replicas: 2
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
        image: your-registry/learning-assistant:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        - name: BETTER_AUTH_SECRET
          valueFrom:
            secretKeyRef:
              name: auth-secret
              key: secret
---
apiVersion: v1
kind: Service
metadata:
  name: learning-assistant-service
spec:
  selector:
    app: learning-assistant
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

### 3. Deploy to Kubernetes
```bash
# Apply manifests
kubectl apply -f k8s/

# Check deployment
kubectl get pods
kubectl get services
```

## Environment Variables

### Complete Environment Configuration
```bash
# Core Application
NODE_ENV=production
PORT=3000
NEXT_TELEMETRY_DISABLED=1

# Database
DATABASE_URL=postgresql://user:pass@host:5432/database
# OR for SQLite
DATABASE_URL=sqlite:./app.db

# Authentication
BETTER_AUTH_SECRET=your-secure-secret-key

# API URLs
NEXT_PUBLIC_API_URL=https://your-app.com
NEXT_PUBLIC_APP_URL=https://your-app.com

# Features
FEATURE_ANALYTICS_ENABLED=true
FEATURE_RECOMMENDATIONS_ENABLED=true
FEATURE_CHAT_ENABLED=true

# Optional
REDIS_URL=redis://host:6379
LOG_LEVEL=info
```

## Database Options

### 1. Managed PostgreSQL
```bash
# Create database
doctl databases create learning-assistant-db \
  --engine postgres \
  --region nyc3 \
  --size db-s-1vcpu-1gb

# Get connection info
doctl databases connection learning-assistant-db

# Connection string format
DATABASE_URL=postgresql://user:pass@host:25060/database?sslmode=require
```

### 2. Managed Redis
```bash
# Create Redis cluster
doctl databases create learning-assistant-redis \
  --engine redis \
  --region nyc3 \
  --size db-s-1vcpu-1gb

# Get connection info
doctl databases connection learning-assistant-redis
```

### 3. Self-hosted Database
```bash
# PostgreSQL on Droplet
apt install postgresql postgresql-contrib -y
sudo -u postgres createdb learning_assistant
sudo -u postgres createuser learning_user
```

## Custom Domain & SSL

### 1. Configure Domain
```bash
# Add A record
your-domain.com → droplet-ip

# For App Platform
your-domain.com → CNAME → learning-assistant-xxxxx.ondigitalocean.app
```

### 2. SSL Certificate
```bash
# Install Certbot
apt install certbot python3-certbot-nginx -y

# Get certificate
certbot --nginx -d your-domain.com

# Auto-renewal
crontab -e
0 12 * * * /usr/bin/certbot renew --quiet
```

## Monitoring & Logging

### App Platform Monitoring
- **Metrics**: Built-in CPU, memory, and request metrics
- **Logs**: Centralized logging in dashboard
- **Alerts**: Configure alerts for resource usage

### Droplet Monitoring
```bash
# Install monitoring agent
curl -sSL https://repos.insights.digitalocean.com/install.sh | sudo bash

# View metrics in DO dashboard
```

### Custom Monitoring
```bash
# Install Prometheus and Grafana
docker run -d --name prometheus prom/prometheus:latest
docker run -d --name grafana grafana/grafana:latest

# Configure monitoring stack
```

## Backup & Recovery

### Database Backups
```bash
# Automated backups for managed databases
doctl databases backup list learning-assistant-db

# Manual backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

### Application Backups
```bash
# Backup application data
tar -czf app-backup.tar.gz /app/data

# Backup to Spaces
doctl compute upload app-backup.tar.gz spaces://your-bucket/
```

## Scaling

### App Platform Scaling
```yaml
# Update .do/app.yaml
services:
- name: web
  instance_count: 3
  instance_size_slug: basic-xs
```

### Droplet Scaling
```bash
# Resize droplet
doctl compute droplet resize droplet-id --size s-4vcpu-8gb

# Add load balancer
doctl compute load-balancer create \
  --name learning-assistant-lb \
  --region nyc3 \
  --droplet-ids droplet-id-1,droplet-id-2
```

## Cost Optimization

### Estimated Costs
- **App Platform**: $12-48/month
- **Droplet**: $6-24/month
- **Managed Database**: $15-30/month
- **Load Balancer**: $12/month
- **Spaces**: $5/month

### Cost-Saving Tips
1. **Right-sizing**: Start with smaller instances
2. **Reserved Instances**: For long-term usage
3. **Monitoring**: Use built-in monitoring
4. **Backup Strategy**: Optimize backup retention

## Troubleshooting

### Common Issues

#### 1. App Platform Build Failures
```bash
# Check build logs in DO dashboard
# Common issues:
# - Node.js version mismatch
# - Build timeout
# - Missing environment variables
```

#### 2. Database Connection Issues
```bash
# Check connection string format
# Verify SSL mode for managed databases
# Test connection:
psql $DATABASE_URL -c "SELECT 1"
```

#### 3. Droplet Access Issues
```bash
# Check SSH key
ssh -i ~/.ssh/id_rsa root@droplet-ip

# Check firewall
ufw status
ufw allow 22
ufw allow 80
ufw allow 443
```

### Debugging Commands
```bash
# App Platform
doctl apps list
doctl apps logs app-id
doctl apps get app-id

# Droplets
doctl compute droplet list
doctl compute droplet get droplet-id
docker logs container-name
```

## Security Best Practices

### 1. Network Security
```bash
# Configure firewall
ufw enable
ufw allow ssh
ufw allow 80
ufw allow 443

# Use private networking
# Enable VPC for resources
```

### 2. Application Security
```bash
# Use strong secrets
BETTER_AUTH_SECRET=$(openssl rand -base64 32)

# Enable HTTPS only
# Use managed databases with SSL
```

### 3. Regular Updates
```bash
# Update system packages
apt update && apt upgrade -y

# Update Docker images
docker-compose pull
docker-compose up -d
```

## Support Resources

### Official Documentation
- [DigitalOcean Documentation](https://docs.digitalocean.com/)
- [App Platform Docs](https://docs.digitalocean.com/products/app-platform/)
- [Community Forum](https://www.digitalocean.com/community/)

### Useful Commands
```bash
# doctl commands
doctl apps list
doctl compute droplet list
doctl databases list
doctl kubernetes cluster list

# Docker commands
docker ps
docker logs container-name
docker-compose ps
```

## Next Steps

1. **Choose Method**: App Platform vs Droplet vs DOKS
2. **Deploy**: Follow the appropriate deployment guide
3. **Database**: Set up managed PostgreSQL
4. **Domain**: Configure custom domain and SSL
5. **Monitoring**: Set up alerts and logging
6. **Scale**: Optimize performance and costs

---

**Tip**: Start with App Platform for simplicity, then move to Droplets or DOKS as your needs grow. DigitalOcean's managed services make it easy to focus on your application rather than infrastructure management.