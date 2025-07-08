# Namespace Management and Resource Quotas
# This file manages namespace creation, resource quotas, and namespace-specific configurations

# Create application namespaces
resource "kubernetes_namespace" "app_namespaces" {
  count = var.create_namespaces ? length(var.namespaces) : 0
  
  metadata {
    name = var.namespaces[count.index]
    labels = merge(local.common_labels, {
      "name"                               = var.namespaces[count.index]
      "pod-security.kubernetes.io/enforce" = "restricted"
      "pod-security.kubernetes.io/audit"   = "restricted"
      "pod-security.kubernetes.io/warn"    = "restricted"
    })
    annotations = {
      "description"         = "Namespace for ${var.namespaces[count.index]} workloads"
      "managed-by"          = "terraform"
      "creation-timestamp"  = timestamp()
    }
  }
  
  depends_on = [
    kubernetes_config_map.cluster_metadata
  ]
}

# Resource quotas for each namespace
resource "kubernetes_resource_quota" "namespace_quotas" {
  count = var.create_namespaces ? length(var.namespaces) : 0
  
  metadata {
    name      = "${var.namespaces[count.index]}-quota"
    namespace = kubernetes_namespace.app_namespaces[count.index].metadata[0].name
    labels    = local.common_labels
  }
  
  spec {
    hard = {
      # Compute resources
      "requests.cpu"    = lookup(local.namespace_quotas, var.namespaces[count.index], local.default_quota).cpu_requests
      "requests.memory" = lookup(local.namespace_quotas, var.namespaces[count.index], local.default_quota).memory_requests
      "limits.cpu"      = lookup(local.namespace_quotas, var.namespaces[count.index], local.default_quota).cpu_limits
      "limits.memory"   = lookup(local.namespace_quotas, var.namespaces[count.index], local.default_quota).memory_limits
      
      # Object counts
      "pods"                       = lookup(local.namespace_quotas, var.namespaces[count.index], local.default_quota).pods
      "replicationcontrollers"     = "10"
      "services"                   = "20"
      "services.loadbalancers"     = "5"
      "services.nodeports"         = "10"
      "configmaps"                 = "50"
      "secrets"                    = "50"
      "persistentvolumeclaims"     = "20"
      
      # Extended resources
      "count/deployments.apps"     = "50"
      "count/replicasets.apps"     = "50"
      "count/statefulsets.apps"    = "20"
      "count/daemonsets.apps"      = "10"
      "count/jobs.batch"           = "20"
      "count/cronjobs.batch"       = "10"
      "count/ingresses.networking.k8s.io" = "10"
      "count/networkpolicies.networking.k8s.io" = "20"
    }
  }
}

# Local values for namespace-specific configurations
locals {
  # Default resource quota
  default_quota = {
    cpu_requests    = "2"
    memory_requests = "4Gi"
    cpu_limits      = "4"
    memory_limits   = "8Gi"
    pods           = "50"
  }
  
  # Namespace-specific quotas
  namespace_quotas = {
    "production" = {
      cpu_requests    = "10"
      memory_requests = "20Gi"
      cpu_limits      = "20"
      memory_limits   = "40Gi"
      pods           = "100"
    }
    "staging" = {
      cpu_requests    = "5"
      memory_requests = "10Gi"
      cpu_limits      = "10"
      memory_limits   = "20Gi"
      pods           = "50"
    }
    "development" = {
      cpu_requests    = "2"
      memory_requests = "4Gi"
      cpu_limits      = "4"
      memory_limits   = "8Gi"
      pods           = "30"
    }
    "monitoring" = {
      cpu_requests    = "4"
      memory_requests = "8Gi"
      cpu_limits      = "8"
      memory_limits   = "16Gi"
      pods           = "50"
    }
    "logging" = {
      cpu_requests    = "3"
      memory_requests = "6Gi"
      cpu_limits      = "6"
      memory_limits   = "12Gi"
      pods           = "30"
    }
    "istio-system" = {
      cpu_requests    = "2"
      memory_requests = "4Gi"
      cpu_limits      = "4"
      memory_limits   = "8Gi"
      pods           = "50"
    }
  }
}

