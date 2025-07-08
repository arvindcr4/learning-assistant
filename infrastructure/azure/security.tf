# Azure Security Configuration
# This file defines security policies, configurations, and compliance settings

# Azure Security Center settings
resource "azurerm_security_center_subscription_pricing" "defender_servers" {
  count = var.enable_azure_defender ? 1 : 0
  
  tier          = "Standard"
  resource_type = "VirtualMachines"
}

resource "azurerm_security_center_subscription_pricing" "defender_storage" {
  count = var.enable_azure_defender ? 1 : 0
  
  tier          = "Standard"
  resource_type = "StorageAccounts"
}

resource "azurerm_security_center_subscription_pricing" "defender_containers" {
  count = var.enable_azure_defender ? 1 : 0
  
  tier          = "Standard"
  resource_type = "Containers"
}

resource "azurerm_security_center_subscription_pricing" "defender_keyvault" {
  count = var.enable_azure_defender ? 1 : 0
  
  tier          = "Standard"
  resource_type = "KeyVaults"
}

resource "azurerm_security_center_subscription_pricing" "defender_databases" {
  count = var.enable_azure_defender ? 1 : 0
  
  tier          = "Standard"
  resource_type = "SqlServers"
}

# Azure Policy assignments for security compliance
resource "azurerm_policy_assignment" "security_benchmark" {
  count = var.enable_compliance_monitoring ? 1 : 0
  
  name                 = "${local.name_prefix}-security-benchmark"
  scope                = azurerm_resource_group.main.id
  policy_definition_id = "/providers/Microsoft.Authorization/policySetDefinitions/1f3afdf9-d0c9-4c3d-847f-89da613e70a8"
  description          = "Azure Security Benchmark policy assignment"
  display_name         = "Azure Security Benchmark"

  parameters = jsonencode({
    effect = {
      value = "AuditIfNotExists"
    }
  })

  metadata = jsonencode({
    category = "Security"
  })
}

resource "azurerm_policy_assignment" "cis_kubernetes" {
  count = var.enable_compliance_monitoring ? 1 : 0
  
  name                 = "${local.name_prefix}-cis-kubernetes"
  scope                = azurerm_kubernetes_cluster.main.id
  policy_definition_id = "/providers/Microsoft.Authorization/policySetDefinitions/a8640138-9b0a-4a28-b8cb-1666c838647d"
  description          = "CIS Microsoft Kubernetes Service Benchmark policy assignment"
  display_name         = "CIS Kubernetes Benchmark"

  parameters = jsonencode({
    effect = {
      value = "audit"
    }
  })

  metadata = jsonencode({
    category = "Kubernetes"
  })
}

# Network Watcher for network monitoring
resource "azurerm_network_watcher" "main" {
  name                = "${local.name_prefix}-network-watcher"
  location            = azurerm_resource_group.networking.location
  resource_group_name = azurerm_resource_group.networking.name

  tags = local.common_tags
}

# Network Watcher Flow Logs for NSG monitoring
resource "azurerm_network_watcher_flow_log" "aks_system" {
  network_watcher_name = azurerm_network_watcher.main.name
  resource_group_name  = azurerm_resource_group.networking.name

  network_security_group_id = azurerm_network_security_group.aks_system.id
  storage_account_id        = azurerm_storage_account.main.id
  enabled                   = true

  retention_policy {
    enabled = true
    days    = var.environment == "production" ? 90 : 30
  }

  traffic_analytics {
    enabled               = true
    workspace_id          = azurerm_log_analytics_workspace.aks.workspace_id
    workspace_region      = azurerm_log_analytics_workspace.aks.location
    workspace_resource_id = azurerm_log_analytics_workspace.aks.id
    interval_in_minutes   = 10
  }

  tags = local.common_tags
}

resource "azurerm_network_watcher_flow_log" "aks_user" {
  network_watcher_name = azurerm_network_watcher.main.name
  resource_group_name  = azurerm_resource_group.networking.name

  network_security_group_id = azurerm_network_security_group.aks_user.id
  storage_account_id        = azurerm_storage_account.main.id
  enabled                   = true

  retention_policy {
    enabled = true
    days    = var.environment == "production" ? 90 : 30
  }

  traffic_analytics {
    enabled               = true
    workspace_id          = azurerm_log_analytics_workspace.aks.workspace_id
    workspace_region      = azurerm_log_analytics_workspace.aks.location
    workspace_resource_id = azurerm_log_analytics_workspace.aks.id
    interval_in_minutes   = 10
  }

  tags = local.common_tags
}

# Azure Sentinel (Security Information and Event Management)
resource "azurerm_sentinel_log_analytics_workspace_onboarding" "main" {
  count = var.environment == "production" ? 1 : 0
  
  workspace_id                 = azurerm_log_analytics_workspace.aks.id
  customer_managed_key_enabled = false
}

