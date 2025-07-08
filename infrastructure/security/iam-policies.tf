# =============================================================================
# IAM POLICIES AND ROLES - LEAST PRIVILEGE ACCESS
# Comprehensive Identity and Access Management
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

variable "enable_mfa_enforcement" {
  description = "Enforce MFA for all users"
  type        = bool
  default     = true
}

variable "enable_password_policy" {
  description = "Enable strong password policy"
  type        = bool
  default     = true
}

variable "enable_access_analyzer" {
  description = "Enable IAM Access Analyzer"
  type        = bool
  default     = true
}

variable "enable_privilege_escalation_monitor" {
  description = "Enable privilege escalation monitoring"
  type        = bool
  default     = true
}

variable "enable_unused_credentials_detection" {
  description = "Enable unused credentials detection"
  type        = bool
  default     = true
}

variable "enable_cross_account_monitoring" {
  description = "Enable cross-account access monitoring"
  type        = bool
  default     = true
}

variable "enable_service_account_rotation" {
  description = "Enable automatic service account key rotation"
  type        = bool
  default     = true
}

variable "enable_just_in_time_access" {
  description = "Enable just-in-time access"
  type        = bool
  default     = true
}

variable "enable_pam" {
  description = "Enable Privileged Access Management"
  type        = bool
  default     = true
}

variable "enable_identity_governance" {
  description = "Enable identity governance"
  type        = bool
  default     = true
}

variable "admin_roles" {
  description = "Administrative roles configuration"
  type = map(object({
    name                 = string
    policies            = list(string)
    max_session_duration = number
    require_mfa         = bool
  }))
  default = {}
}

variable "service_accounts" {
  description = "Service accounts configuration"
  type = map(object({
    name              = string
    policies          = list(string)
    key_rotation_days = number
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
    Module = "iam-security"
  })

  # Default admin roles
  default_admin_roles = {
    security_admin = {
      name                 = "SecurityAdministrator"
      policies            = [
        "arn:aws:iam::aws:policy/SecurityAudit",
        "arn:aws:iam::aws:policy/ReadOnlyAccess"
      ]
      max_session_duration = 3600
      require_mfa         = true
    }
    system_admin = {
      name                 = "SystemAdministrator"
      policies            = [
        "arn:aws:iam::aws:policy/PowerUserAccess"
      ]
      max_session_duration = 3600
      require_mfa         = true
    }
    compliance_admin = {
      name                 = "ComplianceAdministrator"
      policies            = [
        "arn:aws:iam::aws:policy/SecurityAudit",
        "arn:aws:iam::aws:policy/ReadOnlyAccess"
      ]
      max_session_duration = 7200
      require_mfa         = true
    }
    audit_admin = {
      name                 = "AuditAdministrator"
      policies            = [
        "arn:aws:iam::aws:policy/ReadOnlyAccess"
      ]
      max_session_duration = 14400
      require_mfa         = true
    }
  }

  # Default service accounts
  default_service_accounts = {
    application = {
      name              = "LearningAssistantApp"
      policies          = []
      key_rotation_days = 90
    }
    monitoring = {
      name              = "MonitoringService"
      policies          = []
      key_rotation_days = 90
    }
    backup = {
      name              = "BackupService"
      policies          = []
      key_rotation_days = 90
    }
    logging = {
      name              = "LoggingService"
      policies          = []
      key_rotation_days = 90
    }
  }

  # Merge user-defined with defaults
  all_admin_roles = merge(local.default_admin_roles, var.admin_roles)
  all_service_accounts = merge(local.default_service_accounts, var.service_accounts)

  # Sensitive resources that require extra protection
  sensitive_resources = [
    "arn:aws:iam::*:role/*Admin*",
    "arn:aws:iam::*:role/*Root*",
    "arn:aws:iam::*:user/*Admin*",
    "arn:aws:iam::*:policy/*Admin*",
    "arn:aws:kms:*:*:key/*",
    "arn:aws:secretsmanager:*:*:secret:*",
    "arn:aws:ssm:*:*:parameter/prod/*",
    "arn:aws:s3:::*-backup-*",
    "arn:aws:s3:::*-audit-*",
    "arn:aws:logs:*:*:log-group:/aws/cloudtrail/*"
  ]

  # High-privilege actions that require monitoring
  high_privilege_actions = [
    "iam:CreateRole",
    "iam:CreateUser",
    "iam:CreatePolicy",
    "iam:AttachRolePolicy",
    "iam:AttachUserPolicy",
    "iam:PutRolePolicy",
    "iam:PutUserPolicy",
    "iam:DeleteRole",
    "iam:DeleteUser",
    "iam:DeletePolicy",
    "kms:CreateKey",
    "kms:ScheduleKeyDeletion",
    "kms:DisableKey",
    "organizations:CreateAccount",
    "organizations:InviteAccountToOrganization",
    "sts:AssumeRole"
  ]
}

# =============================================================================
# DATA SOURCES
# =============================================================================

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# =============================================================================
# PASSWORD POLICY
# =============================================================================

resource "aws_iam_account_password_policy" "strict" {
  count = var.enable_password_policy ? 1 : 0

  minimum_password_length        = 14
  require_lowercase_characters   = true
  require_numbers               = true
  require_uppercase_characters   = true
  require_symbols               = true
  allow_users_to_change_password = true
  hard_expiry                   = false
  max_password_age              = 90
  password_reuse_prevention     = 24
}

# =============================================================================
# IAM ACCESS ANALYZER
# =============================================================================

resource "aws_accessanalyzer_analyzer" "main" {
  count = var.enable_access_analyzer ? 1 : 0

  analyzer_name = "${var.project_name}-${var.environment}-access-analyzer"
  type         = "ACCOUNT"

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-access-analyzer"
  })
}

