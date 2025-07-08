# ==============================================================================
# COMPREHENSIVE MONITORING INFRASTRUCTURE
# Multi-Cloud Observability Platform with Terraform
# ==============================================================================

terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 6.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.4"
    }
  }
}

# ==============================================================================
# VARIABLES
# ==============================================================================

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "Primary region for deployment"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "cluster_name" {
  description = "Kubernetes cluster name"
  type        = string
}

variable "domain_name" {
  description = "Domain name for monitoring services"
  type        = string
}

variable "notification_email" {
  description = "Email for critical alerts"
  type        = string
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for alerts"
  type        = string
  sensitive   = true
}

variable "pagerduty_integration_key" {
  description = "PagerDuty integration key"
  type        = string
  sensitive   = true
}

variable "enable_multi_cloud" {
  description = "Enable multi-cloud monitoring"
  type        = bool
  default     = true
}

variable "retention_days" {
  description = "Metrics retention period in days"
  type        = number
  default     = 30
}

variable "high_availability" {
  description = "Enable high availability for monitoring stack"
  type        = bool
  default     = true
}

# ==============================================================================
# LOCALS
# ==============================================================================

locals {
  common_labels = {
    project     = var.project_id
    environment = var.environment
    managed_by  = "terraform"
    purpose     = "monitoring"
  }

  monitoring_namespace = "monitoring"
  logging_namespace   = "logging"
  tracing_namespace   = "tracing"

  # Prometheus configuration
  prometheus_config = {
    retention_time    = "${var.retention_days}d"
    storage_size     = var.environment == "prod" ? "100Gi" : "50Gi"
    replica_count    = var.high_availability ? 2 : 1
    cpu_request      = "500m"
    memory_request   = "2Gi"
    cpu_limit        = "2000m"
    memory_limit     = "8Gi"
  }

  # Grafana configuration
  grafana_config = {
    replica_count    = var.high_availability ? 2 : 1
    cpu_request      = "250m"
    memory_request   = "512Mi"
    cpu_limit        = "1000m"
    memory_limit     = "2Gi"
    storage_size     = "10Gi"
  }

  # Jaeger configuration
  jaeger_config = {
    collector_replicas = var.high_availability ? 2 : 1
    query_replicas    = var.high_availability ? 2 : 1
    storage_size      = "50Gi"
    retention_days    = var.retention_days
  }

  # Elasticsearch configuration
  elasticsearch_config = {
    master_nodes   = var.high_availability ? 3 : 1
    data_nodes     = var.high_availability ? 3 : 1
    client_nodes   = var.high_availability ? 2 : 1
    storage_size   = var.environment == "prod" ? "100Gi" : "50Gi"
    heap_size      = "2g"
    retention_days = var.retention_days
  }
}

# ==============================================================================
# RANDOM RESOURCES
# ==============================================================================

resource "random_password" "grafana_admin_password" {
  length  = 16
  special = true
}

resource "random_password" "elasticsearch_password" {
  length  = 16
  special = true
}

resource "random_id" "monitoring_suffix" {
  byte_length = 4
}

# ==============================================================================
# KUBERNETES NAMESPACES
# ==============================================================================

resource "kubernetes_namespace" "monitoring" {
  metadata {
    name = local.monitoring_namespace
    labels = merge(local.common_labels, {
      name = local.monitoring_namespace
    })
  }
}

resource "kubernetes_namespace" "logging" {
  metadata {
    name = local.logging_namespace
    labels = merge(local.common_labels, {
      name = local.logging_namespace
    })
  }
}

resource "kubernetes_namespace" "tracing" {
  metadata {
    name = local.tracing_namespace
    labels = merge(local.common_labels, {
      name = local.tracing_namespace
    })
  }
}

# ==============================================================================
# STORAGE CLASSES
# ==============================================================================

resource "kubernetes_storage_class" "monitoring_ssd" {
  metadata {
    name = "monitoring-ssd"
  }
  storage_provisioner    = "kubernetes.io/gce-pd"
  reclaim_policy        = "Retain"
  allow_volume_expansion = true
  volume_binding_mode   = "WaitForFirstConsumer"
  parameters = {
    type               = "pd-ssd"
    replication-type   = "regional-pd"
    zones              = "${var.region}-a,${var.region}-b,${var.region}-c"
  }
}

# ==============================================================================
# SECRETS MANAGEMENT
# ==============================================================================

