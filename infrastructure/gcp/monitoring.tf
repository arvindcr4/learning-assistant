# Create notification channel for email alerts
resource "google_monitoring_notification_channel" "email" {
  display_name = "Email Notification Channel"
  type         = "email"
  labels = {
    email_address = var.notification_email
  }

  user_labels = local.common_labels

  depends_on = [google_project_service.required_apis]
}

# Create notification channel for Slack (optional)
resource "google_monitoring_notification_channel" "slack" {
  count        = var.environment == "prod" ? 1 : 0
  display_name = "Slack Notification Channel"
  type         = "slack"
  labels = {
    channel_name = "#alerts"
    webhook_url  = "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
  }

  user_labels = local.common_labels

  depends_on = [google_project_service.required_apis]
}

# Create notification channel for PagerDuty (optional)
resource "google_monitoring_notification_channel" "pagerduty" {
  count        = var.environment == "prod" ? 1 : 0
  display_name = "PagerDuty Notification Channel"
  type         = "pagerduty"
  labels = {
    service_key = "YOUR_PAGERDUTY_SERVICE_KEY"
  }

  user_labels = local.common_labels

  depends_on = [google_project_service.required_apis]
}

# Create uptime check for application
resource "google_monitoring_uptime_check_config" "app_uptime" {
  display_name = "Learning Assistant Uptime Check"
  timeout      = "10s"
  period       = "300s"

  http_check {
    path         = "/health"
    port         = 443
    use_ssl      = true
    validate_ssl = true
    mask_headers = false
    
    accepted_response_status_codes {
      status_class = "STATUS_CLASS_2XX"
    }
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = "${var.subdomain}.${var.domain_name}"
    }
  }

  content_matchers {
    content = "OK"
    matcher = "CONTAINS_STRING"
  }

  # Monitor from multiple regions
  selected_regions = ["USA", "EUROPE", "ASIA_PACIFIC"]

  depends_on = [
    google_dns_record_set.subdomain,
  ]
}

# Create uptime check for API
resource "google_monitoring_uptime_check_config" "api_uptime" {
  display_name = "Learning Assistant API Uptime Check"
  timeout      = "10s"
  period       = "300s"

  http_check {
    path         = "/api/health"
    port         = 443
    use_ssl      = true
    validate_ssl = true
    mask_headers = false
    
    accepted_response_status_codes {
      status_class = "STATUS_CLASS_2XX"
    }
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = "api.${var.domain_name}"
    }
  }

  content_matchers {
    content = "healthy"
    matcher = "CONTAINS_STRING"
  }

  selected_regions = ["USA", "EUROPE", "ASIA_PACIFIC"]

  depends_on = [
    google_dns_record_set.api,
  ]
}

# Create alert policy for application downtime
resource "google_monitoring_alert_policy" "app_downtime" {
  display_name = "Application Downtime"
  combiner     = "OR"

  conditions {
    display_name = "Application is down"

    condition_threshold {
      filter         = "resource.type=\"uptime_url\" AND resource.labels.host=\"${var.subdomain}.${var.domain_name}\""
      duration       = "300s"
      comparison     = "COMPARISON_GT"
      threshold_value = 1

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_FRACTION_TRUE"
        cross_series_reducer = "REDUCE_MEAN"
      }
    }
  }

  notification_channels = concat(
    [google_monitoring_notification_channel.email.name],
    var.environment == "prod" ? [google_monitoring_notification_channel.slack[0].name] : []
  )

  alert_strategy {
    auto_close = "1800s"
  }

  documentation {
    content = "The Learning Assistant application is experiencing downtime. Please check the application status and investigate immediately."
  }

  depends_on = [
    google_monitoring_uptime_check_config.app_uptime,
    google_monitoring_notification_channel.email,
  ]
}

