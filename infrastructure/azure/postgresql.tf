# Azure Database for PostgreSQL Configuration
# This file defines the PostgreSQL Flexible Server with high availability, backups, and security

# Private DNS zone for PostgreSQL
resource "azurerm_private_dns_zone" "postgresql" {
  name                = "${local.name_prefix}-postgresql.private.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.networking.name

  tags = local.common_tags
}

# Link private DNS zone to VNet
resource "azurerm_private_dns_zone_virtual_network_link" "postgresql" {
  name                  = "${local.name_prefix}-postgresql-vnet-link"
  resource_group_name   = azurerm_resource_group.networking.name
  private_dns_zone_name = azurerm_private_dns_zone.postgresql.name
  virtual_network_id    = azurerm_virtual_network.main.id
  registration_enabled  = false

  tags = local.common_tags
}

# Random password for PostgreSQL admin
resource "random_password" "postgresql_admin" {
  length  = 32
  special = true
}

# Store PostgreSQL admin password in Key Vault
resource "azurerm_key_vault_secret" "postgresql_admin_password" {
  depends_on = [azurerm_key_vault_access_policy.current]
  
  name         = "postgresql-admin-password"
  value        = random_password.postgresql_admin.result
  key_vault_id = azurerm_key_vault.main.id

  tags = local.common_tags
}

# Random password for application database user
resource "random_password" "postgresql_app_user" {
  length  = 32
  special = true
}

# Store application database password in Key Vault
resource "azurerm_key_vault_secret" "postgresql_app_password" {
  depends_on = [azurerm_key_vault_access_policy.current]
  
  name         = "postgresql-app-password"
  value        = random_password.postgresql_app_user.result
  key_vault_id = azurerm_key_vault.main.id

  tags = local.common_tags
}

# PostgreSQL Flexible Server
resource "azurerm_postgresql_flexible_server" "main" {
  name                   = "${local.name_prefix}-postgresql"
  resource_group_name    = azurerm_resource_group.main.name
  location               = azurerm_resource_group.main.location
  version                = var.postgresql_version
  delegated_subnet_id    = azurerm_subnet.database.id
  private_dns_zone_id    = azurerm_private_dns_zone.postgresql.id
  administrator_login    = "postgresql_admin"
  administrator_password = random_password.postgresql_admin.result

  # Server configuration
  sku_name   = var.postgresql_sku_name
  storage_mb = var.postgresql_storage_mb
  zone       = "1"

  # High availability configuration
  dynamic "high_availability" {
    for_each = var.postgresql_enable_high_availability ? [1] : []
    content {
      mode                      = "ZoneRedundant"
      standby_availability_zone = "2"
    }
  }

  # Backup configuration
  backup_retention_days        = var.postgresql_backup_retention_days
  geo_redundant_backup_enabled = var.postgresql_geo_redundant_backup

  # Maintenance window
  maintenance_window {
    day_of_week  = 0  # Sunday
    start_hour   = 2
    start_minute = 0
  }

  # Auto-grow storage
  auto_grow_enabled = true

  tags = local.common_tags

  depends_on = [azurerm_private_dns_zone_virtual_network_link.postgresql]
}

# PostgreSQL Server configurations
resource "azurerm_postgresql_flexible_server_configuration" "shared_preload_libraries" {
  name      = "shared_preload_libraries"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "pg_stat_statements,pg_cron,pgaudit"
}

resource "azurerm_postgresql_flexible_server_configuration" "log_statement" {
  name      = "log_statement"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "all"
}

resource "azurerm_postgresql_flexible_server_configuration" "log_min_duration_statement" {
  name      = "log_min_duration_statement"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "1000"  # Log queries taking more than 1 second
}

resource "azurerm_postgresql_flexible_server_configuration" "log_checkpoints" {
  name      = "log_checkpoints"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "on"
}

resource "azurerm_postgresql_flexible_server_configuration" "log_connections" {
  name      = "log_connections"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "on"
}

resource "azurerm_postgresql_flexible_server_configuration" "log_disconnections" {
  name      = "log_disconnections"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "on"
}

resource "azurerm_postgresql_flexible_server_configuration" "log_lock_waits" {
  name      = "log_lock_waits"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "on"
}

resource "azurerm_postgresql_flexible_server_configuration" "connection_throttling" {
  name      = "connection_throttling"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "on"
}

resource "azurerm_postgresql_flexible_server_configuration" "pgaudit_log" {
  name      = "pgaudit.log"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "write,ddl"
}

resource "azurerm_postgresql_flexible_server_configuration" "pgaudit_log_catalog" {
  name      = "pgaudit.log_catalog"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "off"
}

# Application database
resource "azurerm_postgresql_flexible_server_database" "learning_assistant" {
  name      = "learning_assistant"
  server_id = azurerm_postgresql_flexible_server.main.id
  collation = "en_US.utf8"
  charset   = "utf8"
}

