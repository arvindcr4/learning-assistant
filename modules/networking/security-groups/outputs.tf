# Security Groups Module Outputs
# Multi-cloud security group outputs

# AWS Security Group IDs
output "web_security_group_id" {
  description = "ID of the web security group"
  value = var.cloud_provider == "aws" ? (
    length(aws_security_group.web) > 0 ? aws_security_group.web[0].id : null
  ) : var.cloud_provider == "gcp" ? (
    length(google_compute_firewall.web) > 0 ? google_compute_firewall.web[0].id : null
  ) : var.cloud_provider == "azure" ? (
    length(azurerm_network_security_group.web) > 0 ? azurerm_network_security_group.web[0].id : null
  ) : null
}

output "app_security_group_id" {
  description = "ID of the application security group"
  value = var.cloud_provider == "aws" ? (
    length(aws_security_group.app) > 0 ? aws_security_group.app[0].id : null
  ) : var.cloud_provider == "gcp" ? (
    length(google_compute_firewall.app) > 0 ? google_compute_firewall.app[0].id : null
  ) : var.cloud_provider == "azure" ? (
    length(azurerm_network_security_group.app) > 0 ? azurerm_network_security_group.app[0].id : null
  ) : null
}

output "database_security_group_id" {
  description = "ID of the database security group"
  value = var.cloud_provider == "aws" ? (
    length(aws_security_group.database) > 0 ? aws_security_group.database[0].id : null
  ) : var.cloud_provider == "gcp" ? (
    length(google_compute_firewall.database) > 0 ? google_compute_firewall.database[0].id : null
  ) : var.cloud_provider == "azure" ? (
    length(azurerm_network_security_group.database) > 0 ? azurerm_network_security_group.database[0].id : null
  ) : null
}

output "cache_security_group_id" {
  description = "ID of the cache security group"
  value = var.cloud_provider == "aws" ? (
    length(aws_security_group.cache) > 0 ? aws_security_group.cache[0].id : null
  ) : var.cloud_provider == "gcp" ? (
    length(google_compute_firewall.cache) > 0 ? google_compute_firewall.cache[0].id : null
  ) : var.cloud_provider == "azure" ? (
    length(azurerm_network_security_group.cache) > 0 ? azurerm_network_security_group.cache[0].id : null
  ) : null
}

output "load_balancer_security_group_id" {
  description = "ID of the load balancer security group"
  value = var.cloud_provider == "aws" ? (
    length(aws_security_group.load_balancer) > 0 ? aws_security_group.load_balancer[0].id : null
  ) : null
}

output "waf_security_group_id" {
  description = "ID of the WAF security group"
  value = var.cloud_provider == "aws" ? (
    length(aws_security_group.waf) > 0 ? aws_security_group.waf[0].id : null
  ) : null
}

# AWS Security Group ARNs
output "web_security_group_arn" {
  description = "ARN of the web security group"
  value = var.cloud_provider == "aws" ? (
    length(aws_security_group.web) > 0 ? aws_security_group.web[0].arn : null
  ) : null
}

output "app_security_group_arn" {
  description = "ARN of the application security group"
  value = var.cloud_provider == "aws" ? (
    length(aws_security_group.app) > 0 ? aws_security_group.app[0].arn : null
  ) : null
}

output "database_security_group_arn" {
  description = "ARN of the database security group"
  value = var.cloud_provider == "aws" ? (
    length(aws_security_group.database) > 0 ? aws_security_group.database[0].arn : null
  ) : null
}

output "cache_security_group_arn" {
  description = "ARN of the cache security group"
  value = var.cloud_provider == "aws" ? (
    length(aws_security_group.cache) > 0 ? aws_security_group.cache[0].arn : null
  ) : null
}

output "load_balancer_security_group_arn" {
  description = "ARN of the load balancer security group"
  value = var.cloud_provider == "aws" ? (
    length(aws_security_group.load_balancer) > 0 ? aws_security_group.load_balancer[0].arn : null
  ) : null
}

# Security Group Names
output "web_security_group_name" {
  description = "Name of the web security group"
  value = var.cloud_provider == "aws" ? (
    length(aws_security_group.web) > 0 ? aws_security_group.web[0].name : null
  ) : var.cloud_provider == "gcp" ? (
    length(google_compute_firewall.web) > 0 ? google_compute_firewall.web[0].name : null
  ) : var.cloud_provider == "azure" ? (
    length(azurerm_network_security_group.web) > 0 ? azurerm_network_security_group.web[0].name : null
  ) : null
}

output "app_security_group_name" {
  description = "Name of the application security group"
  value = var.cloud_provider == "aws" ? (
    length(aws_security_group.app) > 0 ? aws_security_group.app[0].name : null
  ) : var.cloud_provider == "gcp" ? (
    length(google_compute_firewall.app) > 0 ? google_compute_firewall.app[0].name : null
  ) : var.cloud_provider == "azure" ? (
    length(azurerm_network_security_group.app) > 0 ? azurerm_network_security_group.app[0].name : null
  ) : null
}

output "database_security_group_name" {
  description = "Name of the database security group"
  value = var.cloud_provider == "aws" ? (
    length(aws_security_group.database) > 0 ? aws_security_group.database[0].name : null
  ) : var.cloud_provider == "gcp" ? (
    length(google_compute_firewall.database) > 0 ? google_compute_firewall.database[0].name : null
  ) : var.cloud_provider == "azure" ? (
    length(azurerm_network_security_group.database) > 0 ? azurerm_network_security_group.database[0].name : null
  ) : null
}

output "cache_security_group_name" {
  description = "Name of the cache security group"
  value = var.cloud_provider == "aws" ? (
    length(aws_security_group.cache) > 0 ? aws_security_group.cache[0].name : null
  ) : var.cloud_provider == "gcp" ? (
    length(google_compute_firewall.cache) > 0 ? google_compute_firewall.cache[0].name : null
  ) : var.cloud_provider == "azure" ? (
    length(azurerm_network_security_group.cache) > 0 ? azurerm_network_security_group.cache[0].name : null
  ) : null
}

# All Security Group IDs
output "security_group_ids" {
  description = "Map of all security group IDs"
  value = {
    web           = var.cloud_provider == "aws" ? (length(aws_security_group.web) > 0 ? aws_security_group.web[0].id : null) : null
    app           = var.cloud_provider == "aws" ? (length(aws_security_group.app) > 0 ? aws_security_group.app[0].id : null) : null
    database      = var.cloud_provider == "aws" ? (length(aws_security_group.database) > 0 ? aws_security_group.database[0].id : null) : null
    cache         = var.cloud_provider == "aws" ? (length(aws_security_group.cache) > 0 ? aws_security_group.cache[0].id : null) : null
    load_balancer = var.cloud_provider == "aws" ? (length(aws_security_group.load_balancer) > 0 ? aws_security_group.load_balancer[0].id : null) : null
    waf           = var.cloud_provider == "aws" ? (length(aws_security_group.waf) > 0 ? aws_security_group.waf[0].id : null) : null
  }
}

# All Security Group Names
output "security_group_names" {
  description = "Map of all security group names"
  value = {
    web           = var.cloud_provider == "aws" ? (length(aws_security_group.web) > 0 ? aws_security_group.web[0].name : null) : null
    app           = var.cloud_provider == "aws" ? (length(aws_security_group.app) > 0 ? aws_security_group.app[0].name : null) : null
    database      = var.cloud_provider == "aws" ? (length(aws_security_group.database) > 0 ? aws_security_group.database[0].name : null) : null
    cache         = var.cloud_provider == "aws" ? (length(aws_security_group.cache) > 0 ? aws_security_group.cache[0].name : null) : null
    load_balancer = var.cloud_provider == "aws" ? (length(aws_security_group.load_balancer) > 0 ? aws_security_group.load_balancer[0].name : null) : null
    waf           = var.cloud_provider == "aws" ? (length(aws_security_group.waf) > 0 ? aws_security_group.waf[0].name : null) : null
  }
}

