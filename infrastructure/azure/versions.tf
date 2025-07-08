# Terraform and Provider Version Constraints
# This file defines the required Terraform version and provider versions

terraform {
  required_version = ">= 1.6.0"
  
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.80"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 2.45"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }

  # Backend configuration for remote state
  # This should be configured based on your state storage preference
  backend "azurerm" {
    # Configuration will be provided via terraform init -backend-config
    # or via environment variables
  }
}

# Configure the Azure Provider
provider "azurerm" {
  features {
    # Enable enhanced features
    resource_group {
      prevent_deletion_if_contains_resources = true
    }
    
    key_vault {
      purge_soft_delete_on_destroy    = var.environment != "production"
      recover_soft_deleted_key_vaults = true
    }
    
    storage_account {
      prevent_deletion_if_contains_resources = true
    }
    
    cognitive_account {
      purge_soft_delete_on_destroy = var.environment != "production"
    }
    
    template_deployment {
      delete_nested_items_during_deletion = true
    }
  }
  
  # Use managed identity when running in Azure
  use_msi = var.environment == "production" ? true : false
  
  # Skip provider registration for faster deployments
  skip_provider_registration = false
}

# Configure the Azure AD Provider
provider "azuread" {
  # Use the same tenant as AzureRM provider
}

# Configure the Random Provider
provider "random" {
  # No configuration needed
}

# Configure the TLS Provider
provider "tls" {
  # No configuration needed
}

# Configure the Kubernetes Provider
provider "kubernetes" {
  host                   = azurerm_kubernetes_cluster.main.kube_config.0.host
  client_certificate     = base64decode(azurerm_kubernetes_cluster.main.kube_config.0.client_certificate)
  client_key             = base64decode(azurerm_kubernetes_cluster.main.kube_config.0.client_key)
  cluster_ca_certificate = base64decode(azurerm_kubernetes_cluster.main.kube_config.0.cluster_ca_certificate)
}

# Configure the Helm Provider
provider "helm" {
  kubernetes {
    host                   = azurerm_kubernetes_cluster.main.kube_config.0.host
    client_certificate     = base64decode(azurerm_kubernetes_cluster.main.kube_config.0.client_certificate)
    client_key             = base64decode(azurerm_kubernetes_cluster.main.kube_config.0.client_key)
    cluster_ca_certificate = base64decode(azurerm_kubernetes_cluster.main.kube_config.0.cluster_ca_certificate)
  }
}

# Data sources for current configuration
data "azurerm_client_config" "current" {}

data "azurerm_subscription" "current" {}

# Get available AKS versions
data "azurerm_kubernetes_service_versions" "current" {
  location = var.location
  
  # Filter for supported versions
  include_preview = false
}

# Local values for version management
locals {
  # Use latest patch version of specified Kubernetes version
  kubernetes_version = var.aks_kubernetes_version != "latest" ? var.aks_kubernetes_version : data.azurerm_kubernetes_service_versions.current.latest_version
  
  # Provider version information
  provider_versions = {
    azurerm    = "~> 3.80"
    azuread    = "~> 2.45"
    random     = "~> 3.5"
    tls        = "~> 4.0"
    kubernetes = "~> 2.23"
    helm       = "~> 2.11"
  }
  
  # Feature flags based on environment
  feature_flags = {
    enable_preview_features = var.environment == "dev" ? true : false
    enable_beta_features    = var.environment != "production" ? true : false
    strict_security_mode    = var.environment == "production" ? true : false
  }
}

# Output provider versions for reference
output "provider_versions" {
  description = "Provider versions used in this configuration"
  value       = local.provider_versions
}

output "terraform_version" {
  description = "Terraform version constraint"
  value       = ">= 1.6.0"
}

output "kubernetes_version" {
  description = "Kubernetes version used for AKS cluster"
  value       = local.kubernetes_version
}

output "feature_flags" {
  description = "Feature flags enabled for this environment"
  value       = local.feature_flags
}