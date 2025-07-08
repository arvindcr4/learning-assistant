#!/bin/bash

# Enhanced PostgreSQL Database Backup Script with Point-in-Time Recovery
# Learning Assistant Application - Database Backup System
# Version: 2.0.0

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/learning-assistant}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
RETENTION_MONTHS="${RETENTION_MONTHS:-12}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="db_backup_${TIMESTAMP}"

# Database configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-learning_assistant_db}"
DB_USER="${DB_USER:-learning_user}"
DB_PASSWORD="${DB_PASSWORD}"

# Advanced settings
COMPRESSION_LEVEL="${COMPRESSION_LEVEL:-9}"
PARALLEL_JOBS="${PARALLEL_JOBS:-4}"
POINT_IN_TIME_RECOVERY="${POINT_IN_TIME_RECOVERY:-true}"
INCREMENTAL_BACKUP="${INCREMENTAL_BACKUP:-false}"
ENCRYPTION_ENABLED="${ENCRYPTION_ENABLED:-true}"
ENCRYPTION_KEY_FILE="${ENCRYPTION_KEY_FILE:-/etc/backup/encryption.key}"

# Remote storage configuration
S3_BUCKET="${S3_BUCKET}"
S3_PREFIX="${S3_PREFIX:-database-backups/}"
S3_STORAGE_CLASS="${S3_STORAGE_CLASS:-STANDARD_IA}"
AZURE_CONTAINER="${AZURE_CONTAINER}"
GCS_BUCKET="${GCS_BUCKET}"

# Monitoring and alerting
SLACK_WEBHOOK="${SLACK_WEBHOOK}"
DISCORD_WEBHOOK="${DISCORD_WEBHOOK}"
EMAIL_ALERTS="${EMAIL_ALERTS}"
PAGERDUTY_INTEGRATION_KEY="${PAGERDUTY_INTEGRATION_KEY}"

# Backup monitoring integration
BACKUP_MONITOR_ENABLED="${BACKUP_MONITOR_ENABLED:-true}"
BACKUP_MONITOR_URL="${BACKUP_MONITOR_URL:-http://backup-monitor.learning-assistant.svc.cluster.local:9090}"
PROMETHEUS_PUSHGATEWAY="${PROMETHEUS_PUSHGATEWAY:-http://prometheus-pushgateway.monitoring.svc.cluster.local:9091}"
MONITOR_JOB_NAME="${MONITOR_JOB_NAME:-database_backup}"

# Performance monitoring
BACKUP_TIMEOUT="${BACKUP_TIMEOUT:-7200}"  # 2 hours
MIN_BACKUP_SIZE="${MIN_BACKUP_SIZE:-10485760}"  # 10MB minimum
MAX_BACKUP_SIZE="${MAX_BACKUP_SIZE:-107374182400}"  # 100GB maximum

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Logging with levels
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${GREEN}[INFO]${NC} ${timestamp}: $message" | tee -a "${BACKUP_DIR}/backup.log"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} ${timestamp}: $message" | tee -a "${BACKUP_DIR}/backup.log"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} ${timestamp}: $message" | tee -a "${BACKUP_DIR}/backup.log"
            ;;
        "DEBUG")
            echo -e "${BLUE}[DEBUG]${NC} ${timestamp}: $message" | tee -a "${BACKUP_DIR}/backup.log"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} ${timestamp}: $message" | tee -a "${BACKUP_DIR}/backup.log"
            ;;
    esac
}

# Enhanced notification system
send_notification() {
    local status=$1
    local message=$2
    local severity="${3:-info}"
    
    # Slack notification
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        local color="good"
        case $severity in
            "error") color="danger" ;;
            "warning") color="warning" ;;
        esac
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"Database Backup $status\",
                    \"text\": \"$message\",
                    \"footer\": \"Learning Assistant Backup System\",
                    \"ts\": $(date +%s)
                }]
            }" \
            "$SLACK_WEBHOOK" 2>/dev/null || true
    fi
    
    # Discord notification
    if [[ -n "$DISCORD_WEBHOOK" ]]; then
        local embed_color=65280  # Green
        case $severity in
            "error") embed_color=16711680 ;;  # Red
            "warning") embed_color=16776960 ;;  # Yellow
        esac
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"embeds\": [{
                    \"title\": \"Database Backup $status\",
                    \"description\": \"$message\",
                    \"color\": $embed_color,
                    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
                }]
            }" \
            "$DISCORD_WEBHOOK" 2>/dev/null || true
    fi
    
    # Email notification
    if [[ -n "$EMAIL_ALERTS" ]]; then
        local subject="Database Backup $status - Learning Assistant"
        echo -e "Subject: $subject\n\n$message\n\nTimestamp: $(date)\nHost: $(hostname)" | \
        sendmail "$EMAIL_ALERTS" 2>/dev/null || true
    fi
    
    # PagerDuty for critical alerts
    if [[ -n "$PAGERDUTY_INTEGRATION_KEY" && "$severity" == "error" ]]; then
        curl -X POST \
            -H 'Content-Type: application/json' \
            -d "{
                \"routing_key\": \"$PAGERDUTY_INTEGRATION_KEY\",
                \"event_action\": \"trigger\",
                \"payload\": {
                    \"summary\": \"Database Backup Failed - Learning Assistant\",
                    \"source\": \"$(hostname)\",
                    \"severity\": \"critical\",
                    \"custom_details\": {
                        \"message\": \"$message\",
                        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
                    }
                }
            }" \
            'https://events.pagerduty.com/v2/enqueue' 2>/dev/null || true
    fi
}

