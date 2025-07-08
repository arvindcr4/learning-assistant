# ECS Module Variables

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "cluster_name" {
  description = "Name of the ECS cluster"
  type        = string
}

variable "service_name" {
  description = "Name of the ECS service"
  type        = string
}

variable "container_image" {
  description = "Docker image for the application"
  type        = string
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

variable "execution_role_arn" {
  description = "ARN of the ECS task execution role"
  type        = string
}

variable "task_role_arn" {
  description = "ARN of the ECS task role"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs"
  type        = list(string)
}

variable "security_group_ids" {
  description = "List of security group IDs"
  type        = list(string)
}

variable "target_group_arn" {
  description = "ARN of the target group"
  type        = string
}

variable "environment_variables" {
  description = "Environment variables for ECS tasks"
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "Secrets from Parameter Store for ECS tasks"
  type        = map(string)
  default     = {}
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

variable "cpu_target_value" {
  description = "Target CPU utilization for auto scaling"
  type        = number
  default     = 70
}

variable "memory_target_value" {
  description = "Target memory utilization for auto scaling"
  type        = number
  default     = 80
}

variable "requests_target_value" {
  description = "Target request count per target for auto scaling"
  type        = number
  default     = 1000
}

variable "alb_arn_suffix" {
  description = "ARN suffix of the ALB"
  type        = string
  default     = ""
}

variable "target_group_arn_suffix" {
  description = "ARN suffix of the target group"
  type        = string
  default     = ""
}

variable "alb_target_group_arn" {
  description = "ARN of the ALB target group"
  type        = string
  default     = ""
}

variable "enable_service_discovery" {
  description = "Enable service discovery"
  type        = bool
  default     = false
}

variable "service_discovery_arn" {
  description = "ARN of the service discovery service"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}