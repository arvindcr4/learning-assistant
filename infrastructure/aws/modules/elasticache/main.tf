# ElastiCache Module for Learning Assistant Application
# Provides Redis cluster for caching and session management

# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.name_prefix}-cache-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = var.tags
}

# ElastiCache Parameter Group
resource "aws_elasticache_parameter_group" "main" {
  family = "redis6.x"
  name   = "${var.name_prefix}-cache-parameter-group"

  # Performance and memory optimization parameters
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  parameter {
    name  = "maxmemory-samples"
    value = "3"
  }

  # Security parameters
  parameter {
    name  = "rename-commands"
    value = "FLUSHDB='' FLUSHALL='' KEYS='' PEXPIRE='' DEL='' CONFIG='' SHUTDOWN='' DEBUG=''"
  }

  tags = var.tags
}

# KMS Key for ElastiCache Encryption
resource "aws_kms_key" "elasticache" {
  description             = "KMS key for ElastiCache encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = var.tags
}

resource "aws_kms_alias" "elasticache" {
  name          = "alias/${var.name_prefix}-elasticache"
  target_key_id = aws_kms_key.elasticache.key_id
}

# Generate random auth token
resource "random_password" "auth_token" {
  count = var.auth_token_enabled ? 1 : 0

  length  = 32
  special = false
}

# Store auth token in AWS Secrets Manager
resource "aws_secretsmanager_secret" "auth_token" {
  count = var.auth_token_enabled ? 1 : 0

  name                    = "${var.name_prefix}-redis-auth-token"
  description             = "Redis auth token for ${var.name_prefix}"
  recovery_window_in_days = 7
  kms_key_id              = aws_kms_key.elasticache.arn

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "auth_token" {
  count = var.auth_token_enabled ? 1 : 0

  secret_id     = aws_secretsmanager_secret.auth_token[0].id
  secret_string = random_password.auth_token[0].result
}

# ElastiCache Replication Group
resource "aws_elasticache_replication_group" "main" {
  replication_group_id       = var.replication_group_id
  description                = var.description
  port                       = var.port
  parameter_group_name       = aws_elasticache_parameter_group.main.name
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = var.security_group_ids

  # Node configuration
  node_type               = var.node_type
  num_cache_clusters      = var.num_cache_nodes
  engine_version          = var.engine_version
  
  # Multi-AZ configuration
  multi_az_enabled        = var.multi_az_enabled
  automatic_failover_enabled = var.automatic_failover_enabled

  # Backup configuration
  snapshot_retention_limit = var.snapshot_retention_limit
  snapshot_window         = var.snapshot_window
  
  # Maintenance configuration
  maintenance_window = var.maintenance_window
  auto_minor_version_upgrade = true

  # Security and encryption
  at_rest_encryption_enabled = var.at_rest_encryption_enabled
  transit_encryption_enabled = var.transit_encryption_enabled
  kms_key_id                = var.at_rest_encryption_enabled ? aws_kms_key.elasticache.arn : null
  auth_token                = var.auth_token_enabled ? random_password.auth_token[0].result : null

  # Logging
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow_log.name
    destination_type = "cloudwatch-logs"
    log_format       = "text"
    log_type         = "slow-log"
  }

  tags = var.tags

  depends_on = [
    aws_elasticache_subnet_group.main,
    aws_elasticache_parameter_group.main
  ]
}

# CloudWatch Log Group for Redis Slow Log
resource "aws_cloudwatch_log_group" "redis_slow_log" {
  name              = "/aws/elasticache/redis/${var.replication_group_id}/slow-log"
  retention_in_days = 7
  kms_key_id        = aws_kms_key.elasticache.arn

  tags = var.tags
}

# CloudWatch Alarms for ElastiCache
resource "aws_cloudwatch_metric_alarm" "cache_cpu" {
  alarm_name          = "${var.name_prefix}-cache-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "75"
  alarm_description   = "This metric monitors ElastiCache CPU utilization"
  alarm_actions       = var.alarm_actions

  dimensions = {
    CacheClusterId = aws_elasticache_replication_group.main.id
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "cache_memory" {
  alarm_name          = "${var.name_prefix}-cache-memory-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ElastiCache memory utilization"
  alarm_actions       = var.alarm_actions

  dimensions = {
    CacheClusterId = aws_elasticache_replication_group.main.id
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "cache_connections" {
  alarm_name          = "${var.name_prefix}-cache-connection-count"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CurrConnections"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "100"
  alarm_description   = "This metric monitors ElastiCache connection count"
  alarm_actions       = var.alarm_actions

  dimensions = {
    CacheClusterId = aws_elasticache_replication_group.main.id
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "cache_evictions" {
  alarm_name          = "${var.name_prefix}-cache-evictions"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Evictions"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors ElastiCache evictions"
  alarm_actions       = var.alarm_actions

  dimensions = {
    CacheClusterId = aws_elasticache_replication_group.main.id
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "cache_replication_lag" {
  count = var.num_cache_nodes > 1 ? 1 : 0

  alarm_name          = "${var.name_prefix}-cache-replication-lag"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ReplicationLag"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "30"
  alarm_description   = "This metric monitors ElastiCache replication lag"
  alarm_actions       = var.alarm_actions

  dimensions = {
    CacheClusterId = aws_elasticache_replication_group.main.id
  }

  tags = var.tags
}

# ElastiCache Global Replication Group (for multi-region)
resource "aws_elasticache_global_replication_group" "main" {
  count = var.enable_global_replication ? 1 : 0

  global_replication_group_id_suffix = var.global_replication_group_suffix
  primary_replication_group_id       = aws_elasticache_replication_group.main.id
  
  global_replication_group_description = "Global replication group for ${var.name_prefix}"

  tags = var.tags
}

# User for Redis AUTH (if using Redis 6.0+)
resource "aws_elasticache_user" "main" {
  count = var.create_user && var.auth_token_enabled ? 1 : 0

  user_id       = "${var.name_prefix}-redis-user"
  user_name     = "default"
  access_string = "on ~* &* +@all"
  engine        = "REDIS"
  passwords     = [random_password.auth_token[0].result]

  tags = var.tags
}

# User Group for Redis AUTH
resource "aws_elasticache_user_group" "main" {
  count = var.create_user && var.auth_token_enabled ? 1 : 0

  engine          = "REDIS"
  user_group_id   = "${var.name_prefix}-redis-user-group"
  user_ids        = [aws_elasticache_user.main[0].user_id]

  tags = var.tags
}