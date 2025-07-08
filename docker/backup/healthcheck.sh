#!/bin/bash

# Backup Service Health Check Script
# Learning Assistant - Docker Container Health Monitoring
# Version: 2.0.0

set -euo pipefail

# Health check configuration
HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-30}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/learning-assistant}
LOG_DIR=${LOG_DIR:-/var/log/backup}
MAX_BACKUP_AGE_HOURS=${MAX_BACKUP_AGE_HOURS:-25}
MONITORING_ENABLED=${MONITORING_ENABLED:-true}

# Exit codes
HEALTHY=0
UNHEALTHY=1
WARNING=2

# Logging function
log() {
    local level=$1
    shift
    local message="$@"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $message"
}

# Check if backup directory is accessible
check_backup_directory() {
    log "INFO" "Checking backup directory accessibility..."
    
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log "ERROR" "Backup directory does not exist: $BACKUP_DIR"
        return $UNHEALTHY
    fi
    
    if [[ ! -r "$BACKUP_DIR" ]]; then
        log "ERROR" "Backup directory is not readable: $BACKUP_DIR"
        return $UNHEALTHY
    fi
    
    if [[ ! -w "$BACKUP_DIR" ]]; then
        log "ERROR" "Backup directory is not writable: $BACKUP_DIR"
        return $UNHEALTHY
    fi
    
    log "INFO" "Backup directory is accessible"
    return $HEALTHY
}

# Check backup freshness
check_backup_freshness() {
    log "INFO" "Checking backup freshness..."
    
    # Find the most recent backup file
    local latest_backup
    latest_backup=$(find "$BACKUP_DIR" -name "*_backup_*" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
    
    if [[ -z "$latest_backup" ]]; then
        log "ERROR" "No backup files found"
        return $UNHEALTHY
    fi
    
    # Check backup age
    local backup_timestamp
    backup_timestamp=$(stat -c %Y "$latest_backup" 2>/dev/null)
    
    if [[ -z "$backup_timestamp" ]]; then
        log "ERROR" "Cannot determine backup timestamp"
        return $UNHEALTHY
    fi
    
    local current_timestamp
    current_timestamp=$(date +%s)
    local age_seconds=$((current_timestamp - backup_timestamp))
    local age_hours=$((age_seconds / 3600))
    
    log "INFO" "Latest backup is $age_hours hours old"
    
    if [[ $age_hours -gt $MAX_BACKUP_AGE_HOURS ]]; then
        log "ERROR" "Latest backup is too old: $age_hours hours (max: $MAX_BACKUP_AGE_HOURS hours)"
        return $UNHEALTHY
    elif [[ $age_hours -gt $((MAX_BACKUP_AGE_HOURS - 2)) ]]; then
        log "WARN" "Latest backup is getting old: $age_hours hours"
        return $WARNING
    fi
    
    log "INFO" "Backup freshness check passed"
    return $HEALTHY
}

# Check database connectivity
check_database_connectivity() {
    log "INFO" "Checking database connectivity..."
    
    if [[ -z "${DB_HOST:-}" || -z "${DB_USER:-}" || -z "${DB_PASSWORD:-}" ]]; then
        log "WARN" "Database credentials not configured, skipping connectivity check"
        return $HEALTHY
    fi
    
    export PGPASSWORD="$DB_PASSWORD"
    
    if timeout 10 pg_isready -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "${DB_NAME:-learning_assistant_db}" &>/dev/null; then
        log "INFO" "Database connectivity check passed"
        unset PGPASSWORD
        return $HEALTHY
    else
        log "ERROR" "Database connectivity check failed"
        unset PGPASSWORD
        return $UNHEALTHY
    fi
}

# Check log files
check_log_files() {
    log "INFO" "Checking log files..."
    
    local log_files=("backup.log" "monitoring.log" "error.log")
    
    for log_file in "${log_files[@]}"; do
        local full_path="$LOG_DIR/$log_file"
        
        if [[ ! -f "$full_path" ]]; then
            log "WARN" "Log file does not exist: $full_path"
            continue
        fi
        
        # Check if log file is writable
        if [[ ! -w "$full_path" ]]; then
            log "ERROR" "Log file is not writable: $full_path"
            return $UNHEALTHY
        fi
        
        # Check for recent error entries
        if [[ "$log_file" == "error.log" ]]; then
            local recent_errors
            recent_errors=$(find "$full_path" -mmin -60 -exec grep -i "error\|critical\|fatal" {} \; 2>/dev/null | wc -l)
            
            if [[ $recent_errors -gt 10 ]]; then
                log "ERROR" "Too many recent errors in $log_file: $recent_errors"
                return $UNHEALTHY
            elif [[ $recent_errors -gt 5 ]]; then
                log "WARN" "Elevated error count in $log_file: $recent_errors"
            fi
        fi
    done
    
    log "INFO" "Log files check passed"
    return $HEALTHY
}

# Check disk space
check_disk_space() {
    log "INFO" "Checking disk space..."
    
    # Check backup directory disk usage
    local backup_usage
    backup_usage=$(df "$BACKUP_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [[ $backup_usage -gt 95 ]]; then
        log "ERROR" "Backup directory disk usage critical: ${backup_usage}%"
        return $UNHEALTHY
    elif [[ $backup_usage -gt 90 ]]; then
        log "WARN" "Backup directory disk usage high: ${backup_usage}%"
        return $WARNING
    fi
    
    # Check log directory disk usage
    local log_usage
    log_usage=$(df "$LOG_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [[ $log_usage -gt 95 ]]; then
        log "ERROR" "Log directory disk usage critical: ${log_usage}%"
        return $UNHEALTHY
    fi
    
    log "INFO" "Disk space check passed (backup: ${backup_usage}%, logs: ${log_usage}%)"
    return $HEALTHY
}

# Check cron service
check_cron_service() {
    log "INFO" "Checking cron service..."
    
    if pgrep -x "cron" >/dev/null || pgrep -x "crond" >/dev/null; then
        log "INFO" "Cron service is running"
        return $HEALTHY
    else
        log "ERROR" "Cron service is not running"
        return $UNHEALTHY
    fi
}

# Check monitoring service
check_monitoring_service() {
    if [[ "$MONITORING_ENABLED" != "true" ]]; then
        log "INFO" "Monitoring disabled, skipping monitoring service check"
        return $HEALTHY
    fi
    
    log "INFO" "Checking monitoring service..."
    
    if pgrep -f "backup-monitor" >/dev/null; then
        log "INFO" "Monitoring service is running"
        return $HEALTHY
    else
        log "WARN" "Monitoring service is not running"
        return $WARNING
    fi
}

# Check cloud storage connectivity
check_cloud_storage() {
    log "INFO" "Checking cloud storage connectivity..."
    
    local cloud_issues=0
    
    # Check AWS S3
    if [[ -n "${S3_BUCKET:-}" ]]; then
        if command -v aws >/dev/null 2>&1; then
            if timeout 10 aws sts get-caller-identity >/dev/null 2>&1; then
                if timeout 10 aws s3 ls "s3://$S3_BUCKET" >/dev/null 2>&1; then
                    log "INFO" "AWS S3 connectivity verified"
                else
                    log "WARN" "Cannot access S3 bucket: $S3_BUCKET"
                    cloud_issues=$((cloud_issues + 1))
                fi
            else
                log "WARN" "AWS credentials not configured or expired"
                cloud_issues=$((cloud_issues + 1))
            fi
        else
            log "WARN" "AWS CLI not available"
            cloud_issues=$((cloud_issues + 1))
        fi
    fi
    
    # Check Azure
    if [[ -n "${AZURE_CONTAINER:-}" ]]; then
        if command -v az >/dev/null 2>&1; then
            if timeout 10 az account show >/dev/null 2>&1; then
                log "INFO" "Azure connectivity verified"
            else
                log "WARN" "Azure credentials not configured or expired"
                cloud_issues=$((cloud_issues + 1))
            fi
        else
            log "WARN" "Azure CLI not available"
            cloud_issues=$((cloud_issues + 1))
        fi
    fi
    
    # Check GCP
    if [[ -n "${GCS_BUCKET:-}" ]]; then
        if command -v gsutil >/dev/null 2>&1; then
            if timeout 10 gsutil ls "gs://$GCS_BUCKET" >/dev/null 2>&1; then
                log "INFO" "Google Cloud Storage connectivity verified"
            else
                log "WARN" "Cannot access GCS bucket: $GCS_BUCKET"
                cloud_issues=$((cloud_issues + 1))
            fi
        else
            log "WARN" "Google Cloud SDK not available"
            cloud_issues=$((cloud_issues + 1))
        fi
    fi
    
    if [[ $cloud_issues -eq 0 ]]; then
        log "INFO" "Cloud storage connectivity check passed"
        return $HEALTHY
    elif [[ $cloud_issues -le 1 ]]; then
        log "WARN" "Some cloud storage issues detected: $cloud_issues"
        return $WARNING
    else
        log "ERROR" "Multiple cloud storage issues detected: $cloud_issues"
        return $UNHEALTHY
    fi
}

# Check backup integrity
check_backup_integrity() {
    log "INFO" "Checking backup integrity (quick check)..."
    
    # Find recent backup files
    local backup_files
    backup_files=$(find "$BACKUP_DIR" -name "*_backup_*" -type f -mtime -1 2>/dev/null)
    
    if [[ -z "$backup_files" ]]; then
        log "WARN" "No recent backup files found for integrity check"
        return $WARNING
    fi
    
    local corrupt_files=0
    local total_files=0
    
    while IFS= read -r file; do
        if [[ -f "$file" ]]; then
            total_files=$((total_files + 1))
            
            # Quick integrity check based on file type
            if [[ "$file" == *.gz ]]; then
                if ! gzip -t "$file" 2>/dev/null; then
                    log "ERROR" "Corrupt gzip file: $(basename "$file")"
                    corrupt_files=$((corrupt_files + 1))
                fi
            elif [[ "$file" == *.backup ]]; then
                if ! pg_restore --list "$file" >/dev/null 2>&1; then
                    log "ERROR" "Corrupt PostgreSQL backup: $(basename "$file")"
                    corrupt_files=$((corrupt_files + 1))
                fi
            fi
            
            # Check file size
            local size
            size=$(stat -c%s "$file" 2>/dev/null || echo 0)
            if [[ $size -eq 0 ]]; then
                log "ERROR" "Empty backup file: $(basename "$file")"
                corrupt_files=$((corrupt_files + 1))
            fi
        fi
    done <<< "$backup_files"
    
    if [[ $corrupt_files -eq 0 ]]; then
        log "INFO" "Backup integrity check passed ($total_files files checked)"
        return $HEALTHY
    elif [[ $corrupt_files -le 1 && $total_files -gt 3 ]]; then
        log "WARN" "Minor backup integrity issues: $corrupt_files/$total_files files"
        return $WARNING
    else
        log "ERROR" "Backup integrity check failed: $corrupt_files/$total_files files corrupt"
        return $UNHEALTHY
    fi
}

# Main health check function
main() {
    log "INFO" "Starting backup service health check..."
    
    local overall_status=$HEALTHY
    local check_results=()
    
    # Run all health checks
    local checks=(
        "check_backup_directory"
        "check_backup_freshness"
        "check_database_connectivity"
        "check_log_files"
        "check_disk_space"
        "check_cron_service"
        "check_monitoring_service"
        "check_cloud_storage"
        "check_backup_integrity"
    )
    
    for check in "${checks[@]}"; do
        local start_time
        start_time=$(date +%s)
        
        if timeout $HEALTH_CHECK_TIMEOUT $check; then
            local result=$?
            local end_time
            end_time=$(date +%s)
            local duration=$((end_time - start_time))
            
            check_results+=("$check: $([ $result -eq $HEALTHY ] && echo 'PASS' || ([ $result -eq $WARNING ] && echo 'WARN' || echo 'FAIL')) (${duration}s)")
            
            # Update overall status
            if [[ $result -eq $UNHEALTHY ]]; then
                overall_status=$UNHEALTHY
            elif [[ $result -eq $WARNING && $overall_status -eq $HEALTHY ]]; then
                overall_status=$WARNING
            fi
        else
            log "ERROR" "Health check $check timed out or failed"
            check_results+=("$check: TIMEOUT")
            overall_status=$UNHEALTHY
        fi
    done
    
    # Log summary
    log "INFO" "Health check summary:"
    for result in "${check_results[@]}"; do
        log "INFO" "  $result"
    done
    
    # Determine final status
    case $overall_status in
        $HEALTHY)
            log "INFO" "Overall health status: HEALTHY"
            echo "HEALTHY: All checks passed"
            exit $HEALTHY
            ;;
        $WARNING)
            log "WARN" "Overall health status: WARNING"
            echo "WARNING: Some checks failed with warnings"
            exit $WARNING
            ;;
        $UNHEALTHY)
            log "ERROR" "Overall health status: UNHEALTHY"
            echo "UNHEALTHY: Critical checks failed"
            exit $UNHEALTHY
            ;;
    esac
}

# Run health check
main "$@"
