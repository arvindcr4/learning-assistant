# ECS Module Outputs

output "cluster_id" {
  description = "ID of the ECS cluster"
  value       = aws_ecs_cluster.main.id
}

output "cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = aws_ecs_cluster.main.arn
}

output "service_id" {
  description = "ID of the ECS service"
  value       = aws_ecs_service.main.id
}

output "service_name" {
  description = "Name of the ECS service"
  value       = aws_ecs_service.main.name
}

output "service_arn" {
  description = "ARN of the ECS service"
  value       = aws_ecs_service.main.id
}

output "task_definition_arn" {
  description = "ARN of the ECS task definition"
  value       = aws_ecs_task_definition.main.arn
}

output "task_definition_family" {
  description = "Family of the ECS task definition"
  value       = aws_ecs_task_definition.main.family
}

output "task_definition_revision" {
  description = "Revision of the ECS task definition"
  value       = aws_ecs_task_definition.main.revision
}

output "log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.ecs_tasks.name
}

output "log_group_arn" {
  description = "ARN of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.ecs_tasks.arn
}

output "cluster_log_group_name" {
  description = "Name of the cluster CloudWatch log group"
  value       = aws_cloudwatch_log_group.ecs_cluster.name
}

output "cluster_log_group_arn" {
  description = "ARN of the cluster CloudWatch log group"
  value       = aws_cloudwatch_log_group.ecs_cluster.arn
}

output "auto_scaling_target_resource_id" {
  description = "Resource ID of the auto scaling target"
  value       = var.enable_auto_scaling ? aws_appautoscaling_target.ecs_target[0].resource_id : null
}

output "service_discovery_namespace_id" {
  description = "ID of the service discovery namespace"
  value       = var.enable_service_discovery ? aws_service_discovery_private_dns_namespace.main[0].id : null
}

output "service_discovery_service_id" {
  description = "ID of the service discovery service"
  value       = var.enable_service_discovery ? aws_service_discovery_service.main[0].id : null
}

output "service_discovery_arn" {
  description = "ARN of the service discovery service"
  value       = var.enable_service_discovery ? aws_service_discovery_service.main[0].arn : null
}

output "kms_key_id" {
  description = "ID of the KMS key for ECS logs"
  value       = aws_kms_key.ecs_logs.id
}

output "kms_key_arn" {
  description = "ARN of the KMS key for ECS logs"
  value       = aws_kms_key.ecs_logs.arn
}