#!/bin/bash

# Kubernetes Deployment Script for Learning Assistant
# This script automates the deployment of the Learning Assistant application to Kubernetes

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
K8S_DIR="${PROJECT_ROOT}/k8s"
NAMESPACE="learning-assistant"
TIMEOUT=600

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy Learning Assistant application to Kubernetes

OPTIONS:
    -e, --environment    Environment to deploy to (dev|staging|prod) [default: prod]
    -n, --namespace      Kubernetes namespace [default: learning-assistant]
    -d, --dry-run        Perform a dry run without applying changes
    -u, --upgrade        Upgrade existing deployment
    -r, --rollback       Rollback to previous version
    -c, --check          Check deployment status
    -h, --help           Show this help message

EXAMPLES:
    $0                           # Deploy to production
    $0 -e staging                # Deploy to staging
    $0 -d                        # Dry run
    $0 -u                        # Upgrade existing deployment
    $0 -r                        # Rollback deployment
    $0 -c                        # Check deployment status

EOF
}

# Parse command line arguments
ENVIRONMENT="prod"
DRY_RUN=false
UPGRADE=false
ROLLBACK=false
CHECK=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -u|--upgrade)
            UPGRADE=true
            shift
            ;;
        -r|--rollback)
            ROLLBACK=true
            shift
            ;;
        -c|--check)
            CHECK=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    log_error "Invalid environment: $ENVIRONMENT. Must be one of: dev, staging, prod"
    exit 1
fi

# Check if kubectl is installed
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check if we can connect to the cluster
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster. Please check your kubeconfig"
        exit 1
    fi
    
    log_info "Connected to Kubernetes cluster: $(kubectl config current-context)"
}

# Check if required tools are installed
check_dependencies() {
    local missing_tools=()
    
    for tool in kubectl docker helm; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Please install the missing tools and try again"
        exit 1
    fi
}

# Create namespace if it doesn't exist
create_namespace() {
    if kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_info "Namespace '$NAMESPACE' already exists"
    else
        log_info "Creating namespace '$NAMESPACE'"
        if [[ "$DRY_RUN" == "false" ]]; then
            kubectl apply -f "${K8S_DIR}/base/namespace.yaml"
        else
            log_info "[DRY RUN] Would create namespace '$NAMESPACE'"
        fi
    fi
}

# Apply secrets
apply_secrets() {
    log_info "Applying secrets..."
    
    # Check if .env file exists
    if [[ ! -f "${PROJECT_ROOT}/.env.prod" ]]; then
        log_warning "Production environment file (.env.prod) not found"
        log_info "Please create .env.prod with required secrets"
        return 1
    fi
    
    # Create secrets from .env file
    if [[ "$DRY_RUN" == "false" ]]; then
        kubectl create secret generic learning-assistant-secrets \
            --from-env-file="${PROJECT_ROOT}/.env.prod" \
            --namespace="$NAMESPACE" \
            --dry-run=client -o yaml | kubectl apply -f -
    else
        log_info "[DRY RUN] Would apply secrets from .env.prod"
    fi
}

# Apply ConfigMaps
apply_configmaps() {
    log_info "Applying ConfigMaps..."
    
    local configmap_files=(
        "${K8S_DIR}/base/configmap.yaml"
        "${K8S_DIR}/base/init-scripts.yaml"
        "${K8S_DIR}/monitoring/prometheus-config.yaml"
    )
    
    for file in "${configmap_files[@]}"; do
        if [[ -f "$file" ]]; then
            if [[ "$DRY_RUN" == "false" ]]; then
                kubectl apply -f "$file" --namespace="$NAMESPACE"
            else
                log_info "[DRY RUN] Would apply $file"
            fi
        else
            log_warning "ConfigMap file not found: $file"
        fi
    done
}

# Apply persistent volumes
apply_storage() {
    log_info "Applying storage configurations..."
    
    if [[ "$DRY_RUN" == "false" ]]; then
        kubectl apply -f "${K8S_DIR}/base/persistent-volumes.yaml" --namespace="$NAMESPACE"
    else
        log_info "[DRY RUN] Would apply persistent volumes"
    fi
}

# Deploy applications
deploy_applications() {
    log_info "Deploying applications..."
    
    local deployment_files=(
        "${K8S_DIR}/base/postgres-deployment.yaml"
        "${K8S_DIR}/base/redis-deployment.yaml"
        "${K8S_DIR}/base/app-deployment.yaml"
        "${K8S_DIR}/base/services.yaml"
        "${K8S_DIR}/monitoring/monitoring-stack.yaml"
    )
    
    for file in "${deployment_files[@]}"; do
        if [[ -f "$file" ]]; then
            if [[ "$DRY_RUN" == "false" ]]; then
                kubectl apply -f "$file" --namespace="$NAMESPACE"
            else
                log_info "[DRY RUN] Would apply $file"
            fi
        else
            log_warning "Deployment file not found: $file"
        fi
    done
}

# Apply autoscaling
apply_autoscaling() {
    log_info "Applying autoscaling configurations..."
    
    if [[ "$DRY_RUN" == "false" ]]; then
        kubectl apply -f "${K8S_DIR}/base/hpa.yaml" --namespace="$NAMESPACE"
    else
        log_info "[DRY RUN] Would apply autoscaling configurations"
    fi
}

