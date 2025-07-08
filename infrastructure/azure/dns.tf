# Azure DNS Configuration
# This file defines DNS zones and records for the learning assistant application

# DNS Zone (created only if var.create_dns_zone is true)
resource "azurerm_dns_zone" "main" {
  count = var.create_dns_zone ? 1 : 0
  
  name                = var.dns_zone_name
  resource_group_name = azurerm_resource_group.networking.name

  tags = local.common_tags
}

# Data source for existing DNS zone (if not creating new one)
data "azurerm_dns_zone" "existing" {
  count = var.create_dns_zone ? 0 : 1
  
  name                = var.dns_zone_name
  resource_group_name = azurerm_resource_group.networking.name
}

# Local value for DNS zone based on whether we're creating or using existing
locals {
  dns_zone_name = var.create_dns_zone ? azurerm_dns_zone.main[0].name : (
    var.dns_zone_name != "" ? var.dns_zone_name : "${local.name_prefix}.example.com"
  )
  dns_zone_id = var.create_dns_zone ? azurerm_dns_zone.main[0].id : (
    var.dns_zone_name != "" ? data.azurerm_dns_zone.existing[0].id : null
  )
}

# A record for the main application (points to Application Gateway)
resource "azurerm_dns_a_record" "main" {
  count = var.dns_zone_name != "" ? 1 : 0
  
  name                = "@"
  zone_name           = local.dns_zone_name
  resource_group_name = azurerm_resource_group.networking.name
  ttl                 = 300
  records             = [azurerm_public_ip.app_gateway.ip_address]

  tags = local.common_tags
}

# A record for www subdomain
resource "azurerm_dns_a_record" "www" {
  count = var.dns_zone_name != "" ? 1 : 0
  
  name                = "www"
  zone_name           = local.dns_zone_name
  resource_group_name = azurerm_resource_group.networking.name
  ttl                 = 300
  records             = [azurerm_public_ip.app_gateway.ip_address]

  tags = local.common_tags
}

# A record for api subdomain
resource "azurerm_dns_a_record" "api" {
  count = var.dns_zone_name != "" ? 1 : 0
  
  name                = "api"
  zone_name           = local.dns_zone_name
  resource_group_name = azurerm_resource_group.networking.name
  ttl                 = 300
  records             = [azurerm_public_ip.app_gateway.ip_address]

  tags = local.common_tags
}

# A record for admin subdomain
resource "azurerm_dns_a_record" "admin" {
  count = var.dns_zone_name != "" ? 1 : 0
  
  name                = "admin"
  zone_name           = local.dns_zone_name
  resource_group_name = azurerm_resource_group.networking.name
  ttl                 = 300
  records             = [azurerm_public_ip.app_gateway.ip_address]

  tags = local.common_tags
}

# CNAME record for CDN (if using Azure CDN)
resource "azurerm_dns_cname_record" "cdn" {
  count = var.dns_zone_name != "" ? 1 : 0
  
  name                = "cdn"
  zone_name           = local.dns_zone_name
  resource_group_name = azurerm_resource_group.networking.name
  ttl                 = 300
  record              = azurerm_public_ip.app_gateway_dns.fqdn

  tags = local.common_tags
}

# CNAME record for assets subdomain
resource "azurerm_dns_cname_record" "assets" {
  count = var.dns_zone_name != "" ? 1 : 0
  
  name                = "assets"
  zone_name           = local.dns_zone_name
  resource_group_name = azurerm_resource_group.networking.name
  ttl                 = 300
  record              = azurerm_public_ip.app_gateway_dns.fqdn

  tags = local.common_tags
}

# MX record for email (if needed)
resource "azurerm_dns_mx_record" "main" {
  count = var.dns_zone_name != "" && var.environment == "production" ? 1 : 0
  
  name                = "@"
  zone_name           = local.dns_zone_name
  resource_group_name = azurerm_resource_group.networking.name
  ttl                 = 300

  record {
    preference = 10
    exchange   = "mail.${local.dns_zone_name}"
  }

  tags = local.common_tags
}

