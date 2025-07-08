# Azure Cache for Redis Configuration
# This file defines the Redis cache with clustering, SSL, and high availability

# Private DNS zone for Redis
resource "azurerm_private_dns_zone" "redis" {
  name                = "${local.name_prefix}-redis.private.redis.cache.windows.net"
  resource_group_name = azurerm_resource_group.networking.name

  tags = local.common_tags
}

# Link private DNS zone to VNet
resource "azurerm_private_dns_zone_virtual_network_link" "redis" {
  name                  = "${local.name_prefix}-redis-vnet-link"
  resource_group_name   = azurerm_resource_group.networking.name
  private_dns_zone_name = azurerm_private_dns_zone.redis.name
  virtual_network_id    = azurerm_virtual_network.main.id
  registration_enabled  = false

  tags = local.common_tags
}

# Random password for Redis authentication
resource "random_password" "redis_auth" {
  length  = 32
  special = true
}

# Store Redis authentication key in Key Vault
resource "azurerm_key_vault_secret" "redis_auth_key" {
  depends_on = [azurerm_key_vault_access_policy.current]
  
  name         = "redis-auth-key"
  value        = random_password.redis_auth.result
  key_vault_id = azurerm_key_vault.main.id

  tags = local.common_tags
}

# Azure Cache for Redis
resource "azurerm_redis_cache" "main" {
  name                = "${local.name_prefix}-redis"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  capacity            = var.redis_capacity
  family              = var.redis_family
  sku_name            = var.redis_sku_name
  minimum_tls_version = var.redis_minimum_tls_version

  # Enable auth and set custom auth key
  enable_non_ssl_port = var.redis_enable_non_ssl_port
  redis_version       = "6"

  # Advanced configuration
  redis_configuration {
    # Authentication
    enable_authentication = true
    
    # Memory management
    maxmemory_reserved = var.redis_sku_name == "Premium" ? 125 : 50
    maxmemory_delta    = var.redis_sku_name == "Premium" ? 125 : 50
    maxmemory_policy   = "allkeys-lru"
    
    # Persistence (Premium only)
    rdb_backup_enabled = var.redis_sku_name == "Premium" ? true : false
    rdb_backup_frequency = var.redis_sku_name == "Premium" ? 60 : null
    rdb_backup_max_snapshot_count = var.redis_sku_name == "Premium" ? 1 : null
    rdb_storage_connection_string = var.redis_sku_name == "Premium" ? azurerm_storage_account.main.primary_connection_string : null
    
    # AOF persistence (Premium only)
    aof_backup_enabled = var.redis_sku_name == "Premium" ? true : false
    aof_storage_connection_string_0 = var.redis_sku_name == "Premium" ? azurerm_storage_account.main.primary_connection_string : null
    aof_storage_connection_string_1 = var.redis_sku_name == "Premium" ? azurerm_storage_account.main.secondary_connection_string : null
    
    # Notifications
    notify_keyspace_events = "Ex"
  }

  # Zone redundancy for Premium SKU
  zones = var.redis_sku_name == "Premium" ? local.availability_zones : null

  # Network configuration for Premium SKU
  dynamic "private_static_ip_address" {
    for_each = var.redis_sku_name == "Premium" ? [1] : []
    content {
      value = cidrhost(local.subnet_cidrs.redis, 4)
    }
  }

  dynamic "subnet_id" {
    for_each = var.redis_sku_name == "Premium" ? [1] : []
    content {
      value = azurerm_subnet.redis.id
    }
  }

  # Firewall rules for non-Premium SKUs
  dynamic "patch_schedule" {
    for_each = var.redis_sku_name != "Basic" ? [1] : []
    content {
      day_of_week    = "Sunday"
      start_hour_utc = 2
    }
  }

  tags = local.common_tags
}

