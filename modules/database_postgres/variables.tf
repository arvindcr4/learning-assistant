variable "cloud_provider" {
  description = "Cloud provider (aws, gcp, azure, digitalocean)"
  type        = string
  validation {
    condition     = contains(["aws", "gcp", "azure", "digitalocean"], var.cloud_provider)
    error_message = "Cloud provider must be one of: aws, gcp, azure, digitalocean"
  }
}

variable "name" {
  description = "Name of the database instance"
  type        = string
}

variable "engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "13"
}

variable "instance_class" {
  description = "Instance class/size (provider-specific)"
  type        = string
  default     = "db.t3.micro"  # AWS default
}

variable "allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
  default     = 20
}

variable "storage_type" {
  description = "Storage type (gp2, gp3, io1 for AWS)"
  type        = string
  default     = "gp3"
}

variable "database_name" {
  description = "Name of the default database"
  type        = string
  default     = "app"
}

variable "master_username" {
  description = "Master username"
  type        = string
  default     = "postgres"
}

variable "master_password" {
  description = "Master password (should be provided via environment variable)"
  type        = string
  sensitive   = true
}

variable "backup_retention_period" {
  description = "Backup retention period in days"
  type        = number
  default     = 7
}

variable "backup_window" {
  description = "Preferred backup window (UTC)"
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "Preferred maintenance window"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

variable "multi_az" {
  description = "Enable Multi-AZ deployment for high availability"
  type        = bool
  default     = false
}

variable "publicly_accessible" {
  description = "Make database publicly accessible"
  type        = bool
  default     = false
}

variable "vpc_id" {
  description = "VPC/VNet ID"
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs for the database"
  type        = list(string)
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to connect to the database"
  type        = list(string)
  default     = []
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}

variable "enable_encryption" {
  description = "Enable encryption at rest"
  type        = bool
  default     = true
}

variable "performance_insights_enabled" {
  description = "Enable performance insights"
  type        = bool
  default     = false
}

variable "enable_logging" {
  description = "Enable database logging"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
