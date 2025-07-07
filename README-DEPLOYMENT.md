# Learning Assistant Deployment Guide

## Overview

This comprehensive guide covers deployment of the Learning Assistant application across multiple cloud platforms and environments. The application is a Next.js 15 application with PostgreSQL/SQLite database support, Redis caching, and optional monitoring stack.

## Quick Start

Choose your deployment method:

- **[Fly.io](./docs/deployment/fly-io.md)** - Fastest deployment with auto-scaling
- **[Render](./docs/deployment/render.md)** - Easy deployment with Docker support
- **[Railway](./docs/deployment/railway.md)** - Developer-friendly with Git integration
- **[DigitalOcean App Platform](./docs/deployment/digitalocean.md)** - Managed platform with database
- **[AWS](./docs/deployment/aws.md)** - Full AWS stack with ECS/EKS
- **[Google Cloud](./docs/deployment/gcp.md)** - Cloud Run and GKE options
- **[Microsoft Azure](./docs/deployment/azure.md)** - Container Apps and AKS
- **[Linode](./docs/deployment/linode.md)** - Cost-effective VPS deployment

## Application Architecture

### Tech Stack
- **Frontend**: Next.js 15 with React 18
- **Backend**: Next.js API routes
- **Database**: PostgreSQL (production) / SQLite (development)
- **Cache**: Redis
- **Authentication**: Better Auth
- **Monitoring**: Prometheus + Grafana (optional)
- **Proxy**: Nginx (optional)

### Container Support
- Multi-stage Docker builds
- Health checks
- Non-root user security
- Optimized for production

## Prerequisites

### Required
- Node.js 20.x
- npm or yarn
- Git
- Docker (for containerized deployments)

### Optional
- PostgreSQL 15+
- Redis 7+
- Domain name (for custom domains)
- SSL certificate (for HTTPS)

## Environment Variables

### Core Configuration
```bash
# Application
NODE_ENV=production
PORT=3000
NEXT_TELEMETRY_DISABLED=1

# Database
DATABASE_URL=postgresql://user:password@host:5432/database
# OR for SQLite
DATABASE_URL=sqlite:./app.db

# Authentication
BETTER_AUTH_SECRET=your-secure-secret-key

# API URLs
NEXT_PUBLIC_API_URL=https://your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Optional Configuration
```bash
# Redis Cache
REDIS_URL=redis://host:6379

# Features
FEATURE_ANALYTICS_ENABLED=true
FEATURE_RECOMMENDATIONS_ENABLED=true
FEATURE_CHAT_ENABLED=true

# Monitoring
LOG_LEVEL=info
GRAFANA_PASSWORD=secure-password
```

## Deployment Methods

### 1. Platform-as-a-Service (PaaS) - Recommended
- **Fly.io**: Auto-scaling, edge deployment
- **Render**: Easy Docker deployment
- **Railway**: Git-based deployment
- **DigitalOcean App Platform**: Managed platform

### 2. Container Orchestration
- **AWS ECS/EKS**: Enterprise-grade
- **Google Cloud Run/GKE**: Serverless containers
- **Azure Container Apps/AKS**: Microsoft cloud
- **Linode Kubernetes Engine**: Cost-effective K8s

### 3. Virtual Private Servers
- **Linode**: Simple VPS deployment
- **DigitalOcean Droplets**: Docker Compose
- **AWS EC2**: Full control
- **Google Compute Engine**: Scalable VMs

## Quick Deployment Commands

### Using Docker Compose (Local/VPS)
```bash
# Clone repository
git clone https://github.com/your-repo/learning-assistant.git
cd learning-assistant

# Set environment variables
cp .env.example .env
# Edit .env with your configuration

# Deploy with Docker Compose
docker-compose up -d

# Check status
docker-compose ps
```

### Using Platform CLIs
```bash
# Fly.io
fly deploy

# Render
render deploy

