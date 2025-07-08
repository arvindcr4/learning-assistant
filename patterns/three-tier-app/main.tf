# Three-Tier Application Pattern
# Enterprise-grade three-tier architecture with web, application, and database tiers

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for consistent configuration
locals {
  common_tags = merge(
    var.tags,
    {
      Pattern     = "three-tier-app"
      Environment = var.environment
      Project     = var.project_name
      ManagedBy   = "terraform"
    }
  )
  
  name_prefix = "${var.project_name}-${var.environment}"
}

# VPC Module - Network Foundation
module "vpc" {
  source = "../../modules/networking/vpc"
  
  cloud_provider = "aws"
  project_name   = var.project_name
  environment    = var.environment
  
  vpc_cidr        = var.vpc_cidr
  public_subnets  = var.public_subnets
  private_subnets = var.private_subnets
  
  # Network segmentation for three-tier architecture
  enable_network_segmentation = true
  database_subnets           = var.database_subnets
  cache_subnets             = var.cache_subnets
  
  enable_nat_gateway = var.enable_nat_gateway
  enable_flow_logs   = var.enable_flow_logs
  
  # High availability
  multi_az = var.multi_az
  
  # Security
  compliance_framework = var.compliance_framework
  data_classification  = var.data_classification
  
  tags = local.common_tags
}

# Security Groups Module - Network Security
module "security_groups" {
  source = "../../modules/networking/security-groups"
  
  cloud_provider = "aws"
  project_name   = var.project_name
  environment    = var.environment
  
  vpc_id   = module.vpc.vpc_id
  vpc_cidr = module.vpc.vpc_cidr_block
  
  # Application configuration
  app_port           = var.app_port
  enable_web_access  = var.enable_web_access
  database_engines   = var.database_engines
  
  # Security configuration
  ssh_allowed_cidrs      = var.ssh_allowed_cidrs
  enable_database_ssh    = var.enable_database_ssh
  compliance_framework   = var.compliance_framework
  data_classification    = var.data_classification
  
  tags = local.common_tags
  
  depends_on = [module.vpc]
}

# Web Tier - Load Balancer and Web Servers
module "web_tier" {
  source = "../../modules/compute/ecs"
  
  project_name = var.project_name
  environment  = var.environment
  
  # Network configuration
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  public_subnet_ids  = module.vpc.public_subnet_ids
  
  # ECS configuration for web tier
  launch_type    = var.web_tier_launch_type
  task_cpu       = var.web_tier_cpu
  task_memory    = var.web_tier_memory
  desired_count  = var.web_tier_desired_count
  
  # Container configuration
  container_name  = "web-server"
  container_image = var.web_tier_image
  container_port  = var.web_tier_port
  
  # Environment variables for web tier
  environment_variables = merge(
    var.web_tier_environment_variables,
    {
      APP_TIER_URL = "http://${module.app_tier.load_balancer_dns_name}"
      ENVIRONMENT  = var.environment
      PROJECT_NAME = var.project_name
    }
  )
  
  # Secrets management
  secrets = var.web_tier_secrets
  
  # Load balancer configuration
  create_load_balancer             = true
  internal_load_balancer          = false
  enable_deletion_protection      = var.enable_deletion_protection
  load_balancer_security_group_ids = [module.security_groups.load_balancer_security_group_id]
  
  # Auto scaling
  enable_autoscaling      = var.enable_web_tier_autoscaling
  autoscaling_min_capacity = var.web_tier_min_capacity
  autoscaling_max_capacity = var.web_tier_max_capacity
  autoscaling_target_cpu   = var.web_tier_target_cpu
  
  # Health checks
  health_check_path                   = var.web_tier_health_check_path
  health_check_healthy_threshold      = var.health_check_healthy_threshold
  health_check_unhealthy_threshold    = var.health_check_unhealthy_threshold
  health_check_timeout_seconds        = var.health_check_timeout_seconds
  health_check_interval_seconds       = var.health_check_interval_seconds
  
  # Security
  enable_encryption = var.enable_encryption
  
  # Monitoring
  enable_container_insights = var.enable_container_insights
  log_retention_days       = var.log_retention_days
  
  # Compliance
  compliance_framework = var.compliance_framework
  data_classification  = var.data_classification
  
  tags = merge(local.common_tags, {
    Tier = "Web"
    Role = "LoadBalancer"
  })
  
  depends_on = [module.vpc, module.security_groups]
}

# Application Tier - Application Servers
module "app_tier" {
  source = "../../modules/compute/ecs"
  
  project_name = var.project_name
  environment  = var.environment
  
  # Network configuration
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  public_subnet_ids  = []  # App tier should not be in public subnets
  
  # ECS configuration for application tier
  launch_type    = var.app_tier_launch_type
  task_cpu       = var.app_tier_cpu
  task_memory    = var.app_tier_memory
  desired_count  = var.app_tier_desired_count
  
