# ==============================================================================
# MAIN TERRAFORM CONFIGURATION FOR LEARNING ASSISTANT
# Google Cloud Platform Infrastructure for Next.js Application
# ==============================================================================

terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.4"
    }
  }
}

# ==============================================================================
# PROVIDER CONFIGURATION
# ==============================================================================

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# ==============================================================================
# RANDOM RESOURCES
# ==============================================================================

resource "random_id" "db_name_suffix" {
  byte_length = 4
}

resource "random_password" "db_password" {
  length  = 32
  special = true
}

# ==============================================================================
# NETWORK INFRASTRUCTURE
# ==============================================================================

# VPC Network
resource "google_compute_network" "vpc" {
  name                    = "${var.project_name}-vpc"
  auto_create_subnetworks = false
  description             = "VPC for Learning Assistant application"
}

# Subnet for Cloud Run and other services
resource "google_compute_subnetwork" "subnet" {
  name          = "${var.project_name}-subnet"
  ip_cidr_range = var.subnet_cidr
  region        = var.region
  network       = google_compute_network.vpc.id
  description   = "Subnet for Learning Assistant services"

  # Enable private Google access for services without external IPs
  private_ip_google_access = true
}

# VPC Access Connector for Cloud Run
resource "google_vpc_access_connector" "connector" {
  name          = "${var.project_name}-connector"
  ip_cidr_range = var.connector_cidr
  network       = google_compute_network.vpc.name
  region        = var.region
  machine_type  = var.connector_machine_type
  min_instances = var.connector_min_instances
  max_instances = var.connector_max_instances
}

# Cloud NAT for outbound internet access
resource "google_compute_router" "router" {
  name    = "${var.project_name}-router"
  region  = var.region
  network = google_compute_network.vpc.id
}

resource "google_compute_router_nat" "nat" {
  name                               = "${var.project_name}-nat"
  router                             = google_compute_router.router.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# ==============================================================================
# FIREWALL RULES
# ==============================================================================

# Allow HTTPS traffic
resource "google_compute_firewall" "allow_https" {
  name    = "${var.project_name}-allow-https"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["https-server"]
  description   = "Allow HTTPS traffic"
}

# Allow HTTP traffic (for load balancer health checks)
resource "google_compute_firewall" "allow_http" {
  name    = "${var.project_name}-allow-http"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["80"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["http-server"]
  description   = "Allow HTTP traffic for load balancer"
}

# Allow internal communication
resource "google_compute_firewall" "allow_internal" {
  name    = "${var.project_name}-allow-internal"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = [var.subnet_cidr]
  description   = "Allow internal communication within VPC"
}

# ==============================================================================
# CLOUD SQL DATABASE
# ==============================================================================

# Cloud SQL PostgreSQL instance
resource "google_sql_database_instance" "main" {
  name             = "${var.project_name}-db-${random_id.db_name_suffix.hex}"
  database_version = var.database_version
  region           = var.region
  deletion_protection = var.enable_deletion_protection

  settings {
    tier                        = var.database_tier
    availability_type           = var.database_availability_type
    disk_type                   = var.database_disk_type
    disk_size                   = var.database_disk_size
    disk_autoresize             = true
    disk_autoresize_limit       = var.database_disk_autoresize_limit
    edition                     = "ENTERPRISE"

    # Backup configuration
    backup_configuration {
      enabled                        = true
      start_time                     = "02:00"
      location                       = var.region
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 30
        retention_unit   = "COUNT"
      }
    }

    # IP configuration
    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = google_compute_network.vpc.id
      enable_private_path_for_google_cloud_services = true
      require_ssl                                   = true
    }

    # Database flags for optimization
    database_flags {
      name  = "shared_preload_libraries"
      value = "pg_stat_statements"
    }

    database_flags {
      name  = "log_statement"
      value = "all"
    }

    database_flags {
      name  = "log_min_duration_statement"
      value = "1000"
    }

    # Maintenance window
    maintenance_window {
      day  = 7
      hour = 3
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

  depends_on = [google_service_networking_connection.private_vpc_connection]
}

# Database
resource "google_sql_database" "database" {
  name     = var.database_name
  instance = google_sql_database_instance.main.name
}

# Database user
resource "google_sql_user" "user" {
  name     = var.database_user
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
}

# Private service connection for Cloud SQL
resource "google_compute_global_address" "private_ip_address" {
  name          = "${var.project_name}-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_address.name]
}

# ==============================================================================
# SECRET MANAGER
# ==============================================================================

# Database connection string secret
resource "google_secret_manager_secret" "db_connection_string" {
  secret_id = "${var.project_name}-db-connection-string"

  labels = {
    environment = var.environment
    service     = "learning-assistant"
  }

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "db_connection_string" {
  secret = google_secret_manager_secret.db_connection_string.id
  secret_data = "postgresql://${google_sql_user.user.name}:${random_password.db_password.result}@${google_sql_database_instance.main.private_ip_address}:5432/${google_sql_database.database.name}?sslmode=require"
}

# JWT secret for authentication
resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "${var.project_name}-jwt-secret"

  labels = {
    environment = var.environment
    service     = "learning-assistant"
  }

  replication {
    auto {}
  }
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}

resource "google_secret_manager_secret_version" "jwt_secret" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = random_password.jwt_secret.result
}

# NextAuth secret
resource "google_secret_manager_secret" "nextauth_secret" {
  secret_id = "${var.project_name}-nextauth-secret"

  labels = {
    environment = var.environment
    service     = "learning-assistant"
  }

  replication {
    auto {}
  }
}

resource "random_password" "nextauth_secret" {
  length  = 64
  special = true
}

resource "google_secret_manager_secret_version" "nextauth_secret" {
  secret      = google_secret_manager_secret.nextauth_secret.id
  secret_data = random_password.nextauth_secret.result
}

# ==============================================================================
# CLOUD STORAGE
# ==============================================================================

# Storage bucket for static assets
resource "google_storage_bucket" "assets" {
  name          = "${var.project_name}-assets-${random_id.db_name_suffix.hex}"
  location      = var.region
  force_destroy = var.environment != "production"
  storage_class = "STANDARD"

  # Enable versioning for production
  versioning {
    enabled = var.environment == "production"
  }

  # Lifecycle management
  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
  }

  # CORS configuration for web access
  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD"]
    response_header = ["*"]
    max_age_seconds = 3600
  }

  # Public access prevention
  public_access_prevention = "enforced"

  # Uniform bucket-level access
  uniform_bucket_level_access = true

  labels = {
    environment = var.environment
    service     = "learning-assistant"
  }
}

