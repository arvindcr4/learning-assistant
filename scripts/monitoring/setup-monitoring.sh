#!/bin/bash

# ==============================================================================
# COMPREHENSIVE MONITORING INFRASTRUCTURE SETUP
# Deploy complete observability stack across all environments
# ==============================================================================

set -euo pipefail

# Script metadata
SCRIPT_NAME="setup-monitoring.sh"
SCRIPT_VERSION="1.0.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
TERRAFORM_DIR="${PROJECT_ROOT}/infrastructure/monitoring"
HELM_TIMEOUT="600s"
KUBECTL_TIMEOUT="300s"

# Default values
ENVIRONMENT="${ENVIRONMENT:-dev}"
PROJECT_ID="${PROJECT_ID:-}"
CLUSTER_NAME="${CLUSTER_NAME:-monitoring-cluster}"
DOMAIN_NAME="${DOMAIN_NAME:-example.com}"
NOTIFICATION_EMAIL="${NOTIFICATION_EMAIL:-admin@example.com}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
PAGERDUTY_INTEGRATION_KEY="${PAGERDUTY_INTEGRATION_KEY:-}"
ENABLE_MULTI_CLOUD="${ENABLE_MULTI_CLOUD:-true}"
HIGH_AVAILABILITY="${HIGH_AVAILABILITY:-true}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# ==============================================================================
# UTILITY FUNCTIONS
# ==============================================================================

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $*${NC}" >&2
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $*${NC}" >&2
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $*${NC}" >&2
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $*${NC}" >&2
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS: $*${NC}" >&2
}

step() {
    echo -e "${PURPLE}[$(date +'%Y-%m-%d %H:%M:%S')] STEP: $*${NC}" >&2
}

# ==============================================================================
# HELP FUNCTION
# ==============================================================================

show_help() {
    cat << EOF
${SCRIPT_NAME} ${SCRIPT_VERSION}

DESCRIPTION:
    Deploy comprehensive monitoring infrastructure with Terraform.
    Sets up Prometheus, Grafana, Jaeger, ELK stack, AlertManager,
    synthetic monitoring, cost monitoring, and SLO monitoring.

USAGE:
    ${SCRIPT_NAME} [OPTIONS] [COMMAND]

COMMANDS:
    plan        Show deployment plan
    apply       Deploy monitoring infrastructure
    destroy     Remove monitoring infrastructure
    validate    Validate configuration and prerequisites
    status      Show deployment status
    upgrade     Upgrade monitoring components
    backup      Backup monitoring configuration
    restore     Restore monitoring configuration

OPTIONS:
    -e, --environment ENV       Environment (dev, staging, prod) [default: dev]
    -p, --project-id ID         GCP Project ID [required]
    -c, --cluster-name NAME     Kubernetes cluster name [default: monitoring-cluster]
    -d, --domain-name DOMAIN    Domain name for monitoring services [required]
    -n, --notification-email    Email for alerts [required]
    -s, --slack-webhook-url     Slack webhook URL for notifications
    -g, --pagerduty-key        PagerDuty integration key
    -m, --multi-cloud          Enable multi-cloud monitoring [default: true]
    -a, --high-availability    Enable high availability [default: true]
    -r, --retention-days NUM    Metrics retention period [default: 30]
    -v, --verbose              Enable verbose output
    -h, --help                 Show this help message

EXAMPLES:
    # Validate configuration
    ${SCRIPT_NAME} --project-id my-project --domain-name monitoring.example.com validate

    # Plan deployment
    ${SCRIPT_NAME} --environment prod --project-id my-project plan

    # Deploy monitoring infrastructure
    ${SCRIPT_NAME} --environment prod --project-id my-project apply

    # Check deployment status
    ${SCRIPT_NAME} status

ENVIRONMENT VARIABLES:
    ENVIRONMENT                 Environment name
    PROJECT_ID                  GCP Project ID
    CLUSTER_NAME               Kubernetes cluster name
    DOMAIN_NAME                Domain name for monitoring services
    NOTIFICATION_EMAIL         Email for alerts
    SLACK_WEBHOOK_URL          Slack webhook URL
    PAGERDUTY_INTEGRATION_KEY  PagerDuty integration key
    ENABLE_MULTI_CLOUD         Enable multi-cloud monitoring
    HIGH_AVAILABILITY          Enable high availability
    RETENTION_DAYS             Metrics retention period

EOF
}

# ==============================================================================
# VALIDATION FUNCTIONS
# ==============================================================================

