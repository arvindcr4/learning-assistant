# Storage Configuration with Persistent Storage and Backup Solutions
# This file manages storage classes, persistent volumes, and backup configurations

# Storage Classes for different performance tiers
resource "kubernetes_storage_class" "storage_classes" {
  for_each = var.enable_storage_classes ? var.storage_classes : {}
  
  metadata {
    name = each.key
    labels = merge(local.common_labels, {
      "storage-tier" = each.key
    })
    annotations = {
      "description" = "Storage class for ${each.key} workloads"
      "storageclass.kubernetes.io/is-default-class" = each.key == "standard" ? "true" : "false"
    }
  }
  
  storage_provisioner    = each.value.provisioner
  reclaim_policy        = each.value.reclaim_policy
  volume_binding_mode   = each.value.volume_binding_mode
  allow_volume_expansion = each.value.allow_expansion
  
  parameters = each.value.parameters
  
  mount_options = lookup(local.storage_mount_options, each.key, [])
}

# Local storage mount options for different storage classes
locals {
  storage_mount_options = {
    "fast-ssd" = ["noatime", "nodiratime"]
    "standard" = ["noatime"]
    "backup"   = ["noatime", "nodiratime", "ro"]
  }
}

# CSI Snapshot Controller for volume snapshots
resource "helm_release" "snapshot_controller" {
  count = var.enable_volume_snapshots ? 1 : 0
  
  name       = "snapshot-controller"
  repository = "https://piraeus.io/helm-charts"
  chart      = "snapshot-controller"
  version    = "1.7.0"
  namespace  = "kube-system"
  
  atomic  = var.helm_atomic
  timeout = var.helm_timeout
  
  values = [
    yamlencode({
      replicaCount = var.environment == "production" ? 3 : 2
      
      image = {
        repository = "registry.k8s.io/sig-storage/snapshot-controller"
        tag        = "v6.3.0"
      }
      
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
      
      podDisruptionBudget = {
        enabled      = true
        minAvailable = var.environment == "production" ? 2 : 1
      }
      
      securityContext = {
        runAsNonRoot = true
        runAsUser    = 1000
        runAsGroup   = 1000
        fsGroup      = 1000
      }
      
      containerSecurityContext = {
        allowPrivilegeEscalation = false
        readOnlyRootFilesystem   = true
        runAsNonRoot             = true
        runAsUser                = 1000
        capabilities = {
          drop = ["ALL"]
        }
      }
    })
  ]
}

# Volume Snapshot Classes
resource "kubectl_manifest" "volume_snapshot_class" {
  count = var.enable_volume_snapshots ? length(local.snapshot_classes) : 0
  
  yaml_body = <<YAML
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshotClass
metadata:
  name: ${local.snapshot_classes[count.index].name}
  labels:
    ${jsonencode(local.common_labels)}
spec:
  driver: ${local.snapshot_classes[count.index].driver}
  deletionPolicy: ${local.snapshot_classes[count.index].deletion_policy}
  parameters:
    ${jsonencode(local.snapshot_classes[count.index].parameters)}
YAML
  
  depends_on = [helm_release.snapshot_controller]
}

# Snapshot class configurations
locals {
  snapshot_classes = [
    {
      name            = "csi-snapclass"
      driver          = var.cloud_provider == "aws" ? "ebs.csi.aws.com" : var.cloud_provider == "gcp" ? "pd.csi.storage.gke.io" : var.cloud_provider == "azure" ? "disk.csi.azure.com" : "example.com/csi-driver"
      deletion_policy = "Delete"
      parameters = var.cloud_provider == "aws" ? {
        type = "gp3"
      } : var.cloud_provider == "gcp" ? {
        type = "pd-standard"
      } : {}
    }
  ]
}

