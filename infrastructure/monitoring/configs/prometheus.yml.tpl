# ==============================================================================
# PROMETHEUS CONFIGURATION TEMPLATE
# Multi-Cloud Service Discovery and Monitoring
# ==============================================================================

global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: "${cluster_name}"
    environment: "${environment}"
    region: "${region}"

# Alertmanager configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - "alertmanager:9093"
      scheme: http
      timeout: 10s
      api_version: v1

# Rules files
rule_files:
  - "/etc/prometheus/rules/*.yml"

# Scrape configurations
scrape_configs:
  # Prometheus itself
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 15s
    metrics_path: /metrics

  # Kubernetes API server
  - job_name: 'kubernetes-apiservers'
    kubernetes_sd_configs:
      - role: endpoints
    scheme: https
    tls_config:
      ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
    bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
    relabel_configs:
      - source_labels: [__meta_kubernetes_namespace, __meta_kubernetes_service_name, __meta_kubernetes_endpoint_port_name]
        action: keep
        regex: default;kubernetes;https

  # Kubernetes nodes
  - job_name: 'kubernetes-nodes'
    kubernetes_sd_configs:
      - role: node
    scheme: https
    tls_config:
      ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
    bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
    relabel_configs:
      - action: labelmap
        regex: __meta_kubernetes_node_label_(.+)
      - target_label: __address__
        replacement: kubernetes.default.svc:443
      - source_labels: [__meta_kubernetes_node_name]
        regex: (.+)
        target_label: __metrics_path__
        replacement: /api/v1/nodes/$${1}/proxy/metrics

  # Kubernetes node exporter
  - job_name: 'kubernetes-node-exporter'
    kubernetes_sd_configs:
      - role: endpoints
    relabel_configs:
      - source_labels: [__meta_kubernetes_service_name]
        action: keep
        regex: node-exporter
      - source_labels: [__meta_kubernetes_endpoint_port_name]
        action: keep
        regex: metrics

  # Kubernetes pods
  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
        target_label: __address__
      - action: labelmap
        regex: __meta_kubernetes_pod_label_(.+)
      - source_labels: [__meta_kubernetes_namespace]
        action: replace
        target_label: kubernetes_namespace
      - source_labels: [__meta_kubernetes_pod_name]
        action: replace
        target_label: kubernetes_pod_name

  # Kubernetes services
  - job_name: 'kubernetes-services'
    kubernetes_sd_configs:
      - role: service
    metrics_path: /probe
    params:
      module: [http_2xx]
    relabel_configs:
      - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_probe]
        action: keep
        regex: true
      - source_labels: [__address__]
        target_label: __param_target
      - target_label: __address__
        replacement: blackbox-exporter:9115
      - source_labels: [__param_target]
        target_label: instance
      - action: labelmap
        regex: __meta_kubernetes_service_label_(.+)
      - source_labels: [__meta_kubernetes_namespace]
        target_label: kubernetes_namespace
      - source_labels: [__meta_kubernetes_service_name]
        target_label: kubernetes_name

  # Kubernetes ingresses
  - job_name: 'kubernetes-ingresses'
    kubernetes_sd_configs:
      - role: ingress
    relabel_configs:
      - source_labels: [__meta_kubernetes_ingress_annotation_prometheus_io_probe]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_ingress_scheme,__address__,__meta_kubernetes_ingress_path]
        regex: (.+);(.+);(.+)
        replacement: $${1}://$${2}$${3}
        target_label: __param_target
      - target_label: __address__
        replacement: blackbox-exporter:9115
      - source_labels: [__param_target]
        target_label: instance
      - action: labelmap
        regex: __meta_kubernetes_ingress_label_(.+)
      - source_labels: [__meta_kubernetes_namespace]
        target_label: kubernetes_namespace
      - source_labels: [__meta_kubernetes_ingress_name]
        target_label: kubernetes_name

  # Learning Assistant Application
  - job_name: 'learning-assistant'
    kubernetes_sd_configs:
      - role: endpoints
    relabel_configs:
      - source_labels: [__meta_kubernetes_service_name]
        action: keep
        regex: learning-assistant.*
      - source_labels: [__meta_kubernetes_endpoint_port_name]
        action: keep
        regex: metrics
      - action: labelmap
        regex: __meta_kubernetes_service_label_(.+)
      - source_labels: [__meta_kubernetes_namespace]
        target_label: kubernetes_namespace
      - source_labels: [__meta_kubernetes_service_name]
        target_label: kubernetes_name

  # Node Exporter
  - job_name: 'node-exporter'
    kubernetes_sd_configs:
      - role: endpoints
    relabel_configs:
      - source_labels: [__meta_kubernetes_service_name]
        action: keep
        regex: node-exporter
      - source_labels: [__meta_kubernetes_endpoint_port_name]
        action: keep
        regex: metrics

  # Cadvisor
  - job_name: 'cadvisor'
    kubernetes_sd_configs:
      - role: node
    scheme: https
    tls_config:
      ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
    bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
    relabel_configs:
      - action: labelmap
        regex: __meta_kubernetes_node_label_(.+)
      - target_label: __address__
        replacement: kubernetes.default.svc:443
      - source_labels: [__meta_kubernetes_node_name]
        regex: (.+)
        target_label: __metrics_path__
        replacement: /api/v1/nodes/$${1}/proxy/metrics/cadvisor

  # Kube State Metrics
  - job_name: 'kube-state-metrics'
    kubernetes_sd_configs:
      - role: endpoints
    relabel_configs:
      - source_labels: [__meta_kubernetes_service_name]
        action: keep
        regex: kube-state-metrics
      - source_labels: [__meta_kubernetes_endpoint_port_name]
        action: keep
        regex: http-metrics

  # Alertmanager
  - job_name: 'alertmanager'
    kubernetes_sd_configs:
      - role: endpoints
    relabel_configs:
      - source_labels: [__meta_kubernetes_service_name]
        action: keep
        regex: alertmanager.*
      - source_labels: [__meta_kubernetes_endpoint_port_name]
        action: keep
        regex: web

  # Grafana
  - job_name: 'grafana'
    kubernetes_sd_configs:
      - role: endpoints
    relabel_configs:
      - source_labels: [__meta_kubernetes_service_name]
        action: keep
        regex: grafana
      - source_labels: [__meta_kubernetes_endpoint_port_name]
        action: keep
        regex: service

  # Jaeger
  - job_name: 'jaeger'
    kubernetes_sd_configs:
      - role: endpoints
    relabel_configs:
      - source_labels: [__meta_kubernetes_service_name]
        action: keep
        regex: jaeger.*
      - source_labels: [__meta_kubernetes_endpoint_port_name]
        action: keep
        regex: admin-http

  # Elasticsearch
  - job_name: 'elasticsearch'
    kubernetes_sd_configs:
      - role: endpoints
    relabel_configs:
      - source_labels: [__meta_kubernetes_service_name]
        action: keep
        regex: elasticsearch.*
      - source_labels: [__meta_kubernetes_endpoint_port_name]
        action: keep
        regex: http

  # Logstash
  - job_name: 'logstash'
    kubernetes_sd_configs:
      - role: endpoints
    relabel_configs:
      - source_labels: [__meta_kubernetes_service_name]
        action: keep
        regex: logstash.*
      - source_labels: [__meta_kubernetes_endpoint_port_name]
        action: keep
        regex: monitoring

  # Kibana
  - job_name: 'kibana'
    kubernetes_sd_configs:
      - role: endpoints
    relabel_configs:
      - source_labels: [__meta_kubernetes_service_name]
        action: keep
        regex: kibana
      - source_labels: [__meta_kubernetes_endpoint_port_name]
        action: keep
        regex: http

  # Blackbox Exporter for synthetic monitoring
  - job_name: 'blackbox-exporter'
    kubernetes_sd_configs:
      - role: endpoints
    relabel_configs:
      - source_labels: [__meta_kubernetes_service_name]
        action: keep
        regex: blackbox-exporter
      - source_labels: [__meta_kubernetes_endpoint_port_name]
        action: keep
        regex: http

  # Database monitoring (PostgreSQL)
  - job_name: 'postgres-exporter'
    kubernetes_sd_configs:
      - role: endpoints
    relabel_configs:
      - source_labels: [__meta_kubernetes_service_name]
        action: keep
        regex: postgres-exporter
      - source_labels: [__meta_kubernetes_endpoint_port_name]
        action: keep
        regex: metrics

  # Redis monitoring
  - job_name: 'redis-exporter'
    kubernetes_sd_configs:
      - role: endpoints
    relabel_configs:
      - source_labels: [__meta_kubernetes_service_name]
        action: keep
        regex: redis-exporter
      - source_labels: [__meta_kubernetes_endpoint_port_name]
        action: keep
        regex: metrics

  # Cloud provider specific metrics
  %{ if enable_gcp_monitoring ~}
  - job_name: 'gcp-monitoring'
    gce_sd_configs:
      - project: ${gcp_project_id}
        zone: ${gcp_zone}
        port: 9090
    relabel_configs:
      - source_labels: [__meta_gce_instance_name]
        target_label: instance
      - source_labels: [__meta_gce_zone]
        target_label: zone
      - source_labels: [__meta_gce_project]
        target_label: project
  %{ endif ~}

  %{ if enable_aws_monitoring ~}
  - job_name: 'aws-monitoring'
    ec2_sd_configs:
      - region: ${aws_region}
        port: 9090
    relabel_configs:
      - source_labels: [__meta_ec2_instance_id]
        target_label: instance
      - source_labels: [__meta_ec2_availability_zone]
        target_label: zone
      - source_labels: [__meta_ec2_tag_Name]
        target_label: name
  %{ endif ~}

  %{ if enable_azure_monitoring ~}
  - job_name: 'azure-monitoring'
    azure_sd_configs:
      - subscription_id: ${azure_subscription_id}
        tenant_id: ${azure_tenant_id}
        client_id: ${azure_client_id}
        client_secret: ${azure_client_secret}
        resource_group: ${azure_resource_group}
        port: 9090
    relabel_configs:
      - source_labels: [__meta_azure_machine_name]
        target_label: instance
      - source_labels: [__meta_azure_machine_location]
        target_label: region
      - source_labels: [__meta_azure_machine_resource_group]
        target_label: resource_group
  %{ endif ~}

# Remote write configuration for long-term storage
remote_write:
  - url: "http://victoria-metrics:8428/api/v1/write"
    queue_config:
      max_samples_per_send: 1000
      max_shards: 200
      capacity: 2500

# Remote read configuration
remote_read:
  - url: "http://victoria-metrics:8428/api/v1/read"
    read_recent: true