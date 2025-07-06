#!/bin/bash

# Learning Assistant Restore Script
# This script restores application data from backups

set -e  # Exit on any error

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RESTORE_TIMESTAMP="${RESTORE_TIMESTAMP}"

# Database configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-learning_assistant_db}"
DB_USER="${DB_USER:-learning_user}"
DB_PASSWORD="${DB_PASSWORD}"

# Redis configuration
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASSWORD="${REDIS_PASSWORD}"

# S3 configuration (for remote restores)
S3_BUCKET="${S3_BUCKET}"
S3_PREFIX="${S3_PREFIX:-backups/}"

# Application directories
APP_DIR="${APP_DIR:-/app}"
UPLOADS_DIR="${UPLOADS_DIR:-/app/uploads}"
LOGS_DIR="${LOGS_DIR:-/app/logs}"

# Notification configuration
SLACK_WEBHOOK="${SLACK_WEBHOOK}"
DISCORD_WEBHOOK="${DISCORD_WEBHOOK}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${GREEN}[INFO]${NC} ${timestamp}: $message"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} ${timestamp}: $message"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} ${timestamp}: $message"
            ;;
        "DEBUG")
            echo -e "${BLUE}[DEBUG]${NC} ${timestamp}: $message"
            ;;
    esac
}

# Send notification
send_notification() {
    local status=$1
    local message=$2
    
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🔄 Restore ${status}: ${message}\"}" \
            "$SLACK_WEBHOOK" 2>/dev/null || true
    fi
    
    if [[ -n "$DISCORD_WEBHOOK" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"content\":\"🔄 Restore ${status}: ${message}\"}" \
            "$DISCORD_WEBHOOK" 2>/dev/null || true
    fi
}

# List available backups
list_backups() {
    log "INFO" "Available backups:"
    echo
    echo "Local backups:"
    find "$BACKUP_DIR" -name "learning_assistant_backup_*_manifest.json" -type f 2>/dev/null | while read -r manifest; do
        local backup_name=$(basename "$manifest" "_manifest.json")
        local timestamp=$(echo "$backup_name" | sed 's/learning_assistant_backup_//')
        local created_at=$(grep '"created_at"' "$manifest" | cut -d'"' -f4)
        local version=$(grep '"version"' "$manifest" | cut -d'"' -f4)
        
        echo "  $timestamp - Created: $created_at - Version: $version"
    done
    
    # List S3 backups if configured
    if [[ -n "$S3_BUCKET" ]] && command -v aws &> /dev/null; then
        echo
        echo "S3 backups:"
        aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}" | grep "_manifest.json" | while read -r line; do
            local filename=$(echo "$line" | awk '{print $4}')
            local backup_name=$(basename "$filename" "_manifest.json")
            local timestamp=$(echo "$backup_name" | sed 's/learning_assistant_backup_//')
            local date=$(echo "$line" | awk '{print $1 " " $2}')
            
            echo "  $timestamp - Date: $date"
        done
    fi
    echo
}

# Download backup from S3
download_from_s3() {
    local backup_timestamp=$1
    
    if [[ -z "$S3_BUCKET" ]]; then
        log "ERROR" "S3 not configured"
        return 1
    fi
    
    if ! command -v aws &> /dev/null; then
        log "ERROR" "AWS CLI not installed"
        return 1
    fi
    
    log "INFO" "Downloading backup from S3..."
    
    # Download all files for the backup
    local backup_prefix="learning_assistant_backup_${backup_timestamp}"
    
    aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}" | grep "$backup_prefix" | while read -r line; do
        local filename=$(echo "$line" | awk '{print $4}')
        local local_path="${BACKUP_DIR}/${filename}"
        local s3_path="s3://${S3_BUCKET}/${S3_PREFIX}${filename}"
        
        if aws s3 cp "$s3_path" "$local_path"; then
            log "INFO" "Downloaded $filename from S3"
        else
            log "ERROR" "Failed to download $filename from S3"
            return 1
        fi
    done
    
    log "INFO" "S3 download completed"
}

# Verify backup integrity
verify_backup() {
    local backup_timestamp=$1
    log "INFO" "Verifying backup integrity..."
    
    local backup_prefix="learning_assistant_backup_${backup_timestamp}"
    local manifest_file="${BACKUP_DIR}/${backup_prefix}_manifest.json"
    
    if [[ ! -f "$manifest_file" ]]; then
        log "ERROR" "Backup manifest not found: $manifest_file"
        return 1
    fi
    
    # Verify each file listed in manifest
    local verification_failed=false
    
    while IFS= read -r line; do
        if echo "$line" | grep -q '"name"'; then
            local filename=$(echo "$line" | sed 's/.*"name": "\([^"]*\)".*/\1/')
            local expected_checksum=$(echo "$line" | sed 's/.*"checksum": "\([^"]*\)".*/\1/')
            local file_path="${BACKUP_DIR}/${filename}"
            
            if [[ -f "$file_path" ]]; then
                local actual_checksum=$(sha256sum "$file_path" 2>/dev/null | cut -d' ' -f1 || shasum -a 256 "$file_path" 2>/dev/null | cut -d' ' -f1 || echo 'unknown')
                
                if [[ "$actual_checksum" != "$expected_checksum" ]]; then
                    log "ERROR" "Checksum mismatch for $filename"
                    verification_failed=true
                fi
            else
                log "ERROR" "Backup file missing: $filename"
                verification_failed=true
            fi
        fi
    done < "$manifest_file"
    
    if [[ "$verification_failed" == true ]]; then
        log "ERROR" "Backup verification failed"
        return 1
    else
        log "INFO" "Backup verification successful"
        return 0
    fi
}