# Backup monitoring integration functions
register_backup_start() {
    if [[ "$BACKUP_MONITOR_ENABLED" != "true" ]]; then
        return 0
    fi
    
    local backup_type="${1:-full}"
    local backup_id="$BACKUP_NAME"
    
    # Register backup start with monitoring system
    curl -X POST -H 'Content-Type: application/json' \
        --data "{
            \"backup_id\": \"$backup_id\",
            \"backup_type\": \"$backup_type\",
            \"component\": \"database\",
            \"status\": \"started\",
            \"start_time\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
            \"database\": \"$DB_NAME\",
            \"host\": \"$DB_HOST\",
            \"retention_days\": $RETENTION_DAYS
        }" \
        "$BACKUP_MONITOR_URL/api/backup/register" 2>/dev/null || true
    
    log "DEBUG" "Registered backup start with monitoring system: $backup_id"
}

update_backup_progress() {
    if [[ "$BACKUP_MONITOR_ENABLED" != "true" ]]; then
        return 0
    fi
    
    local backup_id="$BACKUP_NAME"
    local progress="${1:-0}"
    local stage="${2:-unknown}"
    local details="${3:-}"
    
    # Update backup progress
    curl -X POST -H 'Content-Type: application/json' \
        --data "{
            \"backup_id\": \"$backup_id\",
            \"progress\": $progress,
            \"stage\": \"$stage\",
            \"details\": \"$details\",
            \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
        }" \
        "$BACKUP_MONITOR_URL/api/backup/progress" 2>/dev/null || true
    
    log "DEBUG" "Updated backup progress: $progress% ($stage)"
}

complete_backup_monitoring() {
    if [[ "$BACKUP_MONITOR_ENABLED" != "true" ]]; then
        return 0
    fi
    
    local backup_id="$BACKUP_NAME"
    local status="${1:-success}"
    local file_size="${2:-0}"
    local duration="${3:-0}"
    local error_message="${4:-}"
    
    # Complete backup monitoring
    curl -X POST -H 'Content-Type: application/json' \
        --data "{
            \"backup_id\": \"$backup_id\",
            \"status\": \"$status\",
            \"end_time\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
            \"file_size\": $file_size,
            \"duration\": $duration,
            \"error_message\": \"$error_message\",
            \"storage_locations\": [
                \"local:${BACKUP_DIR}/${backup_id}_full.backup\",
                \"s3:${S3_BUCKET}/${S3_PREFIX}${backup_id}_full.backup\"
            ]
        }" \
        "$BACKUP_MONITOR_URL/api/backup/complete" 2>/dev/null || true
    
    log "DEBUG" "Completed backup monitoring: $backup_id ($status)"
}

push_metrics_to_prometheus() {
    if [[ "$BACKUP_MONITOR_ENABLED" != "true" ]] || [[ -z "$PROMETHEUS_PUSHGATEWAY" ]]; then
        return 0
    fi
    
    local backup_type="${1:-full}"
    local status="${2:-success}"
    local duration="${3:-0}"
    local file_size="${4:-0}"
    local database_size="${5:-0}"
    
    # Push metrics to Prometheus pushgateway
    cat << EOF | curl -X POST --data-binary @- "$PROMETHEUS_PUSHGATEWAY/metrics/job/$MONITOR_JOB_NAME/instance/$(hostname)"
# HELP backup_duration_seconds Time taken to complete backup
# TYPE backup_duration_seconds gauge
backup_duration_seconds{backup_type="$backup_type",database="$DB_NAME",status="$status"} $duration

# HELP backup_file_size_bytes Size of backup file in bytes
# TYPE backup_file_size_bytes gauge
backup_file_size_bytes{backup_type="$backup_type",database="$DB_NAME",status="$status"} $file_size

# HELP backup_database_size_bytes Size of database being backed up
# TYPE backup_database_size_bytes gauge
backup_database_size_bytes{backup_type="$backup_type",database="$DB_NAME"} $database_size

# HELP backup_timestamp_seconds Unix timestamp when backup was completed
# TYPE backup_timestamp_seconds gauge
backup_timestamp_seconds{backup_type="$backup_type",database="$DB_NAME",status="$status"} $(date +%s)

# HELP backup_compression_ratio Compression ratio achieved
# TYPE backup_compression_ratio gauge
backup_compression_ratio{backup_type="$backup_type",database="$DB_NAME"} $(awk "BEGIN {if($database_size > 0) print $file_size / $database_size; else print 0}")

# HELP backup_retention_days Number of days backup will be retained
# TYPE backup_retention_days gauge
backup_retention_days{backup_type="$backup_type",database="$DB_NAME"} $RETENTION_DAYS
EOF

    log "DEBUG" "Pushed metrics to Prometheus pushgateway"
}

setup_point_in_time_recovery_monitoring() {
    if [[ "$BACKUP_MONITOR_ENABLED" != "true" ]]; then
        return 0
    fi
    
    # Register PITR capability with monitoring system
    curl -X POST -H 'Content-Type: application/json' \
        --data "{
            \"database\": \"$DB_NAME\",
            \"pitr_enabled\": true,
            \"wal_archive_location\": \"${BACKUP_DIR}/wal_archive\",
            \"base_backup_location\": \"${BACKUP_DIR}/${BACKUP_NAME}_full.backup\",
            \"recovery_target_time\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
            \"wal_retention_hours\": 168
        }" \
        "$BACKUP_MONITOR_URL/api/pitr/register" 2>/dev/null || true
    
    log "DEBUG" "Registered PITR capability with monitoring system"
}

# Pre-backup validation
validate_prerequisites() {
    log "INFO" "Validating prerequisites for database backup..."
    
    # Check required tools
    local tools=("pg_dump" "psql" "gzip" "openssl" "curl" "jq")
    
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log "ERROR" "Required tool not found: $tool"
            exit 1
        fi
    done
    
    # Check database connectivity
    export PGPASSWORD="$DB_PASSWORD"
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &> /dev/null; then
        log "ERROR" "Cannot connect to database: $DB_HOST:$DB_PORT/$DB_NAME"
        exit 1
    fi
    unset PGPASSWORD
    
    # Check backup directory
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log "INFO" "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
    fi
    
    # Check disk space (warn if less than 10GB available)
    local available_space=$(df "$BACKUP_DIR" | tail -1 | awk '{print $4}')
    local required_space=10485760  # 10GB in KB
    
    if [[ $available_space -lt $required_space ]]; then
        log "WARN" "Low disk space: $(($available_space / 1024 / 1024))GB available, 10GB+ recommended"
    fi
    
    # Check encryption setup
    if [[ "$ENCRYPTION_ENABLED" == "true" ]]; then
        if [[ ! -f "$ENCRYPTION_KEY_FILE" ]]; then
            log "INFO" "Generating encryption key..."
            mkdir -p "$(dirname "$ENCRYPTION_KEY_FILE")"
            openssl rand -base64 32 > "$ENCRYPTION_KEY_FILE"
            chmod 600 "$ENCRYPTION_KEY_FILE"
        fi
    fi
    
    log "SUCCESS" "Prerequisites validation completed"
}

# Database schema backup
backup_schema() {
    log "INFO" "Creating database schema backup..."
    
    local schema_file="${BACKUP_DIR}/${BACKUP_NAME}_schema.sql"
    
    export PGPASSWORD="$DB_PASSWORD"
    
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --schema-only --verbose --no-owner --no-privileges > "$schema_file"; then
        
        # Compress schema
        gzip -"$COMPRESSION_LEVEL" "$schema_file"
        
        local file_size=$(du -h "${schema_file}.gz" | cut -f1)
        log "SUCCESS" "Schema backup completed: ${schema_file}.gz ($file_size)"
    else
        log "ERROR" "Schema backup failed"
        unset PGPASSWORD
        return 1
    fi
    
    unset PGPASSWORD
}

# Full database backup with parallel processing
backup_database_full() {
    log "INFO" "Starting full database backup..."
    
    local backup_file="${BACKUP_DIR}/${BACKUP_NAME}_full.backup"
    local start_time=$(date +%s)
    
    # Register backup start with monitoring system
    register_backup_start "full"
    update_backup_progress 5 "preparation" "Preparing full database backup"
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Update progress - starting backup
    update_backup_progress 10 "dump_start" "Starting pg_dump process"
    
    # Create backup with parallel processing
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --format=custom \
        --compress="$COMPRESSION_LEVEL" \
        --jobs="$PARALLEL_JOBS" \
        --verbose \
        --no-owner \
        --no-privileges \
        --file="$backup_file"; then
        
        update_backup_progress 80 "dump_complete" "Database dump completed"
        
        local file_size=$(du -h "$backup_file" | cut -f1)
        local backup_size=$(stat -c%s "$backup_file" 2>/dev/null || stat -f%z "$backup_file" 2>/dev/null || echo 0)
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log "SUCCESS" "Full database backup completed: $backup_file ($file_size)"
        
        # Validate backup size
        if [[ $backup_size -lt $MIN_BACKUP_SIZE ]]; then
            log "ERROR" "Backup file too small: ${backup_size} bytes (minimum: ${MIN_BACKUP_SIZE})"
            complete_backup_monitoring "failed" "$backup_size" "$duration" "Backup file too small"
            return 1
        fi
        
        if [[ $backup_size -gt $MAX_BACKUP_SIZE ]]; then
            log "WARN" "Backup file very large: ${backup_size} bytes (maximum expected: ${MAX_BACKUP_SIZE})"
        fi
        
        # Get database size for metrics
        local db_size=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT pg_database_size('$DB_NAME');" 2>/dev/null | tr -d ' ' || echo 0)
        
        # Complete monitoring and push metrics
        update_backup_progress 100 "complete" "Backup completed successfully"
        complete_backup_monitoring "success" "$backup_size" "$duration"
        push_metrics_to_prometheus "full" "success" "$duration" "$backup_size" "$db_size"
        
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log "ERROR" "Full database backup failed"
        complete_backup_monitoring "failed" "0" "$duration" "pg_dump process failed"
        push_metrics_to_prometheus "full" "failed" "$duration" "0" "0"
        unset PGPASSWORD
        return 1
    fi
    
    unset PGPASSWORD
}

# Incremental backup (WAL-based)
backup_database_incremental() {
    if [[ "$INCREMENTAL_BACKUP" != "true" ]]; then
        log "INFO" "Incremental backup disabled, skipping..."
        return 0
    fi
    
    log "INFO" "Starting incremental backup (WAL-based)..."
    
    local wal_backup_dir="${BACKUP_DIR}/wal_archive"
    mkdir -p "$wal_backup_dir"
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Get current WAL file
    local current_wal=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -t -c "SELECT pg_current_wal_file();" | tr -d ' ')
    
    # Archive WAL files
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -c "SELECT pg_switch_wal();" &> /dev/null; then
        
        log "SUCCESS" "WAL switch completed: $current_wal"
    else
        log "ERROR" "WAL switch failed"
        unset PGPASSWORD
        return 1
    fi
    
    unset PGPASSWORD
}

# Point-in-time recovery setup
setup_point_in_time_recovery() {
    if [[ "$POINT_IN_TIME_RECOVERY" != "true" ]]; then
        log "INFO" "Point-in-time recovery disabled, skipping..."
        return 0
    fi
    
    log "INFO" "Setting up point-in-time recovery..."
    
    local pitr_dir="${BACKUP_DIR}/pitr"
    mkdir -p "$pitr_dir"
    local start_time=$(date +%s)
    
    # Register PITR setup start
    register_backup_start "pitr"
    update_backup_progress 5 "pitr_preparation" "Preparing point-in-time recovery setup"
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Update progress - starting base backup
    update_backup_progress 20 "base_backup_start" "Starting pg_basebackup for PITR"
    
    # Create base backup for PITR
    if pg_basebackup -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
        -D "$pitr_dir/base_backup_${TIMESTAMP}" \
        -F tar -z -P -v; then
        
        update_backup_progress 80 "base_backup_complete" "Base backup for PITR completed"
        
        log "SUCCESS" "Base backup for PITR completed"
        
        # Create recovery configuration
        cat > "$pitr_dir/recovery_info.json" << EOF
{
    "backup_timestamp": "$TIMESTAMP",
    "backup_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "database_name": "$DB_NAME",
    "database_version": "$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT version();" | head -1 | tr -d ' ')",
    "recovery_target_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "base_backup_path": "$pitr_dir/base_backup_${TIMESTAMP}",
    "wal_archive_path": "${BACKUP_DIR}/wal_archive"
}
EOF
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        local backup_size=$(du -sb "$pitr_dir/base_backup_${TIMESTAMP}" 2>/dev/null | cut -f1 || echo 0)
        
        # Complete PITR monitoring
        update_backup_progress 100 "pitr_complete" "Point-in-time recovery setup completed"
        complete_backup_monitoring "success" "$backup_size" "$duration"
        setup_point_in_time_recovery_monitoring
        push_metrics_to_prometheus "pitr" "success" "$duration" "$backup_size" "0"
        
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log "ERROR" "Base backup for PITR failed"
        complete_backup_monitoring "failed" "0" "$duration" "pg_basebackup failed"
        push_metrics_to_prometheus "pitr" "failed" "$duration" "0" "0"
        unset PGPASSWORD
        return 1
    fi
    
    unset PGPASSWORD
}

# Encrypt backup files
encrypt_backup() {
    if [[ "$ENCRYPTION_ENABLED" != "true" ]]; then
        log "INFO" "Encryption disabled, skipping..."
        return 0
    fi
    
    log "INFO" "Encrypting backup files..."
    
    # Find all backup files
    local backup_files=("${BACKUP_DIR}/${BACKUP_NAME}"*)
    
    for file in "${backup_files[@]}"; do
        if [[ -f "$file" && "$file" != *.enc ]]; then
            local encrypted_file="${file}.enc"
            
            if openssl enc -aes-256-cbc -salt -in "$file" -out "$encrypted_file" -pass file:"$ENCRYPTION_KEY_FILE"; then
                log "SUCCESS" "Encrypted: $(basename "$file")"
                
                # Remove unencrypted file
                rm "$file"
            else
                log "ERROR" "Encryption failed for: $(basename "$file")"
                return 1
            fi
        fi
    done
    
    log "SUCCESS" "Backup encryption completed"
}

# Verify backup integrity
verify_backup_integrity() {
    log "INFO" "Verifying backup integrity..."
    
    local backup_files=("${BACKUP_DIR}/${BACKUP_NAME}"*)
    local verification_failed=false
    
    for file in "${backup_files[@]}"; do
        if [[ -f "$file" ]]; then
            local filename=$(basename "$file")
            
            # Check if file is encrypted
            if [[ "$file" == *.enc ]]; then
                if [[ "$ENCRYPTION_ENABLED" == "true" ]]; then
                    # Decrypt temporarily to verify
                    local temp_file="/tmp/backup_verify_$$"
                    if openssl enc -aes-256-cbc -d -in "$file" -out "$temp_file" -pass file:"$ENCRYPTION_KEY_FILE" 2>/dev/null; then
                        file="$temp_file"
                    else
                        log "ERROR" "Cannot decrypt file for verification: $filename"
                        verification_failed=true
                        continue
                    fi
                fi
            fi
            
            # Verify based on file type
            if [[ "$file" == *.backup ]]; then
                # Verify PostgreSQL custom format backup
                if pg_restore --list "$file" &> /dev/null; then
                    log "SUCCESS" "Backup file verified: $filename"
                else
                    log "ERROR" "Backup file corrupted: $filename"
                    verification_failed=true
                fi
            elif [[ "$file" == *.gz ]]; then
                # Verify gzip files
                if gzip -t "$file" 2>/dev/null; then
                    log "SUCCESS" "Compressed file verified: $filename"
                else
                    log "ERROR" "Compressed file corrupted: $filename"
                    verification_failed=true
                fi
            fi
            
            # Clean up temporary file
            if [[ -f "/tmp/backup_verify_$$" ]]; then
                rm -f "/tmp/backup_verify_$$"
            fi
            
            # Check file size
            local size=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null || echo 0)
            if [[ $size -eq 0 ]]; then
                log "ERROR" "Empty backup file: $filename"
                verification_failed=true
            fi
        fi
    done
    
    if [[ "$verification_failed" == true ]]; then
        log "ERROR" "Backup integrity verification failed"
        return 1
    else
        log "SUCCESS" "All backup files verified successfully"
        return 0
    fi
}

# Test backup restore capability
test_backup_restore() {
    log "INFO" "Testing backup restore capability..."
    
    local test_db_name="test_restore_$(date +%s)"
    local backup_file="${BACKUP_DIR}/${BACKUP_NAME}_full.backup"
    
    # Handle encrypted backup
    if [[ "$ENCRYPTION_ENABLED" == "true" ]]; then
        backup_file="${backup_file}.enc"
        local temp_backup="/tmp/test_restore_$$"
        
        if ! openssl enc -aes-256-cbc -d -in "$backup_file" -out "$temp_backup" -pass file:"$ENCRYPTION_KEY_FILE"; then
            log "ERROR" "Cannot decrypt backup for restore test"
            return 1
        fi
        
        backup_file="$temp_backup"
    fi
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Create test database
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
        -c "CREATE DATABASE $test_db_name;" &> /dev/null; then
        
        # Restore to test database
        if pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$test_db_name" \
            --jobs="$PARALLEL_JOBS" --verbose "$backup_file" &> /dev/null; then
            
            # Verify restore
            local table_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$test_db_name" \
                -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
            
            if [[ $table_count -gt 0 ]]; then
                log "SUCCESS" "Restore test completed successfully ($table_count tables restored)"
            else
                log "ERROR" "Restore test failed: no tables found"
                return 1
            fi
        else
            log "ERROR" "Restore test failed: pg_restore error"
            return 1
        fi
        
        # Cleanup test database
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
            -c "DROP DATABASE $test_db_name;" &> /dev/null
    else
        log "ERROR" "Cannot create test database for restore test"
        return 1
    fi
    
    # Cleanup temporary files
    if [[ -f "/tmp/test_restore_$$" ]]; then
        rm -f "/tmp/test_restore_$$"
    fi
    
    unset PGPASSWORD
}

# Upload to cloud storage
upload_to_cloud() {
    log "INFO" "Uploading backups to cloud storage..."
    
    local upload_success=true
    
    # AWS S3 Upload
    if [[ -n "$S3_BUCKET" ]]; then
        if ! upload_to_s3; then
            upload_success=false
        fi
    fi
    
    # Azure Blob Storage Upload
    if [[ -n "$AZURE_CONTAINER" ]]; then
        if ! upload_to_azure; then
            upload_success=false
        fi
    fi
    
    # Google Cloud Storage Upload
    if [[ -n "$GCS_BUCKET" ]]; then
        if ! upload_to_gcs; then
            upload_success=false
        fi
    fi
    
    if [[ "$upload_success" == true ]]; then
        log "SUCCESS" "Cloud storage upload completed"
    else
        log "ERROR" "Some cloud storage uploads failed"
        return 1
    fi
}

# S3 upload with lifecycle management
upload_to_s3() {
    log "INFO" "Uploading to AWS S3..."
    
    if ! command -v aws &> /dev/null; then
        log "ERROR" "AWS CLI not installed"
        return 1
    fi
    
    local backup_files=("${BACKUP_DIR}/${BACKUP_NAME}"*)
    
    for file in "${backup_files[@]}"; do
        if [[ -f "$file" ]]; then
            local filename=$(basename "$file")
            local s3_path="s3://${S3_BUCKET}/${S3_PREFIX}${filename}"
            
            if aws s3 cp "$file" "$s3_path" \
                --storage-class "$S3_STORAGE_CLASS" \
                --metadata "backup-date=$(date -u +%Y-%m-%dT%H:%M:%SZ),source=learning-assistant"; then
                
                log "SUCCESS" "S3 upload completed: $filename"
            else
                log "ERROR" "S3 upload failed: $filename"
                return 1
            fi
        fi
    done
    
    # Set lifecycle policy for automated cleanup
    local lifecycle_policy=$(cat << EOF
{
    "Rules": [
        {
            "ID": "LearningAssistantBackupLifecycle",
            "Status": "Enabled",
            "Filter": {
                "Prefix": "$S3_PREFIX"
            },
            "Transitions": [
                {
                    "Days": 7,
                    "StorageClass": "STANDARD_IA"
                },
                {
                    "Days": 30,
                    "StorageClass": "GLACIER"
                },
                {
                    "Days": 90,
                    "StorageClass": "DEEP_ARCHIVE"
                }
            ],
            "Expiration": {
                "Days": $((RETENTION_DAYS + 30))
            }
        }
    ]
}
EOF
)
    
    echo "$lifecycle_policy" > /tmp/s3_lifecycle_policy.json
    aws s3api put-bucket-lifecycle-configuration \
        --bucket "$S3_BUCKET" \
        --lifecycle-configuration file:///tmp/s3_lifecycle_policy.json 2>/dev/null || true
    rm -f /tmp/s3_lifecycle_policy.json
    
    log "SUCCESS" "S3 upload and lifecycle policy updated"
}

# Azure Blob Storage upload
upload_to_azure() {
    log "INFO" "Uploading to Azure Blob Storage..."
    
    if ! command -v az &> /dev/null; then
        log "ERROR" "Azure CLI not installed"
        return 1
    fi
    
    local backup_files=("${BACKUP_DIR}/${BACKUP_NAME}"*)
    
    for file in "${backup_files[@]}"; do
        if [[ -f "$file" ]]; then
            local filename=$(basename "$file")
            
            if az storage blob upload \
                --container-name "$AZURE_CONTAINER" \
                --name "$filename" \
                --file "$file" \
                --tier Cool \
                --metadata "backup-date=$(date -u +%Y-%m-%dT%H:%M:%SZ)" "source=learning-assistant"; then
                
                log "SUCCESS" "Azure upload completed: $filename"
            else
                log "ERROR" "Azure upload failed: $filename"
                return 1
            fi
        fi
    done
    
    log "SUCCESS" "Azure Blob Storage upload completed"
}

# Google Cloud Storage upload
upload_to_gcs() {
    log "INFO" "Uploading to Google Cloud Storage..."
    
    if ! command -v gsutil &> /dev/null; then
        log "ERROR" "Google Cloud SDK not installed"
        return 1
    fi
    
    local backup_files=("${BACKUP_DIR}/${BACKUP_NAME}"*)
    
    for file in "${backup_files[@]}"; do
        if [[ -f "$file" ]]; then
            local filename=$(basename "$file")
            local gcs_path="gs://${GCS_BUCKET}/${filename}"
            
            if gsutil -m cp "$file" "$gcs_path"; then
                # Set object lifecycle
                gsutil lifecycle set /dev/stdin <<< '{
                    "rule": [
                        {
                            "action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},
                            "condition": {"age": 7}
                        },
                        {
                            "action": {"type": "SetStorageClass", "storageClass": "COLDLINE"},
                            "condition": {"age": 30}
                        },
                        {
                            "action": {"type": "Delete"},
                            "condition": {"age": '$((RETENTION_DAYS + 30))'}
                        }
                    ]
                }' "$gcs_path" 2>/dev/null || true
                
                log "SUCCESS" "GCS upload completed: $filename"
            else
                log "ERROR" "GCS upload failed: $filename"
                return 1
            fi
        fi
    done
    
    log "SUCCESS" "Google Cloud Storage upload completed"
}

# Generate backup report
generate_backup_report() {
    log "INFO" "Generating backup report..."
    
    local report_file="${BACKUP_DIR}/${BACKUP_NAME}_report.json"
    local backup_files=("${BACKUP_DIR}/${BACKUP_NAME}"*)
    
    # Calculate total backup size
    local total_size=0
    local file_details=()
    
    for file in "${backup_files[@]}"; do
        if [[ -f "$file" && "$file" != "$report_file" ]]; then
            local filename=$(basename "$file")
            local size=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null || echo 0)
            local checksum=$(sha256sum "$file" 2>/dev/null | cut -d' ' -f1 || shasum -a 256 "$file" 2>/dev/null | cut -d' ' -f1 || echo 'unknown')
            
            total_size=$((total_size + size))
            file_details+=("{\"name\": \"$filename\", \"size\": $size, \"checksum\": \"$checksum\"}")
        fi
    done
    
    # Database statistics
    export PGPASSWORD="$DB_PASSWORD"
    local db_size=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -t -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" | tr -d ' ' || echo 'unknown')
    local table_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ' || echo 'unknown')
    unset PGPASSWORD
    
    # Generate report
    cat > "$report_file" << EOF
{
    "backup_id": "$BACKUP_NAME",
    "timestamp": "$TIMESTAMP",
    "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "backup_type": "full",
    "database": {
        "host": "$DB_HOST",
        "port": $DB_PORT,
        "name": "$DB_NAME",
        "size": "$db_size",
        "table_count": $table_count
    },
    "backup_files": [
        $(IFS=','; echo "${file_details[*]}")
    ],
    "total_size": $total_size,
    "total_size_human": "$(numfmt --to=iec $total_size)",
    "compression_level": $COMPRESSION_LEVEL,
    "encryption_enabled": $ENCRYPTION_ENABLED,
    "parallel_jobs": $PARALLEL_JOBS,
    "retention_days": $RETENTION_DAYS,
    "cloud_storage": {
        "s3_enabled": $([ -n "$S3_BUCKET" ] && echo true || echo false),
        "azure_enabled": $([ -n "$AZURE_CONTAINER" ] && echo true || echo false),
        "gcs_enabled": $([ -n "$GCS_BUCKET" ] && echo true || echo false)
    },
    "performance": {
        "backup_duration": 0,
        "compression_ratio": 0,
        "throughput_mbps": 0
    }
}
EOF
    
    log "SUCCESS" "Backup report generated: $report_file"
}

# Cleanup old backups with retention policy
cleanup_old_backups() {
    log "INFO" "Cleaning up old backups (retention: $RETENTION_DAYS days, $RETENTION_MONTHS months)..."
    
    # Local cleanup - daily backups
    find "$BACKUP_DIR" -name "db_backup_*" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    
    # Keep monthly backups longer
    local monthly_retention=$((RETENTION_MONTHS * 30))
    find "$BACKUP_DIR" -name "db_backup_*01_*" -type f -mtime +$monthly_retention -delete 2>/dev/null || true
    
    # Cloud storage cleanup
    if [[ -n "$S3_BUCKET" ]] && command -v aws &> /dev/null; then
        cleanup_s3_backups
    fi
    
    if [[ -n "$AZURE_CONTAINER" ]] && command -v az &> /dev/null; then
        cleanup_azure_backups
    fi
    
    if [[ -n "$GCS_BUCKET" ]] && command -v gsutil &> /dev/null; then
        cleanup_gcs_backups
    fi
    
    log "SUCCESS" "Cleanup completed"
}

# S3 cleanup
cleanup_s3_backups() {
    local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d 2>/dev/null || \
                       date -v-${RETENTION_DAYS}d +%Y-%m-%d 2>/dev/null)
    
    aws s3api list-objects-v2 \
        --bucket "$S3_BUCKET" \
        --prefix "$S3_PREFIX" \
        --query "Contents[?LastModified<='$cutoff_date'].Key" \
        --output text | \
    while read -r key; do
        if [[ -n "$key" && "$key" != "None" ]]; then
            aws s3 rm "s3://${S3_BUCKET}/${key}"
            log "INFO" "Deleted old S3 backup: $key"
        fi
    done
}

# Azure cleanup
cleanup_azure_backups() {
    local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d 2>/dev/null || \
                       date -v-${RETENTION_DAYS}d +%Y-%m-%d 2>/dev/null)
    
    az storage blob list \
        --container-name "$AZURE_CONTAINER" \
        --prefix "db_backup_" \
        --query "[?properties.lastModified<='$cutoff_date'].name" \
        --output tsv | \
    while read -r blob_name; do
        if [[ -n "$blob_name" ]]; then
            az storage blob delete --container-name "$AZURE_CONTAINER" --name "$blob_name"
            log "INFO" "Deleted old Azure backup: $blob_name"
        fi
    done
}

# GCS cleanup
cleanup_gcs_backups() {
    local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d 2>/dev/null || \
                       date -v-${RETENTION_DAYS}d +%Y-%m-%d 2>/dev/null)
    
    gsutil ls -l "gs://${GCS_BUCKET}/db_backup_*" | \
    awk -v cutoff="$cutoff_date" '$2 < cutoff {print $3}' | \
    while read -r object_path; do
        if [[ -n "$object_path" ]]; then
            gsutil rm "$object_path"
            log "INFO" "Deleted old GCS backup: $object_path"
        fi
    done
}

# Main backup orchestration
main() {
    local start_time=$(date +%s)
    
    # Set up signal handlers
    trap 'log "ERROR" "Backup interrupted by signal"; exit 1' INT TERM
    
    # Set timeout for entire backup process
    timeout "$BACKUP_TIMEOUT" bash -c '
        validate_prerequisites && \
        backup_schema && \
        backup_database_full && \
        backup_database_incremental && \
        setup_point_in_time_recovery && \
        encrypt_backup && \
        verify_backup_integrity && \
        test_backup_restore && \
        upload_to_cloud && \
        generate_backup_report && \
        cleanup_old_backups
    ' || {
        log "ERROR" "Backup process failed or timed out"
        send_notification "FAILED" "Database backup failed or timed out after $BACKUP_TIMEOUT seconds" "error"
        exit 1
    }
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local total_size=$(du -sh "${BACKUP_DIR}/${BACKUP_NAME}"* 2>/dev/null | awk '{s+=$1} END {print s}' || echo "unknown")
    
    # Update performance metrics in report
    if [[ -f "${BACKUP_DIR}/${BACKUP_NAME}_report.json" ]]; then
        local throughput_mbps=$(awk "BEGIN {printf \"%.2f\", $(stat -c%s "${BACKUP_DIR}/${BACKUP_NAME}_full.backup" 2>/dev/null || echo 0) / 1024 / 1024 / $duration}")
        
        # Update report with performance metrics
        jq --arg duration "$duration" --arg throughput "$throughput_mbps" \
           '.performance.backup_duration = ($duration | tonumber) | .performance.throughput_mbps = ($throughput | tonumber)' \
           "${BACKUP_DIR}/${BACKUP_NAME}_report.json" > "${BACKUP_DIR}/${BACKUP_NAME}_report.json.tmp" && \
        mv "${BACKUP_DIR}/${BACKUP_NAME}_report.json.tmp" "${BACKUP_DIR}/${BACKUP_NAME}_report.json"
    fi
    
    log "SUCCESS" "Database backup completed successfully in ${duration}s (Total size: ${total_size})"
    send_notification "SUCCESS" "Database backup completed in ${duration}s. Total size: ${total_size}" "info"
    
    exit 0
}

# Handle script arguments
case "${1:-main}" in
    "main")
        main
        ;;
    "schema")
        validate_prerequisites && backup_schema
        ;;
    "full")
        validate_prerequisites && backup_database_full
        ;;
    "incremental")
        validate_prerequisites && backup_database_incremental
        ;;
    "pitr")
        validate_prerequisites && setup_point_in_time_recovery
        ;;
    "verify")
        verify_backup_integrity
        ;;
    "test-restore")
        test_backup_restore
        ;;
    "cleanup")
        cleanup_old_backups
        ;;
    "help")
        cat << EOF
Usage: $0 [COMMAND]

Commands:
  main         - Run complete database backup (default)
  schema       - Backup database schema only
  full         - Full database backup only
  incremental  - Incremental backup (WAL-based)
  pitr         - Setup point-in-time recovery
  verify       - Verify existing backups
  test-restore - Test backup restore capability
  cleanup      - Cleanup old backups
  help         - Show this help

Environment Variables:
  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
  BACKUP_DIR, RETENTION_DAYS, RETENTION_MONTHS
  S3_BUCKET, AZURE_CONTAINER, GCS_BUCKET
  SLACK_WEBHOOK, DISCORD_WEBHOOK, EMAIL_ALERTS
  ENCRYPTION_ENABLED, COMPRESSION_LEVEL
  PARALLEL_JOBS, POINT_IN_TIME_RECOVERY
EOF
        ;;
    *)
        log "ERROR" "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac