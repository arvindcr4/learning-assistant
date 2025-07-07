# ===============================================================================
# Terraform Variables for Learning Assistant Azure Infrastructure
# ===============================================================================

# ===============================================================================
# General Configuration
# ===============================================================================

variable "application_name" {
  description = "Name of the application"
  type        = string
  default     = "learning-assistant"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.application_name))
    error_message = "Application name must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "location" {
  description = "Azure region where resources will be deployed"
  type        = string
  default     = "East US"

  validation {
    condition = contains([
      "East US", "East US 2", "West US", "West US 2", "West US 3",
      "Central US", "North Central US", "South Central US", "West Central US",
      "Canada Central", "Canada East", "Brazil South", "UK South", "UK West",
      "West Europe", "North Europe", "France Central", "Germany West Central",
      "Switzerland North", "Norway East", "Sweden Central", "Australia East",
      "Australia Southeast", "East Asia", "Southeast Asia", "Japan East",
      "Japan West", "Korea Central", "India Central", "South Africa North"
    ], var.location)
    error_message = "Location must be a valid Azure region."
  }
}

variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
  default     = "learning-assistant-rg"

  validation {
    condition     = can(regex("^[a-zA-Z0-9._-]+$", var.resource_group_name))
    error_message = "Resource group name must contain only letters, numbers, periods, hyphens, and underscores."
  }
}

variable "common_tags" {
  description = "Common tags to be applied to all resources"
  type        = map(string)
  default = {
    Project     = "Learning Assistant"
    ManagedBy   = "Terraform"
    CostCenter  = "IT"
    Owner       = "DevOps Team"
  }
}

variable "admin_email" {
  description = "Email address for alerts and notifications"
  type        = string

  validation {
    condition     = can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.admin_email))
    error_message = "Admin email must be a valid email address."
  }
}

# ===============================================================================
# Network Configuration
# ===============================================================================

variable "vnet_address_space" {
  description = "Address space for the virtual network"
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vnet_address_space, 0))
    error_message = "VNet address space must be a valid CIDR block."
  }
}

variable "app_gateway_subnet_cidr" {
  description = "CIDR block for Application Gateway subnet"
  type        = string
  default     = "10.0.1.0/24"

  validation {
    condition     = can(cidrhost(var.app_gateway_subnet_cidr, 0))
    error_message = "Application Gateway subnet CIDR must be a valid CIDR block."
  }
}

variable "container_instances_subnet_cidr" {
  description = "CIDR block for Container Instances subnet"
  type        = string
  default     = "10.0.2.0/24"

  validation {
    condition     = can(cidrhost(var.container_instances_subnet_cidr, 0))
    error_message = "Container Instances subnet CIDR must be a valid CIDR block."
  }
}

variable "postgresql_subnet_cidr" {
  description = "CIDR block for PostgreSQL subnet"
  type        = string
  default     = "10.0.3.0/24"

  validation {
    condition     = can(cidrhost(var.postgresql_subnet_cidr, 0))
    error_message = "PostgreSQL subnet CIDR must be a valid CIDR block."
  }
}

# ===============================================================================
# Container Configuration
# ===============================================================================

variable "container_cpu" {
  description = "CPU allocation for the container (in cores)"
  type        = number
  default     = 1

  validation {
    condition     = var.container_cpu >= 0.1 && var.container_cpu <= 4
    error_message = "Container CPU must be between 0.1 and 4 cores."
  }
}

variable "container_memory" {
  description = "Memory allocation for the container (in GB)"
  type        = number
  default     = 2

  validation {
    condition     = var.container_memory >= 0.5 && var.container_memory <= 8
    error_message = "Container memory must be between 0.5 and 8 GB."
  }
}

variable "container_registry_sku" {
  description = "SKU for the Azure Container Registry"
  type        = string
  default     = "Standard"

  validation {
    condition     = contains(["Basic", "Standard", "Premium"], var.container_registry_sku)
    error_message = "Container registry SKU must be one of: Basic, Standard, Premium."
  }
}

# ===============================================================================
# Database Configuration
# ===============================================================================

variable "postgresql_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "15"

  validation {
    condition     = contains(["13", "14", "15"], var.postgresql_version)
    error_message = "PostgreSQL version must be one of: 13, 14, 15."
  }
}

variable "postgresql_admin_username" {
  description = "Administrator username for PostgreSQL"
  type        = string
  default     = "psqladmin"

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]{2,62}$", var.postgresql_admin_username))
    error_message = "PostgreSQL admin username must start with a letter and contain only letters, numbers, and underscores (3-63 characters)."
  }
}

variable "postgresql_sku_name" {
  description = "SKU name for PostgreSQL Flexible Server"
  type        = string
  default     = "GP_Standard_D2s_v3"

  validation {
    condition = contains([
      "B_Standard_B1ms", "B_Standard_B2s", "B_Standard_B2ms", "B_Standard_B4ms",
      "GP_Standard_D2s_v3", "GP_Standard_D4s_v3", "GP_Standard_D8s_v3", "GP_Standard_D16s_v3",
      "MO_Standard_E2s_v3", "MO_Standard_E4s_v3", "MO_Standard_E8s_v3", "MO_Standard_E16s_v3"
    ], var.postgresql_sku_name)
    error_message = "PostgreSQL SKU must be a valid Azure Database for PostgreSQL Flexible Server SKU."
  }
}

variable "postgresql_storage_mb" {
  description = "Storage size for PostgreSQL in MB"
  type        = number
  default     = 32768

  validation {
    condition     = var.postgresql_storage_mb >= 20480 && var.postgresql_storage_mb <= 16777216
    error_message = "PostgreSQL storage must be between 20480 MB (20 GB) and 16777216 MB (16 TB)."
  }
}

variable "postgresql_backup_retention_days" {
  description = "Backup retention period in days"
  type        = number
  default     = 7

  validation {
    condition     = var.postgresql_backup_retention_days >= 7 && var.postgresql_backup_retention_days <= 35
    error_message = "Backup retention days must be between 7 and 35."
  }
}

variable "database_name" {
  description = "Name of the PostgreSQL database"
  type        = string
  default     = "learning_assistant"

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]{2,62}$", var.database_name))
    error_message = "Database name must start with a letter and contain only letters, numbers, and underscores (3-63 characters)."
  }
}

# ===============================================================================
# Application Gateway Configuration
# ===============================================================================

variable "app_gateway_sku_name" {
  description = "SKU name for Application Gateway"
  type        = string
  default     = "WAF_v2"

  validation {
    condition     = contains(["Standard_v2", "WAF_v2"], var.app_gateway_sku_name)
    error_message = "Application Gateway SKU name must be either Standard_v2 or WAF_v2."
  }
}

variable "app_gateway_sku_tier" {
  description = "SKU tier for Application Gateway"
  type        = string
  default     = "WAF_v2"

  validation {
    condition     = contains(["Standard_v2", "WAF_v2"], var.app_gateway_sku_tier)
    error_message = "Application Gateway SKU tier must be either Standard_v2 or WAF_v2."
  }
}

variable "app_gateway_capacity" {
  description = "Capacity for Application Gateway (only used when autoscale is disabled)"
  type        = number
  default     = 2

  validation {
    condition     = var.app_gateway_capacity >= 1 && var.app_gateway_capacity <= 125
    error_message = "Application Gateway capacity must be between 1 and 125."
  }
}

variable "app_gateway_min_capacity" {
  description = "Minimum capacity for Application Gateway autoscaling"
  type        = number
  default     = 1

  validation {
    condition     = var.app_gateway_min_capacity >= 0 && var.app_gateway_min_capacity <= 125
    error_message = "Application Gateway minimum capacity must be between 0 and 125."
  }
}

variable "app_gateway_max_capacity" {
  description = "Maximum capacity for Application Gateway autoscaling"
  type        = number
  default     = 10

  validation {
    condition     = var.app_gateway_max_capacity >= 1 && var.app_gateway_max_capacity <= 125
    error_message = "Application Gateway maximum capacity must be between 1 and 125."
  }
}

# ===============================================================================
# SSL/TLS Configuration
# ===============================================================================

variable "ssl_certificate_name" {
  description = "Name of the SSL certificate stored in Key Vault"
  type        = string
  default     = ""
}

variable "ssl_certificate_key_vault_id" {
  description = "Resource ID of the Key Vault containing the SSL certificate"
  type        = string
  default     = ""
}

variable "custom_domain" {
  description = "Custom domain name for the application (leave empty for default Azure domain)"
  type        = string
  default     = ""

  validation {
    condition     = var.custom_domain == "" || can(regex("^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.[a-zA-Z]{2,}$", var.custom_domain))
    error_message = "Custom domain must be a valid domain name or empty string."
  }
}

