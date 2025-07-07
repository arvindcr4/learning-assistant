#!/bin/bash

# Learning Assistant - Terraform Deployment Script
# This script automates the deployment of the Learning Assistant infrastructure on DigitalOcean

set -e  # Exit on any error
set -u  # Exit on undefined variables

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="${1:-production}"
ACTION="${2:-plan}"
AUTO_APPROVE="${3:-false}"
TERRAFORM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TFVARS_FILE="${TERRAFORM_DIR}/environments/${ENVIRONMENT}.tfvars"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if Terraform is installed
    if ! command -v terraform &> /dev/null; then
        print_error "Terraform is not installed. Please install Terraform >= 1.0"
        exit 1
    fi
    
    # Check Terraform version
    TERRAFORM_VERSION=$(terraform version -json | jq -r '.terraform_version')
    print_status "Terraform version: $TERRAFORM_VERSION"
    
    # Check if doctl is installed
    if ! command -v doctl &> /dev/null; then
        print_warning "doctl is not installed. Install it from: https://github.com/digitalocean/doctl"
    fi
    
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        print_warning "jq is not installed. Some features may not work properly."
    fi
    
    print_success "Prerequisites check completed"
}

# Function to validate environment
validate_environment() {
    print_status "Validating environment: $ENVIRONMENT"
    
    if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
        print_error "Invalid environment: $ENVIRONMENT"
        print_error "Valid environments: development, staging, production"
        exit 1
    fi
    
    if [[ ! -f "$TFVARS_FILE" ]]; then
        print_error "Environment file not found: $TFVARS_FILE"
        exit 1
    fi
    
    print_success "Environment validation completed"
}

# Function to check terraform.tfvars file
check_tfvars() {
    print_status "Checking terraform.tfvars file..."
    
    if [[ ! -f "$TERRAFORM_DIR/terraform.tfvars" ]]; then
        print_warning "terraform.tfvars not found. Creating from example..."
        if [[ -f "$TERRAFORM_DIR/terraform.tfvars.example" ]]; then
            cp "$TERRAFORM_DIR/terraform.tfvars.example" "$TERRAFORM_DIR/terraform.tfvars"
            print_warning "Please edit terraform.tfvars with your actual values before proceeding"
            print_warning "Required fields: do_token, domain_name, github_repo"
            exit 1
        else
            print_error "terraform.tfvars.example not found"
            exit 1
        fi
    fi
    
    # Check for required variables
    if ! grep -q "do_token.*=.*\"dop_v1_" "$TERRAFORM_DIR/terraform.tfvars" 2>/dev/null; then
        print_warning "Please set your DigitalOcean API token in terraform.tfvars"
    fi
    
    print_success "terraform.tfvars check completed"
}

# Function to initialize Terraform
terraform_init() {
    print_status "Initializing Terraform..."
    
    cd "$TERRAFORM_DIR"
    
    # Initialize Terraform
    if terraform init -upgrade; then
        print_success "Terraform initialization completed"
    else
        print_error "Terraform initialization failed"
        exit 1
    fi
}

# Function to validate Terraform configuration
terraform_validate() {
    print_status "Validating Terraform configuration..."
    
    cd "$TERRAFORM_DIR"
    
    if terraform validate; then
        print_success "Terraform validation completed"
    else
        print_error "Terraform validation failed"
        exit 1
    fi
}

# Function to plan Terraform deployment
terraform_plan() {
    print_status "Planning Terraform deployment for $ENVIRONMENT..."
    
    cd "$TERRAFORM_DIR"
    
    # Create plan file
    PLAN_FILE="$ENVIRONMENT.tfplan"
    
    if terraform plan -var-file="$TFVARS_FILE" -out="$PLAN_FILE"; then
        print_success "Terraform plan completed"
        print_status "Plan saved to: $PLAN_FILE"
    else
        print_error "Terraform plan failed"
        exit 1
    fi
}

# Function to apply Terraform deployment
terraform_apply() {
    print_status "Applying Terraform deployment for $ENVIRONMENT..."
    
    cd "$TERRAFORM_DIR"
    
    PLAN_FILE="$ENVIRONMENT.tfplan"
    
    # Check if plan file exists
    if [[ ! -f "$PLAN_FILE" ]]; then
        print_warning "Plan file not found. Running plan first..."
        terraform_plan
    fi
    
    # Apply with or without auto-approval
    if [[ "$AUTO_APPROVE" == "true" ]]; then
        if terraform apply -auto-approve "$PLAN_FILE"; then
            print_success "Terraform apply completed"
        else
            print_error "Terraform apply failed"
            exit 1
        fi
    else
        if terraform apply "$PLAN_FILE"; then
            print_success "Terraform apply completed"
        else
            print_error "Terraform apply failed"
            exit 1
        fi
    fi
    
    # Clean up plan file
    rm -f "$PLAN_FILE"
}

# Function to destroy Terraform deployment
terraform_destroy() {
    print_status "Destroying Terraform deployment for $ENVIRONMENT..."
    
    cd "$TERRAFORM_DIR"
    
    print_warning "This will destroy all resources in the $ENVIRONMENT environment!"
    
    if [[ "$AUTO_APPROVE" != "true" ]]; then
        read -p "Are you sure you want to destroy all resources? (yes/no): " -r
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            print_status "Destroy cancelled"
            exit 0
        fi
    fi
    
    if terraform destroy -var-file="$TFVARS_FILE" -auto-approve; then
        print_success "Terraform destroy completed"
    else
        print_error "Terraform destroy failed"
        exit 1
    fi
}

# Function to show outputs
show_outputs() {
    print_status "Showing Terraform outputs for $ENVIRONMENT..."
    
    cd "$TERRAFORM_DIR"
    
    if terraform output; then
        print_success "Outputs displayed"
    else
        print_error "Failed to show outputs"
        exit 1
    fi
}

# Function to format Terraform files
terraform_fmt() {
    print_status "Formatting Terraform files..."
    
    cd "$TERRAFORM_DIR"
    
    if terraform fmt -recursive; then
        print_success "Terraform files formatted"
    else
        print_error "Terraform formatting failed"
        exit 1
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [ENVIRONMENT] [ACTION] [AUTO_APPROVE]"
    echo ""
    echo "Arguments:"
    echo "  ENVIRONMENT    : development, staging, or production (default: production)"
    echo "  ACTION        : plan, apply, destroy, output, fmt, or validate (default: plan)"
    echo "  AUTO_APPROVE  : true or false (default: false)"
    echo ""
    echo "Examples:"
    echo "  $0 production plan"
    echo "  $0 staging apply"
    echo "  $0 development destroy true"
    echo "  $0 production output"
    echo "  $0 staging fmt"
    echo ""
    echo "Environment files:"
    echo "  - environments/development.tfvars"
    echo "  - environments/staging.tfvars"
    echo "  - environments/production.tfvars"
    echo ""
    echo "Before first use:"
    echo "  1. Copy terraform.tfvars.example to terraform.tfvars"
    echo "  2. Edit terraform.tfvars with your actual values"
    echo "  3. Run: $0 [environment] plan"
    echo "  4. Run: $0 [environment] apply"
}

# Main execution
main() {
    print_status "Starting Terraform deployment script..."
    print_status "Environment: $ENVIRONMENT"
    print_status "Action: $ACTION"
    print_status "Auto-approve: $AUTO_APPROVE"
    
    # Show usage if requested
    if [[ "$ACTION" == "help" || "$ACTION" == "-h" || "$ACTION" == "--help" ]]; then
        show_usage
        exit 0
    fi
    
    # Check prerequisites
    check_prerequisites
    
    # Validate environment
    validate_environment
    
    # Check tfvars file
    check_tfvars
    
    # Initialize Terraform
    terraform_init
    
    # Execute action
    case "$ACTION" in
        "plan")
            terraform_validate
            terraform_plan
            ;;
        "apply")
            terraform_validate
            terraform_plan
            terraform_apply
            show_outputs
            ;;
        "destroy")
            terraform_destroy
            ;;
        "output")
            show_outputs
            ;;
        "fmt")
            terraform_fmt
            ;;
        "validate")
            terraform_validate
            ;;
        *)
            print_error "Invalid action: $ACTION"
            show_usage
            exit 1
            ;;
    esac
    
    print_success "Script completed successfully!"
}

# Run main function
main "$@"