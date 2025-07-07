#!/bin/bash

# =============================================================================
# Rollback and Cleanup Utilities
# =============================================================================

set -euo pipefail

# Script configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly DEPLOY_DIR="${SCRIPT_DIR}/deploy"
readonly LOG_DIR="${SCRIPT_DIR}/logs"
readonly BACKUP_DIR="${LOG_DIR}/backups"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m' # No Color

# =============================================================================
# Logging Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}ℹ️  $*${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $*${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $*${NC}"
}

log_error() {
    echo -e "${RED}❌ $*${NC}"
}

# =============================================================================
# Rollback Management
# =============================================================================

# Create rollback metadata
create_rollback_metadata() {
    local platform="$1"
    local environment="$2"
    local deployment_id="$3"
    local current_deployment_url="${4:-}"
    local previous_deployment_id="${5:-}"
    
    local rollback_file="${BACKUP_DIR}/rollback_${deployment_id}.json"
    local timestamp=$(date -Iseconds)
    
    mkdir -p "${BACKUP_DIR}"
    
    cat > "${rollback_file}" << EOF
{
    "deployment_id": "${deployment_id}",
    "platform": "${platform}",
    "environment": "${environment}",
    "timestamp": "${timestamp}",
    "current_deployment_url": "${current_deployment_url}",
    "previous_deployment_id": "${previous_deployment_id}",
    "rollback_available": true,
    "rollback_tested": false,
    "created_by": "${USER:-unknown}",
    "rollback_commands": {
        "platform_specific": [],
        "cleanup_commands": [],
        "validation_commands": []
    },
    "backup_files": [],
    "configuration_snapshot": {}
}
EOF
    
    log_success "Rollback metadata created: ${rollback_file}"
    echo "${rollback_file}"
}

# Update rollback metadata
update_rollback_metadata() {
    local rollback_file="$1"
    local key="$2"
    local value="$3"
    
    if [[ ! -f "${rollback_file}" ]]; then
        log_error "Rollback file not found: ${rollback_file}"
        return 1
    fi
    
    if command -v jq &>/dev/null; then
        local temp_file="${rollback_file}.tmp"
        jq ".${key} = \"${value}\"" "${rollback_file}" > "${temp_file}" && mv "${temp_file}" "${rollback_file}"
        log_info "Updated rollback metadata: ${key} = ${value}"
    else
        log_warning "jq not available, cannot update rollback metadata"
    fi
}

# List available rollbacks
list_rollbacks() {
    local platform="${1:-}"
    local environment="${2:-}"
    
    log_info "Available rollbacks:"
    
    if [[ ! -d "${BACKUP_DIR}" ]]; then
        log_warning "No backup directory found"
        return 0
    fi
    
    local rollback_files
    rollback_files=$(find "${BACKUP_DIR}" -name "rollback_*.json" -type f 2>/dev/null | sort -r)
    
    if [[ -z "${rollback_files}" ]]; then
        log_warning "No rollback files found"
        return 0
    fi
    
    echo -e "${CYAN}Deployment ID                    Platform    Environment    Timestamp${NC}"
    echo "--------------------------------------------------------------------------------"
    
    while IFS= read -r rollback_file; do
        if command -v jq &>/dev/null; then
            local deployment_id platform_name environment_name timestamp rollback_available
            
            deployment_id=$(jq -r '.deployment_id // "unknown"' "${rollback_file}" 2>/dev/null)
            platform_name=$(jq -r '.platform // "unknown"' "${rollback_file}" 2>/dev/null)
            environment_name=$(jq -r '.environment // "unknown"' "${rollback_file}" 2>/dev/null)
            timestamp=$(jq -r '.timestamp // "unknown"' "${rollback_file}" 2>/dev/null)
            rollback_available=$(jq -r '.rollback_available // false' "${rollback_file}" 2>/dev/null)
            
            # Filter by platform and environment if specified
            if [[ -n "${platform}" && "${platform_name}" != "${platform}" ]]; then
                continue
            fi
            
            if [[ -n "${environment}" && "${environment_name}" != "${environment}" ]]; then
                continue
            fi
            
            local status_icon="❌"
            if [[ "${rollback_available}" == "true" ]]; then
                status_icon="✅"
            fi
            
            printf "%s %-30s %-10s %-12s %s\n" "${status_icon}" "${deployment_id}" "${platform_name}" "${environment_name}" "${timestamp}"
        else
            # Fallback without jq
            local filename
            filename=$(basename "${rollback_file}")
            echo "📄 ${filename}"
        fi
    done <<< "${rollback_files}"
}

# =============================================================================
# Platform-specific Rollback Functions
# =============================================================================

# AWS rollback
aws_rollback() {
    local deployment_id="$1"
    local rollback_file="$2"
    
    log_info "Performing AWS rollback for deployment: ${deployment_id}"
    
    if command -v jq &>/dev/null && [[ -f "${rollback_file}" ]]; then
        local platform environment
        platform=$(jq -r '.platform' "${rollback_file}")
        environment=$(jq -r '.environment' "${rollback_file}")
        
        # Implement AWS-specific rollback logic
        log_warning "AWS rollback requires manual intervention"
        log_info "Suggested steps:"
        echo "  1. Terminate current EC2 instances"
        echo "  2. Restore from previous AMI or launch configuration"
        echo "  3. Update load balancer targets"
        echo "  4. Verify application health"
        
        return 0
    fi
    
    log_error "Cannot perform AWS rollback without metadata"
    return 1
}

# Fly.io rollback
fly_rollback() {
    local deployment_id="$1"
    local rollback_file="$2"
    
    log_info "Performing Fly.io rollback for deployment: ${deployment_id}"
    
    if ! command -v flyctl &>/dev/null; then
        log_error "flyctl CLI not found"
        return 1
    fi
    
    # Check if fly.toml exists
    if [[ ! -f "${SCRIPT_DIR}/fly.toml" ]]; then
        log_error "fly.toml not found in project root"
        return 1
    fi
    
    # Get app name from fly.toml
    local app_name
    app_name=$(grep "^app" "${SCRIPT_DIR}/fly.toml" | cut -d'"' -f2)
    
    if [[ -z "${app_name}" ]]; then
        log_error "Cannot determine app name from fly.toml"
        return 1
    fi
    
    # List releases and rollback
    log_info "Getting release history for app: ${app_name}"
    flyctl releases list --app "${app_name}"
    
    echo -e "\n${YELLOW}Enter the version number to rollback to (or 'cancel' to abort):${NC}"
    read -r rollback_version
    
    if [[ "${rollback_version}" == "cancel" ]]; then
        log_info "Rollback cancelled"
        return 0
    fi
    
    if [[ -n "${rollback_version}" ]]; then
        log_info "Rolling back to version: ${rollback_version}"
        if flyctl releases rollback "${rollback_version}" --app "${app_name}"; then
            log_success "Fly.io rollback completed successfully"
            
            # Update rollback metadata
            update_rollback_metadata "${rollback_file}" "rollback_completed" "true"
            update_rollback_metadata "${rollback_file}" "rollback_version" "${rollback_version}"
            
            return 0
        else
            log_error "Fly.io rollback failed"
            return 1
        fi
    else
        log_error "No rollback version specified"
        return 1
    fi
}

# Railway rollback
railway_rollback() {
    local deployment_id="$1"
    local rollback_file="$2"
    
    log_info "Performing Railway rollback for deployment: ${deployment_id}"
    
    if ! command -v railway &>/dev/null; then
        log_error "Railway CLI not found"
        return 1
    fi
    
    # Railway doesn't have direct CLI rollback
    log_warning "Railway rollback requires git-based approach"
    log_info "Suggested steps:"
    echo "  1. Identify the previous working commit"
    echo "  2. git revert or git reset to that commit"
    echo "  3. git push to trigger redeployment"
    echo "  4. Monitor deployment in Railway dashboard"
    
    return 0
}

