# ==============================================================================
# JAEGER DISTRIBUTED TRACING
# OpenTelemetry Compatible Distributed Tracing Platform
# ==============================================================================

# ==============================================================================
# JAEGER OPERATOR
# ==============================================================================

resource "helm_release" "jaeger_operator" {
  name       = "jaeger-operator"
  repository = "https://jaegertracing.github.io/helm-charts"
  chart      = "jaeger-operator"
  version    = "2.49.0"
  namespace  = kubernetes_namespace.tracing.metadata[0].name

  values = [
    templatefile("${path.module}/helm-values/jaeger-operator.yml", {
      environment = var.environment
    })
  ]

  depends_on = [
    kubernetes_namespace.tracing
  ]
}

# ==============================================================================
# JAEGER INSTANCE
# ==============================================================================

resource "kubernetes_manifest" "jaeger_instance" {
  manifest = {
    apiVersion = "jaegertracing.io/v1"
    kind       = "Jaeger"
    metadata = {
      name      = "jaeger-tracing"
      namespace = kubernetes_namespace.tracing.metadata[0].name
      labels = merge(local.common_labels, {
        app = "jaeger"
      })
    }
    spec = {
      strategy = var.high_availability ? "production" : "allInOne"
      
      # Storage configuration
      storage = {
        type = "elasticsearch"
        options = {
          es = {
            "server-urls" = "http://elasticsearch.${kubernetes_namespace.logging.metadata[0].name}.svc.cluster.local:9200"
            "index-prefix" = "jaeger"
            "username" = "elastic"
            "password" = random_password.elasticsearch_password.result
          }
        }
      }

      # Collector configuration
      collector = {
        replicas = local.jaeger_config.collector_replicas
        resources = {
          requests = {
            cpu    = "100m"
            memory = "128Mi"
          }
          limits = {
            cpu    = "1000m"
            memory = "1Gi"
          }
        }
        options = {
          collector = {
            "queue-size" = "2000"
            "queue-size-memory" = "0.5"
            "num-workers" = "50"
          }
        }
      }

      # Query configuration
      query = {
        replicas = local.jaeger_config.query_replicas
        resources = {
          requests = {
            cpu    = "100m"
            memory = "128Mi"
          }
          limits = {
            cpu    = "500m"
            memory = "512Mi"
          }
        }
        options = {
          query = {
            "base-path" = "/"
            "log-level" = "info"
          }
        }
      }

      # Agent configuration
      agent = {
        strategy = "DaemonSet"
        resources = {
          requests = {
            cpu    = "100m"
            memory = "128Mi"
          }
          limits = {
            cpu    = "500m"
            memory = "512Mi"
          }
        }
        options = {
          agent = {
            "collector.host-port" = "jaeger-tracing-collector:14267"
          }
        }
      }

      # Ingester configuration (for production mode)
      ingester = var.high_availability ? {
        replicas = 2
        resources = {
          requests = {
            cpu    = "100m"
            memory = "128Mi"
          }
          limits = {
            cpu    = "1000m"
            memory = "1Gi"
          }
        }
        options = {
          ingester = {
            "deadlockInterval" = "5s"
          }
        }
      } : null

      # All-in-one configuration (for development)
      allInOne = var.high_availability ? null : {
        image = "jaegertracing/all-in-one:latest"
        resources = {
          requests = {
            cpu    = "100m"
            memory = "128Mi"
          }
          limits = {
            cpu    = "500m"
            memory = "512Mi"
          }
        }
        options = {
          query = {
            "base-path" = "/"
          }
          collector = {
            "zipkin.host-port" = ":9411"
          }
        }
      }

      # Sampling configuration
      sampling = {
        options = {
          default_strategy = {
            type = "probabilistic"
            param = 0.1
          }
          per_service_strategies = [
            {
              service = "learning-assistant"
              type = "probabilistic"
              param = 0.5
            },
            {
              service = "learning-assistant-api"
              type = "probabilistic"
              param = 0.3
            }
          ]
        }
      }

      # UI configuration
      ui = {
        options = {
          dependencies = {
            menuEnabled = true
          }
          tracking = {
            gaID = ""
            trackErrors = true
          }
        }
      }

      # Annotations for service discovery
      annotations = {
        "prometheus.io/scrape" = "true"
        "prometheus.io/port" = "14269"
        "prometheus.io/path" = "/metrics"
      }

      # Labels for identification
      labels = merge(local.common_labels, {
        app = "jaeger"
        component = "tracing"
      })
    }
  }

  depends_on = [
    helm_release.jaeger_operator,
    kubernetes_namespace.tracing
  ]
}

