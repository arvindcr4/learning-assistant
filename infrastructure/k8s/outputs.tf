# Outputs for Kubernetes Infrastructure
# This file contains all output values from the Kubernetes infrastructure

# Cluster Information
output "cluster_name" {
  description = "Name of the Kubernetes cluster"
  value       = var.cluster_name
}

output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "cluster_domain" {
  description = "Cluster domain name"
  value       = var.cluster_domain
}

output "cluster_nodes" {
  description = "Information about cluster nodes"
  value = {
    count = length(data.kubernetes_nodes.all.nodes)
    nodes = data.kubernetes_nodes.all.nodes
  }
}

# Namespace Information
output "created_namespaces" {
  description = "List of created namespaces"
  value       = var.create_namespaces ? var.namespaces : []
}

output "namespace_details" {
  description = "Details of created namespaces"
  value = var.create_namespaces ? {
    for ns in kubernetes_namespace.app_namespaces : ns.metadata[0].name => {
      name              = ns.metadata[0].name
      uid               = ns.metadata[0].uid
      creation_timestamp = ns.metadata[0].creation_timestamp
      labels            = ns.metadata[0].labels
      annotations       = ns.metadata[0].annotations
    }
  } : {}
}

# Service Account Information
output "terraform_service_account" {
  description = "Terraform service account information"
  value = var.create_terraform_sa ? {
    name      = kubernetes_service_account.terraform_sa[0].metadata[0].name
    namespace = kubernetes_service_account.terraform_sa[0].metadata[0].namespace
    uid       = kubernetes_service_account.terraform_sa[0].metadata[0].uid
  } : null
}

# Priority Classes
output "priority_classes" {
  description = "Created priority classes"
  value = {
    system_critical = {
      name  = kubernetes_priority_class.system_critical.metadata[0].name
      value = kubernetes_priority_class.system_critical.value
    }
    high_priority = {
      name  = kubernetes_priority_class.high_priority.metadata[0].name
      value = kubernetes_priority_class.high_priority.value
    }
    normal_priority = {
      name  = kubernetes_priority_class.normal_priority.metadata[0].name
      value = kubernetes_priority_class.normal_priority.value
    }
  }
}

# Storage Classes
output "storage_classes" {
  description = "Created storage classes"
  value = var.enable_storage_classes ? {
    for sc in kubernetes_storage_class.storage_classes : sc.metadata[0].name => {
      name                = sc.metadata[0].name
      provisioner         = sc.storage_provisioner
      reclaim_policy      = sc.reclaim_policy
      volume_binding_mode = sc.volume_binding_mode
      allow_expansion     = sc.allow_volume_expansion
    }
  } : {}
}

# Ingress Configuration
output "ingress_controller" {
  description = "Ingress controller information"
  value = var.enable_ingress_nginx ? {
    namespace = helm_release.ingress_nginx[0].namespace
    name      = helm_release.ingress_nginx[0].name
    version   = helm_release.ingress_nginx[0].version
    status    = helm_release.ingress_nginx[0].status
  } : null
}

output "cert_manager" {
  description = "Cert-manager information"
  value = var.enable_cert_manager ? {
    namespace = helm_release.cert_manager[0].namespace
    name      = helm_release.cert_manager[0].name
    version   = helm_release.cert_manager[0].version
    status    = helm_release.cert_manager[0].status
  } : null
}

# Monitoring Stack
output "monitoring_stack" {
  description = "Monitoring stack information"
  value = var.enable_monitoring ? {
    prometheus = {
      namespace = helm_release.kube_prometheus_stack[0].namespace
      name      = helm_release.kube_prometheus_stack[0].name
      version   = helm_release.kube_prometheus_stack[0].version
      status    = helm_release.kube_prometheus_stack[0].status
    }
    grafana_admin_password = var.grafana_admin_password
  } : null
  sensitive = true
}

# Logging Stack
output "logging_stack" {
  description = "Logging stack information"
  value = var.enable_logging ? {
    elasticsearch = var.enable_fluent_bit ? null : {
      namespace = helm_release.elasticsearch[0].namespace
      name      = helm_release.elasticsearch[0].name
      version   = helm_release.elasticsearch[0].version
      status    = helm_release.elasticsearch[0].status
    }
    fluentd = var.enable_fluent_bit ? null : {
      namespace = helm_release.fluentd[0].namespace
      name      = helm_release.fluentd[0].name
      version   = helm_release.fluentd[0].version
      status    = helm_release.fluentd[0].status
    }
    fluent_bit = var.enable_fluent_bit ? {
      namespace = helm_release.fluent_bit[0].namespace
      name      = helm_release.fluent_bit[0].name
      version   = helm_release.fluent_bit[0].version
      status    = helm_release.fluent_bit[0].status
    } : null
    kibana = {
      namespace = helm_release.kibana[0].namespace
      name      = helm_release.kibana[0].name
      version   = helm_release.kibana[0].version
      status    = helm_release.kibana[0].status
    }
  } : null
}

# Service Mesh
output "service_mesh" {
  description = "Service mesh information"
  value = var.enable_istio ? {
    istio_base = {
      namespace = helm_release.istio_base[0].namespace
      name      = helm_release.istio_base[0].name
      version   = helm_release.istio_base[0].version
      status    = helm_release.istio_base[0].status
    }
    istiod = {
      namespace = helm_release.istiod[0].namespace
      name      = helm_release.istiod[0].name
      version   = helm_release.istiod[0].version
      status    = helm_release.istiod[0].status
    }
    gateway = var.enable_istio_gateway ? {
      namespace = helm_release.istio_gateway[0].namespace
      name      = helm_release.istio_gateway[0].name
      version   = helm_release.istio_gateway[0].version
      status    = helm_release.istio_gateway[0].status
    } : null
  } : null
}

