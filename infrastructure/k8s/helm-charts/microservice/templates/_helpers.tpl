{{/*
Expand the name of the chart.
*/}}
{{- define "microservice.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "microservice.fullname" -}}
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
{{- define "microservice.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "microservice.labels" -}}
helm.sh/chart: {{ include "microservice.chart" . }}
{{ include "microservice.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "microservice.selectorLabels" -}}
app.kubernetes.io/name: {{ include "microservice.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "microservice.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "microservice.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Return the proper image name
*/}}
{{- define "microservice.image" -}}
{{- $registryName := .Values.image.registry -}}
{{- $repositoryName := .Values.image.repository -}}
{{- $tag := .Values.image.tag | toString -}}
{{- if .Values.global }}
    {{- if .Values.global.imageRegistry }}
        {{- printf "%s/%s:%s" .Values.global.imageRegistry $repositoryName $tag -}}
    {{- else -}}
        {{- printf "%s/%s:%s" $registryName $repositoryName $tag -}}
    {{- end -}}
{{- else -}}
    {{- printf "%s/%s:%s" $registryName $repositoryName $tag -}}
{{- end -}}
{{- end -}}

{{/*
Return the proper storage class
*/}}
{{- define "microservice.storageClass" -}}
{{- if .Values.global }}
    {{- if .Values.global.storageClass }}
        {{- if (eq "-" .Values.global.storageClass) }}
            {{- printf "storageClassName: \"\"" -}}
        {{- else }}
            {{- printf "storageClassName: %s" .Values.global.storageClass -}}
        {{- end }}
    {{- else if .Values.persistence.storageClass }}
        {{- if (eq "-" .Values.persistence.storageClass) }}
            {{- printf "storageClassName: \"\"" -}}
        {{- else }}
            {{- printf "storageClassName: %s" .Values.persistence.storageClass -}}
        {{- end }}
    {{- end }}
{{- else if .Values.persistence.storageClass }}
    {{- if (eq "-" .Values.persistence.storageClass) }}
        {{- printf "storageClassName: \"\"" -}}
    {{- else }}
        {{- printf "storageClassName: %s" .Values.persistence.storageClass -}}
    {{- end }}
{{- end }}
{{- end -}}

{{/*
Validate values
*/}}
{{- define "microservice.validateValues" -}}
{{- $messages := list -}}
{{- $messages := append $messages (include "microservice.validateValues.ingress" .) -}}
{{- $messages := append $messages (include "microservice.validateValues.autoscaling" .) -}}
{{- $messages := without $messages "" -}}
{{- $message := join "\n" $messages -}}
{{- if $message -}}
{{-   printf "\nVALUES VALIDATION:\n%s" $message | fail -}}
{{- end -}}
{{- end -}}

{{/*
Validate ingress values
*/}}
{{- define "microservice.validateValues.ingress" -}}
{{- if and .Values.ingress.enabled (not .Values.ingress.className) -}}
microservice: ingress.className
    You must specify an ingress class name when ingress is enabled.
{{- end -}}
{{- end -}}

{{/*
Validate autoscaling values
*/}}
{{- define "microservice.validateValues.autoscaling" -}}
{{- if and .Values.autoscaling.enabled (not .Values.autoscaling.targetCPUUtilizationPercentage) (not .Values.autoscaling.targetMemoryUtilizationPercentage) -}}
microservice: autoscaling
    You must specify at least one autoscaling target when autoscaling is enabled.
{{- end -}}
{{- end -}}

{{/*
Get the password secret.
*/}}
{{- define "microservice.secretName" -}}
{{- if .Values.auth.existingSecret -}}
{{- .Values.auth.existingSecret -}}
{{- else -}}
{{- include "microservice.fullname" . -}}
{{- end -}}
{{- end -}}

{{/*
Return true if we should use an existingSecret.
*/}}
{{- define "microservice.useExistingSecret" -}}
{{- if .Values.auth.existingSecret -}}
{{- true -}}
{{- end -}}
{{- end -}}

{{/*
Create a default monitoring label selector
*/}}
{{- define "microservice.monitoringLabels" -}}
{{- if .Values.serviceMonitor.labels }}
{{- with .Values.serviceMonitor.labels }}
{{- toYaml . }}
{{- end }}
{{- else }}
{{- include "microservice.labels" . }}
{{- end }}
{{- end }}

{{/*
Create network policy labels
*/}}
{{- define "microservice.networkPolicyLabels" -}}
app.kubernetes.io/name: {{ include "microservice.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}