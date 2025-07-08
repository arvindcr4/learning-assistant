# ElastiCache Module Variables

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "replication_group_id" {
  description = "ID of the replication group"
  type        = string
}

variable "description" {
  description = "Description of the replication group"
  type        = string
}

variable "port" {
  description = "Port number for Redis"
  type        = number
  default     = 6379
}

variable "node_type" {
  description = "Instance type for Redis nodes"
  type        = string
  default     = "cache.t3.micro"
}

variable "num_cache_nodes" {
  description = "Number of cache nodes"
  type        = number
  default     = 1
}

variable "engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "6.2"
}

variable "parameter_group_name" {
  description = "Name of the parameter group"
  type        = string
  default     = "default.redis6.x"
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs"
  type        = list(string)
}

variable "security_group_ids" {
  description = "List of security group IDs"
  type        = list(string)
}

variable "multi_az_enabled" {
  description = "Enable Multi-AZ"
  type        = bool
  default     = true
}

variable "automatic_failover_enabled" {
  description = "Enable automatic failover"
  type        = bool
  default     = true
}

variable "snapshot_retention_limit" {
  description = "Number of days to retain snapshots"
  type        = number
  default     = 5
}

variable "snapshot_window" {
  description = "Daily time range for snapshots"
  type        = string
  default     = "03:00-05:00"
}

variable "maintenance_window" {
  description = "Weekly time range for maintenance"
  type        = string
  default     = "sun:05:00-sun:06:00"
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
  description = "Enable auth token"
  type        = bool
  default     = true
}

variable "alarm_actions" {
  description = "List of alarm actions"
  type        = list(string)
  default     = []
}

variable "enable_global_replication" {
  description = "Enable global replication"
  type        = bool
  default     = false
}

variable "global_replication_group_suffix" {
  description = "Suffix for global replication group"
  type        = string
  default     = "global"
}

variable "create_user" {
  description = "Create Redis user"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}