# Create database backup before restore
backup_current_database() {
    log "INFO" "Creating backup of current database..."
    
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_file="${BACKUP_DIR}/pre_restore_db_backup_${timestamp}.sql.gz"
    
    export PGPASSWORD="$DB_PASSWORD"
    
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --no-password --verbose --format=custom --compress=9 | gzip > "$backup_file"; then
        log "INFO" "Current database backed up to: $backup_file"
    else
        log "WARN" "Failed to backup current database"
    fi
    
    unset PGPASSWORD
}

# Restore database
restore_database() {
    local backup_timestamp=$1
    log "INFO" "Restoring database..."
    
    local backup_prefix="learning_assistant_backup_${backup_timestamp}"
    local db_backup_file="${BACKUP_DIR}/${backup_prefix}_database.sql.gz"
    
    if [[ ! -f "$db_backup_file" ]]; then
        log "ERROR" "Database backup file not found: $db_backup_file"
        return 1
    fi
    
    # Create database backup before restore
    backup_current_database
    
    # Set password for psql
    export PGPASSWORD="$DB_PASSWORD"
    
    # Drop and recreate database
    log "INFO" "Dropping existing database..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;"
    
    # Restore database
    log "INFO" "Restoring database from backup..."
    if gunzip -c "$db_backup_file" | pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --no-password --verbose; then
        log "INFO" "Database restore completed"
    else
        log "ERROR" "Database restore failed"
        unset PGPASSWORD
        return 1
    fi
    
    unset PGPASSWORD
}

# Restore Redis
restore_redis() {
    local backup_timestamp=$1
    log "INFO" "Restoring Redis..."
    
    local backup_prefix="learning_assistant_backup_${backup_timestamp}"
    local redis_backup_file="${BACKUP_DIR}/${backup_prefix}_redis.rdb.gz"
    
    if [[ ! -f "$redis_backup_file" ]]; then
        log "ERROR" "Redis backup file not found: $redis_backup_file"
        return 1
    fi
    
    # Stop Redis (if running locally)
    if systemctl is-active --quiet redis 2>/dev/null; then
        log "INFO" "Stopping Redis service..."
        systemctl stop redis
    fi
    
    # Flush existing Redis data
    log "INFO" "Flushing existing Redis data..."
    if [[ -n "$REDIS_PASSWORD" ]]; then
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" FLUSHALL
    else
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" FLUSHALL
    fi
    
    # Restore Redis data
    log "INFO" "Restoring Redis from backup..."
    local temp_rdb_file=$(mktemp)
    gunzip -c "$redis_backup_file" > "$temp_rdb_file"
    
    # Use redis-cli to restore
    if [[ -n "$REDIS_PASSWORD" ]]; then
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --rdb "$temp_rdb_file"
    else
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" --rdb "$temp_rdb_file"
    fi
    
    rm -f "$temp_rdb_file"
    
    # Start Redis (if we stopped it)
    if systemctl is-enabled --quiet redis 2>/dev/null; then
        log "INFO" "Starting Redis service..."
        systemctl start redis
    fi
    
    log "INFO" "Redis restore completed"
}

# Restore files
restore_files() {
    local backup_timestamp=$1
    log "INFO" "Restoring files..."
    
    local backup_prefix="learning_assistant_backup_${backup_timestamp}"
    local files_backup="${BACKUP_DIR}/${backup_prefix}_files.tar.gz"
    
    if [[ ! -f "$files_backup" ]]; then
        log "WARN" "Files backup not found: $files_backup"
        return 0  # Not critical
    fi
    
    # Create backup of current files
    local current_backup_dir="${BACKUP_DIR}/pre_restore_files_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$current_backup_dir"
    
    if [[ -d "$UPLOADS_DIR" ]]; then
        cp -r "$UPLOADS_DIR" "$current_backup_dir/" 2>/dev/null || true
    fi
    
    if [[ -d "$LOGS_DIR" ]]; then
        cp -r "$LOGS_DIR" "$current_backup_dir/" 2>/dev/null || true
    fi
    
    # Restore files
    log "INFO" "Extracting files from backup..."
    if tar -xzf "$files_backup" -C / 2>/dev/null; then
        log "INFO" "Files restore completed"
    else
        log "WARN" "Files restore completed with warnings"
    fi
}

