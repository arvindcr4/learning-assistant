# GCP Cloud Storage Backend Configuration for Terraform State Management
# This file configures secure remote state storage using GCS with state locking

terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }
}

# Configure GCP Provider
provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

provider "google-beta" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

# Random suffix for unique resource naming
resource "random_id" "state_suffix" {
  byte_length = 4
}

# Cloud Storage Bucket for Terraform State
resource "google_storage_bucket" "terraform_state" {
  name          = "${var.project_name}-terraform-state-${var.environment}-${random_id.state_suffix.hex}"
  location      = var.gcs_location
  force_destroy = false
  
  uniform_bucket_level_access = true
  
  versioning {
    enabled = true
  }
  
  encryption {
    default_kms_key_name = google_kms_crypto_key.terraform_state.id
  }
  
  lifecycle_rule {
    condition {
      age = var.state_retention_days
    }
    action {
      type = "Delete"
    }
  }
  
  lifecycle_rule {
    condition {
      num_newer_versions = 10
    }
    action {
      type = "Delete"
    }
  }
  
  logging {
    log_bucket        = google_storage_bucket.access_logs.name
    log_object_prefix = "terraform-state-access-logs/"
  }
  
  labels = {
    environment = var.environment
    project     = var.project_name
    managed_by  = "terraform"
    purpose     = "state-storage"
  }
}

# Access Logs Bucket
resource "google_storage_bucket" "access_logs" {
  name          = "${var.project_name}-terraform-state-logs-${var.environment}-${random_id.state_suffix.hex}"
  location      = var.gcs_location
  force_destroy = true
  
  uniform_bucket_level_access = true
  
  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }
  
  labels = {
    environment = var.environment
    project     = var.project_name
    managed_by  = "terraform"
    purpose     = "access-logs"
  }
}

# KMS Key Ring for State Encryption
resource "google_kms_key_ring" "terraform_state" {
  name     = "${var.project_name}-terraform-state-${var.environment}"
  location = var.gcp_region
}

# KMS Crypto Key for State Encryption
resource "google_kms_crypto_key" "terraform_state" {
  name            = "terraform-state-key"
  key_ring        = google_kms_key_ring.terraform_state.id
  rotation_period = "7776000s" # 90 days
  
  purpose = "ENCRYPT_DECRYPT"
  
  labels = {
    environment = var.environment
    project     = var.project_name
    managed_by  = "terraform"
  }
}

# Cloud Firestore Database for State Locking (if using Firestore)
resource "google_firestore_database" "terraform_state_lock" {
  count       = var.use_firestore_locking ? 1 : 0
  project     = var.gcp_project_id
  name        = "${var.project_name}-terraform-locks-${var.environment}"
  location_id = var.firestore_location
  type        = "FIRESTORE_NATIVE"
  
  depends_on = [google_project_service.firestore]
}

# Enable required APIs
resource "google_project_service" "storage" {
  service = "storage.googleapis.com"
  
  disable_on_destroy = false
}

resource "google_project_service" "kms" {
  service = "cloudkms.googleapis.com"
  
  disable_on_destroy = false
}

resource "google_project_service" "firestore" {
  count   = var.use_firestore_locking ? 1 : 0
  service = "firestore.googleapis.com"
  
  disable_on_destroy = false
}

resource "google_project_service" "functions" {
  service = "cloudfunctions.googleapis.com"
  
  disable_on_destroy = false
}

resource "google_project_service" "pubsub" {
  service = "pubsub.googleapis.com"
  
  disable_on_destroy = false
}

# Service Account for Terraform Operations
resource "google_service_account" "terraform_state" {
  account_id   = "${var.project_name}-terraform-state-${var.environment}"
  display_name = "Terraform State Management Service Account"
  description  = "Service account for Terraform state operations"
}

# IAM Policy for Terraform State Operations
resource "google_project_iam_member" "terraform_state_storage" {
  project = var.gcp_project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.terraform_state.email}"
}

resource "google_project_iam_member" "terraform_state_kms" {
  project = var.gcp_project_id
  role    = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member  = "serviceAccount:${google_service_account.terraform_state.email}"
}

resource "google_project_iam_member" "terraform_state_firestore" {
  count   = var.use_firestore_locking ? 1 : 0
  project = var.gcp_project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.terraform_state.email}"
}

# Bucket-level IAM for State Bucket
resource "google_storage_bucket_iam_member" "terraform_state_admin" {
  bucket = google_storage_bucket.terraform_state.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.terraform_state.email}"
}

# Service Account Key for External Access
resource "google_service_account_key" "terraform_state" {
  service_account_id = google_service_account.terraform_state.name
  public_key_type    = "TYPE_X509_PEM_FILE"
}

# Pub/Sub Topic for State Change Notifications
resource "google_pubsub_topic" "terraform_state_changes" {
  name = "${var.project_name}-terraform-state-changes-${var.environment}"
  
  labels = {
    environment = var.environment
    project     = var.project_name
  }
}

