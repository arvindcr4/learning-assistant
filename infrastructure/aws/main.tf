# Main Terraform configuration for AWS infrastructure
# Learning Assistant Application - Production Ready Infrastructure

terraform {
  required_version = ">= 1.0"
  
  # Configure remote state storage
  backend "s3" {
    # These values should be set via terraform init -backend-config
    # bucket         = "your-terraform-state-bucket"
    # key            = "learning-assistant/terraform.tfstate"
    # region         = "us-east-1"
    # encrypt        = true
    # dynamodb_table = "terraform-state-lock"
  }
}

# Local values for resource naming and tagging
locals {
  name_prefix = "${var.project_name}-${var.environment}"
  
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
    Owner       = var.owner
    CostCenter  = var.cost_center
  }
}

# Data sources for availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

# Data source for current AWS region
data "aws_region" "current" {}

# Data source for current AWS account
data "aws_caller_identity" "current" {}

# Random suffix for unique resource naming
resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

# IAM Roles and Policies (create first as they're referenced by other modules)
module "iam" {
  source = "./modules/iam"
  
  name_prefix = local.name_prefix
  
  # ECS task execution role
  create_ecs_task_execution_role = true
  
  # ECS task role
  create_ecs_task_role = true
  
  # Parameter Store access
  parameter_store_parameters = var.parameter_store_parameters
  
  # S3 bucket access (if needed)
  s3_bucket_arns = var.s3_bucket_arns
  
  tags = local.common_tags
}

# VPC Configuration
module "vpc" {
  source = "./modules/vpc"
  
  name_prefix        = local.name_prefix
  vpc_cidr           = var.vpc_cidr
  availability_zones = data.aws_availability_zones.available.names
  
  # Subnet configuration
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  database_subnet_cidrs = var.database_subnet_cidrs
  
  # NAT Gateway configuration
  enable_nat_gateway = var.enable_nat_gateway
  single_nat_gateway = var.single_nat_gateway
  
  # DNS configuration
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = local.common_tags
}

# Security Groups
module "security_groups" {
  source = "./modules/security_groups"
  
  name_prefix = local.name_prefix
  vpc_id      = module.vpc.vpc_id
  
  # ALB configuration
  alb_allowed_cidrs = var.alb_allowed_cidrs
  
  tags = local.common_tags
}

# Application Load Balancer
module "alb" {
  source = "./modules/alb"
  
  name_prefix = local.name_prefix
  vpc_id      = module.vpc.vpc_id
  
  # Subnet configuration
  public_subnet_ids = module.vpc.public_subnet_ids
  
  # Security groups
  security_group_ids = [module.security_groups.alb_security_group_id]
  
  # SSL/TLS configuration
  domain_name         = var.domain_name
  certificate_arn     = var.certificate_arn
  enable_https_redirect = var.enable_https_redirect
  
  tags = local.common_tags
}

# ECS Cluster
module "ecs" {
  source = "./modules/ecs"
  
  name_prefix = local.name_prefix
  
  # Cluster configuration
  cluster_name = "${local.name_prefix}-cluster"
  
  # Service configuration
  service_name        = "${local.name_prefix}-service"
  container_image     = var.container_image
  container_port      = var.container_port
  
  # Task definition
  task_cpu           = var.task_cpu
  task_memory        = var.task_memory
  task_desired_count = var.task_desired_count
  
  # IAM roles
  execution_role_arn = module.iam.ecs_task_execution_role_arn
  task_role_arn      = module.iam.ecs_task_role_arn
  
  # Auto scaling
  enable_auto_scaling = var.enable_auto_scaling
  min_capacity        = var.min_capacity
  max_capacity        = var.max_capacity
  
  # Auto scaling configuration
  alb_arn_suffix         = module.alb.arn_suffix
  target_group_arn_suffix = module.alb.target_group_arn_suffix
  
  # Network configuration
  vpc_id            = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  security_group_ids = [module.security_groups.ecs_security_group_id]
  
  # Load balancer configuration
  target_group_arn = module.alb.target_group_arn
  
  # Environment variables
  environment_variables = var.environment_variables
  
  # Secrets from Parameter Store
  secrets = var.secrets
  
  tags = local.common_tags
}

# RDS PostgreSQL
module "rds" {
  source = "./modules/rds"
  
  name_prefix = local.name_prefix
  
  # Database configuration
  db_name     = var.db_name
  db_username = var.db_username
  db_password = var.db_password
  
  # Instance configuration
  db_instance_class = var.db_instance_class
  allocated_storage = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type      = var.storage_type
  storage_encrypted = var.storage_encrypted
  
  # Multi-AZ and backup configuration
  multi_az               = var.multi_az
  backup_retention_period = var.backup_retention_period
  backup_window          = var.backup_window
  maintenance_window     = var.maintenance_window
  
  # Read replica configuration
  create_read_replica = var.create_read_replica
  
  # Network configuration
  vpc_id               = module.vpc.vpc_id
  database_subnet_ids  = module.vpc.database_subnet_ids
  security_group_ids   = [module.security_groups.rds_security_group_id]
  
  # Monitoring and performance
  monitoring_interval = var.monitoring_interval
  performance_insights_enabled = var.performance_insights_enabled
  
  tags = local.common_tags
}

# ElastiCache Redis
module "elasticache" {
  source = "./modules/elasticache"
  
  name_prefix = local.name_prefix
  
  # Redis configuration
  node_type           = var.redis_node_type
  num_cache_nodes     = var.redis_num_cache_nodes
  parameter_group_name = var.redis_parameter_group_name
  engine_version      = var.redis_engine_version
  
  # Cluster configuration
  replication_group_id = "${local.name_prefix}-redis"
  description         = "Redis cluster for ${var.project_name}"
  port               = var.redis_port
  
  # Network configuration
  vpc_id            = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  security_group_ids = [module.security_groups.redis_security_group_id]
  
  # Backup configuration
  snapshot_retention_limit = var.redis_snapshot_retention_limit
  snapshot_window         = var.redis_snapshot_window
  
  # Auth and security
  auth_token_enabled = var.redis_auth_token_enabled
  transit_encryption_enabled = var.redis_transit_encryption_enabled
  at_rest_encryption_enabled = var.redis_at_rest_encryption_enabled
  
  tags = local.common_tags
}

# Route 53 DNS
module "route53" {
  source = "./modules/route53"
  
  count = var.create_route53_zone ? 1 : 0
  
  name_prefix = local.name_prefix
  
  # Domain configuration
  domain_name = var.domain_name
  
  # ALB configuration
  alb_dns_name = module.alb.dns_name
  alb_zone_id  = module.alb.zone_id
  
  # Health check configuration
  enable_health_check = var.enable_health_check
  health_check_path   = var.health_check_path
  
  tags = local.common_tags
}

# CloudWatch Monitoring
module "cloudwatch" {
  source = "./modules/cloudwatch"
  
  name_prefix = local.name_prefix
  
  # ECS monitoring
  cluster_name = module.ecs.cluster_name
  service_name = module.ecs.service_name
  
  # RDS monitoring
  db_instance_identifier = module.rds.db_instance_identifier
  
  # ElastiCache monitoring
  cache_cluster_id = module.elasticache.cluster_id
  
  # ALB monitoring
  load_balancer_arn_suffix = module.alb.arn_suffix
  
  # Notification configuration
  sns_topic_arn = var.sns_topic_arn
  
  # Alert thresholds
  cpu_threshold_high    = var.cpu_threshold_high
  memory_threshold_high = var.memory_threshold_high
  
  tags = local.common_tags
}


# Parameter Store for secrets
resource "aws_ssm_parameter" "secrets" {
  for_each = var.parameter_store_secrets
  
  name  = "/${var.project_name}/${var.environment}/${each.key}"
  type  = "SecureString"
  value = each.value
  
  tags = local.common_tags
}