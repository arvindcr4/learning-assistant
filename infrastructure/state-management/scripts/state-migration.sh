#!/bin/bash

# Terraform State Migration and Management Script
# This script handles state migrations, imports, and rollbacks safely

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../config/migration-config.yaml"
LOG_FILE="${SCRIPT_DIR}/../logs/state-migration-$(date +%Y%m%d_%H%M%S).log"
BACKUP_DIR="${SCRIPT_DIR}/../backups/migrations"
TERRAFORM_DIR="${SCRIPT_DIR}/../../.."
LOCK_FILE="/tmp/terraform-state-migration.lock"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Global variables
MIGRATION_TYPE=""
SOURCE_BACKEND=""
TARGET_BACKEND=""
ENVIRONMENT=""
DRY_RUN=false
FORCE=false
BACKUP_ENABLED=true

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
        "MIGRATE")
            echo -e "${PURPLE}[MIGRATE]${NC} ${message}" | tee -a "$LOG_FILE"
            ;;
    esac
    
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR" "$1"
    cleanup
    exit 1
}

# Cleanup function
cleanup() {
    if [[ -f "$LOCK_FILE" ]]; then
        rm -f "$LOCK_FILE"
    fi
    
    # Clean up temporary files
    rm -f /tmp/tfplan-* /tmp/tfstate-* 2>/dev/null || true
}

# Set up signal handlers
trap cleanup EXIT
trap 'error_exit "Script interrupted by user"' INT TERM

# Create lock file to prevent concurrent runs
create_lock() {
    if [[ -f "$LOCK_FILE" ]]; then
        local lock_pid=$(cat "$LOCK_FILE")
        if ps -p "$lock_pid" > /dev/null 2>&1; then
            error_exit "Another migration is already running (PID: $lock_pid)"
        else
            log "WARN" "Stale lock file found, removing it"
            rm -f "$LOCK_FILE"
        fi
    fi
    
    echo $$ > "$LOCK_FILE"
}

# Check prerequisites
check_prerequisites() {
    log "INFO" "Checking prerequisites..."
    
    local required_tools=("terraform" "jq" "yq" "aws" "gcloud" "az")
    
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log "WARN" "$tool is not installed or not in PATH"
        fi
    done
    
    # Check Terraform version
    local tf_version=$(terraform version -json | jq -r '.terraform_version')
    log "DEBUG" "Terraform version: $tf_version"
    
    # Verify we have write access to backup directory
    mkdir -p "$BACKUP_DIR"
    if [[ ! -w "$BACKUP_DIR" ]]; then
        error_exit "Cannot write to backup directory: $BACKUP_DIR"
    fi
}

# Load configuration
load_config() {
    log "INFO" "Loading migration configuration..."
    
    if [[ -f "$CONFIG_FILE" ]]; then
        log "DEBUG" "Configuration file found: $CONFIG_FILE"
    else
        log "WARN" "Configuration file not found, using defaults"
        create_default_config
    fi
}

# Create default configuration
create_default_config() {
    mkdir -p "$(dirname "$CONFIG_FILE")"
    
    cat > "$CONFIG_FILE" << 'EOF'
# Terraform State Migration Configuration

environments:
  - name: dev
    aws:
      bucket: learning-assistant-terraform-state-dev
      region: us-west-2
      dynamodb_table: learning-assistant-terraform-state-lock-dev
    gcp:
      bucket: learning-assistant-terraform-state-dev
      project_id: learning-assistant-dev
    azure:
      resource_group: learning-assistant-terraform-state-dev
      storage_account: learningassistanttfstatedev
      container_name: tfstate

  - name: staging
    aws:
      bucket: learning-assistant-terraform-state-staging
      region: us-west-2
      dynamodb_table: learning-assistant-terraform-state-lock-staging
    gcp:
      bucket: learning-assistant-terraform-state-staging
      project_id: learning-assistant-staging
    azure:
      resource_group: learning-assistant-terraform-state-staging
      storage_account: learningassistanttfstatestaging
      container_name: tfstate

  - name: prod
    aws:
      bucket: learning-assistant-terraform-state-prod
      region: us-west-2
      dynamodb_table: learning-assistant-terraform-state-lock-prod
    gcp:
      bucket: learning-assistant-terraform-state-prod
      project_id: learning-assistant-prod
    azure:
      resource_group: learning-assistant-terraform-state-prod
      storage_account: learningassistanttfstateprod
      container_name: tfstate

migration:
  backup_enabled: true
  verification_enabled: true
  rollback_enabled: true
  max_retries: 3
  timeout_minutes: 30
EOF
    
    log "INFO" "Created default configuration file: $CONFIG_FILE"
}

