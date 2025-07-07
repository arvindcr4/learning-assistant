# Terraform AWS Deployment for Learning Assistant

This directory contains Terraform configuration files to deploy the Learning Assistant Next.js application on AWS using a production-ready infrastructure setup.

## Architecture Overview

The Terraform configuration creates the following AWS infrastructure:

- **VPC**: Custom VPC with public, private, and database subnets across multiple AZs
- **ECS Fargate**: Container orchestration for running the Next.js application
- **RDS PostgreSQL**: Managed database service in private subnets
- **Application Load Balancer**: HTTPS load balancer with SSL termination
- **Auto Scaling**: Automatic scaling based on CPU and memory utilization
- **CloudWatch**: Logging and monitoring with alarms
- **Route 53**: Optional DNS management
- **Security Groups**: Least privilege security model
- **S3**: ALB access logs storage

## Prerequisites

Before deploying, ensure you have:

1. **AWS CLI configured** with appropriate credentials
2. **Terraform installed** (>= 1.0)
3. **Docker image** of your application pushed to ECR or Docker Hub
4. **SSL certificate** in AWS Certificate Manager (for HTTPS)
5. **Domain name** (optional, for custom DNS)

## File Structure

```
├── main.tf                      # Main infrastructure configuration
├── variables.tf                 # Input variables with validation
├── outputs.tf                   # Output values and deployment summary
├── terraform.tfvars.example     # Example variables file
└── README-terraform.md          # This documentation
```

## Quick Start

### 1. Prepare Your Environment

```bash
# Clone the repository and navigate to the terraform directory
cd learning-assistant

# Copy the example variables file
cp terraform.tfvars.example terraform.tfvars

# Edit the variables file with your specific values
nano terraform.tfvars
```

### 2. Configure Variables

Edit `terraform.tfvars` with your specific values. Key variables to configure:

```hcl
# Required variables
aws_region = "us-east-1"
app_image = "your-account-id.dkr.ecr.us-east-1.amazonaws.com/learning-assistant:latest"
db_password = "your-secure-password-here"

# Optional but recommended
ssl_certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/..."
domain_name = "yourdomain.com"
alert_email = "admin@yourdomain.com"
```

### 3. Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Review the deployment plan
terraform plan

