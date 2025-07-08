# ==============================================================================
# GRAFANA MONITORING DASHBOARDS
# Unified Observability Platform with Custom Dashboards
# ==============================================================================

# ==============================================================================
# GRAFANA DEPLOYMENT
# ==============================================================================

resource "helm_release" "grafana" {
  name       = "grafana"
  repository = "https://grafana.github.io/helm-charts"
  chart      = "grafana"
  version    = "7.0.0"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name

  values = [
    templatefile("${path.module}/helm-values/grafana.yml", {
      environment           = var.environment
      domain_name          = var.domain_name
      storage_class        = kubernetes_storage_class.monitoring_ssd.metadata[0].name
      storage_size         = local.grafana_config.storage_size
      replica_count        = local.grafana_config.replica_count
      admin_password       = random_password.grafana_admin_password.result
      prometheus_url       = "http://prometheus-operated.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:9090"
      victoria_metrics_url = "http://victoria-metrics.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:8428"
      jaeger_url          = "http://jaeger-query.${kubernetes_namespace.tracing.metadata[0].name}.svc.cluster.local:16686"
      elasticsearch_url   = "http://elasticsearch.${kubernetes_namespace.logging.metadata[0].name}.svc.cluster.local:9200"
      high_availability   = var.high_availability
      notification_email  = var.notification_email
      slack_webhook_url   = var.slack_webhook_url
    })
  ]

  depends_on = [
    kubernetes_namespace.monitoring,
    kubernetes_storage_class.monitoring_ssd,
    kubernetes_secret.monitoring_secrets
  ]
}

# ==============================================================================
# GRAFANA CONFIGURATION
# ==============================================================================

resource "kubernetes_config_map" "grafana_config" {
  metadata {
    name      = "grafana-config"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  data = {
    "grafana.ini" = templatefile("${path.module}/configs/grafana.ini.tpl", {
      domain_name = var.domain_name
      environment = var.environment
    })
  }
}

# ==============================================================================
# GRAFANA DATASOURCES
# ==============================================================================

resource "kubernetes_config_map" "grafana_datasources" {
  metadata {
    name      = "grafana-datasources"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      grafana_datasource = "1"
    }
  }

  data = {
    "datasources.yaml" = templatefile("${path.module}/configs/grafana-datasources.yml", {
      prometheus_url       = "http://prometheus-operated.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:9090"
      victoria_metrics_url = "http://victoria-metrics.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:8428"
      jaeger_url          = "http://jaeger-query.${kubernetes_namespace.tracing.metadata[0].name}.svc.cluster.local:16686"
      elasticsearch_url   = "http://elasticsearch.${kubernetes_namespace.logging.metadata[0].name}.svc.cluster.local:9200"
      environment         = var.environment
    })
  }
}

# ==============================================================================
# GRAFANA DASHBOARD PROVIDERS
# ==============================================================================

resource "kubernetes_config_map" "grafana_dashboard_providers" {
  metadata {
    name      = "grafana-dashboard-providers"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      grafana_dashboard = "1"
    }
  }

  data = {
    "providers.yaml" = templatefile("${path.module}/configs/grafana-dashboard-providers.yml", {
      environment = var.environment
    })
  }
}

# ==============================================================================
# GRAFANA DASHBOARDS
# ==============================================================================

# Application Performance Dashboard
resource "kubernetes_config_map" "grafana_dashboard_app_performance" {
  metadata {
    name      = "grafana-dashboard-app-performance"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      grafana_dashboard = "1"
    }
  }

  data = {
    "app-performance.json" = file("${path.module}/dashboards/app-performance.json")
  }
}

# Infrastructure Dashboard
resource "kubernetes_config_map" "grafana_dashboard_infrastructure" {
  metadata {
    name      = "grafana-dashboard-infrastructure"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      grafana_dashboard = "1"
    }
  }

  data = {
    "infrastructure.json" = file("${path.module}/dashboards/infrastructure.json")
  }
}

# Learning Analytics Dashboard
resource "kubernetes_config_map" "grafana_dashboard_learning_analytics" {
  metadata {
    name      = "grafana-dashboard-learning-analytics"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      grafana_dashboard = "1"
    }
  }

  data = {
    "learning-analytics.json" = file("${path.module}/dashboards/learning-analytics.json")
  }
}

# Security Monitoring Dashboard
resource "kubernetes_config_map" "grafana_dashboard_security" {
  metadata {
    name      = "grafana-dashboard-security"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      grafana_dashboard = "1"
    }
  }

  data = {
    "security-monitoring.json" = file("${path.module}/dashboards/security-monitoring.json")
  }
}

# Business Intelligence Dashboard
resource "kubernetes_config_map" "grafana_dashboard_business" {
  metadata {
    name      = "grafana-dashboard-business"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      grafana_dashboard = "1"
    }
  }

  data = {
    "business-intelligence.json" = file("${path.module}/dashboards/business-intelligence.json")
  }
}

# SLO/SLI Dashboard
resource "kubernetes_config_map" "grafana_dashboard_slo" {
  metadata {
    name      = "grafana-dashboard-slo"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      grafana_dashboard = "1"
    }
  }

  data = {
    "slo-dashboard.json" = file("${path.module}/dashboards/slo-dashboard.json")
  }
}

# Cost Monitoring Dashboard
resource "kubernetes_config_map" "grafana_dashboard_cost" {
  metadata {
    name      = "grafana-dashboard-cost"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      grafana_dashboard = "1"
    }
  }

  data = {
    "cost-monitoring.json" = file("${path.module}/dashboards/cost-monitoring.json")
  }
}

# Synthetic Monitoring Dashboard
resource "kubernetes_config_map" "grafana_dashboard_synthetic" {
  metadata {
    name      = "grafana-dashboard-synthetic"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      grafana_dashboard = "1"
    }
  }

  data = {
    "synthetic-monitoring.json" = file("${path.module}/dashboards/synthetic-monitoring.json")
  }
}

# ==============================================================================
# GRAFANA ALERT RULES
# ==============================================================================

resource "kubernetes_config_map" "grafana_alert_rules" {
  metadata {
    name      = "grafana-alert-rules"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  data = {
    "alert-rules.yaml" = templatefile("${path.module}/configs/grafana-alert-rules.yml", {
      environment        = var.environment
      notification_email = var.notification_email
      slack_webhook_url  = var.slack_webhook_url
    })
  }
}

# ==============================================================================
# GRAFANA NOTIFICATION CHANNELS
# ==============================================================================

resource "kubernetes_config_map" "grafana_notification_channels" {
  metadata {
    name      = "grafana-notification-channels"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  data = {
    "notification-channels.yaml" = templatefile("${path.module}/configs/grafana-notification-channels.yml", {
      notification_email        = var.notification_email
      slack_webhook_url         = var.slack_webhook_url
      pagerduty_integration_key = var.pagerduty_integration_key
      environment              = var.environment
    })
  }
}

# ==============================================================================
# GRAFANA SERVICE
# ==============================================================================

resource "kubernetes_service" "grafana_service" {
  metadata {
    name      = "grafana-service"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = merge(local.common_labels, {
      app = "grafana"
    })
  }

  spec {
    selector = {
      "app.kubernetes.io/name"     = "grafana"
      "app.kubernetes.io/instance" = "grafana"
    }

    port {
      name        = "service"
      port        = 80
      target_port = 3000
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }
}

# ==============================================================================
# GRAFANA INGRESS
# ==============================================================================

resource "kubernetes_ingress_v1" "grafana_ingress" {
  metadata {
    name      = "grafana-ingress"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    annotations = {
      "kubernetes.io/ingress.class"              = "nginx"
      "cert-manager.io/cluster-issuer"           = "letsencrypt-prod"
      "nginx.ingress.kubernetes.io/ssl-redirect" = "true"
      "nginx.ingress.kubernetes.io/rewrite-target" = "/"
    }
  }

  spec {
    tls {
      hosts       = ["grafana.${var.domain_name}"]
      secret_name = "grafana-tls"
    }

    rule {
      host = "grafana.${var.domain_name}"
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = kubernetes_service.grafana_service.metadata[0].name
              port {
                number = 80
              }
            }
          }
        }
      }
    }
  }
}

# ==============================================================================
# GRAFANA IMAGE RENDERER
# ==============================================================================

resource "kubernetes_deployment" "grafana_image_renderer" {
  metadata {
    name      = "grafana-image-renderer"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = merge(local.common_labels, {
      app = "grafana-image-renderer"
    })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "grafana-image-renderer"
      }
    }

    template {
      metadata {
        labels = {
          app = "grafana-image-renderer"
        }
      }

      spec {
        container {
          name  = "grafana-image-renderer"
          image = "grafana/grafana-image-renderer:latest"

          port {
            container_port = 8081
          }

          env {
            name  = "ENABLE_METRICS"
            value = "true"
          }

          env {
            name  = "HTTP_PORT"
            value = "8081"
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

          security_context {
            run_as_user     = 1000
            run_as_group    = 1000
            run_as_non_root = true
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "grafana_image_renderer_service" {
  metadata {
    name      = "grafana-image-renderer"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  spec {
    selector = {
      app = "grafana-image-renderer"
    }

    port {
      port        = 8081
      target_port = 8081
    }
  }
}

# ==============================================================================
# OUTPUTS
# ==============================================================================

output "grafana_service_name" {
  description = "Grafana service name"
  value       = kubernetes_service.grafana_service.metadata[0].name
}

output "grafana_url" {
  description = "Grafana URL"
  value       = "https://grafana.${var.domain_name}"
}

output "grafana_namespace" {
  description = "Grafana namespace"
  value       = kubernetes_namespace.monitoring.metadata[0].name
}

output "grafana_admin_username" {
  description = "Grafana admin username"
  value       = "admin"
}

output "grafana_admin_password" {
  description = "Grafana admin password"
  value       = random_password.grafana_admin_password.result
  sensitive   = true
}