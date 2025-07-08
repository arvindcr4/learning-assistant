# Security Groups Module Outputs

output "alb_security_group_id" {
  description = "ID of the ALB security group"
  value       = aws_security_group.alb.id
}

output "ecs_security_group_id" {
  description = "ID of the ECS security group"
  value       = aws_security_group.ecs.id
}

output "rds_security_group_id" {
  description = "ID of the RDS security group"
  value       = aws_security_group.rds.id
}

output "redis_security_group_id" {
  description = "ID of the Redis security group"
  value       = aws_security_group.redis.id
}

output "bastion_security_group_id" {
  description = "ID of the bastion security group"
  value       = var.create_bastion_sg ? aws_security_group.bastion[0].id : null
}

output "efs_security_group_id" {
  description = "ID of the EFS security group"
  value       = var.create_efs_sg ? aws_security_group.efs[0].id : null
}

output "lambda_security_group_id" {
  description = "ID of the Lambda security group"
  value       = var.create_lambda_sg ? aws_security_group.lambda[0].id : null
}

output "security_group_ids" {
  description = "Map of all security group IDs"
  value = {
    alb     = aws_security_group.alb.id
    ecs     = aws_security_group.ecs.id
    rds     = aws_security_group.rds.id
    redis   = aws_security_group.redis.id
    bastion = var.create_bastion_sg ? aws_security_group.bastion[0].id : null
    efs     = var.create_efs_sg ? aws_security_group.efs[0].id : null
    lambda  = var.create_lambda_sg ? aws_security_group.lambda[0].id : null
  }
}