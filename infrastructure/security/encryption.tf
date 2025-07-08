# =============================================================================
# ENCRYPTION CONFIGURATION
# Comprehensive encryption for data at rest and in transit
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

variable "enable_envelope_encryption" {
  description = "Enable envelope encryption"
  type        = bool
  default     = true
}

variable "enable_field_level_encryption" {
  description = "Enable field-level encryption"
  type        = bool
  default     = true
}

variable "enable_database_encryption" {
  description = "Enable database encryption"
  type        = bool
  default     = true
}

variable "enable_storage_encryption" {
  description = "Enable storage encryption"
  type        = bool
  default     = true
}

variable "enable_transit_encryption" {
  description = "Enable transit encryption"
  type        = bool
  default     = true
}

variable "key_rotation_enabled" {
  description = "Enable automatic key rotation"
  type        = bool
  default     = true
}

variable "key_rotation_days" {
  description = "Number of days between key rotations"
  type        = number
  default     = 90
}

variable "enable_hsm" {
  description = "Enable Hardware Security Module (CloudHSM)"
  type        = bool
  default     = false
}

variable "encryption_keys" {
  description = "Encryption keys configuration"
  type = map(object({
    name             = string
    description      = string
    usage            = string
    rotation_enabled = bool
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
    Module = "encryption"
  })

  # Encryption algorithms and settings
  encryption_config = {
    symmetric_algorithms = ["AES256", "AES128"]
    asymmetric_algorithms = ["RSA_2048", "RSA_3072", "RSA_4096", "ECC_NIST_P256", "ECC_NIST_P384", "ECC_NIST_P521"]
    hash_algorithms = ["SHA256", "SHA384", "SHA512"]
    key_usage_types = ["ENCRYPT_DECRYPT", "SIGN_VERIFY", "GENERATE_VERIFY_MAC"]
    key_specs = {
      symmetric = ["AES_256", "AES_128"]
      asymmetric = ["RSA_2048", "RSA_3072", "RSA_4096", "ECC_NIST_P256", "ECC_NIST_P384", "ECC_NIST_P521"]
      hmac = ["HMAC_256", "HMAC_384", "HMAC_512"]
    }
  }

  # Default encryption keys
  default_encryption_keys = {
    primary = {
      name             = "${var.project_name}-${var.environment}-primary-key"
      description      = "Primary encryption key for application data"
      usage            = "ENCRYPT_DECRYPT"
      rotation_enabled = var.key_rotation_enabled
    }
    database = {
      name             = "${var.project_name}-${var.environment}-database-key"
      description      = "Database encryption key"
      usage            = "ENCRYPT_DECRYPT"
      rotation_enabled = var.key_rotation_enabled
    }
    storage = {
      name             = "${var.project_name}-${var.environment}-storage-key"
      description      = "Storage encryption key"
      usage            = "ENCRYPT_DECRYPT"
      rotation_enabled = var.key_rotation_enabled
    }
    application = {
      name             = "${var.project_name}-${var.environment}-application-key"
      description      = "Application-level encryption key"
      usage            = "ENCRYPT_DECRYPT"
      rotation_enabled = var.key_rotation_enabled
    }
    backup = {
      name             = "${var.project_name}-${var.environment}-backup-key"
      description      = "Backup encryption key"
      usage            = "ENCRYPT_DECRYPT"
      rotation_enabled = var.key_rotation_enabled
    }
    logs = {
      name             = "${var.project_name}-${var.environment}-logs-key"
      description      = "Log encryption key"
      usage            = "ENCRYPT_DECRYPT"
      rotation_enabled = var.key_rotation_enabled
    }
    secrets = {
      name             = "${var.project_name}-${var.environment}-secrets-key"
      description      = "Secrets encryption key"
      usage            = "ENCRYPT_DECRYPT"
      rotation_enabled = var.key_rotation_enabled
    }
    transit = {
      name             = "${var.project_name}-${var.environment}-transit-key"
      description      = "Transit encryption key"
      usage            = "ENCRYPT_DECRYPT"
      rotation_enabled = var.key_rotation_enabled
    }
  }

  # Merge user-defined keys with defaults
  all_encryption_keys = merge(local.default_encryption_keys, var.encryption_keys)
}

# =============================================================================
# DATA SOURCES
# =============================================================================

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# =============================================================================
# KMS CUSTOMER MANAGED KEYS
# =============================================================================

# Primary encryption key
resource "aws_kms_key" "encryption_keys" {
  for_each = local.all_encryption_keys

  description              = each.value.description
  key_usage               = each.value.usage
  customer_master_key_spec = "SYMMETRIC_DEFAULT"
  key_rotation_enabled    = each.value.rotation_enabled
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
        Sid    = "Allow access for Key Administrators"
        Effect = "Allow"
        Principal = {
          AWS = [
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/KMSAdministrator",
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/SecurityAdministrator"
          ]
        }
        Action = [
          "kms:Create*",
          "kms:Describe*",
          "kms:Enable*",
          "kms:List*",
          "kms:Put*",
          "kms:Update*",
          "kms:Revoke*",
          "kms:Disable*",
          "kms:Get*",
          "kms:Delete*",
          "kms:TagResource",
          "kms:UntagResource",
          "kms:ScheduleKeyDeletion",
          "kms:CancelKeyDeletion"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow use of the key"
        Effect = "Allow"
        Principal = {
          AWS = [
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.project_name}-${var.environment}-application-role",
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.project_name}-${var.environment}-lambda-role"
          ]
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = [
              "s3.${data.aws_region.current.name}.amazonaws.com",
              "rds.${data.aws_region.current.name}.amazonaws.com",
              "secretsmanager.${data.aws_region.current.name}.amazonaws.com",
              "logs.${data.aws_region.current.name}.amazonaws.com"
            ]
          }
        }
      },
      {
        Sid    = "Allow attachment of persistent resources"
        Effect = "Allow"
        Principal = {
          AWS = [
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.project_name}-${var.environment}-application-role",
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.project_name}-${var.environment}-lambda-role"
          ]
        }
        Action = [
          "kms:CreateGrant",
          "kms:ListGrants",
          "kms:RevokeGrant"
        ]
        Resource = "*"
        Condition = {
          Bool = {
            "kms:GrantIsForAWSResource" = "true"
          }
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = each.value.name
    KeyUsage = each.value.usage
    RotationEnabled = tostring(each.value.rotation_enabled)
  })
}

