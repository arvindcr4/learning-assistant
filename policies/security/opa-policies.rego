# =============================================================================
# OPEN POLICY AGENT (OPA) SECURITY POLICIES
# Comprehensive security policies as code for the learning assistant
# =============================================================================

package security

import rego.v1

# =============================================================================
# TERRAFORM SECURITY POLICIES
# =============================================================================

# Deny S3 buckets without encryption
deny contains msg if {
    input.resource_type == "aws_s3_bucket"
    not has_server_side_encryption(input)
    msg := sprintf("S3 bucket '%s' must have server-side encryption enabled", [input.name])
}

# Deny S3 buckets with public access
deny contains msg if {
    input.resource_type == "aws_s3_bucket"
    allows_public_access(input)
    msg := sprintf("S3 bucket '%s' must not allow public access", [input.name])
}

# Require S3 bucket versioning
deny contains msg if {
    input.resource_type == "aws_s3_bucket"
    not has_versioning_enabled(input)
    msg := sprintf("S3 bucket '%s' must have versioning enabled", [input.name])
}

# Deny RDS instances without encryption
deny contains msg if {
    input.resource_type == "aws_db_instance"
    not input.config.storage_encrypted
    msg := sprintf("RDS instance '%s' must have storage encryption enabled", [input.name])
}

# Require RDS backup retention
deny contains msg if {
    input.resource_type == "aws_db_instance"
    input.config.backup_retention_period < 7
    msg := sprintf("RDS instance '%s' must have backup retention period >= 7 days", [input.name])
}

# Deny RDS instances without deletion protection
deny contains msg if {
    input.resource_type == "aws_db_instance"
    not input.config.deletion_protection
    msg := sprintf("RDS instance '%s' must have deletion protection enabled", [input.name])
}

# Require CloudTrail encryption
deny contains msg if {
    input.resource_type == "aws_cloudtrail"
    not input.config.kms_key_id
    msg := sprintf("CloudTrail '%s' must have KMS encryption enabled", [input.name])
}

# Require CloudTrail log file validation
deny contains msg if {
    input.resource_type == "aws_cloudtrail"
    not input.config.enable_log_file_validation
    msg := sprintf("CloudTrail '%s' must have log file validation enabled", [input.name])
}

# Deny security groups with overly permissive ingress
deny contains msg if {
    input.resource_type == "aws_security_group"
    rule := input.config.ingress[_]
    rule.from_port == 0
    rule.to_port == 65535
    contains(rule.cidr_blocks[_], "0.0.0.0/0")
    msg := sprintf("Security group '%s' has overly permissive ingress rule", [input.name])
}

# Deny security groups allowing SSH from anywhere
deny contains msg if {
    input.resource_type == "aws_security_group"
    rule := input.config.ingress[_]
    rule.from_port <= 22
    rule.to_port >= 22
    contains(rule.cidr_blocks[_], "0.0.0.0/0")
    msg := sprintf("Security group '%s' allows SSH access from anywhere", [input.name])
}

# Require IAM password policy minimum length
deny contains msg if {
    input.resource_type == "aws_iam_account_password_policy"
    input.config.minimum_password_length < 14
    msg := "IAM password policy must require minimum 14 characters"
}

# Require IAM password policy complexity
deny contains msg if {
    input.resource_type == "aws_iam_account_password_policy"
    not input.config.require_lowercase_characters
    msg := "IAM password policy must require lowercase characters"
}

deny contains msg if {
    input.resource_type == "aws_iam_account_password_policy"
    not input.config.require_uppercase_characters
    msg := "IAM password policy must require uppercase characters"
}

deny contains msg if {
    input.resource_type == "aws_iam_account_password_policy"
    not input.config.require_numbers
    msg := "IAM password policy must require numbers"
}

deny contains msg if {
    input.resource_type == "aws_iam_account_password_policy"
    not input.config.require_symbols
    msg := "IAM password policy must require symbols"
}

# Require KMS key rotation
deny contains msg if {
    input.resource_type == "aws_kms_key"
    not input.config.enable_key_rotation
    msg := sprintf("KMS key '%s' must have automatic rotation enabled", [input.name])
}

# Require EBS volume encryption
deny contains msg if {
    input.resource_type == "aws_ebs_volume"
    not input.config.encrypted
    msg := sprintf("EBS volume '%s' must be encrypted", [input.name])
}

# =============================================================================
# KUBERNETES SECURITY POLICIES
# =============================================================================

# Deny containers running as root
deny contains msg if {
    input.kind == "Pod"
    container := input.spec.containers[_]
    container.securityContext.runAsUser == 0
    msg := sprintf("Container '%s' in pod '%s' must not run as root", [container.name, input.metadata.name])
}

# Require security context for containers
deny contains msg if {
    input.kind == "Pod"
    container := input.spec.containers[_]
    not container.securityContext
    msg := sprintf("Container '%s' in pod '%s' must have security context defined", [container.name, input.metadata.name])
}

# Deny privileged containers
deny contains msg if {
    input.kind == "Pod"
    container := input.spec.containers[_]
    container.securityContext.privileged
    msg := sprintf("Container '%s' in pod '%s' must not be privileged", [container.name, input.metadata.name])
}

# Require read-only root filesystem
deny contains msg if {
    input.kind == "Pod"
    container := input.spec.containers[_]
    not container.securityContext.readOnlyRootFilesystem
    msg := sprintf("Container '%s' in pod '%s' must have read-only root filesystem", [container.name, input.metadata.name])
}

# Deny containers with privilege escalation
deny contains msg if {
    input.kind == "Pod"
    container := input.spec.containers[_]
    container.securityContext.allowPrivilegeEscalation
    msg := sprintf("Container '%s' in pod '%s' must not allow privilege escalation", [container.name, input.metadata.name])
}

# Require resource limits
deny contains msg if {
    input.kind == "Pod"
    container := input.spec.containers[_]
    not container.resources.limits
    msg := sprintf("Container '%s' in pod '%s' must have resource limits defined", [container.name, input.metadata.name])
}

# Require memory limits
deny contains msg if {
    input.kind == "Pod"
    container := input.spec.containers[_]
    not container.resources.limits.memory
    msg := sprintf("Container '%s' in pod '%s' must have memory limits defined", [container.name, input.metadata.name])
}

# Require CPU limits
deny contains msg if {
    input.kind == "Pod"
    container := input.spec.containers[_]
    not container.resources.limits.cpu
    msg := sprintf("Container '%s' in pod '%s' must have CPU limits defined", [container.name, input.metadata.name])
}

# Deny hostNetwork
deny contains msg if {
    input.kind == "Pod"
    input.spec.hostNetwork
    msg := sprintf("Pod '%s' must not use host network", [input.metadata.name])
}

# Deny hostPID
deny contains msg if {
    input.kind == "Pod"
    input.spec.hostPID
    msg := sprintf("Pod '%s' must not use host PID namespace", [input.metadata.name])
}

# Deny hostIPC
deny contains msg if {
    input.kind == "Pod"
    input.spec.hostIPC
    msg := sprintf("Pod '%s' must not use host IPC namespace", [input.metadata.name])
}

# Require non-default service account
deny contains msg if {
    input.kind == "Pod"
    input.spec.serviceAccountName == "default"
    msg := sprintf("Pod '%s' must not use default service account", [input.metadata.name])
}

# =============================================================================
# DOCKER SECURITY POLICIES
# =============================================================================

# Deny running as root user
deny contains msg if {
    input.type == "dockerfile"
    instruction := input.instructions[_]
    instruction.cmd == "user"
    instruction.value[0] == "root"
    msg := "Dockerfile must not run as root user"
}

# Require USER instruction
deny contains msg if {
    input.type == "dockerfile"
    not has_user_instruction(input)
    msg := "Dockerfile must include USER instruction to run as non-root"
}

# Deny ADD instruction (prefer COPY)
deny contains msg if {
    input.type == "dockerfile"
    instruction := input.instructions[_]
    instruction.cmd == "add"
    msg := "Use COPY instead of ADD for better security"
}

# Require HEALTHCHECK instruction
deny contains msg if {
    input.type == "dockerfile"
    not has_healthcheck_instruction(input)
    msg := "Dockerfile must include HEALTHCHECK instruction"
}

# Deny latest tag
deny contains msg if {
    input.type == "dockerfile"
    instruction := input.instructions[_]
    instruction.cmd == "from"
    endswith(instruction.value[0], ":latest")
    msg := "Dockerfile must not use latest tag for base images"
}

# =============================================================================
# APPLICATION SECURITY POLICIES
# =============================================================================

# Deny hardcoded secrets
deny contains msg if {
    input.type == "code"
    file := input.files[_]
    line := file.lines[_]
    contains_hardcoded_secret(line.content)
    msg := sprintf("Hardcoded secret detected in %s:%d", [file.path, line.number])
}

# Deny SQL injection patterns
deny contains msg if {
    input.type == "code"
    file := input.files[_]
    line := file.lines[_]
    has_sql_injection_pattern(line.content)
    msg := sprintf("Potential SQL injection vulnerability in %s:%d", [file.path, line.number])
}

# Require HTTPS for external APIs
deny contains msg if {
    input.type == "code"
    file := input.files[_]
    line := file.lines[_]
    has_insecure_http_call(line.content)
    msg := sprintf("Insecure HTTP call detected in %s:%d - use HTTPS", [file.path, line.number])
}

# Deny eval() usage
deny contains msg if {
    input.type == "code"
    file := input.files[_]
    line := file.lines[_]
    contains(line.content, "eval(")
    msg := sprintf("Dangerous eval() usage detected in %s:%d", [file.path, line.number])
}

# =============================================================================
# COMPLIANCE POLICIES
# =============================================================================

# SOC 2 Type II Policies
soc2_compliant if {
    has_encryption_at_rest
    has_encryption_in_transit
    has_access_controls
    has_audit_logging
    has_monitoring
    has_incident_response
    has_business_continuity
}

# GDPR Compliance Policies
gdpr_compliant if {
    has_data_protection_measures
    has_consent_management
    has_data_subject_rights
    has_breach_notification
    has_privacy_by_design
    has_data_minimization
}

# HIPAA Compliance Policies
hipaa_compliant if {
    has_administrative_safeguards
    has_physical_safeguards
    has_technical_safeguards
    has_access_controls
    has_audit_controls
    has_integrity_controls
    has_transmission_security
}

# PCI DSS Compliance Policies
pci_dss_compliant if {
    has_network_security_controls
    has_secure_configurations
    has_cardholder_data_protection
    has_strong_cryptography
    has_secure_development
    has_access_restrictions
    has_monitoring_testing
    has_information_security_policy
}

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

has_server_side_encryption(resource) if {
    resource.config.server_side_encryption_configuration
}

allows_public_access(resource) if {
    resource.config.acl == "public-read"
}

allows_public_access(resource) if {
    resource.config.acl == "public-read-write"
}

has_versioning_enabled(resource) if {
    resource.config.versioning[_].enabled
}

has_user_instruction(dockerfile) if {
    instruction := dockerfile.instructions[_]
    instruction.cmd == "user"
    instruction.value[0] != "root"
}

has_healthcheck_instruction(dockerfile) if {
    instruction := dockerfile.instructions[_]
    instruction.cmd == "healthcheck"
}

contains_hardcoded_secret(content) if {
    regex.match(`(password|secret|key|token)\s*=\s*['"][^'"]{8,}['"]`, content)
}

has_sql_injection_pattern(content) if {
    regex.match(`query.*\+.*req\.`, content)
}

has_insecure_http_call(content) if {
    regex.match(`http://[^/]`, content)
    not regex.match(`http://localhost`, content)
    not regex.match(`http://127\.0\.0\.1`, content)
}

# Compliance helper functions
has_encryption_at_rest if {
    # Check for S3 encryption, EBS encryption, RDS encryption, etc.
    count([resource | resource := input.resources[_]; resource.type == "aws_s3_bucket"; has_server_side_encryption(resource)]) > 0
}

has_encryption_in_transit if {
    # Check for HTTPS, TLS, SSL configurations
    count([resource | resource := input.resources[_]; resource.type == "aws_lb_listener"; resource.config.protocol == "HTTPS"]) > 0
}

has_access_controls if {
    # Check for IAM policies, security groups, etc.
    count([resource | resource := input.resources[_]; resource.type == "aws_iam_policy"]) > 0
}

has_audit_logging if {
    # Check for CloudTrail, VPC Flow Logs, etc.
    count([resource | resource := input.resources[_]; resource.type == "aws_cloudtrail"]) > 0
}

has_monitoring if {
    # Check for CloudWatch, monitoring configurations
    count([resource | resource := input.resources[_]; resource.type == "aws_cloudwatch_metric_alarm"]) > 0
}

has_incident_response if {
    # Check for incident response configurations
    count([resource | resource := input.resources[_]; resource.type == "aws_sns_topic"]) > 0
}

has_business_continuity if {
    # Check for backup configurations
    count([resource | resource := input.resources[_]; resource.type == "aws_db_instance"; resource.config.backup_retention_period > 0]) > 0
}

has_data_protection_measures if {
    has_encryption_at_rest
    has_encryption_in_transit
}

has_consent_management if {
    # This would check for consent management implementations
    true  # Placeholder - would need specific implementation checks
}

has_data_subject_rights if {
    # This would check for data subject rights implementations
    true  # Placeholder - would need specific implementation checks
}

has_breach_notification if {
    # Check for breach notification mechanisms
    count([resource | resource := input.resources[_]; resource.type == "aws_sns_topic"]) > 0
}

has_privacy_by_design if {
    has_encryption_at_rest
    has_access_controls
}

has_data_minimization if {
    # This would check for data minimization practices
    true  # Placeholder - would need specific implementation checks
}

has_administrative_safeguards if {
    # Check for administrative safeguards
    has_access_controls
}

has_physical_safeguards if {
    # Check for physical safeguards documentation
    true  # Placeholder - would need specific checks
}

has_technical_safeguards if {
    has_encryption_at_rest
    has_encryption_in_transit
    has_access_controls
}

has_integrity_controls if {
    has_encryption_at_rest
}

has_transmission_security if {
    has_encryption_in_transit
}

has_network_security_controls if {
    count([resource | resource := input.resources[_]; resource.type == "aws_security_group"]) > 0
}

has_secure_configurations if {
    # Check for secure configuration practices
    count([resource | resource := input.resources[_]; resource.type == "aws_iam_account_password_policy"]) > 0
}

has_cardholder_data_protection if {
    has_encryption_at_rest
}

has_strong_cryptography if {
    has_encryption_at_rest
    has_encryption_in_transit
}

has_secure_development if {
    # This would check for secure development practices
    true  # Placeholder - would need specific checks
}

has_access_restrictions if {
    has_access_controls
}

has_monitoring_testing if {
    has_monitoring
}

has_information_security_policy if {
    # This would check for information security policy
    true  # Placeholder - would need specific checks
}

# =============================================================================
# SEVERITY LEVELS
# =============================================================================

severity := "CRITICAL" if {
    contains_critical_violation
}

severity := "HIGH" if {
    not contains_critical_violation
    contains_high_violation
}

severity := "MEDIUM" if {
    not contains_critical_violation
    not contains_high_violation
    contains_medium_violation
}

severity := "LOW" if {
    not contains_critical_violation
    not contains_high_violation
    not contains_medium_violation
    contains_low_violation
}

severity := "INFO" if {
    not contains_critical_violation
    not contains_high_violation
    not contains_medium_violation
    not contains_low_violation
}

contains_critical_violation if {
    # Define critical violations
    input.resource_type == "aws_s3_bucket"
    allows_public_access(input)
}

contains_critical_violation if {
    input.resource_type == "aws_security_group"
    rule := input.config.ingress[_]
    rule.from_port == 0
    rule.to_port == 65535
    contains(rule.cidr_blocks[_], "0.0.0.0/0")
}

contains_high_violation if {
    input.resource_type == "aws_s3_bucket"
    not has_server_side_encryption(input)
}

contains_high_violation if {
    input.resource_type == "aws_db_instance"
    not input.config.storage_encrypted
}

contains_medium_violation if {
    input.resource_type == "aws_s3_bucket"
    not has_versioning_enabled(input)
}

contains_low_violation if {
    input.resource_type == "aws_kms_key"
    not input.config.enable_key_rotation
}

# =============================================================================
# REMEDIATION SUGGESTIONS
# =============================================================================

remediation[msg] {
    input.resource_type == "aws_s3_bucket"
    not has_server_side_encryption(input)
    msg := "Add server_side_encryption_configuration block to enable encryption"
}

remediation[msg] {
    input.resource_type == "aws_s3_bucket"
    allows_public_access(input)
    msg := "Remove public ACLs and add public access block configuration"
}

remediation[msg] {
    input.resource_type == "aws_db_instance"
    not input.config.storage_encrypted
    msg := "Set storage_encrypted = true to enable encryption"
}

remediation[msg] {
    input.resource_type == "aws_security_group"
    rule := input.config.ingress[_]
    contains(rule.cidr_blocks[_], "0.0.0.0/0")
    msg := "Replace 0.0.0.0/0 with specific IP ranges or security groups"
}

# =============================================================================
# POLICY METADATA
# =============================================================================

metadata := {
    "name": "Learning Assistant Security Policies",
    "version": "1.0.0",
    "description": "Comprehensive security policies for infrastructure, containers, and applications",
    "standards": ["SOC2", "GDPR", "HIPAA", "PCI-DSS", "ISO27001"],
    "frameworks": ["CIS", "NIST", "OWASP"],
    "last_updated": "2024-01-01T00:00:00Z",
    "maintainer": "Security Team"
}