# Project and Region Configuration
variable "project_id" {
  description = "The GCP project ID"
  type        = string
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "Project ID must be 6-30 characters, start with a letter, and contain only lowercase letters, numbers, and hyphens."
  }
}

variable "region" {
  description = "The GCP region for resources"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "The GCP zone for resources"
  type        = string
  default     = "us-central1-a"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# Domain and DNS Configuration
variable "domain_name" {
  description = "The domain name for the application"
  type        = string
  default     = "learning-assistant.com"
}

variable "subdomain" {
  description = "The subdomain for the application"
  type        = string
  default     = "app"
}

# VPC Configuration
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "private_subnet_cidr" {
  description = "CIDR block for private subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "public_subnet_cidr" {
  description = "CIDR block for public subnet"
  type        = string
  default     = "10.0.2.0/24"
}

# GKE Configuration
variable "gke_cluster_name" {
  description = "Name of the GKE cluster"
  type        = string
  default     = "learning-assistant-cluster"
}

variable "gke_node_count" {
  description = "Number of nodes in the GKE cluster"
  type        = number
  default     = 3
}

variable "gke_min_node_count" {
  description = "Minimum number of nodes in the GKE cluster"
  type        = number
  default     = 1
}

variable "gke_max_node_count" {
  description = "Maximum number of nodes in the GKE cluster"
  type        = number
  default     = 10
}

variable "gke_node_machine_type" {
  description = "Machine type for GKE nodes"
  type        = string
  default     = "e2-standard-4"
}

variable "gke_disk_size" {
  description = "Disk size for GKE nodes in GB"
  type        = number
  default     = 100
}

variable "gke_kubernetes_version" {
  description = "Kubernetes version for GKE cluster"
  type        = string
  default     = "1.28"
}

# Cloud SQL Configuration
variable "db_instance_name" {
  description = "Name of the Cloud SQL instance"
  type        = string
  default     = "learning-assistant-db"
}

variable "db_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "POSTGRES_15"
}

variable "db_tier" {
  description = "Cloud SQL instance tier"
  type        = string
  default     = "db-custom-4-16384"
}

variable "db_disk_size" {
  description = "Cloud SQL disk size in GB"
  type        = number
  default     = 100
}

variable "db_disk_type" {
  description = "Cloud SQL disk type"
  type        = string
  default     = "PD_SSD"
}

variable "db_backup_enabled" {
  description = "Enable automated backups"
  type        = bool
  default     = true
}

variable "db_backup_start_time" {
  description = "Backup start time (HH:MM format)"
  type        = string
  default     = "02:00"
}

variable "db_backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7
}

# Redis Configuration
variable "redis_instance_name" {
  description = "Name of the Redis instance"
  type        = string
  default     = "learning-assistant-redis"
}

variable "redis_tier" {
  description = "Redis service tier"
  type        = string
  default     = "STANDARD_HA"
}

variable "redis_memory_size" {
  description = "Redis memory size in GB"
  type        = number
  default     = 4
}

variable "redis_version" {
  description = "Redis version"
  type        = string
  default     = "REDIS_7_0"
}

# Load Balancer Configuration
variable "ssl_certificate_name" {
  description = "Name of the SSL certificate"
  type        = string
  default     = "learning-assistant-ssl-cert"
}

# Monitoring Configuration
variable "notification_email" {
  description = "Email for monitoring notifications"
  type        = string
  default     = "admin@learning-assistant.com"
}

variable "enable_monitoring" {
  description = "Enable comprehensive monitoring"
  type        = bool
  default     = true
}

# Resource Labels
variable "labels" {
  description = "Labels to apply to resources"
  type        = map(string)
  default = {
    project     = "learning-assistant"
    managed_by  = "terraform"
    cost_center = "engineering"
  }
}

# Security Configuration
variable "enable_network_policy" {
  description = "Enable network policy for GKE"
  type        = bool
  default     = true
}

variable "enable_private_nodes" {
  description = "Enable private nodes for GKE"
  type        = bool
  default     = true
}

variable "authorized_networks" {
  description = "List of authorized networks for GKE master"
  type = list(object({
    cidr_block   = string
    display_name = string
  }))
  default = [
    {
      cidr_block   = "0.0.0.0/0"
      display_name = "All networks"
    }
  ]
}

# Cost Optimization
variable "enable_node_auto_repair" {
  description = "Enable auto-repair for GKE nodes"
  type        = bool
  default     = true
}

variable "enable_node_auto_upgrade" {
  description = "Enable auto-upgrade for GKE nodes"
  type        = bool
  default     = true
}

variable "preemptible_nodes" {
  description = "Use preemptible nodes for cost optimization"
  type        = bool
  default     = false
}

# Application Configuration
variable "app_image" {
  description = "Container image for the application"
  type        = string
  default     = "gcr.io/PROJECT_ID/learning-assistant:latest"
}

variable "app_replicas" {
  description = "Number of application replicas"
  type        = number
  default     = 3
}

# Backup Configuration
variable "backup_schedule" {
  description = "Backup schedule in cron format"
  type        = string
  default     = "0 2 * * *"
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
}