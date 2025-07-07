output "log_group_name" {
  description = "Log group/workspace name"
  value = coalesce(
    try(module.aws_cloudwatch[0].log_group_name, ""),
    try(module.gcp_stackdriver[0].log_sink_name, ""),
    try(module.azure_monitor[0].log_workspace_name, ""),
    try(module.do_monitoring[0].log_endpoint, "")
  )
}

output "log_group_arn" {
  description = "Log group ARN/ID"
  value = coalesce(
    try(module.aws_cloudwatch[0].log_group_arn, ""),
    try(module.gcp_stackdriver[0].log_sink_id, ""),
    try(module.azure_monitor[0].log_workspace_id, ""),
    ""
  )
}

output "metrics_namespace" {
  description = "Metrics namespace"
  value = coalesce(
    try(module.aws_cloudwatch[0].metrics_namespace, ""),
    try(module.gcp_stackdriver[0].metrics_scope, ""),
    try(module.azure_monitor[0].metrics_namespace, ""),
    ""
  )
}

output "dashboard_urls" {
  description = "Dashboard URLs"
  value = concat(
    try(module.aws_cloudwatch[0].dashboard_urls, []),
    try(module.gcp_stackdriver[0].dashboard_urls, []),
    try(module.azure_monitor[0].dashboard_urls, []),
    try(module.prometheus_grafana[0].grafana_url, [])
  )
}

output "prometheus_endpoint" {
  description = "Prometheus endpoint"
  value = try(module.prometheus_grafana[0].prometheus_endpoint, "")
}

output "grafana_endpoint" {
  description = "Grafana endpoint"
  value = try(module.prometheus_grafana[0].grafana_endpoint, "")
}

output "alert_topic_arn" {
  description = "Alert topic ARN/ID"
  value = coalesce(
    try(module.aws_cloudwatch[0].sns_topic_arn, ""),
    try(module.gcp_stackdriver[0].notification_channel_id, ""),
    try(module.azure_monitor[0].action_group_id, ""),
    ""
  )
}

output "log_analytics_workspace_id" {
  description = "Log analytics workspace ID"
  value = coalesce(
    try(module.aws_cloudwatch[0].insights_query_id, ""),
    try(module.azure_monitor[0].log_analytics_workspace_id, ""),
    ""
  )
}

output "monitoring_service_principal" {
  description = "Service principal/role for monitoring access"
  value = coalesce(
    try(module.aws_cloudwatch[0].monitoring_role_arn, ""),
    try(module.gcp_stackdriver[0].service_account_email, ""),
    try(module.azure_monitor[0].managed_identity_id, ""),
    ""
  )
}
