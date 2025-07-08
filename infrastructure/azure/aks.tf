# Azure Kubernetes Service (AKS) Configuration
# This file defines the AKS cluster with system and user node pools, security configurations, and monitoring

# Log Analytics Workspace for AKS monitoring
resource "azurerm_log_analytics_workspace" "aks" {
  name                = "${local.name_prefix}-aks-logs"
  location            = azurerm_resource_group.monitoring.location
  resource_group_name = azurerm_resource_group.monitoring.name
  sku                 = "PerGB2018"
  retention_in_days   = var.log_analytics_retention_days

  tags = local.common_tags
}

# Azure Container Registry for container images
resource "azurerm_container_registry" "main" {
  name                = "${replace(local.name_prefix, "-", "")}acr${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Premium"
  admin_enabled       = false

  # Enable geo-replication for production
  dynamic "georeplications" {
    for_each = var.environment == "production" ? [var.dr_region] : []
    content {
      location                = georeplications.value
      zone_redundancy_enabled = true
      tags                    = local.common_tags
    }
  }

  # Network access rules
  network_rule_set {
    default_action = "Deny"
    
    # Allow access from AKS subnets
    virtual_network {
      action    = "Allow"
      subnet_id = azurerm_subnet.aks_system.id
    }
    
    virtual_network {
      action    = "Allow"
      subnet_id = azurerm_subnet.aks_user.id
    }
  }

  # Enable threat protection
  trust_policy {
    enabled = true
  }

  retention_policy {
    enabled = true
    days    = var.environment == "production" ? 30 : 7
  }

  tags = local.common_tags
}

# User-assigned managed identity for AKS cluster
resource "azurerm_user_assigned_identity" "aks" {
  name                = "${local.name_prefix}-aks-identity"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  tags = local.common_tags
}

# User-assigned managed identity for AKS kubelet
resource "azurerm_user_assigned_identity" "aks_kubelet" {
  name                = "${local.name_prefix}-aks-kubelet-identity"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  tags = local.common_tags
}

# Role assignment for AKS cluster identity to pull images from ACR
resource "azurerm_role_assignment" "aks_acr_pull" {
  scope                = azurerm_container_registry.main.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.aks_kubelet.principal_id
}

# Role assignment for AKS cluster identity to manage network resources
resource "azurerm_role_assignment" "aks_network_contributor" {
  scope                = azurerm_resource_group.networking.id
  role_definition_name = "Network Contributor"
  principal_id         = azurerm_user_assigned_identity.aks.principal_id
}

# Role assignment for AKS cluster identity to manage managed identities
resource "azurerm_role_assignment" "aks_managed_identity_operator" {
  scope                = azurerm_resource_group.main.id
  role_definition_name = "Managed Identity Operator"
  principal_id         = azurerm_user_assigned_identity.aks.principal_id
}

# AKS Cluster
resource "azurerm_kubernetes_cluster" "main" {
  name                = "${local.name_prefix}-aks"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  dns_prefix          = "${local.name_prefix}-aks"
  kubernetes_version  = local.kubernetes_version

  # Use user-assigned managed identity
  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.aks.id]
  }

  # System node pool configuration
  default_node_pool {
    name                         = "system"
    node_count                   = var.aks_system_node_pool.node_count
    vm_size                      = var.aks_system_node_pool.vm_size
    zones                        = local.availability_zones
    vnet_subnet_id               = azurerm_subnet.aks_system.id
    type                         = "VirtualMachineScaleSets"
    only_critical_addons_enabled = true
    
    # Enable auto-scaling
    enable_auto_scaling = var.enable_cluster_autoscaler
    min_count          = var.aks_system_node_pool.min_node_count
    max_count          = var.aks_system_node_pool.max_node_count
    
    # Node configuration
    os_disk_size_gb      = 128
    os_disk_type         = "Managed"
    enable_host_encryption = var.environment == "production"
    
    # Upgrade settings
    upgrade_settings {
      max_surge = "33%"
    }

    # Node labels for system workloads
    node_labels = {
      "kubernetes.io/role" = "system"
      "node-type"          = "system"
    }

    # Taints for system nodes
    node_taints = ["CriticalAddonsOnly=true:NoSchedule"]

    tags = local.common_tags
  }

  # Network profile
  network_profile {
    network_plugin      = "azure"
    network_policy      = "azure"
    dns_service_ip      = "10.1.0.10"
    service_cidr        = "10.1.0.0/16"
    load_balancer_sku   = "standard"
    outbound_type       = "loadBalancer"
  }

  # Enable RBAC
  role_based_access_control_enabled = var.aks_enable_rbac

  # Azure AD integration
  dynamic "azure_active_directory_role_based_access_control" {
    for_each = var.aks_enable_azure_ad ? [1] : []
    content {
      managed                = true
      admin_group_object_ids = []
      azure_rbac_enabled     = true
    }
  }

  # Enable HTTP application routing (disabled for security)
  http_application_routing_enabled = false

  # Azure policy addon
  azure_policy_enabled = true

  # Kubelet identity
  kubelet_identity {
    client_id                 = azurerm_user_assigned_identity.aks_kubelet.client_id
    object_id                 = azurerm_user_assigned_identity.aks_kubelet.principal_id
    user_assigned_identity_id = azurerm_user_assigned_identity.aks_kubelet.id
  }

  # OMS agent for monitoring
  oms_agent {
    log_analytics_workspace_id = azurerm_log_analytics_workspace.aks.id
  }

  # Key vault secrets provider
  key_vault_secrets_provider {
    secret_rotation_enabled  = true
    secret_rotation_interval = "2m"
  }

  # Storage profile
  storage_profile {
    blob_driver_enabled         = true
    disk_driver_enabled         = true
    file_driver_enabled         = true
    snapshot_controller_enabled = true
  }

  # Maintenance window
  maintenance_window {
    allowed {
      day   = "Saturday"
      hours = [2, 3, 4, 5]
    }
    
    allowed {
      day   = "Sunday"
      hours = [2, 3, 4, 5]
    }
  }

  # Auto-upgrade configuration
  automatic_channel_upgrade = var.environment == "production" ? "patch" : "rapid"

  tags = local.common_tags

  depends_on = [
    azurerm_role_assignment.aks_network_contributor,
    azurerm_role_assignment.aks_managed_identity_operator,
    azurerm_role_assignment.aks_acr_pull,
  ]
}

