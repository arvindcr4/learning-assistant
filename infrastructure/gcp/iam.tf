# Create service account for GKE nodes
resource "google_service_account" "gke_nodes" {
  account_id   = "gke-nodes-sa"
  display_name = "GKE Nodes Service Account"
  description  = "Service account for GKE node pools with minimal required permissions"
}

# Grant necessary IAM roles to GKE nodes service account
resource "google_project_iam_member" "gke_nodes_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.gke_nodes.email}"
}

resource "google_project_iam_member" "gke_nodes_monitoring" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.gke_nodes.email}"
}

resource "google_project_iam_member" "gke_nodes_monitoring_viewer" {
  project = var.project_id
  role    = "roles/monitoring.viewer"
  member  = "serviceAccount:${google_service_account.gke_nodes.email}"
}

resource "google_project_iam_member" "gke_nodes_storage" {
  project = var.project_id
  role    = "roles/storage.objectViewer"
  member  = "serviceAccount:${google_service_account.gke_nodes.email}"
}

# Create service account for the application
resource "google_service_account" "app_service_account" {
  account_id   = "learning-assistant-app-sa"
  display_name = "Learning Assistant Application Service Account"
  description  = "Service account for the learning assistant application"
}

# Grant application service account access to Cloud SQL
resource "google_project_iam_member" "app_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.app_service_account.email}"
}

# Grant application service account access to Secret Manager
resource "google_project_iam_member" "app_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.app_service_account.email}"
}

# Grant application service account access to Cloud Storage
resource "google_project_iam_member" "app_storage_object_user" {
  project = var.project_id
  role    = "roles/storage.objectUser"
  member  = "serviceAccount:${google_service_account.app_service_account.email}"
}

# Grant application service account access to Pub/Sub
resource "google_project_iam_member" "app_pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.app_service_account.email}"
}

resource "google_project_iam_member" "app_pubsub_subscriber" {
  project = var.project_id
  role    = "roles/pubsub.subscriber"
  member  = "serviceAccount:${google_service_account.app_service_account.email}"
}

# Grant application service account access to monitoring
resource "google_project_iam_member" "app_monitoring_writer" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.app_service_account.email}"
}

# Grant application service account access to logging
resource "google_project_iam_member" "app_logging_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.app_service_account.email}"
}

# Create service account for backup operations
resource "google_service_account" "backup_service_account" {
  account_id   = "backup-operations-sa"
  display_name = "Backup Operations Service Account"
  description  = "Service account for automated backup operations"
}

# Grant backup service account necessary permissions
resource "google_project_iam_member" "backup_storage_admin" {
  project = var.project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.backup_service_account.email}"
}

resource "google_project_iam_member" "backup_cloudsql_admin" {
  project = var.project_id
  role    = "roles/cloudsql.admin"
  member  = "serviceAccount:${google_service_account.backup_service_account.email}"
}

resource "google_project_iam_member" "backup_cloudbuild_editor" {
  project = var.project_id
  role    = "roles/cloudbuild.builds.editor"
  member  = "serviceAccount:${google_service_account.backup_service_account.email}"
}

# Create service account for monitoring and alerting
resource "google_service_account" "monitoring_service_account" {
  account_id   = "monitoring-alerting-sa"
  display_name = "Monitoring and Alerting Service Account"
  description  = "Service account for monitoring and alerting operations"
}

# Grant monitoring service account necessary permissions
resource "google_project_iam_member" "monitoring_viewer" {
  project = var.project_id
  role    = "roles/monitoring.viewer"
  member  = "serviceAccount:${google_service_account.monitoring_service_account.email}"
}

resource "google_project_iam_member" "monitoring_editor" {
  project = var.project_id
  role    = "roles/monitoring.editor"
  member  = "serviceAccount:${google_service_account.monitoring_service_account.email}"
}

resource "google_project_iam_member" "logging_viewer" {
  project = var.project_id
  role    = "roles/logging.viewer"
  member  = "serviceAccount:${google_service_account.monitoring_service_account.email}"
}

# Create service account for CI/CD operations
resource "google_service_account" "cicd_service_account" {
  account_id   = "cicd-operations-sa"
  display_name = "CI/CD Operations Service Account"
  description  = "Service account for CI/CD pipeline operations"
}

