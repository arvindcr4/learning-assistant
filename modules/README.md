# Multi-Cloud Infrastructure Modules

This repository contains Terraform modules for deploying infrastructure across multiple cloud providers (AWS, GCP, Azure, and DigitalOcean).

## Available Modules

### 1. Network Module (`network/`)
Creates VPC/VNet infrastructure with public and private subnets, NAT gateways, and routing.

**Key Variables:**
- `cloud_provider`: Target cloud provider
- `cidr_block`: CIDR block for the network
- `public_subnet_cidrs`: CIDR blocks for public subnets
- `private_subnet_cidrs`: CIDR blocks for private subnets

**Outputs:**
- `vpc_id`: VPC/VNet identifier
- `public_subnet_ids`: List of public subnet IDs
- `private_subnet_ids`: List of private subnet IDs

### 2. Container Service Module (`container_service/`)
Deploys containerized applications with autoscaling and health checks.

**Key Variables:**
- `image`: Container image URL
- `cpu`: CPU allocation
- `memory`: Memory allocation
- `min_count`/`max_count`: Autoscaling limits
- `health_check_path`: Health check endpoint

**Outputs:**
- `service_endpoint`: Service URL
- `iam_role_arn`: Service IAM role/identity

### 3. PostgreSQL Database Module (`database_postgres/`)
Creates managed PostgreSQL instances with configurable backups and security.

**Key Variables:**
- `engine_version`: PostgreSQL version
- `instance_class`: Instance size
- `allocated_storage`: Storage in GB
- `backup_retention_period`: Backup retention days
- `multi_az`: High availability option

**Outputs:**
- `endpoint`: Database connection endpoint
- `connection_string`: PostgreSQL connection string
- `password_secret_arn`: Secret containing the password

### 4. Redis Cache Module (`cache_redis/`)
Deploys managed Redis instances for caching.

**Key Variables:**
- `node_type`: Instance type
- `num_cache_nodes`: Number of nodes
- `enable_cluster_mode`: Enable Redis cluster mode
- `transit_encryption_enabled`: Enable encryption in transit

**Outputs:**
- `endpoint`: Redis endpoint
- `connection_string`: Redis connection string
- `auth_token_secret_arn`: Secret containing auth token

### 5. CDN Module (`cdn/`)
Creates content delivery networks for static content acceleration.

**Key Variables:**
- `origin_domain_name`: Origin server domain
- `custom_domain_names`: Custom domains for CDN
- `viewer_protocol_policy`: HTTP/HTTPS policy
- `default_ttl`: Default cache TTL

**Outputs:**
- `cdn_url`: CDN endpoint URL
- `distribution_id`: CDN distribution identifier

### 6. Object Storage Module (`object_storage/`)
Creates object storage buckets (S3/GCS/Blob/Spaces).

**Key Variables:**
- `bucket_name`: Bucket name
- `versioning`: Enable versioning
- `encryption_enabled`: Enable encryption at rest
- `lifecycle_rules`: Object lifecycle policies

**Outputs:**
- `bucket_domain_name`: Bucket domain
- `website_endpoint`: Static hosting endpoint (if enabled)

### 7. DNS Module (`dns/`)
Manages DNS zones and records.

**Key Variables:**
- `domain_name`: Domain name
- `records`: DNS records to create
- `private_zone`: Create private DNS zone

**Outputs:**
- `zone_id`: DNS zone identifier
- `name_servers`: DNS name servers

### 8. TLS Certificate Module (`tls_cert/`)
Creates and manages SSL/TLS certificates.

**Key Variables:**
- `domain_name`: Primary domain
- `subject_alternative_names`: Additional domains
- `validation_method`: DNS or EMAIL validation

**Outputs:**
- `certificate_arn`: Certificate identifier
- `validation_records`: DNS validation records

### 9. Monitoring Module (`monitoring/`)
Sets up monitoring, logging, and alerting infrastructure.

**Key Variables:**
- `monitoring_type`: prometheus, cloud-native, or hybrid
- `retention_days`: Log retention period
- `alert_endpoints`: Alert notification endpoints
- `metric_alarms`: Metric-based alarms

**Outputs:**
- `dashboard_urls`: Monitoring dashboard URLs
- `prometheus_endpoint`: Prometheus endpoint (if applicable)
- `grafana_endpoint`: Grafana endpoint (if applicable)

## Usage Example

```hcl
# Network setup
module "network" {
  source = "./modules/network"
  
  cloud_provider = "aws"
  name          = "production"
  cidr_block    = "10.0.0.0/16"
}

# Container service
module "app" {
  source = "./modules/container_service"
  
  cloud_provider = "aws"
  name          = "web-app"
  image         = "myapp:latest"
  cpu           = "512"
  memory        = "1024"
  vpc_id        = module.network.vpc_id
  subnet_ids    = module.network.private_subnet_ids
}

# PostgreSQL database
module "database" {
  source = "./modules/database_postgres"
  
  cloud_provider    = "aws"
  name             = "app-db"
  engine_version   = "13"
  instance_class   = "db.t3.small"
  master_password  = var.db_password
  vpc_id           = module.network.vpc_id
  subnet_ids       = module.network.private_subnet_ids
}

# Redis cache
module "cache" {
  source = "./modules/cache_redis"
  
  cloud_provider = "aws"
  name          = "app-cache"
  node_type     = "cache.t3.micro"
  vpc_id        = module.network.vpc_id
  subnet_ids    = module.network.private_subnet_ids
}

# Monitoring
module "monitoring" {
  source = "./modules/monitoring"
  
  cloud_provider   = "aws"
  name            = "app-monitoring"
  monitoring_type = "cloud-native"
  
  alert_endpoints = [
    {
      type     = "email"
      endpoint = "ops@example.com"
    }
  ]
}
```

## Cloud Provider Support

Each module supports the following cloud providers:
- **AWS**: Amazon Web Services
- **GCP**: Google Cloud Platform
- **Azure**: Microsoft Azure
- **DigitalOcean**: DigitalOcean

## Module Structure

Each module follows a consistent structure:
```
module_name/
├── variables.tf    # Input variables
├── main.tf        # Main logic with provider selection
├── outputs.tf     # Output values
├── aws/           # AWS-specific implementation
├── gcp/           # GCP-specific implementation
├── azure/         # Azure-specific implementation
└── digitalocean/  # DigitalOcean-specific implementation
```

## Best Practices

1. **Secrets Management**: Never commit secrets. Use environment variables or secret management services.
2. **State Management**: Use remote state backends (S3, GCS, Azure Storage).
3. **Naming Conventions**: Use consistent naming across all resources.
4. **Tagging**: Apply tags consistently for cost tracking and management.
5. **Security**: Enable encryption at rest and in transit for all services.

## Contributing

When adding new modules or cloud provider support:
1. Follow the existing module structure
2. Ensure all variables have descriptions and defaults where appropriate
3. Document all outputs
4. Test on each supported cloud provider
5. Update this README with module documentation
