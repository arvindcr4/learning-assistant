# =============================================================================
# AUDIT LOGGING MODULE
# Comprehensive audit logging with tamper-proof storage
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

variable "enable_cloudtrail" {
  description = "Enable AWS CloudTrail"
  type        = bool
  default     = true
}

variable "enable_vpc_flow_logs" {
  description = "Enable VPC Flow Logs"
  type        = bool
  default     = true
}

variable "enable_application_logs" {
  description = "Enable application logs"
  type        = bool
  default     = true
}

variable "enable_security_logs" {
  description = "Enable security logs"
  type        = bool
  default     = true
}

variable "enable_compliance_logs" {
  description = "Enable compliance logs"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "Log retention period in days"
  type        = number
  default     = 365
}

variable "enable_log_encryption" {
  description = "Enable log encryption"
  type        = bool
  default     = true
}

variable "enable_log_integrity_monitoring" {
  description = "Enable log integrity monitoring"
  type        = bool
  default     = true
}

variable "enable_tamper_protection" {
  description = "Enable tamper protection for logs"
  type        = bool
  default     = true
}

variable "log_destinations" {
  description = "Log destination configuration"
  type = object({
    s3_bucket = object({
      name                   = string
      encryption_enabled     = bool
      versioning_enabled     = bool
      mfa_delete_enabled     = bool
      lifecycle_enabled      = bool
    })
    cloudwatch = object({
      name               = string
      retention_days     = number
      encryption_enabled = bool
    })
    elasticsearch = object({
      name               = string
      version            = string
      encryption_enabled = bool
    })
  })
  default = {
    s3_bucket = {
      name                   = ""
      encryption_enabled     = true
      versioning_enabled     = true
      mfa_delete_enabled     = true
      lifecycle_enabled      = true
    }
    cloudwatch = {
      name               = ""
      retention_days     = 365
      encryption_enabled = true
    }
    elasticsearch = {
      name               = ""
      version            = "7.10"
      encryption_enabled = true
    }
  }
}

variable "compliance_standards" {
  description = "Compliance standards to implement"
  type        = list(string)
  default     = ["SOC2", "GDPR", "HIPAA", "PCI-DSS"]
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
    Module = "audit-logging"
  })

  # Log categories and their configurations
  log_categories = {
    api_access = {
      name = "api-access"
      description = "API access logs"
      retention_days = var.log_retention_days
      level = "INFO"
    }
    authentication = {
      name = "authentication"
      description = "Authentication and authorization logs"
      retention_days = var.log_retention_days
      level = "INFO"
    }
    data_access = {
      name = "data-access"
      description = "Data access and modification logs"
      retention_days = var.log_retention_days * 2  # Keep longer for compliance
      level = "INFO"
    }
    security_events = {
      name = "security-events"
      description = "Security-related events and incidents"
      retention_days = var.log_retention_days * 3  # Keep even longer
      level = "WARN"
    }
    admin_actions = {
      name = "admin-actions"
      description = "Administrative actions and changes"
      retention_days = var.log_retention_days * 2
      level = "INFO"
    }
    compliance_events = {
      name = "compliance-events"
      description = "Compliance-related events"
      retention_days = 2555  # 7 years for compliance
      level = "INFO"
    }
    system_events = {
      name = "system-events"
      description = "System-level events and errors"
      retention_days = var.log_retention_days
      level = "ERROR"
    }
    performance_metrics = {
      name = "performance-metrics"
      description = "Performance and monitoring metrics"
      retention_days = 90
      level = "INFO"
    }
  }

  # CloudTrail event categories
  cloudtrail_event_categories = [
    "Data",
    "Management",
    "Insight"
  ]

  # Log shipping destinations
  log_shipping_config = {
    enable_s3 = true
    enable_elasticsearch = true
    enable_external_siem = var.environment == "prod"
    enable_compliance_archive = contains(var.compliance_standards, "SOC2") || contains(var.compliance_standards, "HIPAA")
  }

  # Tamper protection settings
  tamper_protection_config = {
    enable_object_lock = var.enable_tamper_protection
    enable_mfa_delete = var.enable_tamper_protection
    enable_cross_region_replication = var.enable_tamper_protection
    enable_blockchain_verification = var.environment == "prod" && var.enable_tamper_protection
  }
}

# =============================================================================
# DATA SOURCES
# =============================================================================

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# =============================================================================
# KMS KEY FOR LOG ENCRYPTION
# =============================================================================

