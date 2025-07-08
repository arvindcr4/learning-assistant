# Provider Version Constraints
# This file defines the required providers and their version constraints

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    # Kubernetes provider for core Kubernetes resources
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.24"
    }
    
    # Helm provider for Helm chart deployments
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
    
    # kubectl provider for raw Kubernetes manifests
    kubectl = {
      source  = "gavinbunney/kubectl"
      version = "~> 1.14"
    }
    
    # Random provider for generating random values
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    
    # Time provider for time-based resources
    time = {
      source  = "hashicorp/time"
      version = "~> 0.10"
    }
    
    # TLS provider for certificate generation
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    
    # Local provider for local file operations
    local = {
      source  = "hashicorp/local"
      version = "~> 2.4"
    }
    
    # HTTP provider for HTTP data sources
    http = {
      source  = "hashicorp/http"
      version = "~> 3.4"
    }
    
    # Cloud provider specific (uncomment as needed)
    
    # AWS provider for AWS-specific resources
    # aws = {
    #   source  = "hashicorp/aws"
    #   version = "~> 5.0"
    # }
    
    # Google Cloud provider for GCP-specific resources
    # google = {
    #   source  = "hashicorp/google"
    #   version = "~> 5.0"
    # }
    
    # Azure provider for Azure-specific resources
    # azurerm = {
    #   source  = "hashicorp/azurerm"
    #   version = "~> 3.0"
    # }
    
    # External provider for external commands
    external = {
      source  = "hashicorp/external"
      version = "~> 2.3"
    }
  }
}

# Provider configurations with default settings
provider "kubernetes" {
  # Configuration will be provided via environment variables or kubeconfig
  # Set KUBE_CONFIG_PATH or use default ~/.kube/config
}

provider "helm" {
  kubernetes {
    # Configuration will be provided via environment variables or kubeconfig
    # Set KUBE_CONFIG_PATH or use default ~/.kube/config
  }
  
  # Helm-specific settings
  experiments {
    manifest = true
  }
}

provider "kubectl" {
  # Configuration will be provided via environment variables or kubeconfig
  # Set KUBE_CONFIG_PATH or use default ~/.kube/config
  
  load_config_file = true
}

provider "random" {
  # Random provider doesn't require configuration
}

provider "time" {
  # Time provider doesn't require configuration
}

provider "tls" {
  # TLS provider doesn't require configuration
}

provider "local" {
  # Local provider doesn't require configuration
}

provider "http" {
  # HTTP provider doesn't require configuration
}

provider "external" {
  # External provider doesn't require configuration
}

# Backend configuration (uncomment and configure as needed)
# terraform {
#   backend "s3" {
#     bucket         = "your-terraform-state-bucket"
#     key            = "k8s/terraform.tfstate"
#     region         = "us-west-2"
#     encrypt        = true
#     dynamodb_table = "terraform-state-lock"
#   }
# }

# Alternative backend configurations:

# Google Cloud Storage backend
# terraform {
#   backend "gcs" {
#     bucket = "your-terraform-state-bucket"
#     prefix = "k8s/terraform.tfstate"
#   }
# }

# Azure Storage backend
# terraform {
#   backend "azurerm" {
#     resource_group_name   = "your-resource-group"
#     storage_account_name  = "your-storage-account"
#     container_name        = "tfstate"
#     key                   = "k8s/terraform.tfstate"
#   }
# }

# Kubernetes backend (for storing state in cluster)
# terraform {
#   backend "kubernetes" {
#     secret_suffix    = "state"
#     config_path      = "~/.kube/config"
#     namespace        = "terraform"
#   }
# }

# HTTP backend
# terraform {
#   backend "http" {
#     address        = "https://your-backend-url/terraform.tfstate"
#     lock_address   = "https://your-backend-url/terraform.tfstate"
#     unlock_address = "https://your-backend-url/terraform.tfstate"
#   }
# }