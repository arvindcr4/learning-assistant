#!/bin/bash

# Disaster Recovery Automation Script
# Learning Assistant - Comprehensive Disaster Recovery System
# Version: 2.0.0

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/learning-assistant}"
RECOVERY_DIR="${RECOVERY_DIR:-/var/recovery/learning-assistant}"
RECOVERY_LOG_FILE="${RECOVERY_LOG_FILE:-${RECOVERY_DIR}/recovery.log}"

# Recovery scenarios
RECOVERY_SCENARIO="${RECOVERY_SCENARIO:-full}"  # full, database, app-data, partial
RECOVERY_POINT="${RECOVERY_POINT:-latest}"     # latest, timestamp, or specific backup name
RECOVERY_TARGET_TIME="${RECOVERY_TARGET_TIME}" # Point-in-time recovery target

# Infrastructure configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-learning_assistant_db}"
DB_USER="${DB_USER:-learning_user}"
DB_PASSWORD="${DB_PASSWORD}"
BACKUP_DB_NAME="${BACKUP_DB_NAME:-${DB_NAME}_backup}"

# Application paths
APP_DIR="${APP_DIR:-/app}"
UPLOADS_DIR="${UPLOADS_DIR:-/app/uploads}"
CONFIG_DIR="${CONFIG_DIR:-/app/config}"
LOGS_DIR="${LOGS_DIR:-/app/logs}"
CACHE_DIR="${CACHE_DIR:-/app/cache}"
SESSIONS_DIR="${SESSIONS_DIR:-/app/sessions}"

# Recovery settings
PARALLEL_RESTORE="${PARALLEL_RESTORE:-true}"
PARALLEL_JOBS="${PARALLEL_JOBS:-4}"
VERIFICATION_ENABLED="${VERIFICATION_ENABLED:-true}"
ROLLBACK_ENABLED="${ROLLBACK_ENABLED:-true}"
DRY_RUN="${DRY_RUN:-false}"
FORCE_RECOVERY="${FORCE_RECOVERY:-false}"

# Security and encryption
ENCRYPTION_KEY_FILE="${ENCRYPTION_KEY_FILE:-/etc/backup/encryption.key}"
BACKUP_VERIFICATION="${BACKUP_VERIFICATION:-true}"

# Performance and timeouts
RECOVERY_TIMEOUT="${RECOVERY_TIMEOUT:-7200}"  # 2 hours
PRE_RECOVERY_SNAPSHOT="${PRE_RECOVERY_SNAPSHOT:-true}"
POST_RECOVERY_VALIDATION="${POST_RECOVERY_VALIDATION:-true}"

# Monitoring and alerting
SLACK_WEBHOOK="${SLACK_WEBHOOK}"
DISCORD_WEBHOOK="${DISCORD_WEBHOOK}"
EMAIL_ALERTS="${EMAIL_ALERTS}"
PAGERDUTY_INTEGRATION_KEY="${PAGERDUTY_INTEGRATION_KEY}"
CRITICAL_ALERTS="${CRITICAL_ALERTS:-true}"

# Service management
SYSTEMD_SERVICES="${SYSTEMD_SERVICES:-learning-assistant nginx postgresql redis}"
DOCKER_SERVICES="${DOCKER_SERVICES:-learning-assistant-app learning-assistant-db learning-assistant-redis}"
SERVICE_MANAGEMENT="${SERVICE_MANAGEMENT:-systemd}"  # systemd, docker, manual

# RTO/RPO tracking
RECOVERY_TIME_OBJECTIVE="${RECOVERY_TIME_OBJECTIVE:-4}"  # Hours
RECOVERY_POINT_OBJECTIVE="${RECOVERY_POINT_OBJECTIVE:-1}"  # Hours

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Global variables
RECOVERY_START_TIME=0
RECOVERY_STATUS="UNKNOWN"
SERVICES_STOPPED=()
ROLLBACK_POINTS=()

# Enhanced logging with disaster recovery context
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Ensure recovery directory exists
    mkdir -p "$(dirname "$RECOVERY_LOG_FILE")"
    
    case $level in
        "INFO")
            echo -e "${GREEN}[INFO]${NC} ${timestamp}: $message" | tee -a "$RECOVERY_LOG_FILE"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} ${timestamp}: $message" | tee -a "$RECOVERY_LOG_FILE"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} ${timestamp}: $message" | tee -a "$RECOVERY_LOG_FILE"
            ;;
        "CRITICAL")
            echo -e "${RED}[CRITICAL]${NC} ${timestamp}: $message" | tee -a "$RECOVERY_LOG_FILE"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} ${timestamp}: $message" | tee -a "$RECOVERY_LOG_FILE"
            ;;
        "RECOVERY")
            echo -e "${CYAN}[RECOVERY]${NC} ${timestamp}: $message" | tee -a "$RECOVERY_LOG_FILE"
            ;;
    esac
}

# Disaster recovery notification system
send_dr_notification() {
    local status=$1
    local message=$2
    local severity="${3:-info}"
    local recovery_duration=${4:-0}
    
    # Enhanced Slack notification for DR
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        local color="good"
        local icon=":white_check_mark:"
        
        case $severity in
            "critical")
                color="danger"
                icon=":rotating_light:"
                ;;
            "error")
                color="danger"
                icon=":x:"
                ;;
            "warning")
                color="warning"
                icon=":warning:"
                ;;
        esac
        
        local rto_status="WITHIN_RTO"
        if [[ $recovery_duration -gt $((RECOVERY_TIME_OBJECTIVE * 3600)) ]]; then
            rto_status="RTO_EXCEEDED"
        fi
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"${icon} DISASTER RECOVERY $status\",
                    \"text\": \"$message\",
                    \"fields\": [
                        {
                            \"title\": \"Recovery Scenario\",
                            \"value\": \"$RECOVERY_SCENARIO\",
                            \"short\": true
                        },
                        {
                            \"title\": \"Recovery Point\",
                            \"value\": \"$RECOVERY_POINT\",
                            \"short\": true
                        },
                        {
                            \"title\": \"Duration\",
                            \"value\": \"${recovery_duration}s\",
                            \"short\": true
                        },
                        {
                            \"title\": \"RTO Status\",
                            \"value\": \"$rto_status\",
                            \"short\": true
                        }
                    ],
                    \"footer\": \"Learning Assistant Disaster Recovery\",
                    \"ts\": $(date +%s)
                }]
            }" \
            "$SLACK_WEBHOOK" 2>/dev/null || true
    fi
    
    # Discord notification
    if [[ -n "$DISCORD_WEBHOOK" ]]; then
        local embed_color=65280  # Green
        case $severity in
            "critical"|"error") embed_color=16711680 ;;  # Red
            "warning") embed_color=16776960 ;;  # Yellow
        esac
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"embeds\": [{
                    \"title\": \"🚨 Disaster Recovery $status\",
                    \"description\": \"$message\",
                    \"color\": $embed_color,
                    \"fields\": [
                        {\"name\": \"Scenario\", \"value\": \"$RECOVERY_SCENARIO\", \"inline\": true},
                        {\"name\": \"Recovery Point\", \"value\": \"$RECOVERY_POINT\", \"inline\": true},
                        {\"name\": \"Duration\", \"value\": \"${recovery_duration}s\", \"inline\": true}
                    ],
                    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
                }]
            }" \
            "$DISCORD_WEBHOOK" 2>/dev/null || true
    fi
    
    # PagerDuty for critical DR events
    if [[ -n "$PAGERDUTY_INTEGRATION_KEY" && ("$severity" == "critical" || "$severity" == "error") ]]; then
        curl -X POST \
            -H 'Content-Type: application/json' \
            -d "{
                \"routing_key\": \"$PAGERDUTY_INTEGRATION_KEY\",
                \"event_action\": \"trigger\",
                \"payload\": {
                    \"summary\": \"DISASTER RECOVERY $status - Learning Assistant\",
                    \"source\": \"$(hostname)\",
                    \"severity\": \"critical\",
                    \"component\": \"disaster-recovery\",
                    \"custom_details\": {
                        \"message\": \"$message\",
                        \"scenario\": \"$RECOVERY_SCENARIO\",
                        \"recovery_point\": \"$RECOVERY_POINT\",
                        \"duration\": \"${recovery_duration}s\",
                        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
                    }
                }
            }" \
            'https://events.pagerduty.com/v2/enqueue' 2>/dev/null || true
    fi
}

# Pre-recovery validation and preparation
validate_recovery_prerequisites() {
    log "RECOVERY" "Validating disaster recovery prerequisites..."
    
    # Check required tools
    local tools=("pg_dump" "pg_restore" "psql" "tar" "gzip" "openssl" "jq" "curl")
    
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log "CRITICAL" "Required tool not found: $tool"
            return 1
        fi
    done
    
    # Check backup directory
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log "CRITICAL" "Backup directory not found: $BACKUP_DIR"
        return 1
    fi
    
    # Check recovery directory
    mkdir -p "$RECOVERY_DIR"
    
    # Check disk space for recovery
    local available_space=$(df "$RECOVERY_DIR" | tail -1 | awk '{print $4}')
    local required_space=10485760  # 10GB in KB
    
    if [[ $available_space -lt $required_space ]]; then
        log "CRITICAL" "Insufficient disk space for recovery: $(($available_space / 1024 / 1024))GB available, 10GB+ required"
        return 1
    fi
    
    # Check database connectivity
    export PGPASSWORD="$DB_PASSWORD"
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT 1;" &> /dev/null; then
        log "CRITICAL" "Cannot connect to database server: $DB_HOST:$DB_PORT"
        unset PGPASSWORD
        return 1
    fi
    unset PGPASSWORD
    
    # Check encryption key if needed
    if [[ -f "$BACKUP_DIR" ]] && find "$BACKUP_DIR" -name "*.enc" | grep -q .; then
        if [[ ! -f "$ENCRYPTION_KEY_FILE" ]]; then
            log "CRITICAL" "Encrypted backups found but encryption key missing: $ENCRYPTION_KEY_FILE"
            return 1
        fi
    fi
    
    # Check service management capability
    if [[ "$SERVICE_MANAGEMENT" == "systemd" ]]; then
        if ! command -v systemctl &> /dev/null; then
            log "CRITICAL" "systemctl not available for service management"
            return 1
        fi
    elif [[ "$SERVICE_MANAGEMENT" == "docker" ]]; then
        if ! command -v docker &> /dev/null; then
            log "CRITICAL" "docker not available for service management"
            return 1
        fi
    fi
    
    log "SUCCESS" "Recovery prerequisites validation completed"
    return 0
}

