# Create DNS managed zone
resource "google_dns_managed_zone" "main" {
  name        = "learning-assistant-zone"
  dns_name    = "${var.domain_name}."
  description = "DNS zone for learning assistant application"

  # DNSSEC configuration
  dnssec_config {
    state         = "on"
    non_existence = "nsec3"
  }

  visibility = "public"

  # Cloud logging
  cloud_logging_config {
    enable_logging = true
  }

  depends_on = [google_project_service.required_apis]
}

# Create A record for the main domain
resource "google_dns_record_set" "main" {
  name = google_dns_managed_zone.main.dns_name
  type = "A"
  ttl  = 300

  managed_zone = google_dns_managed_zone.main.name
  rrdatas      = [google_compute_global_address.main.address]

  depends_on = [
    google_dns_managed_zone.main,
    google_compute_global_address.main,
  ]
}

# Create A record for the subdomain
resource "google_dns_record_set" "subdomain" {
  name = "${var.subdomain}.${google_dns_managed_zone.main.dns_name}"
  type = "A"
  ttl  = 300

  managed_zone = google_dns_managed_zone.main.name
  rrdatas      = [google_compute_global_address.main.address]

  depends_on = [
    google_dns_managed_zone.main,
    google_compute_global_address.main,
  ]
}

# Create A record for API subdomain
resource "google_dns_record_set" "api" {
  name = "api.${google_dns_managed_zone.main.dns_name}"
  type = "A"
  ttl  = 300

  managed_zone = google_dns_managed_zone.main.name
  rrdatas      = [google_compute_global_address.main.address]

  depends_on = [
    google_dns_managed_zone.main,
    google_compute_global_address.main,
  ]
}

# Create A record for admin subdomain
resource "google_dns_record_set" "admin" {
  name = "admin.${google_dns_managed_zone.main.dns_name}"
  type = "A"
  ttl  = 300

  managed_zone = google_dns_managed_zone.main.name
  rrdatas      = [google_compute_global_address.main.address]

  depends_on = [
    google_dns_managed_zone.main,
    google_compute_global_address.main,
  ]
}

# Create CNAME record for www
resource "google_dns_record_set" "www" {
  name = "www.${google_dns_managed_zone.main.dns_name}"
  type = "CNAME"
  ttl  = 300

  managed_zone = google_dns_managed_zone.main.name
  rrdatas      = [google_dns_managed_zone.main.dns_name]

  depends_on = [
    google_dns_managed_zone.main,
  ]
}

# Create AAAA record for IPv6 support
resource "google_dns_record_set" "ipv6" {
  count = var.environment == "prod" ? 1 : 0
  name  = google_dns_managed_zone.main.dns_name
  type  = "AAAA"
  ttl   = 300

  managed_zone = google_dns_managed_zone.main.name
  rrdatas      = ["2001:db8::1"] # Replace with actual IPv6 address

  depends_on = [
    google_dns_managed_zone.main,
  ]
}

# Create MX records for email
resource "google_dns_record_set" "mx" {
  name = google_dns_managed_zone.main.dns_name
  type = "MX"
  ttl  = 300

  managed_zone = google_dns_managed_zone.main.name
  rrdatas = [
    "1 aspmx.l.google.com.",
    "5 alt1.aspmx.l.google.com.",
    "5 alt2.aspmx.l.google.com.",
    "10 alt3.aspmx.l.google.com.",
    "10 alt4.aspmx.l.google.com."
  ]

  depends_on = [
    google_dns_managed_zone.main,
  ]
}

# Create TXT record for SPF
resource "google_dns_record_set" "spf" {
  name = google_dns_managed_zone.main.dns_name
  type = "TXT"
  ttl  = 300

  managed_zone = google_dns_managed_zone.main.name
  rrdatas      = ["\"v=spf1 include:_spf.google.com ~all\""]

  depends_on = [
    google_dns_managed_zone.main,
  ]
}

# Create TXT record for DKIM
resource "google_dns_record_set" "dkim" {
  name = "google._domainkey.${google_dns_managed_zone.main.dns_name}"
  type = "TXT"
  ttl  = 300

  managed_zone = google_dns_managed_zone.main.name
  rrdatas      = ["\"v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\""] # Replace with actual DKIM key

  depends_on = [
    google_dns_managed_zone.main,
  ]
}

# Create TXT record for DMARC
resource "google_dns_record_set" "dmarc" {
  name = "_dmarc.${google_dns_managed_zone.main.dns_name}"
  type = "TXT"
  ttl  = 300

  managed_zone = google_dns_managed_zone.main.name
  rrdatas      = ["\"v=DMARC1; p=quarantine; rua=mailto:dmarc@${var.domain_name}; ruf=mailto:dmarc@${var.domain_name}; sp=quarantine; adkim=s; aspf=s\""]

  depends_on = [
    google_dns_managed_zone.main,
  ]
}

# Create TXT record for domain verification
resource "google_dns_record_set" "domain_verification" {
  name = google_dns_managed_zone.main.dns_name
  type = "TXT"
  ttl  = 300

  managed_zone = google_dns_managed_zone.main.name
  rrdatas      = ["\"google-site-verification=abcdef123456789\""] # Replace with actual verification string

  depends_on = [
    google_dns_managed_zone.main,
  ]
}

# Create CAA record for SSL certificate authority authorization
resource "google_dns_record_set" "caa" {
  name = google_dns_managed_zone.main.dns_name
  type = "CAA"
  ttl  = 300

  managed_zone = google_dns_managed_zone.main.name
  rrdatas = [
    "0 issue \"letsencrypt.org\"",
    "0 issue \"google.com\"",
    "0 iodef \"mailto:ssl@${var.domain_name}\""
  ]

  depends_on = [
    google_dns_managed_zone.main,
  ]
}

# Create SRV record for services
resource "google_dns_record_set" "srv" {
  name = "_https._tcp.${google_dns_managed_zone.main.dns_name}"
  type = "SRV"
  ttl  = 300

  managed_zone = google_dns_managed_zone.main.name
  rrdatas      = ["0 5 443 ${var.subdomain}.${var.domain_name}."]

  depends_on = [
    google_dns_managed_zone.main,
  ]
}

# Create health check for DNS
resource "google_dns_record_set" "health_check" {
  name = "health.${google_dns_managed_zone.main.dns_name}"
  type = "A"
  ttl  = 60

  managed_zone = google_dns_managed_zone.main.name
  rrdatas      = [google_compute_global_address.main.address]

  depends_on = [
    google_dns_managed_zone.main,
    google_compute_global_address.main,
  ]
}

# Create DNS forwarding policy
resource "google_dns_policy" "main" {
  name                      = "learning-assistant-dns-policy"
  enable_inbound_forwarding = true
  enable_logging            = true

  networks {
    network_url = google_compute_network.main.id
  }

  alternative_name_servers {
    target_name_servers {
      ipv4_address    = "8.8.8.8"
      forwarding_path = "default"
    }
    target_name_servers {
      ipv4_address    = "8.8.4.4"
      forwarding_path = "default"
    }
  }

  depends_on = [
    google_project_service.required_apis,
    google_compute_network.main,
  ]
}

# Create DNS peering for cross-project access
resource "google_dns_peering_zone" "cross_project" {
  count       = var.environment == "prod" ? 1 : 0
  name        = "learning-assistant-peering-zone"
  dns_name    = "cross-project.${var.domain_name}."
  description = "DNS peering zone for cross-project access"

  target_network {
    network_url = google_compute_network.main.id
  }

  depends_on = [
    google_dns_managed_zone.main,
    google_compute_network.main,
  ]
}

# Create DNS response policy for security
resource "google_dns_response_policy" "security" {
  response_policy_name = "learning-assistant-security-policy"
  description          = "DNS response policy for security filtering"

  networks {
    network_url = google_compute_network.main.id
  }

  depends_on = [
    google_project_service.required_apis,
    google_compute_network.main,
  ]
}

# Create DNS response policy rule for malware domains
resource "google_dns_response_policy_rule" "malware_block" {
  response_policy = google_dns_response_policy.security.response_policy_name
  rule_name       = "malware-block"
  dns_name        = "malware.example.com."

  local_data {
    local_datas {
      name    = "malware.example.com."
      type    = "A"
      ttl     = 300
      rrdatas = ["127.0.0.1"]
    }
  }

  depends_on = [
    google_dns_response_policy.security,
  ]
}