# Render rollback
render_rollback() {
    local deployment_id="$1"
    local rollback_file="$2"
    
    log_info "Performing Render rollback for deployment: ${deployment_id}"
    
    log_warning "Render rollback requires manual intervention"
    log_info "Suggested steps:"
    echo "  1. Go to Render dashboard"
    echo "  2. Navigate to your service"
    echo "  3. Go to 'Deploys' tab"
    echo "  4. Click 'Redeploy' on a previous successful deployment"
    echo "  5. Monitor deployment progress"
    
    return 0
}

# DigitalOcean rollback
digitalocean_rollback() {
    local deployment_id="$1"
    local rollback_file="$2"
    
    log_info "Performing DigitalOcean rollback for deployment: ${deployment_id}"
    
    if ! command -v doctl &>/dev/null; then
        log_error "doctl CLI not found"
        return 1
    fi
    
    if command -v jq &>/dev/null && [[ -f "${rollback_file}" ]]; then
        local environment
        environment=$(jq -r '.environment' "${rollback_file}")
        
        # For App Platform deployments
        log_info "Looking for DigitalOcean App Platform deployments..."
        local app_id
        app_id=$(doctl apps list --format ID,Name --no-header | grep "learning-assistant-${environment}" | cut -d' ' -f1 | head -1)
        
        if [[ -n "${app_id}" ]]; then
            log_info "Found app: ${app_id}"
            
            # List deployments
            doctl apps list-deployments "${app_id}"
            
            echo -e "\n${YELLOW}Enter the deployment ID to rollback to (or 'cancel' to abort):${NC}"
            read -r rollback_deployment_id
            
            if [[ "${rollback_deployment_id}" == "cancel" ]]; then
                log_info "Rollback cancelled"
                return 0
            fi
            
            if [[ -n "${rollback_deployment_id}" ]]; then
                log_warning "DigitalOcean App Platform does not support direct rollback"
                log_info "You need to redeploy from a previous commit or app spec"
                return 1
            fi
        else
            log_warning "No DigitalOcean App Platform apps found for environment: ${environment}"
        fi
        
        # For Droplet deployments
        log_info "For Droplet deployments, consider:"
        echo "  1. Create a snapshot of current droplet (backup)"
        echo "  2. Restore from a previous snapshot"
        echo "  3. Rebuild droplet from previous configuration"
    fi
    
    return 1
}

# =============================================================================
# Generic Rollback Function
# =============================================================================

# Perform rollback
perform_rollback() {
    local deployment_id="$1"
    local force="${2:-false}"
    
    log_info "Initiating rollback for deployment: ${deployment_id}"
    
    # Find rollback metadata
    local rollback_file="${BACKUP_DIR}/rollback_${deployment_id}.json"
    
    if [[ ! -f "${rollback_file}" ]]; then
        log_error "Rollback metadata not found: ${rollback_file}"
        log_info "Available rollbacks:"
        list_rollbacks
        return 1
    fi
    
    # Load rollback metadata
    local platform environment rollback_available
    
    if command -v jq &>/dev/null; then
        platform=$(jq -r '.platform' "${rollback_file}")
        environment=$(jq -r '.environment' "${rollback_file}")
        rollback_available=$(jq -r '.rollback_available // false' "${rollback_file}")
    else
        log_error "jq not available, cannot parse rollback metadata"
        return 1
    fi
    
    # Check if rollback is available
    if [[ "${rollback_available}" != "true" && "${force}" != "true" ]]; then
        log_error "Rollback not available for deployment: ${deployment_id}"
        log_info "Use --force to attempt rollback anyway"
        return 1
    fi
    
    # Confirm rollback
    if [[ "${force}" != "true" ]]; then
        echo -e "${YELLOW}⚠️  Are you sure you want to rollback deployment ${deployment_id}? [y/N]${NC}"
        read -r confirmation
        
        if [[ ! "${confirmation}" =~ ^[Yy]$ ]]; then
            log_info "Rollback cancelled"
            return 0
        fi
    fi
    
    # Perform platform-specific rollback
    log_info "Performing rollback for platform: ${platform}"
    
    case "${platform}" in
        "aws")
            aws_rollback "${deployment_id}" "${rollback_file}"
            ;;
        "fly")
            fly_rollback "${deployment_id}" "${rollback_file}"
            ;;
        "railway")
            railway_rollback "${deployment_id}" "${rollback_file}"
            ;;
        "render")
            render_rollback "${deployment_id}" "${rollback_file}"
            ;;
        "digitalocean")
            digitalocean_rollback "${deployment_id}" "${rollback_file}"
            ;;
        "gcp")
            log_warning "GCP rollback requires manual intervention through Cloud Console"
            ;;
        "azure")
            log_warning "Azure rollback requires manual intervention through Azure Portal"
            ;;
        "linode")
            log_warning "Linode rollback requires manual intervention through Linode Manager"
            ;;
        *)
            log_error "Unsupported platform for rollback: ${platform}"
            return 1
            ;;
    esac
}

