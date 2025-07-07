# Learning Assistant - Unified Deployment Guide

## Overview

The Learning Assistant deployment orchestrator is a comprehensive, production-ready deployment system that supports multiple cloud platforms with automated deployment, health checking, rollback capabilities, and monitoring.

## Supported Platforms

- **AWS** (Amazon Web Services) - EC2, ECS
- **GCP** (Google Cloud Platform) - Cloud Run, Compute Engine, App Engine
- **Azure** (Microsoft Azure) - Web Apps, Virtual Machines, Container Instances
- **Fly.io** - Global application platform
- **Railway** - Developer-focused deployment platform
- **Render** - Static sites and web services
- **DigitalOcean** - App Platform, Droplets
- **Linode** - Virtual private servers

## Quick Start

### 1. Installation Requirements

Ensure you have the following installed:

```bash
# Core requirements
curl
git
docker
npm/node.js (v20+)

# Platform-specific CLIs (install as needed)
aws          # AWS CLI
gcloud       # Google Cloud SDK
az           # Azure CLI
flyctl       # Fly.io CLI
railway      # Railway CLI
doctl        # DigitalOcean CLI
linode-cli   # Linode CLI
```

### 2. Basic Deployment

```bash
# Make deployment script executable
chmod +x deploy.sh

# Deploy to a platform (auto-detection)
./deploy.sh fly production

# Deploy with specific options
./deploy.sh aws staging --region us-west-2 --instance-type t3.large

# Dry run to see what would happen
./deploy.sh gcp production --dry-run

# Force deployment (skip validation)
./deploy.sh render production --force
```

### 3. Configuration

The orchestrator automatically creates configuration files for each platform/environment:

```
deploy/
├── config/
│   ├── aws/
│   │   ├── production.env
│   │   ├── staging.env
│   │   └── development.env
│   ├── fly/
│   │   ├── production.env
│   │   └── staging.env
│   └── ... (other platforms)
```

## Detailed Usage

### Command Line Options

```bash
./deploy.sh [OPTIONS] <platform> [environment]

Options:
  -e, --environment ENV     Deployment environment (default: production)
  -r, --region REGION       Deployment region
  -i, --instance-type TYPE  Instance type for cloud deployments
  -n, --dry-run             Show what would be done without executing
  -v, --verbose             Enable verbose logging
  -f, --force               Force deployment even if validation fails
  --skip-health-check       Skip post-deployment health check
  --skip-validation         Skip pre-deployment validation
  --no-rollback             Disable rollback capability
  --no-cleanup              Don't cleanup on failure
  -h, --help                Show help message

Examples:
  ./deploy.sh fly production
  ./deploy.sh aws staging --region us-east-1
  ./deploy.sh gcp --instance-type n1-standard-1 --verbose
  ./deploy.sh railway --dry-run
```

### Environment Management

Each deployment creates environment-specific configuration files with secure defaults:

```bash
# View configuration for a platform/environment
cat deploy/config/fly/production.env

# Customize configuration
vim deploy/config/aws/staging.env

# Generate secure secrets
./deploy/utils/common.sh generate-secrets
```

### Health Checks and Monitoring

The orchestrator includes comprehensive health checking:

```bash
# Run health checks manually
./deploy/utils/health-check.sh comprehensive https://your-app.fly.dev

# Monitor performance
./deploy/utils/health-check.sh performance https://your-app.fly.dev 120 10

# Basic load testing
./deploy/utils/health-check.sh load https://your-app.fly.dev 5 30

# SSL/Security checks
./deploy/utils/health-check.sh ssl https://your-app.fly.dev
```

### Rollback and Recovery

```bash
# List available rollbacks
./deploy/utils/rollback.sh list

# List rollbacks for specific platform/environment
./deploy/utils/rollback.sh list fly production

# Perform rollback
./deploy/utils/rollback.sh rollback fly_production_1704123456

# Emergency rollback (fastest, skip confirmations)
./deploy/utils/rollback.sh emergency fly_production_1704123456

# Clean up old deployments
./deploy/utils/rollback.sh cleanup fly_production_1704123456
```

## Platform-Specific Guides

### AWS Deployment

#### Prerequisites
```bash
# Install and configure AWS CLI
aws configure
```

#### Configuration Options
```bash
# AWS-specific environment variables
AWS_REGION=us-east-1
AWS_INSTANCE_TYPE=t3.medium
AWS_DEPLOY_METHOD=ec2  # or 'ecs'
AWS_AMI_ID=ami-0453ec754f44f9a4a
AWS_KEY_NAME=learning-assistant-key
AWS_SECURITY_GROUP=learning-assistant-sg
```

