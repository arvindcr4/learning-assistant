# ==============================================================================
# SYNTHETIC MONITORING
# User Experience and Uptime Monitoring
# ==============================================================================

# ==============================================================================
# BLACKBOX EXPORTER CONFIGURATION
# ==============================================================================

resource "kubernetes_config_map" "blackbox_exporter_config" {
  metadata {
    name      = "blackbox-exporter-config"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  data = {
    "blackbox.yml" = templatefile("${path.module}/configs/blackbox-exporter.yml", {
      environment = var.environment
      domain_name = var.domain_name
    })
  }
}

# ==============================================================================
# BLACKBOX EXPORTER DEPLOYMENT
# ==============================================================================

resource "kubernetes_deployment" "blackbox_exporter" {
  metadata {
    name      = "blackbox-exporter"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = merge(local.common_labels, {
      app = "blackbox-exporter"
    })
  }

  spec {
    replicas = var.high_availability ? 2 : 1

    selector {
      match_labels = {
        app = "blackbox-exporter"
      }
    }

    template {
      metadata {
        labels = {
          app = "blackbox-exporter"
        }
        annotations = {
          "prometheus.io/scrape" = "true"
          "prometheus.io/port" = "9115"
          "prometheus.io/path" = "/metrics"
        }
      }

      spec {
        container {
          name  = "blackbox-exporter"
          image = "prom/blackbox-exporter:latest"

          args = [
            "--config.file=/etc/blackbox_exporter/config.yml",
            "--log.level=info",
            "--web.listen-address=:9115"
          ]

          port {
            container_port = 9115
            name          = "http"
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }

          volume_mount {
            name       = "blackbox-config"
            mount_path = "/etc/blackbox_exporter"
            read_only  = true
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = 9115
            }
            initial_delay_seconds = 30
            period_seconds        = 30
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = 9115
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }
        }

        volume {
          name = "blackbox-config"
          config_map {
            name = kubernetes_config_map.blackbox_exporter_config.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "blackbox_exporter_service" {
  metadata {
    name      = "blackbox-exporter"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = merge(local.common_labels, {
      app = "blackbox-exporter"
    })
  }

  spec {
    selector = {
      app = "blackbox-exporter"
    }

    port {
      name        = "http"
      port        = 9115
      target_port = 9115
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }
}

# ==============================================================================
# SYNTHETIC MONITORING PROBES
# ==============================================================================

resource "kubernetes_manifest" "synthetic_monitoring_probes" {
  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "Probe"
    metadata = {
      name      = "synthetic-monitoring-probes"
      namespace = kubernetes_namespace.monitoring.metadata[0].name
      labels = merge(local.common_labels, {
        app = "synthetic-monitoring"
      })
    }
    spec = {
      prober = {
        url = "blackbox-exporter.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:9115"
      }
      targets = {
        staticConfig = {
          static = [
            "https://${var.domain_name}",
            "https://${var.domain_name}/api/health",
            "https://${var.domain_name}/api/learning/session",
            "https://grafana.${var.domain_name}",
            "https://prometheus.${var.domain_name}",
            "https://alertmanager.${var.domain_name}",
            "https://jaeger.${var.domain_name}",
            "https://kibana.${var.domain_name}"
          ]
        }
      }
      module = "http_2xx"
      interval = "30s"
      scrapeTimeout = "15s"
    }
  }

  depends_on = [
    kubernetes_service.blackbox_exporter_service
  ]
}

# ==============================================================================
# WEB VITALS MONITORING
# ==============================================================================

resource "kubernetes_deployment" "web_vitals_monitor" {
  metadata {
    name      = "web-vitals-monitor"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = merge(local.common_labels, {
      app = "web-vitals-monitor"
    })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "web-vitals-monitor"
      }
    }

    template {
      metadata {
        labels = {
          app = "web-vitals-monitor"
        }
        annotations = {
          "prometheus.io/scrape" = "true"
          "prometheus.io/port" = "8080"
          "prometheus.io/path" = "/metrics"
        }
      }

      spec {
        container {
          name  = "web-vitals-monitor"
          image = "busybox:latest"
          
          command = ["/bin/sh"]
          args = [
            "-c",
            <<-EOT
            while true; do
              echo "Web vitals monitoring placeholder - implement Lighthouse CI or similar"
              sleep 300
            done
            EOT
          ]

          port {
            container_port = 8080
            name          = "metrics"
          }

          env {
            name  = "TARGET_URL"
            value = "https://${var.domain_name}"
          }

          env {
            name  = "ENVIRONMENT"
            value = var.environment
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "web_vitals_monitor_service" {
  metadata {
    name      = "web-vitals-monitor"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  spec {
    selector = {
      app = "web-vitals-monitor"
    }

    port {
      name        = "metrics"
      port        = 8080
      target_port = 8080
    }

    type = "ClusterIP"
  }
}

# ==============================================================================
# UPTIME ROBOT ALTERNATIVE
# ==============================================================================

resource "kubernetes_deployment" "uptime_monitor" {
  metadata {
    name      = "uptime-monitor"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = merge(local.common_labels, {
      app = "uptime-monitor"
    })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "uptime-monitor"
      }
    }

    template {
      metadata {
        labels = {
          app = "uptime-monitor"
        }
        annotations = {
          "prometheus.io/scrape" = "true"
          "prometheus.io/port" = "8081"
          "prometheus.io/path" = "/metrics"
        }
      }

      spec {
        container {
          name  = "uptime-monitor"
          image = "alpine/curl:latest"
          
          command = ["/bin/sh"]
          args = [
            "-c",
            templatefile("${path.module}/scripts/uptime-monitor.sh", {
              domain_name = var.domain_name
              environment = var.environment
            })
          ]

          port {
            container_port = 8081
            name          = "metrics"
          }

          env {
            name  = "TARGETS"
            value = jsonencode([
              "https://${var.domain_name}",
              "https://${var.domain_name}/api/health",
              "https://${var.domain_name}/api/learning/session"
            ])
          }

          env {
            name  = "CHECK_INTERVAL"
            value = "30"
          }

          resources {
            requests = {
              cpu    = "50m"
              memory = "64Mi"
            }
            limits = {
              cpu    = "200m"
              memory = "128Mi"
            }
          }

          volume_mount {
            name       = "uptime-scripts"
            mount_path = "/scripts"
            read_only  = true
          }
        }

        volume {
          name = "uptime-scripts"
          config_map {
            name         = kubernetes_config_map.uptime_monitor_scripts.metadata[0].name
            default_mode = "0755"
          }
        }
      }
    }
  }
}

resource "kubernetes_config_map" "uptime_monitor_scripts" {
  metadata {
    name      = "uptime-monitor-scripts"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  data = {
    "uptime-monitor.sh" = templatefile("${path.module}/scripts/uptime-monitor.sh", {
      domain_name = var.domain_name
      environment = var.environment
    })
    "metrics-server.py" = file("${path.module}/scripts/metrics-server.py")
  }
}

resource "kubernetes_service" "uptime_monitor_service" {
  metadata {
    name      = "uptime-monitor"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  spec {
    selector = {
      app = "uptime-monitor"
    }

    port {
      name        = "metrics"
      port        = 8081
      target_port = 8081
    }

    type = "ClusterIP"
  }
}

# ==============================================================================
# LIGHTHOUSE CI MONITORING
# ==============================================================================

resource "kubernetes_deployment" "lighthouse_ci" {
  metadata {
    name      = "lighthouse-ci"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = merge(local.common_labels, {
      app = "lighthouse-ci"
    })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "lighthouse-ci"
      }
    }

    template {
      metadata {
        labels = {
          app = "lighthouse-ci"
        }
        annotations = {
          "prometheus.io/scrape" = "true"
          "prometheus.io/port" = "9001"
          "prometheus.io/path" = "/metrics"
        }
      }

      spec {
        container {
          name  = "lighthouse-ci"
          image = "patrickhulce/lhci-server:latest"

          env {
            name  = "LHCI_STORAGE__SQL_DATABASE_URL"
            value = "sqlite:///data/db.sql"
          }

          env {
            name  = "LHCI_SERVER_PORT"
            value = "9001"
          }

          port {
            container_port = 9001
            name          = "http"
          }

          resources {
            requests = {
              cpu    = "200m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "1000m"
              memory = "1Gi"
            }
          }

          volume_mount {
            name       = "lighthouse-data"
            mount_path = "/data"
          }
        }

        volume {
          name = "lighthouse-data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.lighthouse_storage.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_persistent_volume_claim" "lighthouse_storage" {
  metadata {
    name      = "lighthouse-storage"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  spec {
    access_modes       = ["ReadWriteOnce"]
    storage_class_name = kubernetes_storage_class.monitoring_ssd.metadata[0].name
    
    resources {
      requests = {
        storage = "5Gi"
      }
    }
  }
}

resource "kubernetes_service" "lighthouse_ci_service" {
  metadata {
    name      = "lighthouse-ci"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  spec {
    selector = {
      app = "lighthouse-ci"
    }

    port {
      name        = "http"
      port        = 9001
      target_port = 9001
    }

    type = "ClusterIP"
  }
}

# ==============================================================================
# SYNTHETIC MONITORING SERVICE MONITORS
# ==============================================================================

resource "kubernetes_manifest" "blackbox_exporter_service_monitor" {
  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "ServiceMonitor"
    metadata = {
      name      = "blackbox-exporter-service-monitor"
      namespace = kubernetes_namespace.monitoring.metadata[0].name
      labels = merge(local.common_labels, {
        app = "blackbox-exporter"
        team = "monitoring"
      })
    }
    spec = {
      selector = {
        matchLabels = {
          app = "blackbox-exporter"
        }
      }
      endpoints = [
        {
          port = "http"
          interval = "30s"
          path = "/metrics"
        }
      ]
    }
  }

  depends_on = [
    kubernetes_service.blackbox_exporter_service
  ]
}

resource "kubernetes_manifest" "web_vitals_service_monitor" {
  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "ServiceMonitor"
    metadata = {
      name      = "web-vitals-service-monitor"
      namespace = kubernetes_namespace.monitoring.metadata[0].name
      labels = merge(local.common_labels, {
        app = "web-vitals-monitor"
        team = "monitoring"
      })
    }
    spec = {
      selector = {
        matchLabels = {
          app = "web-vitals-monitor"
        }
      }
      endpoints = [
        {
          port = "metrics"
          interval = "60s"
          path = "/metrics"
        }
      ]
    }
  }

  depends_on = [
    kubernetes_service.web_vitals_monitor_service
  ]
}

resource "kubernetes_manifest" "uptime_monitor_service_monitor" {
  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "ServiceMonitor"
    metadata = {
      name      = "uptime-monitor-service-monitor"
      namespace = kubernetes_namespace.monitoring.metadata[0].name
      labels = merge(local.common_labels, {
        app = "uptime-monitor"
        team = "monitoring"
      })
    }
    spec = {
      selector = {
        matchLabels = {
          app = "uptime-monitor"
        }
      }
      endpoints = [
        {
          port = "metrics"
          interval = "30s"
          path = "/metrics"
        }
      ]
    }
  }

  depends_on = [
    kubernetes_service.uptime_monitor_service
  ]
}

# ==============================================================================
# SYNTHETIC MONITORING INGRESS
# ==============================================================================

resource "kubernetes_ingress_v1" "lighthouse_ci_ingress" {
  metadata {
    name      = "lighthouse-ci-ingress"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    annotations = {
      "kubernetes.io/ingress.class"              = "nginx"
      "cert-manager.io/cluster-issuer"           = "letsencrypt-prod"
      "nginx.ingress.kubernetes.io/ssl-redirect" = "true"
      "nginx.ingress.kubernetes.io/auth-type"    = "basic"
      "nginx.ingress.kubernetes.io/auth-secret"  = "monitoring-auth"
      "nginx.ingress.kubernetes.io/auth-realm"   = "Authentication Required"
    }
  }

  spec {
    tls {
      hosts       = ["lighthouse.${var.domain_name}"]
      secret_name = "lighthouse-tls"
    }

    rule {
      host = "lighthouse.${var.domain_name}"
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = kubernetes_service.lighthouse_ci_service.metadata[0].name
              port {
                number = 9001
              }
            }
          }
        }
      }
    }
  }
}

# ==============================================================================
# OUTPUTS
# ==============================================================================

output "blackbox_exporter_url" {
  description = "Blackbox Exporter URL"
  value       = "http://blackbox-exporter.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:9115"
}

output "lighthouse_ci_url" {
  description = "Lighthouse CI URL"
  value       = "https://lighthouse.${var.domain_name}"
}

output "synthetic_monitoring_targets" {
  description = "Synthetic monitoring targets"
  value = [
    "https://${var.domain_name}",
    "https://${var.domain_name}/api/health",
    "https://${var.domain_name}/api/learning/session",
    "https://grafana.${var.domain_name}",
    "https://prometheus.${var.domain_name}",
    "https://alertmanager.${var.domain_name}",
    "https://jaeger.${var.domain_name}",
    "https://kibana.${var.domain_name}"
  ]
}