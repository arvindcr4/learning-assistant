# Variables for AWS Infrastructure
# Learning Assistant Application

# Project Configuration
variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "learning-assistant"
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "owner" {
  description = "Owner of the resources"
  type        = string
  default     = "DevOps Team"
}

variable "cost_center" {
  description = "Cost center for resource billing"
  type        = string
  default     = "Engineering"
}

# AWS Region Configuration
variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

# VPC Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "database_subnet_cidrs" {
  description = "CIDR blocks for database subnets"
  type        = list(string)
  default     = ["10.0.20.0/24", "10.0.21.0/24"]
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnets"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Use single NAT Gateway for all private subnets"
  type        = bool
  default     = false
}

# Security Configuration
variable "alb_allowed_cidrs" {
  description = "CIDR blocks allowed to access ALB"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# Domain and SSL Configuration
variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "learning-assistant.example.com"
}

variable "certificate_arn" {
  description = "ARN of SSL certificate in ACM"
  type        = string
  default     = ""
}

variable "enable_https_redirect" {
  description = "Enable HTTP to HTTPS redirect"
  type        = bool
  default     = true
}

variable "create_route53_zone" {
  description = "Create Route 53 hosted zone"
  type        = bool
  default     = false
}

# ECS Configuration
variable "container_image" {
  description = "Docker image for the application"
  type        = string
  default     = "nginx:latest"
}

variable "container_port" {
  description = "Port on which the application runs"
  type        = number
  default     = 3000
}

variable "task_cpu" {
  description = "CPU units for ECS task"
  type        = number
  default     = 512
}

variable "task_memory" {
  description = "Memory (MiB) for ECS task"
  type        = number
  default     = 1024
}

variable "task_desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 2
}

variable "enable_auto_scaling" {
  description = "Enable auto scaling for ECS service"
  type        = bool
  default     = true
}

variable "min_capacity" {
  description = "Minimum number of tasks"
  type        = number
  default     = 1
}

variable "max_capacity" {
  description = "Maximum number of tasks"
  type        = number
  default     = 10
}

# Environment Variables for ECS
variable "environment_variables" {
  description = "Environment variables for ECS tasks"
  type        = map(string)
  default = {
    NODE_ENV = "production"
    PORT     = "3000"
  }
}

# Secrets from Parameter Store
variable "secrets" {
  description = "Secrets from Parameter Store for ECS tasks"
  type        = map(string)
  default = {
    DATABASE_URL = "database-url"
    REDIS_URL    = "redis-url"
    JWT_SECRET   = "jwt-secret"
  }
}

# RDS Configuration
variable "db_name" {
  description = "Database name"
  type        = string
  default     = "learning_assistant"
}

variable "db_username" {
  description = "Database username"
  type        = string
  default     = "postgres"
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
  default     = ""
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "allocated_storage" {
  description = "Allocated storage for RDS instance (GB)"
  type        = number
  default     = 20
}

variable "max_allocated_storage" {
  description = "Maximum allocated storage for RDS instance (GB)"
  type        = number
  default     = 100
}

variable "storage_type" {
  description = "Storage type for RDS instance"
  type        = string
  default     = "gp2"
}

variable "storage_encrypted" {
  description = "Enable storage encryption"
  type        = bool
  default     = true
}

variable "multi_az" {
  description = "Enable Multi-AZ deployment"
  type        = bool
  default     = true
}

variable "backup_retention_period" {
  description = "Backup retention period (days)"
  type        = number
  default     = 7
}

variable "backup_window" {
  description = "Backup window"
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "Maintenance window"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

variable "create_read_replica" {
  description = "Create read replica"
  type        = bool
  default     = false
}

variable "monitoring_interval" {
  description = "Enhanced monitoring interval"
  type        = number
  default     = 60
}

variable "performance_insights_enabled" {
  description = "Enable Performance Insights"
  type        = bool
  default     = true
}

# ElastiCache Redis Configuration
variable "redis_node_type" {
  description = "Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes"
  type        = number
  default     = 1
}

variable "redis_parameter_group_name" {
  description = "Redis parameter group name"
  type        = string
  default     = "default.redis6.x"
}

variable "redis_engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "6.2"
}

variable "redis_port" {
  description = "Redis port"
  type        = number
  default     = 6379
}

variable "redis_snapshot_retention_limit" {
  description = "Redis snapshot retention limit"
  type        = number
  default     = 5
}

variable "redis_snapshot_window" {
  description = "Redis snapshot window"
  type        = string
  default     = "03:00-05:00"
}

variable "redis_auth_token_enabled" {
  description = "Enable Redis auth token"
  type        = bool
  default     = true
}

variable "redis_transit_encryption_enabled" {
  description = "Enable Redis transit encryption"
  type        = bool
  default     = true
}

variable "redis_at_rest_encryption_enabled" {
  description = "Enable Redis at-rest encryption"
  type        = bool
  default     = true
}

# Health Check Configuration
variable "enable_health_check" {
  description = "Enable Route 53 health check"
  type        = bool
  default     = true
}

variable "health_check_path" {
  description = "Health check path"
  type        = string
  default     = "/api/health"
}

# Monitoring and Alerting
variable "sns_topic_arn" {
  description = "SNS topic ARN for alerts"
  type        = string
  default     = ""
}

variable "cpu_threshold_high" {
  description = "CPU threshold for high utilization alert"
  type        = number
  default     = 80
}

variable "memory_threshold_high" {
  description = "Memory threshold for high utilization alert"
  type        = number
  default     = 80
}

# Parameter Store Configuration
variable "parameter_store_parameters" {
  description = "List of Parameter Store parameters to grant access to"
  type        = list(string)
  default     = []
}

variable "parameter_store_secrets" {
  description = "Map of secrets to store in Parameter Store"
  type        = map(string)
  default     = {}
  sensitive   = true
}

# S3 Configuration
variable "s3_bucket_arns" {
  description = "List of S3 bucket ARNs for IAM access"
  type        = list(string)
  default     = []
}