  # Container configuration
  container_name  = "app-server"
  container_image = var.app_tier_image
  container_port  = var.app_tier_port
  
  # Environment variables for application tier
  environment_variables = merge(
    var.app_tier_environment_variables,
    {
      DATABASE_HOST = module.database_tier.db_instance_address
      DATABASE_PORT = tostring(module.database_tier.db_instance_port)
      DATABASE_NAME = module.database_tier.db_instance_name
      CACHE_HOST    = module.cache_tier.primary_endpoint_address
      CACHE_PORT    = tostring(module.cache_tier.port)
      ENVIRONMENT   = var.environment
      PROJECT_NAME  = var.project_name
    }
  )
  
  # Secrets management - database credentials
  secrets = merge(
    var.app_tier_secrets,
    {
      DATABASE_USERNAME = module.database_tier.master_user_secret_arn
      DATABASE_PASSWORD = module.database_tier.master_user_secret_arn
    }
  )
  
  # Internal load balancer for app tier
  create_load_balancer             = true
  internal_load_balancer          = true
  enable_deletion_protection      = var.enable_deletion_protection
  load_balancer_security_group_ids = [module.security_groups.app_security_group_id]
  
  # Auto scaling
  enable_autoscaling      = var.enable_app_tier_autoscaling
  autoscaling_min_capacity = var.app_tier_min_capacity
  autoscaling_max_capacity = var.app_tier_max_capacity
  autoscaling_target_cpu   = var.app_tier_target_cpu
  
  # Health checks
  health_check_path                   = var.app_tier_health_check_path
  health_check_healthy_threshold      = var.health_check_healthy_threshold
  health_check_unhealthy_threshold    = var.health_check_unhealthy_threshold
  health_check_timeout_seconds        = var.health_check_timeout_seconds
  health_check_interval_seconds       = var.health_check_interval_seconds
  
  # Security
  enable_encryption = var.enable_encryption
  
  # Monitoring
  enable_container_insights = var.enable_container_insights
  log_retention_days       = var.log_retention_days
  
  # Compliance
  compliance_framework = var.compliance_framework
  data_classification  = var.data_classification
  
  tags = merge(local.common_tags, {
    Tier = "Application"
    Role = "Backend"
  })
  
  depends_on = [module.vpc, module.security_groups, module.database_tier, module.cache_tier]
}

# Database Tier - RDS Database
module "database_tier" {
  source = "../../modules/database/rds"
  
  project_name = var.project_name
  environment  = var.environment
  
  # Network configuration
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.database_subnet_ids
  
  # Security configuration
  allowed_security_group_ids = [module.security_groups.app_security_group_id]
  allowed_cidr_blocks       = var.database_allowed_cidrs
  
  # Database configuration
  engine         = var.database_engine
  engine_version = var.database_engine_version
  instance_class = var.database_instance_class
  
  # Storage configuration
  allocated_storage     = var.database_allocated_storage
  max_allocated_storage = var.database_max_allocated_storage
  storage_type          = var.database_storage_type
  storage_encrypted     = var.enable_encryption
  
  # Database settings
  database_name = var.database_name
  username      = var.database_username
  port          = var.database_port
  
  # Password management
  manage_master_user_password = var.manage_master_user_password
  
  # High availability
  multi_az               = var.database_multi_az
  backup_retention_period = var.database_backup_retention_period
  backup_window          = var.database_backup_window
  maintenance_window     = var.database_maintenance_window
  
  # Read replicas for read scaling
  read_replica_count              = var.database_read_replica_count
  read_replica_instance_class     = var.database_read_replica_instance_class
  read_replica_multi_az          = var.database_read_replica_multi_az
  
  # Monitoring
  monitoring_interval             = var.database_monitoring_interval
  performance_insights_enabled    = var.database_performance_insights_enabled
  enabled_cloudwatch_logs_exports = var.database_cloudwatch_logs_exports
  
  # Security
  deletion_protection = var.database_deletion_protection
  
  # Alarms
  create_cloudwatch_alarms = var.enable_database_alarms
  alarm_actions           = var.alarm_actions
  ok_actions             = var.ok_actions
  
  # Compliance
  compliance_framework = var.compliance_framework
  data_classification  = var.data_classification
  
  tags = merge(local.common_tags, {
    Tier = "Database"
    Role = "Primary"
  })
  
  depends_on = [module.vpc, module.security_groups]
}

# Cache Tier - ElastiCache Redis
module "cache_tier" {
  source = "../../modules/cache/elasticache"
  
  project_name = var.project_name
  environment  = var.environment
  
  # Network configuration
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.cache_subnet_ids
  
  # Security configuration
  allowed_security_group_ids = [module.security_groups.app_security_group_id]
  
  # Cache configuration
  engine         = var.cache_engine
  node_type      = var.cache_node_type
  port           = var.cache_port
  
  # Cluster configuration
  num_cache_nodes      = var.cache_num_nodes
  parameter_group_name = var.cache_parameter_group_name
  