# Identify and select backup for recovery
select_recovery_backup() {
    log "RECOVERY" "Selecting backup for recovery: $RECOVERY_POINT"
    
    local selected_backup=""
    
    case "$RECOVERY_POINT" in
        "latest")
            # Find the most recent backup
            selected_backup=$(find "$BACKUP_DIR" -name "*_backup_*" -type f | sort | tail -1)
            ;;
        "timestamp:"*)
            # Find backup by timestamp
            local target_timestamp=$(echo "$RECOVERY_POINT" | cut -d: -f2)
            selected_backup=$(find "$BACKUP_DIR" -name "*_backup_${target_timestamp}*" -type f | head -1)
            ;;
        *)
            # Treat as specific backup name or pattern
            selected_backup=$(find "$BACKUP_DIR" -name "*${RECOVERY_POINT}*" -type f | head -1)
            ;;
    esac
    
    if [[ -z "$selected_backup" ]]; then
        log "CRITICAL" "No backup found matching recovery point: $RECOVERY_POINT"
        return 1
    fi
    
    # Extract backup base name for finding related files
    local backup_basename=$(basename "$selected_backup" | sed 's/\.[^.]*$//' | sed 's/_[^_]*$//')
    
    log "SUCCESS" "Selected backup for recovery: $backup_basename"
    echo "$backup_basename"
    return 0
}

# Create pre-recovery snapshot
create_pre_recovery_snapshot() {
    if [[ "$PRE_RECOVERY_SNAPSHOT" != "true" ]]; then
        log "INFO" "Pre-recovery snapshot disabled"
        return 0
    fi
    
    log "RECOVERY" "Creating pre-recovery snapshot..."
    
    local snapshot_dir="${RECOVERY_DIR}/pre_recovery_snapshot_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$snapshot_dir"
    
    # Snapshot current database
    export PGPASSWORD="$DB_PASSWORD"
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &> /dev/null; then
        local db_snapshot="${snapshot_dir}/current_database.sql"
        
        if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --no-password --format=custom --compress=9 > "$db_snapshot"; then
            log "SUCCESS" "Database snapshot created: $db_snapshot"
            ROLLBACK_POINTS+=("database:$db_snapshot")
        else
            log "WARN" "Failed to create database snapshot"
        fi
    fi
    unset PGPASSWORD
    
    # Snapshot critical application files
    local critical_dirs=("$CONFIG_DIR" "$UPLOADS_DIR")
    
    for dir in "${critical_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            local dir_name=$(basename "$dir")
            local dir_snapshot="${snapshot_dir}/${dir_name}.tar.gz"
            
            if tar -czf "$dir_snapshot" -C "$(dirname "$dir")" "$dir_name" 2>/dev/null; then
                log "SUCCESS" "Directory snapshot created: $dir_snapshot"
                ROLLBACK_POINTS+=("directory:$dir:$dir_snapshot")
            else
                log "WARN" "Failed to create snapshot for: $dir"
            fi
        fi
    done
    
    log "SUCCESS" "Pre-recovery snapshot completed"
    return 0
}

# Stop services before recovery
stop_services() {
    log "RECOVERY" "Stopping services for recovery..."
    
    SERVICES_STOPPED=()
    
    if [[ "$SERVICE_MANAGEMENT" == "systemd" ]]; then
        for service in $SYSTEMD_SERVICES; do
            if systemctl is-active --quiet "$service"; then
                log "INFO" "Stopping systemd service: $service"
                
                if [[ "$DRY_RUN" != "true" ]]; then
                    if systemctl stop "$service"; then
                        SERVICES_STOPPED+=("systemd:$service")
                        log "SUCCESS" "Service stopped: $service"
                    else
                        log "ERROR" "Failed to stop service: $service"
                    fi
                else
                    log "INFO" "[DRY RUN] Would stop service: $service"
                fi
            fi
        done
    elif [[ "$SERVICE_MANAGEMENT" == "docker" ]]; then
        for service in $DOCKER_SERVICES; do
            if docker ps --format "table {{.Names}}" | grep -q "$service"; then
                log "INFO" "Stopping Docker service: $service"
                
                if [[ "$DRY_RUN" != "true" ]]; then
                    if docker stop "$service"; then
                        SERVICES_STOPPED+=("docker:$service")
                        log "SUCCESS" "Service stopped: $service"
                    else
                        log "ERROR" "Failed to stop service: $service"
                    fi
                else
                    log "INFO" "[DRY RUN] Would stop service: $service"
                fi
            fi
        done
    fi
    
    # Wait for services to stop gracefully
    sleep 5
    
    log "SUCCESS" "Service shutdown completed"
    return 0
}

