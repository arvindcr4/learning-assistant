# Security Groups Module Variables

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where security groups will be created"
  type        = string
}

variable "alb_allowed_cidrs" {
  description = "CIDR blocks allowed to access ALB"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "management_cidrs" {
  description = "CIDR blocks for management access to databases"
  type        = list(string)
  default     = []
}

variable "bastion_allowed_cidrs" {
  description = "CIDR blocks allowed to access bastion host"
  type        = list(string)
  default     = []
}

variable "create_bastion_sg" {
  description = "Create bastion host security group"
  type        = bool
  default     = false
}

variable "create_efs_sg" {
  description = "Create EFS security group"
  type        = bool
  default     = false
}

variable "create_lambda_sg" {
  description = "Create Lambda security group"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}