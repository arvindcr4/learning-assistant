# Railway Deployment Guide for Learning Assistant

This comprehensive guide covers deploying the Learning Assistant application on Railway platform with production-ready configurations.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Environment Setup](#environment-setup)
4. [Database Configuration](#database-configuration)
5. [Deployment Process](#deployment-process)
6. [Custom Domain Setup](#custom-domain-setup)
7. [Scaling and Performance](#scaling-and-performance)
8. [Monitoring and Logging](#monitoring-and-logging)
9. [Security Considerations](#security-considerations)
10. [Troubleshooting](#troubleshooting)
11. [Best Practices](#best-practices)

## Prerequisites

Before deploying to Railway, ensure you have:

- **Railway Account**: Sign up at [railway.app](https://railway.app)
- **Railway CLI**: Install with `npm install -g @railway/cli`
- **Node.js**: Version 20 or higher
- **Git**: For version control and deployments
- **Docker**: For local testing (optional)

### Railway CLI Installation

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Verify installation
railway --version
```

## Quick Start

For a rapid deployment:

```bash
# 1. Clone and prepare the project
git clone <your-repo-url>
cd learning-assistant

# 2. Create Railway project
railway init

# 3. Add PostgreSQL database
railway add postgres

# 4. Set environment variables
cp .env.railway.example .env
# Edit .env with your values

# 5. Deploy
railway up
```

## Environment Setup

### 1. Copy Environment Template

```bash
cp .env.railway.example .env
```

### 2. Configure Required Variables

Edit `.env` with your specific values:

```env
# Database (Auto-populated by Railway)
DATABASE_URL="postgresql://user:password@host:port/database"

# Authentication Secrets
NEXTAUTH_SECRET="your-secure-random-string-here"
BETTER_AUTH_SECRET="your-better-auth-secret-here"

# AI Service Keys
OPENAI_API_KEY="sk-your-openai-api-key"
ANTHROPIC_API_KEY="sk-ant-your-anthropic-key"

# Application URL (Auto-populated by Railway)
NEXTAUTH_URL="https://your-app.railway.app"
BETTER_AUTH_URL="https://your-app.railway.app"
```

### 3. Generate Secure Secrets

```bash
# Generate secure random strings
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Database Configuration

### 1. Add PostgreSQL Service

```bash
# Add PostgreSQL to your Railway project
railway add postgres

# Check database connection
railway run node scripts/railway-db-setup.js test
```

### 2. Run Database Setup

```bash
# Complete database setup
railway run node scripts/railway-db-setup.js setup

# Or run individual steps
railway run node scripts/railway-db-setup.js migrate
railway run node scripts/railway-db-setup.js seed
```

### 3. Verify Database Setup

```bash
# Verify database tables and indexes
railway run node scripts/railway-db-setup.js verify
```

## Deployment Process

### 1. Using Railway CLI

```bash
# Deploy current branch
railway up

# Deploy specific branch
railway up --branch main

# Deploy with build logs
railway up --verbose
```

### 2. Using Deployment Script

```bash
# Make script executable
chmod +x scripts/railway-deploy.sh

# Full deployment
./scripts/railway-deploy.sh deploy

# Test deployment
./scripts/railway-deploy.sh test
```

### 3. Using GitHub Integration

1. Connect your GitHub repository in Railway dashboard
2. Configure auto-deployment on push to main branch
3. Set up branch-based deployments for staging

## Custom Domain Setup

### 1. Add Custom Domain in Railway

1. Go to your Railway project dashboard
2. Click on "Settings" → "Domains"
3. Click "Add Domain"
4. Enter your domain name

### 2. Configure DNS Records

Add these DNS records with your domain provider:

#### For Apex Domain (example.com)
```
Type: CNAME
Name: @
Value: your-app.railway.app
```

#### For Subdomain (app.example.com)
```
Type: CNAME
Name: app
Value: your-app.railway.app
```

### 3. SSL Certificate

Railway automatically provisions SSL certificates for custom domains. The process takes 5-10 minutes.

### 4. Update Environment Variables

```bash
# Update URLs to use your custom domain
railway variables set NEXTAUTH_URL=https://your-domain.com
railway variables set BETTER_AUTH_URL=https://your-domain.com
railway variables set CORS_ORIGINS=https://your-domain.com
```

### 5. Force Redeploy

```bash
# Trigger redeploy to pick up new environment variables
railway up --force
```

## Scaling and Performance

### 1. Resource Limits

Configure resource limits in `railway.json`:

```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile.railway"
  },
  "deploy": {
    "numReplicas": 1,
    "restartPolicyType": "ON_FAILURE",
    "healthcheckPath": "/api/health/railway"
  }
}
```

### 2. Auto-scaling Configuration

Railway Pro plans support auto-scaling:

```bash
# Set scaling parameters
railway variables set MIN_REPLICAS=1
railway variables set MAX_REPLICAS=5
railway variables set TARGET_CPU=70
```

### 3. Performance Optimization

```bash
# Enable compression
railway variables set COMPRESSION_ENABLED=true

# Configure caching
railway variables set CACHE_TTL=1800
railway variables set STATIC_CACHE_MAX_AGE=31536000
```

## Monitoring and Logging

### 1. Health Check Endpoints

The application provides multiple health check endpoints:

- **Basic**: `/api/health`
- **Railway-specific**: `/api/health/railway`
- **Detailed**: `/api/health/railway` (with comprehensive metrics)

### 2. Railway Metrics

View metrics in Railway dashboard:
- CPU usage
- Memory usage
- Network traffic
- Response times
- Error rates

### 3. Custom Monitoring

```bash
# Enable custom metrics
railway variables set METRICS_ENABLED=true
railway variables set PERFORMANCE_MONITORING=true

# Configure Sentry (optional)
railway variables set SENTRY_DSN=your-sentry-dsn
railway variables set SENTRY_ENVIRONMENT=production
```

### 4. Log Management

```bash
# View logs
railway logs

# Follow logs in real-time
railway logs --tail

# Filter logs
railway logs --grep "ERROR"
```

## Security Considerations

### 1. Environment Variables

```bash
# Set security headers
railway variables set SECURITY_HEADERS_ENABLED=true
railway variables set CSRF_PROTECTION_ENABLED=true
railway variables set HELMET_ENABLED=true
```

### 2. Rate Limiting

```bash
# Configure rate limiting
railway variables set RATE_LIMITING_ENABLED=true
railway variables set RATE_LIMIT_MAX_REQUESTS=100
railway variables set RATE_LIMIT_WINDOW_SIZE=900000
```

### 3. SSL/TLS Configuration

```bash
# Force HTTPS
railway variables set FORCE_HTTPS=true
railway variables set HSTS_ENABLED=true
```

### 4. IP Restrictions (if needed)

```bash
# Set allowed origins
railway variables set ALLOWED_ORIGINS=https://your-domain.com,https://admin.your-domain.com
```

## Troubleshooting

### Common Issues

#### 1. Build Failures

```bash
# Check build logs
railway logs --tail 100

# Common solutions:
# - Check Dockerfile.railway syntax
# - Verify package.json dependencies
# - Check Node.js version compatibility
```

#### 2. Database Connection Issues

```bash
# Test database connection
railway run node scripts/railway-db-setup.js test

# Check environment variables
railway variables

# Verify database service is running
railway status
```

#### 3. Memory Issues

```bash
# Check memory usage
railway metrics

# Increase memory limit
railway variables set MEMORY_LIMIT=1024
railway variables set NODE_OPTIONS=--max-old-space-size=1024
```

#### 4. Deployment Timeouts

```bash
# Increase build timeout
railway variables set BUILD_TIMEOUT=600

# Check for hanging processes
railway ps
```

### Debug Mode

```bash
# Enable debug mode
railway variables set DEBUG=true
railway variables set VERBOSE_LOGGING=true
railway variables set LOG_LEVEL=debug
```

## Best Practices

### 1. Environment Management

- Use separate Railway projects for staging and production
- Never commit sensitive data to version control
- Use Railway's built-in environment variable management
- Regularly rotate secrets and API keys

### 2. Database Management

- Enable connection pooling
- Set appropriate connection limits
- Use read replicas for high-traffic applications
- Implement database backups

### 3. Performance Optimization

- Use CDN for static assets
- Implement proper caching strategies
- Monitor resource usage regularly
- Optimize database queries

### 4. Security

- Keep dependencies updated
- Use strong, unique passwords
- Enable two-factor authentication
- Implement proper error handling
- Use HTTPS for all communications

### 5. Monitoring

- Set up health checks
- Monitor application metrics
- Configure alerting for critical issues
- Use structured logging
- Implement error tracking

### 6. Deployment Strategy

- Use feature flags for gradual rollouts
- Test in staging before production
- Implement database migrations carefully
- Have a rollback plan
- Use blue-green deployments for zero-downtime updates

## Advanced Configuration

### 1. Multi-Service Setup

```bash
# Add Redis for caching
railway add redis

# Add additional services
railway add mongodb
railway add elasticsearch
```

### 2. Private Networking

```bash
# Configure private networking between services
railway variables set PRIVATE_NETWORK_ENABLED=true
```

### 3. Custom Build Commands

```bash
# Set custom build command
railway variables set BUILD_COMMAND="npm run build:production"

# Set custom start command
railway variables set START_COMMAND="npm run start:production"
```

### 4. Scheduled Jobs

```bash
# Add cron jobs (requires Railway Pro)
railway variables set CRON_JOBS_ENABLED=true
railway variables set BACKUP_SCHEDULE="0 2 * * *"
```

## Support and Resources

### Railway Resources

- **Documentation**: [docs.railway.app](https://docs.railway.app)
- **Discord**: [railway.app/discord](https://railway.app/discord)
- **Status Page**: [status.railway.app](https://status.railway.app)
- **Blog**: [blog.railway.app](https://blog.railway.app)

### Application Resources

- **GitHub Repository**: [Link to your repository]
- **Documentation**: [Link to your docs]
- **Support Email**: support@your-domain.com

### Getting Help

1. Check the Railway documentation
2. Search the Railway Discord community
3. Review application logs
4. Check Railway status page
5. Contact Railway support (Pro plans)

## Conclusion

This guide provides a comprehensive approach to deploying the Learning Assistant on Railway. Follow the steps carefully, test thoroughly in staging, and monitor your application post-deployment.

For questions or issues, refer to the troubleshooting section or reach out to the Railway community.

---

**Last Updated**: January 2025
**Version**: 1.0.0
**Platform**: Railway
**Application**: Learning Assistant