# Restore database from backup
restore_database() {
    local backup_basename="$1"
    
    log "RECOVERY" "Starting database recovery..."
    
    # Find database backup files
    local db_backup_full="${BACKUP_DIR}/${backup_basename}_full.backup"
    local db_backup_schema="${BACKUP_DIR}/${backup_basename}_schema.sql.gz"
    
    # Handle encrypted backups
    if [[ "$db_backup_full" == *.enc ]]; then
        db_backup_full="${db_backup_full}.enc"
    fi
    
    # Check if backup exists
    if [[ ! -f "$db_backup_full" ]]; then
        log "ERROR" "Database backup not found: $db_backup_full"
        return 1
    fi
    
    local restore_file="$db_backup_full"
    
    # Decrypt if needed
    if [[ "$restore_file" == *.enc ]]; then
        local temp_file="/tmp/db_restore_$$"
        log "INFO" "Decrypting database backup..."
        
        if ! openssl enc -aes-256-cbc -d -in "$restore_file" -out "$temp_file" -pass file:"$ENCRYPTION_KEY_FILE"; then
            log "ERROR" "Failed to decrypt database backup"
            return 1
        fi
        
        restore_file="$temp_file"
    fi
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Create backup database if it doesn't exist
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
        -c "SELECT 1 FROM pg_database WHERE datname = '$BACKUP_DB_NAME';" | grep -q 1; then
        
        log "INFO" "Creating backup database: $BACKUP_DB_NAME"
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
            -c "CREATE DATABASE $BACKUP_DB_NAME;"
    fi
    
    # Drop existing database if force recovery is enabled
    if [[ "$FORCE_RECOVERY" == "true" ]]; then
        log "WARN" "Force recovery enabled - dropping existing database"
        
        if [[ "$DRY_RUN" != "true" ]]; then
            # Terminate existing connections
            psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
                -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();"
            
            # Drop and recreate database
            psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
                -c "DROP DATABASE IF EXISTS $DB_NAME;"
            psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
                -c "CREATE DATABASE $DB_NAME;"
        else
            log "INFO" "[DRY RUN] Would drop and recreate database: $DB_NAME"
        fi
    fi
    
    # Restore database
    log "INFO" "Restoring database from backup..."
    
    if [[ "$DRY_RUN" != "true" ]]; then
        local restore_start_time=$(date +%s)
        
        if [[ "$PARALLEL_RESTORE" == "true" ]]; then
            pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                --jobs="$PARALLEL_JOBS" --verbose --clean --if-exists "$restore_file"
        else
            pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                --verbose --clean --if-exists "$restore_file"
        fi
        
        local restore_end_time=$(date +%s)
        local restore_duration=$((restore_end_time - restore_start_time))
        
        log "SUCCESS" "Database restore completed in ${restore_duration}s"
    else
        log "INFO" "[DRY RUN] Would restore database from: $restore_file"
    fi
    
    unset PGPASSWORD
    
    # Cleanup temporary file
    if [[ -f "/tmp/db_restore_$$" ]]; then
        rm -f "/tmp/db_restore_$$"
    fi
    
    return 0
}

