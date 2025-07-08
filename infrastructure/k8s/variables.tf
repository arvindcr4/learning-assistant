# Variables for Kubernetes Infrastructure Configuration
# This file contains all configurable variables for the Kubernetes infrastructure

# Cluster Configuration
variable "cluster_name" {
  description = "Name of the Kubernetes cluster"
  type        = string
  default     = "k8s-cluster"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "terraform_version" {
  description = "Version of Terraform used for deployment"
  type        = string
  default     = "1.0.0"
}

# Namespace Configuration
variable "create_namespaces" {
  description = "Whether to create application namespaces"
  type        = bool
  default     = true
}

variable "namespaces" {
  description = "List of namespaces to create"
  type        = list(string)
  default = [
    "production",
    "staging",
    "development",
    "monitoring",
    "logging",
    "istio-system",
    "cert-manager",
    "ingress-nginx",
    "backup",
    "gitops"
  ]
}

# Service Account Configuration
variable "create_terraform_sa" {
  description = "Whether to create a Terraform service account"
  type        = bool
  default     = true
}

# Runtime Configuration
variable "enable_kata_runtime" {
  description = "Whether to enable Kata runtime class"
  type        = bool
  default     = false
}

# Security Configuration
variable "enable_pod_security_policy" {
  description = "Whether to enable Pod Security Policy"
  type        = bool
  default     = false
}

variable "enable_network_policies" {
  description = "Whether to enable default network policies"
  type        = bool
  default     = true
}

variable "enable_security_context_constraints" {
  description = "Whether to enable Security Context Constraints (OpenShift)"
  type        = bool
  default     = false
}

# Autoscaling Configuration
variable "enable_default_hpa" {
  description = "Whether to enable default HPA configuration"
  type        = bool
  default     = false
}

variable "enable_vpa" {
  description = "Whether to enable Vertical Pod Autoscaler"
  type        = bool
  default     = false
}

variable "hpa_min_replicas" {
  description = "Minimum number of replicas for HPA"
  type        = number
  default     = 1
}

variable "hpa_max_replicas" {
  description = "Maximum number of replicas for HPA"
  type        = number
  default     = 10
}

variable "hpa_cpu_threshold" {
  description = "CPU utilization threshold for HPA"
  type        = number
  default     = 70
}

variable "hpa_memory_threshold" {
  description = "Memory utilization threshold for HPA"
  type        = number
  default     = 80
}

# Resource Quotas and Limits
variable "enable_cluster_resource_quota" {
  description = "Whether to enable cluster-wide resource quotas"
  type        = bool
  default     = true
}

variable "cluster_cpu_requests" {
  description = "Total CPU requests allowed in the cluster"
  type        = string
  default     = "100"
}

variable "cluster_memory_requests" {
  description = "Total memory requests allowed in the cluster"
  type        = string
  default     = "100Gi"
}

variable "cluster_cpu_limits" {
  description = "Total CPU limits allowed in the cluster"
  type        = string
  default     = "200"
}

variable "cluster_memory_limits" {
  description = "Total memory limits allowed in the cluster"
  type        = string
  default     = "200Gi"
}

variable "cluster_pod_limit" {
  description = "Maximum number of pods allowed in the cluster"
  type        = string
  default     = "1000"
}

variable "enable_limit_ranges" {
  description = "Whether to enable limit ranges for namespaces"
  type        = bool
  default     = true
}

# Storage Configuration
variable "enable_storage_classes" {
  description = "Whether to create storage classes"
  type        = bool
  default     = true
}

variable "storage_classes" {
  description = "Storage classes to create"
  type = map(object({
    provisioner          = string
    reclaim_policy      = string
    volume_binding_mode = string
    allow_expansion     = bool
    parameters          = map(string)
  }))
  default = {
    "fast-ssd" = {
      provisioner          = "kubernetes.io/aws-ebs"
      reclaim_policy      = "Delete"
      volume_binding_mode = "WaitForFirstConsumer"
      allow_expansion     = true
      parameters = {
        type = "gp3"
        fsType = "ext4"
      }
    }
    "standard" = {
      provisioner          = "kubernetes.io/aws-ebs"
      reclaim_policy      = "Delete"
      volume_binding_mode = "WaitForFirstConsumer"
      allow_expansion     = true
      parameters = {
        type = "gp2"
        fsType = "ext4"
      }
    }
  }
}

variable "enable_backup" {
  description = "Whether to enable backup solutions"
  type        = bool
  default     = true
}

# Ingress Configuration
variable "enable_ingress_nginx" {
  description = "Whether to deploy NGINX ingress controller"
  type        = bool
  default     = true
}

variable "enable_cert_manager" {
  description = "Whether to deploy cert-manager"
  type        = bool
  default     = true
}

variable "cert_manager_email" {
  description = "Email address for Let's Encrypt certificates"
  type        = string
  default     = "admin@example.com"
}

variable "ingress_class" {
  description = "Ingress class to use"
  type        = string
  default     = "nginx"
}

variable "enable_external_dns" {
  description = "Whether to enable external DNS"
  type        = bool
  default     = false
}

# Monitoring Configuration
variable "enable_monitoring" {
  description = "Whether to deploy monitoring stack"
  type        = bool
  default     = true
}

variable "monitoring_namespace" {
  description = "Namespace for monitoring components"
  type        = string
  default     = "monitoring"
}

variable "prometheus_retention" {
  description = "Prometheus data retention period"
  type        = string
  default     = "15d"
}

variable "prometheus_storage_size" {
  description = "Prometheus storage size"
  type        = string
  default     = "50Gi"
}

variable "grafana_admin_password" {
  description = "Grafana admin password"
  type        = string
  default     = "admin"
  sensitive   = true
}

variable "enable_alertmanager" {
  description = "Whether to deploy AlertManager"
  type        = bool
  default     = true
}

variable "alertmanager_config" {
  description = "AlertManager configuration"
  type        = string
  default     = ""
}

# Logging Configuration
variable "enable_logging" {
  description = "Whether to deploy logging stack"
  type        = bool
  default     = true
}

variable "logging_namespace" {
  description = "Namespace for logging components"
  type        = string
  default     = "logging"
}

variable "elasticsearch_storage_size" {
  description = "Elasticsearch storage size"
  type        = string
  default     = "30Gi"
}

variable "elasticsearch_replicas" {
  description = "Number of Elasticsearch replicas"
  type        = number
  default     = 3
}

variable "log_retention_days" {
  description = "Log retention period in days"
  type        = number
  default     = 30
}

variable "enable_fluent_bit" {
  description = "Whether to use Fluent Bit instead of Fluentd"
  type        = bool
  default     = true
}

# Service Mesh Configuration
variable "enable_istio" {
  description = "Whether to deploy Istio service mesh"
  type        = bool
  default     = false
}

variable "istio_namespace" {
  description = "Namespace for Istio components"
  type        = string
  default     = "istio-system"
}

variable "istio_version" {
  description = "Istio version to deploy"
  type        = string
  default     = "1.19.0"
}

variable "enable_istio_gateway" {
  description = "Whether to create Istio gateway"
  type        = bool
  default     = false
}

variable "istio_gateway_hosts" {
  description = "Hosts for Istio gateway"
  type        = list(string)
  default     = ["*"]
}

# GitOps Configuration
variable "enable_gitops" {
  description = "Whether to deploy GitOps tools"
  type        = bool
  default     = false
}

variable "gitops_tool" {
  description = "GitOps tool to use (argocd or flux)"
  type        = string
  default     = "argocd"
  
  validation {
    condition     = contains(["argocd", "flux"], var.gitops_tool)
    error_message = "GitOps tool must be either 'argocd' or 'flux'."
  }
}

variable "gitops_namespace" {
  description = "Namespace for GitOps components"
  type        = string
  default     = "gitops"
}

variable "git_repository_url" {
  description = "Git repository URL for GitOps"
  type        = string
  default     = ""
}

variable "git_branch" {
  description = "Git branch for GitOps"
  type        = string
  default     = "main"
}

# Application Configuration
variable "enable_default_applications" {
  description = "Whether to deploy default applications"
  type        = bool
  default     = false
}

variable "applications" {
  description = "Applications to deploy"
  type = map(object({
    namespace = string
    replicas  = number
    image     = string
    tag       = string
    resources = object({
      requests = object({
        cpu    = string
        memory = string
      })
      limits = object({
        cpu    = string
        memory = string
      })
    })
  }))
  default = {}
}

# Backup Configuration
variable "backup_schedule" {
  description = "Backup schedule in cron format"
  type        = string
  default     = "0 2 * * *"
}

variable "backup_retention" {
  description = "Backup retention period"
  type        = string
  default     = "30d"
}

variable "backup_storage_location" {
  description = "Backup storage location"
  type        = string
  default     = ""
}

# Cloud Provider Specific Variables
variable "cloud_provider" {
  description = "Cloud provider (aws, gcp, azure, or generic)"
  type        = string
  default     = "generic"
  
  validation {
    condition     = contains(["aws", "gcp", "azure", "generic"], var.cloud_provider)
    error_message = "Cloud provider must be one of: aws, gcp, azure, generic."
  }
}

variable "aws_region" {
  description = "AWS region for EBS storage"
  type        = string
  default     = "us-west-2"
}

variable "gcp_project_id" {
  description = "GCP project ID"
  type        = string
  default     = ""
}

variable "azure_subscription_id" {
  description = "Azure subscription ID"
  type        = string
  default     = ""
}

# DNS Configuration
variable "cluster_domain" {
  description = "Cluster domain name"
  type        = string
  default     = "cluster.local"
}

variable "external_domain" {
  description = "External domain for ingress"
  type        = string
  default     = "example.com"
}

# Feature Flags
variable "enable_pod_disruption_budgets" {
  description = "Whether to enable pod disruption budgets"
  type        = bool
  default     = true
}

variable "enable_cluster_autoscaler" {
  description = "Whether to enable cluster autoscaler"
  type        = bool
  default     = false
}

variable "enable_metrics_server" {
  description = "Whether to deploy metrics server"
  type        = bool
  default     = true
}

variable "enable_dashboard" {
  description = "Whether to deploy Kubernetes dashboard"
  type        = bool
  default     = false
}

# Disaster Recovery
variable "enable_disaster_recovery" {
  description = "Whether to enable disaster recovery features"
  type        = bool
  default     = true
}

variable "multi_az_deployment" {
  description = "Whether to deploy across multiple availability zones"
  type        = bool
  default     = true
}

# Custom Resource Definitions
variable "custom_crds" {
  description = "Custom Resource Definitions to create"
  type        = list(string)
  default     = []
}

# Tagging
variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

# Helm Configuration
variable "helm_timeout" {
  description = "Timeout for Helm operations"
  type        = number
  default     = 600
}

variable "helm_atomic" {
  description = "Whether Helm operations should be atomic"
  type        = bool
  default     = true
}

variable "helm_create_namespace" {
  description = "Whether Helm should create namespaces"
  type        = bool
  default     = true
}