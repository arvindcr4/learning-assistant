# CloudWatch Module Variables

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "cluster_name" {
  description = "Name of the ECS cluster"
  type        = string
}

variable "service_name" {
  description = "Name of the ECS service"
  type        = string
}

variable "db_instance_identifier" {
  description = "Identifier of the RDS instance"
  type        = string
}

variable "cache_cluster_id" {
  description = "ID of the ElastiCache cluster"
  type        = string
}

variable "load_balancer_arn_suffix" {
  description = "ARN suffix of the load balancer"
  type        = string
}

variable "log_retention_days" {
  description = "Number of days to retain logs"
  type        = number
  default     = 30
}

variable "security_log_retention_days" {
  description = "Number of days to retain security logs"
  type        = number
  default     = 90
}

variable "cpu_threshold_high" {
  description = "CPU threshold for high utilization alert"
  type        = number
  default     = 80
}

variable "memory_threshold_high" {
  description = "Memory threshold for high utilization alert"
  type        = number
  default     = 80
}

variable "create_sns_topic" {
  description = "Create SNS topic for alerts"
  type        = bool
  default     = true
}

variable "alert_email" {
  description = "Email address for alerts"
  type        = string
  default     = ""
}

variable "sns_topic_arn" {
  description = "SNS topic ARN for alerts"
  type        = string
  default     = ""
}

variable "alarm_actions" {
  description = "List of alarm actions"
  type        = list(string)
  default     = []
}

variable "enable_detailed_monitoring" {
  description = "Enable detailed monitoring"
  type        = bool
  default     = true
}

variable "enable_anomaly_detection" {
  description = "Enable anomaly detection"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}