# Storage bucket for application backups
resource "google_storage_bucket" "backups" {
  name          = "${var.project_name}-backups-${random_id.db_name_suffix.hex}"
  location      = var.region
  force_destroy = var.environment != "production"
  storage_class = "COLDLINE"

  # Enable versioning
  versioning {
    enabled = true
  }

  # Lifecycle management for backups
  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type          = "SetStorageClass"
      storage_class = "ARCHIVE"
    }
  }

  lifecycle_rule {
    condition {
      age = 2555 # 7 years
    }
    action {
      type = "Delete"
    }
  }

  # Public access prevention
  public_access_prevention = "enforced"

  # Uniform bucket-level access
  uniform_bucket_level_access = true

  labels = {
    environment = var.environment
    service     = "learning-assistant"
    purpose     = "backup"
  }
}

# ==============================================================================
# IAM SERVICE ACCOUNTS
# ==============================================================================

# Service account for Cloud Run
resource "google_service_account" "cloud_run_sa" {
  account_id   = "${var.project_name}-cloud-run-sa"
  display_name = "Learning Assistant Cloud Run Service Account"
  description  = "Service account for Learning Assistant Cloud Run service"
}

# Service account for Cloud SQL Proxy
resource "google_service_account" "cloud_sql_sa" {
  account_id   = "${var.project_name}-cloud-sql-sa"
  display_name = "Learning Assistant Cloud SQL Service Account"
  description  = "Service account for Learning Assistant Cloud SQL access"
}

# ==============================================================================
# IAM ROLES AND PERMISSIONS
# ==============================================================================

# Cloud Run service account permissions
resource "google_project_iam_member" "cloud_run_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

resource "google_project_iam_member" "cloud_run_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