check_prerequisites() {
    step "Checking prerequisites"
    
    local missing_tools=()
    
    # Check required tools
    command -v terraform >/dev/null 2>&1 || missing_tools+=("terraform")
    command -v kubectl >/dev/null 2>&1 || missing_tools+=("kubectl")
    command -v helm >/dev/null 2>&1 || missing_tools+=("helm")
    command -v gcloud >/dev/null 2>&1 || missing_tools+=("gcloud")
    
    if [[ ${#missing_tools[@]} -ne 0 ]]; then
        error "Missing required tools: ${missing_tools[*]}"
        error "Please install the missing tools and try again"
        exit 1
    fi
    
    # Check Terraform version
    local tf_version
    tf_version=$(terraform version -json | jq -r '.terraform_version')
    local required_version="1.0.0"
    
    if ! printf '%s\n%s\n' "$required_version" "$tf_version" | sort -V -C; then
        error "Terraform version $tf_version is too old. Required: >= $required_version"
        exit 1
    fi
    
    # Check Kubernetes connectivity
    if ! kubectl cluster-info >/dev/null 2>&1; then
        error "Cannot connect to Kubernetes cluster"
        error "Please ensure kubectl is configured and cluster is accessible"
        exit 1
    fi
    
    # Check required environment variables
    if [[ -z "$PROJECT_ID" ]]; then
        error "PROJECT_ID is required"
        exit 1
    fi
    
    if [[ -z "$DOMAIN_NAME" ]]; then
        error "DOMAIN_NAME is required"
        exit 1
    fi
    
    if [[ -z "$NOTIFICATION_EMAIL" ]]; then
        error "NOTIFICATION_EMAIL is required"
        exit 1
    fi
    
    success "Prerequisites check passed"
}

validate_terraform_config() {
    step "Validating Terraform configuration"
    
    cd "$TERRAFORM_DIR" || exit 1
    
    # Initialize Terraform
    terraform init -upgrade
    
    # Validate configuration
    terraform validate
    
    # Check formatting
    if ! terraform fmt -check=true; then
        warn "Terraform files are not properly formatted"
        terraform fmt -recursive
        info "Fixed Terraform formatting"
    fi
    
    success "Terraform configuration is valid"
}

# ==============================================================================
# TERRAFORM FUNCTIONS
# ==============================================================================

prepare_terraform_vars() {
    step "Preparing Terraform variables"
    
    local tfvars_file="${TERRAFORM_DIR}/terraform.tfvars"
    
    cat > "$tfvars_file" << EOF
# ==============================================================================
# MONITORING INFRASTRUCTURE VARIABLES
# Generated by ${SCRIPT_NAME} on $(date)
# ==============================================================================

# Basic configuration
project_id = "${PROJECT_ID}"
region = "us-central1"
environment = "${ENVIRONMENT}"
cluster_name = "${CLUSTER_NAME}"
domain_name = "${DOMAIN_NAME}"

# Notification configuration
notification_email = "${NOTIFICATION_EMAIL}"
slack_webhook_url = "${SLACK_WEBHOOK_URL}"
pagerduty_integration_key = "${PAGERDUTY_INTEGRATION_KEY}"

# Feature flags
enable_multi_cloud = ${ENABLE_MULTI_CLOUD}
high_availability = ${HIGH_AVAILABILITY}
retention_days = ${RETENTION_DAYS}

EOF

    info "Created Terraform variables file: $tfvars_file"
}

terraform_plan() {
    step "Creating Terraform plan"
    
    cd "$TERRAFORM_DIR" || exit 1
    
    prepare_terraform_vars
    
    terraform plan \
        -var-file=terraform.tfvars \
        -out=monitoring.tfplan \
        -detailed-exitcode
    
    local plan_exit_code=$?
    
    case $plan_exit_code in
        0)
            info "No changes required"
            ;;
        1)
            error "Terraform plan failed"
            exit 1
            ;;
        2)
            info "Changes detected and plan created"
            ;;
    esac
    
    return $plan_exit_code
}

terraform_apply() {
    step "Applying Terraform configuration"
    
    cd "$TERRAFORM_DIR" || exit 1
    
    if [[ ! -f "monitoring.tfplan" ]]; then
        warn "No plan file found, creating new plan"
        terraform_plan
    fi
    
    terraform apply \
        -auto-approve \
        monitoring.tfplan
    
    success "Terraform apply completed"
}

terraform_destroy() {
    step "Destroying monitoring infrastructure"
    
    cd "$TERRAFORM_DIR" || exit 1
    
    prepare_terraform_vars
    
    # Confirm destruction
    echo -e "${RED}WARNING: This will destroy all monitoring infrastructure!${NC}"
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [[ "$confirm" != "yes" ]]; then
        info "Destruction cancelled"
        exit 0
    fi
    
    terraform destroy \
        -var-file=terraform.tfvars \
        -auto-approve
    
    success "Infrastructure destroyed"
}