# ==============================================================================
# OPENTELEMETRY COLLECTOR
# ==============================================================================

resource "helm_release" "opentelemetry_collector" {
  name       = "opentelemetry-collector"
  repository = "https://open-telemetry.github.io/opentelemetry-helm-charts"
  chart      = "opentelemetry-collector"
  version    = "0.82.0"
  namespace  = kubernetes_namespace.tracing.metadata[0].name

  values = [
    templatefile("${path.module}/helm-values/opentelemetry-collector.yml", {
      environment = var.environment
      jaeger_endpoint = "jaeger-tracing-collector.${kubernetes_namespace.tracing.metadata[0].name}.svc.cluster.local:14250"
      prometheus_endpoint = "prometheus-operated.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:9090"
    })
  ]

  depends_on = [
    kubernetes_namespace.tracing,
    kubernetes_manifest.jaeger_instance
  ]
}

# ==============================================================================
# JAEGER AGENT CONFIGURATION
# ==============================================================================

resource "kubernetes_config_map" "jaeger_agent_config" {
  metadata {
    name      = "jaeger-agent-config"
    namespace = kubernetes_namespace.tracing.metadata[0].name
  }

  data = {
    "agent.yaml" = templatefile("${path.module}/configs/jaeger-agent.yml", {
      environment = var.environment
      cluster_name = var.cluster_name
      collector_endpoint = "jaeger-tracing-collector.${kubernetes_namespace.tracing.metadata[0].name}.svc.cluster.local:14267"
    })
  }
}

# ==============================================================================
# JAEGER SAMPLING CONFIGURATION
# ==============================================================================

resource "kubernetes_config_map" "jaeger_sampling_config" {
  metadata {
    name      = "jaeger-sampling-config"
    namespace = kubernetes_namespace.tracing.metadata[0].name
  }

  data = {
    "sampling.json" = templatefile("${path.module}/configs/jaeger-sampling.json", {
      environment = var.environment
      default_sampling_rate = var.environment == "prod" ? 0.1 : 0.5
    })
  }
}

# ==============================================================================
# JAEGER HOTROD DEMO (FOR TESTING)
# ==============================================================================

resource "kubernetes_deployment" "jaeger_hotrod_demo" {
  count = var.environment == "dev" ? 1 : 0

  metadata {
    name      = "jaeger-hotrod-demo"
    namespace = kubernetes_namespace.tracing.metadata[0].name
    labels = merge(local.common_labels, {
      app = "jaeger-hotrod-demo"
    })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "jaeger-hotrod-demo"
      }
    }

    template {
      metadata {
        labels = {
          app = "jaeger-hotrod-demo"
        }
        annotations = {
          "prometheus.io/scrape" = "true"
          "prometheus.io/port" = "8083"
        }
      }

      spec {
        container {
          name  = "hotrod"
          image = "jaegertracing/example-hotrod:latest"
          
          port {
            container_port = 8080
          }

          port {
            container_port = 8083
          }

          env {
            name  = "JAEGER_AGENT_HOST"
            value = "jaeger-tracing-agent.${kubernetes_namespace.tracing.metadata[0].name}.svc.cluster.local"
          }

          env {
            name  = "JAEGER_AGENT_PORT"
            value = "6831"
          }

          env {
            name  = "JAEGER_SAMPLER_TYPE"
            value = "const"
          }

          env {
            name  = "JAEGER_SAMPLER_PARAM"
            value = "1"
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
        }
      }
    }
  }
}

resource "kubernetes_service" "jaeger_hotrod_demo_service" {
  count = var.environment == "dev" ? 1 : 0

  metadata {
    name      = "jaeger-hotrod-demo"
    namespace = kubernetes_namespace.tracing.metadata[0].name
  }

  spec {
    selector = {
      app = "jaeger-hotrod-demo"
    }

    port {
      name        = "http"
      port        = 8080
      target_port = 8080
    }

    port {
      name        = "metrics"
      port        = 8083
      target_port = 8083
    }

    type = "ClusterIP"
  }
}

# ==============================================================================
# JAEGER SERVICES
# ==============================================================================

resource "kubernetes_service" "jaeger_query_service" {
  metadata {
    name      = "jaeger-query-service"
    namespace = kubernetes_namespace.tracing.metadata[0].name
    labels = merge(local.common_labels, {
      app = "jaeger-query"
    })
  }

  spec {
    selector = {
      app = "jaeger"
      "app.kubernetes.io/component" = "query"
    }

    port {
      name        = "query-http"
      port        = 16686
      target_port = 16686
      protocol    = "TCP"
    }

    port {
      name        = "admin-http"
      port        = 16687
      target_port = 16687
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }
}

# ==============================================================================
# JAEGER INGRESS
# ==============================================================================

resource "kubernetes_ingress_v1" "jaeger_ingress" {
  metadata {
    name      = "jaeger-ingress"
    namespace = kubernetes_namespace.tracing.metadata[0].name
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
      hosts       = ["jaeger.${var.domain_name}"]
      secret_name = "jaeger-tls"
    }

    rule {
      host = "jaeger.${var.domain_name}"
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = kubernetes_service.jaeger_query_service.metadata[0].name
              port {
                number = 16686
              }
            }
          }
        }
      }
    }
  }
}

# ==============================================================================
# JAEGER MONITORING
# ==============================================================================

resource "kubernetes_manifest" "jaeger_service_monitor" {
  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "ServiceMonitor"
    metadata = {
      name      = "jaeger-service-monitor"
      namespace = kubernetes_namespace.tracing.metadata[0].name
      labels = merge(local.common_labels, {
        app = "jaeger"
        team = "monitoring"
      })
    }
    spec = {
      selector = {
        matchLabels = {
          app = "jaeger"
        }
      }
      endpoints = [
        {
          port = "admin-http"
          interval = "30s"
          path = "/metrics"
        }
      ]
    }
  }

  depends_on = [
    kubernetes_manifest.jaeger_instance
  ]
}

# ==============================================================================
# OUTPUTS
# ==============================================================================

output "jaeger_query_url" {
  description = "Jaeger Query UI URL"
  value       = "https://jaeger.${var.domain_name}"
}

output "jaeger_collector_endpoint" {
  description = "Jaeger Collector endpoint"
  value       = "jaeger-tracing-collector.${kubernetes_namespace.tracing.metadata[0].name}.svc.cluster.local:14250"
}

output "jaeger_agent_endpoint" {
  description = "Jaeger Agent endpoint"
  value       = "jaeger-tracing-agent.${kubernetes_namespace.tracing.metadata[0].name}.svc.cluster.local:6831"
}

output "jaeger_namespace" {
  description = "Jaeger namespace"
  value       = kubernetes_namespace.tracing.metadata[0].name
}

output "opentelemetry_collector_endpoint" {
  description = "OpenTelemetry Collector endpoint"
  value       = "opentelemetry-collector.${kubernetes_namespace.tracing.metadata[0].name}.svc.cluster.local:4317"
}