# Restore application data
restore_application_data() {
    local backup_basename="$1"
    
    log "RECOVERY" "Starting application data recovery..."
    
    # Find application data backups
    local app_backups=(
        "${BACKUP_DIR}/${backup_basename}_user_data.tar.gz"
        "${BACKUP_DIR}/${backup_basename}_config.tar.gz"
        "${BACKUP_DIR}/${backup_basename}_uploads.tar.gz"
        "${BACKUP_DIR}/${backup_basename}_content.tar.gz"
    )
    
    for backup_file in "${app_backups[@]}"; do
        # Handle encrypted backups
        if [[ ! -f "$backup_file" && -f "${backup_file}.enc" ]]; then
            backup_file="${backup_file}.enc"
        fi
        
        if [[ ! -f "$backup_file" ]]; then
            log "WARN" "Application backup not found: $(basename "$backup_file")"
            continue
        fi
        
        local restore_file="$backup_file"
        
        # Decrypt if needed
        if [[ "$restore_file" == *.enc ]]; then
            local temp_file="/tmp/app_restore_$(basename "$backup_file")_$$"
            log "INFO" "Decrypting application backup: $(basename "$backup_file")"
            
            if ! openssl enc -aes-256-cbc -d -in "$restore_file" -out "$temp_file" -pass file:"$ENCRYPTION_KEY_FILE"; then
                log "ERROR" "Failed to decrypt application backup: $(basename "$backup_file")"
                continue
            fi
            
            restore_file="$temp_file"
        fi
        
        # Determine restore location based on backup type
        local restore_location="$APP_DIR"
        
        if [[ "$backup_file" == *"config"* ]]; then
            restore_location="$CONFIG_DIR"
        elif [[ "$backup_file" == *"uploads"* ]]; then
            restore_location="$UPLOADS_DIR"
        fi
        
        log "INFO" "Restoring application data: $(basename "$backup_file")"
        
        if [[ "$DRY_RUN" != "true" ]]; then
            # Create restore directory if it doesn't exist
            mkdir -p "$restore_location"
            
            # Extract backup
            if tar -xzf "$restore_file" -C "$restore_location" --strip-components=1 2>/dev/null; then
                log "SUCCESS" "Application data restored: $(basename "$backup_file")"
            else
                log "ERROR" "Failed to restore application data: $(basename "$backup_file")"
            fi
        else
            log "INFO" "[DRY RUN] Would restore application data from: $(basename "$backup_file")"
        fi
        
        # Cleanup temporary file
        if [[ -f "/tmp/app_restore_$(basename "$backup_file")_$$" ]]; then
            rm -f "/tmp/app_restore_$(basename "$backup_file")_$$"
        fi
    done
    
    # Restore Redis data if available
    local redis_backup="${BACKUP_DIR}/${backup_basename}_redis.rdb.gz"
    
    if [[ -f "$redis_backup" ]] || [[ -f "${redis_backup}.enc" ]]; then
        restore_redis_data "$backup_basename"
    fi
    
    log "SUCCESS" "Application data recovery completed"
    return 0
}

# Restore Redis data
restore_redis_data() {
    local backup_basename="$1"
    
    log "RECOVERY" "Starting Redis data recovery..."
    
    local redis_backup="${BACKUP_DIR}/${backup_basename}_redis.rdb.gz"
    
    # Handle encrypted backup
    if [[ ! -f "$redis_backup" && -f "${redis_backup}.enc" ]]; then
        redis_backup="${redis_backup}.enc"
    fi
    
    if [[ ! -f "$redis_backup" ]]; then
        log "WARN" "Redis backup not found: $(basename "$redis_backup")"
        return 0
    fi
    
    local restore_file="$redis_backup"
    
    # Decrypt if needed
    if [[ "$restore_file" == *.enc ]]; then
        local temp_file="/tmp/redis_restore_$$"
        log "INFO" "Decrypting Redis backup..."
        
        if ! openssl enc -aes-256-cbc -d -in "$restore_file" -out "$temp_file" -pass file:"$ENCRYPTION_KEY_FILE"; then
            log "ERROR" "Failed to decrypt Redis backup"
            return 1
        fi
        
        restore_file="$temp_file"
    fi
    
    # Decompress Redis backup
    local redis_rdb_file="/tmp/redis_restore_$$.rdb"
    
    if ! gzip -dc "$restore_file" > "$redis_rdb_file"; then
        log "ERROR" "Failed to decompress Redis backup"
        return 1
    fi
    
    log "INFO" "Restoring Redis data..."
    
    if [[ "$DRY_RUN" != "true" ]]; then
        # Stop Redis service
        if command -v systemctl &> /dev/null; then
            systemctl stop redis 2>/dev/null || true
        fi
        
        # Replace Redis dump file
        local redis_data_dir="${REDIS_DATA_DIR:-/var/lib/redis}"
        
        if [[ -d "$redis_data_dir" ]]; then
            cp "$redis_rdb_file" "$redis_data_dir/dump.rdb"
            chown redis:redis "$redis_data_dir/dump.rdb" 2>/dev/null || true
            chmod 660 "$redis_data_dir/dump.rdb" 2>/dev/null || true
        fi
        
        # Start Redis service
        if command -v systemctl &> /dev/null; then
            systemctl start redis 2>/dev/null || true
        fi
        
        log "SUCCESS" "Redis data restored"
    else
        log "INFO" "[DRY RUN] Would restore Redis data from: $(basename "$redis_backup")"
    fi
    
    # Cleanup temporary files
    rm -f "/tmp/redis_restore_$$" "$redis_rdb_file"
    
    return 0
}

