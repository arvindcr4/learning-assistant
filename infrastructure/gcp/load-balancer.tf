# Create SSL certificate
resource "google_compute_managed_ssl_certificate" "main" {
  name = var.ssl_certificate_name

  managed {
    domains = [
      "${var.subdomain}.${var.domain_name}",
      var.domain_name,
      "api.${var.domain_name}",
      "admin.${var.domain_name}"
    ]
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Create self-signed SSL certificate as fallback
resource "tls_private_key" "main" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "tls_self_signed_cert" "main" {
  private_key_pem = tls_private_key.main.private_key_pem

  subject {
    common_name  = var.domain_name
    organization = "Learning Assistant"
  }

  validity_period_hours = 8760 # 1 year

  allowed_uses = [
    "key_encipherment",
    "digital_signature",
    "server_auth",
  ]
}

resource "google_compute_ssl_certificate" "fallback" {
  name        = "${var.ssl_certificate_name}-fallback"
  private_key = tls_private_key.main.private_key_pem
  certificate = tls_self_signed_cert.main.cert_pem

  lifecycle {
    create_before_destroy = true
  }
}

# Create instance group for the application
resource "google_compute_instance_group" "app_group" {
  name = "learning-assistant-instance-group"
  zone = var.zone

  instances = []

  named_port {
    name = "http"
    port = "80"
  }

  named_port {
    name = "https"
    port = "443"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Create backend service
resource "google_compute_backend_service" "main" {
  name        = "learning-assistant-backend"
  protocol    = "HTTP"
  port_name   = "http"
  timeout_sec = 30

  backend {
    group           = google_compute_instance_group.app_group.id
    balancing_mode  = "UTILIZATION"
    capacity_scaler = 1.0
  }

  # Health check
  health_checks = [google_compute_health_check.main.id]

  # Connection draining
  connection_draining_timeout_sec = 300

  # Session affinity
  session_affinity = "CLIENT_IP"

  # Load balancing scheme
  load_balancing_scheme = "EXTERNAL"

  # Enable CDN
  enable_cdn = true

  cdn_policy {
    cache_mode                   = "CACHE_ALL_STATIC"
    default_ttl                  = 3600
    max_ttl                      = 86400
    client_ttl                   = 3600
    negative_caching             = true
    serve_while_stale            = 86400
    
    cache_key_policy {
      include_host         = true
      include_protocol     = true
      include_query_string = false
    }

    negative_caching_policy {
      code = 404
      ttl  = 120
    }

    negative_caching_policy {
      code = 410
      ttl  = 120
    }
  }

  # Security policy
  security_policy = google_compute_security_policy.main.name

  # Locality LB policy
  locality_lb_policy = "ROUND_ROBIN"

  # Outlier detection
  outlier_detection {
    consecutive_errors                    = 5
    consecutive_gateway_failure_threshold = 5
    interval {
      seconds = 30
    }
    base_ejection_time {
      seconds = 30
    }
    max_ejection_percent = 50
    min_health_percent   = 50
  }

  # Circuit breaker
  circuit_breakers {
    max_requests_per_connection = 1000
    max_connections             = 100
    max_pending_requests        = 100
    max_requests                = 1000
    max_retries                 = 3
  }

  # Consistent hash
  consistent_hash {
    http_header_name = "x-session-id"
  }

  # Log configuration
  log_config {
    enable      = true
    sample_rate = 1.0
  }

  depends_on = [
    google_compute_health_check.main,
    google_compute_security_policy.main,
  ]
}

# Create health check
resource "google_compute_health_check" "main" {
  name               = "learning-assistant-health-check"
  check_interval_sec = 5
  timeout_sec        = 5
  healthy_threshold   = 2
  unhealthy_threshold = 3

  http_health_check {
    request_path = "/health"
    port         = "80"
    host         = "${var.subdomain}.${var.domain_name}"
  }

  log_config {
    enable = true
  }
}

# Create URL map
resource "google_compute_url_map" "main" {
  name            = "learning-assistant-url-map"
  default_service = google_compute_backend_service.main.id

  # API routing
  path_matcher {
    name            = "api-matcher"
    default_service = google_compute_backend_service.main.id

    path_rule {
      paths   = ["/api/*"]
      service = google_compute_backend_service.main.id
    }

    path_rule {
      paths   = ["/health"]
      service = google_compute_backend_service.main.id
    }

    path_rule {
      paths   = ["/metrics"]
      service = google_compute_backend_service.main.id
    }
  }

  host_rule {
    hosts        = ["api.${var.domain_name}"]
    path_matcher = "api-matcher"
  }

  host_rule {
    hosts        = ["${var.subdomain}.${var.domain_name}"]
    path_matcher = "api-matcher"
  }

  host_rule {
    hosts        = [var.domain_name]
    path_matcher = "api-matcher"
  }

  depends_on = [
    google_compute_backend_service.main,
  ]
}

# Create HTTPS proxy
resource "google_compute_target_https_proxy" "main" {
  name   = "learning-assistant-https-proxy"
  url_map = google_compute_url_map.main.id

  ssl_certificates = [
    google_compute_managed_ssl_certificate.main.id,
    google_compute_ssl_certificate.fallback.id
  ]

  # SSL policy
  ssl_policy = google_compute_ssl_policy.main.id

  depends_on = [
    google_compute_url_map.main,
    google_compute_managed_ssl_certificate.main,
    google_compute_ssl_certificate.fallback,
  ]
}

# Create HTTP proxy for redirect
resource "google_compute_target_http_proxy" "main" {
  name    = "learning-assistant-http-proxy"
  url_map = google_compute_url_map.https_redirect.id

  depends_on = [
    google_compute_url_map.https_redirect,
  ]
}

# Create URL map for HTTPS redirect
resource "google_compute_url_map" "https_redirect" {
  name = "learning-assistant-https-redirect"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

# Create SSL policy
resource "google_compute_ssl_policy" "main" {
  name            = "learning-assistant-ssl-policy"
  profile         = "MODERN"
  min_tls_version = "TLS_1_2"

  custom_features = [
    "TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384",
    "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384",
    "TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305",
    "TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305",
    "TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256",
    "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256",
    "TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA384",
    "TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA384",
    "TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA256",
    "TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256"
  ]
}

# Create global forwarding rule for HTTPS
resource "google_compute_global_forwarding_rule" "https" {
  name       = "learning-assistant-https-forwarding-rule"
  target     = google_compute_target_https_proxy.main.id
  port_range = "443"
  ip_address = google_compute_global_address.main.address

  depends_on = [
    google_compute_target_https_proxy.main,
    google_compute_global_address.main,
  ]
}

# Create global forwarding rule for HTTP
resource "google_compute_global_forwarding_rule" "http" {
  name       = "learning-assistant-http-forwarding-rule"
  target     = google_compute_target_http_proxy.main.id
  port_range = "80"
  ip_address = google_compute_global_address.main.address

  depends_on = [
    google_compute_target_http_proxy.main,
    google_compute_global_address.main,
  ]
}

# Create Cloud Armor security policy (extended)
resource "google_compute_security_policy" "advanced" {
  name        = "learning-assistant-advanced-security-policy"
  description = "Advanced security policy for learning assistant application"

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

  # Rate limiting per IP
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
    description = "Rate limit per IP"
  }

  # DDoS protection
  rule {
    action   = "rate_based_ban"
    priority = "900"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "ALL"
      rate_limit_threshold {
        count        = 10000
        interval_sec = 60
      }
      ban_duration_sec = 600
    }
    description = "DDoS protection"
  }

  # Block malicious IPs
  rule {
    action   = "deny(403)"
    priority = "800"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = [
          "192.168.1.0/24",  # Example malicious range
          "10.0.0.0/8"       # Block private networks from external
        ]
      }
    }
    description = "Block known malicious IPs"
  }

  # OWASP Top 10 protection
  rule {
    action   = "deny(403)"
    priority = "700"
    match {
      expr {
        expression = "request.headers['user-agent'].contains('sqlmap') || request.headers['user-agent'].contains('nmap') || request.headers['user-agent'].contains('nikto') || request.headers['user-agent'].contains('dirb') || request.headers['user-agent'].contains('dirbuster')"
      }
    }
    description = "Block security scanning tools"
  }

  # SQL injection protection
  rule {
    action   = "deny(403)"
    priority = "600"
    match {
      expr {
        expression = "request.url_query.matches(r'(?i)(union|select|insert|update|delete|drop|create|alter|exec|execute)\\s') || request.body.matches(r'(?i)(union|select|insert|update|delete|drop|create|alter|exec|execute)\\s')"
      }
    }
    description = "SQL injection protection"
  }

  # XSS protection
  rule {
    action   = "deny(403)"
    priority = "500"
    match {
      expr {
        expression = "request.url_query.matches(r'(?i)<script|javascript:|on\\w+\\s*=') || request.body.matches(r'(?i)<script|javascript:|on\\w+\\s*=')"
      }
    }
    description = "XSS protection"
  }

  # Path traversal protection
  rule {
    action   = "deny(403)"
    priority = "400"
    match {
      expr {
        expression = "request.url_path.matches(r'\\.\\.[\\/\\\\]') || request.url_query.matches(r'\\.\\.[\\/\\\\]')"
      }
    }
    description = "Path traversal protection"
  }

  # Geographic restriction (optional)
  dynamic "rule" {
    for_each = var.environment == "prod" ? [1] : []
    content {
      action   = "allow"
      priority = "100"
      match {
        expr {
          expression = "origin.region_code == 'US' || origin.region_code == 'CA' || origin.region_code == 'GB' || origin.region_code == 'DE' || origin.region_code == 'FR'"
        }
      }
      description = "Geographic restriction"
    }
  }

  # Adaptive protection
  adaptive_protection_config {
    layer_7_ddos_defense_config {
      enable          = true
      rule_visibility = "STANDARD"
    }
  }

  # Advanced DDoS protection
  advanced_options_config {
    json_parsing = "STANDARD"
    log_level    = "NORMAL"
  }
}

# Create Network Endpoint Group for GKE
resource "google_compute_global_network_endpoint_group" "gke_neg" {
  name                  = "learning-assistant-gke-neg"
  network_endpoint_type = "GCE_VM_IP_PORT"
  default_port          = 80
}

# Create backend service for GKE
resource "google_compute_backend_service" "gke_backend" {
  name        = "learning-assistant-gke-backend"
  protocol    = "HTTP"
  port_name   = "http"
  timeout_sec = 30

  backend {
    group           = google_compute_global_network_endpoint_group.gke_neg.id
    balancing_mode  = "RATE"
    max_rate        = 1000
    capacity_scaler = 1.0
  }

  health_checks = [google_compute_health_check.gke_health_check.id]

  # Connection draining
  connection_draining_timeout_sec = 300

  # Load balancing scheme
  load_balancing_scheme = "EXTERNAL"

  # Enable CDN
  enable_cdn = true

  cdn_policy {
    cache_mode                   = "CACHE_ALL_STATIC"
    default_ttl                  = 3600
    max_ttl                      = 86400
    client_ttl                   = 3600
    negative_caching             = true
    serve_while_stale            = 86400
    
    cache_key_policy {
      include_host         = true
      include_protocol     = true
      include_query_string = false
    }

    negative_caching_policy {
      code = 404
      ttl  = 120
    }

    negative_caching_policy {
      code = 410
      ttl  = 120
    }
  }

  # Security policy
  security_policy = google_compute_security_policy.advanced.name

  # Log configuration
  log_config {
    enable      = true
    sample_rate = 1.0
  }

  depends_on = [
    google_compute_health_check.gke_health_check,
    google_compute_security_policy.advanced,
  ]
}

# Create health check for GKE
resource "google_compute_health_check" "gke_health_check" {
  name               = "learning-assistant-gke-health-check"
  check_interval_sec = 5
  timeout_sec        = 5
  healthy_threshold   = 2
  unhealthy_threshold = 3

  http_health_check {
    request_path = "/health"
    port         = "8080"
    host         = "${var.subdomain}.${var.domain_name}"
  }

  log_config {
    enable = true
  }
}

# Create load balancer monitoring
resource "google_monitoring_alert_policy" "lb_latency" {
  display_name = "Load Balancer Latency"
  combiner     = "OR"

  conditions {
    display_name = "Load balancer latency is above 500ms"

    condition_threshold {
      filter         = "resource.type=\"https_lb_rule\" AND resource.labels.url_map_name=\"${google_compute_url_map.main.name}\""
      duration       = "300s"
      comparison     = "COMPARISON_GT"
      threshold_value = 500

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_MEAN"
        cross_series_reducer = "REDUCE_MEAN"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }

  depends_on = [
    google_compute_url_map.main,
    google_monitoring_notification_channel.email,
  ]
}

resource "google_monitoring_alert_policy" "lb_error_rate" {
  display_name = "Load Balancer Error Rate"
  combiner     = "OR"

  conditions {
    display_name = "Load balancer error rate is above 5%"

    condition_threshold {
      filter         = "resource.type=\"https_lb_rule\" AND resource.labels.url_map_name=\"${google_compute_url_map.main.name}\""
      duration       = "300s"
      comparison     = "COMPARISON_GT"
      threshold_value = 0.05

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_MEAN"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }

  depends_on = [
    google_compute_url_map.main,
    google_monitoring_notification_channel.email,
  ]
}