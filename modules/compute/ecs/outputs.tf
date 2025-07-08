# ECS Module Outputs
# Enterprise-grade ECS outputs

# Cluster Information
output "cluster_id" {
  description = "ID of the ECS cluster"
  value       = aws_ecs_cluster.main.id
}

output "cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = aws_ecs_cluster.main.arn
}

output "cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

# Service Information
output "service_id" {
  description = "ID of the ECS service"
  value       = aws_ecs_service.main.id
}

output "service_arn" {
  description = "ARN of the ECS service"
  value       = aws_ecs_service.main.id
}

output "service_name" {
  description = "Name of the ECS service"
  value       = aws_ecs_service.main.name
}

output "service_cluster" {
  description = "Cluster name of the ECS service"
  value       = aws_ecs_service.main.cluster
}

output "service_desired_count" {
  description = "Desired count of the ECS service"
  value       = aws_ecs_service.main.desired_count
}

# Task Definition Information
output "task_definition_arn" {
  description = "ARN of the task definition"
  value       = aws_ecs_task_definition.main.arn
}

output "task_definition_family" {
  description = "Family of the task definition"
  value       = aws_ecs_task_definition.main.family
}

output "task_definition_revision" {
  description = "Revision of the task definition"
  value       = aws_ecs_task_definition.main.revision
}

# Load Balancer Information
output "load_balancer_arn" {
  description = "ARN of the Application Load Balancer"
  value       = var.create_load_balancer ? aws_lb.main[0].arn : null
}

output "load_balancer_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = var.create_load_balancer ? aws_lb.main[0].dns_name : null
}

output "load_balancer_zone_id" {
  description = "Zone ID of the Application Load Balancer"
  value       = var.create_load_balancer ? aws_lb.main[0].zone_id : null
}

output "target_group_arn" {
  description = "ARN of the target group"
  value       = var.create_load_balancer ? aws_lb_target_group.main[0].arn : null
}

output "target_group_name" {
  description = "Name of the target group"
  value       = var.create_load_balancer ? aws_lb_target_group.main[0].name : null
}

# Security Groups
output "ecs_service_security_group_id" {
  description = "ID of the ECS service security group"
  value       = aws_security_group.ecs_service.id
}

output "ecs_instances_security_group_id" {
  description = "ID of the ECS instances security group (EC2 launch type only)"
  value       = var.launch_type == "EC2" ? aws_security_group.ecs_instances[0].id : null
}

output "load_balancer_security_group_id" {
  description = "ID of the load balancer security group"
  value       = var.create_load_balancer ? aws_security_group.load_balancer[0].id : null
}

# Auto Scaling Information
output "autoscaling_group_arn" {
  description = "ARN of the Auto Scaling Group (EC2 launch type only)"
  value       = var.launch_type == "EC2" ? aws_autoscaling_group.ecs[0].arn : null
}

output "autoscaling_group_name" {
  description = "Name of the Auto Scaling Group (EC2 launch type only)"
  value       = var.launch_type == "EC2" ? aws_autoscaling_group.ecs[0].name : null
}

output "autoscaling_target_resource_id" {
  description = "Resource ID of the ECS auto scaling target"
  value       = var.enable_autoscaling ? aws_appautoscaling_target.ecs_target[0].resource_id : null
}

output "autoscaling_policy_arn" {
  description = "ARN of the auto scaling policy"
  value       = var.enable_autoscaling ? aws_appautoscaling_policy.ecs_policy_up[0].arn : null
}

# IAM Roles
output "ecs_execution_role_arn" {
  description = "ARN of the ECS execution role"
  value       = aws_iam_role.ecs_execution.arn
}

output "ecs_task_role_arn" {
  description = "ARN of the ECS task role"
  value       = aws_iam_role.ecs_task.arn
}

output "ecs_instance_role_arn" {
  description = "ARN of the ECS instance role (EC2 launch type only)"
  value       = var.launch_type == "EC2" ? aws_iam_role.ecs_instance[0].arn : null
}

output "ecs_instance_profile_name" {
  description = "Name of the ECS instance profile (EC2 launch type only)"
  value       = var.launch_type == "EC2" ? aws_iam_instance_profile.ecs[0].name : null
}

# Launch Template (EC2 only)
output "launch_template_id" {
  description = "ID of the launch template (EC2 launch type only)"
  value       = var.launch_type == "EC2" ? aws_launch_template.ecs[0].id : null
}

output "launch_template_arn" {
  description = "ARN of the launch template (EC2 launch type only)"
  value       = var.launch_type == "EC2" ? aws_launch_template.ecs[0].arn : null
}

output "launch_template_latest_version" {
  description = "Latest version of the launch template (EC2 launch type only)"
  value       = var.launch_type == "EC2" ? aws_launch_template.ecs[0].latest_version : null
}

# CloudWatch Logs
output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.ecs.name
}

output "cloudwatch_log_group_arn" {
  description = "ARN of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.ecs.arn
}

# KMS (if encryption enabled)
output "kms_key_id" {
  description = "ID of the KMS key (if encryption enabled)"
  value       = var.enable_encryption ? aws_kms_key.ecs[0].key_id : null
}

output "kms_key_arn" {
  description = "ARN of the KMS key (if encryption enabled)"
  value       = var.enable_encryption ? aws_kms_key.ecs[0].arn : null
}

output "kms_alias_name" {
  description = "Name of the KMS alias (if encryption enabled)"
  value       = var.enable_encryption ? aws_kms_alias.ecs[0].name : null
}

# Network Configuration
output "vpc_id" {
  description = "VPC ID where resources are created"
  value       = var.vpc_id
}

output "private_subnet_ids" {
  description = "Private subnet IDs used by ECS tasks"
  value       = var.private_subnet_ids
}

output "public_subnet_ids" {
  description = "Public subnet IDs used by load balancer"
  value       = var.public_subnet_ids
}

# Service Configuration
output "service_configuration" {
  description = "ECS service configuration summary"
  value = {
    launch_type                     = var.launch_type
    platform_version               = var.platform_version
    network_mode                   = var.network_mode
    desired_count                  = var.desired_count
    deployment_maximum_percent      = var.deployment_maximum_percent
    deployment_minimum_healthy_percent = var.deployment_minimum_healthy_percent
    enable_circuit_breaker         = var.enable_circuit_breaker
    enable_rollback               = var.enable_rollback
    enable_execute_command        = var.enable_execute_command
    assign_public_ip              = var.assign_public_ip
  }
}

# Task Configuration
output "task_configuration" {
  description = "ECS task configuration summary"
  value = {
    family          = aws_ecs_task_definition.main.family
    cpu            = var.task_cpu
    memory         = var.task_memory
    container_name = var.container_name
    container_image = var.container_image
    container_port = var.container_port
    health_check_enabled = var.health_check_enabled
    volumes_count   = length(var.volumes)
    mount_points_count = length(var.mount_points)
  }
}

# Auto Scaling Configuration
output "autoscaling_configuration" {
  description = "Auto scaling configuration summary"
  value = {
    enabled         = var.enable_autoscaling
    min_capacity   = var.autoscaling_min_capacity
    max_capacity   = var.autoscaling_max_capacity
    target_cpu     = var.autoscaling_target_cpu
  }
}

# Load Balancer Configuration
output "load_balancer_configuration" {
  description = "Load balancer configuration summary"
  value = {
    created                = var.create_load_balancer
    internal              = var.internal_load_balancer
    deletion_protection   = var.enable_deletion_protection
    access_logs_enabled   = var.enable_access_logs
    health_check_path     = var.health_check_path
    health_check_matcher  = var.health_check_matcher
  }
}

# Security Configuration
output "security_configuration" {
  description = "Security configuration summary"
  value = {
    encryption_enabled       = var.enable_encryption
    exec_logging_enabled    = var.enable_exec_logging
    ssh_access_enabled      = var.enable_ssh_access
    container_insights      = var.enable_container_insights
    compliance_framework    = var.compliance_framework
    data_classification     = var.data_classification
  }
}

# Monitoring Configuration
output "monitoring_configuration" {
  description = "Monitoring configuration summary"
  value = {
    container_insights        = var.enable_container_insights
    detailed_monitoring      = var.enable_detailed_monitoring
    performance_insights     = var.enable_performance_insights
    log_retention_days      = var.log_retention_days
    access_logs_enabled     = var.enable_access_logs
  }
}

# Cost Optimization
output "cost_optimization" {
  description = "Cost optimization configuration"
  value = {
    spot_instances_enabled = var.enable_spot_instances
    capacity_providers    = var.capacity_providers
    launch_type          = var.launch_type
    instance_type        = var.instance_type
  }
}

# Resource URLs
output "resource_urls" {
  description = "URLs for accessing resources"
  value = {
    load_balancer_url = var.create_load_balancer ? "http://${aws_lb.main[0].dns_name}" : null
    ecs_console_url   = "https://console.aws.amazon.com/ecs/home?region=${data.aws_region.current.name}#/clusters/${aws_ecs_cluster.main.name}/services"
    cloudwatch_logs_url = "https://console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#logsV2:log-groups/log-group/${replace(aws_cloudwatch_log_group.ecs.name, "/", "$252F")}"
  }
}

# Capacity Information
output "capacity_information" {
  description = "Capacity information for the ECS service"
  value = {
    ec2_instances = var.launch_type == "EC2" ? {
      min_capacity     = var.min_capacity
      max_capacity     = var.max_capacity
      desired_capacity = var.desired_capacity
      instance_type    = var.instance_type
    } : null
    
    fargate_tasks = var.launch_type == "FARGATE" ? {
      desired_count = var.desired_count
      cpu          = var.task_cpu
      memory       = var.task_memory
    } : null
    
    autoscaling = var.enable_autoscaling ? {
      min_capacity = var.autoscaling_min_capacity
      max_capacity = var.autoscaling_max_capacity
      target_cpu   = var.autoscaling_target_cpu
    } : null
  }
}

# Tags Applied
output "applied_tags" {
  description = "Tags applied to all resources"
  value = merge(
    var.tags,
    {
      Module      = "compute/ecs"
      Environment = var.environment
      Project     = var.project_name
      ManagedBy   = "terraform"
    }
  )
}