# Service Mesh - Istio Configuration
# This file configures Istio service mesh for advanced networking, security, and observability

# Istio Base (CRDs and cluster-wide resources)
resource "helm_release" "istio_base" {
  count = var.enable_istio ? 1 : 0
  
  name       = "istio-base"
  repository = "https://istio-release.storage.googleapis.com/charts"
  chart      = "base"
  version    = var.istio_version
  namespace  = var.istio_namespace
  
  create_namespace = true
  atomic          = var.helm_atomic
  timeout         = var.helm_timeout
  
  values = [
    yamlencode({
      # Global Istio configuration
      global = {
        istioNamespace = var.istio_namespace
        meshID         = var.cluster_name
        network        = var.cluster_name
        
        # Pilot configuration
        pilot = {
          env = {
            EXTERNAL_ISTIOD = false
          }
        }
        
        # Proxy configuration
        proxy = {
          resources = {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "200m"
              memory = "256Mi"
            }
          }
          
          # Security context for proxy
          securityContext = {
            runAsUser  = 1337
            runAsGroup = 1337
            fsGroup    = 1337
          }
          
          # Log level
          logLevel = "warning"
          
          # Concurrency
          concurrency = 2
        }
        
        # Default resources for Istio components
        defaultResources = {
          requests = {
            cpu    = "10m"
            memory = "40Mi"
          }
          limits = {
            cpu    = "100m"
            memory = "128Mi"
          }
        }
        
        # Hub and tag for Istio images
        hub = "docker.io/istio"
        tag = var.istio_version
        
        # Image pull policy
        imagePullPolicy = "IfNotPresent"
        
        # Logging
        logging = {
          level = "default:info"
        }
        
        # Monitoring
        monitoring = {
          enabled = var.enable_monitoring
        }
      }
      
      # Validation webhook configuration
      istiodRemote = {
        enabled = false
      }
      
      # Base chart specific configuration
      validationURL = ""
      
      # Default revision
      defaultRevision = ""
      
      # Experimental features
      experimental = {
        stableValidationPolicy = false
      }
    })
  ]
  
  depends_on = [kubernetes_namespace.app_namespaces]
}