#### Deployment
```bash
# Deploy to AWS EC2
./deploy.sh aws production --region us-east-1

# Deploy to AWS ECS (requires additional setup)
AWS_DEPLOY_METHOD=ecs ./deploy.sh aws production
```

### Fly.io Deployment

#### Prerequisites
```bash
# Install and authenticate with Fly.io CLI
flyctl auth login
```

#### Configuration Options
```bash
# Fly.io-specific environment variables
FLY_REGION=bom
FLY_MEMORY=1gb
FLY_CPU_KIND=shared
FLY_CPUS=1
```

#### Deployment
```bash
# Deploy to Fly.io
./deploy.sh fly production

# Deploy with custom region
./deploy.sh fly production --region ord
```

### Railway Deployment

#### Prerequisites
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login
```

#### Deployment
```bash
# Deploy to Railway
./deploy.sh railway production

# Railway automatically handles environment variables and scaling
```

### Render Deployment

Render deployments are Git-based and require repository integration:

#### Prerequisites
- Git repository connected to Render
- `render.yaml` configuration file

#### Deployment
```bash
# Deploy to Render (triggers via Git push)
./deploy.sh render production

# The script will commit changes and push to trigger deployment
```

### Google Cloud Platform (GCP)

#### Prerequisites
```bash
# Install and configure gcloud
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

#### Configuration Options
```bash
# GCP-specific environment variables
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-central1
GCP_DEPLOY_METHOD=run  # or 'gce', 'gke', 'appengine'
```

#### Deployment
```bash
# Deploy to Cloud Run
./deploy.sh gcp production

# Deploy to Compute Engine
GCP_DEPLOY_METHOD=gce ./deploy.sh gcp production
```

### Microsoft Azure

#### Prerequisites
```bash
# Install and configure Azure CLI
az login
```

#### Configuration Options
```bash
# Azure-specific environment variables
AZURE_RESOURCE_GROUP=learning-assistant-rg
AZURE_LOCATION=eastus
AZURE_DEPLOY_METHOD=webapp  # or 'vm', 'aci'
```

#### Deployment
```bash
# Deploy to Azure Web App
./deploy.sh azure production

# Deploy to Virtual Machine
AZURE_DEPLOY_METHOD=vm ./deploy.sh azure production
```

### DigitalOcean

#### Prerequisites
```bash
# Install and configure doctl
doctl auth init
```

#### Configuration Options
```bash
# DigitalOcean-specific environment variables
DO_REGION=nyc3
DO_SIZE=s-1vcpu-1gb
DO_DEPLOY_METHOD=droplet  # or 'app'
```

#### Deployment
```bash
# Deploy to Droplet
./deploy.sh digitalocean production

# Deploy to App Platform
DO_DEPLOY_METHOD=app ./deploy.sh digitalocean production
```

### Linode

#### Prerequisites
```bash
# Install and configure Linode CLI
pip3 install linode-cli
linode-cli configure
```

#### Deployment
```bash
# Deploy to Linode
./deploy.sh linode production --region us-east
```

## Configuration Management

### Environment Variables

The orchestrator manages environment variables through configuration files:

```bash
# Common variables (all platforms)
NODE_ENV=production
PORT=3000
DATABASE_URL=sqlite:./app.db
BETTER_AUTH_SECRET=auto-generated
FEATURE_ANALYTICS_ENABLED=true
FEATURE_RECOMMENDATIONS_ENABLED=true
FEATURE_CHAT_ENABLED=false

# Security variables
SECURE_COOKIES=true
TRUST_PROXY=1
RATE_LIMIT_ENABLED=true

# Performance variables
NODE_OPTIONS=--max-old-space-size=1024
CACHE_TTL=3600
```

### Secrets Management

Secrets are automatically generated and managed:

```bash
# Generate new secrets
./deploy/utils/common.sh generate-secrets > secrets.env

# Secrets include:
# - BETTER_AUTH_SECRET
# - SESSION_SECRET
# - JWT_SECRET
# - ENCRYPTION_KEY
# - DATABASE_PASSWORD
```

## Monitoring and Logging

### Log Files

Deployment logs are stored in the `logs/` directory:

