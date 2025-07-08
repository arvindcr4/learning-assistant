# Terraform Cloud/Enterprise Integration Configuration
# This file configures Terraform Cloud workspaces and organizations

terraform {
  required_version = ">= 1.0"
  required_providers {
    tfe = {
      source  = "hashicorp/tfe"
      version = "~> 0.48"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }
}

# Configure Terraform Cloud provider
provider "tfe" {
  hostname = var.terraform_cloud_hostname
  token    = var.terraform_cloud_token
}

# Local values for configuration
locals {
  # Organization settings
  organization_name = var.organization_name
  
  # Workspace configurations
  workspaces = {
    for env in var.environments : env => {
      name                = "${var.project_name}-${env}"
      description         = "Terraform workspace for ${var.project_name} ${env} environment"
      environment         = env
      auto_apply          = env == "dev" ? true : false
      queue_all_runs      = env == "prod" ? true : false
      speculative_enabled = true
      structured_run_output_enabled = true
      assessments_enabled = true
      file_triggers_enabled = true
      
      # VCS settings
      vcs_repo = var.enable_vcs_integration ? {
        identifier     = var.vcs_repo_identifier
        branch         = env == "prod" ? "main" : (env == "staging" ? "main" : "develop")
        oauth_token_id = var.vcs_oauth_token_id
      } : null
      
      # Working directory
      working_directory = "stacks/${var.primary_provider}"
      
      # Trigger paths
      trigger_paths = [
        "infrastructure/**",
        "stacks/${var.primary_provider}/**",
        ".github/workflows/terraform-*.yml"
      ]
      
      # Environment variables
      environment_variables = merge(
        {
          TF_IN_AUTOMATION = "true"
          TF_VERSION       = var.terraform_version
        },
        env == "prod" ? var.production_env_vars : {},
        env == "staging" ? var.staging_env_vars : {},
        env == "dev" ? var.development_env_vars : {}
      )
      
      # Terraform variables
      terraform_variables = {
        environment    = env
        project_name   = var.project_name
        organization   = local.organization_name
      }
      
      # Notification settings
      notifications = {
        slack_webhook_url = var.slack_webhook_url
        email_addresses   = var.notification_emails
      }
      
      # Team access
      team_access = {
        for team_name, permissions in var.team_access_config : team_name => {
          permissions = permissions
          environment = env
        }
      }
      
      # Tags
      tags = [
        "environment:${env}",
        "project:${var.project_name}",
        "provider:${var.primary_provider}",
        "managed-by:terraform"
      ]
    }
  }
}

# Create or use existing organization
data "tfe_organization" "main" {
  name = local.organization_name
}

# Create teams for organization
resource "tfe_team" "teams" {
  for_each = var.teams
  
  name         = each.key
  organization = data.tfe_organization.main.name
  visibility   = each.value.visibility
  
  organization_access {
    manage_policies      = each.value.manage_policies
    manage_policy_overrides = each.value.manage_policy_overrides
    manage_workspaces    = each.value.manage_workspaces
    manage_vcs_settings  = each.value.manage_vcs_settings
  }
}

# Create workspaces
resource "tfe_workspace" "workspaces" {
  for_each = local.workspaces
  
  name                          = each.value.name
  organization                  = data.tfe_organization.main.name
  description                   = each.value.description
  auto_apply                    = each.value.auto_apply
  queue_all_runs               = each.value.queue_all_runs
  speculative_enabled          = each.value.speculative_enabled
  structured_run_output_enabled = each.value.structured_run_output_enabled
  assessments_enabled          = each.value.assessments_enabled
  file_triggers_enabled        = each.value.file_triggers_enabled
  working_directory            = each.value.working_directory
  trigger_patterns             = each.value.trigger_paths
  tag_names                    = each.value.tags
  
  # VCS configuration
  dynamic "vcs_repo" {
    for_each = each.value.vcs_repo != null ? [each.value.vcs_repo] : []
    content {
      identifier     = vcs_repo.value.identifier
      branch         = vcs_repo.value.branch
      oauth_token_id = vcs_repo.value.oauth_token_id
    }
  }
}

# Configure workspace variables
resource "tfe_variable" "environment_variables" {
  for_each = {
    for combo in flatten([
      for workspace_key, workspace in local.workspaces : [
        for var_key, var_value in workspace.environment_variables : {
          workspace_key = workspace_key
          var_key       = var_key
          var_value     = var_value
          var_type      = "env"
        }
      ]
    ]) : "${combo.workspace_key}.${combo.var_key}" => combo
  }
  
  key          = each.value.var_key
  value        = each.value.var_value
  category     = "env"
  workspace_id = tfe_workspace.workspaces[each.value.workspace_key].id
  description  = "Environment variable for ${each.value.workspace_key}"
}

resource "tfe_variable" "terraform_variables" {
  for_each = {
    for combo in flatten([
      for workspace_key, workspace in local.workspaces : [
        for var_key, var_value in workspace.terraform_variables : {
          workspace_key = workspace_key
          var_key       = var_key
          var_value     = var_value
          var_type      = "terraform"
        }
      ]
    ]) : "${combo.workspace_key}.${combo.var_key}" => combo
  }
  
  key          = each.value.var_key
  value        = each.value.var_value
  category     = "terraform"
  workspace_id = tfe_workspace.workspaces[each.value.workspace_key].id
  description  = "Terraform variable for ${each.value.workspace_key}"
}

# Configure sensitive variables (cloud provider credentials)
resource "tfe_variable" "aws_credentials" {
  for_each = var.primary_provider == "aws" ? local.workspaces : {}
  
  key          = "AWS_ACCESS_KEY_ID"
  value        = var.aws_access_key_id
  category     = "env"
  sensitive    = true
  workspace_id = tfe_workspace.workspaces[each.key].id
  description  = "AWS Access Key ID"
}

resource "tfe_variable" "aws_secret_key" {
  for_each = var.primary_provider == "aws" ? local.workspaces : {}
  
  key          = "AWS_SECRET_ACCESS_KEY"
  value        = var.aws_secret_access_key
  category     = "env"
  sensitive    = true
  workspace_id = tfe_workspace.workspaces[each.key].id
  description  = "AWS Secret Access Key"
}

resource "tfe_variable" "gcp_credentials" {
  for_each = var.primary_provider == "gcp" ? local.workspaces : {}
  
  key          = "GOOGLE_CREDENTIALS"
  value        = var.gcp_service_account_key
  category     = "env"
  sensitive    = true
  workspace_id = tfe_workspace.workspaces[each.key].id
  description  = "GCP Service Account Key"
}

resource "tfe_variable" "azure_credentials" {
  for_each = var.primary_provider == "azure" ? local.workspaces : {}
  
  key          = "ARM_CLIENT_ID"
  value        = var.azure_client_id
  category     = "env"
  sensitive    = true
  workspace_id = tfe_workspace.workspaces[each.key].id
  description  = "Azure Client ID"
}

resource "tfe_variable" "azure_client_secret" {
  for_each = var.primary_provider == "azure" ? local.workspaces : {}
  
  key          = "ARM_CLIENT_SECRET"
  value        = var.azure_client_secret
  category     = "env"
  sensitive    = true
  workspace_id = tfe_workspace.workspaces[each.key].id
  description  = "Azure Client Secret"
}

resource "tfe_variable" "azure_tenant_id" {
  for_each = var.primary_provider == "azure" ? local.workspaces : {}
  
  key          = "ARM_TENANT_ID"
  value        = var.azure_tenant_id
  category     = "env"
  sensitive    = true
  workspace_id = tfe_workspace.workspaces[each.key].id
  description  = "Azure Tenant ID"
}

resource "tfe_variable" "azure_subscription_id" {
  for_each = var.primary_provider == "azure" ? local.workspaces : {}
  
  key          = "ARM_SUBSCRIPTION_ID"
  value        = var.azure_subscription_id
  category     = "env"
  sensitive    = true
  workspace_id = tfe_workspace.workspaces[each.key].id
  description  = "Azure Subscription ID"
}

# Configure team access to workspaces
resource "tfe_team_access" "workspace_access" {
  for_each = {
    for combo in flatten([
      for workspace_key, workspace in local.workspaces : [
        for team_name, team_config in workspace.team_access : {
          workspace_key = workspace_key
          team_name     = team_name
          permissions   = team_config.permissions
        }
      ]
    ]) : "${combo.workspace_key}.${combo.team_name}" => combo
  }
  
  access       = each.value.permissions
  team_id      = tfe_team.teams[each.value.team_name].id
  workspace_id = tfe_workspace.workspaces[each.value.workspace_key].id
}

# Configure Slack notifications
resource "tfe_notification_configuration" "slack" {
  for_each = var.slack_webhook_url != "" ? local.workspaces : {}
  
  name             = "slack-notifications"
  enabled          = true
  destination_type = "slack"
  triggers         = ["run:planning", "run:needs_attention", "run:applying", "run:completed", "run:errored"]
  url              = var.slack_webhook_url
  workspace_id     = tfe_workspace.workspaces[each.key].id
}

# Configure email notifications
resource "tfe_notification_configuration" "email" {
  for_each = length(var.notification_emails) > 0 ? local.workspaces : {}
  
  name                = "email-notifications"
  enabled             = true
  destination_type    = "email"
  triggers            = ["run:needs_attention", "run:errored"]
  email_user_ids      = data.tfe_organization_membership.email_users[each.key].user_ids
  workspace_id        = tfe_workspace.workspaces[each.key].id
}

# Get organization memberships for email notifications
data "tfe_organization_membership" "email_users" {
  for_each = length(var.notification_emails) > 0 ? local.workspaces : {}
  
  organization = data.tfe_organization.main.name
  emails       = var.notification_emails
}

# Configure workspace settings
resource "tfe_workspace_settings" "settings" {
  for_each = local.workspaces
  
  workspace_id   = tfe_workspace.workspaces[each.key].id
  execution_mode = "remote"
  agent_pool_id  = var.agent_pool_id
}

# Create policy sets
resource "tfe_policy_set" "security_policies" {
  count = var.enable_sentinel_policies ? 1 : 0
  
  name         = "${var.project_name}-security-policies"
  description  = "Security and compliance policies for ${var.project_name}"
  organization = data.tfe_organization.main.name
  kind         = "sentinel"
  
  workspace_ids = [for ws in tfe_workspace.workspaces : ws.id]
}

# Create policies
resource "tfe_policy" "terraform_policy" {
  count = var.enable_sentinel_policies ? 1 : 0
  
  name         = "terraform-security-policy"
  description  = "Security policy for Terraform configurations"
  organization = data.tfe_organization.main.name
  kind         = "sentinel"
  policy       = file("${path.module}/policies/sentinel/terraform-policy.sentinel")
  enforce_mode = var.policy_enforce_mode
}

# Attach policies to policy set
resource "tfe_policy_set_parameter" "security_policies" {
  count = var.enable_sentinel_policies ? 1 : 0
  
  key           = "terraform-policy"
  value         = tfe_policy.terraform_policy[0].id
  policy_set_id = tfe_policy_set.security_policies[0].id
}

# Create variable sets for common variables
resource "tfe_variable_set" "common" {
  name         = "${var.project_name}-common-variables"
  description  = "Common variables for ${var.project_name} workspaces"
  organization = data.tfe_organization.main.name
}

# Add common variables to variable set
resource "tfe_variable" "common_project_name" {
  key             = "project_name"
  value           = var.project_name
  category        = "terraform"
  description     = "Project name"
  variable_set_id = tfe_variable_set.common.id
}

resource "tfe_variable" "common_organization" {
  key             = "organization"
  value           = local.organization_name
  category        = "terraform"
  description     = "Organization name"
  variable_set_id = tfe_variable_set.common.id
}

# Apply variable set to all workspaces
resource "tfe_workspace_variable_set" "common" {
  for_each = local.workspaces
  
  variable_set_id = tfe_variable_set.common.id
  workspace_id    = tfe_workspace.workspaces[each.key].id
}

# Create run triggers for workspace dependencies
resource "tfe_run_trigger" "workspace_dependencies" {
  for_each = var.workspace_dependencies
  
  workspace_id    = tfe_workspace.workspaces[each.key].id
  sourceable_id   = tfe_workspace.workspaces[each.value].id
}

# Variables
variable "terraform_cloud_hostname" {
  description = "Terraform Cloud hostname"
  type        = string
  default     = "app.terraform.io"
}

variable "terraform_cloud_token" {
  description = "Terraform Cloud API token"
  type        = string
  sensitive   = true
}

variable "organization_name" {
  description = "Terraform Cloud organization name"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "learning-assistant"
}

variable "environments" {
  description = "List of environments"
  type        = list(string)
  default     = ["dev", "staging", "prod"]
}

variable "primary_provider" {
  description = "Primary cloud provider"
  type        = string
  default     = "aws"
  
  validation {
    condition     = contains(["aws", "gcp", "azure"], var.primary_provider)
    error_message = "Primary provider must be one of: aws, gcp, azure."
  }
}

variable "terraform_version" {
  description = "Terraform version to use"
  type        = string
  default     = "1.5.0"
}

variable "enable_vcs_integration" {
  description = "Enable VCS integration"
  type        = bool
  default     = true
}

variable "vcs_repo_identifier" {
  description = "VCS repository identifier (e.g., org/repo)"
  type        = string
  default     = ""
}

variable "vcs_oauth_token_id" {
  description = "VCS OAuth token ID"
  type        = string
  default     = ""
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications"
  type        = string
  default     = ""
  sensitive   = true
}

variable "notification_emails" {
  description = "List of email addresses for notifications"
  type        = list(string)
  default     = []
}

variable "teams" {
  description = "Teams configuration"
  type = map(object({
    visibility              = string
    manage_policies         = bool
    manage_policy_overrides = bool
    manage_workspaces      = bool
    manage_vcs_settings    = bool
  }))
  default = {
    "developers" = {
      visibility              = "organization"
      manage_policies         = false
      manage_policy_overrides = false
      manage_workspaces      = true
      manage_vcs_settings    = false
    }
    "operators" = {
      visibility              = "organization"
      manage_policies         = true
      manage_policy_overrides = true
      manage_workspaces      = true
      manage_vcs_settings    = true
    }
  }
}

variable "team_access_config" {
  description = "Team access configuration for workspaces"
  type        = map(string)
  default = {
    "developers" = "write"
    "operators"  = "admin"
  }
}

variable "enable_sentinel_policies" {
  description = "Enable Sentinel policies"
  type        = bool
  default     = true
}

variable "policy_enforce_mode" {
  description = "Policy enforcement mode"
  type        = string
  default     = "advisory"
  
  validation {
    condition     = contains(["advisory", "soft-mandatory", "hard-mandatory"], var.policy_enforce_mode)
    error_message = "Policy enforce mode must be one of: advisory, soft-mandatory, hard-mandatory."
  }
}

variable "agent_pool_id" {
  description = "Terraform Cloud agent pool ID"
  type        = string
  default     = null
}

variable "workspace_dependencies" {
  description = "Workspace dependencies for run triggers"
  type        = map(string)
  default     = {}
}

# Cloud provider credentials
variable "aws_access_key_id" {
  description = "AWS Access Key ID"
  type        = string
  default     = ""
  sensitive   = true
}

variable "aws_secret_access_key" {
  description = "AWS Secret Access Key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "gcp_service_account_key" {
  description = "GCP Service Account Key JSON"
  type        = string
  default     = ""
  sensitive   = true
}

variable "azure_client_id" {
  description = "Azure Client ID"
  type        = string
  default     = ""
  sensitive   = true
}

variable "azure_client_secret" {
  description = "Azure Client Secret"
  type        = string
  default     = ""
  sensitive   = true
}

variable "azure_tenant_id" {
  description = "Azure Tenant ID"
  type        = string
  default     = ""
  sensitive   = true
}

variable "azure_subscription_id" {
  description = "Azure Subscription ID"
  type        = string
  default     = ""
  sensitive   = true
}

# Environment-specific variables
variable "development_env_vars" {
  description = "Development environment variables"
  type        = map(string)
  default     = {}
}

variable "staging_env_vars" {
  description = "Staging environment variables"
  type        = map(string)
  default     = {}
}

variable "production_env_vars" {
  description = "Production environment variables"
  type        = map(string)
  default     = {}
}

# Outputs
output "organization_name" {
  description = "Terraform Cloud organization name"
  value       = data.tfe_organization.main.name
}

output "workspace_ids" {
  description = "Terraform Cloud workspace IDs"
  value = {
    for k, v in tfe_workspace.workspaces : k => v.id
  }
}

output "workspace_urls" {
  description = "Terraform Cloud workspace URLs"
  value = {
    for k, v in tfe_workspace.workspaces : k => "https://${var.terraform_cloud_hostname}/app/${data.tfe_organization.main.name}/workspaces/${v.name}"
  }
}

output "team_ids" {
  description = "Team IDs"
  value = {
    for k, v in tfe_team.teams : k => v.id
  }
}

output "policy_set_id" {
  description = "Policy set ID"
  value       = var.enable_sentinel_policies ? tfe_policy_set.security_policies[0].id : null
}

output "variable_set_id" {
  description = "Common variable set ID"
  value       = tfe_variable_set.common.id
}