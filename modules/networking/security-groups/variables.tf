# Security Groups Module Variables
# Multi-cloud security configuration

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

variable "vpc_id" {
  description = "VPC ID where security groups will be created"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block of the VPC"
  type        = string
}

variable "network_name" {
  description = "Name of the network (GCP only)"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}

# Application Configuration
variable "app_port" {
  description = "Port for application servers"
  type        = number
  default     = 8080
}

variable "enable_web_access" {
  description = "Enable HTTP/HTTPS access from internet"
  type        = bool
  default     = true
}

variable "enable_waf" {
  description = "Enable Web Application Firewall"
  type        = bool
  default     = false
}

variable "health_check_ports" {
  description = "List of health check ports"
  type        = list(number)
  default     = [8080, 9090]
}

# SSH Access Configuration
variable "ssh_allowed_cidrs" {
  description = "CIDR blocks allowed for SSH access"
  type        = list(string)
  default     = ["10.0.0.0/16"]
}

variable "enable_database_ssh" {
  description = "Enable SSH access to database servers"
  type        = bool
  default     = false
}

# Database Configuration
variable "database_engines" {
  description = "List of database engines (mysql, postgresql, mongodb, redis)"
  type        = list(string)
  default     = ["postgresql"]
  validation {
    condition = alltrue([
      for engine in var.database_engines : contains(["mysql", "postgresql", "mongodb", "redis"], engine)
    ])
    error_message = "Database engines must be one of: mysql, postgresql, mongodb, redis"
  }
}

# Custom Security Rules
variable "custom_ingress_rules" {
  description = "List of custom ingress rules"
  type = list(object({
    from_port   = number
    to_port     = number
    protocol    = string
    cidr_blocks = list(string)
    description = string
  }))
  default = []
}

variable "custom_egress_rules" {
  description = "List of custom egress rules"
  type = list(object({
    from_port   = number
    to_port     = number
    protocol    = string
    cidr_blocks = list(string)
    description = string
  }))
  default = []
}

# Cloud Provider Specific Variables
variable "gcp_project_id" {
  description = "GCP project ID"
  type        = string
  default     = ""
}

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

# Security Configuration
variable "enable_strict_mode" {
  description = "Enable strict security mode with minimal access"
  type        = bool
  default     = false
}

variable "enable_logging" {
  description = "Enable security group logging"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "Number of days to retain security logs"
  type        = number
  default     = 30
}

# Compliance Configuration
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

# Advanced Security Features
variable "enable_ddos_protection" {
  description = "Enable DDoS protection"
  type        = bool
  default     = false
}

variable "enable_intrusion_detection" {
  description = "Enable intrusion detection"
  type        = bool
  default     = false
}

variable "enable_threat_intelligence" {
  description = "Enable threat intelligence feeds"
  type        = bool
  default     = false
}

# Rate Limiting
variable "enable_rate_limiting" {
  description = "Enable rate limiting rules"
  type        = bool
  default     = false
}

variable "rate_limit_requests_per_minute" {
  description = "Number of requests per minute for rate limiting"
  type        = number
  default     = 1000
}

# IP Whitelisting
variable "ip_whitelist" {
  description = "List of IP addresses/CIDRs to whitelist"
  type        = list(string)
  default     = []
}

variable "ip_blacklist" {
  description = "List of IP addresses/CIDRs to blacklist"
  type        = list(string)
  default     = []
}

# Monitoring and Alerting
variable "enable_security_alerts" {
  description = "Enable security alerts"
  type        = bool
  default     = true
}

variable "alert_email" {
  description = "Email address for security alerts"
  type        = string
  default     = ""
}

variable "alert_sns_topic" {
  description = "SNS topic ARN for security alerts"
  type        = string
  default     = ""
}

# Load Balancer Configuration
variable "enable_load_balancer_sg" {
  description = "Create security group for load balancer"
  type        = bool
  default     = true
}

variable "load_balancer_ports" {
  description = "List of ports for load balancer"
  type        = list(number)
  default     = [80, 443]
}

# Cache Configuration
variable "enable_cache_sg" {
  description = "Create security group for cache servers"
  type        = bool
  default     = true
}

variable "cache_ports" {
  description = "List of cache ports"
  type        = list(number)
  default     = [6379, 11211]
}

# Microservices Configuration
variable "enable_microservices_sg" {
  description = "Create security groups for microservices"
  type        = bool
  default     = false
}

variable "microservices_ports" {
  description = "List of microservice ports"
  type        = list(number)
  default     = [8080, 8090, 9000]
}

# Container Configuration
variable "enable_container_sg" {
  description = "Create security groups for containers"
  type        = bool
  default     = false
}

variable "container_ports" {
  description = "List of container ports"
  type        = list(number)
  default     = [8080, 9090]
}

# Backup and Recovery
variable "enable_backup_sg" {
  description = "Create security group for backup servers"
  type        = bool
  default     = false
}

variable "backup_ports" {
  description = "List of backup service ports"
  type        = list(number)
  default     = [22, 3306, 5432]
}

# Development and Testing
variable "enable_dev_access" {
  description = "Enable development access (less restrictive)"
  type        = bool
  default     = false
}

variable "dev_allowed_cidrs" {
  description = "CIDR blocks allowed for development access"
  type        = list(string)
  default     = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]
}

# Service Mesh Configuration
variable "enable_service_mesh" {
  description = "Enable service mesh security groups"
  type        = bool
  default     = false
}

variable "service_mesh_ports" {
  description = "List of service mesh ports"
  type        = list(number)
  default     = [15000, 15001, 15006]
}

# Serverless Configuration
variable "enable_serverless_sg" {
  description = "Create security groups for serverless functions"
  type        = bool
  default     = false
}

variable "serverless_ports" {
  description = "List of serverless function ports"
  type        = list(number)
  default     = [3000, 8080]
}

# Third-party Integration
variable "enable_third_party_access" {
  description = "Enable third-party service access"
  type        = bool
  default     = false
}

variable "third_party_cidrs" {
  description = "CIDR blocks for third-party services"
  type        = list(string)
  default     = []
}

# Resource Control
variable "create_web_sg" {
  description = "Create web security group"
  type        = bool
  default     = true
}

variable "create_app_sg" {
  description = "Create application security group"
  type        = bool
  default     = true
}

variable "create_database_sg" {
  description = "Create database security group"
  type        = bool
  default     = true
}

variable "create_cache_sg" {
  description = "Create cache security group"
  type        = bool
  default     = true
}

variable "create_load_balancer_sg" {
  description = "Create load balancer security group"
  type        = bool
  default     = true
}

# Naming Configuration
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