output "endpoint" {
  description = "Redis endpoint"
  value = coalesce(
    try(module.aws_elasticache[0].primary_endpoint, ""),
    try(module.gcp_memorystore[0].host, ""),
    try(module.azure_redis[0].hostname, ""),
    try(module.do_redis[0].host, "")
  )
}

output "port" {
  description = "Redis port"
  value = var.port
}

output "auth_token_secret_arn" {
  description = "ARN/ID of the secret containing the auth token"
  value = coalesce(
    try(module.aws_elasticache[0].auth_token_secret_arn, ""),
    try(module.gcp_memorystore[0].auth_string_secret_id, ""),
    try(module.azure_redis[0].primary_access_key_secret_id, ""),
    ""
  )
}

output "cluster_id" {
  description = "Cache cluster ID"
  value = coalesce(
    try(module.aws_elasticache[0].cluster_id, ""),
    try(module.gcp_memorystore[0].instance_id, ""),
    try(module.azure_redis[0].cache_id, ""),
    try(module.do_redis[0].cluster_id, "")
  )
}

output "configuration_endpoint" {
  description = "Configuration endpoint for cluster mode"
  value = coalesce(
    try(module.aws_elasticache[0].configuration_endpoint, ""),
    ""
  )
}

output "reader_endpoint" {
  description = "Reader endpoint"
  value = coalesce(
    try(module.aws_elasticache[0].reader_endpoint, ""),
    ""
  )
}

output "connection_string" {
  description = "Redis connection string format"
  value = "redis://${coalesce(
    try(module.aws_elasticache[0].primary_endpoint, ""),
    try(module.gcp_memorystore[0].host, ""),
    try(module.azure_redis[0].hostname, ""),
    try(module.do_redis[0].host, "")
  )}:${var.port}"
  sensitive = true
}