# User node pool for application workloads
resource "azurerm_kubernetes_cluster_node_pool" "user" {
  name                  = "user"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.main.id
  node_count            = var.aks_user_node_pool.node_count
  vm_size               = var.aks_user_node_pool.vm_size
  zones                 = local.availability_zones
  vnet_subnet_id        = azurerm_subnet.aks_user.id

  # Enable auto-scaling
  enable_auto_scaling = var.enable_cluster_autoscaler
  min_count          = var.aks_user_node_pool.min_node_count
  max_count          = var.aks_user_node_pool.max_node_count

  # Node configuration
  os_disk_size_gb        = 128
  os_disk_type           = "Managed"
  enable_host_encryption = var.environment == "production"

  # Upgrade settings
  upgrade_settings {
    max_surge = "33%"
  }

  # Node labels for user workloads
  node_labels = {
    "kubernetes.io/role" = "user"
    "node-type"          = "user"
  }

  tags = local.common_tags
}

# Spot node pool for cost optimization (non-production)
resource "azurerm_kubernetes_cluster_node_pool" "spot" {
  count = var.environment != "production" ? 1 : 0
  
  name                  = "spot"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.main.id
  node_count            = 1
  vm_size               = "Standard_D2s_v3"
  zones                 = local.availability_zones
  vnet_subnet_id        = azurerm_subnet.aks_user.id
  
  # Spot configuration
  priority        = "Spot"
  eviction_policy = "Delete"
  spot_max_price  = 0.1  # Max price per hour in USD
  
  # Enable auto-scaling
  enable_auto_scaling = true
  min_count          = 0
  max_count          = 3
  
  # Node configuration
  os_disk_size_gb = 64
  os_disk_type    = "Managed"
  
  # Node labels for spot workloads
  node_labels = {
    "kubernetes.io/role" = "spot"
    "node-type"          = "spot"
  }
  
  # Taints for spot nodes
  node_taints = ["kubernetes.azure.com/scalesetpriority=spot:NoSchedule"]

  tags = local.common_tags
}

# Kubernetes namespace for the application
resource "kubernetes_namespace" "learning_assistant" {
  depends_on = [azurerm_kubernetes_cluster.main]
  
  metadata {
    name = "learning-assistant"
    
    labels = {
      app         = "learning-assistant"
      environment = var.environment
    }
  }
}

# Service account for the application
resource "kubernetes_service_account" "learning_assistant" {
  depends_on = [kubernetes_namespace.learning_assistant]
  
  metadata {
    name      = "learning-assistant"
    namespace = kubernetes_namespace.learning_assistant.metadata[0].name
    
    annotations = {
      "azure.workload.identity/client-id" = azurerm_user_assigned_identity.aks_kubelet.client_id
    }
    
    labels = {
      "azure.workload.identity/use" = "true"
    }
  }
}