# Private endpoint for Redis (if enabled and not Premium with VNet injection)
resource "azurerm_private_endpoint" "redis" {
  count = var.enable_private_endpoints && var.redis_sku_name != "Premium" ? 1 : 0
  
  name                = "${local.name_prefix}-redis-pe"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  subnet_id           = azurerm_subnet.private_endpoints.id

  private_service_connection {
    name                           = "${local.name_prefix}-redis-psc"
    private_connection_resource_id = azurerm_redis_cache.main.id
    subresource_names              = ["redisCache"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [azurerm_private_dns_zone.redis.id]
  }

  tags = local.common_tags
}

# Redis firewall rule to allow Azure services (if private endpoints are disabled)
resource "azurerm_redis_firewall_rule" "azure_services" {
  count = var.enable_private_endpoints ? 0 : 1
  
  name                = "AllowAzureServices"
  redis_cache_name    = azurerm_redis_cache.main.name
  resource_group_name = azurerm_resource_group.main.name
  start_ip            = "0.0.0.0"
  end_ip              = "0.0.0.0"
}

# Redis diagnostic settings
resource "azurerm_monitor_diagnostic_setting" "redis" {
  name                       = "${local.name_prefix}-redis-diagnostics"
  target_resource_id         = azurerm_redis_cache.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.aks.id

  dynamic "enabled_log" {
    for_each = ["ConnectedClientList"]
    content {
      category = enabled_log.value
    }
  }

  metric {
    category = "AllMetrics"
    enabled  = true
  }
}

# Create Redis connection string secret
resource "azurerm_key_vault_secret" "redis_connection_string" {
  depends_on = [azurerm_key_vault_access_policy.current]
  
  name         = "redis-connection-string"
  value        = "rediss://:${azurerm_redis_cache.main.primary_access_key}@${azurerm_redis_cache.main.hostname}:${azurerm_redis_cache.main.ssl_port}"
  key_vault_id = azurerm_key_vault.main.id

  tags = local.common_tags
}

# Create Redis primary key secret
resource "azurerm_key_vault_secret" "redis_primary_key" {
  depends_on = [azurerm_key_vault_access_policy.current]
  
  name         = "redis-primary-key"
  value        = azurerm_redis_cache.main.primary_access_key
  key_vault_id = azurerm_key_vault.main.id

  tags = local.common_tags
}

# Create Redis secondary key secret
resource "azurerm_key_vault_secret" "redis_secondary_key" {
  depends_on = [azurerm_key_vault_access_policy.current]
  
  name         = "redis-secondary-key"
  value        = azurerm_redis_cache.main.secondary_access_key
  key_vault_id = azurerm_key_vault.main.id

  tags = local.common_tags
}

# Redis cluster configuration (for Premium SKU with clustering)
resource "azurerm_redis_cache" "cluster" {
  count = var.redis_sku_name == "Premium" && var.redis_capacity >= 3 ? 1 : 0
  
  name                = "${local.name_prefix}-redis-cluster"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  capacity            = var.redis_capacity
  family              = var.redis_family
  sku_name            = var.redis_sku_name
  minimum_tls_version = var.redis_minimum_tls_version

  # Enable clustering
  enable_non_ssl_port = var.redis_enable_non_ssl_port
  redis_version       = "6"
  shard_count         = var.redis_capacity == 3 ? 3 : var.redis_capacity == 4 ? 6 : 10

  # Advanced configuration
  redis_configuration {
    # Authentication
    enable_authentication = true
    
    # Memory management
    maxmemory_reserved = 125
    maxmemory_delta    = 125
    maxmemory_policy   = "allkeys-lru"
    
    # Persistence
    rdb_backup_enabled = true
    rdb_backup_frequency = 60
    rdb_backup_max_snapshot_count = 1
    rdb_storage_connection_string = azurerm_storage_account.main.primary_connection_string
    
    # AOF persistence
    aof_backup_enabled = true
    aof_storage_connection_string_0 = azurerm_storage_account.main.primary_connection_string
    aof_storage_connection_string_1 = azurerm_storage_account.main.secondary_connection_string
    
    # Notifications
    notify_keyspace_events = "Ex"
  }

  # Zone redundancy
  zones = local.availability_zones

  # Network configuration
  subnet_id = azurerm_subnet.redis.id

  # Patch schedule
  patch_schedule {
    day_of_week    = "Sunday"
    start_hour_utc = 2
  }

  tags = local.common_tags
}

# Create Redis cluster connection string secret (if cluster is enabled)
resource "azurerm_key_vault_secret" "redis_cluster_connection_string" {
  count = var.redis_sku_name == "Premium" && var.redis_capacity >= 3 ? 1 : 0
  
  depends_on = [azurerm_key_vault_access_policy.current]
  
  name         = "redis-cluster-connection-string"
  value        = "rediss://:${azurerm_redis_cache.cluster[0].primary_access_key}@${azurerm_redis_cache.cluster[0].hostname}:${azurerm_redis_cache.cluster[0].ssl_port}"
  key_vault_id = azurerm_key_vault.main.id

  tags = local.common_tags
}

# Redis outputs
output "redis_cache_id" {
  description = "ID of the Redis cache"
  value       = azurerm_redis_cache.main.id
}

output "redis_cache_hostname" {
  description = "Hostname of the Redis cache"
  value       = azurerm_redis_cache.main.hostname
}

output "redis_cache_ssl_port" {
  description = "SSL port of the Redis cache"
  value       = azurerm_redis_cache.main.ssl_port
}

output "redis_cache_port" {
  description = "Non-SSL port of the Redis cache"
  value       = azurerm_redis_cache.main.port
}

output "redis_primary_key_secret_name" {
  description = "Name of the Key Vault secret containing Redis primary key"
  value       = azurerm_key_vault_secret.redis_primary_key.name
}

output "redis_secondary_key_secret_name" {
  description = "Name of the Key Vault secret containing Redis secondary key"
  value       = azurerm_key_vault_secret.redis_secondary_key.name
}

output "redis_connection_string_secret_name" {
  description = "Name of the Key Vault secret containing Redis connection string"
  value       = azurerm_key_vault_secret.redis_connection_string.name
}

output "redis_cluster_id" {
  description = "ID of the Redis cluster (if enabled)"
  value       = var.redis_sku_name == "Premium" && var.redis_capacity >= 3 ? azurerm_redis_cache.cluster[0].id : null
}

output "redis_cluster_hostname" {
  description = "Hostname of the Redis cluster (if enabled)"
  value       = var.redis_sku_name == "Premium" && var.redis_capacity >= 3 ? azurerm_redis_cache.cluster[0].hostname : null
}

output "redis_cluster_connection_string_secret_name" {
  description = "Name of the Key Vault secret containing Redis cluster connection string"
  value       = var.redis_sku_name == "Premium" && var.redis_capacity >= 3 ? azurerm_key_vault_secret.redis_cluster_connection_string[0].name : null
}

output "redis_private_dns_zone_id" {
  description = "ID of the Redis private DNS zone"
  value       = azurerm_private_dns_zone.redis.id
}

output "redis_private_endpoint_id" {
  description = "ID of the Redis private endpoint"
  value       = var.enable_private_endpoints && var.redis_sku_name != "Premium" ? azurerm_private_endpoint.redis[0].id : null
}