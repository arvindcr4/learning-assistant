# Open Policy Agent (OPA) Policy for Terraform Infrastructure
# This policy enforces security, compliance, and operational standards

package terraform.policy

import rego.v1

# Policy Configuration
policy_config := {
    "security": {
        "require_encryption": true,
        "require_vpc": true,
        "require_private_subnets": true,
        "require_ssl_certificates": true,
        "require_backup_enabled": true,
        "require_monitoring": true,
        "require_tags": true
    },
    "compliance": {
        "require_cost_tags": true,
        "require_environment_tags": true,
        "require_owner_tags": true,
        "max_cost_per_resource": 1000,
        "allowed_regions": ["us-west-2", "us-east-1", "eu-west-1"],
        "prohibited_resources": ["aws_instance"]
    },
    "operational": {
        "require_versioning": true,
        "require_lifecycle_rules": true,
        "require_access_logging": true,
        "require_cross_region_backup": true,
        "max_retention_days": 2555
    }
}

# Required Tags
required_tags := [
    "Environment",
    "Project",
    "Owner",
    "CostCenter",
    "ManagedBy"
]

cost_tags := [
    "CostCenter",
    "Project",
    "Environment"
]

# Helper Functions

# Get all resource changes
resource_changes := input.resource_changes

# Get resources by type
resources_by_type(resource_type) := [resource |
    resource := resource_changes[_]
    resource.type == resource_type
]

# Check if resource has required tags
has_required_tags(resource) if {
    resource.change.after.tags
    required_tags_present := [tag | 
        tag := required_tags[_]
        resource.change.after.tags[tag]
    ]
    count(required_tags_present) == count(required_tags)
}

# Check if resource has cost tags
has_cost_tags(resource) if {
    resource.change.after.tags
    cost_tags_present := [tag | 
        tag := cost_tags[_]
        resource.change.after.tags[tag]
    ]
    count(cost_tags_present) == count(cost_tags)
}

# Check if region is allowed
is_allowed_region(region) if {
    region in policy_config.compliance.allowed_regions
}

# Security Policies

# Policy: Require encryption for storage resources
deny[msg] {
    s3_buckets := resources_by_type("aws_s3_bucket")
    bucket := s3_buckets[_]
    not bucket.change.after.server_side_encryption_configuration
    msg := sprintf("S3 bucket '%s' must have server-side encryption enabled", [bucket.name])
}

deny[msg] {
    ebs_volumes := resources_by_type("aws_ebs_volume")
    volume := ebs_volumes[_]
    not volume.change.after.encrypted
    msg := sprintf("EBS volume '%s' must be encrypted", [volume.name])
}

deny[msg] {
    rds_instances := resources_by_type("aws_rds_instance")
    instance := rds_instances[_]
    not instance.change.after.storage_encrypted
    msg := sprintf("RDS instance '%s' must have storage encryption enabled", [instance.name])
}

deny[msg] {
    storage_accounts := resources_by_type("azurerm_storage_account")
    account := storage_accounts[_]
    not account.change.after.enable_https_traffic_only
    msg := sprintf("Azure storage account '%s' must enforce HTTPS traffic only", [account.name])
}

deny[msg] {
    gcs_buckets := resources_by_type("google_storage_bucket")
    bucket := gcs_buckets[_]
    not bucket.change.after.encryption
    msg := sprintf("GCS bucket '%s' must have encryption configured", [bucket.name])
}

# Policy: Require VPC for compute resources
deny[msg] {
    instances := resources_by_type("aws_instance")
    instance := instances[_]
    not instance.change.after.vpc_security_group_ids
    msg := sprintf("EC2 instance '%s' must be deployed in a VPC", [instance.name])
}

deny[msg] {
    ecs_services := resources_by_type("aws_ecs_service")
    service := ecs_services[_]
    not service.change.after.network_configuration
    msg := sprintf("ECS service '%s' must have network configuration", [service.name])
}

deny[msg] {
    lambda_functions := resources_by_type("aws_lambda_function")
    function := lambda_functions[_]
    not function.change.after.vpc_config
    msg := sprintf("Lambda function '%s' should have VPC configuration for security", [function.name])
}

# Policy: Require backup configuration
deny[msg] {
    s3_buckets := resources_by_type("aws_s3_bucket")
    bucket := s3_buckets[_]
    not bucket.change.after.versioning
    msg := sprintf("S3 bucket '%s' must have versioning enabled for backup", [bucket.name])
}

deny[msg] {
    rds_instances := resources_by_type("aws_rds_instance")
    instance := rds_instances[_]
    instance.change.after.backup_retention_period <= 0
    msg := sprintf("RDS instance '%s' must have backup retention period > 0", [instance.name])
}

# Policy: Require monitoring and logging
deny[msg] {
    s3_buckets := resources_by_type("aws_s3_bucket")
    bucket := s3_buckets[_]
    not bucket.change.after.logging
    msg := sprintf("S3 bucket '%s' must have access logging enabled", [bucket.name])
}

deny[msg] {
    cloudfront_distributions := resources_by_type("aws_cloudfront_distribution")
    distribution := cloudfront_distributions[_]
    not distribution.change.after.logging_config
    msg := sprintf("CloudFront distribution '%s' must have logging enabled", [distribution.name])
}

# Compliance Policies

# Policy: Require mandatory tags
deny[msg] {
    resource := resource_changes[_]
    not has_required_tags(resource)
    msg := sprintf("Resource '%s' of type '%s' must have all required tags: %v", [resource.name, resource.type, required_tags])
}

# Policy: Require cost tags
deny[msg] {
    resource := resource_changes[_]
    not has_cost_tags(resource)
    msg := sprintf("Resource '%s' of type '%s' must have all cost tags: %v", [resource.name, resource.type, cost_tags])
}

# Policy: Restrict allowed regions
deny[msg] {
    resource := resource_changes[_]
    resource.change.after.region
    not is_allowed_region(resource.change.after.region)
    msg := sprintf("Resource '%s' cannot be deployed in region '%s'. Allowed regions: %v", [resource.name, resource.change.after.region, policy_config.compliance.allowed_regions])
}

deny[msg] {
    resource := resource_changes[_]
    resource.change.after.location
    not is_allowed_region(resource.change.after.location)
    msg := sprintf("Resource '%s' cannot be deployed in location '%s'. Allowed locations: %v", [resource.name, resource.change.after.location, policy_config.compliance.allowed_regions])
}

# Policy: Prohibit certain resource types
deny[msg] {
    resource := resource_changes[_]
    resource.type in policy_config.compliance.prohibited_resources
    msg := sprintf("Resource type '%s' is prohibited. Resource name: '%s'", [resource.type, resource.name])
}

# Operational Policies

# Policy: Require versioning for storage
deny[msg] {
    s3_buckets := resources_by_type("aws_s3_bucket")
    bucket := s3_buckets[_]
    not bucket.change.after.versioning
    msg := sprintf("S3 bucket '%s' must have versioning enabled", [bucket.name])
}

deny[msg] {
    s3_buckets := resources_by_type("aws_s3_bucket")
    bucket := s3_buckets[_]
    bucket.change.after.versioning
    not bucket.change.after.versioning[0].enabled
    msg := sprintf("S3 bucket '%s' must have versioning enabled (not just configured)", [bucket.name])
}

deny[msg] {
    storage_accounts := resources_by_type("azurerm_storage_account")
    account := storage_accounts[_]
    not account.change.after.blob_properties
    msg := sprintf("Azure storage account '%s' must have blob properties configured", [account.name])
}

deny[msg] {
    storage_accounts := resources_by_type("azurerm_storage_account")
    account := storage_accounts[_]
    account.change.after.blob_properties
    not account.change.after.blob_properties[0].versioning_enabled
    msg := sprintf("Azure storage account '%s' must have versioning enabled", [account.name])
}

# Policy: Require lifecycle rules
deny[msg] {
    s3_buckets := resources_by_type("aws_s3_bucket")
    bucket := s3_buckets[_]
    not bucket.change.after.lifecycle_rule
    msg := sprintf("S3 bucket '%s' must have lifecycle rules configured", [bucket.name])
}

deny[msg] {
    gcs_buckets := resources_by_type("google_storage_bucket")
    bucket := gcs_buckets[_]
    not bucket.change.after.lifecycle_rule
    msg := sprintf("GCS bucket '%s' must have lifecycle rules configured", [bucket.name])
}

# Cost Control Policies

# Policy: Limit resource costs
deny[msg] {
    resource := resource_changes[_]
    resource.change.after.cost_estimate
    resource.change.after.cost_estimate > policy_config.compliance.max_cost_per_resource
    msg := sprintf("Resource '%s' estimated cost $%d exceeds maximum allowed cost $%d", [resource.name, resource.change.after.cost_estimate, policy_config.compliance.max_cost_per_resource])
}

# Environment-specific Policies

# Policy: Production environment restrictions
deny[msg] {
    input.workspace.name == "production"
    resource := resource_changes[_]
    "delete" in resource.change.actions
    msg := sprintf("Deletion of resource '%s' is not allowed in production environment", [resource.name])
}

deny[msg] {
    input.workspace.name == "production"
    resource := resource_changes[_]
    "destroy" in resource.change.actions
    msg := sprintf("Destruction of resource '%s' is not allowed in production environment", [resource.name])
}

deny[msg] {
    input.workspace.name == "production"
    instances := resources_by_type("aws_instance")
    instance := instances[_]
    not instance.change.after.availability_zone
    msg := sprintf("EC2 instance '%s' must specify availability zone in production", [instance.name])
}

deny[msg] {
    input.workspace.name == "production"
    rds_instances := resources_by_type("aws_rds_instance")
    instance := rds_instances[_]
    not instance.change.after.multi_az
    msg := sprintf("RDS instance '%s' must have multi-AZ enabled in production", [instance.name])
}

# Policy: Development environment permissions
deny[msg] {
    input.workspace.name == "development"
    resource := resource_changes[_]
    resource.change.after.tags
    not resource.change.after.tags["Environment"]
    msg := sprintf("Resource '%s' must have Environment tag set to 'development'", [resource.name])
}

deny[msg] {
    input.workspace.name == "development"
    resource := resource_changes[_]
    resource.change.after.tags
    resource.change.after.tags["Environment"] != "development"
    msg := sprintf("Resource '%s' Environment tag must be set to 'development' in development workspace", [resource.name])
}

# Warnings (advisory policies)
warn[msg] {
    lambda_functions := resources_by_type("aws_lambda_function")
    function := lambda_functions[_]
    not function.change.after.vpc_config
    msg := sprintf("Lambda function '%s' should consider VPC configuration for enhanced security", [function.name])
}

warn[msg] {
    s3_buckets := resources_by_type("aws_s3_bucket")
    bucket := s3_buckets[_]
    not bucket.change.after.public_access_block
    msg := sprintf("S3 bucket '%s' should have public access block configured", [bucket.name])
}

warn[msg] {
    resource := resource_changes[_]
    not resource.change.after.tags
    msg := sprintf("Resource '%s' of type '%s' should have tags for better resource management", [resource.name, resource.type])
}

# Policy Summary
policy_summary := {
    "total_resources": count(resource_changes),
    "violations": count(deny),
    "warnings": count(warn),
    "policy_version": "1.0.0",
    "evaluation_time": time.now_ns()
}

# Export policy summary
export policy_summary