# Railway
railway up

# DigitalOcean
doctl apps create --spec .do/app.yaml
```

## Database Setup

### PostgreSQL (Production)
```bash
# Create database
createdb learning_assistant_db

# Run migrations
npm run db:migrate

# Seed data (optional)
npm run db:seed
```

### SQLite (Development)
```bash
# Database auto-created on first run
npm run build
npm start
```

## Security Considerations

### Required Security Measures
1. **Secure Secrets**: Use platform secret management
2. **HTTPS**: Enable SSL/TLS certificates
3. **Environment Variables**: Never commit secrets
4. **Database Security**: Use strong passwords, connection pooling
5. **Container Security**: Non-root user, minimal base images

### Recommended Security Headers
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

## Monitoring & Observability

### Health Checks
- **Endpoint**: `/api/health`
- **Response**: `{"status": "ok", "timestamp": "..."}`
- **Monitoring**: Set up alerts for failed health checks

### Metrics (Optional)
- **Prometheus**: Metrics collection
- **Grafana**: Visualization dashboards
- **Logs**: Structured logging with Winston

### Performance Monitoring
- **Application Performance**: Response times, error rates
- **Database Performance**: Query performance, connection pooling
- **Infrastructure**: CPU, memory, disk usage

## Scaling Considerations

### Horizontal Scaling
- **Load Balancing**: Nginx, platform load balancers
- **Database**: Read replicas, connection pooling
- **Cache**: Redis cluster, distributed caching

### Vertical Scaling
- **CPU**: Monitor application performance
- **Memory**: Next.js build optimization
- **Storage**: Database size, log retention

## Cost Optimization

### Platform Costs (Estimated Monthly)
- **Fly.io**: $5-25 (shared-cpu-1x)
- **Render**: $7-25 (starter plan)
- **Railway**: $5-20 (hobby plan)
- **DigitalOcean**: $5-25 (basic app)
- **AWS**: $10-50 (ECS + RDS)
- **GCP**: $8-40 (Cloud Run + SQL)
- **Azure**: $10-45 (Container Apps + SQL)
- **Linode**: $5-20 (VPS + database)

### Cost Optimization Tips
1. **Right-sizing**: Start small, scale as needed
2. **Auto-scaling**: Use platform auto-scaling features
3. **Database**: Use managed databases for production
4. **CDN**: Enable CDN for static assets
5. **Monitoring**: Set up cost alerts

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Check Node.js version
node --version  # Should be 20.x

# Clear cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install

# Check build logs
npm run build 2>&1 | tee build.log
```

#### Database Connection Issues
```bash
# Test database connection
psql $DATABASE_URL

# Check environment variables
echo $DATABASE_URL

# Verify database exists
npm run db:status
```

#### Performance Issues
```bash
# Check memory usage
docker stats

# Monitor logs
docker logs -f container_name

# Database performance
EXPLAIN ANALYZE SELECT * FROM users;
```

### Getting Help

1. **Check Logs**: Application and platform logs
2. **Health Checks**: Verify `/api/health` endpoint
3. **Environment Variables**: Verify all required vars are set
4. **Database**: Check database connection and migrations
5. **Platform Documentation**: Refer to platform-specific guides

## Support

For deployment issues:
1. Check the platform-specific guide
2. Review the troubleshooting section
3. Check application logs
4. Verify environment variables
5. Test database connectivity

## Next Steps

1. **Choose Platform**: Select deployment platform
2. **Follow Guide**: Use platform-specific instructions
3. **Configure Domain**: Set up custom domain (optional)
4. **Set up Monitoring**: Configure health checks and alerts
5. **Test Deployment**: Verify all functionality works
6. **Performance Tuning**: Optimize based on usage patterns

---

**Note**: This guide assumes you have basic knowledge of command-line tools and cloud platforms. For beginners, we recommend starting with Fly.io or Render for the easiest deployment experience.