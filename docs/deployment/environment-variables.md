# Environment Variables Configuration Guide

## Overview

This guide provides comprehensive documentation for all environment variables used in the Learning Assistant application, including required variables, optional configurations, and platform-specific settings.

## Required Environment Variables

### Core Application Settings
```bash
# Node.js Environment
NODE_ENV=production                    # production, development, test
PORT=3000                             # Application port (default: 3000)
NEXT_TELEMETRY_DISABLED=1             # Disable Next.js telemetry

# API Configuration
NEXT_PUBLIC_API_URL=https://your-domain.com    # Public API URL
NEXT_PUBLIC_APP_URL=https://your-domain.com    # Public app URL
```

### Database Configuration
```bash
# PostgreSQL (Production)
DATABASE_URL=postgresql://user:password@host:5432/database

# SQLite (Development/Simple deployments)
DATABASE_URL=sqlite:./app.db

# Connection Pool Settings (PostgreSQL)
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_SSL_MODE=require
```

### Authentication
```bash
# Better Auth Secret (Required)
BETTER_AUTH_SECRET=your-secure-secret-key-min-32-chars

# Generate secure secret:
# openssl rand -base64 32
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Optional Environment Variables

### Feature Flags
```bash
# Core Features
FEATURE_ANALYTICS_ENABLED=true         # Enable analytics tracking
FEATURE_RECOMMENDATIONS_ENABLED=true   # Enable AI recommendations
FEATURE_CHAT_ENABLED=true             # Enable chat functionality
FEATURE_QUIZ_ENABLED=true             # Enable quiz features
FEATURE_PROGRESS_TRACKING=true        # Enable progress tracking

# Advanced Features
FEATURE_ADAPTIVE_LEARNING=true        # Enable adaptive learning algorithms
FEATURE_SPACED_REPETITION=true        # Enable spaced repetition
FEATURE_BEHAVIORAL_TRACKING=true      # Enable behavioral analytics
FEATURE_FATIGUE_DETECTION=true        # Enable fatigue detection
FEATURE_DIFFICULTY_CALIBRATION=true   # Enable difficulty calibration
```

### Cache Configuration
```bash
# Redis Cache
REDIS_URL=redis://host:6379
REDIS_PASSWORD=your-redis-password
REDIS_PREFIX=learning-assistant
REDIS_TTL=3600                        # Default TTL in seconds

# Memory Cache (alternative)
CACHE_TYPE=memory                      # memory, redis
CACHE_TTL=300                         # Cache TTL in seconds
```

### AI Service Configuration
```bash
# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4                    # gpt-4, gpt-3.5-turbo
OPENAI_MAX_TOKENS=1000
OPENAI_TEMPERATURE=0.7

# Alternative AI Providers
ANTHROPIC_API_KEY=your-anthropic-key
GOOGLE_AI_API_KEY=your-google-key
COHERE_API_KEY=your-cohere-key
```

### Logging Configuration
```bash
# Log Levels
LOG_LEVEL=info                        # error, warn, info, verbose, debug
LOG_FORMAT=combined                   # combined, common, dev, short, tiny

# Log Destinations
LOG_TO_FILE=true
LOG_FILE_PATH=./logs/app.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5

# External Logging Services
DATADOG_API_KEY=your-datadog-key
SENTRY_DSN=your-sentry-dsn
NEW_RELIC_LICENSE_KEY=your-newrelic-key
```

### Email Configuration
```bash
# Email Service (for notifications)
EMAIL_SERVICE=sendgrid                # sendgrid, mailgun, ses, smtp
EMAIL_API_KEY=your-email-api-key
EMAIL_FROM=noreply@your-domain.com

# SMTP Configuration
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_SECURE=false                     # true for 465, false for other ports
```

### File Storage
```bash
# Local Storage
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760               # 10MB in bytes

# AWS S3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name

# Google Cloud Storage
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_KEYFILE=./path/to/keyfile.json
GCS_BUCKET=your-bucket-name

# Azure Blob Storage
AZURE_STORAGE_ACCOUNT=your-account
AZURE_STORAGE_KEY=your-key
AZURE_CONTAINER=your-container
```

### Security Settings
```bash
# CORS Configuration
CORS_ORIGIN=https://your-domain.com   # comma-separated for multiple
CORS_CREDENTIALS=true

# Rate Limiting
RATE_LIMIT_WINDOW=900000             # 15 minutes in milliseconds
RATE_LIMIT_MAX=100                   # Max requests per window
RATE_LIMIT_SKIP_SUCCESSFUL=false

# Session Configuration
SESSION_SECRET=your-session-secret
SESSION_MAX_AGE=86400000            # 24 hours in milliseconds
SESSION_SECURE=true                 # true for HTTPS only
```

### Monitoring & Analytics
```bash
# Application Performance Monitoring
APM_ENABLED=true
APM_SERVICE_NAME=learning-assistant
APM_ENVIRONMENT=production

# Metrics Collection
METRICS_ENABLED=true
METRICS_PORT=9090
METRICS_PATH=/metrics

# Health Check Configuration
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_PATH=/api/health
```

## Platform-Specific Variables

### Fly.io
```bash
# Fly.io specific
FLY_APP_NAME=learning-assistant-app
FLY_REGION=dfw

# Auto-generated by Fly.io
DATABASE_URL=postgresql://...         # Auto-set if using Fly Postgres
REDIS_URL=redis://...                # Auto-set if using Fly Redis
```

### Render
```bash
# Render specific
RENDER_SERVICE_ID=srv-xxxxx
RENDER_EXTERNAL_URL=https://learning-assistant.onrender.com

# Auto-generated by Render
DATABASE_URL=postgresql://...         # Auto-set for Render PostgreSQL
REDIS_URL=redis://...                # Auto-set for Render Redis
```

### Railway
```bash
# Railway specific
RAILWAY_STATIC_URL=https://learning-assistant-production.up.railway.app
RAILWAY_PUBLIC_DOMAIN=learning-assistant-production.up.railway.app
RAILWAY_ENVIRONMENT=production

# Auto-generated by Railway
DATABASE_URL=postgresql://...         # Auto-set for Railway PostgreSQL
REDIS_URL=redis://...                # Auto-set for Railway Redis
PORT=3000                            # Auto-set by Railway
```

### Heroku
```bash
# Heroku specific
DYNO=web.1
HEROKU_APP_NAME=learning-assistant

# Auto-generated by Heroku
DATABASE_URL=postgresql://...         # Auto-set for Heroku Postgres
REDIS_URL=redis://...                # Auto-set for Heroku Redis
PORT=5000                            # Auto-set by Heroku
```

### DigitalOcean App Platform
```bash
# DigitalOcean specific
DO_APP_NAME=learning-assistant
DO_REGION=nyc

# Managed services
DATABASE_URL=postgresql://...         # DigitalOcean Managed Database
REDIS_URL=redis://...                # DigitalOcean Managed Redis
```

### AWS
```bash
# AWS specific
AWS_REGION=us-east-1
AWS_EXECUTION_ROLE=arn:aws:iam::...

# AWS services
DATABASE_URL=postgresql://...         # RDS connection string
REDIS_URL=redis://...                # ElastiCache connection string

# AWS Secrets Manager
AWS_SECRET_NAME=learning-assistant/prod
AWS_SECRET_REGION=us-east-1
```

### Google Cloud Platform
```bash
# GCP specific
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_REGION=us-central1

# Cloud SQL
DATABASE_URL=postgresql://...         # Cloud SQL connection string
REDIS_URL=redis://...                # Memory Store connection string

# Secret Manager
GCP_SECRET_NAME=learning-assistant-secrets
```

### Azure
```bash
# Azure specific
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_RESOURCE_GROUP=learning-assistant-rg

# Azure services
DATABASE_URL=postgresql://...         # Azure Database for PostgreSQL
REDIS_URL=redis://...                # Azure Cache for Redis

# Key Vault
AZURE_KEY_VAULT_URL=https://your-vault.vault.azure.net/
```

## Development vs Production

### Development Environment
```bash
# .env.development
NODE_ENV=development
PORT=3000
NEXT_TELEMETRY_DISABLED=1

# Local database
DATABASE_URL=sqlite:./dev.db

# Local auth secret
BETTER_AUTH_SECRET=dev-secret-key-not-for-production

# API URLs
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Feature flags (enable all for development)
FEATURE_ANALYTICS_ENABLED=true
FEATURE_RECOMMENDATIONS_ENABLED=true
FEATURE_CHAT_ENABLED=true

# Logging
LOG_LEVEL=debug
LOG_TO_FILE=false
```

### Production Environment
```bash
# .env.production
NODE_ENV=production
PORT=3000
NEXT_TELEMETRY_DISABLED=1

# Production database
DATABASE_URL=postgresql://user:password@host:5432/database

# Secure auth secret (32+ characters)
BETTER_AUTH_SECRET=your-very-secure-production-secret

# Production URLs
NEXT_PUBLIC_API_URL=https://your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Feature flags
FEATURE_ANALYTICS_ENABLED=true
FEATURE_RECOMMENDATIONS_ENABLED=true
FEATURE_CHAT_ENABLED=true

# Production logging
LOG_LEVEL=info
LOG_TO_FILE=true
```

## Environment Variable Validation

### Required Variables Validation
```javascript
// lib/config-validation.js
const requiredEnvVars = [
  'NODE_ENV',
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_APP_URL'
];

function validateEnvironment() {
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Validate AUTH_SECRET length
  if (process.env.BETTER_AUTH_SECRET.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must be at least 32 characters long');
  }
  
  // Validate URLs
  try {
    new URL(process.env.NEXT_PUBLIC_API_URL);
    new URL(process.env.NEXT_PUBLIC_APP_URL);
  } catch (error) {
    throw new Error('Invalid URL format for API_URL or APP_URL');
  }
}

// Call during application startup
validateEnvironment();
```

## Security Best Practices

### Secret Management
```bash
# Generate secure secrets
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)

# Use platform secret management
# - AWS Secrets Manager
# - Azure Key Vault
# - Google Secret Manager
# - Platform-specific secret stores
```

### Environment File Security
```bash
# .env file permissions
chmod 600 .env

# Git ignore
echo ".env*" >> .gitignore
echo "!.env.example" >> .gitignore

# Docker ignore
echo ".env*" >> .dockerignore
echo "!.env.example" >> .dockerignore
```

### Production Checklist
- [ ] All secrets are randomly generated and secure
- [ ] No development secrets in production
- [ ] Environment variables are set via platform secret management
- [ ] Database connection uses SSL/TLS
- [ ] Redis connection uses authentication
- [ ] API URLs use HTTPS
- [ ] Logging level is appropriate (info/warn, not debug)
- [ ] Feature flags are properly configured
- [ ] CORS origin is restrictive
- [ ] Rate limiting is enabled

## Common Configurations

### Minimal Production Setup
```bash
NODE_ENV=production
PORT=3000
NEXT_TELEMETRY_DISABLED=1
DATABASE_URL=postgresql://user:password@host:5432/database
BETTER_AUTH_SECRET=your-secure-secret-key
NEXT_PUBLIC_API_URL=https://your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Full-Featured Production Setup
```bash
# Core
NODE_ENV=production
PORT=3000
NEXT_TELEMETRY_DISABLED=1

# Database
DATABASE_URL=postgresql://user:password@host:5432/database
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Cache
REDIS_URL=redis://host:6379
REDIS_PASSWORD=your-redis-password

# Authentication
BETTER_AUTH_SECRET=your-secure-secret-key

# URLs
NEXT_PUBLIC_API_URL=https://your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Features
FEATURE_ANALYTICS_ENABLED=true
FEATURE_RECOMMENDATIONS_ENABLED=true
FEATURE_CHAT_ENABLED=true

# AI Services
OPENAI_API_KEY=your-openai-key
OPENAI_MODEL=gpt-4

# Logging
LOG_LEVEL=info
SENTRY_DSN=your-sentry-dsn

# Email
EMAIL_SERVICE=sendgrid
EMAIL_API_KEY=your-sendgrid-key
EMAIL_FROM=noreply@your-domain.com

# Security
CORS_ORIGIN=https://your-domain.com
RATE_LIMIT_MAX=100

# Monitoring
APM_ENABLED=true
METRICS_ENABLED=true
```

## Troubleshooting

### Common Issues

#### 1. Missing Environment Variables
```bash
# Check if variables are set
env | grep NODE_ENV
echo $DATABASE_URL

# Validate in Node.js
node -e "console.log('NODE_ENV:', process.env.NODE_ENV)"
```

#### 2. Invalid Database URL
```bash
# Test PostgreSQL connection
psql $DATABASE_URL -c "SELECT 1"

# Test SQLite
sqlite3 ./app.db ".schema"
```

#### 3. Invalid Secrets
```bash
# Check secret length
echo -n $BETTER_AUTH_SECRET | wc -c

# Generate new secret
openssl rand -base64 32
```

#### 4. URL Configuration Issues
```bash
# Test API endpoint
curl $NEXT_PUBLIC_API_URL/api/health

# Validate URL format
node -e "console.log(new URL(process.env.NEXT_PUBLIC_API_URL))"
```

## Environment Templates

### .env.example
```bash
# Copy this file to .env and fill in your values

# Core Configuration
NODE_ENV=production
PORT=3000
NEXT_TELEMETRY_DISABLED=1

# Database (choose one)
DATABASE_URL=postgresql://user:password@host:5432/database
# DATABASE_URL=sqlite:./app.db

# Authentication (generate with: openssl rand -base64 32)
BETTER_AUTH_SECRET=your-secure-secret-key-min-32-chars

# API URLs
NEXT_PUBLIC_API_URL=https://your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Optional: Cache
# REDIS_URL=redis://host:6379
# REDIS_PASSWORD=your-redis-password

# Optional: Features
FEATURE_ANALYTICS_ENABLED=true
FEATURE_RECOMMENDATIONS_ENABLED=true
FEATURE_CHAT_ENABLED=true

# Optional: AI Services
# OPENAI_API_KEY=your-openai-api-key

# Optional: Logging
# LOG_LEVEL=info
# SENTRY_DSN=your-sentry-dsn
```

### docker-compose.env
```bash
# Environment file for Docker Compose
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://learning_user:${POSTGRES_PASSWORD}@postgres:5432/learning_assistant_db
REDIS_URL=redis://redis:6379
BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
NEXT_PUBLIC_API_URL=http://localhost
NEXT_PUBLIC_APP_URL=http://localhost
```

---

**Note**: Always use secure, randomly generated secrets for production deployments. Never commit actual environment values to version control. Use platform-specific secret management services for production applications.