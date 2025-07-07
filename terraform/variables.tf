# =============================================================================
# LEARNING ASSISTANT - TERRAFORM VARIABLES
# =============================================================================
# This file defines all configurable variables for the Linode infrastructure
# =============================================================================

# -----------------------------------------------------------------------------
# PROJECT & ENVIRONMENT VARIABLES
# -----------------------------------------------------------------------------

variable "project_name" {
  description = "Name of the project (used for resource naming and tagging)"
  type        = string
  default     = "learning-assistant"
  
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens."
  }
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

variable "region" {
  description = "Linode region for resource deployment"
  type        = string
  default     = "us-east"
  
  validation {
    condition = contains([
      "us-east", "us-west", "us-central", "us-southeast",
      "eu-west", "eu-central", "ap-south", "ap-northeast",
      "ap-southeast", "ca-central", "ap-west"
    ], var.region)
    error_message = "Please specify a valid Linode region."
  }
}

# -----------------------------------------------------------------------------
# COMPUTE INSTANCE VARIABLES
# -----------------------------------------------------------------------------

variable "web_server_count" {
  description = "Number of web server instances to create"
  type        = number
  default     = 2
  
  validation {
    condition     = var.web_server_count >= 1 && var.web_server_count <= 10
    error_message = "Web server count must be between 1 and 10."
  }
}

variable "web_server_type" {
  description = "Linode instance type for web servers"
  type        = string
  default     = "g6-standard-2"
  
  validation {
    condition = contains([
      "g6-nanode-1", "g6-standard-1", "g6-standard-2", "g6-standard-4",
      "g6-standard-6", "g6-standard-8", "g6-standard-16", "g6-standard-20",
      "g6-standard-24", "g6-standard-32", "g6-highmem-1", "g6-highmem-2",
      "g6-highmem-4", "g6-highmem-8", "g6-highmem-16", "g6-dedicated-2",
      "g6-dedicated-4", "g6-dedicated-8", "g6-dedicated-16", "g6-dedicated-32"
    ], var.web_server_type)
    error_message = "Please specify a valid Linode instance type."
  }
}

variable "ssh_public_keys" {
  description = "List of SSH public keys for instance access"
  type        = list(string)
  default     = []
  
  validation {
    condition     = length(var.ssh_public_keys) > 0
    error_message = "At least one SSH public key must be provided."
  }
}

variable "allowed_ssh_ips" {
  description = "List of IP addresses/CIDR blocks allowed SSH access"
  type        = list(string)
  default     = ["0.0.0.0/0"]
  
  validation {
    condition     = length(var.allowed_ssh_ips) > 0
    error_message = "At least one allowed SSH IP must be specified."
  }
}

# -----------------------------------------------------------------------------
# DATABASE VARIABLES
# -----------------------------------------------------------------------------

variable "database_type" {
  description = "Linode database instance type"
  type        = string
  default     = "g6-dedicated-2"
  
  validation {
    condition = contains([
      "g6-dedicated-2", "g6-dedicated-4", "g6-dedicated-8",
      "g6-dedicated-16", "g6-dedicated-32", "g6-dedicated-48",
      "g6-dedicated-50", "g6-dedicated-56", "g6-dedicated-64"
    ], var.database_type)
    error_message = "Please specify a valid Linode database instance type."
  }
}

variable "database_cluster_size" {
  description = "Number of nodes in the database cluster"
  type        = number
  default     = 1
  
  validation {
    condition     = var.database_cluster_size >= 1 && var.database_cluster_size <= 3
    error_message = "Database cluster size must be between 1 and 3."
  }
}

variable "postgres_engine_id" {
  description = "PostgreSQL engine ID for the database"
  type        = string
  default     = "postgresql/16.4"
  
  validation {
    condition = contains([
      "postgresql/13.13", "postgresql/14.10", "postgresql/15.5", "postgresql/16.4"
    ], var.postgres_engine_id)
    error_message = "Please specify a valid PostgreSQL engine ID."
  }
}

variable "database_name" {
  description = "Name of the application database"
  type        = string
  default     = "learning_assistant"
  
  validation {
    condition     = can(regex("^[a-z0-9_]+$", var.database_name))
    error_message = "Database name must contain only lowercase letters, numbers, and underscores."
  }
}

variable "database_username" {
  description = "Database username for the application"
  type        = string
  default     = "app_user"
  
  validation {
    condition     = can(regex("^[a-z0-9_]+$", var.database_username))
    error_message = "Database username must contain only lowercase letters, numbers, and underscores."
  }
}

# -----------------------------------------------------------------------------
# BACKUP CONFIGURATION VARIABLES
# -----------------------------------------------------------------------------

variable "enable_backups" {
  description = "Enable automated backups for instances"
  type        = bool
  default     = true
}

variable "backup_window_day" {
  description = "Day of the week for database backups (0-6, 0 = Sunday)"
  type        = number
  default     = 0
  
  validation {
    condition     = var.backup_window_day >= 0 && var.backup_window_day <= 6
    error_message = "Backup window day must be between 0 and 6."
  }
}

variable "backup_window_hour" {
  description = "Hour of the day for database backups (0-23)"
  type        = number
  default     = 2
  
  validation {
    condition     = var.backup_window_hour >= 0 && var.backup_window_hour <= 23
    error_message = "Backup window hour must be between 0 and 23."
  }
}

variable "backup_duration" {
  description = "Duration of backup window in hours"
  type        = number
  default     = 2
  
  validation {
    condition     = var.backup_duration >= 1 && var.backup_duration <= 4
    error_message = "Backup duration must be between 1 and 4 hours."
  }
}

variable "maintenance_window_day" {
  description = "Day of the week for database maintenance (0-6, 0 = Sunday)"
  type        = number
  default     = 1
  
  validation {
    condition     = var.maintenance_window_day >= 0 && var.maintenance_window_day <= 6
    error_message = "Maintenance window day must be between 0 and 6."
  }
}

variable "maintenance_window_hour" {
  description = "Hour of the day for database maintenance (0-23)"
  type        = number
  default     = 3
  
  validation {
    condition     = var.maintenance_window_hour >= 0 && var.maintenance_window_hour <= 23
    error_message = "Maintenance window hour must be between 0 and 23."
  }
}

variable "maintenance_duration" {
  description = "Duration of maintenance window in hours"
  type        = number
  default     = 1
  
  validation {
    condition     = var.maintenance_duration >= 1 && var.maintenance_duration <= 4
    error_message = "Maintenance duration must be between 1 and 4 hours."
  }
}

# -----------------------------------------------------------------------------
# LOAD BALANCER VARIABLES
# -----------------------------------------------------------------------------

variable "client_conn_throttle" {
  description = "Client connection throttle for NodeBalancer"
  type        = number
  default     = 0
  
  validation {
    condition     = var.client_conn_throttle >= 0 && var.client_conn_throttle <= 20
    error_message = "Client connection throttle must be between 0 and 20."
  }
}

variable "lb_algorithm" {
  description = "Load balancing algorithm"
  type        = string
  default     = "roundrobin"
  
  validation {
    condition     = contains(["roundrobin", "leastconn", "source"], var.lb_algorithm)
    error_message = "Load balancing algorithm must be one of: roundrobin, leastconn, source."
  }
}

variable "lb_stickiness" {
  description = "Session stickiness for load balancer"
  type        = string
  default     = "none"
  
  validation {
    condition     = contains(["none", "table", "http_cookie"], var.lb_stickiness)
    error_message = "Load balancer stickiness must be one of: none, table, http_cookie."
  }
}

variable "node_weight" {
  description = "Weight for load balancer nodes"
  type        = number
  default     = 100
  
  validation {
    condition     = var.node_weight >= 1 && var.node_weight <= 255
    error_message = "Node weight must be between 1 and 255."
  }
}

# -----------------------------------------------------------------------------
# HEALTH CHECK VARIABLES
# -----------------------------------------------------------------------------

variable "health_check_interval" {
  description = "Health check interval in seconds"
  type        = number
  default     = 5
  
  validation {
    condition     = var.health_check_interval >= 5 && var.health_check_interval <= 300
    error_message = "Health check interval must be between 5 and 300 seconds."
  }
}

variable "health_check_timeout" {
  description = "Health check timeout in seconds"
  type        = number
  default     = 3
  
  validation {
    condition     = var.health_check_timeout >= 1 && var.health_check_timeout <= 30
    error_message = "Health check timeout must be between 1 and 30 seconds."
  }
}

variable "health_check_attempts" {
  description = "Number of health check attempts before marking unhealthy"
  type        = number
  default     = 3
  
  validation {
    condition     = var.health_check_attempts >= 1 && var.health_check_attempts <= 30
    error_message = "Health check attempts must be between 1 and 30."
  }
}

# -----------------------------------------------------------------------------
# SSL/TLS CERTIFICATE VARIABLES
# -----------------------------------------------------------------------------

variable "ssl_cert" {
  description = "SSL certificate content (PEM format)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "ssl_key" {
  description = "SSL private key content (PEM format)"
  type        = string
  default     = ""
  sensitive   = true
}

# -----------------------------------------------------------------------------
# DOCKER CONFIGURATION VARIABLES
# -----------------------------------------------------------------------------

variable "docker_image" {
  description = "Docker image for the application"
  type        = string
  default     = "learning-assistant"
  
  validation {
    condition     = can(regex("^[a-z0-9._/-]+$", var.docker_image))
    error_message = "Docker image name must be valid."
  }
}

variable "docker_tag" {
  description = "Docker image tag"
  type        = string
  default     = "latest"
  
  validation {
    condition     = length(var.docker_tag) > 0
    error_message = "Docker tag cannot be empty."
  }
}

# -----------------------------------------------------------------------------
# STORAGE VARIABLES
# -----------------------------------------------------------------------------

variable "volume_size" {
  description = "Size of persistent volumes in GB"
  type        = number
  default     = 20
  
  validation {
    condition     = var.volume_size >= 10 && var.volume_size <= 10240
    error_message = "Volume size must be between 10 and 10240 GB."
  }
}

# -----------------------------------------------------------------------------
# DNS VARIABLES
# -----------------------------------------------------------------------------

variable "domain_name" {
  description = "Domain name for the application (leave empty to skip DNS setup)"
  type        = string
  default     = ""
}

variable "soa_email" {
  description = "SOA email for DNS zone"
  type        = string
  default     = "admin@example.com"
  
  validation {
    condition     = can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.soa_email))
    error_message = "SOA email must be a valid email address."
  }
}

variable "dns_refresh_sec" {
  description = "DNS refresh time in seconds"
  type        = number
  default     = 14400
}

variable "dns_retry_sec" {
  description = "DNS retry time in seconds"
  type        = number
  default     = 3600
}

variable "dns_expire_sec" {
  description = "DNS expire time in seconds"
  type        = number
  default     = 604800
}

variable "dns_ttl_sec" {
  description = "DNS TTL in seconds"
  type        = number
  default     = 300
}

variable "dns_record_ttl" {
  description = "DNS record TTL in seconds"
  type        = number
  default     = 300
}

variable "mx_record_target" {
  description = "MX record target (leave empty to skip)"
  type        = string
  default     = ""
}

variable "mx_record_priority" {
  description = "MX record priority"
  type        = number
  default     = 10
}

variable "txt_record_value" {
  description = "TXT record value for domain verification (leave empty to skip)"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# AUTO-SCALING VARIABLES
# -----------------------------------------------------------------------------

variable "enable_auto_scaling" {
  description = "Enable auto-scaling with additional instances"
  type        = bool
  default     = false
}

variable "max_web_servers" {
  description = "Maximum number of web servers when auto-scaling is enabled"
  type        = number
  default     = 5
  
  validation {
    condition     = var.max_web_servers >= 1 && var.max_web_servers <= 20
    error_message = "Maximum web servers must be between 1 and 20."
  }
}

# -----------------------------------------------------------------------------
# OBJECT STORAGE VARIABLES
# -----------------------------------------------------------------------------

variable "enable_object_storage_backups" {
  description = "Enable Object Storage for additional backups"
  type        = bool
  default     = false
}

variable "object_storage_access_key" {
  description = "Object Storage access key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "object_storage_secret_key" {
  description = "Object Storage secret key"
  type        = string
  default     = ""
  sensitive   = true
}

# -----------------------------------------------------------------------------
# MONITORING VARIABLES
# -----------------------------------------------------------------------------

variable "enable_monitoring" {
  description = "Enable monitoring with Linode LongView"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# RESOURCE TAGGING VARIABLES
# -----------------------------------------------------------------------------

variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = list(string)
  default     = []
}

variable "cost_center" {
  description = "Cost center for resource tagging"
  type        = string
  default     = ""
}

variable "owner" {
  description = "Owner of the resources"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# NETWORK SECURITY VARIABLES
# -----------------------------------------------------------------------------

variable "enable_private_networking" {
  description = "Enable private networking for instances"
  type        = bool
  default     = true
}

variable "allowed_http_ips" {
  description = "List of IP addresses/CIDR blocks allowed HTTP access (default: all)"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "allowed_https_ips" {
  description = "List of IP addresses/CIDR blocks allowed HTTPS access (default: all)"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# -----------------------------------------------------------------------------
# APPLICATION CONFIGURATION VARIABLES
# -----------------------------------------------------------------------------

variable "app_port" {
  description = "Port on which the application runs"
  type        = number
  default     = 3000
  
  validation {
    condition     = var.app_port >= 1 && var.app_port <= 65535
    error_message = "Application port must be between 1 and 65535."
  }
}

variable "app_health_check_path" {
  description = "Health check path for the application"
  type        = string
  default     = "/api/health"
  
  validation {
    condition     = can(regex("^/", var.app_health_check_path))
    error_message = "Health check path must start with /."
  }
}

variable "app_environment_variables" {
  description = "Additional environment variables for the application"
  type        = map(string)
  default     = {}
  sensitive   = true
}

# -----------------------------------------------------------------------------
# PERFORMANCE TUNING VARIABLES
# -----------------------------------------------------------------------------

variable "enable_performance_mode" {
  description = "Enable performance optimizations"
  type        = bool
  default     = false
}

variable "cpu_credits" {
  description = "CPU credits specification for burstable instances"
  type        = string
  default     = "standard"
  
  validation {
    condition     = contains(["standard", "unlimited"], var.cpu_credits)
    error_message = "CPU credits must be either 'standard' or 'unlimited'."
  }
}