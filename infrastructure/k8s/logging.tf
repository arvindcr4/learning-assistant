# Logging Stack - ELK/EFK (Elasticsearch, Logstash/Fluentd, Kibana)
# This file configures comprehensive logging for Kubernetes clusters

# Elasticsearch for log storage
resource "helm_release" "elasticsearch" {
  count = var.enable_logging && !var.enable_fluent_bit ? 1 : 0
  
  name       = "elasticsearch"
  repository = "https://helm.elastic.co"
  chart      = "elasticsearch"
  version    = "8.5.1"
  namespace  = var.logging_namespace
  
  create_namespace = true
  atomic          = var.helm_atomic
  timeout         = var.helm_timeout
  
  values = [
    yamlencode({
      # Elasticsearch configuration
      clusterName = "${var.cluster_name}-elasticsearch"
      
      replicas = var.elasticsearch_replicas
      
      # Resource configuration
      resources = {
        requests = {
          cpu    = "1000m"
          memory = "2Gi"
        }
        limits = {
          cpu    = "2000m"
          memory = "4Gi"
        }
      }
      
      # JVM heap settings
      esJavaOpts = "-Xmx2g -Xms2g"
      
      # Persistence configuration
      persistence = {
        enabled = true
        size    = var.elasticsearch_storage_size
        storageClass = "standard"
      }
      
      # Security context
      securityContext = {
        runAsNonRoot = true
        runAsUser    = 1000
        runAsGroup   = 1000
        fsGroup      = 1000
      }
      
      containerSecurityContext = {
        allowPrivilegeEscalation = false
        readOnlyRootFilesystem   = false  # Elasticsearch needs write access
        runAsNonRoot             = true
        runAsUser                = 1000
        capabilities = {
          drop = ["ALL"]
        }
      }
      
      # Node selector and tolerations
      nodeSelector = {
        "kubernetes.io/os" = "linux"
      }
      
      tolerations = [
        {
          key      = "logging"
          operator = "Equal"
          value    = "true"
          effect   = "NoSchedule"
        }
      ]
      
      # Anti-affinity for high availability
      antiAffinity = "hard"
      
      # Elasticsearch configuration
      esConfig = {
        "elasticsearch.yml" = <<-EOF
          cluster.name: ${var.cluster_name}-elasticsearch
          network.host: 0.0.0.0
          discovery.type: zen
          discovery.zen.minimum_master_nodes: 2
          discovery.zen.ping.unicast.hosts: ["elasticsearch-master-headless"]
          xpack.security.enabled: false
          xpack.monitoring.enabled: false
          xpack.graph.enabled: false
          xpack.watcher.enabled: false
          xpack.ml.enabled: false
          indices.query.bool.max_clause_count: 8192
          search.max_buckets: 100000
          action.destructive_requires_name: true
          cluster.routing.allocation.disk.threshold_enabled: true
          cluster.routing.allocation.disk.watermark.low: 85%
          cluster.routing.allocation.disk.watermark.high: 90%
          cluster.routing.allocation.disk.watermark.flood_stage: 95%
        EOF
      }
      
      # Service configuration
      service = {
        type = "ClusterIP"
        port = 9200
      }
      
      # Health checks
      readinessProbe = {
        httpGet = {
          path = "/_cluster/health?local=true"
          port = 9200
        }
        initialDelaySeconds = 90
        periodSeconds       = 10
        timeoutSeconds      = 5
        successThreshold    = 1
        failureThreshold    = 3
      }
      
      # Index lifecycle management
      lifecycle = {
        policy = "logs-policy"
        rolloverAlias = "logs"
      }
      
      # Monitoring
      monitoring = {
        enabled = var.enable_monitoring
        namespace = var.monitoring_namespace
      }
    })
  ]
  
  depends_on = [kubernetes_namespace.app_namespaces]
}

# Fluentd for log collection and forwarding
resource "helm_release" "fluentd" {
  count = var.enable_logging && !var.enable_fluent_bit ? 1 : 0
  
  name       = "fluentd"
  repository = "https://fluent.github.io/helm-charts"
  chart      = "fluentd"
  version    = "0.4.1"
  namespace  = var.logging_namespace
  
  atomic  = var.helm_atomic
  timeout = var.helm_timeout
  
  values = [
    yamlencode({
      # Fluentd configuration
      image = {
        repository = "fluent/fluentd-kubernetes-daemonset"
        tag        = "v1.16-debian-elasticsearch7-1"
      }
      
      # Resource configuration
      resources = {
        requests = {
          cpu    = "100m"
          memory = "256Mi"
        }
        limits = {
          cpu    = "500m"
          memory = "512Mi"
        }
      }
      
      # Security context
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
      
      # Node tolerations
      tolerations = [
        {
          operator = "Exists"
        }
      ]
      
      # Fluentd configuration
      fileConfigs = {
        "01_sources.conf" = <<-EOF
          <source>
            @type tail
            @id in_tail_container_logs
            path /var/log/containers/*.log
            pos_file /var/log/fluentd-containers.log.pos
            tag "kubernetes.*"
            exclude_path ["/var/log/containers/fluent*"]
            read_from_head true
            <parse>
              @type multi_format
              <pattern>
                format json
                time_key time
                time_format %Y-%m-%dT%H:%M:%S.%NZ
              </pattern>
              <pattern>
                format /^(?<time>.+) (?<stream>stdout|stderr) [^ ]* (?<log>.*)$/
                time_format %Y-%m-%dT%H:%M:%S.%N%:z
              </pattern>
            </parse>
          </source>
          
          <source>
            @type tail
            @id in_tail_kubelet
            multiline_flush_interval 5s
            path /var/log/kubelet.log
            pos_file /var/log/fluentd-kubelet.log.pos
            tag kubelet
            <parse>
              @type kubernetes
            </parse>
          </source>
          
          <source>
            @type tail
            @id in_tail_docker
            path /var/log/docker.log
            pos_file /var/log/fluentd-docker.log.pos
            tag docker
            <parse>
              @type regexp
              expression /^time="(?<time>[^)]*)" level=(?<severity>[^ ]*) msg="(?<message>[^"]*)"( err="(?<error>[^"]*)")?( statusCode=($<status_code>\d+))?/
            </parse>
          </source>
        EOF
        
        "02_filters.conf" = <<-EOF
          <filter kubernetes.**>
            @type kubernetes_metadata
            @id filter_kube_metadata
            kubernetes_url "#{ENV['FLUENT_FILTER_KUBERNETES_URL'] || 'https://' + ENV.fetch('KUBERNETES_SERVICE_HOST') + ':' + ENV.fetch('KUBERNETES_SERVICE_PORT') + '/api'}"
            verify_ssl "#{ENV['KUBERNETES_VERIFY_SSL'] || true}"
            ca_file "#{ENV['KUBERNETES_CA_FILE']}"
            skip_labels "#{ENV['FLUENT_KUBERNETES_METADATA_SKIP_LABELS'] || 'false'}"
            skip_container_metadata "#{ENV['FLUENT_KUBERNETES_METADATA_SKIP_CONTAINER_METADATA'] || 'false'}"
            skip_master_url "#{ENV['FLUENT_KUBERNETES_METADATA_SKIP_MASTER_URL'] || 'false'}"
            skip_namespace_metadata "#{ENV['FLUENT_KUBERNETES_METADATA_SKIP_NAMESPACE_METADATA'] || 'false'}"
          </filter>
          
          <filter kubernetes.**>
            @type parser
            @id filter_parser
            key_name log
            reserve_data true
            remove_key_name_field true
            <parse>
              @type multi_format
              <pattern>
                format json
              </pattern>
              <pattern>
                format none
              </pattern>
            </parse>
          </filter>
          
          <filter kubernetes.**>
            @type grep
            @id filter_grep
            <exclude>
              key $.kubernetes.container_name
              pattern /^(fluentd|fluent-bit)$/
            </exclude>
          </filter>
        EOF
        
        "03_dispatch.conf" = <<-EOF
          <match **>
            @type elasticsearch
            @id out_es
            @log_level info
            include_tag_key true
            host "#{ENV['FLUENT_ELASTICSEARCH_HOST'] || 'elasticsearch-master'}"
            port "#{ENV['FLUENT_ELASTICSEARCH_PORT'] || '9200'}"
            path "#{ENV['FLUENT_ELASTICSEARCH_PATH'] || ''}"
            scheme "#{ENV['FLUENT_ELASTICSEARCH_SCHEME'] || 'http'}"
            ssl_verify "#{ENV['FLUENT_ELASTICSEARCH_SSL_VERIFY'] || 'true'}"
            ssl_version "#{ENV['FLUENT_ELASTICSEARCH_SSL_VERSION'] || 'TLSv1_2'}"
            reload_connections false
            reconnect_on_error true
            reload_on_failure true
            log_es_400_reason false
            logstash_prefix "#{ENV['FLUENT_ELASTICSEARCH_LOGSTASH_PREFIX'] || 'logstash'}"
            logstash_dateformat "#{ENV['FLUENT_ELASTICSEARCH_LOGSTASH_DATEFORMAT'] || '%Y.%m.%d'}"
            logstash_format true
            index_name "#{ENV['FLUENT_ELASTICSEARCH_LOGSTASH_INDEX_NAME'] || 'logstash'}"
            type_name "#{ENV['FLUENT_ELASTICSEARCH_LOGSTASH_TYPE_NAME'] || '_doc'}"
            <buffer>
              flush_thread_count "#{ENV['FLUENT_ELASTICSEARCH_BUFFER_FLUSH_THREAD_COUNT'] || '8'}"
              flush_interval "#{ENV['FLUENT_ELASTICSEARCH_BUFFER_FLUSH_INTERVAL'] || '5s'}"
              chunk_limit_size "#{ENV['FLUENT_ELASTICSEARCH_BUFFER_CHUNK_LIMIT_SIZE'] || '2M'}"
              queue_limit_length "#{ENV['FLUENT_ELASTICSEARCH_BUFFER_QUEUE_LIMIT_LENGTH'] || '32'}"
              retry_max_interval "#{ENV['FLUENT_ELASTICSEARCH_BUFFER_RETRY_MAX_INTERVAL'] || '30'}"
              retry_forever true
            </buffer>
          </match>
        EOF
      }
      
      # Environment variables
      env = [
        {
          name  = "FLUENT_ELASTICSEARCH_HOST"
          value = "elasticsearch-master.${var.logging_namespace}.svc.cluster.local"
        },
        {
          name  = "FLUENT_ELASTICSEARCH_PORT"
          value = "9200"
        },
        {
          name  = "FLUENT_ELASTICSEARCH_SCHEME"
          value = "http"
        },
        {
          name  = "FLUENT_ELASTICSEARCH_SSL_VERIFY"
          value = "false"
        },
        {
          name  = "FLUENT_ELASTICSEARCH_LOGSTASH_PREFIX"
          value = var.cluster_name
        }
      ]
      
      # Volume mounts
      volumeMounts = [
        {
          name      = "varlog"
          mountPath = "/var/log"
        },
        {
          name      = "varlibdockercontainers"
          mountPath = "/var/lib/docker/containers"
          readOnly  = true
        }
      ]
      
      volumes = [
        {
          name = "varlog"
          hostPath = {
            path = "/var/log"
          }
        },
        {
          name = "varlibdockercontainers"
          hostPath = {
            path = "/var/lib/docker/containers"
          }
        }
      ]
      
      # Service account
      serviceAccount = {
        create = true
        name   = "fluentd"
      }
      
      # RBAC
      rbac = {
        create = true
      }
      
      # Pod disruption budget
      podDisruptionBudget = {
        enabled      = true
        minAvailable = "50%"
      }
      
      # Monitoring
      metrics = {
        enabled = var.enable_monitoring
        serviceMonitor = {
          enabled   = var.enable_monitoring
          namespace = var.monitoring_namespace
        }
      }
    })
  ]
  
  depends_on = [helm_release.elasticsearch]
}

# Fluent Bit as an alternative to Fluentd (lighter weight)
resource "helm_release" "fluent_bit" {
  count = var.enable_logging && var.enable_fluent_bit ? 1 : 0
  
  name       = "fluent-bit"
  repository = "https://fluent.github.io/helm-charts"
  chart      = "fluent-bit"
  version    = "0.39.0"
  namespace  = var.logging_namespace
  
  atomic  = var.helm_atomic
  timeout = var.helm_timeout
  
  values = [
    yamlencode({
      # Fluent Bit configuration
      image = {
        repository = "cr.fluentbit.io/fluent/fluent-bit"
        tag        = "2.2.0"
      }
      
      # Resource configuration
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
      
      # Security context
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
      
      # Node tolerations
      tolerations = [
        {
          operator = "Exists"
        }
      ]
      
      # Fluent Bit configuration
      config = {
        service = <<-EOF
          [SERVICE]
              Daemon Off
              Flush {{ .Values.flush }}
              Log_Level {{ .Values.logLevel }}
              Parsers_File parsers.conf
              Parsers_File custom_parsers.conf
              HTTP_Server On
              HTTP_Listen 0.0.0.0
              HTTP_Port {{ .Values.metricsPort }}
              Health_Check On
        EOF
        
        inputs = <<-EOF
          [INPUT]
              Name tail
              Path /var/log/containers/*.log
              multiline.parser docker, cri
              Tag kube.*
              Mem_Buf_Limit 50MB
              Skip_Long_Lines On
              
          [INPUT]
              Name systemd
              Tag host.*
              Systemd_Filter _SYSTEMD_UNIT=kubelet.service
              Read_From_Tail On
        EOF
        
        filters = <<-EOF
          [FILTER]
              Name kubernetes
              Match kube.*
              Kube_URL https://kubernetes.default.svc:443
              Kube_CA_File /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
              Kube_Token_File /var/run/secrets/kubernetes.io/serviceaccount/token
              Kube_Tag_Prefix kube.var.log.containers.
              Merge_Log On
              Keep_Log Off
              K8S-Logging.Parser On
              K8S-Logging.Exclude Off
              
          [FILTER]
              Name nest
              Match kube.*
              Operation lift
              Nested_under kubernetes
              Add_prefix   kubernetes_
              
          [FILTER]
              Name modify
              Match kube.*
              Remove kubernetes_pod_id
              Remove kubernetes_docker_id
              Remove kubernetes_container_hash
        EOF
        
        outputs = <<-EOF
          [OUTPUT]
              Name es
              Match kube.*
              Host elasticsearch-master.${var.logging_namespace}.svc.cluster.local
              Port 9200
              Logstash_Format On
              Logstash_Prefix ${var.cluster_name}
              Logstash_DateFormat %Y.%m.%d
              Retry_Limit False
              Type _doc
              Time_Key @timestamp
              Replace_Dots On
              
          [OUTPUT]
              Name es
              Match host.*
              Host elasticsearch-master.${var.logging_namespace}.svc.cluster.local
              Port 9200
              Logstash_Format On
              Logstash_Prefix ${var.cluster_name}-system
              Logstash_DateFormat %Y.%m.%d
              Retry_Limit False
              Type _doc
              Time_Key @timestamp
              Replace_Dots On
        EOF
        
        customParsers = <<-EOF
          [PARSER]
              Name docker_no_time
              Format json
              Time_Keep Off
              Time_Key time
              Time_Format %Y-%m-%dT%H:%M:%S.%L
        EOF
      }
      
      # Pod disruption budget
      podDisruptionBudget = {
        enabled      = true
        minAvailable = "50%"
      }
      
      # Service account
      serviceAccount = {
        create = true
        name   = "fluent-bit"
      }
      
      # RBAC
      rbac = {
        create = true
      }
      
      # Monitoring
      serviceMonitor = {
        enabled   = var.enable_monitoring
        namespace = var.monitoring_namespace
      }
      
      # Metrics configuration
      metricsPort = 2020
      
      # Log level
      logLevel = "info"
      
      # Flush interval
      flush = 5
    })
  ]
  
  depends_on = [kubernetes_namespace.app_namespaces]
}

# Kibana for log visualization
resource "helm_release" "kibana" {
  count = var.enable_logging ? 1 : 0
  
  name       = "kibana"
  repository = "https://helm.elastic.co"
  chart      = "kibana"
  version    = "8.5.1"
  namespace  = var.logging_namespace
  
  atomic  = var.helm_atomic
  timeout = var.helm_timeout
  
  values = [
    yamlencode({
      # Kibana configuration
      replicas = var.environment == "production" ? 2 : 1
      
      # Resource configuration
      resources = {
        requests = {
          cpu    = "500m"
          memory = "1Gi"
        }
        limits = {
          cpu    = "1000m"
          memory = "2Gi"
        }
      }
      
      # Security context
      securityContext = {
        runAsNonRoot = true
        runAsUser    = 1000
        runAsGroup   = 1000
        fsGroup      = 1000
      }
      
      containerSecurityContext = {
        allowPrivilegeEscalation = false
        readOnlyRootFilesystem   = false  # Kibana needs write access
        runAsNonRoot             = true
        runAsUser                = 1000
        capabilities = {
          drop = ["ALL"]
        }
      }
      
      # Node selector
      nodeSelector = {
        "kubernetes.io/os" = "linux"
      }
      
      # Anti-affinity for high availability
      antiAffinity = "soft"
      
      # Kibana configuration
      kibanaConfig = {
        "kibana.yml" = <<-EOF
          server.host: 0.0.0.0
          server.shutdownTimeout: 5s
          elasticsearch.hosts: ['http://elasticsearch-master.${var.logging_namespace}.svc.cluster.local:9200']
          monitoring.ui.container.elasticsearch.enabled: true
          xpack.security.enabled: false
          xpack.monitoring.enabled: false
          server.maxPayloadBytes: 1048576
          logging.appenders.file.type: file
          logging.appenders.file.fileName: /usr/share/kibana/logs/kibana.log
          logging.appenders.file.layout.type: json
          logging.root.level: info
          logging.root.appenders: [default, file]
          logging.metrics.enabled: false
        EOF
      }
      
      # Service configuration
      service = {
        type = "ClusterIP"
        port = 5601
      }
      
      # Ingress configuration
      ingress = {
        enabled = var.enable_ingress_nginx
        className = var.ingress_class
        annotations = {
          "cert-manager.io/cluster-issuer" = var.enable_cert_manager ? "letsencrypt-prod" : ""
          "nginx.ingress.kubernetes.io/auth-type" = "basic"
          "nginx.ingress.kubernetes.io/auth-secret" = "kibana-basic-auth"
          "nginx.ingress.kubernetes.io/auth-realm" = "Authentication Required"
        }
        hosts = [
          {
            host = "kibana.${var.external_domain}"
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
            secretName = "kibana-tls"
            hosts      = ["kibana.${var.external_domain}"]
          }
        ] : []
      }
      
      # Health checks
      readinessProbe = {
        httpGet = {
          path = "/api/status"
          port = 5601
        }
        initialDelaySeconds = 90
        periodSeconds       = 10
        timeoutSeconds      = 5
        successThreshold    = 1
        failureThreshold    = 3
      }
      
      livenessProbe = {
        httpGet = {
          path = "/api/status"
          port = 5601
        }
        initialDelaySeconds = 120
        periodSeconds       = 30
        timeoutSeconds      = 10
        successThreshold    = 1
        failureThreshold    = 3
      }
      
      # Persistence for Kibana data
      persistence = {
        enabled = true
        size    = "5Gi"
        storageClass = "standard"
      }
    })
  ]
  
  depends_on = [
    helm_release.elasticsearch,
    helm_release.fluent_bit,
    helm_release.fluentd
  ]
}

# Basic auth secret for Kibana
resource "kubernetes_secret" "kibana_basic_auth" {
  count = var.enable_logging && var.enable_ingress_nginx ? 1 : 0
  
  metadata {
    name      = "kibana-basic-auth"
    namespace = var.logging_namespace
    labels    = local.common_labels
  }
  
  type = "Opaque"
  
  data = {
    auth = base64encode("admin:${bcrypt(var.grafana_admin_password)}")
  }
  
  depends_on = [kubernetes_namespace.app_namespaces]
}

# Index lifecycle policy for log retention
resource "kubectl_manifest" "elasticsearch_ilm_policy" {
  count = var.enable_logging && !var.enable_fluent_bit ? 1 : 0
  
  yaml_body = <<YAML
apiVersion: v1
kind: ConfigMap
metadata:
  name: elasticsearch-ilm-policy
  namespace: ${var.logging_namespace}
  labels:
    ${jsonencode(local.common_labels)}
data:
  policy.json: |
    {
      "policy": {
        "phases": {
          "hot": {
            "actions": {
              "rollover": {
                "max_size": "50GB",
                "max_age": "1d"
              }
            }
          },
          "warm": {
            "min_age": "7d",
            "actions": {
              "allocate": {
                "number_of_replicas": 0
              }
            }
          },
          "cold": {
            "min_age": "30d",
            "actions": {
              "allocate": {
                "number_of_replicas": 0
              }
            }
          },
          "delete": {
            "min_age": "${var.log_retention_days}d"
          }
        }
      }
    }
YAML
  
  depends_on = [helm_release.elasticsearch]
}

# Network policy for logging namespace
resource "kubernetes_network_policy" "logging_network_policy" {
  count = var.enable_logging && var.enable_network_policies ? 1 : 0
  
  metadata {
    name      = "logging-network-policy"
    namespace = var.logging_namespace
    labels    = local.common_labels
  }
  
  spec {
    pod_selector {}
    
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
    }
    
    # Allow ingress from monitoring namespace
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
            name = var.logging_namespace
          }
        }
      }
    }
    
    # Allow ingress from all namespaces for log collection
    ingress {
      from {
        namespace_selector {}
      }
      
      ports {
        protocol = "TCP"
        port     = "9200"
      }
    }
    
    # Allow egress to same namespace
    egress {
      to {
        namespace_selector {
          match_labels = {
            name = var.logging_namespace
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
    
    # Allow egress to Kubernetes API
    egress {
      to {}
      
      ports {
        protocol = "TCP"
        port     = "6443"
      }
    }
  }
  
  depends_on = [kubernetes_namespace.app_namespaces]
}

# Log aggregation monitoring
resource "kubernetes_config_map" "log_monitoring" {
  count = var.enable_logging && var.enable_monitoring ? 1 : 0
  
  metadata {
    name      = "log-monitoring"
    namespace = var.monitoring_namespace
    labels    = local.common_labels
  }
  
  data = {
    "logging-rules.yml" = yamlencode({
      groups = [
        {
          name = "logging.rules"
          rules = [
            {
              alert = "ElasticsearchClusterRed"
              expr  = "elasticsearch_cluster_health_status{color=\"red\"} == 1"
              for   = "5m"
              labels = {
                severity = "critical"
              }
              annotations = {
                summary     = "Elasticsearch cluster status is RED"
                description = "Elasticsearch cluster {{ $labels.cluster }} health is RED"
              }
            },
            {
              alert = "ElasticsearchClusterYellow"
              expr  = "elasticsearch_cluster_health_status{color=\"yellow\"} == 1"
              for   = "10m"
              labels = {
                severity = "warning"
              }
              annotations = {
                summary     = "Elasticsearch cluster status is YELLOW"
                description = "Elasticsearch cluster {{ $labels.cluster }} health is YELLOW"
              }
            },
            {
              alert = "FluentBitDown"
              expr  = "up{job=\"fluent-bit\"} == 0"
              for   = "5m"
              labels = {
                severity = "warning"
              }
              annotations = {
                summary     = "Fluent Bit is down"
                description = "Fluent Bit on node {{ $labels.instance }} has been down for more than 5 minutes"
              }
            }
          ]
        }
      ]
    })
  }
  
  depends_on = [kubernetes_namespace.app_namespaces]
}