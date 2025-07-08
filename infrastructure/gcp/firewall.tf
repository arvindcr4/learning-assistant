# Allow internal communication within VPC
resource "google_compute_firewall" "allow_internal" {
  name    = "learning-assistant-allow-internal"
  network = google_compute_network.main.name
  
  description = "Allow internal communication within the VPC"

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
    var.public_subnet_cidr,
    "10.1.0.0/16", # GKE pods
    "10.2.0.0/16", # GKE services
    "10.3.0.0/28", # Redis reserved range
    "10.3.1.0/28"  # Redis replica reserved range
  ]

  direction = "INGRESS"
  priority  = 1000

  target_tags = ["gke-node", "internal-service"]

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

# Allow HTTP/HTTPS traffic to load balancer
resource "google_compute_firewall" "allow_http_https" {
  name    = "learning-assistant-allow-http-https"
  network = google_compute_network.main.name
  
  description = "Allow HTTP and HTTPS traffic from internet to load balancer"

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["http-server", "https-server", "load-balancer"]

  direction = "INGRESS"
  priority  = 1000

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

# Allow health check traffic from Google's health check IPs
resource "google_compute_firewall" "allow_health_checks" {
  name    = "learning-assistant-allow-health-checks"
  network = google_compute_network.main.name
  
  description = "Allow health check traffic from Google Cloud health checkers"

  allow {
    protocol = "tcp"
    ports    = ["80", "443", "8080", "8443"]
  }

  # Google Cloud health check IP ranges
  source_ranges = [
    "130.211.0.0/22",
    "35.191.0.0/16",
    "209.85.152.0/22",
    "209.85.204.0/22"
  ]

  target_tags = ["health-check", "gke-node", "http-server"]

  direction = "INGRESS"
  priority  = 1000

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

# Allow SSH access for administrative purposes (restricted)
resource "google_compute_firewall" "allow_ssh" {
  name    = "learning-assistant-allow-ssh"
  network = google_compute_network.main.name
  
  description = "Allow SSH access from authorized networks only"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  # Restrict SSH access to specific IP ranges (replace with your office/VPN IPs)
  source_ranges = [
    "203.0.113.0/24",  # Example office IP range
    "198.51.100.0/24"  # Example VPN IP range
  ]

  target_tags = ["ssh-allowed"]

  direction = "INGRESS"
  priority  = 1000

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

# Deny all other SSH traffic
resource "google_compute_firewall" "deny_ssh" {
  name    = "learning-assistant-deny-ssh"
  network = google_compute_network.main.name
  
  description = "Deny SSH access from all other sources"

  deny {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]

  direction = "INGRESS"
  priority  = 2000

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

# Allow Cloud SQL proxy connections
resource "google_compute_firewall" "allow_cloudsql_proxy" {
  name    = "learning-assistant-allow-cloudsql-proxy"
  network = google_compute_network.main.name
  
  description = "Allow Cloud SQL proxy connections from GKE nodes"

  allow {
    protocol = "tcp"
    ports    = ["3307", "5432"]
  }

  source_ranges = [var.private_subnet_cidr]
  target_tags   = ["cloudsql-proxy"]

  direction = "INGRESS"
  priority  = 1000

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

# Allow Redis connections
resource "google_compute_firewall" "allow_redis" {
  name    = "learning-assistant-allow-redis"
  network = google_compute_network.main.name
  
  description = "Allow Redis connections from GKE nodes"

  allow {
    protocol = "tcp"
    ports    = ["6379"]
  }

  source_ranges = [var.private_subnet_cidr, "10.1.0.0/16"]
  target_tags   = ["redis-client"]

  direction = "INGRESS"
  priority  = 1000

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

# Allow monitoring and logging traffic
resource "google_compute_firewall" "allow_monitoring" {
  name    = "learning-assistant-allow-monitoring"
  network = google_compute_network.main.name
  
  description = "Allow monitoring and logging traffic"

  allow {
    protocol = "tcp"
    ports    = ["9090", "9093", "9100", "3000"] # Prometheus, Alertmanager, Node Exporter, Grafana
  }

  source_ranges = [var.private_subnet_cidr]
  target_tags   = ["monitoring"]

  direction = "INGRESS"
  priority  = 1000

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

# Allow DNS traffic
resource "google_compute_firewall" "allow_dns" {
  name    = "learning-assistant-allow-dns"
  network = google_compute_network.main.name
  
  description = "Allow DNS traffic"

  allow {
    protocol = "tcp"
    ports    = ["53"]
  }

  allow {
    protocol = "udp"
    ports    = ["53"]
  }

  source_ranges = [var.private_subnet_cidr, "10.1.0.0/16", "10.2.0.0/16"]
  target_tags   = ["dns-server"]

  direction = "INGRESS"
  priority  = 1000

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

# Block suspicious traffic patterns
resource "google_compute_firewall" "deny_suspicious_ports" {
  name    = "learning-assistant-deny-suspicious-ports"
  network = google_compute_network.main.name
  
  description = "Deny traffic to commonly exploited ports"

  deny {
    protocol = "tcp"
    ports    = [
      "23",    # Telnet
      "135",   # RPC
      "139",   # NetBIOS
      "445",   # SMB
      "1433",  # SQL Server
      "1521",  # Oracle
      "3389",  # RDP
      "5432",  # PostgreSQL (from external)
      "6379",  # Redis (from external)
      "27017", # MongoDB
      "50070", # Hadoop
      "8080",  # HTTP alternate (from external)
      "8443"   # HTTPS alternate (from external)
    ]
  }

  source_ranges = ["0.0.0.0/0"]

  direction = "INGRESS"
  priority  = 500

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

# Rate limiting firewall rule (using tags)
resource "google_compute_firewall" "rate_limit_web_traffic" {
  name    = "learning-assistant-rate-limit-web"
  network = google_compute_network.main.name
  
  description = "Rate limit web traffic to prevent abuse"

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["rate-limited"]

  direction = "INGRESS"
  priority  = 1100

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

# Allow ICMP for network diagnostics
resource "google_compute_firewall" "allow_icmp" {
  name    = "learning-assistant-allow-icmp"
  network = google_compute_network.main.name
  
  description = "Allow ICMP for network diagnostics"

  allow {
    protocol = "icmp"
  }

  source_ranges = [
    var.private_subnet_cidr,
    var.public_subnet_cidr,
    "203.0.113.0/24" # Replace with your office/monitoring IP range
  ]

  direction = "INGRESS"
  priority  = 1000

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

# Egress rule for internet access (explicit)
resource "google_compute_firewall" "allow_egress_internet" {
  name    = "learning-assistant-allow-egress-internet"
  network = google_compute_network.main.name
  
  description = "Allow egress traffic to internet for updates and API calls"

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  allow {
    protocol = "udp"
    ports    = ["53", "123"] # DNS and NTP
  }

  destination_ranges = ["0.0.0.0/0"]

  direction = "EGRESS"
  priority  = 1000

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

# Block egress to private networks (prevent data exfiltration)
resource "google_compute_firewall" "deny_egress_private" {
  name    = "learning-assistant-deny-egress-private"
  network = google_compute_network.main.name
  
  description = "Deny egress traffic to private IP ranges to prevent data exfiltration"

  deny {
    protocol = "all"
  }

  destination_ranges = [
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16"
  ]

  direction = "EGRESS"
  priority  = 500

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

# Allow specific egress for Google Cloud services
resource "google_compute_firewall" "allow_egress_google_apis" {
  name    = "learning-assistant-allow-egress-google-apis"
  network = google_compute_network.main.name
  
  description = "Allow egress traffic to Google Cloud APIs"

  allow {
    protocol = "tcp"
    ports    = ["443"]
  }

  destination_ranges = [
    "199.36.153.8/30",   # Google APIs
    "199.36.153.4/30",   # Google APIs
    "34.126.0.0/18"      # Google APIs
  ]

  direction = "EGRESS"
  priority  = 1000

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

# Create hierarchical firewall policy (if using organization-level policies)
resource "google_compute_organization_security_policy" "org_security_policy" {
  count        = var.environment == "prod" ? 1 : 0
  display_name = "Learning Assistant Organization Security Policy"
  description  = "Organization-level security policy for learning assistant"

  # Default deny rule
  rule {
    action      = "deny(403)"
    priority    = 2147483647
    description = "Default deny rule"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
  }

  # Allow known good countries
  rule {
    action      = "allow"
    priority    = 1000
    description = "Allow traffic from approved countries"
    match {
      expr {
        expression = "origin.region_code == 'US' || origin.region_code == 'CA' || origin.region_code == 'GB'"
      }
    }
  }

  # Block known malicious IPs
  rule {
    action      = "deny(403)"
    priority    = 500
    description = "Block known malicious IP ranges"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = [
          # Add known malicious IP ranges here
          "192.0.2.0/24",
          "203.0.113.0/24"
        ]
      }
    }
  }
}

# Create network tags for firewall targeting
locals {
  network_tags = {
    gke_node        = "gke-node"
    load_balancer   = "load-balancer"
    http_server     = "http-server"
    https_server    = "https-server"
    health_check    = "health-check"
    ssh_allowed     = "ssh-allowed"
    cloudsql_proxy  = "cloudsql-proxy"
    redis_client    = "redis-client"
    monitoring      = "monitoring"
    dns_server      = "dns-server"
    rate_limited    = "rate-limited"
    internal_service = "internal-service"
  }
}

# Create firewall rule for backup operations
resource "google_compute_firewall" "allow_backup_operations" {
  name    = "learning-assistant-allow-backup-operations"
  network = google_compute_network.main.name
  
  description = "Allow backup operations traffic"

  allow {
    protocol = "tcp"
    ports    = ["443", "22"]
  }

  source_ranges = [var.private_subnet_cidr]
  target_tags   = ["backup-server"]

  direction = "INGRESS"
  priority  = 1000

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

# Create firewall rule for CI/CD operations
resource "google_compute_firewall" "allow_cicd_operations" {
  name    = "learning-assistant-allow-cicd-operations"
  network = google_compute_network.main.name
  
  description = "Allow CI/CD operations traffic"

  allow {
    protocol = "tcp"
    ports    = ["443", "8080", "9000"]
  }

  source_ranges = [
    var.private_subnet_cidr,
    "203.0.113.0/24" # Replace with your CI/CD system IP range
  ]
  target_tags = ["cicd-agent"]

  direction = "INGRESS"
  priority  = 1000

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

# Create firewall monitoring alert
resource "google_monitoring_alert_policy" "firewall_blocked_traffic" {
  display_name = "Firewall Blocked Traffic"
  combiner     = "OR"

  conditions {
    display_name = "High rate of blocked traffic"

    condition_threshold {
      filter         = "resource.type=\"gce_firewall_rule\" AND resource.labels.rule_name=\"learning-assistant-deny-suspicious-ports\""
      duration       = "300s"
      comparison     = "COMPARISON_GT"
      threshold_value = 100

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }

  documentation {
    content = "High rate of blocked traffic detected. This may indicate a security attack or misconfiguration."
  }

  depends_on = [
    google_monitoring_notification_channel.email,
  ]
}

# Output network tags for use in other resources
output "network_tags" {
  description = "Network tags for firewall rules"
  value       = local.network_tags
}