# Sentinel data connectors
resource "azurerm_sentinel_data_connector_azure_active_directory" "main" {
  count = var.environment == "production" ? 1 : 0
  
  name                       = "${local.name_prefix}-aad-connector"
  log_analytics_workspace_id = azurerm_log_analytics_workspace.aks.id
}

resource "azurerm_sentinel_data_connector_azure_security_center" "main" {
  count = var.environment == "production" ? 1 : 0
  
  name                       = "${local.name_prefix}-asc-connector"
  log_analytics_workspace_id = azurerm_log_analytics_workspace.aks.id
}

resource "azurerm_sentinel_data_connector_kubernetes_cluster" "main" {
  count = var.environment == "production" ? 1 : 0
  
  name                       = "${local.name_prefix}-k8s-connector"
  log_analytics_workspace_id = azurerm_log_analytics_workspace.aks.id
}

# Key Vault Advanced Threat Protection
resource "azurerm_advanced_threat_protection" "keyvault" {
  target_resource_id = azurerm_key_vault.main.id
  enabled            = var.enable_azure_defender
}

# Storage Advanced Threat Protection
resource "azurerm_advanced_threat_protection" "storage" {
  target_resource_id = azurerm_storage_account.main.id
  enabled            = var.enable_azure_defender
}

# Container Registry Advanced Threat Protection
resource "azurerm_advanced_threat_protection" "acr" {
  target_resource_id = azurerm_container_registry.main.id
  enabled            = var.enable_azure_defender
}

# Security alert rules
resource "azurerm_monitor_scheduled_query_rules_alert" "failed_logins" {
  name                = "${local.name_prefix}-failed-logins-alert"
  location            = azurerm_resource_group.monitoring.location
  resource_group_name = azurerm_resource_group.monitoring.name

  action {
    action_group = [azurerm_monitor_action_group.critical.id]
  }

  data_source_id = azurerm_log_analytics_workspace.aks.id
  description    = "Alert for multiple failed login attempts"
  enabled        = true
  query          = <<-QUERY
    SigninLogs
    | where TimeGenerated > ago(5m)
    | where ResultType != "0"
    | summarize FailedAttempts = count() by UserPrincipalName, bin(TimeGenerated, 1m)
    | where FailedAttempts >= 5
  QUERY

  severity    = 1
  frequency   = 5
  time_window = 5

  trigger {
    operator  = "GreaterThan"
    threshold = 0
  }

  tags = local.common_tags
}

resource "azurerm_monitor_scheduled_query_rules_alert" "suspicious_activity" {
  name                = "${local.name_prefix}-suspicious-activity-alert"
  location            = azurerm_resource_group.monitoring.location
  resource_group_name = azurerm_resource_group.monitoring.name

  action {
    action_group = [azurerm_monitor_action_group.critical.id]
  }

  data_source_id = azurerm_log_analytics_workspace.aks.id
  description    = "Alert for suspicious network activity"
  enabled        = true
  query          = <<-QUERY
    AzureNetworkAnalytics_CL
    | where TimeGenerated > ago(5m)
    | where FlowType_s == "MaliciousFlow"
    | summarize Count = count() by SrcIP_s, bin(TimeGenerated, 1m)
    | where Count >= 10
  QUERY

  severity    = 1
  frequency   = 5
  time_window = 5

  trigger {
    operator  = "GreaterThan"
    threshold = 0
  }

  tags = local.common_tags
}

# Azure Policy for data protection
resource "azurerm_policy_assignment" "data_protection" {
  count = var.enable_compliance_monitoring ? 1 : 0
  
  name                 = "${local.name_prefix}-data-protection"
  scope                = azurerm_resource_group.main.id
  policy_definition_id = "/providers/Microsoft.Authorization/policyDefinitions/0725b4dd-7e76-479c-a735-68e7ee23d5ca"
  description          = "Require encryption for storage accounts"
  display_name         = "Storage Account Encryption"

  parameters = jsonencode({
    effect = {
      value = "Audit"
    }
  })

  metadata = jsonencode({
    category = "Data Protection"
  })
}

# Diagnostic settings for Key Vault
resource "azurerm_monitor_diagnostic_setting" "keyvault" {
  name                       = "${local.name_prefix}-keyvault-diagnostics"
  target_resource_id         = azurerm_key_vault.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.aks.id

  dynamic "enabled_log" {
    for_each = ["AuditEvent", "AzurePolicyEvaluationDetails"]
    content {
      category = enabled_log.value
    }
  }

  metric {
    category = "AllMetrics"
    enabled  = true
  }
}

# Diagnostic settings for Storage Account
resource "azurerm_monitor_diagnostic_setting" "storage" {
  name                       = "${local.name_prefix}-storage-diagnostics"
  target_resource_id         = azurerm_storage_account.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.aks.id

  metric {
    category = "AllMetrics"
    enabled  = true
  }
}

