# RDS Database Module
# Enterprise-grade RDS with high availability, backup, monitoring, and security

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for consistent naming and configuration
locals {
  common_tags = merge(
    var.tags,
    {
      Module      = "database/rds"
      Environment = var.environment
      Project     = var.project_name
      ManagedBy   = "terraform"
    }
  )
  
  name_prefix = "${var.project_name}-${var.environment}"
  
  # Final snapshot identifier
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${local.name_prefix}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"
}

# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnet-group"
  subnet_ids = var.subnet_ids
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-db-subnet-group"
  })
}

# DB Parameter Group
resource "aws_db_parameter_group" "main" {
  family = var.parameter_group_family
  name   = "${local.name_prefix}-db-params"
  
  dynamic "parameter" {
    for_each = var.parameters
    content {
      name  = parameter.value.name
      value = parameter.value.value
    }
  }
  
  tags = local.common_tags
  
  lifecycle {
    create_before_destroy = true
  }
}

# DB Option Group
resource "aws_db_option_group" "main" {
  count = var.create_option_group ? 1 : 0
  
  name                     = "${local.name_prefix}-db-options"
  option_group_description = "Option group for ${local.name_prefix}"
  engine_name              = var.engine
  major_engine_version     = var.major_engine_version
  
  dynamic "option" {
    for_each = var.options
    content {
      option_name = option.value.option_name
      
      dynamic "option_settings" {
        for_each = option.value.option_settings
        content {
          name  = option_settings.value.name
          value = option_settings.value.value
        }
      }
    }
  }
  
  tags = local.common_tags
  
  lifecycle {
    create_before_destroy = true
  }
}

# Security Group for RDS
resource "aws_security_group" "rds" {
  name_prefix = "${local.name_prefix}-rds-"
  vpc_id      = var.vpc_id
  description = "Security group for RDS instance"
  
  # Database port access from application security groups
  dynamic "ingress" {
    for_each = var.allowed_security_group_ids
    content {
      from_port       = var.port
      to_port         = var.port
      protocol        = "tcp"
      security_groups = [ingress.value]
      description     = "Database access from application security group ${ingress.value}"
    }
  }
  
  # Database port access from CIDR blocks
  dynamic "ingress" {
    for_each = var.allowed_cidr_blocks
    content {
      from_port   = var.port
      to_port     = var.port
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
      description = "Database access from CIDR ${ingress.value}"
    }
  }
  
  # All outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rds-sg"
  })
  
  lifecycle {
    create_before_destroy = true
  }
}

# KMS Key for RDS encryption
resource "aws_kms_key" "rds" {
  count = var.create_kms_key && var.storage_encrypted ? 1 : 0
  
  description             = "KMS key for RDS encryption - ${local.name_prefix}"
  deletion_window_in_days = var.kms_deletion_window
  
  tags = local.common_tags
}

resource "aws_kms_alias" "rds" {
  count = var.create_kms_key && var.storage_encrypted ? 1 : 0
  
  name          = "alias/${local.name_prefix}-rds"
  target_key_id = aws_kms_key.rds[0].key_id
}

# Random password for RDS master user
resource "random_password" "master" {
  count = var.manage_master_user_password ? 1 : 0
  
  length  = var.master_password_length
  special = true
}

# AWS Secrets Manager secret for master password
resource "aws_secretsmanager_secret" "master_password" {
  count = var.manage_master_user_password ? 1 : 0
  
  name                    = "${local.name_prefix}-rds-master-password"
  description             = "Master password for RDS instance ${local.name_prefix}"
  recovery_window_in_days = var.secret_recovery_window
  
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "master_password" {
  count = var.manage_master_user_password ? 1 : 0
  
  secret_id = aws_secretsmanager_secret.master_password[0].id
  secret_string = jsonencode({
    username = var.username
    password = random_password.master[0].result
  })
}

# RDS Instance
resource "aws_db_instance" "main" {
  identifier = var.identifier != "" ? var.identifier : "${local.name_prefix}-db"
  
  # Engine configuration
  engine         = var.engine
  engine_version = var.engine_version
  instance_class = var.instance_class
  
  # Storage configuration
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = var.storage_type
  storage_encrypted     = var.storage_encrypted
  iops                  = var.iops
  storage_throughput    = var.storage_throughput
  
  kms_key_id = var.storage_encrypted ? (
    var.create_kms_key ? aws_kms_key.rds[0].arn : var.kms_key_id
  ) : null
  
  # Database configuration
  db_name  = var.database_name
  username = var.username
  password = var.manage_master_user_password ? null : var.password
  port     = var.port
  
  # Managed master user password
  manage_master_user_password = var.manage_master_user_password
  master_user_secret_kms_key_id = var.manage_master_user_password && var.storage_encrypted ? (
    var.create_kms_key ? aws_kms_key.rds[0].arn : var.kms_key_id
  ) : null
  
  # Network configuration
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = var.publicly_accessible
  
  # Availability and durability
  availability_zone      = var.multi_az ? null : var.availability_zone
  multi_az              = var.multi_az
  ca_cert_identifier    = var.ca_cert_identifier
  
  # Parameter and option groups
  parameter_group_name = aws_db_parameter_group.main.name
  option_group_name    = var.create_option_group ? aws_db_option_group.main[0].name : var.option_group_name
  
  # Backup configuration
  backup_retention_period   = var.backup_retention_period
  backup_window            = var.backup_window
  copy_tags_to_snapshot    = var.copy_tags_to_snapshot
  delete_automated_backups = var.delete_automated_backups
  
  # Snapshot configuration
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = local.final_snapshot_identifier
  snapshot_identifier       = var.snapshot_identifier
  
  # Maintenance configuration
  maintenance_window         = var.maintenance_window
  auto_minor_version_upgrade = var.auto_minor_version_upgrade
  allow_major_version_upgrade = var.allow_major_version_upgrade
  apply_immediately          = var.apply_immediately
  
  # Monitoring configuration
  monitoring_interval = var.monitoring_interval
  monitoring_role_arn = var.monitoring_interval > 0 ? (
    var.monitoring_role_arn != "" ? var.monitoring_role_arn : aws_iam_role.rds_enhanced_monitoring[0].arn
  ) : null
  
  performance_insights_enabled = var.performance_insights_enabled
  performance_insights_kms_key_id = var.performance_insights_enabled && var.performance_insights_kms_key_id != "" ? (
    var.performance_insights_kms_key_id
  ) : (var.performance_insights_enabled && var.storage_encrypted ? (
    var.create_kms_key ? aws_kms_key.rds[0].arn : var.kms_key_id
  ) : null)
  performance_insights_retention_period = var.performance_insights_retention_period
  
  # Logging configuration
  enabled_cloudwatch_logs_exports = var.enabled_cloudwatch_logs_exports
  
  # Deletion protection
  deletion_protection = var.deletion_protection
  
  # Character set
  character_set_name = var.character_set_name
  
  # Timezone
  timezone = var.timezone
  
  # Network type
  network_type = var.network_type
  
  # Blue/Green deployment
  blue_green_update {
    enabled = var.enable_blue_green_update
  }
  
  tags = local.common_tags
  
  # Lifecycle management
  lifecycle {
    ignore_changes = [
      password, # Ignore password changes if managed by Secrets Manager
    ]
  }
  
  depends_on = [
    aws_cloudwatch_log_group.rds,
  ]
}

# Read Replicas
resource "aws_db_instance" "read_replica" {
  count = var.read_replica_count
  
  identifier = "${var.identifier != "" ? var.identifier : "${local.name_prefix}-db"}-replica-${count.index + 1}"
  
  # Replica configuration
  replicate_source_db = aws_db_instance.main.identifier
  instance_class      = var.read_replica_instance_class != "" ? var.read_replica_instance_class : var.instance_class
  
  # Storage configuration for replica
  storage_encrypted = var.storage_encrypted
  kms_key_id = var.storage_encrypted ? (
    var.create_kms_key ? aws_kms_key.rds[0].arn : var.kms_key_id
  ) : null
  
  # Network configuration
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = var.read_replica_publicly_accessible
  
  # Availability
  availability_zone = var.read_replica_multi_az ? null : (
    length(var.read_replica_availability_zones) > count.index ? 
    var.read_replica_availability_zones[count.index] : null
  )
  multi_az = var.read_replica_multi_az
  
  # Monitoring
  monitoring_interval = var.read_replica_monitoring_interval
  monitoring_role_arn = var.read_replica_monitoring_interval > 0 ? (
    var.monitoring_role_arn != "" ? var.monitoring_role_arn : aws_iam_role.rds_enhanced_monitoring[0].arn
  ) : null
  
  performance_insights_enabled = var.read_replica_performance_insights_enabled
  performance_insights_kms_key_id = var.read_replica_performance_insights_enabled && var.storage_encrypted ? (
    var.create_kms_key ? aws_kms_key.rds[0].arn : var.kms_key_id
  ) : null
  
  # Backup (read replicas don't support backup configuration)
  backup_retention_period = 0
  
  # Maintenance
  maintenance_window         = var.read_replica_maintenance_window
  auto_minor_version_upgrade = var.read_replica_auto_minor_version_upgrade
  
  # Deletion protection
  deletion_protection = var.read_replica_deletion_protection
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-db-replica-${count.index + 1}"
    Type = "ReadReplica"
  })
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "rds" {
  count = length(var.enabled_cloudwatch_logs_exports)
  
  name              = "/aws/rds/instance/${var.identifier != "" ? var.identifier : "${local.name_prefix}-db"}/${var.enabled_cloudwatch_logs_exports[count.index]}"
  retention_in_days = var.cloudwatch_log_retention_days
  
  tags = local.common_tags
}

