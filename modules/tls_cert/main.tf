# AWS ACM
module "aws_acm" {
  source = "./aws"
  count  = var.cloud_provider == "aws" ? 1 : 0

  domain_name               = var.domain_name
  subject_alternative_names = var.subject_alternative_names
  validation_method         = var.validation_method
  key_algorithm            = var.key_algorithm
  dns_zone_id              = var.dns_zone_id
  email_addresses          = var.email_addresses
  tags                     = var.tags
}

# GCP Managed Certificate
module "gcp_cert" {
  source = "./gcp"
  count  = var.cloud_provider == "gcp" ? 1 : 0

  certificate_name         = var.domain_name
  domains                  = concat([var.domain_name], var.subject_alternative_names)
  dns_authorization       = var.validation_method == "DNS"
  dns_zone_name           = var.dns_zone_id
  labels                  = var.tags
}

# Azure App Service Certificate
module "azure_cert" {
  source = "./azure"
  count  = var.cloud_provider == "azure" ? 1 : 0

  certificate_name         = var.domain_name
  domain_names            = concat([var.domain_name], var.subject_alternative_names)
  validation_method       = var.validation_method
  key_size                = var.key_algorithm == "RSA_2048" ? 2048 : 4096
  auto_renew              = var.auto_renew
  tags                    = var.tags
}

# DigitalOcean Certificate
module "do_cert" {
  source = "./digitalocean"
  count  = var.cloud_provider == "digitalocean" ? 1 : 0

  name                    = var.domain_name
  domains                 = concat([var.domain_name], var.subject_alternative_names)
  type                    = "lets_encrypt"
  dns_names               = concat([var.domain_name], var.subject_alternative_names)
}
