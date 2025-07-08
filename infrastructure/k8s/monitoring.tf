# Monitoring Stack - Prometheus, Grafana, AlertManager
# This file configures comprehensive monitoring for Kubernetes clusters

# Prometheus Stack (includes Prometheus, Grafana, AlertManager, and exporters)
resource "helm_release" "kube_prometheus_stack" {
  count = var.enable_monitoring ? 1 : 0
  
  name       = "kube-prometheus-stack"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  version    = "54.0.1"
  namespace  = var.monitoring_namespace
  
  create_namespace = true
  atomic          = var.helm_atomic
  timeout         = var.helm_timeout
  
  values = [
    yamlencode({
      # Global configuration
      global = {
        rbac = {
          create = true
          pspEnabled = var.enable_pod_security_policy
        }
        
        imageRegistry = "quay.io"
      }
      
      # Prometheus configuration
      prometheus = {
        prometheusSpec = {
          retention = var.prometheus_retention
          retentionSize = "40GB"
          
          replicas = var.environment == "production" ? 2 : 1
          
          resources = {
            requests = {
              cpu    = "500m"
              memory = "2Gi"
            }
            limits = {
              cpu    = "2"
              memory = "4Gi"
            }
          }
          
          storageSpec = {
            volumeClaimTemplate = {
              spec = {
                storageClassName = "fast-ssd"
                accessModes      = ["ReadWriteOnce"]
                resources = {
                  requests = {
                    storage = var.prometheus_storage_size
                  }
                }
              }
            }
          }
          
          nodeSelector = {
            "kubernetes.io/os" = "linux"
          }
          
          tolerations = [
            {
              key      = "node-role.kubernetes.io/control-plane"
              operator = "Exists"
              effect   = "NoSchedule"
            }
          ]
          
          affinity = {
            podAntiAffinity = {
              preferredDuringSchedulingIgnoredDuringExecution = [
                {
                  weight = 100
                  podAffinityTerm = {
                    labelSelector = {
                      matchExpressions = [
                        {
                          key      = "app.kubernetes.io/name"
                          operator = "In"
                          values   = ["prometheus"]
                        }
                      ]
                    }
                    topologyKey = "kubernetes.io/hostname"
                  }
                }
              ]
            }
          }
          
          securityContext = {
            runAsNonRoot = true
            runAsUser    = 65534
            runAsGroup   = 65534
            fsGroup      = 65534
          }
          
          containers = [
            {
              name = "prometheus"
              securityContext = {
                allowPrivilegeEscalation = false
                readOnlyRootFilesystem   = true
                runAsNonRoot             = true
                runAsUser                = 65534
                capabilities = {
                  drop = ["ALL"]
                }
              }
            }
          ]
          
          # Service discovery configuration
          serviceMonitorSelectorNilUsesHelmValues = false
          ruleSelectorNilUsesHelmValues          = false
          
          # Remote write configuration for long-term storage
          remoteWrite = var.prometheus_remote_write_enabled ? [
            {
              url = var.prometheus_remote_write_url
              writeRelabelConfigs = [
                {
                  sourceLabels = ["__name__"]
                  regex        = "node_cpu_seconds_total|node_memory_MemTotal_bytes|node_filesystem_size_bytes|node_network_receive_bytes_total|node_network_transmit_bytes_total|kubernetes_build_info|up"
                  action       = "keep"
                }
              ]
            }
          ] : []
          
          # External labels for federation
          externalLabels = {
            cluster     = var.cluster_name
            environment = var.environment
            region      = var.cloud_provider == "aws" ? var.aws_region : var.cloud_provider == "gcp" ? var.gcp_region : var.azure_region
          }
          
          # Scrape configuration
          scrapeInterval = "30s"
          evaluationInterval = "30s"
          
          # WAL compression
          walCompression = true
          
          # Enable admin API
          enableAdminAPI = false
          
          # Prometheus configuration
          additionalScrapeConfigs = [
            {
              job_name = "kubernetes-pods"
              kubernetes_sd_configs = [
                {
                  role = "pod"
                }
              ]
              relabel_configs = [
                {
                  source_labels = ["__meta_kubernetes_pod_annotation_prometheus_io_scrape"]
                  action        = "keep"
                  regex         = "true"
                },
                {
                  source_labels = ["__meta_kubernetes_pod_annotation_prometheus_io_path"]
                  action        = "replace"
                  target_label  = "__metrics_path__"
                  regex         = "(.+)"
                },
                {
                  source_labels = ["__address__", "__meta_kubernetes_pod_annotation_prometheus_io_port"]
                  action        = "replace"
                  regex         = "([^:]+)(?::\\d+)?;(\\d+)"
                  replacement   = "$1:$2"
                  target_label  = "__address__"
                }
              ]
            }
          ]
        }
        
        service = {
          type = "ClusterIP"
          port = 9090
        }
        
        ingress = {
          enabled = var.enable_ingress_nginx
          ingressClassName = var.ingress_class
          annotations = {
            "cert-manager.io/cluster-issuer" = var.enable_cert_manager ? "letsencrypt-prod" : ""
            "nginx.ingress.kubernetes.io/auth-type" = "basic"
            "nginx.ingress.kubernetes.io/auth-secret" = "prometheus-basic-auth"
            "nginx.ingress.kubernetes.io/auth-realm" = "Authentication Required"
          }
          hosts = [
            {
              host = "prometheus.${var.external_domain}"
              paths = [
                {
                  path     = "/"
                  pathType = "Prefix"
                }
              ]
            }
          ]
          tls = var.enable_cert_manager ? [
            {
              secretName = "prometheus-tls"
              hosts      = ["prometheus.${var.external_domain}"]
            }
          ] : []
        }
      }
      
      # Grafana configuration
      grafana = {
        enabled = true
        
        replicas = var.environment == "production" ? 2 : 1
        
        resources = {
          requests = {
            cpu    = "100m"
            memory = "256Mi"
          }
          limits = {
            cpu    = "500m"
            memory = "1Gi"
          }
        }
        
        adminPassword = var.grafana_admin_password
        
        persistence = {
          enabled = true
          size    = "10Gi"
          storageClassName = "standard"
        }
        
        nodeSelector = {
          "kubernetes.io/os" = "linux"
        }
        
        securityContext = {
          runAsNonRoot = true
          runAsUser    = 472
          runAsGroup   = 472
          fsGroup      = 472
        }
        
        containerSecurityContext = {
          allowPrivilegeEscalation = false
          readOnlyRootFilesystem   = true
          runAsNonRoot             = true
          runAsUser                = 472
          capabilities = {
            drop = ["ALL"]
          }
        }
        
        grafana.ini = {
          server = {
            root_url = "https://grafana.${var.external_domain}"
            domain   = "grafana.${var.external_domain}"
          }
          
          security = {
            disable_gravatar        = true
            cookie_secure          = true
            cookie_samesite        = "strict"
            strict_transport_security = true
            content_type_protection = true
          }
          
          auth = {
            disable_login_form = false
            disable_signout_menu = false
          }
          
          analytics = {
            reporting_enabled = false
            check_for_updates = false
          }
          
          log = {
            mode  = "console"
            level = "info"
          }
          
          panels = {
            disable_sanitize_html = false
          }
        }
        
        service = {
          type = "ClusterIP"
          port = 80
        }
        
        ingress = {
          enabled = var.enable_ingress_nginx
          ingressClassName = var.ingress_class
          annotations = {
            "cert-manager.io/cluster-issuer" = var.enable_cert_manager ? "letsencrypt-prod" : ""
            "nginx.ingress.kubernetes.io/rewrite-target" = "/"
          }
          hosts = [
            {
              host = "grafana.${var.external_domain}"
              paths = [
                {
                  path     = "/"
                  pathType = "Prefix"
                }
              ]
            }
          ]
          tls = var.enable_cert_manager ? [
            {
              secretName = "grafana-tls"
              hosts      = ["grafana.${var.external_domain}"]
            }
          ] : []
        }
        
        # Grafana dashboards
        dashboardProviders = {
          "dashboardproviders.yaml" = {
            apiVersion = 1
            providers = [
              {
                name            = "default"
                orgId           = 1
                folder          = ""
                type            = "file"
                disableDeletion = false
                editable        = true
                options = {
                  path = "/var/lib/grafana/dashboards/default"
                }
              }
            ]
          }
        }
        
        dashboards = {
          default = {
            kubernetes-cluster-monitoring = {
              gnetId    = 315
              revision  = 3
              datasource = "Prometheus"
            }
            kubernetes-node-exporter = {
              gnetId    = 1860
              revision  = 27
              datasource = "Prometheus"
            }
            kubernetes-pods = {
              gnetId    = 6417
              revision  = 1
              datasource = "Prometheus"
            }
            kubernetes-deployments = {
              gnetId    = 8588
              revision  = 1
              datasource = "Prometheus"
            }
            nginx-ingress-controller = {
              gnetId    = 9614
              revision  = 1
              datasource = "Prometheus"
            }
          }
        }
        
        # Grafana plugins
        plugins = [
          "grafana-piechart-panel",
          "grafana-worldmap-panel",
          "grafana-clock-panel",
          "grafana-simple-json-datasource"
        ]
        
        # Data sources
        datasources = {
          "datasources.yaml" = {
            apiVersion = 1
            datasources = [
              {
                name      = "Prometheus"
                type      = "prometheus"
                url       = "http://kube-prometheus-stack-prometheus:9090"
                isDefault = true
                editable  = true
              }
            ]
          }
        }
      }
      
      # AlertManager configuration
      alertmanager = {
        enabled = var.enable_alertmanager
        
        alertmanagerSpec = {
          replicas = var.environment == "production" ? 3 : 2
          
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
          
          storage = {
            volumeClaimTemplate = {
              spec = {
                storageClassName = "standard"
                accessModes      = ["ReadWriteOnce"]
                resources = {
                  requests = {
                    storage = "5Gi"
                  }
                }
              }
            }
          }
          
          nodeSelector = {
            "kubernetes.io/os" = "linux"
          }
          
          securityContext = {
            runAsNonRoot = true
            runAsUser    = 65534
            runAsGroup   = 65534
            fsGroup      = 65534
          }
          
          containers = [
            {
              name = "alertmanager"
              securityContext = {
                allowPrivilegeEscalation = false
                readOnlyRootFilesystem   = true
                runAsNonRoot             = true
                runAsUser                = 65534
                capabilities = {
                  drop = ["ALL"]
                }
              }
            }
          ]
          
          # High availability
          affinity = {
            podAntiAffinity = {
              preferredDuringSchedulingIgnoredDuringExecution = [
                {
                  weight = 100
                  podAffinityTerm = {
                    labelSelector = {
                      matchExpressions = [
                        {
                          key      = "app.kubernetes.io/name"
                          operator = "In"
                          values   = ["alertmanager"]
                        }
                      ]
                    }
                    topologyKey = "kubernetes.io/hostname"
                  }
                }
              ]
            }
          }
        }
        
        service = {
          type = "ClusterIP"
          port = 9093
        }
        
        ingress = {
          enabled = var.enable_ingress_nginx
          ingressClassName = var.ingress_class
          annotations = {
            "cert-manager.io/cluster-issuer" = var.enable_cert_manager ? "letsencrypt-prod" : ""
            "nginx.ingress.kubernetes.io/auth-type" = "basic"
            "nginx.ingress.kubernetes.io/auth-secret" = "alertmanager-basic-auth"
            "nginx.ingress.kubernetes.io/auth-realm" = "Authentication Required"
          }
          hosts = [
            {
              host = "alertmanager.${var.external_domain}"
              paths = [
                {
                  path     = "/"
                  pathType = "Prefix"
                }
              ]
            }
          ]
          tls = var.enable_cert_manager ? [
            {
              secretName = "alertmanager-tls"
              hosts      = ["alertmanager.${var.external_domain}"]
            }
          ] : []
        }
        
        config = var.alertmanager_config != "" ? var.alertmanager_config : {
          global = {
            smtp_smarthost = "localhost:587"
            smtp_from      = "alertmanager@${var.external_domain}"
          }
          
          route = {
            group_by        = ["alertname"]
            group_wait      = "10s"
            group_interval  = "10s"
            repeat_interval = "1h"
            receiver        = "web.hook"
          }
          
          receivers = [
            {
              name = "web.hook"
              webhook_configs = [
                {
                  url = "http://127.0.0.1:5001/"
                }
              ]
            }
          ]
          
          inhibit_rules = [
            {
              source_match = {
                severity = "critical"
              }
              target_match = {
                severity = "warning"
              }
              equal = ["alertname", "dev", "instance"]
            }
          ]
        }
      }
      
      # Node Exporter configuration
      nodeExporter = {
        enabled = true
        
        resources = {
          requests = {
            cpu    = "50m"
            memory = "64Mi"
          }
          limits = {
            cpu    = "200m"
            memory = "256Mi"
          }
        }
        
        tolerations = [
          {
            operator = "Exists"
          }
        ]
        
        securityContext = {
          runAsNonRoot = true
          runAsUser    = 65534
          runAsGroup   = 65534
          fsGroup      = 65534
        }
        
        containerSecurityContext = {
          allowPrivilegeEscalation = false
          readOnlyRootFilesystem   = true
          runAsNonRoot             = true
          runAsUser                = 65534
          capabilities = {
            drop = ["ALL"]
          }
        }
      }
      
      # Kube State Metrics configuration
      kubeStateMetrics = {
        enabled = true
        
        resources = {
          requests = {
            cpu    = "50m"
            memory = "64Mi"
          }
          limits = {
            cpu    = "200m"
            memory = "256Mi"
          }
        }
        
        nodeSelector = {
          "kubernetes.io/os" = "linux"
        }
        
        securityContext = {
          runAsNonRoot = true
          runAsUser    = 65534
          runAsGroup   = 65534
          fsGroup      = 65534
        }
        
        containerSecurityContext = {
          allowPrivilegeEscalation = false
          readOnlyRootFilesystem   = true
          runAsNonRoot             = true
          runAsUser                = 65534
          capabilities = {
            drop = ["ALL"]
          }
        }
      }
      
      # Prometheus operator configuration
      prometheusOperator = {
        enabled = true
        
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
        
        nodeSelector = {
          "kubernetes.io/os" = "linux"
        }
        
        securityContext = {
          runAsNonRoot = true
          runAsUser    = 65534
          runAsGroup   = 65534
          fsGroup      = 65534
        }
        
        containerSecurityContext = {
          allowPrivilegeEscalation = false
          readOnlyRootFilesystem   = true
          runAsNonRoot             = true
          runAsUser                = 65534
          capabilities = {
            drop = ["ALL"]
          }
        }
        
        admissionWebhooks = {
          enabled = true
          patch = {
            enabled = true
            resources = {
              requests = {
                cpu    = "50m"
                memory = "64Mi"
              }
              limits = {
                cpu    = "200m"
                memory = "256Mi"
              }
            }
          }
        }
      }
      
      # Default rules
      defaultRules = {
        create = true
        rules = {
          alertmanager = true
          etcd = true
          general = true
          k8s = true
          kubeApiserver = true
          kubeApiserverBurnrate = true
          kubeApiserverHistogram = true
          kubeApiserverSlos = true
          kubelet = true
          kubePrometheusGeneral = true
          kubePrometheusNodeRecording = true
          kubernetesApps = true
          kubernetesResources = true
          kubernetesStorage = true
          kubernetesSystem = true
          kubeScheduler = true
          kubeStateMetrics = true
          network = true
          node = true
          nodeExporterAlerting = true
          nodeExporterRecording = true
          prometheus = true
          prometheusOperator = true
        }
      }
    })
  ]
  
  depends_on = [
    kubernetes_namespace.app_namespaces,
    kubernetes_storage_class.storage_classes
  ]
}

# Additional variables for monitoring
variable "prometheus_remote_write_enabled" {
  description = "Whether to enable Prometheus remote write"
  type        = bool
  default     = false
}

variable "prometheus_remote_write_url" {
  description = "URL for Prometheus remote write"
  type        = string
  default     = ""
}

variable "gcp_region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "azure_region" {
  description = "Azure region"
  type        = string
  default     = "East US"
}

# Basic auth secrets for monitoring services
resource "kubernetes_secret" "prometheus_basic_auth" {
  count = var.enable_monitoring && var.enable_ingress_nginx ? 1 : 0
  
  metadata {
    name      = "prometheus-basic-auth"
    namespace = var.monitoring_namespace
    labels    = local.common_labels
  }
  
  type = "Opaque"
  
  data = {
    auth = base64encode("admin:${bcrypt(var.grafana_admin_password)}")
  }
  
  depends_on = [kubernetes_namespace.app_namespaces]
}

resource "kubernetes_secret" "alertmanager_basic_auth" {
  count = var.enable_monitoring && var.enable_alertmanager && var.enable_ingress_nginx ? 1 : 0
  
  metadata {
    name      = "alertmanager-basic-auth"
    namespace = var.monitoring_namespace
    labels    = local.common_labels
  }
  
  type = "Opaque"
  
  data = {
    auth = base64encode("admin:${bcrypt(var.grafana_admin_password)}")
  }
  
  depends_on = [kubernetes_namespace.app_namespaces]
}

# Custom PrometheusRule for application monitoring
resource "kubectl_manifest" "custom_prometheus_rules" {
  count = var.enable_monitoring ? 1 : 0
  
  yaml_body = <<YAML
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: custom-application-rules
  namespace: ${var.monitoring_namespace}
  labels:
    ${jsonencode(local.common_labels)}
spec:
  groups:
  - name: application.rules
    rules:
    - alert: ApplicationDown
      expr: up{job="kubernetes-pods"} == 0
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "Application is down"
        description: "Application {{ $labels.job }} has been down for more than 5 minutes"
    
    - alert: ApplicationHighLatency
      expr: histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service)) > 0.5
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Application high latency"
        description: "Application {{ $labels.service }} has 95th percentile latency above 500ms"
    
    - alert: ApplicationHighErrorRate
      expr: sum(rate(http_requests_total{status=~"5.."}[5m])) by (service) / sum(rate(http_requests_total[5m])) by (service) > 0.05
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Application high error rate"
        description: "Application {{ $labels.service }} has error rate above 5%"
YAML
  
  depends_on = [helm_release.kube_prometheus_stack]
}

# ServiceMonitor for custom applications
resource "kubectl_manifest" "custom_service_monitor" {
  count = var.enable_monitoring ? 1 : 0
  
  yaml_body = <<YAML
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: custom-application-monitor
  namespace: ${var.monitoring_namespace}
  labels:
    ${jsonencode(local.common_labels)}
spec:
  selector:
    matchLabels:
      monitoring: "true"
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
    honorLabels: true
  namespaceSelector:
    matchNames:
    - production
    - staging
    - development
YAML
  
  depends_on = [helm_release.kube_prometheus_stack]
}

