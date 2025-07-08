# Terraform and Provider Version Configuration
# Learning Assistant Application

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.1"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.1"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.7"
    }
  }
}

# AWS Provider Configuration
provider "aws" {
  region = var.aws_region

  # Default tags for all resources
  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
      Repository  = "learning-assistant"
    }
  }
}

# Additional provider configuration for different regions (if needed)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  
  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
      Repository  = "learning-assistant"
    }
  }
}

# Random provider for generating unique names
provider "random" {}

# Local provider for local file operations
provider "local" {}

# Null provider for null resources
provider "null" {}

# Time provider for time-based resources
provider "time" {}