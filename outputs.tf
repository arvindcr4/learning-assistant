# =============================================================================
# TERRAFORM OUTPUTS FOR LEARNING ASSISTANT NEXT.JS APPLICATION
# =============================================================================
# This file contains all the output values that will be displayed after
# terraform apply completes. These outputs provide important information
# about the deployed infrastructure.

# =============================================================================
# NETWORK OUTPUTS
# =============================================================================

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

output "database_subnet_ids" {
  description = "IDs of the database subnets"
  value       = aws_subnet.database[*].id
}

output "nat_gateway_ips" {
  description = "Public IPs of the NAT gateways"
  value       = var.enable_nat_gateway ? aws_eip.nat[*].public_ip : []
}

# =============================================================================
# DATABASE OUTPUTS
# =============================================================================

output "database_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.main.endpoint
}

output "database_port" {
  description = "RDS instance port"
  value       = aws_db_instance.main.port
}

output "database_name" {
  description = "Name of the database"
  value       = aws_db_instance.main.db_name
}

output "database_username" {
  description = "Username for the database"
  value       = aws_db_instance.main.username
  sensitive   = true
}

output "database_connection_string" {
  description = "Database connection string (without password)"
  value       = "postgresql://${aws_db_instance.main.username}:PASSWORD@${aws_db_instance.main.endpoint}:${aws_db_instance.main.port}/${aws_db_instance.main.db_name}"
  sensitive   = true
}

# =============================================================================
# ECS OUTPUTS
# =============================================================================

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = aws_ecs_cluster.main.arn
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = aws_ecs_service.main.name
}

output "ecs_task_definition_arn" {
  description = "ARN of the ECS task definition"
  value       = aws_ecs_task_definition.main.arn
}

output "ecs_task_definition_family" {
  description = "Family of the ECS task definition"
  value       = aws_ecs_task_definition.main.family
}

output "ecs_task_definition_revision" {
  description = "Revision of the ECS task definition"
  value       = aws_ecs_task_definition.main.revision
}

# =============================================================================
# LOAD BALANCER OUTPUTS
# =============================================================================

output "load_balancer_dns_name" {
  description = "DNS name of the load balancer"
  value       = aws_lb.main.dns_name
}

output "load_balancer_arn" {
  description = "ARN of the load balancer"
  value       = aws_lb.main.arn
}

output "load_balancer_zone_id" {
  description = "Zone ID of the load balancer"
  value       = aws_lb.main.zone_id
}

output "target_group_arn" {
  description = "ARN of the target group"
  value       = aws_lb_target_group.main.arn
}

output "application_url" {
  description = "URL to access the application"
  value       = var.domain_name != "" ? "https://${var.domain_name}" : "https://${aws_lb.main.dns_name}"
}

output "application_health_check_url" {
  description = "URL for application health check"
  value       = var.domain_name != "" ? "https://${var.domain_name}/api/health" : "https://${aws_lb.main.dns_name}/api/health"
}

# =============================================================================
# SECURITY GROUP OUTPUTS
# =============================================================================

output "alb_security_group_id" {
  description = "ID of the ALB security group"
  value       = aws_security_group.alb.id
}

output "ecs_security_group_id" {
  description = "ID of the ECS tasks security group"
  value       = aws_security_group.ecs_tasks.id
}

output "database_security_group_id" {
  description = "ID of the database security group"
  value       = aws_security_group.database.id
}

# =============================================================================
# CLOUDWATCH OUTPUTS
# =============================================================================

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group for ECS tasks"
  value       = aws_cloudwatch_log_group.ecs_tasks.name
}

output "cloudwatch_log_group_arn" {
  description = "ARN of the CloudWatch log group for ECS tasks"
  value       = aws_cloudwatch_log_group.ecs_tasks.arn
}

# =============================================================================
# S3 OUTPUTS
# =============================================================================

output "alb_logs_bucket_name" {
  description = "Name of the S3 bucket for ALB logs"
  value       = aws_s3_bucket.alb_logs.id
}

output "alb_logs_bucket_arn" {
  description = "ARN of the S3 bucket for ALB logs"
  value       = aws_s3_bucket.alb_logs.arn
}

# =============================================================================
# ROUTE 53 OUTPUTS (OPTIONAL)
# =============================================================================

output "route53_zone_id" {
  description = "Route 53 hosted zone ID"
  value       = var.domain_name != "" ? aws_route53_zone.main[0].zone_id : null
}

output "route53_name_servers" {
  description = "Route 53 name servers"
  value       = var.domain_name != "" ? aws_route53_zone.main[0].name_servers : null
}

# =============================================================================
# MONITORING OUTPUTS
# =============================================================================

output "sns_topic_arn" {
  description = "ARN of the SNS topic for alerts"
  value       = aws_sns_topic.alerts.arn
}

output "cloudwatch_alarms" {
  description = "CloudWatch alarm names"
  value = {
    high_cpu      = aws_cloudwatch_metric_alarm.high_cpu.alarm_name
    high_memory   = aws_cloudwatch_metric_alarm.high_memory.alarm_name
    database_cpu  = aws_cloudwatch_metric_alarm.database_cpu.alarm_name
  }
}

# =============================================================================
# IAM OUTPUTS
# =============================================================================

output "ecs_task_execution_role_arn" {
  description = "ARN of the ECS task execution role"
  value       = aws_iam_role.ecs_task_execution_role.arn
}

output "ecs_task_role_arn" {
  description = "ARN of the ECS task role"
  value       = aws_iam_role.ecs_task_role.arn
}

# =============================================================================
# SUMMARY OUTPUTS
# =============================================================================

output "deployment_summary" {
  description = "Summary of the deployment"
  value = {
    application_name     = var.app_name
    environment         = var.environment
    aws_region          = var.aws_region
    vpc_id              = aws_vpc.main.id
    ecs_cluster_name    = aws_ecs_cluster.main.name
    database_endpoint   = aws_db_instance.main.endpoint
    load_balancer_dns   = aws_lb.main.dns_name
    application_url     = var.domain_name != "" ? "https://${var.domain_name}" : "https://${aws_lb.main.dns_name}"
    health_check_url    = var.domain_name != "" ? "https://${var.domain_name}/api/health" : "https://${aws_lb.main.dns_name}/api/health"
  }
}

# =============================================================================
# INSTRUCTIONS OUTPUT
# =============================================================================

output "post_deployment_instructions" {
  description = "Instructions for post-deployment setup"
  value = <<-EOT
    
    🎉 Deployment Complete! 
    
    Your Learning Assistant Next.js application has been successfully deployed to AWS.
    
    📋 Next Steps:
    
    1. Application Access:
       - URL: ${var.domain_name != "" ? "https://${var.domain_name}" : "https://${aws_lb.main.dns_name}"}
       - Health Check: ${var.domain_name != "" ? "https://${var.domain_name}/api/health" : "https://${aws_lb.main.dns_name}/api/health"}
    
    2. SSL Certificate:
       ${var.ssl_certificate_arn == "" ? "⚠️  You need to provide an SSL certificate ARN for HTTPS to work properly." : "✅ SSL certificate is configured."}
    
    3. Domain Setup:
       ${var.domain_name == "" ? "⚠️  No domain configured. Using ALB DNS name." : "✅ Domain configured. Update your DNS settings with the following name servers:"}
       ${var.domain_name != "" ? join(", ", aws_route53_zone.main[0].name_servers) : ""}
    
    4. Database Connection:
       - Endpoint: ${aws_db_instance.main.endpoint}
       - Port: ${aws_db_instance.main.port}
       - Database: ${aws_db_instance.main.db_name}
       - Username: ${aws_db_instance.main.username}
    
    5. Monitoring:
       - CloudWatch Logs: ${aws_cloudwatch_log_group.ecs_tasks.name}
       - SNS Alerts: ${aws_sns_topic.alerts.name}
       ${var.alert_email != "" ? "- Email notifications will be sent to: ${var.alert_email}" : "- Configure alert_email variable for email notifications"}
    
    6. ECS Management:
       - Cluster: ${aws_ecs_cluster.main.name}
       - Service: ${aws_ecs_service.main.name}
       - Task Definition: ${aws_ecs_task_definition.main.family}:${aws_ecs_task_definition.main.revision}
    
    💡 Tips:
    - Use 'aws ecs execute-command' to debug containers
    - Check CloudWatch logs for application logs
    - Monitor the health check endpoint for application status
    - Auto-scaling is configured for ${var.ecs_autoscaling_min_capacity}-${var.ecs_autoscaling_max_capacity} instances
    
    🔐 Security:
    - Database is in private subnets
    - ECS tasks are in private subnets
    - Security groups follow least privilege principle
    - ALB logs are stored in S3 with encryption
    
  EOT
}