# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "compute.googleapis.com",
    "container.googleapis.com",
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "dns.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "secretmanager.googleapis.com",
    "certificatemanager.googleapis.com",
    "networkmanagement.googleapis.com",
    "servicenetworking.googleapis.com",
    "cloudkms.googleapis.com",
    "cloudbuild.googleapis.com",
    "storage.googleapis.com",
    "cloudscheduler.googleapis.com",
    "pubsub.googleapis.com"
  ])

  project = var.project_id
  service = each.value

  disable_dependent_services = true
  disable_on_destroy         = false
}

# Random password generation
resource "random_password" "db_password" {
  length  = 32
  special = true
}

resource "random_password" "redis_auth_string" {
  length  = 32
  special = false
}

# Create a custom KMS key for encryption
resource "google_kms_key_ring" "learning_assistant" {
  name     = "learning-assistant-keyring"
  location = var.region

  depends_on = [google_project_service.required_apis]
}

resource "google_kms_crypto_key" "learning_assistant" {
  name     = "learning-assistant-key"
  key_ring = google_kms_key_ring.learning_assistant.id

  rotation_period = "7776000s" # 90 days

  lifecycle {
    prevent_destroy = true
  }
}

# Store secrets in Secret Manager
resource "google_secret_manager_secret" "db_password" {
  secret_id = "db-password"
  
  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}

resource "google_secret_manager_secret" "redis_auth_string" {
  secret_id = "redis-auth-string"
  
  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "redis_auth_string" {
  secret      = google_secret_manager_secret.redis_auth_string.id
  secret_data = random_password.redis_auth_string.result
}

# Create a GCS bucket for Terraform state (if not exists)
resource "google_storage_bucket" "terraform_state" {
  name                        = "${var.project_id}-terraform-state"
  location                    = var.region
  force_destroy               = false
  public_access_prevention    = "enforced"
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }

  encryption {
    default_kms_key_name = google_kms_crypto_key.learning_assistant.id
  }

  depends_on = [google_project_service.required_apis]
}

# Create a GCS bucket for application backups
resource "google_storage_bucket" "app_backups" {
  name                        = "${var.project_id}-app-backups"
  location                    = var.region
  force_destroy               = false
  public_access_prevention    = "enforced"
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = var.backup_retention_days
    }
    action {
      type = "Delete"
    }
  }

  encryption {
    default_kms_key_name = google_kms_crypto_key.learning_assistant.id
  }

  depends_on = [google_project_service.required_apis]
}

# Create a GCS bucket for static assets
resource "google_storage_bucket" "static_assets" {
  name                        = "${var.project_id}-static-assets"
  location                    = var.region
  force_destroy               = false
  public_access_prevention    = "enforced"
  uniform_bucket_level_access = true

  website {
    main_page_suffix = "index.html"
    not_found_page   = "404.html"
  }

  cors {
    origin          = ["https://${var.subdomain}.${var.domain_name}"]
    method          = ["GET", "HEAD"]
    response_header = ["*"]
    max_age_seconds = 3600
  }

  depends_on = [google_project_service.required_apis]
}

# Cloud Build triggers for CI/CD
resource "google_cloudbuild_trigger" "app_build" {
  name        = "learning-assistant-build"
  description = "Build and deploy learning assistant application"

  github {
    owner = "your-github-username"
    name  = "learning-assistant"
    push {
      branch = "^main$"
    }
  }

  build {
    step {
      name = "gcr.io/cloud-builders/docker"
      args = [
        "build",
        "-t",
        "gcr.io/${var.project_id}/learning-assistant:$COMMIT_SHA",
        "-t",
        "gcr.io/${var.project_id}/learning-assistant:latest",
        "."
      ]
    }

    step {
      name = "gcr.io/cloud-builders/docker"
      args = [
        "push",
        "gcr.io/${var.project_id}/learning-assistant:$COMMIT_SHA"
      ]
    }

    step {
      name = "gcr.io/cloud-builders/docker"
      args = [
        "push",
        "gcr.io/${var.project_id}/learning-assistant:latest"
      ]
    }

    step {
      name = "gcr.io/cloud-builders/gke-deploy"
      args = [
        "run",
        "--filename=k8s/",
        "--image=gcr.io/${var.project_id}/learning-assistant:$COMMIT_SHA",
        "--cluster=${google_container_cluster.primary.name}",
        "--location=${var.region}"
      ]
    }

    options {
      logging = "CLOUD_LOGGING_ONLY"
    }
  }

  depends_on = [google_project_service.required_apis]
}

# Cloud Scheduler for automated backups
resource "google_cloud_scheduler_job" "backup_job" {
  name             = "learning-assistant-backup"
  description      = "Automated backup job for learning assistant"
  schedule         = var.backup_schedule
  time_zone        = "UTC"
  attempt_deadline = "300s"

  http_target {
    http_method = "POST"
    uri         = "https://cloudbuild.googleapis.com/v1/projects/${var.project_id}/triggers/backup-trigger:run"
    
    oauth_token {
      service_account_email = google_service_account.backup_service_account.email
    }
  }

  depends_on = [google_project_service.required_apis]
}

# Pub/Sub topics for event-driven architecture
resource "google_pubsub_topic" "learning_events" {
  name = "learning-events"

  message_retention_duration = "604800s" # 7 days

  depends_on = [google_project_service.required_apis]
}

resource "google_pubsub_topic" "backup_events" {
  name = "backup-events"

  message_retention_duration = "86400s" # 1 day

  depends_on = [google_project_service.required_apis]
}

# Add resource labels to all resources
locals {
  common_labels = merge(
    var.labels,
    {
      environment = var.environment
      terraform   = "true"
    }
  )
}