# TXT record for domain verification
resource "azurerm_dns_txt_record" "verification" {
  count = var.dns_zone_name != "" ? 1 : 0
  
  name                = "@"
  zone_name           = local.dns_zone_name
  resource_group_name = azurerm_resource_group.networking.name
  ttl                 = 300

  record {
    value = "v=spf1 include:_spf.google.com ~all"
  }

  record {
    value = "google-site-verification=placeholder-replace-with-actual-value"
  }

  tags = local.common_tags
}

# TXT record for DMARC
resource "azurerm_dns_txt_record" "dmarc" {
  count = var.dns_zone_name != "" && var.environment == "production" ? 1 : 0
  
  name                = "_dmarc"
  zone_name           = local.dns_zone_name
  resource_group_name = azurerm_resource_group.networking.name
  ttl                 = 300

  record {
    value = "v=DMARC1; p=quarantine; rua=mailto:dmarc@${local.dns_zone_name}"
  }

  tags = local.common_tags
}

# TXT record for DKIM (if using email services)
resource "azurerm_dns_txt_record" "dkim" {
  count = var.dns_zone_name != "" && var.environment == "production" ? 1 : 0
  
  name                = "default._domainkey"
  zone_name           = local.dns_zone_name
  resource_group_name = azurerm_resource_group.networking.name
  ttl                 = 300

  record {
    value = "v=DKIM1; k=rsa; p=placeholder-replace-with-actual-public-key"
  }

  tags = local.common_tags
}

# SRV record for service discovery (if needed)
resource "azurerm_dns_srv_record" "api" {
  count = var.dns_zone_name != "" ? 1 : 0
  
  name                = "_api._tcp"
  zone_name           = local.dns_zone_name
  resource_group_name = azurerm_resource_group.networking.name
  ttl                 = 300

  record {
    priority = 10
    weight   = 100
    port     = 443
    target   = "api.${local.dns_zone_name}"
  }

  tags = local.common_tags
}

# CAA record for certificate authority authorization
resource "azurerm_dns_caa_record" "main" {
  count = var.dns_zone_name != "" && var.environment == "production" ? 1 : 0
  
  name                = "@"
  zone_name           = local.dns_zone_name
  resource_group_name = azurerm_resource_group.networking.name
  ttl                 = 300

  record {
    flags = 0
    tag   = "issue"
    value = "letsencrypt.org"
  }

  record {
    flags = 0
    tag   = "issue"
    value = "digicert.com"
  }

  record {
    flags = 0
    tag   = "iodef"
    value = "mailto:security@${local.dns_zone_name}"
  }

  tags = local.common_tags
}

# Private DNS zone for internal services
resource "azurerm_private_dns_zone" "internal" {
  name                = "${local.name_prefix}.internal"
  resource_group_name = azurerm_resource_group.networking.name

  tags = local.common_tags
}

# Link private DNS zone to VNet
resource "azurerm_private_dns_zone_virtual_network_link" "internal" {
  name                  = "${local.name_prefix}-internal-vnet-link"
  resource_group_name   = azurerm_resource_group.networking.name
  private_dns_zone_name = azurerm_private_dns_zone.internal.name
  virtual_network_id    = azurerm_virtual_network.main.id
  registration_enabled  = true

  tags = local.common_tags
}

# A record for internal AKS cluster
resource "azurerm_private_dns_a_record" "aks" {
  name                = "aks"
  zone_name           = azurerm_private_dns_zone.internal.name
  resource_group_name = azurerm_resource_group.networking.name
  ttl                 = 300
  records             = [azurerm_kubernetes_cluster.main.private_fqdn]

  tags = local.common_tags
}

# A record for internal database
resource "azurerm_private_dns_a_record" "database" {
  name                = "database"
  zone_name           = azurerm_private_dns_zone.internal.name
  resource_group_name = azurerm_resource_group.networking.name
  ttl                 = 300
  records             = [azurerm_postgresql_flexible_server.main.fqdn]

  tags = local.common_tags
}