# =============================================================================
# Cleanup Functions
# =============================================================================

# Clean up deployment artifacts
cleanup_deployment() {
    local deployment_id="$1"
    local keep_logs="${2:-true}"
    
    log_info "Cleaning up deployment artifacts for: ${deployment_id}"
    
    # Remove temporary files
    local temp_files
    temp_files=$(find "${SCRIPT_DIR}/tmp" -name "*${deployment_id}*" 2>/dev/null || true)
    
    if [[ -n "${temp_files}" ]]; then
        echo "${temp_files}" | while read -r temp_file; do
            rm -f "${temp_file}"
            log_debug "Removed temp file: ${temp_file}"
        done
    fi
    
    # Clean up Docker images
    cleanup_docker_images "${deployment_id}"
    
    # Remove configuration backups older than 30 days
    find "${BACKUP_DIR}" -name "*.json" -mtime +30 -delete 2>/dev/null || true
    
    # Clean up logs if requested
    if [[ "${keep_logs}" != "true" ]]; then
        local log_files
        log_files=$(find "${LOG_DIR}" -name "*${deployment_id}*" 2>/dev/null || true)
        
        if [[ -n "${log_files}" ]]; then
            echo "${log_files}" | while read -r log_file; do
                rm -f "${log_file}"
                log_debug "Removed log file: ${log_file}"
            done
        fi
    fi
    
    log_success "Cleanup completed for deployment: ${deployment_id}"
}

# Clean up Docker images
cleanup_docker_images() {
    local deployment_id="$1"
    
    if command -v docker &>/dev/null; then
        log_info "Cleaning up Docker images for deployment: ${deployment_id}"
        
        # Remove images tagged with deployment ID
        local images
        images=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep "${deployment_id}" || true)
        
        if [[ -n "${images}" ]]; then
            echo "${images}" | while read -r image; do
                if docker rmi "${image}" 2>/dev/null; then
                    log_debug "Removed Docker image: ${image}"
                fi
            done
        fi
        
        # Clean up dangling images
        if docker images -f "dangling=true" -q | head -1 > /dev/null; then
            docker image prune -f &>/dev/null || true
            log_debug "Cleaned up dangling Docker images"
        fi
    fi
}

