# DigitalOcean Infrastructure Stack

terraform {
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

provider "digitalocean" {
  token = var.do_token
}

# VPC
resource "digitalocean_vpc" "main" {
  name     = "${var.name}-vpc"
  region   = var.region
  ip_range = var.vpc_ip_range
}

# Container Registry
resource "digitalocean_container_registry" "registry" {
  name                   = "${var.name}-registry"
  subscription_tier_slug = var.registry_tier
  region                 = var.region
}

# Container Registry Docker Credentials
resource "digitalocean_container_registry_docker_credentials" "registry" {
  registry_name = digitalocean_container_registry.registry.name
  write         = true
}

# Database Connection Pool for PostgreSQL
resource "digitalocean_database_connection_pool" "postgres_pool" {
  count      = var.enable_db_connection_pool ? 1 : 0
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = "${var.name}-pool"
  mode       = "transaction"
  size       = var.db_pool_size
  db_name    = digitalocean_database_db.postgres_db.name
  user       = digitalocean_database_user.postgres_user.name
}

# PostgreSQL Database
resource "digitalocean_database_cluster" "postgres" {
  name       = "${var.name}-postgres"
  engine     = "pg"
  version    = var.postgres_version
  size       = var.postgres_size
  region     = var.region
  node_count = var.postgres_node_count
  
  private_network_uuid = digitalocean_vpc.main.id
  
  maintenance_window {
    day  = var.postgres_maintenance_day
    hour = var.postgres_maintenance_hour
  }
  
  backup_restore {
    backup_hour         = var.postgres_backup_hour
    backup_minute       = var.postgres_backup_minute
    days_to_retain_backups = var.postgres_backup_retention
  }
  
  tags = var.tags
}

# PostgreSQL Database
resource "digitalocean_database_db" "postgres_db" {
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = var.postgres_db_name
}

# PostgreSQL User
resource "digitalocean_database_user" "postgres_user" {
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = var.postgres_user
}

# Redis Cluster (optional)
resource "digitalocean_database_cluster" "redis" {
  count      = var.enable_redis ? 1 : 0
  name       = "${var.name}-redis"
  engine     = "redis"
  version    = var.redis_version
  size       = var.redis_size
  region     = var.region
  node_count = var.redis_node_count
  
  private_network_uuid = digitalocean_vpc.main.id
  
  eviction_policy = var.redis_eviction_policy
  
  tags = var.tags
}

# Spaces Bucket
resource "digitalocean_spaces_bucket" "bucket" {
  name   = var.bucket_name
  region = var.spaces_region != "" ? var.spaces_region : var.region
  acl    = var.bucket_acl
  
  cors_rule {
    allowed_headers = var.cors_allowed_headers
    allowed_methods = var.cors_allowed_methods
    allowed_origins = var.cors_allowed_origins
    max_age_seconds = var.cors_max_age_seconds
  }
  
  lifecycle_rule {
    id      = "expire-old-files"
    enabled = var.enable_lifecycle_rules
    prefix  = "temp/"
    expiration {
      days = var.temp_files_expiration_days
    }
  }
  
  lifecycle_rule {
    id      = "archive-backups"
    enabled = var.enable_lifecycle_rules
    prefix  = "backups/"
    noncurrent_version_expiration {
      days = var.backup_expiration_days
    }
  }
  
  versioning {
    enabled = var.enable_versioning
  }
}

# Spaces Bucket Policy for Public Read (if needed)
resource "digitalocean_spaces_bucket_policy" "bucket_policy" {
  count  = var.enable_public_read ? 1 : 0
  region = digitalocean_spaces_bucket.bucket.region
  bucket = digitalocean_spaces_bucket.bucket.name
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "PublicReadGetObject"
        Effect = "Allow"
        Principal = "*"
        Action = [
          "s3:GetObject"
        ]
        Resource = [
          "${digitalocean_spaces_bucket.bucket.urn}/*"
        ]
      }
    ]
  })
}

# CDN for Spaces
resource "digitalocean_cdn" "spaces_cdn" {
  count  = var.enable_cdn ? 1 : 0
  origin = digitalocean_spaces_bucket.bucket.bucket_domain_name
  
  custom_domain = var.cdn_custom_domain
  certificate_id = var.cdn_certificate_id
  ttl = var.cdn_ttl
}