resource "google_project_iam_member" "cloud_run_storage_admin" {
  project = var.project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

resource "google_project_iam_member" "cloud_run_logging_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

resource "google_project_iam_member" "cloud_run_monitoring_writer" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

resource "google_project_iam_member" "cloud_run_trace_agent" {
  project = var.project_id
  role    = "roles/cloudtrace.agent"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# Cloud SQL service account permissions
resource "google_project_iam_member" "cloud_sql_admin" {
  project = var.project_id
  role    = "roles/cloudsql.admin"
  member  = "serviceAccount:${google_service_account.cloud_sql_sa.email}"
}

# ==============================================================================
# CLOUD RUN SERVICE
# ==============================================================================

resource "google_cloud_run_v2_service" "main" {
  name     = "${var.project_name}-service"
  location = var.region

  template {
    # Service account
    service_account = google_service_account.cloud_run_sa.email

    # VPC access
    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "ALL_TRAFFIC"
    }

    # Scaling configuration
    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.cloud_run_max_instances
    }

    # Container configuration
    containers {
      name  = "learning-assistant"
      image = var.container_image

      # Resource limits
      resources {
        limits = {
          cpu    = var.cloud_run_cpu_limit
          memory = var.cloud_run_memory_limit
        }
        cpu_idle = var.cloud_run_cpu_idle
      }

      # Environment variables
      env {
        name  = "NODE_ENV"
        value = var.environment
      }

      env {
        name  = "PORT"
        value = "3000"
      }

      env {
        name  = "NEXT_TELEMETRY_DISABLED"
        value = "1"
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_connection_string.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.jwt_secret.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "NEXTAUTH_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.nextauth_secret.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "NEXTAUTH_URL"
        value = "https://${var.domain_name}"
      }

      env {
        name  = "STORAGE_BUCKET"
        value = google_storage_bucket.assets.name
      }

      env {
        name  = "BACKUP_BUCKET"
        value = google_storage_bucket.backups.name
      }

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }

      env {
        name  = "GCP_REGION"
        value = var.region
      }

      # Health check
      startup_probe {
        initial_delay_seconds = 10
        timeout_seconds       = 5
        period_seconds        = 10
        failure_threshold     = 3
        http_get {
          path = "/api/health"
          port = 3000
        }
      }

      liveness_probe {
        initial_delay_seconds = 30
        timeout_seconds       = 5
        period_seconds        = 30
        failure_threshold     = 3
        http_get {
          path = "/api/health"
          port = 3000
        }
      }

      # Port configuration
      ports {
        name           = "http1"
        container_port = 3000
      }
    }

    # Timeout configuration
    timeout = "3600s"

    # Execution environment
    execution_environment = "EXECUTION_ENVIRONMENT_GEN2"

    # Session affinity
    session_affinity = false
  }

  # Traffic configuration
  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  # Ingress configuration
  ingress = "INGRESS_TRAFFIC_ALL"

  labels = {
    environment = var.environment
    service     = "learning-assistant"
  }

  depends_on = [
    google_sql_database_instance.main,
    google_vpc_access_connector.connector,
    google_secret_manager_secret_version.db_connection_string,
    google_secret_manager_secret_version.jwt_secret,
    google_secret_manager_secret_version.nextauth_secret
  ]
}

# ==============================================================================
# CLOUD RUN IAM
# ==============================================================================

# Allow unauthenticated access to Cloud Run service
resource "google_cloud_run_service_iam_member" "public_access" {
  location = google_cloud_run_v2_service.main.location
  service  = google_cloud_run_v2_service.main.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ==============================================================================
# LOAD BALANCER AND SSL
# ==============================================================================

# Global IP address for load balancer
resource "google_compute_global_address" "lb_ip" {
  name         = "${var.project_name}-lb-ip"
  address_type = "EXTERNAL"
  description  = "Static IP for Learning Assistant load balancer"
}

# SSL certificate
resource "google_compute_managed_ssl_certificate" "ssl_cert" {
  name = "${var.project_name}-ssl-cert"

  managed {
    domains = [var.domain_name]
  }

  description = "SSL certificate for Learning Assistant"
}

# Backend service for Cloud Run
resource "google_compute_backend_service" "backend" {
  name                  = "${var.project_name}-backend"
  protocol              = "HTTP"
  timeout_sec           = 30
  enable_cdn            = var.enable_cdn
  compression_mode      = "AUTOMATIC"
  connection_draining_timeout_sec = 30

  backend {
    group = google_compute_region_network_endpoint_group.neg.id
  }

  # Health check
  health_checks = [google_compute_health_check.health_check.id]

  # CDN configuration
  dynamic "cdn_policy" {
    for_each = var.enable_cdn ? [1] : []
    content {
      cache_mode        = "CACHE_ALL_STATIC"
      default_ttl       = 3600
      max_ttl           = 86400
      client_ttl        = 3600
      negative_caching  = true
      serve_while_stale = 86400

      cache_key_policy {
        include_host         = true
        include_protocol     = true
        include_query_string = false
      }
    }
  }

  log_config {
    enable      = true
    sample_rate = 1.0
  }
}

# Network endpoint group for Cloud Run
resource "google_compute_region_network_endpoint_group" "neg" {
  name                  = "${var.project_name}-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = google_cloud_run_v2_service.main.name
  }
}

# Health check
resource "google_compute_health_check" "health_check" {
  name               = "${var.project_name}-health-check"
  check_interval_sec = 10
  timeout_sec        = 5
  healthy_threshold  = 2
  unhealthy_threshold = 3

  http_health_check {
    request_path = "/api/health"
    port         = 3000
  }
}

# URL map
resource "google_compute_url_map" "url_map" {
  name        = "${var.project_name}-url-map"
  description = "URL map for Learning Assistant"

  default_service = google_compute_backend_service.backend.id

  # Redirect HTTP to HTTPS
  host_rule {
    hosts        = [var.domain_name]
    path_matcher = "allpaths"
  }

  path_matcher {
    name            = "allpaths"
    default_service = google_compute_backend_service.backend.id
  }
}

# HTTPS proxy
resource "google_compute_target_https_proxy" "https_proxy" {
  name             = "${var.project_name}-https-proxy"
  url_map          = google_compute_url_map.url_map.id
  ssl_certificates = [google_compute_managed_ssl_certificate.ssl_cert.id]

  ssl_policy = google_compute_ssl_policy.ssl_policy.id
}

# SSL policy
resource "google_compute_ssl_policy" "ssl_policy" {
  name            = "${var.project_name}-ssl-policy"
  profile         = "MODERN"
  min_tls_version = "TLS_1_2"
}

# HTTP to HTTPS redirect
resource "google_compute_url_map" "http_redirect" {
  name = "${var.project_name}-http-redirect"

  default_url_redirect {
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
    https_redirect         = true
  }
}

resource "google_compute_target_http_proxy" "http_proxy" {
  name    = "${var.project_name}-http-proxy"
  url_map = google_compute_url_map.http_redirect.id
}

# Global forwarding rules
resource "google_compute_global_forwarding_rule" "https_forwarding_rule" {
  name       = "${var.project_name}-https-forwarding-rule"
  target     = google_compute_target_https_proxy.https_proxy.id
  port_range = "443"
  ip_address = google_compute_global_address.lb_ip.address
}

resource "google_compute_global_forwarding_rule" "http_forwarding_rule" {
  name       = "${var.project_name}-http-forwarding-rule"
  target     = google_compute_target_http_proxy.http_proxy.id
  port_range = "80"
  ip_address = google_compute_global_address.lb_ip.address
}

# ==============================================================================
# MONITORING AND LOGGING
# ==============================================================================

# Cloud Monitoring uptime check
resource "google_monitoring_uptime_check_config" "uptime_check" {
  display_name = "${var.project_name}-uptime-check"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path           = "/api/health"
    port           = 443
    use_ssl        = true
    validate_ssl   = true
    request_method = "GET"
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = var.domain_name
    }
  }

  content_matchers {
    content = "healthy"
    matcher = "CONTAINS_STRING"
  }
}

# Cloud Monitoring alert policy
resource "google_monitoring_alert_policy" "app_down_alert" {
  display_name = "${var.project_name}-app-down-alert"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "Application is down"

    condition_threshold {
      filter          = "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND resource.type=\"uptime_url\""
      duration        = "300s"
      comparison      = "COMPARISON_LESS_THAN"
      threshold_value = 1

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_FRACTION_TRUE"
      }
    }
  }

  # Notification channels would be added here
  documentation {
    content = "The Learning Assistant application is down. Please check the Cloud Run service and database connectivity."
  }
}

# Log-based metrics
resource "google_logging_metric" "error_rate" {
  name   = "${var.project_name}-error-rate"
  filter = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${google_cloud_run_v2_service.main.name}\" AND severity>=ERROR"

  metric_descriptor {
    metric_kind = "GAUGE"
    value_type  = "DOUBLE"
    unit        = "1"
    display_name = "Error Rate"
  }

  value_extractor = "EXTRACT(jsonPayload.error_count)"
}

# ==============================================================================
# ENABLE REQUIRED APIS
# ==============================================================================

resource "google_project_service" "required_apis" {
  for_each = toset([
    "cloudresourcemanager.googleapis.com",
    "compute.googleapis.com",
    "servicenetworking.googleapis.com",
    "vpcaccess.googleapis.com",
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "secretmanager.googleapis.com",
    "storage.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "cloudtrace.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com"
  ])

  service = each.value
  project = var.project_id

  disable_on_destroy = false
}