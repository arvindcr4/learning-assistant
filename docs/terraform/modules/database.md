# Database Module Documentation

The Database module provides PostgreSQL database infrastructure with multi-cloud support, automated backups, monitoring, and high availability features.

## 📋 Module Overview

### Purpose
This module creates and manages PostgreSQL database instances across multiple cloud providers with consistent configuration and best practices.

### Features
- ✅ Multi-cloud support (AWS RDS, GCP Cloud SQL, Azure Database, DigitalOcean)
- ✅ Automated backups with configurable retention
- ✅ High availability with Multi-AZ deployment
- ✅ Encryption at rest and in transit
- ✅ Performance monitoring and insights
- ✅ Connection pooling and optimization
- ✅ Disaster recovery capabilities
- ✅ Cost optimization features

### Supported Cloud Providers
- **AWS**: RDS PostgreSQL
- **GCP**: Cloud SQL for PostgreSQL
- **Azure**: Database for PostgreSQL
- **DigitalOcean**: Managed PostgreSQL

## 🏗️ Architecture

### Database Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Database Architecture                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   AZ-1a     │  │   AZ-1b     │  │   AZ-1c     │              │
│  │             │  │             │  │             │              │
│  │ ┌─────────┐ │  │ ┌─────────┐ │  │ ┌─────────┐ │              │
│  │ │Primary  │ │  │ │Replica  │ │  │ │Replica  │ │              │
│  │ │Database │ │  │ │Database │ │  │ │Database │ │              │
│  │ │         │ │  │ │         │ │  │ │         │ │              │
│  │ │PostgreSQL│ │  │ │PostgreSQL│ │  │ │PostgreSQL│ │              │
│  │ └─────────┘ │  │ └─────────┘ │  │ └─────────┘ │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Backup & Monitoring                      ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         ││
│  │  │   Backups   │  │ Monitoring  │  │   Logging   │         ││
│  │  │             │  │             │  │             │         ││
│  │  │ Point-in-   │  │ Performance │  │ Query Logs  │         ││
│  │  │ Time        │  │ Insights    │  │ Error Logs  │         ││
│  │  │ Recovery    │  │ Metrics     │  │ Audit Logs  │         ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘         ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### High-Level Components

#### Primary Database
- **Purpose**: Main read/write database instance
- **Features**: ACID compliance, full PostgreSQL features
- **Replication**: Synchronous replication to standby
- **Backups**: Automated daily backups

#### Read Replicas
- **Purpose**: Scale read operations
- **Features**: Asynchronous replication
- **Distribution**: Multi-AZ deployment
- **Load Balancing**: Application-level read distribution

#### Backup System
- **Automated Backups**: Daily backup schedule
- **Point-in-Time Recovery**: WAL-based recovery
- **Cross-Region**: Optional cross-region backup
- **Retention**: Configurable retention period

## 🚀 Usage

### Basic Usage

```hcl
module "database" {
  source = "./modules/database_postgres"
  
  # Basic configuration
  name           = "learning-assistant-db"
  engine_version = "14.9"
  
  # Instance configuration
  instance_class     = "db.t3.micro"
  allocated_storage  = 20
  storage_type      = "gp2"
  
  # Database configuration
  database_name   = "learning_assistant"
  master_username = "postgres"
  master_password = var.database_password
  
  # Network configuration
  vpc_id              = module.network.vpc_id
  subnet_ids          = module.network.database_subnets
  allowed_cidr_blocks = [module.network.vpc_cidr]
  
  # Basic features
  backup_retention_period = 7
  
  # Tagging
  environment = var.environment
  tags = local.common_tags
}
```

### Advanced Usage

