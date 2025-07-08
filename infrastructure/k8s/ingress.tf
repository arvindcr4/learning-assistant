# Ingress Controllers and SSL/TLS Management
# This file configures ingress controllers, cert-manager, and SSL/TLS certificates

# NGINX Ingress Controller
resource "helm_release" "ingress_nginx" {
  count = var.enable_ingress_nginx ? 1 : 0
  
  name       = "ingress-nginx"
  repository = "https://kubernetes.github.io/ingress-nginx"
  chart      = "ingress-nginx"
  version    = "4.8.3"
  namespace  = "ingress-nginx"
  
  create_namespace = true
  atomic          = var.helm_atomic
  timeout         = var.helm_timeout
  
  values = [
    yamlencode({
      controller = {
        replicaCount = var.environment == "production" ? 3 : 2
        
        config = {
          enable-real-ip                 = "true"
          forwarded-for-header           = "X-Forwarded-For"
          compute-full-forwarded-for     = "true"
          use-forwarded-headers          = "true"
          enable-brotli                  = "true"
          ssl-protocols                  = "TLSv1.2 TLSv1.3"
          ssl-ciphers                   = "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384"
          ssl-prefer-server-ciphers     = "true"
          ssl-session-cache             = "shared:SSL:10m"
          ssl-session-timeout           = "10m"
          hsts-max-age                  = "31536000"
          hsts-include-subdomains       = "true"
          hsts-preload                  = "true"
          server-name-hash-bucket-size  = "256"
          large-client-header-buffers   = "4 16k"
          client-header-buffer-size     = "64k"
          client-body-buffer-size       = "128k"
          client-max-body-size          = "100m"
          proxy-body-size               = "100m"
          proxy-buffer-size             = "16k"
          proxy-buffers                 = "8 16k"
          worker-processes              = "auto"
          worker-connections            = "16384"
          max-worker-connections        = "16384"
          keep-alive                    = "75"
          keep-alive-requests           = "1000"
          upstream-keepalive-connections = "320"
          upstream-keepalive-requests   = "10000"
          upstream-keepalive-timeout    = "60"
          log-format-escape-json        = "true"
          log-format-upstream = jsonencode({
            time                     = "$time_iso8601"
            remote_addr              = "$remote_addr"
            x_forwarded_for          = "$http_x_forwarded_for"
            request_id               = "$req_id"
            remote_user              = "$remote_user"
            bytes_sent               = "$bytes_sent"
            request_time             = "$request_time"
            status                   = "$status"
            vhost                    = "$host"
            request_proto            = "$server_protocol"
            path                     = "$uri"
            request_query            = "$args"
            request_length           = "$request_length"
            duration                 = "$request_time"
            method                   = "$request_method"
            http_referrer            = "$http_referer"
            http_user_agent          = "$http_user_agent"
            upstream_addr            = "$upstream_addr"
            upstream_response_length = "$upstream_response_length"
            upstream_response_time   = "$upstream_response_time"
            upstream_status          = "$upstream_status"
          })
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
            operator = "Equal"
            effect   = "NoSchedule"
          }
        ]
        
        affinity = {
          podAntiAffinity = {
            preferredDuringSchedulingIgnoredDuringExecution = [
              {
                weight = 100
                podAffinityTerm = {
                  labelSelector = {
                    matchExpressions = [
                      {
                        key      = "app.kubernetes.io/name"
                        operator = "In"
                        values   = ["ingress-nginx"]
                      }
                    ]
                  }
                  topologyKey = "kubernetes.io/hostname"
                }
              }
            ]
          }
        }
        
        metrics = {
          enabled = true
          serviceMonitor = {
            enabled   = var.enable_monitoring
            namespace = var.monitoring_namespace
          }
        }
        
        podDisruptionBudget = {
          enabled      = true
          minAvailable = var.environment == "production" ? 2 : 1
        }
        
        service = {
          type = var.cloud_provider == "aws" ? "LoadBalancer" : "LoadBalancer"
          annotations = var.cloud_provider == "aws" ? {
            "service.beta.kubernetes.io/aws-load-balancer-type"                    = "nlb"
            "service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled" = "true"
            "service.beta.kubernetes.io/aws-load-balancer-backend-protocol"        = "tcp"
            "service.beta.kubernetes.io/aws-load-balancer-connection-idle-timeout" = "60"
          } : var.cloud_provider == "gcp" ? {
            "cloud.google.com/load-balancer-type" = "External"
          } : var.cloud_provider == "azure" ? {
            "service.beta.kubernetes.io/azure-load-balancer-internal" = "false"
          } : {}
        }
        
        autoscaling = {
          enabled     = true
          minReplicas = var.environment == "production" ? 3 : 2
          maxReplicas = var.environment == "production" ? 10 : 5
          targetCPUUtilizationPercentage = 70
          targetMemoryUtilizationPercentage = 80
        }
      }
      
      defaultBackend = {
        enabled = true
        image = {
          repository = "registry.k8s.io/defaultbackend-amd64"
          tag        = "1.5"
        }
        resources = {
          requests = {
            cpu    = "10m"
            memory = "20Mi"
          }
          limits = {
            cpu    = "50m"
            memory = "50Mi"
          }
        }
      }
      
      rbac = {
        create = true
      }
      
      serviceAccount = {
        create = true
        name   = "ingress-nginx"
      }
      
      podSecurityPolicy = {
        enabled = var.enable_pod_security_policy
      }
    })
  ]
  
  depends_on = [kubernetes_namespace.app_namespaces]
}

