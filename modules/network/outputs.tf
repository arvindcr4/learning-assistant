output "vpc_id" {
  description = "ID of the VPC/VNet"
  value = coalesce(
    try(module.aws_vpc[0].vpc_id, ""),
    try(module.gcp_vpc[0].vpc_id, ""),
    try(module.azure_vnet[0].vnet_id, ""),
    try(module.do_vpc[0].vpc_id, "")
  )
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value = concat(
    try(module.aws_vpc[0].public_subnet_ids, []),
    try(module.gcp_vpc[0].public_subnet_ids, []),
    try(module.azure_vnet[0].public_subnet_ids, []),
    try(module.do_vpc[0].subnet_ids, [])
  )
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value = concat(
    try(module.aws_vpc[0].private_subnet_ids, []),
    try(module.gcp_vpc[0].private_subnet_ids, []),
    try(module.azure_vnet[0].private_subnet_ids, [])
  )
}

output "nat_gateway_ids" {
  description = "IDs of NAT gateways"
  value = concat(
    try(module.aws_vpc[0].nat_gateway_ids, []),
    try(module.azure_vnet[0].nat_gateway_ids, [])
  )
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC/VNet"
  value = var.cidr_block
}