# Create DNS monitoring and alerting
resource "google_monitoring_alert_policy" "dns_queries" {
  display_name = "DNS Query Volume"
  combiner     = "OR"

  conditions {
    display_name = "DNS query volume is unusually high"

    condition_threshold {
      filter         = "resource.type=\"dns_query\" AND resource.labels.zone_name=\"${google_dns_managed_zone.main.name}\""
      duration       = "300s"
      comparison     = "COMPARISON_GT"
      threshold_value = 1000

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

  depends_on = [
    google_dns_managed_zone.main,
    google_monitoring_notification_channel.email,
  ]
}

resource "google_monitoring_alert_policy" "dns_errors" {
  display_name = "DNS Query Errors"
  combiner     = "OR"

  conditions {
    display_name = "DNS query error rate is above 5%"

    condition_threshold {
      filter         = "resource.type=\"dns_query\" AND resource.labels.zone_name=\"${google_dns_managed_zone.main.name}\""
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
    google_dns_managed_zone.main,
    google_monitoring_notification_channel.email,
  ]
}

# Create DNS uptime check
resource "google_monitoring_uptime_check_config" "dns_uptime" {
  display_name = "DNS Uptime Check"
  timeout      = "10s"
  period       = "300s"

  http_check {
    path         = "/"
    port         = 443
    use_ssl      = true
    validate_ssl = true
    mask_headers = false
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = "${var.subdomain}.${var.domain_name}"
    }
  }

  content_matchers {
    content = "Learning Assistant"
    matcher = "CONTAINS_STRING"
  }

  selected_regions = ["USA", "EUROPE", "ASIA_PACIFIC"]

  depends_on = [
    google_dns_record_set.subdomain,
  ]
}

# Create DNS dashboard
resource "google_monitoring_dashboard" "dns_dashboard" {
  dashboard_json = jsonencode({
    displayName = "Learning Assistant DNS Dashboard"
    mosaicLayout = {
      tiles = [
        {
          width  = 6
          height = 4
          widget = {
            title = "DNS Query Volume"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"dns_query\" AND resource.labels.zone_name=\"${google_dns_managed_zone.main.name}\""
                      aggregation = {
                        alignmentPeriod     = "300s"
                        perSeriesAligner    = "ALIGN_RATE"
                        crossSeriesReducer  = "REDUCE_SUM"
                      }
                    }
                  }
                }
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Queries/sec"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          width  = 6
          height = 4
          widget = {
            title = "DNS Query Errors"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"dns_query\" AND resource.labels.zone_name=\"${google_dns_managed_zone.main.name}\""
                      aggregation = {
                        alignmentPeriod     = "300s"
                        perSeriesAligner    = "ALIGN_RATE"
                        crossSeriesReducer  = "REDUCE_MEAN"
                      }
                    }
                  }
                }
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Error Rate"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          width  = 6
          height = 4
          widget = {
            title = "DNS Response Time"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"dns_query\" AND resource.labels.zone_name=\"${google_dns_managed_zone.main.name}\""
                      aggregation = {
                        alignmentPeriod     = "300s"
                        perSeriesAligner    = "ALIGN_MEAN"
                        crossSeriesReducer  = "REDUCE_MEAN"
                      }
                    }
                  }
                }
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Response Time (ms)"
                scale = "LINEAR"
              }
            }
          }
        },
        {
          width  = 6
          height = 4
          widget = {
            title = "DNS Query Types"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"dns_query\" AND resource.labels.zone_name=\"${google_dns_managed_zone.main.name}\""
                      aggregation = {
                        alignmentPeriod     = "300s"
                        perSeriesAligner    = "ALIGN_RATE"
                        crossSeriesReducer  = "REDUCE_SUM"
                        groupByFields       = ["metric.labels.query_type"]
                      }
                    }
                  }
                }
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Queries by Type"
                scale = "LINEAR"
              }
            }
          }
        }
      ]
    }
  })

  depends_on = [
    google_dns_managed_zone.main,
  ]
}