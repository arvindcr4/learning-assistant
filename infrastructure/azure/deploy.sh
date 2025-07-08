#!/bin/bash

# Azure Learning Assistant Infrastructure Deployment Script
# This script automates the deployment of the Azure infrastructure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="learning-assistant"
TERRAFORM_STATE_RG="terraform-state-rg"
TERRAFORM_STATE_ACCOUNT=""
TERRAFORM_STATE_CONTAINER="terraform-state"

# Functions
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
    exit 1
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if required tools are installed
    command -v terraform >/dev/null 2>&1 || log_error "Terraform is not installed. Please install Terraform >= 1.6.0"
    command -v az >/dev/null 2>&1 || log_error "Azure CLI is not installed. Please install Azure CLI"
    command -v kubectl >/dev/null 2>&1 || log_error "kubectl is not installed. Please install kubectl"
    command -v jq >/dev/null 2>&1 || log_error "jq is not installed. Please install jq"
    
    # Check Terraform version
    TERRAFORM_VERSION=$(terraform version -json | jq -r '.terraform_version')
    log_info "Terraform version: $TERRAFORM_VERSION"
    
    # Check Azure CLI login
    az account show >/dev/null 2>&1 || log_error "Please login to Azure CLI with 'az login'"
    
    SUBSCRIPTION_ID=$(az account show --query id -o tsv)
    SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
    log_info "Using Azure subscription: $SUBSCRIPTION_NAME ($SUBSCRIPTION_ID)"
    
    log_success "Prerequisites check completed"
}

generate_random_suffix() {
    echo $(date +%s | tail -c 6)
}

setup_terraform_backend() {
    log_info "Setting up Terraform backend..."
    
    local suffix=$(generate_random_suffix)
    TERRAFORM_STATE_ACCOUNT="tfstate${PROJECT_NAME}${suffix}"
    
    # Remove hyphens and ensure name is lowercase and within limits
    TERRAFORM_STATE_ACCOUNT=$(echo $TERRAFORM_STATE_ACCOUNT | tr -d '-' | tr '[:upper:]' '[:lower:]' | cut -c1-24)
    
    log_info "Creating Terraform state storage account: $TERRAFORM_STATE_ACCOUNT"
    
    # Create resource group for Terraform state
    az group create \
        --name "$TERRAFORM_STATE_RG" \
        --location "East US 2" \
        --output none
    
    # Create storage account
    az storage account create \
        --name "$TERRAFORM_STATE_ACCOUNT" \
        --resource-group "$TERRAFORM_STATE_RG" \
        --location "East US 2" \
        --sku "Standard_LRS" \
        --encryption-services blob \
        --min-tls-version TLS1_2 \
        --allow-blob-public-access false \
        --output none
    
    # Create container
    az storage container create \
        --name "$TERRAFORM_STATE_CONTAINER" \
        --account-name "$TERRAFORM_STATE_ACCOUNT" \
        --output none
    
    log_success "Terraform backend storage created"
}

create_terraform_config() {
    log_info "Creating Terraform configuration..."
    
    # Create terraform.tfvars if it doesn't exist
    if [ ! -f "$SCRIPT_DIR/terraform.tfvars" ]; then
        log_warning "terraform.tfvars not found. Creating from example..."
        cp "$SCRIPT_DIR/terraform.tfvars.example" "$SCRIPT_DIR/terraform.tfvars"
        
        # Update with some defaults
        sed -i.bak "s/project_name = \"learning-assistant\"/project_name = \"$PROJECT_NAME\"/" "$SCRIPT_DIR/terraform.tfvars"
        
        log_warning "Please review and update terraform.tfvars with your specific values before proceeding."
        read -p "Press Enter to continue once you've updated terraform.tfvars..."
    fi
    
    log_success "Terraform configuration ready"
}

initialize_terraform() {
    log_info "Initializing Terraform..."
    
    cd "$SCRIPT_DIR"
    
    if [ -n "$TERRAFORM_STATE_ACCOUNT" ]; then
        # Initialize with remote backend
        terraform init \
            -backend-config="storage_account_name=$TERRAFORM_STATE_ACCOUNT" \
            -backend-config="container_name=$TERRAFORM_STATE_CONTAINER" \
            -backend-config="key=${PROJECT_NAME}.tfstate" \
            -backend-config="resource_group_name=$TERRAFORM_STATE_RG"
    else
        # Initialize with local backend
        terraform init
    fi
    
    log_success "Terraform initialized"
}

plan_deployment() {
    log_info "Planning deployment..."
    
    cd "$SCRIPT_DIR"
    terraform plan -out=tfplan
    
    log_success "Deployment plan created"
    
    echo ""
    log_warning "Please review the deployment plan above."
    read -p "Do you want to proceed with the deployment? (y/N): " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Deployment cancelled by user"
        exit 0
    fi
}

apply_deployment() {
    log_info "Applying deployment..."
    
    cd "$SCRIPT_DIR"
    terraform apply tfplan
    
    log_success "Deployment completed successfully!"
}

post_deployment_setup() {
    log_info "Running post-deployment setup..."
    
    cd "$SCRIPT_DIR"
    
    # Get outputs
    RG_NAME=$(terraform output -json resource_groups | jq -r '.main.name')
    AKS_NAME=$(terraform output -json aks | jq -r '.cluster.name')
    KV_NAME=$(terraform output -json key_vault | jq -r '.name')
    APP_URL=$(terraform output -json quick_start_urls | jq -r '.application_url')
    
    log_info "Resource Group: $RG_NAME"
    log_info "AKS Cluster: $AKS_NAME"
    log_info "Key Vault: $KV_NAME"
    log_info "Application URL: $APP_URL"
    
    # Configure kubectl
    log_info "Configuring kubectl..."
    az aks get-credentials --resource-group "$RG_NAME" --name "$AKS_NAME" --overwrite-existing
    
    # Verify cluster access
    log_info "Verifying cluster access..."
    kubectl get nodes
    
    # Display important information
    echo ""
    log_success "Deployment completed successfully!"
    echo ""
    echo "Important Information:"
    echo "====================="
    echo "Application URL: $APP_URL"
    echo "Resource Group: $RG_NAME"
    echo "AKS Cluster: $AKS_NAME"
    echo "Key Vault: $KV_NAME"
    echo ""
    echo "Next Steps:"
    echo "1. Deploy your application to the AKS cluster"
    echo "2. Configure DNS records if using a custom domain"
    echo "3. Set up monitoring dashboards"
    echo "4. Review security recommendations in Azure Security Center"
    echo ""
    echo "Useful Commands:"
    echo "- kubectl get pods -A"
    echo "- az keyvault secret list --vault-name $KV_NAME"
    echo "- terraform output quick_start_urls"
    echo ""
}

cleanup_on_error() {
    log_error "Deployment failed. Cleaning up..."
    
    # Remove tfplan file
    if [ -f "$SCRIPT_DIR/tfplan" ]; then
        rm "$SCRIPT_DIR/tfplan"
    fi
    
    # Optionally offer to destroy resources
    read -p "Do you want to destroy any resources that were created? (y/N): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd "$SCRIPT_DIR"
        terraform destroy -auto-approve
    fi
}

show_help() {
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Deploy Azure infrastructure for Learning Assistant"
    echo ""
    echo "Options:"
    echo "  -h, --help              Show this help message"
    echo "  -e, --environment ENV   Set environment (dev, staging, prod)"
    echo "  -s, --skip-backend      Skip Terraform backend setup"
    echo "  -p, --plan-only         Only run terraform plan"
    echo "  -d, --destroy           Destroy infrastructure"
    echo ""
    echo "Examples:"
    echo "  $0                      # Interactive deployment"
    echo "  $0 -e prod              # Deploy production environment"
    echo "  $0 -p                   # Plan only"
    echo "  $0 -d                   # Destroy infrastructure"
    echo ""
}

destroy_infrastructure() {
    log_warning "This will destroy all infrastructure resources!"
    echo ""
    read -p "Are you sure you want to destroy the infrastructure? (y/N): " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Destroy cancelled by user"
        exit 0
    fi
    
    cd "$SCRIPT_DIR"
    terraform destroy
    
    log_success "Infrastructure destroyed"
}

main() {
    local environment=""
    local skip_backend=false
    local plan_only=false
    local destroy=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -e|--environment)
                environment="$2"
                shift 2
                ;;
            -s|--skip-backend)
                skip_backend=true
                shift
                ;;
            -p|--plan-only)
                plan_only=true
                shift
                ;;
            -d|--destroy)
                destroy=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                ;;
        esac
    done
    
    # Set trap for cleanup on error
    trap cleanup_on_error ERR
    
    if [ "$destroy" = true ]; then
        check_prerequisites
        destroy_infrastructure
        exit 0
    fi
    
    log_info "Starting Azure Learning Assistant infrastructure deployment"
    log_info "Script directory: $SCRIPT_DIR"
    
    check_prerequisites
    
    if [ "$skip_backend" = false ]; then
        setup_terraform_backend
    fi
    
    create_terraform_config
    initialize_terraform
    
    if [ "$plan_only" = true ]; then
        terraform plan
        exit 0
    fi
    
    plan_deployment
    apply_deployment
    post_deployment_setup
    
    log_success "All done! 🚀"
}

# Run main function with all arguments
main "$@"