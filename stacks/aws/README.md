# AWS Infrastructure Stack

This Terraform stack deploys a complete AWS infrastructure using shared modules. It includes all the components needed for a production-ready application deployment.

## Architecture Overview

The stack provisions the following AWS resources:

- **Networking**: VPC with public and private subnets across multiple availability zones
- **Container Service**: ECS Fargate service with Application Load Balancer (ALB)
- **Container Registry**: ECR repository for Docker images
- **Database**: RDS PostgreSQL with automated backups
- **Cache**: ElastiCache Redis cluster (optional)
- **Storage**: S3 bucket for backups and static files
- **CDN**: CloudFront distribution with ACM certificate
- **Monitoring**: CloudWatch log groups and alarms
- **Security**: IAM roles and policies for service execution and CI/CD

## Prerequisites

- AWS CLI configured with appropriate credentials
- Terraform >= 1.0
- Valid AWS account with necessary permissions
- (Optional) Route53 hosted zone for custom domain

## Usage

### 1. Create a terraform.tfvars file

```hcl
# Required variables
name         = "my-app"
environment  = "production"
region       = "us-east-1"

# Service configuration
service_name = "my-app-service"
db_name      = "my-app-db"
cache_name   = "my-app-cache"
bucket_name  = "my-app-bucket-unique-name"
cdn_name     = "my-app-cdn"

# Database password (use environment variable in production)
db_master_password = "secure-password-here"

# Optional: Custom domain configuration
create_certificate        = true
domain_name              = "app.example.com"
subject_alternative_names = ["*.app.example.com"]
route53_zone_id          = "Z1234567890ABC"
cdn_custom_domains       = ["app.example.com"]

# Optional: GitHub Actions CI/CD
github_repository = "myorg/myrepo"
```

### 2. Initialize Terraform

```bash
terraform init
```

### 3. Plan the deployment

```bash
terraform plan
```

### 4. Apply the configuration

```bash
terraform apply
```

## Configuration Options

### Network Configuration

```hcl
# Custom CIDR blocks
cidr_block           = "10.0.0.0/16"
public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnet_cidrs = ["10.0.10.0/24", "10.0.11.0/24"]

# Availability zones (auto-detected if not specified)
availability_zones = ["us-east-1a", "us-east-1b"]
```

### Container Service Configuration

```hcl
# Resource allocation
service_cpu    = "512"    # 0.5 vCPU
service_memory = "1024"   # 1 GB RAM

# Scaling configuration
desired_count = 2
min_count     = 1
max_count     = 10

# Health check
health_check_path     = "/health"
health_check_interval = 30
health_check_timeout  = 5
```

### Database Configuration

```hcl
# Instance specifications
db_instance_class    = "db.t3.small"
db_allocated_storage = 100
db_engine_version    = "15.4"

# High availability
db_multi_az                = true
db_backup_retention_period = 30
db_deletion_protection     = true
```

### Redis Configuration

```hcl
# Enable/disable Redis
enable_redis = true

# Instance specifications
cache_node_type          = "cache.t3.micro"
cache_engine_version     = "7.0"
cache_num_nodes          = 2
cache_automatic_failover = true
```

### Monitoring Configuration

```hcl
# CloudWatch logs
log_retention_days = 30

# Alarm notifications
alarm_sns_topic_arn = "arn:aws:sns:us-east-1:123456789012:alerts"
```

## Outputs

After deployment, the stack provides the following outputs:

- `alb_url` - Application Load Balancer URL
- `cloudfront_url` - CloudFront distribution URL
- `database_endpoint` - RDS PostgreSQL endpoint
- `redis_endpoint` - ElastiCache Redis endpoint
- `ecr_repository_url` - ECR repository URL
- `s3_bucket_name` - S3 bucket name
- `ci_role_arn` - IAM role ARN for CI/CD

## CI/CD Integration

The stack creates an IAM role for GitHub Actions OIDC authentication. To use it:

1. Set up GitHub OIDC provider in AWS (if not already done)
2. Use the `ci_role_arn` output in your GitHub Actions workflow
3. The role has permissions to:
   - Push images to ECR
   - Update ECS services

Example GitHub Actions workflow:

```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v2
  with:
    role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
    aws-region: us-east-1

- name: Login to Amazon ECR
  id: login-ecr
  uses: aws-actions/amazon-ecr-login@v1

- name: Build and push image
  env:
    ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
    ECR_REPOSITORY: my-app-app
    IMAGE_TAG: ${{ github.sha }}
  run: |
    docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
    docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
```

## Cost Optimization

To minimize costs in development environments:

```hcl
# Use smaller instance types
db_instance_class = "db.t3.micro"
cache_node_type   = "cache.t3.micro"
service_cpu       = "256"
service_memory    = "512"

# Reduce redundancy
db_multi_az              = false
cache_automatic_failover = false
desired_count            = 1

# Disable optional features
enable_redis            = false
db_performance_insights = false
```

## Security Considerations

- Database passwords should be provided via environment variables or AWS Secrets Manager
- All data is encrypted at rest and in transit
- Network isolation enforced through VPC and security groups
- IAM roles follow principle of least privilege
- Enable deletion protection for production databases

## Troubleshooting

### Common Issues

1. **ECR Repository Name Conflict**
   - ECR repository names must be unique within an AWS account
   - Modify the `name` variable if conflicts occur

2. **S3 Bucket Name Conflict**
   - S3 bucket names must be globally unique
   - Ensure `bucket_name` is unique

3. **Certificate Validation**
   - DNS validation requires access to Route53 hosted zone
   - Manual validation may be needed for external DNS providers

### Viewing Logs

```bash
# View ECS task logs
aws logs tail /ecs/my-app --follow

# View specific time range
aws logs tail /ecs/my-app --since 1h
```

## Cleanup

To destroy all resources:

```bash
terraform destroy
```

Note: Resources with deletion protection enabled must be manually modified before destruction.
