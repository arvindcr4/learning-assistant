# Development Environment Configuration
# This file contains configuration optimized for development environments
# with minimal resources to reduce costs while maintaining functionality

# ================================================================
# ENVIRONMENT CONFIGURATION
# ================================================================

environment = "development"
project_name = "learning-assistant"
region = "nyc3"

# ================================================================
# APPLICATION CONFIGURATION
# ================================================================

# Minimal application resources for development
app_instance_count = 1
app_instance_size = "basic-xxs"
app_min_instances = 1
app_max_instances = 2
autoscaling_cpu_percent = 80

# ================================================================
# DATABASE CONFIGURATION
# ================================================================

# Minimal database setup for development
postgres_version = "15"
db_size = "db-s-1vcpu-1gb"
db_node_count = 1
enable_db_replica = false
enable_analytics_db = false

# Database maintenance (less critical for development)
db_maintenance_day = "sunday"
db_maintenance_hour = "06:00"

# ================================================================
# STORAGE CONFIGURATION
# ================================================================

# Basic storage configuration
spaces_region = "nyc3"
registry_tier = "starter"

# ================================================================
# CDN CONFIGURATION
# ================================================================

# Shorter cache TTL for development (more frequent updates)
cdn_ttl = 300

# ================================================================
# FEATURE FLAGS
# ================================================================

# Enable core features for development testing
enable_analytics = true
enable_recommendations = true
enable_chat = false

# ================================================================
# MONITORING CONFIGURATION
# ================================================================

# Higher alert thresholds for development
cpu_alert_threshold = 90
memory_alert_threshold = 95
db_cpu_alert_threshold = 85

# ================================================================
# NETWORKING CONFIGURATION
# ================================================================

# Development VPC configuration
vpc_ip_range = "10.0.0.0/16"

# More permissive IP ranges for development (adjust as needed)
allowed_ip_ranges = [
  "0.0.0.0/0"  # Note: Restrict this in production
]

# ================================================================
# DNS CONFIGURATION
# ================================================================

# Typically don't manage DNS for development
manage_dns = false

# ================================================================
# COST OPTIMIZATION
# ================================================================

# Additional tags for cost tracking
additional_tags = [
  "environment:development",
  "cost-center:engineering",
  "auto-shutdown:enabled",
  "team:development"
]

# ================================================================
# NOTES
# ================================================================

# Development environment considerations:
# - Single application instance to reduce costs
# - Minimal database configuration
# - No database replica for cost savings
# - Shorter CDN TTL for frequent updates
# - Higher alert thresholds to reduce noise
# - Basic container registry tier
# - Permissive security settings (adjust as needed)

# Expected monthly cost: $50-100
# Suitable for: Individual development, feature testing, experimentation