# AWS RDS
module "aws_rds" {
  source = "./aws"
  count  = var.cloud_provider == "aws" ? 1 : 0

  name                     = var.name
  engine_version          = var.engine_version
  instance_class          = var.instance_class
  allocated_storage       = var.allocated_storage
  storage_type            = var.storage_type
  database_name           = var.database_name
  master_username         = var.master_username
  master_password         = var.master_password
  backup_retention_period = var.backup_retention_period
  backup_window           = var.backup_window
  maintenance_window      = var.maintenance_window
  multi_az                = var.multi_az
  publicly_accessible     = var.publicly_accessible
  vpc_id                  = var.vpc_id
  subnet_ids              = var.subnet_ids
  allowed_cidr_blocks     = var.allowed_cidr_blocks
  enable_deletion_protection = var.enable_deletion_protection
  enable_encryption_at_rest  = var.enable_encryption
  performance_insights_enabled = var.performance_insights_enabled
  enable_logging          = var.enable_logging
  tags                    = var.tags
}

# GCP Cloud SQL
module "gcp_cloud_sql" {
  source = "./gcp"
  count  = var.cloud_provider == "gcp" ? 1 : 0

  db_instance_name        = var.name
  database_version        = var.engine_version
  instance_type           = var.instance_class
  storage_gb              = var.allocated_storage
  database_name           = var.database_name
  master_username         = var.master_username
  master_password         = var.master_password
  backup_retention_period = var.backup_retention_period
  maintenance_window      = var.maintenance_window
  authorized_networks     = var.allowed_cidr_blocks
  private_ip              = var.multi_az
  enable_deletion_protection = var.enable_deletion_protection
  enable_encryption       = var.enable_encryption
  tags                    = var.tags
}

# Azure Database for PostgreSQL
module "azure_postgres" {
  source = "./azure"
  count  = var.cloud_provider == "azure" ? 1 : 0

  server_name             = var.name
  server_version          = var.engine_version
  sku_name                = var.instance_class
  storage_mb              = var.allocated_storage
  database_name           = var.database_name
  admin_username          = var.master_username
  admin_password          = var.master_password
  backup_retention_days   = var.backup_retention_period
  geo_redundant_backup    = var.multi_az
  public_network_access   = var.publicly_accessible
  virtual_network_rule    = var.vpc_id
  subnet_ids              = var.subnet_ids
  tags                    = var.tags
}

# DigitalOcean Managed Database
module "do_database" {
  source = "./digitalocean"
  count  = var.cloud_provider == "digitalocean" ? 1 : 0

  name          = var.name
  engine_version = var.engine_version
  size          = var.instance_class
  region        = "nyc3"  # use a variable if needed
  private_networking = var.multi_az
}
