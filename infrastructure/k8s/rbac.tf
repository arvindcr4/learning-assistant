# RBAC (Role-Based Access Control) Configuration
# This file defines comprehensive RBAC policies with least privilege principle

# Random password for service accounts
resource "random_password" "service_account_tokens" {
  count   = var.create_namespaces ? length(var.namespaces) : 0
  length  = 32
  special = true
}

# Developer role for application namespaces
resource "kubernetes_role" "developer" {
  count = var.create_namespaces ? length(var.namespaces) : 0
  
  metadata {
    name      = "developer"
    namespace = kubernetes_namespace.app_namespaces[count.index].metadata[0].name
    labels    = local.common_labels
  }
  
  # Pod management
  rule {
    api_groups = [""]
    resources  = ["pods", "pods/log", "pods/exec"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }
  
  # Service management
  rule {
    api_groups = [""]
    resources  = ["services", "endpoints"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }
  
  # ConfigMap and Secret management
  rule {
    api_groups = [""]
    resources  = ["configmaps", "secrets"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }
  
  # PVC management
  rule {
    api_groups = [""]
    resources  = ["persistentvolumeclaims"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }
  
  # Deployment management
  rule {
    api_groups = ["apps"]
    resources  = ["deployments", "replicasets"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }
  
  # StatefulSet management
  rule {
    api_groups = ["apps"]
    resources  = ["statefulsets"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }
  
  # DaemonSet (read-only)
  rule {
    api_groups = ["apps"]
    resources  = ["daemonsets"]
    verbs      = ["get", "list", "watch"]
  }
  
  # Job and CronJob management
  rule {
    api_groups = ["batch"]
    resources  = ["jobs", "cronjobs"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }
  
  # Ingress management
  rule {
    api_groups = ["networking.k8s.io"]
    resources  = ["ingresses"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }
  
  # NetworkPolicy (read-only)
  rule {
    api_groups = ["networking.k8s.io"]
    resources  = ["networkpolicies"]
    verbs      = ["get", "list", "watch"]
  }
  
  # HPA management
  rule {
    api_groups = ["autoscaling"]
    resources  = ["horizontalpodautoscalers"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }
  
  # Service Account management
  rule {
    api_groups = [""]
    resources  = ["serviceaccounts"]
    verbs      = ["get", "list", "watch", "create", "update", "patch"]
  }
  
  # Events (read-only)
  rule {
    api_groups = [""]
    resources  = ["events"]
    verbs      = ["get", "list", "watch"]
  }
}

# Viewer role for read-only access
resource "kubernetes_role" "viewer" {
  count = var.create_namespaces ? length(var.namespaces) : 0
  
  metadata {
    name      = "viewer"
    namespace = kubernetes_namespace.app_namespaces[count.index].metadata[0].name
    labels    = local.common_labels
  }
  
  # Read-only access to all resources
  rule {
    api_groups = [""]
    resources  = ["*"]
    verbs      = ["get", "list", "watch"]
  }
  
  rule {
    api_groups = ["apps"]
    resources  = ["*"]
    verbs      = ["get", "list", "watch"]
  }
  
  rule {
    api_groups = ["batch"]
    resources  = ["*"]
    verbs      = ["get", "list", "watch"]
  }
  
  rule {
    api_groups = ["networking.k8s.io"]
    resources  = ["*"]
    verbs      = ["get", "list", "watch"]
  }
  
  rule {
    api_groups = ["autoscaling"]
    resources  = ["*"]
    verbs      = ["get", "list", "watch"]
  }
}

# Admin role for full namespace access
resource "kubernetes_role" "admin" {
  count = var.create_namespaces ? length(var.namespaces) : 0
  
  metadata {
    name      = "admin"
    namespace = kubernetes_namespace.app_namespaces[count.index].metadata[0].name
    labels    = local.common_labels
  }
  
  # Full access to all resources except RBAC
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
    api_groups = ["batch"]
    resources  = ["*"]
    verbs      = ["*"]
  }
  
  rule {
    api_groups = ["networking.k8s.io"]
    resources  = ["*"]
    verbs      = ["*"]
  }
  
  rule {
    api_groups = ["autoscaling"]
    resources  = ["*"]
    verbs      = ["*"]
  }
  
  rule {
    api_groups = ["policy"]
    resources  = ["*"]
    verbs      = ["*"]
  }
  
  # Limited RBAC access
  rule {
    api_groups = ["rbac.authorization.k8s.io"]
    resources  = ["roles", "rolebindings"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }
}

# Cluster-level roles
resource "kubernetes_cluster_role" "cluster_viewer" {
  metadata {
    name   = "cluster-viewer"
    labels = local.common_labels
  }
  
  # Read-only access to cluster-level resources
  rule {
    api_groups = [""]
    resources  = ["nodes", "persistentvolumes", "namespaces"]
    verbs      = ["get", "list", "watch"]
  }
  
  rule {
    api_groups = ["storage.k8s.io"]
    resources  = ["storageclasses", "volumeattachments"]
    verbs      = ["get", "list", "watch"]
  }
  
  rule {
    api_groups = ["rbac.authorization.k8s.io"]
    resources  = ["clusterroles", "clusterrolebindings"]
    verbs      = ["get", "list", "watch"]
  }
  
  rule {
    api_groups = ["apiextensions.k8s.io"]
    resources  = ["customresourcedefinitions"]
    verbs      = ["get", "list", "watch"]
  }
  
  rule {
    api_groups = ["metrics.k8s.io"]
    resources  = ["nodes", "pods"]
    verbs      = ["get", "list"]
  }
}

# Monitoring role for Prometheus
resource "kubernetes_cluster_role" "monitoring" {
  metadata {
    name   = "monitoring"
    labels = local.common_labels
  }
  
  # Metrics access
  rule {
    api_groups = [""]
    resources  = ["nodes", "nodes/metrics", "nodes/proxy", "services", "endpoints", "pods"]
    verbs      = ["get", "list", "watch"]
  }
  
  rule {
    api_groups = ["apps"]
    resources  = ["deployments", "replicasets", "daemonsets", "statefulsets"]
    verbs      = ["get", "list", "watch"]
  }
  
  rule {
    api_groups = ["batch"]
    resources  = ["jobs", "cronjobs"]
    verbs      = ["get", "list", "watch"]
  }
  
  rule {
    api_groups = ["networking.k8s.io"]
    resources  = ["ingresses"]
    verbs      = ["get", "list", "watch"]
  }
  
  rule {
    api_groups = [""]
    resources  = ["configmaps"]
    verbs      = ["get"]
  }
  
  rule {
    non_resource_urls = ["/metrics"]
    verbs             = ["get"]
  }
}

# Logging role for log aggregation
resource "kubernetes_cluster_role" "logging" {
  metadata {
    name   = "logging"
    labels = local.common_labels
  }
  
  # Log access
  rule {
    api_groups = [""]
    resources  = ["pods", "pods/log", "namespaces"]
    verbs      = ["get", "list", "watch"]
  }
  
  rule {
    api_groups = [""]
    resources  = ["nodes"]
    verbs      = ["get", "list"]
  }
  
  rule {
    api_groups = ["apps"]
    resources  = ["deployments", "replicasets", "daemonsets", "statefulsets"]
    verbs      = ["get", "list"]
  }
}

# Backup role for backup operations
resource "kubernetes_cluster_role" "backup" {
  metadata {
    name   = "backup"
    labels = local.common_labels
  }
  
  # Backup access
  rule {
    api_groups = [""]
    resources  = ["*"]
    verbs      = ["get", "list", "watch"]
  }
  
  rule {
    api_groups = ["apps"]
    resources  = ["*"]
    verbs      = ["get", "list", "watch"]
  }
  
  rule {
    api_groups = ["batch"]
    resources  = ["*"]
    verbs      = ["get", "list", "watch"]
  }
  
  rule {
    api_groups = ["networking.k8s.io"]
    resources  = ["*"]
    verbs      = ["get", "list", "watch"]
  }
  
  rule {
    api_groups = ["storage.k8s.io"]
    resources  = ["*"]
    verbs      = ["get", "list", "watch"]
  }
  
  rule {
    api_groups = ["apiextensions.k8s.io"]
    resources  = ["customresourcedefinitions"]
    verbs      = ["get", "list", "watch"]
  }
  
  rule {
    api_groups = ["rbac.authorization.k8s.io"]
    resources  = ["*"]
    verbs      = ["get", "list", "watch"]
  }
}

# Service accounts for system components
resource "kubernetes_service_account" "monitoring_sa" {
  count = var.enable_monitoring ? 1 : 0
  
  metadata {
    name      = "monitoring-service-account"
    namespace = var.monitoring_namespace
    labels    = local.common_labels
  }
  
  automount_service_account_token = true
  
  depends_on = [kubernetes_namespace.app_namespaces]
}

resource "kubernetes_service_account" "logging_sa" {
  count = var.enable_logging ? 1 : 0
  
  metadata {
    name      = "logging-service-account"
    namespace = var.logging_namespace
    labels    = local.common_labels
  }
  
  automount_service_account_token = true
  
  depends_on = [kubernetes_namespace.app_namespaces]
}

resource "kubernetes_service_account" "backup_sa" {
  count = var.enable_backup ? 1 : 0
  
  metadata {
    name      = "backup-service-account"
    namespace = "backup"
    labels    = local.common_labels
  }
  
  automount_service_account_token = true
  
  depends_on = [kubernetes_namespace.app_namespaces]
}

# Cluster role bindings for system components
resource "kubernetes_cluster_role_binding" "monitoring_binding" {
  count = var.enable_monitoring ? 1 : 0
  
  metadata {
    name   = "monitoring-cluster-role-binding"
    labels = local.common_labels
  }
  
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.monitoring.metadata[0].name
  }
  
  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.monitoring_sa[0].metadata[0].name
    namespace = kubernetes_service_account.monitoring_sa[0].metadata[0].namespace
  }
}

resource "kubernetes_cluster_role_binding" "logging_binding" {
  count = var.enable_logging ? 1 : 0
  
  metadata {
    name   = "logging-cluster-role-binding"
    labels = local.common_labels
  }
  
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.logging.metadata[0].name
  }
  
  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.logging_sa[0].metadata[0].name
    namespace = kubernetes_service_account.logging_sa[0].metadata[0].namespace
  }
}

resource "kubernetes_cluster_role_binding" "backup_binding" {
  count = var.enable_backup ? 1 : 0
  
  metadata {
    name   = "backup-cluster-role-binding"
    labels = local.common_labels
  }
  
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.backup.metadata[0].name
  }
  
  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.backup_sa[0].metadata[0].name
    namespace = kubernetes_service_account.backup_sa[0].metadata[0].namespace
  }
}

# Security context constraints for OpenShift
resource "kubectl_manifest" "security_context_constraints" {
  count = var.enable_security_context_constraints ? 1 : 0
  
  yaml_body = <<YAML
apiVersion: security.openshift.io/v1
kind: SecurityContextConstraints
metadata:
  name: restricted-scc
  labels:
    ${jsonencode(local.common_labels)}
allowHostDirVolumePlugin: false
allowHostIPC: false
allowHostNetwork: false
allowHostPID: false
allowHostPorts: false
allowPrivilegeEscalation: false
allowPrivilegedContainer: false
allowedCapabilities: null
defaultAddCapabilities: null
fsGroup:
  type: MustRunAs
readOnlyRootFilesystem: false
requiredDropCapabilities:
- KILL
- MKNOD
- SETUID
- SETGID
runAsUser:
  type: MustRunAsRange
seLinuxContext:
  type: MustRunAs
supplementalGroups:
  type: RunAsAny
users: []
groups: []
volumes:
- configMap
- downwardAPI
- emptyDir
- persistentVolumeClaim
- projected
- secret
YAML
}

# Pod security standards
resource "kubectl_manifest" "pod_security_standards" {
  count = var.enable_pod_security_policy ? length(var.namespaces) : 0
  
  yaml_body = <<YAML
apiVersion: v1
kind: ConfigMap
metadata:
  name: pod-security-standards
  namespace: ${var.namespaces[count.index]}
  labels:
    ${jsonencode(local.common_labels)}
data:
  enforce: "restricted"
  audit: "restricted"
  warn: "restricted"
YAML
  
  depends_on = [kubernetes_namespace.app_namespaces]
}

# Network policy for RBAC enforcement
resource "kubernetes_network_policy" "rbac_enforcement" {
  count = var.enable_network_policies ? 1 : 0
  
  metadata {
    name      = "rbac-enforcement"
    namespace = "kube-system"
    labels    = local.common_labels
  }
  
  spec {
    pod_selector {
      match_labels = {
        component = "kube-apiserver"
      }
    }
    
    policy_types = ["Ingress"]
    
    ingress {
      from {
        pod_selector {}
      }
      
      ports {
        protocol = "TCP"
        port     = "443"
      }
    }
  }
}

# Service account for external secrets operator
resource "kubernetes_service_account" "external_secrets_sa" {
  count = var.enable_external_secrets ? 1 : 0
  
  metadata {
    name      = "external-secrets-service-account"
    namespace = "external-secrets"
    labels    = local.common_labels
    annotations = {
      "eks.amazonaws.com/role-arn" = var.external_secrets_role_arn
    }
  }
  
  automount_service_account_token = true
  
  depends_on = [kubernetes_namespace.app_namespaces]
}

# Additional variables for external secrets
variable "enable_external_secrets" {
  description = "Whether to enable external secrets operator"
  type        = bool
  default     = false
}

variable "external_secrets_role_arn" {
  description = "IAM role ARN for external secrets operator"
  type        = string
  default     = ""
}

# Role for cert-manager
resource "kubernetes_cluster_role" "cert_manager" {
  count = var.enable_cert_manager ? 1 : 0
  
  metadata {
    name   = "cert-manager"
    labels = local.common_labels
  }
  
  rule {
    api_groups = [""]
    resources  = ["configmaps", "endpoints", "events", "pods", "secrets", "services", "serviceaccounts"]
    verbs      = ["get", "list", "watch", "create", "update", "patch"]
  }
  
  rule {
    api_groups = [""]
    resources  = ["secrets"]
    verbs      = ["delete"]
  }
  
  rule {
    api_groups = ["apps"]
    resources  = ["deployments"]
    verbs      = ["get", "list", "watch", "create", "update", "patch"]
  }
  
  rule {
    api_groups = ["cert-manager.io"]
    resources  = ["*"]
    verbs      = ["*"]
  }
  
  rule {
    api_groups = ["acme.cert-manager.io"]
    resources  = ["*"]
    verbs      = ["*"]
  }
  
  rule {
    api_groups = ["networking.k8s.io"]
    resources  = ["ingresses"]
    verbs      = ["get", "list", "watch", "create", "update", "patch"]
  }
  
  rule {
    api_groups = ["route.openshift.io"]
    resources  = ["routes/custom-host"]
    verbs      = ["create"]
  }
}

# Default role bindings for namespace service accounts
resource "kubernetes_role_binding" "default_sa_binding" {
  count = var.create_namespaces ? length(var.namespaces) : 0
  
  metadata {
    name      = "default-sa-binding"
    namespace = kubernetes_namespace.app_namespaces[count.index].metadata[0].name
    labels    = local.common_labels
  }
  
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.viewer[count.index].metadata[0].name
  }
  
  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.namespace_default[count.index].metadata[0].name
    namespace = kubernetes_service_account.namespace_default[count.index].metadata[0].namespace
  }
}