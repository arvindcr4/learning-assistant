variable "cloud_provider" {
  description = "Cloud provider (aws, gcp, azure, digitalocean)"
  type        = string
  validation {
    condition     = contains(["aws", "gcp", "azure", "digitalocean"], var.cloud_provider)
    error_message = "Cloud provider must be one of: aws, gcp, azure, digitalocean"
  }
}

variable "name" {
  description = "Name of the Redis cache instance"
  type        = string
}

variable "node_type" {
  description = "Node/instance type (provider-specific)"
  type        = string
  default     = "cache.t3.micro"  # AWS default
}

variable "engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "6.2"
}

variable "port" {
  description = "Redis port"
  type        = number
  default     = 6379
}

variable "num_cache_nodes" {
  description = "Number of cache nodes"
  type        = number
  default     = 1
}

variable "enable_cluster_mode" {
  description = "Enable cluster mode"
  type        = bool
  default     = false
}

variable "num_node_groups" {
  description = "Number of node groups (shards) for cluster mode"
  type        = number
  default     = 1
}

variable "replicas_per_node_group" {
  description = "Number of replica nodes per shard"
  type        = number
  default     = 1
}

variable "automatic_failover_enabled" {
  description = "Enable automatic failover"
  type        = bool
  default     = true
}

variable "multi_az_enabled" {
  description = "Enable Multi-AZ"
  type        = bool
  default     = false
}

variable "at_rest_encryption_enabled" {
  description = "Enable encryption at rest"
  type        = bool
  default     = true
}

variable "transit_encryption_enabled" {
  description = "Enable encryption in transit"
  type        = bool
  default     = true
}

variable "auth_token_enabled" {
  description = "Enable AUTH token"
  type        = bool
  default     = true
}

variable "snapshot_retention_limit" {
  description = "Number of days to retain snapshots"
  type        = number
  default     = 5
}

variable "snapshot_window" {
  description = "Daily snapshot window"
  type        = string
  default     = "03:00-05:00"
}

variable "maintenance_window" {
  description = "Weekly maintenance window"
  type        = string
  default     = "sun:05:00-sun:06:00"
}

variable "vpc_id" {
  description = "VPC/VNet ID"
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs for the cache"
  type        = list(string)
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to connect"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
