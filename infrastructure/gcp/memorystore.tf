# Create Redis instance
resource "google_redis_instance" "main" {
  name               = var.redis_instance_name
  tier               = var.redis_tier
  memory_size_gb     = var.redis_memory_size
  region             = var.region
  location_id        = var.zone
  alternative_location_id = var.environment == "prod" ? "${substr(var.region, 0, length(var.region) - 1)}b" : null

  authorized_network = google_compute_network.main.id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"

  redis_version     = var.redis_version
  display_name      = "Learning Assistant Redis Cache"
  reserved_ip_range = "10.3.0.0/28"

  # Authentication
  auth_enabled = true
  auth_string  = random_password.redis_auth_string.result

  # Persistence configuration
  persistence_config {
    persistence_mode    = "RDB"
    rdb_snapshot_period = "TWENTY_FOUR_HOURS"
    rdb_snapshot_start_time = "02:00"
  }

  # Maintenance policy
  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 3
        minutes = 0
        seconds = 0
        nanos   = 0
      }
    }
  }

  # Redis configurations
  redis_configs = {
    maxmemory-policy     = "allkeys-lru"
    notify-keyspace-events = "Ex"
    timeout              = "300"
    tcp-keepalive        = "60"
    maxclients           = "10000"
    
    # Persistence settings
    save                 = "900 1 300 10 60 10000"
    stop-writes-on-bgsave-error = "yes"
    rdbcompression       = "yes"
    rdbchecksum          = "yes"
    
    # Replication settings
    repl-backlog-size    = "1mb"
    repl-backlog-ttl     = "3600"
    
    # Slow log settings
    slowlog-log-slower-than = "10000"
    slowlog-max-len         = "128"
    
    # Security settings
    protected-mode       = "yes"
    
    # Memory optimization
    hash-max-ziplist-entries = "512"
    hash-max-ziplist-value   = "64"
    list-max-ziplist-entries = "512"
    list-max-ziplist-value   = "64"
    set-max-intset-entries   = "512"
    zset-max-ziplist-entries = "128"
    zset-max-ziplist-value   = "64"
  }

  # Labels
  labels = local.common_labels

  depends_on = [
    google_project_service.required_apis,
    google_service_networking_connection.private_vpc_connection,
  ]
}

# Create a failover replica for high availability
resource "google_redis_instance" "replica" {
  count              = var.environment == "prod" ? 1 : 0
  name               = "${var.redis_instance_name}-replica"
  tier               = "STANDARD_HA"
  memory_size_gb     = var.redis_memory_size
  region             = var.region
  location_id        = "${substr(var.region, 0, length(var.region) - 1)}b"
  alternative_location_id = var.zone

  authorized_network = google_compute_network.main.id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"

  redis_version     = var.redis_version
  display_name      = "Learning Assistant Redis Replica"
  reserved_ip_range = "10.3.1.0/28"

  # Authentication
  auth_enabled = true
  auth_string  = random_password.redis_auth_string.result

  # Persistence configuration
  persistence_config {
    persistence_mode    = "RDB"
    rdb_snapshot_period = "TWENTY_FOUR_HOURS"
    rdb_snapshot_start_time = "03:00"
  }

  # Maintenance policy
  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 4
        minutes = 0
        seconds = 0
        nanos   = 0
      }
    }
  }

  # Redis configurations (same as primary)
  redis_configs = {
    maxmemory-policy     = "allkeys-lru"
    notify-keyspace-events = "Ex"
    timeout              = "300"
    tcp-keepalive        = "60"
    maxclients           = "10000"
    save                 = "900 1 300 10 60 10000"
    stop-writes-on-bgsave-error = "yes"
    rdbcompression       = "yes"
    rdbchecksum          = "yes"
    repl-backlog-size    = "1mb"
    repl-backlog-ttl     = "3600"
    slowlog-log-slower-than = "10000"
    slowlog-max-len         = "128"
    protected-mode       = "yes"
    hash-max-ziplist-entries = "512"
    hash-max-ziplist-value   = "64"
    list-max-ziplist-entries = "512"
    list-max-ziplist-value   = "64"
    set-max-intset-entries   = "512"
    zset-max-ziplist-entries = "128"
    zset-max-ziplist-value   = "64"
  }

  # Labels
  labels = merge(
    local.common_labels,
    {
      replica = "true"
    }
  )

  depends_on = [
    google_project_service.required_apis,
    google_service_networking_connection.private_vpc_connection,
  ]
}