# Istiod (Control Plane)
resource "helm_release" "istiod" {
  count = var.enable_istio ? 1 : 0
  
  name       = "istiod"
  repository = "https://istio-release.storage.googleapis.com/charts"
  chart      = "istiod"
  version    = var.istio_version
  namespace  = var.istio_namespace
  
  atomic  = var.helm_atomic
  timeout = var.helm_timeout
  
  values = [
    yamlencode({
      # Pilot configuration
      pilot = {
        # Resource configuration
        resources = {
          requests = {
            cpu    = "500m"
            memory = "2Gi"
          }
          limits = {
            cpu    = "1000m"
            memory = "4Gi"
          }
        }
        
        # Autoscaling
        autoscaleEnabled = true
        autoscaleMin     = var.environment == "production" ? 2 : 1
        autoscaleMax     = var.environment == "production" ? 5 : 3
        
        # CPU target for autoscaling
        cpu = {
          targetAverageUtilization = 80
        }
        
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
        
        # Pod disruption budget
        podDisruptionBudget = {
          enabled      = true
          minAvailable = var.environment == "production" ? 1 : 0
        }
        
        # Security context
        securityContext = {
          runAsNonRoot = true
          runAsUser    = 1337
          runAsGroup   = 1337
          fsGroup      = 1337
        }
        
        # Container security context
        containerSecurityContext = {
          allowPrivilegeEscalation = false
          readOnlyRootFilesystem   = true
          runAsNonRoot             = true
          runAsUser                = 1337
          capabilities = {
            drop = ["ALL"]
          }
        }
        
        # Environment variables
        env = {
          PILOT_TRACE_SAMPLING             = "1.0"
          PILOT_ENABLE_WORKLOAD_ENTRY_AUTOREGISTRATION = true
          PILOT_ENABLE_CROSS_CLUSTER_WORKLOAD_ENTRY    = true
          PILOT_ENABLE_STATUS                          = true
          PILOT_ENABLE_LEGACY_FSGROUP                  = false
          EXTERNAL_ISTIOD                              = false
          PILOT_SKIP_VALIDATE_CLUSTER_SECRET           = true
          PILOT_ENABLE_AMBIENT                         = false
        }
        
        # Istiod configuration
        traceSampling = 1.0
        
        # Service configuration
        service = {
          type = "ClusterIP"
          ports = [
            {
              port       = 15010
              name       = "grpc-xds"
              protocol   = "TCP"
              targetPort = 15010
            },
            {
              port       = 15011
              name       = "https-dns"
              protocol   = "TCP"
              targetPort = 15011
            },
            {
              port       = 15014
              name       = "http-monitoring"
              protocol   = "TCP"
              targetPort = 15014
            }
          ]
        }
        
        # Volumes
        volumes = [
          {
            name = "local-certs"
            emptyDir = {
              medium = "Memory"
            }
          },
          {
            name = "istio-token"
            projected = {
              sources = [
                {
                  serviceAccountToken = {
                    audience          = "istio-ca"
                    expirationSeconds = 43200
                    path              = "istio-token"
                  }
                }
              ]
            }
          },
          {
            name = "istio-ca-secret"
            secret = {
              secretName = "cacerts"
              optional   = true
            }
          }
        ]
        
        # Volume mounts
        volumeMounts = [
          {
            name      = "istio-token"
            mountPath = "/var/run/secrets/tokens"
          },
          {
            name      = "local-certs"
            mountPath = "/etc/ssl/certs"
          },
          {
            name      = "istio-ca-secret"
            mountPath = "/etc/cacerts"
            readOnly  = true
          }
        ]
      }
      
      # Global configuration (inherited from base)
      global = {
        istioNamespace = var.istio_namespace
        meshID         = var.cluster_name
        network        = var.cluster_name
        
        # Logging
        logging = {
          level = "default:info"
        }
        
        # Proxy configuration
        proxy = {
          resources = {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "200m"
              memory = "256Mi"
            }
          }
          logLevel = "warning"
        }
        
        # Hub and tag
        hub = "docker.io/istio"
        tag = var.istio_version
      }
      
      # Telemetry v2 configuration
      telemetry = {
        v2 = {
          enabled = true
          prometheus = {
            configOverride = {
              metric_relabeling_configs = [
                {
                  source_labels = ["__name__"]
                  regex         = "istio_build"
                  target_label  = "cluster"
                  replacement   = var.cluster_name
                }
              ]
            }
          }
        }
      }
      
      # Revision configuration
      revision = ""
      
      # Experimental features
      experimental = {
        stableValidationPolicy = false
      }
      
      # Sidecar injector configuration
      sidecarInjectorWebhook = {
        # Enable automatic sidecar injection
        enableNamespacesByDefault = false
        
        # Webhook configuration
        rewriteAppHTTPProbe = true
        
        # Default templates
        templates = {}
        
        # Injection policy
        injectedAnnotations = {}
        
        # Object selector
        objectSelector = {
          enabled         = false
          autoInject      = true
          namespacePolicy = "disabled"
        }
      }
    })
  ]
  
  depends_on = [helm_release.istio_base]
}

# Istio Gateway
resource "helm_release" "istio_gateway" {
  count = var.enable_istio && var.enable_istio_gateway ? 1 : 0
  
  name       = "istio-gateway"
  repository = "https://istio-release.storage.googleapis.com/charts"
  chart      = "gateway"
  version    = var.istio_version
  namespace  = var.istio_namespace
  
  atomic  = var.helm_atomic
  timeout = var.helm_timeout
  
  values = [
    yamlencode({
      # Gateway configuration
      gateways = {
        istio-ingressgateway = {
          # Service configuration
          type = "LoadBalancer"
          
          # Autoscaling
          autoscaling = {
            enabled     = true
            minReplicas = var.environment == "production" ? 3 : 2
            maxReplicas = var.environment == "production" ? 10 : 5
            targetCPUUtilizationPercentage = 80
          }
          
          # Resource configuration
          resources = {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "2000m"
              memory = "1Gi"
            }
          }
          
          # Security context
          securityContext = {
            runAsNonRoot = true
            runAsUser    = 1337
            runAsGroup   = 1337
            fsGroup      = 1337
          }
          
          # Container security context
          containerSecurityContext = {
            allowPrivilegeEscalation = false
            readOnlyRootFilesystem   = true
            runAsNonRoot             = true
            runAsUser                = 1337
            capabilities = {
              drop = ["ALL"]
            }
          }
          
          # Node selector
          nodeSelector = {
            "kubernetes.io/os" = "linux"
          }
          
          # Pod disruption budget
          podDisruptionBudget = {
            enabled      = true
            minAvailable = var.environment == "production" ? 2 : 1
          }
          
          # Service ports
          ports = [
            {
              port       = 15021
              targetPort = 15021
              name       = "status-port"
              protocol   = "TCP"
            },
            {
              port       = 80
              targetPort = 8080
              name       = "http2"
              protocol   = "TCP"
            },
            {
              port       = 443
              targetPort = 8443
              name       = "https"
              protocol   = "TCP"
            }
          ]
          
          # Load balancer source ranges (restrict access if needed)
          loadBalancerSourceRanges = []
          
          # Annotations for cloud provider load balancer
          serviceAnnotations = var.cloud_provider == "aws" ? {
            "service.beta.kubernetes.io/aws-load-balancer-type"                    = "nlb"
            "service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled" = "true"
          } : var.cloud_provider == "gcp" ? {
            "cloud.google.com/load-balancer-type" = "External"
          } : var.cloud_provider == "azure" ? {
            "service.beta.kubernetes.io/azure-load-balancer-internal" = "false"
          } : {}
          
          # Environment variables
          env = {}
          
          # Pod annotations
          podAnnotations = {
            "sidecar.istio.io/inject"                = "false"
            "cluster-autoscaler.kubernetes.io/safe-to-evict" = "true"
          }
          
          # Labels
          labels = merge(local.common_labels, {
            "app"   = "istio-ingressgateway"
            "istio" = "ingressgateway"
          })
          
          # Volumes
          volumes = []
          
          # Volume mounts
          volumeMounts = []
        }
      }
      
      # Global configuration
      global = {
        istioNamespace = var.istio_namespace
        meshID         = var.cluster_name
        network        = var.cluster_name
        
        # Hub and tag
        hub = "docker.io/istio"
        tag = var.istio_version
      }
    })
  ]
  
  depends_on = [helm_release.istiod]
}

# Default Gateway configuration
resource "kubectl_manifest" "default_gateway" {
  count = var.enable_istio && var.enable_istio_gateway ? 1 : 0
  
  yaml_body = <<YAML
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: default-gateway
  namespace: ${var.istio_namespace}
  labels:
    ${jsonencode(local.common_labels)}
spec:
  selector:
    istio: ingressgateway
  servers:
  - port:
      number: 80
      name: http
      protocol: HTTP
    hosts: ${jsonencode(var.istio_gateway_hosts)}
    tls:
      httpsRedirect: true
  - port:
      number: 443
      name: https
      protocol: HTTPS
    hosts: ${jsonencode(var.istio_gateway_hosts)}
    tls:
      mode: SIMPLE
      credentialName: default-tls
YAML
  
  depends_on = [helm_release.istio_gateway]
}

# Default destination rule for circuit breaker
resource "kubectl_manifest" "default_destination_rule" {
  count = var.enable_istio ? 1 : 0
  
  yaml_body = <<YAML
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: default-destination-rule
  namespace: ${var.istio_namespace}
  labels:
    ${jsonencode(local.common_labels)}
spec:
  host: "*.local"
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 50
        http2MaxRequests: 100
        maxRequestsPerConnection: 10
        maxRetries: 3
        consecutiveGatewayErrors: 5
        interval: 30s
        baseEjectionTime: 30s
        maxEjectionPercent: 50
        minHealthPercent: 50
    circuitBreaker:
      consecutiveErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
      minHealthPercent: 50
YAML
  
  depends_on = [helm_release.istiod]
}