# Limit ranges for each namespace
resource "kubernetes_limit_range" "namespace_limits" {
  count = var.create_namespaces && var.enable_limit_ranges ? length(var.namespaces) : 0
  
  metadata {
    name      = "${var.namespaces[count.index]}-limits"
    namespace = kubernetes_namespace.app_namespaces[count.index].metadata[0].name
    labels    = local.common_labels
  }
  
  spec {
    # Container limits
    limit {
      type = "Container"
      default = {
        cpu    = lookup(local.namespace_limits, var.namespaces[count.index], local.default_limits).container_default_cpu
        memory = lookup(local.namespace_limits, var.namespaces[count.index], local.default_limits).container_default_memory
      }
      default_request = {
        cpu    = lookup(local.namespace_limits, var.namespaces[count.index], local.default_limits).container_default_request_cpu
        memory = lookup(local.namespace_limits, var.namespaces[count.index], local.default_limits).container_default_request_memory
      }
      max = {
        cpu    = lookup(local.namespace_limits, var.namespaces[count.index], local.default_limits).container_max_cpu
        memory = lookup(local.namespace_limits, var.namespaces[count.index], local.default_limits).container_max_memory
      }
      min = {
        cpu    = lookup(local.namespace_limits, var.namespaces[count.index], local.default_limits).container_min_cpu
        memory = lookup(local.namespace_limits, var.namespaces[count.index], local.default_limits).container_min_memory
      }
    }
    
    # Pod limits
    limit {
      type = "Pod"
      max = {
        cpu    = lookup(local.namespace_limits, var.namespaces[count.index], local.default_limits).pod_max_cpu
        memory = lookup(local.namespace_limits, var.namespaces[count.index], local.default_limits).pod_max_memory
      }
    }
    
    # Persistent Volume Claim limits
    limit {
      type = "PersistentVolumeClaim"
      max = {
        storage = lookup(local.namespace_limits, var.namespaces[count.index], local.default_limits).pvc_max_storage
      }
      min = {
        storage = lookup(local.namespace_limits, var.namespaces[count.index], local.default_limits).pvc_min_storage
      }
    }
  }
}

# Namespace-specific limit configurations
locals {
  # Default limits
  default_limits = {
    container_default_cpu           = "100m"
    container_default_memory        = "128Mi"
    container_default_request_cpu   = "50m"
    container_default_request_memory = "64Mi"
    container_max_cpu              = "2"
    container_max_memory           = "2Gi"
    container_min_cpu              = "10m"
    container_min_memory           = "32Mi"
    pod_max_cpu                    = "4"
    pod_max_memory                 = "4Gi"
    pvc_max_storage               = "50Gi"
    pvc_min_storage               = "1Gi"
  }
  
  # Namespace-specific limits
  namespace_limits = {
    "production" = {
      container_default_cpu           = "200m"
      container_default_memory        = "256Mi"
      container_default_request_cpu   = "100m"
      container_default_request_memory = "128Mi"
      container_max_cpu              = "4"
      container_max_memory           = "4Gi"
      container_min_cpu              = "50m"
      container_min_memory           = "64Mi"
      pod_max_cpu                    = "8"
      pod_max_memory                 = "8Gi"
      pvc_max_storage               = "100Gi"
      pvc_min_storage               = "5Gi"
    }
    "monitoring" = {
      container_default_cpu           = "100m"
      container_default_memory        = "256Mi"
      container_default_request_cpu   = "50m"
      container_default_request_memory = "128Mi"
      container_max_cpu              = "2"
      container_max_memory           = "4Gi"
      container_min_cpu              = "25m"
      container_min_memory           = "64Mi"
      pod_max_cpu                    = "4"
      pod_max_memory                 = "8Gi"
      pvc_max_storage               = "100Gi"
      pvc_min_storage               = "5Gi"
    }
    "logging" = {
      container_default_cpu           = "100m"
      container_default_memory        = "256Mi"
      container_default_request_cpu   = "50m"
      container_default_request_memory = "128Mi"
      container_max_cpu              = "2"
      container_max_memory           = "4Gi"
      container_min_cpu              = "25m"
      container_min_memory           = "64Mi"
      pod_max_cpu                    = "4"
      pod_max_memory                 = "8Gi"
      pvc_max_storage               = "100Gi"
      pvc_min_storage               = "5Gi"
    }
  }
}

# Network policies for namespace isolation
resource "kubernetes_network_policy" "namespace_isolation" {
  count = var.create_namespaces && var.enable_network_policies ? length(var.namespaces) : 0
  
  metadata {
    name      = "${var.namespaces[count.index]}-isolation"
    namespace = kubernetes_namespace.app_namespaces[count.index].metadata[0].name
    labels    = local.common_labels
  }
  
  spec {
    pod_selector {}
    
    policy_types = ["Ingress", "Egress"]
    
    # Allow ingress from same namespace
    ingress {
      from {
        namespace_selector {
          match_labels = {
            name = var.namespaces[count.index]
          }
        }
      }
    }
    
    # Allow ingress from ingress-nginx namespace
    ingress {
      from {
        namespace_selector {
          match_labels = {
            name = "ingress-nginx"
          }
        }
      }
    }
    
    # Allow ingress from monitoring namespace for metrics scraping
    ingress {
      from {
        namespace_selector {
          match_labels = {
            name = "monitoring"
          }
        }
      }
      ports {
        protocol = "TCP"
        port     = "metrics"
      }
    }
    
    # Allow egress to same namespace
    egress {
      to {
        namespace_selector {
          match_labels = {
            name = var.namespaces[count.index]
          }
        }
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
    
    # Allow egress to internet (customize as needed)
    egress {
      to {}
      ports {
        protocol = "TCP"
        port     = "80"
      }
      ports {
        protocol = "TCP"
        port     = "443"
      }
    }
  }
}

# Pod disruption budgets for critical namespaces
resource "kubernetes_pod_disruption_budget" "critical_apps" {
  count = var.create_namespaces && var.enable_pod_disruption_budgets ? length(local.critical_namespaces) : 0
  
  metadata {
    name      = "${local.critical_namespaces[count.index]}-pdb"
    namespace = local.critical_namespaces[count.index]
    labels    = local.common_labels
  }
  
  spec {
    min_available = "50%"
    
    selector {
      match_labels = {
        tier = "critical"
      }
    }
  }
  
  depends_on = [kubernetes_namespace.app_namespaces]
}

# Critical namespaces that need pod disruption budgets
locals {
  critical_namespaces = [
    "production",
    "monitoring",
    "logging",
    "istio-system",
    "ingress-nginx"
  ]
}

# Service accounts for each namespace
resource "kubernetes_service_account" "namespace_default" {
  count = var.create_namespaces ? length(var.namespaces) : 0
  
  metadata {
    name      = "default"
    namespace = kubernetes_namespace.app_namespaces[count.index].metadata[0].name
    labels    = local.common_labels
    annotations = {
      "description" = "Default service account for ${var.namespaces[count.index]} namespace"
    }
  }
  
  automount_service_account_token = false
}

# Namespace-specific config maps
resource "kubernetes_config_map" "namespace_config" {
  count = var.create_namespaces ? length(var.namespaces) : 0
  
  metadata {
    name      = "${var.namespaces[count.index]}-config"
    namespace = kubernetes_namespace.app_namespaces[count.index].metadata[0].name
    labels    = local.common_labels
  }
  
  data = {
    namespace           = var.namespaces[count.index]
    environment         = var.environment
    cluster_name        = var.cluster_name
    resource_quota      = "enabled"
    network_policy      = var.enable_network_policies ? "enabled" : "disabled"
    pod_security_policy = var.enable_pod_security_policy ? "enabled" : "disabled"
  }
}

# Secrets for each namespace (placeholder)
resource "kubernetes_secret" "namespace_secrets" {
  count = var.create_namespaces ? length(var.namespaces) : 0
  
  metadata {
    name      = "${var.namespaces[count.index]}-secrets"
    namespace = kubernetes_namespace.app_namespaces[count.index].metadata[0].name
    labels    = local.common_labels
  }
  
  type = "Opaque"
  
  data = {
    # Placeholder secrets - replace with actual secrets as needed
    "placeholder" = base64encode("change-me")
  }
}