resource "aws_kms_key" "log_encryption" {
  count = var.enable_log_encryption ? 1 : 0

  description              = "KMS key for audit log encryption"
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
        Sid    = "Allow CloudWatch Logs"
        Effect = "Allow"
        Principal = {
          Service = "logs.${var.region}.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow CloudTrail"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow S3"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
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
    Name = "${var.project_name}-${var.environment}-log-encryption-key"
    Purpose = "LogEncryption"
  })
}

resource "aws_kms_alias" "log_encryption" {
  count = var.enable_log_encryption ? 1 : 0

  name          = "alias/${var.project_name}-${var.environment}-log-encryption"
  target_key_id = aws_kms_key.log_encryption[0].key_id
}

# =============================================================================
# S3 BUCKET FOR AUDIT LOGS
# =============================================================================

resource "aws_s3_bucket" "audit_logs" {
  bucket = var.log_destinations.s3_bucket.name != "" ? var.log_destinations.s3_bucket.name : "${var.project_name}-${var.environment}-audit-logs"

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-audit-logs"
    Purpose = "AuditLogs"
    TamperProtected = tostring(var.enable_tamper_protection)
  })
}

# S3 bucket versioning
resource "aws_s3_bucket_versioning" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id
  
  versioning_configuration {
    status = var.log_destinations.s3_bucket.versioning_enabled ? "Enabled" : "Suspended"
  }
}

# S3 bucket encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = var.enable_log_encryption ? aws_kms_key.log_encryption[0].arn : null
      sse_algorithm     = var.enable_log_encryption ? "aws:kms" : "AES256"
    }
    bucket_key_enabled = var.enable_log_encryption
  }
}

# S3 bucket public access block
resource "aws_s3_bucket_public_access_block" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 bucket object lock for tamper protection
resource "aws_s3_bucket_object_lock_configuration" "audit_logs" {
  count = var.enable_tamper_protection ? 1 : 0

  bucket = aws_s3_bucket.audit_logs.id

  rule {
    default_retention {
      mode  = "GOVERNANCE"
      years = 7  # 7 years retention for compliance
    }
  }

  depends_on = [aws_s3_bucket_versioning.audit_logs]
}

# S3 bucket notification for log integrity monitoring
resource "aws_s3_bucket_notification" "audit_logs" {
  count = var.enable_log_integrity_monitoring ? 1 : 0

  bucket = aws_s3_bucket.audit_logs.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.log_integrity_monitor[0].arn
    events              = ["s3:ObjectCreated:*", "s3:ObjectRemoved:*"]
  }

  depends_on = [aws_lambda_permission.log_integrity_monitor]
}

# S3 bucket lifecycle configuration
resource "aws_s3_bucket_lifecycle_configuration" "audit_logs" {
  count = var.log_destinations.s3_bucket.lifecycle_enabled ? 1 : 0

  bucket = aws_s3_bucket.audit_logs.id

  rule {
    id     = "audit_log_lifecycle"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }

    expiration {
      days = var.log_retention_days * 2  # Extended retention in archive
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# Cross-region replication for tamper protection
resource "aws_s3_bucket_replication_configuration" "audit_logs" {
  count = local.tamper_protection_config.enable_cross_region_replication ? 1 : 0

  role   = aws_iam_role.replication[0].arn
  bucket = aws_s3_bucket.audit_logs.id

  rule {
    id     = "audit_log_replication"
    status = "Enabled"

    destination {
      bucket        = aws_s3_bucket.audit_logs_replica[0].arn
      storage_class = "STANDARD_IA"

      encryption_configuration {
        replica_kms_key_id = var.enable_log_encryption ? aws_kms_key.log_encryption[0].arn : null
      }
    }
  }

  depends_on = [aws_s3_bucket_versioning.audit_logs]
}

# Replica bucket for cross-region replication
resource "aws_s3_bucket" "audit_logs_replica" {
  count = local.tamper_protection_config.enable_cross_region_replication ? 1 : 0

  bucket   = "${var.project_name}-${var.environment}-audit-logs-replica"
  provider = aws.replica

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-audit-logs-replica"
    Purpose = "AuditLogsReplica"
  })
}

# IAM role for replication
resource "aws_iam_role" "replication" {
  count = local.tamper_protection_config.enable_cross_region_replication ? 1 : 0

  name = "${var.project_name}-${var.environment}-s3-replication-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

# =============================================================================
# CLOUDTRAIL
# =============================================================================

resource "aws_cloudtrail" "main" {
  count = var.enable_cloudtrail ? 1 : 0

  name           = "${var.project_name}-${var.environment}-cloudtrail"
  s3_bucket_name = aws_s3_bucket.audit_logs.bucket
  s3_key_prefix  = "cloudtrail/"

  include_global_service_events = true
  is_multi_region_trail         = true
  enable_logging                = true

  kms_key_id = var.enable_log_encryption ? aws_kms_key.log_encryption[0].arn : null

  # Data events for S3
  event_selector {
    read_write_type                 = "All"
    include_management_events       = true

    data_resource {
      type   = "AWS::S3::Object"
      values = ["${aws_s3_bucket.audit_logs.arn}/*"]
    }
  }

  # Insight events
  insight_selector {
    insight_type = "ApiCallRateInsight"
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-cloudtrail"
  })
}

# =============================================================================
# CLOUDWATCH LOG GROUPS
# =============================================================================

# CloudWatch log groups for different log categories
resource "aws_cloudwatch_log_group" "log_categories" {
  for_each = local.log_categories

  name              = "/aws/${var.project_name}/${var.environment}/${each.value.name}"
  retention_in_days = each.value.retention_days
  kms_key_id        = var.enable_log_encryption ? aws_kms_key.log_encryption[0].arn : null

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-${each.value.name}"
    LogCategory = each.key
    LogLevel = each.value.level
  })
}

# CloudWatch log group for VPC flow logs
resource "aws_cloudwatch_log_group" "vpc_flow_logs" {
  count = var.enable_vpc_flow_logs ? 1 : 0

  name              = "/aws/vpc/${var.project_name}-${var.environment}/flowlogs"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.enable_log_encryption ? aws_kms_key.log_encryption[0].arn : null

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-vpc-flow-logs"
    LogCategory = "network"
  })
}

# =============================================================================
# LOG SHIPPING TO ELASTICSEARCH
# =============================================================================

resource "aws_opensearch_domain" "audit_logs" {
  count = local.log_shipping_config.enable_elasticsearch ? 1 : 0

  domain_name    = var.log_destinations.elasticsearch.name != "" ? var.log_destinations.elasticsearch.name : "${var.project_name}-${var.environment}-audit-logs"
  engine_version = "OpenSearch_${var.log_destinations.elasticsearch.version}"

  cluster_config {
    instance_type            = "t3.small.search"
    instance_count           = 3
    dedicated_master_enabled = true
    master_instance_type     = "t3.small.search"
    master_instance_count    = 3
    zone_awareness_enabled   = true

    zone_awareness_config {
      availability_zone_count = 3
    }
  }

  domain_endpoint_options {
    enforce_https       = true
    tls_security_policy = "Policy-Min-TLS-1-2-2019-07"
  }

  encrypt_at_rest {
    enabled    = var.log_destinations.elasticsearch.encryption_enabled
    kms_key_id = var.enable_log_encryption ? aws_kms_key.log_encryption[0].arn : null
  }

  node_to_node_encryption {
    enabled = true
  }

  ebs_options {
    ebs_enabled = true
    volume_type = "gp3"
    volume_size = 100
  }

  vpc_options {
    subnet_ids         = data.aws_subnets.private.ids
    security_group_ids = [aws_security_group.elasticsearch[0].id]
  }

  access_policies = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "*"
        }
        Action   = "es:*"
        Resource = "arn:aws:es:${var.region}:${data.aws_caller_identity.current.account_id}:domain/${var.project_name}-${var.environment}-audit-logs/*"
        Condition = {
          IpAddress = {
            "aws:SourceIp" = [data.aws_vpc.main.cidr_block]
          }
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-audit-logs-search"
    Purpose = "AuditLogSearch"
  })
}

# Security group for Elasticsearch
resource "aws_security_group" "elasticsearch" {
  count = local.log_shipping_config.enable_elasticsearch ? 1 : 0

  name_prefix = "${var.project_name}-${var.environment}-elasticsearch-"
  vpc_id      = data.aws_vpc.main.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.main.cidr_block]
    description = "HTTPS from VPC"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-elasticsearch-sg"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# =============================================================================
# LOG INTEGRITY MONITORING
# =============================================================================

# Lambda function for log integrity monitoring
resource "aws_lambda_function" "log_integrity_monitor" {
  count = var.enable_log_integrity_monitoring ? 1 : 0

  filename         = "log_integrity_monitor.zip"
  function_name    = "${var.project_name}-${var.environment}-log-integrity-monitor"
  role            = aws_iam_role.log_integrity_monitor[0].arn
  handler         = "index.handler"
  runtime         = "python3.9"
  timeout         = 300

  environment {
    variables = {
      AUDIT_BUCKET    = aws_s3_bucket.audit_logs.bucket
      SNS_TOPIC_ARN   = aws_sns_topic.log_alerts.arn
      BLOCKCHAIN_ENABLED = tostring(local.tamper_protection_config.enable_blockchain_verification)
    }
  }

  tags = merge(local.common_tags, {
    Purpose = "LogIntegrityMonitoring"
  })
}

resource "aws_iam_role" "log_integrity_monitor" {
  count = var.enable_log_integrity_monitoring ? 1 : 0

  name = "${var.project_name}-${var.environment}-log-integrity-monitor-role"

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

resource "aws_iam_role_policy" "log_integrity_monitor" {
  count = var.enable_log_integrity_monitoring ? 1 : 0

  name = "${var.project_name}-${var.environment}-log-integrity-monitor-policy"
  role = aws_iam_role.log_integrity_monitor[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:PutObject",
          "s3:PutObjectAcl"
        ]
        Resource = [
          "${aws_s3_bucket.audit_logs.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.audit_logs.arn
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:Encrypt",
          "kms:GenerateDataKey"
        ]
        Resource = var.enable_log_encryption ? [aws_kms_key.log_encryption[0].arn] : []
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.log_alerts.arn
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_lambda_permission" "log_integrity_monitor" {
  count = var.enable_log_integrity_monitoring ? 1 : 0

  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.log_integrity_monitor[0].function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.audit_logs.arn
}

# =============================================================================
# LOG AGGREGATION AND CORRELATION
# =============================================================================

# Kinesis Data Firehose for log aggregation
resource "aws_kinesis_firehose_delivery_stream" "log_aggregation" {
  name        = "${var.project_name}-${var.environment}-log-aggregation"
  destination = "extended_s3"

  extended_s3_configuration {
    role_arn   = aws_iam_role.firehose.arn
    bucket_arn = aws_s3_bucket.audit_logs.arn
    prefix     = "aggregated-logs/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/hour=!{timestamp:HH}/"
    
    buffer_size     = 64
    buffer_interval = 60

    compression_format = "GZIP"

    data_format_conversion_configuration {
      enabled = true

      output_format_configuration {
        serializer {
          parquet_ser_de {}
        }
      }

      schema_database_configuration {
        database_name = aws_glue_catalog_database.audit_logs.name
      }
    }

    cloudwatch_logging_options {
      enabled         = true
      log_group_name  = aws_cloudwatch_log_group.log_categories["system_events"].name
      log_stream_name = "FirehoseDelivery"
    }
  }

  tags = local.common_tags
}

# IAM role for Firehose
resource "aws_iam_role" "firehose" {
  name = "${var.project_name}-${var.environment}-firehose-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "firehose.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

# Glue database for log schema
resource "aws_glue_catalog_database" "audit_logs" {
  name = "${var.project_name}_${var.environment}_audit_logs"

  description = "Audit logs database for ${var.project_name} ${var.environment}"

  tags = local.common_tags
}

# =============================================================================
# COMPLIANCE REPORTING
# =============================================================================

# Lambda function for compliance reporting
resource "aws_lambda_function" "compliance_reporter" {
  count = var.enable_compliance_logs ? 1 : 0

  filename         = "compliance_reporter.zip"
  function_name    = "${var.project_name}-${var.environment}-compliance-reporter"
  role            = aws_iam_role.compliance_reporter[0].arn
  handler         = "index.handler"
  runtime         = "python3.9"
  timeout         = 900

  environment {
    variables = {
      AUDIT_BUCKET       = aws_s3_bucket.audit_logs.bucket
      COMPLIANCE_STANDARDS = jsonencode(var.compliance_standards)
      OPENSEARCH_ENDPOINT = local.log_shipping_config.enable_elasticsearch ? aws_opensearch_domain.audit_logs[0].endpoint : ""
    }
  }

  tags = merge(local.common_tags, {
    Purpose = "ComplianceReporting"
  })
}

resource "aws_iam_role" "compliance_reporter" {
  count = var.enable_compliance_logs ? 1 : 0

  name = "${var.project_name}-${var.environment}-compliance-reporter-role"

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

# EventBridge rule for scheduled compliance reporting
resource "aws_cloudwatch_event_rule" "compliance_reporting" {
  count = var.enable_compliance_logs ? 1 : 0

  name                = "${var.project_name}-${var.environment}-compliance-reporting"
  description         = "Trigger compliance reporting"
  schedule_expression = "cron(0 6 * * MON)"  # Weekly on Monday at 6 AM

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "compliance_reporting" {
  count = var.enable_compliance_logs ? 1 : 0

  rule      = aws_cloudwatch_event_rule.compliance_reporting[0].name
  target_id = "ComplianceReportingTarget"
  arn       = aws_lambda_function.compliance_reporter[0].arn
}

# =============================================================================
# MONITORING AND ALERTING
# =============================================================================

# SNS topic for log alerts
resource "aws_sns_topic" "log_alerts" {
  name = "${var.project_name}-${var.environment}-log-alerts"

  tags = local.common_tags
}

# CloudWatch alarms for log monitoring
resource "aws_cloudwatch_metric_alarm" "log_ingestion_failure" {
  alarm_name          = "${var.project_name}-${var.environment}-log-ingestion-failure"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Logs"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "Log ingestion failures detected"
  alarm_actions       = [aws_sns_topic.log_alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "unusual_log_volume" {
  alarm_name          = "${var.project_name}-${var.environment}-unusual-log-volume"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "IncomingLogEvents"
  namespace           = "AWS/Logs"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10000"
  alarm_description   = "Unusual log volume detected"
  alarm_actions       = [aws_sns_topic.log_alerts.arn]

  tags = local.common_tags
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
# OUTPUTS
# =============================================================================

output "log_destinations" {
  description = "Log destination endpoints"
  value = {
    s3_bucket = aws_s3_bucket.audit_logs.bucket
    cloudwatch_log_groups = {
      for category, log_group in aws_cloudwatch_log_group.log_categories : category => log_group.name
    }
    elasticsearch_endpoint = local.log_shipping_config.enable_elasticsearch ? aws_opensearch_domain.audit_logs[0].endpoint : null
    firehose_delivery_stream = aws_kinesis_firehose_delivery_stream.log_aggregation.name
  }
}

output "cloudtrail" {
  description = "CloudTrail configuration"
  value = var.enable_cloudtrail ? {
    name = aws_cloudtrail.main[0].name
    arn  = aws_cloudtrail.main[0].arn
    s3_bucket = aws_cloudtrail.main[0].s3_bucket_name
  } : null
}

output "log_encryption" {
  description = "Log encryption configuration"
  value = var.enable_log_encryption ? {
    kms_key_id = aws_kms_key.log_encryption[0].key_id
    kms_key_arn = aws_kms_key.log_encryption[0].arn
    alias = aws_kms_alias.log_encryption[0].name
  } : null
  sensitive = true
}

output "tamper_protection" {
  description = "Tamper protection configuration"
  value = {
    object_lock_enabled = var.enable_tamper_protection
    mfa_delete_enabled = var.enable_tamper_protection
    cross_region_replication = local.tamper_protection_config.enable_cross_region_replication
    blockchain_verification = local.tamper_protection_config.enable_blockchain_verification
    replica_bucket = local.tamper_protection_config.enable_cross_region_replication ? aws_s3_bucket.audit_logs_replica[0].bucket : null
  }
}

output "monitoring" {
  description = "Log monitoring configuration"
  value = {
    log_alerts_topic = aws_sns_topic.log_alerts.arn
    integrity_monitor_function = var.enable_log_integrity_monitoring ? aws_lambda_function.log_integrity_monitor[0].function_name : null
    compliance_reporter_function = var.enable_compliance_logs ? aws_lambda_function.compliance_reporter[0].function_name : null
    glue_database = aws_glue_catalog_database.audit_logs.name
  }
}

output "log_categories" {
  description = "Configured log categories"
  value = {
    for category, config in local.log_categories : category => {
      log_group_name = aws_cloudwatch_log_group.log_categories[category].name
      retention_days = config.retention_days
      log_level = config.level
    }
  }
}

output "compliance_configuration" {
  description = "Compliance logging configuration"
  value = {
    standards_supported = var.compliance_standards
    compliance_logs_enabled = var.enable_compliance_logs
    retention_policy = {
      default_days = var.log_retention_days
      compliance_days = 2555  # 7 years
      data_access_days = var.log_retention_days * 2
      security_events_days = var.log_retention_days * 3
    }
  }
}

output "audit_logging_summary" {
  description = "Audit logging configuration summary"
  value = {
    cloudtrail_enabled = var.enable_cloudtrail
    vpc_flow_logs_enabled = var.enable_vpc_flow_logs
    application_logs_enabled = var.enable_application_logs
    security_logs_enabled = var.enable_security_logs
    compliance_logs_enabled = var.enable_compliance_logs
    encryption_enabled = var.enable_log_encryption
    tamper_protection_enabled = var.enable_tamper_protection
    integrity_monitoring_enabled = var.enable_log_integrity_monitoring
    log_categories_count = length(local.log_categories)
    retention_days = var.log_retention_days
    cross_region_replication = local.tamper_protection_config.enable_cross_region_replication
    elasticsearch_enabled = local.log_shipping_config.enable_elasticsearch
  }
}