# ECS Module Variables
# Enterprise-grade ECS configuration

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}

# Networking Configuration
variable "vpc_id" {
  description = "VPC ID where ECS resources will be created"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for ECS tasks"
  type        = list(string)
}

variable "public_subnet_ids" {
  description = "List of public subnet IDs for load balancer"
  type        = list(string)
  default     = []
}

# ECS Cluster Configuration
variable "capacity_providers" {
  description = "List of capacity providers for the cluster"
  type        = list(string)
  default     = ["FARGATE", "FARGATE_SPOT"]
}

variable "default_capacity_provider_strategy" {
  description = "Default capacity provider strategy"
  type = list(object({
    capacity_provider = string
    weight           = number
    base            = number
  }))
  default = [
    {
      capacity_provider = "FARGATE"
      weight           = 100
      base            = 1
    }
  ]
}

variable "enable_container_insights" {
  description = "Enable CloudWatch Container Insights"
  type        = bool
  default     = true
}

# Task Configuration
variable "launch_type" {
  description = "Launch type for ECS tasks (FARGATE or EC2)"
  type        = string
  default     = "FARGATE"
  validation {
    condition     = contains(["FARGATE", "EC2"], var.launch_type)
    error_message = "Launch type must be either FARGATE or EC2"
  }
}

variable "platform_version" {
  description = "Platform version for Fargate tasks"
  type        = string
  default     = "LATEST"
}

variable "network_mode" {
  description = "Network mode for the task definition"
  type        = string
  default     = "awsvpc"
}

variable "task_cpu" {
  description = "CPU units for the task (1024 = 1 vCPU)"
  type        = number
  default     = 256
}

variable "task_memory" {
  description = "Memory for the task in MB"
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Desired number of tasks"
  type        = number
  default     = 2
}

variable "assign_public_ip" {
  description = "Assign public IP to Fargate tasks"
  type        = bool
  default     = false
}

# Container Configuration
variable "container_name" {
  description = "Name of the container"
  type        = string
  default     = "app"
}

variable "container_image" {
  description = "Docker image for the container"
  type        = string
}

variable "container_port" {
  description = "Port exposed by the container"
  type        = number
  default     = 80
}

variable "environment_variables" {
  description = "Environment variables for the container"
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "Secrets for the container (from Systems Manager Parameter Store or Secrets Manager)"
  type        = map(string)
  default     = {}
}

# Health Check Configuration
variable "health_check_enabled" {
  description = "Enable container health check"
  type        = bool
  default     = true
}

variable "health_check_command" {
  description = "Health check command"
  type        = list(string)
  default     = ["CMD-SHELL", "curl -f http://localhost/ || exit 1"]
}

variable "health_check_interval" {
  description = "Health check interval in seconds"
  type        = number
  default     = 30
}

variable "health_check_timeout" {
  description = "Health check timeout in seconds"
  type        = number
  default     = 5
}

variable "health_check_retries" {
  description = "Health check retries"
  type        = number
  default     = 3
}

# Load Balancer Health Check Configuration
variable "health_check_path" {
  description = "Health check path for load balancer"
  type        = string
  default     = "/"
}

variable "health_check_matcher" {
  description = "Health check matcher (HTTP status codes)"
  type        = string
  default     = "200"
}

variable "health_check_healthy_threshold" {
  description = "Number of consecutive successful health checks"
  type        = number
  default     = 2
}

variable "health_check_unhealthy_threshold" {
  description = "Number of consecutive failed health checks"
  type        = number
  default     = 2
}

variable "health_check_timeout_seconds" {
  description = "Health check timeout in seconds"
  type        = number
  default     = 5
}

variable "health_check_interval_seconds" {
  description = "Health check interval in seconds"
  type        = number
  default     = 30
}

# Service Configuration
variable "capacity_provider_strategy" {
  description = "Capacity provider strategy for the service"
  type = list(object({
    capacity_provider = string
    weight           = number
    base            = number
  }))
  default = []
}

variable "deployment_maximum_percent" {
  description = "Maximum percentage of tasks that can be running during deployment"
  type        = number
  default     = 200
}

variable "deployment_minimum_healthy_percent" {
  description = "Minimum percentage of tasks that must remain healthy during deployment"
  type        = number
  default     = 100
}

variable "enable_circuit_breaker" {
  description = "Enable deployment circuit breaker"
  type        = bool
  default     = true
}

variable "enable_rollback" {
  description = "Enable automatic rollback on deployment failure"
  type        = bool
  default     = true
}

variable "enable_execute_command" {
  description = "Enable ECS Exec for debugging"
  type        = bool
  default     = false
}

# Load Balancer Configuration
variable "create_load_balancer" {
  description = "Create an Application Load Balancer"
  type        = bool
  default     = true
}

variable "internal_load_balancer" {
  description = "Create an internal load balancer"
  type        = bool
  default     = false
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection for load balancer"
  type        = bool
  default     = true
}

variable "load_balancer_config" {
  description = "Load balancer configuration"
  type = list(object({
    target_group_arn = string
    container_name   = string
    container_port   = number
  }))
  default = []
}

variable "load_balancer_security_group_ids" {
  description = "Security group IDs for load balancer access"
  type        = list(string)
  default     = []
}

# Auto Scaling Configuration
variable "enable_autoscaling" {
  description = "Enable auto scaling for the ECS service"
  type        = bool
  default     = true
}

variable "autoscaling_min_capacity" {
  description = "Minimum number of tasks for auto scaling"
  type        = number
  default     = 1
}

variable "autoscaling_max_capacity" {
  description = "Maximum number of tasks for auto scaling"
  type        = number
  default     = 10
}

variable "autoscaling_target_cpu" {
  description = "Target CPU utilization for auto scaling"
  type        = number
  default     = 70
}

# EC2 Configuration (for EC2 launch type)
variable "instance_type" {
  description = "EC2 instance type for ECS instances"
  type        = string
  default     = "t3.medium"
}

variable "ami_id" {
  description = "AMI ID for ECS instances (leave empty for latest ECS-optimized AMI)"
  type        = string
  default     = ""
}

variable "min_capacity" {
  description = "Minimum number of EC2 instances"
  type        = number
  default     = 1
}

variable "max_capacity" {
  description = "Maximum number of EC2 instances"
  type        = number
  default     = 3
}

variable "desired_capacity" {
  description = "Desired number of EC2 instances"
  type        = number
  default     = 2
}

variable "enable_ssh_access" {
  description = "Enable SSH access to EC2 instances"
  type        = bool
  default     = false
}

variable "ssh_allowed_cidrs" {
  description = "CIDR blocks allowed for SSH access"
  type        = list(string)
  default     = ["10.0.0.0/8"]
}

variable "block_device_mappings" {
  description = "Block device mappings for EC2 instances"
  type = list(object({
    device_name = string
    volume_size = number
    volume_type = string
  }))
  default = [
    {
      device_name = "/dev/xvda"
      volume_size = 30
      volume_type = "gp3"
    }
  ]
}

# Storage Configuration
variable "volumes" {
  description = "ECS task volumes"
  type = list(object({
    name      = string
    host_path = string
    efs_volume_configuration = object({
      file_system_id          = string
      root_directory          = string
      transit_encryption      = string
      transit_encryption_port = number
      authorization_config = object({
        access_point_id = string
        iam            = string
      })
    })
  }))
  default = []
}

variable "mount_points" {
  description = "Container mount points"
  type = list(object({
    source_volume  = string
    container_path = string
    read_only      = bool
  }))
  default = []
}

# Security Configuration
variable "enable_encryption" {
  description = "Enable encryption for ECS resources"
  type        = bool
  default     = true
}

variable "kms_deletion_window" {
  description = "KMS key deletion window in days"
  type        = number
  default     = 7
}

variable "enable_exec_logging" {
  description = "Enable logging for ECS Exec"
  type        = bool
  default     = true
}

# Logging Configuration
variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "enable_access_logs" {
  description = "Enable load balancer access logs"
  type        = bool
  default     = false
}

variable "access_logs_bucket" {
  description = "S3 bucket for load balancer access logs"
  type        = string
  default     = ""
}

variable "access_logs_prefix" {
  description = "Prefix for load balancer access logs"
  type        = string
  default     = "alb-logs"
}

# Service Discovery
variable "service_registries" {
  description = "Service registries for ECS service"
  type = list(object({
    registry_arn   = string
    port           = number
    container_name = string
    container_port = number
  }))
  default = []
}

# Advanced Configuration
variable "ulimits" {
  description = "Container ulimits"
  type = list(object({
    name      = string
    softLimit = number
    hardLimit = number
  }))
  default = []
}

variable "enable_init_process" {
  description = "Enable init process for container"
  type        = bool
  default     = false
}

variable "enable_firelens" {
  description = "Enable FireLens for log routing"
  type        = bool
  default     = false
}

# IAM Configuration
variable "task_role_policy_arns" {
  description = "List of IAM policy ARNs to attach to the task role"
  type        = list(string)
  default     = []
}

variable "custom_task_policy" {
  description = "Custom IAM policy for the task role"
  type        = string
  default     = ""
}

variable "custom_execution_policy" {
  description = "Custom IAM policy for the execution role"
  type        = string
  default     = ""
}

# Target Group Configuration
variable "target_group_arns" {
  description = "List of target group ARNs for Auto Scaling Group"
  type        = list(string)
  default     = []
}

# Cost Optimization
variable "enable_spot_instances" {
  description = "Enable Spot instances for cost optimization"
  type        = bool
  default     = false
}

variable "spot_instance_types" {
  description = "List of instance types for Spot instances"
  type        = list(string)
  default     = ["t3.medium", "t3.large"]
}

# Monitoring and Alerting
variable "enable_detailed_monitoring" {
  description = "Enable detailed monitoring for EC2 instances"
  type        = bool
  default     = true
}

variable "enable_performance_insights" {
  description = "Enable Performance Insights for monitoring"
  type        = bool
  default     = false
}

# Compliance and Governance
variable "compliance_framework" {
  description = "Compliance framework to follow (pci-dss, hipaa, soc2, gdpr)"
  type        = string
  default     = "none"
  validation {
    condition     = contains(["none", "pci-dss", "hipaa", "soc2", "gdpr"], var.compliance_framework)
    error_message = "Compliance framework must be one of: none, pci-dss, hipaa, soc2, gdpr"
  }
}

variable "data_classification" {
  description = "Data classification level (public, internal, confidential, restricted)"
  type        = string
  default     = "internal"
  validation {
    condition     = contains(["public", "internal", "confidential", "restricted"], var.data_classification)
    error_message = "Data classification must be one of: public, internal, confidential, restricted"
  }
}

# Resource Control
variable "create_ecs_cluster" {
  description = "Create ECS cluster"
  type        = bool
  default     = true
}

variable "create_ecs_service" {
  description = "Create ECS service"
  type        = bool
  default     = true
}

variable "create_task_definition" {
  description = "Create ECS task definition"
  type        = bool
  default     = true
}

variable "create_auto_scaling_group" {
  description = "Create Auto Scaling Group for EC2 launch type"
  type        = bool
  default     = true
}