# Apply the configuration
terraform apply
```

### 4. Post-Deployment Setup

After deployment completes, Terraform will output important information including:

- Application URL
- Database connection details
- DNS configuration steps (if using custom domain)
- Monitoring and logging information

## Configuration Options

### Environment-Specific Deployments

The configuration supports multiple environments. Examples are provided in `terraform.tfvars.example`:

#### Development Environment
- Minimal resources to reduce costs
- Single AZ deployment option
- Smaller instance types
- Reduced backup retention

#### Staging Environment
- Production-like setup
- Multi-AZ for testing
- Moderate scaling limits
- Extended logging retention

#### Production Environment
- High availability across multiple AZs
- Enhanced monitoring and alerting
- Automatic backups and point-in-time recovery
- Comprehensive security configurations

### Key Configuration Categories

#### Network Configuration
- VPC CIDR and subnet allocation
- NAT Gateway configuration (can be disabled to reduce costs)
- Security group rules

#### Database Configuration
- PostgreSQL version and instance type
- Storage allocation and auto-scaling
- Backup and maintenance windows
- Performance monitoring settings

#### ECS Configuration
- Container CPU and memory allocation
- Service desired count and scaling limits
- Environment variables and secrets

#### Load Balancer Configuration
- SSL certificate configuration
- Access logging and retention
- Health check settings

#### Monitoring Configuration
- CloudWatch log retention
- Alert thresholds and email notifications
- Enhanced monitoring for RDS

## Security Features

### Network Security
- **Private Subnets**: ECS tasks and RDS instances in private subnets
- **Security Groups**: Least privilege access control
- **NAT Gateway**: Controlled outbound internet access

### Data Security
- **Encryption at Rest**: RDS storage encryption enabled
- **Encryption in Transit**: HTTPS/SSL termination at ALB
- **Secrets Management**: Sensitive data handled through Terraform variables

### Access Control
- **IAM Roles**: Least privilege roles for ECS tasks
- **Resource-Based Policies**: S3 bucket policies for ALB logs
- **VPC Isolation**: Network-level isolation

## Monitoring and Logging

### CloudWatch Integration
- **Application Logs**: ECS task logs in CloudWatch
- **Infrastructure Metrics**: CPU, memory, network utilization
- **Custom Alarms**: High resource utilization alerts

### Alerting
- **SNS Topics**: Email notifications for critical alerts
- **Threshold-Based Alerts**: CPU, memory, and database metrics
- **Health Check Monitoring**: Application availability alerts

## Cost Optimization

### Development Environment Cost Savings
```hcl
# Minimal configuration for development
enable_nat_gateway = false           # Reduces NAT Gateway costs
db_instance_class = "db.t3.micro"    # Use free tier eligible instance
ecs_task_cpu = 256                   # Minimal CPU allocation
ecs_autoscaling_max_capacity = 3     # Limit scaling
```

### Production Environment Cost Management
- **Auto Scaling**: Automatic scaling based on demand
- **Spot Instances**: Optional Fargate Spot capacity
- **Storage Optimization**: GP3 storage with optimized IOPS
- **Log Retention**: Configurable retention periods

## Backup and Disaster Recovery

### Database Backups
- **Automated Backups**: Daily backups with configurable retention
- **Point-in-Time Recovery**: Up to backup retention period
- **Cross-AZ Deployment**: High availability setup

### Application Recovery
- **Multi-AZ Deployment**: Automatic failover capability
- **Blue-Green Deployments**: Support for zero-downtime updates
- **Infrastructure as Code**: Complete environment recreation capability

## Troubleshooting

### Common Issues

#### ECS Tasks Not Starting
```bash
# Check ECS service events
aws ecs describe-services --cluster learning-assistant-cluster --services learning-assistant-service

# Check CloudWatch logs
aws logs tail /ecs/learning-assistant --follow
```

#### Database Connection Issues
```bash
# Test database connectivity from ECS
aws ecs execute-command --cluster learning-assistant-cluster --task TASK-ID --interactive --command "/bin/bash"
```

#### SSL Certificate Issues
- Ensure certificate is in the same region as the load balancer
- Verify certificate includes all necessary domain names
- Check certificate validation status in AWS Console

### Debugging Commands

```bash
# View Terraform state
terraform show

# Check specific resource
terraform state show aws_ecs_service.main

# View outputs
terraform output

# Plan changes
terraform plan -detailed-exitcode
```

## Updating the Infrastructure

### Application Updates
```bash
# Update the app_image variable in terraform.tfvars
app_image = "your-registry/learning-assistant:new-version"

# Apply the change
terraform apply
```

### Infrastructure Updates
```bash
# Update any variables in terraform.tfvars
# Review changes
terraform plan

# Apply updates
terraform apply
```

### Rolling Back Changes
```bash
# Revert to previous configuration
git checkout HEAD~1 -- terraform.tfvars

# Apply previous configuration
terraform apply
```

## Cleanup

To destroy all infrastructure:

```bash
# Review what will be destroyed
terraform plan -destroy

# Destroy infrastructure
terraform destroy
```

**Warning**: This will permanently delete all resources including the database. Ensure you have backups if needed.

## Support and Maintenance

### Regular Maintenance Tasks
1. **Security Updates**: Keep Terraform and AWS provider updated
2. **Certificate Renewal**: Monitor SSL certificate expiration
3. **Cost Review**: Regular cost analysis and optimization
4. **Backup Testing**: Periodic backup restoration testing

### Best Practices
1. **Version Control**: Always commit infrastructure changes
2. **Environment Separation**: Use separate state files for different environments
3. **State Management**: Consider using remote state with S3 backend
4. **Documentation**: Keep this README updated with changes

## Additional Resources

- [Terraform AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/)
- [AWS RDS Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html)
- [AWS Application Load Balancer Guide](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/)

For specific issues or questions, please refer to the AWS documentation or create an issue in the project repository.