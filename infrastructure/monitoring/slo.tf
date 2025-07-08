# ==============================================================================
# SLI/SLO MONITORING AND REPORTING
# Service Level Indicators and Objectives Management
# ==============================================================================

# ==============================================================================
# SLO MONITORING NAMESPACE
# ==============================================================================

resource "kubernetes_namespace" "slo_monitoring" {
  metadata {
    name = "slo-monitoring"
    labels = merge(local.common_labels, {
      name = "slo-monitoring"
    })
  }
}

# ==============================================================================
# SLOTH SLO GENERATOR
# ==============================================================================

resource "helm_release" "sloth" {
  name       = "sloth"
  repository = "https://slok.github.io/sloth"
  chart      = "sloth"
  version    = "0.11.0"
  namespace  = kubernetes_namespace.slo_monitoring.metadata[0].name

  values = [
    templatefile("${path.module}/helm-values/sloth.yml", {
      environment = var.environment
      prometheus_url = "http://prometheus-operated.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:9090"
    })
  ]

  depends_on = [
    kubernetes_namespace.slo_monitoring
  ]
}

# ==============================================================================
# SLO DEFINITIONS
# ==============================================================================

resource "kubernetes_config_map" "slo_definitions" {
  metadata {
    name      = "slo-definitions"
    namespace = kubernetes_namespace.slo_monitoring.metadata[0].name
  }

  data = {
    "learning-assistant-slos.yml" = templatefile("${path.module}/configs/slos/learning-assistant-slos.yml", {
      environment = var.environment
      cluster_name = var.cluster_name
    })
    "infrastructure-slos.yml" = templatefile("${path.module}/configs/slos/infrastructure-slos.yml", {
      environment = var.environment
      cluster_name = var.cluster_name
    })
    "database-slos.yml" = templatefile("${path.module}/configs/slos/database-slos.yml", {
      environment = var.environment
      cluster_name = var.cluster_name
    })
    "api-slos.yml" = templatefile("${path.module}/configs/slos/api-slos.yml", {
      environment = var.environment
      cluster_name = var.cluster_name
    })
  }
}

# ==============================================================================
# LEARNING ASSISTANT SLO DEFINITIONS
# ==============================================================================

resource "kubernetes_manifest" "learning_assistant_availability_slo" {
  manifest = {
    apiVersion = "sloth.slok.dev/v1"
    kind       = "PrometheusServiceLevel"
    metadata = {
      name      = "learning-assistant-availability"
      namespace = kubernetes_namespace.slo_monitoring.metadata[0].name
      labels = merge(local.common_labels, {
        service = "learning-assistant"
        slo_type = "availability"
      })
    }
    spec = {
      service = "learning-assistant"
      labels = {
        team = "platform"
        service = "learning-assistant"
        environment = var.environment
      }
      slos = [
        {
          name = "availability"
          objective = var.environment == "prod" ? 99.9 : 99.5
          description = "Learning Assistant service availability"
          sli = {
            events = {
              errorQuery = "sum(rate(http_requests_total{job=\"learning-assistant\",code=~\"5..\"}[5m]))"
              totalQuery = "sum(rate(http_requests_total{job=\"learning-assistant\"}[5m]))"
            }
          }
          alerting = {
            name = "LearningAssistantAvailability"
            labels = {
              category = "availability"
              severity = "critical"
            }
            annotations = {
              summary = "Learning Assistant availability SLO is being burned"
              runbook_url = "https://runbooks.${var.domain_name}/slo/learning-assistant-availability"
            }
            pageAlert = {
              labels = {
                severity = "critical"
                team = "platform"
              }
            }
            ticketAlert = {
              labels = {
                severity = "warning"
                team = "platform"
              }
            }
          }
        }
      ]
    }
  }

  depends_on = [
    helm_release.sloth
  ]
}

resource "kubernetes_manifest" "learning_assistant_latency_slo" {
  manifest = {
    apiVersion = "sloth.slok.dev/v1"
    kind       = "PrometheusServiceLevel"
    metadata = {
      name      = "learning-assistant-latency"
      namespace = kubernetes_namespace.slo_monitoring.metadata[0].name
      labels = merge(local.common_labels, {
        service = "learning-assistant"
        slo_type = "latency"
      })
    }
    spec = {
      service = "learning-assistant"
      labels = {
        team = "platform"
        service = "learning-assistant"
        environment = var.environment
      }
      slos = [
        {
          name = "latency"
          objective = var.environment == "prod" ? 99.0 : 95.0
          description = "Learning Assistant API response time under 500ms"
          sli = {
            events = {
              errorQuery = "sum(rate(http_request_duration_seconds_bucket{job=\"learning-assistant\",le=\"0.5\"}[5m]))"
              totalQuery = "sum(rate(http_request_duration_seconds_count{job=\"learning-assistant\"}[5m]))"
            }
          }
          alerting = {
            name = "LearningAssistantLatency"
            labels = {
              category = "latency"
              severity = "warning"
            }
            annotations = {
              summary = "Learning Assistant latency SLO is being burned"
              runbook_url = "https://runbooks.${var.domain_name}/slo/learning-assistant-latency"
            }
            pageAlert = {
              labels = {
                severity = "warning"
                team = "platform"
              }
            }
          }
        }
      ]
    }
  }

  depends_on = [
    helm_release.sloth
  ]
}

# ==============================================================================
# INFRASTRUCTURE SLO DEFINITIONS
# ==============================================================================

resource "kubernetes_manifest" "database_availability_slo" {
  manifest = {
    apiVersion = "sloth.slok.dev/v1"
    kind       = "PrometheusServiceLevel"
    metadata = {
      name      = "database-availability"
      namespace = kubernetes_namespace.slo_monitoring.metadata[0].name
      labels = merge(local.common_labels, {
        service = "database"
        slo_type = "availability"
      })
    }
    spec = {
      service = "database"
      labels = {
        team = "platform"
        service = "database"
        environment = var.environment
      }
      slos = [
        {
          name = "availability"
          objective = var.environment == "prod" ? 99.9 : 99.0
          description = "Database availability"
          sli = {
            events = {
              errorQuery = "up{job=\"postgres-exporter\"} == 0"
              totalQuery = "up{job=\"postgres-exporter\"}"
            }
          }
          alerting = {
            name = "DatabaseAvailability"
            labels = {
              category = "availability"
              severity = "critical"
            }
            annotations = {
              summary = "Database availability SLO is being burned"
              runbook_url = "https://runbooks.${var.domain_name}/slo/database-availability"
            }
            pageAlert = {
              labels = {
                severity = "critical"
                team = "platform"
              }
            }
          }
        }
      ]
    }
  }

  depends_on = [
    helm_release.sloth
  ]
}

resource "kubernetes_manifest" "kubernetes_api_availability_slo" {
  manifest = {
    apiVersion = "sloth.slok.dev/v1"
    kind       = "PrometheusServiceLevel"
    metadata = {
      name      = "kubernetes-api-availability"
      namespace = kubernetes_namespace.slo_monitoring.metadata[0].name
      labels = merge(local.common_labels, {
        service = "kubernetes-api"
        slo_type = "availability"
      })
    }
    spec = {
      service = "kubernetes-api"
      labels = {
        team = "platform"
        service = "kubernetes-api"
        environment = var.environment
      }
      slos = [
        {
          name = "availability"
          objective = 99.9
          description = "Kubernetes API server availability"
          sli = {
            events = {
              errorQuery = "sum(rate(apiserver_request_total{code=~\"5..\"}[5m]))"
              totalQuery = "sum(rate(apiserver_request_total[5m]))"
            }
          }
          alerting = {
            name = "KubernetesAPIAvailability"
            labels = {
              category = "availability"
              severity = "critical"
            }
            annotations = {
              summary = "Kubernetes API availability SLO is being burned"
              runbook_url = "https://runbooks.${var.domain_name}/slo/kubernetes-api-availability"
            }
            pageAlert = {
              labels = {
                severity = "critical"
                team = "platform"
              }
            }
          }
        }
      ]
    }
  }

  depends_on = [
    helm_release.sloth
  ]
}

# ==============================================================================
# SLO DASHBOARD GENERATOR
# ==============================================================================

