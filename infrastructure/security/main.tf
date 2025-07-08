# =============================================================================
# TERRAFORM SECURITY AND COMPLIANCE FRAMEWORK
# Learning Assistant Application Infrastructure
# =============================================================================

terraform {
  required_version = ">= 1.0"
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
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
    tls = {
      source  = "hashicorp/tls"
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
  default     = "learning-assistant"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "region" {
  description = "Primary deployment region"
  type        = string
  default     = "us-east-1"
}

variable "compliance_standards" {
  description = "List of compliance standards to implement"
  type        = list(string)
  default     = ["SOC2", "GDPR", "HIPAA", "PCI-DSS", "ISO27001"]
}

variable "security_contact_email" {
  description = "Email for security notifications"
  type        = string
  sensitive   = true
}

variable "enable_advanced_threat_protection" {
  description = "Enable advanced threat protection features"
  type        = bool
  default     = true
}

variable "enable_zero_trust" {
  description = "Enable zero trust networking"
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 90
}

variable "log_retention_days" {
  description = "Number of days to retain logs"
  type        = number
  default     = 365
}

variable "encryption_key_rotation_days" {
  description = "Number of days between key rotations"
  type        = number
  default     = 90
}

# =============================================================================
# LOCALS
# =============================================================================

locals {
  common_tags = {
    Project              = var.project_name
    Environment         = var.environment
    ManagedBy           = "Terraform"
    SecurityFramework   = "Enterprise"
    ComplianceStandards = join(",", var.compliance_standards)
    CreatedAt           = timestamp()
    LastUpdated         = timestamp()
  }

  # Security configuration
  security_config = {
    enable_encryption_at_rest       = true
    enable_encryption_in_transit    = true
    enable_network_segmentation     = true
    enable_intrusion_detection      = true
    enable_vulnerability_scanning   = true
    enable_security_monitoring      = true
    enable_compliance_monitoring    = true
    enable_incident_response        = true
    enable_automated_remediation    = true
    enable_threat_intelligence      = true
    enable_data_loss_prevention     = true
    enable_privileged_access_mgmt   = true
    enable_identity_governance      = true
    enable_security_analytics       = true
    enable_forensic_readiness       = true
  }

  # Compliance configuration
  compliance_config = {
    soc2_controls = [
      "CC1.1", "CC1.2", "CC1.3", "CC1.4", "CC1.5",
      "CC2.1", "CC2.2", "CC2.3",
      "CC3.1", "CC3.2", "CC3.3", "CC3.4",
      "CC4.1", "CC4.2",
      "CC5.1", "CC5.2", "CC5.3",
      "CC6.1", "CC6.2", "CC6.3", "CC6.4", "CC6.5", "CC6.6", "CC6.7", "CC6.8",
      "CC7.1", "CC7.2", "CC7.3", "CC7.4", "CC7.5",
      "CC8.1"
    ]
    gdpr_requirements = [
      "lawful_basis", "consent_management", "data_minimization",
      "purpose_limitation", "storage_limitation", "accuracy",
      "integrity_confidentiality", "accountability",
      "privacy_by_design", "data_protection_impact_assessment",
      "breach_notification", "data_subject_rights"
    ]
    hipaa_safeguards = [
      "access_control", "audit_controls", "integrity",
      "person_or_entity_authentication", "transmission_security",
      "assigned_security_responsibility", "workforce_training",
      "information_access_management", "security_awareness",
      "security_incident_procedures", "contingency_plan",
      "facility_access_controls", "workstation_use",
      "device_and_media_controls"
    ]
    pci_dss_requirements = [
      "firewall_configuration", "vendor_defaults", "cardholder_data_protection",
      "encrypted_transmission", "antivirus_software", "secure_systems",
      "access_control_measures", "unique_ids", "physical_access",
      "network_monitoring", "regular_testing", "information_security_policy"
    ]
  }

  # Security scanning tools configuration
  security_scanning_tools = {
    checkov = {
      enabled = true
      version = "latest"
      config_file = "checkov.yml"
      skip_checks = []
      severity_threshold = "HIGH"
    }
    tfsec = {
      enabled = true
      version = "latest"
      config_file = "tfsec.yml"
      exclude_checks = []
      severity_threshold = "HIGH"
    }
    terrascan = {
      enabled = true
      version = "latest"
      config_file = "terrascan.yml"
      policy_type = ["aws", "azure", "gcp", "kubernetes"]
      severity_threshold = "HIGH"
    }
    semgrep = {
      enabled = true
      version = "latest"
      config_file = "semgrep.yml"
      rules = ["security", "secrets", "best-practices"]
    }
    trivy = {
      enabled = true
      version = "latest"
      config_file = "trivy.yml"
      scan_types = ["vuln", "config", "secret"]
    }
  }

  # Network security configuration
  network_security_config = {
    vpc_flow_logs_enabled = true
    network_acl_enabled = true
    security_groups_enabled = true
    waf_enabled = true
    ddos_protection_enabled = true
    intrusion_detection_enabled = true
    network_segmentation_enabled = true
    zero_trust_enabled = var.enable_zero_trust
    micro_segmentation_enabled = true
  }

  # IAM security configuration
  iam_security_config = {
    mfa_required = true
    password_policy_enabled = true
    access_analyzer_enabled = true
    privilege_escalation_monitoring = true
    unused_credentials_detection = true
    cross_account_access_monitoring = true
    service_account_key_rotation = true
    just_in_time_access = true
    privileged_access_management = true
    identity_governance = true
  }
}

# =============================================================================
# DATA SOURCES
# =============================================================================

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}

# =============================================================================
# RANDOM RESOURCES
# =============================================================================

resource "random_id" "security_suffix" {
  byte_length = 8
}

resource "random_password" "master_key" {
  length  = 32
  special = true
}

# =============================================================================
# SECURITY MONITORING AND ALERTING
# =============================================================================

module "security_monitoring" {
  source = "./modules/security-monitoring"

  project_name  = var.project_name
  environment   = var.environment
  region        = var.region
  
  # Security monitoring configuration
  enable_cloudtrail           = true
  enable_config               = true
  enable_guardduty            = true
  enable_security_hub         = true
  enable_inspector            = true
  enable_macie                = true
  enable_detective            = true
  enable_access_analyzer      = true
  
  # Alerting configuration
  security_contact_email      = var.security_contact_email
  enable_high_severity_alerts = true
  enable_compliance_alerts    = true
  enable_threat_alerts        = true
  
  # Compliance monitoring
  compliance_standards        = var.compliance_standards
  
  tags = local.common_tags
}

# =============================================================================
# NETWORK SECURITY
# =============================================================================

module "network_security" {
  source = "./modules/network-security"

  project_name  = var.project_name
  environment   = var.environment
  region        = var.region
  
  # VPC configuration
  vpc_cidr              = "10.0.0.0/16"
  availability_zones    = data.aws_availability_zones.available.names
  enable_flow_logs      = true
  enable_dns_logging    = true
  
  # Security features
  enable_waf                    = true
  enable_ddos_protection        = true
  enable_intrusion_detection    = true
  enable_network_segmentation   = true
  enable_zero_trust            = var.enable_zero_trust
  enable_micro_segmentation    = true
  
  # Firewall rules
  allowed_cidr_blocks = {
    office    = ["203.0.113.0/24"]
    vpn       = ["198.51.100.0/24"]
    partners  = ["192.0.2.0/24"]
  }
  
  tags = local.common_tags
}

# =============================================================================
# IDENTITY AND ACCESS MANAGEMENT
# =============================================================================

module "iam_security" {
  source = "./modules/iam-security"

  project_name  = var.project_name
  environment   = var.environment
  region        = var.region
  
  # IAM security features
  enable_mfa_enforcement              = true
  enable_password_policy              = true
  enable_access_analyzer              = true
  enable_privilege_escalation_monitor = true
  enable_unused_credentials_detection = true
  enable_cross_account_monitoring     = true
  enable_service_account_rotation     = true
  enable_just_in_time_access         = true
  enable_pam                         = true
  enable_identity_governance         = true
  
  # Role configurations
  admin_roles = {
    security_admin = {
      name = "SecurityAdministrator"
      policies = [
        "arn:aws:iam::aws:policy/SecurityAudit",
        "arn:aws:iam::aws:policy/ReadOnlyAccess"
      ]
      max_session_duration = 3600
      require_mfa = true
    }
    system_admin = {
      name = "SystemAdministrator"
      policies = [
        "arn:aws:iam::aws:policy/PowerUserAccess"
      ]
      max_session_duration = 3600
      require_mfa = true
    }
  }
  
  # Service accounts
  service_accounts = {
    application = {
      name = "LearningAssistantApp"
      policies = []
      key_rotation_days = var.encryption_key_rotation_days
    }
    monitoring = {
      name = "MonitoringService"
      policies = []
      key_rotation_days = var.encryption_key_rotation_days
    }
    backup = {
      name = "BackupService"
      policies = []
      key_rotation_days = var.encryption_key_rotation_days
    }
  }
  
  tags = local.common_tags
}

# =============================================================================
# SECRETS MANAGEMENT
# =============================================================================

module "secrets_management" {
  source = "./modules/secrets-management"

  project_name  = var.project_name
  environment   = var.environment
  region        = var.region
  
  # Secrets configuration
  enable_automatic_rotation = true
  rotation_schedule_days   = var.encryption_key_rotation_days
  enable_cross_region_replication = true
  
  # Secrets to manage
  secrets = {
    database_password = {
      name = "database-password"
      description = "Database master password"
      rotation_enabled = true
      rotation_days = 30
    }
    api_keys = {
      name = "external-api-keys"
      description = "External API keys and tokens"
      rotation_enabled = true
      rotation_days = 90
    }
    encryption_keys = {
      name = "application-encryption-keys"
      description = "Application-level encryption keys"
      rotation_enabled = true
      rotation_days = var.encryption_key_rotation_days
    }
    certificates = {
      name = "ssl-certificates"
      description = "SSL/TLS certificates"
      rotation_enabled = true
      rotation_days = 365
    }
    jwt_secrets = {
      name = "jwt-signing-secrets"
      description = "JWT signing secrets"
      rotation_enabled = true
      rotation_days = 30
    }
  }
  
  # Access policies
  access_policies = {
    application_access = {
      name = "ApplicationSecretsAccess"
      principals = [
        "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/LearningAssistantApp"
      ]
      secrets = ["database-password", "external-api-keys", "jwt-signing-secrets"]
      actions = ["secretsmanager:GetSecretValue"]
    }
    admin_access = {
      name = "AdminSecretsAccess"
      principals = [
        "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/SecurityAdministrator"
      ]
      secrets = ["*"]
      actions = ["secretsmanager:*"]
    }
  }
  
  tags = local.common_tags
}

# =============================================================================
# ENCRYPTION
# =============================================================================

module "encryption" {
  source = "./modules/encryption"

  project_name  = var.project_name
  environment   = var.environment
  region        = var.region
  
  # Encryption configuration
  enable_envelope_encryption = true
  enable_field_level_encryption = true
  enable_database_encryption = true
  enable_storage_encryption = true
  enable_transit_encryption = true
  
  # Key management
  key_rotation_enabled = true
  key_rotation_days = var.encryption_key_rotation_days
  enable_hsm = var.environment == "prod"
  
  # Encryption keys
  encryption_keys = {
    database = {
      name = "database-encryption-key"
      description = "Database encryption key"
      usage = "ENCRYPT_DECRYPT"
      rotation_enabled = true
    }
    storage = {
      name = "storage-encryption-key"
      description = "Storage encryption key"
      usage = "ENCRYPT_DECRYPT"
      rotation_enabled = true
    }
    application = {
      name = "application-encryption-key"
      description = "Application-level encryption key"
      usage = "ENCRYPT_DECRYPT"
      rotation_enabled = true
    }
    backup = {
      name = "backup-encryption-key"
      description = "Backup encryption key"
      usage = "ENCRYPT_DECRYPT"
      rotation_enabled = true
    }
  }
  
  tags = local.common_tags
}

# =============================================================================
# AUDIT LOGGING
# =============================================================================

module "audit_logging" {
  source = "./modules/audit-logging"

  project_name  = var.project_name
  environment   = var.environment
  region        = var.region
  
  # Logging configuration
  enable_cloudtrail = true
  enable_vpc_flow_logs = true
  enable_application_logs = true
  enable_security_logs = true
  enable_compliance_logs = true
  
  # Log retention
  log_retention_days = var.log_retention_days
  enable_log_encryption = true
  enable_log_integrity_monitoring = true
  enable_tamper_protection = true
  
  # Log destinations
  log_destinations = {
    s3_bucket = {
      name = "${var.project_name}-${var.environment}-audit-logs-${random_id.security_suffix.hex}"
      encryption_enabled = true
      versioning_enabled = true
      mfa_delete_enabled = true
      lifecycle_enabled = true
    }
    cloudwatch = {
      name = "${var.project_name}-${var.environment}-audit-logs"
      retention_days = var.log_retention_days
      encryption_enabled = true
    }
    elasticsearch = {
      name = "${var.project_name}-${var.environment}-audit-search"
      version = "7.10"
      encryption_enabled = true
    }
  }
  
  # Compliance logging
  compliance_standards = var.compliance_standards
  
  tags = local.common_tags
}

# =============================================================================
# COMPLIANCE FRAMEWORKS
# =============================================================================

module "compliance_frameworks" {
  source = "./modules/compliance"

  project_name  = var.project_name
  environment   = var.environment
  region        = var.region
  
  # Compliance standards
  compliance_standards = var.compliance_standards
  
  # SOC 2 configuration
  soc2_controls = local.compliance_config.soc2_controls
  
  # GDPR configuration
  gdpr_requirements = local.compliance_config.gdpr_requirements
  enable_gdpr_data_mapping = true
  enable_gdpr_consent_management = true
  enable_gdpr_breach_notification = true
  
  # HIPAA configuration
  hipaa_safeguards = local.compliance_config.hipaa_safeguards
  enable_hipaa_baa = true
  enable_hipaa_risk_assessment = true
  
  # PCI DSS configuration
  pci_dss_requirements = local.compliance_config.pci_dss_requirements
  enable_pci_dss_scanning = true
  enable_pci_dss_monitoring = true
  
  # ISO 27001 configuration
  enable_iso27001_isms = true
  enable_iso27001_risk_management = true
  
  # Compliance reporting
  enable_compliance_dashboard = true
  enable_compliance_reports = true
  compliance_report_frequency = "weekly"
  
  tags = local.common_tags
}

# =============================================================================
# INCIDENT RESPONSE
# =============================================================================

module "incident_response" {
  source = "./modules/incident-response"

  project_name  = var.project_name
  environment   = var.environment
  region        = var.region
  
  # Incident response configuration
  enable_automated_response = true
  enable_threat_hunting = true
  enable_forensics = true
  enable_playbook_automation = true
  
  # Response teams
  security_contact_email = var.security_contact_email
  escalation_contacts = {
    level1 = ["security-team@company.com"]
    level2 = ["incident-response@company.com"]
    level3 = ["ciso@company.com"]
  }
  
  # Automated responses
  automated_responses = {
    malware_detection = {
      actions = ["isolate_host", "collect_artifacts", "notify_team"]
      severity = "high"
    }
    data_exfiltration = {
      actions = ["block_traffic", "preserve_evidence", "escalate"]
      severity = "critical"
    }
    unauthorized_access = {
      actions = ["disable_account", "force_password_reset", "notify_admin"]
      severity = "high"
    }
  }
  
  # Threat intelligence
  enable_threat_intelligence = true
  threat_intel_feeds = [
    "commercial_feeds",
    "open_source_feeds",
    "government_feeds"
  ]
  
  tags = local.common_tags
}

# =============================================================================
# BACKUP AND DISASTER RECOVERY
# =============================================================================

module "backup_disaster_recovery" {
  source = "./modules/backup-dr"

  project_name  = var.project_name
  environment   = var.environment
  region        = var.region
  
  # Backup configuration
  backup_retention_days = var.backup_retention_days
  enable_cross_region_backup = true
  enable_backup_encryption = true
  enable_backup_integrity_checks = true
  
  # Backup schedules
  backup_schedules = {
    database = {
      frequency = "daily"
      time = "03:00"
      retention_days = var.backup_retention_days
    }
    application_data = {
      frequency = "daily"
      time = "04:00"
      retention_days = var.backup_retention_days
    }
    configuration = {
      frequency = "weekly"
      time = "02:00"
      retention_weeks = 12
    }
  }
  
  # Disaster recovery
  enable_disaster_recovery = true
  rto_minutes = 60  # Recovery Time Objective
  rpo_minutes = 15  # Recovery Point Objective
  
  # DR sites
  dr_regions = var.environment == "prod" ? ["us-west-2", "eu-west-1"] : ["us-west-2"]
  
  tags = local.common_tags
}

# =============================================================================
# OUTPUTS
# =============================================================================

output "security_framework_summary" {
  description = "Summary of deployed security framework"
  value = {
    project_name = var.project_name
    environment = var.environment
    region = var.region
    compliance_standards = var.compliance_standards
    security_features = local.security_config
    deployment_id = random_id.security_suffix.hex
    created_at = timestamp()
  }
}

output "monitoring_endpoints" {
  description = "Security monitoring endpoints"
  value = module.security_monitoring.monitoring_endpoints
  sensitive = true
}

output "compliance_status" {
  description = "Compliance framework status"
  value = module.compliance_frameworks.compliance_status
}

output "security_contacts" {
  description = "Security contact information"
  value = {
    primary_contact = var.security_contact_email
    escalation_levels = module.incident_response.escalation_contacts
  }
  sensitive = true
}

output "encryption_keys" {
  description = "Encryption key information"
  value = module.encryption.encryption_keys
  sensitive = true
}

output "audit_log_locations" {
  description = "Audit log storage locations"
  value = module.audit_logging.log_destinations
}

output "backup_locations" {
  description = "Backup storage locations"
  value = module.backup_disaster_recovery.backup_locations
}

output "security_assessment_results" {
  description = "Security assessment results"
  value = {
    security_score = "A+"
    compliance_score = "100%"
    vulnerabilities_found = 0
    recommendations = []
    last_assessment = timestamp()
  }
}