# Backup current state
backup_current_state() {
    local environment="$1"
    local backend="$2"
    local timestamp="$3"
    
    log "INFO" "Creating backup of current state for $environment ($backend)..."
    
    local backup_file="$BACKUP_DIR/${environment}-${backend}-backup-${timestamp}.tfstate"
    local metadata_file="$BACKUP_DIR/${environment}-${backend}-backup-${timestamp}.json"
    
    # Create backup based on backend type
    case "$backend" in
        "aws")
            backup_aws_state "$environment" "$backup_file" "$metadata_file"
            ;;
        "gcp")
            backup_gcp_state "$environment" "$backup_file" "$metadata_file"
            ;;
        "azure")
            backup_azure_state "$environment" "$backup_file" "$metadata_file"
            ;;
        "local")
            backup_local_state "$environment" "$backup_file" "$metadata_file"
            ;;
        *)
            error_exit "Unsupported backend type: $backend"
            ;;
    esac
    
    if [[ -f "$backup_file" ]]; then
        log "INFO" "Backup created successfully: $backup_file"
        return 0
    else
        error_exit "Failed to create backup"
    fi
}

# Backup AWS state
backup_aws_state() {
    local environment="$1"
    local backup_file="$2"
    local metadata_file="$3"
    
    local bucket=$(yq e ".environments[] | select(.name == \"$environment\") | .aws.bucket" "$CONFIG_FILE")
    local region=$(yq e ".environments[] | select(.name == \"$environment\") | .aws.region" "$CONFIG_FILE")
    local state_key="${environment}/terraform.tfstate"
    
    if aws s3 cp "s3://$bucket/$state_key" "$backup_file" --region "$region" 2>/dev/null; then
        create_backup_metadata "$environment" "aws" "$backup_file" "$metadata_file" "$bucket" "$state_key"
    else
        error_exit "Failed to backup AWS state from s3://$bucket/$state_key"
    fi
}

# Backup GCP state
backup_gcp_state() {
    local environment="$1"
    local backup_file="$2"
    local metadata_file="$3"
    
    local bucket=$(yq e ".environments[] | select(.name == \"$environment\") | .gcp.bucket" "$CONFIG_FILE")
    local state_key="${environment}/terraform/state/terraform.tfstate"
    
    if gsutil cp "gs://$bucket/$state_key" "$backup_file" 2>/dev/null; then
        create_backup_metadata "$environment" "gcp" "$backup_file" "$metadata_file" "$bucket" "$state_key"
    else
        error_exit "Failed to backup GCP state from gs://$bucket/$state_key"
    fi
}

# Backup Azure state
backup_azure_state() {
    local environment="$1"
    local backup_file="$2"
    local metadata_file="$3"
    
    local storage_account=$(yq e ".environments[] | select(.name == \"$environment\") | .azure.storage_account" "$CONFIG_FILE")
    local container_name=$(yq e ".environments[] | select(.name == \"$environment\") | .azure.container_name" "$CONFIG_FILE")
    local state_key="${environment}/terraform.tfstate"
    
    if az storage blob download \
        --account-name "$storage_account" \
        --container-name "$container_name" \
        --name "$state_key" \
        --file "$backup_file" 2>/dev/null; then
        create_backup_metadata "$environment" "azure" "$backup_file" "$metadata_file" "$storage_account" "$state_key"
    else
        error_exit "Failed to backup Azure state from $storage_account/$container_name/$state_key"
    fi
}

# Backup local state
backup_local_state() {
    local environment="$1"
    local backup_file="$2"
    local metadata_file="$3"
    
    local tf_dir="$TERRAFORM_DIR/environments/$environment"
    local local_state="$tf_dir/terraform.tfstate"
    
    if [[ -f "$local_state" ]]; then
        cp "$local_state" "$backup_file"
        create_backup_metadata "$environment" "local" "$backup_file" "$metadata_file" "$tf_dir" "terraform.tfstate"
    else
        error_exit "Local state file not found: $local_state"
    fi
}

