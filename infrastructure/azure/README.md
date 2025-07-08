# Azure Infrastructure for Learning Assistant

This directory contains Terraform configurations for deploying a production-ready learning assistant application on Microsoft Azure. The infrastructure follows Azure best practices and includes comprehensive security, monitoring, and high availability features.

## Architecture Overview

The infrastructure deploys the following components:

### Core Infrastructure
- **Resource Groups**: Organized by function (main, networking, monitoring)
- **Virtual Network**: Multi-subnet design with availability zones
- **Azure Kubernetes Service (AKS)**: Container orchestration with system and user node pools
- **Azure Database for PostgreSQL**: Managed database with high availability
- **Azure Cache for Redis**: In-memory caching with clustering support
- **Azure Container Registry**: Secure container image storage

### Networking & Security
- **Application Gateway**: Load balancing with Web Application Firewall (WAF)
- **Network Security Groups**: Granular network access control
- **Private Endpoints**: Secure connectivity to Azure services
- **Azure DNS**: Domain management with custom domains
- **Azure Bastion**: Secure remote access (production only)

### Identity & Access Management
- **Managed Identities**: Secure service-to-service authentication
- **Azure Active Directory**: User authentication and authorization
- **Azure Key Vault**: Centralized secrets management
- **Role-Based Access Control (RBAC)**: Granular permissions

### Monitoring & Observability
- **Application Insights**: Application performance monitoring
- **Log Analytics**: Centralized logging and analytics
- **Azure Monitor**: Metrics, alerts, and dashboards
- **Azure Security Center**: Security monitoring and recommendations

### Backup & Disaster Recovery
- **Automated Backups**: Database and storage backups
- **Geo-Redundant Storage**: Cross-region data replication
- **Traffic Manager**: Multi-region failover (production)

## Directory Structure

```
azure/
├── main.tf                 # Main infrastructure configuration
├── variables.tf            # Input variables and validation
├── outputs.tf              # Output values and connection info
├── versions.tf             # Provider versions and backend config
├── network.tf              # VNet, subnets, NSGs, and routing
├── aks.tf                  # Kubernetes cluster and node pools
├── postgresql.tf           # PostgreSQL database configuration
├── redis.tf                # Redis cache configuration
├── app-gateway.tf          # Application Gateway and WAF
├── dns.tf                  # DNS zones and records
├── monitoring.tf           # Monitoring, alerts, and observability
├── identity.tf             # Managed identities and Azure AD
├── security.tf             # Security policies and compliance
├── terraform.tfvars.example # Example configuration file
└── README.md               # This file
```

## Prerequisites

