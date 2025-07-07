# AWS ElastiCache
module "aws_elasticache" {
  source = "./aws"
  count  = var.cloud_provider == "aws" ? 1 : 0

  replication_group_id     = var.name
  node_type               = var.node_type
  engine_version          = var.engine_version
  port                    = var.port
  num_cache_nodes         = var.num_cache_nodes
  automatic_failover_enabled = var.automatic_failover_enabled
  multi_az_enabled        = var.multi_az_enabled
  at_rest_encryption_enabled = var.at_rest_encryption_enabled
  transit_encryption_enabled = var.transit_encryption_enabled
  auth_token              = var.auth_token_enabled
  snapshot_retention_limit = var.snapshot_retention_limit
  snapshot_window         = var.snapshot_window
  maintenance_window      = var.maintenance_window
  subnet_ids              = var.subnet_ids
  vpc_id                  = var.vpc_id
  allowed_cidr_blocks     = var.allowed_cidr_blocks
  tags                    = var.tags
}

# GCP Memorystore
module "gcp_memorystore" {
  source = "./gcp"
  count  = var.cloud_provider == "gcp" ? 1 : 0

  instance_id             = var.name
  tier                    = var.num_cache_nodes > 1 ? "STANDARD_HA" : "BASIC"
  redis_version           = "REDIS_${replace(var.engine_version, ".", "_")}"
  memory_size_gb          = 1  # Calculate based on node_type
  auth_enabled            = var.auth_token_enabled
  transit_encryption_mode = var.transit_encryption_enabled ? "SERVER_AUTHENTICATION" : "DISABLED"
  authorized_network      = var.vpc_id
  tags                    = var.tags
}

# Azure Cache for Redis
module "azure_redis" {
  source = "./azure"
  count  = var.cloud_provider == "azure" ? 1 : 0

  cache_name              = var.name
  sku_name                = var.node_type
  family                  = "C"  # or "P" for premium
  capacity                = 1    # Adjust based on node_type
  enable_non_ssl_port     = !var.transit_encryption_enabled
  redis_version           = var.engine_version
  subnet_id               = length(var.subnet_ids) > 0 ? var.subnet_ids[0] : ""
  tags                    = var.tags
}

# DigitalOcean Managed Redis
module "do_redis" {
  source = "./digitalocean"
  count  = var.cloud_provider == "digitalocean" ? 1 : 0

  name                = var.name
  size                = var.node_type
  region              = "nyc3"  # Use a variable if needed
  version             = var.engine_version
  eviction_policy     = "allkeys-lru"
  private_networking  = true
}
