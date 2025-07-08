# Terraform Outputs for Azure Infrastructure
# This file defines all output values that can be used by other modules or external systems

# Resource Group Outputs
output "resource_groups" {
  description = "Information about all resource groups"
  value = {
    main = {
      id       = azurerm_resource_group.main.id
      name     = azurerm_resource_group.main.name
      location = azurerm_resource_group.main.location
    }
    networking = {
      id       = azurerm_resource_group.networking.id
      name     = azurerm_resource_group.networking.name
      location = azurerm_resource_group.networking.location
    }
    monitoring = {
      id       = azurerm_resource_group.monitoring.id
      name     = azurerm_resource_group.monitoring.name
      location = azurerm_resource_group.monitoring.location
    }
  }
}

# Networking Outputs
output "networking" {
  description = "Networking infrastructure information"
  value = {
    vnet = {
      id   = azurerm_virtual_network.main.id
      name = azurerm_virtual_network.main.name
      cidr = azurerm_virtual_network.main.address_space
    }
    subnets = {
      aks_system = {
        id   = azurerm_subnet.aks_system.id
        name = azurerm_subnet.aks_system.name
        cidr = azurerm_subnet.aks_system.address_prefixes
      }
      aks_user = {
        id   = azurerm_subnet.aks_user.id
        name = azurerm_subnet.aks_user.name
        cidr = azurerm_subnet.aks_user.address_prefixes
      }
      database = {
        id   = azurerm_subnet.database.id
        name = azurerm_subnet.database.name
        cidr = azurerm_subnet.database.address_prefixes
      }
      redis = {
        id   = azurerm_subnet.redis.id
        name = azurerm_subnet.redis.name
        cidr = azurerm_subnet.redis.address_prefixes
      }
      app_gateway = {
        id   = azurerm_subnet.app_gateway.id
        name = azurerm_subnet.app_gateway.name
        cidr = azurerm_subnet.app_gateway.address_prefixes
      }
      private_endpoints = {
        id   = azurerm_subnet.private_endpoints.id
        name = azurerm_subnet.private_endpoints.name
        cidr = azurerm_subnet.private_endpoints.address_prefixes
      }
    }
    public_ips = {
      app_gateway = {
        id      = azurerm_public_ip.app_gateway.id
        address = azurerm_public_ip.app_gateway.ip_address
        fqdn    = azurerm_public_ip.app_gateway_dns.fqdn
      }
    }
  }
}

# AKS Cluster Outputs
output "aks" {
  description = "AKS cluster information"
  value = {
    cluster = {
      id                  = azurerm_kubernetes_cluster.main.id
      name                = azurerm_kubernetes_cluster.main.name
      fqdn                = azurerm_kubernetes_cluster.main.fqdn
      kubernetes_version  = azurerm_kubernetes_cluster.main.kubernetes_version
      node_resource_group = azurerm_kubernetes_cluster.main.node_resource_group
    }
    identity = {
      principal_id = azurerm_user_assigned_identity.aks.principal_id
      client_id    = azurerm_user_assigned_identity.aks.client_id
    }
    kubelet_identity = {
      principal_id = azurerm_user_assigned_identity.aks_kubelet.principal_id
      client_id    = azurerm_user_assigned_identity.aks_kubelet.client_id
    }
    namespace = kubernetes_namespace.learning_assistant.metadata[0].name
  }
  sensitive = false
}

# Container Registry Outputs
output "container_registry" {
  description = "Azure Container Registry information"
  value = {
    id           = azurerm_container_registry.main.id
    name         = azurerm_container_registry.main.name
    login_server = azurerm_container_registry.main.login_server
    admin_enabled = azurerm_container_registry.main.admin_enabled
  }
}

