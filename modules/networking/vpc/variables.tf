# VPC Module Variables
# Multi-cloud networking configuration

variable "cloud_provider" {
  description = "Cloud provider to use (aws, gcp, azure)"
  type        = string
  validation {
    condition     = contains(["aws", "gcp", "azure"], var.cloud_provider)
    error_message = "Cloud provider must be one of: aws, gcp, azure"
  }
}

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

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block"
  }
}

variable "public_subnets" {
  description = "List of public subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  validation {
    condition = alltrue([
      for subnet in var.public_subnets : can(cidrhost(subnet, 0))
    ])
    error_message = "All public subnets must be valid IPv4 CIDR blocks"
  }
}

variable "private_subnets" {
  description = "List of private subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.20.0/24", "10.0.30.0/24"]
  validation {
    condition = alltrue([
      for subnet in var.private_subnets : can(cidrhost(subnet, 0))
    ])
    error_message = "All private subnets must be valid IPv4 CIDR blocks"
  }
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnets"
  type        = bool
  default     = true
}

variable "enable_flow_logs" {
  description = "Enable VPC Flow Logs"
  type        = bool
  default     = true
}

variable "flow_log_retention_days" {
  description = "Number of days to retain flow logs"
  type        = number
  default     = 30
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}

# AWS-specific variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

# GCP-specific variables
variable "gcp_project_id" {
  description = "GCP project ID"
  type        = string
  default     = ""
}

variable "gcp_region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

# Azure-specific variables
variable "azure_location" {
  description = "Azure location"
  type        = string
  default     = "West US 2"
}

variable "azure_resource_group_name" {
  description = "Azure resource group name"
  type        = string
  default     = ""
}

# Network Security Configuration
variable "enable_dns_hostnames" {
  description = "Enable DNS hostnames in VPC"
  type        = bool
  default     = true
}

variable "enable_dns_support" {
  description = "Enable DNS support in VPC"
  type        = bool
  default     = true
}

variable "enable_ipv6" {
  description = "Enable IPv6 support"
  type        = bool
  default     = false
}

# High Availability Configuration
variable "multi_az" {
  description = "Deploy resources across multiple availability zones"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Use single NAT Gateway for all AZs (cost optimization)"
  type        = bool
  default     = false
}

# Security Configuration
variable "enable_network_acls" {
  description = "Enable custom Network ACLs"
  type        = bool
  default     = true
}

variable "enable_private_dns" {
  description = "Enable private DNS zones"
  type        = bool
  default     = true
}

# Monitoring and Logging
variable "enable_vpc_endpoint_logs" {
  description = "Enable VPC endpoint logs"
  type        = bool
  default     = true
}

variable "log_format" {
  description = "Format for flow logs"
  type        = string
  default     = "$${version} $${account-id} $${interface-id} $${srcaddr} $${dstaddr} $${srcport} $${dstport} $${protocol} $${packets} $${bytes} $${windowstart} $${windowend} $${action} $${flowlogstatus}"
}

# Cost Optimization
variable "enable_nat_instance" {
  description = "Use NAT instances instead of NAT gateways for cost optimization"
  type        = bool
  default     = false
}

variable "nat_instance_type" {
  description = "Instance type for NAT instances"
  type        = string
  default     = "t3.nano"
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

# Backup and Disaster Recovery
variable "enable_cross_region_backup" {
  description = "Enable cross-region backup for disaster recovery"
  type        = bool
  default     = false
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
}

# Network Segmentation
variable "enable_network_segmentation" {
  description = "Enable network segmentation with dedicated subnets"
  type        = bool
  default     = true
}

variable "database_subnets" {
  description = "CIDR blocks for database subnets"
  type        = list(string)
  default     = ["10.0.40.0/24", "10.0.50.0/24", "10.0.60.0/24"]
}

variable "cache_subnets" {
  description = "CIDR blocks for cache subnets"
  type        = list(string)
  default     = ["10.0.70.0/24", "10.0.80.0/24", "10.0.90.0/24"]
}

# Advanced Networking
variable "enable_transit_gateway" {
  description = "Enable transit gateway for multi-VPC connectivity"
  type        = bool
  default     = false
}

variable "enable_vpc_peering" {
  description = "Enable VPC peering connections"
  type        = bool
  default     = false
}

variable "peering_vpc_ids" {
  description = "List of VPC IDs to peer with"
  type        = list(string)
  default     = []
}

# Resource Naming
variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
  default     = ""
}

variable "name_suffix" {
  description = "Suffix for resource names"
  type        = string
  default     = ""
}

# Module Configuration
variable "module_enabled" {
  description = "Enable/disable the entire module"
  type        = bool
  default     = true
}

variable "create_vpc" {
  description = "Create VPC resources"
  type        = bool
  default     = true
}

variable "create_subnets" {
  description = "Create subnet resources"
  type        = bool
  default     = true
}

variable "create_route_tables" {
  description = "Create route table resources"
  type        = bool
  default     = true
}

variable "create_internet_gateway" {
  description = "Create internet gateway"
  type        = bool
  default     = true
}

variable "create_nat_gateway" {
  description = "Create NAT gateway"
  type        = bool
  default     = true
}