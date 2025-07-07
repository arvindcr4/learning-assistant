# AWS CloudWatch
module "aws_cloudwatch" {
  source = "./aws"
  count  = var.cloud_provider == "aws" ? 1 : 0

  name               = var.name
  log_group_name    = "${var.name}-logs"
  retention_in_days = var.retention_days
  metric_filters     = []
  dashboards        = var.dashboards
  alerts            = var.alert_endpoints
  log_sources       = var.log_sources
  metric_alarms     = var.metric_alarms
  vpc_id           = var.vpc_id
  subnet_ids       = var.subnet_ids
  prometheus_config = var.prometheus_config
  grafana_config   = var.grafana_config
  tags             = var.tags
}

# GCP Stackdriver
module "gcp_stackdriver" {
  source = "./gcp"
  count  = var.cloud_provider == "gcp" ? 1 : 0

  workspace_name     = var.name
  log_sources       = var.log_sources
  metric_alarms     = var.metric_alarms
  retention_days    = var.retention_days
  alert_endpoints   = var.alert_endpoints
  dashboards        = var.dashboards
  enable_log_analytics     = var.enable_log_analytics
  vpc_id           = var.vpc_id
  subnet_ids       = var.subnet_ids
  prometheus_config = var.prometheus_config
  grafana_config   = var.grafana_config
  labels           = var.tags
}

# Azure Monitor
module "azure_monitor" {
  source = "./azure"
  count  = var.cloud_provider == "azure" ? 1 : 0

  workspace_name     = var.name
  log_sources       = var.log_sources
  metric_alarms     = var.metric_alarms
  retention_in_days = var.retention_days
  alert_endpoints   = var.alert_endpoints
  dashboards        = var.dashboards
  enable_log_analytics     = var.enable_log_analytics
  vpc_id           = var.vpc_id
  subnet_ids       = var.subnet_ids
  prometheus_config = var.prometheus_config
  grafana_config   = var.grafana_config
  tags             = var.tags
}

# Prometheus and Grafana
module "prometheus_grafana" {
  source = "./common"
  count  = var.monitoring_type == "prometheus" ? 1 : 0

  prometheus_version = var.prometheus_config.version
  prometheus_instance_type = var.prometheus_config.instance_type
  prometheus_storage_size = var.prometheus_config.storage_size
  grafana_version   = var.grafana_config.version
  grafana_instance_type = var.grafana_config.instance_type
  grafana_admin_password = var.grafana_config.admin_password
  grafana_enable_sso = var.grafana_config.enable_sso
  grafana_data_sources = var.grafana_config.data_sources
}
