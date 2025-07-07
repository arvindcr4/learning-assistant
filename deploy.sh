#!/bin/bash

# =============================================================================
# Learning Assistant - Unified Deployment Orchestrator
# =============================================================================
# A comprehensive deployment script supporting multiple cloud platforms:
# AWS, GCP, Azure, Linode, DigitalOcean, Railway, Fly.io, and Render
# =============================================================================

set -euo pipefail

# Script configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly DEPLOY_DIR="${SCRIPT_DIR}/deploy"
readonly LOG_DIR="${SCRIPT_DIR}/logs"
readonly CONFIG_DIR="${SCRIPT_DIR}/deploy/config"
readonly TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
readonly LOG_FILE="${LOG_DIR}/deploy_${TIMESTAMP}.log"

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m' # No Color

# Platform configuration
readonly SUPPORTED_PLATFORMS=(
    "aws"
    "gcp"
    "azure"
    "linode"
    "digitalocean"
    "railway"
    "fly"
    "render"
)

# Default values
DEFAULT_PLATFORM=""
DEFAULT_ENVIRONMENT="production"
DEFAULT_REGION=""
DEFAULT_INSTANCE_TYPE=""
DRY_RUN=false
VERBOSE=false
FORCE=false
SKIP_HEALTH_CHECK=false
SKIP_VALIDATION=false
ENABLE_ROLLBACK=true
CLEANUP_ON_FAILURE=true

# =============================================================================
# Utility Functions
# =============================================================================

# Logging functions
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo -e "${timestamp} [${level}] ${message}" | tee -a "${LOG_FILE}"
}

log_info() {
    log "INFO" "${BLUE}ℹ️  $*${NC}"
}

log_success() {
    log "SUCCESS" "${GREEN}✅ $*${NC}"
}

log_warning() {
    log "WARNING" "${YELLOW}⚠️  $*${NC}"
}

log_error() {
    log "ERROR" "${RED}❌ $*${NC}"
}

log_debug() {
    if [[ "${VERBOSE}" == "true" ]]; then
        log "DEBUG" "${CYAN}🔍 $*${NC}"
    fi
}

# Progress indicators
show_progress() {
    local message="$1"
    local duration="${2:-3}"
    
    log_info "$message"
    for ((i=1; i<=duration; i++)); do
        echo -ne "${BLUE}$message... ${i}/${duration}${NC}\r"
        sleep 1
    done
    echo -e "${GREEN}$message... Complete!${NC}"
}

# Error handling
handle_error() {
    local exit_code=$?
    local line_number=$1
    
    log_error "An error occurred on line ${line_number}. Exit code: ${exit_code}"
    
    if [[ "${CLEANUP_ON_FAILURE}" == "true" ]]; then
        cleanup_on_failure
    fi
    
    exit "${exit_code}"
}

trap 'handle_error ${LINENO}' ERR

# =============================================================================
# Platform Detection and Validation
# =============================================================================

detect_platform() {
    local platform_indicators=(
        "fly.toml:fly"
        "render.yaml:render"
        "railway.json:railway"
        "gcp-config.yaml:gcp"
        "azure-config.yaml:azure"
        "aws-config.yaml:aws"
        "linode-config.yaml:linode"
        "digitalocean-config.yaml:digitalocean"
    )
    
    for indicator in "${platform_indicators[@]}"; do
        local file="${indicator%:*}"
        local platform="${indicator#*:}"
        
        if [[ -f "${SCRIPT_DIR}/${file}" ]]; then
            echo "${platform}"
            return
        fi
    done
    
    log_warning "No platform configuration detected. Please specify platform explicitly."
    return 1
}

validate_platform() {
    local platform="$1"
    
    for supported in "${SUPPORTED_PLATFORMS[@]}"; do
        if [[ "${platform}" == "${supported}" ]]; then
            return 0
        fi
    done
    
    log_error "Unsupported platform: ${platform}"
    log_info "Supported platforms: ${SUPPORTED_PLATFORMS[*]}"
    return 1
}

# =============================================================================
# Environment Management
# =============================================================================

load_environment_config() {
    local platform="$1"
    local environment="$2"
    
    local config_file="${CONFIG_DIR}/${platform}/${environment}.env"
    
    if [[ -f "${config_file}" ]]; then
        log_info "Loading environment configuration from ${config_file}"
        source "${config_file}"
    else
        log_warning "Environment configuration file not found: ${config_file}"
        log_info "Creating default configuration..."
        create_default_config "${platform}" "${environment}"
    fi
}

create_default_config() {
    local platform="$1"
    local environment="$2"
    
    mkdir -p "${CONFIG_DIR}/${platform}"
    local config_file="${CONFIG_DIR}/${platform}/${environment}.env"
    
    cat > "${config_file}" << EOF
# ${platform} ${environment} Configuration
# Generated automatically on $(date)

# Application settings
APP_NAME=learning-assistant
APP_VERSION=1.0.0
NODE_ENV=${environment}
PORT=3000

# Database settings
DATABASE_URL="sqlite:./app.db"

# Security settings
BETTER_AUTH_SECRET="\$(openssl rand -hex 32)"
NEXT_TELEMETRY_DISABLED=1

# Feature flags
FEATURE_ANALYTICS_ENABLED=true
FEATURE_RECOMMENDATIONS_ENABLED=true
FEATURE_CHAT_ENABLED=false

# Platform-specific settings
PLATFORM=${platform}
ENVIRONMENT=${environment}
DEPLOY_TIMESTAMP=${TIMESTAMP}
EOF
    
    log_success "Created default configuration: ${config_file}"
}

validate_environment() {
    local required_vars=(
        "APP_NAME"
        "NODE_ENV"
        "PORT"
        "DATABASE_URL"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("${var}")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_error "Missing required environment variables: ${missing_vars[*]}"
        return 1
    fi
    
    log_success "Environment validation passed"
    return 0
}

# =============================================================================
# Pre-deployment Checks
# =============================================================================

check_dependencies() {
    local platform="$1"
    local missing_deps=()
    
    # Common dependencies
    local common_deps=("curl" "git" "docker")
    
    # Platform-specific dependencies
    case "${platform}" in
        "aws")
            common_deps+=("aws")
            ;;
        "gcp")
            common_deps+=("gcloud")
            ;;
        "azure")
            common_deps+=("az")
            ;;
        "fly")
            common_deps+=("flyctl")
            ;;
        "railway")
            common_deps+=("railway")
            ;;
        "linode")
            common_deps+=("linode-cli")
            ;;
        "digitalocean")
            common_deps+=("doctl")
            ;;
    esac
    
    for dep in "${common_deps[@]}"; do
        if ! command -v "${dep}" &> /dev/null; then
            missing_deps+=("${dep}")
        fi
    done
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        log_info "Please install missing dependencies and try again."
        return 1
    fi
    
    log_success "All dependencies are available"
    return 0
}

validate_docker_config() {
    if [[ ! -f "${SCRIPT_DIR}/Dockerfile" ]]; then
        log_error "Dockerfile not found in project root"
        return 1
    fi
    
    # Test Docker build
    log_info "Validating Docker configuration..."
    if ! docker build -t learning-assistant:test -f "${SCRIPT_DIR}/Dockerfile" "${SCRIPT_DIR}" &>/dev/null; then
        log_error "Docker build failed"
        return 1
    fi
    
    # Cleanup test image
    docker rmi learning-assistant:test &>/dev/null || true
    
    log_success "Docker configuration is valid"
    return 0
}

validate_application_config() {
    local required_files=(
        "package.json"
        "next.config.ts"
        "tsconfig.json"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "${SCRIPT_DIR}/${file}" ]]; then
            log_error "Required file not found: ${file}"
            return 1
        fi
    done
    
    # Check if package.json has required scripts
    if ! grep -q '"build"' "${SCRIPT_DIR}/package.json"; then
        log_error "package.json missing build script"
        return 1
    fi
    
    log_success "Application configuration is valid"
    return 0
}

# =============================================================================
# Platform-specific Deployment Functions
# =============================================================================

deploy_aws() {
    log_info "Deploying to AWS..."
    source "${DEPLOY_DIR}/platforms/aws.sh"
    aws_deploy "$@"
}

deploy_gcp() {
    log_info "Deploying to Google Cloud Platform..."
    source "${DEPLOY_DIR}/platforms/gcp.sh"
    gcp_deploy "$@"
}

deploy_azure() {
    log_info "Deploying to Microsoft Azure..."
    source "${DEPLOY_DIR}/platforms/azure.sh"
    azure_deploy "$@"
}

deploy_linode() {
    log_info "Deploying to Linode..."
    source "${DEPLOY_DIR}/platforms/linode.sh"
    linode_deploy "$@"
}

deploy_digitalocean() {
    log_info "Deploying to DigitalOcean..."
    source "${DEPLOY_DIR}/platforms/digitalocean.sh"
    digitalocean_deploy "$@"
}

deploy_railway() {
    log_info "Deploying to Railway..."
    source "${DEPLOY_DIR}/platforms/railway.sh"
    railway_deploy "$@"
}

deploy_fly() {
    log_info "Deploying to Fly.io..."
    source "${DEPLOY_DIR}/platforms/fly.sh"
    fly_deploy "$@"
}

deploy_render() {
    log_info "Deploying to Render..."
    source "${DEPLOY_DIR}/platforms/render.sh"
    render_deploy "$@"
}

