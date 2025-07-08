#!/bin/bash

# Terraform State Backup Automation Script
# This script creates automated backups of Terraform state files with versioning and retention

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../config/backup-config.yaml"
LOG_FILE="${SCRIPT_DIR}/../logs/backup-$(date +%Y%m%d_%H%M%S).log"
BACKUP_DIR="${SCRIPT_DIR}/../backups"
RETENTION_DAYS=90
MAX_BACKUPS=100

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case "$level" in
        "INFO")
            echo -e "${GREEN}[INFO]${NC} ${message}" | tee -a "$LOG_FILE"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} ${message}" | tee -a "$LOG_FILE"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} ${message}" | tee -a "$LOG_FILE"
            ;;
        "DEBUG")
            echo -e "${BLUE}[DEBUG]${NC} ${message}" | tee -a "$LOG_FILE"
            ;;
    esac
    
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR" "$1"
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log "INFO" "Checking prerequisites..."
    
    local required_tools=("terraform" "aws" "gcloud" "az" "jq" "yq")
    
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log "WARN" "$tool is not installed or not in PATH"
        else
            log "DEBUG" "$tool is available"
        fi
    done
    
    # Check if running in CI/CD environment
    if [[ "${CI:-}" == "true" ]]; then
        log "INFO" "Running in CI/CD environment"
        export TF_IN_AUTOMATION=true
    fi
}

# Load configuration
load_config() {
    log "INFO" "Loading backup configuration..."
    
    if [[ -f "$CONFIG_FILE" ]]; then
        # Parse YAML configuration
        ENVIRONMENTS=$(yq e '.environments[].name' "$CONFIG_FILE")
        PROVIDERS=$(yq e '.providers[].name' "$CONFIG_FILE")
        RETENTION_DAYS=$(yq e '.retention.days' "$CONFIG_FILE")
        MAX_BACKUPS=$(yq e '.retention.max_backups' "$CONFIG_FILE")
        
        log "DEBUG" "Configuration loaded successfully"
        log "DEBUG" "Environments: $ENVIRONMENTS"
        log "DEBUG" "Providers: $PROVIDERS"
        log "DEBUG" "Retention: $RETENTION_DAYS days, $MAX_BACKUPS max backups"
    else
        log "WARN" "Configuration file not found, using defaults"
        ENVIRONMENTS="dev staging prod"
        PROVIDERS="aws gcp azure"
    fi
}

# Create backup directory structure
create_backup_structure() {
    log "INFO" "Creating backup directory structure..."
    
    for env in $ENVIRONMENTS; do
        for provider in $PROVIDERS; do
            local backup_path="$BACKUP_DIR/$env/$provider"
            mkdir -p "$backup_path"
            log "DEBUG" "Created backup directory: $backup_path"
        done
    done
}

# Backup AWS S3 state
backup_aws_state() {
    local environment="$1"
    local timestamp="$2"
    
    log "INFO" "Backing up AWS state for environment: $environment"
    
    # Load AWS configuration
    local bucket_name=$(yq e ".environments[] | select(.name == \"$environment\") | .aws.bucket" "$CONFIG_FILE")
    local region=$(yq e ".environments[] | select(.name == \"$environment\") | .aws.region" "$CONFIG_FILE")
    
    if [[ -z "$bucket_name" ]]; then
        log "WARN" "AWS bucket not configured for environment: $environment"
        return 0
    fi
    
    local backup_path="$BACKUP_DIR/$environment/aws"
    local state_key="$environment/terraform.tfstate"
    local backup_file="$backup_path/terraform-state-$timestamp.tfstate"
    
    # Download current state
    if aws s3 cp "s3://$bucket_name/$state_key" "$backup_file" --region "$region" 2>/dev/null; then
        log "INFO" "Successfully backed up AWS state to: $backup_file"
        
        # Compress backup
        gzip "$backup_file"
        log "DEBUG" "Compressed backup file: $backup_file.gz"
        
        # Create metadata file
        local metadata_file="$backup_path/terraform-state-$timestamp.json"
        cat > "$metadata_file" << EOF
{
    "timestamp": "$timestamp",
    "environment": "$environment",
    "provider": "aws",
    "bucket": "$bucket_name",
    "region": "$region",
    "state_key": "$state_key",
    "backup_file": "$(basename "$backup_file.gz")",
    "checksum": "$(md5sum "$backup_file.gz" | cut -d' ' -f1)"
}
EOF
        
        # Upload backup to cross-region bucket if configured
        local backup_bucket=$(yq e ".environments[] | select(.name == \"$environment\") | .aws.backup_bucket" "$CONFIG_FILE")
        if [[ -n "$backup_bucket" ]]; then
            aws s3 cp "$backup_file.gz" "s3://$backup_bucket/backups/$environment/" --region "$region"
            log "INFO" "Uploaded backup to cross-region bucket: $backup_bucket"
        fi
        
    else
        log "WARN" "Failed to backup AWS state for environment: $environment"
    fi
}

