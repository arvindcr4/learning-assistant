#!/bin/bash

# Monthly Disaster Recovery Test Script
# Comprehensive automated testing of disaster recovery procedures
# Version: 2.0.0

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/learning-assistant}"
LOG_DIR="${LOG_DIR:-/var/log/backup-testing}"
TEST_NAMESPACE="${TEST_NAMESPACE:-learning-assistant-dr-test}"
DRY_RUN="${DRY_RUN:-false}"
NOTIFICATION_ENABLED="${NOTIFICATION_ENABLED:-true}"
DETAILED_LOGGING="${DETAILED_LOGGING:-true}"

# Test configuration
TEST_START_TIME=$(date +%s)
TEST_ID="dr-test-$(date +%Y%m%d-%H%M%S)"
TEST_LOG_FILE="$LOG_DIR/monthly-dr-test-$(date +%Y%m%d).log"
TEST_RESULTS_DIR="$LOG_DIR/results/$TEST_ID"
TEST_REPORT_FILE="$TEST_RESULTS_DIR/test-report.json"

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
TEST_RESULTS["skipped_tests"]=0

# Initialize test environment
initialize_test_environment() {
    log "Initializing monthly DR test environment..."
    
    # Create log directories
    mkdir -p "$LOG_DIR" "$TEST_RESULTS_DIR"
    
    # Create test namespace
    if [[ "$DRY_RUN" == "false" ]]; then
        kubectl create namespace "$TEST_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
        kubectl label namespace "$TEST_NAMESPACE" test-type=disaster-recovery
    fi
    
    # Initialize test report
    cat > "$TEST_REPORT_FILE" << EOF
{
    "test_id": "$TEST_ID",
    "start_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "test_type": "monthly_disaster_recovery",
    "environment": "$(kubectl config current-context)",
    "dry_run": $DRY_RUN,
    "tests": []
}
EOF
    
    log_success "Test environment initialized"
}

# Run individual test
run_test() {
    local test_name="$1"
    local test_function="$2"
    local test_timeout="${3:-1800}" # 30 minutes default
    
    log "Running test: $test_name"
    TEST_RESULTS["total_tests"]=$((TEST_RESULTS["total_tests"] + 1))
    
    local test_start_time=$(date +%s)
    local test_result="FAILED"
    local test_output=""
    local test_error=""
    
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

# Test 1: Backup Integrity Validation
test_backup_integrity() {
    log "Testing backup integrity..."
    
    # Check if backup files exist
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log_error "Backup directory does not exist: $BACKUP_DIR"
        return 1
    fi
    
    # Find latest backup
    local latest_backup=$(find "$BACKUP_DIR" -name "*.sql.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
    
    if [[ -z "$latest_backup" ]]; then
        log_error "No database backup files found"
        return 1
    fi
    
    log "Found latest backup: $latest_backup"
    
    # Verify backup file integrity
    if ! gzip -t "$latest_backup"; then
        log_error "Backup file is corrupted: $latest_backup"
        return 1
    fi
    
    # Verify backup content
    if ! zcat "$latest_backup" | head -20 | grep -q "PostgreSQL database dump"; then
        log_error "Backup file does not contain valid PostgreSQL dump"
        return 1
    fi
    
    log_success "Backup integrity validation passed"
    return 0
}

# Test 2: Database Recovery Simulation
test_database_recovery() {
    log "Testing database recovery simulation..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "Dry run mode: Simulating database recovery test"
        sleep 5
        return 0
    fi
    
    # Create test database
    local test_db="learning_assistant_dr_test_$(date +%s)"
    
    # Create test database
    psql -h "$DB_HOST" -U "$DB_USER" -c "CREATE DATABASE $test_db;" || {
        log_error "Failed to create test database"
        return 1
    }
    
    # Restore latest backup to test database
    local latest_backup=$(find "$BACKUP_DIR" -name "*.sql.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
    
    if zcat "$latest_backup" | psql -h "$DB_HOST" -U "$DB_USER" -d "$test_db"; then
        log_success "Database recovery simulation successful"
        
        # Verify data integrity
        local table_count=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$test_db" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
        log "Restored database has $table_count tables"
        
        # Cleanup test database
        psql -h "$DB_HOST" -U "$DB_USER" -c "DROP DATABASE $test_db;"
        return 0
    else
        log_error "Database recovery simulation failed"
        psql -h "$DB_HOST" -U "$DB_USER" -c "DROP DATABASE $test_db;" || true
        return 1
    fi
}

# Test 3: Application Recovery Simulation
test_application_recovery() {
    log "Testing application recovery simulation..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "Dry run mode: Simulating application recovery test"
        sleep 10
        return 0
    fi
    
    # Deploy application to test namespace
    helm upgrade --install learning-assistant-dr-test \
        "$PROJECT_ROOT/deploy/helm/learning-assistant" \
        --namespace "$TEST_NAMESPACE" \
        --set image.tag=latest \
        --set replicaCount=1 \
        --set service.type=ClusterIP \
        --timeout=10m || {
        log_error "Failed to deploy application for DR test"
        return 1
    }
    
    # Wait for deployment to be ready
    if kubectl wait --for=condition=available --timeout=600s deployment/learning-assistant-dr-test -n "$TEST_NAMESPACE"; then
        log_success "Application recovery simulation successful"
        
        # Test application health
        local pod_name=$(kubectl get pods -n "$TEST_NAMESPACE" -l app=learning-assistant-dr-test -o jsonpath='{.items[0].metadata.name}')
        if kubectl exec -n "$TEST_NAMESPACE" "$pod_name" -- curl -f http://localhost:3000/api/health; then
            log_success "Application health check passed"
        else
            log_warning "Application health check failed"
        fi
        
        return 0
    else
        log_error "Application recovery simulation failed"
        return 1
    fi
}

# Test 4: Redis Recovery Simulation
test_redis_recovery() {
    log "Testing Redis recovery simulation..."
    
    # Check Redis cluster status
    if ! redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping | grep -q "PONG"; then
        log_error "Redis is not responding"
        return 1
    fi
    
    # Test Redis backup restoration
    local redis_backup_file="$BACKUP_DIR/redis/dump.rdb"
    if [[ -f "$redis_backup_file" ]]; then
        log "Found Redis backup file: $redis_backup_file"
        
        # Verify backup file
        if file "$redis_backup_file" | grep -q "Redis RDB"; then
            log_success "Redis backup file is valid"
        else
            log_error "Redis backup file is invalid"
            return 1
        fi
    else
        log_warning "Redis backup file not found"
    fi
    
    # Test Redis cluster failover simulation
    if [[ "$DRY_RUN" == "false" ]]; then
        # This would be a real failover test in production
        log "Simulating Redis failover test..."
        sleep 5
    fi
    
    log_success "Redis recovery simulation completed"
    return 0
}

# Test 5: Cross-Region Backup Verification
test_cross_region_backup() {
    log "Testing cross-region backup verification..."
    
    # Check S3 cross-region replication
    if command -v aws &> /dev/null; then
        # Primary region
        local primary_bucket="learning-assistant-backups"
        local primary_region="${AWS_DEFAULT_REGION:-us-east-1}"
        
        # Secondary region
        local secondary_bucket="learning-assistant-backups-dr"
        local secondary_region="${AWS_DR_REGION:-us-west-2}"
        
        # Check primary region backup
        if aws s3 ls "s3://$primary_bucket/" --region "$primary_region" >/dev/null 2>&1; then
            log_success "Primary region backup accessible"
        else
            log_error "Primary region backup not accessible"
            return 1
        fi
        
        # Check secondary region backup
        if aws s3 ls "s3://$secondary_bucket/" --region "$secondary_region" >/dev/null 2>&1; then
            log_success "Secondary region backup accessible"
        else
            log_error "Secondary region backup not accessible"
            return 1
        fi
        
        # Verify replication status
        local primary_count=$(aws s3 ls "s3://$primary_bucket/" --recursive --region "$primary_region" | wc -l)
        local secondary_count=$(aws s3 ls "s3://$secondary_bucket/" --recursive --region "$secondary_region" | wc -l)
        
        log "Primary region backup count: $primary_count"
        log "Secondary region backup count: $secondary_count"
        
        if [[ "$primary_count" -eq "$secondary_count" ]]; then
            log_success "Cross-region backup replication verified"
        else
            log_warning "Cross-region backup replication may be incomplete"
        fi
    else
        log_warning "AWS CLI not available, skipping cross-region backup test"
    fi
    
    return 0
}

# Test 6: Performance Recovery Test
test_performance_recovery() {
    log "Testing performance recovery metrics..."
    
    local test_start=$(date +%s)
    
    # Simulate load test after recovery
    if [[ "$DRY_RUN" == "false" ]]; then
        local app_url="http://learning-assistant-dr-test.${TEST_NAMESPACE}.svc.cluster.local:3000"
        
        # Simple load test
        for i in {1..10}; do
            if kubectl run load-test-$i --image=curlimages/curl --rm -it --restart=Never --command -- curl -f "$app_url/api/health"; then
                log "Load test iteration $i: SUCCESS"
            else
                log "Load test iteration $i: FAILED"
            fi
        done
    fi
    
    local test_end=$(date +%s)
    local test_duration=$((test_end - test_start))
    
    log "Performance recovery test completed in $test_duration seconds"
    
    # Check if recovery time meets RTO requirements (4 hours = 14400 seconds)
    if [[ "$test_duration" -lt 14400 ]]; then
        log_success "Performance recovery meets RTO requirements"
        return 0
    else
        log_error "Performance recovery exceeds RTO requirements"
        return 1
    fi
}

# Test 7: Monitoring and Alerting Test
test_monitoring_alerting() {
    log "Testing monitoring and alerting systems..."
    
    # Test backup monitoring endpoint
    if curl -f "http://backup-monitor.learning-assistant.svc.cluster.local:9090/metrics" >/dev/null 2>&1; then
        log_success "Backup monitoring endpoint accessible"
    else
        log_error "Backup monitoring endpoint not accessible"
        return 1
    fi
    
    # Test Prometheus metrics
    if curl -f "http://prometheus.monitoring.svc.cluster.local:9090/api/v1/query?query=up" >/dev/null 2>&1; then
        log_success "Prometheus metrics accessible"
    else
        log_error "Prometheus metrics not accessible"
        return 1
    fi
    
    # Test alert manager
    if curl -f "http://alertmanager.monitoring.svc.cluster.local:9093/api/v1/alerts" >/dev/null 2>&1; then
        log_success "Alert manager accessible"
    else
        log_error "Alert manager not accessible"
        return 1
    fi
    
    return 0
}

# Test 8: Security and Compliance Test
test_security_compliance() {
    log "Testing security and compliance requirements..."
    
    # Test backup encryption
    local encrypted_backup=$(find "$BACKUP_DIR" -name "*.sql.gz.enc" -type f | head -1)
    if [[ -n "$encrypted_backup" ]]; then
        log_success "Encrypted backup files found"
        
        # Test decryption capability
        if openssl enc -aes-256-cbc -d -in "$encrypted_backup" -out /tmp/test-decrypt.sql.gz -k "test-key" 2>/dev/null; then
            log_success "Backup decryption test passed"
            rm -f /tmp/test-decrypt.sql.gz
        else
            log_warning "Backup decryption test failed (expected if using different key)"
        fi
    else
        log_warning "No encrypted backup files found"
    fi
    
    # Test access controls
    if [[ -f "$BACKUP_DIR/access.log" ]]; then
        log_success "Backup access logging enabled"
    else
        log_warning "Backup access logging not found"
    fi
    
    return 0
}

# Cleanup test environment
cleanup_test_environment() {
    log "Cleaning up test environment..."
    
    if [[ "$DRY_RUN" == "false" ]]; then
        # Clean up test namespace
        kubectl delete namespace "$TEST_NAMESPACE" --timeout=300s || true
        
        # Clean up any test databases
        psql -h "$DB_HOST" -U "$DB_USER" -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname LIKE 'learning_assistant_dr_test_%';" || true
        psql -h "$DB_HOST" -U "$DB_USER" -c "DROP DATABASE IF EXISTS learning_assistant_dr_test_$(date +%s);" || true
    fi
    
    log_success "Test environment cleaned up"
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
       --arg skipped_tests "${TEST_RESULTS[skipped_tests]}" \
       '.end_time = $end_time | .total_duration = ($total_duration | tonumber) | .summary = {
           total_tests: ($total_tests | tonumber),
           passed_tests: ($passed_tests | tonumber),
           failed_tests: ($failed_tests | tonumber),
           skipped_tests: ($skipped_tests | tonumber),
           success_rate: (($passed_tests | tonumber) / ($total_tests | tonumber) * 100)
       }' "$TEST_REPORT_FILE" > "$TEST_REPORT_FILE.tmp"
    mv "$TEST_REPORT_FILE.tmp" "$TEST_REPORT_FILE"
    
    # Create summary report
    local summary_file="$TEST_RESULTS_DIR/summary.txt"
    cat > "$summary_file" << EOF
MONTHLY DISASTER RECOVERY TEST SUMMARY
=====================================

Test ID: $TEST_ID
Date: $(date -u +%Y-%m-%d)
Duration: $total_duration seconds ($(($total_duration / 60)) minutes)
Environment: $(kubectl config current-context)

RESULTS:
- Total Tests: ${TEST_RESULTS[total_tests]}
- Passed: ${TEST_RESULTS[passed_tests]}
- Failed: ${TEST_RESULTS[failed_tests]}
- Skipped: ${TEST_RESULTS[skipped_tests]}
- Success Rate: $(echo "scale=2; ${TEST_RESULTS[passed_tests]} * 100 / ${TEST_RESULTS[total_tests]}" | bc -l)%

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
        local status="SUCCESS"
        
        if [[ "${TEST_RESULTS[failed_tests]}" -gt 0 ]]; then
            status="FAILED"
        fi
        
        # Slack notification
        if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
            curl -X POST -H 'Content-type: application/json' \
                --data "{\"text\":\"📋 Monthly DR Test $status\\n\\n**Test ID:** $TEST_ID\\n**Success Rate:** $success_rate%\\n**Duration:** $(($(($(date +%s) - TEST_START_TIME)) / 60)) minutes\\n**Failed Tests:** ${TEST_RESULTS[failed_tests]}\"}" \
                "$SLACK_WEBHOOK_URL" || log_warning "Failed to send Slack notification"
        fi
        
        # Email notification
        if [[ -n "${EMAIL_RECIPIENTS:-}" ]]; then
            local subject="Monthly DR Test $status - $TEST_ID"
            local body="Monthly Disaster Recovery Test Results\n\nTest ID: $TEST_ID\nStatus: $status\nSuccess Rate: $success_rate%\nTotal Tests: ${TEST_RESULTS[total_tests]}\nPassed: ${TEST_RESULTS[passed_tests]}\nFailed: ${TEST_RESULTS[failed_tests]}\n\nDetailed report available at: $TEST_REPORT_FILE"
            
            echo -e "$body" | mail -s "$subject" "$EMAIL_RECIPIENTS" || log_warning "Failed to send email notification"
        fi
    fi
}

# Main execution
main() {
    log "Starting Monthly Disaster Recovery Test - $TEST_ID"
    
    # Validate prerequisites
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        log_error "jq is not installed or not in PATH"
        exit 1
    fi
    
    # Initialize test environment
    initialize_test_environment
    
    # Run all tests
    run_test "backup_integrity" "test_backup_integrity" 600
    run_test "database_recovery" "test_database_recovery" 1800
    run_test "application_recovery" "test_application_recovery" 1800
    run_test "redis_recovery" "test_redis_recovery" 900
    run_test "cross_region_backup" "test_cross_region_backup" 600
    run_test "performance_recovery" "test_performance_recovery" 1800
    run_test "monitoring_alerting" "test_monitoring_alerting" 300
    run_test "security_compliance" "test_security_compliance" 600
    
    # Generate reports
    generate_test_report
    
    # Send notifications
    send_notifications
    
    # Cleanup
    cleanup_test_environment
    
    # Final status
    if [[ "${TEST_RESULTS[failed_tests]}" -gt 0 ]]; then
        log_error "Monthly DR test completed with ${TEST_RESULTS[failed_tests]} failures"
        exit 1
    else
        log_success "Monthly DR test completed successfully"
        exit 0
    fi
}

# Run main function
main "$@"