# Service mesh monitoring configuration
resource "kubectl_manifest" "istio_prometheus_rule" {
  count = var.enable_istio && var.enable_monitoring ? 1 : 0
  
  yaml_body = <<YAML
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: istio-monitoring-rules
  namespace: ${var.monitoring_namespace}
  labels:
    ${jsonencode(local.common_labels)}
spec:
  groups:
  - name: istio.rules
    rules:
    - alert: IstioHighRequestLatency
      expr: histogram_quantile(0.99, sum(rate(istio_request_duration_milliseconds_bucket[5m])) by (destination_service_name, le)) > 1000
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Istio high request latency"
        description: "Service {{ $labels.destination_service_name }} has 99th percentile latency above 1000ms"
    
    - alert: IstioHighErrorRate
      expr: sum(rate(istio_requests_total{response_code!~"2.."}[5m])) / sum(rate(istio_requests_total[5m])) > 0.05
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Istio high error rate"
        description: "Error rate is above 5%"
    
    - alert: IstioProxyDown
      expr: up{job="istio-proxy"} == 0
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "Istio proxy is down"
        description: "Istio proxy {{ $labels.instance }} has been down for more than 5 minutes"
YAML
  
  depends_on = [helm_release.istiod]
}

# Service Monitor for Istio metrics
resource "kubectl_manifest" "istio_service_monitor" {
  count = var.enable_istio && var.enable_monitoring ? 1 : 0
  
  yaml_body = <<YAML
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: istio-mesh
  namespace: ${var.monitoring_namespace}
  labels:
    ${jsonencode(local.common_labels)}
spec:
  selector:
    matchLabels:
      app: istiod
  endpoints:
  - port: http-monitoring
    interval: 15s
    path: /stats/prometheus
  namespaceSelector:
    matchNames:
    - ${var.istio_namespace}
YAML
  
  depends_on = [helm_release.istiod]
}

# Peer Authentication for mutual TLS
resource "kubectl_manifest" "default_peer_authentication" {
  count = var.enable_istio ? 1 : 0
  
  yaml_body = <<YAML
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: ${var.istio_namespace}
  labels:
    ${jsonencode(local.common_labels)}
spec:
  mtls:
    mode: STRICT
YAML
  
  depends_on = [helm_release.istiod]
}

# Authorization Policy for namespace isolation
resource "kubectl_manifest" "namespace_authorization_policy" {
  count = var.enable_istio && var.create_namespaces ? length(var.namespaces) : 0
  
  yaml_body = <<YAML
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: default-deny
  namespace: ${var.namespaces[count.index]}
  labels:
    ${jsonencode(local.common_labels)}
spec:
  {}
---
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-same-namespace
  namespace: ${var.namespaces[count.index]}
  labels:
    ${jsonencode(local.common_labels)}
spec:
  rules:
  - from:
    - source:
        namespaces: ["${var.namespaces[count.index]}"]
---
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-ingress-gateway
  namespace: ${var.namespaces[count.index]}
  labels:
    ${jsonencode(local.common_labels)}
spec:
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/${var.istio_namespace}/sa/istio-ingressgateway-service-account"]
YAML
  
  depends_on = [
    helm_release.istiod,
    kubernetes_namespace.app_namespaces
  ]
}

# Virtual Service for default routing
resource "kubectl_manifest" "default_virtual_service" {
  count = var.enable_istio && var.enable_istio_gateway ? 1 : 0
  
  yaml_body = <<YAML
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: default-vs
  namespace: ${var.istio_namespace}
  labels:
    ${jsonencode(local.common_labels)}
spec:
  hosts: ${jsonencode(var.istio_gateway_hosts)}
  gateways:
  - default-gateway
  http:
  - match:
    - headers:
        ":authority":
          regex: ".*"
    fault:
      delay:
        percentage:
          value: 0.1
        fixedDelay: 5s
    route:
    - destination:
        host: istio-ingressgateway.${var.istio_namespace}.svc.cluster.local
        port:
          number: 80
    timeout: 30s
    retries:
      attempts: 3
      perTryTimeout: 10s
YAML
  
  depends_on = [kubectl_manifest.default_gateway]
}

