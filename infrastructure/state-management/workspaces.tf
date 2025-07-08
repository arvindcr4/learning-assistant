# Terraform Workspace Configuration and Management
# This file defines workspace-specific configurations and management automation

terraform {
  required_version = ">= 1.0"
  required_providers {
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.0"
    }
  }
}

# Local values for workspace configuration
locals {
  # Environment-specific configurations
  environments = {
    dev = {
      name               = "development"
      state_key_prefix   = "dev"
      auto_apply         = true
      destroy_protection = false
      retention_days     = 30
      backup_enabled     = false
      drift_detection    = false
      cost_threshold     = 100
      approval_required  = false
      tags = {
        Environment = "development"
        AutoApply   = "true"
        CostCenter  = "engineering"
      }
    }
    
    staging = {
      name               = "staging"
      state_key_prefix   = "staging"
      auto_apply         = false
      destroy_protection = true
      retention_days     = 90
      backup_enabled     = true
      drift_detection    = true
      cost_threshold     = 500
      approval_required  = true
      tags = {
        Environment = "staging"
        AutoApply   = "false"
        CostCenter  = "engineering"
      }
    }
    
    prod = {
      name               = "production"
      state_key_prefix   = "prod"
      auto_apply         = false
      destroy_protection = true
      retention_days     = 365
      backup_enabled     = true
      drift_detection    = true
      cost_threshold     = 1000
      approval_required  = true
      tags = {
        Environment = "production"
        AutoApply   = "false"
        CostCenter  = "operations"
      }
    }
  }
  
  # Cloud provider configurations
  cloud_providers = {
    aws = {
      region = var.aws_region
      backend_config = {
        bucket         = var.aws_state_bucket
        key            = "${local.environments[var.environment].state_key_prefix}/terraform.tfstate"
        region         = var.aws_region
        encrypt        = true
        dynamodb_table = var.aws_dynamodb_table
        kms_key_id     = var.aws_kms_key_id
      }
    }
    
    gcp = {
      region = var.gcp_region
      backend_config = {
        bucket = var.gcp_state_bucket
        prefix = "${local.environments[var.environment].state_key_prefix}/terraform/state"
      }
    }
    
    azure = {
      region = var.azure_region
      backend_config = {
        resource_group_name  = var.azure_resource_group
        storage_account_name = var.azure_storage_account
        container_name       = var.azure_container_name
        key                  = "${local.environments[var.environment].state_key_prefix}/terraform.tfstate"
      }
    }
  }
}

# Workspace Configuration File Generation
resource "local_file" "workspace_config" {
  for_each = local.environments
  
  filename = "${path.module}/configs/${each.key}.tfvars"
  content = templatefile("${path.module}/templates/workspace.tfvars.tpl", {
    environment = each.value
    workspace   = each.key
  })
  
  file_permission = "0644"
}

# Backend Configuration Generation
resource "local_file" "backend_config" {
  for_each = var.enabled_providers
  
  filename = "${path.module}/configs/backend-${each.key}-${var.environment}.hcl"
  content = templatefile("${path.module}/templates/backend-${each.key}.hcl.tpl", {
    config = local.cloud_providers[each.key].backend_config
  })
  
  file_permission = "0644"
}

# Workspace Management Scripts
resource "local_file" "workspace_init_script" {
  filename = "${path.module}/scripts/workspace-init.sh"
  content = templatefile("${path.module}/templates/workspace-init.sh.tpl", {
    environments = local.environments
    providers    = var.enabled_providers
  })
  
  file_permission = "0755"
}

resource "local_file" "workspace_switch_script" {
  filename = "${path.module}/scripts/workspace-switch.sh"
  content = templatefile("${path.module}/templates/workspace-switch.sh.tpl", {
    environments = local.environments
    providers    = var.enabled_providers
  })
  
  file_permission = "0755"
}

# Workspace Validation Script
resource "local_file" "workspace_validate_script" {
  filename = "${path.module}/scripts/workspace-validate.sh"
  content = templatefile("${path.module}/templates/workspace-validate.sh.tpl", {
    environments = local.environments
    providers    = var.enabled_providers
  })
  
  file_permission = "0755"
}

