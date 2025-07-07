output "endpoint" {
  description = "Database endpoint"
  value = coalesce(
    try(module.aws_rds[0].endpoint, ""),
    try(module.gcp_cloud_sql[0].connection_name, ""),
    try(module.azure_postgres[0].fqdn, ""),
    try(module.do_database[0].host, "")
  )
}

output "port" {
  description = "Database port"
  value = 5432
}

output "database_name" {
  description = "Database name"
  value = var.database_name
}

output "username" {
  description = "Master username"
  value = var.master_username
}

output "password_secret_arn" {
  description = "ARN/ID of the secret containing the password"
  value = coalesce(
    try(module.aws_rds[0].password_secret_arn, ""),
    try(module.gcp_cloud_sql[0].password_secret_id, ""),
    try(module.azure_postgres[0].password_secret_id, ""),
    ""
  )
}

output "instance_id" {
  description = "Database instance ID"
  value = coalesce(
    try(module.aws_rds[0].instance_id, ""),
    try(module.gcp_cloud_sql[0].instance_name, ""),
    try(module.azure_postgres[0].server_id, ""),
    try(module.do_database[0].cluster_id, "")
  )
}

output "security_group_id" {
  description = "Security group ID"
  value = coalesce(
    try(module.aws_rds[0].security_group_id, ""),
    try(module.azure_postgres[0].network_security_group_id, ""),
    ""
  )
}

output "connection_string" {
  description = "Database connection string (without password)"
  value = "postgresql://${var.master_username}@${coalesce(
    try(module.aws_rds[0].endpoint, ""),
    try(module.gcp_cloud_sql[0].public_ip, ""),
    try(module.azure_postgres[0].fqdn, ""),
    try(module.do_database[0].host, "")
  )}:5432/${var.database_name}"
  sensitive = true
}
