output "bucket_name" {
  description = "Name of the bucket"
  value       = var.bucket_name
}

output "bucket_arn" {
  description = "ARN/ID of the bucket"
  value = coalesce(
    try(module.aws_s3[0].bucket_arn, ""),
    try(module.gcp_gcs[0].bucket_url, ""),
    try(module.azure_blob[0].storage_account_id, ""),
    try(module.do_spaces[0].bucket_urn, "")
  )
}

output "bucket_domain_name" {
  description = "Domain name of the bucket"
  value = coalesce(
    try(module.aws_s3[0].bucket_domain_name, ""),
    try(module.gcp_gcs[0].bucket_domain_name, ""),
    try(module.azure_blob[0].primary_blob_endpoint, ""),
    try(module.do_spaces[0].bucket_domain_name, "")
  )
}

output "bucket_regional_domain_name" {
  description = "Regional domain name of the bucket"
  value = coalesce(
    try(module.aws_s3[0].bucket_regional_domain_name, ""),
    try(module.gcp_gcs[0].bucket_domain_name, ""),
    try(module.azure_blob[0].primary_blob_endpoint, ""),
    try(module.do_spaces[0].bucket_domain_name, "")
  )
}

output "website_endpoint" {
  description = "Website endpoint if static hosting is enabled"
  value = coalesce(
    try(module.aws_s3[0].website_endpoint, ""),
    try(module.gcp_gcs[0].website_endpoint, ""),
    try(module.azure_blob[0].static_website_endpoint, ""),
    ""
  )
}

output "access_key_id" {
  description = "Access key ID for bucket access"
  value = coalesce(
    try(module.aws_s3[0].access_key_id, ""),
    try(module.do_spaces[0].access_key_id, ""),
    ""
  )
  sensitive = true
}

output "secret_access_key" {
  description = "Secret access key for bucket access"
  value = coalesce(
    try(module.aws_s3[0].secret_access_key, ""),
    try(module.do_spaces[0].secret_access_key, ""),
    ""
  )
  sensitive = true
}

output "service_account" {
  description = "Service account for bucket access (GCP)"
  value = try(module.gcp_gcs[0].service_account_email, "")
}

output "connection_string" {
  description = "Connection string for the storage account (Azure)"
  value = try(module.azure_blob[0].primary_connection_string, "")
  sensitive = true
}