# =============================================================================
# Health Checks
# =============================================================================

perform_health_check() {
    local url="$1"
    local max_attempts="${2:-30}"
    local wait_time="${3:-10}"
    
    log_info "Performing health check on ${url}"
    
    for ((i=1; i<=max_attempts; i++)); do
        if curl -f -s "${url}/api/health" > /dev/null 2>&1; then
            log_success "Health check passed (attempt ${i}/${max_attempts})"
            return 0
        fi
        
        log_info "Health check failed (attempt ${i}/${max_attempts}), retrying in ${wait_time}s..."
        sleep "${wait_time}"
    done
    
    log_error "Health check failed after ${max_attempts} attempts"
    return 1
}

# =============================================================================
# Rollback Functions
# =============================================================================

create_rollback_point() {
    local platform="$1"
    local deployment_id="$2"
    
    local rollback_file="${LOG_DIR}/rollback_${platform}_${deployment_id}.json"
    
    cat > "${rollback_file}" << EOF
{
    "platform": "${platform}",
    "deployment_id": "${deployment_id}",
    "timestamp": "${TIMESTAMP}",
    "rollback_available": true,
    "rollback_commands": []
}
EOF
    
    log_info "Rollback point created: ${rollback_file}"
}

perform_rollback() {
    local platform="$1"
    local deployment_id="$2"
    
    log_warning "Initiating rollback for ${platform} deployment ${deployment_id}"
    
    case "${platform}" in
        "fly")
            flyctl deploy --config fly.toml --strategy rolling
            ;;
        "railway")
            railway rollback
            ;;
        "render")
            log_warning "Render rollback must be performed manually via dashboard"
            ;;
        *)
            log_warning "Rollback for ${platform} must be performed manually"
            ;;
    esac
}

# =============================================================================
# Cleanup Functions
# =============================================================================

cleanup_on_failure() {
    log_warning "Cleaning up after deployment failure..."
    
    # Stop any running containers
    if docker ps -q --filter name=learning-assistant-temp &>/dev/null; then
        docker stop learning-assistant-temp &>/dev/null || true
        docker rm learning-assistant-temp &>/dev/null || true
    fi
    
    # Remove temporary files
    find "${SCRIPT_DIR}" -name "*.tmp" -delete 2>/dev/null || true
    
    log_info "Cleanup completed"
}

# =============================================================================
# Main Deployment Function
# =============================================================================

main_deploy() {
    local platform="$1"
    local environment="$2"
    
    log_info "Starting deployment for ${platform} (${environment})"
    
    # Pre-deployment checks
    if [[ "${SKIP_VALIDATION}" != "true" ]]; then
        log_info "Running pre-deployment validation..."
        check_dependencies "${platform}"
        validate_application_config
        validate_docker_config
    fi
    
    # Load environment configuration
    load_environment_config "${platform}" "${environment}"
    validate_environment
    
    # Create deployment tracking
    local deployment_id="${platform}_${environment}_${TIMESTAMP}"
    create_rollback_point "${platform}" "${deployment_id}"
    
    # Platform-specific deployment
    case "${platform}" in
        "aws")
            deploy_aws "${environment}" "${deployment_id}"
            ;;
        "gcp")
            deploy_gcp "${environment}" "${deployment_id}"
            ;;
        "azure")
            deploy_azure "${environment}" "${deployment_id}"
            ;;
        "linode")
            deploy_linode "${environment}" "${deployment_id}"
            ;;
        "digitalocean")
            deploy_digitalocean "${environment}" "${deployment_id}"
            ;;
        "railway")
            deploy_railway "${environment}" "${deployment_id}"
            ;;
        "fly")
            deploy_fly "${environment}" "${deployment_id}"
            ;;
        "render")
            deploy_render "${environment}" "${deployment_id}"
            ;;
        *)
            log_error "Unsupported platform: ${platform}"
            return 1
            ;;
    esac
    
    # Post-deployment health check
    if [[ "${SKIP_HEALTH_CHECK}" != "true" ]]; then
        local app_url="${DEPLOYMENT_URL:-}"
        if [[ -n "${app_url}" ]]; then
            perform_health_check "${app_url}"
        else
            log_warning "No deployment URL available for health check"
        fi
    fi
    
    log_success "Deployment completed successfully!"
    log_info "Deployment ID: ${deployment_id}"
    log_info "Log file: ${LOG_FILE}"
}

# =============================================================================
# CLI Interface
# =============================================================================

show_usage() {
    cat << EOF
Learning Assistant - Unified Deployment Orchestrator

Usage: $0 [OPTIONS] <platform> [environment]

Platforms:
    aws          - Amazon Web Services
    gcp          - Google Cloud Platform
    azure        - Microsoft Azure
    linode       - Linode
    digitalocean - DigitalOcean
    railway      - Railway
    fly          - Fly.io
    render       - Render

Options:
    -e, --environment ENV     Deployment environment (default: production)
    -r, --region REGION       Deployment region
    -i, --instance-type TYPE  Instance type for cloud deployments
    -n, --dry-run             Show what would be done without executing
    -v, --verbose             Enable verbose logging
    -f, --force               Force deployment even if validation fails
    --skip-health-check       Skip post-deployment health check
    --skip-validation         Skip pre-deployment validation
    --no-rollback             Disable rollback capability
    --no-cleanup              Don't cleanup on failure
    -h, --help                Show this help message

Examples:
    $0 fly production
    $0 aws staging --region us-east-1
    $0 gcp --instance-type n1-standard-1 --verbose
    $0 railway --dry-run

EOF
}

# Parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                DEFAULT_ENVIRONMENT="$2"
                shift 2
                ;;
            -r|--region)
                DEFAULT_REGION="$2"
                shift 2
                ;;
            -i|--instance-type)
                DEFAULT_INSTANCE_TYPE="$2"
                shift 2
                ;;
            -n|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -f|--force)
                FORCE=true
                shift
                ;;
            --skip-health-check)
                SKIP_HEALTH_CHECK=true
                shift
                ;;
            --skip-validation)
                SKIP_VALIDATION=true
                shift
                ;;
            --no-rollback)
                ENABLE_ROLLBACK=false
                shift
                ;;
            --no-cleanup)
                CLEANUP_ON_FAILURE=false
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            -*)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
            *)
                if [[ -z "${DEFAULT_PLATFORM}" ]]; then
                    DEFAULT_PLATFORM="$1"
                elif [[ -z "${DEFAULT_ENVIRONMENT}" ]]; then
                    DEFAULT_ENVIRONMENT="$1"
                else
                    log_error "Too many arguments: $1"
                    show_usage
                    exit 1
                fi
                shift
                ;;
        esac
    done
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    # Create necessary directories
    mkdir -p "${LOG_DIR}" "${CONFIG_DIR}" "${DEPLOY_DIR}"
    
    # Initialize log file
    echo "Learning Assistant Deployment Log - $(date)" > "${LOG_FILE}"
    
    # Parse arguments
    parse_arguments "$@"
    
    # Determine platform
    if [[ -z "${DEFAULT_PLATFORM}" ]]; then
        log_info "No platform specified, attempting auto-detection..."
        DEFAULT_PLATFORM=$(detect_platform) || {
            log_error "Platform detection failed and no platform specified"
            show_usage
            exit 1
        }
        log_info "Detected platform: ${DEFAULT_PLATFORM}"
    fi
    
    # Validate platform
    validate_platform "${DEFAULT_PLATFORM}"
    
    # Set default environment if not specified
    DEFAULT_ENVIRONMENT="${DEFAULT_ENVIRONMENT:-production}"
    
    # Show configuration
    log_info "Deployment Configuration:"
    log_info "  Platform: ${DEFAULT_PLATFORM}"
    log_info "  Environment: ${DEFAULT_ENVIRONMENT}"
    log_info "  Region: ${DEFAULT_REGION:-auto}"
    log_info "  Instance Type: ${DEFAULT_INSTANCE_TYPE:-auto}"
    log_info "  Dry Run: ${DRY_RUN}"
    log_info "  Verbose: ${VERBOSE}"
    log_info "  Skip Health Check: ${SKIP_HEALTH_CHECK}"
    log_info "  Skip Validation: ${SKIP_VALIDATION}"
    log_info "  Enable Rollback: ${ENABLE_ROLLBACK}"
    log_info "  Cleanup on Failure: ${CLEANUP_ON_FAILURE}"
    
    # Dry run mode
    if [[ "${DRY_RUN}" == "true" ]]; then
        log_info "DRY RUN MODE - No actual deployment will be performed"
        log_info "Would deploy to: ${DEFAULT_PLATFORM} (${DEFAULT_ENVIRONMENT})"
        exit 0
    fi
    
    # Confirm deployment
    if [[ "${FORCE}" != "true" ]]; then
        echo -e "${YELLOW}⚠️  Ready to deploy to ${DEFAULT_PLATFORM} (${DEFAULT_ENVIRONMENT}). Continue? [y/N]${NC}"
        read -r confirmation
        if [[ ! "${confirmation}" =~ ^[Yy]$ ]]; then
            log_info "Deployment cancelled by user"
            exit 0
        fi
    fi
    
    # Start deployment
    log_info "Starting deployment process..."
    main_deploy "${DEFAULT_PLATFORM}" "${DEFAULT_ENVIRONMENT}"
    
    log_success "All deployment tasks completed successfully!"
}

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi