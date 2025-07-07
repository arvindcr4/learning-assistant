output "cdn_domain_name" {
  description = "CDN domain name"
  value = coalesce(
    try(module.aws_cloudfront[0].domain_name, ""),
    try(module.gcp_cloud_cdn[0].cdn_ip, ""),
    try(module.azure_cdn[0].endpoint_hostname, ""),
    try(module.do_cdn[0].endpoint, "")
  )
}

output "cdn_url" {
  description = "CDN URL"
  value = "https://${coalesce(
    try(module.aws_cloudfront[0].domain_name, ""),
    try(module.gcp_cloud_cdn[0].cdn_ip, ""),
    try(module.azure_cdn[0].endpoint_hostname, ""),
    try(module.do_cdn[0].endpoint, "")
  )}"
}

output "distribution_id" {
  description = "CDN distribution ID"
  value = coalesce(
    try(module.aws_cloudfront[0].distribution_id, ""),
    try(module.gcp_cloud_cdn[0].backend_service_id, ""),
    try(module.azure_cdn[0].profile_id, ""),
    try(module.do_cdn[0].cdn_id, "")
  )
}

output "distribution_arn" {
  description = "CDN distribution ARN/ID"
  value = coalesce(
    try(module.aws_cloudfront[0].distribution_arn, ""),
    try(module.azure_cdn[0].endpoint_id, ""),
    ""
  )
}

output "custom_domain_names" {
  description = "Custom domain names"
  value = var.custom_domain_names
}

output "origin_access_identity" {
  description = "Origin access identity for S3"
  value = coalesce(
    try(module.aws_cloudfront[0].origin_access_identity, ""),
    ""
  )
}
