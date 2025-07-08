# =============================================================================
# NETWORK SECURITY AND MICRO-SEGMENTATION
# Zero Trust Networking Implementation
# =============================================================================

# =============================================================================
# VARIABLES
# =============================================================================

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "learning-assistant"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "enable_flow_logs" {
  description = "Enable VPC flow logs"
  type        = bool
  default     = true
}

variable "enable_dns_logging" {
  description = "Enable DNS logging"
  type        = bool
  default     = true
}

variable "enable_waf" {
  description = "Enable AWS WAF"
  type        = bool
  default     = true
}

variable "enable_ddos_protection" {
  description = "Enable DDoS protection"
  type        = bool
  default     = true
}

variable "enable_intrusion_detection" {
  description = "Enable intrusion detection"
  type        = bool
  default     = true
}

variable "enable_network_segmentation" {
  description = "Enable network segmentation"
  type        = bool
  default     = true
}

variable "enable_zero_trust" {
  description = "Enable zero trust networking"
  type        = bool
  default     = true
}

variable "enable_micro_segmentation" {
  description = "Enable micro-segmentation"
  type        = bool
  default     = true
}

variable "allowed_cidr_blocks" {
  description = "Allowed CIDR blocks for external access"
  type = map(list(string))
  default = {
    office    = ["203.0.113.0/24"]
    vpn       = ["198.51.100.0/24"]
    partners  = ["192.0.2.0/24"]
  }
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}

# =============================================================================
# LOCALS
# =============================================================================

locals {
  common_tags = merge(var.tags, {
    Module = "network-security"
  })

  # Calculate subnet CIDRs
  public_subnet_cidrs = [
    for i, az in var.availability_zones : cidrsubnet(var.vpc_cidr, 8, i)
  ]

  private_subnet_cidrs = [
    for i, az in var.availability_zones : cidrsubnet(var.vpc_cidr, 8, i + 10)
  ]

  database_subnet_cidrs = [
    for i, az in var.availability_zones : cidrsubnet(var.vpc_cidr, 8, i + 20)
  ]

  isolated_subnet_cidrs = [
    for i, az in var.availability_zones : cidrsubnet(var.vpc_cidr, 8, i + 30)
  ]

  # Network security rules for micro-segmentation
  micro_segmentation_rules = {
    web_tier = {
      name = "web-tier"
      ingress_rules = [
        {
          from_port   = 80
          to_port     = 80
          protocol    = "tcp"
          cidr_blocks = ["0.0.0.0/0"]
          description = "HTTP from internet"
        },
        {
          from_port   = 443
          to_port     = 443
          protocol    = "tcp"
          cidr_blocks = ["0.0.0.0/0"]
          description = "HTTPS from internet"
        }
      ]
      egress_rules = [
        {
          from_port       = 3000
          to_port         = 3000
          protocol        = "tcp"
          source_security_group = "app-tier"
          description     = "To application tier"
        }
      ]
    }
    app_tier = {
      name = "app-tier"
      ingress_rules = [
        {
          from_port       = 3000
          to_port         = 3000
          protocol        = "tcp"
          source_security_group = "web-tier"
          description     = "From web tier"
        },
        {
          from_port       = 22
          to_port         = 22
          protocol        = "tcp"
          cidr_blocks     = local.private_subnet_cidrs
          description     = "SSH from private subnets"
        }
      ]
      egress_rules = [
        {
          from_port       = 5432
          to_port         = 5432
          protocol        = "tcp"
          source_security_group = "database-tier"
          description     = "To database tier"
        },
        {
          from_port   = 443
          to_port     = 443
          protocol    = "tcp"
          cidr_blocks = ["0.0.0.0/0"]
          description = "HTTPS to internet"
        }
      ]
    }
    database_tier = {
      name = "database-tier"
      ingress_rules = [
        {
          from_port       = 5432
          to_port         = 5432
          protocol        = "tcp"
          source_security_group = "app-tier"
          description     = "PostgreSQL from app tier"
        }
      ]
      egress_rules = []
    }
    cache_tier = {
      name = "cache-tier"
      ingress_rules = [
        {
          from_port       = 6379
          to_port         = 6379
          protocol        = "tcp"
          source_security_group = "app-tier"
          description     = "Redis from app tier"
        }
      ]
      egress_rules = []
    }
    monitoring_tier = {
      name = "monitoring-tier"
      ingress_rules = [
        {
          from_port   = 9090
          to_port     = 9090
          protocol    = "tcp"
          cidr_blocks = local.private_subnet_cidrs
          description = "Prometheus from private subnets"
        },
        {
          from_port   = 3000
          to_port     = 3000
          protocol    = "tcp"
          cidr_blocks = local.private_subnet_cidrs
          description = "Grafana from private subnets"
        }
      ]
      egress_rules = [
        {
          from_port   = 443
          to_port     = 443
          protocol    = "tcp"
          cidr_blocks = ["0.0.0.0/0"]
          description = "HTTPS to internet"
        }
      ]
    }
  }

  # WAF rules for different attack types
  waf_rules = {
    sql_injection = {
      name = "SQLInjectionRule"
      priority = 1
      statement = {
        sqli_match_statement = {
          field_to_match = {
            body = {}
          }
          text_transformations = [
            {
              priority = 0
              type     = "URL_DECODE"
            },
            {
              priority = 1
              type     = "HTML_ENTITY_DECODE"
            }
          ]
        }
      }
      action = "block"
    }
    xss = {
      name = "XSSRule"
      priority = 2
      statement = {
        xss_match_statement = {
          field_to_match = {
            body = {}
          }
          text_transformations = [
            {
              priority = 0
              type     = "URL_DECODE"
            },
            {
              priority = 1
              type     = "HTML_ENTITY_DECODE"
            }
          ]
        }
      }
      action = "block"
    }
    rate_limiting = {
      name = "RateLimitingRule"
      priority = 3
      statement = {
        rate_based_statement = {
          limit              = 2000
          aggregate_key_type = "IP"
        }
      }
      action = "block"
    }
    geo_blocking = {
      name = "GeoBlockingRule"
      priority = 4
      statement = {
        geo_match_statement = {
          country_codes = ["CN", "RU", "KP", "IR"]
        }
      }
      action = "block"
    }
    ip_reputation = {
      name = "IPReputationRule"
      priority = 5
      statement = {
        managed_rule_group_statement = {
          vendor_name = "AWS"
          name        = "AWSManagedRulesAmazonIpReputationList"
        }
      }
      action = "block"
    }
  }
}

# =============================================================================
# DATA SOURCES
# =============================================================================

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# =============================================================================
# VPC AND NETWORKING
# =============================================================================

# Main VPC
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-vpc"
  })
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-igw"
  })
}

# Public Subnets
resource "aws_subnet" "public" {
  count = length(var.availability_zones)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = local.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-public-subnet-${count.index + 1}"
    Tier = "Public"
  })
}

# Private Subnets (Application Tier)
resource "aws_subnet" "private" {
  count = length(var.availability_zones)

  vpc_id            = aws_vpc.main.id
  cidr_block        = local.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-private-subnet-${count.index + 1}"
    Tier = "Private"
  })
}

# Database Subnets
resource "aws_subnet" "database" {
  count = length(var.availability_zones)

  vpc_id            = aws_vpc.main.id
  cidr_block        = local.database_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-database-subnet-${count.index + 1}"
    Tier = "Database"
  })
}

# Isolated Subnets (No internet access)
resource "aws_subnet" "isolated" {
  count = var.enable_micro_segmentation ? length(var.availability_zones) : 0

  vpc_id            = aws_vpc.main.id
  cidr_block        = local.isolated_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-isolated-subnet-${count.index + 1}"
    Tier = "Isolated"
  })
}

# NAT Gateways
resource "aws_eip" "nat" {
  count = length(var.availability_zones)

  domain = "vpc"
  depends_on = [aws_internet_gateway.main]

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-nat-eip-${count.index + 1}"
  })
}

resource "aws_nat_gateway" "main" {
  count = length(var.availability_zones)

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  depends_on = [aws_internet_gateway.main]

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-nat-gw-${count.index + 1}"
  })
}

# =============================================================================
# ROUTE TABLES
# =============================================================================

# Public Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-public-rt"
  })
}

# Private Route Tables
resource "aws_route_table" "private" {
  count = length(var.availability_zones)

  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-private-rt-${count.index + 1}"
  })
}

# Database Route Table (No internet access)
resource "aws_route_table" "database" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-database-rt"
  })
}

# Isolated Route Table (No internet access)
resource "aws_route_table" "isolated" {
  count = var.enable_micro_segmentation ? 1 : 0

  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-isolated-rt"
  })
}

# Route Table Associations
resource "aws_route_table_association" "public" {
  count = length(var.availability_zones)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count = length(var.availability_zones)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

resource "aws_route_table_association" "database" {
  count = length(var.availability_zones)

  subnet_id      = aws_subnet.database[count.index].id
  route_table_id = aws_route_table.database.id
}

resource "aws_route_table_association" "isolated" {
  count = var.enable_micro_segmentation ? length(var.availability_zones) : 0

  subnet_id      = aws_subnet.isolated[count.index].id
  route_table_id = aws_route_table.isolated[0].id
}

# =============================================================================
# SECURITY GROUPS - MICRO-SEGMENTATION
# =============================================================================

# Security Groups for each tier
resource "aws_security_group" "tiers" {
  for_each = var.enable_micro_segmentation ? local.micro_segmentation_rules : {}

  name_prefix = "${var.project_name}-${var.environment}-${each.value.name}-"
  vpc_id      = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-${each.value.name}"
    Tier = each.value.name
  })

  lifecycle {
    create_before_destroy = true
  }
}

# Ingress rules
resource "aws_vpc_security_group_ingress_rule" "tier_ingress" {
  for_each = var.enable_micro_segmentation ? {
    for combo in flatten([
      for tier_name, tier_config in local.micro_segmentation_rules : [
        for idx, rule in tier_config.ingress_rules : {
          key = "${tier_name}-ingress-${idx}"
          tier_name = tier_name
          rule = rule
        }
      ]
    ]) : combo.key => combo
  } : {}

  security_group_id = aws_security_group.tiers[each.value.tier_name].id

  from_port   = each.value.rule.from_port
  to_port     = each.value.rule.to_port
  ip_protocol = each.value.rule.protocol

  # Use either CIDR blocks or source security group
  cidr_ipv4 = lookup(each.value.rule, "cidr_blocks", null) != null ? each.value.rule.cidr_blocks[0] : null
  referenced_security_group_id = lookup(each.value.rule, "source_security_group", null) != null ? aws_security_group.tiers[each.value.rule.source_security_group].id : null

  description = each.value.rule.description

  tags = local.common_tags
}

# Egress rules
resource "aws_vpc_security_group_egress_rule" "tier_egress" {
  for_each = var.enable_micro_segmentation ? {
    for combo in flatten([
      for tier_name, tier_config in local.micro_segmentation_rules : [
        for idx, rule in tier_config.egress_rules : {
          key = "${tier_name}-egress-${idx}"
          tier_name = tier_name
          rule = rule
        }
      ]
    ]) : combo.key => combo
  } : {}

  security_group_id = aws_security_group.tiers[each.value.tier_name].id

  from_port   = each.value.rule.from_port
  to_port     = each.value.rule.to_port
  ip_protocol = each.value.rule.protocol

  # Use either CIDR blocks or source security group
  cidr_ipv4 = lookup(each.value.rule, "cidr_blocks", null) != null ? each.value.rule.cidr_blocks[0] : null
  referenced_security_group_id = lookup(each.value.rule, "source_security_group", null) != null ? aws_security_group.tiers[each.value.rule.source_security_group].id : null

  description = each.value.rule.description

  tags = local.common_tags
}

# =============================================================================
# NETWORK ACLs FOR ADDITIONAL SECURITY
# =============================================================================

# Public Network ACL
resource "aws_network_acl" "public" {
  count = var.enable_network_segmentation ? 1 : 0

  vpc_id = aws_vpc.main.id

  egress {
    protocol   = "-1"
    rule_no    = 100
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }

  ingress {
    protocol   = "tcp"
    rule_no    = 100
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 80
    to_port    = 80
  }

  ingress {
    protocol   = "tcp"
    rule_no    = 110
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 443
    to_port    = 443
  }

  ingress {
    protocol   = "tcp"
    rule_no    = 120
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 1024
    to_port    = 65535
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-public-nacl"
  })
}

# Private Network ACL
resource "aws_network_acl" "private" {
  count = var.enable_network_segmentation ? 1 : 0

  vpc_id = aws_vpc.main.id

  egress {
    protocol   = "-1"
    rule_no    = 100
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }

  ingress {
    protocol   = "-1"
    rule_no    = 100
    action     = "allow"
    cidr_block = var.vpc_cidr
    from_port  = 0
    to_port    = 0
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-private-nacl"
  })
}

# Database Network ACL
resource "aws_network_acl" "database" {
  count = var.enable_network_segmentation ? 1 : 0

  vpc_id = aws_vpc.main.id

  ingress {
    protocol   = "tcp"
    rule_no    = 100
    action     = "allow"
    cidr_block = var.vpc_cidr
    from_port  = 5432
    to_port    = 5432
  }

  ingress {
    protocol   = "tcp"
    rule_no    = 110
    action     = "allow"
    cidr_block = var.vpc_cidr
    from_port  = 6379
    to_port    = 6379
  }

  egress {
    protocol   = "tcp"
    rule_no    = 100
    action     = "allow"
    cidr_block = var.vpc_cidr
    from_port  = 1024
    to_port    = 65535
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-database-nacl"
  })
}

# =============================================================================
# VPC FLOW LOGS
# =============================================================================

resource "aws_flow_log" "vpc_flow_logs" {
  count = var.enable_flow_logs ? 1 : 0

  iam_role_arn    = aws_iam_role.flow_log[0].arn
  log_destination = aws_cloudwatch_log_group.vpc_flow_logs[0].arn
  traffic_type    = "ALL"
  vpc_id          = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-vpc-flow-logs"
  })
}

resource "aws_cloudwatch_log_group" "vpc_flow_logs" {
  count = var.enable_flow_logs ? 1 : 0

  name              = "/aws/vpc/${var.project_name}-${var.environment}/flowlogs"
  retention_in_days = 30

  tags = local.common_tags
}

resource "aws_iam_role" "flow_log" {
  count = var.enable_flow_logs ? 1 : 0

  name = "${var.project_name}-${var.environment}-flow-log-role"

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
  count = var.enable_flow_logs ? 1 : 0

  name = "${var.project_name}-${var.environment}-flow-log-policy"
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
        Effect   = "Allow"
        Resource = "*"
      }
    ]
  })
}

# =============================================================================
# AWS WAF
# =============================================================================

# WAF Web ACL
resource "aws_wafv2_web_acl" "main" {
  count = var.enable_waf ? 1 : 0

  name  = "${var.project_name}-${var.environment}-waf"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  # Dynamic rules based on local.waf_rules
  dynamic "rule" {
    for_each = local.waf_rules
    content {
      name     = rule.value.name
      priority = rule.value.priority

      action {
        dynamic "block" {
          for_each = rule.value.action == "block" ? [1] : []
          content {}
        }
        dynamic "allow" {
          for_each = rule.value.action == "allow" ? [1] : []
          content {}
        }
      }

      statement {
        dynamic "sqli_match_statement" {
          for_each = lookup(rule.value.statement, "sqli_match_statement", null) != null ? [rule.value.statement.sqli_match_statement] : []
          content {
            field_to_match {
              dynamic "body" {
                for_each = lookup(sqli_match_statement.value.field_to_match, "body", null) != null ? [1] : []
                content {}
              }
            }
            dynamic "text_transformation" {
              for_each = sqli_match_statement.value.text_transformations
              content {
                priority = text_transformation.value.priority
                type     = text_transformation.value.type
              }
            }
          }
        }

        dynamic "xss_match_statement" {
          for_each = lookup(rule.value.statement, "xss_match_statement", null) != null ? [rule.value.statement.xss_match_statement] : []
          content {
            field_to_match {
              dynamic "body" {
                for_each = lookup(xss_match_statement.value.field_to_match, "body", null) != null ? [1] : []
                content {}
              }
            }
            dynamic "text_transformation" {
              for_each = xss_match_statement.value.text_transformations
              content {
                priority = text_transformation.value.priority
                type     = text_transformation.value.type
              }
            }
          }
        }

        dynamic "rate_based_statement" {
          for_each = lookup(rule.value.statement, "rate_based_statement", null) != null ? [rule.value.statement.rate_based_statement] : []
          content {
            limit              = rate_based_statement.value.limit
            aggregate_key_type = rate_based_statement.value.aggregate_key_type
          }
        }

        dynamic "geo_match_statement" {
          for_each = lookup(rule.value.statement, "geo_match_statement", null) != null ? [rule.value.statement.geo_match_statement] : []
          content {
            country_codes = geo_match_statement.value.country_codes
          }
        }

        dynamic "managed_rule_group_statement" {
          for_each = lookup(rule.value.statement, "managed_rule_group_statement", null) != null ? [rule.value.statement.managed_rule_group_statement] : []
          content {
            name        = managed_rule_group_statement.value.name
            vendor_name = managed_rule_group_statement.value.vendor_name
          }
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = rule.value.name
        sampled_requests_enabled   = true
      }
    }
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-waf"
  })

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.project_name}-${var.environment}-waf"
    sampled_requests_enabled   = true
  }
}

# =============================================================================
# DDOS PROTECTION
# =============================================================================

resource "aws_shield_protection" "main" {
  count = var.enable_ddos_protection ? 1 : 0

  name         = "${var.project_name}-${var.environment}-shield-protection"
  resource_arn = aws_eip.nat[0].id

  tags = local.common_tags
}

# =============================================================================
# INTRUSION DETECTION SYSTEM
# =============================================================================

# GuardDuty for threat detection
resource "aws_guardduty_detector" "main" {
  count = var.enable_intrusion_detection ? 1 : 0

  enable = true

  datasources {
    s3_logs {
      enable = true
    }
    kubernetes {
      audit_logs {
        enable = true
      }
    }
    malware_protection {
      scan_ec2_instance_with_findings {
        ebs_volumes {
          enable = true
        }
      }
    }
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-guardduty"
  })
}

# =============================================================================
# DNS SECURITY
# =============================================================================

# Route 53 Resolver DNS Firewall
resource "aws_route53_resolver_firewall_domain_list" "malware" {
  count = var.enable_dns_logging ? 1 : 0

  name    = "${var.project_name}-${var.environment}-malware-domains"
  domains = [
    "malware.example.com",
    "phishing.example.com",
    "botnet.example.com"
  ]

  tags = local.common_tags
}

resource "aws_route53_resolver_firewall_rule_group" "main" {
  count = var.enable_dns_logging ? 1 : 0

  name = "${var.project_name}-${var.environment}-dns-firewall"

  tags = local.common_tags
}

resource "aws_route53_resolver_firewall_rule" "malware_block" {
  count = var.enable_dns_logging ? 1 : 0

  name                    = "block-malware"
  action                  = "BLOCK"
  block_response          = "NODATA"
  firewall_domain_list_id = aws_route53_resolver_firewall_domain_list.malware[0].id
  firewall_rule_group_id  = aws_route53_resolver_firewall_rule_group.main[0].id
  priority                = 100
}

# =============================================================================
# NETWORK MONITORING
# =============================================================================

# CloudWatch Alarms for network security
resource "aws_cloudwatch_metric_alarm" "high_network_traffic" {
  alarm_name          = "${var.project_name}-${var.environment}-high-network-traffic"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "NetworkIn"
  namespace           = "AWS/EC2"
  period              = "120"
  statistic           = "Average"
  threshold           = "100000000" # 100MB
  alarm_description   = "This metric monitors high network traffic"
  alarm_actions       = [aws_sns_topic.network_alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "ddos_attack" {
  count = var.enable_ddos_protection ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-ddos-attack"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DDoSDetected"
  namespace           = "AWS/DDoSProtection"
  period              = "60"
  statistic           = "Maximum"
  threshold           = "0"
  alarm_description   = "DDoS attack detected"
  alarm_actions       = [aws_sns_topic.network_alerts.arn]

  tags = local.common_tags
}

# SNS Topic for network alerts
resource "aws_sns_topic" "network_alerts" {
  name = "${var.project_name}-${var.environment}-network-alerts"

  tags = local.common_tags
}

# =============================================================================
# OUTPUTS
# =============================================================================

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

output "database_subnet_ids" {
  description = "IDs of the database subnets"
  value       = aws_subnet.database[*].id
}

output "isolated_subnet_ids" {
  description = "IDs of the isolated subnets"
  value       = var.enable_micro_segmentation ? aws_subnet.isolated[*].id : []
}

output "security_group_ids" {
  description = "Security group IDs for each tier"
  value = var.enable_micro_segmentation ? {
    for tier_name, sg in aws_security_group.tiers : tier_name => sg.id
  } : {}
}

output "nat_gateway_ids" {
  description = "IDs of the NAT Gateways"
  value       = aws_nat_gateway.main[*].id
}

output "internet_gateway_id" {
  description = "ID of the Internet Gateway"
  value       = aws_internet_gateway.main.id
}

output "flow_logs_log_group" {
  description = "CloudWatch log group for VPC flow logs"
  value       = var.enable_flow_logs ? aws_cloudwatch_log_group.vpc_flow_logs[0].name : null
}

output "waf_web_acl_id" {
  description = "ID of the WAF Web ACL"
  value       = var.enable_waf ? aws_wafv2_web_acl.main[0].id : null
}

output "guardduty_detector_id" {
  description = "ID of the GuardDuty detector"
  value       = var.enable_intrusion_detection ? aws_guardduty_detector.main[0].id : null
}

output "shield_protection_id" {
  description = "ID of the Shield protection"
  value       = var.enable_ddos_protection ? aws_shield_protection.main[0].id : null
}

output "dns_firewall_rule_group_id" {
  description = "ID of the DNS firewall rule group"
  value       = var.enable_dns_logging ? aws_route53_resolver_firewall_rule_group.main[0].id : null
}

output "network_alerts_topic" {
  description = "SNS topic for network alerts"
  value       = aws_sns_topic.network_alerts.arn
}

output "network_security_summary" {
  description = "Network security configuration summary"
  value = {
    vpc_cidr                    = aws_vpc.main.cidr_block
    availability_zones          = var.availability_zones
    flow_logs_enabled          = var.enable_flow_logs
    dns_logging_enabled        = var.enable_dns_logging
    waf_enabled               = var.enable_waf
    ddos_protection_enabled   = var.enable_ddos_protection
    intrusion_detection_enabled = var.enable_intrusion_detection
    network_segmentation_enabled = var.enable_network_segmentation
    zero_trust_enabled        = var.enable_zero_trust
    micro_segmentation_enabled = var.enable_micro_segmentation
    security_groups_count     = var.enable_micro_segmentation ? length(local.micro_segmentation_rules) : 0
    waf_rules_count          = var.enable_waf ? length(local.waf_rules) : 0
  }
}