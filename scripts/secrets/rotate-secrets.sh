#!/bin/bash

# Secret Rotation Script for Learning Assistant
# This script handles manual and emergency secret rotation

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VAULT_ADDR=${VAULT_ADDR:-"http://127.0.0.1:8200"}
VAULT_NAMESPACE=${VAULT_NAMESPACE:-"learning-assistant"}
BACKUP_DIR="$SCRIPT_DIR/rotation-backups"

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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if vault is installed
    if ! command -v vault >/dev/null 2>&1; then
        log_error "HashiCorp Vault CLI is not installed"
        exit 1
    fi
    
    # Check if jq is installed
    if ! command -v jq >/dev/null 2>&1; then
        log_error "jq is not installed (required for JSON processing)"
        exit 1
    fi
    
    # Check Vault connection
    if ! vault status >/dev/null 2>&1; then
        log_error "Cannot connect to Vault at $VAULT_ADDR"
        log_error "Make sure Vault is running and VAULT_ADDR is correct"
        exit 1
    fi
    
    # Check if Vault is unsealed
    if vault status | grep -q "Sealed.*true"; then
        log_error "Vault is sealed. Please unseal it first."
        exit 1
    fi
    
    # Check authentication
    if ! vault token lookup >/dev/null 2>&1; then
        log_error "Not authenticated to Vault. Please set VAULT_TOKEN."
        exit 1
    fi
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    log_success "Prerequisites check passed"
}

# Backup current secret
backup_secret() {
    local secret_name="$1"
    local backup_file="$BACKUP_DIR/${secret_name}_$(date +%Y%m%d_%H%M%S).json"
    
    log_info "Backing up secret: $secret_name"
    
    if vault kv get -format=json "$VAULT_NAMESPACE/$secret_name" > "$backup_file" 2>/dev/null; then
        log_success "Secret backed up to: $backup_file"
        echo "$backup_file"
    else
        log_warning "Failed to backup secret: $secret_name (may not exist)"
        echo ""
    fi
}

# Generate new secret value based on type
generate_secret_value() {
    local secret_type="$1"
    local current_value="${2:-}"
    
    case "$secret_type" in
        "resend-api-key")
            echo "re_$(openssl rand -hex 32)"
            ;;
        "tambo-api-key")
            echo "tambo_$(openssl rand -base64 48 | tr -d '=' | tr '+/' '-_')"
            ;;
        "lingo-dev-api-key")
            echo "lingo_$(openssl rand -hex 32)"
            ;;
        "firecrawl-api-key")
            echo "fc_$(openssl rand -hex 32)"
            ;;
        "better-auth-secret"|"jwt-secret"|"jwt-refresh-secret"|"csrf-secret")
            openssl rand -hex 32
            ;;
        "supabase-service-role-key")
            echo "eyJ$(openssl rand -base64 64 | tr -d '=' | tr '+/' '-_')"
            ;;
        "database-password")
            # Generate strong password
            openssl rand -base64 32 | tr -d '=+/' | cut -c1-20
            ;;
        "api-key")
            openssl rand -hex 32
            ;;
        *)
            # Default: hex string
            openssl rand -hex 32
            ;;
    esac
}

