#!/bin/bash

# Azure Learning Assistant Infrastructure Validation Script
# This script validates the deployed infrastructure and checks health

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

check_command() {
    if command -v $1 >/dev/null 2>&1; then
        log_success "$1 is installed"
        return 0
    else
        log_error "$1 is not installed"
        return 1
    fi
}

validate_terraform_state() {
    log_info "Validating Terraform state..."
    
    cd "$SCRIPT_DIR"
    
    if [ ! -f "terraform.tfstate" ] && [ ! -f ".terraform/terraform.tfstate" ]; then
        if ! terraform state list >/dev/null 2>&1; then
            log_error "No Terraform state found. Infrastructure may not be deployed."
            return 1
        fi
    fi
    
    log_success "Terraform state is valid"
    return 0
}

get_terraform_outputs() {
    log_info "Retrieving Terraform outputs..."
    
    cd "$SCRIPT_DIR"
    
    # Check if outputs are available
    if ! terraform output >/dev/null 2>&1; then
        log_error "Unable to retrieve Terraform outputs"
        return 1
    fi
    
    # Export outputs as variables
    export RG_NAME=$(terraform output -json resource_groups 2>/dev/null | jq -r '.main.name // empty')
    export AKS_NAME=$(terraform output -json aks 2>/dev/null | jq -r '.cluster.name // empty')
    export KV_NAME=$(terraform output -json key_vault 2>/dev/null | jq -r '.name // empty')
    export APP_GW_IP=$(terraform output -json application_gateway 2>/dev/null | jq -r '.public_ip_address // empty')
    export APP_URL=$(terraform output -json quick_start_urls 2>/dev/null | jq -r '.application_url // empty')
    export DB_HOST=$(terraform output -json connection_info 2>/dev/null | jq -r '.database.host // empty')
    export REDIS_HOST=$(terraform output -json connection_info 2>/dev/null | jq -r '.redis.host // empty')
    
    if [ -z "$RG_NAME" ] || [ -z "$AKS_NAME" ] || [ -z "$KV_NAME" ]; then
        log_error "Unable to retrieve required Terraform outputs"
        return 1
    fi
    
    log_success "Terraform outputs retrieved"
    return 0
}

validate_azure_resources() {
    log_info "Validating Azure resources..."
    
    local validation_failed=false
    
    # Check Resource Group
    if az group show --name "$RG_NAME" >/dev/null 2>&1; then
        log_success "Resource Group '$RG_NAME' exists"
    else
        log_error "Resource Group '$RG_NAME' not found"
        validation_failed=true
    fi
    
    # Check AKS Cluster
    if az aks show --resource-group "$RG_NAME" --name "$AKS_NAME" >/dev/null 2>&1; then
        log_success "AKS Cluster '$AKS_NAME' exists"
        
        # Check AKS status
        local aks_status=$(az aks show --resource-group "$RG_NAME" --name "$AKS_NAME" --query provisioningState -o tsv)
        if [ "$aks_status" = "Succeeded" ]; then
            log_success "AKS Cluster is in 'Succeeded' state"
        else
            log_warning "AKS Cluster is in '$aks_status' state"
        fi
    else
        log_error "AKS Cluster '$AKS_NAME' not found"
        validation_failed=true
    fi
    
    # Check Key Vault
    if az keyvault show --name "$KV_NAME" >/dev/null 2>&1; then
        log_success "Key Vault '$KV_NAME' exists"
    else
        log_error "Key Vault '$KV_NAME' not found"
        validation_failed=true
    fi
    
    if [ "$validation_failed" = true ]; then
        return 1
    fi
    
    log_success "All Azure resources validated"
    return 0
}