```
logs/
├── deploy_20240107_143022.log    # Deployment logs
├── deployment_status.json        # Deployment status tracking
└── backups/
    ├── rollback_*.json           # Rollback metadata
    └── backup_*.tar.gz           # Configuration backups
```

### Health Monitoring

The orchestrator includes comprehensive health monitoring:

1. **Basic Connectivity** - HTTP response codes
2. **API Endpoints** - Multiple endpoint testing
3. **Database Connectivity** - Database connection testing
4. **SSL/TLS Security** - Certificate validation
5. **Security Headers** - Security header analysis
6. **Performance Monitoring** - Response time analysis
7. **Load Testing** - Basic load testing capabilities

### Metrics and Alerts

Monitor your deployment with:

```bash
# Check deployment status
./deploy/utils/rollback.sh list

# View recent deployments
tail -f logs/deployment_status.json

# Monitor application metrics (if available)
curl https://your-app.com/api/metrics
```

## Security Best Practices

### 1. Secrets Management
- Never commit secrets to version control
- Use environment-specific secret files
- Rotate secrets regularly

### 2. Network Security
- Use HTTPS in production
- Configure proper security headers
- Enable rate limiting

### 3. Access Control
- Use least-privilege principles
- Secure deployment keys
- Regular access audits

### 4. Monitoring
- Enable comprehensive logging
- Set up alerts for deployment failures
- Monitor application health

## Troubleshooting

### Common Issues

#### 1. Authentication Errors
```bash
# Check platform CLI authentication
aws sts get-caller-identity
gcloud auth list
az account show
flyctl auth whoami
railway whoami
```

#### 2. Network Connectivity
```bash
# Test connectivity
curl -I https://your-app.com
./deploy/utils/health-check.sh simple https://your-app.com
```

#### 3. Deployment Failures
```bash
# Check logs
tail -f logs/deploy_*.log

# Validate configuration
./deploy.sh platform environment --dry-run --verbose

# Force deployment (skip validation)
./deploy.sh platform environment --force
```

#### 4. Health Check Failures
```bash
# Run comprehensive health check
./deploy/utils/health-check.sh comprehensive https://your-app.com

# Check specific endpoints
curl -v https://your-app.com/api/health
```

### Debug Mode

Enable verbose logging for detailed debugging:

```bash
# Verbose deployment
./deploy.sh platform environment --verbose

# Debug health checks
./deploy/utils/health-check.sh detailed https://your-app.com
```

### Emergency Procedures

#### Emergency Rollback
```bash
# Immediate rollback (skip confirmations)
./deploy/utils/rollback.sh emergency deployment_id
```

#### Emergency Cleanup
```bash
# Clean up failed deployment
./deploy/utils/rollback.sh cleanup deployment_id

# Clean up entire environment
./deploy/utils/rollback.sh cleanup-env platform environment --force
```

## Advanced Usage

### Custom Deployment Hooks

Create custom hooks for your deployment process:

```bash
# Pre-deployment hook
cat > pre-deploy.sh << 'EOF'
#!/bin/bash
echo "Running pre-deployment checks..."
npm run test
npm run lint
EOF

# Post-deployment hook
cat > post-deploy.sh << 'EOF'
#!/bin/bash
echo "Running post-deployment tasks..."
./deploy/utils/health-check.sh comprehensive $DEPLOYMENT_URL
EOF
```

### Multi-Environment Deployments

Deploy to multiple environments:

```bash
# Deploy to staging first
./deploy.sh fly staging

# Run tests against staging
npm run test:e2e

# Deploy to production
./deploy.sh fly production
```

### Automated CI/CD Integration

Integrate with CI/CD pipelines:

```yaml
# GitHub Actions example
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to production
        run: |
          chmod +x deploy.sh
          ./deploy.sh fly production --force
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

## Platform Comparison

| Platform | Ease of Use | Scalability | Cost | Global | Database | CDN |
|----------|-------------|-------------|------|--------|----------|-----|
| Fly.io | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Railway | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| Render | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| AWS | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| GCP | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Azure | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| DigitalOcean | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Linode | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |

## Support and Contributing

### Getting Help

1. Check the logs: `tail -f logs/deploy_*.log`
2. Run with verbose output: `--verbose`
3. Test with dry run: `--dry-run`
4. Check platform-specific documentation

### Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

### Reporting Issues

Include the following information:
- Platform and environment
- Deployment command used
- Error messages and logs
- Expected vs actual behavior

---

**Last Updated:** January 2024
**Version:** 1.0.0