
variable "tags" {
  description = "A map of tags to assign to the resources."
  type        = map(string)
  default     = {}
}

variable "postgres_maintenance_day" {
  description = "The day of the week for PostgreSQL maintenance."
  type        = string
  default     = "sunday"
}

variable "postgres_maintenance_hour" {
  description = "The hour of the day for PostgreSQL maintenance."
  type        = string
  default     = "03:00:00"
}

variable "postgres_backup_hour" {
  description = "The hour of the day for PostgreSQL backups."
  type        = string
  default     = "02:00"
}

variable "postgres_backup_minute" {
  description = "The minute of the hour for PostgreSQL backups."
  type        = string
  default     = "00"
}
