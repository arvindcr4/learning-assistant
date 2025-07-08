#!/bin/bash

# Daily Health Check Script
# Quick daily verification of backup systems and data integrity
# Version: 2.0.0

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/learning-assistant}"
LOG_DIR="${LOG_DIR:-/var/log/backup-testing}"
NOTIFICATION_ENABLED="${NOTIFICATION_ENABLED:-true}"
ALERT_THRESHOLD_HOURS="${ALERT_THRESHOLD_HOURS:-24}"

# Test configuration
TEST_START_TIME=$(date +%s)
TEST_ID="daily-health-$(date +%Y%m%d-%H%M%S)"
TEST_LOG_FILE="$LOG_DIR/daily-health-check-$(date +%Y%m%d).log"
TEST_RESULTS_DIR="$LOG_DIR/results/$TEST_ID"
HEALTH_REPORT_FILE="$TEST_RESULTS_DIR/health-report.json"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$TEST_LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$TEST_LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS: $1${NC}" | tee -a "$TEST_LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$TEST_LOG_FILE"
}

# Health check result tracking
declare -A HEALTH_STATUS
HEALTH_STATUS["overall"]="HEALTHY"
HEALTH_STATUS["backup_freshness"]="UNKNOWN"
HEALTH_STATUS["database_connectivity"]="UNKNOWN"
HEALTH_STATUS["redis_connectivity"]="UNKNOWN"
HEALTH_STATUS["storage_space"]="UNKNOWN"
HEALTH_STATUS["backup_services"]="UNKNOWN"
HEALTH_STATUS["monitoring"]="UNKNOWN"

# Initialize health check environment
initialize_health_check() {
    log "Initializing daily health check..."
    
    # Create log directories
    mkdir -p "$LOG_DIR" "$TEST_RESULTS_DIR"
    
    # Initialize health report
    cat > "$HEALTH_REPORT_FILE" << EOF
{
    "check_id": "$TEST_ID",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "check_type": "daily_health_check",
    "environment": "$(kubectl config current-context 2>/dev/null || echo 'unknown')",
    "checks": []
}
EOF
    
    log_success "Health check environment initialized"
}

# Record health check result
record_check_result() {
    local check_name="$1"
    local check_status="$2"
    local check_message="$3"
    local check_details="${4:-}"
    
    # Update global status
    HEALTH_STATUS["$check_name"]="$check_status"
    
    if [[ "$check_status" != "HEALTHY" ]]; then
        HEALTH_STATUS["overall"]="UNHEALTHY"
    fi
    
    # Add to health report
    local check_entry=$(jq -n \
        --arg name "$check_name" \
        --arg status "$check_status" \
        --arg message "$check_message" \
        --arg details "$check_details" \
        --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        '{
            name: $name,
            status: $status,
            message: $message,
            details: $details,
            timestamp: $timestamp
        }')
    
    jq --argjson check "$check_entry" '.checks += [$check]' "$HEALTH_REPORT_FILE" > "$HEALTH_REPORT_FILE.tmp"
    mv "$HEALTH_REPORT_FILE.tmp" "$HEALTH_REPORT_FILE"
}

# Check backup freshness
check_backup_freshness() {
    log "Checking backup freshness..."
    
    local current_time=$(date +%s)
    local threshold_time=$((current_time - ALERT_THRESHOLD_HOURS * 3600))
    
    # Check database backups
    local latest_db_backup=$(find "$BACKUP_DIR" -name "*.sql.gz" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f1)
    
    if [[ -z "$latest_db_backup" ]]; then
        log_error "No database backup files found"
        record_check_result "backup_freshness" "CRITICAL" "No database backup files found"
        return 1
    fi
    
    local backup_age_hours=$(( (current_time - ${latest_db_backup%.*}) / 3600 ))
    
    if [[ $backup_age_hours -gt $ALERT_THRESHOLD_HOURS ]]; then
        log_error "Latest database backup is $backup_age_hours hours old (threshold: $ALERT_THRESHOLD_HOURS hours)"
        record_check_result "backup_freshness" "CRITICAL" "Latest backup is too old" "Age: $backup_age_hours hours"
        return 1
    elif [[ $backup_age_hours -gt $((ALERT_THRESHOLD_HOURS / 2)) ]]; then
        log_warning "Latest database backup is $backup_age_hours hours old"
        record_check_result "backup_freshness" "WARNING" "Backup is getting stale" "Age: $backup_age_hours hours"
    else
        log_success "Latest database backup is $backup_age_hours hours old"
        record_check_result "backup_freshness" "HEALTHY" "Backup freshness is good" "Age: $backup_age_hours hours"
    fi
    
    return 0
}

# Check database connectivity
check_database_connectivity() {
    log "Checking database connectivity..."
    
    # Check if environment variables are set
    if [[ -z "${DB_HOST:-}" ]] || [[ -z "${DB_USER:-}" ]]; then
        log_warning "Database connection parameters not set"
        record_check_result "database_connectivity" "WARNING" "Database connection parameters not configured"
        return 1
    fi
    
    # Test database connection
    if pg_isready -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -t 10 >/dev/null 2>&1; then
        log_success "Database is accessible"
        
        # Test basic query
        if echo "SELECT 1;" | psql -h "$DB_HOST" -U "$DB_USER" -d "${DB_NAME:-learning_assistant}" -t >/dev/null 2>&1; then
            log_success "Database query test passed"
            record_check_result "database_connectivity" "HEALTHY" "Database is accessible and responsive"
        else
            log_error "Database query test failed"
            record_check_result "database_connectivity" "CRITICAL" "Database is accessible but queries are failing"
            return 1
        fi
    else
        log_error "Database is not accessible"
        record_check_result "database_connectivity" "CRITICAL" "Database is not accessible"
        return 1
    fi
    
    return 0
}

# Check Redis connectivity
check_redis_connectivity() {
    log "Checking Redis connectivity..."
    
    # Check if environment variables are set
    if [[ -z "${REDIS_HOST:-}" ]]; then
        log_warning "Redis connection parameters not set"
        record_check_result "redis_connectivity" "WARNING" "Redis connection parameters not configured"
        return 1
    fi
    
    # Test Redis connection
    if redis-cli -h "$REDIS_HOST" -p "${REDIS_PORT:-6379}" ping 2>/dev/null | grep -q "PONG"; then
        log_success "Redis is accessible"
        
        # Test basic operations
        local test_key="health_check_$(date +%s)"
        if redis-cli -h "$REDIS_HOST" -p "${REDIS_PORT:-6379}" set "$test_key" "test" EX 60 >/dev/null 2>&1; then
            if redis-cli -h "$REDIS_HOST" -p "${REDIS_PORT:-6379}" get "$test_key" >/dev/null 2>&1; then
                log_success "Redis operations test passed"
                redis-cli -h "$REDIS_HOST" -p "${REDIS_PORT:-6379}" del "$test_key" >/dev/null 2>&1
                record_check_result "redis_connectivity" "HEALTHY" "Redis is accessible and operational"
            else
                log_error "Redis read test failed"
                record_check_result "redis_connectivity" "CRITICAL" "Redis is accessible but read operations are failing"
                return 1
            fi
        else
            log_error "Redis write test failed"
            record_check_result "redis_connectivity" "CRITICAL" "Redis is accessible but write operations are failing"
            return 1
        fi
    else
        log_error "Redis is not accessible"
        record_check_result "redis_connectivity" "CRITICAL" "Redis is not accessible"
        return 1
    fi
    
    return 0
}

# Check storage space
check_storage_space() {
    log "Checking storage space..."
    
    # Check backup directory space
    if [[ -d "$BACKUP_DIR" ]]; then
        local backup_usage=$(df "$BACKUP_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
        local backup_avail=$(df -h "$BACKUP_DIR" | tail -1 | awk '{print $4}')
        
        log "Backup directory usage: $backup_usage% (Available: $backup_avail)"
        
        if [[ $backup_usage -gt 90 ]]; then
            log_error "Backup directory usage is critical: $backup_usage%"
            record_check_result "storage_space" "CRITICAL" "Backup storage is critically full" "Usage: $backup_usage%, Available: $backup_avail"
            return 1
        elif [[ $backup_usage -gt 80 ]]; then
            log_warning "Backup directory usage is high: $backup_usage%"
            record_check_result "storage_space" "WARNING" "Backup storage is getting full" "Usage: $backup_usage%, Available: $backup_avail"
        else
            log_success "Backup directory space is adequate: $backup_usage%"
            record_check_result "storage_space" "HEALTHY" "Storage space is adequate" "Usage: $backup_usage%, Available: $backup_avail"
        fi
    else
        log_error "Backup directory does not exist: $BACKUP_DIR"
        record_check_result "storage_space" "CRITICAL" "Backup directory does not exist"
        return 1
    fi
    
    # Check root filesystem space
    local root_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    local root_avail=$(df -h / | tail -1 | awk '{print $4}')
    
    log "Root filesystem usage: $root_usage% (Available: $root_avail)"
    
    if [[ $root_usage -gt 95 ]]; then
        log_error "Root filesystem usage is critical: $root_usage%"
        record_check_result "storage_space" "CRITICAL" "Root filesystem is critically full" "Usage: $root_usage%, Available: $root_avail"
        return 1
    fi
    
    return 0
}

# Check backup services
check_backup_services() {
    log "Checking backup services..."
    
    # Check if we're in Kubernetes environment
    if command -v kubectl >/dev/null 2>&1 && kubectl cluster-info >/dev/null 2>&1; then
        # Check backup service pods
        local backup_pods=$(kubectl get pods -n learning-assistant-backup -l component=backup 2>/dev/null | grep -c "Running" || echo "0")
        
        if [[ $backup_pods -gt 0 ]]; then
            log_success "Backup service pods are running ($backup_pods pods)"
            record_check_result "backup_services" "HEALTHY" "Backup services are running" "Running pods: $backup_pods"
        else
            log_error "No backup service pods are running"
            record_check_result "backup_services" "CRITICAL" "No backup service pods are running"
            return 1
        fi
        
        # Check backup service health endpoint
        if kubectl exec -n learning-assistant-backup deployment/backup-service -- /opt/backup/healthcheck.sh >/dev/null 2>&1; then
            log_success "Backup service health check passed"
        else
            log_error "Backup service health check failed"
            record_check_result "backup_services" "CRITICAL" "Backup service health check failed"
            return 1
        fi
    else
        # Check backup processes on local system
        local backup_processes=$(pgrep -f "backup" | wc -l)
        
        if [[ $backup_processes -gt 0 ]]; then
            log_success "Backup processes are running ($backup_processes processes)"
            record_check_result "backup_services" "HEALTHY" "Backup processes are running" "Processes: $backup_processes"
        else
            log_warning "No backup processes found"
            record_check_result "backup_services" "WARNING" "No backup processes found"
        fi
    fi
    
    return 0
}

# Check monitoring systems
check_monitoring() {
    log "Checking monitoring systems..."
    
    # Check backup monitoring endpoint
    if curl -f "http://backup-monitor.learning-assistant.svc.cluster.local:9090/metrics" >/dev/null 2>&1; then
        log_success "Backup monitoring endpoint is accessible"
        record_check_result "monitoring" "HEALTHY" "Monitoring systems are accessible"
    elif curl -f "http://localhost:9090/metrics" >/dev/null 2>&1; then
        log_success "Local monitoring endpoint is accessible"
        record_check_result "monitoring" "HEALTHY" "Local monitoring is accessible"
    else
        log_warning "Monitoring endpoints are not accessible"
        record_check_result "monitoring" "WARNING" "Monitoring endpoints are not accessible"
    fi
    
    # Check if backup metrics are being collected
    local metrics_response=""
    if command -v curl >/dev/null 2>&1; then
        metrics_response=$(curl -s "http://backup-monitor.learning-assistant.svc.cluster.local:9090/metrics" 2>/dev/null || curl -s "http://localhost:9090/metrics" 2>/dev/null || echo "")
        
        if echo "$metrics_response" | grep -q "backup_"; then
            log_success "Backup metrics are being collected"
        else
            log_warning "Backup metrics not found in monitoring data"
        fi
    fi
    
    return 0
}

# Generate health report summary
generate_health_summary() {
    log "Generating health summary..."
    
    local check_end_time=$(date +%s)
    local total_duration=$((check_end_time - TEST_START_TIME))
    
    # Count check results
    local healthy_count=0
    local warning_count=0
    local critical_count=0
    
    for status in "${HEALTH_STATUS[@]}"; do
        case "$status" in
            "HEALTHY") healthy_count=$((healthy_count + 1)) ;;
            "WARNING") warning_count=$((warning_count + 1)) ;;
            "CRITICAL") critical_count=$((critical_count + 1)) ;;
        esac
    done
    
    # Update final health report
    jq --arg end_time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
       --arg duration "$total_duration" \
       --arg overall_status "${HEALTH_STATUS[overall]}" \
       --arg healthy_count "$healthy_count" \
       --arg warning_count "$warning_count" \
       --arg critical_count "$critical_count" \
       '.end_time = $end_time | .duration = ($duration | tonumber) | .summary = {
           overall_status: $overall_status,
           healthy_checks: ($healthy_count | tonumber),
           warning_checks: ($warning_count | tonumber),
           critical_checks: ($critical_count | tonumber),
           total_checks: (($healthy_count | tonumber) + ($warning_count | tonumber) + ($critical_count | tonumber))
       }' "$HEALTH_REPORT_FILE" > "$HEALTH_REPORT_FILE.tmp"
    mv "$HEALTH_REPORT_FILE.tmp" "$HEALTH_REPORT_FILE"
    
    # Create summary report
    local summary_file="$TEST_RESULTS_DIR/health-summary.txt"
    cat > "$summary_file" << EOF
DAILY HEALTH CHECK SUMMARY
==========================

Check ID: $TEST_ID
Date: $(date -u +%Y-%m-%d %H:%M:%S) UTC
Duration: $total_duration seconds
Overall Status: ${HEALTH_STATUS[overall]}

COMPONENT STATUS:
- Backup Freshness: ${HEALTH_STATUS[backup_freshness]}
- Database Connectivity: ${HEALTH_STATUS[database_connectivity]}
- Redis Connectivity: ${HEALTH_STATUS[redis_connectivity]}
- Storage Space: ${HEALTH_STATUS[storage_space]}
- Backup Services: ${HEALTH_STATUS[backup_services]}
- Monitoring: ${HEALTH_STATUS[monitoring]}

SUMMARY:
- Healthy: $healthy_count
- Warning: $warning_count
- Critical: $critical_count

DETAILED RESULTS:
EOF
    
    jq -r '.checks[] | "- \(.name): \(.status) - \(.message)"' "$HEALTH_REPORT_FILE" >> "$summary_file"
    
    log_success "Health summary generated: $summary_file"
    
    # Display summary
    cat "$summary_file"
}

# Send notifications
send_notifications() {
    if [[ "$NOTIFICATION_ENABLED" == "true" ]]; then
        log "Checking if notifications should be sent..."
        
        # Only send notifications for warnings and critical issues
        if [[ "${HEALTH_STATUS[overall]}" != "HEALTHY" ]]; then
            log "Sending health alert notifications..."
            
            local status_emoji="⚠️"
            if [[ "${HEALTH_STATUS[overall]}" == "CRITICAL" ]]; then
                status_emoji="🚨"
            fi
            
            # Count issues
            local critical_count=0
            local warning_count=0
            
            for status in "${HEALTH_STATUS[@]}"; do
                case "$status" in
                    "WARNING") warning_count=$((warning_count + 1)) ;;
                    "CRITICAL") critical_count=$((critical_count + 1)) ;;
                esac
            done
            
            # Slack notification
            if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
                local message="$status_emoji Daily Health Check Alert\\n\\n**Status:** ${HEALTH_STATUS[overall]}\\n**Critical Issues:** $critical_count\\n**Warnings:** $warning_count\\n**Check ID:** $TEST_ID"
                
                curl -X POST -H 'Content-type: application/json' \
                    --data "{\"text\":\"$message\"}" \
                    "$SLACK_WEBHOOK_URL" || log_warning "Failed to send Slack notification"
            fi
            
            # Email notification for critical issues
            if [[ "${HEALTH_STATUS[overall]}" == "CRITICAL" ]] && [[ -n "${EMAIL_RECIPIENTS:-}" ]]; then
                local subject="CRITICAL: Daily Health Check Alert - $TEST_ID"
                local body="Critical issues detected in daily health check.\n\nCheck ID: $TEST_ID\nCritical Issues: $critical_count\nWarnings: $warning_count\n\nDetailed report: $HEALTH_REPORT_FILE"
                
                echo -e "$body" | mail -s "$subject" "$EMAIL_RECIPIENTS" || log_warning "Failed to send email notification"
            fi
        else
            log "System is healthy, no notifications needed"
        fi
    fi
}

# Main execution
main() {
    log "Starting Daily Health Check - $TEST_ID"
    
    # Initialize health check
    initialize_health_check
    
    # Run all health checks
    check_backup_freshness
    check_database_connectivity
    check_redis_connectivity
    check_storage_space
    check_backup_services
    check_monitoring
    
    # Generate summary
    generate_health_summary
    
    # Send notifications if needed
    send_notifications
    
    # Final status
    if [[ "${HEALTH_STATUS[overall]}" == "HEALTHY" ]]; then
        log_success "Daily health check completed - System is healthy"
        exit 0
    elif [[ "${HEALTH_STATUS[overall]}" == "WARNING" ]]; then
        log_warning "Daily health check completed with warnings"
        exit 1
    else
        log_error "Daily health check completed with critical issues"
        exit 2
    fi
}

# Run main function
main "$@"