# Rotate a single secret
rotate_secret() {
    local secret_name="$1"
    local secret_type="${2:-api-key}"
    local force="${3:-false}"
    
    log_info "Rotating secret: $secret_name (type: $secret_type)"
    
    # Backup current secret
    local backup_file
    backup_file=$(backup_secret "$secret_name")
    
    # Get current secret metadata
    local current_metadata=""
    if [[ -n "$backup_file" && -f "$backup_file" ]]; then
        current_metadata=$(jq -r '.data.metadata // {}' "$backup_file" 2>/dev/null || echo '{}')
    fi
    
    # Generate new secret value
    local new_value
    new_value=$(generate_secret_value "$secret_type")
    
    # Create metadata
    local rotation_metadata
    rotation_metadata=$(cat <<EOF
{
  "rotated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "rotated_by": "${USER:-script}",
  "rotation_type": "manual",
  "backup_file": "$(basename "$backup_file")",
  "secret_type": "$secret_type"
}
EOF
)
    
    # Store new secret in Vault
    if vault kv put "$VAULT_NAMESPACE/$secret_name" \
        value="$new_value" \
        rotation_metadata="$rotation_metadata"; then
        
        log_success "Secret rotated successfully: $secret_name"
        
        # Store rotation record
        local rotation_record="$BACKUP_DIR/rotation_${secret_name}_$(date +%Y%m%d_%H%M%S).json"
        cat > "$rotation_record" <<EOF
{
  "secret_name": "$secret_name",
  "secret_type": "$secret_type",
  "rotated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "rotated_by": "${USER:-script}",
  "backup_file": "$(basename "$backup_file")",
  "rotation_type": "manual",
  "success": true
}
EOF
        
        return 0
    else
        log_error "Failed to rotate secret: $secret_name"
        return 1
    fi
}

# Rotate multiple secrets
rotate_multiple() {
    local secrets=("$@")
    local success_count=0
    local failure_count=0
    
    log_info "Rotating ${#secrets[@]} secrets..."
    
    for secret_spec in "${secrets[@]}"; do
        # Parse secret specification (name:type format)
        local secret_name
        local secret_type="api-key"
        
        if [[ "$secret_spec" == *":"* ]]; then
            secret_name="${secret_spec%:*}"
            secret_type="${secret_spec#*:}"
        else
            secret_name="$secret_spec"
        fi
        
        if rotate_secret "$secret_name" "$secret_type"; then
            ((success_count++))
        else
            ((failure_count++))
        fi
        
        # Small delay between rotations
        sleep 1
    done
    
    log_info "Rotation complete: $success_count successful, $failure_count failed"
    
    if [[ $failure_count -gt 0 ]]; then
        return 1
    fi
    
    return 0
}

# Emergency rotation of all secrets
emergency_rotate_all() {
    log_warning "EMERGENCY ROTATION: Rotating ALL secrets!"
    log_warning "This will invalidate all current API keys and secrets."
    
    if [[ "${FORCE_EMERGENCY:-}" != "true" ]]; then
        read -p "Are you sure you want to proceed? (type 'yes' to continue): " -r
        if [[ ! $REPLY == "yes" ]]; then
            log_info "Emergency rotation cancelled"
            return 0
        fi
    fi
    
    # Define all secrets to rotate
    local all_secrets=(
        "resend-api-key:resend-api-key"
        "tambo-api-key:tambo-api-key"
        "lingo-dev-api-key:lingo-dev-api-key"
        "firecrawl-api-key:firecrawl-api-key"
        "better-auth-secret:better-auth-secret"
        "jwt-secret:jwt-secret"
        "jwt-refresh-secret:jwt-refresh-secret"
        "csrf-secret:csrf-secret"
        "supabase-service-role-key:supabase-service-role-key"
    )
    
    # Create emergency rotation log
    local emergency_log="$BACKUP_DIR/emergency_rotation_$(date +%Y%m%d_%H%M%S).log"
    
    {
        echo "Emergency Rotation Started: $(date)"
        echo "Initiated by: ${USER:-script}"
        echo "Reason: ${EMERGENCY_REASON:-Manual emergency rotation}"
        echo "=================================="
    } > "$emergency_log"
    
    local emergency_success=0
    local emergency_failures=0
    
    for secret_spec in "${all_secrets[@]}"; do
        local secret_name="${secret_spec%:*}"
        local secret_type="${secret_spec#*:}"
        
        echo "Rotating: $secret_name" >> "$emergency_log"
        
        if rotate_secret "$secret_name" "$secret_type"; then
            echo "  SUCCESS" >> "$emergency_log"
            ((emergency_success++))
        else
            echo "  FAILED" >> "$emergency_log"
            ((emergency_failures++))
        fi
    done
    
    {
        echo "=================================="
        echo "Emergency Rotation Completed: $(date)"
        echo "Successful: $emergency_success"
        echo "Failed: $emergency_failures"
    } >> "$emergency_log"
    
    log_info "Emergency rotation log: $emergency_log"
    
    # Send notification if webhook is configured
    if [[ -n "${ROTATION_WEBHOOK:-}" ]]; then
        send_rotation_notification "emergency" "$emergency_success" "$emergency_failures"
    fi
    
    if [[ $emergency_failures -gt 0 ]]; then
        log_error "Emergency rotation completed with $emergency_failures failures"
        return 1
    else
        log_success "Emergency rotation completed successfully"
        return 0
    fi
}

