# Azure Monitoring Configuration
# This file defines comprehensive monitoring, alerting, and observability for the learning assistant

# Action Group for notifications
resource "azurerm_monitor_action_group" "main" {
  name                = "${local.name_prefix}-alerts"
  resource_group_name = azurerm_resource_group.monitoring.name
  short_name          = "alerts"

  # Email notifications
  email_receiver {
    name          = "admin-email"
    email_address = "admin@${var.dns_zone_name != "" ? var.dns_zone_name : "example.com"}"
  }

  # SMS notifications (optional)
  dynamic "sms_receiver" {
    for_each = var.environment == "production" ? [1] : []
    content {
      name         = "admin-sms"
      country_code = "1"
      phone_number = "5551234567"  # Replace with actual phone number
    }
  }

  # Webhook notifications
  webhook_receiver {
    name        = "slack-webhook"
    service_uri = "https://hooks.slack.com/services/placeholder"  # Replace with actual Slack webhook
  }

  # Azure Function for custom notifications
  azure_function_receiver {
    name                     = "custom-alerts"
    function_app_resource_id = azurerm_function_app.monitoring[0].id
    function_name            = "ProcessAlert"
    http_trigger_url         = "https://${azurerm_function_app.monitoring[0].default_hostname}/api/ProcessAlert"
  }

  tags = local.common_tags
}

# Action Group for critical alerts
resource "azurerm_monitor_action_group" "critical" {
  name                = "${local.name_prefix}-critical-alerts"
  resource_group_name = azurerm_resource_group.monitoring.name
  short_name          = "critical"

  # Email notifications
  email_receiver {
    name          = "admin-email"
    email_address = "admin@${var.dns_zone_name != "" ? var.dns_zone_name : "example.com"}"
  }

  email_receiver {
    name          = "oncall-email"
    email_address = "oncall@${var.dns_zone_name != "" ? var.dns_zone_name : "example.com"}"
  }

  # SMS for critical alerts
  sms_receiver {
    name         = "admin-sms"
    country_code = "1"
    phone_number = "5551234567"  # Replace with actual phone number
  }

  # Voice call for critical alerts
  voice_receiver {
    name         = "admin-voice"
    country_code = "1"
    phone_number = "5551234567"  # Replace with actual phone number
  }

  tags = local.common_tags
}

# Application Insights for application monitoring
resource "azurerm_application_insights_web_test" "availability" {
  name                    = "${local.name_prefix}-availability-test"
  location                = azurerm_resource_group.monitoring.location
  resource_group_name     = azurerm_resource_group.monitoring.name
  application_insights_id = azurerm_application_insights.main.id
  kind                    = "ping"
  frequency               = 300
  timeout                 = 30
  enabled                 = true
  retry_enabled           = true
  geo_locations           = ["us-ca-sjc-azr", "us-tx-sn1-azr", "us-il-ch1-azr"]

  configuration = <<XML
<WebTest Name="${local.name_prefix}-availability-test" Id="00000000-0000-0000-0000-000000000000" Enabled="True" CssProjectStructure="" CssIteration="" Timeout="30" WorkItemIds="" xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010" Description="" CredentialUserName="" CredentialPassword="" PreAuthenticate="True" Proxy="default" StopOnError="False" RecordedResultFile="" ResultsLocale="">
  <Items>
    <Request Method="GET" Guid="a5f10126-e4cd-570d-961c-cea43999a200" Version="1.1" Url="https://${var.dns_zone_name != "" ? var.dns_zone_name : azurerm_public_ip.app_gateway_dns.fqdn}/health" ThinkTime="0" Timeout="30" ParseDependentRequests="True" FollowRedirects="True" RecordResult="True" Cache="False" ResponseTimeGoal="0" Encoding="utf-8" ExpectedHttpStatusCode="200" ExpectedResponseUrl="" ReportingName="" IgnoreHttpStatusCode="False" />
  </Items>
</WebTest>
XML

  tags = local.common_tags
}

# Storage Account for Azure Functions
resource "azurerm_storage_account" "functions" {
  count = var.environment == "production" ? 1 : 0
  
  name                = "${replace(local.name_prefix, "-", "")}funcs${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.monitoring.name
  location            = azurerm_resource_group.monitoring.location

  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "StorageV2"

  tags = local.common_tags
}

# App Service Plan for Azure Functions
resource "azurerm_service_plan" "functions" {
  count = var.environment == "production" ? 1 : 0
  
  name                = "${local.name_prefix}-functions-plan"
  resource_group_name = azurerm_resource_group.monitoring.name
  location            = azurerm_resource_group.monitoring.location
  os_type             = "Linux"
  sku_name            = "Y1"  # Consumption plan

  tags = local.common_tags
}

# Azure Function for custom monitoring
resource "azurerm_function_app" "monitoring" {
  count = var.environment == "production" ? 1 : 0
  
  name                       = "${local.name_prefix}-monitoring-func"
  location                   = azurerm_resource_group.monitoring.location
  resource_group_name        = azurerm_resource_group.monitoring.name
  app_service_plan_id        = azurerm_service_plan.functions[0].id
  storage_account_name       = azurerm_storage_account.functions[0].name
  storage_account_access_key = azurerm_storage_account.functions[0].primary_access_key
  os_type                    = "linux"
  version                    = "~4"

  app_settings = {
    "FUNCTIONS_WORKER_RUNTIME"     = "node"
    "WEBSITE_NODE_DEFAULT_VERSION" = "~18"
    "APPLICATIONINSIGHTS_CONNECTION_STRING" = azurerm_application_insights.main.connection_string
  }

  tags = local.common_tags
}

# Alert rules for AKS cluster
resource "azurerm_monitor_metric_alert" "aks_cpu" {
  name                = "${local.name_prefix}-aks-cpu-alert"
  resource_group_name = azurerm_resource_group.monitoring.name
  scopes              = [azurerm_kubernetes_cluster.main.id]
  description         = "Alert when AKS cluster CPU usage is high"
  enabled             = true
  auto_mitigate       = true
  frequency           = "PT1M"
  window_size         = "PT5M"
  severity            = 2

  criteria {
    metric_namespace = "Microsoft.ContainerService/managedClusters"
    metric_name      = "node_cpu_usage_percentage"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 80
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }

  tags = local.common_tags
}

resource "azurerm_monitor_metric_alert" "aks_memory" {
  name                = "${local.name_prefix}-aks-memory-alert"
  resource_group_name = azurerm_resource_group.monitoring.name
  scopes              = [azurerm_kubernetes_cluster.main.id]
  description         = "Alert when AKS cluster memory usage is high"
  enabled             = true
  auto_mitigate       = true
  frequency           = "PT1M"
  window_size         = "PT5M"
  severity            = 2

  criteria {
    metric_namespace = "Microsoft.ContainerService/managedClusters"
    metric_name      = "node_memory_working_set_percentage"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 85
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }

  tags = local.common_tags
}

# Alert rules for PostgreSQL
resource "azurerm_monitor_metric_alert" "postgresql_cpu" {
  name                = "${local.name_prefix}-postgresql-cpu-alert"
  resource_group_name = azurerm_resource_group.monitoring.name
  scopes              = [azurerm_postgresql_flexible_server.main.id]
  description         = "Alert when PostgreSQL CPU usage is high"
  enabled             = true
  auto_mitigate       = true
  frequency           = "PT1M"
  window_size         = "PT5M"
  severity            = 2

  criteria {
    metric_namespace = "Microsoft.DBforPostgreSQL/flexibleServers"
    metric_name      = "cpu_percent"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 80
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }

  tags = local.common_tags
}

resource "azurerm_monitor_metric_alert" "postgresql_connections" {
  name                = "${local.name_prefix}-postgresql-connections-alert"
  resource_group_name = azurerm_resource_group.monitoring.name
  scopes              = [azurerm_postgresql_flexible_server.main.id]
  description         = "Alert when PostgreSQL connection count is high"
  enabled             = true
  auto_mitigate       = true
  frequency           = "PT1M"
  window_size         = "PT5M"
  severity            = 2

  criteria {
    metric_namespace = "Microsoft.DBforPostgreSQL/flexibleServers"
    metric_name      = "active_connections"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 80
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }

  tags = local.common_tags
}

# Alert rules for Redis
resource "azurerm_monitor_metric_alert" "redis_cpu" {
  name                = "${local.name_prefix}-redis-cpu-alert"
  resource_group_name = azurerm_resource_group.monitoring.name
  scopes              = [azurerm_redis_cache.main.id]
  description         = "Alert when Redis CPU usage is high"
  enabled             = true
  auto_mitigate       = true
  frequency           = "PT1M"
  window_size         = "PT5M"
  severity            = 2

  criteria {
    metric_namespace = "Microsoft.Cache/Redis"
    metric_name      = "percentProcessorTime"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 80
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }

  tags = local.common_tags
}

resource "azurerm_monitor_metric_alert" "redis_memory" {
  name                = "${local.name_prefix}-redis-memory-alert"
  resource_group_name = azurerm_resource_group.monitoring.name
  scopes              = [azurerm_redis_cache.main.id]
  description         = "Alert when Redis memory usage is high"
  enabled             = true
  auto_mitigate       = true
  frequency           = "PT1M"
  window_size         = "PT5M"
  severity            = 2

  criteria {
    metric_namespace = "Microsoft.Cache/Redis"
    metric_name      = "usedmemorypercentage"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 90
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }

  tags = local.common_tags
}

# Alert rules for Application Gateway
resource "azurerm_monitor_metric_alert" "app_gateway_unhealthy_hosts" {
  name                = "${local.name_prefix}-appgw-unhealthy-hosts-alert"
  resource_group_name = azurerm_resource_group.monitoring.name
  scopes              = [azurerm_application_gateway.main.id]
  description         = "Alert when Application Gateway has unhealthy backend hosts"
  enabled             = true
  auto_mitigate       = true
  frequency           = "PT1M"
  window_size         = "PT5M"
  severity            = 1

  criteria {
    metric_namespace = "Microsoft.Network/applicationGateways"
    metric_name      = "UnhealthyHostCount"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 0
  }

  action {
    action_group_id = azurerm_monitor_action_group.critical.id
  }

  tags = local.common_tags
}

resource "azurerm_monitor_metric_alert" "app_gateway_response_time" {
  name                = "${local.name_prefix}-appgw-response-time-alert"
  resource_group_name = azurerm_resource_group.monitoring.name
  scopes              = [azurerm_application_gateway.main.id]
  description         = "Alert when Application Gateway response time is high"
  enabled             = true
  auto_mitigate       = true
  frequency           = "PT1M"
  window_size         = "PT5M"
  severity            = 2

  criteria {
    metric_namespace = "Microsoft.Network/applicationGateways"
    metric_name      = "BackendResponseTime"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 5000  # 5 seconds
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }

  tags = local.common_tags
}

# Application Insights availability alert
resource "azurerm_monitor_metric_alert" "availability" {
  name                = "${local.name_prefix}-availability-alert"
  resource_group_name = azurerm_resource_group.monitoring.name
  scopes              = [azurerm_application_insights.main.id]
  description         = "Alert when application availability is low"
  enabled             = true
  auto_mitigate       = true
  frequency           = "PT1M"
  window_size         = "PT5M"
  severity            = 1

  criteria {
    metric_namespace = "Microsoft.Insights/components"
    metric_name      = "availabilityResults/availabilityPercentage"
    aggregation      = "Average"
    operator         = "LessThan"
    threshold        = 95
  }

  action {
    action_group_id = azurerm_monitor_action_group.critical.id
  }

  tags = local.common_tags
}

# Budget alert for cost management
resource "azurerm_consumption_budget_resource_group" "main" {
  count = var.enable_cost_management ? 1 : 0
  
  name              = "${local.name_prefix}-budget"
  resource_group_id = azurerm_resource_group.main.id

  amount     = var.monthly_budget_amount
  time_grain = "Monthly"

  time_period {
    start_date = formatdate("YYYY-MM-01'T'00:00:00'Z'", timestamp())
  }

  dynamic "notification" {
    for_each = var.budget_alert_thresholds
    content {
      enabled        = true
      threshold      = notification.value
      operator       = "GreaterThan"
      threshold_type = "Actual"
      
      contact_emails = [
        "admin@${var.dns_zone_name != "" ? var.dns_zone_name : "example.com"}"
      ]
      
      contact_groups = [
        azurerm_monitor_action_group.main.id
      ]
    }
  }

  tags = local.common_tags
}

# Log Analytics solutions
resource "azurerm_log_analytics_solution" "container_insights" {
  solution_name         = "ContainerInsights"
  location              = azurerm_resource_group.monitoring.location
  resource_group_name   = azurerm_resource_group.monitoring.name
  workspace_resource_id = azurerm_log_analytics_workspace.aks.id
  workspace_name        = azurerm_log_analytics_workspace.aks.name

  plan {
    publisher = "Microsoft"
    product   = "OMSGallery/ContainerInsights"
  }

  tags = local.common_tags
}

# Security Center contact
resource "azurerm_security_center_contact" "main" {
  count = var.enable_security_center ? 1 : 0
  
  email = "security@${var.dns_zone_name != "" ? var.dns_zone_name : "example.com"}"
  phone = "+15551234567"

  alert_notifications = true
  alerts_to_admins    = true
}

# Security Center workspace
resource "azurerm_security_center_workspace" "main" {
  count = var.enable_security_center ? 1 : 0
  
  scope        = data.azurerm_subscription.current.id
  workspace_id = azurerm_log_analytics_workspace.aks.id
}

# Monitoring outputs
output "application_insights_id" {
  description = "ID of the Application Insights instance"
  value       = azurerm_application_insights.main.id
}

output "application_insights_instrumentation_key" {
  description = "Instrumentation key for Application Insights"
  value       = azurerm_application_insights.main.instrumentation_key
  sensitive   = true
}

output "application_insights_connection_string" {
  description = "Connection string for Application Insights"
  value       = azurerm_application_insights.main.connection_string
  sensitive   = true
}

output "log_analytics_workspace_id" {
  description = "ID of the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.aks.id
}

output "log_analytics_workspace_name" {
  description = "Name of the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.aks.name
}

output "action_group_id" {
  description = "ID of the main action group"
  value       = azurerm_monitor_action_group.main.id
}

output "critical_action_group_id" {
  description = "ID of the critical action group"
  value       = azurerm_monitor_action_group.critical.id
}

output "availability_test_id" {
  description = "ID of the availability test"
  value       = azurerm_application_insights_web_test.availability.id
}

output "budget_id" {
  description = "ID of the budget"
  value       = var.enable_cost_management ? azurerm_consumption_budget_resource_group.main[0].id : null
}

output "monitoring_function_app_name" {
  description = "Name of the monitoring function app"
  value       = var.environment == "production" ? azurerm_function_app.monitoring[0].name : null
}