# Velero for backup and disaster recovery
resource "helm_release" "velero" {
  count = var.enable_backup ? 1 : 0
  
  name       = "velero"
  repository = "https://vmware-tanzu.github.io/helm-charts"
  chart      = "velero"
  version    = "5.1.4"
  namespace  = "backup"
  
  create_namespace = true
  atomic          = var.helm_atomic
  timeout         = var.helm_timeout
  
  values = [
    yamlencode({
      image = {
        repository = "velero/velero"
        tag        = "v1.12.1"
      }
      
      configuration = {
        backupStorageLocation = [
          {
            name     = "default"
            provider = var.cloud_provider == "aws" ? "aws" : var.cloud_provider == "gcp" ? "gcp" : var.cloud_provider == "azure" ? "azure" : "restic"
            bucket   = var.backup_storage_location
            config = var.cloud_provider == "aws" ? {
              region = var.aws_region
              s3ForcePathStyle = "false"
            } : var.cloud_provider == "gcp" ? {
              project = var.gcp_project_id
            } : var.cloud_provider == "azure" ? {
              resourceGroup     = var.azure_resource_group
              storageAccount    = var.azure_storage_account
            } : {}
          }
        ]
        
        volumeSnapshotLocation = var.enable_volume_snapshots ? [
          {
            name     = "default"
            provider = var.cloud_provider == "aws" ? "aws" : var.cloud_provider == "gcp" ? "gcp" : var.cloud_provider == "azure" ? "azure" : "csi"
            config = var.cloud_provider == "aws" ? {
              region = var.aws_region
            } : var.cloud_provider == "gcp" ? {
              project = var.gcp_project_id
            } : var.cloud_provider == "azure" ? {
              resourceGroup     = var.azure_resource_group
            } : {}
          }
        ] : []
        
        defaultVolumeSnapshotLocations = var.enable_volume_snapshots ? {
          aws   = var.cloud_provider == "aws" ? "default" : null
          gcp   = var.cloud_provider == "gcp" ? "default" : null
          azure = var.cloud_provider == "azure" ? "default" : null
        } : {}
        
        logLevel = "info"
        logFormat = "json"
        
        defaultBackupStorageLocation = "default"
        
        features = "EnableCSI"
        
        garbageCollectionFrequency = "72h"
        
        defaultBackupTTL = var.backup_retention
        
        restoreResourcePriorities = [
          "customresourcedefinitions",
          "namespaces",
          "storageclasses",
          "volumesnapshotclass.snapshot.storage.k8s.io",
          "volumesnapshotcontents.snapshot.storage.k8s.io",
          "volumesnapshots.snapshot.storage.k8s.io",
          "persistentvolumes",
          "persistentvolumeclaims",
          "secrets",
          "configmaps",
          "serviceaccounts",
          "limitranges",
          "pods",
          "replicasets.apps",
          "clusterroles.rbac.authorization.k8s.io",
          "clusterrolebindings.rbac.authorization.k8s.io",
          "roles.rbac.authorization.k8s.io",
          "rolebindings.rbac.authorization.k8s.io"
        ]
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
      
      securityContext = {
        runAsNonRoot = true
        runAsUser    = 1000
        runAsGroup   = 1000
        fsGroup      = 1000
      }
      
      containerSecurityContext = {
        allowPrivilegeEscalation = false
        readOnlyRootFilesystem   = true
        runAsNonRoot             = true
        runAsUser                = 1000
        capabilities = {
          drop = ["ALL"]
        }
      }
      
      initContainers = [
        {
          name  = "velero-plugin-for-aws"
          image = "velero/velero-plugin-for-aws:v1.8.0"
          volumeMounts = [
            {
              mountPath = "/target"
              name      = "plugins"
            }
          ]
        }
      ]
      
      metrics = {
        enabled = var.enable_monitoring
        serviceMonitor = {
          enabled   = var.enable_monitoring
          namespace = var.monitoring_namespace
        }
      }
      
      # Cloud provider specific configurations
      serviceAccount = {
        server = {
          create = true
          name   = "velero-server"
          annotations = var.cloud_provider == "aws" ? {
            "eks.amazonaws.com/role-arn" = var.velero_role_arn
          } : {}
        }
      }
      
      rbac = {
        create = true
        clusterAdministrator = true
      }
      
      deployRestic = true
      
      restic = {
        podVolumePath = "/var/lib/kubelet/pods"
        privileged    = false
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
        
        securityContext = {
          runAsUser  = 0
          runAsGroup = 0
          fsGroup    = 0
        }
        
        tolerations = [
          {
            operator = "Exists"
          }
        ]
      }
    })
  ]
  
  depends_on = [kubernetes_namespace.app_namespaces]
}

# Additional variables for backup configuration
variable "enable_volume_snapshots" {
  description = "Whether to enable volume snapshots"
  type        = bool
  default     = true
}

variable "velero_role_arn" {
  description = "IAM role ARN for Velero"
  type        = string
  default     = ""
}

variable "azure_storage_account" {
  description = "Azure storage account for Velero"
  type        = string
  default     = ""
}

# Backup schedules
resource "kubectl_manifest" "backup_schedule" {
  count = var.enable_backup ? length(local.backup_schedules) : 0
  
  yaml_body = <<YAML
apiVersion: velero.io/v1
kind: Schedule
metadata:
  name: ${local.backup_schedules[count.index].name}
  namespace: backup
  labels:
    ${jsonencode(local.common_labels)}
spec:
  schedule: ${local.backup_schedules[count.index].schedule}
  template:
    includedNamespaces: ${jsonencode(local.backup_schedules[count.index].namespaces)}
    excludedNamespaces: ${jsonencode(local.backup_schedules[count.index].excluded_namespaces)}
    includeClusterResources: ${local.backup_schedules[count.index].include_cluster_resources}
    ttl: ${local.backup_schedules[count.index].ttl}
    storageLocation: default
    volumeSnapshotLocations:
    - default
YAML
  
  depends_on = [helm_release.velero]
}

# Backup schedule configurations
locals {
  backup_schedules = [
    {
      name             = "daily-backup"
      schedule         = var.backup_schedule
      namespaces       = ["production", "staging"]
      excluded_namespaces = ["kube-system", "kube-public", "kube-node-lease"]
      include_cluster_resources = true
      ttl              = var.backup_retention
    },
    {
      name             = "weekly-full-backup"
      schedule         = "0 3 * * 0"  # Every Sunday at 3 AM
      namespaces       = []  # All namespaces
      excluded_namespaces = []
      include_cluster_resources = true
      ttl              = "168h"  # 7 days
    },
    {
      name             = "monthly-archive"
      schedule         = "0 4 1 * *"  # First day of month at 4 AM
      namespaces       = []  # All namespaces
      excluded_namespaces = []
      include_cluster_resources = true
      ttl              = "2160h"  # 90 days
    }
  ]
}

# Persistent Volume Claims for system components
resource "kubernetes_persistent_volume_claim" "monitoring_storage" {
  count = var.enable_monitoring ? 1 : 0
  
  metadata {
    name      = "prometheus-storage"
    namespace = var.monitoring_namespace
    labels    = local.common_labels
  }
  
  spec {
    access_modes = ["ReadWriteOnce"]
    
    resources {
      requests = {
        storage = var.prometheus_storage_size
      }
    }
    
    storage_class_name = "fast-ssd"
  }
  
  depends_on = [
    kubernetes_namespace.app_namespaces,
    kubernetes_storage_class.storage_classes
  ]
}

resource "kubernetes_persistent_volume_claim" "logging_storage" {
  count = var.enable_logging ? 1 : 0
  
  metadata {
    name      = "elasticsearch-storage"
    namespace = var.logging_namespace
    labels    = local.common_labels
  }
  
  spec {
    access_modes = ["ReadWriteOnce"]
    
    resources {
      requests = {
        storage = var.elasticsearch_storage_size
      }
    }
    
    storage_class_name = "standard"
  }
  
  depends_on = [
    kubernetes_namespace.app_namespaces,
    kubernetes_storage_class.storage_classes
  ]
}

# Volume snapshot for critical data
resource "kubectl_manifest" "critical_data_snapshot" {
  count = var.enable_volume_snapshots && var.enable_monitoring ? 1 : 0
  
  yaml_body = <<YAML
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: prometheus-snapshot
  namespace: ${var.monitoring_namespace}
  labels:
    ${jsonencode(local.common_labels)}
spec:
  volumeSnapshotClassName: csi-snapclass
  source:
    persistentVolumeClaimName: prometheus-storage
YAML
  
  depends_on = [
    kubectl_manifest.volume_snapshot_class,
    kubernetes_persistent_volume_claim.monitoring_storage
  ]
}

# Storage monitoring and alerts
resource "kubernetes_config_map" "storage_monitoring" {
  count = var.enable_monitoring ? 1 : 0
  
  metadata {
    name      = "storage-monitoring"
    namespace = var.monitoring_namespace
    labels    = local.common_labels
  }
  
  data = {
    "storage-rules.yml" = yamlencode({
      groups = [
        {
          name = "storage.rules"
          rules = [
            {
              alert = "PersistentVolumeUsageHigh"
              expr  = "kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes * 100 > 80"
              for   = "5m"
              labels = {
                severity = "warning"
              }
              annotations = {
                summary     = "PersistentVolume usage is high"
                description = "PersistentVolume {{ $labels.persistentvolumeclaim }} in namespace {{ $labels.namespace }} is {{ $value }}% full"
              }
            },
            {
              alert = "PersistentVolumeUsageCritical"
              expr  = "kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes * 100 > 90"
              for   = "2m"
              labels = {
                severity = "critical"
              }
              annotations = {
                summary     = "PersistentVolume usage is critical"
                description = "PersistentVolume {{ $labels.persistentvolumeclaim }} in namespace {{ $labels.namespace }} is {{ $value }}% full"
              }
            },
            {
              alert = "PersistentVolumeInodeUsageHigh"
              expr  = "kubelet_volume_stats_inodes_used / kubelet_volume_stats_inodes * 100 > 80"
              for   = "5m"
              labels = {
                severity = "warning"
              }
              annotations = {
                summary     = "PersistentVolume inode usage is high"
                description = "PersistentVolume {{ $labels.persistentvolumeclaim }} in namespace {{ $labels.namespace }} has {{ $value }}% inode usage"
              }
            }
          ]
        }
      ]
    })
  }
  
  depends_on = [kubernetes_namespace.app_namespaces]
}

# Storage class for database workloads
resource "kubernetes_storage_class" "database_storage" {
  count = var.enable_storage_classes ? 1 : 0
  
  metadata {
    name = "database-storage"
    labels = merge(local.common_labels, {
      "storage-tier" = "database"
    })
    annotations = {
      "description" = "High-performance storage for database workloads"
    }
  }
  
  storage_provisioner    = var.cloud_provider == "aws" ? "ebs.csi.aws.com" : var.cloud_provider == "gcp" ? "pd.csi.storage.gke.io" : var.cloud_provider == "azure" ? "disk.csi.azure.com" : "kubernetes.io/no-provisioner"
  reclaim_policy        = "Retain"
  volume_binding_mode   = "WaitForFirstConsumer"
  allow_volume_expansion = true
  
  parameters = var.cloud_provider == "aws" ? {
    type      = "io2"
    iops      = "3000"
    fsType    = "ext4"
    encrypted = "true"
  } : var.cloud_provider == "gcp" ? {
    type             = "pd-ssd"
    fsType           = "ext4"
    disk-encryption-key = "projects/PROJECT_ID/locations/LOCATION/keyRings/RING_NAME/cryptoKeys/KEY_NAME"
  } : var.cloud_provider == "azure" ? {
    skuName            = "Premium_LRS"
    fsType             = "ext4"
    diskEncryptionSetID = var.azure_disk_encryption_set_id
  } : {}
  
  mount_options = ["noatime", "nodiratime", "sync"]
}

# Additional variable for Azure disk encryption
variable "azure_disk_encryption_set_id" {
  description = "Azure disk encryption set ID"
  type        = string
  default     = ""
}

# Network policy for backup namespace
resource "kubernetes_network_policy" "backup_network_policy" {
  count = var.enable_backup && var.enable_network_policies ? 1 : 0
  
  metadata {
    name      = "backup-network-policy"
    namespace = "backup"
    labels    = local.common_labels
  }
  
  spec {
    pod_selector {
      match_labels = {
        "app.kubernetes.io/name" = "velero"
      }
    }
    
    policy_types = ["Egress"]
    
    # Allow egress to all namespaces for backup operations
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
    
    # Allow egress to internet for cloud storage
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
  
  depends_on = [helm_release.velero]
}