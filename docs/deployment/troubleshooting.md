# Deployment Troubleshooting Guide

## Overview

This comprehensive troubleshooting guide covers common deployment issues, debugging techniques, and solutions for the Learning Assistant application across all supported platforms.

## Quick Diagnosis Checklist

### Application Health Check
```bash
# 1. Check if application is running
curl -f http://your-domain.com/api/health

# 2. Check application logs
# Platform-specific log commands below

# 3. Verify environment variables
echo $NODE_ENV
echo $DATABASE_URL

# 4. Test database connection
# Platform-specific database tests below

# 5. Check network connectivity
ping your-domain.com
nslookup your-domain.com
```

## Common Issues by Category

## Build & Deployment Issues

### 1. Build Failures

#### Node.js Version Mismatch
```bash
# Problem: Build fails with Node.js version errors
# Solution: Ensure package.json specifies correct version

# Check current Node.js version
node --version

# Fix in package.json
{
  "engines": {
    "node": "20.x",
    "npm": ">=9.0.0"
  }
}

# Platform-specific fixes:
# - Fly.io: Uses Node.js from package.json engines field
# - Render: Specify runtime in render.yaml
# - Railway: Auto-detects from package.json
# - Heroku: Uses engines field or .nvmrc file
```

#### Dependency Installation Failures
```bash
# Problem: npm install fails during build
# Solution: Clear cache and fix dependencies

# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall dependencies
npm install

# Fix package vulnerabilities
npm audit fix

# Platform-specific solutions:
# Docker: Use npm ci instead of npm install
# Ensure .dockerignore excludes node_modules
```

#### Build Timeout
```bash
# Problem: Build times out on platform
# Solution: Optimize build process

# Reduce build size in next.config.js
module.exports = {
  experimental: {
    outputFileTracingExcludes: {
      '*': [
        'node_modules/@swc/core-linux-x64-gnu',
        'node_modules/@swc/core-linux-x64-musl',
        'node_modules/@esbuild/linux-x64',
      ],
    },
  },
}

# Use Docker multi-stage builds
# Optimize dependencies (remove dev dependencies in production)
npm ci --omit=dev

# Platform-specific solutions:
# - Render: Upgrade to higher plan for more build time
# - Vercel: Split into smaller functions
# - Railway: Use build command optimization
```

#### Out of Memory During Build
```bash
# Problem: Build runs out of memory
# Solution: Increase memory or optimize build

# Set Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Optimize Next.js build
# next.config.js
module.exports = {
  experimental: {
    workerThreads: false,
    cpus: 1
  }
}

# Platform-specific solutions:
# - Heroku: Use larger dyno for build
# - DigitalOcean: Increase app size temporarily
# - AWS: Use larger instance for CodeBuild
```

### 2. Application Start Issues

#### Port Binding Errors
```bash
# Problem: Application can't bind to port
# Solution: Check port configuration

# Ensure app listens on correct port
const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});

# Check if port is in use
netstat -tlnp | grep :3000
lsof -i :3000

# Platform-specific solutions:
# - Heroku: Always use process.env.PORT
# - Railway: Use PORT environment variable
# - Fly.io: Configure internal_port in fly.toml
```

#### Permission Errors
```bash
# Problem: Permission denied errors
# Solution: Fix file permissions

# Fix file permissions
chmod +x start.sh
chmod 644 package.json

# Docker permission issues
# Use non-root user in Dockerfile
USER nextjs

# Platform-specific solutions:
# - AWS ECS: Check task execution role
# - GCP Cloud Run: Verify service account permissions
# - Azure: Check managed identity configuration
```

## Database Issues

### 1. Connection Problems

#### Database Connection Refused
```bash
# Problem: Can't connect to database
# Solution: Check connection string and network

# Test PostgreSQL connection
psql $DATABASE_URL -c "SELECT 1"

# Test with explicit connection details
psql -h hostname -p 5432 -U username -d database

# Check database URL format
echo $DATABASE_URL
# Should be: postgresql://user:pass@host:port/database

# Platform-specific solutions:
# - Render: Check if database is in same region
# - Railway: Verify database service is running
# - AWS RDS: Check security groups and VPC
# - DigitalOcean: Verify trusted sources
```

#### SSL/TLS Connection Issues
```bash
# Problem: SSL connection required but not configured
# Solution: Enable SSL in connection string

# Add SSL mode to connection string
DATABASE_URL=postgresql://user:pass@host:port/database?sslmode=require

# For development, disable SSL requirement
DATABASE_URL=postgresql://user:pass@host:port/database?sslmode=disable

# Test SSL connection
psql "$DATABASE_URL" -c "SHOW ssl"

# Platform-specific solutions:
# - AWS RDS: SSL is required by default
# - Google Cloud SQL: Enable SSL connections
# - Azure Database: Force SSL connections
```

#### Database Authentication Failures
```bash
# Problem: Authentication failed for user
# Solution: Verify credentials and user permissions

# Check if user exists
psql -h hostname -U postgres -c "SELECT * FROM pg_user WHERE usename='your_user'"

# Grant permissions
GRANT ALL PRIVILEGES ON DATABASE your_db TO your_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;

# Reset password
ALTER USER your_user WITH PASSWORD 'new_password';

# Platform-specific solutions:
# - Managed databases: Use provided connection strings
# - Self-hosted: Check pg_hba.conf configuration
```

### 2. Migration Issues

#### Migration Failures
```bash
# Problem: Database migrations fail
# Solution: Check migration state and fix errors

# Check current migration status
npm run db:status

# Run migrations manually
npm run db:migrate

# Rollback if needed
npm run db:rollback

# Reset database (DANGER: loses data)
npm run db:reset

# Check migration files for syntax errors
# Ensure migrations are idempotent
```

#### Schema Sync Issues
```bash
# Problem: Database schema out of sync
# Solution: Reset and re-run migrations

# Compare current schema with migrations
pg_dump --schema-only $DATABASE_URL > current_schema.sql

# Manual schema fixes (if safe)
psql $DATABASE_URL -f fix_schema.sql

# Full reset (development only)
DROP DATABASE IF EXISTS your_database;
CREATE DATABASE your_database;
npm run db:migrate
npm run db:seed
```

## Network & DNS Issues

### 1. Domain Configuration

#### Domain Not Resolving
```bash
# Problem: Domain doesn't point to application
# Solution: Check DNS configuration

# Check DNS resolution
nslookup your-domain.com
dig your-domain.com

# Check A records
dig A your-domain.com

# Check CNAME records
dig CNAME www.your-domain.com

# Common DNS record configurations:
# A record: your-domain.com -> IP address
# CNAME: www.your-domain.com -> your-domain.com
# CNAME: your-domain.com -> platform-url.platform.com
```

#### SSL Certificate Issues
```bash
# Problem: SSL certificate not working
# Solution: Check certificate configuration

# Check certificate details
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# Check certificate expiration
echo | openssl s_client -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -dates

# Platform-specific solutions:
# - Let's Encrypt: Renew certificates
# - Cloudflare: Check SSL mode
# - Platform managed: Verify domain ownership
```

#### CORS Errors
```bash
# Problem: Cross-origin requests blocked
# Solution: Configure CORS properly

# Check CORS configuration
# In next.config.js or middleware
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'https://your-domain.com',
  credentials: true,
  optionsSuccessStatus: 200
};

# Test CORS
curl -H "Origin: https://your-domain.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     https://your-api-domain.com/api/endpoint
```

## Performance Issues

### 1. Slow Application Response

#### High Memory Usage
```bash
# Problem: Application using too much memory
# Solution: Optimize memory usage

# Check memory usage
free -h
ps aux | grep node

# Docker memory usage
docker stats

# Optimize Node.js memory
export NODE_OPTIONS="--max-old-space-size=512"

# Platform-specific solutions:
# - Heroku: Upgrade dyno type
# - Railway: Increase memory allocation
# - DigitalOcean: Resize app instance
```

#### High CPU Usage
```bash
# Problem: High CPU utilization
# Solution: Optimize application performance

# Check CPU usage
top
htop

# Profile Node.js application
node --prof your-app.js
node --prof-process isolate-*.log > processed.txt

# Platform-specific solutions:
# - AWS: Use larger instance types
# - GCP: Increase CPU allocation
# - Azure: Scale up container instances
```

#### Slow Database Queries
```bash
# Problem: Database queries are slow
# Solution: Optimize queries and add indexes

# Enable query logging (PostgreSQL)
ALTER SYSTEM SET log_statement = 'all';
SELECT pg_reload_conf();

# Check slow queries
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

# Add indexes for frequently queried columns
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

# Analyze query performance
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'user@example.com';
```

## Platform-Specific Issues

### Fly.io

#### Common Issues
```bash
# App not starting
flyctl logs

# Check app status
flyctl status

# SSH into app for debugging
flyctl ssh console

# Common fixes:
# - Increase memory allocation in fly.toml
# - Check environment variables: flyctl secrets list
# - Verify image build: flyctl deploy --build-only
```

### Render

#### Common Issues
```bash
# Build failures
# Check build logs in Render dashboard

# Service not responding
# Verify health check endpoint is accessible

# Database connection issues
# Check if database is in same region
# Verify internal vs external connection strings

# Common fixes:
# - Use internal database URL for same-region connections
# - Check if service plan includes necessary resources
# - Verify environment variables in dashboard
```

### Railway

#### Common Issues
```bash
# Environment variables not loading
railway variables list

# Service not deploying
railway logs

# Database connection failures
# Check if database service is deployed
# Verify service linking

# Common fixes:
# - Link services properly: railway service connect
# - Check if PORT is automatically assigned
# - Verify resource limits aren't exceeded
```

### AWS

#### Common Issues
```bash
# ECS task failures
aws ecs describe-services --cluster cluster-name --services service-name

# Check task definition
aws ecs describe-task-definition --task-definition task-def-name

# ALB health check failures
aws elbv2 describe-target-health --target-group-arn arn

# Common fixes:
# - Check security groups allow traffic
# - Verify task execution role permissions
# - Check CloudWatch logs for errors
```

### Google Cloud

#### Common Issues
```bash
# Cloud Run cold starts
gcloud run services describe service-name --region=region

# Database connection from Cloud Run
# Check if Cloud SQL proxy is configured
# Verify service account has Cloud SQL permissions

# Build failures in Cloud Build
gcloud builds log build-id

# Common fixes:
# - Use Cloud SQL proxy for database connections
# - Increase memory/CPU allocation
# - Check IAM permissions for Cloud Build
```

### Azure

#### Common Issues
```bash
# Container Apps not starting
az containerapp logs show --name app-name --resource-group rg-name

# Database connection to Azure SQL
# Check firewall rules
# Verify connection string format

# Key Vault access issues
# Check managed identity configuration
# Verify Key Vault access policies

# Common fixes:
# - Enable managed identity for Container Apps
# - Add client IP to SQL Server firewall
# - Use proper connection string format for Azure SQL
```

## Debugging Techniques

### 1. Log Analysis

#### Application Logs
```bash
# Next.js application logs
console.log('Environment:', process.env.NODE_ENV);
console.log('Database URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');

# Structured logging
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'app.log' })
  ]
});

logger.info('Application started', { port: process.env.PORT });
```

#### Database Logs
```bash
# PostgreSQL query logging
# In postgresql.conf:
log_statement = 'all'
log_min_duration_statement = 1000  # Log queries > 1 second

# View PostgreSQL logs
tail -f /var/log/postgresql/postgresql-*.log

# Query statistics
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;
```

### 2. Health Monitoring

#### Health Check Endpoint
```javascript
// pages/api/health.js
export default async function handler(req, res) {
  try {
    // Check database connection
    const dbCheck = await checkDatabase();
    
    // Check Redis connection (if applicable)
    const redisCheck = await checkRedis();
    
    // Check external services
    const externalCheck = await checkExternalServices();
    
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbCheck,
        redis: redisCheck,
        external: externalCheck
      }
    };
    
    res.status(200).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
}
```

#### Monitoring Scripts
```bash
#!/bin/bash
# health-check.sh
URL="https://your-domain.com/api/health"
TIMEOUT=10

response=$(curl -s -w "%{http_code}" --max-time $TIMEOUT "$URL")
status_code="${response: -3}"

if [ "$status_code" -eq 200 ]; then
    echo "✅ Health check passed"
    exit 0
else
    echo "❌ Health check failed with status: $status_code"
    echo "Response: ${response%???}"
    exit 1
fi
```

### 3. Performance Profiling

#### Node.js Profiling
```bash
# CPU profiling
node --prof app.js
# Generate profile after running
node --prof-process isolate-*.log > cpu-profile.txt

# Memory profiling
node --inspect app.js
# Connect Chrome DevTools to debug memory usage

# Heap snapshot
const v8 = require('v8');
const fs = require('fs');

function takeHeapSnapshot() {
  const heapSnapshot = v8.writeHeapSnapshot();
  console.log('Heap snapshot written to', heapSnapshot);
}
```

## Emergency Response

### 1. Application Down

