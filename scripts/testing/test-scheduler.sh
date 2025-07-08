#!/bin/bash

# Automated Test Scheduler
# Manages and schedules all backup and disaster recovery tests
# Version: 2.0.0

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="${LOG_DIR:-/var/log/backup-testing}"
SCHEDULE_CONFIG="${SCHEDULE_CONFIG:-$SCRIPT_DIR/test-schedule.json}"
DRY_RUN="${DRY_RUN:-false}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS: $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

# Create default test schedule configuration
create_default_schedule() {
    log "Creating default test schedule configuration..."
    
    cat > "$SCHEDULE_CONFIG" << 'EOF'
{
  "schedules": [
    {
      "name": "daily_health_check",
      "description": "Daily system health and backup status check",
      "script": "daily-health-check.sh",
      "cron": "0 6 * * *",
      "timezone": "UTC",
      "enabled": true,
      "timeout": 900,
      "retry_count": 2,
      "retry_delay": 300,
      "notification": {
        "on_success": false,
        "on_failure": true,
        "on_warning": true
      }
    },
    {
      "name": "weekly_backup_validation",
      "description": "Weekly comprehensive backup integrity validation",
      "script": "weekly-backup-test.sh",
      "cron": "0 3 * * 0",
      "timezone": "UTC",
      "enabled": true,
      "timeout": 3600,
      "retry_count": 1,
      "retry_delay": 600,
      "notification": {
        "on_success": true,
        "on_failure": true,
        "on_warning": true
      }
    },
    {
      "name": "monthly_disaster_recovery",
      "description": "Monthly full disaster recovery test",
      "script": "monthly-dr-test.sh",
      "cron": "0 2 1 * *",
      "timezone": "UTC",
      "enabled": true,
      "timeout": 14400,
      "retry_count": 1,
      "retry_delay": 1800,
      "notification": {
        "on_success": true,
        "on_failure": true,
        "on_warning": true
      },
      "environment": {
        "DRY_RUN": "false",
        "NOTIFICATION_ENABLED": "true",
        "DETAILED_LOGGING": "true"
      }
    },
    {
      "name": "quarterly_compliance_audit",
      "description": "Quarterly compliance and security audit",
      "script": "compliance-audit.sh",
      "cron": "0 1 1 */3 *",
      "timezone": "UTC",
      "enabled": true,
      "timeout": 7200,
      "retry_count": 0,
      "retry_delay": 0,
      "notification": {
        "on_success": true,
        "on_failure": true,
        "on_warning": true
      }
    }
  ],
  "global_settings": {
    "max_concurrent_tests": 2,
    "log_retention_days": 90,
    "notification_cooldown_minutes": 60,
    "default_timeout": 1800,
    "enable_monitoring": true
  }
}
EOF
    
    log_success "Default test schedule configuration created: $SCHEDULE_CONFIG"
}

# Install cron jobs
install_cron_jobs() {
    log "Installing cron jobs for automated testing..."
    
    if [[ ! -f "$SCHEDULE_CONFIG" ]]; then
        log_error "Schedule configuration not found: $SCHEDULE_CONFIG"
        return 1
    fi
    
    # Create temporary crontab file
    local temp_crontab="/tmp/backup-test-cron-$$"
    
    # Get existing crontab (excluding our managed entries)
    (crontab -l 2>/dev/null || true) | grep -v "# BACKUP_TEST_SCHEDULER" > "$temp_crontab"
    
    # Add header comment
    echo "# BACKUP_TEST_SCHEDULER - Managed by test-scheduler.sh" >> "$temp_crontab"
    
    # Parse schedule configuration and add cron entries
    local schedules=$(jq -r '.schedules[] | select(.enabled == true) | @base64' "$SCHEDULE_CONFIG")
    
    while IFS= read -r schedule_data; do
        local schedule=$(echo "$schedule_data" | base64 --decode)
        local name=$(echo "$schedule" | jq -r '.name')
        local script=$(echo "$schedule" | jq -r '.script')
        local cron_expr=$(echo "$schedule" | jq -r '.cron')
        local timezone=$(echo "$schedule" | jq -r '.timezone // "UTC"')
        
        # Build environment variables
        local env_vars=""
        if echo "$schedule" | jq -e '.environment' >/dev/null; then
            env_vars=$(echo "$schedule" | jq -r '.environment | to_entries[] | "\(.key)=\(.value)"' | tr '\n' ' ')
        fi
        
        # Create cron entry
        local cron_entry="$cron_expr $env_vars TZ=$timezone $SCRIPT_DIR/run-scheduled-test.sh $name # BACKUP_TEST_SCHEDULER"
        echo "$cron_entry" >> "$temp_crontab"
        
        log "Added cron job for $name: $cron_expr"
    done < <(echo "$schedules")
    
    # Install new crontab
    if [[ "$DRY_RUN" == "false" ]]; then
        crontab "$temp_crontab"
        log_success "Cron jobs installed successfully"
    else
        log "Dry run mode: Cron jobs would be installed"
        log "Crontab content:"
        cat "$temp_crontab"
    fi
    
    # Cleanup
    rm -f "$temp_crontab"
}

# Remove cron jobs
remove_cron_jobs() {
    log "Removing backup test cron jobs..."
    
    # Create temporary crontab file without our entries
    local temp_crontab="/tmp/backup-test-cron-$$"
    (crontab -l 2>/dev/null || true) | grep -v "# BACKUP_TEST_SCHEDULER" > "$temp_crontab"
    
    # Install cleaned crontab
    if [[ "$DRY_RUN" == "false" ]]; then
        crontab "$temp_crontab"
        log_success "Backup test cron jobs removed"
    else
        log "Dry run mode: Cron jobs would be removed"
    fi
    
    # Cleanup
    rm -f "$temp_crontab"
}

# List scheduled tests
list_scheduled_tests() {
    log "Current backup test schedule:"
    
    if [[ ! -f "$SCHEDULE_CONFIG" ]]; then
        log_error "Schedule configuration not found: $SCHEDULE_CONFIG"
        return 1
    fi
    
    echo
    printf "%-30s %-15s %-20s %-10s\n" "TEST NAME" "SCHEDULE" "NEXT RUN" "STATUS"
    printf "%-30s %-15s %-20s %-10s\n" "----------" "--------" "--------" "------"
    
    local schedules=$(jq -r '.schedules[] | @base64' "$SCHEDULE_CONFIG")
    
    while IFS= read -r schedule_data; do
        local schedule=$(echo "$schedule_data" | base64 --decode)
        local name=$(echo "$schedule" | jq -r '.name')
        local cron_expr=$(echo "$schedule" | jq -r '.cron')
        local enabled=$(echo "$schedule" | jq -r '.enabled')
        
        # Calculate next run time (simplified)
        local next_run="N/A"
        if command -v python3 >/dev/null && [[ "$enabled" == "true" ]]; then
            next_run=$(python3 -c "
from datetime import datetime
import subprocess
try:
    # This is a simplified calculation
    print('Next scheduled')
except:
    print('N/A')
" 2>/dev/null || echo "N/A")
        fi
        
        local status="ENABLED"
        if [[ "$enabled" != "true" ]]; then
            status="DISABLED"
        fi
        
        printf "%-30s %-15s %-20s %-10s\n" "$name" "$cron_expr" "$next_run" "$status"
    done < <(echo "$schedules")
    
    echo
}

# Run specific test
run_test() {
    local test_name="$1"
    
    log "Running scheduled test: $test_name"
    
    if [[ ! -f "$SCHEDULE_CONFIG" ]]; then
        log_error "Schedule configuration not found: $SCHEDULE_CONFIG"
        return 1
    fi
    
    # Find test configuration
    local test_config=$(jq -r ".schedules[] | select(.name == \"$test_name\")" "$SCHEDULE_CONFIG")
    
    if [[ -z "$test_config" ]]; then
        log_error "Test not found in schedule: $test_name"
        return 1
    fi
    
    local script=$(echo "$test_config" | jq -r '.script')
    local timeout=$(echo "$test_config" | jq -r '.timeout // 1800')
    local retry_count=$(echo "$test_config" | jq -r '.retry_count // 1')
    local retry_delay=$(echo "$test_config" | jq -r '.retry_delay // 300')
    
    # Set environment variables
    if echo "$test_config" | jq -e '.environment' >/dev/null; then
        local env_vars=$(echo "$test_config" | jq -r '.environment | to_entries[] | "export \(.key)=\(.value)"')
        eval "$env_vars"
    fi
    
    # Run test with retries
    local attempt=1
    local max_attempts=$((retry_count + 1))
    
    while [[ $attempt -le $max_attempts ]]; do
        log "Running $test_name (attempt $attempt/$max_attempts)"
        
        if timeout "$timeout" "$SCRIPT_DIR/$script"; then
            log_success "Test completed successfully: $test_name"
            return 0
        else
            log_error "Test failed: $test_name (attempt $attempt/$max_attempts)"
            
            if [[ $attempt -lt $max_attempts ]]; then
                log "Waiting $retry_delay seconds before retry..."
                sleep "$retry_delay"
            fi
        fi
        
        attempt=$((attempt + 1))
    done
    
    log_error "Test failed after $max_attempts attempts: $test_name"
    return 1
}

# Show test status
show_test_status() {
    log "Backup testing system status:"
    
    echo
    echo "=== CRON JOBS ==="
    crontab -l 2>/dev/null | grep "BACKUP_TEST_SCHEDULER" || echo "No backup test cron jobs found"
    
    echo
    echo "=== RECENT TEST RESULTS ==="
    if [[ -d "$LOG_DIR/results" ]]; then
        local recent_tests=$(find "$LOG_DIR/results" -name "*.json" -type f -mtime -7 | sort -r | head -10)
        
        if [[ -n "$recent_tests" ]]; then
            printf "%-25s %-20s %-15s %-10s\n" "TEST ID" "TYPE" "TIMESTAMP" "STATUS"
            printf "%-25s %-20s %-15s %-10s\n" "-------" "----" "---------" "------"
            
            while IFS= read -r test_file; do
                if [[ -f "$test_file" ]]; then
                    local test_id=$(jq -r '.test_id // .check_id // "unknown"' "$test_file" 2>/dev/null || echo "unknown")
                    local test_type=$(jq -r '.test_type // .check_type // "unknown"' "$test_file" 2>/dev/null || echo "unknown")
                    local timestamp=$(jq -r '.start_time // .timestamp // "unknown"' "$test_file" 2>/dev/null || echo "unknown")
                    local status="UNKNOWN"
                    
                    # Determine status from test results
                    if jq -e '.summary.failed_tests' "$test_file" >/dev/null 2>&1; then
                        local failed=$(jq -r '.summary.failed_tests' "$test_file")
                        if [[ "$failed" == "0" ]]; then
                            status="PASSED"
                        else
                            status="FAILED"
                        fi
                    elif jq -e '.summary.overall_status' "$test_file" >/dev/null 2>&1; then
                        status=$(jq -r '.summary.overall_status' "$test_file")
                    fi
                    
                    printf "%-25s %-20s %-15s %-10s\n" "$test_id" "$test_type" "${timestamp:0:16}" "$status"
                fi
            done <<< "$recent_tests"
        else
            echo "No recent test results found"
        fi
    else
        echo "Test results directory not found: $LOG_DIR/results"
    fi
    
    echo
    echo "=== SYSTEM HEALTH ==="
    echo "Log directory: $LOG_DIR"
    echo "Schedule config: $SCHEDULE_CONFIG"
    echo "Scripts directory: $SCRIPT_DIR"
    
    # Check disk usage
    if [[ -d "$LOG_DIR" ]]; then
        local log_usage=$(du -sh "$LOG_DIR" 2>/dev/null | cut -f1 || echo "unknown")
        echo "Log directory size: $log_usage"
    fi
    
    echo
}

# Clean up old logs and results
cleanup_old_logs() {
    log "Cleaning up old test logs and results..."
    
    if [[ ! -f "$SCHEDULE_CONFIG" ]]; then
        log_warning "Schedule configuration not found, using default retention (90 days)"
        local retention_days=90
    else
        local retention_days=$(jq -r '.global_settings.log_retention_days // 90' "$SCHEDULE_CONFIG")
    fi
    
    log "Using log retention period: $retention_days days"
    
    # Clean up old log files
    if [[ -d "$LOG_DIR" ]]; then
        local deleted_files=0
        
        # Clean up daily logs
        while IFS= read -r -d '' log_file; do
            rm -f "$log_file"
            deleted_files=$((deleted_files + 1))
        done < <(find "$LOG_DIR" -name "*.log" -type f -mtime +$retention_days -print0 2>/dev/null)
        
        # Clean up old result directories
        while IFS= read -r -d '' result_dir; do
            rm -rf "$result_dir"
            deleted_files=$((deleted_files + 1))
        done < <(find "$LOG_DIR/results" -type d -mtime +$retention_days -print0 2>/dev/null)
        
        log_success "Cleaned up $deleted_files old log files and directories"
    else
        log_warning "Log directory does not exist: $LOG_DIR"
    fi
}

# Display usage information
usage() {
    cat << EOF
Usage: $0 [COMMAND] [OPTIONS]

COMMANDS:
    install         Install cron jobs for automated testing
    remove          Remove all backup test cron jobs
    list            List all scheduled tests
    run <test>      Run a specific test immediately
    status          Show testing system status
    cleanup         Clean up old logs and results
    init            Create default schedule configuration

OPTIONS:
    --dry-run       Show what would be done without making changes
    --config FILE   Use alternative schedule configuration file

EXAMPLES:
    $0 install                          # Install all scheduled tests
    $0 run daily_health_check          # Run daily health check now
    $0 list                            # Show scheduled tests
    $0 status                          # Show system status
    $0 cleanup                         # Clean up old logs
    $0 --dry-run install               # Preview cron installation

ENVIRONMENT VARIABLES:
    LOG_DIR                 Directory for test logs (default: /var/log/backup-testing)
    SCHEDULE_CONFIG         Path to schedule configuration file
    DRY_RUN                Run in preview mode (true/false)

EOF
}

# Main execution
main() {
    # Parse command line arguments
    local command=""
    local test_name=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN="true"
                shift
                ;;
            --config)
                SCHEDULE_CONFIG="$2"
                shift 2
                ;;
            install|remove|list|status|cleanup|init)
                command="$1"
                shift
                ;;
            run)
                command="run"
                test_name="$2"
                shift 2
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
    
    # Validate command
    if [[ -z "$command" ]]; then
        log_error "No command specified"
        usage
        exit 1
    fi
    
    # Create log directory
    mkdir -p "$LOG_DIR/results"
    
    # Execute command
    case "$command" in
        install)
            install_cron_jobs
            ;;
        remove)
            remove_cron_jobs
            ;;
        list)
            list_scheduled_tests
            ;;
        run)
            if [[ -z "$test_name" ]]; then
                log_error "Test name required for run command"
                exit 1
            fi
            run_test "$test_name"
            ;;
        status)
            show_test_status
            ;;
        cleanup)
            cleanup_old_logs
            ;;
        init)
            create_default_schedule
            ;;
        *)
            log_error "Unknown command: $command"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"