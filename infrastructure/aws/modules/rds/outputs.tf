# RDS Module Outputs

output "db_instance_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.main.endpoint
}

output "db_instance_address" {
  description = "RDS instance address"
  value       = aws_db_instance.main.address
}

output "db_instance_port" {
  description = "RDS instance port"
  value       = aws_db_instance.main.port
}

output "db_instance_id" {
  description = "RDS instance ID"
  value       = aws_db_instance.main.id
}

output "db_instance_identifier" {
  description = "RDS instance identifier"
  value       = aws_db_instance.main.identifier
}

output "db_instance_arn" {
  description = "RDS instance ARN"
  value       = aws_db_instance.main.arn
}

output "db_instance_availability_zone" {
  description = "RDS instance availability zone"
  value       = aws_db_instance.main.availability_zone
}

output "db_instance_backup_retention_period" {
  description = "RDS instance backup retention period"
  value       = aws_db_instance.main.backup_retention_period
}

output "db_instance_backup_window" {
  description = "RDS instance backup window"
  value       = aws_db_instance.main.backup_window
}

output "db_instance_maintenance_window" {
  description = "RDS instance maintenance window"
  value       = aws_db_instance.main.maintenance_window
}

output "db_instance_multi_az" {
  description = "RDS instance Multi-AZ"
  value       = aws_db_instance.main.multi_az
}

output "db_instance_storage_encrypted" {
  description = "RDS instance storage encryption"
  value       = aws_db_instance.main.storage_encrypted
}

output "db_instance_engine_version" {
  description = "RDS instance engine version"
  value       = aws_db_instance.main.engine_version
}

output "db_instance_class" {
  description = "RDS instance class"
  value       = aws_db_instance.main.instance_class
}

output "db_instance_allocated_storage" {
  description = "RDS instance allocated storage"
  value       = aws_db_instance.main.allocated_storage
}

output "db_instance_storage_type" {
  description = "RDS instance storage type"
  value       = aws_db_instance.main.storage_type
}

output "db_subnet_group_id" {
  description = "RDS subnet group ID"
  value       = aws_db_subnet_group.main.id
}

output "db_subnet_group_name" {
  description = "RDS subnet group name"
  value       = aws_db_subnet_group.main.name
}

output "db_parameter_group_id" {
  description = "RDS parameter group ID"
  value       = aws_db_parameter_group.main.id
}

output "db_parameter_group_name" {
  description = "RDS parameter group name"
  value       = aws_db_parameter_group.main.name
}

output "db_option_group_id" {
  description = "RDS option group ID"
  value       = aws_db_option_group.main.id
}

output "db_option_group_name" {
  description = "RDS option group name"
  value       = aws_db_option_group.main.name
}

output "db_read_replica_endpoint" {
  description = "RDS read replica endpoint"
  value       = var.create_read_replica ? aws_db_instance.read_replica[0].endpoint : null
}

output "db_read_replica_address" {
  description = "RDS read replica address"
  value       = var.create_read_replica ? aws_db_instance.read_replica[0].address : null
}

output "db_read_replica_port" {
  description = "RDS read replica port"
  value       = var.create_read_replica ? aws_db_instance.read_replica[0].port : null
}

output "db_read_replica_id" {
  description = "RDS read replica ID"
  value       = var.create_read_replica ? aws_db_instance.read_replica[0].id : null
}

output "db_read_replica_identifier" {
  description = "RDS read replica identifier"
  value       = var.create_read_replica ? aws_db_instance.read_replica[0].identifier : null
}

output "db_read_replica_arn" {
  description = "RDS read replica ARN"
  value       = var.create_read_replica ? aws_db_instance.read_replica[0].arn : null
}

output "kms_key_id" {
  description = "KMS key ID for RDS encryption"
  value       = aws_kms_key.rds.id
}

output "kms_key_arn" {
  description = "KMS key ARN for RDS encryption"
  value       = aws_kms_key.rds.arn
}

output "secrets_manager_secret_arn" {
  description = "Secrets Manager secret ARN for database password"
  value       = aws_secretsmanager_secret.db_password.arn
}

output "secrets_manager_secret_name" {
  description = "Secrets Manager secret name for database password"
  value       = aws_secretsmanager_secret.db_password.name
}

output "enhanced_monitoring_iam_role_arn" {
  description = "Enhanced monitoring IAM role ARN"
  value       = var.monitoring_interval > 0 ? aws_iam_role.rds_enhanced_monitoring[0].arn : null
}

output "cloudwatch_cpu_alarm_arn" {
  description = "CloudWatch CPU alarm ARN"
  value       = aws_cloudwatch_metric_alarm.database_cpu.arn
}

output "cloudwatch_connections_alarm_arn" {
  description = "CloudWatch connections alarm ARN"
  value       = aws_cloudwatch_metric_alarm.database_connections.arn
}

output "cloudwatch_memory_alarm_arn" {
  description = "CloudWatch memory alarm ARN"
  value       = aws_cloudwatch_metric_alarm.database_freeable_memory.arn
}

output "cloudwatch_storage_alarm_arn" {
  description = "CloudWatch storage alarm ARN"
  value       = aws_cloudwatch_metric_alarm.database_free_storage_space.arn
}