# Clean up all deployments for an environment
cleanup_environment() {
    local platform="$1"
    local environment="$2"
    local force="${3:-false}"
    
    log_info "Cleaning up all deployments for ${platform}/${environment}"
    
    if [[ "${force}" != "true" ]]; then
        echo -e "${YELLOW}⚠️  This will clean up ALL deployments for ${platform}/${environment}. Continue? [y/N]${NC}"
        read -r confirmation
        
        if [[ ! "${confirmation}" =~ ^[Yy]$ ]]; then
            log_info "Cleanup cancelled"
            return 0
        fi
    fi
    
    # Find all rollback files for the platform/environment
    local rollback_files
    rollback_files=$(find "${BACKUP_DIR}" -name "rollback_*.json" -type f 2>/dev/null || true)
    
    if [[ -n "${rollback_files}" ]]; then
        echo "${rollback_files}" | while read -r rollback_file; do
            if command -v jq &>/dev/null; then
                local file_platform file_environment deployment_id
                file_platform=$(jq -r '.platform // ""' "${rollback_file}" 2>/dev/null)
                file_environment=$(jq -r '.environment // ""' "${rollback_file}" 2>/dev/null)
                deployment_id=$(jq -r '.deployment_id // ""' "${rollback_file}" 2>/dev/null)
                
                if [[ "${file_platform}" == "${platform}" && "${file_environment}" == "${environment}" ]]; then
                    log_info "Cleaning up deployment: ${deployment_id}"
                    cleanup_deployment "${deployment_id}" false
                    rm -f "${rollback_file}"
                fi
            fi
        done
    fi
    
    # Platform-specific cleanup
    case "${platform}" in
        "aws")
            log_info "AWS cleanup requires manual resource removal through AWS Console"
            ;;
        "fly")
            if command -v flyctl &>/dev/null; then
                log_info "Consider removing Fly.io apps manually with: flyctl apps destroy <app-name>"
            fi
            ;;
        "railway")
            if command -v railway &>/dev/null; then
                log_info "Consider removing Railway services manually through dashboard"
            fi
            ;;
        *)
            log_info "Manual cleanup may be required for platform: ${platform}"
            ;;
    esac
    
    log_success "Environment cleanup completed"
}

# =============================================================================
# Emergency Procedures
# =============================================================================

# Emergency rollback (fastest possible rollback)
emergency_rollback() {
    local deployment_id="$1"
    
    log_warning "🚨 EMERGENCY ROLLBACK INITIATED 🚨"
    log_info "Deployment ID: ${deployment_id}"
    
    # Skip confirmations and checks
    perform_rollback "${deployment_id}" "true"
    
    # Immediate cleanup
    cleanup_deployment "${deployment_id}" "true"
    
    log_warning "Emergency rollback completed - verify system status"
}

# =============================================================================
# CLI Interface
# =============================================================================

show_usage() {
    cat << EOF
Rollback and Cleanup Utilities

Usage: $0 <command> [options]

Commands:
    list [platform] [environment]     - List available rollbacks
    rollback <deployment_id> [--force] - Perform rollback
    cleanup <deployment_id> [--keep-logs] - Clean up deployment artifacts
    cleanup-env <platform> <environment> [--force] - Clean up environment
    emergency <deployment_id>         - Emergency rollback (skip confirmations)
    
Examples:
    $0 list                          - List all rollbacks
    $0 list fly production           - List rollbacks for fly/production
    $0 rollback fly_production_123   - Rollback specific deployment
    $0 cleanup fly_production_123    - Clean up deployment artifacts
    $0 emergency fly_production_123  - Emergency rollback

EOF
}

# Main function
main() {
    local command="${1:-help}"
    
    # Ensure directories exist
    mkdir -p "${LOG_DIR}" "${BACKUP_DIR}"
    
    case "${command}" in
        "list")
            list_rollbacks "${2:-}" "${3:-}"
            ;;
        "rollback")
            if [[ -z "${2:-}" ]]; then
                log_error "Deployment ID required"
                show_usage
                exit 1
            fi
            local force="false"
            if [[ "${3:-}" == "--force" ]]; then
                force="true"
            fi
            perform_rollback "${2}" "${force}"
            ;;
        "cleanup")
            if [[ -z "${2:-}" ]]; then
                log_error "Deployment ID required"
                show_usage
                exit 1
            fi
            local keep_logs="true"
            if [[ "${3:-}" == "--no-keep-logs" ]]; then
                keep_logs="false"
            fi
            cleanup_deployment "${2}" "${keep_logs}"
            ;;
        "cleanup-env")
            if [[ -z "${2:-}" || -z "${3:-}" ]]; then
                log_error "Platform and environment required"
                show_usage
                exit 1
            fi
            local force="false"
            if [[ "${4:-}" == "--force" ]]; then
                force="true"
            fi
            cleanup_environment "${2}" "${3}" "${force}"
            ;;
        "emergency")
            if [[ -z "${2:-}" ]]; then
                log_error "Deployment ID required"
                show_usage
                exit 1
            fi
            emergency_rollback "${2}"
            ;;
        "help"|*)
            show_usage
            ;;
    esac
}

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi