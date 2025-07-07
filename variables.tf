# =============================================================================
# TERRAFORM VARIABLES FOR LEARNING ASSISTANT NEXT.JS APPLICATION
# =============================================================================
# This file contains all the input variables for the Terraform configuration.
# These variables allow you to customize the deployment without modifying
# the main infrastructure code.

# =============================================================================
# GENERAL CONFIGURATION
# =============================================================================

variable "aws_region" {
  description = "AWS region where resources will be created"
  type        = string
  default     = "us-east-1"
  
  validation {
    condition = can(regex("^[a-z]{2}-[a-z]+-[0-9]{1}$", var.aws_region))
    error_message = "AWS region must be in the format: us-east-1, eu-west-1, etc."
  }
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
  default     = "prod"
  
  validation {
    condition = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "app_name" {
  description = "Name of the application (used in resource naming)"
  type        = string
  default     = "learning-assistant"
  
  validation {
    condition = can(regex("^[a-zA-Z0-9-]+$", var.app_name))
    error_message = "App name must contain only alphanumeric characters and hyphens."
  }
}

# =============================================================================
# NETWORK CONFIGURATION
# =============================================================================

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
  
  validation {
    condition = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
}

variable "public_subnet_cidrs" {
  description = "List of CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
  
  validation {
    condition = length(var.public_subnet_cidrs) >= 2
    error_message = "At least 2 public subnets are required for high availability."
  }
}

variable "private_subnet_cidrs" {
  description = "List of CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.20.0/24"]
  
  validation {
    condition = length(var.private_subnet_cidrs) >= 2
    error_message = "At least 2 private subnets are required for high availability."
  }
}

variable "database_subnet_cidrs" {
  description = "List of CIDR blocks for database subnets"
  type        = list(string)
  default     = ["10.0.100.0/24", "10.0.200.0/24"]
  
  validation {
    condition = length(var.database_subnet_cidrs) >= 2
    error_message = "At least 2 database subnets are required for RDS high availability."
  }
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for outbound internet access from private subnets"
  type        = bool
  default     = true
}

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================

variable "db_name" {
  description = "Name of the PostgreSQL database"
  type        = string
  default     = "learning_assistant"
  
  validation {
    condition = can(regex("^[a-zA-Z][a-zA-Z0-9_]*$", var.db_name))
    error_message = "Database name must start with a letter and contain only alphanumeric characters and underscores."
  }
}

variable "db_username" {
  description = "Username for the PostgreSQL database"
  type        = string
  default     = "postgres"
  
  validation {
    condition = length(var.db_username) > 0 && length(var.db_username) <= 16
    error_message = "Database username must be between 1 and 16 characters."
  }
}

variable "db_password" {
  description = "Password for the PostgreSQL database"
  type        = string
  sensitive   = true
  
  validation {
    condition = length(var.db_password) >= 8
    error_message = "Database password must be at least 8 characters long."
  }
}

variable "db_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.7"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
  
  validation {
    condition = can(regex("^db\\.[a-z0-9]+\\.[a-z]+$", var.db_instance_class))
    error_message = "Database instance class must be a valid RDS instance type."
  }
}

variable "db_allocated_storage" {
  description = "Initial allocated storage for RDS instance (GB)"
  type        = number
  default     = 20
  
  validation {
    condition = var.db_allocated_storage >= 20 && var.db_allocated_storage <= 65536
    error_message = "Database allocated storage must be between 20 and 65536 GB."
  }
}

variable "db_max_allocated_storage" {
  description = "Maximum allocated storage for RDS instance (GB)"
  type        = number
  default     = 100
  
  validation {
    condition = var.db_max_allocated_storage >= 20 && var.db_max_allocated_storage <= 65536
    error_message = "Database max allocated storage must be between 20 and 65536 GB."
  }
}

variable "db_backup_retention_period" {
  description = "Number of days to retain automated backups"
  type        = number
  default     = 7
  
  validation {
    condition = var.db_backup_retention_period >= 0 && var.db_backup_retention_period <= 35
    error_message = "Backup retention period must be between 0 and 35 days."
  }
}

variable "db_backup_window" {
  description = "Daily time range for automated backups (UTC)"
  type        = string
  default     = "03:00-04:00"
  
  validation {
    condition = can(regex("^[0-2][0-9]:[0-5][0-9]-[0-2][0-9]:[0-5][0-9]$", var.db_backup_window))
    error_message = "Backup window must be in the format HH:MM-HH:MM."
  }
}

variable "db_maintenance_window" {
  description = "Weekly time range for maintenance (UTC)"
  type        = string
  default     = "sun:04:00-sun:05:00"
  
  validation {
    condition = can(regex("^[a-z]{3}:[0-2][0-9]:[0-5][0-9]-[a-z]{3}:[0-2][0-9]:[0-5][0-9]$", var.db_maintenance_window))
    error_message = "Maintenance window must be in the format ddd:HH:MM-ddd:HH:MM."
  }
}

variable "db_monitoring_interval" {
  description = "Interval for collecting enhanced monitoring metrics (seconds)"
  type        = number
  default     = 0
  
  validation {
    condition = contains([0, 1, 5, 10, 15, 30, 60], var.db_monitoring_interval)
    error_message = "Monitoring interval must be one of: 0, 1, 5, 10, 15, 30, 60 seconds."
  }
}

variable "db_performance_insights_enabled" {
  description = "Enable Performance Insights for RDS"
  type        = bool
  default     = true
}

variable "db_skip_final_snapshot" {
  description = "Skip creating final snapshot when destroying RDS instance"
  type        = bool
  default     = false
}

variable "db_deletion_protection" {
  description = "Enable deletion protection for RDS instance"
  type        = bool
  default     = true
}

# =============================================================================
# ECS CONFIGURATION
# =============================================================================

variable "app_image" {
  description = "Docker image for the application"
  type        = string
  default     = "nginx:latest"
}

variable "app_environment_variables" {
  description = "Additional environment variables for the application"
  type = list(object({
    name  = string
    value = string
  }))
  default = []
}

variable "ecs_task_cpu" {
  description = "CPU units for ECS task (1024 = 1 vCPU)"
  type        = number
  default     = 512
  
  validation {
    condition = contains([256, 512, 1024, 2048, 4096], var.ecs_task_cpu)
    error_message = "ECS task CPU must be one of: 256, 512, 1024, 2048, 4096."
  }
}

variable "ecs_task_memory" {
  description = "Memory for ECS task (MB)"
  type        = number
  default     = 1024
  
  validation {
    condition = var.ecs_task_memory >= 512 && var.ecs_task_memory <= 30720
    error_message = "ECS task memory must be between 512 and 30720 MB."
  }
}

variable "ecs_service_desired_count" {
  description = "Desired number of ECS service instances"
  type        = number
  default     = 2
  
  validation {
    condition = var.ecs_service_desired_count >= 1
    error_message = "ECS service desired count must be at least 1."
  }
}

# =============================================================================
# AUTO SCALING CONFIGURATION
# =============================================================================

variable "ecs_autoscaling_min_capacity" {
  description = "Minimum number of ECS service instances"
  type        = number
  default     = 1
  
  validation {
    condition = var.ecs_autoscaling_min_capacity >= 1
    error_message = "ECS autoscaling minimum capacity must be at least 1."
  }
}

variable "ecs_autoscaling_max_capacity" {
  description = "Maximum number of ECS service instances"
  type        = number
  default     = 10
  
  validation {
    condition = var.ecs_autoscaling_max_capacity >= var.ecs_autoscaling_min_capacity
    error_message = "ECS autoscaling maximum capacity must be greater than or equal to minimum capacity."
  }
}

variable "ecs_autoscaling_cpu_threshold" {
  description = "CPU utilization threshold for auto scaling"
  type        = number
  default     = 70
  
  validation {
    condition = var.ecs_autoscaling_cpu_threshold >= 10 && var.ecs_autoscaling_cpu_threshold <= 100
    error_message = "CPU threshold must be between 10 and 100."
  }
}

variable "ecs_autoscaling_memory_threshold" {
  description = "Memory utilization threshold for auto scaling"
  type        = number
  default     = 80
  
  validation {
    condition = var.ecs_autoscaling_memory_threshold >= 10 && var.ecs_autoscaling_memory_threshold <= 100
    error_message = "Memory threshold must be between 10 and 100."
  }
}

# =============================================================================
# LOAD BALANCER CONFIGURATION
# =============================================================================

variable "ssl_certificate_arn" {
  description = "ARN of the SSL certificate for HTTPS"
  type        = string
  default     = ""
}

variable "alb_deletion_protection" {
  description = "Enable deletion protection for ALB"
  type        = bool
  default     = true
}

variable "alb_log_retention_in_days" {
  description = "Number of days to retain ALB access logs"
  type        = number
  default     = 30
  
  validation {
    condition = var.alb_log_retention_in_days >= 1
    error_message = "ALB log retention must be at least 1 day."
  }
}

# =============================================================================
# DNS CONFIGURATION (OPTIONAL)
# =============================================================================

variable "domain_name" {
  description = "Domain name for the application (optional)"
  type        = string
  default     = ""
}

# =============================================================================
# MONITORING AND LOGGING
# =============================================================================

variable "log_retention_in_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 30
  
  validation {
    condition = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_in_days)
    error_message = "Log retention must be one of the allowed CloudWatch log retention values."
  }
}

variable "alert_email" {
  description = "Email address for CloudWatch alarms (optional)"
  type        = string
  default     = ""
  
  validation {
    condition = var.alert_email == "" || can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.alert_email))
    error_message = "Alert email must be a valid email address or empty."
  }
}

# =============================================================================
# TAGS
# =============================================================================

variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}