# Pub/Sub Subscription for State Change Notifications
resource "google_pubsub_subscription" "terraform_state_changes" {
  name  = "${var.project_name}-terraform-state-changes-sub-${var.environment}"
  topic = google_pubsub_topic.terraform_state_changes.name
  
  message_retention_duration = "604800s" # 7 days
  retain_acked_messages      = false
  ack_deadline_seconds       = 20
  
  expiration_policy {
    ttl = "300000.5s"
  }
  
  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }
  
  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.terraform_state_changes_dlq.id
    max_delivery_attempts = 5
  }
}

# Dead Letter Queue for Failed Notifications
resource "google_pubsub_topic" "terraform_state_changes_dlq" {
  name = "${var.project_name}-terraform-state-changes-dlq-${var.environment}"
  
  labels = {
    environment = var.environment
    project     = var.project_name
  }
}

# Cloud Function for State Change Notifications
resource "google_cloudfunctions_function" "state_change_notifier" {
  name        = "${var.project_name}-state-change-notifier-${var.environment}"
  region      = var.gcp_region
  description = "Cloud Function to handle Terraform state change notifications"
  
  runtime     = "python39"
  entry_point = "state_change_handler"
  
  source_archive_bucket = google_storage_bucket.function_source.name
  source_archive_object = google_storage_bucket_object.function_source.name
  
  event_trigger {
    event_type = "google.storage.object.finalize"
    resource   = google_storage_bucket.terraform_state.name
  }
  
  environment_variables = {
    SLACK_WEBHOOK_URL = var.slack_webhook_url
    ENVIRONMENT      = var.environment
    PROJECT_NAME     = var.project_name
    PUBSUB_TOPIC     = google_pubsub_topic.terraform_state_changes.name
  }
  
  depends_on = [
    google_project_service.functions,
    google_storage_bucket_object.function_source
  ]
}

# Storage Bucket for Cloud Function Source
resource "google_storage_bucket" "function_source" {
  name          = "${var.project_name}-function-source-${var.environment}-${random_id.state_suffix.hex}"
  location      = var.gcs_location
  force_destroy = true
  
  uniform_bucket_level_access = true
  
  labels = {
    environment = var.environment
    project     = var.project_name
    managed_by  = "terraform"
    purpose     = "function-source"
  }
}

# Function Source Code
data "archive_file" "function_source" {
  type        = "zip"
  output_path = "state-change-notifier.zip"
  source {
    content = <<EOF
import json
import os
import urllib3
from datetime import datetime
from google.cloud import pubsub_v1

def state_change_handler(event, context):
    """
    Cloud Function to handle Terraform state change notifications
    """
    http = urllib3.PoolManager()
    
    webhook_url = os.environ.get('SLACK_WEBHOOK_URL')
    environment = os.environ.get('ENVIRONMENT', 'unknown')
    project_name = os.environ.get('PROJECT_NAME', 'terraform')
    pubsub_topic = os.environ.get('PUBSUB_TOPIC')
    
    try:
        # Extract event information
        bucket_name = event['bucket']
        object_name = event['name']
        event_type = event['eventType']
        time_created = event['timeCreated']
        
        # Create notification message
        notification_data = {
            'bucket': bucket_name,
            'object': object_name,
            'event_type': event_type,
            'time_created': time_created,
            'environment': environment,
            'project': project_name,
            'timestamp': datetime.now().isoformat()
        }
        
        # Publish to Pub/Sub
        if pubsub_topic:
            publisher = pubsub_v1.PublisherClient()
            topic_path = publisher.topic_path(project_name, pubsub_topic.split('/')[-1])
            
            message_data = json.dumps(notification_data).encode('utf-8')
            future = publisher.publish(topic_path, message_data)
            print(f"Published message to Pub/Sub: {future.result()}")
        
        # Send Slack notification
        if webhook_url:
            slack_message = {
                "text": f"🔄 Terraform State Change Alert - {environment}",
                "attachments": [
                    {
                        "color": "warning" if "delete" in event_type.lower() else "good",
                        "fields": [
                            {
                                "title": "Environment",
                                "value": environment,
                                "short": True
                            },
                            {
                                "title": "Project",
                                "value": project_name,
                                "short": True
                            },
                            {
                                "title": "Bucket",
                                "value": bucket_name,
                                "short": True
                            },
                            {
                                "title": "Object",
                                "value": object_name,
                                "short": True
                            },
                            {
                                "title": "Event Type",
                                "value": event_type,
                                "short": True
                            },
                            {
                                "title": "Time Created",
                                "value": time_created,
                                "short": True
                            }
                        ]
                    }
                ]
            }
            
            response = http.request(
                'POST',
                webhook_url,
                body=json.dumps(slack_message),
                headers={'Content-Type': 'application/json'}
            )
            
            print(f"Slack notification sent with status: {response.status}")
        
        return 'OK'
        
    except Exception as e:
        print(f"Error processing state change notification: {str(e)}")
        raise

# Requirements.txt content
requirements = '''
google-cloud-pubsub==2.18.0
urllib3==1.26.15
'''
EOF
    filename = "main.py"
  }
  
  source {
    content  = "google-cloud-pubsub==2.18.0\nurllib3==1.26.15"
    filename = "requirements.txt"
  }
}

# Upload Function Source to GCS
resource "google_storage_bucket_object" "function_source" {
  name   = "state-change-notifier-${random_id.state_suffix.hex}.zip"
  bucket = google_storage_bucket.function_source.name
  source = data.archive_file.function_source.output_path
}

# Cloud Monitoring Alert Policy for State Changes
resource "google_monitoring_alert_policy" "terraform_state_changes" {
  display_name = "Terraform State Changes - ${var.environment}"
  combiner     = "OR"
  
  conditions {
    display_name = "Terraform state file modified"
    
    condition_threshold {
      filter         = "resource.type=\"gcs_bucket\" AND resource.labels.bucket_name=\"${google_storage_bucket.terraform_state.name}\""
      duration       = "60s"
      comparison     = "COMPARISON_GT"
      threshold_value = 0
      
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }
  
  notification_channels = var.notification_channels
  
  alert_strategy {
    auto_close = "604800s" # 7 days
  }
}

# State Backup Configuration
resource "google_storage_bucket" "terraform_state_backup" {
  name          = "${var.project_name}-terraform-state-backup-${var.environment}-${random_id.state_suffix.hex}"
  location      = var.backup_location
  force_destroy = false
  
  uniform_bucket_level_access = true
  
  versioning {
    enabled = true
  }
  
  encryption {
    default_kms_key_name = google_kms_crypto_key.terraform_state.id
  }
  
  lifecycle_rule {
    condition {
      age = var.backup_retention_days
    }
    action {
      type = "Delete"
    }
  }
  
  labels = {
    environment = var.environment
    project     = var.project_name
    managed_by  = "terraform"
    purpose     = "state-backup"
  }
}

# Cross-Region Replication (Transfer Service)
resource "google_storage_transfer_job" "terraform_state_backup" {
  count       = var.enable_cross_region_backup ? 1 : 0
  description = "Terraform state backup transfer job"
  
  transfer_spec {
    gcs_data_source {
      bucket_name = google_storage_bucket.terraform_state.name
      path        = "terraform.tfstate"
    }
    
    gcs_data_sink {
      bucket_name = google_storage_bucket.terraform_state_backup.name
      path        = "backups/"
    }
    
    transfer_options {
      overwrite_objects_already_existing_in_sink = true
    }
  }
  
  schedule {
    schedule_start_date {
      year  = 2024
      month = 1
      day   = 1
    }
    
    start_time_of_day {
      hours   = 2
      minutes = 0
      seconds = 0
    }
  }
  
  depends_on = [google_project_service.storage]
}

# Variables
variable "gcp_project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "gcp_region" {
  description = "GCP region for resources"
  type        = string
  default     = "us-central1"
}

variable "gcs_location" {
  description = "GCS bucket location"
  type        = string
  default     = "US"
}

variable "backup_location" {
  description = "Location for backup bucket"
  type        = string
  default     = "EU"
}

variable "firestore_location" {
  description = "Firestore location"
  type        = string
  default     = "us-central"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "learning-assistant"
}

variable "state_retention_days" {
  description = "Number of days to retain old state versions"
  type        = number
  default     = 90
}

variable "backup_retention_days" {
  description = "Number of days to retain backup versions"
  type        = number
  default     = 365
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications"
  type        = string
  default     = ""
  sensitive   = true
}

variable "notification_channels" {
  description = "List of notification channels for alerts"
  type        = list(string)
  default     = []
}

variable "use_firestore_locking" {
  description = "Use Firestore for state locking"
  type        = bool
  default     = false
}

variable "enable_cross_region_backup" {
  description = "Enable cross-region backup"
  type        = bool
  default     = false
}

# Outputs
output "state_bucket_name" {
  description = "Name of the GCS bucket for Terraform state"
  value       = google_storage_bucket.terraform_state.name
}

output "state_bucket_url" {
  description = "URL of the GCS bucket for Terraform state"
  value       = google_storage_bucket.terraform_state.url
}

output "kms_key_id" {
  description = "ID of the KMS key used for state encryption"
  value       = google_kms_crypto_key.terraform_state.id
}

output "service_account_email" {
  description = "Email of the service account for Terraform operations"
  value       = google_service_account.terraform_state.email
}

output "service_account_key" {
  description = "Service account key for external access"
  value       = google_service_account_key.terraform_state.private_key
  sensitive   = true
}

output "pubsub_topic_name" {
  description = "Name of the Pub/Sub topic for state change notifications"
  value       = google_pubsub_topic.terraform_state_changes.name
}

output "backend_config" {
  description = "Backend configuration for Terraform"
  value = {
    bucket = google_storage_bucket.terraform_state.name
    prefix = "terraform/state"
  }
}