# AWS Infrastructure Stack

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = merge(var.tags, {
      Stack       = "aws"
      Environment = var.environment
      ManagedBy   = "terraform"
    })
  }
}

# Get current AWS account ID and region
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Network Module
module "network" {
  source = "../../modules/network"

  cloud_provider       = "aws"
  name                 = var.name
  cidr_block          = var.cidr_block
  availability_zones  = var.availability_zones
  public_subnet_cidrs = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  enable_nat_gateway  = var.enable_nat_gateway
  enable_dns_hostnames = var.enable_dns_hostnames
  tags                = var.tags
}

# ECR Repository for Container Images
resource "aws_ecr_repository" "app" {
  name                 = "${var.name}-app"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  lifecycle {
    prevent_destroy = false
  }

  tags = var.tags
}

# ECR Lifecycle Policy
resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Expire untagged images after 7 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# CloudWatch Log Group for Container Service
resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${var.name}"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

# Container Service Module
module "container_service" {
  source = "../../modules/container_service"

  cloud_provider         = "aws"
  name                   = var.service_name
  image                  = "${aws_ecr_repository.app.repository_url}:${var.service_image_tag}"
  cpu                    = var.service_cpu
  memory                 = var.service_memory
  port                   = var.service_port
  desired_count          = var.desired_count
  min_count              = var.min_count
  max_count              = var.max_count
  health_check_path      = var.health_check_path
  health_check_interval  = var.health_check_interval
  health_check_timeout   = var.health_check_timeout
  vpc_id                 = module.network.vpc_id
  subnet_ids             = module.network.public_subnet_ids
  environment_variables  = merge(var.environment_variables, {
    DATABASE_URL = module.database_postgres.connection_string
    REDIS_URL    = var.enable_redis ? module.cache_redis[0].connection_string : ""
    S3_BUCKET    = module.object_storage.bucket_name
  })
  tags = var.tags
}

# Database Module
module "database_postgres" {
  source = "../../modules/database_postgres"

  cloud_provider             = "aws"
  name                       = var.db_name
  engine_version             = var.db_engine_version
  instance_class             = var.db_instance_class
  allocated_storage          = var.db_allocated_storage
  storage_type               = var.db_storage_type
  database_name              = var.db_database_name
  master_username            = var.db_master_username
  master_password            = var.db_master_password
  backup_retention_period    = var.db_backup_retention_period
  backup_window              = var.db_backup_window
  maintenance_window         = var.db_maintenance_window
  multi_az                   = var.db_multi_az
  vpc_id                     = module.network.vpc_id
  subnet_ids                 = module.network.private_subnet_ids
  allowed_cidr_blocks        = [module.network.vpc_cidr_block]
  enable_deletion_protection = var.db_deletion_protection
  enable_encryption          = true
  performance_insights_enabled = var.db_performance_insights
  enable_logging             = true
  tags                       = var.tags
}

# Redis Cache Module (Optional)
module "cache_redis" {
  count  = var.enable_redis ? 1 : 0
  source = "../../modules/cache_redis"

  cloud_provider             = "aws"
  name                       = var.cache_name
  node_type                  = var.cache_node_type
  engine_version             = var.cache_engine_version
  num_cache_nodes            = var.cache_num_nodes
  automatic_failover_enabled = var.cache_automatic_failover
  multi_az_enabled           = var.cache_multi_az
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token_enabled         = true
  snapshot_retention_limit   = var.cache_snapshot_retention
  vpc_id                     = module.network.vpc_id
  subnet_ids                 = module.network.private_subnet_ids
  allowed_cidr_blocks        = [module.network.vpc_cidr_block]
  tags                       = var.tags
}

# S3 Bucket for Backups and Static Files
module "object_storage" {
  source = "../../modules/object_storage"

  cloud_provider      = "aws"
  bucket_name         = var.bucket_name
  versioning          = var.bucket_versioning
  force_destroy       = var.bucket_force_destroy
  encryption_enabled  = true
  public_access_block = true
  enable_logging      = true
  log_bucket          = var.log_bucket_name
  
  lifecycle_rules = [
    {
      id                       = "backup-lifecycle"
      enabled                  = true
      prefix                   = "backups/"
      expiration_days          = 90
      transition_storage_class = "GLACIER"
      transition_days          = 30
    },
    {
      id                       = "temp-lifecycle"
      enabled                  = true
      prefix                   = "temp/"
      expiration_days          = 7
      transition_storage_class = ""
      transition_days          = 0
    }
  ]

  cors_rules = [
    {
      allowed_headers = ["*"]
      allowed_methods = ["GET", "PUT", "POST"]
      allowed_origins = var.cors_allowed_origins
      expose_headers  = ["ETag"]
      max_age_seconds = 3000
    }
  ]

  tags = var.tags
}

# TLS Certificate for Custom Domain
module "tls_cert" {
  count  = var.create_certificate ? 1 : 0
  source = "../../modules/tls_cert"

  cloud_provider            = "aws"
  domain_name               = var.domain_name
  subject_alternative_names = var.subject_alternative_names
  validation_method         = "DNS"
  dns_zone_id               = var.route53_zone_id
  tags                      = var.tags
}

# CloudFront CDN
module "cdn" {
  source = "../../modules/cdn"

  cloud_provider         = "aws"
  name                   = var.cdn_name
  origin_domain_name     = module.container_service.load_balancer_endpoint
  origin_protocol        = "https-only"
  custom_domain_names    = var.cdn_custom_domains
  certificate_arn        = var.create_certificate ? module.tls_cert[0].certificate_arn : var.certificate_arn
  price_class            = var.cdn_price_class
  viewer_protocol_policy = "redirect-to-https"
  allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
  cached_methods         = ["GET", "HEAD", "OPTIONS"]
  enable_compression     = true
  enable_logging         = true
  log_bucket             = var.log_bucket_name
  
  custom_error_responses = [
    {
      error_code         = 404
      response_code      = 200
      response_page_path = "/index.html"
      error_caching_ttl  = 300
    }
  ]

  tags = var.tags
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "ecs_cpu_high" {
  alarm_name          = "${var.name}-ecs-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ECS CPU utilization"
  alarm_actions       = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    ServiceName = module.container_service.service_name
    ClusterName = var.name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "ecs_memory_high" {
  alarm_name          = "${var.name}-ecs-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ECS memory utilization"
  alarm_actions       = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    ServiceName = module.container_service.service_name
    ClusterName = var.name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  alarm_name          = "${var.name}-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "75"
  alarm_description   = "This metric monitors RDS CPU utilization"
  alarm_actions       = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    DBInstanceIdentifier = module.database_postgres.instance_id
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "rds_storage_low" {
  alarm_name          = "${var.name}-rds-storage-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "1073741824" # 1GB in bytes
  alarm_description   = "This metric monitors RDS free storage"
  alarm_actions       = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    DBInstanceIdentifier = module.database_postgres.instance_id
  }

  tags = var.tags
}

# IAM Role for CI/CD ECR Push
resource "aws_iam_role" "ci_ecr_push" {
  name = "${var.name}-ci-ecr-push"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Federated = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/${var.github_oidc_provider}"
        }
        Condition = {
          StringEquals = {
            "${var.github_oidc_provider}:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "${var.github_oidc_provider}:sub" = "repo:${var.github_repository}:*"
          }
        }
      }
    ]
  })

  tags = var.tags
}

# IAM Policy for ECR Push
resource "aws_iam_role_policy" "ci_ecr_push" {
  name = "${var.name}-ci-ecr-push"
  role = aws_iam_role.ci_ecr_push.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
        Resource = [
          aws_ecr_repository.app.arn,
          "${aws_ecr_repository.app.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices"
        ]
        Resource = [
          "arn:aws:ecs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:service/${var.name}/*"
        ]
      }
    ]
  })
}

# Outputs
output "alb_url" {
  description = "Application Load Balancer URL"
  value       = "https://${module.container_service.load_balancer_endpoint}"
}

output "db_url" {
  description = "Database connection endpoint"
  value       = module.database_postgres.endpoint
  sensitive   = true
}

output "redis_url" {
  description = "Redis cache endpoint"
  value       = var.enable_redis ? module.cache_redis[0].endpoint : null
  sensitive   = true
}

output "cloudfront_url" {
  description = "CloudFront distribution URL"
  value       = module.cdn.cdn_url
}

output "ecr_repository_url" {
  description = "ECR repository URL"
  value       = aws_ecr_repository.app.repository_url
}

output "ci_role_arn" {
  description = "IAM role ARN for CI/CD"
  value       = aws_iam_role.ci_ecr_push.arn
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.app.name
}