# =============================================================================
# ADMINISTRATIVE ROLES
# =============================================================================

# Security Administrator Role
resource "aws_iam_role" "admin_roles" {
  for_each = local.all_admin_roles

  name                 = "${var.project_name}-${var.environment}-${each.value.name}"
  max_session_duration = each.value.max_session_duration

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action = "sts:AssumeRole"
        Condition = each.value.require_mfa ? {
          Bool = {
            "aws:MultiFactorAuthPresent" = "true"
          }
          NumericLessThan = {
            "aws:MultiFactorAuthAge" = "3600"
          }
        } : {}
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-${each.value.name}"
    RoleType = "Administrative"
    MFARequired = tostring(each.value.require_mfa)
  })
}

# Attach managed policies to admin roles
resource "aws_iam_role_policy_attachment" "admin_role_policies" {
  for_each = {
    for combo in flatten([
      for role_key, role_config in local.all_admin_roles : [
        for policy in role_config.policies : {
          role_key = role_key
          policy   = policy
          key      = "${role_key}-${replace(policy, ":", "-")}"
        }
      ]
    ]) : combo.key => combo
  }

  role       = aws_iam_role.admin_roles[each.value.role_key].name
  policy_arn = each.value.policy
}

# =============================================================================
# SERVICE ACCOUNT ROLES
# =============================================================================

# Service Account Roles
resource "aws_iam_role" "service_accounts" {
  for_each = local.all_service_accounts

  name = "${var.project_name}-${var.environment}-${each.value.name}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = [
            "lambda.amazonaws.com",
            "ecs-tasks.amazonaws.com",
            "ec2.amazonaws.com"
          ]
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-${each.value.name}"
    RoleType = "ServiceAccount"
    KeyRotationDays = tostring(each.value.key_rotation_days)
  })
}

# =============================================================================
# APPLICATION-SPECIFIC POLICIES
# =============================================================================