```hcl
module "database" {
  source = "./modules/database_postgres"
  
  # Advanced configuration
  name           = "learning-assistant-db-prod"
  engine_version = "14.9"
  
  # High-performance instance
  instance_class     = "db.r5.xlarge"
  allocated_storage  = 500
  max_allocated_storage = 1000
  storage_type      = "gp3"
  storage_throughput = 3000
  storage_iops      = 12000
  
  # Database configuration
  database_name   = "learning_assistant"
  master_username = "postgres"
  master_password = var.database_password
  
  # Network configuration
  vpc_id              = module.network.vpc_id
  subnet_ids          = module.network.database_subnets
  allowed_cidr_blocks = [module.network.vpc_cidr]
  publicly_accessible = false
  
  # High availability
  multi_az = true
  backup_retention_period = 30
  backup_window = "03:00-04:00"
  maintenance_window = "sun:04:00-sun:05:00"
  
  # Security
  enable_encryption = true
  enable_deletion_protection = true
  enable_backup_encryption = true
  
  # Monitoring
  enable_performance_insights = true
  performance_insights_retention_period = 7
  enable_logging = true
  
  # Read replicas
  create_read_replica = true
  read_replica_count = 2
  
  # Tagging
  environment = var.environment
  tags = merge(local.common_tags, {
    Tier = "Database"
    Backup = "Required"
  })
}
```

### Multi-Cloud Usage

#### AWS Configuration
```hcl
module "database_aws" {
  source = "./modules/database_postgres"
  
  cloud_provider = "aws"
  aws_region     = "us-east-1"
  
  # AWS-specific configuration
  instance_class = "db.t3.micro"
  engine_version = "14.9"
  
  # AWS features
  enable_performance_insights = true
  enable_enhanced_monitoring = true
  monitoring_interval = 60
}
```

#### GCP Configuration
```hcl
module "database_gcp" {
  source = "./modules/database_postgres"
  
  cloud_provider = "gcp"
  gcp_project    = var.gcp_project
  gcp_region     = "us-central1"
  
  # GCP-specific configuration
  instance_type = "db-f1-micro"
  database_version = "POSTGRES_14"
  
  # GCP features
  enable_backup = true
  backup_time = "03:00"
  enable_binary_log_backup = true
}
```

#### Azure Configuration
```hcl
module "database_azure" {
  source = "./modules/database_postgres"
  
  cloud_provider = "azure"
  resource_group_name = var.azure_resource_group
  location = "East US"
  
  # Azure-specific configuration
  sku_name = "B_Gen5_1"
  server_version = "11"
  
  # Azure features
  backup_retention_days = 7
  geo_redundant_backup = true
  auto_grow_enabled = true
}
```

## 📊 Variables

### Required Variables

| Name | Type | Description |
|------|------|-------------|
| `name` | `string` | Database instance name |
| `engine_version` | `string` | PostgreSQL version |
| `instance_class` | `string` | Database instance class |
| `allocated_storage` | `number` | Initial storage size in GB |
| `database_name` | `string` | Initial database name |
| `master_username` | `string` | Master database username |
| `master_password` | `string` | Master database password |
| `vpc_id` | `string` | VPC ID for database placement |
| `subnet_ids` | `list(string)` | Subnet IDs for database placement |

### Optional Variables

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `cloud_provider` | `string` | `"aws"` | Cloud provider (aws, gcp, azure, digitalocean) |
| `storage_type` | `string` | `"gp2"` | Storage type |
| `storage_encrypted` | `bool` | `true` | Enable storage encryption |
| `kms_key_id` | `string` | `null` | KMS key ID for encryption |
| `multi_az` | `bool` | `false` | Enable Multi-AZ deployment |
| `publicly_accessible` | `bool` | `false` | Enable public access |
| `backup_retention_period` | `number` | `7` | Backup retention period in days |
| `backup_window` | `string` | `"03:00-04:00"` | Backup window |
| `maintenance_window` | `string` | `"sun:04:00-sun:05:00"` | Maintenance window |
| `enable_deletion_protection` | `bool` | `false` | Enable deletion protection |
| `enable_performance_insights` | `bool` | `false` | Enable performance insights |
| `enable_logging` | `bool` | `false` | Enable database logging |
| `allowed_cidr_blocks` | `list(string)` | `[]` | CIDR blocks allowed access |
| `create_read_replica` | `bool` | `false` | Create read replicas |
| `read_replica_count` | `number` | `1` | Number of read replicas |
| `parameter_group_name` | `string` | `null` | Custom parameter group name |
| `option_group_name` | `string` | `null` | Custom option group name |
| `tags` | `map(string)` | `{}` | Resource tags |

### Cloud-Specific Variables

