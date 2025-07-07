# VPC Outputs
output "vpc_id" {
  description = "DigitalOcean VPC ID"
  value       = digitalocean_vpc.main.id
}

output "vpc_urn" {
  description = "DigitalOcean VPC URN"
  value       = digitalocean_vpc.main.urn
}

output "vpc_ip_range" {
  description = "VPC IP range"
  value       = digitalocean_vpc.main.ip_range
}

# Container Registry Outputs
output "container_registry_name" {
  description = "Container Registry name"
  value       = digitalocean_container_registry.registry.name
}

output "container_registry_endpoint" {
  description = "Container Registry endpoint"
  value       = digitalocean_container_registry.registry.endpoint
}

output "container_registry_server_url" {
  description = "Container Registry server URL"
  value       = digitalocean_container_registry.registry.server_url
}

output "docker_credentials" {
  description = "Docker credentials for registry"
  value       = digitalocean_container_registry_docker_credentials.registry.docker_credentials
  sensitive   = true
}

# App Platform Outputs
output "app_id" {
  description = "App Platform app ID"
  value       = digitalocean_app.app.id
}

output "app_urn" {
  description = "App Platform app URN"
  value       = digitalocean_app.app.urn
}

output "app_default_ingress" {
  description = "App Platform default ingress URL"
  value       = digitalocean_app.app.default_ingress
}

output "app_live_url" {
  description = "App Platform live URL"
  value       = digitalocean_app.app.live_url
}

output "app_active_deployment_id" {
  description = "App Platform active deployment ID"
  value       = digitalocean_app.app.active_deployment_id
}

# PostgreSQL Outputs
output "postgres_id" {
  description = "PostgreSQL cluster ID"
  value       = digitalocean_database_cluster.postgres.id
}

output "postgres_urn" {
  description = "PostgreSQL cluster URN"
  value       = digitalocean_database_cluster.postgres.urn
}

output "postgres_host" {
  description = "PostgreSQL host"
  value       = digitalocean_database_cluster.postgres.host
  sensitive   = true
}

output "postgres_port" {
  description = "PostgreSQL port"
  value       = digitalocean_database_cluster.postgres.port
}

output "postgres_uri" {
  description = "PostgreSQL connection URI"
  value       = digitalocean_database_cluster.postgres.uri
  sensitive   = true
}

output "postgres_private_uri" {
  description = "PostgreSQL private network connection URI"
  value       = digitalocean_database_cluster.postgres.private_uri
  sensitive   = true
}

output "postgres_database" {
  description = "PostgreSQL database name"
  value       = digitalocean_database_db.postgres_db.name
}

output "postgres_user" {
  description = "PostgreSQL user"
  value       = digitalocean_database_user.postgres_user.name
}

output "postgres_password" {
  description = "PostgreSQL user password"
  value       = digitalocean_database_user.postgres_user.password
  sensitive   = true
}

output "postgres_connection_pool_uri" {
  description = "PostgreSQL connection pool URI"
  value       = var.enable_db_connection_pool ? digitalocean_database_connection_pool.postgres_pool[0].uri : null
  sensitive   = true
}

output "postgres_connection_pool_private_uri" {
  description = "PostgreSQL connection pool private URI"
  value       = var.enable_db_connection_pool ? digitalocean_database_connection_pool.postgres_pool[0].private_uri : null
  sensitive   = true
}

# Redis Outputs (if enabled)
output "redis_id" {
  description = "Redis cluster ID"
  value       = var.enable_redis ? digitalocean_database_cluster.redis[0].id : null
}

output "redis_host" {
  description = "Redis host"
  value       = var.enable_redis ? digitalocean_database_cluster.redis[0].host : null
  sensitive   = true
}

output "redis_port" {
  description = "Redis port"
  value       = var.enable_redis ? digitalocean_database_cluster.redis[0].port : null
}

output "redis_uri" {
  description = "Redis connection URI"
  value       = var.enable_redis ? digitalocean_database_cluster.redis[0].uri : null
  sensitive   = true
}

output "redis_private_uri" {
  description = "Redis private network connection URI"
  value       = var.enable_redis ? digitalocean_database_cluster.redis[0].private_uri : null
  sensitive   = true
}

output "redis_password" {
  description = "Redis password"
  value       = var.enable_redis ? digitalocean_database_cluster.redis[0].password : null
  sensitive   = true
}

# Spaces Outputs
output "spaces_bucket_name" {
  description = "Spaces bucket name"
  value       = digitalocean_spaces_bucket.bucket.name
}

output "spaces_bucket_urn" {
  description = "Spaces bucket URN"
  value       = digitalocean_spaces_bucket.bucket.urn
}

output "spaces_bucket_domain_name" {
  description = "Spaces bucket domain name"
  value       = digitalocean_spaces_bucket.bucket.bucket_domain_name
}

output "spaces_endpoint" {
  description = "Spaces endpoint"
  value       = digitalocean_spaces_bucket.bucket.endpoint
}

output "spaces_region" {
  description = "Spaces region"
  value       = digitalocean_spaces_bucket.bucket.region
}

# CDN Outputs (if enabled)
output "cdn_id" {
  description = "CDN ID"
  value       = var.enable_cdn ? digitalocean_cdn.spaces_cdn[0].id : null
}

output "cdn_endpoint" {
  description = "CDN endpoint"
  value       = var.enable_cdn ? digitalocean_cdn.spaces_cdn[0].endpoint : null
}

output "cdn_custom_domain" {
  description = "CDN custom domain"
  value       = var.enable_cdn && var.cdn_custom_domain != "" ? var.cdn_custom_domain : null
}

# Monitoring Outputs
output "alert_policy_ids" {
  description = "Monitoring alert policy IDs"
  value = {
    cpu    = digitalocean_monitor_alert.cpu_alert.id
    memory = digitalocean_monitor_alert.memory_alert.id
    db_cpu = digitalocean_monitor_alert.database_cpu_alert.id
  }
}

# Project Output
output "project_id" {
  description = "DigitalOcean project ID"
  value       = digitalocean_project.project.id
}

output "project_owner_id" {
  description = "DigitalOcean project owner ID"
  value       = digitalocean_project.project.owner_id
}

# Summary Output
output "infrastructure_summary" {
  description = "Summary of deployed infrastructure"
  value = {
    region                  = var.region
    environment             = var.environment
    app_url                 = digitalocean_app.app.live_url
    container_registry      = digitalocean_container_registry.registry.server_url
    postgres_endpoint       = digitalocean_database_cluster.postgres.host
    redis_endpoint          = var.enable_redis ? digitalocean_database_cluster.redis[0].host : "Not enabled"
    spaces_bucket           = digitalocean_spaces_bucket.bucket.name
    spaces_endpoint         = digitalocean_spaces_bucket.bucket.endpoint
    cdn_endpoint            = var.enable_cdn ? digitalocean_cdn.spaces_cdn[0].endpoint : "Not enabled"
    project_id              = digitalocean_project.project.id
  }
}

# Connection Strings Output
output "connection_strings" {
  description = "Database connection strings for applications"
  value = {
    postgres         = digitalocean_database_cluster.postgres.uri
    postgres_private = digitalocean_database_cluster.postgres.private_uri
    postgres_pool    = var.enable_db_connection_pool ? digitalocean_database_connection_pool.postgres_pool[0].uri : null
    redis            = var.enable_redis ? digitalocean_database_cluster.redis[0].uri : null
    redis_private    = var.enable_redis ? digitalocean_database_cluster.redis[0].private_uri : null
  }
  sensitive = true
}