# Network policy for monitoring namespace
resource "kubernetes_network_policy" "monitoring_network_policy" {
  count = var.enable_monitoring && var.enable_network_policies ? 1 : 0
  
  metadata {
    name      = "monitoring-network-policy"
    namespace = var.monitoring_namespace
    labels    = local.common_labels
  }
  
  spec {
    pod_selector {}
    
    policy_types = ["Ingress", "Egress"]
    
    # Allow ingress from ingress controller
    ingress {
      from {
        namespace_selector {
          match_labels = {
            name = "ingress-nginx"
          }
        }
      }
    }
    
    # Allow ingress from same namespace
    ingress {
      from {
        namespace_selector {
          match_labels = {
            name = var.monitoring_namespace
          }
        }
      }
    }
    
    # Allow egress to all namespaces for metrics scraping
    egress {
      to {
        namespace_selector {}
      }
    }
    
    # Allow egress to kube-system for DNS
    egress {
      to {
        namespace_selector {
          match_labels = {
            name = "kube-system"
          }
        }
      }
      
      ports {
        protocol = "UDP"
        port     = "53"
      }
    }
    
    # Allow egress to internet for external integrations
    egress {
      to {}
      
      ports {
        protocol = "TCP"
        port     = "443"
      }
    }
    
    # Allow egress to Kubernetes API
    egress {
      to {}
      
      ports {
        protocol = "TCP"
        port     = "6443"
      }
    }
  }
  
  depends_on = [kubernetes_namespace.app_namespaces]
}