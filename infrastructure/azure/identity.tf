# Azure Identity and Access Management Configuration
# This file defines managed identities, role assignments, and access policies

# User-assigned managed identity for the learning assistant application
resource "azurerm_user_assigned_identity" "app" {
  name                = "${local.name_prefix}-app-identity"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  tags = local.common_tags
}

# User-assigned managed identity for backup operations
resource "azurerm_user_assigned_identity" "backup" {
  name                = "${local.name_prefix}-backup-identity"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  tags = local.common_tags
}

# User-assigned managed identity for monitoring
resource "azurerm_user_assigned_identity" "monitoring" {
  name                = "${local.name_prefix}-monitoring-identity"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  tags = local.common_tags
}

# Role assignment: Application identity - Key Vault Secrets User
resource "azurerm_role_assignment" "app_keyvault_secrets" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}

# Role assignment: Application identity - Storage Blob Data Contributor
resource "azurerm_role_assignment" "app_storage_blob" {
  scope                = azurerm_storage_account.main.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}

# Role assignment: Application identity - Container Registry Pull
resource "azurerm_role_assignment" "app_acr_pull" {
  scope                = azurerm_container_registry.main.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}

# Role assignment: Backup identity - Storage Account Backup Contributor
resource "azurerm_role_assignment" "backup_storage" {
  scope                = azurerm_storage_account.main.id
  role_definition_name = "Storage Account Backup Contributor"
  principal_id         = azurerm_user_assigned_identity.backup.principal_id
}

# Role assignment: Backup identity - Key Vault Backup User
resource "azurerm_role_assignment" "backup_keyvault" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Backup User"
  principal_id         = azurerm_user_assigned_identity.backup.principal_id
}

# Role assignment: Monitoring identity - Monitoring Reader
resource "azurerm_role_assignment" "monitoring_reader" {
  scope                = azurerm_resource_group.main.id
  role_definition_name = "Monitoring Reader"
  principal_id         = azurerm_user_assigned_identity.monitoring.principal_id
}

# Role assignment: Monitoring identity - Application Insights Component Contributor
resource "azurerm_role_assignment" "monitoring_app_insights" {
  scope                = azurerm_application_insights.main.id
  role_definition_name = "Application Insights Component Contributor"
  principal_id         = azurerm_user_assigned_identity.monitoring.principal_id
}

# Key Vault access policy for application identity
resource "azurerm_key_vault_access_policy" "app_identity" {
  key_vault_id = azurerm_key_vault.main.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = azurerm_user_assigned_identity.app.principal_id

  secret_permissions = [
    "Get",
    "List"
  ]

  certificate_permissions = [
    "Get",
    "List"
  ]

  key_permissions = [
    "Get",
    "List",
    "Decrypt",
    "Encrypt"
  ]
}

# Key Vault access policy for backup identity
resource "azurerm_key_vault_access_policy" "backup_identity" {
  key_vault_id = azurerm_key_vault.main.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = azurerm_user_assigned_identity.backup.principal_id

  secret_permissions = [
    "Get",
    "List",
    "Backup"
  ]

  certificate_permissions = [
    "Get",
    "List",
    "Backup"
  ]

  key_permissions = [
    "Get",
    "List",
    "Backup"
  ]
}

# Key Vault access policy for monitoring identity
resource "azurerm_key_vault_access_policy" "monitoring_identity" {
  key_vault_id = azurerm_key_vault.main.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = azurerm_user_assigned_identity.monitoring.principal_id

  secret_permissions = [
    "Get",
    "List"
  ]
}

# Azure AD group for application administrators
resource "azuread_group" "app_admins" {
  display_name     = "${local.name_prefix}-app-admins"
  description      = "Administrators for the ${var.project_name} application"
  security_enabled = true
  
  owners = [
    data.azurerm_client_config.current.object_id
  ]
}

# Azure AD group for application developers
resource "azuread_group" "app_developers" {
  display_name     = "${local.name_prefix}-app-developers"
  description      = "Developers for the ${var.project_name} application"
  security_enabled = true
  
  owners = [
    data.azurerm_client_config.current.object_id
  ]
}

# Azure AD group for application users
resource "azuread_group" "app_users" {
  display_name     = "${local.name_prefix}-app-users"
  description      = "End users for the ${var.project_name} application"
  security_enabled = true
  
  owners = [
    data.azurerm_client_config.current.object_id
  ]
}

