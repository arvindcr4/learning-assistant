# Cost Optimization Guide

## Overview

This guide provides comprehensive strategies for optimizing deployment costs across all platforms while maintaining performance, reliability, and security. Learn how to reduce infrastructure costs without compromising your application's quality.

## Cost Analysis Framework

### 1. Cost Components

#### Infrastructure Costs
```
Application Hosting: 40-60% of total cost
- Compute resources (CPU, Memory)
- Network bandwidth
- Storage
- Load balancing

Database Services: 20-35% of total cost
- Database instances
- Storage
- Backup storage
- Connection pooling

Additional Services: 10-20% of total cost
- CDN
- Monitoring
- Logging
- Security services

Development Tools: 5-15% of total cost
- CI/CD pipelines
- Testing environments
- Development instances
```

#### Hidden Costs
```
Data Transfer: Often overlooked
- Inter-region transfers
- CDN origin pulls
- Database replication
- Backup transfers

Idle Resources: Waste money
- Over-provisioned instances
- Unused development environments
- Orphaned resources
- Test databases running 24/7

Premium Features: Add up quickly
- Advanced monitoring
- Enhanced security
- Priority support
- Enterprise features
```

## Platform-Specific Cost Optimization

### 1. Fly.io Cost Optimization

#### Current Pricing (2024)
```
Shared CPU:
- shared-cpu-1x (256MB): $1.94/month
- shared-cpu-2x (512MB): $3.88/month
- shared-cpu-4x (1GB): $7.76/month

Dedicated CPU:
- dedicated-cpu-1x (2GB): $29.00/month
- dedicated-cpu-2x (4GB): $58.00/month

Additional:
- IPv4 addresses: $2/month each
- Volumes: $0.15/GB/month
- Bandwidth: Free up to 100GB/month
```

#### Optimization Strategies
```bash
# 1. Auto-scaling configuration
# fly.toml
[http_service]
  min_machines_running = 0  # Scale to zero when idle
  max_machines_running = 3
  auto_stop_machines = 'stop'
  auto_start_machines = true

# 2. Right-size your machines
# Start small and scale up
flyctl scale memory 256  # Start with 256MB
flyctl scale cpu 1      # Single CPU core

# 3. Use volumes efficiently
flyctl volumes create data --size 1  # Start with 1GB

# 4. Optimize regions
# Use single region for development
flyctl regions set dfw  # Keep only primary region

# 5. Development vs Production
# Development
flyctl scale memory 256 --app dev-app
# Production
flyctl scale memory 512 --app prod-app
```

#### Monthly Cost Examples
```
Minimal Setup (Development):
- shared-cpu-1x: $1.94
- 1GB volume: $0.15
Total: ~$2/month

Small Production:
- shared-cpu-2x: $3.88
- 3GB volume: $0.45
Total: ~$4.50/month

Medium Production:
- shared-cpu-4x: $7.76
- 10GB volume: $1.50
- PostgreSQL addon: $7/month
Total: ~$16/month
```

### 2. Render Cost Optimization

#### Current Pricing (2024)
```
Web Services:
- Starter (512MB, 0.5 CPU): $7/month
- Standard (2GB, 1 CPU): $25/month
- Pro (4GB, 2 CPU): $85/month

Databases:
- PostgreSQL Starter: $7/month
- PostgreSQL Standard: $25/month
- Redis: $3/month

Additional:
- Bandwidth: Free up to 100GB/month
- Build minutes: Free up to 500 minutes/month
```

#### Optimization Strategies
```yaml
# render.yaml optimization
services:
  - type: web
    name: learning-assistant
    env: docker
    plan: starter  # Start with smallest plan
    region: oregon  # Choose cheapest region
    buildCommand: npm ci --only=production  # Faster builds
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: NODE_OPTIONS
        value: "--max-old-space-size=512"  # Limit memory usage

# Auto-sleep for development
  - type: web
    name: learning-assistant-dev
    plan: free  # Free tier with auto-sleep
```

#### Cost Reduction Tips
```bash
# 1. Use SQLite for development
DATABASE_URL=sqlite:./app.db

# 2. Optimize Docker builds
# Multi-stage builds reduce image size
FROM node:20-alpine AS deps
# ... dependencies only

FROM node:20-alpine AS builder
# ... build application

FROM node:20-alpine AS runner
# ... runtime only

# 3. Minimize build frequency
# Use branch-specific deployments
# Deploy only from main branch

# 4. Resource monitoring
# Monitor CPU and memory usage
# Downgrade if consistently under-utilized
```

### 3. Railway Cost Optimization

#### Current Pricing (2024)
```
Hobby Plan:
- $5/month base
- $0.000463/GB-hour RAM
- $0.000231/vCPU-hour

Pro Plan:
- $20/month base
- $0.000231/GB-hour RAM
- $0.000116/vCPU-hour

Usage Examples:
- 1GB RAM, 24/7: ~$10/month
- 2GB RAM, 12 hours/day: ~$7/month
```

#### Optimization Strategies
```json
// railway.json
{
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/api/health",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  },
  "build": {
    "buildCommand": "npm ci --only=production && npm run build"
  }
}
```

#### Cost Reduction Tips
```bash
# 1. Development environment management
# Use sleep schedules for development
railway environment

# 2. Resource optimization
# Monitor usage in Railway dashboard
# Adjust based on actual usage patterns

# 3. Database optimization
# Use Railway's PostgreSQL for production
# SQLite for development/testing

# 4. Efficient scaling
# Railway auto-scales based on usage
# Monitor scaling patterns and adjust accordingly
```

### 4. DigitalOcean Cost Optimization

#### Current Pricing (2024)
```
App Platform:
- Basic (512MB): $5/month
- Professional (1GB): $12/month
- Work (2.5GB): $24/month

Droplets:
- Basic (1GB): $6/month
- Basic (2GB): $12/month
- General Purpose (4GB): $24/month

Managed Databases:
- Basic (1GB): $15/month
- Basic (2GB): $30/month
```

#### App Platform Optimization
```yaml
# .do/app.yaml
name: learning-assistant
services:
- name: web
  source_dir: /
  github:
    repo: your-username/learning-assistant
    branch: main
    deploy_on_push: true
  run_command: npm start
  build_command: npm ci --only=production && npm run build
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs  # Start with smallest
  http_port: 3000
  
# Scale based on usage
  instance_count: 1  # Single instance for development
  instance_size_slug: basic-xxs  # 512MB RAM
```

#### Droplet Optimization
```bash
# Use smaller droplets efficiently
# Basic Droplet (1GB) - $6/month
# - Docker Compose deployment
# - Single database instance
# - Nginx for static files

# Optimization script
#!/bin/bash
# optimize-droplet.sh

# 1. Configure swap for small droplets
fallocate -l 1G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab

# 2. Optimize Docker
echo '{"log-driver": "json-file", "log-opts": {"max-size": "10m", "max-file": "3"}}' > /etc/docker/daemon.json
systemctl restart docker

# 3. System optimization
echo 'vm.swappiness=10' >> /etc/sysctl.conf
sysctl -p
```

### 5. AWS Cost Optimization

#### Current Pricing Examples (2024)
```
ECS Fargate:
- 0.25 vCPU, 512MB: ~$10/month
- 0.5 vCPU, 1GB: ~$18/month
- 1 vCPU, 2GB: ~$35/month

RDS:
- db.t3.micro (1GB): ~$16/month
- db.t3.small (2GB): ~$32/month

Additional:
- ALB: ~$20/month
- NAT Gateway: ~$32/month
- Data transfer: $0.09/GB
```

#### Optimization Strategies
```yaml
# ECS Task Definition optimization
{
  "family": "learning-assistant",
  "cpu": "256",  # Start with 0.25 vCPU
  "memory": "512",  # 512MB RAM
  "requiresCompatibilities": ["FARGATE"],
  "containerDefinitions": [{
    "name": "app",
    "memoryReservation": 256,  # Soft limit
    "memory": 512,  # Hard limit
    "cpu": 256
  }]
}
```

#### Cost Reduction Techniques
```bash
# 1. Use Spot Instances for development
aws ecs create-capacity-provider \
  --name spot-capacity-provider \
  --auto-scaling-group-provider autoScalingGroupArn=arn:aws:autoscaling:region:account:autoScalingGroup:uuid:autoScalingGroupName/spot-asg

# 2. Reserved Instances for production
# Purchase 1-year reserved instances for predictable workloads

# 3. S3 Intelligent Tiering
aws s3api put-bucket-intelligent-tiering-configuration \
  --bucket your-bucket \
  --id EntireBucket \
  --intelligent-tiering-configuration Id=EntireBucket,Status=Enabled,IncludedObjectFilter={}

# 4. CloudWatch log retention
aws logs put-retention-policy \
  --log-group-name /ecs/learning-assistant \
  --retention-in-days 30

# 5. Auto-scaling policies
aws application-autoscaling put-scaling-policy \
  --policy-name scale-down \
  --service-namespace ecs \
  --resource-id service/cluster/service \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 50.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    },
    "ScaleOutCooldown": 300,
    "ScaleInCooldown": 300
  }'
```

### 6. Google Cloud Cost Optimization

#### Current Pricing Examples (2024)
```
Cloud Run:
- CPU: $0.000024/vCPU-second
- Memory: $0.0000025/GB-second
- Requests: $0.40/million requests

Example monthly costs:
- 1 vCPU, 1GB, 100k requests: ~$7/month
- 2 vCPU, 2GB, 500k requests: ~$25/month

Cloud SQL:
- db-f1-micro (0.6GB): ~$7/month
- db-g1-small (1.7GB): ~$25/month
```

#### Optimization Strategies
```yaml
# Cloud Run optimization
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: learning-assistant
  annotations:
    run.googleapis.com/cpu-throttling: "true"
    run.googleapis.com/execution-environment: gen2
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "0"  # Scale to zero
        autoscaling.knative.dev/maxScale: "10"
        run.googleapis.com/memory: "512Mi"
        run.googleapis.com/cpu: "1"
    spec:
      containers:
      - image: gcr.io/project/learning-assistant
        resources:
          limits:
            memory: "512Mi"
            cpu: "1"
```

#### Cost Reduction Techniques
```bash
# 1. Use sustained use discounts
# Automatic discounts for running instances >25% of month

# 2. Committed use discounts
gcloud compute commitments create commitment-1 \
  --plan=12-month \
  --region=us-central1 \
  --resources=memory=100GB,vcpu=10

# 3. Preemptible instances for batch jobs
gcloud compute instances create preemptible-instance \
  --preemptible \
  --machine-type=n1-standard-1

# 4. Cloud Storage lifecycle policies
gsutil lifecycle set lifecycle.json gs://your-bucket

# lifecycle.json
{
  "rule": [
    {
      "action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},
      "condition": {"age": 30, "matchesStorageClass": ["STANDARD"]}
    },
    {
      "action": {"type": "Delete"},
      "condition": {"age": 365}
    }
  ]
}

# 5. BigQuery optimization
# Use clustered tables
# Set table expiration
# Use approximate aggregation functions
```

### 7. Azure Cost Optimization

#### Current Pricing Examples (2024)
```
Container Apps:
- 0.25 vCPU, 0.5GB: ~$8/month
- 0.5 vCPU, 1GB: ~$15/month
- 1 vCPU, 2GB: ~$30/month

Azure Database:
- Basic (1 vCore): ~$15/month
- General Purpose (2 vCore): ~$80/month
```

#### Optimization Strategies
```yaml
# Container Apps optimization
properties:
  configuration:
    secrets: []
    activeRevisionsMode: Single
    ingress:
      external: true
      targetPort: 3000
  template:
    containers:
    - name: learning-assistant
      image: registry/learning-assistant:latest
      resources:
        cpu: 0.25  # Quarter vCPU
        memory: 0.5Gi  # 512MB
    scale:
      minReplicas: 0  # Scale to zero
      maxReplicas: 10
      rules:
      - name: http-scale-rule
        http:
          metadata:
            concurrentRequests: "100"
```

#### Cost Reduction Techniques
```bash
# 1. Azure Hybrid Benefit
# Use existing Windows Server licenses
az vm create \
  --resource-group myResourceGroup \
  --name myVM \
  --license-type Windows_Server

# 2. Reserved instances
az reservations reservation-order purchase \
  --reservation-order-id "reservation-order-id" \
  --sku "Standard_B1s" \
  --location "East US" \
  --quantity 1 \
  --term P1Y

# 3. Auto-shutdown for development VMs
az vm auto-shutdown \
  --resource-group myResourceGroup \
  --name myVM \
  --time 1900

# 4. Azure Cost Management
az consumption budget create \
  --budget-name "development-budget" \
  --amount 100 \
  --time-grain Monthly \
  --start-date "2024-01-01T00:00:00Z" \
  --end-date "2024-12-31T00:00:00Z"
```

## Application-Level Optimization

### 1. Performance Optimization

#### Code Optimization
```javascript
// Reduce memory usage
const config = {
  // Limit concurrent connections
  database: {
    pool: {
      min: 2,
      max: 10,
      idle: 10000
    }
  },
  
  // Optimize caching
  cache: {
    ttl: 300, // 5 minutes
    maxSize: 100 // Limit cache size
  },
  
  // Request optimization
  server: {
    // Compress responses
    compression: true,
    // Connection keep-alive
    keepAlive: true,
    // Request timeout
    timeout: 30000
  }
};

// Efficient database queries
// Use indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

// Use connection pooling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: 2,
  max: 10,
  idleTimeoutMillis: 30000
});

// Optimize API responses
app.use(compression()); // Enable gzip compression
app.use(express.json({ limit: '1mb' })); // Limit request size
```

#### Resource Management
```javascript
// Memory management
process.on('warning', (warning) => {
  console.warn('Warning:', warning.name, warning.message);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  // Close database connections
  await pool.end();
  
  // Close server
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

// Memory monitoring
setInterval(() => {
  const usage = process.memoryUsage();
  console.log('Memory usage:', {
    rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB'
  });
}, 60000); // Every minute
```

### 2. Database Optimization

#### Query Optimization
```sql
-- Use EXPLAIN to analyze queries
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'user@example.com';

-- Add appropriate indexes
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX CONCURRENTLY idx_learning_progress_user_id ON learning_progress(user_id);

-- Optimize slow queries
-- Before: Full table scan
SELECT * FROM learning_sessions WHERE created_at > '2024-01-01';

-- After: Use index
CREATE INDEX idx_learning_sessions_created_at ON learning_sessions(created_at);
SELECT id, user_id, session_data FROM learning_sessions 
WHERE created_at > '2024-01-01' 
ORDER BY created_at DESC 
LIMIT 100;
```

#### Connection Pooling
```javascript
// Efficient connection pooling
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: 2,  // Minimum connections
  max: 10, // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  statement_timeout: 30000,
  query_timeout: 30000
});

// Connection health check
pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

// Query with connection reuse
async function getUser(email) {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  } finally {
    client.release();
  }
}
```

### 3. Caching Strategies

#### Redis Caching
```javascript
// Efficient caching implementation
const redis = require('redis');
const client = redis.createClient({
  url: process.env.REDIS_URL,
  socket: {
    connectTimeout: 5000,
    lazyConnect: true
  },
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      return new Error('Redis server refused connection');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error('Retry time exhausted');
    }
    return Math.min(options.attempt * 100, 3000);
  }
});

// Cache with TTL
async function getCachedUser(userId) {
  const cacheKey = `user:${userId}`;
  
  try {
    const cached = await client.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    const user = await getUserFromDatabase(userId);
    if (user) {
      await client.setex(cacheKey, 300, JSON.stringify(user)); // 5 minutes TTL
    }
    
    return user;
  } catch (error) {
    console.error('Cache error:', error);
    // Fallback to database
    return await getUserFromDatabase(userId);
  }
}
```

#### Application-Level Caching
```javascript
// In-memory caching for small datasets
const NodeCache = require('node-cache');
const cache = new NodeCache({ 
  stdTTL: 300, // 5 minutes default TTL
  checkperiod: 320, // Check for expired keys every 320 seconds
  maxKeys: 1000 // Limit cache size
});

// Cache frequently accessed data
function getCachedSettings() {
  const key = 'app:settings';
  let settings = cache.get(key);
  
  if (!settings) {
    settings = loadSettingsFromDatabase();
    cache.set(key, settings, 3600); // 1 hour TTL
  }
  
  return settings;
}

// Cache invalidation
function updateSettings(newSettings) {
  // Update database
  const updated = updateSettingsInDatabase(newSettings);
  
  // Invalidate cache
  cache.del('app:settings');
  
  return updated;
}
```

## Monitoring & Cost Alerts

### 1. Cost Monitoring

#### Platform Cost Alerts
```bash
# AWS Cost Alerts
aws budgets create-budget \
  --account-id 123456789012 \
  --budget '{
    "BudgetName": "learning-assistant-budget",
    "BudgetLimit": {
      "Amount": "50",
      "Unit": "USD"
    },
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }' \
  --notifications-with-subscribers '[{
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80
    },
    "Subscribers": [{
      "SubscriptionType": "EMAIL",
      "Address": "admin@company.com"
    }]
  }]'

# GCP Budget Alerts
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="Learning Assistant Budget" \
  --budget-amount=50USD \
  --threshold-rule=threshold-percent=0.5,spend-basis=current-spend \
  --threshold-rule=threshold-percent=0.9,spend-basis=current-spend \
  --threshold-rule=threshold-percent=1.0,spend-basis=current-spend

# Azure Cost Alerts
az consumption budget create \
  --budget-name "learning-assistant-budget" \
  --amount 50 \
  --time-grain Monthly \
  --start-date "2024-01-01T00:00:00Z" \
  --end-date "2024-12-31T00:00:00Z" \
  --notification-enabled true \
  --notification-operator GreaterThan \
  --notification-threshold 80 \
  --contact-emails "admin@company.com"
```

#### Application Cost Monitoring
```javascript
// Cost monitoring middleware
const costMetrics = {
  requests: 0,
  dataTransfer: 0,
  databaseQueries: 0,
  cacheHits: 0,
  cacheMisses: 0
};

function costTrackingMiddleware(req, res, next) {
  const start = Date.now();
  
  // Track request
  costMetrics.requests++;
  
  // Track response size (data transfer)
  const originalSend = res.send;
  res.send = function(data) {
    costMetrics.dataTransfer += Buffer.byteLength(data);
    return originalSend.call(this, data);
  };
  
  // Track database queries
  const originalQuery = pool.query;
  pool.query = function(...args) {
    costMetrics.databaseQueries++;
    return originalQuery.apply(this, args);
  };
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Log expensive requests
    if (duration > 1000 || costMetrics.databaseQueries > 5) {
      console.warn('Expensive request:', {
        path: req.path,
        duration,
        queries: costMetrics.databaseQueries,
        dataTransfer: costMetrics.dataTransfer
      });
    }
  });
  
  next();
}

// Periodic cost reporting
setInterval(() => {
  console.log('Cost metrics:', {
    requestsPerHour: costMetrics.requests,
    dataTransferMB: costMetrics.dataTransfer / 1024 / 1024,
    databaseQueries: costMetrics.databaseQueries,
    cacheHitRatio: costMetrics.cacheHits / (costMetrics.cacheHits + costMetrics.cacheMisses)
  });
  
  // Reset counters
  Object.keys(costMetrics).forEach(key => costMetrics[key] = 0);
}, 3600000); // Every hour
```

### 2. Resource Optimization

#### Automatic Scaling
```javascript
// Auto-scaling based on metrics
const autoScaler = {
  checkInterval: 60000, // Check every minute
  scaleUpThreshold: 80, // CPU > 80%
  scaleDownThreshold: 20, // CPU < 20%
  minInstances: 1,
  maxInstances: 5
};

async function checkAndScale() {
  const metrics = await getCurrentMetrics();
  
  if (metrics.cpu > autoScaler.scaleUpThreshold && metrics.instances < autoScaler.maxInstances) {
    await scaleUp();
    console.log('Scaled up due to high CPU:', metrics.cpu);
  } else if (metrics.cpu < autoScaler.scaleDownThreshold && metrics.instances > autoScaler.minInstances) {
    await scaleDown();
    console.log('Scaled down due to low CPU:', metrics.cpu);
  }
}

setInterval(checkAndScale, autoScaler.checkInterval);
```

#### Resource Cleanup
```bash
#!/bin/bash
# cleanup-resources.sh

# Remove unused Docker images
docker image prune -f

# Remove unused volumes
docker volume prune -f

# Clean up old log files
find /var/log -name "*.log" -mtime +30 -delete

# Clean up temp files
find /tmp -mtime +7 -delete

# Clean up old backups
find /backups -name "*.sql" -mtime +30 -delete

# Report savings
echo "Cleanup completed. Disk space freed: $(df -h | grep '/$' | awk '{print $4}')"
```

## Development Environment Optimization

### 1. Development vs Production

#### Environment-Specific Configurations
```javascript
// config/environments.js
const environments = {
  development: {
    database: {
      type: 'sqlite',
      path: './dev.db'
    },
    cache: {
      type: 'memory'
    },
    features: {
      analytics: false,
      monitoring: false
    },
    resources: {
      minMemory: '256MB',
      maxMemory: '512MB'
    }
  },
  
  staging: {
    database: {
      type: 'postgresql',
      pool: { min: 1, max: 3 }
    },
    cache: {
      type: 'redis',
      maxMemory: '100MB'
    },
    features: {
      analytics: true,
      monitoring: true
    },
    resources: {
      minMemory: '512MB',
      maxMemory: '1GB'
    }
  },
  
  production: {
    database: {
      type: 'postgresql',
      pool: { min: 2, max: 10 }
    },
    cache: {
      type: 'redis',
      maxMemory: '500MB'
    },
    features: {
      analytics: true,
      monitoring: true
    },
    resources: {
      minMemory: '1GB',
      maxMemory: '2GB'
    }
  }
};
```

#### Development Environment Management
```bash
# Development environment sleep schedules
# Fly.io
flyctl scale count 0 --app dev-learning-assistant  # Stop during nights

# Railway
railway environment  # Use Railway's sleep feature

# Render
# Use free tier with auto-sleep

# Development environment cleanup
#!/bin/bash
# dev-cleanup.sh
echo "Cleaning up development environments..."

# Stop development containers
docker-compose -f docker-compose.dev.yml down

# Remove development data
rm -rf ./dev-data/*

# Clean development logs
truncate -s 0 ./logs/dev.log

echo "Development cleanup completed"
```

### 2. Testing Environment Optimization

#### Efficient Testing
```javascript
// Optimized test configuration
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/tests/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  // Use in-memory database for tests
  globalSetup: '<rootDir>/tests/global-setup.js',
  globalTeardown: '<rootDir>/tests/global-teardown.js'
};

// tests/global-setup.js
module.exports = async () => {
  // Use SQLite in-memory database for tests
  process.env.DATABASE_URL = 'sqlite::memory:';
  process.env.NODE_ENV = 'test';
  process.env.REDIS_URL = 'redis://localhost:6379/15'; // Test database
};
```

## Long-term Cost Strategy

### 1. Growth Planning

#### Scaling Projections
```javascript
// Cost projection model
const costModel = {
  users: {
    current: 100,
    growth: 20, // 20% monthly growth
    costPerUser: 0.10 // $0.10 per user per month
  },
  
  requests: {
    current: 100000,
    growth: 25, // 25% monthly growth
    costPer1000: 0.40 // $0.40 per 1000 requests
  },
  
  storage: {
    current: 10, // GB
    growth: 15, // 15% monthly growth
    costPerGB: 0.15 // $0.15 per GB per month
  }
};

function projectCosts(months) {
  const projections = [];
  
  for (let month = 1; month <= months; month++) {
    const users = costModel.users.current * Math.pow(1 + costModel.users.growth / 100, month);
    const requests = costModel.requests.current * Math.pow(1 + costModel.requests.growth / 100, month);
    const storage = costModel.storage.current * Math.pow(1 + costModel.storage.growth / 100, month);
    
    const userCost = users * costModel.users.costPerUser;
    const requestCost = (requests / 1000) * costModel.requests.costPer1000;
    const storageCost = storage * costModel.storage.costPerGB;
    
    projections.push({
      month,
      users: Math.round(users),
      requests: Math.round(requests),
      storage: Math.round(storage),
      totalCost: userCost + requestCost + storageCost
    });
  }
  
  return projections;
}

// 12-month projection
const yearProjection = projectCosts(12);
console.table(yearProjection);
```

#### Platform Migration Strategy
```javascript
// Platform comparison for different scales
const platformComparison = {
  small: { // < 1000 users
    recommended: ['Fly.io', 'Railway', 'Render'],
    costs: {
      'Fly.io': '$5-15/month',
      'Railway': '$10-25/month',
      'Render': '$15-35/month'
    }
  },
  
  medium: { // 1000-10000 users
    recommended: ['DigitalOcean', 'AWS', 'GCP'],
    costs: {
      'DigitalOcean': '$25-100/month',
      'AWS': '$50-200/month',
      'GCP': '$40-180/month'
    }
  },
  
  large: { // > 10000 users
    recommended: ['AWS', 'GCP', 'Azure'],
    costs: {
      'AWS': '$200-1000+/month',
      'GCP': '$180-900+/month',
      'Azure': '$200-950+/month'
    }
  }
};
```

### 2. Cost Optimization Roadmap

#### Phase 1: Immediate Optimizations (Week 1)
```bash
# Quick wins
- Right-size current resources
- Enable auto-scaling
- Set up cost alerts
- Optimize database queries
- Enable compression
- Clean up unused resources
```

#### Phase 2: Medium-term Optimizations (Month 1)
```bash
# Infrastructure improvements
- Implement caching strategy
- Optimize Docker images
- Set up CDN for static assets
- Database optimization
- Monitoring and alerting
- Development environment automation
```

#### Phase 3: Long-term Optimizations (Month 3+)
```bash
# Strategic improvements
- Multi-cloud strategy
- Reserved instance planning
- Advanced auto-scaling
- Performance optimization
- Cost allocation and tracking
- Regular cost reviews
```

## Cost Optimization Checklist

### Application Level
- [ ] Database queries are optimized with proper indexes
- [ ] Caching is implemented for frequently accessed data
- [ ] Images and assets are optimized and compressed
- [ ] Unused dependencies are removed
- [ ] Memory usage is monitored and optimized
- [ ] Connection pooling is properly configured

### Infrastructure Level
- [ ] Right-sized instances for workload
- [ ] Auto-scaling is configured
- [ ] Development environments are properly managed
- [ ] Unused resources are regularly cleaned up
- [ ] Cost monitoring and alerts are set up
- [ ] Reserved instances are used where appropriate

### Operational Level
- [ ] Regular cost reviews are scheduled
- [ ] Cost allocation is tracked by feature/team
- [ ] Performance metrics are monitored
- [ ] Capacity planning is in place
- [ ] Incident response procedures minimize costs
- [ ] Team is trained on cost optimization

---

**Remember**: Cost optimization is an ongoing process. Regularly review your costs, monitor usage patterns, and adjust your infrastructure accordingly. The goal is to maintain performance and reliability while minimizing unnecessary expenses.