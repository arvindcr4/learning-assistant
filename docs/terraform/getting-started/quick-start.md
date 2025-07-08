# Quick Start Guide

Get your Learning Assistant infrastructure up and running in minutes with this comprehensive quick start guide.

## 🎯 Overview

This guide will walk you through:
- Setting up your development environment
- Deploying basic infrastructure
- Verifying your deployment
- Accessing your application

**Estimated Time**: 15-30 minutes

## 📋 Prerequisites

Before starting, ensure you have:
- [x] Terraform installed (version >= 1.0)
- [x] Cloud provider CLI configured
- [x] Git repository access
- [x] Required environment variables set

> 💡 **Tip**: See [Prerequisites Guide](./prerequisites.md) for detailed setup instructions.

## 🚀 Quick Deploy

### Step 1: Clone and Navigate

```bash
# Clone the repository
git clone <repository-url>
cd learning-assistant

# Navigate to terraform directory
cd terraform
```

### Step 2: Initialize Terraform

```bash
# Initialize Terraform
terraform init

# Validate configuration
terraform validate

# Check formatting
terraform fmt -check
```

### Step 3: Configure Variables

Create your `terraform.tfvars` file:

```hcl
# terraform.tfvars
project_name = "learning-assistant"
environment  = "development"
region      = "us-east-1"

# Database configuration
db_instance_class = "db.t3.micro"
db_allocated_storage = 20

# Application configuration
app_instance_type = "t3.micro"
app_desired_capacity = 1

# Domain configuration
domain_name = "your-domain.com"
```

### Step 4: Plan and Deploy

```bash
# Create execution plan
terraform plan -out=tfplan

# Apply the plan
terraform apply tfplan
```

### Step 5: Verify Deployment

```bash
# Check outputs
terraform output

# Test application endpoint
curl -f https://$(terraform output -raw app_url)/health
```

## 🌐 Cloud Provider Specific Instructions

### AWS Deployment

```bash
# Configure AWS CLI
aws configure

# Set additional AWS-specific variables
export TF_VAR_aws_region="us-east-1"
export TF_VAR_aws_profile="default"

# Deploy
terraform init
terraform plan -var-file="environments/aws.tfvars"
terraform apply
```

### GCP Deployment

```bash
# Authenticate with GCP
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Set GCP-specific variables
export TF_VAR_gcp_project="your-project-id"
export TF_VAR_gcp_region="us-central1"

# Deploy
terraform init
terraform plan -var-file="environments/gcp.tfvars"
terraform apply
```

### Azure Deployment

```bash
# Login to Azure
az login

# Set Azure-specific variables
export TF_VAR_azure_subscription_id="your-subscription-id"
export TF_VAR_azure_resource_group="learning-assistant-rg"

# Deploy
terraform init
terraform plan -var-file="environments/azure.tfvars"
terraform apply
```

### DigitalOcean Deployment

```bash
# Set DigitalOcean token
export DIGITALOCEAN_TOKEN="your-do-token"

# Deploy
terraform init
terraform plan -var-file="environments/digitalocean.tfvars"
terraform apply
```

## 📊 Post-Deployment Verification

### 1. Check Infrastructure Status

```bash
# Verify all resources are created
terraform state list

# Check resource details
terraform show
```

### 2. Application Health Check

```bash
# Get application URL
APP_URL=$(terraform output -raw app_url)

# Test health endpoint
curl -f $APP_URL/api/health

# Test main application
curl -f $APP_URL
```

### 3. Database Connectivity

```bash
# Get database endpoint
DB_HOST=$(terraform output -raw db_endpoint)

# Test connection (replace with actual credentials)
psql -h $DB_HOST -U postgres -d learning_assistant -c "SELECT version();"
```

### 4. Monitoring Setup

```bash
# Check monitoring dashboard
MONITORING_URL=$(terraform output -raw monitoring_url)
echo "Monitoring Dashboard: $MONITORING_URL"

# Verify metrics collection
curl -f $MONITORING_URL/metrics
```

## 🔧 Common Configuration Options

### Basic Configuration

```hcl
# terraform.tfvars
project_name = "learning-assistant"
environment  = "development"

# Size the infrastructure for your needs
app_instance_type = "t3.micro"    # t3.small, t3.medium
db_instance_class = "db.t3.micro" # db.t3.small, db.t3.medium

# Enable/disable features
enable_monitoring = true
enable_ssl = true
enable_backups = true
```

### Advanced Configuration

```hcl
# Advanced options
multi_az = true
backup_retention_period = 7
auto_scaling_enabled = true
ssl_certificate_arn = "arn:aws:acm:..."

# Security settings
enable_deletion_protection = true
enable_encryption = true
allowed_cidr_blocks = ["10.0.0.0/8"]
```

## 🎯 Next Steps

### For Development
1. **Customize Configuration**: Review and modify variables in `terraform.tfvars`
2. **Set Up CI/CD**: Configure automated deployments
3. **Add Monitoring**: Set up alerts and dashboards
4. **Configure Backups**: Set up automated backup schedules

### For Production
1. **Review Security**: Follow [Security Hardening Guide](../tutorials/security-hardening.md)
2. **Performance Tuning**: Optimize for your workload
3. **Cost Optimization**: Review and optimize costs
4. **Disaster Recovery**: Set up DR procedures

## 🆘 Troubleshooting Quick Fixes

### Common Issues

**Issue: Terraform Init Fails**
```bash
# Clear cache and retry
rm -rf .terraform .terraform.lock.hcl
terraform init
```

**Issue: Resource Already Exists**
```bash
# Import existing resource
terraform import aws_instance.app i-1234567890abcdef0
```

**Issue: Permission Denied**
```bash
# Check IAM permissions
aws sts get-caller-identity
```

**Issue: DNS Resolution**
```bash
# Wait for DNS propagation
dig +short your-domain.com
```

## 🔗 Additional Resources

- [Detailed Installation Guide](./installation.md)
- [First Deployment Tutorial](./first-deployment.md)
- [Architecture Overview](../architecture/system-overview.md)
- [Troubleshooting Guide](../troubleshooting/common-issues.md)

## 💡 Tips for Success

1. **Start Small**: Begin with minimal configuration
2. **Use Version Control**: Track all changes in Git
3. **Test Changes**: Always run `terraform plan` first
4. **Monitor Resources**: Watch for unexpected costs
5. **Document Changes**: Keep notes of customizations

---

**🎉 Congratulations!** You've successfully deployed your Learning Assistant infrastructure. 

**Next**: Explore the [Architecture Documentation](../architecture/system-overview.md) to understand your deployment better.