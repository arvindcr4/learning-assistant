# =============================================================================
# COMPLIANCE FRAMEWORKS MODULE
# SOC2, GDPR, HIPAA, PCI-DSS, ISO 27001 Implementation
# =============================================================================

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
  }
}

# =============================================================================
# VARIABLES
# =============================================================================

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "region" {
  description = "AWS region"
  type        = string
}

variable "compliance_standards" {
  description = "List of compliance standards to implement"
  type        = list(string)
  default     = ["SOC2", "GDPR", "HIPAA", "PCI-DSS", "ISO27001"]
}

variable "soc2_controls" {
  description = "SOC 2 controls to implement"
  type        = list(string)
  default     = []
}

variable "gdpr_requirements" {
  description = "GDPR requirements to implement"
  type        = list(string)
  default     = []
}

variable "hipaa_safeguards" {
  description = "HIPAA safeguards to implement"
  type        = list(string)
  default     = []
}

variable "pci_dss_requirements" {
  description = "PCI DSS requirements to implement"
  type        = list(string)
  default     = []
}

variable "enable_gdpr_data_mapping" {
  description = "Enable GDPR data mapping"
  type        = bool
  default     = true
}

variable "enable_gdpr_consent_management" {
  description = "Enable GDPR consent management"
  type        = bool
  default     = true
}

variable "enable_gdpr_breach_notification" {
  description = "Enable GDPR breach notification"
  type        = bool
  default     = true
}

variable "enable_hipaa_baa" {
  description = "Enable HIPAA Business Associate Agreement"
  type        = bool
  default     = true
}

variable "enable_hipaa_risk_assessment" {
  description = "Enable HIPAA risk assessment"
  type        = bool
  default     = true
}

variable "enable_pci_dss_scanning" {
  description = "Enable PCI DSS vulnerability scanning"
  type        = bool
  default     = true
}

variable "enable_pci_dss_monitoring" {
  description = "Enable PCI DSS monitoring"
  type        = bool
  default     = true
}

variable "enable_iso27001_isms" {
  description = "Enable ISO 27001 ISMS"
  type        = bool
  default     = true
}

variable "enable_iso27001_risk_management" {
  description = "Enable ISO 27001 risk management"
  type        = bool
  default     = true
}

variable "enable_compliance_dashboard" {
  description = "Enable compliance dashboard"
  type        = bool
  default     = true
}

variable "enable_compliance_reports" {
  description = "Enable compliance reports"
  type        = bool
  default     = true
}