### Required Tools
- [Terraform](https://www.terraform.io/downloads) >= 1.6.0
- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) >= 2.30.0
- [kubectl](https://kubernetes.io/docs/tasks/tools/) >= 1.28.0
- [Helm](https://helm.sh/docs/intro/install/) >= 3.10.0

### Azure Permissions
Ensure your Azure account has the following permissions:
- Contributor role on the target subscription
- User Access Administrator role (for role assignments)
- Application Administrator role in Azure AD

### Environment Setup
1. Install required tools
2. Authenticate with Azure CLI:
   ```bash
   az login
   az account set --subscription "your-subscription-id"
   ```

## Deployment Guide

### 1. Configure Backend Storage (Recommended)

Create a storage account for Terraform state:

```bash
# Create resource group for Terraform state
az group create --name "terraform-state-rg" --location "East US 2"

# Create storage account
az storage account create \
  --name "yourstateaccount" \
  --resource-group "terraform-state-rg" \
  --location "East US 2" \
  --sku "Standard_LRS" \
  --encryption-services blob

# Create container
az storage container create \
  --name "terraform-state" \
  --account-name "yourstateaccount"
```

### 2. Configure Variables

1. Copy the example variables file:
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```

2. Edit `terraform.tfvars` with your specific values:
   ```hcl
   project_name = "learning-assistant"
   environment  = "dev"
   location     = "East US 2"
   dns_zone_name = "yourdomain.com"
   # ... other variables
   ```

### 3. Initialize Terraform

```bash
# Initialize with local state (for testing)
terraform init

# OR initialize with remote state (recommended)
terraform init \
  -backend-config="storage_account_name=yourstateaccount" \
  -backend-config="container_name=terraform-state" \
  -backend-config="key=learning-assistant.tfstate" \
  -backend-config="resource_group_name=terraform-state-rg"
```

### 4. Plan and Apply

```bash
# Review the deployment plan
terraform plan

# Apply the configuration
terraform apply
```

The deployment typically takes 15-30 minutes depending on the configuration.

### 5. Post-Deployment Setup

After successful deployment:

1. **Configure kubectl**:
   ```bash
   az aks get-credentials --resource-group $(terraform output -raw resource_groups | jq -r '.main.name') --name $(terraform output -raw aks | jq -r '.cluster.name')
   ```

2. **Verify cluster access**:
   ```bash
   kubectl get nodes
   kubectl get namespaces
   ```

3. **Access Key Vault secrets**:
   ```bash
   # Get Key Vault name
   KV_NAME=$(terraform output -raw key_vault | jq -r '.name')
   
   # Retrieve database connection string
   az keyvault secret show --vault-name $KV_NAME --name postgresql-connection-string --query value -o tsv
   ```

## Environment Configurations

### Development Environment
- Minimal resource allocation
- Basic monitoring
- No high availability
- Cost-optimized settings

```hcl
environment = "dev"
aks_system_node_pool = {
  node_count = 1
  vm_size = "Standard_B2s"
  max_node_count = 3
  min_node_count = 1
}
postgresql_sku_name = "B_Standard_B1ms"
redis_sku_name = "Basic"
monthly_budget_amount = 200
```

### Production Environment
- High availability configuration
- Advanced monitoring and alerting
- Security hardening
- Disaster recovery

```hcl
environment = "prod"
postgresql_enable_high_availability = true
postgresql_geo_redundant_backup = true
redis_sku_name = "Premium"
app_gateway_enable_waf = true
enable_azure_defender = true
enable_disaster_recovery = true
monthly_budget_amount = 2000
```

## Security Features

### Network Security
- Private subnets with NSG rules
- WAF protection with OWASP rule sets
- DDoS protection (production)
- Network traffic analytics

### Identity & Access
- Managed identities for secure authentication
- Azure AD integration
- RBAC with least privilege principles
- Key Vault for secrets management

### Monitoring & Compliance
- Azure Security Center integration
- Policy-based compliance monitoring
- Security incident automation
- Audit logging and retention

### Data Protection
- Encryption at rest and in transit
- Geo-redundant backups
- Private endpoints for data services
- Advanced threat protection

## Monitoring & Alerting

### Application Insights
- Application performance monitoring
- Dependency tracking
- Custom metrics and events
- Availability testing

### Azure Monitor
- Infrastructure metrics
- Log aggregation and analysis
- Custom dashboards
- Alert rules and action groups

### Cost Management
- Budget alerts and thresholds
- Cost analysis and optimization
- Resource tagging for cost allocation
- Automated cost recommendations

## Maintenance & Operations

### Regular Tasks
- Review security recommendations
- Monitor resource utilization
- Update Kubernetes versions
- Rotate secrets and certificates

### Backup & Recovery
- Automated database backups
- Storage account replication
- Disaster recovery testing
- Documentation of recovery procedures

### Updates & Patches
- AKS cluster updates
- Node pool maintenance
- Security patch management
- Application updates

## Troubleshooting

### Common Issues

1. **Terraform Backend Errors**:
   - Ensure storage account exists and is accessible
   - Verify Azure CLI authentication
   - Check subscription permissions

2. **AKS Deployment Failures**:
   - Verify subnet configurations
   - Check Azure service quotas
   - Review identity permissions

3. **Application Gateway Issues**:
   - Validate SSL certificate configuration
   - Check backend pool health
   - Review NSG rules

4. **DNS Configuration Problems**:
   - Verify domain ownership
   - Check DNS zone delegation
   - Validate certificate requests

### Useful Commands

```bash
# Check Terraform state
terraform state list
terraform state show <resource>

# Debug AKS issues
kubectl describe nodes
kubectl get events --sort-by=.metadata.creationTimestamp

# Check Application Gateway backend health
az network application-gateway show-backend-health \
  --resource-group <rg-name> \
  --name <gateway-name>

# View Key Vault secrets
az keyvault secret list --vault-name <vault-name>
```

## Cost Optimization

### Development Environment
- Use Basic/Standard SKUs where possible
- Enable auto-scaling with appropriate limits
- Implement scheduled start/stop for non-production
- Monitor and right-size resources

### Production Environment
- Use Reserved Instances for predictable workloads
- Implement Azure Advisor recommendations
- Regular cost reviews and optimization
- Use Azure Cost Management tools

## Contributing

When making changes to the infrastructure:

1. Test changes in development environment first
2. Follow Infrastructure as Code best practices
3. Update documentation and comments
4. Use meaningful commit messages
5. Review security implications

## Support

For issues and questions:
- Check the troubleshooting section
- Review Azure documentation
- Consult Terraform Azure provider docs
- Contact the platform team

## References

- [Azure Well-Architected Framework](https://docs.microsoft.com/en-us/azure/architecture/framework/)
- [AKS Best Practices](https://docs.microsoft.com/en-us/azure/aks/best-practices)
- [Terraform Azure Provider](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [Azure Security Benchmark](https://docs.microsoft.com/en-us/security/benchmark/azure/)