# ALB Module Outputs

output "dns_name" {
  description = "DNS name of the load balancer"
  value       = aws_lb.main.dns_name
}

output "zone_id" {
  description = "Zone ID of the load balancer"
  value       = aws_lb.main.zone_id
}

output "arn" {
  description = "ARN of the load balancer"
  value       = aws_lb.main.arn
}

output "arn_suffix" {
  description = "ARN suffix of the load balancer"
  value       = aws_lb.main.arn_suffix
}

output "target_group_arn" {
  description = "ARN of the target group"
  value       = aws_lb_target_group.main.arn
}

output "target_group_arn_suffix" {
  description = "ARN suffix of the target group"
  value       = aws_lb_target_group.main.arn_suffix
}

output "target_group_name" {
  description = "Name of the target group"
  value       = aws_lb_target_group.main.name
}

output "http_listener_arn" {
  description = "ARN of the HTTP listener"
  value       = aws_lb_listener.http.arn
}

output "https_listener_arn" {
  description = "ARN of the HTTPS listener"
  value       = var.certificate_arn != "" ? aws_lb_listener.https[0].arn : null
}

output "load_balancer_id" {
  description = "ID of the load balancer"
  value       = aws_lb.main.id
}

output "load_balancer_name" {
  description = "Name of the load balancer"
  value       = aws_lb.main.name
}

output "hosted_zone_id" {
  description = "Hosted zone ID of the load balancer"
  value       = aws_lb.main.zone_id
}

output "s3_bucket_name" {
  description = "Name of the S3 bucket for ALB logs"
  value       = aws_s3_bucket.alb_logs.bucket
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket for ALB logs"
  value       = aws_s3_bucket.alb_logs.arn
}

output "cloudwatch_response_time_alarm_arn" {
  description = "ARN of the response time alarm"
  value       = aws_cloudwatch_metric_alarm.alb_response_time.arn
}

output "cloudwatch_unhealthy_hosts_alarm_arn" {
  description = "ARN of the unhealthy hosts alarm"
  value       = aws_cloudwatch_metric_alarm.alb_unhealthy_hosts.arn
}

output "cloudwatch_5xx_alarm_arn" {
  description = "ARN of the 5XX errors alarm"
  value       = aws_cloudwatch_metric_alarm.alb_http_5xx.arn
}

output "cloudwatch_4xx_alarm_arn" {
  description = "ARN of the 4XX errors alarm"
  value       = aws_cloudwatch_metric_alarm.alb_http_4xx.arn
}

output "security_group_ids" {
  description = "Security group IDs associated with the load balancer"
  value       = var.security_group_ids
}

output "subnets" {
  description = "Subnet IDs associated with the load balancer"
  value       = var.public_subnet_ids
}

output "vpc_id" {
  description = "VPC ID associated with the load balancer"
  value       = var.vpc_id
}