variable "cloud_provider" {
  description = "Cloud provider (aws, gcp, azure, digitalocean)"
  type        = string
  validation {
    condition     = contains(["aws", "gcp", "azure", "digitalocean"], var.cloud_provider)
    error_message = "Cloud provider must be one of: aws, gcp, azure, digitalocean"
  }
}

variable "name" {
  description = "Name for monitoring resources"
  type        = string
}

variable "monitoring_type" {
  description = "Type of monitoring setup (prometheus, cloud-native, hybrid)"
  type        = string
  default     = "cloud-native"
  validation {
    condition     = contains(["prometheus", "cloud-native", "hybrid"], var.monitoring_type)
    error_message = "Monitoring type must be prometheus, cloud-native, or hybrid"
  }
}

variable "retention_days" {
  description = "Log retention period in days"
  type        = number
  default     = 30
}

variable "metrics_retention_days" {
  description = "Metrics retention period in days"
  type        = number
  default     = 15
}

variable "enable_alerting" {
  description = "Enable alerting"
  type        = bool
  default     = true
}

variable "alert_endpoints" {
  description = "Alert notification endpoints"
  type = list(object({
    type     = string  # email, sms, webhook, slack
    endpoint = string
  }))
  default = []
}

variable "log_sources" {
  description = "Log sources to monitor"
  type = list(object({
    name         = string
    source_type  = string  # container, vm, application, database
    resource_id  = string
    log_group    = string
  }))
  default = []
}

variable "metric_alarms" {
  description = "Metric-based alarms"
  type = list(object({
    name                = string
    metric_name        = string
    namespace          = string
    statistic          = string
    period             = number
    evaluation_periods = number
    threshold          = number
    comparison_operator = string
    treat_missing_data = string
  }))
  default = []
}

variable "dashboards" {
  description = "Dashboard configurations"
  type = list(object({
    name    = string
    widgets = list(object({
      type        = string  # metric, log, text
      title       = string
      metric_name = string
      namespace   = string
      dimensions  = map(string)
    }))
  }))
  default = []
}

variable "enable_log_analytics" {
  description = "Enable log analytics/insights"
  type        = bool
  default     = true
}

variable "enable_apm" {
  description = "Enable Application Performance Monitoring"
  type        = bool
  default     = false
}

variable "enable_synthetic_monitoring" {
  description = "Enable synthetic monitoring"
  type        = bool
  default     = false
}

variable "vpc_id" {
  description = "VPC ID for private monitoring endpoints"
  type        = string
  default     = ""
}

variable "subnet_ids" {
  description = "Subnet IDs for monitoring resources"
  type        = list(string)
  default     = []
}

variable "prometheus_config" {
  description = "Prometheus configuration"
  type = object({
    version        = string
    instance_type  = string
    storage_size   = number
    scrape_interval = string
    remote_write_endpoints = list(object({
      url = string
      auth_token = string
    }))
  })
  default = null
}

variable "grafana_config" {
  description = "Grafana configuration"
  type = object({
    version       = string
    instance_type = string
    admin_password = string
    enable_sso    = bool
    data_sources  = list(string)
  })
  default = null
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
