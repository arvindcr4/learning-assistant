# VPC Module for Multi-Cloud Infrastructure
# Supports AWS, GCP, and Azure with consistent interface

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

# Local variables for consistent naming and tagging
locals {
  common_tags = merge(
    var.tags,
    {
      Module      = "networking/vpc"
      Environment = var.environment
      Project     = var.project_name
      ManagedBy   = "terraform"
    }
  )
  
  name_prefix = "${var.project_name}-${var.environment}"
}

# AWS VPC Resources
resource "aws_vpc" "main" {
  count = var.cloud_provider == "aws" ? 1 : 0
  
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-vpc"
  })
}

resource "aws_internet_gateway" "main" {
  count = var.cloud_provider == "aws" ? 1 : 0
  
  vpc_id = aws_vpc.main[0].id
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-igw"
  })
}

resource "aws_subnet" "public" {
  count = var.cloud_provider == "aws" ? length(var.public_subnets) : 0
  
  vpc_id                  = aws_vpc.main[0].id
  cidr_block              = var.public_subnets[count.index]
  availability_zone       = data.aws_availability_zones.available[0].names[count.index]
  map_public_ip_on_launch = true
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public-subnet-${count.index + 1}"
    Type = "Public"
  })
}

resource "aws_subnet" "private" {
  count = var.cloud_provider == "aws" ? length(var.private_subnets) : 0
  
  vpc_id            = aws_vpc.main[0].id
  cidr_block        = var.private_subnets[count.index]
  availability_zone = data.aws_availability_zones.available[0].names[count.index]
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-private-subnet-${count.index + 1}"
    Type = "Private"
  })
}

resource "aws_route_table" "public" {
  count = var.cloud_provider == "aws" ? 1 : 0
  
  vpc_id = aws_vpc.main[0].id
  
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main[0].id
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public-rt"
  })
}

resource "aws_route_table_association" "public" {
  count = var.cloud_provider == "aws" ? length(aws_subnet.public) : 0
  
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public[0].id
}

resource "aws_nat_gateway" "main" {
  count = var.cloud_provider == "aws" && var.enable_nat_gateway ? length(var.public_subnets) : 0
  
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-nat-gw-${count.index + 1}"
  })
  
  depends_on = [aws_internet_gateway.main]
}

resource "aws_eip" "nat" {
  count = var.cloud_provider == "aws" && var.enable_nat_gateway ? length(var.public_subnets) : 0
  
  domain = "vpc"
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-nat-eip-${count.index + 1}"
  })
  
  depends_on = [aws_internet_gateway.main]
}

resource "aws_route_table" "private" {
  count = var.cloud_provider == "aws" && var.enable_nat_gateway ? length(var.private_subnets) : 0
  
  vpc_id = aws_vpc.main[0].id
  
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-private-rt-${count.index + 1}"
  })
}

resource "aws_route_table_association" "private" {
  count = var.cloud_provider == "aws" && var.enable_nat_gateway ? length(aws_subnet.private) : 0
  
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# GCP VPC Resources
resource "google_compute_network" "main" {
  count = var.cloud_provider == "gcp" ? 1 : 0
  
  name                    = "${local.name_prefix}-vpc"
  auto_create_subnetworks = false
  
  project = var.gcp_project_id
}

resource "google_compute_subnetwork" "public" {
  count = var.cloud_provider == "gcp" ? length(var.public_subnets) : 0
  
  name          = "${local.name_prefix}-public-subnet-${count.index + 1}"
  ip_cidr_range = var.public_subnets[count.index]
  region        = var.gcp_region
  network       = google_compute_network.main[0].id
  
  project = var.gcp_project_id
}

resource "google_compute_subnetwork" "private" {
  count = var.cloud_provider == "gcp" ? length(var.private_subnets) : 0
  
  name          = "${local.name_prefix}-private-subnet-${count.index + 1}"
  ip_cidr_range = var.private_subnets[count.index]
  region        = var.gcp_region
  network       = google_compute_network.main[0].id
  
  project = var.gcp_project_id
}

resource "google_compute_firewall" "allow_internal" {
  count = var.cloud_provider == "gcp" ? 1 : 0
  
  name    = "${local.name_prefix}-allow-internal"
  network = google_compute_network.main[0].name
  
  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }
  
  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }
  
  allow {
    protocol = "icmp"
  }
  
  source_ranges = [var.vpc_cidr]
  
  project = var.gcp_project_id
}

resource "google_compute_router" "main" {
  count = var.cloud_provider == "gcp" && var.enable_nat_gateway ? 1 : 0
  
  name    = "${local.name_prefix}-router"
  region  = var.gcp_region
  network = google_compute_network.main[0].id
  
  project = var.gcp_project_id
}

resource "google_compute_router_nat" "main" {
  count = var.cloud_provider == "gcp" && var.enable_nat_gateway ? 1 : 0
  
  name                               = "${local.name_prefix}-nat"
  router                            = google_compute_router.main[0].name
  region                            = var.gcp_region
  nat_ip_allocate_option            = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
  
  project = var.gcp_project_id
}

