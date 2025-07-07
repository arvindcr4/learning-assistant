# Terraform variables definition
# Define input variables for the infrastructure

# General variables
variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "my-project"
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
  default     = "dev"
}

# AWS-specific variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

# GCP-specific variables
variable "gcp_project_id" {
  description = "Google Cloud project ID"
  type        = string
  default     = ""
}

variable "gcp_region" {
  description = "Google Cloud region"
  type        = string
  default     = "us-central1"
}

# Azure-specific variables
variable "azure_location" {
  description = "Azure location"
  type        = string
  default     = "East US"
}

# DigitalOcean-specific variables
variable "do_region" {
  description = "DigitalOcean region"
  type        = string
  default     = "nyc3"
}

# Tags and labels
variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}
