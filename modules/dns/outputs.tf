output "zone_id" {
  description = "DNS zone ID"
  value = coalesce(
    try(module.aws_route53[0].zone_id, ""),
    try(module.gcp_cloud_dns[0].zone_id, ""),
    try(module.azure_dns[0].zone_id, ""),
    try(module.do_dns[0].domain_urn, "")
  )
}

output "name_servers" {
  description = "Name servers for the DNS zone"
  value = concat(
    try(module.aws_route53[0].name_servers, []),
    try(module.gcp_cloud_dns[0].name_servers, []),
    try(module.azure_dns[0].name_servers, []),
    try(module.do_dns[0].name_servers, [])
  )
}

output "zone_name" {
  description = "DNS zone name"
  value = var.domain_name
}

output "records" {
  description = "Created DNS records"
  value = var.records
}

output "is_private" {
  description = "Whether this is a private DNS zone"
  value = var.private_zone
}
