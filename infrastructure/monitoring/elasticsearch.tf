# ==============================================================================
# ELASTICSEARCH LOGGING INFRASTRUCTURE
# Centralized Log Aggregation and Analysis Platform
# ==============================================================================

# ==============================================================================
# ELASTIC CLOUD ON KUBERNETES (ECK) OPERATOR
# ==============================================================================

resource "helm_release" "eck_operator" {
  name       = "elastic-operator"
  repository = "https://helm.elastic.co"
  chart      = "eck-operator"
  version    = "2.10.0"
  namespace  = "elastic-system"
  create_namespace = true

  values = [
    templatefile("${path.module}/helm-values/eck-operator.yml", {
      environment = var.environment
    })
  ]
}

# ==============================================================================
# ELASTICSEARCH CLUSTER
# ==============================================================================

resource "kubernetes_manifest" "elasticsearch_cluster" {
  manifest = {
    apiVersion = "elasticsearch.k8s.elastic.co/v1"
    kind       = "Elasticsearch"
    metadata = {
      name      = "elasticsearch"
      namespace = kubernetes_namespace.logging.metadata[0].name
      labels = merge(local.common_labels, {
        app = "elasticsearch"
      })
    }
    spec = {
      version = "8.11.0"
      
      # HTTP configuration
      http = {
        tls = {
          selfSignedCertificate = {
            disabled = true
          }
        }
      }

      # Node sets configuration
      nodeSets = [
        # Master nodes
        {
          name  = "master"
          count = local.elasticsearch_config.master_nodes
          config = {
            "node.roles" = ["master"]
            "cluster.remote.connect" = false
            "xpack.security.enabled" = true
            "xpack.security.authc.anonymous.roles" = "kibana_system"
            "xpack.monitoring.collection.enabled" = true
          }
          
          podTemplate = {
            metadata = {
              labels = {
                node-type = "master"
              }
            }
            spec = {
              initContainers = [
                {
                  name = "sysctl"
                  securityContext = {
                    privileged = true
                    runAsUser = 0
                  }
                  image = "busybox"
                  command = ["sh", "-c", "sysctl -w vm.max_map_count=262144"]
                }
              ]
              containers = [
                {
                  name = "elasticsearch"
                  resources = {
                    requests = {
                      memory = "2Gi"
                      cpu = "500m"
                    }
                    limits = {
                      memory = "4Gi"
                      cpu = "2000m"
                    }
                  }
                  env = [
                    {
                      name = "ES_JAVA_OPTS"
                      value = "-Xms${local.elasticsearch_config.heap_size} -Xmx${local.elasticsearch_config.heap_size}"
                    }
                  ]
                }
              ]
            }
          }

          volumeClaimTemplates = [
            {
              metadata = {
                name = "elasticsearch-data"
              }
              spec = {
                accessModes = ["ReadWriteOnce"]
                storageClassName = kubernetes_storage_class.monitoring_ssd.metadata[0].name
                resources = {
                  requests = {
                    storage = "20Gi"
                  }
                }
              }
            }
          ]
        },

        # Data nodes
        {
          name  = "data"
          count = local.elasticsearch_config.data_nodes
          config = {
            "node.roles" = ["data", "data_content", "data_hot", "data_warm", "data_cold"]
            "cluster.remote.connect" = false
            "xpack.security.enabled" = true
            "xpack.monitoring.collection.enabled" = true
          }

          podTemplate = {
            metadata = {
              labels = {
                node-type = "data"
              }
            }
            spec = {
              initContainers = [
                {
                  name = "sysctl"
                  securityContext = {
                    privileged = true
                    runAsUser = 0
                  }
                  image = "busybox"
                  command = ["sh", "-c", "sysctl -w vm.max_map_count=262144"]
                }
              ]
              containers = [
                {
                  name = "elasticsearch"
                  resources = {
                    requests = {
                      memory = "4Gi"
                      cpu = "1000m"
                    }
                    limits = {
                      memory = "8Gi"
                      cpu = "4000m"
                    }
                  }
                  env = [
                    {
                      name = "ES_JAVA_OPTS"
                      value = "-Xms${local.elasticsearch_config.heap_size} -Xmx${local.elasticsearch_config.heap_size}"
                    }
                  ]
                }
              ]
            }
          }

          volumeClaimTemplates = [
            {
              metadata = {
                name = "elasticsearch-data"
              }
              spec = {
                accessModes = ["ReadWriteOnce"]
                storageClassName = kubernetes_storage_class.monitoring_ssd.metadata[0].name
                resources = {
                  requests = {
                    storage = local.elasticsearch_config.storage_size
                  }
                }
              }
            }
          ]
        },

        # Coordinating nodes (client nodes)
        {
          name  = "coordinating"
          count = local.elasticsearch_config.client_nodes
          config = {
            "node.roles" = []
            "cluster.remote.connect" = false
            "xpack.security.enabled" = true
            "xpack.monitoring.collection.enabled" = true
          }

          podTemplate = {
            metadata = {
              labels = {
                node-type = "coordinating"
              }
            }
            spec = {
              initContainers = [
                {
                  name = "sysctl"
                  securityContext = {
                    privileged = true
                    runAsUser = 0
                  }
                  image = "busybox"
                  command = ["sh", "-c", "sysctl -w vm.max_map_count=262144"]
                }
              ]
              containers = [
                {
                  name = "elasticsearch"
                  resources = {
                    requests = {
                      memory = "2Gi"
                      cpu = "500m"
                    }
                    limits = {
                      memory = "4Gi"
                      cpu = "2000m"
                    }
                  }
                  env = [
                    {
                      name = "ES_JAVA_OPTS"
                      value = "-Xms${local.elasticsearch_config.heap_size} -Xmx${local.elasticsearch_config.heap_size}"
                    }
                  ]
                }
              ]
            }
          }

          volumeClaimTemplates = [
            {
              metadata = {
                name = "elasticsearch-data"
              }
              spec = {
                accessModes = ["ReadWriteOnce"]
                storageClassName = kubernetes_storage_class.monitoring_ssd.metadata[0].name
                resources = {
                  requests = {
                    storage = "10Gi"
                  }
                }
              }
            }
          ]
        }
      ]
    }
  }

  depends_on = [
    helm_release.eck_operator,
    kubernetes_namespace.logging,
    kubernetes_storage_class.monitoring_ssd
  ]
}

# ==============================================================================
# KIBANA DEPLOYMENT
# ==============================================================================

resource "kubernetes_manifest" "kibana" {
  manifest = {
    apiVersion = "kibana.k8s.elastic.co/v1"
    kind       = "Kibana"
    metadata = {
      name      = "kibana"
      namespace = kubernetes_namespace.logging.metadata[0].name
      labels = merge(local.common_labels, {
        app = "kibana"
      })
    }
    spec = {
      version = "8.11.0"
      count   = var.high_availability ? 2 : 1
      
      elasticsearchRef = {
        name = "elasticsearch"
      }

      config = {
        "server.publicBaseUrl" = "https://kibana.${var.domain_name}"
        "server.rewriteBasePath" = false
        "logging.appenders.file.type" = "file"
        "logging.appenders.file.fileName" = "/usr/share/kibana/logs/kibana.log"
        "logging.appenders.file.layout.type" = "json"
        "logging.root.appenders" = ["default", "file"]
        "logging.root.level" = "info"
        "xpack.monitoring.ui.container.elasticsearch.enabled" = true
        "xpack.encryptedSavedObjects.encryptionKey" = random_password.kibana_encryption_key.result
        "xpack.security.encryptionKey" = random_password.kibana_security_key.result
        "xpack.reporting.encryptionKey" = random_password.kibana_reporting_key.result
        "xpack.alerting.healthCheck.interval" = "60s"
        "xpack.actions.enabled" = true
        "xpack.alerting.enabled" = true
        "elasticsearch.ssl.verificationMode" = "none"
      }

      http = {
        tls = {
          selfSignedCertificate = {
            disabled = true
          }
        }
      }

      podTemplate = {
        metadata = {
          labels = {
            app = "kibana"
          }
        }
        spec = {
          containers = [
            {
              name = "kibana"
              resources = {
                requests = {
                  memory = "1Gi"
                  cpu = "500m"
                }
                limits = {
                  memory = "2Gi"
                  cpu = "1000m"
                }
              }
            }
          ]
        }
      }
    }
  }

  depends_on = [
    kubernetes_manifest.elasticsearch_cluster
  ]
}

# ==============================================================================
# LOGSTASH DEPLOYMENT
# ==============================================================================

resource "kubernetes_config_map" "logstash_config" {
  metadata {
    name      = "logstash-config"
    namespace = kubernetes_namespace.logging.metadata[0].name
  }

  data = {
    "logstash.yml" = templatefile("${path.module}/configs/logstash.yml", {
      environment = var.environment
    })
    "pipelines.yml" = templatefile("${path.module}/configs/logstash-pipelines.yml", {
      environment = var.environment
    })
  }
}

