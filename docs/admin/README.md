# System Administrator Guide

## Overview

This comprehensive guide is designed for system administrators responsible for deploying, configuring, and maintaining Learning Assistant in production environments. It covers installation, security hardening, monitoring, backup procedures, and ongoing maintenance tasks.

## Table of Contents

1. [Production Deployment](#production-deployment)
2. [Security Configuration](#security-configuration)
3. [Database Administration](#database-administration)
4. [Monitoring & Logging](#monitoring--logging)
5. [Backup & Recovery](#backup--recovery)
6. [Performance Optimization](#performance-optimization)
7. [User Management](#user-management)
8. [System Maintenance](#system-maintenance)
9. [Troubleshooting](#troubleshooting)
10. [Compliance & Auditing](#compliance--auditing)

---

## Production Deployment

### Infrastructure Requirements

#### Minimum Production Specifications

| Component | Requirement | Notes |
|-----------|-------------|-------|
| **Application Server** | 4 CPU cores, 8GB RAM | Handles web traffic and AI processing |
| **Database Server** | 4 CPU cores, 16GB RAM, 100GB SSD | PostgreSQL with connection pooling |
| **Cache Server** | 2 CPU cores, 4GB RAM | Redis for session and data caching |
| **Storage** | 500GB+ | File uploads, backups, logs |
| **Network** | 1Gbps bandwidth | Stable internet for AI services |

#### Recommended Production Specifications

| Component | Recommendation | Notes |
|-----------|----------------|-------|
| **Application Server** | 8 CPU cores, 16GB RAM | Better performance under load |
| **Database Server** | 8 CPU cores, 32GB RAM, 500GB SSD | High availability setup |
| **Load Balancer** | 2 instances | nginx or cloud load balancer |
| **Monitoring** | Dedicated server | Prometheus, Grafana, ELK stack |

### High Availability Setup

#### Multi-Server Architecture

```yaml
# docker-compose.production.yml
version: '3.8'

services:
  app-1:
    image: learning-assistant:latest
    deploy:
      replicas: 2
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - database
      - redis
    networks:
      - app-network

  app-2:
    image: learning-assistant:latest
    deploy:
      replicas: 2
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - database
      - redis
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app-1
      - app-2
    networks:
      - app-network

  database:
    image: postgres:15
    environment:
      - POSTGRES_DB=${DB_NAME}
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backup:/backup
    ports:
      - "5432:5432"
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - app-network

volumes:
  postgres_data:
  redis_data:

networks:
  app-network:
    driver: bridge
```

#### Load Balancer Configuration

```nginx
# nginx.conf
upstream app_servers {
    least_conn;
    server app-1:3000 weight=1 max_fails=3 fail_timeout=30s;
    server app-2:3000 weight=1 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE+AESGCM:ECDHE+AES256:ECDHE+AES128:!aNULL:!SHA1;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    location / {
        proxy_pass http://app_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        proxy_pass http://app_servers;
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://app_servers;
    }
}
```

### Environment Configuration

#### Production Environment Variables

```bash
# .env.production
NODE_ENV=production
PORT=3000

# Database Configuration
DATABASE_URL="postgresql://user:password@db-server:5432/learning_assistant"
DATABASE_POOL_SIZE=20
DATABASE_TIMEOUT=30000

# Redis Configuration
REDIS_URL="redis://redis-server:6379"
REDIS_PASSWORD="your-secure-redis-password"

# Authentication
BETTER_AUTH_SECRET="your-very-long-random-secret-key-minimum-32-characters"
BETTER_AUTH_URL="https://yourdomain.com"

# AI Services
OPENAI_API_KEY="sk-your-openai-api-key"
OPENAI_MAX_TOKENS=2000
OPENAI_RATE_LIMIT=50

# Email Configuration
EMAIL_SERVER_HOST="smtp.yourprovider.com"
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER="your-smtp-user"
EMAIL_SERVER_PASSWORD="your-smtp-password"
EMAIL_FROM="Learning Assistant <noreply@yourdomain.com>"

# OAuth Providers
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# File Storage
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_REGION="us-east-1"
S3_BUCKET_NAME="learning-assistant-storage"

# Monitoring
SENTRY_DSN="your-sentry-dsn"
ANALYTICS_ENABLED=true
LOGGING_LEVEL=info

# Security
HELMET_ENABLED=true
RATE_LIMIT_ENABLED=true
CORS_ORIGIN="https://yourdomain.com"
```

---

## Security Configuration

### SSL/TLS Configuration

#### Certificate Management

```bash
# Generate SSL certificate with Let's Encrypt
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal setup
sudo crontab -e
# Add line: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### SSL Best Practices

```nginx
# Strong SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_tickets off;

# OCSP stapling
ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;

# Security headers
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
add_header X-Frame-Options DENY;
add_header X-Content-Type-Options nosniff;
add_header Referrer-Policy "strict-origin-when-cross-origin";
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';";
```

### Database Security

#### PostgreSQL Hardening

```sql
-- Create dedicated application user
CREATE USER learning_app WITH PASSWORD 'secure-random-password';

-- Grant minimal necessary permissions
GRANT CONNECT ON DATABASE learning_assistant TO learning_app;
GRANT USAGE ON SCHEMA public TO learning_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO learning_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO learning_app;

-- Ensure future tables inherit permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO learning_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO learning_app;

-- Remove public schema access
REVOKE ALL ON SCHEMA public FROM public;
```

```bash
# PostgreSQL configuration (postgresql.conf)
# Connection security
ssl = on
ssl_cert_file = '/etc/ssl/certs/server.crt'
ssl_key_file = '/etc/ssl/private/server.key'

# Authentication
password_encryption = scram-sha-256

# Logging
log_connections = on
log_disconnections = on
log_failed_connections = on
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_statement = 'ddl'

# Connection limits
max_connections = 100
```

### Application Security

#### Security Middleware Configuration

```typescript
// src/middleware/security.ts
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

export const securityMiddleware = [
  // Helmet for security headers
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.openai.com"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),

  // Rate limiting
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
  }),
];

// API-specific rate limiting
export const apiRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  keyGenerator: (req) => req.user?.id || req.ip,
});

// Auth endpoint rate limiting
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per window
  skipSuccessfulRequests: true,
});
```

### Firewall Configuration

```bash
# UFW (Ubuntu Firewall) configuration
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (adjust port as needed)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow database access only from app servers
sudo ufw allow from 10.0.1.0/24 to any port 5432

# Allow Redis access only from app servers
sudo ufw allow from 10.0.1.0/24 to any port 6379

# Check status
sudo ufw status verbose
```

---

## Database Administration

### Backup Procedures

#### Automated Backup Script

```bash
#!/bin/bash
# backup-database.sh

set -e

# Configuration
DB_NAME="learning_assistant"
DB_USER="postgres"
DB_HOST="localhost"
BACKUP_DIR="/backup"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/learning_assistant_${DATE}.sql"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Create database backup
echo "Starting database backup..."
pg_dump -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" \
    --verbose --clean --no-owner --no-privileges > "${BACKUP_FILE}"

# Compress backup
gzip "${BACKUP_FILE}"
BACKUP_FILE="${BACKUP_FILE}.gz"

echo "Backup completed: ${BACKUP_FILE}"

# Upload to cloud storage (optional)
if [ -n "${AWS_S3_BACKUP_BUCKET}" ]; then
    aws s3 cp "${BACKUP_FILE}" "s3://${AWS_S3_BACKUP_BUCKET}/database/"
    echo "Backup uploaded to S3"
fi

# Clean up old backups
find "${BACKUP_DIR}" -name "learning_assistant_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
echo "Old backups cleaned up"

# Verify backup integrity
echo "Verifying backup integrity..."
gunzip -t "${BACKUP_FILE}"
if [ $? -eq 0 ]; then
    echo "Backup verification successful"
else
    echo "Backup verification failed!"
    exit 1
fi
```

#### Backup Scheduling

```bash
# Add to crontab (crontab -e)
# Daily backup at 2 AM
0 2 * * * /path/to/backup-database.sh >> /var/log/backup.log 2>&1

# Weekly full system backup
0 3 * * 0 /path/to/full-system-backup.sh >> /var/log/full-backup.log 2>&1
```

### Database Maintenance

#### Performance Monitoring

```sql
-- Monitor database performance
SELECT 
    schemaname,
    tablename,
    attname,
    inherited,
    null_frac,
    avg_width,
    n_distinct,
    correlation
FROM pg_stats 
WHERE schemaname = 'public'
ORDER BY tablename, attname;

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Monitor slow queries
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
WHERE mean_time > 1000  -- Queries taking more than 1 second
ORDER BY mean_time DESC;
```

#### Index Optimization

```sql
-- Find missing indexes
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats
WHERE schemaname = 'public'
    AND n_distinct > 100
    AND correlation < 0.1;

-- Create recommended indexes
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_learning_sessions_user_id ON learning_sessions(user_id);
CREATE INDEX CONCURRENTLY idx_learning_sessions_created_at ON learning_sessions(created_at);
CREATE INDEX CONCURRENTLY idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX CONCURRENTLY idx_user_progress_user_id_module_id ON user_progress(user_id, module_id);

-- Monitor index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_tup_read DESC;
```

#### Database Maintenance Tasks

```sql
-- Regular maintenance script
DO $$
BEGIN
    -- Update table statistics
    ANALYZE;
    
    -- Vacuum to reclaim space
    VACUUM (VERBOSE, ANALYZE);
    
    -- Reindex if needed
    REINDEX DATABASE learning_assistant;
    
    RAISE NOTICE 'Database maintenance completed';
END $$;
```

---

## Monitoring & Logging

### Application Monitoring

#### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "learning_assistant_rules.yml"

scrape_configs:
  - job_name: 'learning-assistant'
    static_configs:
      - targets: ['app-1:3000', 'app-2:3000']
    metrics_path: '/api/metrics'
    scrape_interval: 30s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

#### Custom Metrics

```typescript
// src/lib/metrics.ts
import client from 'prom-client';

// Register default metrics
client.collectDefaultMetrics();

// Custom metrics
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

export const activeUsers = new client.Gauge({
  name: 'learning_active_users',
  help: 'Number of active learning sessions',
});

export const learningSessionsTotal = new client.Counter({
  name: 'learning_sessions_total',
  help: 'Total number of learning sessions started',
  labelNames: ['module_type', 'difficulty'],
});

export const databaseConnections = new client.Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections',
});

// Metrics collection endpoint
export async function getMetrics(): Promise<string> {
  return await client.register.metrics();
}
```

#### Alert Rules

```yaml
# learning_assistant_rules.yml
groups:
  - name: learning_assistant
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: High error rate detected
          description: "Error rate is {{ $value }} errors per second"

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High response time
          description: "95th percentile response time is {{ $value }} seconds"

      - alert: DatabaseConnectionHigh
        expr: database_connections_active > 80
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: High database connection usage
          description: "Database connections: {{ $value }}"

      - alert: LowDiskSpace
        expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) * 100 < 10
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: Low disk space
          description: "Disk space is {{ $value }}% full"
```

### Logging Configuration

#### Structured Logging

```typescript
// src/lib/logger.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOGGING_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'learning-assistant',
    version: process.env.APP_VERSION || '1.0.0'
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // File transport for production
    new winston.transports.File({
      filename: '/var/log/learning-assistant/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    
    new winston.transports.File({
      filename: '/var/log/learning-assistant/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    }),
  ],
});

// Production logging with rotation
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.DailyRotateFile({
    filename: '/var/log/learning-assistant/application-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '100m',
    maxFiles: '30d',
    zippedArchive: true,
  }));
}