# A record for internal Redis cache
resource "azurerm_private_dns_a_record" "redis" {
  name                = "redis"
  zone_name           = azurerm_private_dns_zone.internal.name
  resource_group_name = azurerm_resource_group.networking.name
  ttl                 = 300
  records             = [azurerm_redis_cache.main.hostname]

  tags = local.common_tags
}

# Traffic Manager profile for multi-region deployment (production only)
resource "azurerm_traffic_manager_profile" "main" {
  count = var.environment == "production" && var.enable_disaster_recovery ? 1 : 0
  
  name                = "${local.name_prefix}-tm"
  resource_group_name = azurerm_resource_group.networking.name

  traffic_routing_method = "Priority"

  dns_config {
    relative_name = local.name_prefix
    ttl           = 100
  }

  monitor_config {
    protocol                     = "HTTPS"
    port                         = 443
    path                         = "/health"
    interval_in_seconds         = 30
    timeout_in_seconds          = 10
    tolerated_number_of_failures = 3
  }

  tags = local.common_tags
}

# Traffic Manager endpoint for primary region
resource "azurerm_traffic_manager_azure_endpoint" "primary" {
  count = var.environment == "production" && var.enable_disaster_recovery ? 1 : 0
  
  name                = "${local.name_prefix}-primary"
  profile_id          = azurerm_traffic_manager_profile.main[0].id
  target_resource_id  = azurerm_public_ip.app_gateway.id
  priority            = 1
  weight              = 100
  enabled             = true
}

# DNS diagnostic settings
resource "azurerm_monitor_diagnostic_setting" "dns" {
  count = var.create_dns_zone ? 1 : 0
  
  name                       = "${local.name_prefix}-dns-diagnostics"
  target_resource_id         = azurerm_dns_zone.main[0].id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.aks.id

  dynamic "enabled_log" {
    for_each = ["QueryLogs"]
    content {
      category = enabled_log.value
    }
  }

  metric {
    category = "AllMetrics"
    enabled  = true
  }
}

# DNS outputs
output "dns_zone_name" {
  description = "Name of the DNS zone"
  value       = local.dns_zone_name
}

output "dns_zone_id" {
  description = "ID of the DNS zone"
  value       = local.dns_zone_id
}

output "dns_zone_name_servers" {
  description = "Name servers for the DNS zone"
  value       = var.create_dns_zone ? azurerm_dns_zone.main[0].name_servers : []
}

output "private_dns_zone_name" {
  description = "Name of the private DNS zone"
  value       = azurerm_private_dns_zone.internal.name
}

output "private_dns_zone_id" {
  description = "ID of the private DNS zone"
  value       = azurerm_private_dns_zone.internal.id
}

output "traffic_manager_profile_fqdn" {
  description = "FQDN of the Traffic Manager profile"
  value       = var.environment == "production" && var.enable_disaster_recovery ? azurerm_traffic_manager_profile.main[0].fqdn : null
}

output "main_domain_fqdn" {
  description = "FQDN of the main domain"
  value       = var.dns_zone_name != "" ? local.dns_zone_name : azurerm_public_ip.app_gateway_dns.fqdn
}

output "www_domain_fqdn" {
  description = "FQDN of the www subdomain"
  value       = var.dns_zone_name != "" ? "www.${local.dns_zone_name}" : azurerm_public_ip.app_gateway_dns.fqdn
}

output "api_domain_fqdn" {
  description = "FQDN of the API subdomain"
  value       = var.dns_zone_name != "" ? "api.${local.dns_zone_name}" : azurerm_public_ip.app_gateway_dns.fqdn
}

output "admin_domain_fqdn" {
  description = "FQDN of the admin subdomain"
  value       = var.dns_zone_name != "" ? "admin.${local.dns_zone_name}" : azurerm_public_ip.app_gateway_dns.fqdn
}