# Create Redis connection info secret
resource "google_secret_manager_secret" "redis_connection_string" {
  secret_id = "redis-connection-string"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "redis_connection_string" {
  secret = google_secret_manager_secret.redis_connection_string.id
  secret_data = jsonencode({
    host     = google_redis_instance.main.host
    port     = google_redis_instance.main.port
    auth     = random_password.redis_auth_string.result
    ssl      = true
    replica_host = var.environment == "prod" ? google_redis_instance.replica[0].host : ""
    replica_port = var.environment == "prod" ? google_redis_instance.replica[0].port : ""
  })
}

# Create Redis monitoring alerts
resource "google_monitoring_alert_policy" "redis_cpu_usage" {
  display_name = "Redis CPU Usage"
  combiner     = "OR"

  conditions {
    display_name = "Redis CPU usage is above 80%"

    condition_threshold {
      filter         = "resource.type=\"redis_instance\" AND resource.labels.instance_id=\"${google_redis_instance.main.id}\""
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
    google_redis_instance.main,
    google_monitoring_notification_channel.email,
  ]
}

resource "google_monitoring_alert_policy" "redis_memory_usage" {
  display_name = "Redis Memory Usage"
  combiner     = "OR"

  conditions {
    display_name = "Redis memory usage is above 90%"

    condition_threshold {
      filter         = "resource.type=\"redis_instance\" AND resource.labels.instance_id=\"${google_redis_instance.main.id}\""
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
    google_redis_instance.main,
    google_monitoring_notification_channel.email,
  ]
}

resource "google_monitoring_alert_policy" "redis_connection_count" {
  display_name = "Redis Connection Count"
  combiner     = "OR"

  conditions {
    display_name = "Redis connection count is above 8000"

    condition_threshold {
      filter         = "resource.type=\"redis_instance\" AND resource.labels.instance_id=\"${google_redis_instance.main.id}\""
      duration       = "300s"
      comparison     = "COMPARISON_GT"
      threshold_value = 8000

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
    google_redis_instance.main,
    google_monitoring_notification_channel.email,
  ]
}

# Create Redis performance dashboard
resource "google_monitoring_dashboard" "redis_dashboard" {
  dashboard_json = jsonencode({
    displayName = "Learning Assistant Redis Dashboard"
    mosaicLayout = {
      tiles = [
        {
          width  = 6
          height = 4
          widget = {
            title = "Redis CPU Usage"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"redis_instance\" AND resource.labels.instance_id=\"${google_redis_instance.main.id}\""
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
            title = "Redis Memory Usage"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"redis_instance\" AND resource.labels.instance_id=\"${google_redis_instance.main.id}\""
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
                label = "Memory Usage (Bytes)"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          width  = 6
          height = 4
          widget = {
            title = "Redis Operations/sec"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"redis_instance\" AND resource.labels.instance_id=\"${google_redis_instance.main.id}\""
                      aggregation = {
                        alignmentPeriod  = "300s"
                        perSeriesAligner = "ALIGN_RATE"
                      }
                    }
                  }
                }
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Operations/sec"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          width  = 6
          height = 4
          widget = {
            title = "Redis Connections"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"redis_instance\" AND resource.labels.instance_id=\"${google_redis_instance.main.id}\""
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
            title = "Redis Keyspace"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"redis_instance\" AND resource.labels.instance_id=\"${google_redis_instance.main.id}\""
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
                label = "Key Count"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          width  = 6
          height = 4
          widget = {
            title = "Redis Hit Rate"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"redis_instance\" AND resource.labels.instance_id=\"${google_redis_instance.main.id}\""
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
                label = "Hit Rate %"
                scale = "LINEAR"
              }
            }
          }
        }
      ]
    }
  })

  depends_on = [
    google_redis_instance.main,
  ]
}

# Create Redis backup script using Cloud Functions
resource "google_storage_bucket_object" "redis_backup_script" {
  name   = "redis-backup.py"
  bucket = google_storage_bucket.app_backups.name
  
  content = <<-EOT
import redis
import json
import os
from google.cloud import storage
from datetime import datetime

def backup_redis():
    # Connect to Redis
    redis_client = redis.Redis(
        host='${google_redis_instance.main.host}',
        port=${google_redis_instance.main.port},
        password='${random_password.redis_auth_string.result}',
        ssl=True,
        ssl_cert_reqs=None
    )
    
    # Get all keys
    keys = redis_client.keys('*')
    backup_data = {}
    
    for key in keys:
        key_str = key.decode('utf-8')
        key_type = redis_client.type(key).decode('utf-8')
        
        if key_type == 'string':
            backup_data[key_str] = redis_client.get(key).decode('utf-8')
        elif key_type == 'hash':
            backup_data[key_str] = {k.decode('utf-8'): v.decode('utf-8') for k, v in redis_client.hgetall(key).items()}
        elif key_type == 'list':
            backup_data[key_str] = [item.decode('utf-8') for item in redis_client.lrange(key, 0, -1)]
        elif key_type == 'set':
            backup_data[key_str] = [item.decode('utf-8') for item in redis_client.smembers(key)]
        elif key_type == 'zset':
            backup_data[key_str] = {item[0].decode('utf-8'): item[1] for item in redis_client.zrange(key, 0, -1, withscores=True)}
    
    # Upload to Cloud Storage
    client = storage.Client()
    bucket = client.bucket('${google_storage_bucket.app_backups.name}')
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    blob = bucket.blob(f'redis-backups/redis_backup_{timestamp}.json')
    blob.upload_from_string(json.dumps(backup_data, indent=2))
    
    print(f"Redis backup completed: redis_backup_{timestamp}.json")

if __name__ == "__main__":
    backup_redis()
  EOT
}

# Create Cloud Function for Redis backup
resource "google_cloudfunctions_function" "redis_backup" {
  name        = "redis-backup-function"
  description = "Automated Redis backup function"
  runtime     = "python39"

  available_memory_mb   = 256
  source_archive_bucket = google_storage_bucket.app_backups.name
  source_archive_object = google_storage_bucket_object.redis_backup_script.name
  trigger {
    event_trigger {
      event_type = "google.pubsub.topic.publish"
      resource   = google_pubsub_topic.backup_events.name
    }
  }
  timeout = 540
  entry_point = "backup_redis"

  environment_variables = {
    REDIS_HOST = google_redis_instance.main.host
    REDIS_PORT = google_redis_instance.main.port
    REDIS_AUTH = random_password.redis_auth_string.result
  }

  depends_on = [
    google_project_service.required_apis,
    google_storage_bucket_object.redis_backup_script,
  ]
}