# Grant CI/CD service account necessary permissions
resource "google_project_iam_member" "cicd_container_developer" {
  project = var.project_id
  role    = "roles/container.developer"
  member  = "serviceAccount:${google_service_account.cicd_service_account.email}"
}

resource "google_project_iam_member" "cicd_storage_admin" {
  project = var.project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.cicd_service_account.email}"
}

resource "google_project_iam_member" "cicd_cloudbuild_editor" {
  project = var.project_id
  role    = "roles/cloudbuild.builds.editor"
  member  = "serviceAccount:${google_service_account.cicd_service_account.email}"
}

resource "google_project_iam_member" "cicd_container_registry" {
  project = var.project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.cicd_service_account.email}"
}

# Create custom IAM role for application-specific permissions
resource "google_project_iam_custom_role" "learning_assistant_app_role" {
  role_id     = "learningAssistantAppRole"
  title       = "Learning Assistant Application Role"
  description = "Custom role for learning assistant application with minimal required permissions"

  permissions = [
    "cloudsql.instances.connect",
    "secretmanager.versions.access",
    "storage.objects.get",
    "storage.objects.create",
    "storage.objects.delete",
    "pubsub.messages.publish",
    "pubsub.messages.ack",
    "monitoring.metricDescriptors.create",
    "monitoring.metricDescriptors.get",
    "monitoring.metricDescriptors.list",
    "monitoring.timeSeries.create",
    "logging.logEntries.create",
    "redis.instances.get"
  ]
}

# Assign custom role to application service account
resource "google_project_iam_member" "app_custom_role" {
  project = var.project_id
  role    = google_project_iam_custom_role.learning_assistant_app_role.name
  member  = "serviceAccount:${google_service_account.app_service_account.email}"
}

# Create workload identity binding for GKE
resource "google_service_account_iam_member" "workload_identity_binding" {
  service_account_id = google_service_account.app_service_account.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[default/learning-assistant-app]"

  depends_on = [
    google_container_cluster.primary,
  ]
}

# Create service account for external secrets operator (if used)
resource "google_service_account" "external_secrets_sa" {
  account_id   = "external-secrets-sa"
  display_name = "External Secrets Operator Service Account"
  description  = "Service account for External Secrets Operator to access Secret Manager"
}

resource "google_project_iam_member" "external_secrets_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.external_secrets_sa.email}"
}

resource "google_service_account_iam_member" "external_secrets_workload_identity" {
  service_account_id = google_service_account.external_secrets_sa.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[external-secrets-system/external-secrets]"

  depends_on = [
    google_container_cluster.primary,
  ]
}

# Create service account keys for external systems (use sparingly)
resource "google_service_account_key" "backup_key" {
  service_account_id = google_service_account.backup_service_account.name
  public_key_type    = "TYPE_X509_PEM_FILE"
}

# Store service account key in Secret Manager
resource "google_secret_manager_secret" "backup_sa_key" {
  secret_id = "backup-service-account-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "backup_sa_key" {
  secret      = google_secret_manager_secret.backup_sa_key.id
  secret_data = base64decode(google_service_account_key.backup_key.private_key)
}

# IAM policy for bucket access
resource "google_storage_bucket_iam_member" "terraform_state_admin" {
  bucket = google_storage_bucket.terraform_state.name
  role   = "roles/storage.admin"
  member = "serviceAccount:${google_service_account.backup_service_account.email}"
}

resource "google_storage_bucket_iam_member" "app_backups_admin" {
  bucket = google_storage_bucket.app_backups.name
  role   = "roles/storage.admin"
  member = "serviceAccount:${google_service_account.backup_service_account.email}"
}

resource "google_storage_bucket_iam_member" "static_assets_user" {
  bucket = google_storage_bucket.static_assets.name
  role   = "roles/storage.objectUser"
  member = "serviceAccount:${google_service_account.app_service_account.email}"
}

# IAM policy for secret access
resource "google_secret_manager_secret_iam_member" "db_password_accessor" {
  secret_id = google_secret_manager_secret.db_password.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.app_service_account.email}"
}

resource "google_secret_manager_secret_iam_member" "redis_auth_accessor" {
  secret_id = google_secret_manager_secret.redis_auth_string.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.app_service_account.email}"
}

resource "google_secret_manager_secret_iam_member" "db_connection_accessor" {
  secret_id = google_secret_manager_secret.db_connection_string.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.app_service_account.email}"
}