# Database Outputs
output "database" {
  description = "PostgreSQL database information"
  value = {
    server = {
      id                     = azurerm_postgresql_flexible_server.main.id
      name                   = azurerm_postgresql_flexible_server.main.name
      fqdn                   = azurerm_postgresql_flexible_server.main.fqdn
      version                = azurerm_postgresql_flexible_server.main.version
      administrator_login    = azurerm_postgresql_flexible_server.main.administrator_login
      high_availability      = var.postgresql_enable_high_availability
    }
    database = {
      name     = azurerm_postgresql_flexible_server_database.learning_assistant.name
      charset  = azurerm_postgresql_flexible_server_database.learning_assistant.charset
      collation = azurerm_postgresql_flexible_server_database.learning_assistant.collation
    }
    secrets = {
      admin_password    = azurerm_key_vault_secret.postgresql_admin_password.name
      app_password      = azurerm_key_vault_secret.postgresql_app_password.name
      connection_string = azurerm_key_vault_secret.postgresql_connection_string.name
    }
  }
}

# Redis Cache Outputs
output "redis" {
  description = "Redis cache information"
  value = {
    cache = {
      id           = azurerm_redis_cache.main.id
      name         = azurerm_redis_cache.main.name
      hostname     = azurerm_redis_cache.main.hostname
      ssl_port     = azurerm_redis_cache.main.ssl_port
      port         = azurerm_redis_cache.main.port
      sku_name     = azurerm_redis_cache.main.sku_name
      capacity     = azurerm_redis_cache.main.capacity
    }
    cluster = var.redis_sku_name == "Premium" && var.redis_capacity >= 3 ? {
      id       = azurerm_redis_cache.cluster[0].id
      name     = azurerm_redis_cache.cluster[0].name
      hostname = azurerm_redis_cache.cluster[0].hostname
    } : null
    secrets = {
      primary_key       = azurerm_key_vault_secret.redis_primary_key.name
      secondary_key     = azurerm_key_vault_secret.redis_secondary_key.name
      connection_string = azurerm_key_vault_secret.redis_connection_string.name
    }
  }
}

# Application Gateway Outputs
output "application_gateway" {
  description = "Application Gateway information"
  value = {
    id               = azurerm_application_gateway.main.id
    name             = azurerm_application_gateway.main.name
    public_ip_address = azurerm_public_ip.app_gateway.ip_address
    fqdn             = azurerm_public_ip.app_gateway_dns.fqdn
    backend_pool     = "backendPool"
    waf_enabled      = var.app_gateway_enable_waf
    waf_mode         = var.app_gateway_waf_mode
    ssl_certificate  = azurerm_key_vault_certificate.app_gateway.name
  }
}

# DNS Outputs
output "dns" {
  description = "DNS configuration information"
  value = {
    zone = var.create_dns_zone ? {
      id           = azurerm_dns_zone.main[0].id
      name         = azurerm_dns_zone.main[0].name
      name_servers = azurerm_dns_zone.main[0].name_servers
    } : null
    private_zone = {
      id   = azurerm_private_dns_zone.internal.id
      name = azurerm_private_dns_zone.internal.name
    }
    domains = {
      main  = var.dns_zone_name != "" ? local.dns_zone_name : azurerm_public_ip.app_gateway_dns.fqdn
      www   = var.dns_zone_name != "" ? "www.${local.dns_zone_name}" : azurerm_public_ip.app_gateway_dns.fqdn
      api   = var.dns_zone_name != "" ? "api.${local.dns_zone_name}" : azurerm_public_ip.app_gateway_dns.fqdn
      admin = var.dns_zone_name != "" ? "admin.${local.dns_zone_name}" : azurerm_public_ip.app_gateway_dns.fqdn
    }
    traffic_manager = var.environment == "production" && var.enable_disaster_recovery ? {
      fqdn = azurerm_traffic_manager_profile.main[0].fqdn
    } : null
  }
}

# Key Vault Outputs
output "key_vault" {
  description = "Key Vault information"
  value = {
    id         = azurerm_key_vault.main.id
    name       = azurerm_key_vault.main.name
    vault_uri  = azurerm_key_vault.main.vault_uri
    tenant_id  = azurerm_key_vault.main.tenant_id
  }
}

# Storage Account Outputs
output "storage" {
  description = "Storage account information"
  value = {
    id                   = azurerm_storage_account.main.id
    name                 = azurerm_storage_account.main.name
    primary_endpoint     = azurerm_storage_account.main.primary_blob_endpoint
    secondary_endpoint   = azurerm_storage_account.main.secondary_blob_endpoint
    replication_type     = azurerm_storage_account.main.account_replication_type
    containers = {
      backups = azurerm_storage_container.backups.name
      logs    = azurerm_storage_container.logs.name
    }
  }
}

