#!/bin/bash

# Learning Assistant Backup Script
# This script creates comprehensive backups of the application data

set -e  # Exit on any error

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="learning_assistant_backup_${TIMESTAMP}"

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

# S3 configuration (for remote backups)
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
            --data "{\"text\":\"🔄 Backup ${status}: ${message}\"}" \
            "$SLACK_WEBHOOK" 2>/dev/null || true
    fi
    
    if [[ -n "$DISCORD_WEBHOOK" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"content\":\"🔄 Backup ${status}: ${message}\"}" \
            "$DISCORD_WEBHOOK" 2>/dev/null || true
    fi
}

# Check prerequisites
check_prerequisites() {
    log "INFO" "Checking prerequisites..."
    
    # Check if required tools are installed
    local tools=("pg_dump" "redis-cli" "tar" "gzip")
    
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log "ERROR" "$tool is not installed"
            exit 1
        fi
    done
    
    # Check if backup directory exists
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log "INFO" "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
    fi
    
    # Check disk space (warn if less than 5GB available)
    local available_space=$(df "$BACKUP_DIR" | tail -1 | awk '{print $4}')
    if [[ $available_space -lt 5242880 ]]; then  # 5GB in KB
        log "WARN" "Low disk space available: $(($available_space / 1024 / 1024))GB"
    fi
    
    log "INFO" "Prerequisites check completed"
}

# Backup PostgreSQL database
backup_database() {
    log "INFO" "Starting database backup..."
    
    local db_backup_file="${BACKUP_DIR}/${BACKUP_NAME}_database.sql.gz"
    
    # Set password for pg_dump
    export PGPASSWORD="$DB_PASSWORD"
    
    # Create database backup
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --no-password --verbose --format=custom --compress=9 | gzip > "$db_backup_file"; then
        
        local file_size=$(du -h "$db_backup_file" | cut -f1)
        log "INFO" "Database backup completed: $db_backup_file ($file_size)"
        
        # Verify backup integrity
        if gzip -t "$db_backup_file"; then
            log "INFO" "Database backup integrity verified"
        else
            log "ERROR" "Database backup integrity check failed"
            return 1
        fi
    else
        log "ERROR" "Database backup failed"
        return 1
    fi
    
    unset PGPASSWORD
}

# Backup Redis data
backup_redis() {
    log "INFO" "Starting Redis backup..."
    
    local redis_backup_file="${BACKUP_DIR}/${BACKUP_NAME}_redis.rdb"
    
    # Redis backup using BGSAVE
    if [[ -n "$REDIS_PASSWORD" ]]; then
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" BGSAVE
    else
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" BGSAVE
    fi
    
    # Wait for background save to complete
    local save_status=""
    while [[ "$save_status" != "OK" ]]; do
        sleep 1
        if [[ -n "$REDIS_PASSWORD" ]]; then
            save_status=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" LASTSAVE)
        else
            save_status=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" LASTSAVE)
        fi
    done
    
    # Copy Redis dump file
    if [[ -n "$REDIS_PASSWORD" ]]; then
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --rdb "$redis_backup_file"
    else
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" --rdb "$redis_backup_file"
    fi
    
    if [[ -f "$redis_backup_file" ]]; then
        local file_size=$(du -h "$redis_backup_file" | cut -f1)
        log "INFO" "Redis backup completed: $redis_backup_file ($file_size)"
        
        # Compress Redis backup
        gzip "$redis_backup_file"
        log "INFO" "Redis backup compressed: ${redis_backup_file}.gz"
    else
        log "ERROR" "Redis backup failed"
        return 1
    fi
}

# Backup application files
backup_files() {
    log "INFO" "Starting file backup..."
    
    local files_backup="${BACKUP_DIR}/${BACKUP_NAME}_files.tar.gz"
    
    # Create list of directories to backup
    local backup_dirs=()
    
    if [[ -d "$UPLOADS_DIR" ]]; then
        backup_dirs+=("$UPLOADS_DIR")
    fi
    
    if [[ -d "$LOGS_DIR" ]]; then
        backup_dirs+=("$LOGS_DIR")
    fi
    
    # Add configuration files
    local config_files=(
        "${APP_DIR}/.env"
        "${APP_DIR}/.env.production"
        "${APP_DIR}/config"
        "${APP_DIR}/scripts"
    )
    
    for config_file in "${config_files[@]}"; do
        if [[ -e "$config_file" ]]; then
            backup_dirs+=("$config_file")
        fi
    done
    
    if [[ ${#backup_dirs[@]} -gt 0 ]]; then
        if tar -czf "$files_backup" "${backup_dirs[@]}" 2>/dev/null; then
            local file_size=$(du -h "$files_backup" | cut -f1)
            log "INFO" "File backup completed: $files_backup ($file_size)"
        else
            log "WARN" "File backup completed with warnings"
        fi
    else
        log "WARN" "No files found to backup"
    fi
}

# Create backup manifest
create_manifest() {
    log "INFO" "Creating backup manifest..."
    
    local manifest_file="${BACKUP_DIR}/${BACKUP_NAME}_manifest.json"
    
    cat > "$manifest_file" << EOF
{
    "backup_name": "$BACKUP_NAME",
    "timestamp": "$TIMESTAMP",
    "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "version": "$(cat ${APP_DIR}/package.json | grep version | cut -d'"' -f4 2>/dev/null || echo 'unknown')",
    "environment": "${NODE_ENV:-production}",
    "database": {
        "host": "$DB_HOST",
        "port": "$DB_PORT",
        "name": "$DB_NAME",
        "user": "$DB_USER"
    },
    "redis": {
        "host": "$REDIS_HOST",
        "port": "$REDIS_PORT"
    },
    "files": [
EOF

    # Add file information to manifest
    local first=true
    for file in "${BACKUP_DIR}/${BACKUP_NAME}"*; do
        if [[ "$file" != "$manifest_file" && -f "$file" ]]; then
            if [[ "$first" == true ]]; then
                first=false
            else
                echo "," >> "$manifest_file"
            fi
            
            local filename=$(basename "$file")
            local size=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null || echo 0)
            local checksum=$(sha256sum "$file" 2>/dev/null | cut -d' ' -f1 || shasum -a 256 "$file" 2>/dev/null | cut -d' ' -f1 || echo 'unknown')
            
            echo -n "        {\"name\": \"$filename\", \"size\": $size, \"checksum\": \"$checksum\"}" >> "$manifest_file"
        fi
    done
    
    cat >> "$manifest_file" << EOF

    ],
    "retention_days": $RETENTION_DAYS,
    "backup_script_version": "1.0.0"
}
EOF

    log "INFO" "Backup manifest created: $manifest_file"
}

# Upload to S3 (if configured)
upload_to_s3() {
    if [[ -z "$S3_BUCKET" ]]; then
        log "INFO" "S3 upload not configured, skipping..."
        return 0
    fi
    
    log "INFO" "Uploading backup to S3..."
    
    # Check if AWS CLI is available
    if ! command -v aws &> /dev/null; then
        log "ERROR" "AWS CLI not installed, cannot upload to S3"
        return 1
    fi
    
    # Upload all backup files
    for file in "${BACKUP_DIR}/${BACKUP_NAME}"*; do
        if [[ -f "$file" ]]; then
            local filename=$(basename "$file")
            local s3_path="s3://${S3_BUCKET}/${S3_PREFIX}${filename}"
            
            if aws s3 cp "$file" "$s3_path"; then
                log "INFO" "Uploaded $filename to S3"
            else
                log "ERROR" "Failed to upload $filename to S3"
                return 1
            fi
        fi
    done
    
    log "INFO" "S3 upload completed"
}

# Cleanup old backups
cleanup_old_backups() {
    log "INFO" "Cleaning up old backups (retention: $RETENTION_DAYS days)..."
    
    # Local cleanup
    find "$BACKUP_DIR" -name "learning_assistant_backup_*" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    
    # S3 cleanup (if configured)
    if [[ -n "$S3_BUCKET" ]] && command -v aws &> /dev/null; then
        local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d 2>/dev/null || date -v-${RETENTION_DAYS}d +%Y-%m-%d 2>/dev/null)
        
        aws s3api list-objects-v2 --bucket "$S3_BUCKET" --prefix "$S3_PREFIX" --query "Contents[?LastModified<='$cutoff_date'].Key" --output text | \
        while read -r key; do
            if [[ -n "$key" && "$key" != "None" ]]; then
                aws s3 rm "s3://${S3_BUCKET}/${key}"
                log "INFO" "Deleted old S3 backup: $key"
            fi
        done
    fi
    
    log "INFO" "Cleanup completed"
}

# Verify backup
verify_backup() {
    log "INFO" "Verifying backup integrity..."
    
    local backup_files=("${BACKUP_DIR}/${BACKUP_NAME}"*)
    local verification_failed=false
    
    for file in "${backup_files[@]}"; do
        if [[ -f "$file" && "$file" != *"_manifest.json" ]]; then
            # Check if file is a gzip file
            if [[ "$file" == *.gz ]]; then
                if ! gzip -t "$file"; then
                    log "ERROR" "Backup file corrupted: $file"
                    verification_failed=true
                fi
            fi
            
            # Check file size (should be > 0)
            local size=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null || echo 0)
            if [[ $size -eq 0 ]]; then
                log "ERROR" "Backup file is empty: $file"
                verification_failed=true
            fi
        fi
    done
    
    if [[ "$verification_failed" == true ]]; then
        log "ERROR" "Backup verification failed"
        return 1
    else
        log "INFO" "Backup verification successful"
        return 0
    fi
}

# Main backup function
main() {
    local start_time=$(date +%s)
    log "INFO" "Starting backup process: $BACKUP_NAME"
    
    # Send start notification
    send_notification "STARTED" "Backup process initiated for Learning Assistant"
    
    # Run backup steps
    if check_prerequisites && \
       backup_database && \
       backup_redis && \
       backup_files && \
       create_manifest && \
       verify_backup; then
        
        # Optional S3 upload
        upload_to_s3 || log "WARN" "S3 upload failed, but backup completed locally"
        
        # Cleanup old backups
        cleanup_old_backups
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        local total_size=$(du -sh "${BACKUP_DIR}/${BACKUP_NAME}"* 2>/dev/null | awk '{s+=$1} END {print s}' || echo "unknown")
        
        log "INFO" "Backup completed successfully in ${duration}s (Total size: ${total_size})"
        send_notification "SUCCESS" "Backup completed in ${duration}s"
        
        exit 0
    else
        log "ERROR" "Backup failed"
        send_notification "FAILED" "Backup process failed - check logs for details"
        exit 1
    fi
}

# Handle script arguments
case "${1:-main}" in
    "main")
        main
        ;;
    "database")
        check_prerequisites && backup_database
        ;;
    "redis")
        check_prerequisites && backup_redis
        ;;
    "files")
        check_prerequisites && backup_files
        ;;
    "cleanup")
        cleanup_old_backups
        ;;
    "verify")
        verify_backup
        ;;
    "help")
        echo "Usage: $0 [main|database|redis|files|cleanup|verify|help]"
        echo "  main     - Run complete backup (default)"
        echo "  database - Backup database only"
        echo "  redis    - Backup Redis only"
        echo "  files    - Backup files only"
        echo "  cleanup  - Cleanup old backups"
        echo "  verify   - Verify existing backups"
        echo "  help     - Show this help"
        ;;
    *)
        log "ERROR" "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac