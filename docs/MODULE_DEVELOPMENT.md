# Terraform Module Development Guide

This guide provides comprehensive instructions for developing, testing, and publishing Terraform modules within the learning assistant infrastructure framework.

## Table of Contents

- [Overview](#overview)
- [Module Structure](#module-structure)
- [Development Standards](#development-standards)
- [Testing Framework](#testing-framework)
- [Security Requirements](#security-requirements)
- [Publishing Process](#publishing-process)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

Our Terraform module system provides enterprise-grade, reusable infrastructure components that promote consistency, security, and scalability across multi-cloud environments. The modules support AWS, GCP, and Azure with a unified interface.

### Module Categories

1. **Networking Modules** - VPC, subnets, security groups, load balancers
2. **Compute Modules** - ECS, GKE, AKS, auto-scaling
3. **Database Modules** - RDS, Cloud SQL, Azure Database
4. **Cache Modules** - ElastiCache, Memorystore
5. **Monitoring Modules** - Prometheus, Grafana, alerting
6. **Patterns** - Three-tier apps, microservices, serverless

## Module Structure

### Required Files

Every module must include these essential files:

```
modules/category/module-name/
├── main.tf           # Main resource definitions
├── variables.tf      # Input variable definitions
├── outputs.tf        # Output value definitions
├── versions.tf       # Provider version constraints
├── README.md         # Module documentation
└── examples/         # Usage examples
    └── basic/
        ├── main.tf
        ├── variables.tf
        └── README.md
```

### Optional Files

Additional files that enhance module functionality:

```
├── locals.tf         # Local value definitions
├── data.tf           # Data source definitions
├── providers.tf      # Provider configurations
├── scripts/          # Helper scripts
├── templates/        # Template files
├── tests/            # Automated tests
└── CHANGELOG.md      # Version history
```

### File Naming Conventions

- Use lowercase letters and hyphens for file names
- Keep file names descriptive but concise
- Group related resources in separate files when appropriate

## Development Standards

### Code Style

#### Terraform Formatting

```hcl
# Use consistent indentation (2 spaces)
resource "aws_instance" "web" {
  ami           = data.aws_ami.amazon_linux.id
  instance_type = var.instance_type
  
  vpc_security_group_ids = [aws_security_group.web.id]
  subnet_id              = var.subnet_id
  
  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-web"
    }
  )
}
```

#### Variable Definitions

```hcl
variable "instance_type" {
  description = "EC2 instance type for web servers"
  type        = string
  default     = "t3.medium"
  
  validation {
    condition = contains([
      "t3.micro", "t3.small", "t3.medium", "t3.large"
    ], var.instance_type)
    error_message = "Instance type must be a valid t3 instance type."
  }
}
```

#### Output Definitions

```hcl
output "instance_id" {
  description = "ID of the EC2 instance"
  value       = aws_instance.web.id
}

output "public_ip" {
  description = "Public IP address of the instance"
  value       = aws_instance.web.public_ip
  sensitive   = false
}
```

### Documentation Standards

#### README.md Template

```markdown
# Module Name

Brief description of what the module does and its primary use case.

## Features

- Feature 1
- Feature 2
- Feature 3

## Usage

### Basic Example

```hcl
module "example" {
  source = "./modules/category/module-name"
  
  project_name = "my-project"
  environment  = "prod"
  
  # Required variables
  vpc_id = "vpc-12345678"
  
  # Optional variables
  instance_type = "t3.medium"
  
  tags = {
    Owner = "team-name"
  }
}
```

### Advanced Example

```hcl
# Advanced usage example
```

## Requirements

| Name | Version |
|------|---------|
| terraform | >= 1.0 |
| aws | ~> 5.0 |

## Providers

| Name | Version |
|------|---------|
| aws | ~> 5.0 |

## Resources

| Name | Type |
|------|------|
| aws_instance.web | resource |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| project_name | Name of the project | string | n/a | yes |

## Outputs

| Name | Description |
|------|-------------|
| instance_id | ID of the EC2 instance |

## Examples

See the `examples/` directory for complete working examples.
```

### Versioning Strategy

Follow semantic versioning (SemVer) for module releases:

- **MAJOR** version: Breaking changes
- **MINOR** version: New features (backward compatible)
- **PATCH** version: Bug fixes (backward compatible)

Example: `1.2.3`

### Git Workflow

1. Create feature branch from `main`
2. Develop and test changes
3. Create pull request
4. Code review and approval
5. Merge to `main`
6. Tag release with version number

## Testing Framework

### Validation Tests

#### Syntax Validation

```bash
# Format check
terraform fmt -check -recursive

# Initialize and validate
terraform init -backend=false
terraform validate
```

#### Linting with TFLint

```bash
# Install TFLint
curl -s https://raw.githubusercontent.com/terraform-linters/tflint/master/install_linux.sh | bash

# Run TFLint
tflint --init
tflint --format=compact
```

### Security Testing

#### Checkov Security Scanning

```bash
# Install Checkov
pip install checkov

# Run security scan
checkov --directory . --framework terraform
```

#### Custom Security Rules

Create `.checkov.yml` for module-specific rules:

```yaml
framework:
  - terraform
check:
  - CKV_AWS_7   # Ensure RDS is encrypted
  - CKV_AWS_16  # Ensure EBS is encrypted
  - CKV_AWS_17  # Ensure S3 is encrypted
skip-check:
  - CKV_AWS_23  # Skip if not applicable
```

### Integration Testing

#### Terratest Framework

```go
package test

import (
    "testing"
    "github.com/gruntwork-io/terratest/modules/terraform"
    "github.com/stretchr/testify/assert"
)

func TestTerraformModule(t *testing.T) {
    terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
        TerraformDir: "../examples/basic",
        Vars: map[string]interface{}{
            "project_name": "test",
            "environment":  "test",
        },
    })

    defer terraform.Destroy(t, terraformOptions)

    terraform.InitAndApply(t, terraformOptions)

    // Test outputs
    instanceId := terraform.Output(t, terraformOptions, "instance_id")
    assert.NotEmpty(t, instanceId)
}
```

### Performance Testing

#### Resource Planning

```bash
# Test resource creation
terraform plan -out=tfplan

# Analyze plan
terraform show -json tfplan | jq '.planned_values.root_module.resources | length'
```

#### Cost Estimation

```bash
# Install Infracost
curl -fsSL https://raw.githubusercontent.com/infracost/infracost/master/scripts/install.sh | sh

# Generate cost estimate
infracost breakdown --path .
```

## Security Requirements

### Encryption Standards

All modules must implement encryption at rest and in transit:

```hcl
# Example: RDS with encryption
resource "aws_db_instance" "main" {
  storage_encrypted = true
  kms_key_id       = var.kms_key_id
  
  # Other configuration...
}
```

### Access Control

Implement least privilege access patterns:

```hcl
# Example: IAM role with minimal permissions
resource "aws_iam_role_policy" "minimal" {
  name = "${var.project_name}-minimal-policy"
  role = aws_iam_role.main.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "${aws_s3_bucket.main.arn}/*"
      }
    ]
  })
}
```

### Network Security

Implement proper network segmentation:

```hcl
# Example: Security group with restricted access
resource "aws_security_group" "web" {
  name_prefix = "${var.project_name}-web-"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidrs
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

### Compliance Frameworks

Support multiple compliance frameworks:

```hcl
# Example: Conditional compliance features
resource "aws_s3_bucket_logging" "compliance" {
  count = var.compliance_framework != "none" ? 1 : 0
  
  bucket = aws_s3_bucket.main.id
  
  target_bucket = aws_s3_bucket.access_logs.id
  target_prefix = "access-logs/"
}
```

## Publishing Process

### Automated Publishing

Use the provided publishing script:

```bash
# Validate module
./scripts/modules/publish-module.sh --validate-only modules/networking/vpc

# Dry run
./scripts/modules/publish-module.sh --dry-run modules/networking/vpc

# Publish with specific version
./scripts/modules/publish-module.sh --version 1.2.3 modules/networking/vpc
```

### Manual Publishing Steps

1. **Validation**: Ensure all tests pass
2. **Documentation**: Update README and CHANGELOG
3. **Versioning**: Tag with appropriate version
4. **Package**: Create distribution package
5. **Registry**: Upload to module registry
6. **Announcement**: Notify team of new release

### Registry Configuration

Configure registry settings:

```bash
export REGISTRY_BASE_URL="https://registry.company.com"
export REGISTRY_TOKEN="your-api-token"
```

## Best Practices

### Design Principles

1. **Single Responsibility**: Each module should have one clear purpose
2. **Composition**: Build complex infrastructure from simple modules
3. **Reusability**: Design for multiple use cases and environments
4. **Testability**: Include comprehensive tests and examples

### Variable Design

```hcl
# Good: Descriptive names and proper types
variable "database_instance_class" {
  description = "RDS instance class for database servers"
  type        = string
  default     = "db.t3.medium"
}

# Bad: Unclear names and missing validation
variable "size" {
  type    = string
  default = "medium"
}
```

### Output Design

```hcl
# Good: Clear descriptions and appropriate sensitivity
output "database_endpoint" {
  description = "RDS instance endpoint for database connections"
  value       = aws_db_instance.main.endpoint
  sensitive   = false
}

output "database_password" {
  description = "RDS master user password"
  value       = aws_db_instance.main.password
  sensitive   = true
}
```

### Tag Strategy

Implement consistent tagging:

```hcl
locals {
  common_tags = merge(
    var.tags,
    {
      Module      = "networking/vpc"
      Environment = var.environment
      Project     = var.project_name
      ManagedBy   = "terraform"
      CreatedAt   = timestamp()
    }
  )
}
```

### Error Handling

Implement proper validation and error messages:

```hcl
variable "environment" {
  description = "Environment name"
  type        = string
  
  validation {
    condition = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}
```

## Troubleshooting

### Common Issues

#### Module Not Found

```
Error: Module not found
```

**Solution**: Check module source path and ensure module exists.

#### Provider Version Conflicts

```
Error: Incompatible provider version
```

**Solution**: Update provider version constraints in `versions.tf`.

#### Circular Dependencies

```
Error: Cycle in module dependencies
```

**Solution**: Restructure modules to eliminate circular references.

### Debugging Techniques

#### Enable Debug Logging

```bash
export TF_LOG=DEBUG
terraform plan
```

#### Validate Module Isolation

```bash
# Test module in isolation
cd modules/networking/vpc
terraform init -backend=false
terraform validate
```

#### Check Resource Dependencies

```bash
# Visualize dependencies
terraform graph | dot -Tpng > graph.png
```

### Performance Optimization

#### Reduce Plan Time

```hcl
# Use data sources efficiently
data "aws_availability_zones" "available" {
  state = "available"
}

# Cache expensive operations
locals {
  availability_zones = data.aws_availability_zones.available.names
}
```

#### Optimize State Management

```hcl
# Use lifecycle rules to prevent recreation
resource "aws_instance" "web" {
  # ... configuration ...
  
  lifecycle {
    create_before_destroy = true
    ignore_changes = [
      ami,  # Ignore AMI changes
      user_data,  # Ignore user data changes
    ]
  }
}
```

### Getting Help

1. **Documentation**: Check module README and examples
2. **Issues**: Search existing GitHub issues
3. **Community**: Join Terraform community discussions
4. **Support**: Contact the infrastructure team

## Contributing

### Code Review Checklist

- [ ] Module follows naming conventions
- [ ] All required files are present
- [ ] Documentation is complete and accurate
- [ ] Tests pass successfully
- [ ] Security requirements are met
- [ ] Performance impact is acceptable
- [ ] Breaking changes are documented

### Submission Process

1. Fork the repository
2. Create feature branch
3. Implement changes
4. Add tests and documentation
5. Submit pull request
6. Address review feedback
7. Merge after approval

## Additional Resources

- [Terraform Best Practices](https://www.terraform-best-practices.com/)
- [Module Development Guidelines](https://developer.hashicorp.com/terraform/language/modules/develop)
- [Testing Terraform Code](https://www.terraform.io/docs/extend/testing/index.html)
- [Security Best Practices](https://learn.hashicorp.com/tutorials/terraform/security-best-practices)

---

For questions or support, please contact the Infrastructure Team or create an issue in the repository.