# KMS Key Aliases
resource "aws_kms_alias" "encryption_key_aliases" {
  for_each = local.all_encryption_keys

  name          = "alias/${each.value.name}"
  target_key_id = aws_kms_key.encryption_keys[each.key].key_id
}

# =============================================================================
# FIELD-LEVEL ENCRYPTION KEYS
# =============================================================================

resource "aws_kms_key" "field_level_encryption" {
  count = var.enable_field_level_encryption ? 1 : 0

  description              = "Field-level encryption key for sensitive data"
  key_usage               = "ENCRYPT_DECRYPT"
  customer_master_key_spec = "SYMMETRIC_DEFAULT"
  key_rotation_enabled    = var.key_rotation_enabled
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
        Sid    = "Allow field-level encryption use"
        Effect = "Allow"
        Principal = {
          AWS = [
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.project_name}-${var.environment}-application-role"
          ]
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-field-level-encryption"
    Purpose = "FieldLevelEncryption"
  })
}

resource "aws_kms_alias" "field_level_encryption" {
  count = var.enable_field_level_encryption ? 1 : 0

  name          = "alias/${var.project_name}-${var.environment}-field-level-encryption"
  target_key_id = aws_kms_key.field_level_encryption[0].key_id
}

# =============================================================================
# CLOUDFRONT FIELD-LEVEL ENCRYPTION
# =============================================================================

