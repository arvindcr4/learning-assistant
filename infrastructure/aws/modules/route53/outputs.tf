# Route 53 Module Outputs

output "zone_id" {
  description = "Zone ID of the hosted zone"
  value       = aws_route53_zone.main.zone_id
}

output "zone_arn" {
  description = "ARN of the hosted zone"
  value       = aws_route53_zone.main.arn
}

output "name_servers" {
  description = "Name servers for the hosted zone"
  value       = aws_route53_zone.main.name_servers
}

output "domain_name" {
  description = "Domain name of the hosted zone"
  value       = aws_route53_zone.main.name
}

output "main_record_name" {
  description = "Name of the main A record"
  value       = aws_route53_record.main.name
}

output "main_record_fqdn" {
  description = "FQDN of the main A record"
  value       = aws_route53_record.main.fqdn
}

output "www_record_name" {
  description = "Name of the www A record"
  value       = aws_route53_record.www.name
}

output "www_record_fqdn" {
  description = "FQDN of the www A record"
  value       = aws_route53_record.www.fqdn
}

output "api_record_name" {
  description = "Name of the API A record"
  value       = var.create_api_subdomain ? aws_route53_record.api[0].name : null
}

output "api_record_fqdn" {
  description = "FQDN of the API A record"
  value       = var.create_api_subdomain ? aws_route53_record.api[0].fqdn : null
}

output "health_check_id" {
  description = "ID of the main health check"
  value       = var.enable_health_check ? aws_route53_health_check.main[0].id : null
}

output "api_health_check_id" {
  description = "ID of the API health check"
  value       = var.enable_health_check && var.create_api_subdomain ? aws_route53_health_check.api[0].id : null
}

output "health_check_arn" {
  description = "ARN of the main health check"
  value       = var.enable_health_check ? aws_route53_health_check.main[0].arn : null
}

output "api_health_check_arn" {
  description = "ARN of the API health check"
  value       = var.enable_health_check && var.create_api_subdomain ? aws_route53_health_check.api[0].arn : null
}

output "cloudwatch_health_alarm_arn" {
  description = "ARN of the health check CloudWatch alarm"
  value       = var.enable_health_check ? aws_cloudwatch_metric_alarm.health_check[0].arn : null
}

output "cloudwatch_api_health_alarm_arn" {
  description = "ARN of the API health check CloudWatch alarm"
  value       = var.enable_health_check && var.create_api_subdomain ? aws_cloudwatch_metric_alarm.api_health_check[0].arn : null
}

output "query_log_id" {
  description = "ID of the query logging configuration"
  value       = var.enable_query_logging ? aws_route53_query_log.main[0].id : null
}

output "query_log_arn" {
  description = "ARN of the query logging configuration"
  value       = var.enable_query_logging ? aws_route53_query_log.main[0].arn : null
}

output "query_log_group_name" {
  description = "Name of the query logging CloudWatch log group"
  value       = var.enable_query_logging ? aws_cloudwatch_log_group.route53_query_log[0].name : null
}

output "query_log_group_arn" {
  description = "ARN of the query logging CloudWatch log group"
  value       = var.enable_query_logging ? aws_cloudwatch_log_group.route53_query_log[0].arn : null
}

output "dnssec_key_signing_key_id" {
  description = "ID of the DNSSEC key signing key"
  value       = var.enable_dnssec ? aws_route53_key_signing_key.main[0].id : null
}

output "dnssec_kms_key_id" {
  description = "ID of the DNSSEC KMS key"
  value       = var.enable_dnssec ? aws_kms_key.dnssec[0].id : null
}

output "dnssec_kms_key_arn" {
  description = "ARN of the DNSSEC KMS key"
  value       = var.enable_dnssec ? aws_kms_key.dnssec[0].arn : null
}

output "additional_records" {
  description = "Map of additional subdomain records"
  value = {
    for k, v in aws_route53_record.additional : k => {
      name = v.name
      fqdn = v.fqdn
    }
  }
}

output "txt_records" {
  description = "Map of TXT records"
  value = {
    for k, v in aws_route53_record.txt : k => {
      name = v.name
      fqdn = v.fqdn
    }
  }
}

output "mx_record_name" {
  description = "Name of the MX record"
  value       = var.create_mx_record ? aws_route53_record.mx[0].name : null
}

output "mx_record_fqdn" {
  description = "FQDN of the MX record"
  value       = var.create_mx_record ? aws_route53_record.mx[0].fqdn : null
}

output "caa_record_name" {
  description = "Name of the CAA record"
  value       = var.create_caa_record ? aws_route53_record.caa[0].name : null
}

output "caa_record_fqdn" {
  description = "FQDN of the CAA record"
  value       = var.create_caa_record ? aws_route53_record.caa[0].fqdn : null
}