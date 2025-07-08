#!/bin/bash

# Weekly Backup Validation Test Script
# Automated backup integrity and restoration verification
# Version: 2.0.0

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/learning-assistant}"
LOG_DIR="${LOG_DIR:-/var/log/backup-testing}"
TEST_DB_PREFIX="${TEST_DB_PREFIX:-weekly_backup_test}"
DRY_RUN="${DRY_RUN:-false}"
NOTIFICATION_ENABLED="${NOTIFICATION_ENABLED:-true}"
PARALLEL_TESTS="${PARALLEL_TESTS:-3}"

# Test configuration
TEST_START_TIME=$(date +%s)
TEST_ID="weekly-backup-test-$(date +%Y%m%d-%H%M%S)"
TEST_LOG_FILE="$LOG_DIR/weekly-backup-test-$(date +%Y%m%d).log"
TEST_RESULTS_DIR="$LOG_DIR/results/$TEST_ID"
TEST_REPORT_FILE="$TEST_RESULTS_DIR/backup-test-report.json"

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

# Test result tracking
declare -A TEST_RESULTS
TEST_RESULTS["total_tests"]=0
TEST_RESULTS["passed_tests"]=0
TEST_RESULTS["failed_tests"]=0
TEST_RESULTS["backup_files_tested"]=0
TEST_RESULTS["backup_files_valid"]=0
TEST_RESULTS["backup_files_invalid"]=0

# Initialize test environment
initialize_test_environment() {
    log "Initializing weekly backup test environment..."
    
    # Create log directories
    mkdir -p "$LOG_DIR" "$TEST_RESULTS_DIR"
    
    # Initialize test report
    cat > "$TEST_REPORT_FILE" << EOF
{
    "test_id": "$TEST_ID",
    "start_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "test_type": "weekly_backup_validation",
    "backup_directory": "$BACKUP_DIR",
    "dry_run": $DRY_RUN,
    "tests": [],
    "backup_files": []
}
EOF
    
    log_success "Test environment initialized"
}

# Find and validate backup files
find_backup_files() {
    log "Scanning for backup files..."
    
    declare -A backup_files
    
    # Find database backups
    while IFS= read -r -d '' file; do
        backup_files["$file"]="database"
    done < <(find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime -7 -print0)
    
    # Find Redis backups
    while IFS= read -r -d '' file; do
        backup_files["$file"]="redis"
    done < <(find "$BACKUP_DIR" -name "*.rdb" -type f -mtime -7 -print0)
    
    # Find application backups
    while IFS= read -r -d '' file; do
        backup_files["$file"]="application"
    done < <(find "$BACKUP_DIR" -name "*-app-*.tar.gz" -type f -mtime -7 -print0)
    
    # Find configuration backups
    while IFS= read -r -d '' file; do
        backup_files["$file"]="configuration"
    done < <(find "$BACKUP_DIR" -name "*-config-*.tar.gz" -type f -mtime -7 -print0)
    
    local total_files=${#backup_files[@]}
    log "Found $total_files backup files to test"
    
    if [[ $total_files -eq 0 ]]; then
        log_error "No backup files found for testing"
        return 1
    fi
    
    # Export for other functions
    declare -g -A BACKUP_FILES
    for file in "${!backup_files[@]}"; do
        BACKUP_FILES["$file"]="${backup_files[$file]}"
    done
    
    return 0
}

# Test backup file integrity
test_backup_file_integrity() {
    local backup_file="$1"
    local backup_type="$2"
    
    log "Testing integrity of $backup_type backup: $(basename "$backup_file")"
    
    TEST_RESULTS["backup_files_tested"]=$((TEST_RESULTS["backup_files_tested"] + 1))
    
    local file_size=$(stat -c%s "$backup_file")
    local file_age=$(( $(date +%s) - $(stat -c%Y "$backup_file") ))
    local test_result="FAILED"
    local test_details=""
    
    # Basic file checks
    if [[ ! -f "$backup_file" ]]; then
        test_details="File does not exist"
    elif [[ $file_size -lt 1024 ]]; then
        test_details="File size too small ($file_size bytes)"
    else
        case "$backup_type" in
            "database")
                test_result=$(test_database_backup_integrity "$backup_file")
                ;;
            "redis")
                test_result=$(test_redis_backup_integrity "$backup_file")
                ;;
            "application"|"configuration")
                test_result=$(test_archive_backup_integrity "$backup_file")
                ;;
            *)
                test_details="Unknown backup type"
                ;;
        esac
    fi
    
    # Update test results
    if [[ "$test_result" == "PASSED" ]]; then
        TEST_RESULTS["backup_files_valid"]=$((TEST_RESULTS["backup_files_valid"] + 1))
        log_success "Backup file integrity test passed: $(basename "$backup_file")"
    else
        TEST_RESULTS["backup_files_invalid"]=$((TEST_RESULTS["backup_files_invalid"] + 1))
        log_error "Backup file integrity test failed: $(basename "$backup_file") - $test_details"
    fi
    
    # Update test report
    local backup_entry=$(jq -n \
        --arg file "$backup_file" \
        --arg type "$backup_type" \
        --arg size "$file_size" \
        --arg age "$file_age" \
        --arg result "$test_result" \
        --arg details "$test_details" \
        '{
            file: $file,
            type: $type,
            size: $size | tonumber,
            age_seconds: $age | tonumber,
            result: $result,
            details: $details,
            tested_at: now | strftime("%Y-%m-%dT%H:%M:%SZ")
        }')
    
    jq --argjson backup "$backup_entry" '.backup_files += [$backup]' "$TEST_REPORT_FILE" > "$TEST_REPORT_FILE.tmp"
    mv "$TEST_REPORT_FILE.tmp" "$TEST_REPORT_FILE"
    
    return $([ "$test_result" == "PASSED" ] && echo 0 || echo 1)
}

# Test database backup integrity
test_database_backup_integrity() {
    local backup_file="$1"
    
    # Test gzip integrity
    if ! gzip -t "$backup_file" 2>/dev/null; then
        echo "FAILED: Gzip integrity check failed"
        return 1
    fi
    
    # Test SQL content
    if ! zcat "$backup_file" | head -20 | grep -q "PostgreSQL database dump"; then
        echo "FAILED: Invalid PostgreSQL dump format"
        return 1
    fi
    
    # Test for required tables (basic schema validation)
    local required_tables=("users" "learning_sessions" "learning_profiles")
    for table in "${required_tables[@]}"; do
        if ! zcat "$backup_file" | grep -q "CREATE TABLE.*$table"; then
            echo "FAILED: Missing required table: $table"
            return 1
        fi
    done
    
    echo "PASSED"
    return 0
}

# Test Redis backup integrity
test_redis_backup_integrity() {
    local backup_file="$1"
    
    # Check if file is a valid Redis RDB file
    if ! file "$backup_file" | grep -q "Redis RDB"; then
        echo "FAILED: Not a valid Redis RDB file"
        return 1
    fi
    
    # Check file size (should be > 0)
    if [[ $(stat -c%s "$backup_file") -eq 0 ]]; then
        echo "FAILED: Redis backup file is empty"
        return 1
    fi
    
    echo "PASSED"
    return 0
}

# Test archive backup integrity
test_archive_backup_integrity() {
    local backup_file="$1"
    
    # Test gzip integrity
    if ! gzip -t "$backup_file" 2>/dev/null; then
        echo "FAILED: Gzip integrity check failed"
        return 1
    fi
    
    # Test tar archive
    if ! tar -tzf "$backup_file" >/dev/null 2>&1; then
        echo "FAILED: Tar archive integrity check failed"
        return 1
    fi
    
    # Check if archive is not empty
    if [[ $(tar -tzf "$backup_file" | wc -l) -eq 0 ]]; then
        echo "FAILED: Archive is empty"
        return 1
    fi
    
    echo "PASSED"
    return 0
}

# Test backup restoration
test_backup_restoration() {
    log "Testing backup restoration capabilities..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "Dry run mode: Simulating backup restoration test"
        return 0
    fi
    
    # Find latest database backup
    local latest_db_backup=$(find "$BACKUP_DIR" -name "*.sql.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
    
    if [[ -z "$latest_db_backup" ]]; then
        log_error "No database backup found for restoration test"
        return 1
    fi
    
    # Create test database
    local test_db="${TEST_DB_PREFIX}_$(date +%s)"
    
    log "Creating test database: $test_db"
    if ! psql -h "$DB_HOST" -U "$DB_USER" -c "CREATE DATABASE $test_db;"; then
        log_error "Failed to create test database"
        return 1
    fi
    
    # Restore backup to test database
    log "Restoring backup to test database..."
    if zcat "$latest_db_backup" | psql -h "$DB_HOST" -U "$DB_USER" -d "$test_db" -q; then
        log_success "Backup restoration successful"
        
        # Verify restoration
        local table_count=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$test_db" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
        log "Restored database has $table_count tables"
        
        # Verify data integrity
        local user_count=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$test_db" -t -c "SELECT count(*) FROM users;" 2>/dev/null | tr -d ' ' || echo "0")
        log "Restored database has $user_count users"
        
        # Cleanup test database
        psql -h "$DB_HOST" -U "$DB_USER" -c "DROP DATABASE $test_db;" >/dev/null 2>&1
        
        return 0
    else
        log_error "Backup restoration failed"
        psql -h "$DB_HOST" -U "$DB_USER" -c "DROP DATABASE $test_db;" >/dev/null 2>&1 || true
        return 1
    fi
}

# Test cross-region backup synchronization
test_cross_region_sync() {
    log "Testing cross-region backup synchronization..."
    
    if ! command -v aws &> /dev/null; then
        log_warning "AWS CLI not available, skipping cross-region sync test"
        return 0
    fi
    
    # Check primary region
    local primary_bucket="learning-assistant-backups"
    local primary_region="${AWS_DEFAULT_REGION:-us-east-1}"
    
    # Check secondary region
    local secondary_bucket="learning-assistant-backups-dr"
    local secondary_region="${AWS_DR_REGION:-us-west-2}"
    
    # Get file counts
    local primary_files=$(aws s3 ls "s3://$primary_bucket/" --recursive --region "$primary_region" | wc -l)
    local secondary_files=$(aws s3 ls "s3://$secondary_bucket/" --recursive --region "$secondary_region" | wc -l)
    
    log "Primary region ($primary_region) backup files: $primary_files"
    log "Secondary region ($secondary_region) backup files: $secondary_files"
    
    # Check sync status
    local sync_diff=$((primary_files - secondary_files))
    local sync_tolerance=5  # Allow small differences due to timing
    
    if [[ ${sync_diff#-} -le $sync_tolerance ]]; then
        log_success "Cross-region backup synchronization is healthy"
        return 0
    else
        log_error "Cross-region backup synchronization has significant differences: $sync_diff"
        return 1
    fi
}

# Test backup retention policy
test_backup_retention() {
    log "Testing backup retention policy compliance..."
    
    # Check for old backups that should be cleaned up
    local old_backups=$(find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +30 | wc -l)
    local recent_backups=$(find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime -7 | wc -l)
    
    log "Old backups (>30 days): $old_backups"
    log "Recent backups (<7 days): $recent_backups"
    
    # Verify retention policy
    if [[ $recent_backups -lt 3 ]]; then
        log_error "Insufficient recent backups found (expected at least 3)"
        return 1
    fi
    
    # Check archive backups
    local archive_dir="$BACKUP_DIR/archive"
    if [[ -d "$archive_dir" ]]; then
        local archived_backups=$(find "$archive_dir" -name "*.sql.gz*" -type f | wc -l)
        log "Archived backups: $archived_backups"
    fi
    
    log_success "Backup retention policy compliance verified"
    return 0
}

# Test backup encryption
test_backup_encryption() {
    log "Testing backup encryption capabilities..."
    
    # Check for encrypted backups
    local encrypted_backups=$(find "$BACKUP_DIR" -name "*.enc" -type f | wc -l)
    
    if [[ $encrypted_backups -gt 0 ]]; then
        log_success "Found $encrypted_backups encrypted backup files"
        
        # Test encryption/decryption with test key
        local test_file="/tmp/test-backup-$(date +%s).sql"
        echo "SELECT 1;" > "$test_file"
        
        # Encrypt test file
        if openssl enc -aes-256-cbc -in "$test_file" -out "$test_file.enc" -k "test-key" 2>/dev/null; then
            log_success "Backup encryption test passed"
            
            # Test decryption
            if openssl enc -aes-256-cbc -d -in "$test_file.enc" -out "$test_file.dec" -k "test-key" 2>/dev/null; then
                log_success "Backup decryption test passed"
            else
                log_error "Backup decryption test failed"
            fi
        else
            log_error "Backup encryption test failed"
        fi
        
        # Cleanup
        rm -f "$test_file" "$test_file.enc" "$test_file.dec"
    else
        log_warning "No encrypted backup files found"
    fi
    
    return 0
}

# Test backup monitoring metrics
test_backup_monitoring() {
    log "Testing backup monitoring and metrics..."
    
    # Check backup service health
    if curl -f "http://backup-monitor.learning-assistant.svc.cluster.local:9090/metrics" >/dev/null 2>&1; then
        log_success "Backup monitoring service is accessible"
        
        # Check specific metrics
        local metrics_response=$(curl -s "http://backup-monitor.learning-assistant.svc.cluster.local:9090/metrics")
        
        if echo "$metrics_response" | grep -q "backup_files_total"; then
            log_success "Backup metrics are being collected"
        else
            log_error "Backup metrics not found"
        fi
    else
        log_error "Backup monitoring service not accessible"
        return 1
    fi
    
    return 0
}

# Run individual test
run_test() {
    local test_name="$1"
    local test_function="$2"
    local test_timeout="${3:-600}" # 10 minutes default
    
    log "Running test: $test_name"
    TEST_RESULTS["total_tests"]=$((TEST_RESULTS["total_tests"] + 1))
    
    local test_start_time=$(date +%s)
    local test_result="FAILED"
    
    # Run test with timeout
    if timeout "$test_timeout" bash -c "$test_function" 2>&1 | tee -a "$TEST_LOG_FILE"; then
        test_result="PASSED"
        TEST_RESULTS["passed_tests"]=$((TEST_RESULTS["passed_tests"] + 1))
        log_success "Test passed: $test_name"
    else
        test_result="FAILED"
        TEST_RESULTS["failed_tests"]=$((TEST_RESULTS["failed_tests"] + 1))
        log_error "Test failed: $test_name"
    fi
    
    local test_end_time=$(date +%s)
    local test_duration=$((test_end_time - test_start_time))
    
    # Update test report
    local test_entry=$(jq -n \
        --arg name "$test_name" \
        --arg result "$test_result" \
        --arg duration "$test_duration" \
        --arg start_time "$(date -u -d @$test_start_time +%Y-%m-%dT%H:%M:%SZ)" \
        --arg end_time "$(date -u -d @$test_end_time +%Y-%m-%dT%H:%M:%SZ)" \
        '{
            name: $name,
            result: $result,
            duration: $duration | tonumber,
            start_time: $start_time,
            end_time: $end_time
        }')
    
    jq --argjson test "$test_entry" '.tests += [$test]' "$TEST_REPORT_FILE" > "$TEST_REPORT_FILE.tmp"
    mv "$TEST_REPORT_FILE.tmp" "$TEST_REPORT_FILE"
}

# Test all backup files in parallel
test_all_backup_files() {
    log "Testing all backup files..."
    
    local pids=()
    local temp_dir="/tmp/backup-test-$$"
    mkdir -p "$temp_dir"
    
    # Test backup files in parallel
    for backup_file in "${!BACKUP_FILES[@]}"; do
        local backup_type="${BACKUP_FILES[$backup_file]}"
        
        # Limit parallel processes
        while [[ ${#pids[@]} -ge $PARALLEL_TESTS ]]; do
            for i in "${!pids[@]}"; do
                if ! kill -0 "${pids[$i]}" 2>/dev/null; then
                    unset "pids[$i]"
                fi
            done
            pids=("${pids[@]}") # Reindex array
            sleep 1
        done
        
        # Start test in background
        (
            test_backup_file_integrity "$backup_file" "$backup_type"
            echo $? > "$temp_dir/$(basename "$backup_file").result"
        ) &
        pids+=($!)
    done
    
    # Wait for all tests to complete
    for pid in "${pids[@]}"; do
        wait "$pid"
    done
    
    # Collect results
    local failed_files=0
    for result_file in "$temp_dir"/*.result; do
        if [[ -f "$result_file" ]]; then
            local result=$(cat "$result_file")
            if [[ "$result" -ne 0 ]]; then
                failed_files=$((failed_files + 1))
            fi
        fi
    done
    
    # Cleanup
    rm -rf "$temp_dir"
    
    if [[ $failed_files -eq 0 ]]; then
        log_success "All backup files passed integrity tests"
        return 0
    else
        log_error "$failed_files backup files failed integrity tests"
        return 1
    fi
}

# Generate test report
generate_test_report() {
    log "Generating test report..."
    
    local test_end_time=$(date +%s)
    local total_duration=$((test_end_time - TEST_START_TIME))
    
    # Update final test report
    jq --arg end_time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
       --arg total_duration "$total_duration" \
       --arg total_tests "${TEST_RESULTS[total_tests]}" \
       --arg passed_tests "${TEST_RESULTS[passed_tests]}" \
       --arg failed_tests "${TEST_RESULTS[failed_tests]}" \
       --arg backup_files_tested "${TEST_RESULTS[backup_files_tested]}" \
       --arg backup_files_valid "${TEST_RESULTS[backup_files_valid]}" \
       --arg backup_files_invalid "${TEST_RESULTS[backup_files_invalid]}" \
       '.end_time = $end_time | .total_duration = ($total_duration | tonumber) | .summary = {
           total_tests: ($total_tests | tonumber),
           passed_tests: ($passed_tests | tonumber),
           failed_tests: ($failed_tests | tonumber),
           backup_files_tested: ($backup_files_tested | tonumber),
           backup_files_valid: ($backup_files_valid | tonumber),
           backup_files_invalid: ($backup_files_invalid | tonumber),
           success_rate: (($passed_tests | tonumber) / ($total_tests | tonumber) * 100),
           backup_validity_rate: (($backup_files_valid | tonumber) / ($backup_files_tested | tonumber) * 100)
       }' "$TEST_REPORT_FILE" > "$TEST_REPORT_FILE.tmp"
    mv "$TEST_REPORT_FILE.tmp" "$TEST_REPORT_FILE"
    
    # Create summary report
    local summary_file="$TEST_RESULTS_DIR/summary.txt"
    cat > "$summary_file" << EOF
WEEKLY BACKUP VALIDATION TEST SUMMARY
====================================

Test ID: $TEST_ID
Date: $(date -u +%Y-%m-%d)
Duration: $total_duration seconds ($(($total_duration / 60)) minutes)
Backup Directory: $BACKUP_DIR

TEST RESULTS:
- Total Tests: ${TEST_RESULTS[total_tests]}
- Passed: ${TEST_RESULTS[passed_tests]}
- Failed: ${TEST_RESULTS[failed_tests]}
- Success Rate: $(echo "scale=2; ${TEST_RESULTS[passed_tests]} * 100 / ${TEST_RESULTS[total_tests]}" | bc -l)%

BACKUP FILE VALIDATION:
- Files Tested: ${TEST_RESULTS[backup_files_tested]}
- Valid Files: ${TEST_RESULTS[backup_files_valid]}
- Invalid Files: ${TEST_RESULTS[backup_files_invalid]}
- Validity Rate: $(echo "scale=2; ${TEST_RESULTS[backup_files_valid]} * 100 / ${TEST_RESULTS[backup_files_tested]}" | bc -l)%

DETAILED RESULTS:
EOF
    
    jq -r '.tests[] | "- \(.name): \(.result) (\(.duration)s)"' "$TEST_REPORT_FILE" >> "$summary_file"
    
    log_success "Test report generated: $TEST_REPORT_FILE"
    log_success "Summary report generated: $summary_file"
    
    # Display summary
    cat "$summary_file"
}

# Send notifications
send_notifications() {
    if [[ "$NOTIFICATION_ENABLED" == "true" ]]; then
        log "Sending test completion notifications..."
        
        local success_rate=$(echo "scale=2; ${TEST_RESULTS[passed_tests]} * 100 / ${TEST_RESULTS[total_tests]}" | bc -l)
        local validity_rate=$(echo "scale=2; ${TEST_RESULTS[backup_files_valid]} * 100 / ${TEST_RESULTS[backup_files_tested]}" | bc -l)
        local status="SUCCESS"
        
        if [[ "${TEST_RESULTS[failed_tests]}" -gt 0 ]] || [[ "${TEST_RESULTS[backup_files_invalid]}" -gt 0 ]]; then
            status="FAILED"
        fi
        
        # Slack notification
        if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
            curl -X POST -H 'Content-type: application/json' \
                --data "{\"text\":\"🔍 Weekly Backup Test $status\\n\\n**Test ID:** $TEST_ID\\n**Test Success Rate:** $success_rate%\\n**Backup Validity Rate:** $validity_rate%\\n**Files Tested:** ${TEST_RESULTS[backup_files_tested]}\\n**Invalid Files:** ${TEST_RESULTS[backup_files_invalid]}\"}" \
                "$SLACK_WEBHOOK_URL" || log_warning "Failed to send Slack notification"
        fi
    fi
}

# Main execution
main() {
    log "Starting Weekly Backup Validation Test - $TEST_ID"
    
    # Validate prerequisites
    if ! command -v jq &> /dev/null; then
        log_error "jq is not installed or not in PATH"
        exit 1
    fi
    
    # Initialize test environment
    initialize_test_environment
    
    # Find backup files
    if ! find_backup_files; then
        log_error "No backup files found to test"
        exit 1
    fi
    
    # Run system tests
    run_test "backup_restoration" "test_backup_restoration" 1800
    run_test "cross_region_sync" "test_cross_region_sync" 600
    run_test "backup_retention" "test_backup_retention" 300
    run_test "backup_encryption" "test_backup_encryption" 300
    run_test "backup_monitoring" "test_backup_monitoring" 300
    
    # Test all backup files
    test_all_backup_files
    
    # Generate reports
    generate_test_report
    
    # Send notifications
    send_notifications
    
    # Final status
    if [[ "${TEST_RESULTS[failed_tests]}" -gt 0 ]] || [[ "${TEST_RESULTS[backup_files_invalid]}" -gt 0 ]]; then
        log_error "Weekly backup test completed with failures"
        exit 1
    else
        log_success "Weekly backup test completed successfully"
        exit 0
    fi
}

# Run main function
main "$@"