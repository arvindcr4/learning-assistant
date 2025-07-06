# DevOps Guide - Personal Learning Assistant

This guide provides comprehensive instructions for deploying and managing the Personal Learning Assistant application using the complete DevOps infrastructure.

## 🏗️ Infrastructure Overview

The DevOps setup includes:

- **Docker**: Multi-stage containerization for production-ready deployments
- **CI/CD**: GitHub Actions pipeline with automated testing, security scanning, and deployment
- **Database**: PostgreSQL with automated migrations and backup procedures
- **Caching**: Redis for session storage and performance optimization
- **Monitoring**: Prometheus + Grafana stack with custom metrics
- **Logging**: Winston-based structured logging with log rotation
- **Security**: Comprehensive security headers, rate limiting, and HTTPS
- **Backup**: Automated backup and recovery procedures

## 📋 Prerequisites

### Development Environment
- Node.js 18+ 
- Docker and Docker Compose
- Git
- PostgreSQL (for local development)
- Redis (for local development)

### Production Environment
- Docker and Docker Compose
- SSL certificates (Let's Encrypt recommended)
- Domain name with DNS configured
- Sufficient server resources (minimum 2GB RAM, 20GB storage)

## 🚀 Quick Start

### 1. Clone and Setup
```bash
git clone <repository-url>
cd learning-assistant

# Copy environment configuration
cp .env.example .env.local

# Edit environment variables
nano .env.local
```

### 2. Development Setup
```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# Run database migrations
npm run migrate

# Start development server
npm run dev
```

### 3. Production Setup
```bash
# Configure environment variables
cp .env.example .env

# Generate SSL certificates
./scripts/ssl-setup.sh

# Start production environment
docker-compose up -d

# Verify deployment
curl https://your-domain.com/api/health
```

## 🔧 Configuration

### Environment Variables

#### Core Application
```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
```

#### Security
```bash
CORS_ORIGIN=https://your-domain.com
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=15
BCRYPT_ROUNDS=12
```

#### Monitoring & Logging
```bash
LOG_LEVEL=info
ENABLE_APM=true
NEW_RELIC_LICENSE_KEY=your-key
SENTRY_DSN=your-sentry-dsn
```

#### External Services
```bash
OPENAI_API_KEY=your-openai-key
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
S3_BUCKET=your-backup-bucket
```

## 🐳 Docker Deployment

### Development
```bash
# Start all services
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f app

# Stop services
docker-compose -f docker-compose.dev.yml down
```

### Production
```bash
# Build and start production
docker-compose up -d --build

# Scale application (if needed)
docker-compose up -d --scale app=3

# Update application
docker-compose pull
docker-compose up -d --no-deps app
```

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

The CI/CD pipeline automatically:

1. **Code Quality**: Linting, type checking, and testing
2. **Security**: Dependency scanning and vulnerability checks
3. **Build**: Docker image creation and registry push
4. **Deploy**: Automated deployment to staging/production
5. **Monitor**: Health checks and notifications

### Deployment Triggers

- **Push to `main`**: Deploys to production
- **Push to `develop`**: Deploys to staging
- **Pull Requests**: Runs tests and security scans

### Setup Instructions

1. **Configure Secrets** in GitHub repository:
   ```
   DOCKER_REGISTRY_TOKEN
   PRODUCTION_SERVER_HOST
   PRODUCTION_SERVER_USER
   PRODUCTION_SSH_KEY
   SLACK_WEBHOOK (optional)
   ```

2. **Configure Environments**:
   - Create `staging` and `production` environments
   - Set up approval rules for production deployments

## 📊 Monitoring & Observability

### Metrics Dashboard

Access Grafana dashboard at `http://your-domain:3001`

**Key Metrics**:
- API response times and error rates
- Database query performance
- User engagement and learning progress
- System resource utilization
- Business metrics (learning goals, completion rates)

### Logging

**Log Levels**:
- `error`: Application errors and exceptions
- `warn`: Warning conditions and rate limiting
- `info`: General application flow
- `debug`: Detailed debugging information

**Log Locations**:
- Container logs: `docker-compose logs`
- File logs: `./logs/` directory
- Centralized: Grafana Loki (if configured)

### Health Checks

- **Application**: `GET /api/health`
- **Database**: Connection and query tests
- **Redis**: Connectivity and performance
- **External APIs**: Integration status

## 🗄️ Database Management

### Migrations

```bash
# Run migrations
node scripts/migrate.js up

# Rollback to version
node scripts/migrate.js down 5

# Check migration status
node scripts/migrate.js status
```

### Backup and Restore

```bash
# Create backup
./scripts/backup.sh

# List available backups
./scripts/restore.sh list

# Restore from backup
./scripts/restore.sh restore 20231225_143000

# Interactive restore
./scripts/restore.sh interactive
```

### Scheduled Maintenance

```bash
# Install cron jobs
crontab scripts/crontab.txt

# Manual maintenance
./scripts/db-maintenance.sh
```

## 🔒 Security

### SSL/TLS Setup

```bash
# Generate self-signed certificate (development)
DOMAIN=localhost ./scripts/ssl-setup.sh self-signed

# Install Let's Encrypt certificate (production)
DOMAIN=your-domain.com ./scripts/ssl-setup.sh letsencrypt

# Verify certificate
./scripts/ssl-setup.sh verify
```

### Security Features

- **HTTPS**: Automatic redirect and HSTS headers
- **CSP**: Content Security Policy with strict rules
- **Rate Limiting**: API and authentication endpoint protection
- **Input Validation**: XSS and injection prevention
- **Security Headers**: Comprehensive header configuration

### Security Monitoring

- Failed authentication attempts
- Suspicious request patterns
- Rate limit violations
- SSL certificate expiration alerts

## 📈 Performance Optimization

### Application Performance

- **Caching**: Redis for session and content caching
- **Compression**: Gzip compression for all text content
- **CDN**: Static asset optimization
- **Database**: Query optimization and indexing

### Monitoring Performance

- **APM**: Application Performance Monitoring with custom metrics
- **Database**: Query performance tracking
- **User Experience**: Learning session analytics
- **Infrastructure**: System resource monitoring

## 🚨 Troubleshooting

### Common Issues

#### Application Won't Start
```bash
# Check logs
docker-compose logs app

# Verify environment variables
docker-compose config

# Check database connectivity
docker-compose exec app npm run db:test
```

#### Database Connection Issues
```bash
# Check database status
docker-compose ps postgres

# Test connection
docker-compose exec postgres psql -U learning_user -d learning_assistant_db

# Reset database
docker-compose down -v
docker-compose up -d postgres
```

#### SSL Certificate Issues
```bash
# Check certificate validity
./scripts/ssl-setup.sh verify

# Regenerate certificate
./scripts/ssl-setup.sh letsencrypt

# Check Nginx configuration
docker-compose exec nginx nginx -t
```

### Log Analysis

```bash
# Real-time application logs
docker-compose logs -f app

# Error logs only
docker-compose logs app | grep ERROR

# Performance logs
docker-compose logs app | grep "Slow"

# Security events
docker-compose logs app | grep "Security"
```

## 🔧 Maintenance Tasks

### Daily
- Monitor application health
- Check error logs
- Verify backup completion

### Weekly
- Review performance metrics
- Update dependencies
- Security scan results

### Monthly
- SSL certificate renewal check
- Database optimization
- Log rotation and cleanup
- Backup retention policy review

## 📞 Support & Monitoring

### Alerting

Configure alerts for:
- Application downtime
- High error rates
- Database connection failures
- SSL certificate expiration
- High resource utilization

### Notification Channels

- **Slack**: Real-time alerts and deployment notifications
- **Email**: Critical system alerts
- **Discord**: Development team notifications

### Emergency Procedures

1. **Application Down**: 
   - Check health endpoint
   - Review recent deployments
   - Scale containers if needed

2. **Database Issues**:
   - Check connection pool
   - Review slow queries
   - Consider read replica failover

3. **Security Breach**:
   - Enable maintenance mode
   - Review access logs
   - Rotate secrets and keys

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## 🤝 Contributing

1. Create feature branch from `develop`
2. Make changes with appropriate tests
3. Ensure CI pipeline passes
4. Create pull request with detailed description
5. Deploy to staging for testing
6. Merge to `main` for production deployment

---

For additional support or questions, please refer to the project documentation or contact the development team.