# Create alert policy for high error rate
resource "google_monitoring_alert_policy" "high_error_rate" {
  display_name = "High Error Rate"
  combiner     = "OR"

  conditions {
    display_name = "Error rate is above 5%"

    condition_threshold {
      filter         = "resource.type=\"k8s_container\" AND resource.labels.cluster_name=\"${var.gke_cluster_name}\""
      duration       = "300s"
      comparison     = "COMPARISON_GT"
      threshold_value = 0.05

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_MEAN"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }

  documentation {
    content = "The application is experiencing a high error rate. Please investigate the logs and check for any issues."
  }

  depends_on = [
    google_container_cluster.primary,
    google_monitoring_notification_channel.email,
  ]
}

# Create alert policy for high CPU usage
resource "google_monitoring_alert_policy" "high_cpu_usage" {
  display_name = "High CPU Usage"
  combiner     = "OR"

  conditions {
    display_name = "CPU usage is above 80%"

    condition_threshold {
      filter         = "resource.type=\"k8s_node\" AND resource.labels.cluster_name=\"${var.gke_cluster_name}\""
      duration       = "300s"
      comparison     = "COMPARISON_GT"
      threshold_value = 0.8

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_MEAN"
        cross_series_reducer = "REDUCE_MEAN"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }

  documentation {
    content = "GKE nodes are experiencing high CPU usage. Consider scaling up the cluster or optimizing the application."
  }

  depends_on = [
    google_container_cluster.primary,
    google_monitoring_notification_channel.email,
  ]
}

# Create alert policy for high memory usage
resource "google_monitoring_alert_policy" "high_memory_usage" {
  display_name = "High Memory Usage"
  combiner     = "OR"

  conditions {
    display_name = "Memory usage is above 90%"

    condition_threshold {
      filter         = "resource.type=\"k8s_node\" AND resource.labels.cluster_name=\"${var.gke_cluster_name}\""
      duration       = "300s"
      comparison     = "COMPARISON_GT"
      threshold_value = 0.9

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_MEAN"
        cross_series_reducer = "REDUCE_MEAN"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }

  documentation {
    content = "GKE nodes are experiencing high memory usage. Consider scaling up the cluster or optimizing memory usage."
  }

  depends_on = [
    google_container_cluster.primary,
    google_monitoring_notification_channel.email,
  ]
}

# Create alert policy for pod restart frequency
resource "google_monitoring_alert_policy" "pod_restart_frequency" {
  display_name = "Pod Restart Frequency"
  combiner     = "OR"

  conditions {
    display_name = "Pod restart rate is above 5 per minute"

    condition_threshold {
      filter         = "resource.type=\"k8s_pod\" AND resource.labels.cluster_name=\"${var.gke_cluster_name}\""
      duration       = "300s"
      comparison     = "COMPARISON_GT"
      threshold_value = 5

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }

  documentation {
    content = "Pods are restarting frequently. This may indicate application issues or resource constraints."
  }

  depends_on = [
    google_container_cluster.primary,
    google_monitoring_notification_channel.email,
  ]
}

# Create alert policy for disk usage
resource "google_monitoring_alert_policy" "disk_usage" {
  display_name = "Disk Usage"
  combiner     = "OR"

  conditions {
    display_name = "Disk usage is above 85%"

    condition_threshold {
      filter         = "resource.type=\"k8s_node\" AND resource.labels.cluster_name=\"${var.gke_cluster_name}\""
      duration       = "300s"
      comparison     = "COMPARISON_GT"
      threshold_value = 0.85

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_MEAN"
        cross_series_reducer = "REDUCE_MEAN"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }

  documentation {
    content = "GKE nodes are experiencing high disk usage. Consider cleaning up or expanding disk capacity."
  }

  depends_on = [
    google_container_cluster.primary,
    google_monitoring_notification_channel.email,
  ]
}

# Create comprehensive monitoring dashboard
resource "google_monitoring_dashboard" "main" {
  dashboard_json = jsonencode({
    displayName = "Learning Assistant Monitoring Dashboard"
    mosaicLayout = {
      tiles = [
        {
          width  = 6
          height = 4
          widget = {
            title = "Application Uptime"
            scorecard = {
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "resource.type=\"uptime_url\" AND resource.labels.host=\"${var.subdomain}.${var.domain_name}\""
                  aggregation = {
                    alignmentPeriod     = "300s"
                    perSeriesAligner    = "ALIGN_FRACTION_TRUE"
                    crossSeriesReducer  = "REDUCE_MEAN"
                  }
                }
              }
              gaugeView = {
                lowerBound = 0.0
                upperBound = 1.0
              }
            }
          }
        },
        {
          width  = 6
          height = 4
          widget = {
            title = "Request Rate"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"https_lb_rule\" AND resource.labels.url_map_name=\"${google_compute_url_map.main.name}\""
                      aggregation = {
                        alignmentPeriod     = "300s"
                        perSeriesAligner    = "ALIGN_RATE"
                        crossSeriesReducer  = "REDUCE_SUM"
                      }
                    }
                  }
                }
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Requests/sec"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          width  = 6
          height = 4
          widget = {
            title = "Response Latency"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"https_lb_rule\" AND resource.labels.url_map_name=\"${google_compute_url_map.main.name}\""
                      aggregation = {
                        alignmentPeriod     = "300s"
                        perSeriesAligner    = "ALIGN_MEAN"
                        crossSeriesReducer  = "REDUCE_MEAN"
                      }
                    }
                  }
                }
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Latency (ms)"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          width  = 6
          height = 4
          widget = {
            title = "Error Rate"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"https_lb_rule\" AND resource.labels.url_map_name=\"${google_compute_url_map.main.name}\""
                      aggregation = {
                        alignmentPeriod     = "300s"
                        perSeriesAligner    = "ALIGN_RATE"
                        crossSeriesReducer  = "REDUCE_MEAN"
                      }
                    }
                  }
                }
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Error Rate"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          width  = 6
          height = 4
          widget = {
            title = "GKE CPU Usage"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"k8s_node\" AND resource.labels.cluster_name=\"${var.gke_cluster_name}\""
                      aggregation = {
                        alignmentPeriod     = "300s"
                        perSeriesAligner    = "ALIGN_MEAN"
                        crossSeriesReducer  = "REDUCE_MEAN"
                      }
                    }
                  }
                }
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "CPU Usage %"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          width  = 6
          height = 4
          widget = {
            title = "GKE Memory Usage"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"k8s_node\" AND resource.labels.cluster_name=\"${var.gke_cluster_name}\""
                      aggregation = {
                        alignmentPeriod     = "300s"
                        perSeriesAligner    = "ALIGN_MEAN"
                        crossSeriesReducer  = "REDUCE_MEAN"
                      }
                    }
                  }
                }
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Memory Usage %"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          width  = 6
          height = 4
          widget = {
            title = "Pod Count"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"k8s_pod\" AND resource.labels.cluster_name=\"${var.gke_cluster_name}\""
                      aggregation = {
                        alignmentPeriod     = "300s"
                        perSeriesAligner    = "ALIGN_MEAN"
                        crossSeriesReducer  = "REDUCE_COUNT"
                      }
                    }
                  }
                }
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Pod Count"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          width  = 6
          height = 4
          widget = {
            title = "Network Traffic"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"gce_instance\" AND resource.labels.zone=\"${var.zone}\""
                      aggregation = {
                        alignmentPeriod     = "300s"
                        perSeriesAligner    = "ALIGN_RATE"
                        crossSeriesReducer  = "REDUCE_SUM"
                      }
                    }
                  }
                }
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Bytes/sec"
                scale = "LINEAR"
              }
            }
          }
        }
      ]
    }
  })

  depends_on = [
    google_compute_url_map.main,
    google_container_cluster.primary,
  ]
}