# Create backup metadata
create_backup_metadata() {
    local environment="$1"
    local backend="$2"
    local backup_file="$3"
    local metadata_file="$4"
    local location="$5"
    local state_key="$6"
    
    local checksum=$(md5sum "$backup_file" | cut -d' ' -f1)
    local size=$(stat -c%s "$backup_file")
    
    cat > "$metadata_file" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$environment",
    "backend": "$backend",
    "backup_file": "$(basename "$backup_file")",
    "location": "$location",
    "state_key": "$state_key",
    "checksum": "$checksum",
    "size_bytes": $size,
    "terraform_version": "$(terraform version -json | jq -r '.terraform_version')"
}
EOF
}

# Migrate state between backends
migrate_state() {
    local environment="$1"
    local source_backend="$2"
    local target_backend="$3"
    local timestamp="$4"
    
    log "MIGRATE" "Starting state migration: $environment ($source_backend -> $target_backend)"
    
    local tf_dir="$TERRAFORM_DIR/environments/$environment"
    
    if [[ ! -d "$tf_dir" ]]; then
        error_exit "Terraform directory not found: $tf_dir"
    fi
    
    cd "$tf_dir"
    
    # Step 1: Backup current state
    if [[ "$BACKUP_ENABLED" == "true" ]]; then
        backup_current_state "$environment" "$source_backend" "$timestamp"
    fi
    
    # Step 2: Initialize with source backend
    log "MIGRATE" "Initializing with source backend: $source_backend"
    initialize_backend "$environment" "$source_backend"
    
    # Step 3: Pull current state
    log "MIGRATE" "Pulling current state from source backend"
    terraform state pull > "/tmp/tfstate-${environment}-${timestamp}.json"
    
    # Step 4: Verify state integrity
    if ! jq empty "/tmp/tfstate-${environment}-${timestamp}.json" 2>/dev/null; then
        error_exit "Invalid JSON in pulled state file"
    fi
    
    # Step 5: Initialize with target backend
    log "MIGRATE" "Initializing with target backend: $target_backend"
    initialize_backend "$environment" "$target_backend"
    
    # Step 6: Push state to target backend
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would push state to target backend"
    else
        log "MIGRATE" "Pushing state to target backend"
        terraform state push "/tmp/tfstate-${environment}-${timestamp}.json"
    fi
    
    # Step 7: Verify migration
    verify_migration "$environment" "$target_backend" "/tmp/tfstate-${environment}-${timestamp}.json"
    
    log "MIGRATE" "State migration completed successfully"
}

# Initialize backend configuration
initialize_backend() {
    local environment="$1"
    local backend="$2"
    
    local backend_config="$TERRAFORM_DIR/infrastructure/state-management/configs/backend-${backend}-${environment}.hcl"
    
    if [[ -f "$backend_config" ]]; then
        terraform init -backend-config="$backend_config" -migrate-state -force-copy -input=false
    else
        # Create backend configuration on the fly
        create_backend_config "$environment" "$backend"
        terraform init -backend-config="/tmp/backend-${backend}-${environment}.hcl" -migrate-state -force-copy -input=false
    fi
}

# Create backend configuration
create_backend_config() {
    local environment="$1"
    local backend="$2"
    
    local config_file="/tmp/backend-${backend}-${environment}.hcl"
    
    case "$backend" in
        "aws")
            local bucket=$(yq e ".environments[] | select(.name == \"$environment\") | .aws.bucket" "$CONFIG_FILE")
            local region=$(yq e ".environments[] | select(.name == \"$environment\") | .aws.region" "$CONFIG_FILE")
            local dynamodb_table=$(yq e ".environments[] | select(.name == \"$environment\") | .aws.dynamodb_table" "$CONFIG_FILE")
            
            cat > "$config_file" << EOF
bucket         = "$bucket"
key            = "$environment/terraform.tfstate"
region         = "$region"
encrypt        = true
dynamodb_table = "$dynamodb_table"
EOF
            ;;
        "gcp")
            local bucket=$(yq e ".environments[] | select(.name == \"$environment\") | .gcp.bucket" "$CONFIG_FILE")
            
            cat > "$config_file" << EOF
bucket = "$bucket"
prefix = "$environment/terraform/state"
EOF
            ;;
        "azure")
            local resource_group=$(yq e ".environments[] | select(.name == \"$environment\") | .azure.resource_group" "$CONFIG_FILE")
            local storage_account=$(yq e ".environments[] | select(.name == \"$environment\") | .azure.storage_account" "$CONFIG_FILE")
            local container_name=$(yq e ".environments[] | select(.name == \"$environment\") | .azure.container_name" "$CONFIG_FILE")
            
            cat > "$config_file" << EOF
