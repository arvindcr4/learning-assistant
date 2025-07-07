variable "psql_admin_password" {
  description = "The administrator password for the PostgreSQL server."
  type        = string
  sensitive   = true
}