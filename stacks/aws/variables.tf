# General Variables
variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
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

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# Network Variables
variable "cidr_block" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = []
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

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnets"
  type        = bool
  default     = true
}

variable "enable_dns_hostnames" {
  description = "Enable DNS hostnames in VPC"
  type        = bool
  default     = true
}

# Container Service Variables
variable "service_name" {
  description = "Name of the ECS service"
  type        = string
}

variable "service_image_tag" {
  description = "Docker image tag"
  type        = string
  default     = "latest"
}

variable "service_cpu" {
  description = "CPU units for the service"
  type        = string
  default     = "256"
}

variable "service_memory" {
  description = "Memory in MB for the service"
  type        = string
  default     = "512"
}

variable "service_port" {
  description = "Container port"
  type        = number
  default     = 3000
}

variable "desired_count" {
  description = "Desired number of tasks"
  type        = number
  default     = 2
}

variable "min_count" {
  description = "Minimum number of tasks"
  type        = number
  default     = 1
}

variable "max_count" {
  description = "Maximum number of tasks"
  type        = number
  default     = 10
}

variable "health_check_path" {
  description = "Health check path"
  type        = string
  default     = "/health"
}

variable "health_check_interval" {
  description = "Health check interval"
  type        = number
  default     = 30
}

variable "health_check_timeout" {
  description = "Health check timeout"
  type        = number
  default     = 5
}

variable "environment_variables" {
  description = "Environment variables for the container"
  type        = map(string)
  default     = {}
}

# Database Variables
variable "db_name" {
  description = "Name of the RDS instance"
  type        = string
}

variable "db_engine_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "15.4"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_storage_type" {
  description = "Storage type"
  type        = string
  default     = "gp3"
}

variable "db_database_name" {
  description = "Default database name"
  type        = string
  default     = "app"
}

variable "db_master_username" {
  description = "Master username"
  type        = string
  default     = "postgres"
}

variable "db_master_password" {
  description = "Master password"
  type        = string
  sensitive   = true
}

variable "db_backup_retention_period" {
  description = "Backup retention period in days"
  type        = number
  default     = 7
}

variable "db_backup_window" {
  description = "Preferred backup window"
  type        = string
  default     = "03:00-04:00"
}

variable "db_maintenance_window" {
  description = "Preferred maintenance window"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

variable "db_multi_az" {
  description = "Enable Multi-AZ deployment"
  type        = bool
  default     = false
}

variable "db_deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = false
}

variable "db_performance_insights" {
  description = "Enable Performance Insights"
  type        = bool
  default     = false
}

# Redis Cache Variables
variable "enable_redis" {
  description = "Enable Redis cache"
  type        = bool
  default     = true
}

variable "cache_name" {
  description = "Name of the ElastiCache instance"
  type        = string
}

variable "cache_node_type" {
  description = "Cache node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "cache_engine_version" {
  description = "Redis version"
  type        = string
  default     = "7.0"
}

variable "cache_num_nodes" {
  description = "Number of cache nodes"
  type        = number
  default     = 1
}

variable "cache_automatic_failover" {
  description = "Enable automatic failover"
  type        = bool
  default     = false
}

variable "cache_multi_az" {
  description = "Enable Multi-AZ"
  type        = bool
  default     = false
}

variable "cache_snapshot_retention" {
  description = "Snapshot retention in days"
  type        = number
  default     = 5
}

# S3 Bucket Variables
variable "bucket_name" {
  description = "S3 bucket name"
  type        = string
}

variable "bucket_versioning" {
  description = "Enable bucket versioning"
  type        = bool
  default     = true
}

variable "bucket_force_destroy" {
  description = "Allow bucket to be destroyed with contents"
  type        = bool
  default     = false
}

variable "log_bucket_name" {
  description = "S3 bucket for logs"
  type        = string
  default     = ""
}

variable "cors_allowed_origins" {
  description = "CORS allowed origins"
  type        = list(string)
  default     = ["*"]
}

# CDN Variables
variable "cdn_name" {
  description = "Name of the CloudFront distribution"
  type        = string
}

variable "cdn_custom_domains" {
  description = "Custom domain names for CloudFront"
  type        = list(string)
  default     = []
}

variable "cdn_price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_100"
}

# Certificate Variables
variable "create_certificate" {
  description = "Create ACM certificate"
  type        = bool
  default     = false
}

variable "certificate_arn" {
  description = "Existing ACM certificate ARN"
  type        = string
  default     = ""
}

variable "domain_name" {
  description = "Domain name for certificate"
  type        = string
  default     = ""
}

variable "subject_alternative_names" {
  description = "Subject alternative names for certificate"
  type        = list(string)
  default     = []
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID"
  type        = string
  default     = ""
}

# Monitoring Variables
variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "alarm_sns_topic_arn" {
  description = "SNS topic ARN for alarms"
  type        = string
  default     = ""
}

# CI/CD Variables
variable "github_oidc_provider" {
  description = "GitHub OIDC provider URL"
  type        = string
  default     = "token.actions.githubusercontent.com"
}

variable "github_repository" {
  description = "GitHub repository (org/repo)"
  type        = string
  default     = ""
}