# Network policy for the application namespace
resource "kubernetes_network_policy" "learning_assistant" {
  depends_on = [kubernetes_namespace.learning_assistant]
  
  metadata {
    name      = "learning-assistant-network-policy"
    namespace = kubernetes_namespace.learning_assistant.metadata[0].name
  }

  spec {
    pod_selector {
      match_labels = {
        app = "learning-assistant"
      }
    }

    policy_types = ["Ingress", "Egress"]

    # Allow ingress from other pods in the same namespace
    ingress {
      from {
        namespace_selector {
          match_labels = {
            name = kubernetes_namespace.learning_assistant.metadata[0].name
          }
        }
      }
    }

    # Allow egress to DNS, PostgreSQL, and Redis
    egress {
      to {
        namespace_selector {
          match_labels = {
            name = "kube-system"
          }
        }
      }
      
      ports {
        port     = "53"
        protocol = "UDP"
      }
      
      ports {
        port     = "53"
        protocol = "TCP"
      }
    }

    # Allow egress to external services
    egress {
      to {}
      
      ports {
        port     = "443"
        protocol = "TCP"
      }
      
      ports {
        port     = "80"
        protocol = "TCP"
      }
    }
  }
}

# Install essential cluster components using Helm
resource "helm_release" "ingress_nginx" {
  depends_on = [azurerm_kubernetes_cluster.main]
  
  name             = "ingress-nginx"
  repository       = "https://kubernetes.github.io/ingress-nginx"
  chart            = "ingress-nginx"
  namespace        = "ingress-nginx"
  create_namespace = true
  version          = "4.8.3"

  values = [
    yamlencode({
      controller = {
        replicaCount = 2
        
        nodeSelector = {
          "kubernetes.io/role" = "user"
        }
        
        tolerations = [
          {
            key      = "node-type"
            operator = "Equal"
            value    = "user"
            effect   = "NoSchedule"
          }
        ]
        
        service = {
          type = "LoadBalancer"
          annotations = {
            "service.beta.kubernetes.io/azure-load-balancer-health-probe-request-path" = "/healthz"
          }
        }
        
        config = {
          "use-forwarded-headers" = "true"
          "compute-full-forwarded-for" = "true"
          "use-proxy-protocol" = "false"
        }
        
        metrics = {
          enabled = true
        }
      }
    })
  ]
}

# Install cert-manager for SSL certificates
resource "helm_release" "cert_manager" {
  depends_on = [azurerm_kubernetes_cluster.main]
  
  name             = "cert-manager"
  repository       = "https://charts.jetstack.io"
  chart            = "cert-manager"
  namespace        = "cert-manager"
  create_namespace = true
  version          = "v1.13.2"

  set {
    name  = "installCRDs"
    value = "true"
  }

  set {
    name  = "global.leaderElection.namespace"
    value = "cert-manager"
  }

  set {
    name  = "nodeSelector.kubernetes\\.io/role"
    value = "user"
  }
}

# Install external-secrets operator
resource "helm_release" "external_secrets" {
  depends_on = [azurerm_kubernetes_cluster.main]
  
  name             = "external-secrets"
  repository       = "https://charts.external-secrets.io"
  chart            = "external-secrets"
  namespace        = "external-secrets-system"
  create_namespace = true
  version          = "0.9.11"

  set {
    name  = "installCRDs"
    value = "true"
  }

  set {
    name  = "nodeSelector.kubernetes\\.io/role"
    value = "user"
  }
}

# AKS outputs
output "aks_cluster_id" {
  description = "ID of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.id
}

output "aks_cluster_name" {
  description = "Name of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.name
}

output "aks_cluster_fqdn" {
  description = "FQDN of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.fqdn
}

output "aks_node_resource_group" {
  description = "Resource group containing AKS nodes"
  value       = azurerm_kubernetes_cluster.main.node_resource_group
}

output "acr_login_server" {
  description = "Login server for Azure Container Registry"
  value       = azurerm_container_registry.main.login_server
}

output "acr_name" {
  description = "Name of Azure Container Registry"
  value       = azurerm_container_registry.main.name
}

output "aks_identity_principal_id" {
  description = "Principal ID of the AKS cluster identity"
  value       = azurerm_user_assigned_identity.aks.principal_id
}

output "aks_kubelet_identity_object_id" {
  description = "Object ID of the AKS kubelet identity"
  value       = azurerm_user_assigned_identity.aks_kubelet.principal_id
}

output "log_analytics_workspace_id" {
  description = "ID of the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.aks.id
}

output "kube_config" {
  description = "Raw Kubernetes config for the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.kube_config_raw
  sensitive   = true
}

output "kubernetes_namespace" {
  description = "Kubernetes namespace for the application"
  value       = kubernetes_namespace.learning_assistant.metadata[0].name
}