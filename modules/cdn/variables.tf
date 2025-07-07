variable "cloud_provider" {
  description = "Cloud provider (aws, gcp, azure, digitalocean)"
  type        = string
  validation {
    condition     = contains(["aws", "gcp", "azure", "digitalocean"], var.cloud_provider)
    error_message = "Cloud provider must be one of: aws, gcp, azure, digitalocean"
  }
}

variable "name" {
  description = "Name of the CDN distribution"
  type        = string
}

variable "origin_domain_name" {
  description = "Origin domain name"
  type        = string
}

variable "origin_protocol" {
  description = "Origin protocol (http-only, https-only, match-viewer)"
  type        = string
  default     = "https-only"
}

variable "origin_path" {
  description = "Origin path"
  type        = string
  default     = ""
}

variable "custom_domain_names" {
  description = "Custom domain names for the CDN"
  type        = list(string)
  default     = []
}

variable "certificate_arn" {
  description = "SSL certificate ARN/ID for custom domains"
  type        = string
  default     = ""
}

variable "price_class" {
  description = "Price class for CDN distribution"
  type        = string
  default     = "PriceClass_100"  # AWS default for US, Canada, Europe
}

variable "default_root_object" {
  description = "Default root object"
  type        = string
  default     = "index.html"
}

variable "enable_compression" {
  description = "Enable compression"
  type        = bool
  default     = true
}

variable "viewer_protocol_policy" {
  description = "Viewer protocol policy (allow-all, https-only, redirect-to-https)"
  type        = string
  default     = "redirect-to-https"
}

variable "allowed_methods" {
  description = "Allowed HTTP methods"
  type        = list(string)
  default     = ["GET", "HEAD", "OPTIONS"]
}

variable "cached_methods" {
  description = "Cached HTTP methods"
  type        = list(string)
  default     = ["GET", "HEAD"]
}

variable "default_ttl" {
  description = "Default TTL in seconds"
  type        = number
  default     = 86400  # 24 hours
}

variable "max_ttl" {
  description = "Maximum TTL in seconds"
  type        = number
  default     = 31536000  # 365 days
}

variable "min_ttl" {
  description = "Minimum TTL in seconds"
  type        = number
  default     = 0
}

variable "geo_restriction_type" {
  description = "Geo restriction type (none, whitelist, blacklist)"
  type        = string
  default     = "none"
}

variable "geo_restriction_locations" {
  description = "Geo restriction locations (country codes)"
  type        = list(string)
  default     = []
}

variable "enable_logging" {
  description = "Enable access logging"
  type        = bool
  default     = true
}

variable "log_bucket" {
  description = "S3 bucket for logs"
  type        = string
  default     = ""
}

variable "enable_waf" {
  description = "Enable WAF"
  type        = bool
  default     = false
}

variable "waf_acl_id" {
  description = "WAF ACL ID"
  type        = string
  default     = ""
}

variable "custom_error_responses" {
  description = "Custom error response configurations"
  type = list(object({
    error_code         = number
    response_code      = number
    response_page_path = string
    error_caching_ttl  = number
  }))
  default = []
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
