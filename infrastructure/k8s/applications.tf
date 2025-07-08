# Application Deployment Management
# This file manages application deployments with GitOps, autoscaling, and best practices

# ArgoCD for GitOps
resource "helm_release" "argocd" {
  count = var.enable_gitops && var.gitops_tool == "argocd" ? 1 : 0
  
  name       = "argocd"
  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argo-cd"
  version    = "5.51.4"
  namespace  = var.gitops_namespace
  
  create_namespace = true
  atomic          = var.helm_atomic
  timeout         = var.helm_timeout
  
  values = [
    yamlencode({
      # Global configuration
      global = {
        image = {
          repository = "quay.io/argoproj/argocd"
          tag        = "v2.9.3"
        }
        
        # Security context
        securityContext = {
          runAsNonRoot = true
          runAsUser    = 999
          runAsGroup   = 999
          fsGroup      = 999
        }
        
        # Pod security standards
        podSecurityContext = {
          runAsNonRoot = true
          runAsUser    = 999
          runAsGroup   = 999
          fsGroup      = 999
        }
        
        containerSecurityContext = {
          allowPrivilegeEscalation = false
          readOnlyRootFilesystem   = true
          runAsNonRoot             = true
          runAsUser                = 999
          capabilities = {
            drop = ["ALL"]
          }
        }
      }
      
      # Controller configuration
      controller = {
        # Resource configuration
        resources = {
          requests = {
            cpu    = "500m"
            memory = "1Gi"
          }
          limits = {
            cpu    = "2000m"
            memory = "4Gi"
          }
        }
        
        # Replicas for high availability
        replicas = var.environment == "production" ? 3 : 1
        
        # Node selector
        nodeSelector = {
          "kubernetes.io/os" = "linux"
        }
        
        # Tolerations
        tolerations = [
          {
            key      = "node-role.kubernetes.io/control-plane"
            operator = "Exists"
            effect   = "NoSchedule"
          }
        ]
        
        # Metrics
        metrics = {
          enabled = var.enable_monitoring
          serviceMonitor = {
            enabled   = var.enable_monitoring
            namespace = var.monitoring_namespace
          }
        }
        
        # Log level
        logLevel = "info"
        
        # Log format
        logFormat = "json"
        
        # Environment variables
        env = [
          {
            name  = "ARGOCD_CONTROLLER_REPLICAS"
            value = tostring(var.environment == "production" ? 3 : 1)
          }
        ]
        
        # Application controller configuration
        applicationInstanceLabelKey = "argocd.argoproj.io/instance"
      }
      
      # Dex configuration (OIDC)
      dex = {
        enabled = false  # Disable for simplicity, can be enabled for SSO
        
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
      }
      
      # Redis configuration
      redis = {
        enabled = true
        
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
        
        # Redis HA configuration
        ha = {
          enabled = var.environment == "production"
          replicas = var.environment == "production" ? 3 : 1
          
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
        }
      }
      
      # Server configuration
      server = {
        # Resource configuration
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
        
        # Replicas
        replicas = var.environment == "production" ? 3 : 2
        
        # Autoscaling
        autoscaling = {
          enabled     = true
          minReplicas = var.environment == "production" ? 3 : 2
          maxReplicas = var.environment == "production" ? 10 : 5
          targetCPUUtilizationPercentage = 70
          targetMemoryUtilizationPercentage = 80
        }
        
        # Pod disruption budget
        podDisruptionBudget = {
          enabled      = true
          minAvailable = var.environment == "production" ? 2 : 1
        }
        
        # Service configuration
        service = {
          type = "ClusterIP"
          port = 80
        }
        
        # Ingress configuration
        ingress = {
          enabled = var.enable_ingress_nginx
          ingressClassName = var.ingress_class
          annotations = {
            "cert-manager.io/cluster-issuer" = var.enable_cert_manager ? "letsencrypt-prod" : ""
            "nginx.ingress.kubernetes.io/ssl-redirect" = "true"
            "nginx.ingress.kubernetes.io/force-ssl-redirect" = "true"
            "nginx.ingress.kubernetes.io/backend-protocol" = "GRPC"
          }
          hosts = [
            {
              host = "argocd.${var.external_domain}"
              paths = [
                {
                  path     = "/"
                  pathType = "Prefix"
                }
              ]
            }
          ]
          tls = var.enable_cert_manager ? [
            {
              secretName = "argocd-server-tls"
              hosts      = ["argocd.${var.external_domain}"]
            }
          ] : []
        }
        
        # Metrics
        metrics = {
          enabled = var.enable_monitoring
          serviceMonitor = {
            enabled   = var.enable_monitoring
            namespace = var.monitoring_namespace
          }
        }
        
        # ArgoCD configuration
        config = {
          # Application instance label key
          "application.instanceLabelKey" = "argocd.argoproj.io/instance"
          
          # Server configuration
          "server.insecure" = false
          "server.grpc.web" = true
          
          # Repository configuration
          "repositories" = var.git_repository_url != "" ? [
            {
              url  = var.git_repository_url
              type = "git"
            }
          ] : []
          
          # Resource exclusions
          "resource.exclusions" = [
            {
              apiGroups = ["cilium.io"]
              kinds     = ["CiliumIdentity"]
              clusters  = ["*"]
            }
          ]
          
          # Resource inclusions
          "resource.inclusions" = []
          
          # Resource customizations
          "resource.customizations" = {
            "networking.k8s.io/Ingress" = {
              health = {
                lua = <<-EOF
                  health_status = {}
                  if obj.status ~= nil then
                    if obj.status.loadBalancer ~= nil then
                      if obj.status.loadBalancer.ingress ~= nil then
                        health_status.status = "Healthy"
                        health_status.message = "Ingress has been provisioned"
                        return health_status
                      end
                    end
                  end
                  health_status.status = "Progressing"
                  health_status.message = "Waiting for ingress to be provisioned"
                  return health_status
                EOF
              }
            }
          }
          
          # URL
          "url" = "https://argocd.${var.external_domain}"
          
          # Application settings
          "application.resourceTrackingMethod" = "annotation"
        }
        
        # RBAC configuration
        rbacConfig = {
          "policy.default" = "role:readonly"
          "policy.csv" = <<-EOF
            p, role:admin, applications, *, */*, allow
            p, role:admin, clusters, *, *, allow
            p, role:admin, repositories, *, *, allow
            p, role:developer, applications, *, */*, allow
            p, role:developer, repositories, get, *, allow
            p, role:readonly, applications, get, */*, allow
            p, role:readonly, repositories, get, *, allow
            g, argocd-admins, role:admin
            g, argocd-developers, role:developer
          EOF
        }
      }
      
      # Repository server configuration
      repoServer = {
        # Resource configuration
        resources = {
          requests = {
            cpu    = "100m"
            memory = "256Mi"
          }
          limits = {
            cpu    = "1000m"
            memory = "1Gi"
          }
        }
        
        # Replicas
        replicas = var.environment == "production" ? 3 : 2
        
        # Autoscaling
        autoscaling = {
          enabled     = true
          minReplicas = var.environment == "production" ? 3 : 2
          maxReplicas = var.environment == "production" ? 10 : 5
          targetCPUUtilizationPercentage = 70
          targetMemoryUtilizationPercentage = 80
        }
        
        # Metrics
        metrics = {
          enabled = var.enable_monitoring
          serviceMonitor = {
            enabled   = var.enable_monitoring
            namespace = var.monitoring_namespace
          }
        }
        
        # Environment variables
        env = [
          {
            name  = "ARGOCD_EXEC_TIMEOUT"
            value = "120s"
          },
          {
            name  = "ARGOCD_SERVER_REPO_SERVER_TIMEOUT_SECONDS"
            value = "120"
          }
        ]
      }
      
      # Application Set controller
      applicationSet = {
        enabled = true
        
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
        
        # Metrics
        metrics = {
          enabled = var.enable_monitoring
          serviceMonitor = {
            enabled   = var.enable_monitoring
            namespace = var.monitoring_namespace
          }
        }
      }
      
      # Notifications
      notifications = {
        enabled = true
        
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
        
        # Metrics
        metrics = {
          enabled = var.enable_monitoring
          serviceMonitor = {
            enabled   = var.enable_monitoring
            namespace = var.monitoring_namespace
          }
        }
      }
      
      # Configs
      configs = {
        # Repository credentials template
        credentialTemplates = {}
        
        # Known hosts for Git repositories
        knownHosts = {
          data = {
            ssh_known_hosts = <<-EOF
              github.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCj7ndNxQowgcQnjshcLrqPEiiphnt+VTTvDP6mHBL9j1aNUkY4Ue1gvwnGLVlOhGeYrnZaMgRK6+PKCUXaDbC7qtbW8gIkhL7aGCsOr/C56SJMy/BCZfxd1nWzAOxSDPgVsmerOBYfNqltV9/hWCqBywINIR+5dIg6JTJ72pcEpEjcYgXkE2YEFXV1JHnsKgbLWNlhScqb2UmyRkQyytRLtL+38TGxkxCflmO+5Z8CSSNY7GidjMIZ7Q4zMjA2n1nGrlTDkzwDCsw+wqFPGQA179cnfGWOWRVruj16z6XyvxvjJwbz0wQZ75XK5tKSb7FNyeIEs4TT4jk+S4dhPeAUC5y+bDYirYgM4GC7uEnztnZyaVWQ7B381AK4Qdrwt51ZqExKbQpTUNn+EjqoTwvqNj4kqx5QUCI0ThS/YkOxJCXmPUWZbhjpCg56i+2aB6CmK2JGhn57K5mj0MNdBXA4/WnwH6XoPWJzK5Nyu2zB3nAZp+S5hpQs+p1vN1/wsjk=
              gitlab.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCsj2bNKTBSpIYDEGk9KxsGh3mySTRgMtXL583qmBpzeQ+jqCMRgBqB98u3z++J1sKlXHWfM9dyhSevkMwSbhoR8XIq/U0tCNyokEi/ueaBMCvbcTHhO7k0VCUCz+5D0TQUtFALzs8mUVqMGKxj6KPdXBNK3nOkHNJ2q3j3vZCN1uB8z7O0+oG0E8+W8wdTpC0G6V1xm6Sf8R1Xe1i4e8QGQ2iiYF9J3v8vE8vU+Q/mG3bh4+HWC2e3HhY1F9Z
            EOF
          }
        }
        
        # TLS certificates
        tlsCerts = {}
        
        # Styles
        styles = ""
        
        # Parameters
        params = {
          "application.namespaces" = join(",", var.namespaces)
          "server.insecure"        = "false"
          "server.grpc.web"        = "true"
        }
      }
    })
  ]
  
  depends_on = [kubernetes_namespace.app_namespaces]
}

# Flux for GitOps (alternative to ArgoCD)
resource "helm_release" "flux" {
  count = var.enable_gitops && var.gitops_tool == "flux" ? 1 : 0
  
  name       = "flux-system"
  repository = "https://fluxcd-community.github.io/helm-charts"
  chart      = "flux2"
  version    = "2.12.1"
  namespace  = var.gitops_namespace
  
  create_namespace = true
  atomic          = var.helm_atomic
  timeout         = var.helm_timeout
  
  values = [
    yamlencode({
      # Flux components
      controllers = {
        source = {
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
        }
        
        kustomize = {
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
        }
        
        helm = {
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
        }
        
        notification = {
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
        }
        
        imageReflection = {
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
        }
        
        imageAutomation = {
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
        }
      }
      
      # Security context
      securityContext = {
        runAsNonRoot = true
        runAsUser    = 65534
        runAsGroup   = 65534
        fsGroup      = 65534
      }
      
      containerSecurityContext = {
        allowPrivilegeEscalation = false
        readOnlyRootFilesystem   = true
        runAsNonRoot             = true
        runAsUser                = 65534
        capabilities = {
          drop = ["ALL"]
        }
      }
      
      # Node selector
      nodeSelector = {
        "kubernetes.io/os" = "linux"
      }
      
      # Monitoring
      prometheus = {
        podMonitor = {
          create = var.enable_monitoring
        }
      }
    })
  ]
  
  depends_on = [kubernetes_namespace.app_namespaces]
}

# Default applications for demonstration
resource "kubernetes_deployment" "sample_app" {
  count = var.enable_default_applications ? length(var.applications) : 0
  
  metadata {
    name      = keys(var.applications)[count.index]
    namespace = values(var.applications)[count.index].namespace
    labels = merge(local.common_labels, {
      "app" = keys(var.applications)[count.index]
    })
  }
  
  spec {
    replicas = values(var.applications)[count.index].replicas
    
    selector {
      match_labels = {
        "app" = keys(var.applications)[count.index]
      }
    }
    
    template {
      metadata {
        labels = merge(local.common_labels, {
          "app" = keys(var.applications)[count.index]
          "monitoring" = "true"
        })
        annotations = {
          "prometheus.io/scrape" = "true"
          "prometheus.io/port"   = "8080"
          "prometheus.io/path"   = "/metrics"
        }
      }
      
      spec {
        security_context {
          run_as_non_root = true
          run_as_user     = 1000
          run_as_group    = 1000
          fs_group        = 1000
        }
        
        container {
          name  = keys(var.applications)[count.index]
          image = "${values(var.applications)[count.index].image}:${values(var.applications)[count.index].tag}"
          
          port {
            container_port = 8080
            name          = "http"
            protocol      = "TCP"
          }
          
          port {
            container_port = 8080
            name          = "metrics"
            protocol      = "TCP"
          }
          
          resources {
            requests = {
              cpu    = values(var.applications)[count.index].resources.requests.cpu
              memory = values(var.applications)[count.index].resources.requests.memory
            }
            limits = {
              cpu    = values(var.applications)[count.index].resources.limits.cpu
              memory = values(var.applications)[count.index].resources.limits.memory
            }
          }
          
          security_context {
            allow_privilege_escalation = false
            read_only_root_filesystem  = true
            run_as_non_root           = true
            run_as_user               = 1000
            capabilities {
              drop = ["ALL"]
            }
          }
          
          liveness_probe {
            http_get {
              path = "/health"
              port = "http"
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
            success_threshold     = 1
          }
          
          readiness_probe {
            http_get {
              path = "/ready"
              port = "http"
            }
            initial_delay_seconds = 5
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 3
            success_threshold     = 1
          }
          
          env {
            name  = "ENVIRONMENT"
            value = var.environment
          }
          
          env {
            name  = "CLUSTER_NAME"
            value = var.cluster_name
          }
          
          volume_mount {
            name       = "tmp"
            mount_path = "/tmp"
          }
          
          volume_mount {
            name       = "cache"
            mount_path = "/app/cache"
          }
        }
        
        volume {
          name = "tmp"
          empty_dir {
            medium = "Memory"
          }
        }
        
        volume {
          name = "cache"
          empty_dir {}
        }
        
        node_selector = {
          "kubernetes.io/os" = "linux"
        }
        
        affinity {
          pod_anti_affinity {
            preferred_during_scheduling_ignored_during_execution {
              weight = 100
              pod_affinity_term {
                label_selector {
                  match_expressions {
                    key      = "app"
                    operator = "In"
                    values   = [keys(var.applications)[count.index]]
                  }
                }
                topology_key = "kubernetes.io/hostname"
              }
            }
          }
        }
        
        toleration {
          key      = "node-role.kubernetes.io/control-plane"
          operator = "Exists"
          effect   = "NoSchedule"
        }
      }
    }
    
    strategy {
      type = "RollingUpdate"
      rolling_update {
        max_unavailable = "25%"
        max_surge       = "25%"
      }
    }
  }
  
  depends_on = [kubernetes_namespace.app_namespaces]
}

# Services for sample applications
resource "kubernetes_service" "sample_app" {
  count = var.enable_default_applications ? length(var.applications) : 0
  
  metadata {
    name      = keys(var.applications)[count.index]
    namespace = values(var.applications)[count.index].namespace
    labels = merge(local.common_labels, {
      "app" = keys(var.applications)[count.index]
    })
    annotations = {
      "prometheus.io/scrape" = "true"
      "prometheus.io/port"   = "8080"
      "prometheus.io/path"   = "/metrics"
    }
  }
  
  spec {
    selector = {
      "app" = keys(var.applications)[count.index]
    }
    
    port {
      name        = "http"
      port        = 80
      target_port = "http"
      protocol    = "TCP"
    }
    
    port {
      name        = "metrics"
      port        = 8080
      target_port = "metrics"
      protocol    = "TCP"
    }
    
    type = "ClusterIP"
  }
  
  depends_on = [kubernetes_deployment.sample_app]
}

# HPA for sample applications
resource "kubernetes_horizontal_pod_autoscaler_v2" "sample_app" {
  count = var.enable_default_applications ? length(var.applications) : 0
  
  metadata {
    name      = keys(var.applications)[count.index]
    namespace = values(var.applications)[count.index].namespace
    labels    = local.common_labels
  }
  
  spec {
    scale_target_ref {
      api_version = "apps/v1"
      kind        = "Deployment"
      name        = keys(var.applications)[count.index]
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
  
  depends_on = [kubernetes_deployment.sample_app]
}

# Ingress for sample applications
resource "kubernetes_ingress_v1" "sample_app" {
  count = var.enable_default_applications && var.enable_ingress_nginx ? length(var.applications) : 0
  
  metadata {
    name      = keys(var.applications)[count.index]
    namespace = values(var.applications)[count.index].namespace
    labels    = local.common_labels
    annotations = {
      "kubernetes.io/ingress.class"        = var.ingress_class
      "cert-manager.io/cluster-issuer"     = var.enable_cert_manager ? "letsencrypt-prod" : ""
      "nginx.ingress.kubernetes.io/rewrite-target" = "/"
    }
  }
  
  spec {
    ingress_class_name = var.ingress_class
    
    rule {
      host = "${keys(var.applications)[count.index]}.${var.external_domain}"
      
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          
          backend {
            service {
              name = keys(var.applications)[count.index]
              port {
                number = 80
              }
            }
          }
        }
      }
    }
    
    dynamic "tls" {
      for_each = var.enable_cert_manager ? [1] : []
      content {
        hosts       = ["${keys(var.applications)[count.index]}.${var.external_domain}"]
        secret_name = "${keys(var.applications)[count.index]}-tls"
      }
    }
  }
  
  depends_on = [kubernetes_service.sample_app]
}

# Network policy for applications
resource "kubernetes_network_policy" "sample_app" {
  count = var.enable_default_applications && var.enable_network_policies ? length(var.applications) : 0
  
  metadata {
    name      = keys(var.applications)[count.index]
    namespace = values(var.applications)[count.index].namespace
    labels    = local.common_labels
  }
  
  spec {
    pod_selector {
      match_labels = {
        "app" = keys(var.applications)[count.index]
      }
    }
    
    policy_types = ["Ingress", "Egress"]
    
    # Allow ingress from ingress controller
    ingress {
      from {
        namespace_selector {
          match_labels = {
            name = "ingress-nginx"
          }
        }
      }
      
      ports {
        protocol = "TCP"
        port     = "http"
      }
    }
    
    # Allow ingress from monitoring for metrics
    ingress {
      from {
        namespace_selector {
          match_labels = {
            name = var.monitoring_namespace
          }
        }
      }
      
      ports {
        protocol = "TCP"
        port     = "metrics"
      }
    }
    
    # Allow ingress from same namespace
    ingress {
      from {
        namespace_selector {
          match_labels = {
            name = values(var.applications)[count.index].namespace
          }
        }
      }
    }
    
    # Allow egress to same namespace
    egress {
      to {
        namespace_selector {
          match_labels = {
            name = values(var.applications)[count.index].namespace
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
    
    # Allow egress to internet
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
  
  depends_on = [kubernetes_deployment.sample_app]
}

# GitOps application for ArgoCD
resource "kubectl_manifest" "argocd_application" {
  count = var.enable_gitops && var.gitops_tool == "argocd" && var.git_repository_url != "" ? 1 : 0
  
  yaml_body = <<YAML
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: cluster-applications
  namespace: ${var.gitops_namespace}
  labels:
    ${jsonencode(local.common_labels)}
spec:
  project: default
  source:
    repoURL: ${var.git_repository_url}
    targetRevision: ${var.git_branch}
    path: kubernetes/applications
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
      allowEmpty: false
    syncOptions:
    - CreateNamespace=true
    - PrunePropagationPolicy=foreground
    - PruneLast=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
YAML
  
  depends_on = [helm_release.argocd]
}

# GitRepository for Flux
resource "kubectl_manifest" "flux_git_repository" {
  count = var.enable_gitops && var.gitops_tool == "flux" && var.git_repository_url != "" ? 1 : 0
  
  yaml_body = <<YAML
apiVersion: source.toolkit.fluxcd.io/v1beta1
kind: GitRepository
metadata:
  name: cluster-applications
  namespace: ${var.gitops_namespace}
  labels:
    ${jsonencode(local.common_labels)}
spec:
  interval: 1m
  ref:
    branch: ${var.git_branch}
  url: ${var.git_repository_url}
YAML
  
  depends_on = [helm_release.flux]
}

# Kustomization for Flux
resource "kubectl_manifest" "flux_kustomization" {
  count = var.enable_gitops && var.gitops_tool == "flux" && var.git_repository_url != "" ? 1 : 0
  
  yaml_body = <<YAML
apiVersion: kustomize.toolkit.fluxcd.io/v1beta1
kind: Kustomization
metadata:
  name: cluster-applications
  namespace: ${var.gitops_namespace}
  labels:
    ${jsonencode(local.common_labels)}
spec:
  interval: 10m
  path: "./kubernetes/applications"
  prune: true
  sourceRef:
    kind: GitRepository
    name: cluster-applications
  validation: client
  healthChecks:
  - apiVersion: apps/v1
    kind: Deployment
    name: "*"
    namespace: production
YAML
  
  depends_on = [kubectl_manifest.flux_git_repository]
}