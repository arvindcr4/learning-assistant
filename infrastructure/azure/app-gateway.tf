# Azure Application Gateway Configuration
# This file defines the Application Gateway with WAF, SSL termination, and load balancing

# Self-signed certificate for testing (replace with proper certificate in production)
resource "tls_private_key" "app_gateway" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "tls_self_signed_cert" "app_gateway" {
  private_key_pem = tls_private_key.app_gateway.private_key_pem

  subject {
    common_name  = var.dns_zone_name != "" ? var.dns_zone_name : "${local.name_prefix}.example.com"
    organization = var.project_name
  }

  validity_period_hours = 8760  # 1 year

  allowed_uses = [
    "key_encipherment",
    "digital_signature",
    "server_auth",
  ]
}

# Store SSL certificate in Key Vault
resource "azurerm_key_vault_certificate" "app_gateway" {
  depends_on = [azurerm_key_vault_access_policy.current]
  
  name         = "${local.name_prefix}-ssl-cert"
  key_vault_id = azurerm_key_vault.main.id

  certificate {
    contents = base64encode(tls_self_signed_cert.app_gateway.cert_pem)
    password = ""
  }

  certificate_policy {
    issuer_parameters {
      name = "Self"
    }

    key_properties {
      exportable = true
      key_size   = 2048
      key_type   = "RSA"
      reuse_key  = true
    }

    secret_properties {
      content_type = "application/x-pkcs12"
    }

    x509_certificate_properties {
      extended_key_usage = ["1.3.6.1.5.5.7.3.1"]
      key_usage          = ["digitalSignature", "keyEncipherment"]
      
      subject_alternative_names {
        dns_names = [
          var.dns_zone_name != "" ? var.dns_zone_name : "${local.name_prefix}.example.com",
          "*.${var.dns_zone_name != "" ? var.dns_zone_name : "${local.name_prefix}.example.com"}"
        ]
      }

      subject            = "CN=${var.dns_zone_name != "" ? var.dns_zone_name : "${local.name_prefix}.example.com"}"
      validity_in_months = 12
    }
  }

  tags = local.common_tags
}

# User-assigned managed identity for Application Gateway
resource "azurerm_user_assigned_identity" "app_gateway" {
  name                = "${local.name_prefix}-appgw-identity"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  tags = local.common_tags
}

# Grant Application Gateway identity access to Key Vault
resource "azurerm_key_vault_access_policy" "app_gateway" {
  key_vault_id = azurerm_key_vault.main.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = azurerm_user_assigned_identity.app_gateway.principal_id

  secret_permissions = [
    "Get",
    "List"
  ]

  certificate_permissions = [
    "Get",
    "List"
  ]
}

