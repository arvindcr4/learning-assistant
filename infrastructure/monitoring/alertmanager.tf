# ==============================================================================
# ALERTMANAGER CONFIGURATION
# Multi-Channel Alerting and Incident Management
# ==============================================================================

# ==============================================================================
# ALERTMANAGER CONFIGURATION
# ==============================================================================

resource "kubernetes_config_map" "alertmanager_config" {
  metadata {
    name      = "alertmanager-config"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      alertmanager = "main"
      role        = "alert-config"
    }
  }

  data = {
    "alertmanager.yml" = templatefile("${path.module}/configs/alertmanager.yml.tpl", {
      notification_email        = var.notification_email
      slack_webhook_url         = var.slack_webhook_url
      pagerduty_integration_key = var.pagerduty_integration_key
      environment              = var.environment
      cluster_name             = var.cluster_name
    })
  }
}

# ==============================================================================
# ALERTMANAGER CUSTOM RESOURCE
# ==============================================================================

resource "kubernetes_manifest" "alertmanager_instance" {
  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "Alertmanager"
    metadata = {
      name      = "alertmanager-main"
      namespace = kubernetes_namespace.monitoring.metadata[0].name
      labels = merge(local.common_labels, {
        app = "alertmanager"
      })
    }
    spec = {
      replicas = var.high_availability ? 3 : 1
      
      serviceAccountName = "alertmanager-main"
      
      securityContext = {
        fsGroup      = 2000
        runAsNonRoot = true
        runAsUser    = 1000
      }

      storage = {
        volumeClaimTemplate = {
          spec = {
            storageClassName = kubernetes_storage_class.monitoring_ssd.metadata[0].name
            accessModes     = ["ReadWriteOnce"]
            resources = {
              requests = {
                storage = "10Gi"
              }
            }
          }
        }
      }

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

      retention = "120h"

      configSecret = kubernetes_secret.alertmanager_config_secret.metadata[0].name

      # High availability clustering
      clusterAdvertiseAddress = "0.0.0.0:9094"
      clusterPeers = var.high_availability ? [
        "alertmanager-main-0.alertmanager-operated:9094",
        "alertmanager-main-1.alertmanager-operated:9094",
        "alertmanager-main-2.alertmanager-operated:9094"
      ] : []

      # External URL
      externalUrl = "https://alertmanager.${var.domain_name}"

      # Route prefix
      routePrefix = "/"

      # Log configuration
      logLevel = "info"
      logFormat = "logfmt"

      # Web configuration
      web = {
        httpConfig = {
          http2 = true
        }
      }

      # Additional configuration
      additionalPeers = []
      
      alertmanagerConfigSelector = {
        matchLabels = {
          alertmanagerConfig = "main"
        }
      }

      # Alertmanager configuration matcher
      alertmanagerConfigNamespaceSelector = {
        matchLabels = {
          name = kubernetes_namespace.monitoring.metadata[0].name
        }
      }
    }
  }

  depends_on = [
    kubernetes_config_map.alertmanager_config,
    kubernetes_secret.alertmanager_config_secret
  ]
}

# ==============================================================================
# ALERTMANAGER CONFIGURATION SECRET
# ==============================================================================

resource "kubernetes_secret" "alertmanager_config_secret" {
  metadata {
    name      = "alertmanager-main"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  data = {
    "alertmanager.yaml" = base64encode(templatefile("${path.module}/configs/alertmanager.yml.tpl", {
      notification_email        = var.notification_email
      slack_webhook_url         = var.slack_webhook_url
      pagerduty_integration_key = var.pagerduty_integration_key
      environment              = var.environment
      cluster_name             = var.cluster_name
    }))
  }

  type = "Opaque"
}

# ==============================================================================
# ALERTMANAGER SERVICE ACCOUNT
# ==============================================================================

resource "kubernetes_service_account" "alertmanager_sa" {
  metadata {
    name      = "alertmanager-main"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }
}

# ==============================================================================
# ALERTMANAGER SERVICE
# ==============================================================================

resource "kubernetes_service" "alertmanager_service" {
  metadata {
    name      = "alertmanager-main"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = merge(local.common_labels, {
      app = "alertmanager"
    })
  }

  spec {
    selector = {
      app                          = "alertmanager"
      "alertmanager"              = "alertmanager-main"
      "app.kubernetes.io/name"    = "alertmanager"
    }

    port {
      name        = "web"
      port        = 9093
      target_port = 9093
      protocol    = "TCP"
    }

    port {
      name        = "reloader-web"
      port        = 8080
      target_port = 8080
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }
}

# ==============================================================================
# ALERTMANAGER INGRESS
# ==============================================================================

resource "kubernetes_ingress_v1" "alertmanager_ingress" {
  metadata {
    name      = "alertmanager-ingress"
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
      hosts       = ["alertmanager.${var.domain_name}"]
      secret_name = "alertmanager-tls"
    }

    rule {
      host = "alertmanager.${var.domain_name}"
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = kubernetes_service.alertmanager_service.metadata[0].name
              port {
                number = 9093
              }
            }
          }
        }
      }
    }
  }
}

