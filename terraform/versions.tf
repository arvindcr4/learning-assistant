# =============================================================================
# LEARNING ASSISTANT - TERRAFORM VERSION REQUIREMENTS
# =============================================================================
# This file defines the required Terraform version and provider versions
# =============================================================================

terraform {
  # Minimum Terraform version required
  required_version = ">= 1.5.0"
  
  # Required providers and their versions
  required_providers {
    # Linode provider for managing Linode resources
    linode = {
      source  = "linode/linode"
      version = "~> 2.0"
    }
    
    # Random provider for generating secure passwords
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    
    # Time provider for time-based operations
    time = {
      source  = "hashicorp/time"
      version = "~> 0.9"
    }
    
    # TLS provider for certificate management
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    
    # Template provider for file templating
    template = {
      source  = "hashicorp/template"
      version = "~> 2.2"
    }
  }
  
  # Optional: Configure remote state backend
  # Uncomment and configure one of the following backends for production use
  
  # S3-compatible backend (Linode Object Storage)
  # backend "s3" {
  #   endpoint                    = "https://us-east-1.linodeobjects.com"
  #   region                      = "us-east-1"
  #   bucket                      = "your-terraform-state-bucket"
  #   key                         = "learning-assistant/terraform.tfstate"
  #   skip_credentials_validation = true
  #   skip_region_validation      = true
  #   skip_metadata_api_check     = true
  #   force_path_style           = true
  # }
  
  # Terraform Cloud backend
  # backend "remote" {
  #   hostname     = "app.terraform.io"
  #   organization = "your-organization"
  #   
  #   workspaces {
  #     name = "learning-assistant-prod"
  #   }
  # }
  
  # HTTP backend (for custom solutions)
  # backend "http" {
  #   address        = "https://your-backend-url/terraform.tfstate"
  #   lock_address   = "https://your-backend-url/terraform.tfstate.lock"
  #   unlock_address = "https://your-backend-url/terraform.tfstate.unlock"
  # }
  
  # PostgreSQL backend (using your own database)
  # backend "pg" {
  #   conn_str = "postgres://user:password@host:port/dbname?sslmode=require"
  # }
  
  # Azure backend (if using Azure)
  # backend "azurerm" {
  #   resource_group_name  = "your-resource-group"
  #   storage_account_name = "your-storage-account"
  #   container_name       = "tfstate"
  #   key                  = "learning-assistant.tfstate"
  # }
  
  # Google Cloud backend (if using GCP)
  # backend "gcs" {
  #   bucket = "your-terraform-state-bucket"
  #   prefix = "learning-assistant"
  # }
  
  # Local backend (default - not recommended for production)
  # backend "local" {
  #   path = "terraform.tfstate"
  # }
}

# =============================================================================
# PROVIDER CONFIGURATION
# =============================================================================

# Configure the Linode provider
provider "linode" {
  # API token should be set via environment variable: LINODE_TOKEN
  # token = var.linode_token  # Not recommended - use environment variable
  
  # Optional: Set API URL (useful for testing)
  # url = "https://api.linode.com/v4"
  
  # Optional: Set API version
  # api_version = "v4"
  
  # Optional: Set user agent
  # ua_prefix = "terraform-learning-assistant"
}

# Configure the Random provider
provider "random" {
  # No configuration needed for random provider
}

# Configure the Time provider
provider "time" {
  # No configuration needed for time provider
}

# Configure the TLS provider
provider "tls" {
  # No configuration needed for TLS provider
}

# Configure the Template provider
provider "template" {
  # No configuration needed for template provider
}

# =============================================================================
# PROVIDER VERSION CONSTRAINTS EXPLANATION
# =============================================================================

# Version constraint operators:
# = (or no operator): Allows only one exact version
# !=: Excludes an exact version
# >: Greater than
# <: Less than
# >=: Greater than or equal to
# <=: Less than or equal to
# ~>: Pessimistic constraint (allows rightmost version component to increment)

# Examples:
# version = "2.0.0"     # Exactly version 2.0.0
# version = ">=2.0.0"   # Version 2.0.0 or higher
# version = "~>2.0"     # Version 2.0 or higher, but less than 3.0
# version = "~>2.0.0"   # Version 2.0.0 or higher, but less than 2.1.0

# =============================================================================
# BACKEND CONFIGURATION NOTES
# =============================================================================

# For production deployments, it's highly recommended to use a remote backend
# for storing Terraform state. This provides:
# 
# 1. State Locking: Prevents concurrent modifications
# 2. State Sharing: Allows team collaboration
# 3. State Backup: Protects against local file loss
# 4. Encryption: Keeps sensitive data secure
# 5. Versioning: Tracks state changes over time

# To configure a remote backend:
# 1. Uncomment one of the backend configurations above
# 2. Replace placeholder values with your actual configuration
# 3. Run `terraform init` to migrate existing state (if any)

# For Linode Object Storage backend:
# 1. Create a bucket in Linode Object Storage
# 2. Generate access keys for the bucket
# 3. Configure the S3 backend with Linode Object Storage endpoints
# 4. Set environment variables for access credentials:
#    export AWS_ACCESS_KEY_ID="your-access-key"
#    export AWS_SECRET_ACCESS_KEY="your-secret-key"

# =============================================================================
# ENVIRONMENT VARIABLES
# =============================================================================

# Required environment variables for deployment:
# 
# LINODE_TOKEN: Your Linode API token
#   - Generate from: https://cloud.linode.com/profile/tokens
#   - Should have full access to manage resources
#   - Keep secure and never commit to version control
#
# For S3 backend (Linode Object Storage):
# AWS_ACCESS_KEY_ID: Object Storage access key
# AWS_SECRET_ACCESS_KEY: Object Storage secret key
#
# For other backends, refer to their specific documentation

# Example environment variable setup:
# export LINODE_TOKEN="your-linode-api-token"
# export AWS_ACCESS_KEY_ID="your-object-storage-access-key"
# export AWS_SECRET_ACCESS_KEY="your-object-storage-secret-key"

# =============================================================================
# TERRAFORM COMMANDS
# =============================================================================

# Basic Terraform workflow:
# 1. terraform init      # Initialize working directory
# 2. terraform validate  # Validate configuration syntax
# 3. terraform plan      # Preview changes
# 4. terraform apply     # Apply changes
# 5. terraform destroy   # Destroy infrastructure (when needed)

# Advanced commands:
# terraform fmt          # Format configuration files
# terraform show          # Show current state
# terraform state list   # List resources in state
# terraform output        # Show output values
# terraform refresh       # Refresh state from real infrastructure
# terraform import        # Import existing resources
# terraform taint         # Mark resource for recreation
# terraform untaint       # Remove taint from resource

# =============================================================================
# UPGRADE NOTES
# =============================================================================

# When upgrading Terraform or provider versions:
# 1. Review changelog for breaking changes
# 2. Test in a development environment first
# 3. Update version constraints gradually
# 4. Run `terraform init -upgrade` to download new provider versions
# 5. Run `terraform plan` to check for changes
# 6. Consider using `terraform state replace-provider` for major provider changes

# Provider upgrade commands:
# terraform init -upgrade              # Upgrade all providers
# terraform init -upgrade=true         # Same as above
# terraform providers lock -platform=linux_amd64 -platform=darwin_amd64  # Lock for multiple platforms