  # Replication group (for Redis)
  create_replication_group = var.create_cache_replication_group
  replication_group_size   = var.cache_replication_group_size
  
  # Security
  at_rest_encryption_enabled = var.enable_encryption
  transit_encryption_enabled = var.enable_encryption
  auth_token_enabled         = var.cache_auth_token_enabled
  
  # High availability
  multi_az_enabled           = var.cache_multi_az
  automatic_failover_enabled = var.cache_automatic_failover
  
  # Backup
  snapshot_retention_limit = var.cache_snapshot_retention_limit
  snapshot_window         = var.cache_snapshot_window
  
  # Maintenance
  maintenance_window = var.cache_maintenance_window
  
  # Monitoring
  notification_topic_arn = var.cache_notification_topic_arn
  
  # Compliance
  compliance_framework = var.compliance_framework
  data_classification  = var.data_classification
  
  tags = merge(local.common_tags, {
    Tier = "Cache"
    Role = "Performance"
  })
  
  depends_on = [module.vpc, module.security_groups]
}

# Monitoring and Alerting
module "monitoring" {
  source = "../../modules/monitoring/cloudwatch"
  
  project_name = var.project_name
  environment  = var.environment
  
  # Resources to monitor
  ecs_cluster_name    = module.web_tier.cluster_name
  app_cluster_name    = module.app_tier.cluster_name
  db_instance_id      = module.database_tier.db_instance_id
  cache_cluster_id    = module.cache_tier.cluster_id
  
  # Load balancer monitoring
  load_balancer_arn_suffix = module.web_tier.load_balancer_arn_suffix
  target_group_arn_suffix  = module.web_tier.target_group_arn_suffix
  
  # Alarm configuration
  create_alarms          = var.enable_monitoring_alarms
  alarm_actions         = var.alarm_actions
  ok_actions           = var.ok_actions
  
  # Dashboard configuration
  create_dashboard = var.create_monitoring_dashboard
  
  # Log retention
  log_retention_days = var.log_retention_days
  
  tags = merge(local.common_tags, {
    Component = "Monitoring"
  })
  
  depends_on = [
    module.web_tier,
    module.app_tier,
    module.database_tier,
    module.cache_tier
  ]
}

# WAF for Web Application Firewall (optional)
resource "aws_wafv2_web_acl" "main" {
  count = var.enable_waf ? 1 : 0
  
  name  = "${local.name_prefix}-waf"
  scope = "REGIONAL"
  
  default_action {
    allow {}
  }
  
  # Rate limiting rule
  rule {
    name     = "RateLimitRule"
    priority = 1
    
    action {
      block {}
    }
    
    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit
        aggregate_key_type = "IP"
      }
    }
    
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRule"
      sampled_requests_enabled   = true
    }
  }
  
  # AWS Managed Rules
  dynamic "rule" {
    for_each = var.waf_managed_rules
    content {
      name     = rule.value.name
      priority = rule.value.priority
      
      override_action {
        none {}
      }
      
      statement {
        managed_rule_group_statement {
          name        = rule.value.name
          vendor_name = "AWS"
        }
      }
      
      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = rule.value.name
        sampled_requests_enabled   = true
      }
    }
  }
  
  tags = local.common_tags
}

# Associate WAF with Load Balancer
resource "aws_wafv2_web_acl_association" "main" {
  count = var.enable_waf ? 1 : 0
  
  resource_arn = module.web_tier.load_balancer_arn
  web_acl_arn  = aws_wafv2_web_acl.main[0].arn
}

# Route53 DNS (optional)
resource "aws_route53_zone" "main" {
  count = var.create_dns_zone ? 1 : 0
  
  name = var.domain_name
  
  tags = local.common_tags
}

resource "aws_route53_record" "main" {
  count = var.create_dns_zone ? 1 : 0
  
  zone_id = aws_route53_zone.main[0].zone_id
  name    = var.domain_name
  type    = "A"
  
  alias {
    name                   = module.web_tier.load_balancer_dns_name
    zone_id                = module.web_tier.load_balancer_zone_id
    evaluate_target_health = true
  }
}

# SSL Certificate (optional)
resource "aws_acm_certificate" "main" {
  count = var.create_ssl_certificate ? 1 : 0
  
  domain_name       = var.domain_name
  validation_method = "DNS"
  
  subject_alternative_names = var.subject_alternative_names
  
  lifecycle {
    create_before_destroy = true
  }
  
  tags = local.common_tags
}

resource "aws_route53_record" "cert_validation" {
  count = var.create_ssl_certificate && var.create_dns_zone ? 1 : 0
  
  for_each = {
    for dvo in aws_acm_certificate.main[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }
  
  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = aws_route53_zone.main[0].zone_id
}

resource "aws_acm_certificate_validation" "main" {
  count = var.create_ssl_certificate && var.create_dns_zone ? 1 : 0
  
  certificate_arn         = aws_acm_certificate.main[0].arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}