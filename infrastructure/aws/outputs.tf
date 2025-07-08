# Outputs for AWS Infrastructure
# Learning Assistant Application

# VPC Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = module.vpc.private_subnet_ids
}

output "database_subnet_ids" {
  description = "IDs of the database subnets"
  value       = module.vpc.database_subnet_ids
}

output "internet_gateway_id" {
  description = "ID of the Internet Gateway"
  value       = module.vpc.internet_gateway_id
}

output "nat_gateway_ids" {
  description = "IDs of the NAT Gateways"
  value       = module.vpc.nat_gateway_ids
}

# Security Groups Outputs
output "alb_security_group_id" {
  description = "ID of the ALB security group"
  value       = module.security_groups.alb_security_group_id
}

output "ecs_security_group_id" {
  description = "ID of the ECS security group"
  value       = module.security_groups.ecs_security_group_id
}

output "rds_security_group_id" {
  description = "ID of the RDS security group"
  value       = module.security_groups.rds_security_group_id
}

output "redis_security_group_id" {
  description = "ID of the Redis security group"
  value       = module.security_groups.redis_security_group_id
}

# Application Load Balancer Outputs
output "alb_dns_name" {
  description = "DNS name of the load balancer"
  value       = module.alb.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the load balancer"
  value       = module.alb.zone_id
}

output "alb_arn" {
  description = "ARN of the load balancer"
  value       = module.alb.arn
}

output "target_group_arn" {
  description = "ARN of the target group"
  value       = module.alb.target_group_arn
}

# ECS Outputs
output "ecs_cluster_id" {
  description = "ID of the ECS cluster"
  value       = module.ecs.cluster_id
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = module.ecs.cluster_name
}

output "ecs_service_id" {
  description = "ID of the ECS service"
  value       = module.ecs.service_id
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = module.ecs.service_name
}

output "ecs_task_definition_arn" {
  description = "ARN of the ECS task definition"
  value       = module.ecs.task_definition_arn
}

output "ecs_task_execution_role_arn" {
  description = "ARN of the ECS task execution role"
  value       = module.iam.ecs_task_execution_role_arn
}

output "ecs_task_role_arn" {
  description = "ARN of the ECS task role"
  value       = module.iam.ecs_task_role_arn
}

# RDS Outputs
output "db_instance_endpoint" {
  description = "RDS instance endpoint"
  value       = module.rds.db_instance_endpoint
  sensitive   = true
}

output "db_instance_address" {
  description = "RDS instance address"
  value       = module.rds.db_instance_address
  sensitive   = true
}

output "db_instance_port" {
  description = "RDS instance port"
  value       = module.rds.db_instance_port
}

output "db_instance_id" {
  description = "RDS instance ID"
  value       = module.rds.db_instance_id
}

output "db_instance_identifier" {
  description = "RDS instance identifier"
  value       = module.rds.db_instance_identifier
}

output "db_subnet_group_id" {
  description = "RDS subnet group ID"
  value       = module.rds.db_subnet_group_id
}

output "db_read_replica_endpoint" {
  description = "RDS read replica endpoint"
  value       = try(module.rds.db_read_replica_endpoint, null)
  sensitive   = true
}

# ElastiCache Outputs
output "redis_endpoint" {
  description = "Redis endpoint"
  value       = module.elasticache.primary_endpoint_address
  sensitive   = true
}

output "redis_port" {
  description = "Redis port"
  value       = module.elasticache.port
}

output "redis_cluster_id" {
  description = "Redis cluster ID"
  value       = module.elasticache.cluster_id
}

output "redis_replication_group_id" {
  description = "Redis replication group ID"
  value       = module.elasticache.replication_group_id
}

# Route 53 Outputs
output "route53_zone_id" {
  description = "Route 53 zone ID"
  value       = var.create_route53_zone ? module.route53[0].zone_id : null
}

output "route53_name_servers" {
  description = "Route 53 name servers"
  value       = var.create_route53_zone ? module.route53[0].name_servers : null
}

# CloudWatch Outputs
output "cloudwatch_log_group_name" {
  description = "CloudWatch log group name"
  value       = module.cloudwatch.log_group_name
}

output "cloudwatch_log_group_arn" {
  description = "CloudWatch log group ARN"
  value       = module.cloudwatch.log_group_arn
}

# Connection Information
output "application_url" {
  description = "Application URL"
  value       = var.certificate_arn != "" ? "https://${var.domain_name}" : "http://${module.alb.dns_name}"
}

output "database_connection_string" {
  description = "Database connection string"
  value       = "postgresql://${var.db_username}:${var.db_password}@${module.rds.db_instance_endpoint}/${var.db_name}"
  sensitive   = true
}

output "redis_connection_string" {
  description = "Redis connection string"
  value       = "redis://${module.elasticache.primary_endpoint_address}:${module.elasticache.port}"
  sensitive   = true
}

# Resource Information
output "resource_summary" {
  description = "Summary of created resources"
  value = {
    vpc_id                    = module.vpc.vpc_id
    alb_dns_name             = module.alb.dns_name
    ecs_cluster_name         = module.ecs.cluster_name
    ecs_service_name         = module.ecs.service_name
    db_instance_identifier   = module.rds.db_instance_identifier
    redis_cluster_id         = module.elasticache.cluster_id
    environment              = var.environment
    region                   = var.aws_region
  }
}

# Cost Information
output "estimated_monthly_cost" {
  description = "Estimated monthly cost breakdown"
  value = {
    note = "Costs are estimates and may vary based on usage"
    ecs_fargate = "~$30-100/month (depends on task count and size)"
    rds = "~$15-50/month (depends on instance class and storage)"
    elasticache = "~$15-30/month (depends on node type)"
    alb = "~$20-25/month (base cost plus data processing)"
    nat_gateway = var.enable_nat_gateway ? "~$45-90/month (depends on data transfer)" : "Not used"
    total_estimate = "~$125-300/month (excluding data transfer costs)"
  }
}

# Deployment Information
output "deployment_info" {
  description = "Information for deployment"
  value = {
    container_registry_url = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
    ecs_cluster_name      = module.ecs.cluster_name
    ecs_service_name      = module.ecs.service_name
    task_definition_family = "${local.name_prefix}-task"
    log_group_name        = module.cloudwatch.log_group_name
  }
}