# GitOps
output "gitops" {
  description = "GitOps information"
  value = var.enable_gitops ? {
    tool = var.gitops_tool
    argocd = var.gitops_tool == "argocd" ? {
      namespace = helm_release.argocd[0].namespace
      name      = helm_release.argocd[0].name
      version   = helm_release.argocd[0].version
      status    = helm_release.argocd[0].status
    } : null
    flux = var.gitops_tool == "flux" ? {
      namespace = helm_release.flux[0].namespace
      name      = helm_release.flux[0].name
      version   = helm_release.flux[0].version
      status    = helm_release.flux[0].status
    } : null
  } : null
}

# Backup Configuration
output "backup_configuration" {
  description = "Backup configuration information"
  value = var.enable_backup ? {
    velero = {
      namespace = helm_release.velero[0].namespace
      name      = helm_release.velero[0].name
      version   = helm_release.velero[0].version
      status    = helm_release.velero[0].status
    }
    schedule          = var.backup_schedule
    retention         = var.backup_retention
    storage_location  = var.backup_storage_location
  } : null
}

# Resource Quotas
output "resource_quotas" {
  description = "Resource quota information"
  value = var.enable_cluster_resource_quota ? {
    cluster_quota = {
      cpu_requests    = var.cluster_cpu_requests
      memory_requests = var.cluster_memory_requests
      cpu_limits      = var.cluster_cpu_limits
      memory_limits   = var.cluster_memory_limits
      pod_limit       = var.cluster_pod_limit
    }
  } : null
}

# Network Policies
output "network_policies" {
  description = "Network policy information"
  value = var.enable_network_policies ? {
    default_deny_all = {
      namespaces = local.app_namespaces
      count      = length(local.app_namespaces)
    }
  } : null
}

# Autoscaling Configuration
output "autoscaling" {
  description = "Autoscaling configuration"
  value = {
    hpa_enabled = var.enable_default_hpa
    vpa_enabled = var.enable_vpa
    hpa_config = var.enable_default_hpa ? {
      min_replicas     = var.hpa_min_replicas
      max_replicas     = var.hpa_max_replicas
      cpu_threshold    = var.hpa_cpu_threshold
      memory_threshold = var.hpa_memory_threshold
    } : null
  }
}

# Security Configuration
output "security_configuration" {
  description = "Security configuration information"
  value = {
    pod_security_policy_enabled = var.enable_pod_security_policy
    network_policies_enabled    = var.enable_network_policies
    rbac_enabled               = true
    runtime_security_enabled   = var.enable_kata_runtime
  }
}

# Cluster Metadata
output "cluster_metadata" {
  description = "Cluster metadata from config map"
  value = {
    name               = kubernetes_config_map.cluster_metadata.data["cluster_name"]
    environment        = kubernetes_config_map.cluster_metadata.data["environment"]
    terraform_version  = kubernetes_config_map.cluster_metadata.data["terraform_version"]
    creation_timestamp = kubernetes_config_map.cluster_metadata.data["creation_timestamp"]
    node_count         = kubernetes_config_map.cluster_metadata.data["node_count"]
  }
}

# Helm Releases Status
output "helm_releases" {
  description = "Status of all Helm releases"
  value = {
    ingress_nginx = var.enable_ingress_nginx ? {
      status  = helm_release.ingress_nginx[0].status
      version = helm_release.ingress_nginx[0].version
    } : null
    cert_manager = var.enable_cert_manager ? {
      status  = helm_release.cert_manager[0].status
      version = helm_release.cert_manager[0].version
    } : null
    prometheus = var.enable_monitoring ? {
      status  = helm_release.kube_prometheus_stack[0].status
      version = helm_release.kube_prometheus_stack[0].version
    } : null
    logging = var.enable_logging ? {
      fluent_bit_status = var.enable_fluent_bit ? helm_release.fluent_bit[0].status : null
      fluentd_status    = var.enable_fluent_bit ? null : helm_release.fluentd[0].status
      kibana_status     = helm_release.kibana[0].status
    } : null
  }
}

# Cloud Provider Information
output "cloud_provider_info" {
  description = "Cloud provider specific information"
  value = {
    provider = var.cloud_provider
    aws_region = var.cloud_provider == "aws" ? var.aws_region : null
    gcp_project_id = var.cloud_provider == "gcp" ? var.gcp_project_id : null
    azure_subscription_id = var.cloud_provider == "azure" ? var.azure_subscription_id : null
  }
}

# DNS Configuration
output "dns_configuration" {
  description = "DNS configuration information"
  value = {
    cluster_domain  = var.cluster_domain
    external_domain = var.external_domain
    external_dns_enabled = var.enable_external_dns
  }
}

# Feature Flags Status
output "feature_flags" {
  description = "Status of all feature flags"
  value = {
    monitoring_enabled           = var.enable_monitoring
    logging_enabled             = var.enable_logging
    istio_enabled               = var.enable_istio
    gitops_enabled              = var.enable_gitops
    backup_enabled              = var.enable_backup
    ingress_nginx_enabled       = var.enable_ingress_nginx
    cert_manager_enabled        = var.enable_cert_manager
    network_policies_enabled    = var.enable_network_policies
    pod_security_policy_enabled = var.enable_pod_security_policy
    vpa_enabled                 = var.enable_vpa
    disaster_recovery_enabled   = var.enable_disaster_recovery
  }
}

# Application Deployment Status
output "application_deployments" {
  description = "Status of application deployments"
  value = var.enable_default_applications ? {
    for app_name, app_config in var.applications : app_name => {
      namespace = app_config.namespace
      replicas  = app_config.replicas
      image     = "${app_config.image}:${app_config.tag}"
      deployed  = true
    }
  } : {}
}