# Enhanced Monitoring IAM Role
resource "aws_iam_role" "rds_enhanced_monitoring" {
  count = var.monitoring_interval > 0 && var.monitoring_role_arn == "" ? 1 : 0
  
  name = "${local.name_prefix}-rds-enhanced-monitoring"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })
  
  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  count = var.monitoring_interval > 0 && var.monitoring_role_arn == "" ? 1 : 0
  
  role       = aws_iam_role.rds_enhanced_monitoring[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "cpu_utilization" {
  count = var.create_cloudwatch_alarms ? 1 : 0
  
  alarm_name          = "${local.name_prefix}-rds-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = var.cpu_utilization_threshold
  alarm_description   = "This metric monitors RDS CPU utilization"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.ok_actions
  
  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }
  
  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "database_connections" {
  count = var.create_cloudwatch_alarms ? 1 : 0
  
  alarm_name          = "${local.name_prefix}-rds-database-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = var.database_connections_threshold
  alarm_description   = "This metric monitors RDS database connections"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.ok_actions
  
  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }
  
  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "free_storage_space" {
  count = var.create_cloudwatch_alarms ? 1 : 0
  
  alarm_name          = "${local.name_prefix}-rds-free-storage-space"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = var.free_storage_space_threshold
  alarm_description   = "This metric monitors RDS free storage space"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.ok_actions
  
  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }
  
  tags = local.common_tags
}

# DB Event Subscription
resource "aws_db_event_subscription" "main" {
  count = var.create_db_event_subscription ? 1 : 0
  
  name      = "${local.name_prefix}-rds-events"
  sns_topic = var.sns_topic_arn
  
  source_type = "db-instance"
  source_ids  = [aws_db_instance.main.id]
  
  event_categories = var.event_categories
  
  tags = local.common_tags
}

# Automated backups to S3 (if enabled)
resource "aws_db_instance_automated_backups_replication" "main" {
  count = var.enable_backup_replication ? 1 : 0
  
  source_db_instance_arn = aws_db_instance.main.arn
  
  kms_key_id = var.backup_replication_kms_key_id != "" ? var.backup_replication_kms_key_id : (
    var.create_kms_key ? aws_kms_key.rds[0].arn : null
  )
  
  tags = local.common_tags
}