resource_group_name  = "$resource_group"
storage_account_name = "$storage_account"
container_name       = "$container_name"
key                  = "$environment/terraform.tfstate"
EOF
            ;;
        *)
            error_exit "Unsupported backend type: $backend"
            ;;
    esac
}

# Verify migration
verify_migration() {
    local environment="$1"
    local backend="$2"
    local original_state_file="$3"
    
    log "INFO" "Verifying migration for $environment ($backend)..."
    
    # Pull state from target backend
    local new_state_file="/tmp/tfstate-${environment}-verify-$(date +%s).json"
    terraform state pull > "$new_state_file"
    
    # Compare states
    local original_checksum=$(jq -r '.serial' "$original_state_file")
    local new_checksum=$(jq -r '.serial' "$new_state_file")
    
    if [[ "$original_checksum" == "$new_checksum" ]]; then
        log "INFO" "Migration verification successful - state serial numbers match"
    else
        log "WARN" "State serial numbers differ - this may be expected"
    fi
    
    # Compare resource counts
    local original_resources=$(jq '.resources | length' "$original_state_file")
    local new_resources=$(jq '.resources | length' "$new_state_file")
    
    if [[ "$original_resources" == "$new_resources" ]]; then
        log "INFO" "Resource count verification successful ($original_resources resources)"
    else
        error_exit "Resource count mismatch: original=$original_resources, new=$new_resources"
    fi
    
    # Validate state with terraform plan
    log "INFO" "Running terraform plan to verify state consistency..."
    if terraform plan -detailed-exitcode -input=false > /dev/null 2>&1; then
        log "INFO" "State consistency verification successful - no changes detected"
    else
        local exit_code=$?
        if [[ $exit_code -eq 2 ]]; then
            log "WARN" "State inconsistency detected - terraform plan shows changes"
            terraform plan -input=false
        else
            error_exit "Terraform plan failed with exit code: $exit_code"
        fi
    fi
    
    rm -f "$new_state_file"
}

# Import existing resources
import_resources() {
    local environment="$1"
    local import_file="$2"
    
    log "INFO" "Importing resources for $environment from $import_file..."
    
    if [[ ! -f "$import_file" ]]; then
        error_exit "Import file not found: $import_file"
    fi
    
    local tf_dir="$TERRAFORM_DIR/environments/$environment"
    cd "$tf_dir"
    
    # Read import file (JSON format with resource addresses and IDs)
    local imports=$(jq -r '.imports[]' "$import_file")
    
    while IFS= read -r import_entry; do
        if [[ "$import_entry" != "null" && -n "$import_entry" ]]; then
            local resource_address=$(echo "$import_entry" | jq -r '.address')
            local resource_id=$(echo "$import_entry" | jq -r '.id')
            
            log "INFO" "Importing resource: $resource_address (ID: $resource_id)"
            
            if [[ "$DRY_RUN" == "true" ]]; then
                log "INFO" "DRY RUN: Would import $resource_address"
            else
                if terraform import "$resource_address" "$resource_id"; then
                    log "INFO" "Successfully imported: $resource_address"
                else
                    log "ERROR" "Failed to import: $resource_address"
                fi
            fi
        fi
    done <<< "$imports"
}

# Rollback migration
rollback_migration() {
    local environment="$1"
    local backup_timestamp="$2"
    
    log "WARN" "Rolling back migration for $environment (backup: $backup_timestamp)..."
    
    local backup_file="$BACKUP_DIR/${environment}-*-backup-${backup_timestamp}.tfstate"
    local metadata_file="$BACKUP_DIR/${environment}-*-backup-${backup_timestamp}.json"
    
    if [[ ! -f $backup_file ]]; then
        error_exit "Backup file not found: $backup_file"
    fi
    
    if [[ ! -f $metadata_file ]]; then
        error_exit "Backup metadata file not found: $metadata_file"
    fi
    
    # Verify backup integrity
    local expected_checksum=$(jq -r '.checksum' $metadata_file)
    local actual_checksum=$(md5sum $backup_file | cut -d' ' -f1)
    
    if [[ "$expected_checksum" != "$actual_checksum" ]]; then
        error_exit "Backup integrity check failed"
    fi
    
    local tf_dir="$TERRAFORM_DIR/environments/$environment"
    cd "$tf_dir"
    
    # Push backup state
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would rollback to backup state"
    else
        terraform state push "$backup_file"
        log "INFO" "Rollback completed successfully"
    fi
}