# Backup GCP Cloud Storage state
backup_gcp_state() {
    local environment="$1"
    local timestamp="$2"
    
    log "INFO" "Backing up GCP state for environment: $environment"
    
    # Load GCP configuration
    local bucket_name=$(yq e ".environments[] | select(.name == \"$environment\") | .gcp.bucket" "$CONFIG_FILE")
    local project_id=$(yq e ".environments[] | select(.name == \"$environment\") | .gcp.project_id" "$CONFIG_FILE")
    
    if [[ -z "$bucket_name" ]]; then
        log "WARN" "GCP bucket not configured for environment: $environment"
        return 0
    fi
    
    local backup_path="$BACKUP_DIR/$environment/gcp"
    local state_key="$environment/terraform/state/terraform.tfstate"
    local backup_file="$backup_path/terraform-state-$timestamp.tfstate"
    
    # Download current state
    if gsutil cp "gs://$bucket_name/$state_key" "$backup_file" 2>/dev/null; then
        log "INFO" "Successfully backed up GCP state to: $backup_file"
        
        # Compress backup
        gzip "$backup_file"
        log "DEBUG" "Compressed backup file: $backup_file.gz"
        
        # Create metadata file
        local metadata_file="$backup_path/terraform-state-$timestamp.json"
        cat > "$metadata_file" << EOF
{
    "timestamp": "$timestamp",
    "environment": "$environment",
    "provider": "gcp",
    "bucket": "$bucket_name",
    "project_id": "$project_id",
    "state_key": "$state_key",
    "backup_file": "$(basename "$backup_file.gz")",
    "checksum": "$(md5sum "$backup_file.gz" | cut -d' ' -f1)"
}
EOF
        
        # Upload backup to cross-region bucket if configured
        local backup_bucket=$(yq e ".environments[] | select(.name == \"$environment\") | .gcp.backup_bucket" "$CONFIG_FILE")
        if [[ -n "$backup_bucket" ]]; then
            gsutil cp "$backup_file.gz" "gs://$backup_bucket/backups/$environment/"
            log "INFO" "Uploaded backup to cross-region bucket: $backup_bucket"
        fi
        
    else
        log "WARN" "Failed to backup GCP state for environment: $environment"
    fi
}

# Backup Azure Storage state
backup_azure_state() {
    local environment="$1"
    local timestamp="$2"
    
    log "INFO" "Backing up Azure state for environment: $environment"
    
    # Load Azure configuration
    local storage_account=$(yq e ".environments[] | select(.name == \"$environment\") | .azure.storage_account" "$CONFIG_FILE")
    local container_name=$(yq e ".environments[] | select(.name == \"$environment\") | .azure.container_name" "$CONFIG_FILE")
    local resource_group=$(yq e ".environments[] | select(.name == \"$environment\") | .azure.resource_group" "$CONFIG_FILE")
    
    if [[ -z "$storage_account" ]]; then
        log "WARN" "Azure storage account not configured for environment: $environment"
        return 0
    fi
    
    local backup_path="$BACKUP_DIR/$environment/azure"
    local state_key="$environment/terraform.tfstate"
    local backup_file="$backup_path/terraform-state-$timestamp.tfstate"
    
    # Download current state
    if az storage blob download \
        --account-name "$storage_account" \
        --container-name "$container_name" \
        --name "$state_key" \
        --file "$backup_file" 2>/dev/null; then
        
        log "INFO" "Successfully backed up Azure state to: $backup_file"
        
        # Compress backup
        gzip "$backup_file"
        log "DEBUG" "Compressed backup file: $backup_file.gz"
        
        # Create metadata file
        local metadata_file="$backup_path/terraform-state-$timestamp.json"
        cat > "$metadata_file" << EOF
{
    "timestamp": "$timestamp",
    "environment": "$environment",
    "provider": "azure",
    "storage_account": "$storage_account",
    "container_name": "$container_name",
    "resource_group": "$resource_group",
    "state_key": "$state_key",
    "backup_file": "$(basename "$backup_file.gz")",
    "checksum": "$(md5sum "$backup_file.gz" | cut -d' ' -f1)"
}
EOF
        
        # Upload backup to cross-region storage if configured
        local backup_storage=$(yq e ".environments[] | select(.name == \"$environment\") | .azure.backup_storage_account" "$CONFIG_FILE")
        if [[ -n "$backup_storage" ]]; then
            az storage blob upload \
                --account-name "$backup_storage" \
                --container-name "backups" \
                --name "$environment/$(basename "$backup_file.gz")" \
                --file "$backup_file.gz"
            log "INFO" "Uploaded backup to cross-region storage: $backup_storage"
        fi
        
    else
        log "WARN" "Failed to backup Azure state for environment: $environment"
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    log "INFO" "Cleaning up old backups..."
    
    for env in $ENVIRONMENTS; do
        for provider in $PROVIDERS; do
            local backup_path="$BACKUP_DIR/$env/$provider"
            
            if [[ -d "$backup_path" ]]; then
                # Remove files older than retention period
                find "$backup_path" -name "terraform-state-*.tfstate.gz" -mtime +$RETENTION_DAYS -delete
                find "$backup_path" -name "terraform-state-*.json" -mtime +$RETENTION_DAYS -delete
                
                # Keep only the most recent backups
                local backup_count=$(find "$backup_path" -name "terraform-state-*.tfstate.gz" | wc -l)
                if [[ $backup_count -gt $MAX_BACKUPS ]]; then
                    find "$backup_path" -name "terraform-state-*.tfstate.gz" -type f -printf '%T@ %p\n' | \
                        sort -n | head -n -$MAX_BACKUPS | cut -d' ' -f2- | xargs rm -f
                    find "$backup_path" -name "terraform-state-*.json" -type f -printf '%T@ %p\n' | \
                        sort -n | head -n -$MAX_BACKUPS | cut -d' ' -f2- | xargs rm -f
                fi
                
                log "DEBUG" "Cleaned up old backups in: $backup_path"
            fi
        done
    done
}

# Verify backup integrity
verify_backup_integrity() {
    log "INFO" "Verifying backup integrity..."
    
    local errors=0
    
    for env in $ENVIRONMENTS; do
        for provider in $PROVIDERS; do
            local backup_path="$BACKUP_DIR/$env/$provider"
            
            if [[ -d "$backup_path" ]]; then
                for metadata_file in "$backup_path"/terraform-state-*.json; do
                    if [[ -f "$metadata_file" ]]; then
                        local backup_file=$(jq -r '.backup_file' "$metadata_file")
                        local expected_checksum=$(jq -r '.checksum' "$metadata_file")
                        local actual_checksum=$(md5sum "$backup_path/$backup_file" | cut -d' ' -f1)
                        
                        if [[ "$expected_checksum" != "$actual_checksum" ]]; then
                            log "ERROR" "Backup integrity check failed for: $backup_path/$backup_file"
                            errors=$((errors + 1))
                        else
                            log "DEBUG" "Backup integrity verified for: $backup_path/$backup_file"
                        fi
                    fi
                done
            fi
        done
    done
    
    if [[ $errors -gt 0 ]]; then
        log "ERROR" "Backup integrity verification failed with $errors errors"
        return 1
    else
        log "INFO" "All backup integrity checks passed"
        return 0
    fi
}

# Send notification
send_notification() {
    local status="$1"
    local message="$2"
    
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local color="good"
        if [[ "$status" == "error" ]]; then
            color="danger"
        elif [[ "$status" == "warning" ]]; then
            color="warning"
        fi
        
        local payload=$(cat << EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "Terraform State Backup - $status",
            "text": "$message",
            "fields": [
                {
                    "title": "Environment",
                    "value": "$(echo $ENVIRONMENTS | tr ' ' ',')",
                    "short": true
                },
                {
                    "title": "Timestamp",
                    "value": "$(date '+%Y-%m-%d %H:%M:%S UTC')",
                    "short": true
                }
            ]
        }
    ]
}
EOF
        )
        
        curl -X POST -H 'Content-type: application/json' \
            --data "$payload" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi
}

# Main backup process
main() {
    local start_time=$(date +%s)
    local timestamp=$(date +%Y%m%d_%H%M%S)
    
    log "INFO" "Starting Terraform state backup process..."
    
    # Create log directory
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Check prerequisites
    check_prerequisites
    
    # Load configuration
    load_config
    
    # Create backup directory structure
    create_backup_structure
    
    # Perform backups for each environment and provider
    for env in $ENVIRONMENTS; do
        log "INFO" "Processing environment: $env"
        
        if echo "$PROVIDERS" | grep -q "aws"; then
            backup_aws_state "$env" "$timestamp"
        fi
        
        if echo "$PROVIDERS" | grep -q "gcp"; then
            backup_gcp_state "$env" "$timestamp"
        fi
        
        if echo "$PROVIDERS" | grep -q "azure"; then
            backup_azure_state "$env" "$timestamp"
        fi
    done
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Verify backup integrity
    if verify_backup_integrity; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        local success_message="Terraform state backup completed successfully in ${duration}s"
        
        log "INFO" "$success_message"
        send_notification "success" "$success_message"
    else
        local error_message="Terraform state backup completed with integrity verification errors"
        log "ERROR" "$error_message"
        send_notification "error" "$error_message"
        exit 1
    fi
}

# Handle script arguments
case "${1:-}" in
    "help"|"--help"|"-h")
        cat << EOF
Terraform State Backup Script

Usage: $0 [OPTIONS] [COMMAND]

Commands:
    backup      Run the backup process (default)
    verify      Verify backup integrity only
    cleanup     Cleanup old backups only
    help        Show this help message

Options:
    --config    Path to configuration file
    --retention Days to retain backups (default: 90)
    --max       Maximum number of backups to keep (default: 100)
    --dry-run   Show what would be done without executing

Examples:
    $0 backup
    $0 verify
    $0 cleanup
    $0 --config /path/to/config.yaml backup
    $0 --retention 30 --max 50 backup

EOF
        exit 0
        ;;
    "verify")
        load_config
        verify_backup_integrity
        ;;
    "cleanup")
        load_config
        cleanup_old_backups
        ;;
    "backup"|"")
        main
        ;;
    *)
        error_exit "Unknown command: $1. Use '$0 help' for usage information."
        ;;
esac