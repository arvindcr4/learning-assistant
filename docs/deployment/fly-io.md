# Fly.io Deployment Guide

## Overview

Fly.io is a developer-friendly platform that runs your applications close to users worldwide. It provides excellent auto-scaling, edge deployment, and built-in load balancing.

## Prerequisites

### Required
- Fly.io account ([sign up](https://fly.io/app/sign-up))
- flyctl CLI installed
- Git repository

### Install flyctl
```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh

# Windows
iwr https://fly.io/install.ps1 -useb | iex
```

## Quick Deployment (5-10 minutes)

### 1. Login to Fly.io
```bash
flyctl auth login
```

### 2. Initialize Your App
```bash
# In your project directory
flyctl launch
```

This will:
- Create a `fly.toml` configuration file
- Set up your app name and region
- Configure basic settings

### 3. Configure fly.toml
```toml
# fly.toml
app = "learning-assistant-your-name"
primary_region = "dfw"  # or your preferred region

[build]

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = 'stop'
  auto_start_machines = true
  min_machines_running = 0
  processes = ['app']

[[vm]]
  memory = '1gb'
  cpu_kind = 'shared'
  cpus = 1
```

### 4. Set Environment Variables
```bash
# Required variables
flyctl secrets set NODE_ENV=production
flyctl secrets set NEXT_TELEMETRY_DISABLED=1
flyctl secrets set DATABASE_URL=sqlite:./app.db
flyctl secrets set BETTER_AUTH_SECRET=$(openssl rand -base64 32)

# Optional variables
flyctl secrets set FEATURE_ANALYTICS_ENABLED=true
flyctl secrets set FEATURE_RECOMMENDATIONS_ENABLED=true
flyctl secrets set FEATURE_CHAT_ENABLED=true
```

### 5. Deploy
```bash
flyctl deploy
```

## Database Setup

### Option 1: SQLite (Simple)
```bash
# Already configured in secrets above
flyctl secrets set DATABASE_URL=sqlite:./app.db
```

### Option 2: PostgreSQL (Production)
```bash
# Create Postgres app
flyctl postgres create --name learning-assistant-db

# Connect to your app
flyctl postgres attach --app learning-assistant learning-assistant-db

# This automatically sets DATABASE_URL
```

## Configuration Options

### Scaling Configuration
```toml
# fly.toml
[[vm]]
  memory = '512mb'  # Start small
  cpu_kind = 'shared'
  cpus = 1

# Auto-scaling (optional)
[http_service]
  min_machines_running = 0
  max_machines_running = 10
  auto_stop_machines = 'stop'
  auto_start_machines = true
```

### Multi-Region Deployment
```bash
# Add regions
flyctl regions add lax sjc fra

# List regions
flyctl regions list
```

### Volume for Persistent Data
```bash
# Create volume for SQLite
flyctl volumes create data --size 1 --region dfw

# Update fly.toml
[mounts]
  destination = "/app/data"
  source = "data"
```

## Environment Variables

### Complete Environment Setup
```bash
# Core application
flyctl secrets set NODE_ENV=production
flyctl secrets set PORT=3000
flyctl secrets set NEXT_TELEMETRY_DISABLED=1

# Database
flyctl secrets set DATABASE_URL=sqlite:./app/data/app.db
# OR for PostgreSQL
flyctl secrets set DATABASE_URL=postgresql://user:pass@host:5432/db

# Authentication
flyctl secrets set BETTER_AUTH_SECRET=$(openssl rand -base64 32)

# API URLs (replace with your app name)
flyctl secrets set NEXT_PUBLIC_API_URL=https://learning-assistant-your-name.fly.dev
flyctl secrets set NEXT_PUBLIC_APP_URL=https://learning-assistant-your-name.fly.dev

# Features
flyctl secrets set FEATURE_ANALYTICS_ENABLED=true
flyctl secrets set FEATURE_RECOMMENDATIONS_ENABLED=true
flyctl secrets set FEATURE_CHAT_ENABLED=true
```

## Custom Domain

### 1. Add Custom Domain
```bash
# Add your domain
flyctl certs create your-domain.com

# Add www subdomain
flyctl certs create www.your-domain.com
```

### 2. Update DNS
```bash
# Get your app's IP
flyctl ips list

# Add DNS records:
# A record: your-domain.com -> your-app-ip
# CNAME record: www.your-domain.com -> your-app-name.fly.dev
```

### 3. Update Environment Variables
```bash
flyctl secrets set NEXT_PUBLIC_API_URL=https://your-domain.com
flyctl secrets set NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Monitoring & Logging

### View Logs
```bash
# Real-time logs
flyctl logs

# Historical logs
flyctl logs --since 1h
```

### Monitor Performance
```bash
# App status
flyctl status

# Machine details
flyctl machine list

# Performance metrics
flyctl dashboard
```

### Health Checks
```toml
# fly.toml
[http_service]
  [http_service.checks]
    [http_service.checks.health]
      grace_period = "10s"
      interval = "30s"
      method = "GET"
      path = "/api/health"
      protocol = "http"
      timeout = "5s"
      tls_skip_verify = false
```

## Advanced Configuration

### Multiple Processes
```toml
# fly.toml
[processes]
  web = "npm start"
  worker = "npm run worker"

[[vm]]
  processes = ["web"]
  memory = "1gb"
  cpus = 1

[[vm]]
  processes = ["worker"]
  memory = "512mb"
  cpus = 1
```

### Redis Cache
```bash
# Create Redis app
flyctl redis create --name learning-assistant-redis

# Connect to your app
flyctl redis attach --app learning-assistant learning-assistant-redis
```

### File System Persistence
```bash
# Create volume
flyctl volumes create data --size 3 --region dfw

# Mount volume
[mounts]
  destination = "/app/data"
  source = "data"
```

## Troubleshooting

### Common Issues

#### 1. Build Failures
```bash
# Check build logs
flyctl logs

# Deploy with verbose output
flyctl deploy --verbose

# Check Dockerfile
docker build -t test .
```

#### 2. Database Connection Issues
```bash
# Check database connection
flyctl postgres connect --app learning-assistant-db

# Verify environment variables
flyctl secrets list
```

#### 3. Memory Issues
```bash
# Monitor memory usage
flyctl machine list

# Scale up memory
flyctl scale memory 2048  # 2GB
```

#### 4. SSL Certificate Issues
```bash
# Check certificate status
flyctl certs list

# Force certificate renewal
flyctl certs create your-domain.com --force
```

### Debugging Commands
```bash
# SSH into machine
flyctl ssh console

# Check machine health
flyctl machine status

# View configuration
flyctl config show
```

## Performance Optimization

### Auto-scaling Settings
```toml
# fly.toml
[http_service]
  min_machines_running = 0
  max_machines_running = 5
  auto_stop_machines = 'stop'
  auto_start_machines = true
  
  [[http_service.concurrency]]
    type = "connections"
    hard_limit = 1000
    soft_limit = 800
```

### Machine Sizing
```bash
# Check current usage
flyctl machine list

# Scale CPU
flyctl scale cpu 2

# Scale memory
flyctl scale memory 2048
```

## Cost Optimization

### Estimated Costs
- **Hobby Plan**: $0/month (limited resources)
- **Shared CPU 1x**: ~$1.94/month (256MB RAM)
- **Shared CPU 2x**: ~$3.88/month (512MB RAM)
- **Shared CPU 4x**: ~$7.76/month (1GB RAM)

### Cost-Saving Tips
1. **Auto-stop**: Use auto-stop for development
2. **Right-sizing**: Start with minimal resources
3. **Monitoring**: Set up cost alerts
4. **Regional**: Use single region for testing

## CI/CD Integration

### GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy to Fly.io

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

### Set up CI/CD
```bash
# Generate deploy token
flyctl auth token

# Add to GitHub Secrets as FLY_API_TOKEN
```

## Security Best Practices

### 1. Secure Secrets
```bash
# Use strong secrets
flyctl secrets set BETTER_AUTH_SECRET=$(openssl rand -base64 32)

# Rotate secrets regularly
flyctl secrets set DATABASE_PASSWORD=$(openssl rand -base64 20)
```

### 2. Network Security
```toml
# fly.toml
[http_service]
  force_https = true
  
  [[http_service.headers]]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
```

### 3. Database Security
```bash
# Use PostgreSQL with SSL
flyctl postgres create --name learning-assistant-db --vm-size shared-cpu-1x
```

## Support Resources

### Official Documentation
- [Fly.io Documentation](https://fly.io/docs/)
- [Fly.io Community](https://community.fly.io/)
- [Status Page](https://status.fly.io/)

### Useful Commands
```bash
# App information
flyctl info

# Scale resources
flyctl scale show
flyctl scale cpu 2
flyctl scale memory 1024

# Restart app
flyctl restart

# Delete app
flyctl destroy
```

## Next Steps

1. **Deploy**: Follow the quick deployment steps
2. **Configure Domain**: Set up custom domain
3. **Set up Monitoring**: Configure alerts and logging
4. **Database**: Set up PostgreSQL for production
5. **CI/CD**: Automate deployments
6. **Scale**: Adjust resources based on usage

---

**Tip**: Start with the basic SQLite setup for testing, then migrate to PostgreSQL for production. Fly.io makes it easy to scale up as your application grows.