resource "kubernetes_deployment" "slo_dashboard_generator" {
  metadata {
    name      = "slo-dashboard-generator"
    namespace = kubernetes_namespace.slo_monitoring.metadata[0].name
    labels = merge(local.common_labels, {
      app = "slo-dashboard-generator"
    })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "slo-dashboard-generator"
      }
    }

    template {
      metadata {
        labels = {
          app = "slo-dashboard-generator"
        }
      }

      spec {
        container {
          name  = "slo-dashboard-generator"
          image = "python:3.11-alpine"
          
          command = ["python"]
          args = ["/scripts/slo-dashboard-generator.py"]

          env {
            name  = "PROMETHEUS_URL"
            value = "http://prometheus-operated.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:9090"
          }

          env {
            name  = "GRAFANA_URL"
            value = "http://grafana.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:3000"
          }

          env {
            name  = "ENVIRONMENT"
            value = var.environment
          }

          env {
            name  = "GENERATION_INTERVAL"
            value = "3600" # 1 hour
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
            name       = "slo-scripts"
            mount_path = "/scripts"
            read_only  = true
          }
        }

        volume {
          name = "slo-scripts"
          config_map {
            name         = kubernetes_config_map.slo_scripts.metadata[0].name
            default_mode = "0755"
          }
        }
      }
    }
  }
}

resource "kubernetes_config_map" "slo_scripts" {
  metadata {
    name      = "slo-scripts"
    namespace = kubernetes_namespace.slo_monitoring.metadata[0].name
  }

  data = {
    "slo-dashboard-generator.py" = file("${path.module}/scripts/slo-dashboard-generator.py")
    "slo-reporter.py" = file("${path.module}/scripts/slo-reporter.py")
    "error-budget-calculator.py" = file("${path.module}/scripts/error-budget-calculator.py")
  }
}

# ==============================================================================
# SLO REPORTING ENGINE
# ==============================================================================

resource "kubernetes_deployment" "slo_reporter" {
  metadata {
    name      = "slo-reporter"
    namespace = kubernetes_namespace.slo_monitoring.metadata[0].name
    labels = merge(local.common_labels, {
      app = "slo-reporter"
    })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "slo-reporter"
      }
    }

    template {
      metadata {
        labels = {
          app = "slo-reporter"
        }
        annotations = {
          "prometheus.io/scrape" = "true"
          "prometheus.io/port" = "8080"
          "prometheus.io/path" = "/metrics"
        }
      }

      spec {
        container {
          name  = "slo-reporter"
          image = "python:3.11-alpine"
          
          command = ["python"]
          args = ["/scripts/slo-reporter.py"]

          port {
            container_port = 8080
            name          = "metrics"
          }

          env {
            name  = "PROMETHEUS_URL"
            value = "http://prometheus-operated.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:9090"
          }

          env {
            name  = "ENVIRONMENT"
            value = var.environment
          }

          env {
            name  = "REPORT_INTERVAL"
            value = "86400" # 24 hours
          }

          env {
            name  = "SLACK_WEBHOOK_URL"
            value = var.slack_webhook_url
          }

          env {
            name  = "EMAIL_RECIPIENT"
            value = var.notification_email
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
            name       = "slo-scripts"
            mount_path = "/scripts"
            read_only  = true
          }
        }

        volume {
          name = "slo-scripts"
          config_map {
            name         = kubernetes_config_map.slo_scripts.metadata[0].name
            default_mode = "0755"
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "slo_reporter_service" {
  metadata {
    name      = "slo-reporter"
    namespace = kubernetes_namespace.slo_monitoring.metadata[0].name
    labels = merge(local.common_labels, {
      app = "slo-reporter"
    })
  }

  spec {
    selector = {
      app = "slo-reporter"
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
# ERROR BUDGET CALCULATOR
# ==============================================================================

resource "kubernetes_deployment" "error_budget_calculator" {
  metadata {
    name      = "error-budget-calculator"
    namespace = kubernetes_namespace.slo_monitoring.metadata[0].name
    labels = merge(local.common_labels, {
      app = "error-budget-calculator"
    })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "error-budget-calculator"
      }
    }

    template {
      metadata {
        labels = {
          app = "error-budget-calculator"
        }
        annotations = {
          "prometheus.io/scrape" = "true"
          "prometheus.io/port" = "8081"
          "prometheus.io/path" = "/metrics"
        }
      }

      spec {
        container {
          name  = "error-budget-calculator"
          image = "python:3.11-alpine"
          
          command = ["python"]
          args = ["/scripts/error-budget-calculator.py"]

          port {
            container_port = 8081
            name          = "metrics"
          }

          env {
            name  = "PROMETHEUS_URL"
            value = "http://prometheus-operated.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:9090"
          }

          env {
            name  = "ENVIRONMENT"
            value = var.environment
          }

          env {
            name  = "CALCULATION_INTERVAL"
            value = "300" # 5 minutes
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
            name       = "slo-scripts"
            mount_path = "/scripts"
            read_only  = true
          }
        }

        volume {
          name = "slo-scripts"
          config_map {
            name         = kubernetes_config_map.slo_scripts.metadata[0].name
            default_mode = "0755"
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "error_budget_calculator_service" {
  metadata {
    name      = "error-budget-calculator"
    namespace = kubernetes_namespace.slo_monitoring.metadata[0].name
    labels = merge(local.common_labels, {
      app = "error-budget-calculator"
    })
  }

  spec {
    selector = {
      app = "error-budget-calculator"
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
# SLO ALERT RULES
# ==============================================================================

resource "kubernetes_manifest" "slo_alert_rules" {
  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "PrometheusRule"
    metadata = {
      name      = "slo-alert-rules"
      namespace = kubernetes_namespace.slo_monitoring.metadata[0].name
      labels = {
        prometheus = "kube-prometheus"
        role       = "alert-rules"
      }
    }
    spec = {
      groups = [
        {
          name = "slo-alerts"
          rules = [
            {
              alert = "ErrorBudgetExhausted"
              expr = "slo_error_budget_remaining < 0.1"
              for = "5m"
              labels = {
                severity = "critical"
                category = "slo"
              }
              annotations = {
                summary = "Error budget is almost exhausted"
                description = "The error budget for {{ $labels.service }} SLO is below 10%"
                runbook_url = "https://runbooks.${var.domain_name}/slo/error-budget-exhausted"
              }
            },
            {
              alert = "ErrorBudgetBurnRateHigh"
              expr = "slo_error_budget_burn_rate > 10"
              for = "2m"
              labels = {
                severity = "critical"
                category = "slo"
              }
              annotations = {
                summary = "High error budget burn rate"
                description = "The error budget burn rate for {{ $labels.service }} is {{ $value }}x normal"
                runbook_url = "https://runbooks.${var.domain_name}/slo/high-burn-rate"
              }
            },
            {
              alert = "SLOViolation"
              expr = "slo_objective_ratio < 1"
              for = "10m"
              labels = {
                severity = "warning"
                category = "slo"
              }
              annotations = {
                summary = "SLO violation detected"
                description = "{{ $labels.service }} is violating its SLO ({{ $value }}% compliance)"
                runbook_url = "https://runbooks.${var.domain_name}/slo/slo-violation"
              }
            }
          ]
        }
      ]
    }
  }

  depends_on = [
    helm_release.sloth
  ]
}

# ==============================================================================
# SLO SERVICE MONITORS
# ==============================================================================

resource "kubernetes_manifest" "slo_service_monitors" {
  for_each = toset(["slo-reporter", "error-budget-calculator"])

  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "ServiceMonitor"
    metadata = {
      name      = "${each.key}-service-monitor"
      namespace = kubernetes_namespace.slo_monitoring.metadata[0].name
      labels = merge(local.common_labels, {
        app = each.key
        team = "monitoring"
      })
    }
    spec = {
      selector = {
        matchLabels = {
          app = each.key
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
}

# ==============================================================================
# SLO DASHBOARD
# ==============================================================================

resource "kubernetes_config_map" "slo_dashboard" {
  metadata {
    name      = "slo-monitoring-dashboard"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      grafana_dashboard = "1"
    }
  }

  data = {
    "slo-monitoring.json" = file("${path.module}/dashboards/slo-dashboard.json")
  }
}

# ==============================================================================
# OUTPUTS
# ==============================================================================

output "slo_monitoring_namespace" {
  description = "SLO monitoring namespace"
  value       = kubernetes_namespace.slo_monitoring.metadata[0].name
}

output "sloth_url" {
  description = "Sloth SLO generator URL"
  value       = "http://sloth.${kubernetes_namespace.slo_monitoring.metadata[0].name}.svc.cluster.local:8080"
}

output "slo_reporter_url" {
  description = "SLO reporter endpoint"
  value       = "http://slo-reporter.${kubernetes_namespace.slo_monitoring.metadata[0].name}.svc.cluster.local:8080"
}

output "error_budget_calculator_url" {
  description = "Error budget calculator endpoint"
  value       = "http://error-budget-calculator.${kubernetes_namespace.slo_monitoring.metadata[0].name}.svc.cluster.local:8081"
}

output "slo_objectives" {
  description = "Configured SLO objectives"
  value = {
    learning_assistant_availability = var.environment == "prod" ? 99.9 : 99.5
    learning_assistant_latency     = var.environment == "prod" ? 99.0 : 95.0
    database_availability          = var.environment == "prod" ? 99.9 : 99.0
    kubernetes_api_availability    = 99.9
  }
}