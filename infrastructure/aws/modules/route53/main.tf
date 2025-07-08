# Route 53 Module for Learning Assistant Application
# Provides DNS management and health checks

# Route 53 Hosted Zone
resource "aws_route53_zone" "main" {
  name = var.domain_name

  tags = var.tags
}

# A Record for the main domain
resource "aws_route53_record" "main" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}

# A Record for www subdomain
resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}

# CNAME Record for API subdomain
resource "aws_route53_record" "api" {
  count = var.create_api_subdomain ? 1 : 0

  zone_id = aws_route53_zone.main.zone_id
  name    = "api.${var.domain_name}"
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}

# Health Check for the main application
resource "aws_route53_health_check" "main" {
  count = var.enable_health_check ? 1 : 0

  fqdn                            = var.domain_name
  port                            = 443
  type                            = "HTTPS"
  resource_path                   = var.health_check_path
  failure_threshold               = 3
  request_interval                = 30
  cloudwatch_alarm_region         = data.aws_region.current.name
  cloudwatch_alarm_name           = aws_cloudwatch_metric_alarm.health_check[0].alarm_name
  insufficient_data_health_status = "Failure"

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-health-check"
    }
  )
}

# Health Check for API endpoint
resource "aws_route53_health_check" "api" {
  count = var.enable_health_check && var.create_api_subdomain ? 1 : 0

  fqdn                            = "api.${var.domain_name}"
  port                            = 443
  type                            = "HTTPS"
  resource_path                   = var.api_health_check_path
  failure_threshold               = 3
  request_interval                = 30
  cloudwatch_alarm_region         = data.aws_region.current.name
  cloudwatch_alarm_name           = aws_cloudwatch_metric_alarm.api_health_check[0].alarm_name
  insufficient_data_health_status = "Failure"

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-api-health-check"
    }
  )
}

# CloudWatch Alarm for Health Check
resource "aws_cloudwatch_metric_alarm" "health_check" {
  count = var.enable_health_check ? 1 : 0

  alarm_name          = "${var.name_prefix}-health-check-failed"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = "60"
  statistic           = "Minimum"
  threshold           = "1"
  alarm_description   = "This metric monitors the health check status"
  alarm_actions       = var.alarm_actions

  dimensions = {
    HealthCheckId = aws_route53_health_check.main[0].id
  }

  tags = var.tags
}

# CloudWatch Alarm for API Health Check
resource "aws_cloudwatch_metric_alarm" "api_health_check" {
  count = var.enable_health_check && var.create_api_subdomain ? 1 : 0

  alarm_name          = "${var.name_prefix}-api-health-check-failed"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = "60"
  statistic           = "Minimum"
  threshold           = "1"
  alarm_description   = "This metric monitors the API health check status"
  alarm_actions       = var.alarm_actions

  dimensions = {
    HealthCheckId = aws_route53_health_check.api[0].id
  }

  tags = var.tags
}

# Additional A records for other subdomains
resource "aws_route53_record" "additional" {
  for_each = var.additional_subdomains

  zone_id = aws_route53_zone.main.zone_id
  name    = "${each.key}.${var.domain_name}"
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}

# MX Record for email (if needed)
resource "aws_route53_record" "mx" {
  count = var.create_mx_record ? 1 : 0

  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "MX"
  ttl     = 300
  records = var.mx_records
}

# TXT Record for domain verification
resource "aws_route53_record" "txt" {
  for_each = var.txt_records

  zone_id = aws_route53_zone.main.zone_id
  name    = each.key == "@" ? var.domain_name : "${each.key}.${var.domain_name}"
  type    = "TXT"
  ttl     = 300
  records = [each.value]
}

# CAA Record for certificate authority authorization
resource "aws_route53_record" "caa" {
  count = var.create_caa_record ? 1 : 0

  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "CAA"
  ttl     = 300
  records = var.caa_records
}

# Query Logging Configuration
resource "aws_route53_query_log" "main" {
  count = var.enable_query_logging ? 1 : 0

  depends_on = [aws_cloudwatch_log_group.route53_query_log[0]]

  destination_arn = aws_cloudwatch_log_group.route53_query_log[0].arn
  zone_id         = aws_route53_zone.main.zone_id

  tags = var.tags
}

# CloudWatch Log Group for Route 53 Query Logging
resource "aws_cloudwatch_log_group" "route53_query_log" {
  count = var.enable_query_logging ? 1 : 0

  name              = "/aws/route53/${var.domain_name}"
  retention_in_days = 30

  tags = var.tags
}

# CloudWatch Log Group Policy for Route 53
resource "aws_cloudwatch_log_resource_policy" "route53_query_log" {
  count = var.enable_query_logging ? 1 : 0

  policy_document = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "route53.amazonaws.com"
        }
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:log-group:/aws/route53/*"
      }
    ]
  })
  policy_name = "${var.name_prefix}-route53-query-log-policy"
}

# Route 53 Resolver Config for DNS over HTTPS
resource "aws_route53_resolver_config" "main" {
  count = var.enable_dnssec ? 1 : 0

  resource_id                = var.vpc_id
  autodefined_reverse_flag   = "DISABLE"
}

# Route 53 DNSSEC Key Signing Key
resource "aws_route53_key_signing_key" "main" {
  count = var.enable_dnssec ? 1 : 0

  hosted_zone_id             = aws_route53_zone.main.id
  key_management_service_arn = aws_kms_key.dnssec[0].arn
  name                       = "${var.name_prefix}-dnssec-ksk"

  tags = var.tags
}

# KMS Key for DNSSEC
resource "aws_kms_key" "dnssec" {
  count = var.enable_dnssec ? 1 : 0

  customer_master_key_spec = "ECC_NIST_P256"
  key_usage               = "SIGN_VERIFY"
  deletion_window_in_days = 7

  tags = var.tags
}

resource "aws_kms_alias" "dnssec" {
  count = var.enable_dnssec ? 1 : 0

  name          = "alias/${var.name_prefix}-dnssec"
  target_key_id = aws_kms_key.dnssec[0].key_id
}

# Enable DNSSEC
resource "aws_route53_hosted_zone_dnssec" "main" {
  count = var.enable_dnssec ? 1 : 0

  hosted_zone_id = aws_route53_zone.main.id
  depends_on     = [aws_route53_key_signing_key.main]
}

# Data sources
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}