# Project Information
output "project_id" {
  description = "The project ID"
  value       = var.project_id
}

output "region" {
  description = "The region where resources are created"
  value       = var.region
}

output "zone" {
  description = "The zone where resources are created"
  value       = var.zone
}

# Network Outputs
output "vpc_network_name" {
  description = "The name of the VPC network"
  value       = google_compute_network.main.name
}

output "vpc_network_id" {
  description = "The ID of the VPC network"
  value       = google_compute_network.main.id
}

output "private_subnet_name" {
  description = "The name of the private subnet"
  value       = google_compute_subnetwork.private.name
}

output "private_subnet_cidr" {
  description = "The CIDR range of the private subnet"
  value       = google_compute_subnetwork.private.ip_cidr_range
}

output "public_subnet_name" {
  description = "The name of the public subnet"
  value       = google_compute_subnetwork.public.name
}

output "public_subnet_cidr" {
  description = "The CIDR range of the public subnet"
  value       = google_compute_subnetwork.public.ip_cidr_range
}

output "static_external_ip" {
  description = "The static external IP address for the load balancer"
  value       = google_compute_global_address.main.address
}

output "static_internal_ip" {
  description = "The static internal IP address for services"
  value       = google_compute_address.internal.address
}

# GKE Cluster Outputs
output "gke_cluster_name" {
  description = "The name of the GKE cluster"
  value       = google_container_cluster.primary.name
}

output "gke_cluster_endpoint" {
  description = "The endpoint of the GKE cluster"
  value       = google_container_cluster.primary.endpoint
  sensitive   = true
}

output "gke_cluster_ca_certificate" {
  description = "The CA certificate of the GKE cluster"
  value       = google_container_cluster.primary.master_auth[0].cluster_ca_certificate
  sensitive   = true
}

output "gke_cluster_location" {
  description = "The location of the GKE cluster"
  value       = google_container_cluster.primary.location
}

output "gke_node_pool_name" {
  description = "The name of the primary GKE node pool"
  value       = google_container_node_pool.primary_nodes.name
}

# Database Outputs
output "database_instance_name" {
  description = "The name of the Cloud SQL instance"
  value       = google_sql_database_instance.main.name
}

output "database_private_ip" {
  description = "The private IP address of the Cloud SQL instance"
  value       = google_sql_database_instance.main.private_ip_address
  sensitive   = true
}

output "database_connection_name" {
  description = "The connection name of the Cloud SQL instance"
  value       = google_sql_database_instance.main.connection_name
}

output "database_name" {
  description = "The name of the database"
  value       = google_sql_database.learning_assistant.name
}

output "database_username" {
  description = "The database username"
  value       = google_sql_user.app_user.name
  sensitive   = true
}

output "database_read_replica_name" {
  description = "The name of the database read replica"
  value       = var.environment == "prod" ? google_sql_database_instance.read_replica[0].name : null
}

# Redis Outputs
output "redis_instance_name" {
  description = "The name of the Redis instance"
  value       = google_redis_instance.main.name
}

output "redis_host" {
  description = "The host of the Redis instance"
  value       = google_redis_instance.main.host
  sensitive   = true
}

output "redis_port" {
  description = "The port of the Redis instance"
  value       = google_redis_instance.main.port
}

output "redis_replica_host" {
  description = "The host of the Redis replica"
  value       = var.environment == "prod" ? google_redis_instance.replica[0].host : null
  sensitive   = true
}

# DNS Outputs
output "dns_zone_name" {
  description = "The name of the Cloud DNS zone"
  value       = google_dns_managed_zone.main.name
}

output "dns_zone_dns_name" {
  description = "The DNS name of the Cloud DNS zone"
  value       = google_dns_managed_zone.main.dns_name
}

output "dns_name_servers" {
  description = "The name servers for the DNS zone"
  value       = google_dns_managed_zone.main.name_servers
}

output "application_url" {
  description = "The URL of the application"
  value       = "https://${var.subdomain}.${var.domain_name}"
}

output "api_url" {
  description = "The URL of the API"
  value       = "https://api.${var.domain_name}"
}