# Post-recovery validation
validate_recovery() {
    log "RECOVERY" "Starting post-recovery validation..."
    
    local validation_errors=()
    
    # Validate database recovery
    export PGPASSWORD="$DB_PASSWORD"
    
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &> /dev/null; then
        validation_errors+=("Database connection failed")
    else
        # Check table count
        local table_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
        
        if [[ $table_count -lt 5 ]]; then  # Expecting at least 5 tables
            validation_errors+=("Database incomplete: only $table_count tables found")
        fi
        
        # Test sample queries
        if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            -c "SELECT COUNT(*) FROM users LIMIT 1;" &> /dev/null; then
            validation_errors+=("Database queries failing")
        fi
    fi
    
    unset PGPASSWORD
    
    # Validate application files
    local critical_files=(
        "$CONFIG_DIR/app.js"
        "$APP_DIR/package.json"
        "$APP_DIR/next.config.js"
    )
    
    for file in "${critical_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            validation_errors+=("Critical file missing: $file")
        fi
    done
    
    # Validate application directories
    local critical_dirs=("$UPLOADS_DIR" "$CONFIG_DIR" "$LOGS_DIR")
    
    for dir in "${critical_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            validation_errors+=("Critical directory missing: $dir")
        fi
    done
    
    # Validate Redis if available
    if command -v redis-cli &> /dev/null; then
        if ! redis-cli ping &> /dev/null; then
            validation_errors+=("Redis connection failed")
        fi
    fi
    
    # Report validation results
    if [[ ${#validation_errors[@]} -gt 0 ]]; then
        log "ERROR" "Recovery validation failed with ${#validation_errors[@]} errors:"
        for error in "${validation_errors[@]}"; do
            log "ERROR" "  - $error"
        done
        return 1
    else
        log "SUCCESS" "Recovery validation passed"
        return 0
    fi
}

# Start services after recovery
start_services() {
    log "RECOVERY" "Starting services after recovery..."
    
    # Start services in reverse order of how they were stopped
    local services_to_start=()
    
    for service in "${SERVICES_STOPPED[@]}"; do
        services_to_start=("$service" "${services_to_start[@]}")
    done
    
    for service_info in "${services_to_start[@]}"; do
        local service_type=$(echo "$service_info" | cut -d: -f1)
        local service_name=$(echo "$service_info" | cut -d: -f2)
        
        log "INFO" "Starting service: $service_name ($service_type)"
        
        if [[ "$DRY_RUN" != "true" ]]; then
            if [[ "$service_type" == "systemd" ]]; then
                if systemctl start "$service_name"; then
                    log "SUCCESS" "Service started: $service_name"
                else
                    log "ERROR" "Failed to start service: $service_name"
                fi
            elif [[ "$service_type" == "docker" ]]; then
                if docker start "$service_name"; then
                    log "SUCCESS" "Service started: $service_name"
                else
                    log "ERROR" "Failed to start service: $service_name"
                fi
            fi
        else
            log "INFO" "[DRY RUN] Would start service: $service_name"
        fi
    done
    
    # Wait for services to start
    sleep 10
    
    log "SUCCESS" "Service startup completed"
    return 0
}

# Rollback recovery in case of failure
rollback_recovery() {
    log "RECOVERY" "Starting recovery rollback..."
    
    send_dr_notification "ROLLBACK_INITIATED" "Recovery rollback initiated due to validation failure" "warning"
    
    # Stop services again
    stop_services
    
    # Rollback database
    for rollback_point in "${ROLLBACK_POINTS[@]}"; do
        local rollback_type=$(echo "$rollback_point" | cut -d: -f1)
        local rollback_data=$(echo "$rollback_point" | cut -d: -f2-)
        
        case "$rollback_type" in
            "database")
                log "INFO" "Rolling back database to: $rollback_data"
                
                export PGPASSWORD="$DB_PASSWORD"
                
                # Drop current database
                psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
                    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();"
                psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
                    -c "DROP DATABASE IF EXISTS $DB_NAME;"
                psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
                    -c "CREATE DATABASE $DB_NAME;"
                
                # Restore from rollback point
                pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                    --verbose "$rollback_data"
                
                unset PGPASSWORD
                ;;
            "directory")
                local dir_path=$(echo "$rollback_data" | cut -d: -f1)
                local snapshot_file=$(echo "$rollback_data" | cut -d: -f2)
                
                log "INFO" "Rolling back directory: $dir_path"
                
                # Remove current directory and restore from snapshot
                rm -rf "$dir_path"
                mkdir -p "$(dirname "$dir_path")"
                tar -xzf "$snapshot_file" -C "$(dirname "$dir_path")"
                ;;
        esac
    done
    
    # Start services
    start_services
    
    log "SUCCESS" "Recovery rollback completed"
    send_dr_notification "ROLLBACK_COMPLETED" "Recovery rollback completed successfully" "info"
    
    return 0
}

# Generate recovery report
generate_recovery_report() {
    local recovery_status="$1"
    local recovery_duration="$2"
    
    local report_file="${RECOVERY_DIR}/recovery_report_$(date +%Y%m%d_%H%M%S).json"
    
    local rto_met="true"
    local rpo_met="true"
    
    if [[ $recovery_duration -gt $((RECOVERY_TIME_OBJECTIVE * 3600)) ]]; then
        rto_met="false"
    fi
    
    # Calculate RPO (this would need backup timestamp analysis)
    local backup_age_hours=0  # This should be calculated from selected backup
    if [[ $backup_age_hours -gt $RECOVERY_POINT_OBJECTIVE ]]; then
        rpo_met="false"
    fi
    
    cat > "$report_file" << EOF
{
    "recovery_report": {
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "recovery_id": "recovery_$(date +%Y%m%d_%H%M%S)",
        "status": "$recovery_status",
        "scenario": "$RECOVERY_SCENARIO",
        "recovery_point": "$RECOVERY_POINT",
        "duration_seconds": $recovery_duration,
        "duration_human": "$(($recovery_duration / 3600))h $(( ($recovery_duration % 3600) / 60))m $(($recovery_duration % 60))s",
        "objectives": {
            "recovery_time_objective_hours": $RECOVERY_TIME_OBJECTIVE,
            "recovery_point_objective_hours": $RECOVERY_POINT_OBJECTIVE,
            "rto_met": $rto_met,
            "rpo_met": $rpo_met
        },
        "components_recovered": {
            "database": $([ "$RECOVERY_SCENARIO" == "full" ] || [ "$RECOVERY_SCENARIO" == "database" ] && echo true || echo false),
            "application_data": $([ "$RECOVERY_SCENARIO" == "full" ] || [ "$RECOVERY_SCENARIO" == "app-data" ] && echo true || echo false),
            "configuration": $([ "$RECOVERY_SCENARIO" == "full" ] && echo true || echo false),
            "redis_data": $([ "$RECOVERY_SCENARIO" == "full" ] && echo true || echo false)
        },
        "services_managed": {
            "stopped_services": $(echo "${SERVICES_STOPPED[@]}" | jq -R 'split(" ")'),
            "service_management_type": "$SERVICE_MANAGEMENT"
        },
        "validation": {
            "post_recovery_validation": "$POST_RECOVERY_VALIDATION",
            "rollback_capability": "$ROLLBACK_ENABLED",
            "dry_run_mode": "$DRY_RUN"
        },
        "environment": {
            "hostname": "$(hostname)",
            "recovery_directory": "$RECOVERY_DIR",
            "backup_directory": "$BACKUP_DIR",
            "parallel_restore": "$PARALLEL_RESTORE",
            "parallel_jobs": $PARALLEL_JOBS
        }
    }
}
EOF
    
    log "SUCCESS" "Recovery report generated: $report_file"
    
    # Copy report to backup directory for archival
    cp "$report_file" "${BACKUP_DIR}/latest_recovery_report.json"
}

# Main disaster recovery orchestration
main() {
    RECOVERY_START_TIME=$(date +%s)
    
    log "RECOVERY" "=== DISASTER RECOVERY INITIATED ==="
    log "RECOVERY" "Scenario: $RECOVERY_SCENARIO | Recovery Point: $RECOVERY_POINT | Dry Run: $DRY_RUN"
    
    send_dr_notification "INITIATED" "Disaster recovery process started for scenario: $RECOVERY_SCENARIO"
    
    # Set up signal handlers for cleanup
    trap 'log "CRITICAL" "Recovery interrupted by signal"; send_dr_notification "INTERRUPTED" "Recovery process interrupted by signal" "critical"; exit 1' INT TERM
    
    # Validate prerequisites
    if ! validate_recovery_prerequisites; then
        log "CRITICAL" "Recovery prerequisites validation failed"
        send_dr_notification "FAILED" "Recovery prerequisites validation failed" "critical"
        exit 1
    fi
    
    # Select backup for recovery
    local backup_basename
    if ! backup_basename=$(select_recovery_backup); then
        log "CRITICAL" "Failed to select backup for recovery"
        send_dr_notification "FAILED" "Failed to select backup for recovery" "critical"
        exit 1
    fi
    
    # Create pre-recovery snapshot for rollback
    if ! create_pre_recovery_snapshot; then
        log "ERROR" "Failed to create pre-recovery snapshot"
        if [[ "$ROLLBACK_ENABLED" == "true" ]]; then
            log "CRITICAL" "Cannot proceed without rollback capability"
            send_dr_notification "FAILED" "Cannot proceed without rollback capability" "critical"
            exit 1
        fi
    fi
    
    # Stop services
    if ! stop_services; then
        log "ERROR" "Failed to stop services properly"
        # Continue with recovery but note the issue
    fi
    
    # Execute recovery based on scenario
    local recovery_success=true
    
    case "$RECOVERY_SCENARIO" in
        "full")
            if ! restore_database "$backup_basename" || ! restore_application_data "$backup_basename"; then
                recovery_success=false
            fi
            ;;
        "database")
            if ! restore_database "$backup_basename"; then
                recovery_success=false
            fi
            ;;
        "app-data")
            if ! restore_application_data "$backup_basename"; then
                recovery_success=false
            fi
            ;;
        "partial")
            # Partial recovery - implement specific component recovery here
            log "INFO" "Partial recovery scenario - implementing specific components"
            if ! restore_database "$backup_basename"; then
                recovery_success=false
            fi
            ;;
        *)
            log "CRITICAL" "Unknown recovery scenario: $RECOVERY_SCENARIO"
            recovery_success=false
            ;;
    esac
    
    # Start services
    if ! start_services; then
        log "ERROR" "Failed to start services after recovery"
        recovery_success=false
    fi
    
    # Post-recovery validation
    if [[ "$POST_RECOVERY_VALIDATION" == "true" ]]; then
        if ! validate_recovery; then
            log "CRITICAL" "Post-recovery validation failed"
            recovery_success=false
            
            # Attempt rollback if enabled
            if [[ "$ROLLBACK_ENABLED" == "true" && ${#ROLLBACK_POINTS[@]} -gt 0 ]]; then
                rollback_recovery
                RECOVERY_STATUS="ROLLED_BACK"
            else
                RECOVERY_STATUS="FAILED"
            fi
        fi
    fi
    
    # Calculate recovery duration
    local recovery_end_time=$(date +%s)
    local recovery_duration=$((recovery_end_time - RECOVERY_START_TIME))
    
    # Determine final status
    if [[ "$recovery_success" == true && "$RECOVERY_STATUS" != "ROLLED_BACK" ]]; then
        RECOVERY_STATUS="SUCCESS"
        log "SUCCESS" "=== DISASTER RECOVERY COMPLETED SUCCESSFULLY ==="
        log "SUCCESS" "Recovery completed in ${recovery_duration}s"
        
        # Check RTO compliance
        if [[ $recovery_duration -gt $((RECOVERY_TIME_OBJECTIVE * 3600)) ]]; then
            log "WARN" "Recovery exceeded RTO: ${recovery_duration}s > $((RECOVERY_TIME_OBJECTIVE * 3600))s"
            send_dr_notification "SUCCESS_RTO_EXCEEDED" "Recovery completed but exceeded RTO" "warning" "$recovery_duration"
        else
            send_dr_notification "SUCCESS" "Disaster recovery completed successfully within RTO" "info" "$recovery_duration"
        fi
    else
        RECOVERY_STATUS="FAILED"
        log "CRITICAL" "=== DISASTER RECOVERY FAILED ==="
        send_dr_notification "FAILED" "Disaster recovery failed after ${recovery_duration}s" "critical" "$recovery_duration"
    fi
    
    # Generate recovery report
    generate_recovery_report "$RECOVERY_STATUS" "$recovery_duration"
    
    # Exit with appropriate code
    case "$RECOVERY_STATUS" in
        "SUCCESS") exit 0 ;;
        "ROLLED_BACK") exit 2 ;;
        *) exit 1 ;;
    esac
}

