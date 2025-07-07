# AWS ECS/Fargate
module "aws_ecs" {
  source = "./aws"
  count  = var.cloud_provider == "aws" ? 1 : 0

  name                  = var.name
  image                 = var.image
  cpu                   = var.cpu
  memory                = var.memory
  port                  = var.port
  desired_count         = var.desired_count
  min_count            = var.min_count
  max_count            = var.max_count
  health_check_path    = var.health_check_path
  environment_variables = var.environment_variables
  secrets              = var.secrets
  vpc_id               = var.vpc_id
  subnet_ids           = var.subnet_ids
  tags                 = var.tags
}

# GCP Cloud Run
module "gcp_cloud_run" {
  source = "./gcp"
  count  = var.cloud_provider == "gcp" ? 1 : 0

  name                  = var.name
  image                 = var.image
  cpu                   = var.cpu
  memory                = var.memory
  port                  = var.port
  min_instances         = var.min_count
  max_instances         = var.max_count
  environment_variables = var.environment_variables
  vpc_connector_id      = var.vpc_id
  tags                  = var.tags
}

# Azure Container Instances
module "azure_container" {
  source = "./azure"
  count  = var.cloud_provider == "azure" ? 1 : 0

  name                  = var.name
  image                 = var.image
  cpu                   = var.cpu
  memory                = var.memory
  port                  = var.port
  instance_count        = var.desired_count
  environment_variables = var.environment_variables
  vnet_id              = var.vpc_id
  subnet_ids           = var.subnet_ids
  tags                 = var.tags
}

# DigitalOcean App Platform
module "do_app" {
  source = "./digitalocean"
  count  = var.cloud_provider == "digitalocean" ? 1 : 0

  name                  = var.name
  image                 = var.image
  instance_size_slug    = "basic-xxs"  # Translate from CPU/memory
  instance_count        = var.desired_count
  http_port            = var.port
  environment_variables = var.environment_variables
}
