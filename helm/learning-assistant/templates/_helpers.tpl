{{/*
Expand the name of the chart.
*/}}
{{- define "learning-assistant.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "learning-assistant.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "learning-assistant.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "learning-assistant.labels" -}}
helm.sh/chart: {{ include "learning-assistant.chart" . }}
{{ include "learning-assistant.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: learning-platform
environment: {{ .Values.global.environment }}
{{- with .Values.labels }}
{{ toYaml . }}
{{- end }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "learning-assistant.selectorLabels" -}}
app.kubernetes.io/name: {{ include "learning-assistant.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "learning-assistant.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "learning-assistant.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create the name of the PostgreSQL service account to use
*/}}
{{- define "learning-assistant.postgresServiceAccountName" -}}
{{- printf "%s-postgres-sa" (include "learning-assistant.fullname" .) }}
{{- end }}

{{/*
Create the name of the Redis service account to use
*/}}
{{- define "learning-assistant.redisServiceAccountName" -}}
{{- printf "%s-redis-sa" (include "learning-assistant.fullname" .) }}
{{- end }}

{{/*
Generate the PostgreSQL connection URL
*/}}
{{- define "learning-assistant.postgresqlURL" -}}
{{- if .Values.postgresql.enabled }}
{{- printf "postgresql://%s:%s@%s-postgresql:%d/%s" .Values.postgresql.auth.username "$(DATABASE_PASSWORD)" .Release.Name (.Values.postgresql.primary.service.ports.postgresql | default 5432) .Values.postgresql.auth.database }}
{{- else }}
{{- .Values.externalDatabase.url }}
{{- end }}
{{- end }}

{{/*
Generate the Redis connection URL
*/}}
{{- define "learning-assistant.redisURL" -}}
{{- if .Values.redis.enabled }}
{{- if .Values.redis.auth.enabled }}
{{- printf "redis://:%s@%s-redis-master:6379" "$(REDIS_PASSWORD)" .Release.Name }}
{{- else }}
{{- printf "redis://%s-redis-master:6379" .Release.Name }}
{{- end }}
{{- else }}
{{- .Values.externalRedis.url }}
{{- end }}
{{- end }}

{{/*
Generate security context
*/}}
{{- define "learning-assistant.securityContext" -}}
{{- with .Values.security.securityContext }}
{{ toYaml . }}
{{- end }}
{{- end }}

{{/*
Generate container security context
*/}}
{{- define "learning-assistant.containerSecurityContext" -}}
{{- with .Values.security.containerSecurityContext }}
{{ toYaml . }}
{{- end }}
{{- end }}

{{/*
Generate image pull secrets
*/}}
{{- define "learning-assistant.imagePullSecrets" -}}
{{- if .Values.global.imagePullSecrets }}
imagePullSecrets:
{{- range .Values.global.imagePullSecrets }}
  - name: {{ . }}
{{- end }}
{{- else if .Values.imagePullSecrets }}
imagePullSecrets:
{{- range .Values.imagePullSecrets }}
  - name: {{ . }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Generate resource requirements
*/}}
{{- define "learning-assistant.resources" -}}
{{- with .Values.app.resources }}
resources:
{{ toYaml . | indent 2 }}
{{- end }}
{{- end }}

{{/*
Generate nginx resource requirements
*/}}
{{- define "learning-assistant.nginxResources" -}}
{{- with .Values.nginx.resources }}
resources:
{{ toYaml . | indent 2 }}
{{- end }}
{{- end }}

{{/*
Generate liveness probe
*/}}
{{- define "learning-assistant.livenessProbe" -}}
{{- with .Values.app.livenessProbe }}
livenessProbe:
{{ toYaml . | indent 2 }}
{{- end }}
{{- end }}

{{/*
Generate readiness probe
*/}}
{{- define "learning-assistant.readinessProbe" -}}
{{- with .Values.app.readinessProbe }}
readinessProbe:
{{ toYaml . | indent 2 }}
{{- end }}
{{- end }}

{{/*
Generate startup probe
*/}}
{{- define "learning-assistant.startupProbe" -}}
{{- with .Values.app.startupProbe }}
startupProbe:
{{ toYaml . | indent 2 }}
{{- end }}
{{- end }}

{{/*
Generate node affinity
*/}}
{{- define "learning-assistant.nodeAffinity" -}}
{{- if .Values.nodeAffinity.enabled }}
nodeAffinity:
{{ toYaml .Values.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution | indent 2 }}
{{- end }}
{{- end }}

{{/*
Generate pod anti-affinity
*/}}
{{- define "learning-assistant.podAntiAffinity" -}}
{{- if .Values.podAntiAffinity.enabled }}
podAntiAffinity:
{{ toYaml .Values.podAntiAffinity.preferredDuringSchedulingIgnoredDuringExecution | indent 2 }}
{{- end }}
{{- end }}

{{/*
Generate affinity
*/}}
{{- define "learning-assistant.affinity" -}}
{{- if or .Values.nodeAffinity.enabled .Values.podAntiAffinity.enabled }}
affinity:
{{ include "learning-assistant.nodeAffinity" . | indent 2 }}
{{ include "learning-assistant.podAntiAffinity" . | indent 2 }}
{{- end }}
{{- end }}

{{/*
Generate tolerations
*/}}
{{- define "learning-assistant.tolerations" -}}
{{- with .Values.tolerations }}
tolerations:
{{ toYaml . }}
{{- end }}
{{- end }}

{{/*
Generate node selector
*/}}
{{- define "learning-assistant.nodeSelector" -}}
{{- with .Values.nodeSelector }}
nodeSelector:
{{ toYaml . }}
{{- end }}
{{- end }}

{{/*
Generate pod annotations
*/}}
{{- define "learning-assistant.podAnnotations" -}}
{{- with .Values.podAnnotations }}
{{ toYaml . }}
{{- end }}
{{- with .Values.annotations }}
{{ toYaml . }}
{{- end }}
{{- end }}

{{/*
Generate pod labels
*/}}
{{- define "learning-assistant.podLabels" -}}
{{ include "learning-assistant.selectorLabels" . }}
version: v1
component: backend
{{- with .Values.podLabels }}
{{ toYaml . }}
{{- end }}
{{- end }}

{{/*
Generate environment variables
*/}}
{{- define "learning-assistant.env" -}}
- name: NODE_ENV
  value: {{ .Values.app.env.NODE_ENV | quote }}
- name: PORT
  value: {{ .Values.app.env.PORT | quote }}
- name: NEXT_TELEMETRY_DISABLED
  value: {{ .Values.app.env.NEXT_TELEMETRY_DISABLED | quote }}
- name: LOG_LEVEL
  value: {{ .Values.app.env.LOG_LEVEL | quote }}
- name: CACHE_TTL
  value: {{ .Values.app.env.CACHE_TTL | quote }}
- name: SESSION_TIMEOUT
  value: {{ .Values.app.env.SESSION_TIMEOUT | quote }}
- name: MAX_UPLOAD_SIZE
  value: {{ .Values.app.env.MAX_UPLOAD_SIZE | quote }}
- name: RATE_LIMIT_WINDOW
  value: {{ .Values.app.env.RATE_LIMIT_WINDOW | quote }}
- name: RATE_LIMIT_MAX
  value: {{ .Values.app.env.RATE_LIMIT_MAX | quote }}
- name: FEATURES_ENABLED
  value: {{ .Values.app.env.FEATURES_ENABLED | quote }}
- name: PAGINATION_DEFAULT_SIZE
  value: {{ .Values.app.env.PAGINATION_DEFAULT_SIZE | quote }}
- name: PAGINATION_MAX_SIZE
  value: {{ .Values.app.env.PAGINATION_MAX_SIZE | quote }}
- name: POD_NAME
  valueFrom:
    fieldRef:
      fieldPath: metadata.name
- name: POD_NAMESPACE
  valueFrom:
    fieldRef:
      fieldPath: metadata.namespace
- name: POD_IP
  valueFrom:
    fieldRef:
      fieldPath: status.podIP
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: {{ include "learning-assistant.fullname" . }}-secrets
      key: DATABASE_URL
- name: DATABASE_PASSWORD
  valueFrom:
    secretKeyRef:
      {{- if .Values.postgresql.enabled }}
      name: {{ .Release.Name }}-postgresql
      key: {{ .Values.postgresql.auth.secretKeys.adminPasswordKey }}
      {{- else }}
      name: {{ include "learning-assistant.fullname" . }}-secrets
      key: DATABASE_PASSWORD
      {{- end }}
- name: REDIS_URL
  valueFrom:
    secretKeyRef:
      name: {{ include "learning-assistant.fullname" . }}-secrets
      key: REDIS_URL
{{- if .Values.redis.auth.enabled }}
- name: REDIS_PASSWORD
  valueFrom:
    secretKeyRef:
      {{- if .Values.redis.enabled }}
      name: {{ .Release.Name }}-redis
      key: {{ .Values.redis.auth.existingSecretPasswordKey }}
      {{- else }}
      name: {{ include "learning-assistant.fullname" . }}-secrets
      key: REDIS_PASSWORD
      {{- end }}
{{- end }}
- name: JWT_SECRET
  valueFrom:
    secretKeyRef:
      name: {{ include "learning-assistant.fullname" . }}-secrets
      key: JWT_SECRET
- name: NEXTAUTH_SECRET
  valueFrom:
    secretKeyRef:
      name: {{ include "learning-assistant.fullname" . }}-secrets
      key: NEXTAUTH_SECRET
- name: NEXTAUTH_URL
  value: "https://{{ .Values.global.domain }}"
{{- end }}

{{/*
Generate volume mounts
*/}}
{{- define "learning-assistant.volumeMounts" -}}
{{- if .Values.volumes.tmp.enabled }}
- name: tmp
  mountPath: /tmp
{{- end }}
{{- if .Values.volumes.logs.enabled }}
- name: app-logs
  mountPath: /app/logs
{{- end }}
{{- if .Values.volumes.cache.enabled }}
- name: cache-volume
  mountPath: /app/.next/cache
{{- end }}
{{- end }}

{{/*
Generate volumes
*/}}
{{- define "learning-assistant.volumes" -}}
{{- if .Values.volumes.tmp.enabled }}
- name: tmp
  emptyDir:
    sizeLimit: {{ .Values.volumes.tmp.sizeLimit }}
{{- end }}
{{- if .Values.volumes.logs.enabled }}
- name: app-logs
  emptyDir:
    sizeLimit: {{ .Values.volumes.logs.sizeLimit }}
{{- end }}
{{- if .Values.volumes.cache.enabled }}
- name: cache-volume
  emptyDir:
    sizeLimit: {{ .Values.volumes.cache.sizeLimit }}
{{- end }}
{{- if .Values.nginx.enabled }}
- name: nginx-config
  configMap:
    name: {{ include "learning-assistant.fullname" . }}-nginx-config
- name: nginx-cache
  emptyDir: {}
{{- end }}
{{- end }}

{{/*
Generate nginx volume mounts
*/}}
{{- define "learning-assistant.nginxVolumeMounts" -}}
{{- if .Values.nginx.enabled }}
- name: nginx-config
  mountPath: /etc/nginx/nginx.conf
  subPath: nginx.conf
- name: tmp
  mountPath: /tmp
- name: nginx-cache
  mountPath: /var/cache/nginx
{{- end }}
{{- end }}

{{/*
Generate deployment strategy
*/}}
{{- define "learning-assistant.strategy" -}}
{{- with .Values.strategy }}
strategy:
{{ toYaml . | indent 2 }}
{{- end }}
{{- end }}

{{/*
Generate monitoring annotations
*/}}
{{- define "learning-assistant.monitoringAnnotations" -}}
{{- if .Values.monitoring.enabled }}
prometheus.io/scrape: "true"
prometheus.io/port: "3000"
prometheus.io/path: "/api/metrics"
{{- end }}
{{- end }}

{{/*
Generate TLS configuration for ingress
*/}}
{{- define "learning-assistant.ingressTLS" -}}
{{- if .Values.tls.enabled }}
tls:
{{- range .Values.ingress.tls }}
  - secretName: {{ .secretName }}
    hosts:
    {{- range .hosts }}
      - {{ . }}
    {{- end }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Generate certificate issuer annotation
*/}}
{{- define "learning-assistant.certManagerAnnotation" -}}
{{- if and .Values.tls.enabled .Values.tls.certManager.enabled }}
cert-manager.io/cluster-issuer: {{ .Values.tls.certManager.issuer }}
{{- end }}
{{- end }}