# ==============================================================================
# ALERTMANAGER CONFIGURATION TEMPLATE
# ==============================================================================

resource "kubernetes_manifest" "alertmanager_config_crd" {
  manifest = {
    apiVersion = "monitoring.coreos.com/v1alpha1"
    kind       = "AlertmanagerConfig"
    metadata = {
      name      = "alertmanager-main-config"
      namespace = kubernetes_namespace.monitoring.metadata[0].name
      labels = {
        alertmanagerConfig = "main"
      }
    }
    spec = {
      route = {
        groupBy = ["alertname", "cluster", "service"]
        groupWait = "30s"
        groupInterval = "5m"
        repeatInterval = "12h"
        receiver = "default"
        routes = [
          {
            match = {
              severity = "critical"
            }
            receiver = "critical-alerts"
            routes = [
              {
                match = {
                  alertname = "Watchdog"
                }
                receiver = "null"
              }
            ]
          },
          {
            match = {
              severity = "warning"
            }
            receiver = "warning-alerts"
          },
          {
            match = {
              alertname = "InfoInhibitor"
            }
            receiver = "null"
          }
        ]
      }

      receivers = [
        {
          name = "null"
        },
        {
          name = "default"
          emailConfigs = [
            {
              to = var.notification_email
              from = var.notification_email
              subject = "[{{ .Status | toUpper }}{{ if eq .Status \"firing\" }}:{{ .Alerts.Firing | len }}{{ end }}] Monitoring Alert - {{ .GroupLabels.alertname }}"
              body = templatefile("${path.module}/templates/email-alert.html", {
                environment = var.environment
              })
              html = templatefile("${path.module}/templates/email-alert.html", {
                environment = var.environment
              })
              headers = {
                "X-Priority" = "1"
              }
            }
          ]
          slackConfigs = [
            {
              apiURL = var.slack_webhook_url
              channel = "#alerts-${var.environment}"
              title = "Alert: {{ .GroupLabels.alertname }}"
              text = "{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}"
              sendResolved = true
              color = "{{ if eq .Status \"firing\" }}danger{{ else }}good{{ end }}"
            }
          ]
        },
        {
          name = "critical-alerts"
          emailConfigs = [
            {
              to = var.notification_email
              from = var.notification_email
              subject = "[CRITICAL] {{ .GroupLabels.alertname }} - {{ .GroupLabels.cluster }}"
              body = templatefile("${path.module}/templates/critical-alert.html", {
                environment = var.environment
              })
              html = templatefile("${path.module}/templates/critical-alert.html", {
                environment = var.environment
              })
              headers = {
                "X-Priority" = "1"
                "Importance" = "high"
              }
            }
          ]
          slackConfigs = [
            {
              apiURL = var.slack_webhook_url
              channel = "#critical-alerts"
              title = "🚨 CRITICAL: {{ .GroupLabels.alertname }}"
              text = "{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}"
              sendResolved = true
              color = "danger"
            }
          ]
          pagerdutyConfigs = [
            {
              routingKey = var.pagerduty_integration_key
              description = "{{ .GroupLabels.alertname }} - {{ .GroupLabels.cluster }}"
              severity = "critical"
              client = "AlertManager"
              clientURL = "https://alertmanager.${var.domain_name}"
            }
          ]
        },
        {
          name = "warning-alerts"
          emailConfigs = [
            {
              to = var.notification_email
              from = var.notification_email
              subject = "[WARNING] {{ .GroupLabels.alertname }} - {{ .GroupLabels.cluster }}"
              body = templatefile("${path.module}/templates/warning-alert.html", {
                environment = var.environment
              })
              html = templatefile("${path.module}/templates/warning-alert.html", {
                environment = var.environment
              })
            }
          ]
          slackConfigs = [
            {
              apiURL = var.slack_webhook_url
              channel = "#alerts-${var.environment}"
              title = "⚠️ WARNING: {{ .GroupLabels.alertname }}"
              text = "{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}"
              sendResolved = true
              color = "warning"
            }
          ]
        }
      ]

      inhibitRules = [
        {
          sourceMatch = {
            severity = "critical"
          }
          targetMatch = {
            severity = "warning"
          }
          equal = ["alertname", "cluster", "service"]
        }
      ]
    }
  }

  depends_on = [
    kubernetes_manifest.alertmanager_instance
  ]
}

