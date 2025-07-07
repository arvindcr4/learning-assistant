# Security Best Practices for Deployment

## Overview

This guide covers comprehensive security practices for deploying the Learning Assistant application across different platforms, including authentication, data protection, network security, and compliance considerations.

## Core Security Principles

### 1. Defense in Depth
- Multiple layers of security controls
- Fail-safe defaults
- Principle of least privilege
- Regular security audits

### 2. Security by Design
- Security considerations from deployment planning
- Secure coding practices
- Regular dependency updates
- Automated security testing

## Authentication & Authorization

### 1. Secret Management

#### Environment Variables Security
```bash
# ❌ NEVER DO THIS - Hardcoded secrets
const secret = "hardcoded-secret-key";

# ✅ USE ENVIRONMENT VARIABLES
const secret = process.env.BETTER_AUTH_SECRET;

# Generate secure secrets
openssl rand -base64 32
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Minimum secret requirements:
# - At least 32 characters long
# - Cryptographically random
# - Unique per environment
# - Rotated regularly
```

#### Platform Secret Management
```bash
# AWS Secrets Manager
aws secretsmanager create-secret \
  --name "learning-assistant/prod/auth-secret" \
  --secret-string "your-secure-secret"

# Azure Key Vault
az keyvault secret set \
  --vault-name "learning-assistant-kv" \
  --name "auth-secret" \
  --value "your-secure-secret"

# Google Secret Manager
echo "your-secure-secret" | gcloud secrets create auth-secret --data-file=-

# Platform-specific secret injection
# Fly.io
flyctl secrets set BETTER_AUTH_SECRET="your-secure-secret"

# Render
# Set secrets in Render dashboard

# Railway
railway variables set BETTER_AUTH_SECRET="your-secure-secret"
```

#### Secret Rotation Strategy
```javascript
// Implement secret rotation
const rotateSecrets = {
  schedule: '0 2 1 * *', // Monthly at 2 AM
  secrets: [
    'BETTER_AUTH_SECRET',
    'DATABASE_PASSWORD',
    'JWT_SECRET'
  ],
  rollover: {
    duration: '7 days',
    gracePeriod: '24 hours'
  }
};

// Secret validation
function validateSecret(secret, name) {
  if (!secret) {
    throw new Error(`${name} is required`);
  }
  
  if (secret.length < 32) {
    throw new Error(`${name} must be at least 32 characters`);
  }
  
  // Check for common weak patterns
  if (secret.includes('password') || secret.includes('123')) {
    throw new Error(`${name} contains weak patterns`);
  }
}
```

### 2. Authentication Configuration

#### Better Auth Security
```javascript
// lib/auth.js
import { BetterAuth } from "better-auth";

export const auth = new BetterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  database: {
    provider: "postgresql",
    url: process.env.DATABASE_URL,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60 * 1000 // 5 minutes
    }
  },
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    domain: process.env.COOKIE_DOMAIN,
  },
  rateLimit: {
    window: 60000, // 1 minute
    max: 100 // requests per window
  },
  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_API_URL
  ]
});
```

#### Session Security
```javascript
// Secure session configuration
const sessionConfig = {
  name: 'session',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'strict'
  },
  store: new RedisStore({
    client: redisClient,
    prefix: 'sess:',
    ttl: 86400 // 24 hours
  })
};
```

## Data Protection

### 1. Database Security

#### Connection Security
```bash
# ✅ Secure PostgreSQL connection
DATABASE_URL=postgresql://user:password@host:5432/db?sslmode=require&sslcert=client-cert.pem&sslkey=client-key.pem&sslrootcert=ca-cert.pem

# ✅ Connection pooling with SSL
DATABASE_POOL_SSL=true
DATABASE_POOL_SSL_REJECT_UNAUTHORIZED=true
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_POOL_IDLE_TIMEOUT=10000
```

#### Data Encryption
```javascript
// Encrypt sensitive data before storing
const crypto = require('crypto');

const algorithm = 'aes-256-gcm';
const secretKey = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, secretKey);
  cipher.setAAD(Buffer.from('learning-assistant', 'utf8'));
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

function decrypt(encryptedData) {
  const decipher = crypto.createDecipher(algorithm, secretKey);
  decipher.setAAD(Buffer.from('learning-assistant', 'utf8'));
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

#### Database Access Control
```sql
-- Create dedicated application user
CREATE USER learning_app WITH PASSWORD 'secure_random_password';

-- Grant minimal required permissions
GRANT CONNECT ON DATABASE learning_assistant TO learning_app;
GRANT USAGE ON SCHEMA public TO learning_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO learning_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO learning_app;

-- Revoke dangerous permissions
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM learning_app;

-- Enable row-level security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_isolation ON users USING (user_id = current_setting('app.current_user_id')::uuid);
```

### 2. Input Validation & Sanitization

#### Request Validation
```javascript
// Input validation middleware
import Joi from 'joi';

const userSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required(),
  name: Joi.string().min(2).max(50).pattern(/^[a-zA-Z\s]+$/).required()
});

function validateUser(req, res, next) {
  const { error, value } = userSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details.map(d => d.message)
    });
  }
  
  req.validatedData = value;
  next();
}

// SQL injection prevention
const query = `
  SELECT * FROM users 
  WHERE email = $1 AND status = $2
`;
const values = [email, 'active'];
const result = await pool.query(query, values);
```

#### XSS Prevention
```javascript
// Content Security Policy
const cspConfig = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'", process.env.NEXT_PUBLIC_API_URL],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: []
  }
};

// HTML sanitization
import DOMPurify from 'isomorphic-dompurify';

function sanitizeHtml(dirty) {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: []
  });
}
```

## Network Security

### 1. HTTPS & TLS Configuration

#### SSL/TLS Setup
```bash
# Generate strong SSL certificate
# Let's Encrypt (free)
certbot --nginx -d your-domain.com

# Configure strong TLS
# nginx.conf
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;

# HSTS header
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

#### Security Headers
```javascript
// Security headers middleware
function securityHeaders(req, res, next) {
  // HSTS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Content Type Options
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Frame Options
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
}
```

### 2. CORS Configuration

#### Secure CORS Setup
```javascript
// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_APP_URL,
      'https://your-domain.com',
      'https://www.your-domain.com'
    ];
    
    // Allow same-origin requests
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
```

### 3. Rate Limiting

#### API Rate Limiting
```javascript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

const limiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health';
  }
});

// Stricter limits for sensitive endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 attempts per window
  skipSuccessfulRequests: true
});

// Apply to auth routes
app.use('/api/auth', authLimiter);
```

## Infrastructure Security

### 1. Container Security

#### Dockerfile Security
```dockerfile
# Use specific versions, not latest
FROM node:20.11.1-alpine3.19

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# Set secure permissions
COPY --chown=nextjs:nodejs . .
RUN chmod -R 755 /app && \
    chmod -R 644 /app/package*.json

# Remove unnecessary packages
RUN npm prune --production && \
    npm cache clean --force

# Use non-root user
USER nextjs

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]

# Security labels
LABEL security.scan=true
LABEL maintainer="your-email@domain.com"
```

#### Docker Security Scanning
```bash
# Scan for vulnerabilities
docker scout quickview
docker scout cves

# Use minimal base images
# Alpine Linux is preferred for smaller attack surface
FROM node:20-alpine

# Scan dependencies
npm audit
npm audit fix

# Use .dockerignore
echo "node_modules" >> .dockerignore
echo ".git" >> .dockerignore
echo "*.md" >> .dockerignore
echo ".env*" >> .dockerignore
```

### 2. Environment Isolation

#### Production Environment Security
```bash
# Separate environments
production:
  - Dedicated infrastructure
  - No development tools
  - Minimal dependencies
  - Restricted access

staging:
  - Mirror of production
  - Limited access
  - Test data only

development:
  - Local or isolated environment
  - Full debugging tools
  - Synthetic data only
```

#### Access Control
```bash
# Platform-specific access control

# AWS IAM Roles
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecs:DescribeServices",
        "ecs:UpdateService"
      ],
      "Resource": "arn:aws:ecs:*:*:service/learning-assistant/*"
    }
  ]
}

# Azure RBAC
az role assignment create \
  --assignee user@domain.com \
  --role "Contributor" \
  --scope "/subscriptions/sub-id/resourceGroups/learning-assistant-rg"

# GCP IAM
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="user:user@domain.com" \
  --role="roles/run.developer"
```

## Monitoring & Logging

### 1. Security Logging

#### Audit Logging
```javascript
// Security event logging
const winston = require('winston');

const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'security.log' }),
    new winston.transports.Console()
  ]
});

function logSecurityEvent(event, details) {
  securityLogger.info({
    event,
    timestamp: new Date().toISOString(),
    ip: details.ip,
    userAgent: details.userAgent,
    userId: details.userId,
    details
  });
}

// Log authentication events
function logAuthEvent(type, result, details) {
  logSecurityEvent(`AUTH_${type.toUpperCase()}`, {
    result,
    email: details.email,
    ip: details.ip,
    userAgent: details.userAgent,
    timestamp: details.timestamp
  });
}

// Failed login attempt
logAuthEvent('login', 'FAILED', {
  email: 'user@example.com',
  ip: '192.168.1.1',
  reason: 'Invalid password'
});
```

#### Intrusion Detection
```javascript
// Simple intrusion detection
const suspiciousPatterns = [
  /\b(union|select|insert|update|delete|drop|exec|script)\b/i,
  /<script|javascript:|vbscript:/i,
  /\.\./,
  /\/etc\/passwd/,
  /cmd\.exe/
];

function detectSuspiciousActivity(req) {
  const suspicious = [];
  
  // Check for SQL injection patterns
  const queryString = JSON.stringify(req.query);
  const bodyString = JSON.stringify(req.body);
  
  suspiciousPatterns.forEach((pattern, index) => {
    if (pattern.test(queryString) || pattern.test(bodyString)) {
      suspicious.push(`Pattern ${index} matched`);
    }
  });
  
  // Check for excessive requests
  if (req.rateLimit && req.rateLimit.remaining < 10) {
    suspicious.push('High request rate');
  }
  
  if (suspicious.length > 0) {
    logSecurityEvent('SUSPICIOUS_ACTIVITY', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      patterns: suspicious
    });
  }
}
```

### 2. Security Monitoring

#### Real-time Alerts
```javascript
// Security alerting
const alertThresholds = {
  failedLogins: 5,
  suspiciousRequests: 10,
  errorRate: 0.05
};

function checkSecurityThresholds() {
  // Check failed logins in last 15 minutes
  const failedLogins = getFailedLoginsCount(15);
  if (failedLogins > alertThresholds.failedLogins) {
    sendAlert('HIGH_FAILED_LOGINS', {
      count: failedLogins,
      threshold: alertThresholds.failedLogins
    });
  }
  
  // Check error rate
  const errorRate = getErrorRate(5);
  if (errorRate > alertThresholds.errorRate) {
    sendAlert('HIGH_ERROR_RATE', {
      rate: errorRate,
      threshold: alertThresholds.errorRate
    });
  }
}
```

## Compliance & Governance

### 1. Data Privacy

#### GDPR Compliance
```javascript
// Data retention policy
const dataRetentionPolicy = {
  userSessions: '30 days',
  auditLogs: '7 years',
  personalData: 'until account deletion',
  analyticsData: '26 months'
};

// Data deletion
async function deleteUserData(userId) {
  await Promise.all([
    deleteUserSessions(userId),
    deletePersonalData(userId),
    anonymizeAnalyticsData(userId),
    logDataDeletion(userId)
  ]);
}

// Data export
async function exportUserData(userId) {
  const userData = await getUserData(userId);
  const sessions = await getUserSessions(userId);
  const preferences = await getUserPreferences(userId);
  
  return {
    userData,
    sessions,
    preferences,
    exportDate: new Date().toISOString()
  };
}
```

#### Privacy Controls
```javascript
// Cookie consent
const cookieConsent = {
  necessary: true, // Always required
  analytics: false, // User choice
  marketing: false, // User choice
  preferences: false // User choice
};

// Privacy settings
function updatePrivacySettings(userId, settings) {
  const allowedSettings = [
    'analytics_enabled',
    'marketing_enabled',
    'data_sharing_enabled'
  ];
  
  const validSettings = {};
  for (const [key, value] of Object.entries(settings)) {
    if (allowedSettings.includes(key)) {
      validSettings[key] = Boolean(value);
    }
  }
  
  return updateUserSettings(userId, validSettings);
}
```

### 2. Security Standards

#### Security Checklist
```markdown
## Pre-Deployment Security Checklist

### Application Security
- [ ] All secrets are properly configured
- [ ] Input validation is implemented
- [ ] Output encoding prevents XSS
- [ ] SQL injection protection is in place
- [ ] Authentication is properly configured
- [ ] Authorization checks are implemented
- [ ] Session management is secure

### Infrastructure Security
- [ ] HTTPS is enforced
- [ ] Security headers are configured
- [ ] CORS is properly configured
- [ ] Rate limiting is implemented
- [ ] Firewall rules are configured
- [ ] Database access is restricted
- [ ] Monitoring and alerting is set up

### Compliance
- [ ] Data retention policies are implemented
- [ ] Privacy controls are in place
- [ ] Audit logging is configured
- [ ] Incident response plan is ready
- [ ] Security documentation is updated
```

#### Security Testing
```bash
# Automated security testing
npm audit
npm run test:security

# OWASP ZAP scanning
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://your-domain.com

# SSL/TLS testing
sslyze your-domain.com

# Header security testing
curl -I https://your-domain.com | grep -E "(Strict-Transport-Security|X-Frame-Options|X-Content-Type-Options)"
```

## Incident Response

### 1. Security Incident Plan

#### Response Procedures
```markdown
## Security Incident Response Plan

### Immediate Response (0-1 hour)
1. Identify and contain the threat
2. Assess the scope of the incident
3. Notify security team
4. Document all actions taken

### Investigation (1-24 hours)
1. Collect and preserve evidence
2. Analyze attack vectors
3. Determine data exposure
4. Coordinate with stakeholders

### Recovery (24-72 hours)
1. Remove threats from environment
2. Patch vulnerabilities
3. Restore from clean backups
4. Implement additional controls

### Post-Incident (1-2 weeks)
1. Conduct lessons learned review
2. Update security procedures
3. Communicate with affected users
4. File required reports
```

#### Emergency Contacts
```javascript
// Emergency response contacts
const emergencyContacts = {
  securityTeam: 'security@company.com',
  platformSupport: {
    aws: 'https://console.aws.amazon.com/support/',
    gcp: 'https://cloud.google.com/support/',
    azure: 'https://portal.azure.com/#blade/Microsoft_Azure_Support/'
  },
  legal: 'legal@company.com',
  compliance: 'compliance@company.com'
};
```

### 2. Breach Notification

#### Automated Notifications
```javascript
// Security breach notification
async function notifySecurityBreach(incident) {
  const notification = {
    timestamp: new Date().toISOString(),
    severity: incident.severity,
    type: incident.type,
    affectedUsers: incident.affectedUsers,
    description: incident.description
  };
  
  // Notify security team immediately
  await sendEmail({
    to: 'security@company.com',
    subject: `SECURITY INCIDENT: ${incident.type}`,
    body: JSON.stringify(notification, null, 2)
  });
  
  // Log to security system
  await logSecurityEvent('BREACH_NOTIFICATION', notification);
  
  // If personal data affected, start GDPR notification process
  if (incident.personalDataAffected) {
    await initiateDPANotification(incident);
  }
}
```

## Platform-Specific Security

### AWS Security
```bash
# AWS security best practices
# Use IAM roles instead of access keys
# Enable CloudTrail for audit logging
# Use VPC for network isolation
# Enable GuardDuty for threat detection
# Use Secrets Manager for secrets
# Enable Config for compliance monitoring
```

### Google Cloud Security
```bash
# GCP security best practices
# Use service accounts with minimal permissions
# Enable Cloud Security Command Center
# Use VPC for network isolation
# Enable Cloud Armor for DDoS protection
# Use Secret Manager for secrets
# Enable Cloud Audit Logs
```

### Azure Security
```bash
# Azure security best practices
# Use managed identities
# Enable Azure Security Center
# Use Network Security Groups
# Enable Azure Defender
# Use Key Vault for secrets
# Enable Azure Monitor
```

---

**Remember**: Security is an ongoing process, not a one-time setup. Regularly review and update your security configurations, keep dependencies updated, and stay informed about new security threats and best practices.