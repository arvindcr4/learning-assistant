# Create GKE cluster
resource "google_container_cluster" "primary" {
  name        = var.gke_cluster_name
  location    = var.region
  description = "Main GKE cluster for learning assistant application"

  # We can't create a cluster with no node pool defined, but we want to only use
  # separately managed node pools. So we create the smallest possible default
  # node pool and immediately delete it.
  remove_default_node_pool = true
  initial_node_count       = 1

  # Networking configuration
  network    = google_compute_network.main.id
  subnetwork = google_compute_subnetwork.private.id

  # IP allocation policy for pods and services
  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  # Enable network policy for security
  network_policy {
    enabled = var.enable_network_policy
  }

  # Enable private cluster
  private_cluster_config {
    enable_private_nodes    = var.enable_private_nodes
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"

    master_global_access_config {
      enabled = true
    }
  }

  # Master authorized networks
  master_authorized_networks_config {
    dynamic "cidr_blocks" {
      for_each = var.authorized_networks
      content {
        cidr_block   = cidr_blocks.value.cidr_block
        display_name = cidr_blocks.value.display_name
      }
    }
  }

  # Workload Identity for secure access to Google Cloud services
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Enable shielded nodes for enhanced security
  enable_shielded_nodes = true

  # Enable network policy addon
  addons_config {
    network_policy_config {
      disabled = !var.enable_network_policy
    }

    horizontal_pod_autoscaling {
      disabled = false
    }

    http_load_balancing {
      disabled = false
    }

    dns_cache_config {
      enabled = true
    }

    gcp_filestore_csi_driver_config {
      enabled = true
    }

    gce_persistent_disk_csi_driver_config {
      enabled = true
    }

    config_connector_config {
      enabled = true
    }
  }

  # Binary authorization
  binary_authorization {
    evaluation_mode = "PROJECT_SINGLETON_POLICY_ENFORCE"
  }

  # Database encryption
  database_encryption {
    state    = "ENCRYPTED"
    key_name = google_kms_crypto_key.learning_assistant.id
  }

  # Maintenance policy
  maintenance_policy {
    daily_maintenance_window {
      start_time = "03:00"
    }
  }

  # Release channel for automatic updates
  release_channel {
    channel = "REGULAR"
  }

  # Logging configuration
  logging_config {
    enable_components = [
      "SYSTEM_COMPONENTS",
      "WORKLOADS",
      "API_SERVER"
    ]
  }

  # Monitoring configuration
  monitoring_config {
    enable_components = [
      "SYSTEM_COMPONENTS",
      "WORKLOADS",
      "API_SERVER"
    ]

    managed_prometheus {
      enabled = true
    }
  }

  # Resource labels
  resource_labels = local.common_labels

  # Security configuration
  security_posture_config {
    mode               = "BASIC"
    vulnerability_mode = "VULNERABILITY_BASIC"
  }

  # Gateway API configuration
  gateway_api_config {
    channel = "CHANNEL_STANDARD"
  }

  depends_on = [
    google_project_service.required_apis,
    google_service_networking_connection.private_vpc_connection,
  ]
}

# Create primary node pool
resource "google_container_node_pool" "primary_nodes" {
  name     = "primary-node-pool"
  location = var.region
  cluster  = google_container_cluster.primary.name

  # Auto-scaling configuration
  autoscaling {
    min_node_count = var.gke_min_node_count
    max_node_count = var.gke_max_node_count
  }

  # Node pool management
  management {
    auto_repair  = var.enable_node_auto_repair
    auto_upgrade = var.enable_node_auto_upgrade
  }

  # Node configuration
  node_config {
    preemptible  = var.preemptible_nodes
    machine_type = var.gke_node_machine_type
    disk_size_gb = var.gke_disk_size
    disk_type    = "pd-ssd"
    image_type   = "COS_CONTAINERD"

    # Enable secure boot and integrity monitoring
    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }

    # Service account with minimal permissions
    service_account = google_service_account.gke_nodes.email
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
      "https://www.googleapis.com/auth/logging.write",
      "https://www.googleapis.com/auth/monitoring",
      "https://www.googleapis.com/auth/devstorage.read_only"
    ]

    # Node labels
    labels = merge(
      local.common_labels,
      {
        node_pool = "primary"
      }
    )

    # Node taints for workload isolation
    taint {
      key    = "node_pool"
      value  = "primary"
      effect = "NO_SCHEDULE"
    }

    # Node tags for firewall rules
    tags = ["gke-node", "primary-node-pool"]

    # Workload identity
    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    # Advanced machine features
    advanced_machine_features {
      threads_per_core = 2
    }

    # Reservation affinity
    reservation_affinity {
      consume_reservation_type = "ANY_RESERVATION"
    }
  }

  # Upgrade settings
  upgrade_settings {
    max_surge       = 1
    max_unavailable = 0
  }

  # Network configuration
  network_config {
    create_pod_range     = false
    enable_private_nodes = var.enable_private_nodes
  }

  depends_on = [
    google_container_cluster.primary,
    google_service_account.gke_nodes,
  ]
}

