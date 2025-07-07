# AWS Route53
module "aws_route53" {
  source = "./aws"
  count  = var.cloud_provider == "aws" ? 1 : 0

  zone_name          = var.domain_name
  private_zone       = var.private_zone
  vpc_id            = var.vpc_id
  records           = var.records
  alias_records     = var.alias_records
  mx_records        = var.mx_records
  txt_records       = var.txt_records
  srv_records       = var.srv_records
  enable_dnssec     = var.enable_dnssec
  tags              = var.tags
}

# GCP Cloud DNS
module "gcp_cloud_dns" {
  source = "./gcp"
  count  = var.cloud_provider == "gcp" ? 1 : 0

  dns_name          = var.domain_name
  visibility        = var.private_zone ? "private" : "public"
  private_visibility_config = var.private_zone ? {
    networks = [{
      network_url = var.vpc_id
    }]
  } : null
  records           = var.records
  enable_dnssec     = var.enable_dnssec
  labels            = var.tags
}

# Azure DNS
module "azure_dns" {
  source = "./azure"
  count  = var.cloud_provider == "azure" ? 1 : 0

  zone_name         = var.domain_name
  private_zone      = var.private_zone
  virtual_network_id = var.vpc_id
  records           = var.records
  mx_records        = var.mx_records
  txt_records       = var.txt_records
  srv_records       = var.srv_records
  tags              = var.tags
}

# DigitalOcean DNS
module "do_dns" {
  source = "./digitalocean"
  count  = var.cloud_provider == "digitalocean" ? 1 : 0

  domain_name       = var.domain_name
  records           = var.records
}
