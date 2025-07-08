# Azure Storage Backend Configuration for Terraform State Management
# This file configures secure remote state storage using Azure Storage Account with state locking

terraform {
  required_version = ">= 1.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }
}

# Configure Azure Provider
provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = true
      recover_soft_deleted_key_vaults = true
    }
    storage {
      purge_soft_delete_on_destroy = true
    }
  }
}

# Random suffix for unique resource naming
resource "random_id" "state_suffix" {
  byte_length = 4
}

# Resource Group for Terraform State Resources
resource "azurerm_resource_group" "terraform_state" {
  name     = "${var.project_name}-terraform-state-${var.environment}"
  location = var.azure_location
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Purpose     = "state-management"
  }
}

# Storage Account for Terraform State
resource "azurerm_storage_account" "terraform_state" {
  name                = "${var.project_name}tfstate${var.environment}${random_id.state_suffix.hex}"
  resource_group_name = azurerm_resource_group.terraform_state.name
  location            = azurerm_resource_group.terraform_state.location
  
  account_tier                    = "Standard"
  account_replication_type        = var.replication_type
  enable_https_traffic_only       = true
  min_tls_version                = "TLS1_2"
  allow_nested_items_to_be_public = false
  
  # Enable versioning and soft delete
  blob_properties {
    versioning_enabled  = true
    change_feed_enabled = true
    
    delete_retention_policy {
      days = var.state_retention_days
    }
    
    container_delete_retention_policy {
      days = var.state_retention_days
    }
  }
  
  # Enable infrastructure encryption
  infrastructure_encryption_enabled = true
  
  # Network rules
  network_rules {
    default_action = "Deny"
    bypass         = ["AzureServices"]
    
    # Allow access from specific IP ranges
    ip_rules = var.allowed_ip_ranges
    
    # Allow access from specific virtual networks
    virtual_network_subnet_ids = var.allowed_subnet_ids
  }
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Purpose     = "state-storage"
  }
}

# Container for Terraform State Files
resource "azurerm_storage_container" "terraform_state" {
  name                  = "tfstate"
  storage_account_name  = azurerm_storage_account.terraform_state.name
  container_access_type = "private"
}

# Container for State Backups
resource "azurerm_storage_container" "terraform_state_backup" {
  name                  = "tfstate-backup"
  storage_account_name  = azurerm_storage_account.terraform_state.name
  container_access_type = "private"
}

# Key Vault for State Encryption Keys
resource "azurerm_key_vault" "terraform_state" {
  name                = "${var.project_name}-kv-${var.environment}-${random_id.state_suffix.hex}"
  location            = azurerm_resource_group.terraform_state.location
  resource_group_name = azurerm_resource_group.terraform_state.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  
  sku_name = "standard"
  
  enabled_for_disk_encryption     = true
  enabled_for_deployment          = true
  enabled_for_template_deployment = true
  purge_protection_enabled       = true
  
  # Network ACLs
  network_acls {
    default_action = "Deny"
    bypass         = "AzureServices"
    
    ip_rules = var.allowed_ip_ranges
    virtual_network_subnet_ids = var.allowed_subnet_ids
  }
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Purpose     = "state-encryption"
  }
}

# Key Vault Access Policy for Current User/Service Principal
resource "azurerm_key_vault_access_policy" "terraform_state" {
  key_vault_id = azurerm_key_vault.terraform_state.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = data.azurerm_client_config.current.object_id
  
  key_permissions = [
    "Create",
    "Delete",
    "Get",
    "List",
    "Update",
    "Encrypt",
    "Decrypt",
    "GetRotationPolicy",
    "SetRotationPolicy"
  ]
  
  secret_permissions = [
    "Get",
    "List",
    "Set",
    "Delete"
  ]
}

# Key Vault Key for State Encryption
resource "azurerm_key_vault_key" "terraform_state" {
  name         = "terraform-state-key"
  key_vault_id = azurerm_key_vault.terraform_state.id
  key_type     = "RSA"
  key_size     = 2048
  
  key_opts = [
    "decrypt",
    "encrypt",
    "sign",
    "unwrapKey",
    "verify",
    "wrapKey",
  ]
  
  rotation_policy {
    automatic {
      time_before_expiry = "P30D"
    }
    
    expire_after         = "P90D"
    notify_before_expiry = "P29D"
  }
  
  depends_on = [azurerm_key_vault_access_policy.terraform_state]
}

# User-Assigned Managed Identity for Terraform Operations
resource "azurerm_user_assigned_identity" "terraform_state" {
  name                = "${var.project_name}-terraform-state-identity-${var.environment}"
  location            = azurerm_resource_group.terraform_state.location
  resource_group_name = azurerm_resource_group.terraform_state.name
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Purpose     = "state-operations"
  }
}

# Role Assignment for Storage Account
resource "azurerm_role_assignment" "terraform_state_storage" {
  scope                = azurerm_storage_account.terraform_state.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.terraform_state.principal_id
}

# Role Assignment for Key Vault
resource "azurerm_role_assignment" "terraform_state_kv" {
  scope                = azurerm_key_vault.terraform_state.id
  role_definition_name = "Key Vault Crypto Officer"
  principal_id         = azurerm_user_assigned_identity.terraform_state.principal_id
}

# Key Vault Access Policy for Managed Identity
resource "azurerm_key_vault_access_policy" "terraform_state_identity" {
  key_vault_id = azurerm_key_vault.terraform_state.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = azurerm_user_assigned_identity.terraform_state.principal_id
  
  key_permissions = [
    "Get",
    "List",
    "Encrypt",
    "Decrypt"
  ]
}

# Log Analytics Workspace for Monitoring
resource "azurerm_log_analytics_workspace" "terraform_state" {
  name                = "${var.project_name}-terraform-state-logs-${var.environment}"
  location            = azurerm_resource_group.terraform_state.location
  resource_group_name = azurerm_resource_group.terraform_state.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Purpose     = "monitoring"
  }
}

# Diagnostic Settings for Storage Account
resource "azurerm_monitor_diagnostic_setting" "terraform_state_storage" {
  name               = "terraform-state-storage-diagnostic"
  target_resource_id = azurerm_storage_account.terraform_state.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.terraform_state.id
  
  enabled_log {
    category = "StorageRead"
  }
  
  enabled_log {
    category = "StorageWrite"
  }
  
  enabled_log {
    category = "StorageDelete"
  }
  
  metric {
    category = "Transaction"
    enabled  = true
    
    retention_policy {
      enabled = true
      days    = 30
    }
  }
}

# Diagnostic Settings for Key Vault
resource "azurerm_monitor_diagnostic_setting" "terraform_state_kv" {
  name               = "terraform-state-kv-diagnostic"
  target_resource_id = azurerm_key_vault.terraform_state.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.terraform_state.id
  
  enabled_log {
    category = "AuditEvent"
  }
  
  metric {
    category = "AllMetrics"
    enabled  = true
    
    retention_policy {
      enabled = true
      days    = 30
    }
  }
}

# Action Group for Alerts
resource "azurerm_monitor_action_group" "terraform_state" {
  name                = "${var.project_name}-terraform-state-alerts-${var.environment}"
  resource_group_name = azurerm_resource_group.terraform_state.name
  short_name          = "tfstate"
  
  dynamic "email_receiver" {
    for_each = var.alert_emails
    content {
      name          = "email-${email_receiver.key}"
      email_address = email_receiver.value
    }
  }
  
  dynamic "webhook_receiver" {
    for_each = var.webhook_urls
    content {
      name        = "webhook-${webhook_receiver.key}"
      service_uri = webhook_receiver.value
    }
  }
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

# Metric Alert for State File Changes
resource "azurerm_monitor_metric_alert" "terraform_state_changes" {
  name                = "terraform-state-file-changes"
  resource_group_name = azurerm_resource_group.terraform_state.name
  scopes              = [azurerm_storage_account.terraform_state.id]
  
  criteria {
    metric_namespace = "Microsoft.Storage/storageAccounts"
    metric_name      = "Transactions"
    aggregation      = "Count"
    operator         = "GreaterThan"
    threshold        = 0
    
    dimension {
      name     = "ApiName"
      operator = "Include"
      values   = ["PutBlob", "DeleteBlob"]
    }
    
    dimension {
      name     = "ResponseType"
      operator = "Include"
      values   = ["Success"]
    }
  }
  
  action {
    action_group_id = azurerm_monitor_action_group.terraform_state.id
  }
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

# Function App for State Change Notifications
resource "azurerm_service_plan" "terraform_state" {
  name                = "${var.project_name}-terraform-state-plan-${var.environment}"
  resource_group_name = azurerm_resource_group.terraform_state.name
  location            = azurerm_resource_group.terraform_state.location
  
  os_type  = "Linux"
  sku_name = "Y1"
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

# Storage Account for Function App
resource "azurerm_storage_account" "function_app" {
  name                     = "${var.project_name}func${var.environment}${random_id.state_suffix.hex}"
  resource_group_name      = azurerm_resource_group.terraform_state.name
  location                 = azurerm_resource_group.terraform_state.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Purpose     = "function-app"
  }
}

# Function App
resource "azurerm_linux_function_app" "terraform_state" {
  name                = "${var.project_name}-terraform-state-func-${var.environment}"
  resource_group_name = azurerm_resource_group.terraform_state.name
  location            = azurerm_resource_group.terraform_state.location
  
  service_plan_id            = azurerm_service_plan.terraform_state.id
  storage_account_name       = azurerm_storage_account.function_app.name
  storage_account_access_key = azurerm_storage_account.function_app.primary_access_key
  
  site_config {
    application_stack {
      python_version = "3.9"
    }
  }
  
  app_settings = {
    "FUNCTIONS_WORKER_RUNTIME" = "python"
    "SLACK_WEBHOOK_URL"        = var.slack_webhook_url
    "ENVIRONMENT"              = var.environment
    "PROJECT_NAME"             = var.project_name
  }
  
  identity {
    type = "SystemAssigned"
  }
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

# Event Grid Topic for State Changes
resource "azurerm_eventgrid_topic" "terraform_state" {
  name                = "${var.project_name}-terraform-state-events-${var.environment}"
  location            = azurerm_resource_group.terraform_state.location
  resource_group_name = azurerm_resource_group.terraform_state.name
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

# Event Grid Subscription for Storage Events
resource "azurerm_eventgrid_event_subscription" "terraform_state" {
  name  = "${var.project_name}-terraform-state-subscription-${var.environment}"
  scope = azurerm_storage_account.terraform_state.id
  
  azure_function_endpoint {
    function_id = "${azurerm_linux_function_app.terraform_state.id}/functions/StateChangeHandler"
  }
  
  included_event_types = [
    "Microsoft.Storage.BlobCreated",
    "Microsoft.Storage.BlobDeleted"
  ]
  
  subject_filter {
    subject_begins_with = "/blobServices/default/containers/tfstate/"
  }
}

# Backup Storage Account (Cross-Region)
resource "azurerm_storage_account" "terraform_state_backup" {
  count               = var.enable_cross_region_backup ? 1 : 0
  name                = "${var.project_name}backup${var.environment}${random_id.state_suffix.hex}"
  resource_group_name = azurerm_resource_group.terraform_state.name
  location            = var.backup_location
  
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  enable_https_traffic_only       = true
  min_tls_version                = "TLS1_2"
  allow_nested_items_to_be_public = false
  
  blob_properties {
    versioning_enabled = true
    
    delete_retention_policy {
      days = var.backup_retention_days
    }
  }
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Purpose     = "state-backup"
  }
}

# Backup Container
resource "azurerm_storage_container" "terraform_state_backup_container" {
  count                 = var.enable_cross_region_backup ? 1 : 0
  name                  = "tfstate-backup"
  storage_account_name  = azurerm_storage_account.terraform_state_backup[0].name
  container_access_type = "private"
}

# Data Factory for Automated Backups
resource "azurerm_data_factory" "terraform_state" {
  count               = var.enable_automated_backup ? 1 : 0
  name                = "${var.project_name}-terraform-state-df-${var.environment}"
  location            = azurerm_resource_group.terraform_state.location
  resource_group_name = azurerm_resource_group.terraform_state.name
  
  identity {
    type = "SystemAssigned"
  }
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

# Current Azure client configuration
data "azurerm_client_config" "current" {}

# Variables
variable "azure_location" {
  description = "Azure location for resources"
  type        = string
  default     = "East US"
}

variable "backup_location" {
  description = "Azure location for backup resources"
  type        = string
  default     = "West US"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "learning-assistant"
}

variable "replication_type" {
  description = "Storage account replication type"
  type        = string
  default     = "GRS"
}

variable "state_retention_days" {
  description = "Number of days to retain old state versions"
  type        = number
  default     = 90
}

variable "backup_retention_days" {
  description = "Number of days to retain backup versions"
  type        = number
  default     = 365
}

variable "allowed_ip_ranges" {
  description = "List of allowed IP ranges for storage account access"
  type        = list(string)
  default     = []
}

variable "allowed_subnet_ids" {
  description = "List of allowed subnet IDs for storage account access"
  type        = list(string)
  default     = []
}

variable "alert_emails" {
  description = "List of email addresses for alerts"
  type        = list(string)
  default     = []
}

variable "webhook_urls" {
  description = "List of webhook URLs for alerts"
  type        = list(string)
  default     = []
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications"
  type        = string
  default     = ""
  sensitive   = true
}

variable "enable_cross_region_backup" {
  description = "Enable cross-region backup"
  type        = bool
  default     = false
}

variable "enable_automated_backup" {
  description = "Enable automated backup with Data Factory"
  type        = bool
  default     = false
}

# Outputs
output "storage_account_name" {
  description = "Name of the storage account for Terraform state"
  value       = azurerm_storage_account.terraform_state.name
}

output "storage_account_key" {
  description = "Primary access key of the storage account"
  value       = azurerm_storage_account.terraform_state.primary_access_key
  sensitive   = true
}

output "container_name" {
  description = "Name of the storage container for Terraform state"
  value       = azurerm_storage_container.terraform_state.name
}

output "key_vault_id" {
  description = "ID of the Key Vault for state encryption"
  value       = azurerm_key_vault.terraform_state.id
}

output "managed_identity_id" {
  description = "ID of the managed identity for Terraform operations"
  value       = azurerm_user_assigned_identity.terraform_state.id
}

output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.terraform_state.name
}

output "backend_config" {
  description = "Backend configuration for Terraform"
  value = {
    resource_group_name  = azurerm_resource_group.terraform_state.name
    storage_account_name = azurerm_storage_account.terraform_state.name
    container_name       = azurerm_storage_container.terraform_state.name
    key                  = "terraform.tfstate"
  }
}