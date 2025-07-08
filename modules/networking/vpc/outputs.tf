# VPC Module Outputs
# Multi-cloud networking outputs

# VPC Information
output "vpc_id" {
  description = "ID of the VPC"
  value = var.cloud_provider == "aws" ? (
    length(aws_vpc.main) > 0 ? aws_vpc.main[0].id : null
  ) : var.cloud_provider == "gcp" ? (
    length(google_compute_network.main) > 0 ? google_compute_network.main[0].id : null
  ) : var.cloud_provider == "azure" ? (
    length(azurerm_virtual_network.main) > 0 ? azurerm_virtual_network.main[0].id : null
  ) : null
}

output "vpc_arn" {
  description = "ARN of the VPC (AWS only)"
  value = var.cloud_provider == "aws" ? (
    length(aws_vpc.main) > 0 ? aws_vpc.main[0].arn : null
  ) : null
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value = var.cloud_provider == "aws" ? (
    length(aws_vpc.main) > 0 ? aws_vpc.main[0].cidr_block : null
  ) : var.cloud_provider == "gcp" ? (
    var.vpc_cidr
  ) : var.cloud_provider == "azure" ? (
    length(azurerm_virtual_network.main) > 0 ? azurerm_virtual_network.main[0].address_space[0] : null
  ) : null
}

output "vpc_name" {
  description = "Name of the VPC"
  value = var.cloud_provider == "aws" ? (
    length(aws_vpc.main) > 0 ? aws_vpc.main[0].tags.Name : null
  ) : var.cloud_provider == "gcp" ? (
    length(google_compute_network.main) > 0 ? google_compute_network.main[0].name : null
  ) : var.cloud_provider == "azure" ? (
    length(azurerm_virtual_network.main) > 0 ? azurerm_virtual_network.main[0].name : null
  ) : null
}

# Subnet Information
output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value = var.cloud_provider == "aws" ? (
    aws_subnet.public[*].id
  ) : var.cloud_provider == "gcp" ? (
    google_compute_subnetwork.public[*].id
  ) : var.cloud_provider == "azure" ? (
    azurerm_subnet.public[*].id
  ) : []
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value = var.cloud_provider == "aws" ? (
    aws_subnet.private[*].id
  ) : var.cloud_provider == "gcp" ? (
    google_compute_subnetwork.private[*].id
  ) : var.cloud_provider == "azure" ? (
    azurerm_subnet.private[*].id
  ) : []
}

output "public_subnet_cidrs" {
  description = "CIDR blocks of the public subnets"
  value = var.cloud_provider == "aws" ? (
    aws_subnet.public[*].cidr_block
  ) : var.cloud_provider == "gcp" ? (
    google_compute_subnetwork.public[*].ip_cidr_range
  ) : var.cloud_provider == "azure" ? (
    azurerm_subnet.public[*].address_prefixes
  ) : []
}

output "private_subnet_cidrs" {
  description = "CIDR blocks of the private subnets"
  value = var.cloud_provider == "aws" ? (
    aws_subnet.private[*].cidr_block
  ) : var.cloud_provider == "gcp" ? (
    google_compute_subnetwork.private[*].ip_cidr_range
  ) : var.cloud_provider == "azure" ? (
    azurerm_subnet.private[*].address_prefixes
  ) : []
}

output "database_subnet_ids" {
  description = "IDs of the database subnets"
  value = var.cloud_provider == "aws" ? (
    aws_subnet.database[*].id
  ) : var.cloud_provider == "gcp" ? (
    google_compute_subnetwork.database[*].id
  ) : var.cloud_provider == "azure" ? (
    azurerm_subnet.database[*].id
  ) : []
}

output "cache_subnet_ids" {
  description = "IDs of the cache subnets"
  value = var.cloud_provider == "aws" ? (
    aws_subnet.cache[*].id
  ) : var.cloud_provider == "gcp" ? (
    google_compute_subnetwork.cache[*].id
  ) : var.cloud_provider == "azure" ? (
    azurerm_subnet.cache[*].id
  ) : []
}

# Availability Zone Information
output "availability_zones" {
  description = "List of availability zones"
  value = var.cloud_provider == "aws" ? (
    length(data.aws_availability_zones.available) > 0 ? data.aws_availability_zones.available[0].names : []
  ) : var.cloud_provider == "gcp" ? (
    ["${var.gcp_region}-a", "${var.gcp_region}-b", "${var.gcp_region}-c"]
  ) : var.cloud_provider == "azure" ? (
    ["1", "2", "3"]
  ) : []
}

# Gateway Information
output "internet_gateway_id" {
  description = "ID of the Internet Gateway"
  value = var.cloud_provider == "aws" ? (
    length(aws_internet_gateway.main) > 0 ? aws_internet_gateway.main[0].id : null
  ) : null
}

output "nat_gateway_ids" {
  description = "IDs of the NAT Gateways"
  value = var.cloud_provider == "aws" ? (
    aws_nat_gateway.main[*].id
  ) : var.cloud_provider == "gcp" ? (
    google_compute_router_nat.main[*].id
  ) : var.cloud_provider == "azure" ? (
    azurerm_nat_gateway.main[*].id
  ) : []
}

output "nat_gateway_public_ips" {
  description = "Public IP addresses of the NAT Gateways"
  value = var.cloud_provider == "aws" ? (
    aws_eip.nat[*].public_ip
  ) : var.cloud_provider == "azure" ? (
    azurerm_public_ip.nat[*].ip_address
  ) : []
}

# Route Table Information
output "public_route_table_ids" {
  description = "IDs of the public route tables"
  value = var.cloud_provider == "aws" ? (
    aws_route_table.public[*].id
  ) : []
}

output "private_route_table_ids" {
  description = "IDs of the private route tables"
  value = var.cloud_provider == "aws" ? (
    aws_route_table.private[*].id
  ) : []
}

# Security Group Information (Azure)
output "public_security_group_id" {
  description = "ID of the public security group"
  value = var.cloud_provider == "azure" ? (
    length(azurerm_network_security_group.public) > 0 ? azurerm_network_security_group.public[0].id : null
  ) : null
}

output "private_security_group_id" {
  description = "ID of the private security group"
  value = var.cloud_provider == "azure" ? (
    length(azurerm_network_security_group.private) > 0 ? azurerm_network_security_group.private[0].id : null
  ) : null
}

# Flow Logs Information
output "flow_log_id" {
  description = "ID of the VPC Flow Log"
  value = var.cloud_provider == "aws" ? (
    length(aws_flow_log.vpc_flow_log) > 0 ? aws_flow_log.vpc_flow_log[0].id : null
  ) : null
}

output "flow_log_cloudwatch_group" {
  description = "CloudWatch Log Group for VPC Flow Logs"
  value = var.cloud_provider == "aws" ? (
    length(aws_cloudwatch_log_group.vpc_flow_log) > 0 ? aws_cloudwatch_log_group.vpc_flow_log[0].name : null
  ) : null
}

# Network Configuration
output "vpc_dhcp_options_id" {
  description = "ID of the DHCP options set"
  value = var.cloud_provider == "aws" ? (
    length(aws_vpc.main) > 0 ? aws_vpc.main[0].dhcp_options_id : null
  ) : null
}

output "vpc_main_route_table_id" {
  description = "ID of the main route table"
  value = var.cloud_provider == "aws" ? (
    length(aws_vpc.main) > 0 ? aws_vpc.main[0].main_route_table_id : null
  ) : null
}

output "vpc_default_security_group_id" {
  description = "ID of the default security group"
  value = var.cloud_provider == "aws" ? (
    length(aws_vpc.main) > 0 ? aws_vpc.main[0].default_security_group_id : null
  ) : null
}

output "vpc_default_network_acl_id" {
  description = "ID of the default network ACL"
  value = var.cloud_provider == "aws" ? (
    length(aws_vpc.main) > 0 ? aws_vpc.main[0].default_network_acl_id : null
  ) : null
}

# GCP Specific Outputs
output "gcp_network_self_link" {
  description = "Self-link of the GCP network"
  value = var.cloud_provider == "gcp" ? (
    length(google_compute_network.main) > 0 ? google_compute_network.main[0].self_link : null
  ) : null
}

output "gcp_router_id" {
  description = "ID of the GCP router"
  value = var.cloud_provider == "gcp" ? (
    length(google_compute_router.main) > 0 ? google_compute_router.main[0].id : null
  ) : null
}

# Azure Specific Outputs
output "azure_resource_group_name" {
  description = "Name of the Azure resource group"
  value = var.cloud_provider == "azure" ? var.azure_resource_group_name : null
}

output "azure_location" {
  description = "Azure location"
  value = var.cloud_provider == "azure" ? var.azure_location : null
}

# Network Metrics and Monitoring
output "network_monitoring_enabled" {
  description = "Whether network monitoring is enabled"
  value = var.enable_flow_logs
}

output "nat_gateway_count" {
  description = "Number of NAT gateways created"
  value = var.enable_nat_gateway ? length(var.public_subnets) : 0
}

output "multi_az_enabled" {
  description = "Whether multi-AZ deployment is enabled"
  value = var.multi_az && length(var.public_subnets) > 1
}

# Cost Optimization Information
output "single_nat_gateway_enabled" {
  description = "Whether single NAT gateway is enabled for cost optimization"
  value = var.single_nat_gateway
}

output "nat_instance_enabled" {
  description = "Whether NAT instances are used instead of NAT gateways"
  value = var.enable_nat_instance
}

# Security and Compliance
output "compliance_framework" {
  description = "Compliance framework being followed"
  value = var.compliance_framework
}

output "data_classification" {
  description = "Data classification level"
  value = var.data_classification
}

output "network_segmentation_enabled" {
  description = "Whether network segmentation is enabled"
  value = var.enable_network_segmentation
}

# Tags
output "common_tags" {
  description = "Common tags applied to all resources"
  value = merge(
    var.tags,
    {
      Module      = "networking/vpc"
      Environment = var.environment
      Project     = var.project_name
      ManagedBy   = "terraform"
    }
  )
}