# Application Read-Only Policy
resource "aws_iam_policy" "application_readonly" {
  name        = "${var.project_name}-${var.environment}-application-readonly"
  description = "Read-only access for application components"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.project_name}-${var.environment}-*",
          "arn:aws:s3:::${var.project_name}-${var.environment}-*/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:${var.project_name}-${var.environment}-*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = [
          "arn:aws:kms:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:key/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = [
          "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${var.project_name}-${var.environment}-*"
        ]
      }
    ]
  })

  tags = local.common_tags
}

# Application Write Policy
resource "aws_iam_policy" "application_write" {
  name        = "${var.project_name}-${var.environment}-application-write"
  description = "Write access for application components"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:DeleteObject"
        ]
        Resource = [
          "arn:aws:s3:::${var.project_name}-${var.environment}-uploads/*",
          "arn:aws:s3:::${var.project_name}-${var.environment}-temp/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/${var.project_name}-${var.environment}-*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = [
          "arn:aws:sns:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:${var.project_name}-${var.environment}-*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          "arn:aws:sqs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:${var.project_name}-${var.environment}-*"
        ]
      }
    ]
  })

  tags = local.common_tags
}

# Database Access Policy
resource "aws_iam_policy" "database_access" {
  name        = "${var.project_name}-${var.environment}-database-access"
  description = "Database access for application"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "rds:DescribeDBInstances",
          "rds:DescribeDBClusters"
        ]
        Resource = [
          "arn:aws:rds:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:db:${var.project_name}-${var.environment}-*",
          "arn:aws:rds:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:cluster:${var.project_name}-${var.environment}-*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "rds-db:connect"
        ]
        Resource = [
          "arn:aws:rds-db:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:dbuser:*/app_user"
        ]
      }
    ]
  })

  tags = local.common_tags
}

# Monitoring Policy
resource "aws_iam_policy" "monitoring_access" {
  name        = "${var.project_name}-${var.environment}-monitoring-access"
  description = "Monitoring and metrics access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData",
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:ListMetrics"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "cloudwatch:namespace" = "${var.project_name}-${var.environment}"
          }
        }
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Resource = [
          "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${var.project_name}-${var.environment}-*",
          "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/ecs/${var.project_name}-${var.environment}-*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords"
        ]
        Resource = "*"
      }
    ]
  })

  tags = local.common_tags
}

# =============================================================================
# SECURITY MONITORING POLICIES
# =============================================================================

# Privilege Escalation Monitoring Policy
resource "aws_iam_policy" "privilege_escalation_monitor" {
  count = var.enable_privilege_escalation_monitor ? 1 : 0

  name        = "${var.project_name}-${var.environment}-privilege-escalation-monitor"
  description = "Monitor privilege escalation attempts"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Deny"
        Action = local.high_privilege_actions
        Resource = "*"
        Condition = {
          Bool = {
            "aws:MultiFactorAuthPresent" = "false"
          }
        }
      },
      {
        Effect = "Deny"
        Action = [
          "iam:CreateRole",
          "iam:AttachRolePolicy",
          "iam:PutRolePolicy"
        ]
        Resource = local.sensitive_resources
      }
    ]
  })

  tags = local.common_tags
}

# Cross-Account Access Monitoring Policy
resource "aws_iam_policy" "cross_account_monitor" {
  count = var.enable_cross_account_monitoring ? 1 : 0

  name        = "${var.project_name}-${var.environment}-cross-account-monitor"
  description = "Monitor cross-account access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Deny"
        Action = "sts:AssumeRole"
        Resource = "*"
        Condition = {
          StringNotEquals = {
            "aws:RequestedRegion" = [
              data.aws_region.current.name,
              "us-east-1",
              "us-west-2"
            ]
          }
        }
      },
      {
        Effect = "Deny"
        Action = "*"
        Resource = "*"
        Condition = {
          StringNotEquals = {
            "aws:PrincipalAccount" = data.aws_caller_identity.current.account_id
          }
          Bool = {
            "aws:ViaAWSService" = "false"
          }
        }
      }
    ]
  })

  tags = local.common_tags
}