resource "kubernetes_config_map" "logstash_pipeline" {
  metadata {
    name      = "logstash-pipeline"
    namespace = kubernetes_namespace.logging.metadata[0].name
  }

  data = {
    "logstash.conf" = templatefile("${path.module}/configs/logstash.conf", {
      environment = var.environment
      elasticsearch_hosts = "elasticsearch-es-http.${kubernetes_namespace.logging.metadata[0].name}.svc.cluster.local:9200"
    })
  }
}

resource "kubernetes_deployment" "logstash" {
  metadata {
    name      = "logstash"
    namespace = kubernetes_namespace.logging.metadata[0].name
    labels = merge(local.common_labels, {
      app = "logstash"
    })
  }

  spec {
    replicas = var.high_availability ? 2 : 1

    selector {
      match_labels = {
        app = "logstash"
      }
    }

    template {
      metadata {
        labels = {
          app = "logstash"
        }
        annotations = {
          "prometheus.io/scrape" = "true"
          "prometheus.io/port" = "9600"
          "prometheus.io/path" = "/metrics"
        }
      }

      spec {
        container {
          name  = "logstash"
          image = "docker.elastic.co/logstash/logstash:8.11.0"

          port {
            container_port = 5044
            name          = "beats"
          }

          port {
            container_port = 9600
            name          = "monitoring"
          }

          env {
            name  = "LS_JAVA_OPTS"
            value = "-Xmx2g -Xms2g"
          }

          env {
            name  = "ELASTICSEARCH_HOSTS"
            value = "http://elasticsearch-es-http.${kubernetes_namespace.logging.metadata[0].name}.svc.cluster.local:9200"
          }

          resources {
            requests = {
              cpu    = "500m"
              memory = "2Gi"
            }
            limits = {
              cpu    = "2000m"
              memory = "4Gi"
            }
          }

          volume_mount {
            name       = "logstash-config"
            mount_path = "/usr/share/logstash/config"
          }

          volume_mount {
            name       = "logstash-pipeline"
            mount_path = "/usr/share/logstash/pipeline"
          }

          liveness_probe {
            http_get {
              path = "/"
              port = 9600
            }
            initial_delay_seconds = 60
            period_seconds        = 30
          }

          readiness_probe {
            http_get {
              path = "/"
              port = 9600
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }
        }

        volume {
          name = "logstash-config"
          config_map {
            name = kubernetes_config_map.logstash_config.metadata[0].name
          }
        }

        volume {
          name = "logstash-pipeline"
          config_map {
            name = kubernetes_config_map.logstash_pipeline.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "logstash_service" {
  metadata {
    name      = "logstash"
    namespace = kubernetes_namespace.logging.metadata[0].name
    labels = merge(local.common_labels, {
      app = "logstash"
    })
  }

  spec {
    selector = {
      app = "logstash"
    }

    port {
      name        = "beats"
      port        = 5044
      target_port = 5044
      protocol    = "TCP"
    }

    port {
      name        = "monitoring"
      port        = 9600
      target_port = 9600
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }
}

# ==============================================================================
# FILEBEAT DAEMONSET
# ==============================================================================

resource "kubernetes_config_map" "filebeat_config" {
  metadata {
    name      = "filebeat-config"
    namespace = kubernetes_namespace.logging.metadata[0].name
  }

  data = {
    "filebeat.yml" = templatefile("${path.module}/configs/filebeat.yml", {
      environment = var.environment
      logstash_hosts = "logstash.${kubernetes_namespace.logging.metadata[0].name}.svc.cluster.local:5044"
      elasticsearch_hosts = "elasticsearch-es-http.${kubernetes_namespace.logging.metadata[0].name}.svc.cluster.local:9200"
    })
  }
}

resource "kubernetes_daemonset" "filebeat" {
  metadata {
    name      = "filebeat"
    namespace = kubernetes_namespace.logging.metadata[0].name
    labels = merge(local.common_labels, {
      app = "filebeat"
    })
  }

  spec {
    selector {
      match_labels = {
        app = "filebeat"
      }
    }

    template {
      metadata {
        labels = {
          app = "filebeat"
        }
      }

      spec {
        service_account_name = kubernetes_service_account.logging_sa.metadata[0].name

        host_network = true
        dns_policy   = "ClusterFirstWithHostNet"

        container {
          name  = "filebeat"
          image = "docker.elastic.co/beats/filebeat:8.11.0"

          args = [
            "-c", "/etc/filebeat.yml",
            "-e"
          ]

          env {
            name = "NODE_NAME"
            value_from {
              field_ref {
                field_path = "spec.nodeName"
              }
            }
          }

          security_context {
            run_as_user = 0
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "1000m"
              memory = "512Mi"
            }
          }

          volume_mount {
            name       = "config"
            mount_path = "/etc/filebeat.yml"
            sub_path   = "filebeat.yml"
            read_only  = true
          }

          volume_mount {
            name       = "data"
            mount_path = "/usr/share/filebeat/data"
          }

          volume_mount {
            name       = "varlibdockercontainers"
            mount_path = "/var/lib/docker/containers"
            read_only  = true
          }

          volume_mount {
            name       = "varlog"
            mount_path = "/var/log"
            read_only  = true
          }
        }

        volume {
          name = "config"
          config_map {
            name         = kubernetes_config_map.filebeat_config.metadata[0].name
            default_mode = "0640"
          }
        }

        volume {
          name = "data"
          host_path {
            path = "/var/lib/filebeat-data"
            type = "DirectoryOrCreate"
          }
        }

        volume {
          name = "varlibdockercontainers"
          host_path {
            path = "/var/lib/docker/containers"
          }
        }

        volume {
          name = "varlog"
          host_path {
            path = "/var/log"
          }
        }

        toleration {
          effect = "NoSchedule"
          key    = "node-role.kubernetes.io/master"
        }

        toleration {
          effect = "NoSchedule"
          key    = "node-role.kubernetes.io/control-plane"
        }
      }
    }
  }
}

# ==============================================================================
# LOGGING SERVICE ACCOUNT AND RBAC
# ==============================================================================

resource "kubernetes_service_account" "logging_sa" {
  metadata {
    name      = "logging-serviceaccount"
    namespace = kubernetes_namespace.logging.metadata[0].name
  }
}

resource "kubernetes_cluster_role" "logging_cluster_role" {
  metadata {
    name = "logging-cluster-role"
  }

  rule {
    api_groups = [""]
    resources  = ["namespaces", "nodes", "pods"]
    verbs      = ["get", "list", "watch"]
  }

  rule {
    api_groups = ["apps"]
    resources  = ["replicasets"]
    verbs      = ["get", "list", "watch"]
  }
}

resource "kubernetes_cluster_role_binding" "logging_cluster_role_binding" {
  metadata {
    name = "logging-cluster-role-binding"
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.logging_cluster_role.metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.logging_sa.metadata[0].name
    namespace = kubernetes_namespace.logging.metadata[0].name
  }
}

# ==============================================================================
# RANDOM PASSWORDS FOR KIBANA
# ==============================================================================

resource "random_password" "kibana_encryption_key" {
  length  = 32
  special = false
}

resource "random_password" "kibana_security_key" {
  length  = 32
  special = false
}

resource "random_password" "kibana_reporting_key" {
  length  = 32
  special = false
}

# ==============================================================================
# KIBANA INGRESS
# ==============================================================================

resource "kubernetes_ingress_v1" "kibana_ingress" {
  metadata {
    name      = "kibana-ingress"
    namespace = kubernetes_namespace.logging.metadata[0].name
    annotations = {
      "kubernetes.io/ingress.class"              = "nginx"
      "cert-manager.io/cluster-issuer"           = "letsencrypt-prod"
      "nginx.ingress.kubernetes.io/ssl-redirect" = "true"
      "nginx.ingress.kubernetes.io/auth-type"    = "basic"
      "nginx.ingress.kubernetes.io/auth-secret"  = "monitoring-auth"
      "nginx.ingress.kubernetes.io/auth-realm"   = "Authentication Required"
    }
  }

  spec {
    tls {
      hosts       = ["kibana.${var.domain_name}"]
      secret_name = "kibana-tls"
    }

    rule {
      host = "kibana.${var.domain_name}"
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = "kibana-kb-http"
              port {
                number = 5601
              }
            }
          }
        }
      }
    }
  }
}

# ==============================================================================
# OUTPUTS
# ==============================================================================

output "elasticsearch_cluster_name" {
  description = "Elasticsearch cluster name"
  value       = "elasticsearch"
}

output "elasticsearch_url" {
  description = "Elasticsearch URL"
  value       = "http://elasticsearch-es-http.${kubernetes_namespace.logging.metadata[0].name}.svc.cluster.local:9200"
}

output "kibana_url" {
  description = "Kibana URL"
  value       = "https://kibana.${var.domain_name}"
}

output "logstash_endpoint" {
  description = "Logstash endpoint"
  value       = "logstash.${kubernetes_namespace.logging.metadata[0].name}.svc.cluster.local:5044"
}

output "logging_namespace" {
  description = "Logging namespace"
  value       = kubernetes_namespace.logging.metadata[0].name
}