#### Immediate Actions
```bash
# 1. Check service status
curl -I https://your-domain.com

# 2. Check platform status
# - Platform status pages
# - Check for maintenance windows

# 3. Review recent deployments
# - Rollback if recent deployment caused issue
# - Check deployment logs

# 4. Check resource usage
# - CPU, memory, disk usage
# - Database connections
# - Error rates
```

#### Recovery Steps
```bash
# Rollback deployment
# Platform-specific rollback commands:

# Fly.io
flyctl releases list
flyctl rollback --app app-name

# Render
# Use Render dashboard to rollback to previous deploy

# Railway
railway rollback

# Heroku
heroku rollback

# Manual rollback (Git)
git revert HEAD
git push origin main
```

### 2. Database Issues

#### Emergency Database Recovery
```bash
# 1. Check database status
psql $DATABASE_URL -c "SELECT 1"

# 2. Check database locks
SELECT * FROM pg_stat_activity WHERE state = 'active';

# 3. Kill long-running queries (if safe)
SELECT pg_terminate_backend(pid) FROM pg_stat_activity 
WHERE state = 'active' AND query_start < NOW() - INTERVAL '1 hour';

# 4. Check database disk space
SELECT pg_size_pretty(pg_database_size('your_database'));

# 5. Emergency read-only mode
# Set database to read-only temporarily
ALTER DATABASE your_database SET default_transaction_read_only = on;
```

### 3. Performance Degradation

#### Quick Performance Fixes
```bash
# 1. Scale up resources immediately
# Platform-specific scaling commands

# 2. Enable caching
# Add Redis caching for database queries
# Enable CDN for static assets

# 3. Database optimization
# Add missing indexes
# Update table statistics
ANALYZE;

# 4. Rate limiting
# Implement or tighten rate limiting
# Block suspicious IP addresses
```

## Prevention & Best Practices

### 1. Monitoring Setup

#### Application Monitoring
```javascript
// Basic monitoring middleware
function monitoringMiddleware(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    
    // Send metrics to monitoring service
    if (duration > 1000) {
      logger.warn('Slow request', {
        method: req.method,
        path: req.path,
        duration,
        statusCode: res.statusCode
      });
    }
  });
  
  next();
}
```

#### Alerting Rules
```yaml
# Example alerting configuration
alerts:
  - name: high_error_rate
    condition: error_rate > 5%
    duration: 5m
    
  - name: high_response_time
    condition: avg_response_time > 2s
    duration: 2m
    
  - name: database_connection_failed
    condition: database_connections == 0
    duration: 1m
    
  - name: memory_usage_high
    condition: memory_usage > 80%
    duration: 5m
```

### 2. Deployment Automation

#### Health Check Automation
```bash
#!/bin/bash
# deployment-health-check.sh
set -e

URL="$1"
MAX_ATTEMPTS=30
SLEEP_TIME=10

echo "🔍 Checking deployment health for $URL"

for i in $(seq 1 $MAX_ATTEMPTS); do
    if curl -f -s "$URL/api/health" > /dev/null; then
        echo "✅ Deployment healthy after $((i * SLEEP_TIME)) seconds"
        exit 0
    fi
    
    echo "⏳ Attempt $i/$MAX_ATTEMPTS failed, retrying in ${SLEEP_TIME}s..."
    sleep $SLEEP_TIME
done

echo "❌ Deployment failed health check after $((MAX_ATTEMPTS * SLEEP_TIME)) seconds"
exit 1
```

## Getting Help

### 1. Information to Gather

#### Before Seeking Help
```bash
# Application information
- Platform and plan
- Deployment method
- Recent changes
- Error messages and logs
- Steps to reproduce

# System information
- Node.js version
- Database type and version
- Environment variables (without secrets)
- Resource usage (CPU, memory)

# Network information
- Domain configuration
- SSL certificate status
- DNS resolution
- CORS configuration
```

### 2. Support Channels

#### Platform Support
- **Fly.io**: Community forum, Discord
- **Render**: Support tickets, community
- **Railway**: Discord, GitHub discussions
- **Heroku**: Support tickets, docs
- **DigitalOcean**: Support tickets, community
- **AWS**: Support cases, forums
- **Google Cloud**: Support cases, Stack Overflow
- **Azure**: Support requests, community

#### Community Resources
- GitHub Issues: Application-specific problems
- Stack Overflow: General deployment questions
- Platform Discord/Slack: Real-time help
- Documentation: Platform-specific guides

---

**Remember**: When troubleshooting, always start with the basics (health check, logs, environment variables) before diving into complex debugging. Document your solutions for future reference.