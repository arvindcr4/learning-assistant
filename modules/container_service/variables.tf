variable "cloud_provider" {
  description = "Cloud provider (aws, gcp, azure, digitalocean)"
  type        = string
  validation {
    condition     = contains(["aws", "gcp", "azure", "digitalocean"], var.cloud_provider)
    error_message = "Cloud provider must be one of: aws, gcp, azure, digitalocean"
  }
}

variable "name" {
  description = "Name of the container service"
  type        = string
}

variable "image" {
  description = "Container image URL"
  type        = string
}

variable "cpu" {
  description = "CPU units (AWS: 256-4096, GCP: 0.25-8, Azure: 0.25-4)"
  type        = string
  default     = "256"
}

variable "memory" {
  description = "Memory in MB"
  type        = string
  default     = "512"
}

variable "port" {
  description = "Container port"
  type        = number
  default     = 80
}

variable "desired_count" {
  description = "Desired number of instances"
  type        = number
  default     = 2
}

variable "min_count" {
  description = "Minimum number of instances for autoscaling"
  type        = number
  default     = 1
}

variable "max_count" {
  description = "Maximum number of instances for autoscaling"
  type        = number
  default     = 10
}

variable "health_check_path" {
  description = "Health check path"
  type        = string
  default     = "/"
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

variable "health_check_healthy_threshold" {
  description = "Number of consecutive health checks successes required"
  type        = number
  default     = 2
}

variable "health_check_unhealthy_threshold" {
  description = "Number of consecutive health check failures required"
  type        = number
  default     = 3
}

variable "environment_variables" {
  description = "Environment variables for the container"
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "Secret references for the container"
  type        = map(string)
  default     = {}
}

variable "vpc_id" {
  description = "VPC/VNet ID"
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs for the container service"
  type        = list(string)
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