# ==============================================================================
# WEBHOOK RECEIVER FOR CUSTOM INTEGRATIONS
# ==============================================================================

resource "kubernetes_deployment" "webhook_receiver" {
  metadata {
    name      = "webhook-receiver"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = merge(local.common_labels, {
      app = "webhook-receiver"
    })
  }

  spec {
    replicas = var.high_availability ? 2 : 1

    selector {
      match_labels = {
        app = "webhook-receiver"
      }
    }

    template {
      metadata {
        labels = {
          app = "webhook-receiver"
        }
      }

      spec {
        container {
          name  = "webhook-receiver"
          image = "prom/alertmanager:latest"
          
          command = ["/bin/sh"]
          args = [
            "-c",
            "while true; do echo 'Webhook receiver running'; sleep 3600; done"
          ]

          port {
            container_port = 9093
          }

          env {
            name  = "ENVIRONMENT"
            value = var.environment
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

resource "kubernetes_service" "webhook_receiver_service" {
  metadata {
    name      = "webhook-receiver"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  spec {
    selector = {
      app = "webhook-receiver"
    }

    port {
      port        = 9093
      target_port = 9093
    }

    type = "ClusterIP"
  }
}

# ==============================================================================
# ALERT RULES
# ==============================================================================

resource "kubernetes_manifest" "prometheus_rules" {
  for_each = fileset("${path.module}/rules", "*.yml")

  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "PrometheusRule"
    metadata = {
      name      = "prometheus-rules-${replace(each.key, ".yml", "")}"
      namespace = kubernetes_namespace.monitoring.metadata[0].name
      labels = {
        prometheus = "kube-prometheus"
        role       = "alert-rules"
        app        = "kube-prometheus-stack"
      }
    }
    spec = {
      groups = yamldecode(file("${path.module}/rules/${each.key}")).groups
    }
  }

  depends_on = [
    kubernetes_manifest.alertmanager_instance
  ]
}

# ==============================================================================
# DEAD MAN'S SWITCH
# ==============================================================================

resource "kubernetes_manifest" "dead_mans_switch_rule" {
  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "PrometheusRule"
    metadata = {
      name      = "dead-mans-switch"
      namespace = kubernetes_namespace.monitoring.metadata[0].name
      labels = {
        prometheus = "kube-prometheus"
        role       = "alert-rules"
      }
    }
    spec = {
      groups = [
        {
          name = "dead-mans-switch"
          rules = [
            {
              alert = "Watchdog"
              expr = "vector(1)"
              labels = {
                severity = "none"
              }
              annotations = {
                summary = "Alerting is working"
                description = "This is a dead man's switch meant to ensure that the entire alerting pipeline is functional."
              }
            }
          ]
        }
      ]
    }
  }
}

# ==============================================================================
# SILENCES MANAGEMENT
# ==============================================================================

resource "kubernetes_config_map" "silence_templates" {
  metadata {
    name      = "silence-templates"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  data = {
    "maintenance-silence.json" = templatefile("${path.module}/templates/maintenance-silence.json", {
      environment = var.environment
    })
    "deployment-silence.json" = templatefile("${path.module}/templates/deployment-silence.json", {
      environment = var.environment
    })
  }
}

# ==============================================================================
# OUTPUTS
# ==============================================================================

output "alertmanager_service_name" {
  description = "AlertManager service name"
  value       = kubernetes_service.alertmanager_service.metadata[0].name
}

output "alertmanager_url" {
  description = "AlertManager URL"
  value       = "https://alertmanager.${var.domain_name}"
}

output "alertmanager_namespace" {
  description = "AlertManager namespace"
  value       = kubernetes_namespace.monitoring.metadata[0].name
}

output "webhook_receiver_endpoint" {
  description = "Webhook receiver endpoint"
  value       = "http://webhook-receiver.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:9093"
}