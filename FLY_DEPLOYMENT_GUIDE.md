# Fly.io Deployment Guide for Learning Assistant

This comprehensive guide provides step-by-step instructions for deploying the Learning Assistant Next.js application to Fly.io with production-ready configuration.

## 📋 Prerequisites

- [Fly.io CLI](https://fly.io/docs/hands-on/install-flyctl/) installed and authenticated
- Docker installed (for local testing)
- PostgreSQL client tools (for database operations)
- Node.js 20.x and npm (for local development)

## 🚀 Quick Start

1. **Initialize Fly.io Application** (Already done)
   ```bash
   fly launch --name learning-assistant-lively-rain-3457
   ```

2. **Set up Database**
   ```bash
   ./fly-postgres-setup.md  # Follow the guide
   ```

3. **Configure Secrets**
   ```bash
   ./fly-secrets-setup.sh
   ```

4. **Deploy Application**
   ```bash
   fly deploy
   ```

## 📁 Configuration Files Overview

### Core Configuration Files

| File | Purpose | Status |
|------|---------|--------|
| `fly.toml` | Main Fly.io configuration | ✅ Enhanced |
| `Dockerfile.fly` | Optimized Docker build | ✅ Created |
| `.dockerignore` | Docker ignore rules | ✅ Exists |

### Database Configuration

| File | Purpose | Status |
|------|---------|--------|
| `fly-postgres-setup.md` | Database setup guide | ✅ Created |
| `src/lib/database/config.ts` | Database connection config | ✅ Exists |

### Environment & Secrets

| File | Purpose | Status |
|------|---------|--------|
| `fly-secrets-setup.sh` | Secrets configuration script | ✅ Created |
| `.env.fly.template` | Environment variables template | ✅ Created |

### Multi-Region & Scaling

| File | Purpose | Status |
|------|---------|--------|
| `fly-regions-setup.sh` | Multi-region deployment script | ✅ Created |

### Storage & Volumes

| File | Purpose | Status |
|------|---------|--------|
| `fly-volumes-setup.sh` | Volume management script | ✅ Created |

### Monitoring & Health Checks

| File | Purpose | Status |
|------|---------|--------|
| `fly-monitoring-setup.sh` | Monitoring configuration script | ✅ Created |

### Custom Domain & SSL

| File | Purpose | Status |
|------|---------|--------|
| `fly-domain-ssl-setup.sh` | Domain and SSL setup script | ✅ Created |

## 🔧 Detailed Setup Instructions

### 1. Database Setup

```bash
# Create PostgreSQL database
fly postgres create --name learning-assistant-db --region bom --initial-cluster-size 1

# Attach database to application
fly postgres attach --app learning-assistant-lively-rain-3457 learning-assistant-db

# Set additional database configuration
fly secrets set \
  DB_SSL=true \
  DB_MAX_CONNECTIONS=20 \
  DB_IDLE_TIMEOUT=30000 \
  DB_CONNECTION_TIMEOUT=10000 \
  --app learning-assistant-lively-rain-3457
```

### 2. Environment Variables and Secrets

```bash
# Run the secrets setup script
./fly-secrets-setup.sh

# Or set manually
fly secrets set \
  APP_SECRET="your_app_secret_key" \
  JWT_SECRET="your_jwt_secret_key" \
  NEXTAUTH_SECRET="your_nextauth_secret" \
  NEXTAUTH_URL="https://learning-assistant-lively-rain-3457.fly.dev" \
  --app learning-assistant-lively-rain-3457
```

### 3. Volume Configuration

```bash
# Run the volumes setup script
./fly-volumes-setup.sh

# Or create volumes manually
fly volumes create learning_assistant_data --region bom --size 10 --app learning-assistant-lively-rain-3457
fly volumes create learning_assistant_logs --region bom --size 5 --app learning-assistant-lively-rain-3457
```

### 4. Multi-Region Deployment (Optional)

```bash
# Run the regions setup script
./fly-regions-setup.sh

# Or configure manually
fly regions add sin nrt --app learning-assistant-lively-rain-3457
fly autoscale set --min-machines-running=1 --max-machines-running=10 --app learning-assistant-lively-rain-3457
```

### 5. Monitoring Setup

```bash
# Run the monitoring setup script
./fly-monitoring-setup.sh

# Enable monitoring
fly secrets set \
  ENABLE_METRICS=true \
  METRICS_PORT=9091 \
  MONITORING_ENABLED=true \
  --app learning-assistant-lively-rain-3457
```

### 6. Custom Domain (Optional)

```bash
# Run the domain setup script
./fly-domain-ssl-setup.sh

# Or configure manually
fly certs create yourdomain.com --app learning-assistant-lively-rain-3457
```

## 🐳 Docker Configuration

### Using the Optimized Dockerfile

The project includes an optimized Dockerfile specifically for Fly.io:

```bash
# Build locally for testing
docker build -f Dockerfile.fly -t learning-assistant .

# Run locally
docker run -p 3000:3000 learning-assistant
```

### Key Optimizations

- Multi-stage build for smaller image size
- PostgreSQL client included
- Health checks configured
- Security optimizations (non-root user)
- Proper signal handling with dumb-init

## 🔍 Health Checks and Monitoring

### Health Check Endpoints

| Endpoint | Purpose | Method |
|----------|---------|--------|
| `/api/health` | Comprehensive health check | GET |
| `/api/health` | Quick health check | HEAD |
| `/api/metrics` | Prometheus metrics | GET |

### Monitoring Tools

```bash
# Check application status
fly status --app learning-assistant-lively-rain-3457

# View logs
fly logs --app learning-assistant-lively-rain-3457

# Check health
curl https://learning-assistant-lively-rain-3457.fly.dev/api/health

# Monitor with dashboard
./tmp/monitoring-dashboard.sh
```

## 📊 Scaling Configuration

### Auto-scaling

```bash
# Enable auto-scaling
fly autoscale set \
  --min-machines-running=1 \
  --max-machines-running=10 \
  --metrics-target-cpu-percent=70 \
  --metrics-target-memory-percent=80 \
  --app learning-assistant-lively-rain-3457
```

### Manual Scaling

```bash
# Scale up
fly scale count 3 --app learning-assistant-lively-rain-3457

# Scale in specific region
fly scale count 2 --region sin --app learning-assistant-lively-rain-3457
```

## 🗄️ Database Management

### Migrations

```bash
# Run migrations (automatic during deployment)
fly ssh console --app learning-assistant-lively-rain-3457 --command "node scripts/migrate.js"

# Connect to database
fly postgres connect --app learning-assistant-db
```

### Backups

```bash
# List backups
fly postgres list-snapshots --app learning-assistant-db

# Create backup
fly postgres backup --app learning-assistant-db
```

## 🔐 Security Configuration

### SSL/TLS

- Automatic SSL certificate generation
- HTTPS redirect enabled
- Security headers configured
- HSTS enabled

### Environment Security

```bash
# Set security-related environment variables
fly secrets set \
  SECURE_COOKIES=true \
  TRUST_PROXY=true \
  NODE_ENV=production \
  --app learning-assistant-lively-rain-3457
```

## 🌐 Custom Domain Setup

### DNS Configuration

Add these records to your DNS provider:

```
Type: A
Name: @
Value: [IP from fly ips list]

Type: AAAA
Name: @
Value: [IPv6 from fly ips list]
```

### SSL Certificate

```bash
# Create certificate
fly certs create yourdomain.com --app learning-assistant-lively-rain-3457

# Check certificate status
fly certs show yourdomain.com --app learning-assistant-lively-rain-3457
```

## 🚀 Deployment Process

### Standard Deployment

```bash
# Deploy application
fly deploy --app learning-assistant-lively-rain-3457

# Deploy with specific Dockerfile
fly deploy --dockerfile Dockerfile.fly --app learning-assistant-lively-rain-3457
```

### Rolling Deployment

```bash
# Deploy with zero downtime
fly deploy --strategy rolling --app learning-assistant-lively-rain-3457
```

### Deployment Verification

```bash
# Check deployment status
fly status --app learning-assistant-lively-rain-3457

# Test health endpoint
curl https://learning-assistant-lively-rain-3457.fly.dev/api/health

# Check logs
fly logs --app learning-assistant-lively-rain-3457
```

## 🔧 Troubleshooting

### Common Issues

1. **Database Connection Issues**
   ```bash
   # Check database status
   fly postgres status --app learning-assistant-db
   
   # Verify connection string
   fly ssh console --app learning-assistant-lively-rain-3457 --command "echo $DATABASE_URL"
   ```

2. **Memory Issues**
   ```bash
   # Check memory usage
   fly ssh console --app learning-assistant-lively-rain-3457 --command "free -h"
   
   # Scale VM size
   fly scale vm shared-cpu-2x --app learning-assistant-lively-rain-3457
   ```

3. **SSL Certificate Issues**
   ```bash
   # Check certificate status
   fly certs show yourdomain.com --app learning-assistant-lively-rain-3457
   
   # Verify DNS propagation
   dig yourdomain.com
   ```

### Debug Commands

```bash
# SSH into running machine
fly ssh console --app learning-assistant-lively-rain-3457

# Check machine resources
fly ssh console --app learning-assistant-lively-rain-3457 --command "top"

# View application logs
fly logs --app learning-assistant-lively-rain-3457 --follow
```

## 📊 Performance Optimization

### Database Optimization

```bash
# Set connection pool settings
fly secrets set \
  DB_MAX_CONNECTIONS=20 \
  DB_IDLE_TIMEOUT=30000 \
  --app learning-assistant-lively-rain-3457
```

### Caching Configuration

```bash
# Enable caching
fly secrets set \
  ENABLE_CACHE=true \
  CACHE_TTL=3600 \
  --app learning-assistant-lively-rain-3457
```

## 🔄 Backup and Recovery

### Application Backup

```bash
# Create volume snapshots
fly volumes snapshot create <volume-id> --app learning-assistant-lively-rain-3457

# Export configuration
fly config save --app learning-assistant-lively-rain-3457
```

### Database Backup

```bash
# Create database backup
fly postgres backup --app learning-assistant-db

# Export database
fly postgres export --app learning-assistant-db > backup.sql
```

## 📈 Monitoring and Alerting

### Metrics Collection

```bash
# View metrics
curl https://learning-assistant-lively-rain-3457.fly.dev/api/metrics

# Check health status
curl https://learning-assistant-lively-rain-3457.fly.dev/api/health | jq
```

### Log Management

```bash
# View recent logs
fly logs --app learning-assistant-lively-rain-3457

# Follow logs in real-time
fly logs --app learning-assistant-lively-rain-3457 --follow

# Search logs
fly logs --app learning-assistant-lively-rain-3457 | grep "ERROR"
```

## 🔐 Security Best Practices

1. **Environment Variables**
   - Use secrets for sensitive data
   - Never commit secrets to version control
   - Rotate secrets regularly

2. **Network Security**
   - Use internal networks for database connections
   - Enable SSL/TLS for all connections
   - Configure proper CORS settings

3. **Access Control**
   - Limit SSH access
   - Use proper authentication
   - Regular security audits

## 📋 Maintenance Tasks

### Regular Tasks

```bash
# Update dependencies
npm update

# Check for security vulnerabilities
npm audit

# Update Docker base image
docker pull node:20-alpine
```

### Monthly Tasks

```bash
# Review logs for issues
fly logs --app learning-assistant-lively-rain-3457 | grep -i error

# Check database performance
fly postgres metrics --app learning-assistant-db

# Review scaling metrics
fly autoscale show --app learning-assistant-lively-rain-3457
```

## 🆘 Support and Resources

### Fly.io Documentation

- [Fly.io Docs](https://fly.io/docs/)
- [Fly.io Community](https://community.fly.io/)
- [Fly.io Status](https://status.fly.io/)

### Application-Specific Support

- Check application logs: `fly logs --app learning-assistant-lively-rain-3457`
- Monitor health: `https://learning-assistant-lively-rain-3457.fly.dev/api/health`
- Review configuration: `fly config show --app learning-assistant-lively-rain-3457`

---

## 🎉 Deployment Complete!

Your Learning Assistant application is now deployed on Fly.io with:

✅ Production-ready configuration  
✅ PostgreSQL database with SSL  
✅ Multi-region deployment capability  
✅ Persistent volume storage  
✅ Health checks and monitoring  
✅ SSL certificates and security  
✅ Auto-scaling configuration  
✅ Comprehensive logging  

### Next Steps

1. Test the deployment thoroughly
2. Set up monitoring and alerts
3. Configure custom domain (if needed)
4. Set up CI/CD pipeline
5. Plan backup and recovery procedures

**Happy deploying! 🚀**