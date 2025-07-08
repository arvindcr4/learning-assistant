# Create Cloud SQL PostgreSQL instance
resource "google_sql_database_instance" "main" {
  name             = var.db_instance_name
  database_version = var.db_version
  region           = var.region
  deletion_protection = var.environment == "prod" ? true : false

  settings {
    tier              = var.db_tier
    disk_size         = var.db_disk_size
    disk_type         = var.db_disk_type
    disk_autoresize   = true
    disk_autoresize_limit = var.db_disk_size * 2
    availability_type = var.environment == "prod" ? "REGIONAL" : "ZONAL"
    edition           = "ENTERPRISE"

    # Backup configuration
    backup_configuration {
      enabled                        = var.db_backup_enabled
      start_time                     = var.db_backup_start_time
      backup_retention_settings {
        retained_backups = var.db_backup_retention_days
        retention_unit   = "COUNT"
      }
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
      location                       = var.region
    }

    # IP configuration
    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = google_compute_network.main.id
      enable_private_path_for_google_cloud_services = true
      require_ssl                                   = true

      authorized_networks {
        name  = "gke-nodes"
        value = var.private_subnet_cidr
      }
    }

    # Database flags for performance and security
    database_flags {
      name  = "log_checkpoints"
      value = "on"
    }

    database_flags {
      name  = "log_connections"
      value = "on"
    }

    database_flags {
      name  = "log_disconnections"
      value = "on"
    }

    database_flags {
      name  = "log_lock_waits"
      value = "on"
    }

    database_flags {
      name  = "log_temp_files"
      value = "0"
    }

    database_flags {
      name  = "log_min_duration_statement"
      value = "1000"
    }

    database_flags {
      name  = "shared_preload_libraries"
      value = "pg_stat_statements"
    }

    database_flags {
      name  = "max_connections"
      value = "200"
    }

    database_flags {
      name  = "work_mem"
      value = "4096"
    }

    database_flags {
      name  = "maintenance_work_mem"
      value = "2097152"
    }

    database_flags {
      name  = "effective_cache_size"
      value = "4194304"
    }

    database_flags {
      name  = "random_page_cost"
      value = "1.1"
    }

    database_flags {
      name  = "checkpoint_completion_target"
      value = "0.9"
    }

    database_flags {
      name  = "wal_buffers"
      value = "16384"
    }

    database_flags {
      name  = "default_statistics_target"
      value = "100"
    }

    # Maintenance window
    maintenance_window {
      day          = 7
      hour         = 3
      update_track = "stable"
    }

    # Insights configuration
    insights_config {
      query_insights_enabled  = true
      query_plans_per_minute  = 5
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }

    # Password validation
    password_validation_policy {
      enable_password_policy = true
      min_length             = 12
      complexity             = "COMPLEXITY_DEFAULT"
    }

    # SQL Server Agent (if using SQL Server)
    sql_server_audit_config {
      bucket                = google_storage_bucket.app_backups.name
      retention_interval    = "1209600s" # 14 days
      upload_interval       = "1800s"    # 30 minutes
    }

    # User labels
    user_labels = local.common_labels

    # Advanced threat protection
    advanced_machine_features {
      threads_per_core = 2
    }

    # Connector enforcement
    connector_enforcement = "REQUIRED"

    # Data cache
    data_cache_config {
      data_cache_enabled = true
    }

    # Collation
    collation = "en_US.UTF8"

    # Time zone
    time_zone = "UTC"

    # Deletion protection
    deletion_protection_enabled = var.environment == "prod" ? true : false

    # Active directory configuration (if needed)
    active_directory_config {
      domain = var.domain_name
    }

    # Deny maintenance period
    deny_maintenance_period {
      end_date   = "2024-12-31"
      start_date = "2024-12-25"
      time       = "00:00:00"
    }
  }

  # Encryption at rest
  encryption_key_name = google_kms_crypto_key.learning_assistant.id

  depends_on = [
    google_project_service.required_apis,
    google_service_networking_connection.private_vpc_connection,
  ]
}

# Create read replica for performance
resource "google_sql_database_instance" "read_replica" {
  count            = var.environment == "prod" ? 1 : 0
  name             = "${var.db_instance_name}-read-replica"
  database_version = var.db_version
  region           = var.region
  master_instance_name = google_sql_database_instance.main.name
  deletion_protection = true

  replica_configuration {
    failover_target = false
  }

  settings {
    tier              = var.db_tier
    disk_size         = var.db_disk_size
    disk_type         = var.db_disk_type
    disk_autoresize   = true
    availability_type = "ZONAL"

    # IP configuration
    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = google_compute_network.main.id
      enable_private_path_for_google_cloud_services = true
      require_ssl                                   = true

      authorized_networks {
        name  = "gke-nodes"
        value = var.private_subnet_cidr
      }
    }

    # Database flags (subset for read replica)
    database_flags {
      name  = "log_connections"
      value = "on"
    }

    database_flags {
      name  = "log_disconnections"
      value = "on"
    }

    database_flags {
      name  = "max_connections"
      value = "200"
    }

    # User labels
    user_labels = merge(
      local.common_labels,
      {
        replica = "true"
      }
    )

    # Data cache
    data_cache_config {
      data_cache_enabled = true
    }

    # Insights configuration
    insights_config {
      query_insights_enabled  = true
      query_plans_per_minute  = 5
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }
  }

  depends_on = [
    google_sql_database_instance.main,
  ]
}

