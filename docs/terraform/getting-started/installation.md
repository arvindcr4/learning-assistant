# Installation Guide

This comprehensive guide walks you through installing and configuring all the tools needed for Learning Assistant infrastructure management.

## 🎯 Installation Overview

This guide covers:
- Terraform installation and configuration
- Cloud provider CLI tools
- Supporting tools and utilities
- Environment configuration
- Verification and testing

## 🛠️ Core Tools Installation

### 1. Terraform Installation

#### Using tfenv (Recommended)

tfenv allows you to easily manage multiple Terraform versions:

```bash
# Install tfenv
git clone https://github.com/tfutils/tfenv.git ~/.tfenv

# Add to PATH (choose your shell)
# For bash
echo 'export PATH="$HOME/.tfenv/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# For zsh
echo 'export PATH="$HOME/.tfenv/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Install latest Terraform
tfenv install latest
tfenv use latest

# Verify installation
terraform version
```

#### Direct Installation

##### Linux
```bash
# Download Terraform
TERRAFORM_VERSION="1.6.0"
wget https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip

# Extract and install
unzip terraform_${TERRAFORM_VERSION}_linux_amd64.zip
sudo mv terraform /usr/local/bin/
sudo chmod +x /usr/local/bin/terraform

# Verify installation
terraform version
```

##### macOS
```bash
# Using Homebrew (recommended)
brew install terraform

# Or download directly
TERRAFORM_VERSION="1.6.0"
wget https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_darwin_amd64.zip
unzip terraform_${TERRAFORM_VERSION}_darwin_amd64.zip
sudo mv terraform /usr/local/bin/
```

##### Windows
```powershell
# Using Chocolatey
choco install terraform

# Using Scoop
scoop install terraform

# Or download from HashiCorp website and add to PATH
```

### 2. Cloud Provider CLI Tools

#### AWS CLI Installation

##### Linux/macOS
```bash
# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# For macOS, use:
# curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
# sudo installer -pkg AWSCLIV2.pkg -target /

# Verify installation
aws --version
```

##### Windows
```powershell
# Download and install AWS CLI MSI
# Or using Chocolatey
choco install awscli
```

#### Google Cloud SDK Installation

##### Linux/macOS
```bash
# Add Google Cloud SDK repository
curl https://sdk.cloud.google.com | bash

# Restart shell
exec -l $SHELL

# Initialize SDK
gcloud init

# Verify installation
gcloud --version
```

##### Windows
```powershell
# Download Google Cloud SDK installer
# Or using Chocolatey
choco install gcloudsdk
```

#### Azure CLI Installation

##### Linux
```bash
# Install Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Verify installation
az --version
```

##### macOS
```bash
# Using Homebrew
brew install azure-cli
```

##### Windows
```powershell
# Using Chocolatey
choco install azure-cli
```

#### DigitalOcean CLI Installation

```bash
# Linux/macOS
wget https://github.com/digitalocean/doctl/releases/download/v1.94.0/doctl-1.94.0-linux-amd64.tar.gz
tar xf doctl-1.94.0-linux-amd64.tar.gz
sudo mv doctl /usr/local/bin

# macOS with Homebrew
brew install doctl

# Verify installation
doctl version
```

### 3. Supporting Tools

#### Git Installation

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install git

# CentOS/RHEL
sudo yum install git

# macOS
brew install git

# Windows
choco install git
```

#### jq (JSON Processor)

```bash
# Ubuntu/Debian
sudo apt-get install jq

# CentOS/RHEL
sudo yum install jq

# macOS
brew install jq

# Windows
choco install jq
```

#### curl and wget

```bash
# Usually pre-installed, but if needed:
# Ubuntu/Debian
sudo apt-get install curl wget

# CentOS/RHEL
sudo yum install curl wget

# macOS
brew install curl wget
```

#### Docker (Optional)

```bash
# Ubuntu/Debian
sudo apt-get install docker.io
sudo systemctl start docker
sudo systemctl enable docker

# macOS
brew install docker

# Add user to docker group
sudo usermod -aG docker $USER
```

## 🔧 Configuration Setup

### 1. Terraform Configuration

#### Create Terraform Configuration Directory

```bash
mkdir -p ~/.terraform.d/plugin-cache
export TF_PLUGIN_CACHE_DIR="$HOME/.terraform.d/plugin-cache"
```

#### Configure Terraform CLI

Create `~/.terraformrc`:

```hcl
# ~/.terraformrc
plugin_cache_dir   = "$HOME/.terraform.d/plugin-cache"
disable_checkpoint = true

provider_installation {
  filesystem_mirror {
    path    = "/usr/share/terraform/providers"
    include = ["registry.terraform.io/*/*"]
  }
  direct {
    exclude = ["registry.terraform.io/*/*"]
  }
}
```

### 2. Cloud Provider Configuration

#### AWS Configuration

```bash
# Interactive configuration
aws configure

# Manual configuration
mkdir -p ~/.aws
cat > ~/.aws/config << EOF
[default]
region = us-east-1
output = json

[profile production]
region = us-west-2
output = json
EOF

cat > ~/.aws/credentials << EOF
[default]
aws_access_key_id = YOUR_ACCESS_KEY
aws_secret_access_key = YOUR_SECRET_KEY

[production]
aws_access_key_id = YOUR_PROD_ACCESS_KEY
aws_secret_access_key = YOUR_PROD_SECRET_KEY
EOF
```

#### GCP Configuration

```bash
# Initialize and authenticate
gcloud init
gcloud auth login

# Set up application default credentials
gcloud auth application-default login

# Configure project
gcloud config set project YOUR_PROJECT_ID
```

#### Azure Configuration

```bash
# Login to Azure
az login

# Set default subscription
az account set --subscription "YOUR_SUBSCRIPTION_ID"

# Create service principal for Terraform
az ad sp create-for-rbac --name terraform-sp --role Contributor --scopes /subscriptions/YOUR_SUBSCRIPTION_ID
```

#### DigitalOcean Configuration

```bash
# Authenticate with API token
doctl auth init

# Test connection
doctl account get
```

### 3. Environment Variables Setup

Create environment configuration file:

```bash
# Create .env file
cat > ~/.terraform_env << EOF
# AWS
export AWS_DEFAULT_REGION=us-east-1
export AWS_PROFILE=default

# GCP
export GOOGLE_APPLICATION_CREDENTIALS=~/.config/gcloud/application_default_credentials.json
export GOOGLE_PROJECT=your-project-id

# Azure
export ARM_SUBSCRIPTION_ID=your-subscription-id
export ARM_TENANT_ID=your-tenant-id
export ARM_CLIENT_ID=your-client-id
export ARM_CLIENT_SECRET=your-client-secret

# DigitalOcean
export DIGITALOCEAN_TOKEN=your-api-token

# Terraform
export TF_PLUGIN_CACHE_DIR=~/.terraform.d/plugin-cache
export TF_LOG=INFO
EOF

# Source environment variables
source ~/.terraform_env

# Add to shell profile
echo 'source ~/.terraform_env' >> ~/.bashrc
```

## 📁 Project Structure Setup

### 1. Create Project Directory

```bash
# Create main project directory
mkdir learning-assistant-terraform
cd learning-assistant-terraform

# Initialize Git repository
git init

# Create directory structure
mkdir -p {environments,modules,scripts,docs,tests}
mkdir -p modules/{compute,database,network,security,monitoring}
mkdir -p environments/{development,staging,production}
mkdir -p scripts/{deployment,backup,maintenance}
```

### 2. Create Base Configuration Files

#### .gitignore

```bash
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
*_override.tf
*_override.tf.json

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db
ehthumbs.db
Desktop.ini

# Logs
*.log
logs/

# Runtime
*.pid
*.seed
*.pid.lock

# Environment
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Certificates
*.pem
*.key
*.crt
*.p12
*.pfx
EOF
```

#### Makefile

```bash
cat > Makefile << EOF
.PHONY: init plan apply destroy validate fmt clean help

# Default environment
ENV ?= development

# Terraform commands
init:
	terraform init

plan:
	terraform plan -var-file="environments/\$(ENV).tfvars"

apply:
	terraform apply -var-file="environments/\$(ENV).tfvars"

destroy:
	terraform destroy -var-file="environments/\$(ENV).tfvars"

validate:
	terraform validate
	terraform fmt -check

fmt:
	terraform fmt -recursive

clean:
	rm -rf .terraform
	rm -f .terraform.lock.hcl
	rm -f terraform.tfstate*
	rm -f *.tfplan

help:
	@echo "Usage: make [target] [ENV=environment]"
	@echo ""
	@echo "Targets:"
	@echo "  init     - Initialize Terraform"
	@echo "  plan     - Create execution plan"
	@echo "  apply    - Apply changes"
	@echo "  destroy  - Destroy infrastructure"
	@echo "  validate - Validate configuration"
	@echo "  fmt      - Format code"
	@echo "  clean    - Clean temporary files"
	@echo "  help     - Show this help"
	@echo ""
	@echo "Environments: development, staging, production"
EOF
```

### 3. Create Environment Templates

```bash
# Development environment
cat > environments/development.tfvars << EOF
# Development Environment Configuration
environment = "development"
project_name = "learning-assistant"

# Instance sizes (small for development)
app_instance_type = "t3.micro"
db_instance_class = "db.t3.micro"

# Scaling
min_capacity = 1
max_capacity = 2
desired_capacity = 1

# Storage
db_allocated_storage = 20
db_storage_type = "gp2"

# Features
enable_monitoring = true
enable_backups = false
enable_ssl = false
multi_az = false
EOF

# Production environment template
cat > environments/production.tfvars.example << EOF
# Production Environment Configuration
environment = "production"
project_name = "learning-assistant"

# Instance sizes (appropriate for production)
app_instance_type = "t3.medium"
db_instance_class = "db.t3.medium"

# Scaling
min_capacity = 2
max_capacity = 10
desired_capacity = 3

# Storage
db_allocated_storage = 100
db_storage_type = "gp3"

# Features
enable_monitoring = true
enable_backups = true
enable_ssl = true
multi_az = true

# Security
enable_deletion_protection = true
backup_retention_period = 30
EOF
```

## ✅ Verification and Testing

### 1. Verify Tool Installation

```bash
# Check all tools
echo "=== Tool Versions ==="
terraform version
aws --version
gcloud --version
az --version
doctl version
git --version
jq --version
docker --version
```

### 2. Test Cloud Provider Authentication

```bash
# Test AWS
aws sts get-caller-identity

# Test GCP
gcloud auth list
gcloud config list

# Test Azure
az account show

# Test DigitalOcean
doctl account get
```

### 3. Initialize Sample Terraform Configuration

```bash
# Create a simple test configuration
cat > test.tf << EOF
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

data "aws_caller_identity" "current" {}

output "account_id" {
  value = data.aws_caller_identity.current.account_id
}
EOF

# Test Terraform
terraform init
terraform plan
terraform apply -auto-approve
terraform destroy -auto-approve

# Clean up
rm test.tf
rm -rf .terraform*
```

## 🚀 Post-Installation Steps

### 1. Set Up Shell Aliases

```bash
# Add to ~/.bashrc or ~/.zshrc
cat >> ~/.bashrc << EOF
# Terraform aliases
alias tf='terraform'
alias tfi='terraform init'
alias tfp='terraform plan'
alias tfa='terraform apply'
alias tfd='terraform destroy'
alias tfv='terraform validate'
alias tff='terraform fmt'
alias tfs='terraform state'
alias tfo='terraform output'

# Environment shortcuts
alias tf-dev='terraform workspace select development'
alias tf-prod='terraform workspace select production'
EOF

source ~/.bashrc
```

### 2. Configure IDE/Editor

#### VS Code Extensions

```json
{
  "recommendations": [
    "hashicorp.terraform",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-azuretools.vscode-azureterraform"
  ]
}
```

#### Vim Configuration

```bash
# Add to ~/.vimrc
cat >> ~/.vimrc << EOF
" Terraform
autocmd BufRead,BufNewFile *.tf set filetype=terraform
autocmd BufRead,BufNewFile *.tfvars set filetype=terraform
EOF
```

### 3. Set Up Pre-commit Hooks

```bash
# Install pre-commit
pip install pre-commit

# Create .pre-commit-config.yaml
cat > .pre-commit-config.yaml << EOF
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.4.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files

  - repo: https://github.com/antonbabenko/pre-commit-terraform
    rev: v1.81.0
    hooks:
      - id: terraform_fmt
      - id: terraform_validate
      - id: terraform_docs
      - id: terraform_tflint
EOF

# Install hooks
pre-commit install
```

## 🔧 Troubleshooting

### Common Installation Issues

#### Terraform Not Found
```bash
# Check PATH
echo $PATH
# Add to PATH
export PATH=$PATH:/usr/local/bin
```

#### Permission Denied
```bash
# Make executable
chmod +x /usr/local/bin/terraform
```

#### Cloud Provider Authentication
```bash
# Clear cached credentials
rm -rf ~/.aws ~/.config/gcloud
# Reconfigure
aws configure
gcloud auth login
```

### Performance Optimization

```bash
# Enable parallel downloads
export TF_PLUGIN_CACHE_DIR=~/.terraform.d/plugin-cache
mkdir -p $TF_PLUGIN_CACHE_DIR

# Increase parallelism
export TF_CLI_ARGS="-parallelism=20"
```

## 📚 Next Steps

After successful installation:

1. **Complete Setup**: Review all configurations
2. **Run Tests**: Verify everything works
3. **Follow Quick Start**: Deploy your first infrastructure
4. **Read Documentation**: Understand the system architecture

## 🔗 Additional Resources

- [Terraform Documentation](https://terraform.io/docs)
- [AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws)
- [GCP Provider Documentation](https://registry.terraform.io/providers/hashicorp/google)
- [Azure Provider Documentation](https://registry.terraform.io/providers/hashicorp/azurerm)

---

**🎉 Installation Complete!** You're ready to deploy infrastructure.

**Next**: Follow the [Quick Start Guide](./quick-start.md) to deploy your first infrastructure stack.