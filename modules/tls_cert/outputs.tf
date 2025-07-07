output "certificate_arn" {
  description = "Certificate ARN/ID"
  value = coalesce(
    try(module.aws_acm[0].certificate_arn, ""),
    try(module.gcp_cert[0].certificate_id, ""),
    try(module.azure_cert[0].certificate_id, ""),
    try(module.do_cert[0].certificate_id, "")
  )
}

output "certificate_domain" {
  description = "Certificate domain name"
  value = var.domain_name
}

output "subject_alternative_names" {
  description = "Subject alternative names"
  value = var.subject_alternative_names
}

output "validation_records" {
  description = "DNS validation records"
  value = coalesce(
    try(module.aws_acm[0].domain_validation_options, []),
    try(module.gcp_cert[0].domain_validation_records, []),
    []
  )
}

output "certificate_status" {
  description = "Certificate status"
  value = coalesce(
    try(module.aws_acm[0].status, ""),
    try(module.gcp_cert[0].status, ""),
    try(module.azure_cert[0].provisioning_state, ""),
    ""
  )
}

output "expiration_date" {
  description = "Certificate expiration date"
  value = coalesce(
    try(module.aws_acm[0].expiration_date, ""),
    try(module.gcp_cert[0].expiration_time, ""),
    try(module.azure_cert[0].expiration_date, ""),
    ""
  )
}
