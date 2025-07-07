# 🚀 Learning Assistant - Unified Deployment Orchestrator

A comprehensive, production-ready deployment system supporting 8 major cloud platforms with automated deployment, health checking, rollback capabilities, and monitoring.

## ✨ Features

- **Multi-Platform Support**: AWS, GCP, Azure, Fly.io, Railway, Render, DigitalOcean, Linode
- **Automated Health Checks**: Comprehensive post-deployment validation
- **Rollback Capabilities**: One-command rollback to previous deployments
- **Environment Management**: Secure configuration for development, staging, production
- **CI/CD Integration**: GitHub Actions workflows included
- **Monitoring & Logging**: Built-in performance monitoring and detailed logging
- **Security First**: Automated secret generation and security validation

## 🏗️ Architecture

```
learning-assistant/
├── deploy.sh                 # Main deployment orchestrator
├── setup-deployment.sh       # Setup script
├── DEPLOYMENT_GUIDE.md       # Comprehensive guide
├── deploy/
│   ├── platforms/            # Platform-specific handlers
│   │   ├── aws.sh
│   │   ├── fly.sh
│   │   ├── railway.sh
│   │   ├── render.sh
│   │   ├── gcp.sh
│   │   ├── azure.sh
│   │   ├── digitalocean.sh
│   │   └── linode.sh
│   ├── utils/               # Utility scripts
│   │   ├── common.sh        # Common functions
│   │   ├── health-check.sh  # Health checking
│   │   └── rollback.sh      # Rollback management
│   └── config/             # Environment configurations
│       ├── aws/
│       ├── fly/
│       ├── railway/
│       └── ... (per platform)
├── logs/                   # Deployment logs and backups
└── .github/workflows/      # CI/CD workflows
```

## 🚀 Quick Start

### 1. Setup

```bash
# Run the setup script
./setup-deployment.sh

# This will:
# - Check system requirements
# - Create directory structure
# - Generate platform configurations
# - Make scripts executable
# - Test the deployment system
```

### 2. Platform CLI Setup

Install and configure your preferred platform CLIs:

```bash
# Fly.io
curl -L https://fly.io/install.sh | sh
flyctl auth login

# Railway
npm install -g @railway/cli
railway login

# AWS
aws configure

# Google Cloud
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Azure
az login

# DigitalOcean
doctl auth init

# Linode
pip3 install linode-cli
linode-cli configure
```

### 3. Deploy

```bash
# Deploy to your preferred platform
./deploy.sh fly production

# With custom options
./deploy.sh aws staging --region us-west-2 --verbose

# Dry run first
./deploy.sh gcp production --dry-run
```

## 🎯 Usage Examples

### Basic Deployments

```bash
# Deploy to Fly.io production
./deploy.sh fly production

# Deploy to Railway staging
./deploy.sh railway staging

# Deploy to AWS with specific region
./deploy.sh aws production --region us-east-1

# Deploy to Render (Git-based)
./deploy.sh render production
```

### Advanced Options

```bash
# Verbose deployment with custom instance type
./deploy.sh gcp production --verbose --instance-type n1-standard-2

# Skip validation and force deployment
./deploy.sh azure staging --force --skip-validation

# Deploy without health checks
./deploy.sh digitalocean production --skip-health-check

# Dry run with verbose output
./deploy.sh linode staging --dry-run --verbose
```

### Health Checks

```bash
# Comprehensive health check
./deploy/utils/health-check.sh comprehensive https://your-app.com

# Performance monitoring
./deploy/utils/health-check.sh performance https://your-app.com 120

# Load testing
./deploy/utils/health-check.sh load https://your-app.com 10 60

# SSL security check
./deploy/utils/health-check.sh ssl https://your-app.com
```

### Rollback Management

```bash
# List available rollbacks
./deploy/utils/rollback.sh list

# Rollback to specific deployment
./deploy/utils/rollback.sh rollback fly_production_1704123456

# Emergency rollback (fastest)
./deploy/utils/rollback.sh emergency fly_production_1704123456

# Clean up old deployments
./deploy/utils/rollback.sh cleanup-env fly production
```

## 🔧 Configuration

### Environment Variables

Each platform/environment has its own configuration file:

```bash
# Edit Fly.io production config
vim deploy/config/fly/production.env

# Edit AWS staging config
vim deploy/config/aws/staging.env
```

### Platform-Specific Settings

#### Fly.io
```bash
FLY_REGION=bom
FLY_MEMORY=1gb
FLY_CPU_KIND=shared
FLY_CPUS=1
```

#### AWS
```bash
AWS_REGION=us-east-1
AWS_INSTANCE_TYPE=t3.medium
AWS_DEPLOY_METHOD=ec2
```

#### Railway
```bash
RAILWAY_CUSTOM_VARS=CUSTOM_VAR1=value1,CUSTOM_VAR2=value2
```

## 🔒 Security