# Create application database user (using null_resource for SQL commands)
resource "null_resource" "postgresql_app_user" {
  depends_on = [azurerm_postgresql_flexible_server_database.learning_assistant]

  triggers = {
    server_id = azurerm_postgresql_flexible_server.main.id
    password  = random_password.postgresql_app_user.result
  }

  provisioner "local-exec" {
    command = <<-EOT
      # Install psql if not available
      if ! command -v psql &> /dev/null; then
        echo "PostgreSQL client (psql) is required but not installed."
        exit 1
      fi

      # Connect to PostgreSQL and create application user
      export PGPASSWORD="${random_password.postgresql_admin.result}"
      psql -h ${azurerm_postgresql_flexible_server.main.fqdn} \
           -U ${azurerm_postgresql_flexible_server.main.administrator_login} \
           -d postgres \
           -c "CREATE USER learning_assistant_app WITH PASSWORD '${random_password.postgresql_app_user.result}';"
      
      # Grant privileges
      psql -h ${azurerm_postgresql_flexible_server.main.fqdn} \
           -U ${azurerm_postgresql_flexible_server.main.administrator_login} \
           -d learning_assistant \
           -c "GRANT ALL PRIVILEGES ON DATABASE learning_assistant TO learning_assistant_app;"
      
      psql -h ${azurerm_postgresql_flexible_server.main.fqdn} \
           -U ${azurerm_postgresql_flexible_server.main.administrator_login} \
           -d learning_assistant \
           -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO learning_assistant_app;"
      
      psql -h ${azurerm_postgresql_flexible_server.main.fqdn} \
           -U ${azurerm_postgresql_flexible_server.main.administrator_login} \
           -d learning_assistant \
           -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO learning_assistant_app;"
      
      psql -h ${azurerm_postgresql_flexible_server.main.fqdn} \
           -U ${azurerm_postgresql_flexible_server.main.administrator_login} \
           -d learning_assistant \
           -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO learning_assistant_app;"
      
      psql -h ${azurerm_postgresql_flexible_server.main.fqdn} \
           -U ${azurerm_postgresql_flexible_server.main.administrator_login} \
           -d learning_assistant \
           -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO learning_assistant_app;"
    EOT
  }

  provisioner "local-exec" {
    when = destroy
    command = <<-EOT
      # Cleanup application user on destroy
      export PGPASSWORD="${random_password.postgresql_admin.result}"
      psql -h ${azurerm_postgresql_flexible_server.main.fqdn} \
           -U ${azurerm_postgresql_flexible_server.main.administrator_login} \
           -d postgres \
           -c "DROP USER IF EXISTS learning_assistant_app;" || true
    EOT
  }
}

# Private endpoint for PostgreSQL (if enabled)
resource "azurerm_private_endpoint" "postgresql" {
  count = var.enable_private_endpoints ? 1 : 0
  
  name                = "${local.name_prefix}-postgresql-pe"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  subnet_id           = azurerm_subnet.private_endpoints.id

  private_service_connection {
    name                           = "${local.name_prefix}-postgresql-psc"
    private_connection_resource_id = azurerm_postgresql_flexible_server.main.id
    subresource_names              = ["postgresqlServer"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [azurerm_private_dns_zone.postgresql.id]
  }

  tags = local.common_tags
}

# PostgreSQL firewall rule to allow Azure services (if private endpoints are disabled)
resource "azurerm_postgresql_flexible_server_firewall_rule" "azure_services" {
  count = var.enable_private_endpoints ? 0 : 1
  
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# PostgreSQL diagnostic settings
resource "azurerm_monitor_diagnostic_setting" "postgresql" {
  name                       = "${local.name_prefix}-postgresql-diagnostics"
  target_resource_id         = azurerm_postgresql_flexible_server.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.aks.id

  dynamic "enabled_log" {
    for_each = [
      "PostgreSQLLogs",
      "PostgreSQLFlexDatabaseXacts",
      "PostgreSQLFlexQueryStoreRuntime",
      "PostgreSQLFlexQueryStoreWaitStats",
      "PostgreSQLFlexTableStats",
      "PostgreSQLFlexSessions"
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

# Create PostgreSQL connection string secret
resource "azurerm_key_vault_secret" "postgresql_connection_string" {
  depends_on = [azurerm_key_vault_access_policy.current]
  
  name         = "postgresql-connection-string"
  value        = "postgresql://learning_assistant_app:${random_password.postgresql_app_user.result}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/learning_assistant?sslmode=require"
  key_vault_id = azurerm_key_vault.main.id

  tags = local.common_tags
}

# PostgreSQL outputs
output "postgresql_server_id" {
  description = "ID of the PostgreSQL Flexible Server"
  value       = azurerm_postgresql_flexible_server.main.id
}

output "postgresql_server_fqdn" {
  description = "FQDN of the PostgreSQL Flexible Server"
  value       = azurerm_postgresql_flexible_server.main.fqdn
}

output "postgresql_database_name" {
  description = "Name of the application database"
  value       = azurerm_postgresql_flexible_server_database.learning_assistant.name
}

output "postgresql_admin_username" {
  description = "Administrator username for PostgreSQL"
  value       = azurerm_postgresql_flexible_server.main.administrator_login
}

output "postgresql_admin_password_secret_name" {
  description = "Name of the Key Vault secret containing PostgreSQL admin password"
  value       = azurerm_key_vault_secret.postgresql_admin_password.name
}

output "postgresql_app_password_secret_name" {
  description = "Name of the Key Vault secret containing PostgreSQL app password"
  value       = azurerm_key_vault_secret.postgresql_app_password.name
}

output "postgresql_connection_string_secret_name" {
  description = "Name of the Key Vault secret containing PostgreSQL connection string"
  value       = azurerm_key_vault_secret.postgresql_connection_string.name
}

output "postgresql_private_dns_zone_id" {
  description = "ID of the PostgreSQL private DNS zone"
  value       = azurerm_private_dns_zone.postgresql.id
}

output "postgresql_private_endpoint_id" {
  description = "ID of the PostgreSQL private endpoint"
  value       = var.enable_private_endpoints ? azurerm_private_endpoint.postgresql[0].id : null
}