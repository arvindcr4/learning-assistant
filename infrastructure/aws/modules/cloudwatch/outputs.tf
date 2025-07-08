# CloudWatch Module Outputs

output "log_group_name" {
  description = "Name of the application log group"
  value       = aws_cloudwatch_log_group.application.name
}

output "log_group_arn" {
  description = "ARN of the application log group"
  value       = aws_cloudwatch_log_group.application.arn
}

output "system_log_group_name" {
  description = "Name of the system log group"
  value       = aws_cloudwatch_log_group.system.name
}

output "system_log_group_arn" {
  description = "ARN of the system log group"
  value       = aws_cloudwatch_log_group.system.arn
}

output "security_log_group_name" {
  description = "Name of the security log group"
  value       = aws_cloudwatch_log_group.security.name
}

output "security_log_group_arn" {
  description = "ARN of the security log group"
  value       = aws_cloudwatch_log_group.security.arn
}

output "dashboard_url" {
  description = "URL of the CloudWatch dashboard"
  value       = "https://${data.aws_region.current.name}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
}

output "dashboard_name" {
  description = "Name of the CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.main.dashboard_name
}

output "dashboard_arn" {
  description = "ARN of the CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.main.dashboard_arn
}

output "kms_key_id" {
  description = "ID of the KMS key for logs encryption"
  value       = aws_kms_key.logs.id
}

output "kms_key_arn" {
  description = "ARN of the KMS key for logs encryption"
  value       = aws_kms_key.logs.arn
}

output "sns_topic_arn" {
  description = "ARN of the SNS topic for alerts"
  value       = var.create_sns_topic ? aws_sns_topic.alerts[0].arn : null
}

output "sns_topic_name" {
  description = "Name of the SNS topic for alerts"
  value       = var.create_sns_topic ? aws_sns_topic.alerts[0].name : null
}

output "alarms" {
  description = "Map of alarm names and ARNs"
  value = {
    application_error_rate = {
      name = aws_cloudwatch_metric_alarm.application_error_rate.alarm_name
      arn  = aws_cloudwatch_metric_alarm.application_error_rate.arn
    }
    ecs_cpu_high = {
      name = aws_cloudwatch_metric_alarm.ecs_cpu_high.alarm_name
      arn  = aws_cloudwatch_metric_alarm.ecs_cpu_high.arn
    }
    ecs_memory_high = {
      name = aws_cloudwatch_metric_alarm.ecs_memory_high.alarm_name
      arn  = aws_cloudwatch_metric_alarm.ecs_memory_high.arn
    }
    ecs_running_tasks_low = {
      name = aws_cloudwatch_metric_alarm.ecs_service_running_tasks_low.alarm_name
      arn  = aws_cloudwatch_metric_alarm.ecs_service_running_tasks_low.arn
    }
    application_health = {
      name = aws_cloudwatch_composite_alarm.application_health.alarm_name
      arn  = aws_cloudwatch_composite_alarm.application_health.arn
    }
    request_count_anomaly = {
      name = aws_cloudwatch_metric_alarm.request_count_anomaly.alarm_name
      arn  = aws_cloudwatch_metric_alarm.request_count_anomaly.arn
    }
  }
}

output "query_definitions" {
  description = "Map of CloudWatch Insights query definitions"
  value = {
    error_analysis = {
      name = aws_cloudwatch_query_definition.error_analysis.name
    }
    performance_analysis = {
      name = aws_cloudwatch_query_definition.performance_analysis.name
    }
  }
}

output "anomaly_detector_id" {
  description = "ID of the anomaly detector"
  value       = aws_cloudwatch_anomaly_detector.request_count.id
}

output "log_stream_names" {
  description = "List of log stream names"
  value = [
    aws_cloudwatch_log_group.application.name,
    aws_cloudwatch_log_group.system.name,
    aws_cloudwatch_log_group.security.name
  ]
}

output "monitoring_urls" {
  description = "Useful monitoring URLs"
  value = {
    dashboard = "https://${data.aws_region.current.name}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
    alarms    = "https://${data.aws_region.current.name}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#alarmsV2:"
    logs      = "https://${data.aws_region.current.name}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#logsV2:log-groups"
    insights  = "https://${data.aws_region.current.name}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#logsV2:logs-insights"
  }
}