# Role assignment: App Admins - Contributor to main resource group
resource "azurerm_role_assignment" "admins_contributor" {
  scope                = azurerm_resource_group.main.id
  role_definition_name = "Contributor"
  principal_id         = azuread_group.app_admins.object_id
}

# Role assignment: App Admins - Key Vault Administrator
resource "azurerm_role_assignment" "admins_keyvault" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Administrator"
  principal_id         = azuread_group.app_admins.object_id
}

# Role assignment: App Developers - Reader to main resource group
resource "azurerm_role_assignment" "developers_reader" {
  scope                = azurerm_resource_group.main.id
  role_definition_name = "Reader"
  principal_id         = azuread_group.app_developers.object_id
}

# Role assignment: App Developers - AKS Cluster User
resource "azurerm_role_assignment" "developers_aks_user" {
  scope                = azurerm_kubernetes_cluster.main.id
  role_definition_name = "Azure Kubernetes Service Cluster User Role"
  principal_id         = azuread_group.app_developers.object_id
}

# Role assignment: App Developers - Container Registry Pull
resource "azurerm_role_assignment" "developers_acr_pull" {
  scope                = azurerm_container_registry.main.id
  role_definition_name = "AcrPull"
  principal_id         = azuread_group.app_developers.object_id
}

# Azure AD application registration for the learning assistant
resource "azuread_application" "learning_assistant" {
  display_name     = "${local.name_prefix}-app"
  description      = "Azure AD application for ${var.project_name}"
  sign_in_audience = "AzureADMyOrg"

  # API configuration
  api {
    mapped_claims_enabled          = true
    requested_access_token_version = 2

    # Define scopes
    oauth2_permission_scope {
      admin_consent_description  = "Access the learning assistant API"
      admin_consent_display_name = "Access API"
      enabled                    = true
      id                         = "api.access"
      type                       = "User"
      user_consent_description   = "Access the learning assistant API"
      user_consent_display_name  = "Access API"
      value                      = "api.access"
    }

    oauth2_permission_scope {
      admin_consent_description  = "Read user profile data"
      admin_consent_display_name = "Read profile"
      enabled                    = true
      id                         = "profile.read"
      type                       = "User"
      user_consent_description   = "Read your profile data"
      user_consent_display_name  = "Read profile"
      value                      = "profile.read"
    }
  }

  # Web configuration
  web {
    homepage_url = "https://${var.dns_zone_name != "" ? var.dns_zone_name : azurerm_public_ip.app_gateway_dns.fqdn}"
    
    redirect_uris = [
      "https://${var.dns_zone_name != "" ? var.dns_zone_name : azurerm_public_ip.app_gateway_dns.fqdn}/auth/callback",
      "https://${var.dns_zone_name != "" ? var.dns_zone_name : azurerm_public_ip.app_gateway_dns.fqdn}/api/auth/callback/azure-ad"
    ]

    implicit_grant {
      access_token_issuance_enabled = true
      id_token_issuance_enabled     = true
    }
  }

  # Required resource access
  required_resource_access {
    resource_app_id = "00000003-0000-0000-c000-000000000000" # Microsoft Graph

    resource_access {
      id   = "e1fe6dd8-ba31-4d61-89e7-88639da4683d" # User.Read
      type = "Scope"
    }

    resource_access {
      id   = "b4e74841-8e56-480b-be8b-910348b18b4c" # User.ReadWrite
      type = "Scope"
    }
  }

  # Optional claims
  optional_claims {
    access_token {
      name = "given_name"
    }
    access_token {
      name = "family_name"
    }
    access_token {
      name = "email"
    }

    id_token {
      name = "given_name"
    }
    id_token {
      name = "family_name"
    }
    id_token {
      name = "email"
    }
  }
}

# Service principal for the application
resource "azuread_service_principal" "learning_assistant" {
  application_id               = azuread_application.learning_assistant.application_id
  app_role_assignment_required = false
  
  tags = ["learning-assistant", var.environment]
}

# Application password/client secret
resource "azuread_application_password" "learning_assistant" {
  application_object_id = azuread_application.learning_assistant.object_id
  display_name          = "Learning Assistant Client Secret"
  end_date_relative     = "8760h" # 1 year
}

# Store client secret in Key Vault
resource "azurerm_key_vault_secret" "azure_ad_client_secret" {
  depends_on = [azurerm_key_vault_access_policy.current]
  
  name         = "azure-ad-client-secret"
  value        = azuread_application_password.learning_assistant.value
  key_vault_id = azurerm_key_vault.main.id

  tags = local.common_tags
}

# Store Azure AD configuration in Key Vault
resource "azurerm_key_vault_secret" "azure_ad_client_id" {
  depends_on = [azurerm_key_vault_access_policy.current]
  
  name         = "azure-ad-client-id"
  value        = azuread_application.learning_assistant.application_id
  key_vault_id = azurerm_key_vault.main.id

  tags = local.common_tags
}

resource "azurerm_key_vault_secret" "azure_ad_tenant_id" {
  depends_on = [azurerm_key_vault_access_policy.current]
  
  name         = "azure-ad-tenant-id"
  value        = data.azurerm_client_config.current.tenant_id
  key_vault_id = azurerm_key_vault.main.id

  tags = local.common_tags
}

# Federated identity credential for GitHub Actions (if using)
resource "azuread_application_federated_identity_credential" "github_actions" {
  count = var.environment == "production" ? 1 : 0
  
  application_object_id = azuread_application.learning_assistant.object_id
  display_name          = "GitHub Actions"
  description           = "Federated identity for GitHub Actions deployment"
  audiences             = ["api://AzureADTokenExchange"]
  issuer                = "https://token.actions.githubusercontent.com"
  subject               = "repo:your-org/learning-assistant:environment:production"
}

# Custom role definition for application-specific permissions
resource "azurerm_role_definition" "learning_assistant_operator" {
  name        = "${local.name_prefix}-operator"
  scope       = azurerm_resource_group.main.id
  description = "Custom role for learning assistant application operations"

  permissions {
    actions = [
      "Microsoft.ContainerService/managedClusters/read",
      "Microsoft.ContainerService/managedClusters/listClusterUserCredential/action",
      "Microsoft.KeyVault/vaults/secrets/read",
      "Microsoft.Storage/storageAccounts/read",
      "Microsoft.Storage/storageAccounts/blobServices/containers/read",
      "Microsoft.Cache/Redis/read",
      "Microsoft.DBforPostgreSQL/flexibleServers/read",
      "Microsoft.Insights/components/read",
      "Microsoft.Insights/metrics/read"
    ]
    
    not_actions = []
    
    data_actions = [
      "Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read",
      "Microsoft.Storage/storageAccounts/blobServices/containers/blobs/write",
      "Microsoft.KeyVault/vaults/secrets/getSecret/action"
    ]
    
    not_data_actions = []
  }

  assignable_scopes = [
    azurerm_resource_group.main.id
  ]
}

# Role assignment: Application service principal - Custom operator role
resource "azurerm_role_assignment" "app_sp_operator" {
  scope              = azurerm_resource_group.main.id
  role_definition_id = azurerm_role_definition.learning_assistant_operator.role_definition_resource_id
  principal_id       = azuread_service_principal.learning_assistant.object_id
}

# Identity outputs
output "app_identity_id" {
  description = "ID of the application managed identity"
  value       = azurerm_user_assigned_identity.app.id
}

output "app_identity_principal_id" {
  description = "Principal ID of the application managed identity"
  value       = azurerm_user_assigned_identity.app.principal_id
}

output "app_identity_client_id" {
  description = "Client ID of the application managed identity"
  value       = azurerm_user_assigned_identity.app.client_id
}

output "backup_identity_id" {
  description = "ID of the backup managed identity"
  value       = azurerm_user_assigned_identity.backup.id
}

output "monitoring_identity_id" {
  description = "ID of the monitoring managed identity"
  value       = azurerm_user_assigned_identity.monitoring.id
}

output "azure_ad_application_id" {
  description = "Azure AD application ID"
  value       = azuread_application.learning_assistant.application_id
}

output "azure_ad_service_principal_id" {
  description = "Azure AD service principal ID"
  value       = azuread_service_principal.learning_assistant.object_id
}

output "app_admins_group_id" {
  description = "Object ID of the app admins group"
  value       = azuread_group.app_admins.object_id
}

output "app_developers_group_id" {
  description = "Object ID of the app developers group"
  value       = azuread_group.app_developers.object_id
}

output "app_users_group_id" {
  description = "Object ID of the app users group"
  value       = azuread_group.app_users.object_id
}

output "azure_ad_client_secret_name" {
  description = "Name of the Key Vault secret containing Azure AD client secret"
  value       = azurerm_key_vault_secret.azure_ad_client_secret.name
}

output "custom_role_definition_id" {
  description = "ID of the custom role definition"
  value       = azurerm_role_definition.learning_assistant_operator.role_definition_resource_id
}