# ===============================================================================
# Monitoring Configuration
# ===============================================================================

variable "log_retention_days" {
  description = "Number of days to retain logs in Log Analytics workspace"
  type        = number
  default     = 30

  validation {
    condition     = var.log_retention_days >= 30 && var.log_retention_days <= 730
    error_message = "Log retention days must be between 30 and 730."
  }
}

variable "enable_monitoring" {
  description = "Enable monitoring and alerting"
  type        = bool
  default     = true
}

variable "alert_cpu_threshold" {
  description = "CPU usage threshold for alerts (percentage)"
  type        = number
  default     = 80

  validation {
    condition     = var.alert_cpu_threshold >= 50 && var.alert_cpu_threshold <= 95
    error_message = "CPU alert threshold must be between 50 and 95 percent."
  }
}

variable "alert_memory_threshold" {
  description = "Memory usage threshold for alerts (percentage)"
  type        = number
  default     = 80

  validation {
    condition     = var.alert_memory_threshold >= 50 && var.alert_memory_threshold <= 95
    error_message = "Memory alert threshold must be between 50 and 95 percent."
  }
}

# ===============================================================================
# Backup Configuration
# ===============================================================================

variable "enable_backup" {
  description = "Enable automated backups"
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30

  validation {
    condition     = var.backup_retention_days >= 7 && var.backup_retention_days <= 365
    error_message = "Backup retention days must be between 7 and 365."
  }
}

# ===============================================================================
# Security Configuration
# ===============================================================================

variable "enable_waf" {
  description = "Enable Web Application Firewall"
  type        = bool
  default     = true
}

variable "waf_mode" {
  description = "WAF mode (Detection or Prevention)"
  type        = string
  default     = "Prevention"

  validation {
    condition     = contains(["Detection", "Prevention"], var.waf_mode)
    error_message = "WAF mode must be either Detection or Prevention."
  }
}

variable "allowed_ip_ranges" {
  description = "List of IP ranges allowed to access the application (empty list allows all)"
  type        = list(string)
  default     = []

  validation {
    condition = alltrue([
      for ip_range in var.allowed_ip_ranges : can(cidrhost(ip_range, 0))
    ])
    error_message = "All IP ranges must be valid CIDR blocks."
  }
}

# ===============================================================================
# Feature Flags
# ===============================================================================

variable "enable_container_insights" {
  description = "Enable Container Insights for monitoring"
  type        = bool
  default     = true
}

variable "enable_auto_scaling" {
  description = "Enable auto-scaling for Application Gateway"
  type        = bool
  default     = true
}

variable "enable_geo_replication" {
  description = "Enable geo-replication for storage account and container registry"
  type        = bool
  default     = false
}

variable "enable_high_availability" {
  description = "Enable high availability for PostgreSQL"
  type        = bool
  default     = false
}

# ===============================================================================
# Performance Configuration
# ===============================================================================

variable "connection_timeout" {
  description = "Database connection timeout in seconds"
  type        = number
  default     = 30

  validation {
    condition     = var.connection_timeout >= 5 && var.connection_timeout <= 300
    error_message = "Connection timeout must be between 5 and 300 seconds."
  }
}

variable "max_connections" {
  description = "Maximum number of database connections"
  type        = number
  default     = 100

  validation {
    condition     = var.max_connections >= 10 && var.max_connections <= 1000
    error_message = "Maximum connections must be between 10 and 1000."
  }
}

# ===============================================================================
# Development Configuration
# ===============================================================================

variable "enable_debug_logging" {
  description = "Enable debug logging for development environments"
  type        = bool
  default     = false
}

variable "skip_provider_registration" {
  description = "Skip provider registration (useful for testing)"
  type        = bool
  default     = false
}

# ===============================================================================
# Cost Optimization
# ===============================================================================

variable "enable_spot_instances" {
  description = "Enable spot instances for cost optimization (non-production only)"
  type        = bool
  default     = false
}

variable "auto_shutdown_enabled" {
  description = "Enable auto-shutdown for development environments"
  type        = bool
  default     = false
}

variable "auto_shutdown_time" {
  description = "Time to automatically shutdown resources (24-hour format, e.g., '19:00')"
  type        = string
  default     = "19:00"

  validation {
    condition     = can(regex("^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$", var.auto_shutdown_time))
    error_message = "Auto shutdown time must be in HH:MM format (24-hour)."
  }
}