# Application Gateway
resource "azurerm_application_gateway" "main" {
  name                = "${local.name_prefix}-appgw"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  zones               = local.availability_zones

  # SKU Configuration
  sku {
    name     = var.app_gateway_sku.name
    tier     = var.app_gateway_sku.tier
    capacity = var.app_gateway_sku.capacity
  }

  # Auto-scaling configuration
  autoscale_configuration {
    min_capacity = 2
    max_capacity = 10
  }

  # Gateway IP configuration
  gateway_ip_configuration {
    name      = "appGatewayIpConfig"
    subnet_id = azurerm_subnet.app_gateway.id
  }

  # Frontend port configurations
  frontend_port {
    name = "frontendPort80"
    port = 80
  }

  frontend_port {
    name = "frontendPort443"
    port = 443
  }

  # Frontend IP configuration
  frontend_ip_configuration {
    name                 = "frontendIpConfig"
    public_ip_address_id = azurerm_public_ip.app_gateway.id
  }

  # Backend address pool
  backend_address_pool {
    name = "backendPool"
    # Backend addresses will be dynamically updated by AKS ingress controller
  }

  # Backend HTTP settings
  backend_http_settings {
    name                                = "backendHttpSettings"
    cookie_based_affinity               = "Disabled"
    path                                = "/"
    port                                = 80
    protocol                            = "Http"
    request_timeout                     = 60
    pick_host_name_from_backend_address = true
    
    # Health probe
    probe_name = "healthProbe"
  }

  backend_http_settings {
    name                                = "backendHttpsSettings"
    cookie_based_affinity               = "Disabled"
    path                                = "/"
    port                                = 443
    protocol                            = "Https"
    request_timeout                     = 60
    pick_host_name_from_backend_address = true
    
    # Health probe
    probe_name = "healthsProbe"
  }

  # HTTP listener
  http_listener {
    name                           = "httpListener"
    frontend_ip_configuration_name = "frontendIpConfig"
    frontend_port_name             = "frontendPort80"
    protocol                       = "Http"
  }

  # HTTPS listener
  http_listener {
    name                           = "httpsListener"
    frontend_ip_configuration_name = "frontendIpConfig"
    frontend_port_name             = "frontendPort443"
    protocol                       = "Https"
    ssl_certificate_name           = "appGatewaySslCert"
  }

  # SSL certificate
  ssl_certificate {
    name                = "appGatewaySslCert"
    key_vault_secret_id = azurerm_key_vault_certificate.app_gateway.secret_id
  }

  # Request routing rules
  request_routing_rule {
    name                       = "httpRule"
    rule_type                  = "Basic"
    http_listener_name         = "httpListener"
    backend_address_pool_name  = "backendPool"
    backend_http_settings_name = "backendHttpSettings"
    priority                   = 100
  }

  request_routing_rule {
    name                       = "httpsRule"
    rule_type                  = "Basic"
    http_listener_name         = "httpsListener"
    backend_address_pool_name  = "backendPool"
    backend_http_settings_name = "backendHttpsSettings"
    priority                   = 110
  }

  # Health probes
  probe {
    name                                      = "healthProbe"
    protocol                                  = "Http"
    path                                      = "/health"
    interval                                  = 30
    timeout                                   = 30
    unhealthy_threshold                       = 3
    pick_host_name_from_backend_http_settings = true
    
    match {
      status_code = ["200-399"]
    }
  }

  probe {
    name                                      = "healthsProbe"
    protocol                                  = "Https"
    path                                      = "/health"
    interval                                  = 30
    timeout                                   = 30
    unhealthy_threshold                       = 3
    pick_host_name_from_backend_http_settings = true
    
    match {
      status_code = ["200-399"]
    }
  }

  # Web Application Firewall configuration
  dynamic "waf_configuration" {
    for_each = var.app_gateway_enable_waf ? [1] : []
    content {
      enabled                  = true
      firewall_mode            = var.app_gateway_waf_mode
      rule_set_type            = "OWASP"
      rule_set_version         = "3.2"
      request_body_check       = true
      max_request_body_size_kb = 128
      file_upload_limit_mb     = 100

      # Disabled rules (customize based on your application needs)
      disabled_rule_group {
        rule_group_name = "REQUEST-920-PROTOCOL-ENFORCEMENT"
        rules           = [920300, 920440]
      }

      # Exclusion rules
      exclusion {
        match_variable          = "RequestCookieNames"
        selector_match_operator = "StartsWith"
        selector                = "session"
      }

      exclusion {
        match_variable          = "RequestHeaderNames"
        selector_match_operator = "Equals"
        selector                = "x-forwarded-for"
      }
    }
  }

  # Identity configuration
  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app_gateway.id]
  }

  # Global configuration
  enable_http2 = true
  
  # Custom error pages
  custom_error_configuration {
    status_code           = "HttpStatus403"
    custom_error_page_url = "https://example.com/errors/403.html"
  }

  custom_error_configuration {
    status_code           = "HttpStatus502"
    custom_error_page_url = "https://example.com/errors/502.html"
  }

  tags = local.common_tags

  depends_on = [
    azurerm_key_vault_access_policy.app_gateway,
    azurerm_key_vault_certificate.app_gateway
  ]
}

# Application Gateway diagnostic settings
resource "azurerm_monitor_diagnostic_setting" "app_gateway" {
  name                       = "${local.name_prefix}-appgw-diagnostics"
  target_resource_id         = azurerm_application_gateway.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.aks.id

  dynamic "enabled_log" {
    for_each = [
      "ApplicationGatewayAccessLog",
      "ApplicationGatewayPerformanceLog",
      "ApplicationGatewayFirewallLog"
    ]
    content {
      category = enabled_log.value
    }
  }

  metric {
    category = "AllMetrics"
    enabled  = true
  }
}

# Application Gateway public IP DNS label
resource "azurerm_public_ip" "app_gateway_dns" {
  name                = "${local.name_prefix}-appgw-pip-dns"
  location            = azurerm_resource_group.networking.location
  resource_group_name = azurerm_resource_group.networking.name
  allocation_method   = "Static"
  sku                 = "Standard"
  zones               = local.availability_zones
  domain_name_label   = local.name_prefix

  tags = local.common_tags
}

# WAF policy (v2 SKU)
resource "azurerm_web_application_firewall_policy" "main" {
  count = var.app_gateway_enable_waf ? 1 : 0
  
  name                = "${local.name_prefix}-waf-policy"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  # Policy settings
  policy_settings {
    enabled                     = true
    mode                        = var.app_gateway_waf_mode
    request_body_check          = true
    file_upload_limit_in_mb     = 100
    max_request_body_size_in_kb = 128
  }

  # Managed rules
  managed_rules {
    # Exclusions
    exclusion {
      match_variable          = "RequestCookieNames"
      selector_match_operator = "StartsWith"
      selector                = "session"
    }

    exclusion {
      match_variable          = "RequestHeaderNames"
      selector_match_operator = "Equals"
      selector                = "x-forwarded-for"
    }

    # Managed rule sets
    managed_rule_set {
      type    = "OWASP"
      version = "3.2"

      # Rule group overrides
      rule_group_override {
        rule_group_name = "REQUEST-920-PROTOCOL-ENFORCEMENT"
        
        rule {
          id      = "920300"
          enabled = false
        }
        
        rule {
          id      = "920440"
          enabled = false
        }
      }

      rule_group_override {
        rule_group_name = "REQUEST-942-APPLICATION-ATTACK-SQLI"
        
        rule {
          id      = "942100"
          enabled = true
          action  = "Block"
        }
      }
    }

    # Microsoft Bot Manager rules
    managed_rule_set {
      type    = "Microsoft_BotManagerRuleSet"
      version = "0.1"
    }
  }

  # Custom rules
  custom_rules {
    name      = "RateLimitRule"
    priority  = 1
    rule_type = "RateLimitRule"
    action    = "Block"

    match_conditions {
      match_variables {
        variable_name = "RemoteAddr"
      }
      operator           = "IPMatch"
      negation_condition = false
      match_values       = ["0.0.0.0/0"]
    }

    rate_limit_duration_in_minutes = 1
    rate_limit_threshold           = 100
  }

  custom_rules {
    name      = "GeoBlockRule"
    priority  = 2
    rule_type = "MatchRule"
    action    = "Block"

    match_conditions {
      match_variables {
        variable_name = "RemoteAddr"
      }
      operator           = "GeoMatch"
      negation_condition = false
      match_values       = ["CN", "RU", "KP"]  # Block specific countries
    }
  }

  tags = local.common_tags
}

# Application Gateway outputs
output "app_gateway_id" {
  description = "ID of the Application Gateway"
  value       = azurerm_application_gateway.main.id
}

output "app_gateway_public_ip_address" {
  description = "Public IP address of the Application Gateway"
  value       = azurerm_public_ip.app_gateway.ip_address
}

output "app_gateway_public_ip_fqdn" {
  description = "FQDN of the Application Gateway public IP"
  value       = azurerm_public_ip.app_gateway_dns.fqdn
}

output "app_gateway_backend_address_pool_name" {
  description = "Name of the Application Gateway backend address pool"
  value       = "backendPool"
}

output "app_gateway_identity_principal_id" {
  description = "Principal ID of the Application Gateway managed identity"
  value       = azurerm_user_assigned_identity.app_gateway.principal_id
}

output "app_gateway_waf_policy_id" {
  description = "ID of the WAF policy"
  value       = var.app_gateway_enable_waf ? azurerm_web_application_firewall_policy.main[0].id : null
}

output "ssl_certificate_name" {
  description = "Name of the SSL certificate"
  value       = azurerm_key_vault_certificate.app_gateway.name
}

output "ssl_certificate_secret_id" {
  description = "Secret ID of the SSL certificate in Key Vault"
  value       = azurerm_key_vault_certificate.app_gateway.secret_id
}