# Send rotation notification
send_rotation_notification() {
    local rotation_type="$1"
    local success_count="$2"
    local failure_count="$3"
    
    if [[ -z "${ROTATION_WEBHOOK:-}" ]]; then
        return 0
    fi
    
    local payload
    payload=$(cat <<EOF
{
  "event": "secret_rotation",
  "type": "$rotation_type",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "summary": {
    "successful": $success_count,
    "failed": $failure_count,
    "total": $((success_count + failure_count))
  },
  "initiated_by": "${USER:-script}",
  "reason": "${EMERGENCY_REASON:-Manual rotation}"
}
EOF
)
    
    if curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$ROTATION_WEBHOOK" >/dev/null; then
        log_info "Rotation notification sent to webhook"
    else
        log_warning "Failed to send rotation notification"
    fi
}

# List current secrets
list_secrets() {
    log_info "Listing secrets in $VAULT_NAMESPACE..."
    
    if vault kv list "$VAULT_NAMESPACE" 2>/dev/null; then
        log_success "Secrets listed successfully"
    else
        log_error "Failed to list secrets"
        return 1
    fi
}

# Show secret metadata
show_secret_info() {
    local secret_name="$1"
    
    log_info "Getting information for secret: $secret_name"
    
    if vault kv metadata get "$VAULT_NAMESPACE/$secret_name" 2>/dev/null; then
        log_success "Secret metadata retrieved"
    else
        log_error "Failed to get secret metadata"
        return 1
    fi
}

# Restore secret from backup
restore_secret() {
    local secret_name="$1"
    local backup_file="${2:-}"
    
    if [[ -z "$backup_file" ]]; then
        # Find latest backup for this secret
        backup_file=$(find "$BACKUP_DIR" -name "${secret_name}_*.json" -type f | sort -r | head -n1)
        
        if [[ -z "$backup_file" ]]; then
            log_error "No backup found for secret: $secret_name"
            return 1
        fi
        
        log_info "Using latest backup: $(basename "$backup_file")"
    fi
    
    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi
    
    log_info "Restoring secret from backup: $secret_name"
    
    # Extract value from backup
    local secret_value
    secret_value=$(jq -r '.data.data.value' "$backup_file" 2>/dev/null)
    
    if [[ -z "$secret_value" || "$secret_value" == "null" ]]; then
        log_error "Invalid backup file format"
        return 1
    fi
    
    # Restore secret
    if vault kv put "$VAULT_NAMESPACE/$secret_name" \
        value="$secret_value" \
        restored_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        restored_by="${USER:-script}" \
        restored_from="$(basename "$backup_file")"; then
        
        log_success "Secret restored successfully: $secret_name"
        return 0
    else
        log_error "Failed to restore secret: $secret_name"
        return 1
    fi
}

# Test secret connectivity
test_secret() {
    local secret_name="$1"
    
    log_info "Testing secret: $secret_name"
    
    local secret_value
    secret_value=$(vault kv get -field=value "$VAULT_NAMESPACE/$secret_name" 2>/dev/null)
    
    if [[ -z "$secret_value" ]]; then
        log_error "Failed to retrieve secret: $secret_name"
        return 1
    fi
    
    # Basic validation based on secret type
    case "$secret_name" in
        *"resend"*)
            if [[ "$secret_value" =~ ^re_[a-zA-Z0-9]+$ ]]; then
                log_success "Resend API key format is valid"
            else
                log_warning "Resend API key format may be invalid"
            fi
            ;;
        *"tambo"*)
            if [[ "$secret_value" =~ ^tambo_.+ ]]; then
                log_success "Tambo API key format is valid"
            else
                log_warning "Tambo API key format may be invalid"
            fi
            ;;
        *"jwt"*|*"auth"*|*"csrf"*)
            if [[ ${#secret_value} -eq 64 ]]; then
                log_success "Secret length is valid (64 characters)"
            else
                log_warning "Secret length may be invalid (expected 64 characters, got ${#secret_value})"
            fi
            ;;
        *)
            log_info "Secret retrieved successfully (length: ${#secret_value})"
            ;;
    esac
    
    return 0
}

# Show usage
usage() {
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  rotate <secret-name> [type]    Rotate a single secret"
    echo "  rotate-multiple <secret1> ...  Rotate multiple secrets"
    echo "  emergency-rotate-all           Rotate ALL secrets (emergency)"
    echo "  list                           List all secrets"
    echo "  info <secret-name>             Show secret metadata"
    echo "  restore <secret-name> [backup] Restore secret from backup"
    echo "  test <secret-name>             Test secret format/connectivity"
    echo "  backup <secret-name>           Backup a secret"
    echo ""
    echo "Secret types:"
    echo "  resend-api-key, tambo-api-key, lingo-dev-api-key, firecrawl-api-key"
    echo "  better-auth-secret, jwt-secret, jwt-refresh-secret, csrf-secret"
    echo "  supabase-service-role-key, database-password, api-key (default)"
    echo ""
    echo "Environment variables:"
    echo "  VAULT_ADDR           Vault server address"
    echo "  VAULT_TOKEN          Vault authentication token"
    echo "  VAULT_NAMESPACE      Vault namespace (default: learning-assistant)"
    echo "  ROTATION_WEBHOOK     Webhook URL for notifications"
    echo "  EMERGENCY_REASON     Reason for emergency rotation"
    echo "  FORCE_EMERGENCY      Skip confirmation for emergency rotation"
    echo ""
    echo "Examples:"
    echo "  $0 rotate resend-api-key resend-api-key"
    echo "  $0 rotate-multiple jwt-secret:jwt-secret csrf-secret:csrf-secret"
    echo "  $0 emergency-rotate-all"
    echo "  $0 restore jwt-secret /path/to/backup.json"
}

# Main script logic
main() {
    case "${1:-}" in
        rotate)
            check_prerequisites
            if [[ $# -lt 2 ]]; then
                log_error "Secret name is required"
                usage
                exit 1
            fi
            rotate_secret "$2" "${3:-api-key}"
            ;;
        rotate-multiple)
            check_prerequisites
            if [[ $# -lt 2 ]]; then
                log_error "At least one secret name is required"
                usage
                exit 1
            fi
            shift
            rotate_multiple "$@"
            ;;
        emergency-rotate-all)
            check_prerequisites
            emergency_rotate_all
            ;;
        list)
            check_prerequisites
            list_secrets
            ;;
        info)
            check_prerequisites
            if [[ $# -lt 2 ]]; then
                log_error "Secret name is required"
                usage
                exit 1
            fi
            show_secret_info "$2"
            ;;
        restore)
            check_prerequisites
            if [[ $# -lt 2 ]]; then
                log_error "Secret name is required"
                usage
                exit 1
            fi
            restore_secret "$2" "${3:-}"
            ;;
        test)
            check_prerequisites
            if [[ $# -lt 2 ]]; then
                log_error "Secret name is required"
                usage
                exit 1
            fi
            test_secret "$2"
            ;;
        backup)
            check_prerequisites
            if [[ $# -lt 2 ]]; then
                log_error "Secret name is required"
                usage
                exit 1
            fi
            backup_secret "$2"
            ;;
        *)
            usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"