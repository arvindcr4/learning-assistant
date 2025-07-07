# AWS S3
module "aws_s3" {
  source = "./aws"
  count  = var.cloud_provider == "aws" ? 1 : 0

  bucket_name              = var.bucket_name
  force_destroy           = var.force_destroy
  versioning_enabled      = var.versioning
  lifecycle_rules         = var.lifecycle_rules
  default_encryption      = var.encryption_enabled
  kms_master_key_id      = var.kms_key_id
  block_public_acls      = var.public_access_block
  block_public_policy    = var.public_access_block
  ignore_public_acls     = var.public_access_block
  restrict_public_buckets = var.public_access_block
  cors_rules             = var.cors_rules
  logging_enabled        = var.enable_logging
  target_bucket          = var.log_bucket
  target_prefix          = var.log_prefix
  replication_configuration = var.replication_configuration
  website_configuration  = var.website_configuration
  tags                   = var.tags
}

# GCP Cloud Storage
module "gcp_gcs" {
  source = "./gcp"
  count  = var.cloud_provider == "gcp" ? 1 : 0

  bucket_name            = var.bucket_name
  force_destroy         = var.force_destroy
  versioning_enabled    = var.versioning
  lifecycle_rules       = var.lifecycle_rules
  storage_class         = var.storage_class
  encryption_key_name   = var.kms_key_id
  uniform_bucket_level_access = var.public_access_block
  cors                  = var.cors_rules
  logging_enabled       = var.enable_logging
  log_bucket           = var.log_bucket
  log_object_prefix    = var.log_prefix
  website_configuration = var.website_configuration
  labels               = var.tags
}

# Azure Blob Storage
module "azure_blob" {
  source = "./azure"
  count  = var.cloud_provider == "azure" ? 1 : 0

  storage_account_name   = replace(var.bucket_name, "-", "")
  container_name         = var.bucket_name
  account_tier          = "Standard"
  account_replication_type = "LRS"
  enable_https_traffic_only = true
  enable_blob_encryption = var.encryption_enabled
  blob_versioning_enabled = var.versioning
  blob_delete_retention_days = 7
  cors_rules            = var.cors_rules
  lifecycle_rules       = var.lifecycle_rules
  static_website        = var.website_configuration
  tags                  = var.tags
}

# DigitalOcean Spaces
module "do_spaces" {
  source = "./digitalocean"
  count  = var.cloud_provider == "digitalocean" ? 1 : 0

  bucket_name           = var.bucket_name
  region               = "nyc3"  # Use a variable if needed
  force_destroy        = var.force_destroy
  versioning_enabled   = var.versioning
  cors_rules          = var.cors_rules
}