resource "aws_cloudfront_public_key" "field_level_encryption" {
  count = var.enable_field_level_encryption ? 1 : 0

  name        = "${var.project_name}-${var.environment}-field-level-encryption-key"
  encoded_key = tls_public_key.field_level_encryption[0].public_key_pem

  comment = "Field-level encryption public key for ${var.project_name} ${var.environment}"
}

resource "tls_private_key" "field_level_encryption" {
  count = var.enable_field_level_encryption ? 1 : 0

  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "tls_public_key" "field_level_encryption" {
  count = var.enable_field_level_encryption ? 1 : 0

  private_key_pem = tls_private_key.field_level_encryption[0].private_key_pem
}

resource "aws_cloudfront_field_level_encryption_config" "main" {
  count = var.enable_field_level_encryption ? 1 : 0

  comment = "Field-level encryption config for ${var.project_name} ${var.environment}"

  content_type_profile_config {
    forward_when_content_type_is_unknown = false
    
    content_type_profiles {
      content_type = "application/json"
      
      profile_id = aws_cloudfront_field_level_encryption_profile.main[0].id
    }
  }

  query_arg_profile_config {
    forward_when_query_arg_profile_is_unknown = false
    
    query_arg_profiles {
      profile_id = aws_cloudfront_field_level_encryption_profile.main[0].id
      query_arg  = "sensitive"
    }
  }
}

resource "aws_cloudfront_field_level_encryption_profile" "main" {
  count = var.enable_field_level_encryption ? 1 : 0

  name    = "${var.project_name}-${var.environment}-field-level-encryption-profile"
  comment = "Field-level encryption profile for sensitive data"

  encryption_entities {
    public_key_id = aws_cloudfront_public_key.field_level_encryption[0].id
    provider_id   = aws_cloudfront_public_key.field_level_encryption[0].id

    field_patterns {
      items = [
        "password",
        "credit_card",
        "ssn",
        "email",
        "phone",
        "address",
        "sensitive_data"
      ]
    }
  }
}

# =============================================================================
# AWS CERTIFICATE MANAGER (ACM) FOR TLS
# =============================================================================

# Primary domain certificate
resource "aws_acm_certificate" "primary" {
  count = var.enable_transit_encryption ? 1 : 0

  domain_name               = "${var.environment}.${var.project_name}.com"
  subject_alternative_names = ["*.${var.environment}.${var.project_name}.com"]
  validation_method         = "DNS"

  options {
    certificate_transparency_logging_preference = "ENABLED"
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-primary-certificate"
    Purpose = "TransitEncryption"
  })
}

# API domain certificate
resource "aws_acm_certificate" "api" {
  count = var.enable_transit_encryption ? 1 : 0

  domain_name       = "api.${var.environment}.${var.project_name}.com"
  validation_method = "DNS"

  options {
    certificate_transparency_logging_preference = "ENABLED"
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-api-certificate"
    Purpose = "APITransitEncryption"
  })
}

# =============================================================================
# S3 BUCKET ENCRYPTION
# =============================================================================

# S3 bucket for encrypted storage
resource "aws_s3_bucket" "encrypted_storage" {
  count = var.enable_storage_encryption ? 1 : 0

  bucket = "${var.project_name}-${var.environment}-encrypted-storage"

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-encrypted-storage"
    Purpose = "EncryptedStorage"
  })
}

resource "aws_s3_bucket_server_side_encryption_configuration" "encrypted_storage" {
  count = var.enable_storage_encryption ? 1 : 0

  bucket = aws_s3_bucket.encrypted_storage[0].id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.encryption_keys["storage"].arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "encrypted_storage" {
  count = var.enable_storage_encryption ? 1 : 0

  bucket = aws_s3_bucket.encrypted_storage[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# =============================================================================
# RDS ENCRYPTION
# =============================================================================

# RDS parameter group for encryption
resource "aws_db_parameter_group" "encrypted" {
  count = var.enable_database_encryption ? 1 : 0

  family = "postgres14"
  name   = "${var.project_name}-${var.environment}-encrypted-params"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  tags = local.common_tags
}

# =============================================================================
# SECRETS MANAGER ENCRYPTION
# =============================================================================

# Encrypted secret for database credentials
resource "aws_secretsmanager_secret" "db_credentials" {
  name        = "${var.project_name}-${var.environment}-database-credentials"
  description = "Encrypted database credentials"
  kms_key_id  = aws_kms_key.encryption_keys["secrets"].arn

  replica {
    region     = "us-west-2"
    kms_key_id = aws_kms_key.encryption_keys["secrets"].arn
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-database-credentials"
    Purpose = "DatabaseCredentials"
  })
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = "admin"
    password = random_password.db_password.result
  })
}

resource "random_password" "db_password" {
  length  = 32
  special = true
}

# =============================================================================
# CLOUDWATCH LOGS ENCRYPTION
# =============================================================================

resource "aws_cloudwatch_log_group" "encrypted_logs" {
  name              = "/aws/lambda/${var.project_name}-${var.environment}-encrypted"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.encryption_keys["logs"].arn

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-encrypted-logs"
    Purpose = "EncryptedLogging"
  })
}

# =============================================================================
# EBS ENCRYPTION
# =============================================================================

# EBS encryption by default
resource "aws_ebs_encryption_by_default" "main" {
  enabled = var.enable_storage_encryption
}

resource "aws_ebs_default_kms_key" "main" {
  key_arn = aws_kms_key.encryption_keys["storage"].arn
}

# =============================================================================
# SNS ENCRYPTION
# =============================================================================

resource "aws_sns_topic" "encrypted_notifications" {
  name         = "${var.project_name}-${var.environment}-encrypted-notifications"
  kms_master_key_id = aws_kms_key.encryption_keys["primary"].arn

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-encrypted-notifications"
    Purpose = "EncryptedNotifications"
  })
}

# =============================================================================
# SQS ENCRYPTION
# =============================================================================

resource "aws_sqs_queue" "encrypted_queue" {
  name                              = "${var.project_name}-${var.environment}-encrypted-queue"
  kms_master_key_id                = aws_kms_key.encryption_keys["primary"].arn
  kms_data_key_reuse_period_seconds = 300

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-encrypted-queue"
    Purpose = "EncryptedMessaging"
  })
}

# =============================================================================
# ELASTICSEARCH/OPENSEARCH ENCRYPTION
# =============================================================================

resource "aws_opensearch_domain" "encrypted" {
  count = var.enable_storage_encryption ? 1 : 0

  domain_name    = "${var.project_name}-${var.environment}-encrypted-search"
  engine_version = "OpenSearch_1.3"

  cluster_config {
    instance_type = "t3.small.search"
  }

  domain_endpoint_options {
    enforce_https       = true
    tls_security_policy = "Policy-Min-TLS-1-2-2019-07"
  }

  encrypt_at_rest {
    enabled    = true
    kms_key_id = aws_kms_key.encryption_keys["storage"].arn
  }

  node_to_node_encryption {
    enabled = true
  }

  ebs_options {
    ebs_enabled = true
    volume_type = "gp3"
    volume_size = 20
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-encrypted-search"
    Purpose = "EncryptedSearch"
  })
}

# =============================================================================
# KINESIS ENCRYPTION
# =============================================================================

resource "aws_kinesis_stream" "encrypted" {
  count = var.enable_transit_encryption ? 1 : 0

  name        = "${var.project_name}-${var.environment}-encrypted-stream"
  shard_count = 1

  encryption_type = "KMS"
  kms_key_id      = aws_kms_key.encryption_keys["transit"].arn

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-encrypted-stream"
    Purpose = "EncryptedStreaming"
  })
}

# =============================================================================
# CLOUDFORMATION STACK FOR MONITORING
# =============================================================================

resource "aws_cloudformation_stack" "encryption_monitoring" {
  name = "${var.project_name}-${var.environment}-encryption-monitoring"

  template_body = jsonencode({
    AWSTemplateFormatVersion = "2010-09-09"
    Description = "Encryption monitoring stack"
    
    Resources = {
      EncryptionComplianceAlarm = {
        Type = "AWS::CloudWatch::Alarm"
        Properties = {
          AlarmName = "${var.project_name}-${var.environment}-encryption-compliance"
          AlarmDescription = "Monitor encryption compliance"
          MetricName = "NumberOfNonCompliantResources"
          Namespace = "AWS/Config"
          Statistic = "Sum"
          Period = 300
          EvaluationPeriods = 1
          Threshold = 0
          ComparisonOperator = "GreaterThanThreshold"
          TreatMissingData = "notBreaching"
        }
      }
    }
  })

  tags = local.common_tags
}

# =============================================================================
# OUTPUTS
# =============================================================================

output "encryption_keys" {
  description = "KMS encryption keys"
  value = {
    for key, config in local.all_encryption_keys : key => {
      key_id  = aws_kms_key.encryption_keys[key].key_id
      arn     = aws_kms_key.encryption_keys[key].arn
      alias   = aws_kms_alias.encryption_key_aliases[key].name
    }
  }
  sensitive = true
}

output "field_level_encryption" {
  description = "Field-level encryption configuration"
  value = var.enable_field_level_encryption ? {
    key_id = aws_kms_key.field_level_encryption[0].key_id
    public_key_id = aws_cloudfront_public_key.field_level_encryption[0].id
    config_id = aws_cloudfront_field_level_encryption_config.main[0].id
  } : null
  sensitive = true
}

output "certificates" {
  description = "TLS certificates"
  value = var.enable_transit_encryption ? {
    primary = aws_acm_certificate.primary[0].arn
    api     = aws_acm_certificate.api[0].arn
  } : null
}

output "encrypted_storage" {
  description = "Encrypted storage resources"
  value = var.enable_storage_encryption ? {
    s3_bucket = aws_s3_bucket.encrypted_storage[0].id
    opensearch_domain = aws_opensearch_domain.encrypted[0].domain_name
  } : null
}

output "encrypted_secrets" {
  description = "Encrypted secrets"
  value = {
    database_credentials = aws_secretsmanager_secret.db_credentials.arn
  }
  sensitive = true
}

output "encrypted_messaging" {
  description = "Encrypted messaging resources"
  value = {
    sns_topic = aws_sns_topic.encrypted_notifications.arn
    sqs_queue = aws_sqs_queue.encrypted_queue.url
    kinesis_stream = var.enable_transit_encryption ? aws_kinesis_stream.encrypted[0].name : null
  }
}

output "encryption_compliance" {
  description = "Encryption compliance status"
  value = {
    ebs_encryption_enabled = aws_ebs_encryption_by_default.main.enabled
    key_rotation_enabled = var.key_rotation_enabled
    field_level_encryption_enabled = var.enable_field_level_encryption
    transit_encryption_enabled = var.enable_transit_encryption
    storage_encryption_enabled = var.enable_storage_encryption
    database_encryption_enabled = var.enable_database_encryption
  }
}

output "encryption_config" {
  description = "Encryption configuration summary"
  value = {
    envelope_encryption = var.enable_envelope_encryption
    field_level_encryption = var.enable_field_level_encryption
    database_encryption = var.enable_database_encryption
    storage_encryption = var.enable_storage_encryption
    transit_encryption = var.enable_transit_encryption
    hsm_enabled = var.enable_hsm
    key_rotation_days = var.key_rotation_days
    total_keys_managed = length(local.all_encryption_keys)
  }
}