# Create SLI/SLO configuration
resource "google_monitoring_slo" "availability_slo" {
  service      = google_monitoring_service.app_service.service_id
  slo_id       = "availability-slo"
  display_name = "Application Availability SLO"

  goal                = 0.995  # 99.5% availability
  calendar_period     = "MONTH"
  rolling_period_days = 30

  request_based_sli {
    good_total_ratio {
      total_service_filter = "resource.type=\"k8s_service\" AND resource.labels.cluster_name=\"${var.gke_cluster_name}\""
      good_service_filter  = "resource.type=\"k8s_service\" AND resource.labels.cluster_name=\"${var.gke_cluster_name}\" AND metric.labels.response_code_class=\"2xx\""
    }
  }

  depends_on = [
    google_monitoring_service.app_service,
    google_container_cluster.primary,
  ]
}

resource "google_monitoring_slo" "latency_slo" {
  service      = google_monitoring_service.app_service.service_id
  slo_id       = "latency-slo"
  display_name = "Application Latency SLO"

  goal                = 0.95   # 95% of requests under 500ms
  calendar_period     = "MONTH"
  rolling_period_days = 30

  request_based_sli {
    distribution_cut {
      distribution_filter = "resource.type=\"k8s_service\" AND resource.labels.cluster_name=\"${var.gke_cluster_name}\""
      range {
        max = 500  # 500ms
      }
    }
  }

  depends_on = [
    google_monitoring_service.app_service,
    google_container_cluster.primary,
  ]
}

# Create monitoring service
resource "google_monitoring_service" "app_service" {
  service_id   = "learning-assistant-service"
  display_name = "Learning Assistant Service"

  basic_service {
    service_type = "APP_ENGINE"
    service_labels = {
      module_id = "default"
    }
  }

  depends_on = [
    google_project_service.required_apis,
  ]
}

# Create log-based metrics
resource "google_logging_metric" "error_rate_metric" {
  name   = "learning_assistant_error_rate"
  filter = "resource.type=\"k8s_container\" AND resource.labels.cluster_name=\"${var.gke_cluster_name}\" AND severity=\"ERROR\""

  metric_descriptor {
    metric_kind = "GAUGE"
    value_type  = "DOUBLE"
    unit        = "1"
    display_name = "Learning Assistant Error Rate"
  }

  value_extractor = "EXTRACT(jsonPayload.error_count)"

  depends_on = [
    google_container_cluster.primary,
  ]
}

resource "google_logging_metric" "slow_query_metric" {
  name   = "learning_assistant_slow_queries"
  filter = "resource.type=\"cloudsql_database\" AND resource.labels.database_id=\"${var.project_id}:${google_sql_database_instance.main.name}\" AND jsonPayload.duration_ms > 1000"

  metric_descriptor {
    metric_kind = "COUNTER"
    value_type  = "INT64"
    unit        = "1"
    display_name = "Learning Assistant Slow Queries"
  }

  depends_on = [
    google_sql_database_instance.main,
  ]
}

# Create log export to BigQuery for analytics
resource "google_bigquery_dataset" "logs_dataset" {
  dataset_id  = "learning_assistant_logs"
  description = "Dataset for Learning Assistant logs"
  location    = var.region

  labels = local.common_labels

  depends_on = [
    google_project_service.required_apis,
  ]
}

resource "google_logging_project_sink" "bigquery_sink" {
  name        = "learning-assistant-bigquery-sink"
  destination = "bigquery.googleapis.com/projects/${var.project_id}/datasets/${google_bigquery_dataset.logs_dataset.dataset_id}"

  filter = "resource.type=\"k8s_container\" AND resource.labels.cluster_name=\"${var.gke_cluster_name}\""

  unique_writer_identity = true

  depends_on = [
    google_bigquery_dataset.logs_dataset,
    google_container_cluster.primary,
  ]
}

# Grant BigQuery Data Editor role to the sink's writer identity
resource "google_project_iam_member" "bigquery_sink_writer" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = google_logging_project_sink.bigquery_sink.writer_identity

  depends_on = [
    google_logging_project_sink.bigquery_sink,
  ]
}

# Create custom metrics for application-specific monitoring
resource "google_monitoring_metric_descriptor" "business_metric" {
  type        = "custom.googleapis.com/learning_assistant/active_users"
  metric_kind = "GAUGE"
  value_type  = "INT64"
  unit        = "1"
  description = "Number of active users in the learning assistant"
  display_name = "Active Users"

  labels {
    key         = "region"
    value_type  = "STRING"
    description = "The region of the users"
  }

  depends_on = [
    google_project_service.required_apis,
  ]
}

# Create monitoring group for organizing resources
resource "google_monitoring_group" "app_group" {
  display_name = "Learning Assistant Resources"
  filter       = "resource.type=\"k8s_container\" AND resource.labels.cluster_name=\"${var.gke_cluster_name}\""

  depends_on = [
    google_container_cluster.primary,
  ]
}