# General Variables
variable "do_token" {
  description = "DigitalOcean API Token"
  type        = string
  sensitive   = true
}

variable "name" {
  description = "Name prefix for all resources"
  type        = string
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "region" {
  description = "DigitalOcean region"
  type        = string
  default     = "nyc3"
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = list(string)
  default     = []
}

# VPC Variables
variable "vpc_ip_range" {
  description = "IP range for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

# Container Registry Variables
variable "registry_tier" {
  description = "Container registry subscription tier"
  type        = string
  default     = "starter"
}

# PostgreSQL Variables
variable "postgres_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "15"
}

variable "postgres_size" {
  description = "PostgreSQL instance size"
  type        = string
  default     = "db-s-1vcpu-1gb"
}

variable "postgres_node_count" {
  description = "Number of PostgreSQL nodes"
  type        = number
  default     = 1
}

variable "postgres_db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "app"
}

variable "postgres_user" {
  description = "PostgreSQL username"
  type        = string
  default     = "appuser"
}

variable "postgres_backup_retention" {
  description = "Days to retain PostgreSQL backups"
  type        = number
  default     = 7
}

variable "enable_db_connection_pool" {
  description = "Enable database connection pooling"
  type        = bool
  default     = true
}

variable "db_pool_size" {
  description = "Database connection pool size"
  type        = number
  default     = 25
}

# Redis Variables
variable "enable_redis" {
  description = "Enable Redis cache"
  type        = bool
  default     = true
}

variable "redis_version" {
  description = "Redis version"
  type        = string
  default     = "7"
}

variable "redis_size" {
  description = "Redis instance size"
  type        = string
  default     = "db-s-1vcpu-1gb"
}

variable "redis_node_count" {
  description = "Number of Redis nodes"
  type        = number
  default     = 1
}

variable "redis_eviction_policy" {
  description = "Redis eviction policy"
  type        = string
  default     = "allkeys-lru"
}

# Spaces Variables
variable "bucket_name" {
  description = "Name for the DigitalOcean Spaces bucket"
  type        = string
}

variable "spaces_region" {
  description = "Region for Spaces (if different from main region)"
  type        = string
  default     = ""
}

variable "bucket_acl" {
  description = "ACL for Spaces bucket"
  type        = string
  default     = "private"
}

variable "enable_versioning" {
  description = "Enable versioning for Spaces bucket"
  type        = bool
  default     = true
}

variable "enable_lifecycle_rules" {
  description = "Enable lifecycle rules for Spaces bucket"
  type        = bool
  default     = true
}

variable "temp_files_expiration_days" {
  description = "Days to retain temporary files"
  type        = number
  default     = 7
}

variable "backup_expiration_days" {
  description = "Days to retain backup files"
  type        = number
  default     = 90
}

variable "enable_public_read" {
  description = "Enable public read access for bucket"
  type        = bool
  default     = false
}

# CORS Variables
variable "cors_allowed_headers" {
  description = "CORS allowed headers"
  type        = list(string)
  default     = ["*"]
}

variable "cors_allowed_methods" {
  description = "CORS allowed methods"
  type        = list(string)
  default     = ["GET", "PUT", "POST", "DELETE"]
}

variable "cors_allowed_origins" {
  description = "CORS allowed origins"
  type        = list(string)
  default     = ["*"]
}

variable "cors_max_age_seconds" {
  description = "CORS max age in seconds"
  type        = number
  default     = 3000
}

# CDN Variables
variable "enable_cdn" {
  description = "Enable CDN for Spaces"
  type        = bool
  default     = true
}

variable "cdn_custom_domain" {
  description = "Custom domain for CDN"
  type        = string
  default     = ""
}

variable "cdn_certificate_id" {
  description = "Certificate ID for CDN custom domain"
  type        = string
  default     = ""
}

variable "cdn_ttl" {
  description = "CDN cache TTL in seconds"
  type        = number
  default     = 3600
}

# App Platform Variables
variable "app_environment" {
  description = "App Platform environment"
  type        = string
  default     = "production"
}

variable "app_instance_count" {
  description = "Number of app instances"
  type        = number
  default     = 1
}

variable "app_instance_size" {
  description = "App instance size"
  type        = string
  default     = "basic-xs"
}

variable "app_image_repository" {
  description = "Docker image repository name"
  type        = string
}

variable "app_image_tag" {
  description = "Docker image tag"
  type        = string
  default     = "latest"
}

variable "app_port" {
  description = "Application port"
  type        = number
  default     = 3000
}

variable "app_env_vars" {
  description = "Environment variables for the app"
  type        = map(string)
  default     = {}
}

# Health Check Variables
variable "health_check_path" {
  description = "Health check path"
  type        = string
  default     = "/health"
}

variable "health_check_initial_delay" {
  description = "Health check initial delay in seconds"
  type        = number
  default     = 30
}

variable "health_check_period" {
  description = "Health check period in seconds"
  type        = number
  default     = 30
}

variable "health_check_timeout" {
  description = "Health check timeout in seconds"
  type        = number
  default     = 5
}

variable "health_check_success_threshold" {
  description = "Health check success threshold"
  type        = number
  default     = 2
}

variable "health_check_failure_threshold" {
  description = "Health check failure threshold"
  type        = number
  default     = 3
}

# Monitoring Variables
variable "alert_emails" {
  description = "Email addresses for alerts"
  type        = list(string)
  default     = []
}

variable "slack_channel" {
  description = "Slack channel for alerts"
  type        = string
  default     = ""
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for alerts"
  type        = string
  default     = ""
  sensitive   = true
}

variable "cpu_alert_threshold" {
  description = "CPU usage threshold for alerts (%)"
  type        = number
  default     = 80
}

variable "memory_alert_threshold" {
  description = "Memory usage threshold for alerts (%)"
  type        = number
  default     = 80
}

variable "db_cpu_alert_threshold" {
  description = "Database CPU usage threshold for alerts (%)"
  type        = number
  default     = 75
}

# Project Variables
variable "project_purpose" {
  description = "Purpose of the project"
  type        = string
  default     = "Web Application"
}