# Cert-Manager for SSL/TLS certificate management
resource "helm_release" "cert_manager" {
  count = var.enable_cert_manager ? 1 : 0
  
  name       = "cert-manager"
  repository = "https://charts.jetstack.io"
  chart      = "cert-manager"
  version    = "v1.13.2"
  namespace  = "cert-manager"
  
  create_namespace = true
  atomic          = var.helm_atomic
  timeout         = var.helm_timeout
  
  values = [
    yamlencode({
      installCRDs = true
      
      replicaCount = var.environment == "production" ? 3 : 2
      
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
      
      podDisruptionBudget = {
        enabled      = true
        minAvailable = var.environment == "production" ? 2 : 1
      }
      
      serviceMonitor = {
        enabled   = var.enable_monitoring
        namespace = var.monitoring_namespace
      }
      
      webhook = {
        replicaCount = var.environment == "production" ? 3 : 2
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
      
      cainjector = {
        replicaCount = var.environment == "production" ? 3 : 2
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
      
      startupapicheck = {
        enabled = true
        resources = {
          requests = {
            cpu    = "10m"
            memory = "32Mi"
          }
          limits = {
            cpu    = "100m"
            memory = "128Mi"
          }
        }
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
  
  depends_on = [kubernetes_namespace.app_namespaces]
}

# Let's Encrypt ClusterIssuer for staging
resource "kubectl_manifest" "letsencrypt_staging" {
  count = var.enable_cert_manager ? 1 : 0
  
  yaml_body = <<YAML
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
  labels:
    ${jsonencode(local.common_labels)}
spec:
  acme:
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    email: ${var.cert_manager_email}
    privateKeySecretRef:
      name: letsencrypt-staging
    solvers:
    - http01:
        ingress:
          class: nginx
          podTemplate:
            spec:
              nodeSelector:
                "kubernetes.io/os": linux
YAML
  
  depends_on = [helm_release.cert_manager]
}

# Let's Encrypt ClusterIssuer for production
resource "kubectl_manifest" "letsencrypt_prod" {
  count = var.enable_cert_manager ? 1 : 0
  
  yaml_body = <<YAML
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
  labels:
    ${jsonencode(local.common_labels)}
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: ${var.cert_manager_email}
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
          podTemplate:
            spec:
              nodeSelector:
                "kubernetes.io/os": linux
YAML
  
  depends_on = [helm_release.cert_manager]
}

# Default SSL certificate for wildcard domain
resource "kubectl_manifest" "default_certificate" {
  count = var.enable_cert_manager && var.external_domain != "example.com" ? 1 : 0
  
  yaml_body = <<YAML
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: default-tls
  namespace: ingress-nginx
  labels:
    ${jsonencode(local.common_labels)}
spec:
  secretName: default-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
  - ${var.external_domain}
  - "*.${var.external_domain}"
YAML
  
  depends_on = [
    helm_release.ingress_nginx,
    kubectl_manifest.letsencrypt_prod
  ]
}

# External DNS for automatic DNS management
resource "helm_release" "external_dns" {
  count = var.enable_external_dns ? 1 : 0
  
  name       = "external-dns"
  repository = "https://kubernetes-sigs.github.io/external-dns/"
  chart      = "external-dns"
  version    = "1.13.1"
  namespace  = "external-dns"
  
  create_namespace = true
  atomic          = var.helm_atomic
  timeout         = var.helm_timeout
  
  values = [
    yamlencode({
      sources = ["ingress", "service"]
      
      provider = var.cloud_provider == "aws" ? "aws" : var.cloud_provider == "gcp" ? "google" : var.cloud_provider == "azure" ? "azure" : "cloudflare"
      
      domainFilters = [var.external_domain]
      
      registry = "txt"
      txtOwnerId = var.cluster_name
      
      interval = "1m"
      
      logLevel = "info"
      logFormat = "json"
      
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
      
      serviceMonitor = {
        enabled   = var.enable_monitoring
        namespace = var.monitoring_namespace
      }
      
      # Cloud provider specific configurations
      aws = var.cloud_provider == "aws" ? {
        region = var.aws_region
        zoneType = "public"
        assumeRoleArn = var.external_dns_role_arn
      } : null
      
      google = var.cloud_provider == "gcp" ? {
        project = var.gcp_project_id
      } : null
      
      azure = var.cloud_provider == "azure" ? {
        subscriptionId = var.azure_subscription_id
        resourceGroup  = var.azure_resource_group
      } : null
      
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
  
  depends_on = [kubernetes_namespace.app_namespaces]
}

# Additional variables for external DNS
variable "external_dns_role_arn" {
  description = "IAM role ARN for external DNS"
  type        = string
  default     = ""
}

variable "azure_resource_group" {
  description = "Azure resource group for external DNS"
  type        = string
  default     = ""
}

# IngressClass for NGINX
resource "kubernetes_ingress_class" "nginx" {
  count = var.enable_ingress_nginx ? 1 : 0
  
  metadata {
    name = "nginx"
    labels = local.common_labels
    annotations = {
      "ingressclass.kubernetes.io/is-default-class" = "true"
    }
  }
  
  spec {
    controller = "k8s.io/ingress-nginx"
  }
  
  depends_on = [helm_release.ingress_nginx]
}

# Default backend service for custom 404 pages
resource "kubernetes_service" "default_backend" {
  count = var.enable_ingress_nginx ? 1 : 0
  
  metadata {
    name      = "default-backend"
    namespace = "ingress-nginx"
    labels    = local.common_labels
  }
  
  spec {
    selector = {
      "app.kubernetes.io/name"     = "default-backend"
      "app.kubernetes.io/instance" = "default-backend"
    }
    
    port {
      port        = 80
      target_port = 8080
      protocol    = "TCP"
    }
    
    type = "ClusterIP"
  }
  
  depends_on = [helm_release.ingress_nginx]
}

# Network policy for ingress controller
resource "kubernetes_network_policy" "ingress_nginx" {
  count = var.enable_ingress_nginx && var.enable_network_policies ? 1 : 0
  
  metadata {
    name      = "ingress-nginx"
    namespace = "ingress-nginx"
    labels    = local.common_labels
  }
  
  spec {
    pod_selector {
      match_labels = {
        "app.kubernetes.io/name" = "ingress-nginx"
      }
    }
    
    policy_types = ["Ingress", "Egress"]
    
    # Allow ingress from anywhere on HTTP/HTTPS
    ingress {
      from {}
      
      ports {
        protocol = "TCP"
        port     = "80"
      }
      
      ports {
        protocol = "TCP"
        port     = "443"
      }
    }
    
    # Allow egress to application namespaces
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
    
    # Allow egress to internet for ACME challenges
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
  
  depends_on = [helm_release.ingress_nginx]
}

# Network policy for cert-manager
resource "kubernetes_network_policy" "cert_manager" {
  count = var.enable_cert_manager && var.enable_network_policies ? 1 : 0
  
  metadata {
    name      = "cert-manager"
    namespace = "cert-manager"
    labels    = local.common_labels
  }
  
  spec {
    pod_selector {
      match_labels = {
        "app.kubernetes.io/name" = "cert-manager"
      }
    }
    
    policy_types = ["Ingress", "Egress"]
    
    # Allow ingress from webhooks
    ingress {
      from {
        namespace_selector {
          match_labels = {
            name = "cert-manager"
          }
        }
      }
      
      ports {
        protocol = "TCP"
        port     = "9402"
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
    
    # Allow egress to internet for ACME challenges
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
    
    # Allow egress to Kubernetes API
    egress {
      to {}
      
      ports {
        protocol = "TCP"
        port     = "6443"
      }
    }
  }
  
  depends_on = [helm_release.cert_manager]
}

# Monitoring service for ingress controller
resource "kubernetes_service" "ingress_nginx_metrics" {
  count = var.enable_ingress_nginx && var.enable_monitoring ? 1 : 0
  
  metadata {
    name      = "ingress-nginx-metrics"
    namespace = "ingress-nginx"
    labels = merge(local.common_labels, {
      "app.kubernetes.io/name"     = "ingress-nginx"
      "app.kubernetes.io/instance" = "ingress-nginx"
    })
  }
  
  spec {
    selector = {
      "app.kubernetes.io/name"     = "ingress-nginx"
      "app.kubernetes.io/instance" = "ingress-nginx"
    }
    
    port {
      name        = "metrics"
      port        = 10254
      target_port = 10254
      protocol    = "TCP"
    }
    
    type = "ClusterIP"
  }
  
  depends_on = [helm_release.ingress_nginx]
}