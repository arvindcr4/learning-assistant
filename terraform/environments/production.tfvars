# Production Environment Configuration
# This file contains configuration optimized for production environments
# with high availability, performance, and security

# ================================================================
# ENVIRONMENT CONFIGURATION
# ================================================================

environment = "production"
project_name = "learning-assistant"
region = "nyc3"

# ================================================================
# APPLICATION CONFIGURATION
# ================================================================

# High availability application configuration
app_instance_count = 3
app_instance_size = "basic-m"
app_min_instances = 2
app_max_instances = 10
autoscaling_cpu_percent = 70

# ================================================================
# DATABASE CONFIGURATION
# ================================================================

# Production database setup with high availability
postgres_version = "15"
db_size = "db-s-4vcpu-8gb"
db_node_count = 3
enable_db_replica = true
replica_region = "sfo3"
enable_analytics_db = true

# Database maintenance (off-peak hours)
db_maintenance_day = "sunday"
db_maintenance_hour = "02:00"

# ================================================================
# STORAGE CONFIGURATION
# ================================================================

# Production storage configuration
spaces_region = "nyc3"
registry_tier = "professional"

# ================================================================
# CDN CONFIGURATION
# ================================================================

# Longer cache TTL for production performance
cdn_ttl = 86400

# ================================================================
# FEATURE FLAGS
# ================================================================

# Enable all features for production
enable_analytics = true
enable_recommendations = true
enable_chat = true

# ================================================================
# MONITORING CONFIGURATION
# ================================================================

# Strict alert thresholds for production
cpu_alert_threshold = 80
memory_alert_threshold = 85
db_cpu_alert_threshold = 75

# ================================================================
# NETWORKING CONFIGURATION
# ================================================================

# Production VPC configuration
vpc_ip_range = "10.2.0.0/16"

# Restricted IP ranges for production security
allowed_ip_ranges = [
  # Add your specific IP ranges here
  # "123.456.789.0/24",  # Office network
  # "987.654.321.0/32",  # Admin IP
  "0.0.0.0/0"  # TODO: Restrict this in production
]

# ================================================================
# DNS CONFIGURATION
# ================================================================

# Manage DNS for production
manage_dns = true

# ================================================================
# ENVIRONMENT-SPECIFIC OVERRIDES
# ================================================================

environment_config = {
  app_instance_count = 3
  app_instance_size  = "basic-m"
  db_size           = "db-s-4vcpu-8gb"
  db_node_count     = 3
  enable_db_replica = true
  cdn_ttl           = 86400
}

# ================================================================
# COST OPTIMIZATION
# ================================================================

# Additional tags for cost tracking and management
additional_tags = [
  "environment:production",
  "cost-center:product",
  "team:engineering",
  "backup:enabled",
  "monitoring:enabled",
  "high-availability:enabled"
]

# ================================================================
# SECURITY CONFIGURATION
# ================================================================

# Production security considerations are handled in main configuration
# Additional security measures:
# - VPC isolation enabled
# - Database firewall rules
# - SSL/TLS encryption
# - Secure environment variables
# - Access key rotation

# ================================================================
# DISASTER RECOVERY
# ================================================================

# Disaster recovery features enabled:
# - Database replicas in different regions
# - Automated backups
# - Multi-region object storage
# - Monitoring and alerting
# - Infrastructure as Code

# ================================================================
# NOTES
# ================================================================

# Production environment considerations:
# - Multiple application instances for high availability
# - Clustered database with replicas
# - Professional container registry
# - All features enabled
# - Strict monitoring thresholds
# - DNS management enabled
# - Enhanced security settings
# - Disaster recovery capabilities

# Expected monthly cost: $300-600
# Suitable for: Live production traffic, customer-facing applications

# ================================================================
# SCALING CONSIDERATIONS
# ================================================================

# For high-traffic production environments, consider:
# - Increasing app_max_instances to 20+
# - Using larger database instances (db-s-8vcpu-32gb)
# - Adding more database nodes
# - Implementing multiple regions
# - Using dedicated load balancers
# - Advanced monitoring and alerting