resource "google_secret_manager_secret_iam_member" "redis_connection_accessor" {
  secret_id = google_secret_manager_secret.redis_connection_string.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.app_service_account.email}"
}

# IAM bindings for KMS encryption
resource "google_kms_crypto_key_iam_member" "encrypt_decrypt" {
  crypto_key_id = google_kms_crypto_key.learning_assistant.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:${google_service_account.app_service_account.email}"
}

resource "google_kms_crypto_key_iam_member" "backup_encrypt_decrypt" {
  crypto_key_id = google_kms_crypto_key.learning_assistant.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:${google_service_account.backup_service_account.email}"
}

# Organization policies for security (if you have organization-level access)
resource "google_organization_policy" "require_os_login" {
  count      = var.environment == "prod" ? 1 : 0
  org_id     = "123456789" # Replace with your organization ID
  constraint = "compute.requireOsLogin"

  boolean_policy {
    enforced = true
  }
}

resource "google_organization_policy" "restrict_vm_external_ips" {
  count      = var.environment == "prod" ? 1 : 0
  org_id     = "123456789" # Replace with your organization ID
  constraint = "compute.vmExternalIpAccess"

  list_policy {
    deny {
      all = true
    }
  }
}

# IAM audit logging configuration
resource "google_project_iam_audit_config" "audit_log" {
  project = var.project_id
  service = "allServices"

  audit_log_config {
    log_type = "ADMIN_READ"
  }

  audit_log_config {
    log_type = "DATA_READ"
  }

  audit_log_config {
    log_type = "DATA_WRITE"
  }
}

# Create IAM conditions for time-based access (example)
resource "google_project_iam_member" "conditional_access" {
  count   = var.environment == "prod" ? 1 : 0
  project = var.project_id
  role    = "roles/compute.instanceAdmin"
  member  = "serviceAccount:${google_service_account.cicd_service_account.email}"

  condition {
    title       = "Business Hours Access"
    description = "Only allow access during business hours"
    expression  = "request.time.getHours() >= 9 && request.time.getHours() <= 17"
  }
}

# Create security policy for IAM
resource "google_access_context_manager_access_policy" "access_policy" {
  count  = var.environment == "prod" ? 1 : 0
  parent = "organizations/123456789" # Replace with your organization ID
  title  = "Learning Assistant Access Policy"
}

# Create access level for internal networks
resource "google_access_context_manager_access_level" "internal_access" {
  count  = var.environment == "prod" ? 1 : 0
  parent = "accessPolicies/${google_access_context_manager_access_policy.access_policy[0].name}"
  name   = "accessPolicies/${google_access_context_manager_access_policy.access_policy[0].name}/accessLevels/internal_access"
  title  = "Internal Network Access"

  basic {
    conditions {
      ip_subnetworks = [var.private_subnet_cidr]
    }
  }
}

# Create service perimeter for VPC Service Controls
resource "google_access_context_manager_service_perimeter" "perimeter" {
  count  = var.environment == "prod" ? 1 : 0
  parent = "accessPolicies/${google_access_context_manager_access_policy.access_policy[0].name}"
  name   = "accessPolicies/${google_access_context_manager_access_policy.access_policy[0].name}/servicePerimeters/learning_assistant_perimeter"
  title  = "Learning Assistant Service Perimeter"

  status {
    restricted_services = [
      "storage.googleapis.com",
      "bigquery.googleapis.com",
      "cloudsql.googleapis.com"
    ]

    access_levels = [
      google_access_context_manager_access_level.internal_access[0].name
    ]

    vpc_accessible_services {
      enable_restriction = true
      allowed_services = [
        "storage.googleapis.com",
        "cloudsql.googleapis.com",
        "redis.googleapis.com"
      ]
    }
  }
}

# Output service account emails for use in Kubernetes manifests
output "service_account_emails" {
  description = "Service account emails for use in Kubernetes"
  value = {
    gke_nodes                = google_service_account.gke_nodes.email
    app_service_account      = google_service_account.app_service_account.email
    backup_service_account   = google_service_account.backup_service_account.email
    monitoring_service_account = google_service_account.monitoring_service_account.email
    cicd_service_account     = google_service_account.cicd_service_account.email
    external_secrets_sa      = google_service_account.external_secrets_sa.email
  }
}