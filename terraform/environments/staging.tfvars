# Staging Environment Configuration
# This file contains configuration optimized for staging environments
# with moderate resources for testing and QA purposes

# ================================================================
# ENVIRONMENT CONFIGURATION
# ================================================================

environment = "staging"
project_name = "learning-assistant"
region = "nyc3"

# ================================================================
# APPLICATION CONFIGURATION
# ================================================================

# Moderate application resources for staging
app_instance_count = 1
app_instance_size = "basic-xs"
app_min_instances = 1
app_max_instances = 3
autoscaling_cpu_percent = 75

# ================================================================
# DATABASE CONFIGURATION
# ================================================================

# Staging database setup
postgres_version = "15"
db_size = "db-s-1vcpu-2gb"
db_node_count = 1
enable_db_replica = false
enable_analytics_db = true

# Database maintenance (less critical than production)
db_maintenance_day = "saturday"
db_maintenance_hour = "04:00"

# ================================================================
# STORAGE CONFIGURATION
# ================================================================

# Basic storage configuration
spaces_region = "nyc3"
registry_tier = "basic"

# ================================================================
# CDN CONFIGURATION
# ================================================================

# Moderate cache TTL for staging
cdn_ttl = 1800

# ================================================================
# FEATURE FLAGS
# ================================================================

# Enable all features for comprehensive testing
enable_analytics = true
enable_recommendations = true
enable_chat = true

# ================================================================
# MONITORING CONFIGURATION
# ================================================================

# Production-like alert thresholds for staging
cpu_alert_threshold = 85
memory_alert_threshold = 90
db_cpu_alert_threshold = 80

# ================================================================
# NETWORKING CONFIGURATION
# ================================================================

# Staging VPC configuration
vpc_ip_range = "10.1.0.0/16"

# Restricted IP ranges for staging (adjust as needed)
allowed_ip_ranges = [
  "0.0.0.0/0"  # Note: Restrict this for better security
]

# ================================================================
# DNS CONFIGURATION
# ================================================================

# May manage DNS for staging depending on setup
manage_dns = false

# ================================================================
# ENVIRONMENT-SPECIFIC OVERRIDES
# ================================================================

environment_config = {
  app_instance_count = 1
  app_instance_size  = "basic-xs"
  db_size           = "db-s-1vcpu-2gb"
  db_node_count     = 1
  enable_db_replica = false
  cdn_ttl           = 1800
}

# ================================================================
# COST OPTIMIZATION
# ================================================================

# Additional tags for cost tracking
additional_tags = [
  "environment:staging",
  "cost-center:engineering",
  "team:qa",
  "backup:enabled"
]

# ================================================================
# NOTES
# ================================================================

# Staging environment considerations:
# - Single application instance with limited scaling
# - Moderate database configuration
# - No database replica for cost savings
# - Analytics database enabled for testing
# - All features enabled for comprehensive testing
# - Basic container registry tier
# - Production-like monitoring thresholds
# - Moderate security settings

# Expected monthly cost: $100-200
# Suitable for: QA testing, integration testing, pre-production validation