# Network Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = module.network.vpc_id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = module.network.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = module.network.private_subnet_ids
}

# Container Service Outputs
output "service_endpoint" {
  description = "ECS service endpoint"
  value       = module.container_service.service_endpoint
}

output "load_balancer_dns" {
  description = "Application Load Balancer DNS name"
  value       = module.container_service.load_balancer_endpoint
}

output "load_balancer_url" {
  description = "Application Load Balancer URL"
  value       = "https://${module.container_service.load_balancer_endpoint}"
}

output "service_arn" {
  description = "ECS service ARN"
  value       = module.container_service.service_arn
}

output "task_role_arn" {
  description = "ECS task IAM role ARN"
  value       = module.container_service.iam_role_arn
}

# ECR Outputs
output "ecr_repository_url" {
  description = "ECR repository URL"
  value       = aws_ecr_repository.app.repository_url
}

output "ecr_repository_arn" {
  description = "ECR repository ARN"
  value       = aws_ecr_repository.app.arn
}

# Database Outputs
output "database_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = module.database_postgres.endpoint
  sensitive   = true
}

output "database_port" {
  description = "RDS PostgreSQL port"
  value       = module.database_postgres.port
}

output "database_name" {
  description = "Database name"
  value       = module.database_postgres.database_name
}

output "database_username" {
  description = "Database master username"
  value       = module.database_postgres.username
  sensitive   = true
}

output "database_connection_string" {
  description = "Database connection string (without password)"
  value       = module.database_postgres.connection_string
  sensitive   = true
}

output "database_instance_id" {
  description = "RDS instance ID"
  value       = module.database_postgres.instance_id
}

# Redis Cache Outputs
output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = var.enable_redis ? module.cache_redis[0].endpoint : null
  sensitive   = true
}

output "redis_port" {
  description = "ElastiCache Redis port"
  value       = var.enable_redis ? module.cache_redis[0].port : null
}

output "redis_connection_string" {
  description = "Redis connection string"
  value       = var.enable_redis ? module.cache_redis[0].connection_string : null
  sensitive   = true
}

output "redis_cluster_id" {
  description = "ElastiCache cluster ID"
  value       = var.enable_redis ? module.cache_redis[0].cluster_id : null
}

# S3 Bucket Outputs
output "s3_bucket_name" {
  description = "S3 bucket name"
  value       = module.object_storage.bucket_name
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN"
  value       = module.object_storage.bucket_arn
}

output "s3_bucket_domain_name" {
  description = "S3 bucket domain name"
  value       = module.object_storage.bucket_domain_name
}

# CloudFront CDN Outputs
output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = module.cdn.distribution_id
}

output "cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN"
  value       = module.cdn.distribution_arn
}

output "cloudfront_domain_name" {
  description = "CloudFront domain name"
  value       = module.cdn.cdn_domain_name
}

output "cloudfront_url" {
  description = "CloudFront URL"
  value       = module.cdn.cdn_url
}

output "cloudfront_custom_domains" {
  description = "CloudFront custom domain names"
  value       = module.cdn.custom_domain_names
}

# Certificate Outputs
output "certificate_arn" {
  description = "ACM certificate ARN"
  value       = var.create_certificate ? module.tls_cert[0].certificate_arn : var.certificate_arn
}

output "certificate_domain_name" {
  description = "Certificate domain name"
  value       = var.create_certificate ? module.tls_cert[0].domain_name : var.domain_name
}

# CloudWatch Outputs
output "cloudwatch_log_group_name" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.app.name
}

output "cloudwatch_log_group_arn" {
  description = "CloudWatch log group ARN"
  value       = aws_cloudwatch_log_group.app.arn
}

# IAM Outputs
output "ci_role_arn" {
  description = "IAM role ARN for CI/CD"
  value       = aws_iam_role.ci_ecr_push.arn
}

output "ci_role_name" {
  description = "IAM role name for CI/CD"
  value       = aws_iam_role.ci_ecr_push.name
}

# Alarm Outputs
output "alarm_names" {
  description = "CloudWatch alarm names"
  value = {
    ecs_cpu_high    = aws_cloudwatch_metric_alarm.ecs_cpu_high.alarm_name
    ecs_memory_high = aws_cloudwatch_metric_alarm.ecs_memory_high.alarm_name
    rds_cpu_high    = aws_cloudwatch_metric_alarm.rds_cpu_high.alarm_name
    rds_storage_low = aws_cloudwatch_metric_alarm.rds_storage_low.alarm_name
  }
}

# Summary Output
output "infrastructure_summary" {
  description = "Summary of deployed infrastructure"
  value = {
    region                = var.region
    environment           = var.environment
    app_url               = "https://${module.container_service.load_balancer_endpoint}"
    cdn_url               = module.cdn.cdn_url
    ecr_repository        = aws_ecr_repository.app.repository_url
    database_endpoint     = module.database_postgres.endpoint
    redis_endpoint        = var.enable_redis ? module.cache_redis[0].endpoint : "Not enabled"
    s3_bucket             = module.object_storage.bucket_name
    log_group             = aws_cloudwatch_log_group.app.name
    ci_role               = aws_iam_role.ci_ecr_push.arn
  }
}