# Monitoring Outputs
output "monitoring" {
  description = "Monitoring and observability information"
  value = {
    application_insights = {
      id                     = azurerm_application_insights.main.id
      name                   = azurerm_application_insights.main.name
      app_id                 = azurerm_application_insights.main.app_id
      connection_string_name = "application-insights-connection-string"
    }
    log_analytics = {
      id           = azurerm_log_analytics_workspace.aks.id
      name         = azurerm_log_analytics_workspace.aks.name
      workspace_id = azurerm_log_analytics_workspace.aks.workspace_id
    }
    action_groups = {
      main     = azurerm_monitor_action_group.main.id
      critical = azurerm_monitor_action_group.critical.id
    }
    availability_test = {
      id   = azurerm_application_insights_web_test.availability.id
      name = azurerm_application_insights_web_test.availability.name
    }
  }
}

# Identity and Access Management Outputs
output "identity" {
  description = "Identity and access management information"
  value = {
    managed_identities = {
      app = {
        id           = azurerm_user_assigned_identity.app.id
        principal_id = azurerm_user_assigned_identity.app.principal_id
        client_id    = azurerm_user_assigned_identity.app.client_id
      }
      backup = {
        id           = azurerm_user_assigned_identity.backup.id
        principal_id = azurerm_user_assigned_identity.backup.principal_id
        client_id    = azurerm_user_assigned_identity.backup.client_id
      }
      monitoring = {
        id           = azurerm_user_assigned_identity.monitoring.id
        principal_id = azurerm_user_assigned_identity.monitoring.principal_id
        client_id    = azurerm_user_assigned_identity.monitoring.client_id
      }
      app_gateway = {
        id           = azurerm_user_assigned_identity.app_gateway.id
        principal_id = azurerm_user_assigned_identity.app_gateway.principal_id
        client_id    = azurerm_user_assigned_identity.app_gateway.client_id
      }
    }
    azure_ad = {
      application_id        = azuread_application.learning_assistant.application_id
      service_principal_id  = azuread_service_principal.learning_assistant.object_id
      client_secret_name    = azurerm_key_vault_secret.azure_ad_client_secret.name
      tenant_id_secret_name = azurerm_key_vault_secret.azure_ad_tenant_id.name
    }
    groups = {
      admins     = azuread_group.app_admins.object_id
      developers = azuread_group.app_developers.object_id
      users      = azuread_group.app_users.object_id
    }
  }
}

# Security Outputs
output "security" {
  description = "Security configuration information"
  value = {
    network_watcher = {
      id   = azurerm_network_watcher.main.id
      name = azurerm_network_watcher.main.name
    }
    defender_enabled = var.enable_azure_defender
    compliance_monitoring = var.enable_compliance_monitoring
    ddos_protection = var.environment == "production" ? {
      id   = azurerm_network_ddos_protection_plan.main[0].id
      name = azurerm_network_ddos_protection_plan.main[0].name
    } : null
    sentinel = var.environment == "production" ? {
      workspace_id = azurerm_sentinel_log_analytics_workspace_onboarding.main[0].workspace_id
    } : null
  }
}

# Connection Information for Applications
output "connection_info" {
  description = "Connection information for applications (sensitive values are stored in Key Vault)"
  value = {
    database = {
      host     = azurerm_postgresql_flexible_server.main.fqdn
      port     = 5432
      database = azurerm_postgresql_flexible_server_database.learning_assistant.name
      username = "learning_assistant_app"
      password_secret = azurerm_key_vault_secret.postgresql_app_password.name
      connection_string_secret = azurerm_key_vault_secret.postgresql_connection_string.name
      ssl_mode = "require"
    }
    redis = {
      host     = azurerm_redis_cache.main.hostname
      port     = azurerm_redis_cache.main.ssl_port
      ssl      = true
      auth_key_secret = azurerm_key_vault_secret.redis_primary_key.name
      connection_string_secret = azurerm_key_vault_secret.redis_connection_string.name
    }
    azure_ad = {
      tenant_id     = data.azurerm_client_config.current.tenant_id
      client_id     = azuread_application.learning_assistant.application_id
      client_secret_name = azurerm_key_vault_secret.azure_ad_client_secret.name
      redirect_uri  = "https://${var.dns_zone_name != "" ? var.dns_zone_name : azurerm_public_ip.app_gateway_dns.fqdn}/auth/callback"
    }
    storage = {
      account_name = azurerm_storage_account.main.name
      endpoint     = azurerm_storage_account.main.primary_blob_endpoint
    }
    monitoring = {
      app_insights_connection_string_secret = "application-insights-connection-string"
      log_analytics_workspace_id = azurerm_log_analytics_workspace.aks.workspace_id
    }
  }
  sensitive = false
}

# Environment Configuration
output "environment_config" {
  description = "Environment-specific configuration"
  value = {
    environment = var.environment
    location    = var.location
    project_name = var.project_name
    name_prefix = local.name_prefix
    availability_zones = local.availability_zones
    features = {
      high_availability = var.postgresql_enable_high_availability
      geo_redundancy   = var.postgresql_geo_redundant_backup
      auto_scaling     = var.enable_cluster_autoscaler
      waf_enabled      = var.app_gateway_enable_waf
      private_endpoints = var.enable_private_endpoints
      disaster_recovery = var.enable_disaster_recovery
      cost_management  = var.enable_cost_management
    }
    compliance = var.compliance_standards
  }
}

# Deployment Information
output "deployment_info" {
  description = "Information about the deployment"
  value = {
    terraform_version = ">= 1.6.0"
    provider_versions = local.provider_versions
    deployment_date   = timestamp()
    resource_count = {
      resource_groups = 3
      virtual_networks = 1
      subnets = 6
      aks_clusters = 1
      databases = 1
      redis_caches = var.redis_sku_name == "Premium" && var.redis_capacity >= 3 ? 2 : 1
      storage_accounts = var.environment == "production" ? 2 : 1
      key_vaults = 1
      application_gateways = 1
      managed_identities = 4
    }
  }
}

# Cost Estimation (approximate)
output "cost_estimation" {
  description = "Approximate monthly cost estimation (USD)"
  value = {
    aks_cluster = var.aks_system_node_pool.vm_size == "Standard_D2s_v3" ? 150 : 300
    postgresql  = var.postgresql_sku_name == "GP_Standard_D2s_v3" ? 200 : 400
    redis       = var.redis_sku_name == "Standard" ? 100 : 300
    app_gateway = var.app_gateway_sku.tier == "WAF_v2" ? 250 : 150
    storage     = 50
    monitoring  = 100
    networking  = 50
    estimated_total = var.aks_system_node_pool.vm_size == "Standard_D2s_v3" ? 900 : 1350
    note = "This is an approximate estimation. Actual costs may vary based on usage, region, and specific configurations."
  }
}

# Quick Start URLs
output "quick_start_urls" {
  description = "Quick start URLs for accessing the application and services"
  value = {
    application_url = "https://${var.dns_zone_name != "" ? var.dns_zone_name : azurerm_public_ip.app_gateway_dns.fqdn}"
    api_url        = "https://${var.dns_zone_name != "" ? "api.${var.dns_zone_name}" : azurerm_public_ip.app_gateway_dns.fqdn}/api"
    admin_url      = "https://${var.dns_zone_name != "" ? "admin.${var.dns_zone_name}" : azurerm_public_ip.app_gateway_dns.fqdn}/admin"
    azure_portal   = "https://portal.azure.com/#@${data.azurerm_client_config.current.tenant_id}/resource${azurerm_resource_group.main.id}"
    key_vault_url  = "https://portal.azure.com/#@${data.azurerm_client_config.current.tenant_id}/resource${azurerm_key_vault.main.id}"
    aks_url        = "https://portal.azure.com/#@${data.azurerm_client_config.current.tenant_id}/resource${azurerm_kubernetes_cluster.main.id}"
    monitoring_url = "https://portal.azure.com/#@${data.azurerm_client_config.current.tenant_id}/resource${azurerm_application_insights.main.id}"
  }
}