# Create spot instance node pool for cost optimization
resource "google_container_node_pool" "spot_nodes" {
  count    = var.environment == "prod" ? 0 : 1
  name     = "spot-node-pool"
  location = var.region
  cluster  = google_container_cluster.primary.name

  # Auto-scaling configuration
  autoscaling {
    min_node_count = 0
    max_node_count = 5
  }

  # Node pool management
  management {
    auto_repair  = true
    auto_upgrade = true
  }

  # Node configuration
  node_config {
    spot         = true
    machine_type = "e2-medium"
    disk_size_gb = 50
    disk_type    = "pd-standard"
    image_type   = "COS_CONTAINERD"

    # Service account with minimal permissions
    service_account = google_service_account.gke_nodes.email
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
      "https://www.googleapis.com/auth/logging.write",
      "https://www.googleapis.com/auth/monitoring",
      "https://www.googleapis.com/auth/devstorage.read_only"
    ]

    # Node labels
    labels = merge(
      local.common_labels,
      {
        node_pool = "spot"
      }
    )

    # Node taints for workload isolation
    taint {
      key    = "node_pool"
      value  = "spot"
      effect = "NO_SCHEDULE"
    }

    # Node tags for firewall rules
    tags = ["gke-node", "spot-node-pool"]

    # Workload identity
    workload_metadata_config {
      mode = "GKE_METADATA"
    }
  }

  # Upgrade settings
  upgrade_settings {
    max_surge       = 1
    max_unavailable = 1
  }

  depends_on = [
    google_container_cluster.primary,
    google_service_account.gke_nodes,
  ]
}

# Create GPU node pool for ML workloads (optional)
resource "google_container_node_pool" "gpu_nodes" {
  count    = var.environment == "prod" ? 1 : 0
  name     = "gpu-node-pool"
  location = var.region
  cluster  = google_container_cluster.primary.name

  # Auto-scaling configuration
  autoscaling {
    min_node_count = 0
    max_node_count = 2
  }

  # Node pool management
  management {
    auto_repair  = true
    auto_upgrade = true
  }

  # Node configuration
  node_config {
    machine_type = "n1-standard-4"
    disk_size_gb = 100
    disk_type    = "pd-ssd"
    image_type   = "COS_CONTAINERD"

    # GPU configuration
    guest_accelerator {
      type  = "nvidia-tesla-t4"
      count = 1
    }

    # Service account with minimal permissions
    service_account = google_service_account.gke_nodes.email
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
      "https://www.googleapis.com/auth/logging.write",
      "https://www.googleapis.com/auth/monitoring",
      "https://www.googleapis.com/auth/devstorage.read_only"
    ]

    # Node labels
    labels = merge(
      local.common_labels,
      {
        node_pool = "gpu"
      }
    )

    # Node taints for workload isolation
    taint {
      key    = "node_pool"
      value  = "gpu"
      effect = "NO_SCHEDULE"
    }

    # Node tags for firewall rules
    tags = ["gke-node", "gpu-node-pool"]

    # Workload identity
    workload_metadata_config {
      mode = "GKE_METADATA"
    }
  }

  depends_on = [
    google_container_cluster.primary,
    google_service_account.gke_nodes,
  ]
}

# Create Horizontal Pod Autoscaler for the application
resource "google_compute_instance_template" "app_template" {
  name_prefix  = "learning-assistant-template-"
  machine_type = "e2-medium"

  disk {
    source_image = "cos-cloud/cos-stable"
    auto_delete  = true
    boot         = true
    disk_size_gb = 30
  }

  network_interface {
    network    = google_compute_network.main.id
    subnetwork = google_compute_subnetwork.private.id
  }

  service_account {
    email  = google_service_account.gke_nodes.email
    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
  }

  metadata_startup_script = <<-EOF
    #!/bin/bash
    # Install Docker
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    
    # Install kubectl
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
    chmod +x kubectl
    sudo mv kubectl /usr/local/bin/
    
    # Configure kubectl
    gcloud container clusters get-credentials ${google_container_cluster.primary.name} --region ${var.region}
  EOF

  tags = ["gke-node"]

  labels = local.common_labels

  lifecycle {
    create_before_destroy = true
  }
}

# Create instance group manager for auto-scaling
resource "google_compute_region_instance_group_manager" "app_igm" {
  name   = "learning-assistant-igm"
  region = var.region

  base_instance_name = "learning-assistant-instance"
  target_size        = 2

  version {
    instance_template = google_compute_instance_template.app_template.id
  }

  named_port {
    name = "http"
    port = 80
  }

  named_port {
    name = "https"
    port = 443
  }

  auto_healing_policies {
    health_check      = google_compute_health_check.app_health_check.id
    initial_delay_sec = 300
  }

  update_policy {
    type                         = "PROACTIVE"
    instance_redistribution_type = "PROACTIVE"
    minimal_action               = "REPLACE"
    max_surge_fixed              = 1
    max_unavailable_fixed        = 0
  }

  depends_on = [
    google_compute_instance_template.app_template,
  ]
}

# Create health check for instance group
resource "google_compute_health_check" "app_health_check" {
  name               = "learning-assistant-health-check"
  check_interval_sec = 5
  timeout_sec        = 5
  healthy_threshold  = 2
  unhealthy_threshold = 3

  http_health_check {
    request_path = "/health"
    port         = "8080"
  }

  log_config {
    enable = true
  }
}

# Create auto-scaler for instance group
resource "google_compute_region_autoscaler" "app_autoscaler" {
  name   = "learning-assistant-autoscaler"
  region = var.region
  target = google_compute_region_instance_group_manager.app_igm.id

  autoscaling_policy {
    max_replicas    = 10
    min_replicas    = 2
    cooldown_period = 60

    cpu_utilization {
      target = 0.7
    }

    metric {
      name   = "pubsub.googleapis.com/subscription/num_undelivered_messages"
      target = 30
      type   = "GAUGE"
    }
  }
}