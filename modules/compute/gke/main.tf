# GKE Compute Module
# Enterprise-grade Google Kubernetes Engine cluster with auto-scaling, monitoring, and security

terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 4.0"
    }
  }
}

# Local variables for consistent naming and configuration
locals {
  common_labels = merge(
    var.labels,
    {
      module      = "compute-gke"
      environment = var.environment
      project     = var.project_name
      managed-by  = "terraform"
    }
  )
  
  name_prefix = "${var.project_name}-${var.environment}"
}

# GKE Cluster
resource "google_container_cluster" "main" {
  name     = "${local.name_prefix}-gke"
  location = var.regional_cluster ? var.region : var.zone
  
  # Regional or zonal cluster
  node_locations = var.regional_cluster ? var.node_locations : null
  
  # Remove default node pool
  remove_default_node_pool = true
  initial_node_count       = 1
  
  # Network configuration
  network    = var.network
  subnetwork = var.subnetwork
  
  # IP allocation policy for VPC-native cluster
  ip_allocation_policy {
    cluster_secondary_range_name  = var.cluster_secondary_range_name
    services_secondary_range_name = var.services_secondary_range_name
  }
  
  # Private cluster configuration
  dynamic "private_cluster_config" {
    for_each = var.enable_private_cluster ? [1] : []
    content {
      enable_private_endpoint = var.enable_private_endpoint
      enable_private_nodes    = var.enable_private_nodes
      master_ipv4_cidr_block  = var.master_ipv4_cidr_block
      
      dynamic "master_global_access_config" {
        for_each = var.enable_master_global_access ? [1] : []
        content {
          enabled = true
        }
      }
    }
  }
  
  # Master authorized networks
  dynamic "master_authorized_networks_config" {
    for_each = length(var.master_authorized_networks) > 0 ? [1] : []
    content {
      dynamic "cidr_blocks" {
        for_each = var.master_authorized_networks
        content {
          cidr_block   = cidr_blocks.value.cidr_block
          display_name = cidr_blocks.value.display_name
        }
      }
    }
  }
  
  # Workload Identity
  dynamic "workload_identity_config" {
    for_each = var.enable_workload_identity ? [1] : []
    content {
      workload_pool = "${var.project_id}.svc.id.goog"
    }
  }
  
  # Network policy
  dynamic "network_policy" {
    for_each = var.enable_network_policy ? [1] : []
    content {
      enabled = true
    }
  }
  
  # Pod security policy
  dynamic "pod_security_policy_config" {
    for_each = var.enable_pod_security_policy ? [1] : []
    content {
      enabled = true
    }
  }
  
  # Addons configuration
  addons_config {
    http_load_balancing {
      disabled = !var.enable_http_load_balancing
    }
    
    horizontal_pod_autoscaling {
      disabled = !var.enable_horizontal_pod_autoscaling
    }
    
    network_policy_config {
      disabled = !var.enable_network_policy
    }
    
    dynamic "istio_config" {
      for_each = var.enable_istio ? [1] : []
      content {
        disabled = false
        auth     = var.istio_auth
      }
    }
    
    dynamic "cloudrun_config" {
      for_each = var.enable_cloudrun ? [1] : []
      content {
        disabled           = false
        load_balancer_type = var.cloudrun_load_balancer_type
      }
    }
  }
  
  # Cluster autoscaling
  dynamic "cluster_autoscaling" {
    for_each = var.enable_cluster_autoscaling ? [1] : []
    content {
      enabled = true
      resource_limits {
        resource_type = "cpu"
        minimum       = var.cluster_autoscaling_cpu_min
        maximum       = var.cluster_autoscaling_cpu_max
      }
      resource_limits {
        resource_type = "memory"
        minimum       = var.cluster_autoscaling_memory_min
        maximum       = var.cluster_autoscaling_memory_max
      }
      
      auto_provisioning_defaults {
        oauth_scopes = var.oauth_scopes
        
        dynamic "management" {
          for_each = var.enable_auto_provisioning_management ? [1] : []
          content {
            auto_upgrade = var.auto_provisioning_auto_upgrade
            auto_repair  = var.auto_provisioning_auto_repair
          }
        }
        
        dynamic "shielded_instance_config" {
          for_each = var.enable_shielded_nodes ? [1] : []
          content {
            enable_secure_boot          = var.shielded_instance_secure_boot
            enable_integrity_monitoring = var.shielded_instance_integrity_monitoring
          }
        }
      }
    }
  }
  
  # Database encryption
  dynamic "database_encryption" {
    for_each = var.enable_database_encryption ? [1] : []
    content {
      state    = "ENCRYPTED"
      key_name = var.database_encryption_key_name
    }
  }
  
  # Binary authorization
  dynamic "binary_authorization" {
    for_each = var.enable_binary_authorization ? [1] : []
    content {
      enabled = true
    }
  }
  
  # Maintenance policy
  dynamic "maintenance_policy" {
    for_each = var.maintenance_start_time != "" ? [1] : []
    content {
      daily_maintenance_window {
        start_time = var.maintenance_start_time
      }
    }
  }
  
  # Monitoring and logging
  logging_service    = var.logging_service
  monitoring_service = var.monitoring_service
  
  # Resource labels
  resource_labels = local.common_labels
  
  # Lifecycle management
  lifecycle {
    ignore_changes = [node_pool]
  }
  
  # Depends on service APIs
  depends_on = [
    google_project_service.container,
    google_project_service.compute,
  ]
}

# Node Pool
resource "google_container_node_pool" "primary" {
  count = var.create_node_pool ? 1 : 0
  
  name       = "${local.name_prefix}-primary-pool"
  location   = google_container_cluster.main.location
  cluster    = google_container_cluster.main.name
  
  # Node count configuration
  node_count = var.regional_cluster ? null : var.node_count
  
  dynamic "initial_node_count" {
    for_each = var.regional_cluster ? [var.initial_node_count] : []
    content {
      value = initial_node_count.value
    }
  }
  
  # Autoscaling
  dynamic "autoscaling" {
    for_each = var.enable_node_autoscaling ? [1] : []
    content {
      min_node_count = var.min_node_count
      max_node_count = var.max_node_count
    }
  }
  
  # Node configuration
  node_config {
    preemptible  = var.preemptible_nodes
    machine_type = var.machine_type
    disk_type    = var.disk_type
    disk_size_gb = var.disk_size_gb
    image_type   = var.image_type
    
    # Service account
    service_account = var.node_service_account != "" ? var.node_service_account : google_service_account.gke_node[0].email
    oauth_scopes    = var.oauth_scopes
    
    # Labels and tags
    labels = local.common_labels
    tags   = var.node_tags
    
    # Metadata
    metadata = merge(
      var.node_metadata,
      {
        disable-legacy-endpoints = "true"
      }
    )
    
    # Shielded instance configuration
    dynamic "shielded_instance_config" {
      for_each = var.enable_shielded_nodes ? [1] : []
      content {
        enable_secure_boot          = var.shielded_instance_secure_boot
        enable_integrity_monitoring = var.shielded_instance_integrity_monitoring
      }
    }
    
    # Workload metadata config
    dynamic "workload_metadata_config" {
      for_each = var.enable_workload_identity ? [1] : []
      content {
        mode = "GKE_METADATA"
      }
    }
    
    # Boot disk encryption
    dynamic "gcfs_config" {
      for_each = var.enable_gcfs ? [1] : []
      content {
        enabled = true
      }
    }
    
    # Local SSD configuration
    dynamic "local_ssd_config" {
      for_each = var.local_ssd_count > 0 ? [1] : []
      content {
        count = var.local_ssd_count
      }
    }
    
    # Taints
    dynamic "taint" {
      for_each = var.node_taints
      content {
        key    = taint.value.key
        value  = taint.value.value
        effect = taint.value.effect
      }
    }
  }
  
  # Management configuration
  management {
    auto_repair  = var.auto_repair
    auto_upgrade = var.auto_upgrade
  }
  
  # Upgrade settings
  dynamic "upgrade_settings" {
    for_each = var.max_surge > 0 || var.max_unavailable > 0 ? [1] : []
    content {
      max_surge       = var.max_surge
      max_unavailable = var.max_unavailable
    }
  }
  
  # Network configuration
  dynamic "network_config" {
    for_each = var.enable_pod_range ? [1] : []
    content {
      pod_range = var.pod_range
    }
  }
}

# Additional node pools
resource "google_container_node_pool" "additional" {
  count = length(var.additional_node_pools)
  
  name     = "${local.name_prefix}-${var.additional_node_pools[count.index].name}"
  location = google_container_cluster.main.location
  cluster  = google_container_cluster.main.name
  
  node_count = var.additional_node_pools[count.index].node_count
  
  dynamic "autoscaling" {
    for_each = var.additional_node_pools[count.index].autoscaling_enabled ? [1] : []
    content {
      min_node_count = var.additional_node_pools[count.index].min_node_count
      max_node_count = var.additional_node_pools[count.index].max_node_count
    }
  }
  
  node_config {
    preemptible  = var.additional_node_pools[count.index].preemptible
    machine_type = var.additional_node_pools[count.index].machine_type
    disk_type    = var.additional_node_pools[count.index].disk_type
    disk_size_gb = var.additional_node_pools[count.index].disk_size_gb
    
    service_account = google_service_account.gke_node[0].email
    oauth_scopes    = var.oauth_scopes
    
    labels = merge(
      local.common_labels,
      var.additional_node_pools[count.index].labels
    )
    
    tags = var.additional_node_pools[count.index].tags
    
    metadata = {
      disable-legacy-endpoints = "true"
    }
    
    dynamic "taint" {
      for_each = var.additional_node_pools[count.index].taints
      content {
        key    = taint.value.key
        value  = taint.value.value
        effect = taint.value.effect
      }
    }
  }
  
  management {
    auto_repair  = var.auto_repair
    auto_upgrade = var.auto_upgrade
  }
}

