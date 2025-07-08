# Variables for Azure Infrastructure Configuration
# This file defines all configurable parameters for the Azure infrastructure

# Project Configuration
variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "learning-assistant"
  
  validation {
    condition     = can(regex("^[a-zA-Z0-9-]+$", var.project_name))
    error_message = "Project name must contain only alphanumeric characters and hyphens."
  }
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# Location Configuration
variable "location" {
  description = "Azure region where resources will be created"
  type        = string
  default     = "East US 2"
  
  validation {
    condition = contains([
      "East US", "East US 2", "West US", "West US 2", "West US 3",
      "Central US", "North Central US", "South Central US", "West Central US",
      "Canada Central", "Canada East", "Brazil South", "UK South", "UK West",
      "West Europe", "North Europe", "France Central", "Germany West Central",
      "Norway East", "Switzerland North", "UAE North", "South Africa North",
      "Australia East", "Australia Southeast", "East Asia", "Southeast Asia",
      "Japan East", "Japan West", "Korea Central", "India Central"
    ], var.location)
    error_message = "Location must be a valid Azure region."
  }
}

# Network Configuration
variable "vnet_address_space" {
  description = "Address space for the virtual network"
  type        = list(string)
  default     = ["10.0.0.0/16"]
  
  validation {
    condition     = length(var.vnet_address_space) > 0
    error_message = "At least one address space must be specified."
  }
}

variable "enable_private_endpoints" {
  description = "Enable private endpoints for services"
  type        = bool
  default     = true
}

# AKS Configuration
variable "aks_kubernetes_version" {
  description = "Kubernetes version for AKS cluster"
  type        = string
  default     = "1.28"
}

variable "aks_system_node_pool" {
  description = "Configuration for AKS system node pool"
  type = object({
    node_count      = number
    vm_size         = string
    max_node_count  = number
    min_node_count  = number
  })
  default = {
    node_count     = 3
    vm_size        = "Standard_D2s_v3"
    max_node_count = 5
    min_node_count = 1
  }
}

variable "aks_user_node_pool" {
  description = "Configuration for AKS user node pool"
  type = object({
    node_count      = number
    vm_size         = string
    max_node_count  = number
    min_node_count  = number
  })
  default = {
    node_count     = 2
    vm_size        = "Standard_D4s_v3"
    max_node_count = 10
    min_node_count = 1
  }
}

variable "aks_enable_rbac" {
  description = "Enable RBAC for AKS cluster"
  type        = bool
  default     = true
}

variable "aks_enable_azure_ad" {
  description = "Enable Azure AD integration for AKS"
  type        = bool
  default     = true
}

variable "aks_enable_pod_identity" {
  description = "Enable pod identity for AKS"
  type        = bool
  default     = true
}

# Database Configuration
variable "postgresql_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "14"
  
  validation {
    condition     = contains(["11", "12", "13", "14", "15"], var.postgresql_version)
    error_message = "PostgreSQL version must be one of: 11, 12, 13, 14, 15."
  }
}

variable "postgresql_sku_name" {
  description = "PostgreSQL SKU name"
  type        = string
  default     = "GP_Standard_D2s_v3"
}

variable "postgresql_storage_mb" {
  description = "PostgreSQL storage in MB"
  type        = number
  default     = 32768
  
  validation {
    condition     = var.postgresql_storage_mb >= 32768 && var.postgresql_storage_mb <= 16777216
    error_message = "PostgreSQL storage must be between 32768 MB and 16777216 MB."
  }
}

variable "postgresql_backup_retention_days" {
  description = "PostgreSQL backup retention in days"
  type        = number
  default     = 7
  
  validation {
    condition     = var.postgresql_backup_retention_days >= 7 && var.postgresql_backup_retention_days <= 35
    error_message = "PostgreSQL backup retention must be between 7 and 35 days."
  }
}

variable "postgresql_geo_redundant_backup" {
  description = "Enable geo-redundant backups for PostgreSQL"
  type        = bool
  default     = true
}

variable "postgresql_enable_high_availability" {
  description = "Enable high availability for PostgreSQL"
  type        = bool
  default     = true
}

# Redis Configuration
variable "redis_capacity" {
  description = "Redis cache capacity"
  type        = number
  default     = 2
  
  validation {
    condition     = contains([1, 2, 3, 4, 5, 6], var.redis_capacity)
    error_message = "Redis capacity must be one of: 1, 2, 3, 4, 5, 6."
  }
}

variable "redis_family" {
  description = "Redis cache family"
  type        = string
  default     = "C"
  
  validation {
    condition     = contains(["C", "P"], var.redis_family)
    error_message = "Redis family must be either C (Basic/Standard) or P (Premium)."
  }
}

variable "redis_sku_name" {
  description = "Redis cache SKU name"
  type        = string
  default     = "Standard"
  
  validation {
    condition     = contains(["Basic", "Standard", "Premium"], var.redis_sku_name)
    error_message = "Redis SKU must be one of: Basic, Standard, Premium."
  }
}

variable "redis_enable_non_ssl_port" {
  description = "Enable non-SSL port for Redis"
  type        = bool
  default     = false
}

