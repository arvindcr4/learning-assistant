# VPC Module

A comprehensive multi-cloud VPC module that provides consistent networking infrastructure across AWS, GCP, and Azure. This module creates a secure, scalable, and well-architected network foundation for your applications.

## Features

- **Multi-cloud support**: Deploy to AWS, GCP, or Azure with a consistent interface
- **High availability**: Multi-AZ deployment with automatic failover
- **Security**: Built-in security groups, NACLs, and flow logs
- **Cost optimization**: Options for single NAT gateway or NAT instances
- **Compliance**: Support for various compliance frameworks
- **Monitoring**: VPC flow logs and network monitoring
- **Scalability**: Flexible subnet configuration for different tiers

## Usage

### Basic Usage

```hcl
module "vpc" {
  source = "./modules/networking/vpc"
  
  cloud_provider = "aws"
  project_name   = "learning-assistant"
  environment    = "prod"
  
  vpc_cidr        = "10.0.0.0/16"
  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  private_subnets = ["10.0.10.0/24", "10.0.20.0/24", "10.0.30.0/24"]
  
  enable_nat_gateway = true
  enable_flow_logs   = true
  
  tags = {
    Owner = "devops-team"
    CostCenter = "engineering"
  }
}
```

### AWS Usage

```hcl
module "vpc_aws" {
  source = "./modules/networking/vpc"
  
  cloud_provider = "aws"
  aws_region     = "us-west-2"
  
  project_name = "learning-assistant"
  environment  = "prod"
  
  vpc_cidr        = "10.0.0.0/16"
  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  private_subnets = ["10.0.10.0/24", "10.0.20.0/24", "10.0.30.0/24"]
  
  enable_nat_gateway = true
  enable_flow_logs   = true
  
  # Cost optimization
  single_nat_gateway = false
  
  # Security
  compliance_framework = "soc2"
  data_classification  = "confidential"
  
  tags = {
    Owner = "devops-team"
    CostCenter = "engineering"
  }
}
```

### GCP Usage

```hcl
module "vpc_gcp" {
  source = "./modules/networking/vpc"
  
  cloud_provider = "gcp"
  gcp_project_id = "my-gcp-project"
  gcp_region     = "us-central1"
  
  project_name = "learning-assistant"
  environment  = "prod"
  
  vpc_cidr        = "10.0.0.0/16"
  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  private_subnets = ["10.0.10.0/24", "10.0.20.0/24", "10.0.30.0/24"]
  
  enable_nat_gateway = true
  
  tags = {
    owner = "devops-team"
    cost-center = "engineering"
  }
}
```

### Azure Usage

```hcl
module "vpc_azure" {
  source = "./modules/networking/vpc"
  
  cloud_provider            = "azure"
  azure_location           = "West US 2"
  azure_resource_group_name = "rg-learning-assistant-prod"
  
  project_name = "learning-assistant"
  environment  = "prod"
  
  vpc_cidr        = "10.0.0.0/16"
  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  private_subnets = ["10.0.10.0/24", "10.0.20.0/24", "10.0.30.0/24"]
  
  enable_nat_gateway = true
  
  tags = {
    Owner = "devops-team"
    CostCenter = "engineering"
  }
}
```

### Advanced Usage with Network Segmentation

```hcl
module "vpc_advanced" {
  source = "./modules/networking/vpc"
  
  cloud_provider = "aws"
  project_name   = "learning-assistant"
  environment    = "prod"
  
  vpc_cidr        = "10.0.0.0/16"
  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  private_subnets = ["10.0.10.0/24", "10.0.20.0/24", "10.0.30.0/24"]
  
  # Network segmentation
  enable_network_segmentation = true
  database_subnets = ["10.0.40.0/24", "10.0.50.0/24", "10.0.60.0/24"]
  cache_subnets    = ["10.0.70.0/24", "10.0.80.0/24", "10.0.90.0/24"]
  
  # High availability
  multi_az = true
  
  # Security
  enable_flow_logs = true
  enable_network_acls = true
  compliance_framework = "pci-dss"
  
  # Cost optimization
  single_nat_gateway = false
  enable_nat_instance = false
  
  # Monitoring
  flow_log_retention_days = 90
  
  tags = {
    Owner = "devops-team"
    CostCenter = "engineering"
    Environment = "production"
  }
}
```

## Module Structure

```
modules/networking/vpc/
├── main.tf           # Main resource definitions
├── variables.tf      # Input variable definitions
├── outputs.tf        # Output value definitions
├── versions.tf       # Provider version constraints
└── README.md         # This documentation
```

## Requirements

| Name | Version |
|------|---------|
| terraform | >= 1.0 |
| aws | ~> 5.0 |
| google | ~> 4.0 |
| azurerm | ~> 3.0 |

## Providers

| Name | Version |
|------|---------|
| aws | ~> 5.0 |
| google | ~> 4.0 |
| azurerm | ~> 3.0 |

## Resources

### AWS Resources

| Name | Type |
|------|------|
| aws_vpc.main | resource |
| aws_internet_gateway.main | resource |
| aws_subnet.public | resource |
| aws_subnet.private | resource |
| aws_route_table.public | resource |
| aws_route_table.private | resource |
| aws_route_table_association.public | resource |
| aws_route_table_association.private | resource |
| aws_nat_gateway.main | resource |
| aws_eip.nat | resource |
| aws_flow_log.vpc_flow_log | resource |
| aws_cloudwatch_log_group.vpc_flow_log | resource |
| aws_iam_role.flow_log | resource |
| aws_iam_role_policy.flow_log | resource |

### GCP Resources

| Name | Type |
|------|------|
| google_compute_network.main | resource |
| google_compute_subnetwork.public | resource |
| google_compute_subnetwork.private | resource |
| google_compute_firewall.allow_internal | resource |
| google_compute_router.main | resource |
| google_compute_router_nat.main | resource |

### Azure Resources

| Name | Type |
|------|------|
| azurerm_virtual_network.main | resource |
| azurerm_subnet.public | resource |
| azurerm_subnet.private | resource |
| azurerm_network_security_group.public | resource |
| azurerm_network_security_group.private | resource |
| azurerm_public_ip.nat | resource |
| azurerm_nat_gateway.main | resource |
| azurerm_nat_gateway_public_ip_association.main | resource |
| azurerm_subnet_nat_gateway_association.private | resource |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| cloud_provider | Cloud provider to use (aws, gcp, azure) | `string` | n/a | yes |
| project_name | Name of the project | `string` | n/a | yes |
| environment | Environment name (dev, staging, prod) | `string` | n/a | yes |
| vpc_cidr | CIDR block for VPC | `string` | `"10.0.0.0/16"` | no |
| public_subnets | List of public subnet CIDR blocks | `list(string)` | `["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]` | no |
| private_subnets | List of private subnet CIDR blocks | `list(string)` | `["10.0.10.0/24", "10.0.20.0/24", "10.0.30.0/24"]` | no |
| enable_nat_gateway | Enable NAT Gateway for private subnets | `bool` | `true` | no |
| enable_flow_logs | Enable VPC Flow Logs | `bool` | `true` | no |
| tags | Additional tags to apply to resources | `map(string)` | `{}` | no |
| aws_region | AWS region | `string` | `"us-west-2"` | no |
| gcp_project_id | GCP project ID | `string` | `""` | no |
| gcp_region | GCP region | `string` | `"us-central1"` | no |
| azure_location | Azure location | `string` | `"West US 2"` | no |
| azure_resource_group_name | Azure resource group name | `string` | `""` | no |

## Outputs

| Name | Description |
|------|-------------|
| vpc_id | ID of the VPC |
| vpc_arn | ARN of the VPC (AWS only) |
| vpc_cidr_block | CIDR block of the VPC |
| public_subnet_ids | IDs of the public subnets |
| private_subnet_ids | IDs of the private subnets |
| internet_gateway_id | ID of the Internet Gateway |
| nat_gateway_ids | IDs of the NAT Gateways |
| nat_gateway_public_ips | Public IP addresses of the NAT Gateways |
| availability_zones | List of availability zones |
| common_tags | Common tags applied to all resources |

## Security Features

- **Network Segmentation**: Separate subnets for different tiers (public, private, database, cache)
- **Security Groups**: Dedicated security groups for each tier
- **Network ACLs**: Additional layer of security at the subnet level
- **Flow Logs**: Network traffic monitoring and analysis
- **Compliance**: Support for PCI-DSS, HIPAA, SOC2, and GDPR requirements
- **Encryption**: Traffic encryption in transit and at rest where supported

## Cost Optimization Features

- **Single NAT Gateway**: Option to use single NAT gateway across all AZs
- **NAT Instances**: Use NAT instances instead of NAT gateways for cost savings
- **Resource Tagging**: Comprehensive tagging for cost allocation
- **Multi-AZ Control**: Option to disable multi-AZ for development environments

## Monitoring and Logging

- **VPC Flow Logs**: Capture network traffic for security and troubleshooting
- **CloudWatch Integration**: Log aggregation and monitoring
- **Network Metrics**: Built-in networking metrics and dashboards
- **Alerting**: Configurable alerts for network anomalies

## Best Practices

1. **Use consistent CIDR blocks** across environments
2. **Enable flow logs** for security monitoring
3. **Implement network segmentation** for different application tiers
4. **Use multi-AZ deployment** for high availability
5. **Tag all resources** for cost allocation and management
6. **Follow compliance requirements** based on your industry
7. **Monitor network costs** and optimize as needed

## Examples

See the `examples/` directory for complete working examples of how to use this module in different scenarios.

## Testing

This module includes comprehensive testing:
- Unit tests for resource creation
- Integration tests for multi-cloud scenarios
- Security tests for compliance validation
- Performance tests for scalability

## Contributing

Please see the [CONTRIBUTING.md](../../../CONTRIBUTING.md) file for information on how to contribute to this module.

## License

This module is licensed under the MIT License. See [LICENSE](../../../LICENSE) for details.