# App Platform
resource "digitalocean_app" "app" {
  spec {
    name   = "${var.name}-app"
    region = var.region
    
    # Service spec
    service {
      name               = "api"
      environment_slug   = var.app_environment
      instance_count     = var.app_instance_count
      instance_size_slug = var.app_instance_size
      
      image {
        registry_type = "DOCR"
        registry      = digitalocean_container_registry.registry.name
        repository    = var.app_image_repository
        tag           = var.app_image_tag
      }
      
      http_port = var.app_port
      
      # Health check
      health_check {
        http_path             = var.health_check_path
        initial_delay_seconds = var.health_check_initial_delay
        period_seconds        = var.health_check_period
        timeout_seconds       = var.health_check_timeout
        success_threshold     = var.health_check_success_threshold
        failure_threshold     = var.health_check_failure_threshold
      }
      
      # Environment variables
      dynamic "env" {
        for_each = var.app_env_vars
        content {
          key   = env.key
          value = env.value
          type  = "GENERAL"
        }
      }
      
      # Database URL
      env {
        key   = "DATABASE_URL"
        value = digitalocean_database_cluster.postgres.uri
        type  = "SECRET"
      }
      
      # Redis URL (if enabled)
      dynamic "env" {
        for_each = var.enable_redis ? [1] : []
        content {
          key   = "REDIS_URL"
          value = digitalocean_database_cluster.redis[0].uri
          type  = "SECRET"
        }
      }
      
      # Spaces configuration
      env {
        key   = "SPACES_BUCKET"
        value = digitalocean_spaces_bucket.bucket.name
        type  = "GENERAL"
      }
      
      env {
        key   = "SPACES_REGION"
        value = digitalocean_spaces_bucket.bucket.region
        type  = "GENERAL"
      }
      
      env {
        key   = "SPACES_ENDPOINT"
        value = digitalocean_spaces_bucket.bucket.endpoint
        type  = "GENERAL"
      }
    }
    
    # Ingress rules
    ingress {
      rule {
        component {
          name = "api"
        }
        match {
          path {
            prefix = "/"
          }
        }
      }
    }
    
    # Alerts
    alert {
      rule = "DEPLOYMENT_FAILED"
    }
    
    alert {
      rule = "DOMAIN_FAILED"
    }
  }
}

# Monitoring Alert Policies
resource "digitalocean_monitor_alert" "cpu_alert" {
  alerts {
    email = var.alert_emails
    slack {
      channel = var.slack_channel
      url     = var.slack_webhook_url
    }
  }
  window      = "5m"
  type        = "v1/insights/droplet/cpu"
  compare     = "GreaterThan"
  value       = var.cpu_alert_threshold
  enabled     = true
  entities    = [digitalocean_app.app.id]
  description = "Alert when CPU usage exceeds ${var.cpu_alert_threshold}%"
}

resource "digitalocean_monitor_alert" "memory_alert" {
  alerts {
    email = var.alert_emails
    slack {
      channel = var.slack_channel
      url     = var.slack_webhook_url
    }
  }
  window      = "5m"
  type        = "v1/insights/droplet/memory_utilization_percent"
  compare     = "GreaterThan"
  value       = var.memory_alert_threshold
  enabled     = true
  entities    = [digitalocean_app.app.id]
  description = "Alert when memory usage exceeds ${var.memory_alert_threshold}%"
}

resource "digitalocean_monitor_alert" "database_cpu_alert" {
  alerts {
    email = var.alert_emails
    slack {
      channel = var.slack_channel
      url     = var.slack_webhook_url
    }
  }
  window      = "5m"
  type        = "v1/insights/dbaas/cpu"
  compare     = "GreaterThan"
  value       = var.db_cpu_alert_threshold
  enabled     = true
  entities    = [digitalocean_database_cluster.postgres.id]
  description = "Alert when database CPU usage exceeds ${var.db_cpu_alert_threshold}%"
}

# Project to organize resources
resource "digitalocean_project" "project" {
  name        = "${var.name}-project"
  description = "Project for ${var.name} infrastructure"
  purpose     = var.project_purpose
  environment = var.environment
  
  resources = concat(
    [digitalocean_app.app.urn],
    [digitalocean_database_cluster.postgres.urn],
    var.enable_redis ? [digitalocean_database_cluster.redis[0].urn] : [],
    [digitalocean_spaces_bucket.bucket.urn],
    [digitalocean_container_registry.registry.urn]
  )
}
