# ==============================================================================
# COST MONITORING AND OPTIMIZATION
# Multi-Cloud Cost Tracking and Budget Alerts
# ==============================================================================

# ==============================================================================
# COST MONITORING NAMESPACE
# ==============================================================================

resource "kubernetes_namespace" "cost_monitoring" {
  metadata {
    name = "cost-monitoring"
    labels = merge(local.common_labels, {
      name = "cost-monitoring"
    })
  }
}

# ==============================================================================
# OPENCOST DEPLOYMENT
# ==============================================================================

resource "helm_release" "opencost" {
  name       = "opencost"
  repository = "https://opencost.github.io/opencost-helm-chart"
  chart      = "opencost"
  version    = "1.20.0"
  namespace  = kubernetes_namespace.cost_monitoring.metadata[0].name

  values = [
    templatefile("${path.module}/helm-values/opencost.yml", {
      environment = var.environment
      cluster_name = var.cluster_name
      prometheus_url = "http://prometheus-operated.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:9090"
    })
  ]

  depends_on = [
    kubernetes_namespace.cost_monitoring
  ]
}

# ==============================================================================
# CLOUD COST EXPORTERS
# ==============================================================================

# GCP Cost Exporter
resource "kubernetes_deployment" "gcp_cost_exporter" {
  metadata {
    name      = "gcp-cost-exporter"
    namespace = kubernetes_namespace.cost_monitoring.metadata[0].name
    labels = merge(local.common_labels, {
      app = "gcp-cost-exporter"
    })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "gcp-cost-exporter"
      }
    }

    template {
      metadata {
        labels = {
          app = "gcp-cost-exporter"
        }
        annotations = {
          "prometheus.io/scrape" = "true"
          "prometheus.io/port" = "8080"
          "prometheus.io/path" = "/metrics"
        }
      }

      spec {
        service_account_name = kubernetes_service_account.cost_monitoring_sa.metadata[0].name

        container {
          name  = "gcp-cost-exporter"
          image = "google/cloud-sdk:alpine"
          
          command = ["/bin/sh"]
          args = [
            "-c",
            templatefile("${path.module}/scripts/gcp-cost-exporter.sh", {
              project_id = var.project_id
              environment = var.environment
            })
          ]

          port {
            container_port = 8080
            name          = "metrics"
          }

          env {
            name  = "GCP_PROJECT_ID"
            value = var.project_id
          }

          env {
            name  = "ENVIRONMENT"
            value = var.environment
          }

          env {
            name  = "EXPORT_INTERVAL"
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
            name       = "cost-scripts"
            mount_path = "/scripts"
            read_only  = true
          }
        }

        volume {
          name = "cost-scripts"
          config_map {
            name         = kubernetes_config_map.cost_monitoring_scripts.metadata[0].name
            default_mode = "0755"
          }
        }
      }
    }
  }
}

# AWS Cost Exporter
resource "kubernetes_deployment" "aws_cost_exporter" {
  count = var.enable_multi_cloud ? 1 : 0

  metadata {
    name      = "aws-cost-exporter"
    namespace = kubernetes_namespace.cost_monitoring.metadata[0].name
    labels = merge(local.common_labels, {
      app = "aws-cost-exporter"
    })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "aws-cost-exporter"
      }
    }

    template {
      metadata {
        labels = {
          app = "aws-cost-exporter"
        }
        annotations = {
          "prometheus.io/scrape" = "true"
          "prometheus.io/port" = "8081"
          "prometheus.io/path" = "/metrics"
        }
      }

      spec {
        container {
          name  = "aws-cost-exporter"
          image = "amazon/aws-cli:latest"
          
          command = ["/bin/sh"]
          args = [
            "-c",
            templatefile("${path.module}/scripts/aws-cost-exporter.sh", {
              environment = var.environment
            })
          ]

          port {
            container_port = 8081
            name          = "metrics"
          }

          env {
            name  = "AWS_REGION"
            value = "us-east-1"
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

# Azure Cost Exporter
resource "kubernetes_deployment" "azure_cost_exporter" {
  count = var.enable_multi_cloud ? 1 : 0

  metadata {
    name      = "azure-cost-exporter"
    namespace = kubernetes_namespace.cost_monitoring.metadata[0].name
    labels = merge(local.common_labels, {
      app = "azure-cost-exporter"
    })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "azure-cost-exporter"
      }
    }

    template {
      metadata {
        labels = {
          app = "azure-cost-exporter"
        }
        annotations = {
          "prometheus.io/scrape" = "true"
          "prometheus.io/port" = "8082"
          "prometheus.io/path" = "/metrics"
        }
      }

      spec {
        container {
          name  = "azure-cost-exporter"
          image = "mcr.microsoft.com/azure-cli:latest"
          
          command = ["/bin/sh"]
          args = [
            "-c",
            templatefile("${path.module}/scripts/azure-cost-exporter.sh", {
              environment = var.environment
            })
          ]

          port {
            container_port = 8082
            name          = "metrics"
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

# ==============================================================================
# COST MONITORING SCRIPTS
# ==============================================================================

resource "kubernetes_config_map" "cost_monitoring_scripts" {
  metadata {
    name      = "cost-monitoring-scripts"
    namespace = kubernetes_namespace.cost_monitoring.metadata[0].name
  }

  data = {
    "gcp-cost-exporter.sh" = templatefile("${path.module}/scripts/gcp-cost-exporter.sh", {
      project_id = var.project_id
      environment = var.environment
    })
    "aws-cost-exporter.sh" = file("${path.module}/scripts/aws-cost-exporter.sh")
    "azure-cost-exporter.sh" = file("${path.module}/scripts/azure-cost-exporter.sh")
    "cost-optimizer.py" = file("${path.module}/scripts/cost-optimizer.py")
  }
}

# ==============================================================================
# BUDGET ALERTS
# ==============================================================================

resource "kubernetes_config_map" "budget_alerts_config" {
  metadata {
    name      = "budget-alerts-config"
    namespace = kubernetes_namespace.cost_monitoring.metadata[0].name
  }

  data = {
    "budget-alerts.yml" = templatefile("${path.module}/configs/budget-alerts.yml", {
      environment = var.environment
      monthly_budget = var.environment == "prod" ? 1000 : 500
      daily_budget = var.environment == "prod" ? 35 : 20
    })
  }
}

# ==============================================================================
# COST OPTIMIZATION ENGINE
# ==============================================================================

resource "kubernetes_deployment" "cost_optimizer" {
  metadata {
    name      = "cost-optimizer"
    namespace = kubernetes_namespace.cost_monitoring.metadata[0].name
    labels = merge(local.common_labels, {
      app = "cost-optimizer"
    })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "cost-optimizer"
      }
    }

    template {
      metadata {
        labels = {
          app = "cost-optimizer"
        }
        annotations = {
          "prometheus.io/scrape" = "true"
          "prometheus.io/port" = "8090"
          "prometheus.io/path" = "/metrics"
        }
      }

      spec {
        container {
          name  = "cost-optimizer"
          image = "python:3.11-alpine"
          
          command = ["python"]
          args = ["/scripts/cost-optimizer.py"]

          port {
            container_port = 8090
            name          = "metrics"
          }

          env {
            name  = "PROMETHEUS_URL"
            value = "http://prometheus-operated.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:9090"
          }

          env {
            name  = "OPENCOST_URL"
            value = "http://opencost.${kubernetes_namespace.cost_monitoring.metadata[0].name}.svc.cluster.local:9003"
          }

          env {
            name  = "ENVIRONMENT"
            value = var.environment
          }

          env {
            name  = "OPTIMIZATION_INTERVAL"
            value = "21600" # 6 hours
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
            name       = "cost-scripts"
            mount_path = "/scripts"
            read_only  = true
          }
        }

        volume {
          name = "cost-scripts"
          config_map {
            name         = kubernetes_config_map.cost_monitoring_scripts.metadata[0].name
            default_mode = "0755"
          }
        }
      }
    }
  }
}

# ==============================================================================
# COST MONITORING SERVICES
# ==============================================================================

resource "kubernetes_service" "gcp_cost_exporter_service" {
  metadata {
    name      = "gcp-cost-exporter"
    namespace = kubernetes_namespace.cost_monitoring.metadata[0].name
    labels = merge(local.common_labels, {
      app = "gcp-cost-exporter"
    })
  }

  spec {
    selector = {
      app = "gcp-cost-exporter"
    }

    port {
      name        = "metrics"
      port        = 8080
      target_port = 8080
    }

    type = "ClusterIP"
  }
}

resource "kubernetes_service" "cost_optimizer_service" {
  metadata {
    name      = "cost-optimizer"
    namespace = kubernetes_namespace.cost_monitoring.metadata[0].name
    labels = merge(local.common_labels, {
      app = "cost-optimizer"
    })
  }

  spec {
    selector = {
      app = "cost-optimizer"
    }

    port {
      name        = "metrics"
      port        = 8090
      target_port = 8090
    }

    type = "ClusterIP"
  }
}

# ==============================================================================
# RBAC FOR COST MONITORING
# ==============================================================================

resource "kubernetes_service_account" "cost_monitoring_sa" {
  metadata {
    name      = "cost-monitoring-serviceaccount"
    namespace = kubernetes_namespace.cost_monitoring.metadata[0].name
  }
}

resource "kubernetes_cluster_role" "cost_monitoring_role" {
  metadata {
    name = "cost-monitoring-role"
  }

  rule {
    api_groups = [""]
    resources  = ["nodes", "pods", "persistentvolumes", "persistentvolumeclaims"]
    verbs      = ["get", "list", "watch"]
  }

  rule {
    api_groups = ["apps"]
    resources  = ["deployments", "replicasets", "daemonsets", "statefulsets"]
    verbs      = ["get", "list", "watch"]
  }

  rule {
    api_groups = ["metrics.k8s.io"]
    resources  = ["nodes", "pods"]
    verbs      = ["get", "list"]
  }
}

resource "kubernetes_cluster_role_binding" "cost_monitoring_binding" {
  metadata {
    name = "cost-monitoring-binding"
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.cost_monitoring_role.metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.cost_monitoring_sa.metadata[0].name
    namespace = kubernetes_namespace.cost_monitoring.metadata[0].name
  }
}

# ==============================================================================
# COST MONITORING SERVICE MONITORS
# ==============================================================================

resource "kubernetes_manifest" "cost_monitoring_service_monitors" {
  for_each = toset(["gcp-cost-exporter", "cost-optimizer"])

  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "ServiceMonitor"
    metadata = {
      name      = "${each.key}-service-monitor"
      namespace = kubernetes_namespace.cost_monitoring.metadata[0].name
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
          interval = "300s" # 5 minutes
          path = "/metrics"
        }
      ]
    }
  }
}

# ==============================================================================
# COST ALERT RULES
# ==============================================================================

resource "kubernetes_manifest" "cost_alert_rules" {
  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "PrometheusRule"
    metadata = {
      name      = "cost-monitoring-alerts"
      namespace = kubernetes_namespace.cost_monitoring.metadata[0].name
      labels = {
        prometheus = "kube-prometheus"
        role       = "alert-rules"
      }
    }
    spec = {
      groups = [
        {
          name = "cost-alerts"
          rules = [
            {
              alert = "HighDailyCost"
              expr = "increase(opencost_daily_cost_total[1d]) > ${var.environment == "prod" ? 35 : 20}"
              for = "5m"
              labels = {
                severity = "warning"
                category = "cost"
              }
              annotations = {
                summary = "Daily cost is higher than expected"
                description = "Daily cost has exceeded the threshold of $${var.environment == "prod" ? 35 : 20}"
                runbook_url = "https://runbooks.${var.domain_name}/cost/high-daily-cost"
              }
            },
            {
              alert = "HighMonthlyCost"
              expr = "increase(opencost_monthly_cost_total[30d]) > ${var.environment == "prod" ? 1000 : 500}"
              for = "1h"
              labels = {
                severity = "critical"
                category = "cost"
              }
              annotations = {
                summary = "Monthly cost is higher than budget"
                description = "Monthly cost has exceeded the budget of $${var.environment == "prod" ? 1000 : 500}"
                runbook_url = "https://runbooks.${var.domain_name}/cost/high-monthly-cost"
              }
            },
            {
              alert = "UnusedResources"
              expr = "opencost_unused_cpu_percentage > 50"
              for = "2h"
              labels = {
                severity = "warning"
                category = "cost"
              }
              annotations = {
                summary = "High percentage of unused CPU resources"
                description = "More than 50% of CPU resources are unused"
                runbook_url = "https://runbooks.${var.domain_name}/cost/unused-resources"
              }
            },
            {
              alert = "CostSpike"
              expr = "rate(opencost_hourly_cost_total[1h]) > rate(opencost_hourly_cost_total[24h]) * 1.5"
              for = "30m"
              labels = {
                severity = "warning"
                category = "cost"
              }
              annotations = {
                summary = "Cost spike detected"
                description = "Hourly cost is 50% higher than the 24-hour average"
                runbook_url = "https://runbooks.${var.domain_name}/cost/cost-spike"
              }
            }
          ]
        }
      ]
    }
  }
}

# ==============================================================================
# COST DASHBOARD
# ==============================================================================

resource "kubernetes_config_map" "cost_dashboard" {
  metadata {
    name      = "cost-monitoring-dashboard"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      grafana_dashboard = "1"
    }
  }

  data = {
    "cost-monitoring.json" = file("${path.module}/dashboards/cost-monitoring.json")
  }
}

# ==============================================================================
# OUTPUTS
# ==============================================================================

output "opencost_url" {
  description = "OpenCost URL"
  value       = "http://opencost.${kubernetes_namespace.cost_monitoring.metadata[0].name}.svc.cluster.local:9003"
}

output "cost_monitoring_namespace" {
  description = "Cost monitoring namespace"
  value       = kubernetes_namespace.cost_monitoring.metadata[0].name
}

output "cost_exporters" {
  description = "Cost exporter endpoints"
  value = {
    gcp   = "http://gcp-cost-exporter.${kubernetes_namespace.cost_monitoring.metadata[0].name}.svc.cluster.local:8080"
    aws   = var.enable_multi_cloud ? "http://aws-cost-exporter.${kubernetes_namespace.cost_monitoring.metadata[0].name}.svc.cluster.local:8081" : null
    azure = var.enable_multi_cloud ? "http://azure-cost-exporter.${kubernetes_namespace.cost_monitoring.metadata[0].name}.svc.cluster.local:8082" : null
  }
}

output "cost_optimizer_url" {
  description = "Cost optimizer endpoint"
  value       = "http://cost-optimizer.${kubernetes_namespace.cost_monitoring.metadata[0].name}.svc.cluster.local:8090"
}