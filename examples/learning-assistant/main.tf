# Learning Assistant Complete Infrastructure Example
# This example demonstrates a full deployment of the learning assistant application
# using our enterprise-grade Terraform modules

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  # Configure remote state (uncomment and configure for production)
  # backend "s3" {
  #   bucket         = "your-terraform-state-bucket"
  #   key            = "learning-assistant/terraform.tfstate"
  #   region         = "us-west-2"
  #   dynamodb_table = "terraform-state-locks"
  #   encrypt        = true
  # }
}

# Configure AWS Provider
provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = var.owner
      CostCenter  = var.cost_center
    }
  }
}

# Local variables for consistent configuration
locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    Application = "learning-assistant"
    Owner       = var.owner
    CostCenter  = var.cost_center
    ManagedBy   = "terraform"
  }
  
  name_prefix = "${var.project_name}-${var.environment}"
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Three-Tier Application Pattern - Complete Learning Assistant Infrastructure
module "learning_assistant_infrastructure" {
  source = "../../patterns/three-tier-app"
  
  # Basic Configuration
  project_name = var.project_name
  environment  = var.environment
  
  # Network Configuration
  vpc_cidr        = var.vpc_cidr
  public_subnets  = var.public_subnets
  private_subnets = var.private_subnets
  database_subnets = var.database_subnets
  cache_subnets   = var.cache_subnets
  
  # High Availability
  multi_az            = var.multi_az
  enable_nat_gateway  = var.enable_nat_gateway
  
  # Security Configuration
  ssh_allowed_cidrs     = var.ssh_allowed_cidrs
  compliance_framework  = var.compliance_framework
  data_classification   = var.data_classification
  enable_encryption     = var.enable_encryption
  
  # Web Tier Configuration
  web_tier_launch_type    = var.web_tier_launch_type
  web_tier_cpu           = var.web_tier_cpu
  web_tier_memory        = var.web_tier_memory
  web_tier_desired_count = var.web_tier_desired_count
  web_tier_image         = var.web_tier_image
  web_tier_port          = var.web_tier_port
  
  web_tier_environment_variables = {
    NODE_ENV                = var.environment
    API_BASE_URL           = "https://api.${var.domain_name}"
    FRONTEND_URL           = "https://${var.domain_name}"
    SESSION_SECRET         = "#{session-secret}"  # Will be replaced by secret
    ENABLE_ANALYTICS       = "true"
    LOG_LEVEL             = var.log_level
    SENTRY_DSN            = var.sentry_dsn
    NEW_RELIC_LICENSE_KEY = var.new_relic_license_key
  }
  
  web_tier_secrets = {
    SESSION_SECRET = aws_secretsmanager_secret.session_secret.arn
    JWT_SECRET     = aws_secretsmanager_secret.jwt_secret.arn
  }
  
  # Auto Scaling for Web Tier
  enable_web_tier_autoscaling = var.enable_web_tier_autoscaling
  web_tier_min_capacity      = var.web_tier_min_capacity
  web_tier_max_capacity      = var.web_tier_max_capacity
  web_tier_target_cpu        = var.web_tier_target_cpu
  
  # Application Tier Configuration
  app_tier_launch_type    = var.app_tier_launch_type
  app_tier_cpu           = var.app_tier_cpu
  app_tier_memory        = var.app_tier_memory
  app_tier_desired_count = var.app_tier_desired_count
  app_tier_image         = var.app_tier_image
  app_tier_port          = var.app_tier_port
  
  app_tier_environment_variables = {
    NODE_ENV              = var.environment
    PORT                  = tostring(var.app_tier_port)
    LOG_LEVEL            = var.log_level
    ENABLE_CORS          = "true"
    CORS_ORIGIN          = "https://${var.domain_name}"
    RATE_LIMIT_WINDOW    = "900000"  # 15 minutes
    RATE_LIMIT_MAX       = "100"
    ENABLE_COMPRESSION   = "true"
    HELMET_ENABLED       = "true"
    TRUST_PROXY         = "true"
    
    # AI/ML Configuration
    OPENAI_API_ENDPOINT   = "https://api.openai.com/v1"
    ANTHROPIC_API_ENDPOINT = "https://api.anthropic.com"
    ENABLE_AI_FEATURES    = "true"
    AI_MODEL_CACHE_TTL    = "3600"
    
    # Learning Analytics
    ENABLE_LEARNING_ANALYTICS = "true"
    ANALYTICS_BATCH_SIZE     = "100"
    ANALYTICS_FLUSH_INTERVAL = "30000"
    
    # Performance Monitoring
    SENTRY_DSN               = var.sentry_dsn
    NEW_RELIC_LICENSE_KEY    = var.new_relic_license_key
    PROMETHEUS_METRICS_PORT  = "9090"
  }
  
  app_tier_secrets = {
    DATABASE_URL          = aws_secretsmanager_secret.database_url.arn
    REDIS_URL            = aws_secretsmanager_secret.redis_url.arn
    JWT_SECRET           = aws_secretsmanager_secret.jwt_secret.arn
    ENCRYPTION_KEY       = aws_secretsmanager_secret.encryption_key.arn
    OPENAI_API_KEY       = aws_secretsmanager_secret.openai_api_key.arn
    ANTHROPIC_API_KEY    = aws_secretsmanager_secret.anthropic_api_key.arn
    SUPABASE_URL         = aws_secretsmanager_secret.supabase_url.arn
    SUPABASE_ANON_KEY    = aws_secretsmanager_secret.supabase_anon_key.arn
    RESEND_API_KEY       = aws_secretsmanager_secret.resend_api_key.arn
  }
  
  # Auto Scaling for App Tier
  enable_app_tier_autoscaling = var.enable_app_tier_autoscaling
  app_tier_min_capacity      = var.app_tier_min_capacity
  app_tier_max_capacity      = var.app_tier_max_capacity
  app_tier_target_cpu        = var.app_tier_target_cpu
  
  # Database Configuration
  database_engine              = var.database_engine
  database_engine_version      = var.database_engine_version
  database_instance_class      = var.database_instance_class
  database_allocated_storage   = var.database_allocated_storage
  database_max_allocated_storage = var.database_max_allocated_storage
  database_storage_type        = var.database_storage_type
  database_name               = var.database_name
  database_username           = var.database_username
  database_port               = var.database_port
  database_multi_az           = var.database_multi_az
  database_backup_retention_period = var.database_backup_retention_period
  database_backup_window      = var.database_backup_window
  database_maintenance_window = var.database_maintenance_window
  database_deletion_protection = var.database_deletion_protection
  
  # Database Read Replicas
  database_read_replica_count       = var.database_read_replica_count
  database_read_replica_instance_class = var.database_read_replica_instance_class
  database_read_replica_multi_az     = var.database_read_replica_multi_az
  
  # Database Monitoring
  database_monitoring_interval         = var.database_monitoring_interval
  database_performance_insights_enabled = var.database_performance_insights_enabled
  database_cloudwatch_logs_exports     = var.database_cloudwatch_logs_exports
  
  # Cache Configuration (Redis)
  cache_engine                    = "redis"
  cache_node_type                = var.cache_node_type
  cache_port                     = 6379
  cache_num_nodes                = var.cache_num_nodes
  create_cache_replication_group = var.create_cache_replication_group
  cache_replication_group_size   = var.cache_replication_group_size
  cache_multi_az                 = var.cache_multi_az
  cache_automatic_failover       = var.cache_automatic_failover
  cache_snapshot_retention_limit = var.cache_snapshot_retention_limit
  cache_snapshot_window          = var.cache_snapshot_window
  cache_maintenance_window       = var.cache_maintenance_window
  cache_auth_token_enabled       = var.cache_auth_token_enabled
  
  # Load Balancer Configuration
  enable_deletion_protection = var.enable_deletion_protection
  
  # Health Check Configuration
  web_tier_health_check_path       = var.web_tier_health_check_path
  app_tier_health_check_path       = var.app_tier_health_check_path
  health_check_healthy_threshold   = var.health_check_healthy_threshold
  health_check_unhealthy_threshold = var.health_check_unhealthy_threshold
  health_check_timeout_seconds     = var.health_check_timeout_seconds
  health_check_interval_seconds    = var.health_check_interval_seconds
  
  # Monitoring Configuration
  enable_container_insights   = var.enable_container_insights
  log_retention_days         = var.log_retention_days
  enable_monitoring_alarms   = var.enable_monitoring_alarms
  create_monitoring_dashboard = var.create_monitoring_dashboard
  enable_database_alarms     = var.enable_database_alarms
  
  # Alarm Configuration
  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions   = [aws_sns_topic.alerts.arn]
  
