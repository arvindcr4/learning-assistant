variable "cloud_provider" {
  description = "Cloud provider (aws, gcp, azure, digitalocean)"
  type        = string
  validation {
    condition     = contains(["aws", "gcp", "azure", "digitalocean"], var.cloud_provider)
    error_message = "Cloud provider must be one of: aws, gcp, azure, digitalocean"
  }
}

variable "bucket_name" {
  description = "Name of the storage bucket"
  type        = string
}

variable "force_destroy" {
  description = "Allow bucket to be destroyed even if it contains objects"
  type        = bool
  default     = false
}

variable "versioning" {
  description = "Enable versioning"
  type        = bool
  default     = true
}

variable "lifecycle_rules" {
  description = "Lifecycle rules for object management"
  type = list(object({
    id                     = string
    enabled               = bool
    prefix                = string
    expiration_days       = number
    transition_storage_class = string
    transition_days       = number
  }))
  default = []
}

variable "storage_class" {
  description = "Default storage class"
  type        = string
  default     = "STANDARD"
}

variable "encryption_enabled" {
  description = "Enable server-side encryption"
  type        = bool
  default     = true
}

variable "kms_key_id" {
  description = "KMS key ID for encryption"
  type        = string
  default     = ""
}

variable "public_access_block" {
  description = "Block public access"
  type        = bool
  default     = true
}

variable "cors_rules" {
  description = "CORS rules"
  type = list(object({
    allowed_headers = list(string)
    allowed_methods = list(string)
    allowed_origins = list(string)
    expose_headers  = list(string)
    max_age_seconds = number
  }))
  default = []
}

variable "enable_logging" {
  description = "Enable access logging"
  type        = bool
  default     = true
}

variable "log_bucket" {
  description = "Target bucket for logs"
  type        = string
  default     = ""
}

variable "log_prefix" {
  description = "Prefix for log objects"
  type        = string
  default     = "logs/"
}

variable "replication_configuration" {
  description = "Cross-region replication configuration"
  type = object({
    role                     = string
    destination_bucket       = string
    destination_storage_class = string
  })
  default = null
}

variable "website_configuration" {
  description = "Static website hosting configuration"
  type = object({
    index_document = string
    error_document = string
  })
  default = null
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