# GCP Firewall Rules
output "gcp_firewall_rules" {
  description = "Map of GCP firewall rule names"
  value = var.cloud_provider == "gcp" ? {
    web      = length(google_compute_firewall.web) > 0 ? google_compute_firewall.web[0].name : null
    app      = length(google_compute_firewall.app) > 0 ? google_compute_firewall.app[0].name : null
    database = length(google_compute_firewall.database) > 0 ? google_compute_firewall.database[0].name : null
    cache    = length(google_compute_firewall.cache) > 0 ? google_compute_firewall.cache[0].name : null
    internal = length(google_compute_firewall.internal) > 0 ? google_compute_firewall.internal[0].name : null
  } : {}
}

# Azure Network Security Groups
output "azure_nsg_ids" {
  description = "Map of Azure Network Security Group IDs"
  value = var.cloud_provider == "azure" ? {
    web      = length(azurerm_network_security_group.web) > 0 ? azurerm_network_security_group.web[0].id : null
    app      = length(azurerm_network_security_group.app) > 0 ? azurerm_network_security_group.app[0].id : null
    database = length(azurerm_network_security_group.database) > 0 ? azurerm_network_security_group.database[0].id : null
    cache    = length(azurerm_network_security_group.cache) > 0 ? azurerm_network_security_group.cache[0].id : null
  } : {}
}

# Security Configuration
output "security_configuration" {
  description = "Security configuration summary"
  value = {
    cloud_provider        = var.cloud_provider
    web_access_enabled   = var.enable_web_access
    waf_enabled          = var.enable_waf
    strict_mode_enabled  = var.enable_strict_mode
    compliance_framework = var.compliance_framework
    data_classification  = var.data_classification
    ddos_protection      = var.enable_ddos_protection
    intrusion_detection  = var.enable_intrusion_detection
    threat_intelligence  = var.enable_threat_intelligence
    rate_limiting        = var.enable_rate_limiting
    security_alerts      = var.enable_security_alerts
  }
}

# Port Configuration
output "port_configuration" {
  description = "Port configuration summary"
  value = {
    app_port           = var.app_port
    database_engines   = var.database_engines
    health_check_ports = var.health_check_ports
    load_balancer_ports = var.load_balancer_ports
    cache_ports        = var.cache_ports
    microservices_ports = var.microservices_ports
    container_ports    = var.container_ports
    backup_ports       = var.backup_ports
    service_mesh_ports = var.service_mesh_ports
    serverless_ports   = var.serverless_ports
  }
}

# Access Control
output "access_control" {
  description = "Access control configuration"
  value = {
    ssh_allowed_cidrs     = var.ssh_allowed_cidrs
    database_ssh_enabled  = var.enable_database_ssh
    dev_access_enabled    = var.enable_dev_access
    dev_allowed_cidrs     = var.dev_allowed_cidrs
    ip_whitelist          = var.ip_whitelist
    ip_blacklist          = var.ip_blacklist
    third_party_access    = var.enable_third_party_access
    third_party_cidrs     = var.third_party_cidrs
  }
}

# Monitoring and Logging
output "monitoring_configuration" {
  description = "Monitoring and logging configuration"
  value = {
    logging_enabled       = var.enable_logging
    log_retention_days    = var.log_retention_days
    security_alerts       = var.enable_security_alerts
    alert_email          = var.alert_email
    alert_sns_topic      = var.alert_sns_topic
  }
}

# Feature Flags
output "feature_flags" {
  description = "Feature flags configuration"
  value = {
    load_balancer_sg     = var.enable_load_balancer_sg
    cache_sg             = var.enable_cache_sg
    microservices_sg     = var.enable_microservices_sg
    container_sg         = var.enable_container_sg
    backup_sg            = var.enable_backup_sg
    service_mesh         = var.enable_service_mesh
    serverless_sg        = var.enable_serverless_sg
    third_party_access   = var.enable_third_party_access
  }
}

# Resource Creation Status
output "created_resources" {
  description = "Status of created resources"
  value = {
    web_sg           = var.create_web_sg
    app_sg           = var.create_app_sg
    database_sg      = var.create_database_sg
    cache_sg         = var.create_cache_sg
    load_balancer_sg = var.create_load_balancer_sg
  }
}

# Tags Applied
output "applied_tags" {
  description = "Tags applied to all resources"
  value = merge(
    var.tags,
    {
      Module      = "networking/security-groups"
      Environment = var.environment
      Project     = var.project_name
      ManagedBy   = "terraform"
    }
  )
}