variable "compliance_report_frequency" {
  description = "Compliance report frequency"
  type        = string
  default     = "weekly"
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
    Module = "compliance-frameworks"
  })

  # SOC 2 Trust Service Criteria mapping
  soc2_trust_criteria = {
    "CC1.1" = "Control Environment - Integrity and Ethical Values"
    "CC1.2" = "Control Environment - Board of Directors"
    "CC1.3" = "Control Environment - Management's Philosophy"
    "CC1.4" = "Control Environment - Organizational Structure"
    "CC1.5" = "Control Environment - Commitment to Competence"
    "CC2.1" = "Communication and Information - Internal Communication"
    "CC2.2" = "Communication and Information - External Communication"
    "CC2.3" = "Communication and Information - Quality of Information"
    "CC3.1" = "Risk Assessment - Specification of Objectives"
    "CC3.2" = "Risk Assessment - Identification of Risks"
    "CC3.3" = "Risk Assessment - Assessment of Fraud Risk"
    "CC3.4" = "Risk Assessment - Assessment of Significant Changes"
    "CC4.1" = "Monitoring Activities - Ongoing Monitoring"
    "CC4.2" = "Monitoring Activities - Separate Evaluations"
    "CC5.1" = "Control Activities - Selection and Development"
    "CC5.2" = "Control Activities - Technology General Controls"
    "CC5.3" = "Control Activities - Policies and Procedures"
    "CC6.1" = "Logical and Physical Access - Logical Access"
    "CC6.2" = "Logical and Physical Access - Physical Access"
    "CC6.3" = "Logical and Physical Access - Logical Access Controls"
    "CC6.4" = "Logical and Physical Access - Physical Access Controls"
    "CC6.5" = "Logical and Physical Access - Logical Access Removal"
    "CC6.6" = "Logical and Physical Access - Physical Access Removal"
    "CC6.7" = "Logical and Physical Access - System Access"
    "CC6.8" = "Logical and Physical Access - Data Classification"
    "CC7.1" = "System Operations - System Design"
    "CC7.2" = "System Operations - System Implementation"
    "CC7.3" = "System Operations - System Maintenance"
    "CC7.4" = "System Operations - System Monitoring"
    "CC7.5" = "System Operations - System Availability"
    "CC8.1" = "Change Management - System Changes"
  }

  # GDPR Articles mapping
  gdpr_articles = {
    "lawful_basis" = "Article 6 - Lawfulness of processing"
    "consent_management" = "Article 7 - Conditions for consent"
    "data_minimization" = "Article 5(1)(c) - Data minimization"
    "purpose_limitation" = "Article 5(1)(b) - Purpose limitation"
    "storage_limitation" = "Article 5(1)(e) - Storage limitation"
    "accuracy" = "Article 5(1)(d) - Accuracy"
    "integrity_confidentiality" = "Article 5(1)(f) - Integrity and confidentiality"
    "accountability" = "Article 5(2) - Accountability"
    "privacy_by_design" = "Article 25 - Data protection by design and by default"
    "data_protection_impact_assessment" = "Article 35 - Data protection impact assessment"
    "breach_notification" = "Article 33 - Notification of a personal data breach"
    "data_subject_rights" = "Articles 15-22 - Rights of the data subject"
  }

  # HIPAA Safeguards mapping
  hipaa_safeguards_map = {
    "access_control" = "164.312(a)(1) - Access Control"
    "audit_controls" = "164.312(b) - Audit Controls"
    "integrity" = "164.312(c)(1) - Integrity"
    "person_or_entity_authentication" = "164.312(d) - Person or Entity Authentication"
    "transmission_security" = "164.312(e)(1) - Transmission Security"
    "assigned_security_responsibility" = "164.308(a)(2) - Assigned Security Responsibility"
    "workforce_training" = "164.308(a)(5) - Workforce Training"
    "information_access_management" = "164.308(a)(4) - Information Access Management"
    "security_awareness" = "164.308(a)(5) - Security Awareness"
    "security_incident_procedures" = "164.308(a)(6) - Security Incident Procedures"
    "contingency_plan" = "164.308(a)(7) - Contingency Plan"
    "facility_access_controls" = "164.310(a)(1) - Facility Access Controls"
    "workstation_use" = "164.310(b) - Workstation Use"
    "device_and_media_controls" = "164.310(d)(1) - Device and Media Controls"
  }

  # PCI DSS Requirements mapping
  pci_dss_requirements_map = {
    "firewall_configuration" = "Requirement 1 - Install and maintain a firewall configuration"
    "vendor_defaults" = "Requirement 2 - Do not use vendor-supplied defaults"
    "cardholder_data_protection" = "Requirement 3 - Protect stored cardholder data"
    "encrypted_transmission" = "Requirement 4 - Encrypt transmission of cardholder data"
    "antivirus_software" = "Requirement 5 - Protect all systems against malware"
    "secure_systems" = "Requirement 6 - Develop and maintain secure systems"
    "access_control_measures" = "Requirement 7 - Restrict access to cardholder data"
    "unique_ids" = "Requirement 8 - Identify and authenticate access to system components"
    "physical_access" = "Requirement 9 - Restrict physical access to cardholder data"
    "network_monitoring" = "Requirement 10 - Track and monitor all access to network resources"
    "regular_testing" = "Requirement 11 - Regularly test security systems and processes"
    "information_security_policy" = "Requirement 12 - Maintain a policy that addresses information security"
  }
}

# =============================================================================
# SOC 2 COMPLIANCE
# =============================================================================

resource "aws_config_configuration_recorder" "soc2_recorder" {
  count = contains(var.compliance_standards, "SOC2") ? 1 : 0
  
  name     = "${var.project_name}-${var.environment}-soc2-recorder"
  role_arn = aws_iam_role.config_role[0].arn

  recording_group {
    all_supported                 = true
    include_global_resource_types = true
  }

  depends_on = [aws_s3_bucket_public_access_block.config_bucket]
}

resource "aws_config_delivery_channel" "soc2_delivery" {
  count = contains(var.compliance_standards, "SOC2") ? 1 : 0
  
  name           = "${var.project_name}-${var.environment}-soc2-delivery"
  s3_bucket_name = aws_s3_bucket.config_bucket[0].id
  depends_on     = [aws_s3_bucket_policy.config_bucket_policy]
}

# SOC 2 Config Rules
resource "aws_config_config_rule" "soc2_rules" {
  for_each = contains(var.compliance_standards, "SOC2") ? toset([
    "root-access-key-check",
    "iam-password-policy",
    "iam-user-mfa-enabled",
    "encrypted-volumes",
    "s3-bucket-ssl-requests-only",
    "cloudtrail-enabled",
    "guardduty-enabled-centralized",
    "vpc-flow-logs-enabled",
    "securityhub-enabled",
    "access-keys-rotated"
  ]) : toset([])

  name = "${var.project_name}-${var.environment}-soc2-${each.value}"

  source {
    owner             = "AWS"
    source_identifier = upper(replace(each.value, "-", "_"))
  }

  depends_on = [aws_config_configuration_recorder.soc2_recorder]

  tags = local.common_tags
}

# =============================================================================
# GDPR COMPLIANCE
# =============================================================================

# Data mapping and inventory
resource "aws_s3_bucket" "gdpr_data_inventory" {
  count = contains(var.compliance_standards, "GDPR") ? 1 : 0
  
  bucket = "${var.project_name}-${var.environment}-gdpr-inventory"
  
  tags = merge(local.common_tags, {
    Purpose = "GDPR Data Inventory"
    DataClassification = "Confidential"
  })
}

resource "aws_s3_bucket_versioning" "gdpr_data_inventory_versioning" {
  count = contains(var.compliance_standards, "GDPR") ? 1 : 0
  
  bucket = aws_s3_bucket.gdpr_data_inventory[0].id
  
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "gdpr_data_inventory_encryption" {
  count = contains(var.compliance_standards, "GDPR") ? 1 : 0
  
  bucket = aws_s3_bucket.gdpr_data_inventory[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# GDPR Consent Management
resource "aws_dynamodb_table" "gdpr_consent_records" {
  count = contains(var.compliance_standards, "GDPR") && var.enable_gdpr_consent_management ? 1 : 0
  
  name           = "${var.project_name}-${var.environment}-gdpr-consent"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "user_id"
  range_key      = "consent_timestamp"

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "consent_timestamp"
    type = "S"
  }

  attribute {
    name = "consent_type"
    type = "S"
  }

  global_secondary_index {
    name            = "ConsentTypeIndex"
    hash_key        = "consent_type"
    range_key       = "consent_timestamp"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(local.common_tags, {
    Purpose = "GDPR Consent Management"
    DataClassification = "Personal Data"
  })
}

# GDPR Breach Notification System
resource "aws_sns_topic" "gdpr_breach_notification" {
  count = contains(var.compliance_standards, "GDPR") && var.enable_gdpr_breach_notification ? 1 : 0
  
  name = "${var.project_name}-${var.environment}-gdpr-breach-notification"
  
  tags = merge(local.common_tags, {
    Purpose = "GDPR Breach Notification"
  })
}

resource "aws_lambda_function" "gdpr_breach_processor" {
  count = contains(var.compliance_standards, "GDPR") && var.enable_gdpr_breach_notification ? 1 : 0
  
  filename         = "gdpr_breach_processor.zip"
  function_name    = "${var.project_name}-${var.environment}-gdpr-breach-processor"
  role            = aws_iam_role.lambda_role[0].arn
  handler         = "index.handler"
  runtime         = "python3.9"
  timeout         = 300

  environment {
    variables = {
      SNS_TOPIC_ARN = aws_sns_topic.gdpr_breach_notification[0].arn
      BREACH_THRESHOLD = "72" # Hours for GDPR notification
    }
  }

  tags = local.common_tags
}

# =============================================================================
# HIPAA COMPLIANCE
# =============================================================================

# HIPAA Audit Log
resource "aws_cloudwatch_log_group" "hipaa_audit_log" {
  count = contains(var.compliance_standards, "HIPAA") ? 1 : 0
  
  name              = "/aws/hipaa/${var.project_name}/${var.environment}/audit"
  retention_in_days = 2555 # 7 years for HIPAA
  
  tags = merge(local.common_tags, {
    Purpose = "HIPAA Audit Logging"
    Compliance = "HIPAA"
  })
}

# HIPAA Risk Assessment
resource "aws_s3_bucket" "hipaa_risk_assessment" {
  count = contains(var.compliance_standards, "HIPAA") && var.enable_hipaa_risk_assessment ? 1 : 0
  
  bucket = "${var.project_name}-${var.environment}-hipaa-risk-assessment"
  
  tags = merge(local.common_tags, {
    Purpose = "HIPAA Risk Assessment"
    Compliance = "HIPAA"
  })
}

# HIPAA Business Associate Agreement tracking
resource "aws_dynamodb_table" "hipaa_baa_tracking" {
  count = contains(var.compliance_standards, "HIPAA") && var.enable_hipaa_baa ? 1 : 0
  
  name           = "${var.project_name}-${var.environment}-hipaa-baa"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "vendor_id"

  attribute {
    name = "vendor_id"
    type = "S"
  }

  attribute {
    name = "baa_status"
    type = "S"
  }

  attribute {
    name = "expiration_date"
    type = "S"
  }

  global_secondary_index {
    name            = "BAAStatusIndex"
    hash_key        = "baa_status"
    range_key       = "expiration_date"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(local.common_tags, {
    Purpose = "HIPAA BAA Tracking"
    Compliance = "HIPAA"
  })
}

# =============================================================================
# PCI DSS COMPLIANCE
# =============================================================================

# PCI DSS Vulnerability Scanning
resource "aws_inspector_assessment_template" "pci_dss_assessment" {
  count = contains(var.compliance_standards, "PCI-DSS") && var.enable_pci_dss_scanning ? 1 : 0
  
  name       = "${var.project_name}-${var.environment}-pci-dss-assessment"
  target_arn = aws_inspector_assessment_target.pci_dss_target[0].arn
  duration   = 3600

  rules_package_arns = [
    "arn:aws:inspector:${var.region}:316112463485:rulespackage/0-R01qwB5Q", # Security Best Practices
    "arn:aws:inspector:${var.region}:316112463485:rulespackage/0-gEjTy7T7", # Network Reachability
    "arn:aws:inspector:${var.region}:316112463485:rulespackage/0-rExsr2X8", # Runtime Behavior Analysis
    "arn:aws:inspector:${var.region}:316112463485:rulespackage/0-gBONHN9h"  # Common Vulnerabilities and Exposures
  ]

  tags = local.common_tags
}

resource "aws_inspector_assessment_target" "pci_dss_target" {
  count = contains(var.compliance_standards, "PCI-DSS") && var.enable_pci_dss_scanning ? 1 : 0
  
  name = "${var.project_name}-${var.environment}-pci-dss-target"
  
  resource_group_arn = aws_inspector_resource_group.pci_dss_resource_group[0].arn
}

resource "aws_inspector_resource_group" "pci_dss_resource_group" {
  count = contains(var.compliance_standards, "PCI-DSS") && var.enable_pci_dss_scanning ? 1 : 0
  
  tags = merge(local.common_tags, {
    PCIScope = "true"
  })
}

# PCI DSS Cardholder Data Environment (CDE) monitoring
resource "aws_cloudwatch_log_group" "pci_dss_cde_monitoring" {
  count = contains(var.compliance_standards, "PCI-DSS") && var.enable_pci_dss_monitoring ? 1 : 0
  
  name              = "/aws/pci-dss/${var.project_name}/${var.environment}/cde"
  retention_in_days = 365 # 1 year minimum for PCI DSS
  
  tags = merge(local.common_tags, {
    Purpose = "PCI DSS CDE Monitoring"
    Compliance = "PCI-DSS"
  })
}

# =============================================================================
# ISO 27001 COMPLIANCE
# =============================================================================

# ISO 27001 Information Security Management System (ISMS)
resource "aws_s3_bucket" "iso27001_isms" {
  count = contains(var.compliance_standards, "ISO27001") && var.enable_iso27001_isms ? 1 : 0
  
  bucket = "${var.project_name}-${var.environment}-iso27001-isms"
  
  tags = merge(local.common_tags, {
    Purpose = "ISO 27001 ISMS"
    Compliance = "ISO27001"
  })
}

# ISO 27001 Risk Management
resource "aws_dynamodb_table" "iso27001_risk_register" {
  count = contains(var.compliance_standards, "ISO27001") && var.enable_iso27001_risk_management ? 1 : 0
  
  name           = "${var.project_name}-${var.environment}-iso27001-risk-register"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "risk_id"

  attribute {
    name = "risk_id"
    type = "S"
  }

  attribute {
    name = "risk_level"
    type = "S"
  }

  attribute {
    name = "risk_status"
    type = "S"
  }

  global_secondary_index {
    name            = "RiskLevelIndex"
    hash_key        = "risk_level"
    range_key       = "risk_id"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "RiskStatusIndex"
    hash_key        = "risk_status"
    range_key       = "risk_id"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(local.common_tags, {
    Purpose = "ISO 27001 Risk Register"
    Compliance = "ISO27001"
  })
}

# =============================================================================
# SHARED COMPLIANCE INFRASTRUCTURE
# =============================================================================

# Config bucket for compliance logging
resource "aws_s3_bucket" "config_bucket" {
  count = length(var.compliance_standards) > 0 ? 1 : 0
  
  bucket = "${var.project_name}-${var.environment}-compliance-config"
  
  tags = merge(local.common_tags, {
    Purpose = "Compliance Configuration"
  })
}

resource "aws_s3_bucket_public_access_block" "config_bucket" {
  count = length(var.compliance_standards) > 0 ? 1 : 0
  
  bucket = aws_s3_bucket.config_bucket[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "config_bucket" {
  count = length(var.compliance_standards) > 0 ? 1 : 0
  
  bucket = aws_s3_bucket.config_bucket[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "config_bucket" {
  count = length(var.compliance_standards) > 0 ? 1 : 0
  
  bucket = aws_s3_bucket.config_bucket[0].id
  
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_policy" "config_bucket_policy" {
  count = length(var.compliance_standards) > 0 ? 1 : 0
  
  bucket = aws_s3_bucket.config_bucket[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AWSConfigBucketPermissionsCheck"
        Effect = "Allow"
        Principal = {
          Service = "config.amazonaws.com"
        }
        Action   = "s3:GetBucketAcl"
        Resource = aws_s3_bucket.config_bucket[0].arn
      },
      {
        Sid    = "AWSConfigBucketExistenceCheck"
        Effect = "Allow"
        Principal = {
          Service = "config.amazonaws.com"
        }
        Action   = "s3:ListBucket"
        Resource = aws_s3_bucket.config_bucket[0].arn
      },
      {
        Sid    = "AWSConfigBucketDelivery"
        Effect = "Allow"
        Principal = {
          Service = "config.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.config_bucket[0].arn}/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl" = "bucket-owner-full-control"
          }
        }
      }
    ]
  })
}

# IAM Role for Config
resource "aws_iam_role" "config_role" {
  count = length(var.compliance_standards) > 0 ? 1 : 0
  
  name = "${var.project_name}-${var.environment}-config-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "config.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "config_role_policy" {
  count = length(var.compliance_standards) > 0 ? 1 : 0
  
  role       = aws_iam_role.config_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/ConfigRole"
}

# IAM Role for Lambda functions
resource "aws_iam_role" "lambda_role" {
  count = length(var.compliance_standards) > 0 ? 1 : 0
  
  name = "${var.project_name}-${var.environment}-compliance-lambda-role"

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

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  count = length(var.compliance_standards) > 0 ? 1 : 0
  
  role       = aws_iam_role.lambda_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Compliance Dashboard
resource "aws_cloudwatch_dashboard" "compliance_dashboard" {
  count = var.enable_compliance_dashboard ? 1 : 0
  
  dashboard_name = "${var.project_name}-${var.environment}-compliance-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/Config", "ComplianceByConfigRule", "ConfigRuleName", "root-access-key-check"],
            ["AWS/Config", "ComplianceByConfigRule", "ConfigRuleName", "iam-password-policy"],
            ["AWS/Config", "ComplianceByConfigRule", "ConfigRuleName", "encrypted-volumes"]
          ]
          period = 300
          stat   = "Average"
          region = var.region
          title  = "Compliance Status"
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          query = "SOURCE '/aws/config/configuration-history' | fields @timestamp, resourceType, configurationItemStatus\n| filter configurationItemStatus = \"NON_COMPLIANT\"\n| stats count() by resourceType"
          region = var.region
          title  = "Non-Compliant Resources"
        }
      }
    ]
  })

  tags = local.common_tags
}

# =============================================================================
# OUTPUTS
# =============================================================================

output "compliance_status" {
  description = "Compliance framework status"
  value = {
    standards_enabled = var.compliance_standards
    soc2_enabled = contains(var.compliance_standards, "SOC2")
    gdpr_enabled = contains(var.compliance_standards, "GDPR")
    hipaa_enabled = contains(var.compliance_standards, "HIPAA")
    pci_dss_enabled = contains(var.compliance_standards, "PCI-DSS")
    iso27001_enabled = contains(var.compliance_standards, "ISO27001")
    dashboard_enabled = var.enable_compliance_dashboard
    reports_enabled = var.enable_compliance_reports
  }
}

output "compliance_resources" {
  description = "Compliance resources created"
  value = {
    config_bucket = length(var.compliance_standards) > 0 ? aws_s3_bucket.config_bucket[0].id : null
    gdpr_consent_table = contains(var.compliance_standards, "GDPR") && var.enable_gdpr_consent_management ? aws_dynamodb_table.gdpr_consent_records[0].name : null
    hipaa_baa_table = contains(var.compliance_standards, "HIPAA") && var.enable_hipaa_baa ? aws_dynamodb_table.hipaa_baa_tracking[0].name : null
    iso27001_risk_register = contains(var.compliance_standards, "ISO27001") && var.enable_iso27001_risk_management ? aws_dynamodb_table.iso27001_risk_register[0].name : null
    dashboard_url = var.enable_compliance_dashboard ? "https://console.aws.amazon.com/cloudwatch/home?region=${var.region}#dashboards:name=${aws_cloudwatch_dashboard.compliance_dashboard[0].dashboard_name}" : null
  }
}

output "compliance_controls" {
  description = "Compliance controls implemented"
  value = {
    soc2_controls = var.soc2_controls
    gdpr_requirements = var.gdpr_requirements
    hipaa_safeguards = var.hipaa_safeguards
    pci_dss_requirements = var.pci_dss_requirements
  }
}

output "compliance_contact_info" {
  description = "Compliance contact information"
  value = {
    gdpr_breach_notification = contains(var.compliance_standards, "GDPR") && var.enable_gdpr_breach_notification ? aws_sns_topic.gdpr_breach_notification[0].arn : null
    hipaa_audit_log = contains(var.compliance_standards, "HIPAA") ? aws_cloudwatch_log_group.hipaa_audit_log[0].name : null
    pci_dss_monitoring = contains(var.compliance_standards, "PCI-DSS") && var.enable_pci_dss_monitoring ? aws_cloudwatch_log_group.pci_dss_cde_monitoring[0].name : null
  }
}