# Workspace Cleanup Script
resource "local_file" "workspace_cleanup_script" {
  filename = "${path.module}/scripts/workspace-cleanup.sh"
  content = templatefile("${path.module}/templates/workspace-cleanup.sh.tpl", {
    environments = local.environments
    providers    = var.enabled_providers
  })
  
  file_permission = "0755"
}

# Environment-specific Terraform Configuration
resource "local_file" "env_terraform_config" {
  for_each = local.environments
  
  filename = "${path.module}/environments/${each.key}/terraform.tf"
  content = templatefile("${path.module}/templates/terraform.tf.tpl", {
    environment = each.value
    workspace   = each.key
    providers   = var.enabled_providers
  })
  
  file_permission = "0644"
}

# Environment-specific Variable Files
resource "local_file" "env_variables" {
  for_each = local.environments
  
  filename = "${path.module}/environments/${each.key}/variables.tf"
  content = templatefile("${path.module}/templates/variables.tf.tpl", {
    environment = each.value
    workspace   = each.key
  })
  
  file_permission = "0644"
}

# Environment-specific Outputs
resource "local_file" "env_outputs" {
  for_each = local.environments
  
  filename = "${path.module}/environments/${each.key}/outputs.tf"
  content = templatefile("${path.module}/templates/outputs.tf.tpl", {
    environment = each.value
    workspace   = each.key
  })
  
  file_permission = "0644"
}

# Workspace State Management
resource "null_resource" "workspace_setup" {
  for_each = local.environments
  
  triggers = {
    workspace_config = local_file.workspace_config[each.key].content
  }
  
  provisioner "local-exec" {
    command = "${path.module}/scripts/workspace-init.sh ${each.key}"
    environment = {
      TF_WORKSPACE = each.key
      ENVIRONMENT  = each.value.name
    }
  }
}

# Workspace Validation
resource "null_resource" "workspace_validation" {
  for_each = local.environments
  
  triggers = {
    workspace_config = local_file.workspace_config[each.key].content
  }
  
  provisioner "local-exec" {
    command = "${path.module}/scripts/workspace-validate.sh ${each.key}"
    environment = {
      TF_WORKSPACE = each.key
      ENVIRONMENT  = each.value.name
    }
  }
  
  depends_on = [null_resource.workspace_setup]
}

# Workspace Documentation
resource "local_file" "workspace_documentation" {
  filename = "${path.module}/docs/WORKSPACE_MANAGEMENT.md"
  content = templatefile("${path.module}/templates/workspace-docs.md.tpl", {
    environments = local.environments
    providers    = var.enabled_providers
  })
  
  file_permission = "0644"
}

# Workspace Monitoring Configuration
resource "local_file" "workspace_monitoring" {
  filename = "${path.module}/monitoring/workspace-monitoring.json"
  content = jsonencode({
    environments = local.environments
    monitoring = {
      drift_detection = {
        enabled = true
        schedule = "0 */6 * * *"  # Every 6 hours
        environments = [
          for env_name, env_config in local.environments : env_name
          if env_config.drift_detection
        ]
      }
      cost_monitoring = {
        enabled = true
        schedule = "0 0 * * *"  # Daily
        thresholds = {
          for env_name, env_config in local.environments : env_name => env_config.cost_threshold
        }
      }
      backup_monitoring = {
        enabled = true
        schedule = "0 2 * * *"  # Daily at 2 AM
        environments = [
          for env_name, env_config in local.environments : env_name
          if env_config.backup_enabled
        ]
      }
    }
  })
  
  file_permission = "0644"
}

# Create template files
resource "local_file" "workspace_tfvars_template" {
  filename = "${path.module}/templates/workspace.tfvars.tpl"
  content = <<-EOT
    # Workspace Configuration for ${var.environment}
    environment = "${var.environment}"
    
    # Environment-specific settings
    auto_apply = ${var.auto_apply}
    destroy_protection = ${var.destroy_protection}
    retention_days = ${var.retention_days}
    backup_enabled = ${var.backup_enabled}
    drift_detection = ${var.drift_detection}
    cost_threshold = ${var.cost_threshold}
    approval_required = ${var.approval_required}
    
    # Tags
    tags = {
      %{ for key, value in var.tags ~}
      ${key} = "${value}"
      %{ endfor ~}
    }
    
    # Provider-specific configurations
    %{ for provider in var.enabled_providers ~}
    ${provider}_enabled = true
    %{ endfor ~}
  EOT
  
  file_permission = "0644"
}

# Backend configuration templates
resource "local_file" "backend_aws_template" {
  filename = "${path.module}/templates/backend-aws.hcl.tpl"
  content = <<-EOT
    bucket         = "${var.aws_state_bucket}"
    key            = "${var.state_key_prefix}/terraform.tfstate"
    region         = "${var.aws_region}"
    encrypt        = true
    dynamodb_table = "${var.aws_dynamodb_table}"
    kms_key_id     = "${var.aws_kms_key_id}"
    
    # Workspace-specific configurations
    workspace_key_prefix = "${var.state_key_prefix}"
  EOT
  
  file_permission = "0644"
}

resource "local_file" "backend_gcp_template" {
  filename = "${path.module}/templates/backend-gcp.hcl.tpl"
  content = <<-EOT
    bucket = "${var.gcp_state_bucket}"
    prefix = "${var.state_key_prefix}/terraform/state"
    
    # Workspace-specific configurations
    workspace_key_prefix = "${var.state_key_prefix}"
  EOT
  
  file_permission = "0644"
}

resource "local_file" "backend_azure_template" {
  filename = "${path.module}/templates/backend-azure.hcl.tpl"
  content = <<-EOT
    resource_group_name  = "${var.azure_resource_group}"
    storage_account_name = "${var.azure_storage_account}"
    container_name       = "${var.azure_container_name}"
    key                  = "${var.state_key_prefix}/terraform.tfstate"
    
    # Workspace-specific configurations
    workspace_key_prefix = "${var.state_key_prefix}"
  EOT
  
  file_permission = "0644"
}

# Variables
variable "environment" {
  description = "Current environment (dev, staging, prod)"
  type        = string
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "enabled_providers" {
  description = "List of enabled cloud providers"
  type        = set(string)
  default     = ["aws"]
  
  validation {
    condition = alltrue([
      for provider in var.enabled_providers : contains(["aws", "gcp", "azure"], provider)
    ])
    error_message = "Enabled providers must be one of: aws, gcp, azure."
  }
}

# AWS Configuration
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

variable "aws_state_bucket" {
  description = "AWS S3 bucket for state storage"
  type        = string
  default     = ""
}

variable "aws_dynamodb_table" {
  description = "AWS DynamoDB table for state locking"
  type        = string
  default     = ""
}

variable "aws_kms_key_id" {
  description = "AWS KMS key ID for state encryption"
  type        = string
  default     = ""
}

# GCP Configuration
variable "gcp_region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "gcp_state_bucket" {
  description = "GCP Storage bucket for state storage"
  type        = string
  default     = ""
}

# Azure Configuration
variable "azure_region" {
  description = "Azure region"
  type        = string
  default     = "East US"
}

variable "azure_resource_group" {
  description = "Azure resource group for state storage"
  type        = string
  default     = ""
}

variable "azure_storage_account" {
  description = "Azure storage account for state storage"
  type        = string
  default     = ""
}

variable "azure_container_name" {
  description = "Azure container name for state storage"
  type        = string
  default     = ""
}

# Outputs
output "workspace_configurations" {
  description = "Workspace configurations for all environments"
  value       = local.environments
}

output "backend_configurations" {
  description = "Backend configurations for enabled providers"
  value = {
    for provider in var.enabled_providers : provider => local.cloud_providers[provider].backend_config
  }
}

output "workspace_files" {
  description = "Generated workspace configuration files"
  value = {
    configs = [for file in local_file.workspace_config : file.filename]
    scripts = [
      local_file.workspace_init_script.filename,
      local_file.workspace_switch_script.filename,
      local_file.workspace_validate_script.filename,
      local_file.workspace_cleanup_script.filename
    ]
  }
}

output "current_environment" {
  description = "Current environment configuration"
  value       = local.environments[var.environment]
}