  # WAF Configuration
  enable_waf       = var.enable_waf
  waf_rate_limit   = var.waf_rate_limit
  waf_managed_rules = var.waf_managed_rules
  
  # DNS Configuration
  create_dns_zone        = var.create_dns_zone
  domain_name           = var.domain_name
  create_ssl_certificate = var.create_ssl_certificate
  subject_alternative_names = var.subject_alternative_names
  
  # Security
  enable_flow_logs = var.enable_flow_logs
  
  tags = local.common_tags
}

# Secrets Management
resource "aws_secretsmanager_secret" "session_secret" {
  name                    = "${local.name_prefix}-session-secret"
  description             = "Session secret for learning assistant"
  recovery_window_in_days = 30
  
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "session_secret" {
  secret_id = aws_secretsmanager_secret.session_secret.id
  secret_string = random_password.session_secret.result
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "${local.name_prefix}-jwt-secret"
  description             = "JWT secret for learning assistant"
  recovery_window_in_days = 30
  
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id = aws_secretsmanager_secret.jwt_secret.id
  secret_string = random_password.jwt_secret.result
}

resource "aws_secretsmanager_secret" "encryption_key" {
  name                    = "${local.name_prefix}-encryption-key"
  description             = "Encryption key for learning assistant"
  recovery_window_in_days = 30
  
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "encryption_key" {
  secret_id = aws_secretsmanager_secret.encryption_key.id
  secret_string = random_password.encryption_key.result
}

resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${local.name_prefix}-database-url"
  description             = "Database URL for learning assistant"
  recovery_window_in_days = 30
  
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id = aws_secretsmanager_secret.database_url.id
  secret_string = "postgresql://${var.database_username}:${random_password.database_password.result}@${module.learning_assistant_infrastructure.database_endpoint}:${var.database_port}/${var.database_name}?ssl=true"
}

resource "aws_secretsmanager_secret" "redis_url" {
  name                    = "${local.name_prefix}-redis-url"
  description             = "Redis URL for learning assistant"
  recovery_window_in_days = 30
  
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "redis_url" {
  secret_id = aws_secretsmanager_secret.redis_url.id
  secret_string = var.cache_auth_token_enabled ? 
    "redis://default:${random_password.redis_auth_token.result}@${module.learning_assistant_infrastructure.cache_primary_endpoint}:6379" :
    "redis://${module.learning_assistant_infrastructure.cache_primary_endpoint}:6379"
}

# External API Secrets (these would typically be provided externally)
resource "aws_secretsmanager_secret" "openai_api_key" {
  name                    = "${local.name_prefix}-openai-api-key"
  description             = "OpenAI API key for learning assistant"
  recovery_window_in_days = 30
  
  tags = local.common_tags
}

resource "aws_secretsmanager_secret" "anthropic_api_key" {
  name                    = "${local.name_prefix}-anthropic-api-key"
  description             = "Anthropic API key for learning assistant"
  recovery_window_in_days = 30
  
  tags = local.common_tags
}

resource "aws_secretsmanager_secret" "supabase_url" {
  name                    = "${local.name_prefix}-supabase-url"
  description             = "Supabase URL for learning assistant"
  recovery_window_in_days = 30
  
  tags = local.common_tags
}

resource "aws_secretsmanager_secret" "supabase_anon_key" {
  name                    = "${local.name_prefix}-supabase-anon-key"
  description             = "Supabase anonymous key for learning assistant"
  recovery_window_in_days = 30
  
  tags = local.common_tags
}

resource "aws_secretsmanager_secret" "resend_api_key" {
  name                    = "${local.name_prefix}-resend-api-key"
  description             = "Resend API key for learning assistant"
  recovery_window_in_days = 30
  
  tags = local.common_tags
}

# Generate random passwords
resource "random_password" "session_secret" {
  length  = 64
  special = true
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}

resource "random_password" "encryption_key" {
  length  = 32
  special = false
}

resource "random_password" "database_password" {
  length  = 32
  special = true
}

resource "random_password" "redis_auth_token" {
  count = var.cache_auth_token_enabled ? 1 : 0
  
  length  = 64
  special = false
}

# SNS Topic for Alerts
resource "aws_sns_topic" "alerts" {
  name = "${local.name_prefix}-alerts"
  
  tags = local.common_tags
}

resource "aws_sns_topic_subscription" "email_alerts" {
  count = var.alert_email != "" ? 1 : 0
  
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# S3 Bucket for Application Assets
resource "aws_s3_bucket" "assets" {
  bucket = "${local.name_prefix}-assets-${random_id.bucket_suffix.hex}"
  
  tags = local.common_tags
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_encryption" "assets" {
  bucket = aws_s3_bucket.assets.id
  
  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# CloudFront Distribution for Assets
resource "aws_cloudfront_distribution" "assets" {
  count = var.enable_cdn ? 1 : 0
  
  origin {
    domain_name = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.assets.bucket}"
    
    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.assets[0].cloudfront_access_identity_path
    }
  }
  
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  
  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.assets.bucket}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"
    
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
    
    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }
  
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  
  viewer_certificate {
    cloudfront_default_certificate = true
  }
  
  tags = local.common_tags
}