variable "redis_minimum_tls_version" {
  description = "Minimum TLS version for Redis"
  type        = string
  default     = "1.2"
  
  validation {
    condition     = contains(["1.0", "1.1", "1.2"], var.redis_minimum_tls_version)
    error_message = "Redis minimum TLS version must be one of: 1.0, 1.1, 1.2."
  }
}

# Application Gateway Configuration
variable "app_gateway_sku" {
  description = "Application Gateway SKU"
  type = object({
    name     = string
    tier     = string
    capacity = number
  })
  default = {
    name     = "WAF_v2"
    tier     = "WAF_v2"
    capacity = 2
  }
}

variable "app_gateway_enable_waf" {
  description = "Enable Web Application Firewall"
  type        = bool
  default     = true
}

variable "app_gateway_waf_mode" {
  description = "WAF mode (Detection or Prevention)"
  type        = string
  default     = "Prevention"
  
  validation {
    condition     = contains(["Detection", "Prevention"], var.app_gateway_waf_mode)
    error_message = "WAF mode must be either Detection or Prevention."
  }
}

# DNS Configuration
variable "dns_zone_name" {
  description = "DNS zone name for the application"
  type        = string
  default     = ""
}

variable "create_dns_zone" {
  description = "Create DNS zone"
  type        = bool
  default     = false
}

# Monitoring Configuration
variable "log_analytics_retention_days" {
  description = "Log Analytics workspace retention in days"
  type        = number
  default     = 30
  
  validation {
    condition     = var.log_analytics_retention_days >= 30 && var.log_analytics_retention_days <= 730
    error_message = "Log Analytics retention must be between 30 and 730 days."
  }
}

variable "enable_container_insights" {
  description = "Enable Container Insights for AKS"
  type        = bool
  default     = true
}

variable "enable_security_center" {
  description = "Enable Azure Security Center"
  type        = bool
  default     = true
}

# Backup Configuration
variable "backup_policy" {
  description = "Backup policy for resources"
  type        = string
  default     = "daily"
  
  validation {
    condition     = contains(["daily", "weekly", "monthly"], var.backup_policy)
    error_message = "Backup policy must be one of: daily, weekly, monthly."
  }
}

variable "backup_retention_days" {
  description = "Backup retention in days"
  type        = number
  default     = 30
  
  validation {
    condition     = var.backup_retention_days >= 7 && var.backup_retention_days <= 365
    error_message = "Backup retention must be between 7 and 365 days."
  }
}

# Security Configuration
variable "enable_network_security_groups" {
  description = "Enable Network Security Groups"
  type        = bool
  default     = true
}

variable "enable_azure_defender" {
  description = "Enable Azure Defender"
  type        = bool
  default     = true
}

variable "allowed_ip_ranges" {
  description = "Allowed IP ranges for access"
  type        = list(string)
  default     = []
}

# Tagging Configuration
variable "owner" {
  description = "Owner of the resources"
  type        = string
  default     = "Platform Team"
}

variable "cost_center" {
  description = "Cost center for billing"
  type        = string
  default     = "Engineering"
}

variable "data_classification" {
  description = "Data classification level"
  type        = string
  default     = "Internal"
  
  validation {
    condition     = contains(["Public", "Internal", "Confidential", "Restricted"], var.data_classification)
    error_message = "Data classification must be one of: Public, Internal, Confidential, Restricted."
  }
}

# Auto-scaling Configuration
variable "enable_cluster_autoscaler" {
  description = "Enable cluster autoscaler for AKS"
  type        = bool
  default     = true
}

variable "enable_horizontal_pod_autoscaler" {
  description = "Enable horizontal pod autoscaler"
  type        = bool
  default     = true
}

variable "enable_vertical_pod_autoscaler" {
  description = "Enable vertical pod autoscaler"
  type        = bool
  default     = false
}

# Cost Management
variable "enable_cost_management" {
  description = "Enable cost management and budgets"
  type        = bool
  default     = true
}

variable "monthly_budget_amount" {
  description = "Monthly budget amount in USD"
  type        = number
  default     = 1000
  
  validation {
    condition     = var.monthly_budget_amount > 0
    error_message = "Monthly budget amount must be greater than 0."
  }
}

variable "budget_alert_thresholds" {
  description = "Budget alert thresholds (percentages)"
  type        = list(number)
  default     = [50, 75, 90, 100]
}

# Disaster Recovery Configuration
variable "enable_disaster_recovery" {
  description = "Enable disaster recovery configuration"
  type        = bool
  default     = true
}

variable "dr_region" {
  description = "Disaster recovery region"
  type        = string
  default     = "West US 2"
}

# Performance Configuration
variable "enable_performance_monitoring" {
  description = "Enable performance monitoring"
  type        = bool
  default     = true
}

variable "enable_application_insights" {
  description = "Enable Application Insights"
  type        = bool
  default     = true
}

# Compliance Configuration
variable "enable_compliance_monitoring" {
  description = "Enable compliance monitoring"
  type        = bool
  default     = true
}

variable "compliance_standards" {
  description = "Compliance standards to monitor"
  type        = list(string)
  default     = ["SOC2", "ISO27001", "PCI-DSS"]
}