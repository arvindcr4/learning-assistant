# CloudWatch Module for Learning Assistant Application
# Provides comprehensive monitoring, logging, and alerting

# CloudWatch Log Group for Application Logs
resource "aws_cloudwatch_log_group" "application" {
  name              = "/aws/ecs/${var.service_name}"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.logs.arn

  tags = var.tags
}

# CloudWatch Log Group for System Logs
resource "aws_cloudwatch_log_group" "system" {
  name              = "/aws/system/${var.name_prefix}"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.logs.arn

  tags = var.tags
}

# CloudWatch Log Group for Security Logs
resource "aws_cloudwatch_log_group" "security" {
  name              = "/aws/security/${var.name_prefix}"
  retention_in_days = var.security_log_retention_days
  kms_key_id        = aws_kms_key.logs.arn

  tags = var.tags
}

# KMS Key for CloudWatch Logs Encryption
resource "aws_kms_key" "logs" {
  description             = "KMS key for CloudWatch logs encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Effect = "Allow"
        Principal = {
          Service = "logs.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
        Condition = {
          ArnEquals = {
            "kms:EncryptionContext:aws:logs:arn" = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"
          }
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_kms_alias" "logs" {
  name          = "alias/${var.name_prefix}-logs"
  target_key_id = aws_kms_key.logs.key_id
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.name_prefix}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ServiceName", var.service_name, "ClusterName", var.cluster_name],
            [".", "MemoryUtilization", ".", ".", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "ECS Service Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", var.load_balancer_arn_suffix],
            [".", "RequestCount", ".", "."],
            [".", "HTTPCode_Target_2XX_Count", ".", "."],
            [".", "HTTPCode_Target_4XX_Count", ".", "."],
            [".", "HTTPCode_Target_5XX_Count", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Load Balancer Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", var.db_instance_identifier],
            [".", "DatabaseConnections", ".", "."],
            [".", "FreeableMemory", ".", "."],
            [".", "FreeStorageSpace", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "RDS Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 18
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ElastiCache", "CPUUtilization", "CacheClusterId", var.cache_cluster_id],
            [".", "DatabaseMemoryUsagePercentage", ".", "."],
            [".", "CurrConnections", ".", "."],
            [".", "Evictions", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "ElastiCache Metrics"
          period  = 300
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 24
        width  = 24
        height = 6

        properties = {
          query   = "SOURCE '${aws_cloudwatch_log_group.application.name}' | fields @timestamp, @message | sort @timestamp desc | limit 100"
          region  = data.aws_region.current.name
          title   = "Recent Application Logs"
          view    = "table"
        }
      }
    ]
  })

  tags = var.tags
}

# Custom Metrics
resource "aws_cloudwatch_metric_alarm" "application_error_rate" {
  alarm_name          = "${var.name_prefix}-application-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  threshold           = "5"
  alarm_description   = "Application error rate is too high"
  alarm_actions       = var.alarm_actions

  metric_query {
    id = "e1"
    expression = "m2/m1*100"
    label      = "Error Rate"
    return_data = true
  }

  metric_query {
    id = "m1"
    metric {
      metric_name = "RequestCount"
      namespace   = "AWS/ApplicationELB"
      period      = 300
      stat        = "Sum"

      dimensions = {
        LoadBalancer = var.load_balancer_arn_suffix
      }
    }
  }

  metric_query {
    id = "m2"
    metric {
      metric_name = "HTTPCode_Target_5XX_Count"
      namespace   = "AWS/ApplicationELB"
      period      = 300
      stat        = "Sum"

      dimensions = {
        LoadBalancer = var.load_balancer_arn_suffix
      }
    }
  }

  tags = var.tags
}

# ECS Service Alarms
resource "aws_cloudwatch_metric_alarm" "ecs_cpu_high" {
  alarm_name          = "${var.name_prefix}-ecs-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = var.cpu_threshold_high
  alarm_description   = "ECS CPU utilization is too high"
  alarm_actions       = var.alarm_actions

  dimensions = {
    ServiceName = var.service_name
    ClusterName = var.cluster_name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "ecs_memory_high" {
  alarm_name          = "${var.name_prefix}-ecs-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = var.memory_threshold_high
  alarm_description   = "ECS memory utilization is too high"
  alarm_actions       = var.alarm_actions

  dimensions = {
    ServiceName = var.service_name
    ClusterName = var.cluster_name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "ecs_service_running_tasks_low" {
  alarm_name          = "${var.name_prefix}-ecs-running-tasks-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "RunningTaskCount"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "1"
  alarm_description   = "ECS running task count is too low"
  alarm_actions       = var.alarm_actions

  dimensions = {
    ServiceName = var.service_name
    ClusterName = var.cluster_name
  }

  tags = var.tags
}

# SNS Topic for Alerts
resource "aws_sns_topic" "alerts" {
  count = var.create_sns_topic ? 1 : 0

  name = "${var.name_prefix}-alerts"

  tags = var.tags
}

resource "aws_sns_topic_subscription" "email" {
  count = var.create_sns_topic && var.alert_email != "" ? 1 : 0

  topic_arn = aws_sns_topic.alerts[0].arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# CloudWatch Insights Queries
resource "aws_cloudwatch_query_definition" "error_analysis" {
  name = "${var.name_prefix}/error-analysis"

  log_group_names = [
    aws_cloudwatch_log_group.application.name
  ]

  query_string = <<EOF
fields @timestamp, @message
| filter @message like /ERROR/
| stats count() by bin(5m)
| sort @timestamp desc
EOF

  tags = var.tags
}

resource "aws_cloudwatch_query_definition" "performance_analysis" {
  name = "${var.name_prefix}/performance-analysis"

  log_group_names = [
    aws_cloudwatch_log_group.application.name
  ]

  query_string = <<EOF
fields @timestamp, @message
| filter @message like /duration/
| parse @message "duration=*ms" as duration
| stats avg(duration), max(duration), min(duration) by bin(5m)
| sort @timestamp desc
EOF

  tags = var.tags
}

# CloudWatch Composite Alarms
resource "aws_cloudwatch_composite_alarm" "application_health" {
  alarm_name        = "${var.name_prefix}-application-health"
  alarm_description = "Overall application health status"
  alarm_actions     = var.alarm_actions

  alarm_rule = join(" OR ", [
    "ALARM(${aws_cloudwatch_metric_alarm.ecs_cpu_high.alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.ecs_memory_high.alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.ecs_service_running_tasks_low.alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.application_error_rate.alarm_name})"
  ])

  tags = var.tags
}

# CloudWatch Anomaly Detector
resource "aws_cloudwatch_anomaly_detector" "request_count" {
  metric_math_anomaly_detector {
    metric_data_queries {
      id = "m1"
      return_data = true
      metric_stat {
        metric {
          metric_name = "RequestCount"
          namespace   = "AWS/ApplicationELB"
          dimensions = {
            LoadBalancer = var.load_balancer_arn_suffix
          }
        }
        period = 300
        stat   = "Average"
      }
    }
  }

  tags = var.tags
}

# CloudWatch Anomaly Alarm
resource "aws_cloudwatch_metric_alarm" "request_count_anomaly" {
  alarm_name          = "${var.name_prefix}-request-count-anomaly"
  comparison_operator = "LessThanLowerOrGreaterThanUpperThreshold"
  evaluation_periods  = "2"
  threshold_metric_id = "ad1"
  alarm_description   = "Request count anomaly detected"
  alarm_actions       = var.alarm_actions

  metric_query {
    id = "ad1"
    anomaly_detector {
      metric_math_anomaly_detector {
        metric_data_queries {
          id = "m1"
          return_data = true
          metric_stat {
            metric {
              metric_name = "RequestCount"
              namespace   = "AWS/ApplicationELB"
              dimensions = {
                LoadBalancer = var.load_balancer_arn_suffix
              }
            }
            period = 300
            stat   = "Average"
          }
        }
      }
    }
  }

  tags = var.tags
}

# Data sources
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}