# =============================================================================
# JUST-IN-TIME ACCESS
# =============================================================================

# JIT Access Role
resource "aws_iam_role" "jit_access" {
  count = var.enable_just_in_time_access ? 1 : 0

  name                 = "${var.project_name}-${var.environment}-jit-access"
  max_session_duration = 3600

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action = "sts:AssumeRole"
        Condition = {
          Bool = {
            "aws:MultiFactorAuthPresent" = "true"
          }
          DateGreaterThan = {
            "aws:TokenIssueTime" = "2023-01-01T00:00:00Z"
          }
          StringEquals = {
            "aws:RequestTag/JITRequest" = "approved"
          }
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-jit-access"
    RoleType = "JustInTime"
  })
}

# =============================================================================
# SERVICE CONTROL POLICIES (SCPs)
# =============================================================================

# Prevent privilege escalation
resource "aws_iam_policy" "prevent_privilege_escalation" {
  name        = "${var.project_name}-${var.environment}-prevent-privilege-escalation"
  description = "Prevent privilege escalation attempts"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "PreventPrivilegeEscalation"
        Effect = "Deny"
        Action = [
          "iam:CreateRole",
          "iam:CreateUser",
          "iam:CreatePolicy",
          "iam:AttachRolePolicy",
          "iam:AttachUserPolicy",
          "iam:PutRolePolicy",
          "iam:PutUserPolicy"
        ]
        Resource = "*"
        Condition = {
          Bool = {
            "aws:MultiFactorAuthPresent" = "false"
          }
        }
      },
      {
        Sid    = "PreventRootAccess"
        Effect = "Deny"
        Action = "*"
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:username" = "root"
          }
          Bool = {
            "aws:MultiFactorAuthPresent" = "false"
          }
        }
      },
      {
        Sid    = "RequireMFAForSensitiveActions"
        Effect = "Deny"
        Action = [
          "iam:DeleteRole",
          "iam:DeleteUser",
          "iam:DeletePolicy",
          "kms:ScheduleKeyDeletion",
          "organizations:LeaveOrganization"
        ]
        Resource = "*"
        Condition = {
          Bool = {
            "aws:MultiFactorAuthPresent" = "false"
          }
        }
      }
    ]
  })

  tags = local.common_tags
}

# =============================================================================
# IDENTITY GOVERNANCE
# =============================================================================

# Lambda function for identity governance
resource "aws_lambda_function" "identity_governance" {
  count = var.enable_identity_governance ? 1 : 0

  filename         = "identity_governance.zip"
  function_name    = "${var.project_name}-${var.environment}-identity-governance"
  role            = aws_iam_role.identity_governance_lambda[0].arn
  handler         = "index.handler"
  runtime         = "python3.9"
  timeout         = 300

  environment {
    variables = {
      PROJECT_NAME = var.project_name
      ENVIRONMENT  = var.environment
      REGION       = var.region
    }
  }

  tags = local.common_tags
}