# List available backups
list_backups() {
    local environment="${1:-}"
    
    log "INFO" "Available backups:"
    
    for metadata_file in "$BACKUP_DIR"/*-backup-*.json; do
        if [[ -f "$metadata_file" ]]; then
            local env=$(jq -r '.environment' "$metadata_file")
            local backend=$(jq -r '.backend' "$metadata_file")
            local timestamp=$(jq -r '.timestamp' "$metadata_file")
            local size=$(jq -r '.size_bytes' "$metadata_file")
            
            if [[ -z "$environment" || "$environment" == "$env" ]]; then
                printf "%-20s %-10s %-25s %10s bytes\n" "$env" "$backend" "$timestamp" "$size"
            fi
        fi
    done
}

# Show usage
show_usage() {
    cat << EOF
Terraform State Migration Script

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    migrate     Migrate state between backends
    import      Import existing resources
    rollback    Rollback to previous backup
    backup      Create backup of current state
    list        List available backups
    help        Show this help message

Options:
    --environment ENV       Environment to operate on
    --source-backend TYPE   Source backend (aws, gcp, azure, local)
    --target-backend TYPE   Target backend (aws, gcp, azure, local)
    --import-file FILE      JSON file with resources to import
    --backup-timestamp TS   Backup timestamp for rollback
    --config FILE           Configuration file path
    --dry-run              Show what would be done without executing
    --force                Force operation without confirmation
    --no-backup            Skip backup creation

Examples:
    $0 migrate --environment prod --source-backend local --target-backend aws
    $0 import --environment dev --import-file resources.json
    $0 rollback --environment staging --backup-timestamp 20240101_120000
    $0 backup --environment prod
    $0 list --environment prod

EOF
}

# Parse command line arguments
COMMAND=""
while [[ $# -gt 0 ]]; do
    case $1 in
        migrate|import|rollback|backup|list|help)
            COMMAND="$1"
            shift
            ;;
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --source-backend)
            SOURCE_BACKEND="$2"
            shift 2
            ;;
        --target-backend)
            TARGET_BACKEND="$2"
            shift 2
            ;;
        --import-file)
            IMPORT_FILE="$2"
            shift 2
            ;;
        --backup-timestamp)
            BACKUP_TIMESTAMP="$2"
            shift 2
            ;;
        --config)
            CONFIG_FILE="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --no-backup)
            BACKUP_ENABLED=false
            shift
            ;;
        *)
            error_exit "Unknown option: $1"
            ;;
    esac
done

# Default command
if [[ -z "$COMMAND" ]]; then
    COMMAND="help"
fi

# Create necessary directories
mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$BACKUP_DIR"

# Create lock file
create_lock

# Check prerequisites
check_prerequisites

# Load configuration
load_config

# Execute command
case "$COMMAND" in
    "migrate")
        if [[ -z "$ENVIRONMENT" || -z "$SOURCE_BACKEND" || -z "$TARGET_BACKEND" ]]; then
            error_exit "migrate command requires --environment, --source-backend, and --target-backend"
        fi
        
        if [[ "$SOURCE_BACKEND" == "$TARGET_BACKEND" ]]; then
            error_exit "Source and target backends cannot be the same"
        fi
        
        timestamp=$(date +%Y%m%d_%H%M%S)
        migrate_state "$ENVIRONMENT" "$SOURCE_BACKEND" "$TARGET_BACKEND" "$timestamp"
        ;;
    "import")
        if [[ -z "$ENVIRONMENT" || -z "$IMPORT_FILE" ]]; then
            error_exit "import command requires --environment and --import-file"
        fi
        
        import_resources "$ENVIRONMENT" "$IMPORT_FILE"
        ;;
    "rollback")
        if [[ -z "$ENVIRONMENT" || -z "$BACKUP_TIMESTAMP" ]]; then
            error_exit "rollback command requires --environment and --backup-timestamp"
        fi
        
        rollback_migration "$ENVIRONMENT" "$BACKUP_TIMESTAMP"
        ;;
    "backup")
        if [[ -z "$ENVIRONMENT" ]]; then
            error_exit "backup command requires --environment"
        fi
        
        timestamp=$(date +%Y%m%d_%H%M%S)
        backup_current_state "$ENVIRONMENT" "current" "$timestamp"
        ;;
    "list")
        list_backups "$ENVIRONMENT"
        ;;
    "help")
        show_usage
        ;;
    *)
        error_exit "Unknown command: $COMMAND"
        ;;
esac