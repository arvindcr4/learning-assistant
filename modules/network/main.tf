# AWS VPC
module "aws_vpc" {
  source = "./aws"
  count  = var.cloud_provider == "aws" ? 1 : 0

  name                 = var.name
  cidr_block          = var.cidr_block
  availability_zones  = var.availability_zones
  public_subnet_cidrs = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  enable_nat_gateway  = var.enable_nat_gateway
  enable_dns_hostnames = var.enable_dns_hostnames
  tags                = var.tags
}

# GCP VPC
module "gcp_vpc" {
  source = "./gcp"
  count  = var.cloud_provider == "gcp" ? 1 : 0

  name                 = var.name
  public_subnet_cidrs = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  tags                = var.tags
}

# Azure VNet
module "azure_vnet" {
  source = "./azure"
  count  = var.cloud_provider == "azure" ? 1 : 0

  name                 = var.name
  cidr_block          = var.cidr_block
  public_subnet_cidrs = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  tags                = var.tags
}

# DigitalOcean VPC
module "do_vpc" {
  source = "./digitalocean"
  count  = var.cloud_provider == "digitalocean" ? 1 : 0

  name       = var.name
  cidr_block = var.cidr_block
}