resource "aws_iam_role" "identity_governance_lambda" {
  count = var.enable_identity_governance ? 1 : 0

  name = "${var.project_name}-${var.environment}-identity-governance-lambda"

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

# =============================================================================
# CLOUDWATCH ALARMS FOR IAM MONITORING
# =============================================================================

# Root account usage alarm
resource "aws_cloudwatch_metric_alarm" "root_account_usage" {
  alarm_name          = "${var.project_name}-${var.environment}-root-account-usage"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "1"
  metric_name         = "RootAccountUsage"
  namespace           = "CISBenchmark"
  period              = "60"
  statistic           = "Sum"
  threshold           = "1"
  alarm_description   = "Root account usage detected"
  alarm_actions       = [aws_sns_topic.security_alerts.arn]

  tags = local.common_tags
}

# IAM policy changes alarm
resource "aws_cloudwatch_metric_alarm" "iam_policy_changes" {
  alarm_name          = "${var.project_name}-${var.environment}-iam-policy-changes"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "1"
  metric_name         = "IAMPolicyChanges"
  namespace           = "CISBenchmark"
  period              = "300"
  statistic           = "Sum"
  threshold           = "1"
  alarm_description   = "IAM policy changes detected"
  alarm_actions       = [aws_sns_topic.security_alerts.arn]

  tags = local.common_tags
}

# =============================================================================
# SNS TOPIC FOR SECURITY ALERTS
# =============================================================================

resource "aws_sns_topic" "security_alerts" {
  name = "${var.project_name}-${var.environment}-security-alerts"

  tags = local.common_tags
}

# =============================================================================
# OUTPUTS
# =============================================================================

output "admin_roles" {
  description = "Administrative roles"
  value = {
    for key, role in aws_iam_role.admin_roles : key => {
      name = role.name
      arn  = role.arn
    }
  }
}

output "service_account_roles" {
  description = "Service account roles"
  value = {
    for key, role in aws_iam_role.service_accounts : key => {
      name = role.name
      arn  = role.arn
    }
  }
}

output "application_policies" {
  description = "Application-specific policies"
  value = {
    readonly    = aws_iam_policy.application_readonly.arn
    write       = aws_iam_policy.application_write.arn
    database    = aws_iam_policy.database_access.arn
    monitoring  = aws_iam_policy.monitoring_access.arn
  }
}

output "security_policies" {
  description = "Security monitoring policies"
  value = {
    privilege_escalation = var.enable_privilege_escalation_monitor ? aws_iam_policy.privilege_escalation_monitor[0].arn : null
    cross_account        = var.enable_cross_account_monitoring ? aws_iam_policy.cross_account_monitor[0].arn : null
    prevent_escalation   = aws_iam_policy.prevent_privilege_escalation.arn
  }
}

output "access_analyzer" {
  description = "IAM Access Analyzer"
  value = var.enable_access_analyzer ? {
    name = aws_accessanalyzer_analyzer.main[0].analyzer_name
    arn  = aws_accessanalyzer_analyzer.main[0].arn
  } : null
}

output "password_policy" {
  description = "Password policy configuration"
  value = var.enable_password_policy ? {
    minimum_length = aws_iam_account_password_policy.strict[0].minimum_password_length
    max_age        = aws_iam_account_password_policy.strict[0].max_password_age
    reuse_prevention = aws_iam_account_password_policy.strict[0].password_reuse_prevention
  } : null
}

output "jit_access_role" {
  description = "Just-in-time access role"
  value = var.enable_just_in_time_access ? {
    name = aws_iam_role.jit_access[0].name
    arn  = aws_iam_role.jit_access[0].arn
  } : null
}

output "security_alerts_topic" {
  description = "SNS topic for security alerts"
  value = aws_sns_topic.security_alerts.arn
}

output "identity_governance" {
  description = "Identity governance configuration"
  value = var.enable_identity_governance ? {
    lambda_function = aws_lambda_function.identity_governance[0].function_name
    lambda_role     = aws_iam_role.identity_governance_lambda[0].arn
  } : null
}

output "iam_security_summary" {
  description = "IAM security configuration summary"
  value = {
    mfa_enforced                    = var.enable_mfa_enforcement
    password_policy_enabled         = var.enable_password_policy
    access_analyzer_enabled         = var.enable_access_analyzer
    privilege_escalation_monitored  = var.enable_privilege_escalation_monitor
    unused_credentials_detected     = var.enable_unused_credentials_detection
    cross_account_monitored         = var.enable_cross_account_monitoring
    service_account_rotation        = var.enable_service_account_rotation
    jit_access_enabled             = var.enable_just_in_time_access
    pam_enabled                    = var.enable_pam
    identity_governance_enabled    = var.enable_identity_governance
    admin_roles_count              = length(local.all_admin_roles)
    service_accounts_count         = length(local.all_service_accounts)
  }
}