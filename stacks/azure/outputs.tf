output "acr_login_server" {
  value     = azurerm_container_registry.acr.login_server
  sensitive = false
}

output "acr_admin_username" {
  value     = azurerm_container_registry.acr.admin_username
  sensitive = false
}

output "acr_admin_password" {
  value     = azurerm_container_registry.acr.admin_password
  sensitive = true
}

output "postgres_hostname" {
  value = azurerm_postgresql_flexible_server.postgres.fqdn
}

output "postgres_admin_login" {
  value = azurerm_postgresql_flexible_server.postgres.administrator_login
}

output "postgres_admin_password" {
  value     = azurerm_postgresql_flexible_server.postgres.administrator_login_password
  sensitive = true
}

output "redis_hostname" {
  value = azurerm_redis_cache.redis.hostname
}

output "redis_primary_access_key" {
  value     = azurerm_redis_cache.redis.primary_access_key
  sensitive = true
}

output "storage_primary_connection_string" {
  value     = azurerm_storage_account.storage.primary_connection_string
  sensitive = true
}

output "storage_primary_blob_endpoint" {
  value = azurerm_storage_account.storage.primary_blob_endpoint
}

output "cdn_endpoint_hostname" {
  value = azurerm_cdn_endpoint.cdn.hostname
}

output "log_analytics_workspace_id" {
  value = azurerm_log_analytics_workspace.log_analytics.id
}

output "app_insights_instrumentation_key" {
  value     = azurerm_application_insights.app_insights.instrumentation_key
  sensitive = true
}

output "managed_identity_id" {
  value = azurerm_user_assigned_identity.identity.id
}

output "managed_identity_principal_id" {
  value = azurerm_user_assigned_identity.identity.principal_id
}

output "managed_identity_tenant_id" {
  value = azurerm_user_assigned_identity.identity.tenant_id
}
