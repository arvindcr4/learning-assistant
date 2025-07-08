# ==============================================================================
# ALERTMANAGER CONFIGURATION
# Multi-Channel Alerting and Incident Management
# ==============================================================================

global:
  # SMTP configuration
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: '${notification_email}'
  smtp_auth_username: '${notification_email}'
  smtp_auth_password: '$SMTP_PASSWORD'
  smtp_require_tls: true

  # Slack configuration
  slack_api_url: '${slack_webhook_url}'

  # HTTP configuration
  http_config:
    follow_redirects: true
    enable_http2: true

  # Resolve timeout
  resolve_timeout: 5m

# Templates
templates:
  - '/etc/alertmanager/templates/*.tmpl'

# Route configuration
route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'default'
  routes:
    # Critical alerts
    - match:
        severity: critical
      receiver: 'critical-alerts'
      group_wait: 10s
      group_interval: 5m
      repeat_interval: 5m
      routes:
        # Infrastructure critical alerts
        - match:
            category: infrastructure
          receiver: 'infrastructure-critical'
          group_wait: 5s
          repeat_interval: 2m
        
        # Application critical alerts
        - match:
            category: application
          receiver: 'application-critical'
          group_wait: 10s
          repeat_interval: 5m
        
        # Security critical alerts
        - match:
            category: security
          receiver: 'security-critical'
          group_wait: 5s
          repeat_interval: 1m

    # High severity alerts
    - match:
        severity: high
      receiver: 'high-severity-alerts'
      group_wait: 30s
      group_interval: 5m
      repeat_interval: 30m

    # Warning alerts
    - match:
        severity: warning
      receiver: 'warning-alerts'
      group_wait: 5m
      group_interval: 10m
      repeat_interval: 2h

    # Info alerts
    - match:
        severity: info
      receiver: 'info-alerts'
      group_wait: 10m
      group_interval: 30m
      repeat_interval: 6h

    # Learning Assistant specific routes
    - match:
        service: learning-assistant
      receiver: 'learning-assistant-alerts'
      routes:
        - match:
            alertname: LearningAssistantDown
          receiver: 'learning-assistant-critical'
        - match:
            alertname: HighErrorRate
          receiver: 'learning-assistant-errors'
        - match:
            alertname: SlowResponse
          receiver: 'learning-assistant-performance'

    # Database alerts
    - match:
        component: database
      receiver: 'database-alerts'
      routes:
        - match:
            severity: critical
          receiver: 'database-critical'

    # Kubernetes alerts
    - match:
        component: kubernetes
      receiver: 'kubernetes-alerts'

    # Cost optimization alerts
    - match:
        category: cost
      receiver: 'cost-alerts'
      group_wait: 1h
      repeat_interval: 24h

    # Capacity planning alerts
    - match:
        category: capacity
      receiver: 'capacity-alerts'
      group_wait: 30m
      repeat_interval: 6h

    # Dead man's switch
    - match:
        alertname: Watchdog
      receiver: 'null'

    # Inhibitor rules
    - match:
        alertname: InfoInhibitor
      receiver: 'null'

# Inhibit rules
inhibit_rules:
  # Inhibit info alerts when critical alerts are firing
  - source_match:
      severity: critical
    target_match:
      severity: info
    equal: ['alertname', 'cluster', 'service']

  # Inhibit warning alerts when critical alerts are firing
  - source_match:
      severity: critical
    target_match:
      severity: warning
    equal: ['alertname', 'cluster', 'service']

  # Inhibit warning alerts when high severity alerts are firing
  - source_match:
      severity: high
    target_match:
      severity: warning
    equal: ['alertname', 'cluster', 'service']

  # Inhibit node alerts when cluster is down
  - source_match:
      alertname: KubernetesClusterDown
    target_match_re:
      alertname: (KubernetesNode.*|Node.*)
    equal: ['cluster']

  # Inhibit pod alerts when node is down
  - source_match_re:
      alertname: (KubernetesNode.*Down|NodeDown)
    target_match_re:
      alertname: (KubernetesPod.*|Pod.*)
    equal: ['cluster', 'node']

# Receivers
receivers:
  # Null receiver for silenced alerts
  - name: 'null'

  # Default receiver
  - name: 'default'
    email_configs:
      - to: '${notification_email}'
        from: '${notification_email}'
        subject: '[{{ .Status | toUpper }}] {{ .GroupLabels.alertname }} - ${environment}'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          
          Labels:
          {{ range .Labels.SortedPairs }}  {{ .Name }}: {{ .Value }}
          {{ end }}
          
          {{ if .GeneratorURL }}
          Source: {{ .GeneratorURL }}
          {{ end }}
          {{ end }}
        headers:
          X-Environment: '${environment}'
          X-Cluster: '${cluster_name}'

    slack_configs:
      - api_url: '${slack_webhook_url}'
        channel: '#alerts-${environment}'
        title: '{{ .Status | title }} Alert: {{ .GroupLabels.alertname }}'
        text: |
          {{ range .Alerts }}
          *Alert:* {{ .Annotations.summary }}
          *Environment:* ${environment}
          *Cluster:* ${cluster_name}
          *Severity:* {{ .Labels.severity }}
          {{ if .Annotations.description }}*Description:* {{ .Annotations.description }}{{ end }}
          {{ if .Annotations.runbook_url }}*Runbook:* {{ .Annotations.runbook_url }}{{ end }}
          {{ end }}
        color: '{{ if eq .Status "firing" }}danger{{ else }}good{{ end }}'
        send_resolved: true

  # Critical alerts receiver
  - name: 'critical-alerts'
    email_configs:
      - to: '${notification_email}'
        from: '${notification_email}'
        subject: '🚨 [CRITICAL] {{ .GroupLabels.alertname }} - ${environment}'
        body: |
          CRITICAL ALERT FIRED!
          
          Environment: ${environment}
          Cluster: ${cluster_name}
          
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          Severity: {{ .Labels.severity }}
          
          Labels:
          {{ range .Labels.SortedPairs }}  {{ .Name }}: {{ .Value }}
          {{ end }}
          
          {{ if .Annotations.runbook_url }}
          Runbook: {{ .Annotations.runbook_url }}
          {{ end }}
          
          {{ if .GeneratorURL }}
          Source: {{ .GeneratorURL }}
          {{ end }}
          {{ end }}
        headers:
          X-Priority: '1'
          Importance: 'high'
          X-Environment: '${environment}'
          X-Cluster: '${cluster_name}'

    slack_configs:
      - api_url: '${slack_webhook_url}'
        channel: '#critical-alerts'
        title: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
        text: |
          <!channel> CRITICAL ALERT FIRED!
          
          {{ range .Alerts }}
          *Alert:* {{ .Annotations.summary }}
          *Environment:* ${environment}
          *Cluster:* ${cluster_name}
          *Severity:* {{ .Labels.severity }}
          {{ if .Annotations.description }}*Description:* {{ .Annotations.description }}{{ end }}
          {{ if .Annotations.runbook_url }}*Runbook:* <{{ .Annotations.runbook_url }}|Click here>{{ end }}
          {{ end }}
        color: 'danger'
        send_resolved: true

    pagerduty_configs:
      - routing_key: '${pagerduty_integration_key}'
        description: '{{ .GroupLabels.alertname }} - ${environment}'
        severity: 'critical'
        client: 'AlertManager'
        client_url: 'https://alertmanager.${domain_name}'
        details:
          environment: '${environment}'
          cluster: '${cluster_name}'
          summary: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'

  # Infrastructure critical alerts
  - name: 'infrastructure-critical'
    email_configs:
      - to: '${notification_email}'
        from: '${notification_email}'
        subject: '🔥 [INFRASTRUCTURE CRITICAL] {{ .GroupLabels.alertname }} - ${environment}'
        body: |
          INFRASTRUCTURE CRITICAL ALERT!
          
          This alert indicates a critical infrastructure problem that requires immediate attention.
          
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          {{ end }}

    slack_configs:
      - api_url: '${slack_webhook_url}'
        channel: '#infrastructure-alerts'
        title: '🔥 INFRASTRUCTURE CRITICAL: {{ .GroupLabels.alertname }}'
        text: |
          <!channel> INFRASTRUCTURE CRITICAL ALERT!
          
          {{ range .Alerts }}*{{ .Annotations.summary }}*{{ end }}
        color: 'danger'

    pagerduty_configs:
      - routing_key: '${pagerduty_integration_key}'
        description: 'Infrastructure Critical: {{ .GroupLabels.alertname }}'
        severity: 'critical'

  # Application critical alerts
  - name: 'application-critical'
    email_configs:
      - to: '${notification_email}'
        subject: '🚨 [APP CRITICAL] {{ .GroupLabels.alertname }} - ${environment}'

    slack_configs:
      - api_url: '${slack_webhook_url}'
        channel: '#app-alerts'
        title: '🚨 APP CRITICAL: {{ .GroupLabels.alertname }}'
        color: 'danger'

  # Security critical alerts
  - name: 'security-critical'
    email_configs:
      - to: '${notification_email}'
        subject: '🛡️ [SECURITY CRITICAL] {{ .GroupLabels.alertname }} - ${environment}'

    slack_configs:
      - api_url: '${slack_webhook_url}'
        channel: '#security-alerts'
        title: '🛡️ SECURITY CRITICAL: {{ .GroupLabels.alertname }}'
        color: 'danger'

    pagerduty_configs:
      - routing_key: '${pagerduty_integration_key}'
        description: 'Security Critical: {{ .GroupLabels.alertname }}'
        severity: 'critical'

  # High severity alerts
  - name: 'high-severity-alerts'
    email_configs:
      - to: '${notification_email}'
        subject: '⚠️ [HIGH] {{ .GroupLabels.alertname }} - ${environment}'

    slack_configs:
      - api_url: '${slack_webhook_url}'
        channel: '#alerts-${environment}'
        title: '⚠️ HIGH: {{ .GroupLabels.alertname }}'
        color: 'warning'

  # Warning alerts
  - name: 'warning-alerts'
    slack_configs:
      - api_url: '${slack_webhook_url}'
        channel: '#alerts-${environment}'
        title: '⚠️ Warning: {{ .GroupLabels.alertname }}'
        color: 'warning'

  # Info alerts
  - name: 'info-alerts'
    slack_configs:
      - api_url: '${slack_webhook_url}'
        channel: '#info-alerts'
        title: 'ℹ️ Info: {{ .GroupLabels.alertname }}'
        color: 'good'

  # Learning Assistant specific alerts
  - name: 'learning-assistant-alerts'
    email_configs:
      - to: '${notification_email}'
        subject: '[Learning Assistant] {{ .GroupLabels.alertname }} - ${environment}'

    slack_configs:
      - api_url: '${slack_webhook_url}'
        channel: '#learning-assistant-alerts'
        title: '📚 Learning Assistant: {{ .GroupLabels.alertname }}'

  - name: 'learning-assistant-critical'
    email_configs:
      - to: '${notification_email}'
        subject: '🚨 [Learning Assistant CRITICAL] {{ .GroupLabels.alertname }} - ${environment}'

    slack_configs:
      - api_url: '${slack_webhook_url}'
        channel: '#learning-assistant-alerts'
        title: '🚨 Learning Assistant CRITICAL: {{ .GroupLabels.alertname }}'
        color: 'danger'

    pagerduty_configs:
      - routing_key: '${pagerduty_integration_key}'
        description: 'Learning Assistant Critical: {{ .GroupLabels.alertname }}'
        severity: 'critical'

  - name: 'learning-assistant-errors'
    slack_configs:
      - api_url: '${slack_webhook_url}'
        channel: '#learning-assistant-alerts'
        title: '🔥 Learning Assistant Errors: {{ .GroupLabels.alertname }}'
        color: 'warning'

  - name: 'learning-assistant-performance'
    slack_configs:
      - api_url: '${slack_webhook_url}'
        channel: '#learning-assistant-alerts'
        title: '⏱️ Learning Assistant Performance: {{ .GroupLabels.alertname }}'
        color: 'warning'

  # Database alerts
  - name: 'database-alerts'
    email_configs:
      - to: '${notification_email}'
        subject: '[Database] {{ .GroupLabels.alertname }} - ${environment}'

    slack_configs:
      - api_url: '${slack_webhook_url}'
        channel: '#database-alerts'
        title: '🗃️ Database: {{ .GroupLabels.alertname }}'

  - name: 'database-critical'
    email_configs:
      - to: '${notification_email}'
        subject: '🚨 [Database CRITICAL] {{ .GroupLabels.alertname }} - ${environment}'

    slack_configs:
      - api_url: '${slack_webhook_url}'
        channel: '#database-alerts'
        title: '🚨 Database CRITICAL: {{ .GroupLabels.alertname }}'
        color: 'danger'

    pagerduty_configs:
      - routing_key: '${pagerduty_integration_key}'
        description: 'Database Critical: {{ .GroupLabels.alertname }}'
        severity: 'critical'

  # Kubernetes alerts
  - name: 'kubernetes-alerts'
    slack_configs:
      - api_url: '${slack_webhook_url}'
        channel: '#kubernetes-alerts'
        title: '☸️ Kubernetes: {{ .GroupLabels.alertname }}'

  # Cost alerts
  - name: 'cost-alerts'
    email_configs:
      - to: '${notification_email}'
        subject: '[Cost Alert] {{ .GroupLabels.alertname }} - ${environment}'

    slack_configs:
      - api_url: '${slack_webhook_url}'
        channel: '#cost-optimization'
        title: '💰 Cost Alert: {{ .GroupLabels.alertname }}'
        color: 'warning'

  # Capacity alerts
  - name: 'capacity-alerts'
    email_configs:
      - to: '${notification_email}'
        subject: '[Capacity Alert] {{ .GroupLabels.alertname }} - ${environment}'

    slack_configs:
      - api_url: '${slack_webhook_url}'
        channel: '#capacity-planning'
        title: '📊 Capacity Alert: {{ .GroupLabels.alertname }}'
        color: 'warning'