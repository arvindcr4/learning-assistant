# Main Kubernetes Infrastructure Configuration
# This configuration is cloud-agnostic and works with any Kubernetes cluster

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.24"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
    kubectl = {
      source  = "gavinbunney/kubectl"
      version = "~> 1.14"
    }
  }
  required_version = ">= 1.0"
}

# Local variables for common labels and configurations
locals {
  common_labels = {
    "app.kubernetes.io/managed-by"   = "terraform"
    "app.kubernetes.io/environment"  = var.environment
    "app.kubernetes.io/cluster-name" = var.cluster_name
  }
  
  # Namespace configuration
  system_namespaces = [
    "kube-system",
    "kube-public",
    "kube-node-lease",
    "default"
  ]
  
  # Application namespaces to create
  app_namespaces = var.create_namespaces ? var.namespaces : []
}

# Data sources for cluster information
data "kubernetes_config_map" "cluster_info" {
  metadata {
    name      = "cluster-info"
    namespace = "kube-public"
  }
}

data "kubernetes_nodes" "all" {}

# Create a config map with cluster metadata
resource "kubernetes_config_map" "cluster_metadata" {
  metadata {
    name      = "cluster-metadata"
    namespace = "kube-system"
    labels    = local.common_labels
  }
  
  data = {
    cluster_name        = var.cluster_name
    environment         = var.environment
    terraform_version   = var.terraform_version
    managed_by         = "terraform"
    creation_timestamp = timestamp()
    node_count         = length(data.kubernetes_nodes.all.nodes)
  }
}

# Create a service account for Terraform operations
resource "kubernetes_service_account" "terraform_sa" {
  count = var.create_terraform_sa ? 1 : 0
  
  metadata {
    name      = "terraform-operator"
    namespace = "kube-system"
    labels    = local.common_labels
    annotations = {
      "description" = "Service account for Terraform operations"
    }
  }
  
  automount_service_account_token = true
}

# Create cluster role for Terraform service account
resource "kubernetes_cluster_role" "terraform_cluster_role" {
  count = var.create_terraform_sa ? 1 : 0
  
  metadata {
    name   = "terraform-operator"
    labels = local.common_labels
  }
  
  rule {
    api_groups = [""]
    resources  = ["*"]
    verbs      = ["*"]
  }
  
  rule {
    api_groups = ["apps"]
    resources  = ["*"]
    verbs      = ["*"]
  }
  
  rule {
    api_groups = ["networking.k8s.io"]
    resources  = ["*"]
    verbs      = ["*"]
  }
  
  rule {
    api_groups = ["rbac.authorization.k8s.io"]
    resources  = ["*"]
    verbs      = ["*"]
  }
}

# Bind cluster role to service account
resource "kubernetes_cluster_role_binding" "terraform_cluster_role_binding" {
  count = var.create_terraform_sa ? 1 : 0
  
  metadata {
    name   = "terraform-operator"
    labels = local.common_labels
  }
  
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.terraform_cluster_role[0].metadata[0].name
  }
  
  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.terraform_sa[0].metadata[0].name
    namespace = kubernetes_service_account.terraform_sa[0].metadata[0].namespace
  }
}

# Priority classes for different workload types
resource "kubernetes_priority_class" "system_critical" {
  metadata {
    name   = "system-critical"
    labels = local.common_labels
  }
  
  value          = 1000000
  global_default = false
  description    = "Priority class for system critical workloads"
}

resource "kubernetes_priority_class" "high_priority" {
  metadata {
    name   = "high-priority"
    labels = local.common_labels
  }
  
  value          = 100000
  global_default = false
  description    = "Priority class for high priority workloads"
}

resource "kubernetes_priority_class" "normal_priority" {
  metadata {
    name   = "normal-priority"
    labels = local.common_labels
  }
  
  value          = 0
  global_default = true
  description    = "Priority class for normal priority workloads"
}

# Runtime classes for different container runtimes
resource "kubernetes_runtime_class" "kata" {
  count = var.enable_kata_runtime ? 1 : 0
  
  metadata {
    name   = "kata"
    labels = local.common_labels
  }
  
  handler = "kata"
  
  overhead {
    pod_fixed = {
      cpu    = "100m"
      memory = "128Mi"
    }
  }
  
  scheduling {
    node_classification {
      tolerations {
        key      = "kata"
        operator = "Equal"
        value    = "true"
        effect   = "NoSchedule"
      }
    }
  }
}

# Pod security policy (for clusters that support it)
resource "kubernetes_pod_security_policy" "restricted" {
  count = var.enable_pod_security_policy ? 1 : 0
  
  metadata {
    name   = "restricted-psp"
    labels = local.common_labels
  }
  
  spec {
    privileged                     = false
    allow_privilege_escalation     = false
    required_drop_capabilities     = ["ALL"]
    volumes                       = ["configMap", "emptyDir", "projected", "secret", "downwardAPI", "persistentVolumeClaim"]
    run_as_user {
      rule = "MustRunAsNonRoot"
    }
    run_as_group {
      rule = "MustRunAs"
      ranges {
        min = 1
        max = 65535
      }
    }
    fs_group {
      rule = "RunAsAny"
    }
    se_linux {
      rule = "RunAsAny"
    }
  }
}

# Network policies for default deny-all
resource "kubernetes_network_policy" "default_deny_all" {
  count = var.enable_network_policies ? length(local.app_namespaces) : 0
  
  metadata {
    name      = "default-deny-all"
    namespace = local.app_namespaces[count.index]
    labels    = local.common_labels
  }
  
  spec {
    pod_selector {}
    policy_types = ["Ingress", "Egress"]
  }
}

# Horizontal Pod Autoscaler configuration
resource "kubernetes_horizontal_pod_autoscaler_v2" "default_hpa" {
  count = var.enable_default_hpa ? 1 : 0
  
  metadata {
    name      = "default-hpa"
    namespace = "default"
    labels    = local.common_labels
  }
  
  spec {
    scale_target_ref {
      api_version = "apps/v1"
      kind        = "Deployment"
      name        = "default-app"
    }
    
    min_replicas = 1
    max_replicas = 10
    
    metric {
      type = "Resource"
      resource {
        name = "cpu"
        target {
          type                = "Utilization"
          average_utilization = 70
        }
      }
    }
    
    metric {
      type = "Resource"
      resource {
        name = "memory"
        target {
          type                = "Utilization"
          average_utilization = 80
        }
      }
    }
    
    behavior {
      scale_up {
        stabilization_window_seconds = 300
        select_policy               = "Max"
        policy {
          type          = "Percent"
          value         = 100
          period_seconds = 15
        }
      }
      
      scale_down {
        stabilization_window_seconds = 300
        select_policy               = "Min"
        policy {
          type          = "Percent"
          value         = 10
          period_seconds = 60
        }
      }
    }
  }
}

# Vertical Pod Autoscaler configuration
resource "kubectl_manifest" "vpa_crd" {
  count = var.enable_vpa ? 1 : 0
  
  yaml_body = <<YAML
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: verticalpodautoscalers.autoscaling.k8s.io
  labels:
    ${jsonencode(local.common_labels)}
spec:
  group: autoscaling.k8s.io
  versions:
  - name: v1
    served: true
    storage: true
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
            properties:
              targetRef:
                type: object
              updatePolicy:
                type: object
              resourcePolicy:
                type: object
          status:
            type: object
  scope: Namespaced
  names:
    plural: verticalpodautoscalers
    singular: verticalpodautoscaler
    kind: VerticalPodAutoscaler
    shortNames:
    - vpa
YAML
}

# Cluster-wide resource quotas
resource "kubernetes_resource_quota" "cluster_quota" {
  count = var.enable_cluster_resource_quota ? 1 : 0
  
  metadata {
    name      = "cluster-quota"
    namespace = "default"
    labels    = local.common_labels
  }
  
  spec {
    hard = {
      "requests.cpu"    = var.cluster_cpu_requests
      "requests.memory" = var.cluster_memory_requests
      "limits.cpu"      = var.cluster_cpu_limits
      "limits.memory"   = var.cluster_memory_limits
      "pods"           = var.cluster_pod_limit
    }
  }
}

# Limit ranges for resource constraints
resource "kubernetes_limit_range" "default_limits" {
  count = var.enable_limit_ranges ? length(local.app_namespaces) : 0
  
  metadata {
    name      = "default-limits"
    namespace = local.app_namespaces[count.index]
    labels    = local.common_labels
  }
  
  spec {
    limit {
      type = "Container"
      default = {
        cpu    = "100m"
        memory = "128Mi"
      }
      default_request = {
        cpu    = "50m"
        memory = "64Mi"
      }
      max = {
        cpu    = "2"
        memory = "2Gi"
      }
      min = {
        cpu    = "10m"
        memory = "32Mi"
      }
    }
    
    limit {
      type = "Pod"
      max = {
        cpu    = "4"
        memory = "4Gi"
      }
    }
  }
}