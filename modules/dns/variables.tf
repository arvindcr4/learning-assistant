variable "cloud_provider" {
  description = "Cloud provider (aws, gcp, azure, digitalocean)"
  type        = string
  validation {
    condition     = contains(["aws", "gcp", "azure", "digitalocean"], var.cloud_provider)
    error_message = "Cloud provider must be one of: aws, gcp, azure, digitalocean"
  }
}

variable "domain_name" {
  description = "Domain name for the DNS zone"
  type        = string
}

variable "private_zone" {
  description = "Create a private DNS zone"
  type        = bool
  default     = false
}

variable "vpc_id" {
  description = "VPC ID for private zone association"
  type        = string
  default     = ""
}

variable "records" {
  description = "DNS records to create"
  type = list(object({
    name    = string
    type    = string
    ttl     = number
    records = list(string)
  }))
  default = []
}

variable "alias_records" {
  description = "Alias records for cloud resources"
  type = list(object({
    name                   = string
    zone_id               = string
    target_dns_name       = string
    evaluate_target_health = bool
  }))
  default = []
}

variable "mx_records" {
  description = "MX records"
  type = list(object({
    name     = string
    ttl      = number
    priority = number
    value    = string
  }))
  default = []
}

variable "txt_records" {
  description = "TXT records"
  type = list(object({
    name   = string
    ttl    = number
    values = list(string)
  }))
  default = []
}

variable "srv_records" {
  description = "SRV records"
  type = list(object({
    name     = string
    ttl      = number
    priority = number
    weight   = number
    port     = number
    target   = string
  }))
  default = []
}

variable "enable_dnssec" {
  description = "Enable DNSSEC"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
