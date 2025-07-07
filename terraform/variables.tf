# ==============================================================================
# TERRAFORM VARIABLES FOR LEARNING ASSISTANT
# Input variables for Google Cloud Platform infrastructure
# ==============================================================================

# ==============================================================================
# PROJECT CONFIGURATION
# ==============================================================================

variable "project_id" {
  description = "The GCP project ID where resources will be created"
  type        = string
  
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]*[a-z0-9]$", var.project_id))
    error_message = "Project ID must be a valid GCP project ID (lowercase letters, numbers, and hyphens only)."
  }
}

variable "project_name" {
  description = "The name of the project (used for resource naming)"
  type        = string
  default     = "learning-assistant"
  
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]*[a-z0-9]$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "environment" {
  description = "The deployment environment (development, staging, production)"
  type        = string
  default     = "production"
  
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

# ==============================================================================
# REGIONAL CONFIGURATION
# ==============================================================================

variable "region" {
  description = "The GCP region where resources will be created"
  type        = string
  default     = "us-central1"
  
  validation {
    condition = contains([
      "us-central1", "us-east1", "us-east4", "us-west1", "us-west2", "us-west3", "us-west4",
      "europe-west1", "europe-west2", "europe-west3", "europe-west4", "europe-west6",
      "asia-east1", "asia-east2", "asia-northeast1", "asia-northeast2", "asia-northeast3",
      "asia-south1", "asia-southeast1", "asia-southeast2", "australia-southeast1"
    ], var.region)
    error_message = "Region must be a valid GCP region."
  }
}

variable "zone" {
  description = "The GCP zone where zonal resources will be created"
  type        = string
  default     = "us-central1-a"
  
  validation {
    condition     = can(regex("^[a-z]+-[a-z0-9]+-[a-z]$", var.zone))
    error_message = "Zone must be a valid GCP zone (e.g., us-central1-a)."
  }
}

# ==============================================================================
# NETWORK CONFIGURATION
# ==============================================================================

variable "subnet_cidr" {
  description = "CIDR range for the subnet"
  type        = string
  default     = "10.0.0.0/24"
  
  validation {
    condition     = can(cidrhost(var.subnet_cidr, 0))
    error_message = "Subnet CIDR must be a valid CIDR block."
  }
}

variable "connector_cidr" {
  description = "CIDR range for the VPC Access Connector"
  type        = string
  default     = "10.8.0.0/28"
  
  validation {
    condition     = can(cidrhost(var.connector_cidr, 0))
    error_message = "Connector CIDR must be a valid CIDR block."
  }
}

variable "connector_machine_type" {
  description = "Machine type for the VPC Access Connector"
  type        = string
  default     = "e2-micro"
  
  validation {
    condition     = contains(["e2-micro", "e2-standard-4", "f1-micro"], var.connector_machine_type)
    error_message = "Connector machine type must be one of: e2-micro, e2-standard-4, f1-micro."
  }
}

variable "connector_min_instances" {
  description = "Minimum number of instances for the VPC Access Connector"
  type        = number
  default     = 2
  
  validation {
    condition     = var.connector_min_instances >= 2 && var.connector_min_instances <= 10
    error_message = "Connector minimum instances must be between 2 and 10."
  }
}

variable "connector_max_instances" {
  description = "Maximum number of instances for the VPC Access Connector"
  type        = number
  default     = 10
  
  validation {
    condition     = var.connector_max_instances >= 2 && var.connector_max_instances <= 1000
    error_message = "Connector maximum instances must be between 2 and 1000."
  }
}

# ==============================================================================
# DATABASE CONFIGURATION
# ==============================================================================

variable "database_version" {
  description = "PostgreSQL version for Cloud SQL"
  type        = string
  default     = "POSTGRES_16"
  
  validation {
    condition     = contains(["POSTGRES_13", "POSTGRES_14", "POSTGRES_15", "POSTGRES_16"], var.database_version)
    error_message = "Database version must be one of: POSTGRES_13, POSTGRES_14, POSTGRES_15, POSTGRES_16."
  }
}

variable "database_tier" {
  description = "Machine type for the Cloud SQL instance"
  type        = string
  default     = "db-custom-2-7680"
  
  validation {
    condition     = can(regex("^db-(custom|standard|n1-standard|n1-highmem).*", var.database_tier))
    error_message = "Database tier must be a valid Cloud SQL machine type."
  }
}

variable "database_availability_type" {
  description = "Availability type for the Cloud SQL instance"
  type        = string
  default     = "ZONAL"
  
  validation {
    condition     = contains(["ZONAL", "REGIONAL"], var.database_availability_type)
    error_message = "Database availability type must be either ZONAL or REGIONAL."
  }
}

variable "database_disk_type" {
  description = "Disk type for the Cloud SQL instance"
  type        = string
  default     = "PD_SSD"
  
  validation {
    condition     = contains(["PD_SSD", "PD_HDD"], var.database_disk_type)
    error_message = "Database disk type must be either PD_SSD or PD_HDD."
  }
}

variable "database_disk_size" {
  description = "Disk size in GB for the Cloud SQL instance"
  type        = number
  default     = 100
  
  validation {
    condition     = var.database_disk_size >= 10 && var.database_disk_size <= 65536
    error_message = "Database disk size must be between 10 and 65536 GB."
  }
}

variable "database_disk_autoresize_limit" {
  description = "Maximum disk size in GB for automatic resize"
  type        = number
  default     = 1000
  
  validation {
    condition     = var.database_disk_autoresize_limit >= 0 && var.database_disk_autoresize_limit <= 65536
    error_message = "Database disk autoresize limit must be between 0 and 65536 GB."
  }
}

variable "database_name" {
  description = "Name of the PostgreSQL database"
  type        = string
  default     = "learning_assistant"
  
  validation {
    condition     = can(regex("^[a-z][a-z0-9_]*$", var.database_name))
    error_message = "Database name must start with a letter and contain only lowercase letters, numbers, and underscores."
  }
}

variable "database_user" {
  description = "Database username"
  type        = string
  default     = "app_user"
  
  validation {
    condition     = can(regex("^[a-z][a-z0-9_]*$", var.database_user))
    error_message = "Database user must start with a letter and contain only lowercase letters, numbers, and underscores."
  }
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection for the Cloud SQL instance"
  type        = bool
  default     = true
}

# ==============================================================================
# CLOUD RUN CONFIGURATION
# ==============================================================================

variable "container_image" {
  description = "Container image for the Cloud Run service"
  type        = string
  default     = "gcr.io/cloudrun/hello"
  
  validation {
    condition     = can(regex("^[a-z0-9.-]+/[a-z0-9.-]+.*", var.container_image))
    error_message = "Container image must be a valid Docker image reference."
  }
}

variable "cloud_run_min_instances" {
  description = "Minimum number of Cloud Run instances"
  type        = number
  default     = 1
  
  validation {
    condition     = var.cloud_run_min_instances >= 0 && var.cloud_run_min_instances <= 1000
    error_message = "Cloud Run minimum instances must be between 0 and 1000."
  }
}

variable "cloud_run_max_instances" {
  description = "Maximum number of Cloud Run instances"
  type        = number
  default     = 100
  
  validation {
    condition     = var.cloud_run_max_instances >= 1 && var.cloud_run_max_instances <= 1000
    error_message = "Cloud Run maximum instances must be between 1 and 1000."
  }
}

variable "cloud_run_cpu_limit" {
  description = "CPU limit for Cloud Run containers"
  type        = string
  default     = "2000m"
  
  validation {
    condition     = can(regex("^[0-9]+m?$", var.cloud_run_cpu_limit))
    error_message = "Cloud Run CPU limit must be a valid CPU specification (e.g., 1000m or 2)."
  }
}

variable "cloud_run_memory_limit" {
  description = "Memory limit for Cloud Run containers"
  type        = string
  default     = "4Gi"
  
  validation {
    condition     = can(regex("^[0-9]+(Mi|Gi)$", var.cloud_run_memory_limit))
    error_message = "Cloud Run memory limit must be a valid memory specification (e.g., 512Mi or 2Gi)."
  }
}

variable "cloud_run_cpu_idle" {
  description = "Whether to allocate CPU only during request processing"
  type        = bool
  default     = true
}

# ==============================================================================
# DOMAIN AND SSL CONFIGURATION
# ==============================================================================

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "learning-assistant.example.com"
  
  validation {
    condition     = can(regex("^[a-z0-9.-]+\\.[a-z]{2,}$", var.domain_name))
    error_message = "Domain name must be a valid domain (e.g., example.com)."
  }
}

variable "enable_cdn" {
  description = "Enable Cloud CDN for the load balancer"
  type        = bool
  default     = true
}

# ==============================================================================
# MONITORING AND LOGGING CONFIGURATION
# ==============================================================================

variable "enable_monitoring" {
  description = "Enable monitoring and alerting"
  type        = bool
  default     = true
}

variable "enable_logging" {
  description = "Enable detailed logging"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "Number of days to retain logs"
  type        = number
  default     = 30
  
  validation {
    condition     = var.log_retention_days >= 1 && var.log_retention_days <= 3653
    error_message = "Log retention days must be between 1 and 3653 (10 years)."
  }
}

# ==============================================================================
# BACKUP CONFIGURATION
# ==============================================================================

variable "backup_retention_days" {
  description = "Number of days to retain database backups"
  type        = number
  default     = 30
  
  validation {
    condition     = var.backup_retention_days >= 1 && var.backup_retention_days <= 365
    error_message = "Backup retention days must be between 1 and 365."
  }
}

variable "enable_point_in_time_recovery" {
  description = "Enable point-in-time recovery for the database"
  type        = bool
  default     = true
}

# ==============================================================================
# LABELS AND TAGGING
# ==============================================================================

variable "labels" {
  description = "Labels to apply to all resources"
  type        = map(string)
  default = {
    project     = "learning-assistant"
    managed_by  = "terraform"
    owner       = "platform-team"
  }
  
  validation {
    condition     = alltrue([for k, v in var.labels : can(regex("^[a-z][a-z0-9_-]*$", k)) && can(regex("^[a-z0-9_-]*$", v))])
    error_message = "All label keys and values must contain only lowercase letters, numbers, hyphens, and underscores."
  }
}

variable "tags" {
  description = "Network tags to apply to resources"
  type        = list(string)
  default     = ["learning-assistant", "web-app"]
  
  validation {
    condition     = alltrue([for tag in var.tags : can(regex("^[a-z][a-z0-9-]*$", tag))])
    error_message = "All tags must start with a letter and contain only lowercase letters, numbers, and hyphens."
  }
}

# ==============================================================================
# NOTIFICATION CONFIGURATION
# ==============================================================================

variable "notification_email" {
  description = "Email address for notifications and alerts"
  type        = string
  default     = "admin@example.com"
  
  validation {
    condition     = can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.notification_email))
    error_message = "Notification email must be a valid email address."
  }
}