output "admin_url" {
  description = "The URL of the admin interface"
  value       = "https://admin.${var.domain_name}"
}

# Load Balancer Outputs
output "load_balancer_ip" {
  description = "The IP address of the load balancer"
  value       = google_compute_global_address.main.address
}

output "ssl_certificate_name" {
  description = "The name of the SSL certificate"
  value       = google_compute_managed_ssl_certificate.main.name
}

output "backend_service_name" {
  description = "The name of the backend service"
  value       = google_compute_backend_service.main.name
}

# Storage Outputs
output "terraform_state_bucket" {
  description = "The name of the Terraform state bucket"
  value       = google_storage_bucket.terraform_state.name
}

output "app_backups_bucket" {
  description = "The name of the application backups bucket"
  value       = google_storage_bucket.app_backups.name
}

output "static_assets_bucket" {
  description = "The name of the static assets bucket"
  value       = google_storage_bucket.static_assets.name
}

# Security Outputs
output "kms_key_ring_name" {
  description = "The name of the KMS key ring"
  value       = google_kms_key_ring.learning_assistant.name
}

output "kms_crypto_key_name" {
  description = "The name of the KMS crypto key"
  value       = google_kms_crypto_key.learning_assistant.name
}

output "kms_crypto_key_id" {
  description = "The ID of the KMS crypto key"
  value       = google_kms_crypto_key.learning_assistant.id
}

# Service Account Outputs
output "app_service_account_email" {
  description = "The email of the application service account"
  value       = google_service_account.app_service_account.email
}

output "gke_nodes_service_account_email" {
  description = "The email of the GKE nodes service account"
  value       = google_service_account.gke_nodes.email
}

output "backup_service_account_email" {
  description = "The email of the backup service account"
  value       = google_service_account.backup_service_account.email
}

output "monitoring_service_account_email" {
  description = "The email of the monitoring service account"
  value       = google_service_account.monitoring_service_account.email
}

output "cicd_service_account_email" {
  description = "The email of the CI/CD service account"
  value       = google_service_account.cicd_service_account.email
}

# Secret Manager Outputs
output "db_password_secret_name" {
  description = "The name of the database password secret"
  value       = google_secret_manager_secret.db_password.secret_id
}

output "redis_auth_secret_name" {
  description = "The name of the Redis auth secret"
  value       = google_secret_manager_secret.redis_auth_string.secret_id
}

output "db_connection_secret_name" {
  description = "The name of the database connection secret"
  value       = google_secret_manager_secret.db_connection_string.secret_id
}

output "redis_connection_secret_name" {
  description = "The name of the Redis connection secret"
  value       = google_secret_manager_secret.redis_connection_string.secret_id
}

# Monitoring Outputs
output "notification_channel_email" {
  description = "The email notification channel name"
  value       = google_monitoring_notification_channel.email.name
}

output "uptime_check_app_id" {
  description = "The ID of the application uptime check"
  value       = google_monitoring_uptime_check_config.app_uptime.uptime_check_id
}

output "uptime_check_api_id" {
  description = "The ID of the API uptime check"
  value       = google_monitoring_uptime_check_config.api_uptime.uptime_check_id
}

output "main_dashboard_id" {
  description = "The ID of the main monitoring dashboard"
  value       = google_monitoring_dashboard.main.id
}

output "database_dashboard_id" {
  description = "The ID of the database monitoring dashboard"
  value       = google_monitoring_dashboard.database_dashboard.id
}

output "redis_dashboard_id" {
  description = "The ID of the Redis monitoring dashboard"
  value       = google_monitoring_dashboard.redis_dashboard.id
}

output "dns_dashboard_id" {
  description = "The ID of the DNS monitoring dashboard"
  value       = google_monitoring_dashboard.dns_dashboard.id
}

# Pub/Sub Outputs
output "learning_events_topic" {
  description = "The name of the learning events Pub/Sub topic"
  value       = google_pubsub_topic.learning_events.name
}

output "backup_events_topic" {
  description = "The name of the backup events Pub/Sub topic"
  value       = google_pubsub_topic.backup_events.name
}

# Cloud Build Outputs
output "cloudbuild_trigger_name" {
  description = "The name of the Cloud Build trigger"
  value       = google_cloudbuild_trigger.app_build.name
}

# Network Security Outputs
output "security_policy_name" {
  description = "The name of the Cloud Armor security policy"
  value       = google_compute_security_policy.main.name
}

output "advanced_security_policy_name" {
  description = "The name of the advanced Cloud Armor security policy"
  value       = google_compute_security_policy.advanced.name
}

# Environment Information
output "environment" {
  description = "The deployment environment"
  value       = var.environment
}

output "labels" {
  description = "Common labels applied to resources"
  value       = local.common_labels
}

# Health Check Outputs
output "main_health_check_name" {
  description = "The name of the main health check"
  value       = google_compute_health_check.main.name
}

output "gke_health_check_name" {
  description = "The name of the GKE health check"
  value       = google_compute_health_check.gke_health_check.name
}

# Auto Scaling Outputs
output "instance_group_manager_name" {
  description = "The name of the instance group manager"
  value       = google_compute_region_instance_group_manager.app_igm.name
}

output "autoscaler_name" {
  description = "The name of the autoscaler"
  value       = google_compute_region_autoscaler.app_autoscaler.name
}

# Connection Commands (for convenience)
output "gcloud_connect_cluster_command" {
  description = "Command to connect to the GKE cluster"
  value       = "gcloud container clusters get-credentials ${google_container_cluster.primary.name} --region ${var.region} --project ${var.project_id}"
}

output "kubectl_config_command" {
  description = "Command to configure kubectl"
  value       = "gcloud container clusters get-credentials ${google_container_cluster.primary.name} --region ${var.region}"
}

output "cloudsql_proxy_command" {
  description = "Command to start Cloud SQL proxy"
  value       = "cloud_sql_proxy -instances=${google_sql_database_instance.main.connection_name}=tcp:5432"
}

# Resource Summary
output "resource_summary" {
  description = "Summary of created resources"
  value = {
    vpc_network               = google_compute_network.main.name
    gke_cluster              = google_container_cluster.primary.name
    database_instance        = google_sql_database_instance.main.name
    redis_instance           = google_redis_instance.main.name
    dns_zone                 = google_dns_managed_zone.main.name
    load_balancer_ip         = google_compute_global_address.main.address
    ssl_certificate          = google_compute_managed_ssl_certificate.main.name
    storage_buckets          = [
      google_storage_bucket.terraform_state.name,
      google_storage_bucket.app_backups.name,
      google_storage_bucket.static_assets.name
    ]
    service_accounts         = [
      google_service_account.app_service_account.email,
      google_service_account.gke_nodes.email,
      google_service_account.backup_service_account.email
    ]
    monitoring_dashboards    = [
      google_monitoring_dashboard.main.id,
      google_monitoring_dashboard.database_dashboard.id,
      google_monitoring_dashboard.redis_dashboard.id
    ]
  }
}

# Cost Estimation (informational)
output "estimated_monthly_cost_usd" {
  description = "Estimated monthly cost in USD (approximate)"
  value = {
    gke_cluster              = "~$200-400"
    cloudsql_postgres        = "~$100-300"
    redis_memorystore        = "~$50-150"
    load_balancer           = "~$20-50"
    cloud_dns               = "~$1-5"
    storage                 = "~$10-50"
    monitoring_logging      = "~$20-100"
    network_egress          = "~$10-100"
    total_estimate          = "~$411-1155"
    note                    = "Costs vary based on usage, region, and configuration"
  }
}

# Next Steps
output "next_steps" {
  description = "Next steps after infrastructure deployment"
  value = [
    "1. Configure kubectl: ${google_container_cluster.primary.name}",
    "2. Deploy application to GKE cluster",
    "3. Configure DNS records at your domain registrar",
    "4. Set up monitoring and alerting",
    "5. Configure backup schedules",
    "6. Review and adjust security policies",
    "7. Set up CI/CD pipelines",
    "8. Configure application secrets in Secret Manager"
  ]
}