validate_kubernetes_cluster() {
    log_info "Validating Kubernetes cluster..."
    
    # Get AKS credentials
    if ! az aks get-credentials --resource-group "$RG_NAME" --name "$AKS_NAME" --overwrite-existing >/dev/null 2>&1; then
        log_error "Failed to get AKS credentials"
        return 1
    fi
    
    # Check cluster connectivity
    if ! kubectl cluster-info >/dev/null 2>&1; then
        log_error "Unable to connect to Kubernetes cluster"
        return 1
    fi
    
    log_success "Kubernetes cluster connectivity verified"
    
    # Check nodes
    local node_count=$(kubectl get nodes --no-headers 2>/dev/null | wc -l | tr -d ' ')
    if [ "$node_count" -gt 0 ]; then
        log_success "Kubernetes cluster has $node_count nodes"
    else
        log_error "No Kubernetes nodes found"
        return 1
    fi
    
    # Check node status
    local ready_nodes=$(kubectl get nodes --no-headers 2>/dev/null | grep -c Ready || echo 0)
    if [ "$ready_nodes" -eq "$node_count" ]; then
        log_success "All $ready_nodes nodes are Ready"
    else
        log_warning "$ready_nodes out of $node_count nodes are Ready"
    fi
    
    # Check system pods
    local system_pods=$(kubectl get pods -n kube-system --no-headers 2>/dev/null | wc -l | tr -d ' ')
    local running_system_pods=$(kubectl get pods -n kube-system --no-headers 2>/dev/null | grep -c Running || echo 0)
    
    if [ "$running_system_pods" -gt 0 ]; then
        log_success "System pods: $running_system_pods/$system_pods running"
    else
        log_warning "No system pods are running"
    fi
    
    # Check application namespace
    if kubectl get namespace learning-assistant >/dev/null 2>&1; then
        log_success "Application namespace 'learning-assistant' exists"
    else
        log_warning "Application namespace 'learning-assistant' not found"
    fi
    
    return 0
}

validate_database_connectivity() {
    log_info "Validating database connectivity..."
    
    if [ -z "$DB_HOST" ]; then
        log_warning "Database host not found in outputs"
        return 1
    fi
    
    # Check if database host is reachable (basic connectivity test)
    if nslookup "$DB_HOST" >/dev/null 2>&1; then
        log_success "Database host '$DB_HOST' is resolvable"
    else
        log_warning "Database host '$DB_HOST' is not resolvable"
    fi
    
    # Note: We can't test actual database connectivity without credentials
    log_info "Note: Database credentials are stored in Key Vault for security"
    
    return 0
}

validate_redis_connectivity() {
    log_info "Validating Redis connectivity..."
    
    if [ -z "$REDIS_HOST" ]; then
        log_warning "Redis host not found in outputs"
        return 1
    fi
    
    # Check if Redis host is reachable
    if nslookup "$REDIS_HOST" >/dev/null 2>&1; then
        log_success "Redis host '$REDIS_HOST' is resolvable"
    else
        log_warning "Redis host '$REDIS_HOST' is not resolvable"
    fi
    
    return 0
}

validate_application_gateway() {
    log_info "Validating Application Gateway..."
    
    if [ -z "$APP_GW_IP" ]; then
        log_warning "Application Gateway IP not found in outputs"
        return 1
    fi
    
    log_success "Application Gateway IP: $APP_GW_IP"
    
    # Test basic connectivity to Application Gateway
    if ping -c 1 "$APP_GW_IP" >/dev/null 2>&1; then
        log_success "Application Gateway IP is reachable"
    else
        log_warning "Application Gateway IP is not reachable (may be normal)"
    fi
    
    return 0
}

validate_monitoring() {
    log_info "Validating monitoring setup..."
    
    # Check if Application Insights exists
    local app_insights=$(terraform output -json monitoring 2>/dev/null | jq -r '.application_insights.name // empty')
    if [ -n "$app_insights" ]; then
        log_success "Application Insights '$app_insights' configured"
    else
        log_warning "Application Insights not found"
    fi
    
    # Check if Log Analytics workspace exists
    local log_analytics=$(terraform output -json monitoring 2>/dev/null | jq -r '.log_analytics.name // empty')
    if [ -n "$log_analytics" ]; then
        log_success "Log Analytics workspace '$log_analytics' configured"
    else
        log_warning "Log Analytics workspace not found"
    fi
    
    return 0
}

validate_security() {
    log_info "Validating security configuration..."
    
    # Check if Key Vault has secrets
    local secret_count=$(az keyvault secret list --vault-name "$KV_NAME" --query "length(@)" -o tsv 2>/dev/null || echo 0)
    if [ "$secret_count" -gt 0 ]; then
        log_success "Key Vault has $secret_count secrets configured"
    else
        log_warning "No secrets found in Key Vault"
    fi
    
    # Check if managed identities are configured
    local identities=$(terraform output -json identity 2>/dev/null | jq -r '.managed_identities | keys | length')
    if [ "$identities" -gt 0 ]; then
        log_success "Managed identities configured: $identities"
    else
        log_warning "No managed identities found"
    fi
    
    return 0
}

run_health_checks() {
    log_info "Running health checks..."
    
    # Check Application URL if available
    if [ -n "$APP_URL" ]; then
        log_info "Testing application URL: $APP_URL"
        
        # Test HTTP connectivity (with timeout)
        if curl -f -s -m 10 "$APP_URL/health" >/dev/null 2>&1; then
            log_success "Application health endpoint is responding"
        elif curl -f -s -m 10 "$APP_URL" >/dev/null 2>&1; then
            log_success "Application URL is responding"
        else
            log_warning "Application URL is not responding (may be normal if app not deployed)"
        fi
    fi
    
    return 0
}

generate_validation_report() {
    log_info "Generating validation report..."
    
    local report_file="validation-report-$(date +%Y%m%d-%H%M%S).txt"
    
    cat > "$report_file" << EOF
Azure Learning Assistant Infrastructure Validation Report
========================================================

Generated: $(date)
Terraform Directory: $SCRIPT_DIR

Resource Information:
--------------------
Resource Group: $RG_NAME
AKS Cluster: $AKS_NAME
Key Vault: $KV_NAME
Application Gateway IP: $APP_GW_IP
Application URL: $APP_URL
Database Host: $DB_HOST
Redis Host: $REDIS_HOST

Kubernetes Cluster Status:
--------------------------
$(kubectl get nodes 2>/dev/null || echo "Unable to retrieve node information")

System Pods Status:
------------------
$(kubectl get pods -n kube-system 2>/dev/null || echo "Unable to retrieve pod information")

Key Vault Secrets:
------------------
$(az keyvault secret list --vault-name "$KV_NAME" --query "[].name" -o tsv 2>/dev/null || echo "Unable to retrieve secret information")

Terraform Outputs:
------------------
$(terraform output 2>/dev/null || echo "Unable to retrieve Terraform outputs")

EOF
    
    log_success "Validation report saved to: $report_file"
}

show_summary() {
    echo ""
    echo "=========================================="
    echo "         VALIDATION SUMMARY"
    echo "=========================================="
    echo ""
    echo "Infrastructure Details:"
    echo "----------------------"
    echo "Resource Group: $RG_NAME"
    echo "AKS Cluster: $AKS_NAME"
    echo "Key Vault: $KV_NAME"
    echo "Application URL: $APP_URL"
    echo ""
    echo "Next Steps:"
    echo "----------"
    echo "1. Deploy your application to the AKS cluster"
    echo "2. Configure application secrets in Key Vault"
    echo "3. Set up CI/CD pipelines"
    echo "4. Configure monitoring dashboards"
    echo ""
    echo "Useful Commands:"
    echo "---------------"
    echo "kubectl get pods -A"
    echo "az keyvault secret list --vault-name $KV_NAME"
    echo "terraform output"
    echo ""
}

main() {
    log_info "Starting Azure Learning Assistant infrastructure validation"
    
    # Check prerequisites
    local prereq_failed=false
    check_command "terraform" || prereq_failed=true
    check_command "az" || prereq_failed=true
    check_command "kubectl" || prereq_failed=true
    check_command "jq" || prereq_failed=true
    
    if [ "$prereq_failed" = true ]; then
        log_error "Prerequisites check failed"
        exit 1
    fi
    
    # Validate infrastructure
    local validation_failed=false
    
    validate_terraform_state || validation_failed=true
    get_terraform_outputs || validation_failed=true
    validate_azure_resources || validation_failed=true
    validate_kubernetes_cluster || validation_failed=true
    validate_database_connectivity || validation_failed=true
    validate_redis_connectivity || validation_failed=true
    validate_application_gateway || validation_failed=true
    validate_monitoring || validation_failed=true
    validate_security || validation_failed=true
    run_health_checks || validation_failed=true
    
    # Generate report
    generate_validation_report
    show_summary
    
    if [ "$validation_failed" = true ]; then
        log_warning "Some validations failed. Please review the issues above."
        exit 1
    else
        log_success "All validations passed! Infrastructure is healthy. 🎉"
        exit 0
    fi
}

# Run main function
main "$@"