# Service Account for GKE nodes
resource "google_service_account" "gke_node" {
  count = var.node_service_account == "" ? 1 : 0
  
  account_id   = "${local.name_prefix}-gke-node"
  display_name = "GKE Node Service Account for ${local.name_prefix}"
  description  = "Service account for GKE nodes in ${local.name_prefix} cluster"
}

# IAM bindings for node service account
resource "google_project_iam_member" "gke_node" {
  count = var.node_service_account == "" ? length(var.node_service_account_roles) : 0
  
  project = var.project_id
  role    = var.node_service_account_roles[count.index]
  member  = "serviceAccount:${google_service_account.gke_node[0].email}"
}

# Firewall rules for GKE
resource "google_compute_firewall" "gke_webhook" {
  count = var.create_firewall_rules ? 1 : 0
  
  name    = "${local.name_prefix}-gke-webhook"
  network = var.network
  
  allow {
    protocol = "tcp"
    ports    = ["8443", "9443", "15017"]
  }
  
  source_ranges = [var.master_ipv4_cidr_block]
  target_tags   = var.node_tags
  
  description = "Allow GKE webhook traffic"
}

# Network policy for additional security (if Calico is enabled)
resource "kubernetes_network_policy" "default_deny" {
  count = var.enable_network_policy && var.create_default_deny_policy ? 1 : 0
  
  metadata {
    name      = "default-deny-all"
    namespace = "default"
  }
  
  spec {
    pod_selector {}
    policy_types = ["Ingress", "Egress"]
  }
  
  depends_on = [google_container_cluster.main]
}

# Pod Security Policy (if enabled)
resource "kubernetes_pod_security_policy" "restricted" {
  count = var.enable_pod_security_policy && var.create_pod_security_policy ? 1 : 0
  
  metadata {
    name = "${local.name_prefix}-restricted"
  }
  
  spec {
    privileged                 = false
    allow_privilege_escalation = false
    required_drop_capabilities = ["ALL"]
    
    volumes = [
      "configMap",
      "emptyDir",
      "projected",
      "secret",
      "downwardAPI",
      "persistentVolumeClaim"
    ]
    
    run_as_user {
      rule = "MustRunAsNonRoot"
    }
    
    se_linux {
      rule = "RunAsAny"
    }
    
    fs_group {
      rule = "RunAsAny"
    }
  }
  
  depends_on = [google_container_cluster.main]
}

# Resource quotas for cost control
resource "kubernetes_resource_quota" "compute_quota" {
  count = var.enable_resource_quotas ? 1 : 0
  
  metadata {
    name      = "compute-quota"
    namespace = "default"
  }
  
  spec {
    hard = {
      "requests.cpu"    = var.resource_quota_cpu_requests
      "requests.memory" = var.resource_quota_memory_requests
      "limits.cpu"      = var.resource_quota_cpu_limits
      "limits.memory"   = var.resource_quota_memory_limits
      "pods"           = var.resource_quota_pods
    }
  }
  
  depends_on = [google_container_cluster.main]
}

# Enable required APIs
resource "google_project_service" "container" {
  service = "container.googleapis.com"
  
  disable_dependent_services = true
}

resource "google_project_service" "compute" {
  service = "compute.googleapis.com"
  
  disable_dependent_services = true
}

resource "google_project_service" "monitoring" {
  count = var.enable_monitoring_api ? 1 : 0
  
  service = "monitoring.googleapis.com"
  
  disable_dependent_services = true
}

resource "google_project_service" "logging" {
  count = var.enable_logging_api ? 1 : 0
  
  service = "logging.googleapis.com"
  
  disable_dependent_services = true
}

# Monitoring and alerting (if enabled)
resource "google_monitoring_alert_policy" "node_cpu" {
  count = var.enable_monitoring_alerts ? 1 : 0
  
  display_name = "${local.name_prefix} GKE Node CPU Usage"
  combiner     = "OR"
  enabled      = true
  
  conditions {
    display_name = "Node CPU usage"
    
    condition_threshold {
      filter          = "resource.type=\"gce_instance\" AND metric.type=\"compute.googleapis.com/instance/cpu/utilization\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = var.cpu_alert_threshold
      
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }
  
  notification_channels = var.notification_channels
  
  alert_strategy {
    auto_close = "1800s"
  }
}

resource "google_monitoring_alert_policy" "node_memory" {
  count = var.enable_monitoring_alerts ? 1 : 0
  
  display_name = "${local.name_prefix} GKE Node Memory Usage"
  combiner     = "OR"
  enabled      = true
  
  conditions {
    display_name = "Node Memory usage"
    
    condition_threshold {
      filter          = "resource.type=\"gce_instance\" AND metric.type=\"compute.googleapis.com/instance/memory/utilization\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = var.memory_alert_threshold
      
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }
  
  notification_channels = var.notification_channels
  
  alert_strategy {
    auto_close = "1800s"
  }
}