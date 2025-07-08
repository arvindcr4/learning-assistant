# =============================================================================
# SECRETS MANAGEMENT MODULE
# Comprehensive secrets management with automatic rotation
# =============================================================================

# =============================================================================
# VARIABLES
# =============================================================================

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "learning-assistant"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "enable_automatic_rotation" {
  description = "Enable automatic secret rotation"
  type        = bool
  default     = true
}

variable "rotation_schedule_days" {
  description = "Default rotation schedule in days"
  type        = number
  default     = 90
}

variable "enable_cross_region_replication" {
  description = "Enable cross-region secret replication"
  type        = bool
  default     = true
}

variable "secrets" {
  description = "Secrets configuration"
  type = map(object({
    name             = string
    description      = string
    rotation_enabled = bool
    rotation_days    = number
  }))
  default = {}
}

variable "access_policies" {
  description = "Access policies for secrets"
  type = map(object({
    name       = string
    principals = list(string)
    secrets    = list(string)
    actions    = list(string)
  }))
  default = {}
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}

# =============================================================================
# LOCALS
# =============================================================================

locals {
  common_tags = merge(var.tags, {
    Module = "secrets-management"
  })

  # Default secrets configuration
  default_secrets = {
    database_master_password = {
      name             = "database-master-password"
      description      = "Database master password"
      rotation_enabled = true
      rotation_days    = 30
    }
    database_app_password = {
      name             = "database-app-password"
      description      = "Database application user password"
      rotation_enabled = true
      rotation_days    = 30
    }
    redis_auth_token = {
      name             = "redis-auth-token"
      description      = "Redis authentication token"
      rotation_enabled = true
      rotation_days    = 60
    }
    jwt_signing_key = {
      name             = "jwt-signing-key"
      description      = "JWT signing key"
      rotation_enabled = true
      rotation_days    = 30
    }
    api_keys = {
      name             = "external-api-keys"
      description      = "External API keys and tokens"
      rotation_enabled = true
      rotation_days    = 90
    }
    encryption_keys = {
      name             = "application-encryption-keys"
      description      = "Application-level encryption keys"
      rotation_enabled = true
      rotation_days    = var.rotation_schedule_days
    }
    oauth_client_secrets = {
      name             = "oauth-client-secrets"
      description      = "OAuth client secrets"
      rotation_enabled = true
      rotation_days    = 180
    }
    webhook_secrets = {
      name             = "webhook-secrets"
      description      = "Webhook signing secrets"
      rotation_enabled = true
      rotation_days    = 90
    }
    session_encryption_key = {
      name             = "session-encryption-key"
      description      = "Session encryption key"
      rotation_enabled = true
      rotation_days    = 30
    }
    backup_encryption_key = {
      name             = "backup-encryption-key"
      description      = "Backup encryption key"
      rotation_enabled = true
      rotation_days    = 90
    }
  }

  # Merge user-defined secrets with defaults
  all_secrets = merge(local.default_secrets, var.secrets)

  # Cross-region replication targets
  replication_regions = var.enable_cross_region_replication ? [
    "us-west-2",
    "eu-west-1"
  ] : []
}

# =============================================================================
# DATA SOURCES
# =============================================================================

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# =============================================================================
# KMS KEY FOR SECRETS ENCRYPTION
# =============================================================================

resource "aws_kms_key" "secrets" {
  description              = "KMS key for secrets encryption"
  key_usage               = "ENCRYPT_DECRYPT"
  customer_master_key_spec = "SYMMETRIC_DEFAULT"
  key_rotation_enabled    = true
  deletion_window_in_days = 30

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow secrets manager access"
        Effect = "Allow"
        Principal = {
          Service = "secretsmanager.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:Encrypt",
          "kms:GenerateDataKey",
          "kms:ReEncrypt*"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow application access"
        Effect = "Allow"
        Principal = {
          AWS = [
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.project_name}-${var.environment}-application-role",
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.project_name}-${var.environment}-lambda-role"
          ]
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-secrets-key"
    Purpose = "SecretsEncryption"
  })
}

resource "aws_kms_alias" "secrets" {
  name          = "alias/${var.project_name}-${var.environment}-secrets"
  target_key_id = aws_kms_key.secrets.key_id
}

# =============================================================================
# SECRETS MANAGER SECRETS
# =============================================================================

# Secrets Manager secrets
resource "aws_secretsmanager_secret" "secrets" {
  for_each = local.all_secrets

  name        = "${var.project_name}-${var.environment}-${each.value.name}"
  description = each.value.description
  kms_key_id  = aws_kms_key.secrets.arn

  # Cross-region replication
  dynamic "replica" {
    for_each = local.replication_regions
    content {
      region     = replica.value
      kms_key_id = aws_kms_key.secrets.arn
    }
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-${each.value.name}"
    RotationEnabled = tostring(each.value.rotation_enabled)
    RotationDays = tostring(each.value.rotation_days)
  })
}

# =============================================================================
# SECRET VALUES
# =============================================================================

# Database master password
resource "aws_secretsmanager_secret_version" "database_master_password" {
  secret_id = aws_secretsmanager_secret.secrets["database_master_password"].id
  secret_string = jsonencode({
    username = "postgres"
    password = random_password.database_master.result
    engine   = "postgres"
    host     = "${var.project_name}-${var.environment}-database.cluster-xyz.${var.region}.rds.amazonaws.com"
    port     = 5432
    dbname   = "${var.project_name}_${var.environment}"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "random_password" "database_master" {
  length  = 32
  special = true
}

# Database application password
resource "aws_secretsmanager_secret_version" "database_app_password" {
  secret_id = aws_secretsmanager_secret.secrets["database_app_password"].id
  secret_string = jsonencode({
    username = "app_user"
    password = random_password.database_app.result
    engine   = "postgres"
    host     = "${var.project_name}-${var.environment}-database.cluster-xyz.${var.region}.rds.amazonaws.com"
    port     = 5432
    dbname   = "${var.project_name}_${var.environment}"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "random_password" "database_app" {
  length  = 32
  special = true
}

# Redis auth token
resource "aws_secretsmanager_secret_version" "redis_auth_token" {
  secret_id = aws_secretsmanager_secret.secrets["redis_auth_token"].id
  secret_string = jsonencode({
    auth_token = random_password.redis_auth.result
    host       = "${var.project_name}-${var.environment}-redis.abc123.cache.amazonaws.com"
    port       = 6379
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "random_password" "redis_auth" {
  length  = 64
  special = false
}

# JWT signing key
resource "aws_secretsmanager_secret_version" "jwt_signing_key" {
  secret_id = aws_secretsmanager_secret.secrets["jwt_signing_key"].id
  secret_string = jsonencode({
    signing_key    = random_password.jwt_signing.result
    algorithm      = "HS256"
    expiration     = "24h"
    refresh_expiration = "7d"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "random_password" "jwt_signing" {
  length  = 64
  special = false
}

# External API keys
resource "aws_secretsmanager_secret_version" "api_keys" {
  secret_id = aws_secretsmanager_secret.secrets["api_keys"].id
  secret_string = jsonencode({
    openai_api_key     = "sk-placeholder-openai-key"
    stripe_secret_key  = "sk_test_placeholder_stripe_key"
    sendgrid_api_key   = "SG.placeholder-sendgrid-key"
    oauth_client_id    = "placeholder-oauth-client-id"
    oauth_client_secret = random_password.oauth_client.result
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "random_password" "oauth_client" {
  length  = 64
  special = true
}

# Application encryption keys
resource "aws_secretsmanager_secret_version" "encryption_keys" {
  secret_id = aws_secretsmanager_secret.secrets["encryption_keys"].id
  secret_string = jsonencode({
    data_encryption_key = random_password.data_encryption.result
    file_encryption_key = random_password.file_encryption.result
    pii_encryption_key  = random_password.pii_encryption.result
    session_key        = random_password.session_encryption.result
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "random_password" "data_encryption" {
  length  = 64
  special = false
}

resource "random_password" "file_encryption" {
  length  = 64
  special = false
}

resource "random_password" "pii_encryption" {
  length  = 64
  special = false
}

resource "random_password" "session_encryption" {
  length  = 64
  special = false
}

# Webhook secrets
resource "aws_secretsmanager_secret_version" "webhook_secrets" {
  secret_id = aws_secretsmanager_secret.secrets["webhook_secrets"].id
  secret_string = jsonencode({
    github_webhook_secret   = random_password.github_webhook.result
    stripe_webhook_secret   = random_password.stripe_webhook.result
    general_webhook_secret  = random_password.general_webhook.result
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "random_password" "github_webhook" {
  length  = 64
  special = true
}

resource "random_password" "stripe_webhook" {
  length  = 64
  special = true
}

resource "random_password" "general_webhook" {
  length  = 64
  special = true
}

# Backup encryption key
resource "aws_secretsmanager_secret_version" "backup_encryption_key" {
  secret_id = aws_secretsmanager_secret.secrets["backup_encryption_key"].id
  secret_string = jsonencode({
    encryption_key = random_password.backup_encryption.result
    algorithm      = "AES-256-GCM"
    key_derivation = "PBKDF2"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "random_password" "backup_encryption" {
  length  = 64
  special = false
}

# =============================================================================
# AUTOMATIC ROTATION
# =============================================================================

# Lambda function for secret rotation
resource "aws_lambda_function" "secret_rotation" {
  for_each = {
    for k, v in local.all_secrets : k => v if v.rotation_enabled
  }

  filename         = "secret_rotation_${each.key}.zip"
  function_name    = "${var.project_name}-${var.environment}-rotate-${each.key}"
  role            = aws_iam_role.rotation_lambda.arn
  handler         = "index.handler"
  runtime         = "python3.9"
  timeout         = 300

  environment {
    variables = {
      SECRETS_MANAGER_ENDPOINT = "https://secretsmanager.${var.region}.amazonaws.com"
      SECRET_ARN              = aws_secretsmanager_secret.secrets[each.key].arn
    }
  }

  vpc_config {
    subnet_ids         = data.aws_subnets.private.ids
    security_group_ids = [aws_security_group.rotation_lambda.id]
  }

  tags = merge(local.common_tags, {
    SecretName = each.key
  })
}

# IAM role for rotation Lambda
resource "aws_iam_role" "rotation_lambda" {
  name = "${var.project_name}-${var.environment}-rotation-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "rotation_lambda_policy" {
  name = "${var.project_name}-${var.environment}-rotation-lambda-policy"
  role = aws_iam_role.rotation_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:DescribeSecret",
          "secretsmanager:GetSecretValue",
          "secretsmanager:PutSecretValue",
          "secretsmanager:UpdateSecretVersionStage"
        ]
        Resource = [
          for secret in aws_secretsmanager_secret.secrets : secret.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:Encrypt",
          "kms:GenerateDataKey"
        ]
        Resource = aws_kms_key.secrets.arn
      },
      {
        Effect = "Allow"
        Action = [
          "rds:ModifyDBInstance",
          "rds:ModifyDBCluster"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "rds:DatabaseEngine" = "postgres"
          }
        }
      },
      {
        Effect = "Allow"
        Action = [
          "elasticache:ModifyReplicationGroup",
          "elasticache:ModifyUser"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ]
        Resource = "*"
      }
    ]
  })
}

# Security group for rotation Lambda
resource "aws_security_group" "rotation_lambda" {
  name_prefix = "${var.project_name}-${var.environment}-rotation-lambda-"
  vpc_id      = data.aws_vpc.main.id

  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS to AWS APIs"
  }

  egress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.main.cidr_block]
    description = "PostgreSQL to database"
  }

  egress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.main.cidr_block]
    description = "Redis to cache"
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-rotation-lambda-sg"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# Secret rotation configuration
resource "aws_secretsmanager_secret_rotation" "rotation" {
  for_each = {
    for k, v in local.all_secrets : k => v if v.rotation_enabled && var.enable_automatic_rotation
  }

  secret_id          = aws_secretsmanager_secret.secrets[each.key].id
  rotation_lambda_arn = aws_lambda_function.secret_rotation[each.key].arn

  rotation_rules {
    automatically_after_days = each.value.rotation_days
  }

  depends_on = [aws_lambda_permission.rotation_lambda]
}

# Lambda permission for rotation
resource "aws_lambda_permission" "rotation_lambda" {
  for_each = {
    for k, v in local.all_secrets : k => v if v.rotation_enabled
  }

  statement_id  = "AllowExecutionFromSecretsManager"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.secret_rotation[each.key].function_name
  principal     = "secretsmanager.amazonaws.com"
}

# =============================================================================
# DATA SOURCES FOR NETWORKING
# =============================================================================

data "aws_vpc" "main" {
  filter {
    name   = "tag:Name"
    values = ["${var.project_name}-${var.environment}-vpc"]
  }
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.main.id]
  }

  filter {
    name   = "tag:Tier"
    values = ["Private"]
  }
}

# =============================================================================
# ACCESS POLICIES
# =============================================================================

# Resource-based policies for secrets
resource "aws_secretsmanager_secret_policy" "access_policies" {
  for_each = var.access_policies

  secret_arn = aws_secretsmanager_secret.secrets[each.value.secrets[0]].arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSpecifiedPrincipals"
        Effect = "Allow"
        Principal = {
          AWS = each.value.principals
        }
        Action   = each.value.actions
        Resource = "*"
        Condition = {
          StringEquals = {
            "secretsmanager:ResourceTag/Environment" = var.environment
          }
        }
      }
    ]
  })
}

# =============================================================================
# MONITORING AND ALERTING
# =============================================================================

# CloudWatch alarms for secret rotation failures
resource "aws_cloudwatch_metric_alarm" "rotation_failure" {
  for_each = {
    for k, v in local.all_secrets : k => v if v.rotation_enabled
  }

  alarm_name          = "${var.project_name}-${var.environment}-${each.key}-rotation-failure"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "Secret rotation failure for ${each.key}"
  alarm_actions       = [aws_sns_topic.secrets_alerts.arn]

  dimensions = {
    FunctionName = aws_lambda_function.secret_rotation[each.key].function_name
  }

  tags = local.common_tags
}

# CloudWatch alarms for secret access
resource "aws_cloudwatch_metric_alarm" "unusual_access" {
  for_each = local.all_secrets

  alarm_name          = "${var.project_name}-${var.environment}-${each.key}-unusual-access"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "GetSecretValue"
  namespace           = "AWS/SecretsManager"
  period              = "300"
  statistic           = "Sum"
  threshold           = "100"
  alarm_description   = "Unusual access pattern for secret ${each.key}"
  alarm_actions       = [aws_sns_topic.secrets_alerts.arn]

  dimensions = {
    SecretName = aws_secretsmanager_secret.secrets[each.key].name
  }

  tags = local.common_tags
}

# SNS topic for secrets alerts
resource "aws_sns_topic" "secrets_alerts" {
  name = "${var.project_name}-${var.environment}-secrets-alerts"

  tags = local.common_tags
}

# =============================================================================
# SECRET SCANNING
# =============================================================================

# EventBridge rule for secret scanning
resource "aws_cloudwatch_event_rule" "secret_scan" {
  name        = "${var.project_name}-${var.environment}-secret-scan"
  description = "Trigger secret scanning"

  event_pattern = jsonencode({
    source        = ["aws.secretsmanager"]
    "detail-type" = ["AWS API Call via CloudTrail"]
    detail = {
      eventSource = ["secretsmanager.amazonaws.com"]
      eventName   = ["CreateSecret", "UpdateSecret", "PutSecretValue"]
    }
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "secret_scan_lambda" {
  rule      = aws_cloudwatch_event_rule.secret_scan.name
  target_id = "SecretScanTarget"
  arn       = aws_lambda_function.secret_scanner.arn
}

# Lambda function for secret scanning
resource "aws_lambda_function" "secret_scanner" {
  filename         = "secret_scanner.zip"
  function_name    = "${var.project_name}-${var.environment}-secret-scanner"
  role            = aws_iam_role.secret_scanner_lambda.arn
  handler         = "index.handler"
  runtime         = "python3.9"
  timeout         = 300

  environment {
    variables = {
      SNS_TOPIC_ARN = aws_sns_topic.secrets_alerts.arn
    }
  }

  tags = local.common_tags
}

resource "aws_iam_role" "secret_scanner_lambda" {
  name = "${var.project_name}-${var.environment}-secret-scanner-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_lambda_permission" "secret_scan_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.secret_scanner.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.secret_scan.arn
}

# =============================================================================
# BACKUP AND RECOVERY
# =============================================================================

# S3 bucket for secret backups
resource "aws_s3_bucket" "secret_backups" {
  bucket = "${var.project_name}-${var.environment}-secret-backups"

  tags = merge(local.common_tags, {
    Purpose = "SecretBackups"
  })
}

resource "aws_s3_bucket_server_side_encryption_configuration" "secret_backups" {
  bucket = aws_s3_bucket.secret_backups.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.secrets.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "secret_backups" {
  bucket = aws_s3_bucket.secret_backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "secret_backups" {
  bucket = aws_s3_bucket.secret_backups.id

  rule {
    id     = "secret_backup_lifecycle"
    status = "Enabled"

    expiration {
      days = 2555  # 7 years for compliance
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# =============================================================================
# OUTPUTS
# =============================================================================

output "secrets" {
  description = "Created secrets"
  value = {
    for key, secret in aws_secretsmanager_secret.secrets : key => {
      name = secret.name
      arn  = secret.arn
    }
  }
  sensitive = true
}

output "kms_key" {
  description = "KMS key for secrets encryption"
  value = {
    key_id = aws_kms_key.secrets.key_id
    arn    = aws_kms_key.secrets.arn
    alias  = aws_kms_alias.secrets.name
  }
  sensitive = true
}

output "rotation_functions" {
  description = "Secret rotation Lambda functions"
  value = {
    for key, func in aws_lambda_function.secret_rotation : key => {
      function_name = func.function_name
      arn          = func.arn
    }
  }
}

output "access_policies" {
  description = "Secret access policies"
  value = {
    for key, policy in var.access_policies : key => {
      name = policy.name
      principals = policy.principals
      secrets = policy.secrets
      actions = policy.actions
    }
  }
  sensitive = true
}

output "monitoring" {
  description = "Secrets monitoring configuration"
  value = {
    alerts_topic = aws_sns_topic.secrets_alerts.arn
    scanner_function = aws_lambda_function.secret_scanner.function_name
    backup_bucket = aws_s3_bucket.secret_backups.bucket
  }
}

output "rotation_schedule" {
  description = "Rotation schedule for secrets"
  value = {
    for key, config in local.all_secrets : key => {
      rotation_enabled = config.rotation_enabled
      rotation_days    = config.rotation_days
    } if config.rotation_enabled
  }
}

output "cross_region_replication" {
  description = "Cross-region replication status"
  value = {
    enabled = var.enable_cross_region_replication
    regions = local.replication_regions
  }
}

output "secrets_management_summary" {
  description = "Secrets management configuration summary"
  value = {
    total_secrets                = length(local.all_secrets)
    rotation_enabled_secrets     = length([for k, v in local.all_secrets : k if v.rotation_enabled])
    automatic_rotation_enabled   = var.enable_automatic_rotation
    cross_region_replication     = var.enable_cross_region_replication
    default_rotation_days        = var.rotation_schedule_days
    kms_encryption_enabled       = true
    monitoring_enabled           = true
    backup_enabled               = true
    access_policies_count        = length(var.access_policies)
  }
}