resource "kubernetes_secret" "monitoring_secrets" {
  metadata {
    name      = "monitoring-secrets"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  data = {
    grafana-admin-password      = random_password.grafana_admin_password.result
    elasticsearch-password      = random_password.elasticsearch_password.result
    slack-webhook-url          = var.slack_webhook_url
    pagerduty-integration-key  = var.pagerduty_integration_key
    notification-email         = var.notification_email
  }

  type = "Opaque"
}

# ==============================================================================
# NETWORK POLICIES
# ==============================================================================

resource "kubernetes_network_policy" "monitoring_network_policy" {
  metadata {
    name      = "monitoring-network-policy"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  spec {
    pod_selector {
      match_labels = {
        app = "monitoring"
      }
    }

    policy_types = ["Ingress", "Egress"]

    ingress {
      from {
        namespace_selector {
          match_labels = {
            name = local.monitoring_namespace
          }
        }
      }

      ports {
        protocol = "TCP"
        port     = "9090"
      }
      ports {
        protocol = "TCP"
        port     = "3000"
      }
      ports {
        protocol = "TCP"
        port     = "9200"
      }
    }

    egress {
      to {}
      ports {
        protocol = "TCP"
        port     = "443"
      }
      ports {
        protocol = "TCP"
        port     = "80"
      }
      ports {
        protocol = "UDP"
        port     = "53"
      }
    }
  }
}

# ==============================================================================
# RBAC CONFIGURATION
# ==============================================================================

resource "kubernetes_service_account" "monitoring_sa" {
  metadata {
    name      = "monitoring-serviceaccount"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }
}

resource "kubernetes_cluster_role" "monitoring_cluster_role" {
  metadata {
    name = "monitoring-cluster-role"
  }

  rule {
    api_groups = [""]
    resources  = ["nodes", "nodes/proxy", "services", "endpoints", "pods"]
    verbs      = ["get", "list", "watch"]
  }

  rule {
    api_groups = ["extensions"]
    resources  = ["ingresses"]
    verbs      = ["get", "list", "watch"]
  }

  rule {
    api_groups = ["apps"]
    resources  = ["deployments", "replicasets", "daemonsets", "statefulsets"]
    verbs      = ["get", "list", "watch"]
  }

  rule {
    api_groups = ["monitoring.coreos.com"]
    resources  = ["*"]
    verbs      = ["*"]
  }
}

resource "kubernetes_cluster_role_binding" "monitoring_cluster_role_binding" {
  metadata {
    name = "monitoring-cluster-role-binding"
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.monitoring_cluster_role.metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.monitoring_sa.metadata[0].name
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }
}

# ==============================================================================
# CONFIGMAPS
# ==============================================================================

resource "kubernetes_config_map" "prometheus_config" {
  metadata {
    name      = "prometheus-config"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  data = {
    "prometheus.yml" = templatefile("${path.module}/configs/prometheus.yml.tpl", {
      environment    = var.environment
      cluster_name   = var.cluster_name
      retention_time = local.prometheus_config.retention_time
    })
  }
}

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

resource "kubernetes_config_map" "alertmanager_config" {
  metadata {
    name      = "alertmanager-config"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  data = {
    "alertmanager.yml" = templatefile("${path.module}/configs/alertmanager.yml.tpl", {
      notification_email        = var.notification_email
      slack_webhook_url         = var.slack_webhook_url
      pagerduty_integration_key = var.pagerduty_integration_key
    })
  }
}

# ==============================================================================
# PERSISTENT VOLUMES
# ==============================================================================

resource "kubernetes_persistent_volume_claim" "prometheus_storage" {
  metadata {
    name      = "prometheus-storage"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  spec {
    access_modes       = ["ReadWriteOnce"]
    storage_class_name = kubernetes_storage_class.monitoring_ssd.metadata[0].name
    
    resources {
      requests = {
        storage = local.prometheus_config.storage_size
      }
    }
  }
}

resource "kubernetes_persistent_volume_claim" "grafana_storage" {
  metadata {
    name      = "grafana-storage"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  spec {
    access_modes       = ["ReadWriteOnce"]
    storage_class_name = kubernetes_storage_class.monitoring_ssd.metadata[0].name
    
    resources {
      requests = {
        storage = local.grafana_config.storage_size
      }
    }
  }
}

# ==============================================================================
# CUSTOM RESOURCE DEFINITIONS
# ==============================================================================

# This will be populated by the Prometheus operator
resource "kubernetes_manifest" "prometheus_crd" {
  manifest = {
    apiVersion = "apiextensions.k8s.io/v1"
    kind       = "CustomResourceDefinition"
    metadata = {
      name = "prometheuses.monitoring.coreos.com"
    }
    spec = {
      group = "monitoring.coreos.com"
      versions = [{
        name    = "v1"
        served  = true
        storage = true
        schema = {
          openAPIV3Schema = {
            type = "object"
            properties = {
              spec = {
                type = "object"
                properties = {
                  replicas = {
                    type = "integer"
                  }
                  serviceAccountName = {
                    type = "string"
                  }
                  storage = {
                    type = "object"
                    properties = {
                      volumeClaimTemplate = {
                        type = "object"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }]
      scope = "Namespaced"
      names = {
        plural   = "prometheuses"
        singular = "prometheus"
        kind     = "Prometheus"
      }
    }
  }
}

# ==============================================================================
# OUTPUTS
# ==============================================================================

output "monitoring_namespace" {
  description = "Monitoring namespace name"
  value       = kubernetes_namespace.monitoring.metadata[0].name
}

output "logging_namespace" {
  description = "Logging namespace name"
  value       = kubernetes_namespace.logging.metadata[0].name
}

output "tracing_namespace" {
  description = "Tracing namespace name"
  value       = kubernetes_namespace.tracing.metadata[0].name
}

output "grafana_admin_password" {
  description = "Grafana admin password"
  value       = random_password.grafana_admin_password.result
  sensitive   = true
}

output "monitoring_endpoints" {
  description = "Monitoring service endpoints"
  value = {
    prometheus  = "https://prometheus.${var.domain_name}"
    grafana     = "https://grafana.${var.domain_name}"
    alertmanager = "https://alertmanager.${var.domain_name}"
    jaeger      = "https://jaeger.${var.domain_name}"
    kibana      = "https://kibana.${var.domain_name}"
  }
}

output "monitoring_storage_class" {
  description = "Storage class for monitoring components"
  value       = kubernetes_storage_class.monitoring_ssd.metadata[0].name
}