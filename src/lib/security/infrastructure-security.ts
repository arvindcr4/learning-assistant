/**
 * Infrastructure security hardening and deployment configurations
 */

export interface SecurityHardeningConfig {
  ssl: {
    enabled: boolean;
    minVersion: string;
    cipherSuites: string[];
    hsts: {
      enabled: boolean;
      maxAge: number;
      includeSubDomains: boolean;
      preload: boolean;
    };
  };
  headers: {
    contentTypeOptions: boolean;
    frameOptions: string;
    xssProtection: boolean;
    referrerPolicy: string;
    permissionsPolicy: string[];
    csp: {
      enabled: boolean;
      policy: Record<string, string[]>;
      reportUri?: string;
    };
  };
  database: {
    ssl: boolean;
    connectionPooling: {
      min: number;
      max: number;
      idleTimeout: number;
    };
    queryTimeout: number;
    statementTimeout: number;
  };
  logging: {
    level: string;
    retention: number;
    encryption: boolean;
    anonymization: boolean;
  };
  backup: {
    enabled: boolean;
    frequency: string;
    retention: number;
    encryption: boolean;
    offsite: boolean;
  };
  monitoring: {
    healthChecks: boolean;
    metricsCollection: boolean;
    alerting: boolean;
    uptimeMonitoring: boolean;
  };
}

export class InfrastructureSecurityService {
  private config: SecurityHardeningConfig;

  constructor() {
    this.config = this.getDefaultConfig();
  }

  /**
   * Get default security hardening configuration
   */
  private getDefaultConfig(): SecurityHardeningConfig {
    return {
      ssl: {
        enabled: true,
        minVersion: 'TLSv1.2',
        cipherSuites: [
          'ECDHE-ECDSA-AES256-GCM-SHA384',
          'ECDHE-RSA-AES256-GCM-SHA384',
          'ECDHE-ECDSA-CHACHA20-POLY1305',
          'ECDHE-RSA-CHACHA20-POLY1305',
          'ECDHE-ECDSA-AES128-GCM-SHA256',
          'ECDHE-RSA-AES128-GCM-SHA256',
        ],
        hsts: {
          enabled: true,
          maxAge: 31536000, // 1 year
          includeSubDomains: true,
          preload: true,
        },
      },
      headers: {
        contentTypeOptions: true,
        frameOptions: 'DENY',
        xssProtection: true,
        referrerPolicy: 'strict-origin-when-cross-origin',
        permissionsPolicy: [
          'camera=()',
          'microphone=()',
          'geolocation=()',
          'interest-cohort=()',
        ],
        csp: {
          enabled: true,
          policy: {
            'default-src': ["'self'"],
            'script-src': ["'self'", "'unsafe-inline'", 'https://apis.google.com'],
            'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            'img-src': ["'self'", 'data:', 'https:'],
            'font-src': ["'self'", 'https://fonts.gstatic.com'],
            'connect-src': ["'self'", 'https://api.openai.com'],
            'frame-src': ["'none'"],
            'frame-ancestors': ["'self'"],
            'base-uri': ["'self'"],
            'form-action': ["'self'"],
          },
          reportUri: '/api/security/csp-report',
        },
      },
      database: {
        ssl: true,
        connectionPooling: {
          min: 2,
          max: 10,
          idleTimeout: 30000,
        },
        queryTimeout: 30000,
        statementTimeout: 60000,
      },
      logging: {
        level: 'info',
        retention: 90, // days
        encryption: true,
        anonymization: true,
      },
      backup: {
        enabled: true,
        frequency: 'daily',
        retention: 30, // days
        encryption: true,
        offsite: true,
      },
      monitoring: {
        healthChecks: true,
        metricsCollection: true,
        alerting: true,
        uptimeMonitoring: true,
      },
    };
  }

  /**
   * Generate security headers for HTTP responses
   */
  getSecurityHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    // HSTS
    if (this.config.ssl.hsts.enabled) {
      let hstsValue = `max-age=${this.config.ssl.hsts.maxAge}`;
      if (this.config.ssl.hsts.includeSubDomains) {
        hstsValue += '; includeSubDomains';
      }
      if (this.config.ssl.hsts.preload) {
        hstsValue += '; preload';
      }
      headers['Strict-Transport-Security'] = hstsValue;
    }

    // Content Type Options
    if (this.config.headers.contentTypeOptions) {
      headers['X-Content-Type-Options'] = 'nosniff';
    }

    // Frame Options
    headers['X-Frame-Options'] = this.config.headers.frameOptions;

    // XSS Protection
    if (this.config.headers.xssProtection) {
      headers['X-XSS-Protection'] = '1; mode=block';
    }

    // Referrer Policy
    headers['Referrer-Policy'] = this.config.headers.referrerPolicy;

    // Permissions Policy
    headers['Permissions-Policy'] = this.config.headers.permissionsPolicy.join(', ');

    // Content Security Policy
    if (this.config.headers.csp.enabled) {
      const cspDirectives = Object.entries(this.config.headers.csp.policy)
        .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
        .join('; ');
      
      headers['Content-Security-Policy'] = cspDirectives;
      
      if (this.config.headers.csp.reportUri) {
        headers['Content-Security-Policy-Report-Only'] = 
          cspDirectives + `; report-uri ${this.config.headers.csp.reportUri}`;
      }
    }

    // Remove server information
    headers['Server'] = '';
    
    return headers;
  }

  /**
   * Generate database connection configuration
   */
  getDatabaseConfig(): any {
    return {
      ssl: this.config.database.ssl ? {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
      } : false,
      pool: {
        min: this.config.database.connectionPooling.min,
        max: this.config.database.connectionPooling.max,
        idleTimeoutMillis: this.config.database.connectionPooling.idleTimeout,
      },
      query_timeout: this.config.database.queryTimeout,
      statement_timeout: this.config.database.statementTimeout,
      connectionTimeoutMillis: 10000,
      application_name: 'learning-assistant',
    };
  }

  /**
   * Generate Nginx configuration for security hardening
   */
  generateNginxConfig(): string {
    return `
# Security-hardened Nginx configuration for Learning Assistant

# Rate limiting
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=api:10m rate=60r/m;
limit_req_zone $binary_remote_addr zone=general:10m rate=100r/m;

# Connection limiting
limit_conn_zone $binary_remote_addr zone=addr:10m;

server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    # SSL Security
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ${this.config.ssl.cipherSuites.join(':')};
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;
    
    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /path/to/chain.crt;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    # Security Headers
    add_header Strict-Transport-Security "${this.config.ssl.hsts.enabled ? 
      `max-age=${this.config.ssl.hsts.maxAge}${this.config.ssl.hsts.includeSubDomains ? '; includeSubDomains' : ''}${this.config.ssl.hsts.preload ? '; preload' : ''}` : 
      'max-age=31536000; includeSubDomains; preload'}" always;
    add_header X-Frame-Options "${this.config.headers.frameOptions}" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "${this.config.headers.referrerPolicy}" always;
    
    # Hide Nginx version
    server_tokens off;
    
    # Connection limits
    limit_conn addr 10;
    
    # Request size limits
    client_max_body_size 10M;
    client_body_buffer_size 128k;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 16k;
    
    # Timeouts
    client_body_timeout 12;
    client_header_timeout 12;
    keepalive_timeout 15;
    send_timeout 10;
    
    # Gzip compression (with security considerations)
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;
    
    # Security-related locations
    location = /robots.txt {
        allow all;
        log_not_found off;
        access_log off;
    }
    
    location = /favicon.ico {
        log_not_found off;
        access_log off;
    }
    
    # Block access to sensitive files
    location ~* \\.(env|log|sql|bak|backup|swp|tmp)$ {
        deny all;
        return 404;
    }
    
    # Block access to hidden files
    location ~ /\\. {
        deny all;
        return 404;
    }
    
    # Authentication endpoints with strict rate limiting
    location /api/auth/ {
        limit_req zone=login burst=5 nodelay;
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # API endpoints with moderate rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # General application with basic rate limiting
    location / {
        limit_req zone=general burst=50 nodelay;
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Security headers for HTML responses
        location ~* \\.(html|htm)$ {
            add_header Content-Security-Policy "${this.generateCSPString()}" always;
        }
    }
    
    # Health check endpoint (internal only)
    location /health {
        allow 127.0.0.1;
        allow 10.0.0.0/8;
        allow 172.16.0.0/12;
        allow 192.168.0.0/16;
        deny all;
        
        proxy_pass http://localhost:3000;
        access_log off;
    }
}
`;
  }

  /**
   * Generate Docker security configuration
   */
  generateDockerConfig(): any {
    return {
      dockerfile: `
# Multi-stage build for security
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS runtime

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Security updates
RUN apk update && apk upgrade && apk add --no-cache \\
    dumb-init \\
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy built application
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs . .

# Set security headers
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Drop root privileges
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:3000/api/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
`,
      compose: `
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=\${DATABASE_URL}
      - BETTER_AUTH_SECRET=\${BETTER_AUTH_SECRET}
    depends_on:
      - db
      - redis
    restart: unless-stopped
    read_only: true
    tmpfs:
      - /tmp
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    security_opt:
      - no-new-privileges:true
    user: "1001:1001"

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=\${POSTGRES_DB}
      - POSTGRES_USER=\${POSTGRES_USER}
      - POSTGRES_PASSWORD=\${POSTGRES_PASSWORD}
    volumes:
      - db_data:/var/lib/postgresql/data
    restart: unless-stopped
    read_only: true
    tmpfs:
      - /tmp
      - /var/run/postgresql
    cap_drop:
      - ALL
    cap_add:
      - SETUID
      - SETGID
      - DAC_OVERRIDE
    security_opt:
      - no-new-privileges:true

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    read_only: true
    tmpfs:
      - /tmp
    cap_drop:
      - ALL
    cap_add:
      - SETUID
      - SETGID
    security_opt:
      - no-new-privileges:true

volumes:
  db_data:
`,
    };
  }

  /**
   * Generate Kubernetes security manifests
   */
  generateKubernetesConfig(): any {
    return {
      deployment: `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: learning-assistant
  labels:
    app: learning-assistant
spec:
  replicas: 3
  selector:
    matchLabels:
      app: learning-assistant
  template:
    metadata:
      labels:
        app: learning-assistant
    spec:
      serviceAccountName: learning-assistant
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        runAsGroup: 1001
        fsGroup: 1001
        seccompProfile:
          type: RuntimeDefault
      containers:
      - name: app
        image: learning-assistant:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          runAsNonRoot: true
          runAsUser: 1001
          capabilities:
            drop:
            - ALL
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: tmp
          mountPath: /tmp
      volumes:
      - name: tmp
        emptyDir: {}
`,
      networkPolicy: `
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: learning-assistant-netpol
spec:
  podSelector:
    matchLabels:
      app: learning-assistant
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53
  - to:
    - namespaceSelector:
        matchLabels:
          name: database
    ports:
    - protocol: TCP
      port: 5432
`,
      podSecurityPolicy: `
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: learning-assistant-psp
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  runAsUser:
    rule: 'MustRunAsNonRoot'
  runAsGroup:
    rule: 'MustRunAs'
    ranges:
      - min: 1001
        max: 1001
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'MustRunAs'
    ranges:
      - min: 1001
        max: 1001
`,
    };
  }

  /**
   * Generate backup and disaster recovery scripts
   */
  generateBackupScripts(): any {
    return {
      backup: `#!/bin/bash
set -euo pipefail

# Configuration
BACKUP_DIR="/backups"
DB_NAME="\${POSTGRES_DB}"
DB_USER="\${POSTGRES_USER}"
RETENTION_DAYS="${this.config.backup.retention}"
ENCRYPTION_KEY="\${BACKUP_ENCRYPTION_KEY}"

# Create backup directory
mkdir -p "\${BACKUP_DIR}"

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="\${BACKUP_DIR}/backup_\${TIMESTAMP}.sql"
ENCRYPTED_FILE="\${BACKUP_FILE}.enc"

echo "Starting backup at \$(date)"

# Create database backup
pg_dump -h \${POSTGRES_HOST} -U \${DB_USER} -d \${DB_NAME} > "\${BACKUP_FILE}"

# Encrypt backup if encryption is enabled
if [ "${this.config.backup.encryption}" = "true" ]; then
    openssl enc -aes-256-cbc -salt -in "\${BACKUP_FILE}" -out "\${ENCRYPTED_FILE}" -k "\${ENCRYPTION_KEY}"
    rm "\${BACKUP_FILE}"
    BACKUP_FILE="\${ENCRYPTED_FILE}"
fi

# Compress backup
gzip "\${BACKUP_FILE}"
BACKUP_FILE="\${BACKUP_FILE}.gz"

echo "Backup created: \${BACKUP_FILE}"

# Upload to offsite storage (if enabled)
if [ "${this.config.backup.offsite}" = "true" ]; then
    aws s3 cp "\${BACKUP_FILE}" "s3://\${BACKUP_BUCKET}/\$(basename \${BACKUP_FILE})"
    echo "Backup uploaded to S3"
fi

# Clean up old backups
find "\${BACKUP_DIR}" -name "backup_*.sql.gz" -mtime +\${RETENTION_DAYS} -delete
echo "Cleaned up backups older than \${RETENTION_DAYS} days"

echo "Backup completed successfully at \$(date)"
`,
      restore: `#!/bin/bash
set -euo pipefail

# Configuration
BACKUP_FILE="\$1"
DB_NAME="\${POSTGRES_DB}"
DB_USER="\${POSTGRES_USER}"
ENCRYPTION_KEY="\${BACKUP_ENCRYPTION_KEY}"

if [ -z "\${BACKUP_FILE}" ]; then
    echo "Usage: \$0 <backup_file>"
    exit 1
fi

echo "Starting restore from \${BACKUP_FILE} at \$(date)"

# Create temporary directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf \${TEMP_DIR}" EXIT

# Copy backup file to temp directory
cp "\${BACKUP_FILE}" "\${TEMP_DIR}/"
BACKUP_FILE="\${TEMP_DIR}/\$(basename \${BACKUP_FILE})"

# Decompress if needed
if [[ "\${BACKUP_FILE}" == *.gz ]]; then
    gunzip "\${BACKUP_FILE}"
    BACKUP_FILE="\${BACKUP_FILE%.gz}"
fi

# Decrypt if needed
if [[ "\${BACKUP_FILE}" == *.enc ]]; then
    DECRYPTED_FILE="\${BACKUP_FILE%.enc}"
    openssl enc -aes-256-cbc -d -in "\${BACKUP_FILE}" -out "\${DECRYPTED_FILE}" -k "\${ENCRYPTION_KEY}"
    BACKUP_FILE="\${DECRYPTED_FILE}"
fi

# Drop existing database (WARNING: This will delete all data!)
read -p "This will delete all existing data. Are you sure? (yes/no): " confirm
if [ "\${confirm}" != "yes" ]; then
    echo "Restore cancelled"
    exit 1
fi

dropdb -h \${POSTGRES_HOST} -U \${DB_USER} --if-exists \${DB_NAME}
createdb -h \${POSTGRES_HOST} -U \${DB_USER} \${DB_NAME}

# Restore database
psql -h \${POSTGRES_HOST} -U \${DB_USER} -d \${DB_NAME} < "\${BACKUP_FILE}"

echo "Restore completed successfully at \$(date)"
`,
    };
  }

  /**
   * Generate monitoring and alerting configuration
   */
  generateMonitoringConfig(): any {
    return {
      prometheus: `
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alerts.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'learning-assistant'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/api/metrics'
    scrape_interval: 10s

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['postgres-exporter:9187']
`,
      alerts: `
groups:
  - name: learning-assistant
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
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High response time
          description: "95th percentile response time is {{ $value }} seconds"

      - alert: DatabaseConnectionFailure
        expr: up{job="postgres-exporter"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: Database connection failure
          description: "Cannot connect to database"

      - alert: SecurityEventSpike
        expr: rate(security_events_total[5m]) > 10
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: High number of security events
          description: "Security event rate is {{ $value }} per second"
`,
      grafana: `
{
  "dashboard": {
    "title": "Learning Assistant Security Dashboard",
    "panels": [
      {
        "title": "Security Events",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(security_events_total[5m])",
            "legendFormat": "Events per second"
          }
        ]
      },
      {
        "title": "Authentication Failures",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(auth_failures_total[5m])",
            "legendFormat": "Auth failures per second"
          }
        ]
      },
      {
        "title": "Rate Limit Violations",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(rate_limit_exceeded_total[5m])",
            "legendFormat": "Rate limits exceeded per second"
          }
        ]
      }
    ]
  }
}
`,
    };
  }

  /**
   * Generate CSP string from policy object
   */
  private generateCSPString(): string {
    return Object.entries(this.config.headers.csp.policy)
      .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
      .join('; ');
  }

  /**
   * Validate current security configuration
   */
  validateConfiguration(): {
    isValid: boolean;
    warnings: string[];
    errors: string[];
    recommendations: string[];
  } {
    const warnings: string[] = [];
    const errors: string[] = [];
    const recommendations: string[] = [];

    // SSL validation
    if (!this.config.ssl.enabled) {
      errors.push('SSL is not enabled - this is required for production');
    }

    if (this.config.ssl.minVersion < 'TLSv1.2') {
      warnings.push('SSL minimum version should be TLSv1.2 or higher');
    }

    // HSTS validation
    if (!this.config.ssl.hsts.enabled) {
      warnings.push('HSTS is not enabled - recommended for security');
    }

    if (this.config.ssl.hsts.maxAge < 31536000) {
      recommendations.push('HSTS max-age should be at least 1 year (31536000 seconds)');
    }

    // CSP validation
    if (!this.config.headers.csp.enabled) {
      warnings.push('Content Security Policy is not enabled');
    }

    const cspPolicy = this.config.headers.csp.policy;
    if (cspPolicy['script-src']?.includes("'unsafe-inline'")) {
      warnings.push("CSP allows 'unsafe-inline' scripts - consider using nonces or hashes");
    }

    // Database security
    if (!this.config.database.ssl) {
      errors.push('Database SSL is not enabled - required for production');
    }

    // Monitoring validation
    if (!this.config.monitoring.healthChecks) {
      warnings.push('Health checks are not enabled');
    }

    if (!this.config.monitoring.alerting) {
      recommendations.push('Enable alerting for better incident response');
    }

    // Backup validation
    if (!this.config.backup.enabled) {
      warnings.push('Backups are not enabled');
    }

    if (!this.config.backup.encryption) {
      recommendations.push('Enable backup encryption for better security');
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
      recommendations,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<SecurityHardeningConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): SecurityHardeningConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const infrastructureSecurityService = new InfrastructureSecurityService();