# Post-restore checks
post_restore_checks() {
    log "INFO" "Running post-restore checks..."
    
    # Check database connectivity
    export PGPASSWORD="$DB_PASSWORD"
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT COUNT(*) FROM users;" >/dev/null 2>&1; then
        log "INFO" "Database connectivity verified"
    else
        log "ERROR" "Database connectivity check failed"
        unset PGPASSWORD
        return 1
    fi
    unset PGPASSWORD
    
    # Check Redis connectivity
    if [[ -n "$REDIS_PASSWORD" ]]; then
        redis_response=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" ping 2>/dev/null || echo "FAILED")
    else
        redis_response=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null || echo "FAILED")
    fi
    
    if [[ "$redis_response" == "PONG" ]]; then
        log "INFO" "Redis connectivity verified"
    else
        log "ERROR" "Redis connectivity check failed"
        return 1
    fi
    
    # Check file permissions
    if [[ -d "$UPLOADS_DIR" ]]; then
        if [[ -r "$UPLOADS_DIR" && -w "$UPLOADS_DIR" ]]; then
            log "INFO" "File permissions verified"
        else
            log "WARN" "File permission issues detected"
        fi
    fi
    
    log "INFO" "Post-restore checks completed"
}

# Interactive restore mode
interactive_restore() {
    echo "Learning Assistant - Interactive Restore"
    echo "======================================="
    echo
    
    list_backups
    
    echo -n "Enter backup timestamp to restore (YYYYMMDD_HHMMSS): "
    read -r backup_timestamp
    
    if [[ -z "$backup_timestamp" ]]; then
        log "ERROR" "No timestamp provided"
        return 1
    fi
    
    # Check if backup exists locally
    local backup_prefix="learning_assistant_backup_${backup_timestamp}"
    local manifest_file="${BACKUP_DIR}/${backup_prefix}_manifest.json"
    
    if [[ ! -f "$manifest_file" ]]; then
        echo "Backup not found locally. Download from S3? (y/n): "
        read -r download_choice
        
        if [[ "$download_choice" =~ ^[Yy]$ ]]; then
            download_from_s3 "$backup_timestamp" || return 1
        else
            log "ERROR" "Backup not available for restore"
            return 1
        fi
    fi
    
    echo
    echo "WARNING: This will overwrite current data!"
    echo "Components to restore:"
    echo "  [✓] Database"
    echo "  [✓] Redis cache"
    echo "  [✓] Application files"
    echo
    echo -n "Are you sure you want to continue? (yes/no): "
    read -r confirmation
    
    if [[ "$confirmation" != "yes" ]]; then
        log "INFO" "Restore cancelled by user"
        return 0
    fi
    
    restore_backup "$backup_timestamp"
}

# Main restore function
restore_backup() {
    local backup_timestamp=$1
    
    if [[ -z "$backup_timestamp" ]]; then
        log "ERROR" "Backup timestamp not provided"
        return 1
    fi
    
    local start_time=$(date +%s)
    log "INFO" "Starting restore process for backup: $backup_timestamp"
    
    # Send start notification
    send_notification "STARTED" "Restore process initiated for backup $backup_timestamp"
    
    # Verify backup before restore
    if ! verify_backup "$backup_timestamp"; then
        log "ERROR" "Backup verification failed, aborting restore"
        send_notification "FAILED" "Backup verification failed"
        return 1
    fi
    
    # Run restore steps
    if restore_database "$backup_timestamp" && \
       restore_redis "$backup_timestamp" && \
       restore_files "$backup_timestamp" && \
       post_restore_checks; then
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log "INFO" "Restore completed successfully in ${duration}s"
        send_notification "SUCCESS" "Restore completed in ${duration}s"
        
        return 0
    else
        log "ERROR" "Restore failed"
        send_notification "FAILED" "Restore process failed - check logs for details"
        return 1
    fi
}

# Handle script arguments
case "${1:-help}" in
    "list")
        list_backups
        ;;
    "interactive")
        interactive_restore
        ;;
    "restore")
        if [[ -n "$2" ]]; then
            restore_backup "$2"
        else
            log "ERROR" "Backup timestamp required for restore"
            echo "Usage: $0 restore <timestamp>"
            exit 1
        fi
        ;;
    "download")
        if [[ -n "$2" ]]; then
            download_from_s3 "$2"
        else
            log "ERROR" "Backup timestamp required for download"
            echo "Usage: $0 download <timestamp>"
            exit 1
        fi
        ;;
    "verify")
        if [[ -n "$2" ]]; then
            verify_backup "$2"
        else
            log "ERROR" "Backup timestamp required for verification"
            echo "Usage: $0 verify <timestamp>"
            exit 1
        fi
        ;;
    "help")
        echo "Learning Assistant Restore Script"
        echo "Usage: $0 [command] [options]"
        echo
        echo "Commands:"
        echo "  list        - List available backups"
        echo "  interactive - Interactive restore mode"
        echo "  restore <timestamp> - Restore specific backup"
        echo "  download <timestamp> - Download backup from S3"
        echo "  verify <timestamp> - Verify backup integrity"
        echo "  help        - Show this help"
        echo
        echo "Examples:"
        echo "  $0 list"
        echo "  $0 restore 20231225_143000"
        echo "  $0 interactive"
        ;;
    *)
        log "ERROR" "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac