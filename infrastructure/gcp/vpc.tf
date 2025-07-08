# Create VPC network
resource "google_compute_network" "main" {
  name                    = "learning-assistant-vpc"
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"
  description             = "Main VPC network for learning assistant application"

  depends_on = [google_project_service.required_apis]
}

# Create private subnet for GKE nodes
resource "google_compute_subnetwork" "private" {
  name          = "learning-assistant-private-subnet"
  ip_cidr_range = var.private_subnet_cidr
  network       = google_compute_network.main.id
  region        = var.region
  description   = "Private subnet for GKE nodes and internal services"

  # Enable private Google access
  private_ip_google_access = true

  # Secondary IP ranges for GKE pods and services
  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.1.0.0/16"
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.2.0.0/16"
  }

  log_config {
    aggregation_interval = "INTERVAL_10_MIN"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

# Create public subnet for load balancers
resource "google_compute_subnetwork" "public" {
  name          = "learning-assistant-public-subnet"
  ip_cidr_range = var.public_subnet_cidr
  network       = google_compute_network.main.id
  region        = var.region
  description   = "Public subnet for load balancers and public-facing services"

  log_config {
    aggregation_interval = "INTERVAL_10_MIN"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

# Create Cloud Router for NAT
resource "google_compute_router" "main" {
  name    = "learning-assistant-router"
  network = google_compute_network.main.id
  region  = var.region

  bgp {
    asn = 64514
  }
}

# Create NAT Gateway for private subnet internet access
resource "google_compute_router_nat" "main" {
  name   = "learning-assistant-nat"
  router = google_compute_router.main.name
  region = var.region

  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "LIST_OF_SUBNETWORKS"

  subnetwork {
    name                    = google_compute_subnetwork.private.id
    source_ip_ranges_to_nat = ["ALL_IP_RANGES"]
  }

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# Reserve static external IP for load balancer
resource "google_compute_global_address" "main" {
  name         = "learning-assistant-lb-ip"
  description  = "Static external IP for learning assistant load balancer"
  address_type = "EXTERNAL"
  ip_version   = "IPV4"
}

# Reserve static internal IP for services
resource "google_compute_address" "internal" {
  name         = "learning-assistant-internal-ip"
  subnetwork   = google_compute_subnetwork.private.id
  address_type = "INTERNAL"
  region       = var.region
  description  = "Static internal IP for internal services"
}

# Create private service connection for Cloud SQL
resource "google_compute_global_address" "private_service_connection" {
  name          = "learning-assistant-private-service-connection"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.main.id
  description   = "Private service connection for Cloud SQL"
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_service_connection.name]

  depends_on = [google_project_service.required_apis]
}

# VPC Flow Logs for network monitoring
resource "google_compute_network_peering" "vpc_peering" {
  count        = var.environment == "prod" ? 1 : 0
  name         = "learning-assistant-vpc-peering"
  network      = google_compute_network.main.id
  peer_network = google_compute_network.main.id

  import_custom_routes = true
  export_custom_routes = true
}

# Create firewall rules (imported from firewall.tf)
# Health check firewall rule
resource "google_compute_firewall" "health_check" {
  name    = "learning-assistant-health-check"
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["80", "443", "8080"]
  }

  source_ranges = [
    "130.211.0.0/22",
    "35.191.0.0/16"
  ]

  target_tags = ["health-check"]
}

# Internal communication firewall rule
resource "google_compute_firewall" "internal" {
  name    = "learning-assistant-internal"
  network = google_compute_network.main.name

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

  source_ranges = [
    var.private_subnet_cidr,
    "10.1.0.0/16", # pods
    "10.2.0.0/16"  # services
  ]
}

# Network security policies
resource "google_compute_security_policy" "main" {
  name        = "learning-assistant-security-policy"
  description = "Security policy for learning assistant application"

  # Default rule
  rule {
    action   = "allow"
    priority = "2147483647"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default allow rule"
  }

  # Rate limiting rule
  rule {
    action   = "rate_based_ban"
    priority = "1000"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"
      rate_limit_threshold {
        count        = 100
        interval_sec = 60
      }
      ban_duration_sec = 300
    }
    description = "Rate limiting rule"
  }

  # Block common attack patterns
  rule {
    action   = "deny(403)"
    priority = "500"
    match {
      expr {
        expression = "request.headers['user-agent'].contains('sqlmap') || request.headers['user-agent'].contains('nmap') || request.headers['user-agent'].contains('nikto')"
      }
    }
    description = "Block common attack tools"
  }

  # Geographic restriction (optional)
  dynamic "rule" {
    for_each = var.environment == "prod" ? [1] : []
    content {
      action   = "allow"
      priority = "100"
      match {
        expr {
          expression = "origin.region_code == 'US' || origin.region_code == 'CA'"
        }
      }
      description = "Allow traffic from US and Canada only"
    }
  }

  adaptive_protection_config {
    layer_7_ddos_defense_config {
      enable = true
    }
  }
}

# Network endpoint groups for load balancing
resource "google_compute_network_endpoint_group" "main" {
  name         = "learning-assistant-neg"
  network      = google_compute_network.main.id
  subnetwork   = google_compute_subnetwork.private.id
  default_port = "80"
  zone         = var.zone
  description  = "Network endpoint group for learning assistant"
}

# Private DNS zone for internal services
resource "google_dns_managed_zone" "private" {
  name        = "learning-assistant-private-zone"
  dns_name    = "internal.learning-assistant.local."
  description = "Private DNS zone for internal services"

  visibility = "private"

  private_visibility_config {
    networks {
      network_url = google_compute_network.main.id
    }
  }
}

# Private DNS records
resource "google_dns_record_set" "database" {
  name = "database.${google_dns_managed_zone.private.dns_name}"
  type = "A"
  ttl  = 300

  managed_zone = google_dns_managed_zone.private.name
  rrdatas      = [google_sql_database_instance.main.private_ip_address]
}

resource "google_dns_record_set" "redis" {
  name = "redis.${google_dns_managed_zone.private.dns_name}"
  type = "A"
  ttl  = 300

  managed_zone = google_dns_managed_zone.private.name
  rrdatas      = [google_redis_instance.main.host]
}