# Diagnostic settings for Container Registry
resource "azurerm_monitor_diagnostic_setting" "acr" {
  name                       = "${local.name_prefix}-acr-diagnostics"
  target_resource_id         = azurerm_container_registry.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.aks.id

  dynamic "enabled_log" {
    for_each = ["ContainerRegistryRepositoryEvents", "ContainerRegistryLoginEvents"]
    content {
      category = enabled_log.value
    }
  }

  metric {
    category = "AllMetrics"
    enabled  = true
  }
}

# Security Center automation for incident response
resource "azurerm_security_center_automation" "main" {
  count = var.environment == "production" ? 1 : 0
  
  name                = "${local.name_prefix}-security-automation"
  location            = azurerm_resource_group.monitoring.location
  resource_group_name = azurerm_resource_group.monitoring.name

  scopes = [
    azurerm_resource_group.main.id,
    azurerm_resource_group.networking.id,
    azurerm_resource_group.monitoring.id
  ]

  source {
    event_source = "Alerts"
    rule_set {
      rule {
        property_path  = "properties.metadata.severity"
        operator       = "Equals"
        expected_value = "High"
        property_type  = "String"
      }
    }
  }

  action {
    type        = "LogicApp"
    resource_id = azurerm_logic_app_workflow.security_incident[0].id
  }

  tags = local.common_tags
}

# Logic App for security incident response
resource "azurerm_logic_app_workflow" "security_incident" {
  count = var.environment == "production" ? 1 : 0
  
  name                = "${local.name_prefix}-security-incident-workflow"
  location            = azurerm_resource_group.monitoring.location
  resource_group_name = azurerm_resource_group.monitoring.name

  workflow_schema   = "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#"
  workflow_version  = "1.0.0.0"
  workflow_parameters = jsonencode({})

  tags = local.common_tags
}

# Network security rules for additional protection
resource "azurerm_network_security_rule" "deny_rdp" {
  count = var.enable_network_security_groups ? 1 : 0
  
  name                        = "DenyRDP"
  priority                    = 1000
  direction                   = "Inbound"
  access                      = "Deny"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_range      = "3389"
  source_address_prefix       = "*"
  destination_address_prefix  = "*"
  resource_group_name         = azurerm_resource_group.networking.name
  network_security_group_name = azurerm_network_security_group.aks_system.name
}

resource "azurerm_network_security_rule" "deny_ssh" {
  count = var.enable_network_security_groups ? 1 : 0
  
  name                        = "DenySSH"
  priority                    = 1001
  direction                   = "Inbound"
  access                      = "Deny"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_range      = "22"
  source_address_prefix       = "*"
  destination_address_prefix  = "*"
  resource_group_name         = azurerm_resource_group.networking.name
  network_security_group_name = azurerm_network_security_group.aks_system.name
}

# DDoS protection plan for production
resource "azurerm_network_ddos_protection_plan" "main" {
  count = var.environment == "production" ? 1 : 0
  
  name                = "${local.name_prefix}-ddos-protection"
  location            = azurerm_resource_group.networking.location
  resource_group_name = azurerm_resource_group.networking.name

  tags = local.common_tags
}

# Enable DDoS protection on VNet
resource "azurerm_virtual_network_ddos_protection_plan" "main" {
  count = var.environment == "production" ? 1 : 0
  
  virtual_network_id         = azurerm_virtual_network.main.id
  ddos_protection_plan_id    = azurerm_network_ddos_protection_plan.main[0].id
  enable_ddos_protection     = true
}

# Security outputs
output "network_watcher_id" {
  description = "ID of the Network Watcher"
  value       = azurerm_network_watcher.main.id
}

output "security_center_workspace_id" {
  description = "ID of the Security Center workspace"
  value       = var.enable_security_center ? azurerm_security_center_workspace.main[0].id : null
}

output "sentinel_workspace_id" {
  description = "ID of the Sentinel workspace"
  value       = var.environment == "production" ? azurerm_sentinel_log_analytics_workspace_onboarding.main[0].workspace_id : null
}

output "ddos_protection_plan_id" {
  description = "ID of the DDoS protection plan"
  value       = var.environment == "production" ? azurerm_network_ddos_protection_plan.main[0].id : null
}

output "security_automation_id" {
  description = "ID of the security automation"
  value       = var.environment == "production" ? azurerm_security_center_automation.main[0].id : null
}

output "security_policy_assignments" {
  description = "List of security policy assignment IDs"
  value = var.enable_compliance_monitoring ? [
    azurerm_policy_assignment.security_benchmark[0].id,
    azurerm_policy_assignment.cis_kubernetes[0].id,
    azurerm_policy_assignment.data_protection[0].id
  ] : []
}

output "advanced_threat_protection_enabled" {
  description = "List of resources with Advanced Threat Protection enabled"
  value = var.enable_azure_defender ? {
    keyvault = azurerm_advanced_threat_protection.keyvault.id
    storage  = azurerm_advanced_threat_protection.storage.id
    acr      = azurerm_advanced_threat_protection.acr.id
  } : {}
}