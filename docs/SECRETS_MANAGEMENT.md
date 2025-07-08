# Secrets Management Documentation

## Overview

This document describes the comprehensive secrets management system implemented for the Learning Assistant application. The system provides zero-trust secrets management with automated rotation, encryption, auditing, and secure deployment workflows.

## Table of Contents

1. [Architecture](#architecture)
2. [Supported Providers](#supported-providers)
3. [Setup and Installation](#setup-and-installation)
4. [Configuration](#configuration)
5. [Secret Rotation](#secret-rotation)
6. [Runtime Injection](#runtime-injection)
7. [Deployment](#deployment)
8. [Security Features](#security-features)
9. [Monitoring and Auditing](#monitoring-and-auditing)
10. [Emergency Procedures](#emergency-procedures)
11. [Best Practices](#best-practices)
12. [Troubleshooting](#troubleshooting)

## Architecture

The secrets management system consists of several components:

```
┌─────────────────────────────────────────────────────────────┐
│                    Learning Assistant                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────┐ │
│  │ Runtime Secrets │  │ Secret Rotation │  │ Audit Logging │ │
│  │    Injection    │  │    Manager      │  │    System     │ │
│  └─────────────────┘  └─────────────────┘  └───────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                   Secrets Manager Core                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────┐ │
│  │   Encryption    │  │     Caching     │  │ Provider API  │ │
│  │    at Rest      │  │   & Transport   │  │   Abstraction │ │
│  └─────────────────┘  └─────────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Secrets Providers                           │
├─────────────────┬─────────────────┬─────────────────────────┤
│ HashiCorp Vault │ AWS Secrets Mgr │    Azure Key Vault      │
└─────────────────┴─────────────────┴─────────────────────────┘
```

## Supported Providers

### HashiCorp Vault (Primary)
- **Features**: KV v2 secrets engine, dynamic secrets, policies, audit logging
- **Authentication**: Token-based, Kubernetes service accounts
- **Rotation**: Built-in support for secret versioning and rotation
- **Setup**: Use `scripts/secrets/setup-vault.sh`

### AWS Secrets Manager
- **Features**: Automatic rotation, integration with AWS services
- **Authentication**: IAM roles and policies
- **Rotation**: Lambda-based automatic rotation
- **Setup**: AWS CLI configuration required

### Azure Key Vault
- **Features**: Hardware security modules, certificate management
- **Authentication**: Azure Active Directory
- **Rotation**: Azure Functions-based rotation
- **Setup**: Azure CLI configuration required

## Setup and Installation

### Prerequisites

```bash
# Install required tools
curl -fsSL https://releases.hashicorp.com/vault/1.15.4/vault_1.15.4_linux_amd64.zip -o vault.zip
unzip vault.zip && sudo mv vault /usr/local/bin/

# Install jq for JSON processing
sudo apt-get install jq  # Ubuntu/Debian
brew install jq          # macOS
```

### Quick Setup with HashiCorp Vault

```bash
# 1. Full Vault setup (install, configure, start, initialize)
./scripts/secrets/setup-vault.sh full

# 2. Source the environment configuration
source vault-env.sh

# 3. Verify setup
vault status
vault kv list learning-assistant
```

### Manual Setup Steps

```bash
# 1. Install Vault
./scripts/secrets/setup-vault.sh install

# 2. Configure Vault
./scripts/secrets/setup-vault.sh configure

# 3. Start Vault server
./scripts/secrets/setup-vault.sh start

# 4. Initialize Vault (first time only)
./scripts/secrets/setup-vault.sh init

# 5. Setup secrets engines and policies
./scripts/secrets/setup-vault.sh setup
```

## Configuration

### Environment Variables

```bash
# Secrets Provider Configuration
SECRETS_PROVIDER=hashicorp-vault          # Provider type
SECRETS_ENDPOINT=http://localhost:8200    # Provider endpoint
SECRETS_TOKEN=your-vault-token            # Authentication token
SECRETS_NAMESPACE=learning-assistant      # Namespace/path for secrets

# Caching and Performance
SECRETS_CACHE_TTL=300                     # Cache TTL in seconds (5 minutes)

# Security Features
SECRETS_ENCRYPTION_KEY=your-32-char-key   # Encryption key for local storage
SECRETS_ROTATION_ENABLED=true             # Enable automatic rotation
SECRETS_AUDIT_ENABLED=true                # Enable audit logging

# Notifications
SECRETS_EMERGENCY_ROTATION_WEBHOOK=https://... # Emergency notification webhook
```

### Application Configuration

```typescript
// src/lib/config.ts
import { getSecret } from './runtime-secrets';

export const config = {
  email: {
    apiKey: getSecret('RESEND_API_KEY'),
    // ... other config
  },
  ai: {
    tamboApiKey: getSecret('TAMBO_API_KEY'),
    lingoApiKey: getSecret('LINGO_DEV_API_KEY'),
    // ... other config
  }
};
```

## Secret Rotation

### Automatic Rotation

The system includes automated secret rotation with configurable policies:

```typescript
// Default rotation policies
const rotationPolicies = [
  {
    secretName: 'resend-api-key',
    interval: 30,      // days
    maxVersions: 5,
    enabled: true
  },
  {
    secretName: 'jwt-secret',
    interval: 90,      // days
    maxVersions: 3,
    enabled: true
  }
];
```

### Manual Rotation

```bash
# Rotate a single secret
./scripts/secrets/rotate-secrets.sh rotate resend-api-key resend-api-key

# Rotate multiple secrets
./scripts/secrets/rotate-secrets.sh rotate-multiple \
  jwt-secret:jwt-secret \
  csrf-secret:csrf-secret

# Emergency rotation of all secrets
./scripts/secrets/rotate-secrets.sh emergency-rotate-all
```

### Rotation Monitoring

```bash
# Check rotation status
./scripts/secrets/rotate-secrets.sh list

# View secret information
./scripts/secrets/rotate-secrets.sh info jwt-secret

# View rotation history
tail -f vault-data/audit.log | jq 'select(.request.operation == "update")'
```

## Runtime Injection

### Automatic Injection

The runtime secrets injection system automatically loads secrets at application startup:

```typescript
import runtimeSecrets from './lib/runtime-secrets';

// Initialize secrets (happens automatically)
await runtimeSecrets.initialize();

// Validate required secrets
runtimeSecrets.validateRequiredSecrets([
  'RESEND_API_KEY',
  'TAMBO_API_KEY',
  'JWT_SECRET'
]);

// Setup periodic refresh (every 5 minutes)
runtimeSecrets.setupPeriodicRefresh(5);
```

### Manual Secret Access

```typescript
import { getSecret } from './lib/runtime-secrets';

// Get a secret value
const apiKey = getSecret('RESEND_API_KEY');

// Check if injection is enabled
if (runtimeSecrets.isEnabled()) {
  console.log('Secrets injection is active');
}
```

## Deployment

### Development Environment

```bash
# Start development environment with Vault
kubectl apply -f deploy/secrets/development.yml

# Verify deployment
kubectl get pods -n learning-assistant-dev
kubectl logs -f deployment/learning-assistant -n learning-assistant-dev
```

### Staging Environment

```bash
# Deploy to staging
kubectl apply -f deploy/secrets/staging.yml

# Monitor secret refresh
kubectl logs -f deployment/learning-assistant -n learning-assistant-staging | grep "secrets"
```

### Production Environment

```bash
# Deploy to production
kubectl apply -f deploy/secrets/production.yml

# Verify External Secrets Operator
kubectl get externalsecrets -n learning-assistant
kubectl describe externalsecret application-secrets -n learning-assistant
```

### CI/CD Integration

The CI/CD pipeline includes secrets security scanning:

```yaml
# .github/workflows/security.yml
- name: Secrets Scan
  uses: zricethezav/gitleaks-action@v2
  
- name: Validate secrets management
  run: |
    # Check for hardcoded secrets
    ./scripts/check-hardcoded-secrets.sh
    
    # Validate secrets management setup
    ./scripts/validate-secrets-config.sh
```

## Security Features

### Encryption at Rest and in Transit

- **At Rest**: All secrets are encrypted using AES-256-GCM
- **In Transit**: TLS 1.3 for all communication with secrets providers
- **Local Cache**: Secrets are encrypted before caching

### Access Control

```bash
# Vault policy for application
path "learning-assistant/data/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "learning-assistant/metadata/*" {
  capabilities = ["read", "list"]
}
```

### Audit Logging

All secret operations are logged with:
- Operation type (read, write, rotate, delete)
- User/service identity
- Timestamp
- Secret name (without value)
- Success/failure status

## Monitoring and Auditing

### Health Checks

```typescript
// Check secrets system health
const health = await rotationManager.healthCheck();
console.log(health);
// {
//   status: 'healthy',
//   activeJobs: 8,
//   failedJobs: 0,
//   lastRotations: { ... }
// }
```

### Audit Log Analysis

```bash
# View recent secret operations
vault audit list
vault read sys/audit/file

# Analysis queries
jq 'select(.request.path | contains("learning-assistant"))' audit.log
jq 'select(.response.data.error != null)' audit.log
```

### Metrics and Alerting

```typescript
// Set up monitoring
const metrics = {
  secretsRetrieved: new Counter('secrets_retrieved_total'),
  secretsRotated: new Counter('secrets_rotated_total'),
  rotationFailures: new Counter('rotation_failures_total'),
  cacheHitRate: new Histogram('secrets_cache_hit_rate')
};
```

## Emergency Procedures

### Immediate Secret Rotation

```bash
# Emergency rotation with notification
EMERGENCY_REASON="Security incident detected" \
ROTATION_WEBHOOK="https://alerts.company.com/webhook" \
FORCE_EMERGENCY=true \
./scripts/secrets/rotate-secrets.sh emergency-rotate-all
```

### Vault Breach Response

```bash
# 1. Revoke all tokens
vault auth -method=token revoke-prefix auth/token/

# 2. Rotate root token
vault operator generate-root

# 3. Update application tokens
vault token create -policy=learning-assistant -ttl=1h

# 4. Rotate all application secrets
./scripts/secrets/rotate-secrets.sh emergency-rotate-all
```

### Secret Restoration

```bash
# List available backups
ls -la scripts/secrets/rotation-backups/

# Restore specific secret
./scripts/secrets/rotate-secrets.sh restore jwt-secret \
  scripts/secrets/rotation-backups/jwt-secret_20231201_120000.json
```

## Best Practices

### Secret Naming

- Use kebab-case: `resend-api-key`
- Include environment suffix for non-prod: `jwt-secret-staging`
- Use descriptive names: `supabase-service-role-key`

### Rotation Intervals

- **API Keys**: 30 days
- **Authentication Secrets**: 90 days
- **Database Passwords**: 180 days
- **Root Certificates**: 365 days

### Access Patterns

```typescript
// ✅ Good - Use runtime injection
const apiKey = getSecret('RESEND_API_KEY');

// ❌ Bad - Direct environment access
const apiKey = process.env.RESEND_API_KEY;

// ✅ Good - Validate required secrets
validateRequiredSecrets(['RESEND_API_KEY', 'JWT_SECRET']);

// ❌ Bad - Assume secrets exist
const apiKey = process.env.RESEND_API_KEY!;
```

### Error Handling

```typescript
try {
  await initializeRuntimeSecrets();
} catch (error) {
  // In production, this is critical
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
  
  // In development, log and continue
  console.error('Secrets initialization failed:', error);
}
```

## Troubleshooting

### Common Issues

#### Vault Connection Failed

```bash
# Check Vault status
vault status

# Check network connectivity
curl -s http://localhost:8200/v1/sys/health

# Verify authentication
vault token lookup
```

#### Secret Not Found

```bash
# List all secrets
vault kv list learning-assistant

# Check secret existence
vault kv get learning-assistant/resend-api-key

# Verify permissions
vault token capabilities learning-assistant/data/resend-api-key
```

#### Rotation Failures

```bash
# Check rotation logs
tail -f scripts/secrets/rotation-backups/*.log

# Verify rotation job status
node -e "
const { getRotationStatus } = require('./src/lib/secret-rotation');
console.log(getRotationStatus('resend-api-key'));
"
```

#### Runtime Injection Issues

```bash
# Check runtime secrets status
node -e "
const runtimeSecrets = require('./src/lib/runtime-secrets');
console.log(runtimeSecrets.getStatus());
"

# Enable debug logging
DEBUG=secrets:* npm start
```

### Debug Commands

```bash
# Vault debug
vault operator diagnose
vault monitor

# Application debug
NODE_ENV=development DEBUG=secrets:* npm start

# Kubernetes debug
kubectl describe externalsecret application-secrets
kubectl get events --sort-by=.metadata.creationTimestamp
```

### Log Analysis

```bash
# Application logs
kubectl logs -f deployment/learning-assistant | grep -E "(secret|rotation|vault)"

# Vault audit logs
vault audit list
tail -f vault-data/audit.log | jq 'select(.type == "request")'

# Rotation logs
ls -la scripts/secrets/rotation-backups/*.log
```

## Security Considerations

1. **Never log secret values** - Only log secret names and metadata
2. **Use least privilege** - Grant minimal required permissions
3. **Rotate regularly** - Follow rotation interval guidelines
4. **Monitor access** - Review audit logs regularly
5. **Encrypt in transit** - Always use TLS for secrets communication
6. **Validate inputs** - Sanitize secret names and metadata
7. **Handle errors securely** - Don't expose secret information in error messages

## Support and Maintenance

For issues or questions regarding the secrets management system:

1. Check this documentation and troubleshooting section
2. Review audit logs for security events
3. Verify Vault health and connectivity
4. Contact the security team for emergency incidents

---

*Last updated: $(date)*