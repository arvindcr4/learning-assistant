# Render Deployment Guide

## Overview

Render is a unified platform for deploying web applications with automatic builds, deploys, and scaling. It provides excellent Docker support and integrated database services.

## Prerequisites

### Required
- Render account ([sign up](https://render.com/register))
- GitHub/GitLab repository
- Git repository with your code

### Optional
- Render CLI
- Docker knowledge

## Quick Deployment (5-8 minutes)

### 1. Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub/GitLab
3. Authorize Render to access your repositories

### 2. Create Web Service
1. **Dashboard**: Go to your Render dashboard
2. **New Service**: Click "New" → "Web Service"
3. **Connect Repository**: Select your `learning-assistant` repository
4. **Branch**: Choose `main` branch

### 3. Configure Service Settings
```
Name: learning-assistant
Region: Oregon (or nearest to you)
Branch: main
Runtime: Docker
```

### 4. Docker Configuration
```
Dockerfile Path: ./Dockerfile
Docker Context: .
Docker Command: (leave empty - uses Dockerfile CMD)
```

### 5. Environment Variables
Add these environment variables in the Render dashboard:

```bash
# Core Configuration
NODE_ENV=production
PORT=3000
NEXT_TELEMETRY_DISABLED=1

# Database (SQLite for quick start)
DATABASE_URL=sqlite:./app.db

# Authentication
BETTER_AUTH_SECRET=your-secure-secret-key

# API URLs (replace with your Render URL)
NEXT_PUBLIC_API_URL=https://learning-assistant.onrender.com
NEXT_PUBLIC_APP_URL=https://learning-assistant.onrender.com

# Features
FEATURE_ANALYTICS_ENABLED=true
FEATURE_RECOMMENDATIONS_ENABLED=true
FEATURE_CHAT_ENABLED=true
```

### 6. Deploy
1. Click "Create Web Service"
2. Wait for initial build (3-5 minutes)
3. Access your app at `https://your-app-name.onrender.com`

## Database Setup

### Option 1: SQLite (Quick Start)
```bash
# Already configured in environment variables
DATABASE_URL=sqlite:./app.db
```

### Option 2: PostgreSQL (Production)
1. **Create Database**: In Render dashboard, create new PostgreSQL database
2. **Get Connection String**: Copy the internal database URL
3. **Update Environment**: Set `DATABASE_URL` to the PostgreSQL connection string

```bash
# Example PostgreSQL URL
DATABASE_URL=postgres://user:pass@dpg-xxxxx-a.oregon-postgres.render.com/dbname
```

## Configuration Options

### Service Configuration
```yaml
# render.yaml (optional)
services:
  - type: web
    name: learning-assistant
    env: docker
    dockerfilePath: ./Dockerfile
    dockerContext: .
    plan: starter
    region: oregon
    branch: main
    buildCommand: ""
    startCommand: ""
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: '3000'
      - key: NEXT_TELEMETRY_DISABLED
        value: '1'
      - key: DATABASE_URL
        value: sqlite:./app.db
      - key: BETTER_AUTH_SECRET
        generateValue: true
      - key: NEXT_PUBLIC_API_URL
        value: https://learning-assistant.onrender.com
      - key: NEXT_PUBLIC_APP_URL
        value: https://learning-assistant.onrender.com
```

### Auto-Deploy Configuration
```yaml
# Enable auto-deploy from GitHub
services:
  - type: web
    name: learning-assistant
    env: docker
    dockerfilePath: ./Dockerfile
    dockerContext: .
    autoDeploy: true
    branch: main
```

## Environment Variables

### Complete Environment Setup
```bash
# Core Application
NODE_ENV=production
PORT=3000
NEXT_TELEMETRY_DISABLED=1

# Database Options
DATABASE_URL=sqlite:./app.db
# OR for PostgreSQL
DATABASE_URL=postgres://user:pass@host:5432/database

# Authentication
BETTER_AUTH_SECRET=your-secure-secret-key

# API URLs (update with your Render URL)
NEXT_PUBLIC_API_URL=https://your-app-name.onrender.com
NEXT_PUBLIC_APP_URL=https://your-app-name.onrender.com

# Features
FEATURE_ANALYTICS_ENABLED=true
FEATURE_RECOMMENDATIONS_ENABLED=true
FEATURE_CHAT_ENABLED=true

# Optional: Redis
REDIS_URL=redis://user:pass@host:6379

# Optional: Logging
LOG_LEVEL=info
```

## Custom Domain

### 1. Add Custom Domain
1. Go to your service settings
2. Click "Custom Domains"
3. Add your domain name
4. Follow DNS setup instructions

### 2. DNS Configuration
```bash
# Add CNAME record
www.your-domain.com → your-app-name.onrender.com

# Add A record for apex domain
your-domain.com → Render's IP (provided in dashboard)
```

### 3. SSL Certificate
- Render automatically provides SSL certificates
- Certificates are managed and renewed automatically
- Force HTTPS is enabled by default

## Monitoring & Logging

### View Logs
```bash
# In Render dashboard
1. Go to your service
2. Click "Logs" tab
3. View real-time logs

# Using Render CLI
render logs --service learning-assistant
```

### Health Checks
```yaml
# render.yaml
services:
  - type: web
    name: learning-assistant
    healthCheckPath: /api/health
```

### Monitoring
- **Metrics**: CPU, memory, and request metrics in dashboard
- **Alerts**: Set up alerts for service issues
- **Uptime**: Monitor service availability

## Advanced Configuration

### Multiple Services
```yaml
# render.yaml
services:
  - type: web
    name: learning-assistant-web
    env: docker
    dockerfilePath: ./Dockerfile
    dockerContext: .
    
  - type: worker
    name: learning-assistant-worker
    env: docker
    dockerfilePath: ./Dockerfile.worker
    dockerContext: .
    
databases:
  - name: learning-assistant-db
    databaseName: learning_assistant
    user: learning_user
```

### Redis Service
```yaml
# render.yaml
services:
  - type: redis
    name: learning-assistant-redis
    region: oregon
    plan: starter
    maxmemoryPolicy: allkeys-lru
```

### Cron Jobs
```yaml
# render.yaml
services:
  - type: cron
    name: learning-assistant-cron
    env: docker
    dockerfilePath: ./Dockerfile
    dockerContext: .
    schedule: "0 2 * * *"  # Daily at 2 AM
    buildCommand: ""
    startCommand: "npm run cron"
```

## Render CLI Usage

### Install CLI
```bash
# Install Render CLI
npm install -g @render/cli

# Or via pip
pip install render-cli
```

### CLI Commands
```bash
# Login
render login

# Deploy
render deploy

# View services
render services list

# View logs
render logs --service learning-assistant

# Scale service
render scale --service learning-assistant --plan standard
```

## Troubleshooting

### Common Issues

#### 1. Build Failures
```bash
# Check build logs in Render dashboard
# Common issues:
# - Node.js version mismatch
# - Missing environment variables
# - Docker build context issues

# Fix Node.js version
# Ensure package.json has:
"engines": {
  "node": "20.x"
}
```

#### 2. Database Connection Issues
```bash
# Check database URL format
# PostgreSQL format:
DATABASE_URL=postgres://user:pass@host:5432/database

# Test connection
npx pg-connection-string parse $DATABASE_URL
```

#### 3. Environment Variable Issues
```bash
# Check environment variables in Render dashboard
# Ensure all required variables are set
# Check for typos in variable names
```

#### 4. Docker Issues
```bash
# Test Docker build locally
docker build -t learning-assistant .
docker run -p 3000:3000 learning-assistant

# Check Dockerfile path in Render settings
```

### Debugging Steps
1. **Check Logs**: Review build and runtime logs
2. **Environment Variables**: Verify all required variables are set
3. **Database**: Test database connection
4. **Health Check**: Verify `/api/health` endpoint works
5. **Local Testing**: Test Docker build locally

## Performance Optimization

### Service Plans
```
Starter: $7/month
- 512MB RAM
- 0.5 CPU
- Good for development

Standard: $25/month
- 2GB RAM
- 1 CPU
- Production ready

Pro: $85/month
- 4GB RAM
- 2 CPU
- High performance
```

### Optimization Tips
1. **Image Optimization**: Use multi-stage Docker builds
2. **Caching**: Enable build caching
3. **Database**: Use connection pooling
4. **Static Assets**: Use CDN for static files

## Cost Optimization

### Estimated Costs
- **Starter Plan**: $7/month
- **Standard Plan**: $25/month
- **Pro Plan**: $85/month
- **Database**: $7/month (PostgreSQL)
- **Redis**: $3/month

### Cost-Saving Tips
1. **Right-sizing**: Start with Starter plan
2. **Sleep Mode**: Use for development (free tier)
3. **Resource Monitoring**: Monitor usage patterns
4. **Database**: Use SQLite for small applications

## CI/CD Integration

### GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy to Render

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Render
        uses: render-deploy/action@v1
        with:
          render-token: ${{ secrets.RENDER_TOKEN }}
          service-id: ${{ secrets.RENDER_SERVICE_ID }}
```

### Automatic Deploys
- **Enable**: Turn on auto-deploy in service settings
- **Branch**: Deploy from specific branch
- **Webhooks**: Custom deploy triggers

## Security Best Practices

### 1. Environment Variables
```bash
# Use Render's secret management
# Generate secure secrets
BETTER_AUTH_SECRET=$(openssl rand -base64 32)

# Use environment-specific URLs
NEXT_PUBLIC_API_URL=https://your-app.onrender.com
```

### 2. Database Security
```bash
# Use PostgreSQL with SSL
DATABASE_URL=postgres://user:pass@host:5432/db?sslmode=require

# Enable connection pooling
# Use strong passwords
```

### 3. Network Security
```yaml
# render.yaml
services:
  - type: web
    name: learning-assistant
    headers:
      X-Frame-Options: DENY
      X-Content-Type-Options: nosniff
      Strict-Transport-Security: max-age=31536000
```

## Support Resources

### Official Documentation
- [Render Documentation](https://render.com/docs)
- [Render Community](https://community.render.com/)
- [Status Page](https://status.render.com/)

### Useful Commands
```bash
# Service management
render services list
render services logs --service learning-assistant
render services restart --service learning-assistant

# Database management
render databases list
render databases connect --database learning-assistant-db

# Domain management
render domains list
render domains add --service learning-assistant your-domain.com
```

## Next Steps

1. **Deploy**: Follow the quick deployment guide
2. **Database**: Set up PostgreSQL for production
3. **Domain**: Configure custom domain
4. **Monitoring**: Set up alerts and logging
5. **CI/CD**: Automate deployments
6. **Scale**: Upgrade plan as needed

---

**Tip**: Start with the Starter plan and SQLite for development, then upgrade to Standard plan with PostgreSQL for production. Render's auto-scaling and managed services make it easy to grow your application.