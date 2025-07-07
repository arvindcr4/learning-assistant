# Learning Assistant - Linode Terraform Infrastructure

This directory contains a comprehensive Terraform configuration for deploying the Learning Assistant Next.js application on Linode with production-ready infrastructure including PostgreSQL database, load balancing, auto-scaling, and security features.

## 🏗️ Infrastructure Overview

### Architecture

```
Internet
    │
    ▼
┌─────────────────┐
│   Domain Name   │ (Optional)
│      (DNS)      │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  NodeBalancer   │ (Load Balancer)
│   (SSL/TLS)     │
└─────────────────┘
    │
    ▼
┌─────────────────┐    ┌─────────────────┐
│  Web Server 1   │    │  Web Server 2   │
│   (Docker)      │    │   (Docker)      │
│   Ubuntu 22.04  │    │   Ubuntu 22.04  │
└─────────────────┘    └─────────────────┘
    │                      │
    └──────────────────────┘
               │
               ▼
    ┌─────────────────┐
    │   PostgreSQL    │
    │   Database      │
    │   (Managed)     │
    └─────────────────┘
```

### Components

- **Linode Instances**: Ubuntu 22.04 LTS web servers with Docker
- **Linode Database**: Managed PostgreSQL cluster with backups
- **NodeBalancer**: Load balancer with SSL/TLS termination
- **Firewall Rules**: Security groups for web and database tiers
- **Volume Storage**: Persistent storage for application data
- **DNS Management**: Linode DNS service for domain management
- **Monitoring**: Linode LongView for system monitoring
- **Backup Configuration**: Automated backups for data protection

## 📋 Prerequisites

### Required Tools

1. **Terraform** (>= 1.5.0)
   ```bash
   # Install via Homebrew (macOS)
   brew install terraform
   
   # Or download from https://www.terraform.io/downloads
   ```

2. **Linode CLI** (Optional but recommended)
   ```bash
   pip3 install linode-cli
   ```

3. **Docker** (for building application images)
   ```bash
   # Install Docker Desktop or Docker Engine
   ```

### Required Accounts and Access

1. **Linode Account**
   - Sign up at https://www.linode.com/
   - Generate API token with full access

2. **Domain Registration** (Optional)
   - For custom domain setup
   - DNS management access

3. **SSL Certificate** (Optional)
   - For HTTPS termination
   - Can use Let's Encrypt or commercial CA

## 🚀 Quick Start

### 1. Clone and Navigate

```bash
cd terraform
```

### 2. Set Environment Variables

```bash
# Required: Linode API token
export LINODE_TOKEN="your-linode-api-token"

# Optional: For Object Storage backend
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
```

### 3. Create Configuration

```bash
# Copy example configuration
cp terraform.tfvars.example terraform.tfvars

# Edit configuration with your values
vim terraform.tfvars
```

### 4. Build Docker Image

```bash
# Build your application image
cd ..
docker build -t learning-assistant:latest .

# Tag and push to registry (if using remote registry)
docker tag learning-assistant:latest your-registry/learning-assistant:latest
docker push your-registry/learning-assistant:latest
```

### 5. Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Review planned changes
terraform plan

# Apply configuration
terraform apply
```

### 6. Access Your Application

After deployment, Terraform will output the access URLs and connection information.

## ⚙️ Configuration

### Required Configuration

Edit `terraform.tfvars` and set these required values:

```hcl
# SSH public keys (REQUIRED)
ssh_public_keys = [
  "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC... your-key"
]

# Project configuration
project_name = "learning-assistant"
environment  = "prod"
region       = "us-east"
```

### Optional Configuration

```hcl
# Custom domain
domain_name = "learning-assistant.example.com"

# SSL certificates
ssl_cert = "-----BEGIN CERTIFICATE-----\n..."
ssl_key  = "-----BEGIN PRIVATE KEY-----\n..."

# Scaling configuration
web_server_count = 3
enable_auto_scaling = true
max_web_servers = 5

# Database configuration
database_type = "g6-dedicated-4"
database_cluster_size = 2
```

### Instance Types

| Type | vCPUs | Memory | Storage | Monthly Cost |
|------|-------|--------|---------|--------------|
| g6-nanode-1 | 1 | 1 GB | 25 GB | $5 |
| g6-standard-1 | 1 | 2 GB | 50 GB | $10 |
| g6-standard-2 | 1 | 4 GB | 80 GB | $20 |
| g6-standard-4 | 2 | 8 GB | 160 GB | $40 |
| g6-standard-6 | 4 | 16 GB | 320 GB | $80 |

## 🔒 Security Features

### Network Security

- **Firewall Rules**: Restrictive ingress rules, open egress
- **Private Networking**: Internal communication between instances
- **SSH Access Control**: Configurable IP restrictions

### Application Security

- **Non-root Containers**: Docker containers run as non-root user
- **Security Updates**: Automated system updates
- **Fail2ban**: Intrusion prevention system
- **SSL/TLS**: HTTPS encryption for web traffic

### Database Security

- **Encrypted Storage**: Database encryption at rest
- **SSL Connections**: Encrypted database connections
- **Network Isolation**: Database accessible only from web servers
- **Automated Backups**: Point-in-time recovery capability

## 📊 Monitoring and Logging

### Built-in Monitoring

- **Health Checks**: Application health monitoring via load balancer
- **System Monitoring**: CPU, memory, disk usage tracking
- **Log Aggregation**: Centralized application logging
- **Backup Verification**: Automated backup testing

### Linode LongView

- **Real-time Metrics**: System performance monitoring
- **Historical Data**: Long-term performance trends
- **Alerting**: Custom alerts for resource thresholds

### Log Management

- **Application Logs**: `/opt/learning-assistant/logs/`
- **System Logs**: `/var/log/`
- **Log Rotation**: Automated log cleanup
- **Monitoring Script**: `/usr/local/bin/monitor-app.sh`

## 💾 Backup Strategy

### Automated Backups

1. **Instance Backups**: Daily snapshots of web servers
2. **Database Backups**: Continuous backup with point-in-time recovery
3. **Application Data**: Daily backup of persistent volumes
4. **Configuration Backup**: Infrastructure as Code in Git

### Backup Retention

- **Instance Snapshots**: 7 days
- **Database Backups**: 30 days
- **Application Data**: 7 days
- **Object Storage**: Configurable retention

### Backup Verification

```bash
# Test backup restoration
/usr/local/bin/backup-app.sh

# Verify backup integrity
tar -tzf /opt/backups/learning-assistant-backup-*.tar.gz
```

## 🔧 Operations

### Common Commands

```bash
# Check infrastructure status
terraform output

# Update infrastructure
terraform plan
terraform apply

# Scale web servers
# Edit web_server_count in terraform.tfvars
terraform apply

# View application logs
ssh root@<web-server-ip>
docker logs learning-assistant

# Monitor system resources
ssh root@<web-server-ip>
htop
```

### SSH Access

```bash
# Connect to web servers
ssh root@<web-server-ip>

# View application status
systemctl status learning-assistant.service

# Restart application
systemctl restart learning-assistant.service

# View Docker containers
docker ps
```

### Database Management

```bash
# Connect to database
psql "postgresql://app_user:password@host:port/learning_assistant"

# View database status via Terraform
terraform output database_connection_string
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Health Check Failures

```bash
# Check application status
curl -f http://<web-server-ip>:3000/api/health

# View application logs
docker logs learning-assistant

# Restart application
systemctl restart learning-assistant.service
```

#### 2. Database Connection Issues

```bash
# Test database connectivity
psql "$(terraform output -raw database_connection_string)"

# Check firewall rules
ufw status

# Verify database status
terraform output database_status
```

#### 3. SSL Certificate Problems

```bash
# Check certificate validity
openssl x509 -in certificate.pem -text -noout

# Test SSL connection
openssl s_client -connect your-domain.com:443
```

#### 4. Load Balancer Issues

```bash
# Check NodeBalancer status
curl -I http://<load-balancer-ip>

# View backend server health
# Check via Linode Cloud Manager
```

### Log Locations

- **Initialization**: `/var/log/web-server-init.log`
- **Application**: `/opt/learning-assistant/logs/`
- **System**: `/var/log/syslog`
- **Docker**: `docker logs learning-assistant`
- **Monitoring**: `/var/log/app-monitor.log`

### Recovery Procedures

#### Instance Recovery

1. **Identify Failed Instance**
   ```bash
   terraform output web_server_ips
   ```

2. **Restore from Backup**
   ```bash
   # Via Linode Cloud Manager or CLI
   linode-cli linodes restore <instance-id> <backup-id>
   ```

3. **Update Terraform State**
   ```bash
   terraform refresh
   terraform plan
   ```

#### Database Recovery

1. **Point-in-time Recovery**
   ```bash
   # Via Linode Cloud Manager
   # Select restore point and confirm
   ```

2. **Update Connection Strings**
   ```bash
   # If database endpoint changes
   terraform apply
   ```

## 💰 Cost Optimization

### Cost Breakdown (Estimated Monthly)

| Component | Configuration | Estimated Cost |
|-----------|---------------|----------------|
| Web Servers (2x g6-standard-2) | 2 vCPU, 8 GB RAM | $40 |
| Database (g6-dedicated-2) | 1 vCPU, 4 GB RAM | $60 |
| NodeBalancer | Load balancer | $10 |
| Block Storage (40 GB) | Persistent volumes | $4 |
| Backups | Instance + DB backups | $15 |
| **Total** | **Base configuration** | **~$129/month** |

### Cost Optimization Tips

1. **Right-size Instances**: Start small and scale as needed
2. **Use Object Storage**: For static assets and long-term backups
3. **Monitor Usage**: Regular cost analysis and optimization
4. **Reserved Instances**: Consider annual pricing for savings
5. **Cleanup Resources**: Remove unused volumes and snapshots

## 🚀 Scaling

### Horizontal Scaling

```bash
# Increase web server count
# Edit terraform.tfvars
web_server_count = 5

# Apply changes
terraform apply
```

### Vertical Scaling

```bash
# Upgrade instance types
# Edit terraform.tfvars
web_server_type = "g6-standard-4"

# Apply changes (will recreate instances)
terraform apply
```

### Auto-scaling (Manual)

```bash
# Enable auto-scaling
enable_auto_scaling = true
max_web_servers = 10

# Apply configuration
terraform apply
```

## 🔄 Updates and Maintenance

### Application Updates

1. **Build New Image**
   ```bash
   docker build -t learning-assistant:v2.0.0 .
   docker push your-registry/learning-assistant:v2.0.0
   ```

2. **Update Configuration**
   ```bash
   # Edit terraform.tfvars
   docker_tag = "v2.0.0"
   ```

3. **Apply Changes**
   ```bash
   terraform apply
   ```

### Infrastructure Updates

1. **Review Changes**
   ```bash
   terraform plan
   ```

2. **Apply in Stages**
   ```bash
   # Test in development first
   terraform apply -target=module.development
   
   # Then apply to production
   terraform apply
   ```

### Security Updates

- **Automatic Updates**: Enabled by default for security patches
- **Manual Updates**: SSH into instances for major updates
- **Container Updates**: Rebuild Docker images regularly

## 🏷️ Resource Tagging

All resources are automatically tagged with:

- `environment`: Environment name (dev/staging/prod)
- `project`: Project name (learning-assistant)
- `managed-by`: terraform
- `terraform-workspace`: Current workspace

Additional custom tags can be added via the `additional_tags` variable.

## 🔐 Security Best Practices

### Access Control

1. **SSH Keys Only**: Password authentication disabled
2. **Restricted Access**: Limit SSH access to specific IPs
3. **Least Privilege**: Minimal required permissions
4. **Regular Audits**: Review access logs and permissions

### Network Security

1. **Firewall Rules**: Restrictive default-deny policy
2. **Private Networking**: Internal communication only
3. **SSL/TLS**: Encrypt all web traffic
4. **Database Security**: Encrypted connections and storage

### Operational Security

1. **Regular Updates**: Keep systems and containers updated
2. **Backup Testing**: Verify backup integrity regularly
3. **Monitoring**: Monitor for security events
4. **Incident Response**: Have procedures for security incidents

## 📞 Support and Maintenance

### Documentation

- **Infrastructure**: This README and inline comments
- **Application**: Application-specific documentation
- **Runbooks**: Operational procedures and troubleshooting

### Monitoring Contacts

Set up alerts for:
- **System Health**: CPU, memory, disk usage
- **Application Health**: HTTP status and response times
- **Security Events**: Failed login attempts, firewall blocks
- **Backup Status**: Backup success/failure notifications

## 📝 Change Log

### Version 1.0.0 (Initial Release)

- Complete Terraform infrastructure for Linode
- PostgreSQL database with backups
- Load balancer with SSL support
- Auto-scaling web servers
- Comprehensive monitoring and logging
- Security hardening and firewall rules
- Automated backup and recovery procedures

---

## 📄 License

This Terraform configuration is part of the Learning Assistant project. Please refer to the main project license for usage terms.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Test changes in development environment
4. Submit a pull request with detailed description

---

For additional support or questions, please refer to the main project documentation or open an issue in the project repository.