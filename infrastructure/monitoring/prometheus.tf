# ==============================================================================
# PROMETHEUS MONITORING DEPLOYMENT
# Scalable Prometheus Setup with High Availability
# ==============================================================================

# ==============================================================================
# PROMETHEUS OPERATOR
# ==============================================================================

resource "helm_release" "prometheus_operator" {
  name       = "prometheus-operator"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  version    = "57.0.0"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name

  values = [
    templatefile("${path.module}/helm-values/prometheus-operator.yml", {
      environment           = var.environment
      cluster_name         = var.cluster_name
      domain_name          = var.domain_name
      storage_class        = kubernetes_storage_class.monitoring_ssd.metadata[0].name
      prometheus_replicas  = local.prometheus_config.replica_count
      prometheus_retention = local.prometheus_config.retention_time
      prometheus_storage   = local.prometheus_config.storage_size
      grafana_replicas     = local.grafana_config.replica_count
      grafana_storage      = local.grafana_config.storage_size
      notification_email   = var.notification_email
      slack_webhook_url    = var.slack_webhook_url
      high_availability    = var.high_availability
    })
  ]

  depends_on = [
    kubernetes_namespace.monitoring,
    kubernetes_storage_class.monitoring_ssd,
    kubernetes_secret.monitoring_secrets
  ]
}

# ==============================================================================
# PROMETHEUS CONFIGURATION
# ==============================================================================

resource "kubernetes_config_map" "prometheus_additional_config" {
  metadata {
    name      = "prometheus-additional-config"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  data = {
    "additional-scrape-configs.yaml" = templatefile("${path.module}/configs/additional-scrape-configs.yml", {
      environment = var.environment
      region      = var.region
    })
  }
}

# ==============================================================================
# PROMETHEUS RULES
# ==============================================================================

resource "kubernetes_config_map" "prometheus_rules" {
  for_each = fileset("${path.module}/rules", "*.yml")

  metadata {
    name      = "prometheus-rules-${replace(each.key, ".yml", "")}"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      prometheus = "kube-prometheus"
      role       = "alert-rules"
    }
  }

  data = {
    "${each.key}" = file("${path.module}/rules/${each.key}")
  }
}

# ==============================================================================
# PROMETHEUS CUSTOM RESOURCE
# ==============================================================================

resource "kubernetes_manifest" "prometheus_instance" {
  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "Prometheus"
    metadata = {
      name      = "prometheus-monitoring"
      namespace = kubernetes_namespace.monitoring.metadata[0].name
      labels = merge(local.common_labels, {
        app = "prometheus"
      })
    }
    spec = {
      serviceAccountName = "prometheus-kube-prometheus-prometheus"
      serviceMonitorSelector = {
        matchLabels = {
          team = "monitoring"
        }
      }
      ruleSelector = {
        matchLabels = {
          prometheus = "kube-prometheus"
          role       = "alert-rules"
        }
      }
      retention = local.prometheus_config.retention_time
      replicas  = local.prometheus_config.replica_count
      
      resources = {
        requests = {
          cpu    = local.prometheus_config.cpu_request
          memory = local.prometheus_config.memory_request
        }
        limits = {
          cpu    = local.prometheus_config.cpu_limit
          memory = local.prometheus_config.memory_limit
        }
      }

      storage = {
        volumeClaimTemplate = {
          spec = {
            storageClassName = kubernetes_storage_class.monitoring_ssd.metadata[0].name
            accessModes     = ["ReadWriteOnce"]
            resources = {
              requests = {
                storage = local.prometheus_config.storage_size
              }
            }
          }
        }
      }

      securityContext = {
        fsGroup      = 2000
        runAsNonRoot = true
        runAsUser    = 1000
      }

      additionalScrapeConfigs = {
        name = kubernetes_config_map.prometheus_additional_config.metadata[0].name
        key  = "additional-scrape-configs.yaml"
      }

      remoteWrite = [
        {
          url = "http://victoria-metrics.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:8428/api/v1/write"
          queueConfig = {
            maxSamplesPerSend = 1000
            maxShards         = 200
            capacity          = 2500
          }
        }
      ]

      remoteRead = [
        {
          url        = "http://victoria-metrics.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:8428/api/v1/read"
          readRecent = true
        }
      ]

      alerting = {
        alertmanagers = [
          {
            namespace = kubernetes_namespace.monitoring.metadata[0].name
            name      = "alertmanager-operated"
            port      = "web"
          }
        ]
      }

      portName = "web"
    }
  }

  depends_on = [
    helm_release.prometheus_operator,
    kubernetes_config_map.prometheus_additional_config
  ]
}

# ==============================================================================
# VICTORIA METRICS (LONG-TERM STORAGE)
# ==============================================================================

resource "helm_release" "victoria_metrics" {
  name       = "victoria-metrics"
  repository = "https://victoriametrics.github.io/helm-charts"
  chart      = "victoria-metrics-single"
  version    = "0.9.0"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name

  values = [
    templatefile("${path.module}/helm-values/victoria-metrics.yml", {
      storage_class     = kubernetes_storage_class.monitoring_ssd.metadata[0].name
      retention_months  = var.retention_days / 30
      storage_size      = var.environment == "prod" ? "200Gi" : "100Gi"
      replica_count     = var.high_availability ? 2 : 1
    })
  ]

  depends_on = [
    kubernetes_namespace.monitoring,
    kubernetes_storage_class.monitoring_ssd
  ]
}

# ==============================================================================
# NODE EXPORTER
# ==============================================================================

resource "helm_release" "node_exporter" {
  name       = "node-exporter"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "prometheus-node-exporter"
  version    = "4.24.0"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name

  values = [
    templatefile("${path.module}/helm-values/node-exporter.yml", {
      environment = var.environment
    })
  ]

  depends_on = [
    kubernetes_namespace.monitoring
  ]
}

# ==============================================================================
# KUBE STATE METRICS
# ==============================================================================

resource "helm_release" "kube_state_metrics" {
  name       = "kube-state-metrics"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-state-metrics"
  version    = "5.15.0"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name

  values = [
    templatefile("${path.module}/helm-values/kube-state-metrics.yml", {
      environment = var.environment
    })
  ]

  depends_on = [
    kubernetes_namespace.monitoring
  ]
}

# ==============================================================================
# POSTGRES EXPORTER
# ==============================================================================

resource "helm_release" "postgres_exporter" {
  name       = "postgres-exporter"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "prometheus-postgres-exporter"
  version    = "5.0.0"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name

  values = [
    templatefile("${path.module}/helm-values/postgres-exporter.yml", {
      environment = var.environment
      # Database connection details will be provided via secrets
    })
  ]

  depends_on = [
    kubernetes_namespace.monitoring
  ]
}

# ==============================================================================
# REDIS EXPORTER
# ==============================================================================

resource "helm_release" "redis_exporter" {
  name       = "redis-exporter"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "prometheus-redis-exporter"
  version    = "6.0.0"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name

  values = [
    templatefile("${path.module}/helm-values/redis-exporter.yml", {
      environment = var.environment
    })
  ]

  depends_on = [
    kubernetes_namespace.monitoring
  ]
}

# ==============================================================================
# BLACKBOX EXPORTER (SYNTHETIC MONITORING)
# ==============================================================================

resource "helm_release" "blackbox_exporter" {
  name       = "blackbox-exporter"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "prometheus-blackbox-exporter"
  version    = "8.8.0"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name

  values = [
    templatefile("${path.module}/helm-values/blackbox-exporter.yml", {
      environment = var.environment
      domain_name = var.domain_name
    })
  ]

  depends_on = [
    kubernetes_namespace.monitoring
  ]
}

# ==============================================================================
# PROMETHEUS SERVICES
# ==============================================================================

resource "kubernetes_service" "prometheus_service" {
  metadata {
    name      = "prometheus-service"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = merge(local.common_labels, {
      app = "prometheus"
    })
  }

  spec {
    selector = {
      app = "prometheus"
    }

    port {
      name        = "web"
      port        = 9090
      target_port = 9090
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }
}

# ==============================================================================
# INGRESS CONFIGURATION
# ==============================================================================

resource "kubernetes_ingress_v1" "prometheus_ingress" {
  metadata {
    name      = "prometheus-ingress"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    annotations = {
      "kubernetes.io/ingress.class"                = "nginx"
      "cert-manager.io/cluster-issuer"             = "letsencrypt-prod"
      "nginx.ingress.kubernetes.io/ssl-redirect"   = "true"
      "nginx.ingress.kubernetes.io/auth-type"      = "basic"
      "nginx.ingress.kubernetes.io/auth-secret"    = "monitoring-auth"
      "nginx.ingress.kubernetes.io/auth-realm"     = "Authentication Required"
    }
  }

  spec {
    tls {
      hosts       = ["prometheus.${var.domain_name}"]
      secret_name = "prometheus-tls"
    }

    rule {
      host = "prometheus.${var.domain_name}"
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = kubernetes_service.prometheus_service.metadata[0].name
              port {
                number = 9090
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

output "prometheus_service_name" {
  description = "Prometheus service name"
  value       = kubernetes_service.prometheus_service.metadata[0].name
}

output "prometheus_url" {
  description = "Prometheus URL"
  value       = "https://prometheus.${var.domain_name}"
}

output "prometheus_namespace" {
  description = "Prometheus namespace"
  value       = kubernetes_namespace.monitoring.metadata[0].name
}

output "victoria_metrics_url" {
  description = "Victoria Metrics URL"
  value       = "http://victoria-metrics.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:8428"
}