#### AWS Variables
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `aws_region` | `string` | `null` | AWS region |
| `availability_zone` | `string` | `null` | Preferred AZ |
| `enable_enhanced_monitoring` | `bool` | `false` | Enable enhanced monitoring |
| `monitoring_interval` | `number` | `0` | Monitoring interval |
| `monitoring_role_arn` | `string` | `null` | Monitoring role ARN |
| `performance_insights_retention_period` | `number` | `7` | Performance insights retention |

#### GCP Variables
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `gcp_project` | `string` | `null` | GCP project ID |
| `gcp_region` | `string` | `null` | GCP region |
| `database_version` | `string` | `"POSTGRES_14"` | Database version |
| `tier` | `string` | `"db-f1-micro"` | Instance tier |
| `disk_size` | `number` | `20` | Disk size in GB |
| `disk_type` | `string` | `"PD_SSD"` | Disk type |

#### Azure Variables
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `resource_group_name` | `string` | `null` | Resource group name |
| `location` | `string` | `null` | Azure location |
| `sku_name` | `string` | `"B_Gen5_1"` | SKU name |
| `server_version` | `string` | `"11"` | Server version |
| `storage_mb` | `number` | `5120` | Storage in MB |
| `auto_grow_enabled` | `bool` | `true` | Enable auto-grow |
| `backup_retention_days` | `number` | `7` | Backup retention days |
| `geo_redundant_backup` | `bool` | `false` | Enable geo-redundant backup |

## 📤 Outputs

### Database Endpoints

| Name | Type | Description |
|------|------|-------------|
| `db_instance_id` | `string` | Database instance ID |
| `db_instance_arn` | `string` | Database instance ARN |
| `db_instance_endpoint` | `string` | Database endpoint |
| `db_instance_port` | `number` | Database port |
| `db_instance_name` | `string` | Database name |
| `db_instance_username` | `string` | Database master username |
| `db_instance_resource_id` | `string` | Database resource ID |

### Read Replicas

| Name | Type | Description |
|------|------|-------------|
| `read_replica_endpoints` | `list(string)` | Read replica endpoints |
| `read_replica_ids` | `list(string)` | Read replica IDs |
| `read_replica_arns` | `list(string)` | Read replica ARNs |

### Security Groups

| Name | Type | Description |
|------|------|-------------|
| `db_security_group_id` | `string` | Database security group ID |
| `db_security_group_arn` | `string` | Database security group ARN |

### Subnet Groups

| Name | Type | Description |
|------|------|-------------|
| `db_subnet_group_id` | `string` | Database subnet group ID |
| `db_subnet_group_arn` | `string` | Database subnet group ARN |

### Parameter Groups

| Name | Type | Description |
|------|------|-------------|
| `db_parameter_group_id` | `string` | Database parameter group ID |
| `db_parameter_group_arn` | `string` | Database parameter group ARN |

### Monitoring

| Name | Type | Description |
|------|------|-------------|
| `performance_insights_enabled` | `bool` | Performance insights status |
| `performance_insights_kms_key_id` | `string` | Performance insights KMS key |
| `enhanced_monitoring_arn` | `string` | Enhanced monitoring role ARN |

## 🔧 Configuration Examples

### Development Environment

```hcl
module "database_dev" {
  source = "./modules/database_postgres"
  
  name           = "learning-assistant-dev"
  engine_version = "14.9"
  
  # Small instance for development
  instance_class     = "db.t3.micro"
  allocated_storage  = 20
  storage_type      = "gp2"
  
  # Basic configuration
  database_name   = "learning_assistant_dev"
  master_username = "postgres"
  master_password = var.dev_database_password
  
  # Network
  vpc_id              = module.network.vpc_id
  subnet_ids          = module.network.database_subnets
  allowed_cidr_blocks = [module.network.vpc_cidr, "10.0.0.0/8"]
  
  # Development settings
  multi_az = false
  backup_retention_period = 1
  enable_deletion_protection = false
  publicly_accessible = true  # For development access
  
  # Minimal monitoring
  enable_performance_insights = false
  enable_logging = false
  
  tags = {
    Environment = "development"
    Purpose     = "development-database"
  }
}
```

### Staging Environment

```hcl
module "database_staging" {
  source = "./modules/database_postgres"
  
  name           = "learning-assistant-staging"
  engine_version = "14.9"
  
  # Production-like sizing
  instance_class     = "db.t3.small"
  allocated_storage  = 100
  storage_type      = "gp2"
  
  # Configuration
  database_name   = "learning_assistant_staging"
  master_username = "postgres"
  master_password = var.staging_database_password
  
  # Network
  vpc_id              = module.network.vpc_id
  subnet_ids          = module.network.database_subnets
  allowed_cidr_blocks = [module.network.vpc_cidr]
  publicly_accessible = false
  
  # Staging settings
  multi_az = true
  backup_retention_period = 7
  enable_deletion_protection = false
  
  # Monitoring
  enable_performance_insights = true
  enable_logging = true
  
  tags = {
    Environment = "staging"
    Purpose     = "staging-database"
  }
}
```

### Production Environment

```hcl
module "database_production" {
  source = "./modules/database_postgres"
  
  name           = "learning-assistant-prod"
  engine_version = "14.9"
  
  # Production sizing
  instance_class     = "db.r5.large"
  allocated_storage  = 500
  max_allocated_storage = 1000
  storage_type      = "gp3"
  storage_throughput = 3000
  storage_iops      = 12000
  
  # Configuration
  database_name   = "learning_assistant"
  master_username = "postgres"
  master_password = var.production_database_password
  
  # Network
  vpc_id              = module.network.vpc_id
  subnet_ids          = module.network.database_subnets
  allowed_cidr_blocks = [module.network.vpc_cidr]
  publicly_accessible = false
  
  # Production settings
  multi_az = true
  backup_retention_period = 30
  backup_window = "03:00-04:00"
  maintenance_window = "sun:04:00-sun:05:00"
  
  # Security
  enable_encryption = true
  enable_deletion_protection = true
  enable_backup_encryption = true
  
  # Monitoring
  enable_performance_insights = true
  performance_insights_retention_period = 7
  enable_enhanced_monitoring = true
  monitoring_interval = 60
  enable_logging = true
  
  # Read replicas
  create_read_replica = true
  read_replica_count = 2
  
  # Custom parameter group
  parameter_group_family = "postgres14"
  parameters = [
    {
      name  = "shared_preload_libraries"
      value = "pg_stat_statements"
    },
    {
      name  = "log_statement"
      value = "all"
    }
  ]
  
  tags = {
    Environment = "production"
    Purpose     = "production-database"
    Backup      = "required"
    Monitoring  = "required"
  }
}
```

## 🔐 Security Configuration

### Security Best Practices

#### Network Security
```hcl
# Secure network configuration
module "database" {
  source = "./modules/database_postgres"
  
  # Network isolation
  publicly_accessible = false
  vpc_id = module.network.vpc_id
  subnet_ids = module.network.private_subnets
  
  # Restrict access
  allowed_cidr_blocks = [
    "10.0.0.0/16",  # VPC CIDR
    "172.16.0.0/12" # Private networks only
  ]
  
  # Security groups
  create_security_group = true
  security_group_rules = [
    {
      type        = "ingress"
      from_port   = 5432
      to_port     = 5432
      protocol    = "tcp"
      cidr_blocks = ["10.0.0.0/16"]
      description = "PostgreSQL from VPC"
    }
  ]
}
```

#### Encryption Configuration
```hcl
# Comprehensive encryption
module "database" {
  source = "./modules/database_postgres"
  
  # Encryption at rest
  storage_encrypted = true
  kms_key_id = aws_kms_key.database.arn
  
  # Backup encryption
  enable_backup_encryption = true
  
  # Performance insights encryption
  performance_insights_enabled = true
  performance_insights_kms_key_id = aws_kms_key.database.arn
  
  # SSL/TLS enforcement
  parameters = [
    {
      name  = "ssl"
      value = "on"
    },
    {
      name  = "log_connections"
      value = "on"
    }
  ]
}
```

#### Access Control
```hcl
# IAM database authentication
module "database" {
  source = "./modules/database_postgres"
  
  # IAM authentication
  iam_database_authentication_enabled = true
  
  # Custom parameter group with security settings
  parameter_group_family = "postgres14"
  parameters = [
    {
      name  = "log_statement"
      value = "all"
    },
    {
      name  = "log_min_duration_statement"
      value = "1000"
    },
    {
      name  = "log_connections"
      value = "on"
    },
    {
      name  = "log_disconnections"
      value = "on"
    }
  ]
}
```

## 📊 Monitoring and Alerting

### CloudWatch Monitoring

```hcl
# Comprehensive monitoring
module "database" {
  source = "./modules/database_postgres"
  
  # Performance insights
  enable_performance_insights = true
  performance_insights_retention_period = 7
  
  # Enhanced monitoring
  enable_enhanced_monitoring = true
  monitoring_interval = 60
  
  # Custom monitoring role
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn
  
  # Logging
  enable_logging = true
  enabled_cloudwatch_logs_exports = [
    "postgresql",
    "upgrade"
  ]
}

# CloudWatch alarms
resource "aws_cloudwatch_metric_alarm" "database_cpu" {
  alarm_name          = "database-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors database CPU utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  
  dimensions = {
    DBInstanceIdentifier = module.database.db_instance_id
  }
}
```

### Custom Metrics

```hcl
# Custom CloudWatch metrics
resource "aws_cloudwatch_metric_alarm" "database_connections" {
  alarm_name          = "database-connection-count"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors database connection count"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  
  dimensions = {
    DBInstanceIdentifier = module.database.db_instance_id
  }
}

resource "aws_cloudwatch_metric_alarm" "database_read_latency" {
  alarm_name          = "database-read-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ReadLatency"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "0.2"
  alarm_description   = "This metric monitors database read latency"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  
  dimensions = {
    DBInstanceIdentifier = module.database.db_instance_id
  }
}
```

## 🔄 Backup and Recovery

### Backup Configuration

```hcl
# Comprehensive backup strategy
module "database" {
  source = "./modules/database_postgres"
  
  # Automated backups
  backup_retention_period = 30
  backup_window = "03:00-04:00"
  
  # Backup encryption
  enable_backup_encryption = true
  
  # Copy tags to snapshots
  copy_tags_to_snapshot = true
  
  # Final snapshot
  skip_final_snapshot = false
  final_snapshot_identifier = "learning-assistant-final-snapshot"
  
  # Deletion protection
  enable_deletion_protection = true
}

# Manual snapshot
resource "aws_db_snapshot" "manual_snapshot" {
  db_instance_identifier = module.database.db_instance_id
  db_snapshot_identifier = "learning-assistant-manual-snapshot"
  
  tags = {
    Name = "Manual Snapshot"
    Type = "Manual"
  }
}
```

### Point-in-Time Recovery

```hcl
# Point-in-time recovery setup
module "database" {
  source = "./modules/database_postgres"
  
  # Enable point-in-time recovery
  backup_retention_period = 35  # Maximum retention
  
  # Backup window optimization
  backup_window = "03:00-04:00"  # Low traffic period
  
  # Enable automated backups
  skip_final_snapshot = false
  final_snapshot_identifier = "learning-assistant-final-snapshot"
}
```

### Cross-Region Backup

```hcl
# Cross-region backup replication
resource "aws_db_instance" "replica" {
  identifier = "learning-assistant-replica"
  
  # Source database
  replicate_source_db = module.database.db_instance_id
  
  # Replica configuration
  instance_class = "db.t3.micro"
  
  # Different region
  availability_zone = "us-west-2a"
  
  # Backup configuration
  backup_retention_period = 7
  backup_window = "06:00-07:00"  # Different window
  
  tags = {
    Name = "Cross-Region Replica"
    Purpose = "Disaster Recovery"
  }
}
```

## 🚀 Performance Optimization

### Performance Tuning

```hcl
# Performance-optimized configuration
module "database" {
  source = "./modules/database_postgres"
  
  # High-performance instance
  instance_class = "db.r5.2xlarge"
  
  # Optimized storage
  storage_type = "gp3"
  allocated_storage = 1000
  storage_throughput = 3000
  storage_iops = 16000
  
  # Custom parameter group
  parameter_group_family = "postgres14"
  parameters = [
    {
      name  = "shared_buffers"
      value = "256MB"
    },
    {
      name  = "effective_cache_size"
      value = "1GB"
    },
    {
      name  = "maintenance_work_mem"
      value = "64MB"
    },
    {
      name  = "checkpoint_completion_target"
      value = "0.9"
    },
    {
      name  = "wal_buffers"
      value = "16MB"
    },
    {
      name  = "default_statistics_target"
      value = "100"
    }
  ]
}
```

### Connection Pooling

```hcl
# Connection pooling configuration
module "database" {
  source = "./modules/database_postgres"
  
  # Connection limits
  parameters = [
    {
      name  = "max_connections"
      value = "200"
    },
    {
      name  = "shared_buffers"
      value = "256MB"
    }
  ]
  
  # Connection pooling with PgBouncer
  enable_proxy = true
  proxy_config = {
    pool_mode = "transaction"
    default_pool_size = 20
    max_client_conn = 100
  }
}
```

## 💰 Cost Optimization

### Cost-Optimized Configuration

```hcl
# Cost-optimized database
module "database" {
  source = "./modules/database_postgres"
  
  # Burstable performance instance
  instance_class = "db.t3.micro"
  
  # General purpose storage
  storage_type = "gp2"
  allocated_storage = 20
  
  # Minimal backup retention
  backup_retention_period = 7
  
  # Disable expensive features
  enable_performance_insights = false
  enable_enhanced_monitoring = false
  multi_az = false
  
  # Cost allocation tags
  tags = {
    CostCenter = "development"
    Project = "learning-assistant"
  }
}
```

### Reserved Instances

```hcl
# Reserved instance for cost savings
resource "aws_rds_reserved_instance" "production" {
  offering_id    = "rds-reserved-offering-id"
  instance_count = 1
  
  tags = {
    Name = "Production Database Reserved Instance"
  }
}
```

## 🧪 Testing

### Module Testing

```hcl
# Test configuration
module "database_test" {
  source = "./modules/database_postgres"
  
  # Test-specific configuration
  name = "test-database"
  engine_version = "14.9"
  instance_class = "db.t3.micro"
  allocated_storage = 20
  
  # Test network
  vpc_id = module.test_network.vpc_id
  subnet_ids = module.test_network.database_subnets
  
  # Test settings
  backup_retention_period = 1
  enable_deletion_protection = false
  
  tags = {
    Environment = "test"
    Purpose = "automated-testing"
  }
}
```

### Integration Tests

```go
// test/database_test.go
package test

import (
    "testing"
    "github.com/gruntwork-io/terratest/modules/terraform"
    "github.com/stretchr/testify/assert"
)

func TestDatabaseModule(t *testing.T) {
    terraformOptions := &terraform.Options{
        TerraformDir: "../examples/database",
        Vars: map[string]interface{}{
            "name": "test-database",
        },
    }
    
    defer terraform.Destroy(t, terraformOptions)
    terraform.InitAndApply(t, terraformOptions)
    
    // Test outputs
    dbEndpoint := terraform.Output(t, terraformOptions, "db_instance_endpoint")
    assert.NotEmpty(t, dbEndpoint)
    
    // Test connectivity
    // ... connectivity tests
}
```

## 🔗 Related Documentation

- [Network Module](./network.md)
- [Security Patterns](../patterns/security-patterns.md)
- [Backup and Recovery](../runbooks/backup-recovery.md)
- [Performance Optimization](../tutorials/performance-optimization.md)
- [Cost Optimization](../cost-optimization/analysis.md)

## 📝 Changelog

### Version 1.0.0
- Initial release with multi-cloud support
- Automated backup and recovery
- Performance insights integration
- Security hardening features

### Version 1.1.0
- Added read replica support
- Enhanced monitoring capabilities
- Cost optimization features
- Cross-region backup support

### Version 1.2.0
- Added connection pooling
- Performance parameter tuning
- Enhanced security features
- Improved documentation

---

This database module provides a production-ready, secure, and scalable PostgreSQL database solution with comprehensive monitoring, backup, and recovery capabilities.