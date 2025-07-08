# Azure Infrastructure for Learning Assistant Application
# This configuration sets up a production-ready Azure environment with:
# - Resource Groups with proper naming and tagging
# - Virtual Network with availability zones
# - AKS cluster with system and user node pools
# - Azure Database for PostgreSQL with zone redundancy
# - Azure Cache for Redis with clustering
# - Application Gateway with WAF and SSL termination
# - Azure DNS for domain management
# - Comprehensive monitoring and logging

# Resource Group for all learning assistant resources
resource "azurerm_resource_group" "main" {
  name     = "${var.project_name}-${var.environment}-rg"
  location = var.location

  tags = local.common_tags
}

# Resource Group for networking resources
resource "azurerm_resource_group" "networking" {
  name     = "${var.project_name}-${var.environment}-networking-rg"
  location = var.location

  tags = local.common_tags
}

# Resource Group for monitoring resources
resource "azurerm_resource_group" "monitoring" {
  name     = "${var.project_name}-${var.environment}-monitoring-rg"
  location = var.location

  tags = local.common_tags
}

# Local values for common configurations
locals {
  common_tags = {
    Project       = var.project_name
    Environment   = var.environment
    Owner         = var.owner
    CostCenter    = var.cost_center
    ManagedBy     = "Terraform"
    CreatedDate   = formatdate("YYYY-MM-DD", timestamp())
    BackupPolicy  = var.backup_policy
    DataClass     = var.data_classification
  }

  # Naming conventions
  name_prefix = "${var.project_name}-${var.environment}"
  
  # Network CIDR blocks
  vnet_cidr = "10.0.0.0/16"
  subnet_cidrs = {
    aks_system    = "10.0.1.0/24"
    aks_user      = "10.0.2.0/24"
    database      = "10.0.3.0/24"
    redis         = "10.0.4.0/24"
    app_gateway   = "10.0.5.0/24"
    private_link  = "10.0.6.0/24"
    bastion       = "10.0.7.0/24"
  }

  # Availability zones
  availability_zones = ["1", "2", "3"]
}

# Azure Key Vault for secrets management
resource "azurerm_key_vault" "main" {
  name                        = "${local.name_prefix}-kv-${random_string.suffix.result}"
  location                    = azurerm_resource_group.main.location
  resource_group_name         = azurerm_resource_group.main.name
  enabled_for_disk_encryption = true
  tenant_id                   = data.azurerm_client_config.current.tenant_id
  soft_delete_retention_days  = 7
  purge_protection_enabled    = var.environment == "production" ? true : false

  sku_name = "standard"

  # Network ACLs
  network_acls {
    default_action = "Deny"
    bypass         = "AzureServices"
    
    # Allow access from AKS subnet
    virtual_network_subnet_ids = [
      azurerm_subnet.aks_system.id,
      azurerm_subnet.aks_user.id
    ]
  }

  # Enable diagnostic logging
  lifecycle {
    ignore_changes = [
      tags["CreatedDate"]
    ]
  }

  tags = local.common_tags
}

# Key Vault access policy for current user/service principal
resource "azurerm_key_vault_access_policy" "current" {
  key_vault_id = azurerm_key_vault.main.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = data.azurerm_client_config.current.object_id

  key_permissions = [
    "Get", "List", "Update", "Create", "Import", "Delete", "Recover", "Backup", "Restore"
  ]

  secret_permissions = [
    "Get", "List", "Set", "Delete", "Recover", "Backup", "Restore"
  ]

  certificate_permissions = [
    "Get", "List", "Update", "Create", "Import", "Delete", "Recover", "Backup", "Restore"
  ]
}

# Random string for unique naming
resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

# Application Insights for monitoring
resource "azurerm_application_insights" "main" {
  name                = "${local.name_prefix}-ai"
  location            = azurerm_resource_group.monitoring.location
  resource_group_name = azurerm_resource_group.monitoring.name
  application_type    = "web"
  retention_in_days   = var.environment == "production" ? 730 : 90

  tags = local.common_tags
}

# Storage Account for application data and backups
resource "azurerm_storage_account" "main" {
  name                = "${replace(local.name_prefix, "-", "")}st${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  account_tier                    = "Standard"
  account_replication_type        = var.environment == "production" ? "GRS" : "LRS"
  account_kind                    = "StorageV2"
  access_tier                     = "Hot"
  enable_https_traffic_only       = true
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false

  # Enable advanced threat protection
  threat_protection_enabled = true

  # Network rules
  network_rules {
    default_action = "Deny"
    bypass         = ["AzureServices"]
    
    # Allow access from AKS subnets
    virtual_network_subnet_ids = [
      azurerm_subnet.aks_system.id,
      azurerm_subnet.aks_user.id
    ]
  }

  # Enable blob versioning and soft delete
  blob_properties {
    versioning_enabled  = true
    change_feed_enabled = true
    
    delete_retention_policy {
      days = var.environment == "production" ? 30 : 7
    }
    
    container_delete_retention_policy {
      days = var.environment == "production" ? 30 : 7
    }
  }

  tags = local.common_tags
}

# Container for application backups
resource "azurerm_storage_container" "backups" {
  name                  = "backups"
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = "private"
}

# Container for application logs
resource "azurerm_storage_container" "logs" {
  name                  = "logs"
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = "private"
}

# Output values for other modules
output "resource_group_name" {
  value = azurerm_resource_group.main.name
}

output "location" {
  value = azurerm_resource_group.main.location
}

output "key_vault_id" {
  value = azurerm_key_vault.main.id
}

output "storage_account_name" {
  value = azurerm_storage_account.main.name
}

output "application_insights_key" {
  value     = azurerm_application_insights.main.instrumentation_key
  sensitive = true
}

output "common_tags" {
  value = local.common_tags
}