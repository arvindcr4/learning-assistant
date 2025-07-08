# Security Groups Module for Multi-Cloud Infrastructure
# Supports AWS, GCP, and Azure with consistent security policies

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

# Local variables for consistent naming and security rules
locals {
  common_tags = merge(
    var.tags,
    {
      Module      = "networking/security-groups"
      Environment = var.environment
      Project     = var.project_name
      ManagedBy   = "terraform"
    }
  )
  
  name_prefix = "${var.project_name}-${var.environment}"
  
  # Common security rules
  common_ingress_rules = {
    http = {
      from_port   = 80
      to_port     = 80
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
      description = "HTTP access from anywhere"
    }
    https = {
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
      description = "HTTPS access from anywhere"
    }
    ssh = {
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = var.ssh_allowed_cidrs
      description = "SSH access from allowed CIDRs"
    }
  }
  
  database_ports = {
    mysql      = 3306
    postgresql = 5432
    redis      = 6379
    mongodb    = 27017
  }
}

# AWS Security Groups
resource "aws_security_group" "web" {
  count = var.cloud_provider == "aws" ? 1 : 0
  
  name_prefix = "${local.name_prefix}-web-"
  vpc_id      = var.vpc_id
  description = "Security group for web servers"
  
  # HTTP/HTTPS ingress
  dynamic "ingress" {
    for_each = var.enable_web_access ? ["http", "https"] : []
    content {
      from_port   = ingress.value == "http" ? 80 : 443
      to_port     = ingress.value == "http" ? 80 : 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
      description = "${upper(ingress.value)} access from anywhere"
    }
  }
  
  # Custom application ports
  dynamic "ingress" {
    for_each = var.custom_ingress_rules
    content {
      from_port   = ingress.value.from_port
      to_port     = ingress.value.to_port
      protocol    = ingress.value.protocol
      cidr_blocks = ingress.value.cidr_blocks
      description = ingress.value.description
    }
  }
  
  # SSH access
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ssh_allowed_cidrs
    description = "SSH access from allowed CIDRs"
  }
  
  # All outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-web-sg"
    Type = "Web"
  })
  
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group" "app" {
  count = var.cloud_provider == "aws" ? 1 : 0
  
  name_prefix = "${local.name_prefix}-app-"
  vpc_id      = var.vpc_id
  description = "Security group for application servers"
  
  # Application port access from web tier
  ingress {
    from_port       = var.app_port
    to_port         = var.app_port
    protocol        = "tcp"
    security_groups = [aws_security_group.web[0].id]
    description     = "App port access from web tier"
  }
  
  # Internal communication
  ingress {
    from_port = 0
    to_port   = 65535
    protocol  = "tcp"
    self      = true
    description = "Internal communication within app tier"
  }
  
  # SSH access
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ssh_allowed_cidrs
    description = "SSH access from allowed CIDRs"
  }
  
  # All outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-app-sg"
    Type = "Application"
  })
  
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group" "database" {
  count = var.cloud_provider == "aws" ? 1 : 0
  
  name_prefix = "${local.name_prefix}-db-"
  vpc_id      = var.vpc_id
  description = "Security group for database servers"
  
  # Database port access from app tier
  dynamic "ingress" {
    for_each = var.database_engines
    content {
      from_port       = local.database_ports[ingress.value]
      to_port         = local.database_ports[ingress.value]
      protocol        = "tcp"
      security_groups = [aws_security_group.app[0].id]
      description     = "${upper(ingress.value)} access from app tier"
    }
  }
  
  # Internal communication
  ingress {
    from_port = 0
    to_port   = 65535
    protocol  = "tcp"
    self      = true
    description = "Internal communication within database tier"
  }
  
  # SSH access (if enabled)
  dynamic "ingress" {
    for_each = var.enable_database_ssh ? [1] : []
    content {
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = var.ssh_allowed_cidrs
      description = "SSH access from allowed CIDRs"
    }
  }
  
  # All outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-db-sg"
    Type = "Database"
  })
  
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group" "cache" {
  count = var.cloud_provider == "aws" ? 1 : 0
  
  name_prefix = "${local.name_prefix}-cache-"
  vpc_id      = var.vpc_id
  description = "Security group for cache servers"
  
  # Redis port access from app tier
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.app[0].id]
    description     = "Redis access from app tier"
  }
  
  # Memcached port access from app tier
  ingress {
    from_port       = 11211
    to_port         = 11211
    protocol        = "tcp"
    security_groups = [aws_security_group.app[0].id]
    description     = "Memcached access from app tier"
  }
  
  # Internal communication
  ingress {
    from_port = 0
    to_port   = 65535
    protocol  = "tcp"
    self      = true
    description = "Internal communication within cache tier"
  }
  
  # All outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-cache-sg"
    Type = "Cache"
  })
  
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group" "load_balancer" {
  count = var.cloud_provider == "aws" ? 1 : 0
  
  name_prefix = "${local.name_prefix}-lb-"
  vpc_id      = var.vpc_id
  description = "Security group for load balancers"
  
  # HTTP/HTTPS ingress
  dynamic "ingress" {
    for_each = var.enable_web_access ? ["http", "https"] : []
    content {
      from_port   = ingress.value == "http" ? 80 : 443
      to_port     = ingress.value == "http" ? 80 : 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
      description = "${upper(ingress.value)} access from anywhere"
    }
  }
  
  # Health check ports
  dynamic "ingress" {
    for_each = var.health_check_ports
    content {
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
      description = "Health check on port ${ingress.value}"
    }
  }
  
  # All outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-lb-sg"
    Type = "LoadBalancer"
  })
  
  lifecycle {
    create_before_destroy = true
  }
}

# GCP Firewall Rules
resource "google_compute_firewall" "web" {
  count = var.cloud_provider == "gcp" ? 1 : 0
  
  name    = "${local.name_prefix}-web-firewall"
  network = var.network_name
  
  allow {
    protocol = "tcp"
    ports    = var.enable_web_access ? ["80", "443"] : []
  }
  
  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
  
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["web-server"]
  
  project = var.gcp_project_id
}

resource "google_compute_firewall" "app" {
  count = var.cloud_provider == "gcp" ? 1 : 0
  
  name    = "${local.name_prefix}-app-firewall"
  network = var.network_name
  
  allow {
    protocol = "tcp"
    ports    = [tostring(var.app_port)]
  }
  
  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
  
  source_tags = ["web-server"]
  target_tags = ["app-server"]
  
  project = var.gcp_project_id
}

resource "google_compute_firewall" "database" {
  count = var.cloud_provider == "gcp" ? 1 : 0
  
  name    = "${local.name_prefix}-database-firewall"
  network = var.network_name
  
  dynamic "allow" {
    for_each = var.database_engines
    content {
      protocol = "tcp"
      ports    = [tostring(local.database_ports[allow.value])]
    }
  }
  
  source_tags = ["app-server"]
  target_tags = ["database-server"]
  
  project = var.gcp_project_id
}

resource "google_compute_firewall" "cache" {
  count = var.cloud_provider == "gcp" ? 1 : 0
  
  name    = "${local.name_prefix}-cache-firewall"
  network = var.network_name
  
  allow {
    protocol = "tcp"
    ports    = ["6379", "11211"]
  }
  
  source_tags = ["app-server"]
  target_tags = ["cache-server"]
  
  project = var.gcp_project_id
}

resource "google_compute_firewall" "internal" {
  count = var.cloud_provider == "gcp" ? 1 : 0
  
  name    = "${local.name_prefix}-internal-firewall"
  network = var.network_name
  
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

# Azure Network Security Groups
resource "azurerm_network_security_group" "web" {
  count = var.cloud_provider == "azure" ? 1 : 0
  
  name                = "${local.name_prefix}-web-nsg"
  location            = var.azure_location
  resource_group_name = var.azure_resource_group_name
  
  tags = local.common_tags
}

resource "azurerm_network_security_rule" "web_http" {
  count = var.cloud_provider == "azure" && var.enable_web_access ? 1 : 0
  
  name                        = "AllowHTTP"
  priority                    = 100
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_range      = "80"
  source_address_prefix       = "*"
  destination_address_prefix  = "*"
  resource_group_name         = var.azure_resource_group_name
  network_security_group_name = azurerm_network_security_group.web[0].name
}

resource "azurerm_network_security_rule" "web_https" {
  count = var.cloud_provider == "azure" && var.enable_web_access ? 1 : 0
  
  name                        = "AllowHTTPS"
  priority                    = 110
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_range      = "443"
  source_address_prefix       = "*"
  destination_address_prefix  = "*"
  resource_group_name         = var.azure_resource_group_name
  network_security_group_name = azurerm_network_security_group.web[0].name
}

resource "azurerm_network_security_rule" "web_ssh" {
  count = var.cloud_provider == "azure" ? 1 : 0
  
  name                        = "AllowSSH"
  priority                    = 120
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_range      = "22"
  source_address_prefixes     = var.ssh_allowed_cidrs
  destination_address_prefix  = "*"
  resource_group_name         = var.azure_resource_group_name
  network_security_group_name = azurerm_network_security_group.web[0].name
}

resource "azurerm_network_security_group" "app" {
  count = var.cloud_provider == "azure" ? 1 : 0
  
  name                = "${local.name_prefix}-app-nsg"
  location            = var.azure_location
  resource_group_name = var.azure_resource_group_name
  
  tags = local.common_tags
}

resource "azurerm_network_security_rule" "app_port" {
  count = var.cloud_provider == "azure" ? 1 : 0
  
  name                        = "AllowAppPort"
  priority                    = 100
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_range      = tostring(var.app_port)
  source_address_prefix       = var.vpc_cidr
  destination_address_prefix  = "*"
  resource_group_name         = var.azure_resource_group_name
  network_security_group_name = azurerm_network_security_group.app[0].name
}

resource "azurerm_network_security_group" "database" {
  count = var.cloud_provider == "azure" ? 1 : 0
  
  name                = "${local.name_prefix}-database-nsg"
  location            = var.azure_location
  resource_group_name = var.azure_resource_group_name
  
  tags = local.common_tags
}

resource "azurerm_network_security_rule" "database_ports" {
  count = var.cloud_provider == "azure" ? length(var.database_engines) : 0
  
  name                        = "Allow${title(var.database_engines[count.index])}"
  priority                    = 100 + count.index * 10
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_range      = tostring(local.database_ports[var.database_engines[count.index]])
  source_address_prefix       = var.vpc_cidr
  destination_address_prefix  = "*"
  resource_group_name         = var.azure_resource_group_name
  network_security_group_name = azurerm_network_security_group.database[0].name
}

resource "azurerm_network_security_group" "cache" {
  count = var.cloud_provider == "azure" ? 1 : 0
  
  name                = "${local.name_prefix}-cache-nsg"
  location            = var.azure_location
  resource_group_name = var.azure_resource_group_name
  
  tags = local.common_tags
}

resource "azurerm_network_security_rule" "cache_redis" {
  count = var.cloud_provider == "azure" ? 1 : 0
  
  name                        = "AllowRedis"
  priority                    = 100
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_range      = "6379"
  source_address_prefix       = var.vpc_cidr
  destination_address_prefix  = "*"
  resource_group_name         = var.azure_resource_group_name
  network_security_group_name = azurerm_network_security_group.cache[0].name
}

resource "azurerm_network_security_rule" "cache_memcached" {
  count = var.cloud_provider == "azure" ? 1 : 0
  
  name                        = "AllowMemcached"
  priority                    = 110
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_range      = "11211"
  source_address_prefix       = var.vpc_cidr
  destination_address_prefix  = "*"
  resource_group_name         = var.azure_resource_group_name
  network_security_group_name = azurerm_network_security_group.cache[0].name
}

# Security Group Rules for Web Application Firewall (WAF)
resource "aws_security_group" "waf" {
  count = var.cloud_provider == "aws" && var.enable_waf ? 1 : 0
  
  name_prefix = "${local.name_prefix}-waf-"
  vpc_id      = var.vpc_id
  description = "Security group for WAF"
  
  # WAF typically needs to allow HTTP/HTTPS traffic
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP access for WAF"
  }
  
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS access for WAF"
  }
  
  # All outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-waf-sg"
    Type = "WAF"
  })
  
  lifecycle {
    create_before_destroy = true
  }
}