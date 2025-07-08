# AWS Infrastructure for Learning Assistant Application

This directory contains Terraform configurations for deploying the Learning Assistant application on AWS with production-ready infrastructure following AWS best practices.

## Architecture Overview

The infrastructure includes:

- **VPC** with public, private, and database subnets across multiple AZs
- **ECS Fargate** for container orchestration
- **Application Load Balancer** with SSL/TLS termination
- **RDS PostgreSQL** with Multi-AZ deployment and read replicas
- **ElastiCache Redis** for caching and session management
- **Route 53** for DNS management and health checks
- **CloudWatch** for comprehensive monitoring and logging
- **IAM roles** with least privilege access
- **Security Groups** with proper network segmentation
- **KMS encryption** for data at rest
- **VPC Endpoints** for secure AWS service access

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Terraform** >= 1.0 installed
3. **Domain name** registered (optional, for custom domain)
4. **SSL certificate** in AWS Certificate Manager (optional)
5. **Container image** pushed to ECR or Docker Hub

## Quick Start

1. **Clone and navigate to the infrastructure directory:**
   ```bash
   cd infrastructure/aws
   ```

2. **Copy and customize the variables file:**
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```

3. **Edit `terraform.tfvars` with your specific values:**
   - Update domain name and certificate ARN
   - Set container image URL
   - Configure database credentials
   - Adjust instance sizes for your environment

4. **Initialize Terraform:**
   ```bash
   terraform init
   ```

5. **Plan the deployment:**
   ```bash
   terraform plan
   ```

6. **Apply the configuration:**
   ```bash
   terraform apply
   ```

## Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `project_name` | Name of the project | `learning-assistant` |
| `environment` | Environment name | `prod`, `staging`, `dev` |
| `container_image` | Docker image for the application | `your-account.dkr.ecr.us-east-1.amazonaws.com/learning-assistant:latest` |
| `domain_name` | Domain name for the application | `learning-assistant.example.com` |

### Optional Variables

See `variables.tf` for a complete list of configurable options.

## Environment-Specific Configurations

### Development Environment
```hcl
environment        = "dev"
db_instance_class  = "db.t3.micro"
redis_node_type    = "cache.t3.micro"
task_desired_count = 1
single_nat_gateway = true
multi_az           = false
```

### Staging Environment
```hcl
environment        = "staging"
db_instance_class  = "db.t3.small"
redis_node_type    = "cache.t3.small"
task_desired_count = 2
multi_az           = true
```

### Production Environment
```hcl
environment        = "prod"
db_instance_class  = "db.r5.large"
redis_node_type    = "cache.r5.large"
task_desired_count = 3
min_capacity       = 2
max_capacity       = 20
multi_az           = true
create_read_replica = true
```

## Security Features

- **Network isolation** with VPC and security groups
- **Encryption at rest** for RDS, ElastiCache, and CloudWatch Logs
- **Encryption in transit** for all communications
- **IAM roles** with least privilege access
- **Parameter Store** for secure secret management
- **VPC endpoints** to avoid internet routing for AWS services
- **Network ACLs** for additional subnet-level security

## Monitoring and Alerting

The infrastructure includes comprehensive monitoring:

- **CloudWatch Dashboard** with key metrics
- **CloudWatch Alarms** for critical thresholds
- **CloudWatch Logs** with structured logging
- **CloudWatch Insights** queries for log analysis
- **Health checks** for application availability
- **SNS notifications** for alert delivery

Access the dashboard at: `https://console.aws.amazon.com/cloudwatch/home#dashboards:`

## Backup and Disaster Recovery

- **RDS automated backups** with configurable retention
- **RDS snapshots** for point-in-time recovery
- **ElastiCache snapshots** for Redis data backup
- **Multi-AZ deployment** for high availability
- **Cross-region replication** support (optional)

## Cost Optimization

### Development/Staging
- Use `t3.micro` instances
- Single NAT Gateway
- Disable Multi-AZ for RDS
- Shorter backup retention periods

### Production
- Use appropriate instance sizes based on load
- Enable all high availability features
- Consider Reserved Instances for cost savings
- Monitor with AWS Cost Explorer

**Estimated Monthly Costs:**
- **Development:** ~$80-150/month
- **Staging:** ~$150-300/month  
- **Production:** ~$300-800/month (varies with traffic)

## Deployment Process

### Initial Deployment

1. Prepare your container image
2. Configure variables in `terraform.tfvars`
3. Run `terraform plan` to review changes
4. Run `terraform apply` to create infrastructure
5. Update DNS records (if not using Route 53)
6. Deploy your application container

### Updates

1. Update container image in ECR
2. Modify variables if needed
3. Run `terraform plan` to review changes
4. Run `terraform apply` to update infrastructure

### CI/CD Integration

The infrastructure supports automated deployments with:
- AWS CodePipeline
- GitHub Actions
- GitLab CI/CD
- Jenkins

Example GitHub Actions workflow:
```yaml
- name: Deploy to AWS
  run: |
    terraform init
    terraform plan
    terraform apply -auto-approve
```

## Troubleshooting

### Common Issues

1. **ECS tasks not starting**
   - Check CloudWatch logs for container errors
   - Verify IAM permissions for task execution role
   - Ensure container image is accessible

2. **Database connection issues**
   - Verify security group rules
   - Check database endpoint and credentials
   - Review VPC configuration

3. **High costs**
   - Review instance sizes
   - Check data transfer costs
   - Consider using Spot instances for development

### Useful Commands

```bash
# View infrastructure status
terraform show

# Refresh state
terraform refresh

# Import existing resources
terraform import aws_instance.example i-1234567890abcdef0

# Destroy infrastructure
terraform destroy
```

## Module Structure

```
modules/
├── vpc/                 # VPC and networking
├── security_groups/     # Security group rules
├── alb/                # Application Load Balancer
├── ecs/                # ECS cluster and services
├── rds/                # PostgreSQL database
├── elasticache/        # Redis cluster
├── route53/            # DNS management
├── cloudwatch/         # Monitoring and logging
└── iam/                # IAM roles and policies
```

Each module is self-contained with its own variables, outputs, and documentation.

## State Management

For production deployments, configure remote state storage:

```hcl
terraform {
  backend "s3" {
    bucket         = "your-terraform-state-bucket"
    key            = "learning-assistant/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}
```

## Contributing

1. Follow Terraform best practices
2. Add variables for configurable options
3. Include comprehensive documentation
4. Test changes in development environment
5. Update this README for significant changes

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review AWS documentation
3. Check Terraform documentation
4. Create an issue in the project repository

## Security Considerations

- Regularly update instance AMIs
- Monitor AWS Security Hub recommendations
- Enable AWS Config for compliance
- Use AWS Systems Manager for patch management
- Implement proper secret rotation
- Regular security audits and penetration testing

## Compliance

The infrastructure is designed to meet common compliance requirements:
- SOC 2 Type II
- PCI DSS (with additional configuration)
- HIPAA (with additional encryption)
- GDPR (with proper data handling)

Review specific compliance requirements for your use case and implement additional controls as needed.