output "service_endpoint" {
  description = "Service endpoint URL"
  value = coalesce(
    try(module.aws_ecs[0].service_endpoint, ""),
    try(module.gcp_cloud_run[0].service_endpoint, ""),
    try(module.azure_container[0].service_endpoint, ""),
    try(module.do_app[0].service_endpoint, "")
  )
}

output "service_name" {
  description = "Name of the container service"
  value = var.name
}

output "service_arn" {
  description = "ARN/ID of the container service"
  value = coalesce(
    try(module.aws_ecs[0].service_arn, ""),
    try(module.gcp_cloud_run[0].service_id, ""),
    try(module.azure_container[0].service_id, ""),
    try(module.do_app[0].app_id, "")
  )
}

output "load_balancer_endpoint" {
  description = "Load balancer endpoint if applicable"
  value = coalesce(
    try(module.aws_ecs[0].load_balancer_dns, ""),
    try(module.azure_container[0].load_balancer_ip, ""),
    ""
  )
}

output "iam_role_arn" {
  description = "IAM role ARN for the service"
  value = coalesce(
    try(module.aws_ecs[0].task_role_arn, ""),
    try(module.gcp_cloud_run[0].service_account, ""),
    try(module.azure_container[0].managed_identity_id, ""),
    ""
  )
}
