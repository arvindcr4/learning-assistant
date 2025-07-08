
variable "location" {
  description = "The Azure region to deploy the resources in."
  type        = string
}

variable "psql_admin_password" {
  description = "The administrator password for the PostgreSQL server."
  type        = string
  sensitive   = true
}
