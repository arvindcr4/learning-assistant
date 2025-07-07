# Main Terraform configuration file
# This file contains the primary resource definitions for your infrastructure

# Example resource configuration (to be customized based on your needs)
# resource "example_resource" "main" {
#   name = var.project_name
#   tags = local.common_tags
# }

# Local values for common configurations
locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}
