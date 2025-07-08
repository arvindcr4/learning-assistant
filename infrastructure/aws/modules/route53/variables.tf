# Route 53 Module Variables

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "domain_name" {
  description = "Domain name for the hosted zone"
  type        = string
}

variable "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  type        = string
}

variable "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID for Route 53 resolver config"
  type        = string
  default     = ""
}

variable "enable_health_check" {
  description = "Enable Route 53 health check"
  type        = bool
  default     = true
}

variable "health_check_path" {
  description = "Path for health check"
  type        = string
  default     = "/api/health"
}

variable "api_health_check_path" {
  description = "Path for API health check"
  type        = string
  default     = "/api/health"
}

variable "create_api_subdomain" {
  description = "Create API subdomain"
  type        = bool
  default     = true
}

variable "additional_subdomains" {
  description = "Map of additional subdomains to create"
  type        = map(string)
  default     = {}
}

variable "create_mx_record" {
  description = "Create MX record for email"
  type        = bool
  default     = false
}

variable "mx_records" {
  description = "List of MX records"
  type        = list(string)
  default     = []
}

variable "txt_records" {
  description = "Map of TXT records"
  type        = map(string)
  default     = {}
}

variable "create_caa_record" {
  description = "Create CAA record"
  type        = bool
  default     = true
}

variable "caa_records" {
  description = "List of CAA records"
  type        = list(string)
  default     = [
    "0 issue \"amazon.com\"",
    "0 issue \"amazontrust.com\"",
    "0 issue \"awstrust.com\"",
    "0 issue \"amazonaws.com\""
  ]
}

variable "enable_query_logging" {
  description = "Enable Route 53 query logging"
  type        = bool
  default     = false
}

variable "enable_dnssec" {
  description = "Enable DNSSEC"
  type        = bool
  default     = false
}

variable "alarm_actions" {
  description = "List of alarm actions"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}