# Envoy Filter for custom configurations
resource "kubectl_manifest" "envoy_filter" {
  count = var.enable_istio ? 1 : 0
  
  yaml_body = <<YAML
apiVersion: networking.istio.io/v1alpha3
kind: EnvoyFilter
metadata:
  name: custom-headers
  namespace: ${var.istio_namespace}
  labels:
    ${jsonencode(local.common_labels)}
spec:
  configPatches:
  - applyTo: HTTP_FILTER
    match:
      context: SIDECAR_INBOUND
      listener:
        filterChain:
          filter:
            name: "envoy.filters.network.http_connection_manager"
    patch:
      operation: INSERT_BEFORE
      value:
        name: envoy.filters.http.lua
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.filters.http.lua.v3.Lua
          inline_code: |
            function envoy_on_request(request_handle)
              request_handle:headers():add("x-custom-header", "istio-mesh")
              request_handle:headers():add("x-cluster-name", "${var.cluster_name}")
            end
            function envoy_on_response(response_handle)
              response_handle:headers():add("x-served-by", "istio")
            end
YAML
  
  depends_on = [helm_release.istiod]
}

# Network policy for Istio namespace
resource "kubernetes_network_policy" "istio_network_policy" {
  count = var.enable_istio && var.enable_network_policies ? 1 : 0
  
  metadata {
    name      = "istio-network-policy"
    namespace = var.istio_namespace
    labels    = local.common_labels
  }
  
  spec {
    pod_selector {}
    
    policy_types = ["Ingress", "Egress"]
    
    # Allow ingress from anywhere to ingress gateway
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
      
      ports {
        protocol = "TCP"
        port     = "15021"
      }
    }
    
    # Allow ingress from same namespace
    ingress {
      from {
        namespace_selector {
          match_labels = {
            name = var.istio_namespace
          }
        }
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
        port     = "15014"
      }
    }
    
    # Allow egress to all namespaces for service mesh
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
    
    # Allow egress to Kubernetes API
    egress {
      to {}
      
      ports {
        protocol = "TCP"
        port     = "6443"
      }
    }
    
    # Allow egress to internet for external services
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
  
  depends_on = [kubernetes_namespace.app_namespaces]
}

# Istio operator for advanced configurations (optional)
resource "kubectl_manifest" "istio_operator" {
  count = var.enable_istio_operator ? 1 : 0
  
  yaml_body = <<YAML
apiVersion: install.istio.io/v1alpha1
kind: IstioOperator
metadata:
  name: control-plane
  namespace: ${var.istio_namespace}
  labels:
    ${jsonencode(local.common_labels)}
spec:
  values:
    global:
      meshID: ${var.cluster_name}
      network: ${var.cluster_name}
      meshConfig:
        defaultConfig:
          proxyStatsMatcher:
            inclusionRegexps:
            - ".*outlier_detection.*"
            - ".*circuit_breakers.*"
            - ".*upstream_rq_retry.*"
            - ".*upstream_rq_pending.*"
            - ".*_cx_.*"
            exclusionRegexps:
            - ".*osconfig.*"
  components:
    pilot:
      k8s:
        resources:
          requests:
            cpu: 500m
            memory: 2Gi
          limits:
            cpu: 1000m
            memory: 4Gi
        hpaSpec:
          minReplicas: ${var.environment == "production" ? 2 : 1}
          maxReplicas: ${var.environment == "production" ? 5 : 3}
    ingressGateways:
    - name: istio-ingressgateway
      enabled: ${var.enable_istio_gateway}
      k8s:
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 2000m
            memory: 1Gi
        hpaSpec:
          minReplicas: ${var.environment == "production" ? 3 : 2}
          maxReplicas: ${var.environment == "production" ? 10 : 5}
        service:
          type: LoadBalancer
YAML
  
  depends_on = [helm_release.istio_base]
}

# Additional variable for Istio operator
variable "enable_istio_operator" {
  description = "Whether to enable Istio operator"
  type        = bool
  default     = false
}