export default logger;
```

#### Log Aggregation with ELK Stack

```yaml
# docker-compose.logging.yml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.5.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"

  logstash:
    image: docker.elastic.co/logstash/logstash:8.5.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    ports:
      - "5044:5044"
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.5.0
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch

volumes:
  elasticsearch_data:
```

---

## Backup & Recovery

### Comprehensive Backup Strategy

#### Full System Backup

```bash
#!/bin/bash
# full-system-backup.sh

set -e

BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_ROOT="/backup/full"
RETENTION_DAYS=90

echo "Starting full system backup: ${BACKUP_DATE}"

# Create backup directory
mkdir -p "${BACKUP_ROOT}/${BACKUP_DATE}"

# 1. Database backup
echo "Backing up database..."
pg_dump -h localhost -U postgres learning_assistant | gzip > \
    "${BACKUP_ROOT}/${BACKUP_DATE}/database.sql.gz"

# 2. Redis backup
echo "Backing up Redis..."
redis-cli --rdb "${BACKUP_ROOT}/${BACKUP_DATE}/redis.rdb"

# 3. Application files
echo "Backing up application files..."
tar -czf "${BACKUP_ROOT}/${BACKUP_DATE}/app_files.tar.gz" \
    /opt/learning-assistant \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='logs'

# 4. Configuration files
echo "Backing up configuration..."
tar -czf "${BACKUP_ROOT}/${BACKUP_DATE}/config.tar.gz" \
    /etc/nginx \
    /etc/ssl \
    /etc/systemd/system/learning-assistant.service

# 5. User uploads and data
echo "Backing up user data..."
tar -czf "${BACKUP_ROOT}/${BACKUP_DATE}/user_data.tar.gz" \
    /var/lib/learning-assistant/uploads

# 6. System logs
echo "Backing up logs..."
tar -czf "${BACKUP_ROOT}/${BACKUP_DATE}/logs.tar.gz" \
    /var/log/learning-assistant \
    /var/log/nginx

# Create manifest
echo "Creating backup manifest..."
cat > "${BACKUP_ROOT}/${BACKUP_DATE}/manifest.txt" << EOF
Backup Date: ${BACKUP_DATE}
Database Size: $(stat -c%s "${BACKUP_ROOT}/${BACKUP_DATE}/database.sql.gz")
Redis Size: $(stat -c%s "${BACKUP_ROOT}/${BACKUP_DATE}/redis.rdb")
App Files Size: $(stat -c%s "${BACKUP_ROOT}/${BACKUP_DATE}/app_files.tar.gz")
Config Size: $(stat -c%s "${BACKUP_ROOT}/${BACKUP_DATE}/config.tar.gz")
User Data Size: $(stat -c%s "${BACKUP_ROOT}/${BACKUP_DATE}/user_data.tar.gz")
Logs Size: $(stat -c%s "${BACKUP_ROOT}/${BACKUP_DATE}/logs.tar.gz")
System Info: $(uname -a)
Backup Completed: $(date)
EOF

# Upload to cloud storage
if [ -n "${AWS_S3_BACKUP_BUCKET}" ]; then
    echo "Uploading to S3..."
    aws s3 sync "${BACKUP_ROOT}/${BACKUP_DATE}" \
        "s3://${AWS_S3_BACKUP_BUCKET}/full/${BACKUP_DATE}/"
fi

# Clean up old backups
find "${BACKUP_ROOT}" -type d -name "*_*" -mtime +${RETENTION_DAYS} -exec rm -rf {} \;

echo "Full system backup completed: ${BACKUP_DATE}"
```

### Disaster Recovery Procedures

#### Recovery Plan Documentation

```bash
#!/bin/bash
# disaster-recovery.sh

# DISASTER RECOVERY PLAN
# ======================
# 
# Recovery Time Objective (RTO): 4 hours
# Recovery Point Objective (RPO): 1 hour
#
# Prerequisites:
# - New server with same OS version
# - Docker and Docker Compose installed
# - Network access to backup storage
# - SSL certificates available

set -e

BACKUP_DATE=${1:-"latest"}
BACKUP_SOURCE=${2:-"s3://your-backup-bucket"}

echo "=== LEARNING ASSISTANT DISASTER RECOVERY ==="
echo "Backup Date: ${BACKUP_DATE}"
echo "Backup Source: ${BACKUP_SOURCE}"
echo "Recovery Start Time: $(date)"

# 1. System Preparation
echo "1. Preparing system..."
sudo apt-get update
sudo apt-get install -y docker.io docker-compose postgresql-client redis-tools aws-cli

# 2. Download backups
echo "2. Downloading backups..."
mkdir -p /tmp/recovery
if [ "${BACKUP_SOURCE}" = "s3://"* ]; then
    aws s3 sync "${BACKUP_SOURCE}/full/${BACKUP_DATE}/" /tmp/recovery/
else
    cp -r "${BACKUP_SOURCE}/${BACKUP_DATE}/"* /tmp/recovery/
fi

# 3. Restore configuration
echo "3. Restoring configuration..."
sudo tar -xzf /tmp/recovery/config.tar.gz -C /

# 4. Restore application files
echo "4. Restoring application files..."
sudo mkdir -p /opt
sudo tar -xzf /tmp/recovery/app_files.tar.gz -C /

# 5. Start services
echo "5. Starting services..."
cd /opt/learning-assistant
sudo docker-compose -f docker-compose.production.yml up -d postgres redis

# Wait for database to be ready
echo "Waiting for database to start..."
sleep 30

# 6. Restore database
echo "6. Restoring database..."
gunzip -c /tmp/recovery/database.sql.gz | \
    docker exec -i $(docker-compose ps -q postgres) \
    psql -U postgres learning_assistant

# 7. Restore Redis
echo "7. Restoring Redis..."
docker cp /tmp/recovery/redis.rdb $(docker-compose ps -q redis):/data/dump.rdb
docker-compose restart redis

# 8. Restore user data
echo "8. Restoring user data..."
sudo mkdir -p /var/lib/learning-assistant
sudo tar -xzf /tmp/recovery/user_data.tar.gz -C /

# 9. Start application
echo "9. Starting application..."
sudo docker-compose -f docker-compose.production.yml up -d

# 10. Verify recovery
echo "10. Verifying recovery..."
sleep 60

# Check application health
curl -f http://localhost:3000/api/health || {
    echo "ERROR: Application health check failed"
    exit 1
}

# Check database connectivity
docker exec $(docker-compose ps -q postgres) \
    psql -U postgres -d learning_assistant -c "SELECT COUNT(*) FROM users;" || {
    echo "ERROR: Database check failed"
    exit 1
}

echo "=== DISASTER RECOVERY COMPLETED ==="
echo "Recovery End Time: $(date)"
echo "Application is available at: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "Post-Recovery Checklist:"
echo "- Update DNS records"
echo "- Verify SSL certificates"
echo "- Test user authentication"
echo "- Verify data integrity"
echo "- Update monitoring systems"
echo "- Notify stakeholders"
```

---

## Performance Optimization

### Application Performance

#### Node.js Optimization

```typescript
// src/lib/performance.ts
import cluster from 'cluster';
import os from 'os';

// Cluster configuration for production
if (cluster.isMaster && process.env.NODE_ENV === 'production') {
  const numWorkers = process.env.WEB_CONCURRENCY || os.cpus().length;
  
  console.log(`Master ${process.pid} is running`);
  console.log(`Starting ${numWorkers} workers`);
  
  // Fork workers
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }
  
  // Handle worker death
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    console.log('Starting a new worker');
    cluster.fork();
  });
} else {
  // Worker process - start the application
  require('./app');
}

// Memory management
export function optimizeMemory() {
  // Force garbage collection periodically
  if (global.gc) {
    setInterval(() => {
      global.gc();
    }, 30000); // Every 30 seconds
  }
  
  // Monitor memory usage
  setInterval(() => {
    const usage = process.memoryUsage();
    const formatMemory = (bytes: number) => Math.round(bytes / 1024 / 1024 * 100) / 100;
    
    console.log({
      rss: `${formatMemory(usage.rss)} MB`,
      heapTotal: `${formatMemory(usage.heapTotal)} MB`,
      heapUsed: `${formatMemory(usage.heapUsed)} MB`,
      external: `${formatMemory(usage.external)} MB`,
    });
    
    // Alert if memory usage is too high
    if (usage.heapUsed > 1024 * 1024 * 1024) { // 1GB
      console.warn('High memory usage detected');
    }
  }, 60000); // Every minute
}
```

#### Database Connection Pooling

```typescript
// src/lib/database/pool.ts
import { Pool, PoolConfig } from 'pg';

const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DATABASE_POOL_SIZE || '20'),
  min: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  acquireTimeoutMillis: 60000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

export const pool = new Pool(poolConfig);

// Monitor pool status
pool.on('connect', (client) => {
  console.log('New client connected');
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Pool health monitoring
export function getPoolStatus() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}
```

### Caching Strategy

#### Redis Caching Implementation

```typescript
// src/lib/cache/strategy.ts
export class CacheStrategy {
  private redis: Redis;
  
  constructor(redis: Redis) {
    this.redis = redis;
  }
  
  // Cache learning content with different TTLs
  async cacheContent(key: string, content: any, type: 'static' | 'dynamic' | 'user'): Promise<void> {
    const ttl = this.getTTL(type);
    await this.redis.setEx(key, ttl, JSON.stringify(content));
  }
  
  private getTTL(type: string): number {
    switch (type) {
      case 'static': return 86400; // 24 hours for static content
      case 'dynamic': return 3600; // 1 hour for dynamic content
      case 'user': return 1800;    // 30 minutes for user-specific data
      default: return 3600;
    }
  }
  
  // Intelligent cache warming
  async warmCache(): Promise<void> {
    console.log('Starting cache warming...');
    
    // Warm frequently accessed content
    const popularModules = await this.getPopularModules();
    for (const module of popularModules) {
      const cacheKey = `module:${module.id}`;
      if (!(await this.redis.exists(cacheKey))) {
        await this.cacheContent(cacheKey, module, 'static');
      }
    }
    
    // Warm user session data for active users
    const activeUsers = await this.getActiveUsers();
    for (const user of activeUsers) {
      const sessionKey = `session:${user.id}`;
      const sessionData = await this.getUserSession(user.id);
      await this.cacheContent(sessionKey, sessionData, 'user');
    }
    
    console.log('Cache warming completed');
  }
  
  // Cache invalidation patterns
  async invalidateUserCache(userId: string): Promise<void> {
    const pattern = `*:${userId}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
  
  async invalidateContentCache(moduleId: string): Promise<void> {
    const keys = [
      `module:${moduleId}`,
      `module:${moduleId}:*`,
      `recommendations:*:${moduleId}`,
    ];
    
    const existingKeys = await Promise.all(
      keys.map(key => this.redis.exists(key))
    );
    
    const keysToDelete = keys.filter((_, index) => existingKeys[index]);
    if (keysToDelete.length > 0) {
      await this.redis.del(...keysToDelete);
    }
  }
}
```

---

## User Management

### User Administration

#### User Management API

```typescript
// src/lib/admin/user-management.ts
export class UserManagementService {
  async createAdminUser(userData: CreateAdminUserData): Promise<User> {
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    
    const user = await this.database.query(
      `INSERT INTO users (email, password_hash, name, role, email_verified, created_at)
       VALUES ($1, $2, $3, $4, true, NOW())
       RETURNING *`,
      [userData.email, hashedPassword, userData.name, 'admin']
    );
    
    await this.logAdminAction('create_admin_user', userData.email);
    return user.rows[0];
  }
  
  async suspendUser(userId: string, reason: string, suspendedBy: string): Promise<void> {
    await this.database.query(
      `UPDATE users 
       SET suspended = true, suspended_at = NOW(), suspension_reason = $2
       WHERE id = $1`,
      [userId, reason]
    );
    
    // Log action
    await this.logAdminAction('suspend_user', userId, {
      reason,
      suspendedBy,
    });
    
    // Invalidate user sessions
    await this.invalidateUserSessions(userId);
    
    // Send notification
    await this.sendSuspensionNotification(userId, reason);
  }
  
  async bulkUserOperation(operation: BulkOperation): Promise<BulkOperationResult> {
    const results: BulkOperationResult = {
      successful: [],
      failed: [],
      total: operation.userIds.length,
    };
    
    for (const userId of operation.userIds) {
      try {
        switch (operation.type) {
          case 'suspend':
            await this.suspendUser(userId, operation.reason!, operation.performedBy);
            results.successful.push(userId);
            break;
          case 'activate':
            await this.activateUser(userId, operation.performedBy);
            results.successful.push(userId);
            break;
          case 'delete':
            await this.deleteUser(userId, operation.performedBy);
            results.successful.push(userId);
            break;
        }
      } catch (error) {
        results.failed.push({
          userId,
          error: error.message,
        });
      }
    }
    
    return results;
  }
  
  async getUserAnalytics(timeRange: DateRange): Promise<UserAnalytics> {
    const analytics = await this.database.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN created_at >= $1 THEN 1 END) as new_users,
        COUNT(CASE WHEN last_login >= $2 THEN 1 END) as active_users,
        COUNT(CASE WHEN suspended = true THEN 1 END) as suspended_users,
        AVG(EXTRACT(EPOCH FROM (last_login - created_at))/86400) as avg_retention_days
      FROM users
      WHERE created_at <= $3
    `, [timeRange.start, timeRange.start, timeRange.end]);
    
    return analytics.rows[0];
  }
}
```

#### Role-Based Access Control

```typescript
// src/lib/auth/rbac.ts
export enum Permission {
  READ_USERS = 'read:users',
  WRITE_USERS = 'write:users',
  DELETE_USERS = 'delete:users',
  READ_CONTENT = 'read:content',
  WRITE_CONTENT = 'write:content',
  READ_ANALYTICS = 'read:analytics',
  MANAGE_SYSTEM = 'manage:system',
}

export enum Role {
  USER = 'user',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

const rolePermissions: Record<Role, Permission[]> = {
  [Role.USER]: [Permission.READ_CONTENT],
  [Role.MODERATOR]: [
    Permission.READ_CONTENT,
    Permission.WRITE_CONTENT,
    Permission.READ_USERS,
  ],
  [Role.ADMIN]: [
    Permission.READ_CONTENT,
    Permission.WRITE_CONTENT,
    Permission.READ_USERS,
    Permission.WRITE_USERS,
    Permission.READ_ANALYTICS,
  ],
  [Role.SUPER_ADMIN]: Object.values(Permission),
};

export function hasPermission(userRole: Role, permission: Permission): boolean {
  return rolePermissions[userRole]?.includes(permission) || false;
}

export function requirePermission(permission: Permission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !hasPermission(req.user.role, permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
```

---

## System Maintenance

### Automated Maintenance Tasks

#### Maintenance Scheduler

```bash
#!/bin/bash
# maintenance-scheduler.sh

# Daily maintenance tasks
cat > /etc/cron.d/learning-assistant-daily << 'EOF'
# Learning Assistant Daily Maintenance
0 2 * * * root /opt/scripts/daily-maintenance.sh >> /var/log/maintenance.log 2>&1
EOF

# Weekly maintenance tasks
cat > /etc/cron.d/learning-assistant-weekly << 'EOF'
# Learning Assistant Weekly Maintenance
0 3 * * 0 root /opt/scripts/weekly-maintenance.sh >> /var/log/maintenance.log 2>&1
EOF

# Monthly maintenance tasks
cat > /etc/cron.d/learning-assistant-monthly << 'EOF'
# Learning Assistant Monthly Maintenance
0 4 1 * * root /opt/scripts/monthly-maintenance.sh >> /var/log/maintenance.log 2>&1
EOF
```

#### Daily Maintenance Script

```bash
#!/bin/bash
# daily-maintenance.sh

set -e

echo "=== Daily Maintenance - $(date) ==="

# 1. Database maintenance
echo "Running database maintenance..."
docker exec learning-assistant-postgres psql -U postgres -d learning_assistant -c "
    VACUUM (VERBOSE, ANALYZE);
    REINDEX DATABASE learning_assistant;
"

# 2. Clear expired sessions
echo "Clearing expired sessions..."
docker exec learning-assistant-redis redis-cli EVAL "
    local keys = redis.call('keys', 'session:*')
    local expired = 0
    for i=1,#keys do
        local ttl = redis.call('ttl', keys[i])
        if ttl == -1 then
            redis.call('del', keys[i])
            expired = expired + 1
        end
    end
    return expired
" 0

# 3. Log rotation
echo "Rotating logs..."
logrotate -f /etc/logrotate.d/learning-assistant

# 4. Check disk space
echo "Checking disk space..."
df -h | awk '$5 > 80 {print "WARNING: " $0}'

# 5. Update application metrics
echo "Updating metrics..."
curl -s http://localhost:3000/api/admin/update-metrics

# 6. Health check
echo "Performing health check..."
if ! curl -sf http://localhost:3000/api/health > /dev/null; then
    echo "ERROR: Health check failed"
    systemctl restart learning-assistant
fi

echo "Daily maintenance completed - $(date)"
```

### Update Procedures

#### Application Updates

```bash
#!/bin/bash
# update-application.sh

set -e

VERSION=${1:-"latest"}
BACKUP_BEFORE_UPDATE=${2:-"true"}

echo "=== Application Update to ${VERSION} ==="

# 1. Pre-update backup
if [ "${BACKUP_BEFORE_UPDATE}" = "true" ]; then
    echo "Creating pre-update backup..."
    /opt/scripts/backup-database.sh
fi

# 2. Download new version
echo "Downloading version ${VERSION}..."
cd /tmp
wget "https://github.com/your-repo/learning-assistant/releases/download/${VERSION}/learning-assistant-${VERSION}.tar.gz"
tar -xzf "learning-assistant-${VERSION}.tar.gz"

# 3. Stop application
echo "Stopping application..."
docker-compose -f /opt/learning-assistant/docker-compose.production.yml down

# 4. Update application files
echo "Updating application files..."
rsync -av --exclude='node_modules' --exclude='.env.production' \
    "/tmp/learning-assistant-${VERSION}/" /opt/learning-assistant/

# 5. Install dependencies
echo "Installing dependencies..."
cd /opt/learning-assistant
npm ci --production

# 6. Run migrations
echo "Running database migrations..."
npm run db:migrate

# 7. Start application
echo "Starting application..."
docker-compose -f docker-compose.production.yml up -d

# 8. Verify update
echo "Verifying update..."
sleep 30
if curl -sf http://localhost:3000/api/health > /dev/null; then
    echo "Update successful!"
else
    echo "Update failed, rolling back..."
    /opt/scripts/rollback.sh
    exit 1
fi

echo "Application updated to version ${VERSION}"
```

### System Health Monitoring

```typescript
// src/lib/health/monitor.ts
export class SystemHealthMonitor {
  async performHealthCheck(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkStorage(),
      this.checkExternalServices(),
      this.checkSystemResources(),
    ]);
    
    const results = checks.map((check, index) => ({
      name: ['database', 'redis', 'storage', 'external', 'system'][index],
      status: check.status === 'fulfilled' && check.value ? 'healthy' : 'unhealthy',
      details: check.status === 'rejected' ? check.reason : null,
    }));
    
    const overallHealth = results.every(r => r.status === 'healthy');
    
    return {
      status: overallHealth ? 'healthy' : 'unhealthy',
      timestamp: new Date(),
      services: results,
      uptime: process.uptime(),
      version: process.env.APP_VERSION || '1.0.0',
    };
  }
  
  private async checkSystemResources(): Promise<boolean> {
    const usage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Check memory usage (alert if > 90%)
    const memoryUsagePercent = (usage.heapUsed / usage.heapTotal) * 100;
    if (memoryUsagePercent > 90) {
      throw new Error(`High memory usage: ${memoryUsagePercent.toFixed(2)}%`);
    }
    
    // Check disk space
    const diskUsage = await this.getDiskUsage();
    if (diskUsage > 90) {
      throw new Error(`High disk usage: ${diskUsage}%`);
    }
    
    return true;
  }
}
```

---

## Compliance & Auditing

### Audit Logging

```typescript
// src/lib/audit/logger.ts
export class AuditLogger {
  async logEvent(event: AuditEvent): Promise<void> {
    const auditEntry = {
      id: generateId(),
      timestamp: new Date(),
      userId: event.userId,
      action: event.action,
      resource: event.resource,
      details: event.details,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      sessionId: event.sessionId,
    };
    
    // Store in database
    await this.storeAuditLog(auditEntry);
    
    // Send to external audit service if configured
    if (process.env.AUDIT_SERVICE_URL) {
      await this.sendToAuditService(auditEntry);
    }
  }
  
  async generateAuditReport(timeRange: DateRange): Promise<AuditReport> {
    const events = await this.getAuditEvents(timeRange);
    
    return {
      timeRange,
      totalEvents: events.length,
      eventsByType: this.groupEventsByType(events),
      userActivity: this.analyzeUserActivity(events),
      securityEvents: this.filterSecurityEvents(events),
      dataAccess: this.analyzeDataAccess(events),
      systemChanges: this.analyzeSystemChanges(events),
    };
  }
}
```

### GDPR Compliance

```typescript
// src/lib/compliance/gdpr.ts
export class GDPRComplianceService {
  async exportUserData(userId: string): Promise<UserDataExport> {
    const userData = await this.collectAllUserData(userId);
    
    return {
      personal_information: userData.profile,
      learning_progress: userData.progress,
      chat_history: userData.chatHistory,
      assessments: userData.assessments,
      system_logs: userData.auditLogs,
      created_at: new Date(),
      export_format: 'JSON',
    };
  }
  
  async deleteUserData(userId: string, reason: string): Promise<DeletionReport> {
    const deletionPlan = await this.createDeletionPlan(userId);
    const results = [];
    
    for (const table of deletionPlan.tables) {
      try {
        const deletedCount = await this.deleteFromTable(table, userId);
        results.push({
          table,
          deleted_records: deletedCount,
          status: 'success',
        });
      } catch (error) {
        results.push({
          table,
          deleted_records: 0,
          status: 'failed',
          error: error.message,
        });
      }
    }
    
    // Anonymize remaining references
    await this.anonymizeUserReferences(userId);
    
    return {
      user_id: userId,
      deletion_reason: reason,
      deleted_at: new Date(),
      tables_processed: results,
      total_records_deleted: results.reduce((sum, r) => sum + r.deleted_records, 0),
    };
  }
}
```

---

## Support & Resources

### Administrator Resources

- **System Monitoring**: Grafana dashboards for real-time monitoring
- **Log Analysis**: ELK stack for centralized logging
- **Backup Verification**: Automated backup testing procedures
- **Security Updates**: Security vulnerability monitoring and patching
- **Performance Optimization**: Query optimization and caching strategies

### Emergency Contacts

| Issue Type | Contact | Response Time |
|------------|---------|---------------|
| **Critical System Down** | DevOps Team | 15 minutes |
| **Security Incident** | Security Team | 30 minutes |
| **Data Loss** | Database Admin | 1 hour |
| **Performance Issues** | Development Team | 2 hours |

### Maintenance Windows

- **Daily**: 2:00-4:00 AM UTC (automated tasks)
- **Weekly**: Sunday 3:00-5:00 AM UTC (system updates)
- **Monthly**: First Sunday 4:00-8:00 AM UTC (major maintenance)

---

*This administrator guide is a living document that should be updated regularly as the system evolves. For the most current information, always refer to the latest version in the documentation repository.*

*Last Updated: 2025-01-07*
*Version: 1.0.0*