# Apply ingress
apply_ingress() {
    log_info "Applying ingress configurations..."
    
    if [[ "$DRY_RUN" == "false" ]]; then
        kubectl apply -f "${K8S_DIR}/base/ingress.yaml" --namespace="$NAMESPACE"
    else
        log_info "[DRY RUN] Would apply ingress configurations"
    fi
}

# Apply resource quotas and RBAC
apply_policies() {
    log_info "Applying resource quotas and policies..."
    
    if [[ "$DRY_RUN" == "false" ]]; then
        kubectl apply -f "${K8S_DIR}/base/resource-quotas.yaml" --namespace="$NAMESPACE"
    else
        log_info "[DRY RUN] Would apply resource quotas and policies"
    fi
}

# Wait for deployments to be ready
wait_for_deployments() {
    log_info "Waiting for deployments to be ready..."
    
    local deployments=(
        "postgres"
        "redis"
        "learning-assistant"
        "prometheus"
        "grafana"
    )
    
    for deployment in "${deployments[@]}"; do
        log_info "Waiting for deployment: $deployment"
        if [[ "$DRY_RUN" == "false" ]]; then
            kubectl wait --for=condition=available \
                --timeout="${TIMEOUT}s" \
                deployment/"$deployment" \
                --namespace="$NAMESPACE" || {
                log_error "Deployment $deployment failed to become ready"
                return 1
            }
        else
            log_info "[DRY RUN] Would wait for deployment: $deployment"
        fi
    done
    
    log_success "All deployments are ready"
}

# Check deployment status
check_deployment_status() {
    log_info "Checking deployment status..."
    
    echo
    log_info "Namespace: $NAMESPACE"
    kubectl get namespace "$NAMESPACE" 2>/dev/null || log_warning "Namespace not found"
    
    echo
    log_info "Pods:"
    kubectl get pods --namespace="$NAMESPACE" -o wide
    
    echo
    log_info "Services:"
    kubectl get services --namespace="$NAMESPACE" -o wide
    
    echo
    log_info "Deployments:"
    kubectl get deployments --namespace="$NAMESPACE" -o wide
    
    echo
    log_info "Ingress:"
    kubectl get ingress --namespace="$NAMESPACE" -o wide
    
    echo
    log_info "HPA:"
    kubectl get hpa --namespace="$NAMESPACE" -o wide
    
    echo
    log_info "PVCs:"
    kubectl get pvc --namespace="$NAMESPACE" -o wide
}

# Rollback deployment
rollback_deployment() {
    log_info "Rolling back deployment..."
    
    local deployments=(
        "learning-assistant"
        "postgres"
        "redis"
    )
    
    for deployment in "${deployments[@]}"; do
        log_info "Rolling back deployment: $deployment"
        if [[ "$DRY_RUN" == "false" ]]; then
            kubectl rollout undo deployment/"$deployment" --namespace="$NAMESPACE"
            kubectl rollout status deployment/"$deployment" --namespace="$NAMESPACE" --timeout="${TIMEOUT}s"
        else
            log_info "[DRY RUN] Would rollback deployment: $deployment"
        fi
    done
    
    log_success "Rollback completed"
}

# Upgrade deployment
upgrade_deployment() {
    log_info "Upgrading deployment..."
    
    # Update image tags if specified
    if [[ -n "${IMAGE_TAG:-}" ]]; then
        log_info "Updating image tag to: $IMAGE_TAG"
        if [[ "$DRY_RUN" == "false" ]]; then
            kubectl set image deployment/learning-assistant \
                learning-assistant="learning-assistant:$IMAGE_TAG" \
                --namespace="$NAMESPACE"
        else
            log_info "[DRY RUN] Would update image tag to: $IMAGE_TAG"
        fi
    fi
    
    # Apply updated configurations
    deploy_applications
    wait_for_deployments
    
    log_success "Upgrade completed"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary files..."
    # Add cleanup logic here if needed
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

# Main function
main() {
    log_info "Starting Learning Assistant Kubernetes deployment"
    log_info "Environment: $ENVIRONMENT"
    log_info "Namespace: $NAMESPACE"
    log_info "Dry run: $DRY_RUN"
    
    # Check dependencies
    check_dependencies
    check_kubectl
    
    if [[ "$CHECK" == "true" ]]; then
        check_deployment_status
        exit 0
    fi
    
    if [[ "$ROLLBACK" == "true" ]]; then
        rollback_deployment
        exit 0
    fi
    
    # Create namespace
    create_namespace
    
    # Apply configurations in order
    apply_secrets
    apply_configmaps
    apply_storage
    apply_policies
    
    if [[ "$UPGRADE" == "true" ]]; then
        upgrade_deployment
    else
        deploy_applications
        apply_autoscaling
        apply_ingress
        wait_for_deployments
    fi
    
    # Check final status
    check_deployment_status
    
    log_success "Learning Assistant deployment completed successfully!"
    log_info "You can access the application at the configured ingress URL"
}

# Run main function
main "$@"