# Azure VNet Resources
resource "azurerm_virtual_network" "main" {
  count = var.cloud_provider == "azure" ? 1 : 0
  
  name                = "${local.name_prefix}-vnet"
  address_space       = [var.vpc_cidr]
  location            = var.azure_location
  resource_group_name = var.azure_resource_group_name
  
  tags = local.common_tags
}

resource "azurerm_subnet" "public" {
  count = var.cloud_provider == "azure" ? length(var.public_subnets) : 0
  
  name                 = "${local.name_prefix}-public-subnet-${count.index + 1}"
  resource_group_name  = var.azure_resource_group_name
  virtual_network_name = azurerm_virtual_network.main[0].name
  address_prefixes     = [var.public_subnets[count.index]]
}

resource "azurerm_subnet" "private" {
  count = var.cloud_provider == "azure" ? length(var.private_subnets) : 0
  
  name                 = "${local.name_prefix}-private-subnet-${count.index + 1}"
  resource_group_name  = var.azure_resource_group_name
  virtual_network_name = azurerm_virtual_network.main[0].name
  address_prefixes     = [var.private_subnets[count.index]]
}

resource "azurerm_public_ip" "nat" {
  count = var.cloud_provider == "azure" && var.enable_nat_gateway ? length(var.public_subnets) : 0
  
  name                = "${local.name_prefix}-nat-ip-${count.index + 1}"
  location            = var.azure_location
  resource_group_name = var.azure_resource_group_name
  allocation_method   = "Static"
  sku                 = "Standard"
  
  tags = local.common_tags
}

resource "azurerm_nat_gateway" "main" {
  count = var.cloud_provider == "azure" && var.enable_nat_gateway ? length(var.public_subnets) : 0
  
  name                = "${local.name_prefix}-nat-gw-${count.index + 1}"
  location            = var.azure_location
  resource_group_name = var.azure_resource_group_name
  sku_name            = "Standard"
  
  tags = local.common_tags
}

resource "azurerm_nat_gateway_public_ip_association" "main" {
  count = var.cloud_provider == "azure" && var.enable_nat_gateway ? length(var.public_subnets) : 0
  
  nat_gateway_id       = azurerm_nat_gateway.main[count.index].id
  public_ip_address_id = azurerm_public_ip.nat[count.index].id
}

resource "azurerm_subnet_nat_gateway_association" "private" {
  count = var.cloud_provider == "azure" && var.enable_nat_gateway ? length(azurerm_subnet.private) : 0
  
  subnet_id      = azurerm_subnet.private[count.index].id
  nat_gateway_id = azurerm_nat_gateway.main[count.index].id
}

# Network Security Groups for Azure
resource "azurerm_network_security_group" "public" {
  count = var.cloud_provider == "azure" ? 1 : 0
  
  name                = "${local.name_prefix}-public-nsg"
  location            = var.azure_location
  resource_group_name = var.azure_resource_group_name
  
  tags = local.common_tags
}

resource "azurerm_network_security_group" "private" {
  count = var.cloud_provider == "azure" ? 1 : 0
  
  name                = "${local.name_prefix}-private-nsg"
  location            = var.azure_location
  resource_group_name = var.azure_resource_group_name
  
  tags = local.common_tags
}

resource "azurerm_subnet_network_security_group_association" "public" {
  count = var.cloud_provider == "azure" ? length(azurerm_subnet.public) : 0
  
  subnet_id                 = azurerm_subnet.public[count.index].id
  network_security_group_id = azurerm_network_security_group.public[0].id
}

resource "azurerm_subnet_network_security_group_association" "private" {
  count = var.cloud_provider == "azure" ? length(azurerm_subnet.private) : 0
  
  subnet_id                 = azurerm_subnet.private[count.index].id
  network_security_group_id = azurerm_network_security_group.private[0].id
}

# Data sources
data "aws_availability_zones" "available" {
  count = var.cloud_provider == "aws" ? 1 : 0
  
  state = "available"
}

# VPC Flow Logs for monitoring
resource "aws_flow_log" "vpc_flow_log" {
  count = var.cloud_provider == "aws" && var.enable_flow_logs ? 1 : 0
  
  iam_role_arn    = aws_iam_role.flow_log[0].arn
  log_destination = aws_cloudwatch_log_group.vpc_flow_log[0].arn
  traffic_type    = "ALL"
  vpc_id          = aws_vpc.main[0].id
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-vpc-flow-log"
  })
}

resource "aws_cloudwatch_log_group" "vpc_flow_log" {
  count = var.cloud_provider == "aws" && var.enable_flow_logs ? 1 : 0
  
  name              = "/aws/vpc/flow-logs/${local.name_prefix}"
  retention_in_days = var.flow_log_retention_days
  
  tags = local.common_tags
}

resource "aws_iam_role" "flow_log" {
  count = var.cloud_provider == "aws" && var.enable_flow_logs ? 1 : 0
  
  name = "${local.name_prefix}-flow-log-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "vpc-flow-logs.amazonaws.com"
        }
      }
    ]
  })
  
  tags = local.common_tags
}

resource "aws_iam_role_policy" "flow_log" {
  count = var.cloud_provider == "aws" && var.enable_flow_logs ? 1 : 0
  
  name = "${local.name_prefix}-flow-log-policy"
  role = aws_iam_role.flow_log[0].id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Effect = "Allow"
        Resource = "*"
      }
    ]
  })
}