resource "aws_cloudfront_origin_access_identity" "assets" {
  count = var.enable_cdn ? 1 : 0
  
  comment = "OAI for ${local.name_prefix} assets"
}

# Backup Configuration
resource "aws_backup_vault" "main" {
  count = var.enable_backup ? 1 : 0
  
  name        = "${local.name_prefix}-backup-vault"
  kms_key_arn = aws_kms_key.backup[0].arn
  
  tags = local.common_tags
}

resource "aws_kms_key" "backup" {
  count = var.enable_backup ? 1 : 0
  
  description             = "KMS key for backup encryption"
  deletion_window_in_days = 10
  
  tags = local.common_tags
}

resource "aws_backup_plan" "main" {
  count = var.enable_backup ? 1 : 0
  
  name = "${local.name_prefix}-backup-plan"
  
  rule {
    rule_name         = "daily_backup"
    target_vault_name = aws_backup_vault.main[0].name
    schedule          = var.backup_schedule
    
    lifecycle {
      cold_storage_after = 30
      delete_after       = var.backup_retention_days
    }
    
    recovery_point_tags = local.common_tags
  }
  
  tags = local.common_tags
}

# Monitoring Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  count = var.create_custom_dashboard ? 1 : 0
  
  dashboard_name = "${local.name_prefix}-dashboard"
  
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ServiceName", module.learning_assistant_infrastructure.web_service_name],
            [".", "MemoryUtilization", ".", "."],
            ["AWS/ECS", "CPUUtilization", "ServiceName", module.learning_assistant_infrastructure.app_service_name],
            [".", "MemoryUtilization", ".", "."]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "ECS Service Metrics"
        }
      },
      {
        type   = "metric"
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", module.learning_assistant_infrastructure.database_instance_id],
            [".", "DatabaseConnections", ".", "."],
            [".", "FreeStorageSpace", ".", "."]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "RDS Metrics"
        }
      }
    ]
  })
}

# Output important information
output "application_url" {
  description = "URL to access the learning assistant application"
  value = var.create_dns_zone ? "https://${var.domain_name}" : 
          "http://${module.learning_assistant_infrastructure.load_balancer_dns_name}"
}

output "database_endpoint" {
  description = "RDS database endpoint"
  value       = module.learning_assistant_infrastructure.database_endpoint
  sensitive   = true
}

output "cache_endpoint" {
  description = "Redis cache endpoint"
  value       = module.learning_assistant_infrastructure.cache_primary_endpoint
  sensitive   = true
}

output "vpc_id" {
  description = "VPC ID"
  value       = module.learning_assistant_infrastructure.vpc_id
}

output "load_balancer_dns_name" {
  description = "Load balancer DNS name"
  value       = module.learning_assistant_infrastructure.load_balancer_dns_name
}

output "secrets_manager_arns" {
  description = "ARNs of created Secrets Manager secrets"
  value = {
    session_secret    = aws_secretsmanager_secret.session_secret.arn
    jwt_secret       = aws_secretsmanager_secret.jwt_secret.arn
    encryption_key   = aws_secretsmanager_secret.encryption_key.arn
    database_url     = aws_secretsmanager_secret.database_url.arn
    redis_url        = aws_secretsmanager_secret.redis_url.arn
  }
  sensitive = true
}

output "s3_assets_bucket" {
  description = "S3 bucket for application assets"
  value       = aws_s3_bucket.assets.bucket
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for assets"
  value       = var.enable_cdn ? aws_cloudfront_distribution.assets[0].id : null
}

output "monitoring_dashboard_url" {
  description = "URL to access the CloudWatch dashboard"
  value = var.create_custom_dashboard ? 
    "https://${data.aws_region.current.name}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${local.name_prefix}-dashboard" : 
    null
}