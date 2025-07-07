# Railway Deployment Guide

## Overview

Railway is a modern deployment platform that focuses on developer experience. It provides Git-based deployments, automatic CI/CD, and excellent integration with popular frameworks including Next.js.

## Prerequisites

### Required
- Railway account ([sign up](https://railway.app/login))
- GitHub/GitLab repository
- Git repository with your code

### Optional
- Railway CLI
- Docker knowledge

## Quick Deployment (3-5 minutes)

### 1. Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub/GitLab
3. Authorize Railway to access your repositories

### 2. Deploy from GitHub
1. **New Project**: Click "New Project"
2. **Deploy from GitHub**: Select "Deploy from GitHub repo"
3. **Select Repository**: Choose your `learning-assistant` repository
4. **Deploy**: Railway will automatically detect Next.js and deploy

### 3. Automatic Configuration
Railway automatically detects:
- Next.js framework
- Node.js version from package.json
- Build and start commands
- Port configuration

## Environment Variables

### Set Environment Variables
```bash
# In Railway dashboard, go to Variables tab
NODE_ENV=production
PORT=3000
NEXT_TELEMETRY_DISABLED=1

# Database (SQLite for quick start)
DATABASE_URL=sqlite:./app.db

# Authentication
BETTER_AUTH_SECRET=your-secure-secret-key

# API URLs (Railway provides these automatically)
NEXT_PUBLIC_API_URL=${{RAILWAY_STATIC_URL}}
NEXT_PUBLIC_APP_URL=${{RAILWAY_STATIC_URL}}

# Features
FEATURE_ANALYTICS_ENABLED=true
FEATURE_RECOMMENDATIONS_ENABLED=true
FEATURE_CHAT_ENABLED=true
```

### Railway Variables
Railway provides built-in variables:
```bash
# Automatic Railway variables
RAILWAY_STATIC_URL=https://your-app-production.up.railway.app
RAILWAY_PUBLIC_DOMAIN=your-app-production.up.railway.app
PORT=3000  # Automatically set
```

## Database Setup

### Option 1: SQLite (Quick Start)
```bash
# Set in Railway dashboard
DATABASE_URL=sqlite:/app/data/app.db
```

### Option 2: PostgreSQL (Recommended)
1. **Add Database**: In Railway dashboard, click "New" → "Database" → "PostgreSQL"
2. **Connect**: Railway automatically creates `DATABASE_URL` variable
3. **Use Connection**: Your app will automatically connect

```bash
# Railway automatically provides
DATABASE_URL=postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway
```

### Option 3: External Database
```bash
# Connect to external database
DATABASE_URL=postgresql://user:pass@host:5432/database
```

## Configuration Options

### railway.json (Optional)
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Dockerfile Deployment
```dockerfile
# Railway automatically detects Dockerfile
# No additional configuration needed
```

## Custom Domain

### 1. Add Custom Domain
1. Go to your project settings
2. Click "Domains" tab
3. Click "Custom Domain"
4. Enter your domain name

### 2. DNS Configuration
```bash
# Add CNAME record
www.your-domain.com → your-app-production.up.railway.app

# Add CNAME for apex domain
your-domain.com → your-app-production.up.railway.app
```

### 3. SSL Certificate
- Railway automatically provides SSL certificates
- Certificates are managed and renewed automatically
- HTTPS is enforced by default

## Railway CLI Usage

### Install CLI
```bash
# Install Railway CLI
npm install -g @railway/cli

# Or via curl
curl -fsSL https://railway.app/install.sh | sh
```

### CLI Commands
```bash
# Login
railway login

# Link project
railway link

# Deploy
railway up

# View logs
railway logs

# Open in browser
railway open

# Set environment variables
railway variables set NODE_ENV=production

# Run commands
railway run npm run db:migrate
```

## Monitoring & Logging

### View Logs
```bash
# In Railway dashboard
1. Go to your project
2. Click on the deployment
3. View logs in real-time

# Using Railway CLI
railway logs
railway logs --tail
```

### Metrics
- **Resource Usage**: CPU, memory, and network metrics
- **Request Metrics**: Response times and error rates
- **Build Metrics**: Build times and success rates

### Health Checks
```json
{
  "deploy": {
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 100
  }
}
```

## Advanced Configuration

### Multiple Services
```json
{
  "services": {
    "web": {
      "build": {
        "builder": "DOCKERFILE",
        "dockerfilePath": "Dockerfile"
      },
      "deploy": {
        "startCommand": "npm start"
      }
    },
    "worker": {
      "build": {
        "builder": "DOCKERFILE",
        "dockerfilePath": "Dockerfile.worker"
      },
      "deploy": {
        "startCommand": "npm run worker"
      }
    }
  }
}
```

### Redis Service
1. **Add Redis**: Click "New" → "Database" → "Redis"
2. **Connect**: Railway automatically creates `REDIS_URL` variable
3. **Use in App**: Access via `process.env.REDIS_URL`

### Cron Jobs
```json
{
  "services": {
    "cron": {
      "build": {
        "builder": "DOCKERFILE"
      },
      "deploy": {
        "startCommand": "npm run cron",
        "cronSchedule": "0 2 * * *"
      }
    }
  }
}
```

## Troubleshooting

### Common Issues

#### 1. Build Failures
```bash
# Check build logs in Railway dashboard
# Common issues:
# - Node.js version mismatch
# - Missing dependencies
# - Build timeout

# Fix Node.js version in package.json
"engines": {
  "node": "20.x"
}
```

#### 2. Database Connection Issues
```bash
# Check DATABASE_URL format
# PostgreSQL format:
DATABASE_URL=postgresql://user:pass@host:5432/database

# Test connection using Railway CLI
railway run node -e "console.log(process.env.DATABASE_URL)"
```

#### 3. Environment Variable Issues
```bash
# Check variables in Railway dashboard
# Ensure all required variables are set
# Check variable names for typos

# List all variables
railway variables
```

#### 4. Port Issues
```bash
# Railway automatically sets PORT
# Ensure your app listens on process.env.PORT
const port = process.env.PORT || 3000;
```

### Debugging Steps
1. **Check Logs**: Review build and runtime logs
2. **Environment Variables**: Verify all required variables
3. **Database**: Test database connection
4. **Health Check**: Verify `/api/health` endpoint
5. **Local Testing**: Test with Railway CLI locally

## Performance Optimization

### Resource Limits
```json
{
  "deploy": {
    "startCommand": "npm start",
    "memoryLimit": 1024,
    "cpuLimit": 1000
  }
}
```

### Build Optimization
```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile",
    "buildCommand": "npm run build"
  }
}
```

### Caching
```dockerfile
# Dockerfile optimization for Railway
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "start"]
```

## Cost Optimization

### Estimated Costs
- **Hobby Plan**: $0/month (limited resources)
- **Pro Plan**: $20/month (unlimited projects)
- **Database**: $5/month (PostgreSQL)
- **Usage-based**: Additional charges for high usage

### Cost-Saving Tips
1. **Resource Monitoring**: Monitor CPU and memory usage
2. **Optimize Builds**: Use efficient Docker builds
3. **Database**: Use SQLite for small applications
4. **Sleep Mode**: For development projects

## CI/CD Integration

### Automatic Deploys
- **GitHub Integration**: Automatic deploys on push
- **Branch Deployment**: Deploy specific branches
- **PR Previews**: Preview deployments for pull requests

### GitHub Actions
```yaml
# .github/workflows/railway.yml
name: Deploy to Railway

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Railway CLI
        run: npm install -g @railway/cli
      - name: Deploy to Railway
        run: railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

### Environment-Based Deployments
```bash
# Deploy to different environments
railway up --environment production
railway up --environment staging
```

## Security Best Practices

### 1. Environment Variables
```bash
# Use Railway's secret management
# Generate secure secrets
BETTER_AUTH_SECRET=$(openssl rand -base64 32)

# Use Railway's built-in variables
NEXT_PUBLIC_API_URL=${{RAILWAY_STATIC_URL}}
```

### 2. Database Security
```bash
# Use Railway's managed PostgreSQL
# Automatic SSL connections
# Network isolation
```

### 3. Network Security
```json
{
  "deploy": {
    "healthcheckPath": "/api/health",
    "headers": {
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff"
    }
  }
}
```

## Support Resources

### Official Documentation
- [Railway Documentation](https://docs.railway.app/)
- [Railway Community](https://discord.gg/railway)
- [Status Page](https://status.railway.app/)

### Useful Commands
```bash
# Project management
railway status
railway logs
railway open
railway restart

# Environment management
railway variables list
railway variables set KEY=value
railway variables delete KEY

# Database management
railway connect database
railway run psql $DATABASE_URL
```

## Migration from Other Platforms

### From Heroku
1. **Import**: Railway can import Heroku apps
2. **Environment Variables**: Automatically migrated
3. **Database**: Migrate data separately
4. **Domains**: Update DNS records

### From Vercel
1. **Import**: Connect GitHub repository
2. **Environment Variables**: Copy from Vercel dashboard
3. **Build Settings**: Railway auto-detects Next.js
4. **Database**: Set up PostgreSQL

## Next Steps

1. **Deploy**: Follow the quick deployment guide
2. **Database**: Set up PostgreSQL for production
3. **Domain**: Configure custom domain
4. **Monitoring**: Set up alerts and logging
5. **CI/CD**: Configure automatic deployments
6. **Scale**: Monitor and optimize performance

---

**Tip**: Railway's strength is its simplicity and developer experience. Start with the automatic deployment, then customize as needed. The platform handles most configuration automatically, making it perfect for rapid prototyping and production deployments.