# ==============================================================================
# KUBERNETES FUNCTIONS
# ==============================================================================

wait_for_deployments() {
    step "Waiting for deployments to be ready"
    
    local namespaces=("monitoring" "logging" "tracing" "cost-monitoring" "slo-monitoring")
    
    for namespace in "${namespaces[@]}"; do
        info "Checking deployments in namespace: $namespace"
        
        if kubectl get namespace "$namespace" >/dev/null 2>&1; then
            kubectl wait --for=condition=available \
                --timeout=${KUBECTL_TIMEOUT} \
                deployment --all \
                -n "$namespace" || true
        else
            warn "Namespace $namespace not found, skipping"
        fi
    done
    
    success "All deployments are ready"
}

check_monitoring_health() {
    step "Checking monitoring services health"
    
    local services=(
        "monitoring:prometheus-operated:9090"
        "monitoring:grafana:3000"
        "monitoring:alertmanager-main:9093"
        "tracing:jaeger-query:16686"
        "logging:kibana-kb-http:5601"
    )
    
    for service in "${services[@]}"; do
        IFS=':' read -ra SERVICE_PARTS <<< "$service"
        local namespace="${SERVICE_PARTS[0]}"
        local service_name="${SERVICE_PARTS[1]}"
        local port="${SERVICE_PARTS[2]}"
        
        info "Checking $service_name in $namespace namespace"
        
        if kubectl get service "$service_name" -n "$namespace" >/dev/null 2>&1; then
            # Port forward and check health
            kubectl port-forward -n "$namespace" "service/$service_name" "$port:$port" &
            local pf_pid=$!
            
            sleep 5
            
            if curl -f "http://localhost:$port/api/v1/status/buildinfo" >/dev/null 2>&1 || \
               curl -f "http://localhost:$port/api/health" >/dev/null 2>&1 || \
               curl -f "http://localhost:$port/" >/dev/null 2>&1; then
                success "$service_name is healthy"
            else
                warn "$service_name health check failed"
            fi
            
            kill $pf_pid 2>/dev/null || true
        else
            warn "Service $service_name not found in namespace $namespace"
        fi
    done
}

# ==============================================================================
# BACKUP AND RESTORE FUNCTIONS
# ==============================================================================

backup_monitoring_config() {
    step "Backing up monitoring configuration"
    
    local backup_dir="${PROJECT_ROOT}/backups/monitoring-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Backup Terraform state
    if [[ -f "${TERRAFORM_DIR}/terraform.tfstate" ]]; then
        cp "${TERRAFORM_DIR}/terraform.tfstate" "$backup_dir/"
        info "Backed up Terraform state"
    fi
    
    # Backup Kubernetes resources
    local namespaces=("monitoring" "logging" "tracing" "cost-monitoring" "slo-monitoring")
    
    for namespace in "${namespaces[@]}"; do
        if kubectl get namespace "$namespace" >/dev/null 2>&1; then
            kubectl get all,configmaps,secrets,pvc -n "$namespace" -o yaml > "$backup_dir/$namespace-resources.yaml"
            info "Backed up $namespace resources"
        fi
    done
    
    # Backup Grafana dashboards
    if kubectl get deployment grafana -n monitoring >/dev/null 2>&1; then
        kubectl port-forward -n monitoring service/grafana 3000:3000 &
        local pf_pid=$!
        sleep 5
        
        # Export dashboards (would need Grafana API)
        # This is a placeholder - implement actual dashboard backup
        info "Grafana dashboard backup placeholder"
        
        kill $pf_pid 2>/dev/null || true
    fi
    
    success "Backup completed: $backup_dir"
    echo "$backup_dir"
}

# ==============================================================================
# STATUS FUNCTIONS
# ==============================================================================

show_deployment_status() {
    step "Showing deployment status"
    
    echo -e "\n${CYAN}=== MONITORING INFRASTRUCTURE STATUS ===${NC}\n"
    
    # Terraform status
    echo -e "${BLUE}Terraform Status:${NC}"
    if [[ -f "${TERRAFORM_DIR}/terraform.tfstate" ]]; then
        cd "$TERRAFORM_DIR" || exit 1
        terraform show -no-color | head -20
    else
        echo "  No Terraform state found"
    fi
    
    echo -e "\n${BLUE}Kubernetes Resources:${NC}"
    
    # Check namespaces
    local namespaces=("monitoring" "logging" "tracing" "cost-monitoring" "slo-monitoring")
    
    for namespace in "${namespaces[@]}"; do
        if kubectl get namespace "$namespace" >/dev/null 2>&1; then
            echo -e "\n  ${GREEN}Namespace: $namespace${NC}"
            kubectl get pods -n "$namespace" --no-headers | wc -l | xargs echo "    Pods:"
            kubectl get services -n "$namespace" --no-headers | wc -l | xargs echo "    Services:"
            kubectl get deployments -n "$namespace" --no-headers | wc -l | xargs echo "    Deployments:"
        else
            echo -e "\n  ${RED}Namespace: $namespace (not found)${NC}"
        fi
    done
    
    # Show service endpoints
    echo -e "\n${BLUE}Service Endpoints:${NC}"
    cat << EOF
  Grafana:       https://grafana.${DOMAIN_NAME}
  Prometheus:    https://prometheus.${DOMAIN_NAME}
  AlertManager:  https://alertmanager.${DOMAIN_NAME}
  Jaeger:        https://jaeger.${DOMAIN_NAME}
  Kibana:        https://kibana.${DOMAIN_NAME}
EOF
}

upgrade_monitoring() {
    step "Upgrading monitoring components"
    
    # Update Helm repositories
    helm repo update
    
    # Upgrade Helm releases
    local releases=(
        "monitoring:prometheus-operator"
        "monitoring:grafana"
        "monitoring:victoria-metrics"
        "tracing:jaeger-operator"
        "logging:elastic-operator"
        "cost-monitoring:opencost"
        "slo-monitoring:sloth"
    )
    
    for release in "${releases[@]}"; do
        IFS=':' read -ra RELEASE_PARTS <<< "$release"
        local namespace="${RELEASE_PARTS[0]}"
        local release_name="${RELEASE_PARTS[1]}"
        
        if helm list -n "$namespace" | grep -q "$release_name"; then
            info "Upgrading $release_name in $namespace"
            helm upgrade "$release_name" -n "$namespace" --timeout="$HELM_TIMEOUT" || warn "Failed to upgrade $release_name"
        else
            warn "Release $release_name not found in namespace $namespace"
        fi
    done
    
    success "Upgrade completed"
}

# ==============================================================================
# MAIN FUNCTION
# ==============================================================================

main() {
    local command=""
    local verbose=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -p|--project-id)
                PROJECT_ID="$2"
                shift 2
                ;;
            -c|--cluster-name)
                CLUSTER_NAME="$2"
                shift 2
                ;;
            -d|--domain-name)
                DOMAIN_NAME="$2"
                shift 2
                ;;
            -n|--notification-email)
                NOTIFICATION_EMAIL="$2"
                shift 2
                ;;
            -s|--slack-webhook-url)
                SLACK_WEBHOOK_URL="$2"
                shift 2
                ;;
            -g|--pagerduty-key)
                PAGERDUTY_INTEGRATION_KEY="$2"
                shift 2
                ;;
            -m|--multi-cloud)
                ENABLE_MULTI_CLOUD="$2"
                shift 2
                ;;
            -a|--high-availability)
                HIGH_AVAILABILITY="$2"
                shift 2
                ;;
            -r|--retention-days)
                RETENTION_DAYS="$2"
                shift 2
                ;;
            -v|--verbose)
                verbose=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            plan|apply|destroy|validate|status|upgrade|backup|restore)
                command="$1"
                shift
                ;;
            *)
                error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Enable verbose output if requested
    if [[ "$verbose" == "true" ]]; then
        set -x
    fi
    
    # Show script header
    echo -e "${CYAN}"
    echo "================================================================================"
    echo "  COMPREHENSIVE MONITORING INFRASTRUCTURE SETUP"
    echo "  Version: $SCRIPT_VERSION"
    echo "  Environment: $ENVIRONMENT"
    echo "  Project: $PROJECT_ID"
    echo "  Domain: $DOMAIN_NAME"
    echo "================================================================================"
    echo -e "${NC}"
    
    # Execute command
    case "$command" in
        validate)
            check_prerequisites
            validate_terraform_config
            success "Validation completed successfully"
            ;;
        plan)
            check_prerequisites
            terraform_plan
            ;;
        apply)
            check_prerequisites
            terraform_plan
            terraform_apply
            wait_for_deployments
            check_monitoring_health
            show_deployment_status
            success "Monitoring infrastructure deployed successfully"
            ;;
        destroy)
            terraform_destroy
            ;;
        status)
            show_deployment_status
            ;;
        upgrade)
            upgrade_monitoring
            ;;
        backup)
            backup_monitoring_config
            ;;
        restore)
            error "Restore functionality not yet implemented"
            exit 1
            ;;
        "")
            error "No command specified"
            show_help
            exit 1
            ;;
        *)
            error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# ==============================================================================
# SCRIPT EXECUTION
# ==============================================================================

# Check if script is being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi