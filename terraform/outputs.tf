# ==============================================================================
# TERRAFORM OUTPUTS FOR LEARNING ASSISTANT
# Output values for Google Cloud Platform infrastructure
# ==============================================================================

# ==============================================================================
# NETWORK OUTPUTS
# ==============================================================================

output "vpc_id" {
  description = "ID of the VPC network"
  value       = google_compute_network.vpc.id
}

output "vpc_name" {
  description = "Name of the VPC network"
  value       = google_compute_network.vpc.name
}

output "subnet_id" {
  description = "ID of the subnet"
  value       = google_compute_subnetwork.subnet.id
}

output "subnet_name" {
  description = "Name of the subnet"
  value       = google_compute_subnetwork.subnet.name
}

output "vpc_connector_id" {
  description = "ID of the VPC Access Connector"
  value       = google_vpc_access_connector.connector.id
}

output "vpc_connector_name" {
  description = "Name of the VPC Access Connector"
  value       = google_vpc_access_connector.connector.name
}

# ==============================================================================
# DATABASE OUTPUTS
# ==============================================================================

output "database_instance_name" {
  description = "Name of the Cloud SQL instance"
  value       = google_sql_database_instance.main.name
}

output "database_instance_id" {
  description = "ID of the Cloud SQL instance"
  value       = google_sql_database_instance.main.id
}

output "database_connection_name" {
  description = "Connection name for the Cloud SQL instance"
  value       = google_sql_database_instance.main.connection_name
}

output "database_private_ip" {
  description = "Private IP address of the Cloud SQL instance"
  value       = google_sql_database_instance.main.private_ip_address
  sensitive   = true
}

output "database_name" {
  description = "Name of the database"
  value       = google_sql_database.database.name
}

output "database_username" {
  description = "Database username"
  value       = google_sql_user.user.name
  sensitive   = true
}

# ==============================================================================
# SECRET MANAGER OUTPUTS
# ==============================================================================

output "db_connection_secret_name" {
  description = "Name of the database connection string secret"
  value       = google_secret_manager_secret.db_connection_string.secret_id
}

output "jwt_secret_name" {
  description = "Name of the JWT secret"
  value       = google_secret_manager_secret.jwt_secret.secret_id
}

output "nextauth_secret_name" {
  description = "Name of the NextAuth secret"
  value       = google_secret_manager_secret.nextauth_secret.secret_id
}

# ==============================================================================
# CLOUD STORAGE OUTPUTS
# ==============================================================================

output "assets_bucket_name" {
  description = "Name of the assets storage bucket"
  value       = google_storage_bucket.assets.name
}

output "assets_bucket_url" {
  description = "URL of the assets storage bucket"
  value       = google_storage_bucket.assets.url
}

output "backups_bucket_name" {
  description = "Name of the backups storage bucket"
  value       = google_storage_bucket.backups.name
}

output "backups_bucket_url" {
  description = "URL of the backups storage bucket"
  value       = google_storage_bucket.backups.url
}

# ==============================================================================
# SERVICE ACCOUNT OUTPUTS
# ==============================================================================

output "cloud_run_service_account_email" {
  description = "Email of the Cloud Run service account"
  value       = google_service_account.cloud_run_sa.email
}

output "cloud_run_service_account_id" {
  description = "ID of the Cloud Run service account"
  value       = google_service_account.cloud_run_sa.id
}

output "cloud_sql_service_account_email" {
  description = "Email of the Cloud SQL service account"
  value       = google_service_account.cloud_sql_sa.email
}

output "cloud_sql_service_account_id" {
  description = "ID of the Cloud SQL service account"
  value       = google_service_account.cloud_sql_sa.id
}

# ==============================================================================
# CLOUD RUN OUTPUTS
# ==============================================================================

output "cloud_run_service_name" {
  description = "Name of the Cloud Run service"
  value       = google_cloud_run_v2_service.main.name
}

output "cloud_run_service_id" {
  description = "ID of the Cloud Run service"
  value       = google_cloud_run_v2_service.main.id
}

output "cloud_run_service_url" {
  description = "URL of the Cloud Run service"
  value       = google_cloud_run_v2_service.main.uri
}

output "cloud_run_service_location" {
  description = "Location of the Cloud Run service"
  value       = google_cloud_run_v2_service.main.location
}

# ==============================================================================
# LOAD BALANCER OUTPUTS
# ==============================================================================

output "load_balancer_ip" {
  description = "External IP address of the load balancer"
  value       = google_compute_global_address.lb_ip.address
}

output "load_balancer_ip_name" {
  description = "Name of the load balancer IP address"
  value       = google_compute_global_address.lb_ip.name
}

output "ssl_certificate_name" {
  description = "Name of the SSL certificate"
  value       = google_compute_managed_ssl_certificate.ssl_cert.name
}

output "ssl_certificate_id" {
  description = "ID of the SSL certificate"
  value       = google_compute_managed_ssl_certificate.ssl_cert.id
}

output "backend_service_name" {
  description = "Name of the backend service"
  value       = google_compute_backend_service.backend.name
}

output "backend_service_id" {
  description = "ID of the backend service"
  value       = google_compute_backend_service.backend.id
}

# ==============================================================================
# DOMAIN AND SSL OUTPUTS
# ==============================================================================

output "domain_name" {
  description = "Domain name for the application"
  value       = var.domain_name
}

output "application_url" {
  description = "Full HTTPS URL of the application"
  value       = "https://${var.domain_name}"
}

output "http_url" {
  description = "HTTP URL (redirects to HTTPS)"
  value       = "http://${var.domain_name}"
}

# ==============================================================================
# MONITORING OUTPUTS
# ==============================================================================

output "uptime_check_name" {
  description = "Name of the uptime check"
  value       = google_monitoring_uptime_check_config.uptime_check.display_name
}

output "uptime_check_id" {
  description = "ID of the uptime check"
  value       = google_monitoring_uptime_check_config.uptime_check.name
}

output "alert_policy_name" {
  description = "Name of the alert policy"
  value       = google_monitoring_alert_policy.app_down_alert.display_name
}

output "alert_policy_id" {
  description = "ID of the alert policy"
  value       = google_monitoring_alert_policy.app_down_alert.name
}

# ==============================================================================
# PROJECT INFORMATION OUTPUTS
# ==============================================================================

output "project_id" {
  description = "GCP project ID"
  value       = var.project_id
}

output "project_name" {
  description = "Project name used for resource naming"
  value       = var.project_name
}

output "environment" {
  description = "Deployment environment"
  value       = var.environment
}

output "region" {
  description = "GCP region"
  value       = var.region
}

output "zone" {
  description = "GCP zone"
  value       = var.zone
}

# ==============================================================================
# CONFIGURATION OUTPUTS
# ==============================================================================

output "database_configuration" {
  description = "Database configuration summary"
  value = {
    version           = var.database_version
    tier              = var.database_tier
    availability_type = var.database_availability_type
    disk_type         = var.database_disk_type
    disk_size         = var.database_disk_size
  }
}

output "cloud_run_configuration" {
  description = "Cloud Run configuration summary"
  value = {
    min_instances = var.cloud_run_min_instances
    max_instances = var.cloud_run_max_instances
    cpu_limit     = var.cloud_run_cpu_limit
    memory_limit  = var.cloud_run_memory_limit
    cpu_idle      = var.cloud_run_cpu_idle
  }
}

output "network_configuration" {
  description = "Network configuration summary"
  value = {
    vpc_name       = google_compute_network.vpc.name
    subnet_cidr    = var.subnet_cidr
    connector_cidr = var.connector_cidr
  }
}

# ==============================================================================
# DEPLOYMENT INFORMATION
# ==============================================================================

output "deployment_information" {
  description = "Key deployment information and next steps"
  value = {
    load_balancer_ip     = google_compute_global_address.lb_ip.address
    application_url      = "https://${var.domain_name}"
    cloud_run_url        = google_cloud_run_v2_service.main.uri
    database_instance    = google_sql_database_instance.main.name
    assets_bucket        = google_storage_bucket.assets.name
    backups_bucket       = google_storage_bucket.backups.name
    monitoring_enabled   = var.enable_monitoring
    cdn_enabled          = var.enable_cdn
    deletion_protection  = var.enable_deletion_protection
  }
}

# ==============================================================================
# CONNECTION STRINGS (SENSITIVE)
# ==============================================================================

output "database_connection_instructions" {
  description = "Instructions for connecting to the database"
  value = {
    connection_name = google_sql_database_instance.main.connection_name
    database_name   = google_sql_database.database.name
    username        = google_sql_user.user.name
    secret_name     = google_secret_manager_secret.db_connection_string.secret_id
    note           = "Use Secret Manager to retrieve the connection string securely"
  }
}

output "gcp_commands" {
  description = "Useful GCP commands for managing the infrastructure"
  value = {
    get_db_password    = "gcloud secrets versions access latest --secret=${google_secret_manager_secret.db_connection_string.secret_id}"
    cloud_run_logs     = "gcloud run services logs read ${google_cloud_run_v2_service.main.name} --region=${var.region}"
    cloud_sql_connect  = "gcloud sql connect ${google_sql_database_instance.main.name} --user=${google_sql_user.user.name}"
    list_secrets       = "gcloud secrets list --filter='name:${var.project_name}*'"
    monitoring_status  = "gcloud monitoring uptime list --filter='displayName:${var.project_name}*'"
  }
}

# ==============================================================================
# COST ESTIMATION
# ==============================================================================

output "estimated_monthly_costs" {
  description = "Estimated monthly costs for the infrastructure (approximate)"
  value = {
    cloud_run        = "Based on CPU/Memory allocation and requests"
    cloud_sql        = "Based on ${var.database_tier} tier and storage"
    load_balancer    = "~$18-25/month for global load balancer"
    storage          = "Based on bucket usage and data transfer"
    vpc_connector    = "Based on ${var.connector_machine_type} instances"
    monitoring       = "Free tier for basic monitoring"
    note            = "Actual costs depend on usage patterns. Use GCP Pricing Calculator for detailed estimates."
  }
}

# ==============================================================================
# SECURITY INFORMATION
# ==============================================================================

output "security_features" {
  description = "Security features enabled in the deployment"
  value = {
    private_database     = "Database is private (no public IP)"
    ssl_enforced        = "SSL/TLS enforced for database connections"
    secret_management   = "Secrets stored in Secret Manager"
    vpc_isolation       = "Services run in isolated VPC"
    https_only          = "HTTPS enforced with managed SSL certificates"
    iam_least_privilege = "Service accounts with minimal required permissions"
    deletion_protection = var.enable_deletion_protection ? "Enabled" : "Disabled"
  }
}