# Handle script arguments
case "${1:-main}" in
    "main")
        main
        ;;
    "database")
        RECOVERY_SCENARIO="database"
        main
        ;;
    "app-data")
        RECOVERY_SCENARIO="app-data"
        main
        ;;
    "partial")
        RECOVERY_SCENARIO="partial"
        main
        ;;
    "dry-run")
        DRY_RUN="true"
        main
        ;;
    "validate")
        validate_recovery_prerequisites
        ;;
    "rollback")
        rollback_recovery
        ;;
    "help")
        cat << EOF
Usage: $0 [COMMAND]

Commands:
  main       - Run complete disaster recovery (default)
  database   - Recover database only
  app-data   - Recover application data only
  partial    - Partial recovery scenario
  dry-run    - Run recovery in dry-run mode
  validate   - Validate recovery prerequisites
  rollback   - Perform recovery rollback
  help       - Show this help

Environment Variables:
  RECOVERY_SCENARIO - full, database, app-data, partial
  RECOVERY_POINT - latest, timestamp:YYYYMMDD_HHMMSS, or backup name
  RECOVERY_TARGET_TIME - Point-in-time recovery target
  DRY_RUN - true/false for dry run mode
  FORCE_RECOVERY - true/false to force destructive recovery
  ROLLBACK_ENABLED - true/false to enable rollback capability
  SERVICE_MANAGEMENT - systemd, docker, manual

Recovery Objectives:
  RECOVERY_TIME_OBJECTIVE - RTO in hours (default: 4)
  RECOVERY_POINT_OBJECTIVE - RPO in hours (default: 1)

Monitoring:
  SLACK_WEBHOOK, DISCORD_WEBHOOK, EMAIL_ALERTS
  PAGERDUTY_INTEGRATION_KEY
EOF
        ;;
    *)
        log "ERROR" "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac