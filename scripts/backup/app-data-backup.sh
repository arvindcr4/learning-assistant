#!/bin/bash

# Application Data Backup Script
# Learning Assistant - User Data and Application State Backup
# Version: 2.0.0

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/learning-assistant}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="app_data_backup_${TIMESTAMP}"

# Application directories
APP_DIR="${APP_DIR:-/app}"
UPLOADS_DIR="${UPLOADS_DIR:-/app/uploads}"
LOGS_DIR="${LOGS_DIR:-/app/logs}"
CONFIG_DIR="${CONFIG_DIR:-/app/config}"
CACHE_DIR="${CACHE_DIR:-/app/cache}"
SESSIONS_DIR="${SESSIONS_DIR:-/app/sessions}"
TEMP_DIR="${TEMP_DIR:-/app/tmp}"

# User data directories
USER_PROFILES_DIR="${USER_PROFILES_DIR:-/app/data/profiles}"
LEARNING_DATA_DIR="${LEARNING_DATA_DIR:-/app/data/learning}"
PROGRESS_DATA_DIR="${PROGRESS_DATA_DIR:-/app/data/progress}"
ANALYTICS_DATA_DIR="${ANALYTICS_DATA_DIR:-/app/data/analytics}"
CONTENT_DATA_DIR="${CONTENT_DATA_DIR:-/app/data/content}"

# External storage configuration
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASSWORD="${REDIS_PASSWORD}"
REDIS_DB="${REDIS_DB:-0}"

# Object storage configuration
S3_BUCKET="${S3_BUCKET}"
S3_PREFIX="${S3_PREFIX:-app-data-backups/}"
AZURE_CONTAINER="${AZURE_CONTAINER}"
GCS_BUCKET="${GCS_BUCKET}"

# Backup settings
COMPRESSION_LEVEL="${COMPRESSION_LEVEL:-6}"
ENCRYPTION_ENABLED="${ENCRYPTION_ENABLED:-true}"
ENCRYPTION_KEY_FILE="${ENCRYPTION_KEY_FILE:-/etc/backup/encryption.key}"
PARALLEL_COMPRESSION="${PARALLEL_COMPRESSION:-true}"
INCREMENTAL_BACKUP="${INCREMENTAL_BACKUP:-true}"
EXCLUDE_PATTERNS="${EXCLUDE_PATTERNS:-*.tmp,*.log,*.pid,*.sock,node_modules,*.git}"

# Performance settings
BACKUP_TIMEOUT="${BACKUP_TIMEOUT:-3600}"  # 1 hour
MAX_PARALLEL_JOBS="${MAX_PARALLEL_JOBS:-4}"
MIN_FILE_SIZE_COMPRESS="${MIN_FILE_SIZE_COMPRESS:-1024}"  # 1KB
MAX_FILE_SIZE_BACKUP="${MAX_FILE_SIZE_BACKUP:-1073741824}"  # 1GB

# Monitoring and alerting
SLACK_WEBHOOK="${SLACK_WEBHOOK}"
DISCORD_WEBHOOK="${DISCORD_WEBHOOK}"
EMAIL_ALERTS="${EMAIL_ALERTS}"
MONITORING_ENABLED="${MONITORING_ENABLED:-true}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${GREEN}[INFO]${NC} ${timestamp}: $message" | tee -a "${BACKUP_DIR}/app-backup.log"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} ${timestamp}: $message" | tee -a "${BACKUP_DIR}/app-backup.log"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} ${timestamp}: $message" | tee -a "${BACKUP_DIR}/app-backup.log"
            ;;
        "DEBUG")
            echo -e "${BLUE}[DEBUG]${NC} ${timestamp}: $message" | tee -a "${BACKUP_DIR}/app-backup.log"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} ${timestamp}: $message" | tee -a "${BACKUP_DIR}/app-backup.log"
            ;;
    esac
}

# Notification system
send_notification() {
    local status=$1
    local message=$2
    local severity="${3:-info}"
    
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
                    \"title\": \"App Data Backup $status\",
                    \"text\": \"$message\",
                    \"footer\": \"Learning Assistant Backup System\",
                    \"ts\": $(date +%s)
                }]
            }" \
            "$SLACK_WEBHOOK" 2>/dev/null || true
    fi
    
    if [[ -n "$DISCORD_WEBHOOK" ]]; then
        local embed_color=65280  # Green
        case $severity in
            "error") embed_color=16711680 ;;  # Red
            "warning") embed_color=16776960 ;;  # Yellow
        esac
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"embeds\": [{
                    \"title\": \"App Data Backup $status\",
                    \"description\": \"$message\",
                    \"color\": $embed_color,
                    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
                }]
            }" \
            "$DISCORD_WEBHOOK" 2>/dev/null || true
    fi
}

# Prerequisites validation
validate_prerequisites() {
    log "INFO" "Validating prerequisites for application data backup..."
    
    # Check required tools
    local tools=("tar" "gzip" "find" "rsync" "jq" "curl")
    
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log "ERROR" "Required tool not found: $tool"
            exit 1
        fi
    done
    
    # Check backup directory
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log "INFO" "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
    fi
    
    # Check disk space
    local available_space=$(df "$BACKUP_DIR" | tail -1 | awk '{print $4}')
    local required_space=5242880  # 5GB in KB
    
    if [[ $available_space -lt $required_space ]]; then
        log "WARN" "Low disk space: $(($available_space / 1024 / 1024))GB available"
    fi
    
    # Setup encryption if enabled
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

# Create exclude patterns file
create_exclude_file() {
    local exclude_file="/tmp/backup_exclude_$$"
    
    # Convert comma-separated patterns to newline-separated
    echo "$EXCLUDE_PATTERNS" | tr ',' '\n' > "$exclude_file"
    
    # Add common exclusions
    cat >> "$exclude_file" << EOF
*.tmp
*.temp
*.log
*.pid
*.sock
*.swp
*.swo
*~
.DS_Store
Thumbs.db
node_modules/
.git/
.svn/
.hg/
__pycache__/
*.pyc
*.pyo
.env.local
.env.*.local
coverage/
.nyc_output/
.cache/
.parcel-cache/
dist/
build/
EOF
    
    echo "$exclude_file"
}

# Backup user profiles and learning data
backup_user_data() {
    log "INFO" "Starting user data backup..."
    
    local user_backup_file="${BACKUP_DIR}/${BACKUP_NAME}_user_data.tar.gz"
    local exclude_file=$(create_exclude_file)
    
    # Create list of user data directories to backup
    local user_data_dirs=()
    
    [[ -d "$USER_PROFILES_DIR" ]] && user_data_dirs+=("$USER_PROFILES_DIR")
    [[ -d "$LEARNING_DATA_DIR" ]] && user_data_dirs+=("$LEARNING_DATA_DIR")
    [[ -d "$PROGRESS_DATA_DIR" ]] && user_data_dirs+=("$PROGRESS_DATA_DIR")
    [[ -d "$ANALYTICS_DATA_DIR" ]] && user_data_dirs+=("$ANALYTICS_DATA_DIR")
    
    if [[ ${#user_data_dirs[@]} -gt 0 ]]; then
        # Create user data manifest
        local manifest_file="${BACKUP_DIR}/${BACKUP_NAME}_user_data_manifest.json"
        
        cat > "$manifest_file" << EOF
{
    "backup_type": "user_data",
    "timestamp": "$TIMESTAMP",
    "directories": [
EOF
        
        local first=true
        for dir in "${user_data_dirs[@]}"; do
            if [[ "$first" == true ]]; then
                first=false
            else
                echo "," >> "$manifest_file"
            fi
            
            local file_count=$(find "$dir" -type f | wc -l)
            local dir_size=$(du -sb "$dir" | cut -f1)
            
            echo -n "        {\"path\": \"$dir\", \"file_count\": $file_count, \"size\": $dir_size}" >> "$manifest_file"
        done
        
        echo -e "\n    ]\n}" >> "$manifest_file"
        
        # Create compressed archive
        if tar -czf "$user_backup_file" \
            --exclude-from="$exclude_file" \
            --absolute-names \
            "${user_data_dirs[@]}" 2>/dev/null; then
            
            local file_size=$(du -h "$user_backup_file" | cut -f1)
            log "SUCCESS" "User data backup completed: $user_backup_file ($file_size)"
        else
            log "ERROR" "User data backup failed"
            rm -f "$exclude_file"
            return 1
        fi
    else
        log "WARN" "No user data directories found to backup"
    fi
    
    rm -f "$exclude_file"
}

# Backup application configuration
backup_app_config() {
    log "INFO" "Starting application configuration backup..."
    
    local config_backup_file="${BACKUP_DIR}/${BACKUP_NAME}_config.tar.gz"
    local config_files=()
    
    # Application configuration files
    [[ -d "$CONFIG_DIR" ]] && config_files+=("$CONFIG_DIR")
    [[ -f "$APP_DIR/.env" ]] && config_files+=("$APP_DIR/.env")
    [[ -f "$APP_DIR/.env.production" ]] && config_files+=("$APP_DIR/.env.production")
    [[ -f "$APP_DIR/package.json" ]] && config_files+=("$APP_DIR/package.json")
    [[ -f "$APP_DIR/package-lock.json" ]] && config_files+=("$APP_DIR/package-lock.json")
    [[ -f "$APP_DIR/next.config.js" ]] && config_files+=("$APP_DIR/next.config.js")
    [[ -f "$APP_DIR/tailwind.config.js" ]] && config_files+=("$APP_DIR/tailwind.config.js")
    [[ -f "$APP_DIR/tsconfig.json" ]] && config_files+=("$APP_DIR/tsconfig.json")
    [[ -d "$APP_DIR/scripts" ]] && config_files+=("$APP_DIR/scripts")
    
    if [[ ${#config_files[@]} -gt 0 ]]; then
        # Sanitize sensitive data before backup
        local temp_dir="/tmp/config_backup_$$"
        mkdir -p "$temp_dir"
        
        for file in "${config_files[@]}"; do
            if [[ -f "$file" ]]; then
                local dest_file="$temp_dir/$(basename "$file")"
                cp "$file" "$dest_file"
                
                # Remove sensitive data from .env files
                if [[ "$file" == *".env"* ]]; then
                    sed -i.bak -E 's/(PASSWORD|SECRET|KEY|TOKEN)=.*/\1=***REDACTED***/g' "$dest_file"
                    rm -f "${dest_file}.bak"
                fi
            elif [[ -d "$file" ]]; then
                cp -r "$file" "$temp_dir/"
            fi
        done
        
        # Create archive from sanitized files
        if tar -czf "$config_backup_file" -C "$temp_dir" .; then
            local file_size=$(du -h "$config_backup_file" | cut -f1)
            log "SUCCESS" "Configuration backup completed: $config_backup_file ($file_size)"
        else
            log "ERROR" "Configuration backup failed"
            rm -rf "$temp_dir"
            return 1
        fi
        
        rm -rf "$temp_dir"
    else
        log "WARN" "No configuration files found to backup"
    fi
}

# Backup uploaded files and media
backup_uploads() {
    log "INFO" "Starting uploads backup..."
    
    if [[ ! -d "$UPLOADS_DIR" ]]; then
        log "WARN" "Uploads directory not found: $UPLOADS_DIR"
        return 0
    fi
    
    local uploads_backup_file="${BACKUP_DIR}/${BACKUP_NAME}_uploads.tar.gz"
    local exclude_file=$(create_exclude_file)
    
    # Calculate upload statistics
    local file_count=$(find "$UPLOADS_DIR" -type f | wc -l)
    local total_size=$(du -sb "$UPLOADS_DIR" | cut -f1)
    
    if [[ $file_count -gt 0 ]]; then
        # Create uploads manifest
        local manifest_file="${BACKUP_DIR}/${BACKUP_NAME}_uploads_manifest.json"
        
        cat > "$manifest_file" << EOF
{
    "backup_type": "uploads",
    "timestamp": "$TIMESTAMP",
    "upload_directory": "$UPLOADS_DIR",
    "file_count": $file_count,
    "total_size": $total_size,
    "file_types": [
EOF
        
        # Analyze file types
        local file_types=$(find "$UPLOADS_DIR" -type f -name "*.*" | \
                          sed 's/.*\.//' | sort | uniq -c | sort -nr | head -10)
        
        local first=true
        while IFS= read -r line; do
            if [[ -n "$line" ]]; then
                if [[ "$first" == true ]]; then
                    first=false
                else
                    echo "," >> "$manifest_file"
                fi
                
                local count=$(echo "$line" | awk '{print $1}')
                local ext=$(echo "$line" | awk '{print $2}')
                echo -n "        {\"extension\": \"$ext\", \"count\": $count}" >> "$manifest_file"
            fi
        done <<< "$file_types"
        
        echo -e "\n    ]\n}" >> "$manifest_file"
        
        # Create compressed archive with parallel compression if enabled
        if [[ "$PARALLEL_COMPRESSION" == "true" ]]; then
            # Use pigz for parallel compression if available
            if command -v pigz &> /dev/null; then
                tar -cf - --exclude-from="$exclude_file" "$UPLOADS_DIR" | pigz -$COMPRESSION_LEVEL > "$uploads_backup_file"
            else
                tar -czf "$uploads_backup_file" --exclude-from="$exclude_file" "$UPLOADS_DIR"
            fi
        else
            tar -czf "$uploads_backup_file" --exclude-from="$exclude_file" "$UPLOADS_DIR"
        fi
        
        if [[ -f "$uploads_backup_file" ]]; then
            local file_size=$(du -h "$uploads_backup_file" | cut -f1)
            log "SUCCESS" "Uploads backup completed: $uploads_backup_file ($file_size)"
        else
            log "ERROR" "Uploads backup failed"
            rm -f "$exclude_file"
            return 1
        fi
    else
        log "WARN" "No uploaded files found to backup"
    fi
    
    rm -f "$exclude_file"
}

# Backup application logs
backup_logs() {
    log "INFO" "Starting logs backup..."
    
    if [[ ! -d "$LOGS_DIR" ]]; then
        log "WARN" "Logs directory not found: $LOGS_DIR"
        return 0
    fi
    
    local logs_backup_file="${BACKUP_DIR}/${BACKUP_NAME}_logs.tar.gz"
    
    # Only backup logs from the last 7 days to keep size manageable
    local log_files=$(find "$LOGS_DIR" -name "*.log" -mtime -7 -type f)
    
    if [[ -n "$log_files" ]]; then
        # Create logs archive
        tar -czf "$logs_backup_file" $log_files 2>/dev/null
        
        if [[ -f "$logs_backup_file" ]]; then
            local file_size=$(du -h "$logs_backup_file" | cut -f1)
            log "SUCCESS" "Logs backup completed: $logs_backup_file ($file_size)"
        else
            log "ERROR" "Logs backup failed"
            return 1
        fi
    else
        log "WARN" "No recent log files found to backup"
    fi
}

# Backup Redis data
backup_redis_data() {
    log "INFO" "Starting Redis data backup..."
    
    if ! command -v redis-cli &> /dev/null; then
        log "WARN" "Redis CLI not found, skipping Redis backup"
        return 0
    fi
    
    local redis_backup_file="${BACKUP_DIR}/${BACKUP_NAME}_redis.rdb"
    
    # Test Redis connection
    if [[ -n "$REDIS_PASSWORD" ]]; then
        if ! redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" ping &> /dev/null; then
            log "WARN" "Cannot connect to Redis, skipping Redis backup"
            return 0
        fi
    else
        if ! redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping &> /dev/null; then
            log "WARN" "Cannot connect to Redis, skipping Redis backup"
            return 0
        fi
    fi
    
    # Create Redis backup
    if [[ -n "$REDIS_PASSWORD" ]]; then
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --rdb "$redis_backup_file"
    else
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" --rdb "$redis_backup_file"
    fi
    
    if [[ -f "$redis_backup_file" ]]; then
        # Compress Redis backup
        gzip -"$COMPRESSION_LEVEL" "$redis_backup_file"
        
        local file_size=$(du -h "${redis_backup_file}.gz" | cut -f1)
        log "SUCCESS" "Redis backup completed: ${redis_backup_file}.gz ($file_size)"
    else
        log "ERROR" "Redis backup failed"
        return 1
    fi
}

# Backup session data
backup_sessions() {
    log "INFO" "Starting sessions backup..."
    
    if [[ ! -d "$SESSIONS_DIR" ]]; then
        log "WARN" "Sessions directory not found: $SESSIONS_DIR"
        return 0
    fi
    
    local sessions_backup_file="${BACKUP_DIR}/${BACKUP_NAME}_sessions.tar.gz"
    
    # Only backup active sessions (modified within last 24 hours)
    local active_sessions=$(find "$SESSIONS_DIR" -mtime -1 -type f)
    
    if [[ -n "$active_sessions" ]]; then
        tar -czf "$sessions_backup_file" $active_sessions 2>/dev/null
        
        if [[ -f "$sessions_backup_file" ]]; then
            local file_size=$(du -h "$sessions_backup_file" | cut -f1)
            log "SUCCESS" "Sessions backup completed: $sessions_backup_file ($file_size)"
        else
            log "ERROR" "Sessions backup failed"
            return 1
        fi
    else
        log "WARN" "No active sessions found to backup"
    fi
}

# Backup content data
backup_content_data() {
    log "INFO" "Starting content data backup..."
    
    if [[ ! -d "$CONTENT_DATA_DIR" ]]; then
        log "WARN" "Content data directory not found: $CONTENT_DATA_DIR"
        return 0
    fi
    
    local content_backup_file="${BACKUP_DIR}/${BACKUP_NAME}_content.tar.gz"
    local exclude_file=$(create_exclude_file)
    
    # Calculate content statistics
    local file_count=$(find "$CONTENT_DATA_DIR" -type f | wc -l)
    local total_size=$(du -sb "$CONTENT_DATA_DIR" | cut -f1)
    
    if [[ $file_count -gt 0 ]]; then
        # Create content manifest
        local manifest_file="${BACKUP_DIR}/${BACKUP_NAME}_content_manifest.json"
        
        cat > "$manifest_file" << EOF
{
    "backup_type": "content",
    "timestamp": "$TIMESTAMP",
    "content_directory": "$CONTENT_DATA_DIR",
    "file_count": $file_count,
    "total_size": $total_size
}
EOF
        
        # Create compressed archive
        tar -czf "$content_backup_file" --exclude-from="$exclude_file" "$CONTENT_DATA_DIR" 2>/dev/null
        
        if [[ -f "$content_backup_file" ]]; then
            local file_size=$(du -h "$content_backup_file" | cut -f1)
            log "SUCCESS" "Content backup completed: $content_backup_file ($file_size)"
        else
            log "ERROR" "Content backup failed"
            rm -f "$exclude_file"
            return 1
        fi
    else
        log "WARN" "No content files found to backup"
    fi
    
    rm -f "$exclude_file"
}

# Encrypt backup files
encrypt_backup_files() {
    if [[ "$ENCRYPTION_ENABLED" != "true" ]]; then
        log "INFO" "Encryption disabled, skipping..."
        return 0
    fi
    
    log "INFO" "Encrypting backup files..."
    
    local backup_files=("${BACKUP_DIR}/${BACKUP_NAME}"*)
    
    for file in "${backup_files[@]}"; do
        if [[ -f "$file" && "$file" != *.enc && "$file" != *.json ]]; then
            local encrypted_file="${file}.enc"
            
            if openssl enc -aes-256-cbc -salt -in "$file" -out "$encrypted_file" -pass file:"$ENCRYPTION_KEY_FILE"; then
                log "SUCCESS" "Encrypted: $(basename "$file")"
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
            
            # Check file size
            local size=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null || echo 0)
            if [[ $size -eq 0 ]]; then
                log "ERROR" "Empty backup file: $filename"
                verification_failed=true
                continue
            fi
            
            # Verify based on file type
            if [[ "$file" == *.enc ]]; then
                # Verify encrypted file by attempting to decrypt header
                if ! openssl enc -aes-256-cbc -d -in "$file" -pass file:"$ENCRYPTION_KEY_FILE" -out /dev/null -count 1 2>/dev/null; then
                    log "ERROR" "Encrypted file corrupted: $filename"
                    verification_failed=true
                fi
            elif [[ "$file" == *.tar.gz ]]; then
                # Verify gzip integrity
                if ! gzip -t "$file" 2>/dev/null; then
                    log "ERROR" "Compressed file corrupted: $filename"
                    verification_failed=true
                fi
            elif [[ "$file" == *.rdb.gz ]]; then
                # Verify Redis backup
                if ! gzip -t "$file" 2>/dev/null; then
                    log "ERROR" "Redis backup corrupted: $filename"
                    verification_failed=true
                fi
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

# Generate comprehensive backup report
generate_backup_report() {
    log "INFO" "Generating backup report..."
    
    local report_file="${BACKUP_DIR}/${BACKUP_NAME}_report.json"
    local backup_files=("${BACKUP_DIR}/${BACKUP_NAME}"*)
    
    # Calculate backup statistics
    local total_size=0
    local file_count=0
    local file_details=()
    
    for file in "${backup_files[@]}"; do
        if [[ -f "$file" && "$file" != "$report_file" ]]; then
            local filename=$(basename "$file")
            local size=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null || echo 0)
            local checksum=$(sha256sum "$file" 2>/dev/null | cut -d' ' -f1 || shasum -a 256 "$file" 2>/dev/null | cut -d' ' -f1 || echo 'unknown')
            
            total_size=$((total_size + size))
            file_count=$((file_count + 1))
            file_details+=("{\"name\": \"$filename\", \"size\": $size, \"checksum\": \"$checksum\"}")
        fi
    done
    
    # Generate comprehensive report
    cat > "$report_file" << EOF
{
    "backup_id": "$BACKUP_NAME",
    "timestamp": "$TIMESTAMP",
    "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "backup_type": "application_data",
    "application": {
        "name": "Learning Assistant",
        "version": "$(cat ${APP_DIR}/package.json | grep version | cut -d'\"' -f4 2>/dev/null || echo 'unknown')",
        "environment": "${NODE_ENV:-production}"
    },
    "backup_components": {
        "user_data": $([ -f "${BACKUP_DIR}/${BACKUP_NAME}_user_data.tar.gz" ] && echo true || echo false),
        "configuration": $([ -f "${BACKUP_DIR}/${BACKUP_NAME}_config.tar.gz" ] && echo true || echo false),
        "uploads": $([ -f "${BACKUP_DIR}/${BACKUP_NAME}_uploads.tar.gz" ] && echo true || echo false),
        "logs": $([ -f "${BACKUP_DIR}/${BACKUP_NAME}_logs.tar.gz" ] && echo true || echo false),
        "redis": $([ -f "${BACKUP_DIR}/${BACKUP_NAME}_redis.rdb.gz" ] && echo true || echo false),
        "sessions": $([ -f "${BACKUP_DIR}/${BACKUP_NAME}_sessions.tar.gz" ] && echo true || echo false),
        "content": $([ -f "${BACKUP_DIR}/${BACKUP_NAME}_content.tar.gz" ] && echo true || echo false)
    },
    "backup_files": [
        $(IFS=','; echo "${file_details[*]}")
    ],
    "statistics": {
        "total_files": $file_count,
        "total_size": $total_size,
        "total_size_human": "$(numfmt --to=iec $total_size)",
        "compression_level": $COMPRESSION_LEVEL,
        "encryption_enabled": $ENCRYPTION_ENABLED,
        "parallel_compression": $PARALLEL_COMPRESSION
    },
    "retention": {
        "retention_days": $RETENTION_DAYS,
        "cleanup_scheduled": true
    },
    "cloud_storage": {
        "s3_enabled": $([ -n "$S3_BUCKET" ] && echo true || echo false),
        "azure_enabled": $([ -n "$AZURE_CONTAINER" ] && echo true || echo false),
        "gcs_enabled": $([ -n "$GCS_BUCKET" ] && echo true || echo false)
    },
    "performance": {
        "backup_duration": 0,
        "compression_ratio": 0
    }
}
EOF
    
    log "SUCCESS" "Backup report generated: $report_file"
}

# Upload to cloud storage
upload_to_cloud_storage() {
    log "INFO" "Uploading to cloud storage..."
    
    local upload_success=true
    
    # S3 upload
    if [[ -n "$S3_BUCKET" ]]; then
        if ! upload_to_s3; then
            upload_success=false
        fi
    fi
    
    # Azure upload
    if [[ -n "$AZURE_CONTAINER" ]]; then
        if ! upload_to_azure; then
            upload_success=false
        fi
    fi
    
    # GCS upload
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

# S3 upload function
upload_to_s3() {
    if ! command -v aws &> /dev/null; then
        log "ERROR" "AWS CLI not installed"
        return 1
    fi
    
    local backup_files=("${BACKUP_DIR}/${BACKUP_NAME}"*)
    
    for file in "${backup_files[@]}"; do
        if [[ -f "$file" ]]; then
            local filename=$(basename "$file")
            local s3_path="s3://${S3_BUCKET}/${S3_PREFIX}${filename}"
            
            if aws s3 cp "$file" "$s3_path" --storage-class STANDARD_IA; then
                log "SUCCESS" "S3 upload completed: $filename"
            else
                log "ERROR" "S3 upload failed: $filename"
                return 1
            fi
        fi
    done
    
    return 0
}

# Azure upload function
upload_to_azure() {
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
                --tier Cool; then
                
                log "SUCCESS" "Azure upload completed: $filename"
            else
                log "ERROR" "Azure upload failed: $filename"
                return 1
            fi
        fi
    done
    
    return 0
}

# GCS upload function
upload_to_gcs() {
    if ! command -v gsutil &> /dev/null; then
        log "ERROR" "Google Cloud SDK not installed"
        return 1
    fi
    
    local backup_files=("${BACKUP_DIR}/${BACKUP_NAME}"*)
    
    for file in "${backup_files[@]}"; do
        if [[ -f "$file" ]]; then
            local filename=$(basename "$file")
            local gcs_path="gs://${GCS_BUCKET}/${filename}"
            
            if gsutil cp "$file" "$gcs_path"; then
                log "SUCCESS" "GCS upload completed: $filename"
            else
                log "ERROR" "GCS upload failed: $filename"
                return 1
            fi
        fi
    done
    
    return 0
}

# Cleanup old backups
cleanup_old_backups() {
    log "INFO" "Cleaning up old backups (retention: $RETENTION_DAYS days)..."
    
    # Local cleanup
    find "$BACKUP_DIR" -name "app_data_backup_*" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    
    # Cloud storage cleanup
    if [[ -n "$S3_BUCKET" ]] && command -v aws &> /dev/null; then
        local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d 2>/dev/null || date -v-${RETENTION_DAYS}d +%Y-%m-%d 2>/dev/null)
        
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
    fi
    
    log "SUCCESS" "Cleanup completed"
}

# Main backup orchestration
main() {
    local start_time=$(date +%s)
    
    log "INFO" "Starting application data backup: $BACKUP_NAME"
    send_notification "STARTED" "Application data backup initiated"
    
    # Set up signal handlers
    trap 'log "ERROR" "Backup interrupted by signal"; exit 1' INT TERM
    
    # Run backup process with timeout
    timeout "$BACKUP_TIMEOUT" bash -c '
        validate_prerequisites && \
        backup_user_data && \
        backup_app_config && \
        backup_uploads && \
        backup_logs && \
        backup_redis_data && \
        backup_sessions && \
        backup_content_data && \
        encrypt_backup_files && \
        verify_backup_integrity && \
        generate_backup_report && \
        upload_to_cloud_storage && \
        cleanup_old_backups
    ' || {
        log "ERROR" "Application data backup failed or timed out"
        send_notification "FAILED" "Application data backup failed or timed out after $BACKUP_TIMEOUT seconds" "error"
        exit 1
    }
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local total_size=$(du -sh "${BACKUP_DIR}/${BACKUP_NAME}"* 2>/dev/null | awk '{s+=$1} END {print s}' || echo "unknown")
    
    # Update performance metrics in report
    if [[ -f "${BACKUP_DIR}/${BACKUP_NAME}_report.json" ]]; then
        jq --arg duration "$duration" \
           '.performance.backup_duration = ($duration | tonumber)' \
           "${BACKUP_DIR}/${BACKUP_NAME}_report.json" > "${BACKUP_DIR}/${BACKUP_NAME}_report.json.tmp" && \
        mv "${BACKUP_DIR}/${BACKUP_NAME}_report.json.tmp" "${BACKUP_DIR}/${BACKUP_NAME}_report.json"
    fi
    
    log "SUCCESS" "Application data backup completed successfully in ${duration}s (Total size: ${total_size})"
    send_notification "SUCCESS" "Application data backup completed in ${duration}s. Total size: ${total_size}"
    
    exit 0
}

# Handle script arguments
case "${1:-main}" in
    "main")
        main
        ;;
    "user-data")
        validate_prerequisites && backup_user_data
        ;;
    "config")
        validate_prerequisites && backup_app_config
        ;;
    "uploads")
        validate_prerequisites && backup_uploads
        ;;
    "logs")
        validate_prerequisites && backup_logs
        ;;
    "redis")
        validate_prerequisites && backup_redis_data
        ;;
    "sessions")
        validate_prerequisites && backup_sessions
        ;;
    "content")
        validate_prerequisites && backup_content_data
        ;;
    "verify")
        verify_backup_integrity
        ;;
    "cleanup")
        cleanup_old_backups
        ;;
    "help")
        cat << EOF
Usage: $0 [COMMAND]

Commands:
  main       - Run complete application data backup (default)
  user-data  - Backup user data and learning progress
  config     - Backup application configuration
  uploads    - Backup uploaded files and media
  logs       - Backup application logs
  redis      - Backup Redis data
  sessions   - Backup session data
  content    - Backup content data
  verify     - Verify existing backups
  cleanup    - Cleanup old backups
  help       - Show this help

Environment Variables:
  BACKUP_DIR, RETENTION_DAYS, COMPRESSION_LEVEL
  ENCRYPTION_ENABLED, PARALLEL_COMPRESSION
  S3_BUCKET, AZURE_CONTAINER, GCS_BUCKET
  SLACK_WEBHOOK, DISCORD_WEBHOOK, EMAIL_ALERTS
  REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
EOF
        ;;
    *)
        log "ERROR" "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac