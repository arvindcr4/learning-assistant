# Prerequisites Guide

This guide covers all the prerequisites needed to deploy and manage the Learning Assistant infrastructure using Terraform.

## 🎯 System Requirements

### Operating System Support
- ✅ **Linux** (Ubuntu 20.04+, CentOS 8+, Amazon Linux 2)
- ✅ **macOS** (10.15+)
- ✅ **Windows** (Windows 10 with WSL2)

### Hardware Requirements
- **Minimum**: 4GB RAM, 2 CPU cores, 10GB disk space
- **Recommended**: 8GB RAM, 4 CPU cores, 20GB disk space

## 🛠️ Required Tools

### 1. Terraform Installation

#### Linux/macOS (Using tfenv - Recommended)
```bash
# Install tfenv (Terraform version manager)
git clone https://github.com/tfutils/tfenv.git ~/.tfenv
echo 'export PATH="$HOME/.tfenv/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Install latest Terraform
tfenv install latest
tfenv use latest

# Verify installation
terraform version
```

#### Alternative: Direct Installation
```bash
# Download and install Terraform
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/
terraform version
```

#### Windows (Using Chocolatey)
```powershell
# Install Chocolatey first, then:
choco install terraform
terraform version
```

### 2. Cloud Provider CLIs

#### AWS CLI
```bash
# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS CLI
aws configure
# Enter: Access Key ID, Secret Access Key, Default Region, Output Format
```

#### Google Cloud SDK
```bash
# Install Google Cloud SDK
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Initialize and authenticate
gcloud init
gcloud auth login
gcloud auth application-default login
```

#### Azure CLI
```bash
# Install Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Login to Azure
az login
```

#### DigitalOcean CLI (doctl)
```bash
# Install doctl
wget https://github.com/digitalocean/doctl/releases/download/v1.94.0/doctl-1.94.0-linux-amd64.tar.gz
tar xf doctl-1.94.0-linux-amd64.tar.gz
sudo mv doctl /usr/local/bin

# Authenticate
doctl auth init
```

### 3. Additional Tools

#### Git
```bash
# Install Git
sudo apt-get install git  # Ubuntu/Debian
sudo yum install git       # CentOS/RHEL
brew install git          # macOS

# Configure Git
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

#### jq (JSON processor)
```bash
# Install jq
sudo apt-get install jq   # Ubuntu/Debian
sudo yum install jq       # CentOS/RHEL
brew install jq          # macOS
```

#### curl/wget
```bash
# Usually pre-installed, but if needed:
sudo apt-get install curl wget
```

## 🔑 Authentication Setup

### AWS Authentication

#### Method 1: AWS CLI Configuration
```bash
aws configure
# AWS Access Key ID: YOUR_ACCESS_KEY
# AWS Secret Access Key: YOUR_SECRET_KEY
# Default region name: us-east-1
# Default output format: json
```

#### Method 2: Environment Variables
```bash
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_DEFAULT_REGION="us-east-1"
```

#### Method 3: IAM Roles (for EC2 instances)
```bash
# Attach IAM role to EC2 instance with required policies
```

### GCP Authentication

#### Service Account Key
```bash
# Create service account key
gcloud iam service-accounts create terraform-sa
gcloud projects add-iam-policy-binding PROJECT_ID \
    --member="serviceAccount:terraform-sa@PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/editor"

# Download key file
gcloud iam service-accounts keys create key.json \
    --iam-account=terraform-sa@PROJECT_ID.iam.gserviceaccount.com

# Set environment variable
export GOOGLE_APPLICATION_CREDENTIALS="path/to/key.json"
```

### Azure Authentication

#### Service Principal
```bash
# Create service principal
az ad sp create-for-rbac --name terraform-sp --role Contributor

# Set environment variables
export ARM_CLIENT_ID="your-client-id"
export ARM_CLIENT_SECRET="your-client-secret"
export ARM_SUBSCRIPTION_ID="your-subscription-id"
export ARM_TENANT_ID="your-tenant-id"
```

### DigitalOcean Authentication

```bash
# Generate API token in DigitalOcean dashboard
export DIGITALOCEAN_TOKEN="your-api-token"
```

## 📁 Project Structure Setup

### 1. Create Project Directory
```bash
mkdir learning-assistant-infra
cd learning-assistant-infra
git init
```

### 2. Set Up Directory Structure
```bash
# Create standard Terraform structure
mkdir -p {environments,modules,scripts,docs}
mkdir -p modules/{compute,database,network,security}

# Create environment-specific directories
mkdir -p environments/{development,staging,production}
```

### 3. Initialize Git Repository
```bash
# Create .gitignore
cat > .gitignore << EOF
# Terraform
*.tfstate
*.tfstate.*
*.tfvars
.terraform/
.terraform.lock.hcl
crash.log
override.tf
override.tf.json

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
EOF

git add .gitignore
git commit -m "Initial commit with .gitignore"
```

## 🔒 Security Prerequisites

### 1. SSH Key Setup
```bash
# Generate SSH key pair
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"

# Add to SSH agent
ssh-add ~/.ssh/id_rsa

# Copy public key (for server access)
cat ~/.ssh/id_rsa.pub
```

### 2. Secret Management
```bash
# Install password manager or use cloud secret management
# Examples:
# - AWS Secrets Manager
# - GCP Secret Manager
# - Azure Key Vault
# - HashiCorp Vault
```

### 3. VPN/Network Access
- Ensure access to target cloud environments
- Configure VPN if required for corporate networks
- Set up bastion hosts for secure access

## 🌐 Network Prerequisites

### 1. Domain Name (Optional)
- Purchase domain name from registrar
- Configure DNS settings
- Set up SSL certificates

### 2. Network Planning
- Plan IP address ranges
- Define subnet configurations
- Plan security group rules

## 📊 Monitoring Prerequisites

### 1. Monitoring Tools
```bash
# Install monitoring tools (optional)
# Examples:
# - Prometheus
# - Grafana
# - Datadog agent
# - New Relic agent
```

### 2. Log Management
- Set up log aggregation
- Configure log retention policies
- Plan log storage and analysis

## ✅ Verification Checklist

Before proceeding with deployment, verify:

### Tools Installation
- [ ] Terraform installed and working (`terraform version`)
- [ ] Cloud provider CLI installed and configured
- [ ] Git installed and configured
- [ ] jq installed for JSON processing

### Authentication
- [ ] Cloud provider credentials configured
- [ ] API tokens and keys available
- [ ] Service accounts created with proper permissions
- [ ] SSH keys generated and configured

### Project Setup
- [ ] Project directory created
- [ ] Git repository initialized
- [ ] Directory structure set up
- [ ] .gitignore file created

### Security
- [ ] SSH keys set up
- [ ] Secret management strategy defined
- [ ] Network access confirmed
- [ ] VPN configured if required

### Permissions
- [ ] IAM roles and policies configured
- [ ] Service accounts have required permissions
- [ ] API limits and quotas checked
- [ ] Billing alerts configured

## 🔧 Troubleshooting Common Issues

### Terraform Installation Issues

**Issue: Command not found**
```bash
# Check PATH
echo $PATH
# Add Terraform to PATH
export PATH=$PATH:/usr/local/bin
```

**Issue: Permission denied**
```bash
# Make terraform executable
chmod +x terraform
```

### Cloud Provider Authentication Issues

**Issue: AWS credentials not found**
```bash
# Check AWS configuration
aws sts get-caller-identity
# Reconfigure if needed
aws configure
```

**Issue: GCP authentication failed**
```bash
# Check current account
gcloud auth list
# Re-authenticate
gcloud auth login
```

### Network Connectivity Issues

**Issue: Cannot reach cloud APIs**
```bash
# Test connectivity
curl -I https://aws.amazon.com
# Check firewall/proxy settings
```

## 📚 Next Steps

Once all prerequisites are met:

1. **Review Configuration**: Check all tools are properly configured
2. **Test Access**: Verify you can access cloud resources
3. **Proceed to Quick Start**: Follow the [Quick Start Guide](./quick-start.md)
4. **Read Architecture**: Review [System Architecture](../architecture/system-overview.md)

## 🆘 Getting Help

If you encounter issues:
1. Check the [Troubleshooting Guide](../troubleshooting/common-issues.md)
2. Review cloud provider documentation
3. Check Terraform documentation
4. Create an issue in the project repository

---

**🎉 Prerequisites Complete!** You're ready to deploy your infrastructure.

**Next**: Follow the [Quick Start Guide](./quick-start.md) to deploy your first infrastructure.