### Automatic Secret Generation

The orchestrator automatically generates secure secrets:

```bash
# Generate new secrets
./deploy/utils/common.sh generate-secrets

# Secrets include:
# - BETTER_AUTH_SECRET (32 chars)
# - SESSION_SECRET (32 chars)
# - JWT_SECRET (32 chars)
# - ENCRYPTION_KEY (32 chars)
```

### Security Validations

- SSL/TLS certificate validation
- Security headers checking
- Environment variable validation
- Network connectivity testing

## 📊 Monitoring

### Built-in Health Checks

1. **Basic Connectivity** - HTTP response validation
2. **API Endpoints** - Multiple endpoint testing
3. **Database Connectivity** - Connection validation
4. **SSL Security** - Certificate and TLS validation
5. **Performance** - Response time monitoring
6. **Load Testing** - Basic concurrent user testing

### Logging

All deployments are logged with detailed information:

```bash
# View recent deployment logs
tail -f logs/deploy_*.log

# View deployment status
cat logs/deployment_status.json

# View rollback history
ls -la logs/backups/rollback_*.json
```

## 🔄 CI/CD Integration

### GitHub Actions

Pre-configured workflows for popular platforms:

```yaml
# .github/workflows/fly-deploy.yml
name: Deploy to Fly.io
on:
  push:
    branches: [ main ]
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [production, staging, development]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        run: ./deploy.sh fly ${{ inputs.environment || 'production' }}
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

### Automated Testing

The deployment orchestrator includes automated testing:

```bash
# Run tests before deployment
npm run test:ci
npm run lint

# Performance testing
npm run test:performance

# E2E testing
npm run test:e2e
```

## 🛠️ Platform-Specific Features

| Platform | Deployment Type | Auto-scaling | Database | CDN | SSL |
|----------|----------------|--------------|----------|-----|-----|
| **Fly.io** | Containers | ✅ | PostgreSQL | ✅ | ✅ |
| **Railway** | Git-based | ✅ | PostgreSQL/Redis | ❌ | ✅ |
| **Render** | Git-based | ✅ | PostgreSQL | ✅ | ✅ |
| **AWS** | EC2/ECS | ✅ | RDS/DynamoDB | CloudFront | ✅ |
| **GCP** | Cloud Run/GCE | ✅ | Cloud SQL | Cloud CDN | ✅ |
| **Azure** | Web Apps/VMs | ✅ | Azure SQL | Azure CDN | ✅ |
| **DigitalOcean** | App Platform/Droplets | ✅ | Managed DB | ❌ | ✅ |
| **Linode** | VPS | Manual | Manual | ❌ | Manual |

## 🚨 Emergency Procedures

### Emergency Rollback

```bash
# Fastest possible rollback
./deploy/utils/rollback.sh emergency deployment_id

# This will:
# - Skip all confirmations
# - Perform immediate rollback
# - Clean up failed deployment
# - Verify system status
```

### Disaster Recovery

```bash
# List all deployments for recovery
./deploy/utils/rollback.sh list

# Clean up corrupted environment
./deploy/utils/rollback.sh cleanup-env platform environment --force

# Redeploy from scratch
./deploy.sh platform environment --force --no-rollback
```

## 📈 Performance Optimization

### Deployment Speed

- Parallel health checks
- Cached dependencies
- Optimized Docker builds
- Fast rollback mechanisms

### Resource Usage

- Memory-optimized defaults
- CPU usage monitoring
- Disk space management
- Network optimization

## 🔍 Troubleshooting

### Common Issues

1. **Authentication Errors**
   ```bash
   # Check platform CLI auth
   flyctl auth whoami
   aws sts get-caller-identity
   railway whoami
   ```

2. **Network Issues**
   ```bash
   # Test connectivity
   ./deploy/utils/health-check.sh simple https://your-app.com
   ```

3. **Configuration Errors**
   ```bash
   # Validate configuration
   ./deploy.sh platform environment --dry-run --verbose
   ```

### Debug Mode

```bash
# Enable verbose logging
./deploy.sh platform environment --verbose

# Skip validations for debugging
./deploy.sh platform environment --skip-validation

# Test individual components
./deploy/utils/health-check.sh detailed https://your-app.com
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

### Adding New Platforms

1. Create platform handler: `deploy/platforms/newplatform.sh`
2. Add configuration template: `deploy/config/newplatform/`
3. Update main deploy script
4. Add documentation
5. Test thoroughly

## 📚 Documentation

- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Comprehensive deployment guide
- **[API Documentation](./docs/api.md)** - API reference
- **[Architecture Guide](./docs/architecture.md)** - System architecture
- **[Security Guide](./docs/security.md)** - Security best practices

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

## 🙏 Acknowledgments

- Platform CLIs and APIs
- Community feedback and contributions
- Open source dependencies

---

**Made with ❤️ for the developer community**

*Last updated: January 2024*