# Create database
resource "google_sql_database" "learning_assistant" {
  name     = "learning_assistant"
  instance = google_sql_database_instance.main.name
  charset  = "UTF8"
  collation = "en_US.UTF8"

  depends_on = [
    google_sql_database_instance.main,
  ]
}

# Create database user
resource "google_sql_user" "app_user" {
  name     = "app_user"
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
  type     = "BUILT_IN"

  depends_on = [
    google_sql_database_instance.main,
  ]
}

# Create SSL certificate for database connection
resource "google_sql_ssl_cert" "client_cert" {
  common_name = "learning-assistant-client-cert"
  instance    = google_sql_database_instance.main.name

  depends_on = [
    google_sql_database_instance.main,
  ]
}

# Create database backup schedule
resource "google_sql_backup_run" "backup" {
  count    = var.environment == "prod" ? 1 : 0
  instance = google_sql_database_instance.main.name
  type     = "ON_DEMAND"

  depends_on = [
    google_sql_database_instance.main,
  ]
}

# Create Cloud SQL Proxy service account
resource "google_service_account" "cloudsql_proxy" {
  account_id   = "cloudsql-proxy-sa"
  display_name = "Cloud SQL Proxy Service Account"
  description  = "Service account for Cloud SQL Proxy"
}

resource "google_project_iam_member" "cloudsql_proxy_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloudsql_proxy.email}"
}

# Create database connection info secret
resource "google_secret_manager_secret" "db_connection_string" {
  secret_id = "db-connection-string"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "db_connection_string" {
  secret = google_secret_manager_secret.db_connection_string.id
  secret_data = jsonencode({
    host     = google_sql_database_instance.main.private_ip_address
    port     = 5432
    database = google_sql_database.learning_assistant.name
    username = google_sql_user.app_user.name
    password = random_password.db_password.result
    ssl_mode = "require"
  })
}

# Create database monitoring alerts
resource "google_monitoring_alert_policy" "db_cpu_usage" {
  display_name = "Database CPU Usage"
  combiner     = "OR"

  conditions {
    display_name = "Database CPU usage is above 80%"

    condition_threshold {
      filter         = "resource.type=\"cloudsql_database\" AND resource.labels.database_id=\"${var.project_id}:${google_sql_database_instance.main.name}\""
      duration       = "300s"
      comparison     = "COMPARISON_GT"
      threshold_value = 0.8

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }

  depends_on = [
    google_sql_database_instance.main,
    google_monitoring_notification_channel.email,
  ]
}

resource "google_monitoring_alert_policy" "db_memory_usage" {
  display_name = "Database Memory Usage"
  combiner     = "OR"

  conditions {
    display_name = "Database memory usage is above 90%"

    condition_threshold {
      filter         = "resource.type=\"cloudsql_database\" AND resource.labels.database_id=\"${var.project_id}:${google_sql_database_instance.main.name}\""
      duration       = "300s"
      comparison     = "COMPARISON_GT"
      threshold_value = 0.9

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }

  depends_on = [
    google_sql_database_instance.main,
    google_monitoring_notification_channel.email,
  ]
}

resource "google_monitoring_alert_policy" "db_connection_count" {
  display_name = "Database Connection Count"
  combiner     = "OR"

  conditions {
    display_name = "Database connection count is above 150"

    condition_threshold {
      filter         = "resource.type=\"cloudsql_database\" AND resource.labels.database_id=\"${var.project_id}:${google_sql_database_instance.main.name}\""
      duration       = "300s"
      comparison     = "COMPARISON_GT"
      threshold_value = 150

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }

  depends_on = [
    google_sql_database_instance.main,
    google_monitoring_notification_channel.email,
  ]
}

# Create database performance insights dashboard
resource "google_monitoring_dashboard" "database_dashboard" {
  dashboard_json = jsonencode({
    displayName = "Learning Assistant Database Dashboard"
    mosaicLayout = {
      tiles = [
        {
          width  = 6
          height = 4
          widget = {
            title = "Database CPU Usage"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"cloudsql_database\" AND resource.labels.database_id=\"${var.project_id}:${google_sql_database_instance.main.name}\""
                      aggregation = {
                        alignmentPeriod  = "300s"
                        perSeriesAligner = "ALIGN_MEAN"
                      }
                    }
                  }
                }
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "CPU Utilization"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          width  = 6
          height = 4
          widget = {
            title = "Database Memory Usage"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"cloudsql_database\" AND resource.labels.database_id=\"${var.project_id}:${google_sql_database_instance.main.name}\""
                      aggregation = {
                        alignmentPeriod  = "300s"
                        perSeriesAligner = "ALIGN_MEAN"
                      }
                    }
                  }
                }
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Memory Utilization"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          width  = 6
          height = 4
          widget = {
            title = "Database Connections"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"cloudsql_database\" AND resource.labels.database_id=\"${var.project_id}:${google_sql_database_instance.main.name}\""
                      aggregation = {
                        alignmentPeriod  = "300s"
                        perSeriesAligner = "ALIGN_MEAN"
                      }
                    }
                  }
                }
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Active Connections"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          width  = 6
          height = 4
          widget = {
            title = "Database Disk Usage"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"cloudsql_database\" AND resource.labels.database_id=\"${var.project_id}:${google_sql_database_instance.main.name}\""
                      aggregation = {
                        alignmentPeriod  = "300s"
                        perSeriesAligner = "ALIGN_MEAN"
                      }
                    }
                  }
                }
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Disk Usage (Bytes)"
                scale = "LINEAR"
              }
            }
          }
        }
      ]
    }
  })

  depends_on = [
    google_sql_database_instance.main,
  ]
}