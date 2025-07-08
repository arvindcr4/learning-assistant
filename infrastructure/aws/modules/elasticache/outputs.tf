# ElastiCache Module Outputs

output "cluster_id" {
  description = "ID of the ElastiCache cluster"
  value       = aws_elasticache_replication_group.main.id
}

output "replication_group_id" {
  description = "ID of the replication group"
  value       = aws_elasticache_replication_group.main.replication_group_id
}

output "primary_endpoint_address" {
  description = "Address of the endpoint for the primary node"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "reader_endpoint_address" {
  description = "Address of the endpoint for the reader node"
  value       = aws_elasticache_replication_group.main.reader_endpoint_address
}

output "configuration_endpoint_address" {
  description = "Address of the replication group configuration endpoint"
  value       = aws_elasticache_replication_group.main.configuration_endpoint_address
}

output "port" {
  description = "Port number"
  value       = aws_elasticache_replication_group.main.port
}

output "member_clusters" {
  description = "Identifiers of all the nodes that are part of this replication group"
  value       = aws_elasticache_replication_group.main.member_clusters
}

output "arn" {
  description = "ARN of the created ElastiCache Replication Group"
  value       = aws_elasticache_replication_group.main.arn
}

output "engine_version_actual" {
  description = "Running version of the cache engine"
  value       = aws_elasticache_replication_group.main.engine_version_actual
}

output "cluster_enabled" {
  description = "Indicates if cluster mode is enabled"
  value       = aws_elasticache_replication_group.main.cluster_enabled
}

output "multi_az_enabled" {
  description = "Indicates if Multi-AZ is enabled"
  value       = aws_elasticache_replication_group.main.multi_az_enabled
}

output "subnet_group_name" {
  description = "Name of the cache subnet group"
  value       = aws_elasticache_subnet_group.main.name
}

output "parameter_group_name" {
  description = "Name of the parameter group"
  value       = aws_elasticache_parameter_group.main.name
}

output "kms_key_id" {
  description = "KMS key ID for encryption"
  value       = aws_kms_key.elasticache.id
}

output "kms_key_arn" {
  description = "KMS key ARN for encryption"
  value       = aws_kms_key.elasticache.arn
}

output "auth_token_secret_arn" {
  description = "ARN of the auth token secret in Secrets Manager"
  value       = var.auth_token_enabled ? aws_secretsmanager_secret.auth_token[0].arn : null
}

output "auth_token_secret_name" {
  description = "Name of the auth token secret in Secrets Manager"
  value       = var.auth_token_enabled ? aws_secretsmanager_secret.auth_token[0].name : null
}

output "log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.redis_slow_log.name
}

output "log_group_arn" {
  description = "ARN of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.redis_slow_log.arn
}

output "global_replication_group_id" {
  description = "ID of the global replication group"
  value       = var.enable_global_replication ? aws_elasticache_global_replication_group.main[0].global_replication_group_id : null
}

output "user_id" {
  description = "ID of the Redis user"
  value       = var.create_user && var.auth_token_enabled ? aws_elasticache_user.main[0].user_id : null
}

output "user_group_id" {
  description = "ID of the Redis user group"
  value       = var.create_user && var.auth_token_enabled ? aws_elasticache_user_group.main[0].user_group_id : null
}

output "cloudwatch_cpu_alarm_arn" {
  description = "ARN of the CPU utilization alarm"
  value       = aws_cloudwatch_metric_alarm.cache_cpu.arn
}

output "cloudwatch_memory_alarm_arn" {
  description = "ARN of the memory utilization alarm"
  value       = aws_cloudwatch_metric_alarm.cache_memory.arn
}

output "cloudwatch_connections_alarm_arn" {
  description = "ARN of the connections alarm"
  value       = aws_cloudwatch_metric_alarm.cache_connections.arn
}

output "cloudwatch_evictions_alarm_arn" {
  description = "ARN of the evictions alarm"
  value       = aws_cloudwatch_metric_alarm.cache_evictions.arn
}

output "cloudwatch_replication_lag_alarm_arn" {
  description = "ARN of the replication lag alarm"
  value       = var.num_cache_nodes > 1 ? aws_cloudwatch_metric_alarm.cache_replication_lag[0].arn : null
}