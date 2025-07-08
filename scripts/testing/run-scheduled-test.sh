#!/bin/bash

# Run Scheduled Test
# Helper script to execute scheduled backup tests with proper logging and error handling
# Version: 2.0.0

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="${LOG_DIR:-/var/log/backup-testing}"
SCHEDULE_CONFIG="${SCHEDULE_CONFIG:-$SCRIPT_DIR/test-schedule.json}"
LOCK_DIR="${LOCK_DIR:-/var/lock/backup-testing}"

# Parse arguments
TEST_NAME="${1:-}"

if [[ -z "$TEST_NAME" ]]; then
    echo "ERROR: Test name required"
    echo "Usage: $0 <test_name>"
    exit 1
fi

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS: $1${NC}" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

# Initialize logging
EXECUTION_ID="$TEST_NAME-$(date +%Y%m%d-%H%M%S)"
LOG_FILE="$LOG_DIR/scheduled-execution-$(date +%Y%m%d).log"
LOCK_FILE="$LOCK_DIR/$TEST_NAME.lock"

# Create directories
mkdir -p "$LOG_DIR" "$LOCK_DIR"

# Check for concurrent execution
acquire_lock() {
    if [[ -f "$LOCK_FILE" ]]; then
        local lock_pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
        
        if [[ -n "$lock_pid" ]] && kill -0 "$lock_pid" 2>/dev/null; then
            log_error "Test is already running (PID: $lock_pid)"
            exit 1
        else
            log_warning "Stale lock file found, removing..."
            rm -f "$LOCK_FILE"
        fi
    fi
    
    echo $$ > "$LOCK_FILE"
    log "Acquired lock for test execution"
}

# Release lock on exit
release_lock() {
    if [[ -f "$LOCK_FILE" ]]; then
        rm -f "$LOCK_FILE"
        log "Released lock for test execution"
    fi
}

# Set up trap for cleanup
trap 'release_lock' EXIT

# Get test configuration
get_test_config() {
    if [[ ! -f "$SCHEDULE_CONFIG" ]]; then
        log_error "Schedule configuration not found: $SCHEDULE_CONFIG"
        exit 1
    fi
    
    local config=$(jq -r ".schedules[] | select(.name == \"$TEST_NAME\")" "$SCHEDULE_CONFIG" 2>/dev/null)
    
    if [[ -z "$config" ]]; then
        log_error "Test configuration not found: $TEST_NAME"
        exit 1
    fi
    
    echo "$config"
}

# Set environment variables
set_environment() {
    local config="$1"
    
    # Set test-specific environment variables
    if echo "$config" | jq -e '.environment' >/dev/null; then
        while IFS= read -r env_line; do
            export "$env_line"
            log "Set environment: $env_line"
        done < <(echo "$config" | jq -r '.environment | to_entries[] | "\(.key)=\(.value)"')
    fi
    
    # Set global environment variables
    export TEST_EXECUTION_ID="$EXECUTION_ID"
    export TEST_NAME="$TEST_NAME"
    export SCHEDULED_EXECUTION="true"
}

# Execute the test
execute_test() {
    local config="$1"
    
    local script=$(echo "$config" | jq -r '.script')
    local timeout=$(echo "$config" | jq -r '.timeout // 1800')
    local description=$(echo "$config" | jq -r '.description // "No description"')
    
    log "Starting scheduled test execution"
    log "Test: $TEST_NAME"
    log "Description: $description"
    log "Script: $script"
    log "Timeout: ${timeout}s"
    log "Execution ID: $EXECUTION_ID"
    
    local start_time=$(date +%s)
    local exit_code=0
    
    # Execute test with timeout
    if timeout "$timeout" "$SCRIPT_DIR/$script" 2>&1 | tee -a "$LOG_FILE"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_success "Test completed successfully in ${duration}s"
        
        # Record successful execution
        record_execution_result "SUCCESS" "$duration" ""
        
        # Send success notification if configured
        send_notification "SUCCESS" "$duration"
        
    else
        exit_code=$?
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_error "Test failed with exit code $exit_code after ${duration}s"
        
        # Record failed execution
        record_execution_result "FAILED" "$duration" "Exit code: $exit_code"
        
        # Send failure notification
        send_notification "FAILED" "$duration" "Exit code: $exit_code"
        
        return $exit_code
    fi
}

# Record execution result
record_execution_result() {
    local status="$1"
    local duration="$2"
    local error_details="${3:-}"
    
    local result_file="$LOG_DIR/execution-results.json"
    
    # Create or update results file
    if [[ ! -f "$result_file" ]]; then
        echo '{"executions": []}' > "$result_file"
    fi
    
    local execution_record=$(jq -n \
        --arg execution_id "$EXECUTION_ID" \
        --arg test_name "$TEST_NAME" \
        --arg status "$status" \
        --arg start_time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --arg duration "$duration" \
        --arg error_details "$error_details" \
        '{
            execution_id: $execution_id,
            test_name: $test_name,
            status: $status,
            start_time: $start_time,
            duration: $duration | tonumber,
            error_details: $error_details,
            log_file: "'"$LOG_FILE"'"
        }')
    
    jq --argjson execution "$execution_record" '.executions += [$execution] | .executions = (.executions | sort_by(.start_time) | .[-100:])' "$result_file" > "$result_file.tmp"
    mv "$result_file.tmp" "$result_file"
    
    log "Execution result recorded"
}

# Send notifications
send_notification() {
    local status="$1"
    local duration="$2"
    local error_details="${3:-}"
    
    local config=$(get_test_config)
    local notification_config=$(echo "$config" | jq -r '.notification')
    
    # Check if notification should be sent
    local should_notify=false
    case "$status" in
        "SUCCESS")
            if echo "$notification_config" | jq -e '.on_success' >/dev/null && [[ "$(echo "$notification_config" | jq -r '.on_success')" == "true" ]]; then
                should_notify=true
            fi
            ;;
        "FAILED")
            if echo "$notification_config" | jq -e '.on_failure' >/dev/null && [[ "$(echo "$notification_config" | jq -r '.on_failure')" == "true" ]]; then
                should_notify=true
            fi
            ;;
        "WARNING")
            if echo "$notification_config" | jq -e '.on_warning' >/dev/null && [[ "$(echo "$notification_config" | jq -r '.on_warning')" == "true" ]]; then
                should_notify=true
            fi
            ;;
    esac
    
    if [[ "$should_notify" == "false" ]]; then
        log "Notification not configured for status: $status"
        return 0
    fi
    
    # Check notification cooldown
    local cooldown_file="$LOG_DIR/notification-cooldown-$TEST_NAME"
    local cooldown_minutes=$(jq -r '.global_settings.notification_cooldown_minutes // 60' "$SCHEDULE_CONFIG" 2>/dev/null || echo "60")
    
    if [[ -f "$cooldown_file" ]]; then
        local last_notification=$(cat "$cooldown_file")
        local current_time=$(date +%s)
        local time_diff=$(( (current_time - last_notification) / 60 ))
        
        if [[ $time_diff -lt $cooldown_minutes ]]; then
            log "Notification cooldown active (${time_diff}/${cooldown_minutes} minutes)"
            return 0
        fi
    fi
    
    # Send notifications
    local status_emoji="✅"
    local message_prefix="Test Completed"
    
    case "$status" in
        "FAILED")
            status_emoji="❌"
            message_prefix="Test Failed"
            ;;
        "WARNING")
            status_emoji="⚠️"
            message_prefix="Test Warning"
            ;;
    esac
    
    # Slack notification
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local message="$status_emoji $message_prefix\\n\\n**Test:** $TEST_NAME\\n**Status:** $status\\n**Duration:** ${duration}s\\n**Execution ID:** $EXECUTION_ID"
        
        if [[ -n "$error_details" ]]; then
            message="$message\\n**Error:** $error_details"
        fi
        
        if curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\"}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null; then
            log "Slack notification sent"
        else
            log_warning "Failed to send Slack notification"
        fi
    fi
    
    # Email notification for failures
    if [[ "$status" == "FAILED" ]] && [[ -n "${EMAIL_RECIPIENTS:-}" ]]; then
        local subject="Backup Test Failed: $TEST_NAME"
        local body="Scheduled backup test failed.\n\nTest: $TEST_NAME\nExecution ID: $EXECUTION_ID\nDuration: ${duration}s\nError: $error_details\n\nLog file: $LOG_FILE"
        
        if echo -e "$body" | mail -s "$subject" "$EMAIL_RECIPIENTS" 2>/dev/null; then
            log "Email notification sent"
        else
            log_warning "Failed to send email notification"
        fi
    fi
    
    # Update cooldown timer
    date +%s > "$cooldown_file"
}

# Check system health before execution
check_system_health() {
    log "Checking system health before test execution..."
    
    # Check disk space
    local backup_usage=$(df "$LOG_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
    if [[ $backup_usage -gt 95 ]]; then
        log_error "Critical disk space: ${backup_usage}% used"
        exit 1
    elif [[ $backup_usage -gt 85 ]]; then
        log_warning "High disk space usage: ${backup_usage}%"
    fi
    
    # Check load average (if available)
    if command -v uptime >/dev/null; then
        local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
        local cpu_count=$(nproc 2>/dev/null || echo "1")
        local load_ratio=$(echo "scale=2; $load_avg / $cpu_count" | bc -l 2>/dev/null || echo "0")
        
        if (( $(echo "$load_ratio > 3.0" | bc -l 2>/dev/null || echo "0") )); then
            log_warning "High system load: $load_avg (ratio: $load_ratio)"
        fi
    fi
    
    # Check available memory (if /proc/meminfo exists)
    if [[ -f "/proc/meminfo" ]]; then
        local mem_available=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
        local mem_total=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        local mem_usage_percent=$(echo "scale=0; (($mem_total - $mem_available) * 100) / $mem_total" | bc -l)
        
        if [[ $mem_usage_percent -gt 90 ]]; then
            log_warning "High memory usage: ${mem_usage_percent}%"
        fi
    fi
    
    log "System health check completed"
}

# Main execution
main() {
    log "Starting scheduled test execution: $TEST_NAME"
    
    # Acquire execution lock
    acquire_lock
    
    # Get test configuration
    local config=$(get_test_config)
    
    # Check if test is enabled
    local enabled=$(echo "$config" | jq -r '.enabled // true')
    if [[ "$enabled" != "true" ]]; then
        log_warning "Test is disabled: $TEST_NAME"
        exit 0
    fi
    
    # Set up environment
    set_environment "$config"
    
    # Check system health
    check_system_health
    
    # Execute the test
    execute_test "$config"
    
    log_success "Scheduled test execution completed: $TEST_NAME"
}

# Run main function
main "$@"