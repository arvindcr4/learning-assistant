variable "cloud_provider" {
  description = "Cloud provider (aws, gcp, azure, digitalocean)"
  type        = string
  validation {
    condition     = contains(["aws", "gcp", "azure", "digitalocean"], var.cloud_provider)
    error_message = "Cloud provider must be one of: aws, gcp, azure, digitalocean"
  }
}

variable "domain_name" {
  description = "Primary domain name for the certificate"
  type        = string
}

variable "subject_alternative_names" {
  description = "Subject alternative names (SANs)"
  type        = list(string)
  default     = []
}

variable "validation_method" {
  description = "Validation method (DNS or EMAIL)"
  type        = string
  default     = "DNS"
  validation {
    condition     = contains(["DNS", "EMAIL"], var.validation_method)
    error_message = "Validation method must be DNS or EMAIL"
  }
}

variable "key_algorithm" {
  description = "Key algorithm for the certificate"
  type        = string
  default     = "RSA_2048"
}

variable "transparency_logging" {
  description = "Enable certificate transparency logging"
  type        = bool
  default     = true
}

variable "auto_renew" {
  description = "Enable automatic renewal"
  type        = bool
  default     = true
}

variable "dns_zone_id" {
  description = "DNS zone ID for automatic validation"
  type        = string
  default     = ""
}

variable "email_addresses" {
  description = "Email addresses for EMAIL validation"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
