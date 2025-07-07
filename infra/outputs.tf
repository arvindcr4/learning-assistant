# Terraform outputs definition
# Define output values that will be displayed after apply

# Example outputs (to be customized based on your resources)

# General outputs
output "project_name" {
  description = "The name of the project"
  value       = var.project_name
}

output "environment" {
  description = "The deployment environment"
  value       = var.environment
}

# Resource-specific outputs (examples)
# output "vpc_id" {
#   description = "ID of the VPC"
#   value       = module.network.vpc_id
# }

# output "load_balancer_url" {
#   description = "URL of the load balancer"
#   value       = module.load_balancer.url
# }

# output "database_endpoint" {
#   description = "Database connection endpoint"
#   value       = module.database.endpoint
#   sensitive   = true
# }
