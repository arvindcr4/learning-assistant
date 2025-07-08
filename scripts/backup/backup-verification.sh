#!/bin/bash

# Backup Verification and Integrity Testing Script
# Learning Assistant - Comprehensive Backup Validation System
# Version: 2.0.0

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/learning-assistant}"
VERIFICATION_DIR="${VERIFICATION_DIR:-/tmp/backup-verification}"
RESTORE_TEST_DIR="${RESTORE_TEST_DIR:-/tmp/restore-test}"

# Database configuration for restore testing
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-learning_assistant_db}"
DB_USER="${DB_USER:-learning_user}"
DB_PASSWORD="${DB_PASSWORD}"
TEST_DB_PREFIX="${TEST_DB_PREFIX:-test_restore}"

# Verification settings
DEEP_VERIFICATION="${DEEP_VERIFICATION:-true}"
PERFORMANCE_TEST="${PERFORMANCE_TEST:-true}"
RESTORE_TEST="${RESTORE_TEST:-true}"
INTEGRITY_CHECK="${INTEGRITY_CHECK:-true}"
ENCRYPTION_VERIFY="${ENCRYPTION_VERIFY:-true}"
COMPRESSION_VERIFY="${COMPRESSION_VERIFY:-true}"

# Encryption settings
ENCRYPTION_KEY_FILE="${ENCRYPTION_KEY_FILE:-/etc/backup/encryption.key}"

# Performance thresholds
MAX_RESTORE_TIME="${MAX_RESTORE_TIME:-3600}"  # 1 hour
MIN_COMPRESSION_RATIO="${MIN_COMPRESSION_RATIO:-0.3}"  # 30% compression
MAX_CORRUPTION_RATE="${MAX_CORRUPTION_RATE:-0.01}"  # 1% corruption tolerance

# Monitoring and alerting
SLACK_WEBHOOK="${SLACK_WEBHOOK}"
DISCORD_WEBHOOK="${DISCORD_WEBHOOK}"
EMAIL_ALERTS="${EMAIL_ALERTS}"
CRITICAL_ALERTS="${CRITICAL_ALERTS:-true}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Global variables for tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0
VERIFICATION_RESULTS=()

# Logging function with severity levels
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${GREEN}[INFO]${NC} ${timestamp}: $message" | tee -a "${BACKUP_DIR}/verification.log"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} ${timestamp}: $message" | tee -a "${BACKUP_DIR}/verification.log"
            WARNINGS=$((WARNINGS + 1))
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} ${timestamp}: $message" | tee -a "${BACKUP_DIR}/verification.log"
            ;;
        "DEBUG")
            echo -e "${BLUE}[DEBUG]${NC} ${timestamp}: $message" | tee -a "${BACKUP_DIR}/verification.log"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} ${timestamp}: $message" | tee -a "${BACKUP_DIR}/verification.log"
            ;;
        "CRITICAL")
            echo -e "${RED}[CRITICAL]${NC} ${timestamp}: $message" | tee -a "${BACKUP_DIR}/verification.log"
            ;;
    esac
}

# Test execution framework
run_test() {
    local test_name="$1"
    local test_function="$2"
    local test_description="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    log "INFO" "Running test: $test_name - $test_description"
    
    local start_time=$(date +%s)
    local test_result=""
    local test_output=""
    
    if test_output=$($test_function 2>&1); then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log "SUCCESS" "Test passed: $test_name (${duration}s)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        test_result="PASSED"
        
        VERIFICATION_RESULTS+=("\"$test_name\": {\"status\": \"PASSED\", \"duration\": $duration, \"output\": \"$test_output\"}")
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log "ERROR" "Test failed: $test_name (${duration}s)"
        log "ERROR" "Test output: $test_output"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        test_result="FAILED"
        
        VERIFICATION_RESULTS+=("\"$test_name\": {\"status\": \"FAILED\", \"duration\": $duration, \"error\": \"$test_output\"}")
    fi
}

# Enhanced notification system
send_notification() {
    local status=$1
    local message=$2
    local severity="${3:-info}"
    
    # Slack notification with detailed formatting
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        local color="good"
        local icon=":white_check_mark:"
        
        case $severity in
            "error"|"critical")
                color="danger"
                icon=":x:"
                ;;
            "warning")
                color="warning"
                icon=":warning:"
                ;;
        esac
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"${icon} Backup Verification $status\",
                    \"text\": \"$message\",
                    \"fields\": [
                        {
                            \"title\": \"Total Tests\",
                            \"value\": \"$TOTAL_TESTS\",
                            \"short\": true
                        },
                        {
                            \"title\": \"Passed\",
                            \"value\": \"$PASSED_TESTS\",
                            \"short\": true
                        },
                        {
                            \"title\": \"Failed\",
                            \"value\": \"$FAILED_TESTS\",
                            \"short\": true
                        },
                        {
                            \"title\": \"Warnings\",
                            \"value\": \"$WARNINGS\",
                            \"short\": true
                        }
                    ],
                    \"footer\": \"Learning Assistant Backup Verification\",
                    \"ts\": $(date +%s)
                }]
            }" \
            "$SLACK_WEBHOOK" 2>/dev/null || true
    fi
    
    # Discord notification
    if [[ -n "$DISCORD_WEBHOOK" ]]; then
        local embed_color=65280  # Green
        case $severity in
            "error"|"critical") embed_color=16711680 ;;  # Red
            "warning") embed_color=16776960 ;;  # Yellow
        esac
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"embeds\": [{
                    \"title\": \"Backup Verification $status\",
                    \"description\": \"$message\",
                    \"color\": $embed_color,
                    \"fields\": [
                        {\"name\": \"Total Tests\", \"value\": \"$TOTAL_TESTS\", \"inline\": true},
                        {\"name\": \"Passed\", \"value\": \"$PASSED_TESTS\", \"inline\": true},
                        {\"name\": \"Failed\", \"value\": \"$FAILED_TESTS\", \"inline\": true}
                    ],
                    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
                }]
            }" \
            "$DISCORD_WEBHOOK" 2>/dev/null || true
    fi
    
    # Email notification for critical issues
    if [[ -n "$EMAIL_ALERTS" && ("$severity" == "critical" || "$severity" == "error") ]]; then
        local subject="ALERT: Backup Verification $status - Learning Assistant"
        echo -e "Subject: $subject\n\n$message\n\nTests: $TOTAL_TESTS | Passed: $PASSED_TESTS | Failed: $FAILED_TESTS | Warnings: $WARNINGS\n\nTimestamp: $(date)" | \
        sendmail "$EMAIL_ALERTS" 2>/dev/null || true
    fi
}

# Prerequisites validation
validate_prerequisites() {
    log "INFO" "Validating prerequisites for backup verification..."
    
    # Check required tools
    local tools=("pg_dump" "pg_restore" "psql" "gzip" "tar" "openssl" "jq" "curl" "sha256sum")
    
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log "ERROR" "Required tool not found: $tool"
            return 1
        fi
    done
    
    # Check backup directory
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log "ERROR" "Backup directory not found: $BACKUP_DIR"
        return 1
    fi
    
    # Create verification directory
    mkdir -p "$VERIFICATION_DIR"
    mkdir -p "$RESTORE_TEST_DIR"
    
    # Check database connectivity
    export PGPASSWORD="$DB_PASSWORD"
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &> /dev/null; then
        log "WARN" "Cannot connect to database for restore testing"
    fi
    unset PGPASSWORD
    
    # Check encryption key
    if [[ "$ENCRYPTION_VERIFY" == "true" && ! -f "$ENCRYPTION_KEY_FILE" ]]; then
        log "WARN" "Encryption key file not found: $ENCRYPTION_KEY_FILE"
    fi
    
    log "SUCCESS" "Prerequisites validation completed"
    return 0
}

# File existence verification
test_backup_files_exist() {
    local latest_backup=$(find "$BACKUP_DIR" -name "*_backup_*" -type f | sort | tail -1)
    
    if [[ -z "$latest_backup" ]]; then
        echo "No backup files found"
        return 1
    fi
    
    local backup_base=$(basename "$latest_backup" | sed 's/\.[^.]*$//' | sed 's/_[^_]*$//')
    local expected_files=(
        "${backup_base}_database.sql.gz"
        "${backup_base}_full.backup"
        "${backup_base}_user_data.tar.gz"
        "${backup_base}_config.tar.gz"
        "${backup_base}_report.json"
    )
    
    local missing_files=()
    
    for file in "${expected_files[@]}"; do
        local full_path="${BACKUP_DIR}/${file}"
        if [[ "$ENCRYPTION_VERIFY" == "true" ]]; then
            full_path="${full_path}.enc"
        fi
        
        if [[ ! -f "$full_path" ]]; then
            missing_files+=("$file")
        fi
    done
    
    if [[ ${#missing_files[@]} -gt 0 ]]; then
        echo "Missing backup files: ${missing_files[*]}"
        return 1
    fi
    
    echo "All expected backup files found"
    return 0
}

# File integrity verification
test_file_integrity() {
    local backup_files=($(find "$BACKUP_DIR" -name "*_backup_*" -type f | sort | tail -5))
    local corrupt_files=()
    
    for file in "${backup_files[@]}"; do
        local filename=$(basename "$file")
        
        # Skip manifest files
        if [[ "$file" == *.json ]]; then
            continue
        fi
        
        # Check encrypted files
        if [[ "$file" == *.enc ]]; then
            if [[ "$ENCRYPTION_VERIFY" == "true" && -f "$ENCRYPTION_KEY_FILE" ]]; then
                if ! openssl enc -aes-256-cbc -d -in "$file" -pass file:"$ENCRYPTION_KEY_FILE" -out /dev/null 2>/dev/null; then
                    corrupt_files+=("$filename (encryption)")
                fi
            fi
        # Check compressed files
        elif [[ "$file" == *.gz ]]; then
            if ! gzip -t "$file" 2>/dev/null; then
                corrupt_files+=("$filename (compression)")
            fi
        # Check PostgreSQL backup files
        elif [[ "$file" == *.backup ]]; then
            if ! pg_restore --list "$file" &> /dev/null; then
                corrupt_files+=("$filename (pg_restore)")
            fi
        # Check tar files
        elif [[ "$file" == *.tar ]]; then
            if ! tar -tf "$file" &> /dev/null; then
                corrupt_files+=("$filename (tar)")
            fi
        fi
        
        # Check file size
        local size=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null || echo 0)
        if [[ $size -eq 0 ]]; then
            corrupt_files+=("$filename (empty)")
        fi
    done
    
    if [[ ${#corrupt_files[@]} -gt 0 ]]; then
        echo "Corrupt files detected: ${corrupt_files[*]}"
        return 1
    fi
    
    echo "All backup files passed integrity checks"
    return 0
}

# Checksum verification
test_checksum_verification() {
    local backup_files=($(find "$BACKUP_DIR" -name "*_backup_*" -type f | sort | tail -5))
    local checksum_mismatches=()
    
    for file in "${backup_files[@]}"; do
        local filename=$(basename "$file")
        local manifest_file="${BACKUP_DIR}/$(echo "$filename" | sed 's/_[^_]*\.[^.]*$/_report.json/')"
        
        if [[ -f "$manifest_file" ]]; then
            local expected_checksum=$(jq -r ".backup_files[] | select(.name == \"$filename\") | .checksum" "$manifest_file" 2>/dev/null)
            
            if [[ -n "$expected_checksum" && "$expected_checksum" != "null" && "$expected_checksum" != "unknown" ]]; then
                local actual_checksum=$(sha256sum "$file" 2>/dev/null | cut -d' ' -f1 || shasum -a 256 "$file" 2>/dev/null | cut -d' ' -f1 || echo 'unknown')
                
                if [[ "$expected_checksum" != "$actual_checksum" ]]; then
                    checksum_mismatches+=("$filename")
                fi
            fi
        fi
    done
    
    if [[ ${#checksum_mismatches[@]} -gt 0 ]]; then
        echo "Checksum mismatches detected: ${checksum_mismatches[*]}"
        return 1
    fi
    
    echo "All checksums verified successfully"
    return 0
}

# Database restore test
test_database_restore() {
    if [[ "$RESTORE_TEST" != "true" ]]; then
        echo "Database restore test disabled"
        return 0
    fi
    
    local latest_db_backup=$(find "$BACKUP_DIR" -name "*_full.backup*" -type f | sort | tail -1)
    
    if [[ -z "$latest_db_backup" ]]; then
        echo "No database backup found for restore test"
        return 1
    fi
    
    local test_db_name="${TEST_DB_PREFIX}_$(date +%s)"
    local backup_file="$latest_db_backup"
    
    # Handle encrypted backup
    if [[ "$backup_file" == *.enc ]]; then
        if [[ ! -f "$ENCRYPTION_KEY_FILE" ]]; then
            echo "Encryption key not available for restore test"
            return 1
        fi
        
        local temp_backup="/tmp/restore_test_$$"
        if ! openssl enc -aes-256-cbc -d -in "$backup_file" -out "$temp_backup" -pass file:"$ENCRYPTION_KEY_FILE"; then
            echo "Failed to decrypt backup for restore test"
            return 1
        fi
        backup_file="$temp_backup"
    fi
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Create test database
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
        -c "CREATE DATABASE $test_db_name;" &> /dev/null; then
        echo "Failed to create test database"
        unset PGPASSWORD
        return 1
    fi
    
    local start_time=$(date +%s)
    
    # Restore to test database
    if ! pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$test_db_name" \
        --jobs=2 --verbose "$backup_file" &> /dev/null; then
        echo "Database restore failed"
        
        # Cleanup
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
            -c "DROP DATABASE IF EXISTS $test_db_name;" &> /dev/null
        unset PGPASSWORD
        
        # Clean up temporary file
        [[ -f "/tmp/restore_test_$$" ]] && rm -f "/tmp/restore_test_$$"
        
        return 1
    fi
    
    local end_time=$(date +%s)
    local restore_duration=$((end_time - start_time))
    
    # Verify restore
    local table_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$test_db_name" \
        -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
    
    if [[ $table_count -le 0 ]]; then
        echo "Restore verification failed: no tables found"
        
        # Cleanup
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
            -c "DROP DATABASE IF EXISTS $test_db_name;" &> /dev/null
        unset PGPASSWORD
        
        return 1
    fi
    
    # Test data integrity
    local sample_data=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$test_db_name" \
        -t -c "SELECT COUNT(*) FROM users LIMIT 1;" 2>/dev/null | tr -d ' ' || echo "0")
    
    # Cleanup test database
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
        -c "DROP DATABASE $test_db_name;" &> /dev/null
    unset PGPASSWORD
    
    # Clean up temporary file
    [[ -f "/tmp/restore_test_$$" ]] && rm -f "/tmp/restore_test_$$"
    
    # Check restore performance
    if [[ $restore_duration -gt $MAX_RESTORE_TIME ]]; then
        echo "Database restore completed but took too long: ${restore_duration}s (max: ${MAX_RESTORE_TIME}s)"
        return 1
    fi
    
    echo "Database restore test passed: ${table_count} tables restored in ${restore_duration}s"
    return 0
}

# Application data restore test
test_app_data_restore() {
    local latest_app_backup=$(find "$BACKUP_DIR" -name "*_user_data.tar.gz*" -type f | sort | tail -1)
    
    if [[ -z "$latest_app_backup" ]]; then
        echo "No application data backup found for restore test"
        return 1
    fi
    
    local restore_dir="${RESTORE_TEST_DIR}/app_data_test_$(date +%s)"
    mkdir -p "$restore_dir"
    
    local backup_file="$latest_app_backup"
    
    # Handle encrypted backup
    if [[ "$backup_file" == *.enc ]]; then
        if [[ ! -f "$ENCRYPTION_KEY_FILE" ]]; then
            echo "Encryption key not available for app data restore test"
            return 1
        fi
        
        local temp_backup="/tmp/app_restore_test_$$"
        if ! openssl enc -aes-256-cbc -d -in "$backup_file" -out "$temp_backup" -pass file:"$ENCRYPTION_KEY_FILE"; then
            echo "Failed to decrypt app data backup for restore test"
            return 1
        fi
        backup_file="$temp_backup"
    fi
    
    # Extract backup
    if ! tar -xzf "$backup_file" -C "$restore_dir" 2>/dev/null; then
        echo "Failed to extract application data backup"
        rm -rf "$restore_dir"
        [[ -f "/tmp/app_restore_test_$$" ]] && rm -f "/tmp/app_restore_test_$$"
        return 1
    fi
    
    # Verify extracted data
    local extracted_files=$(find "$restore_dir" -type f | wc -l)
    
    if [[ $extracted_files -le 0 ]]; then
        echo "No files extracted from application data backup"
        rm -rf "$restore_dir"
        [[ -f "/tmp/app_restore_test_$$" ]] && rm -f "/tmp/app_restore_test_$$"
        return 1
    fi
    
    # Cleanup
    rm -rf "$restore_dir"
    [[ -f "/tmp/app_restore_test_$$" ]] && rm -f "/tmp/app_restore_test_$$"
    
    echo "Application data restore test passed: $extracted_files files extracted"
    return 0
}

# Compression ratio verification
test_compression_efficiency() {
    if [[ "$COMPRESSION_VERIFY" != "true" ]]; then
        echo "Compression verification disabled"
        return 0
    fi
    
    local backup_files=($(find "$BACKUP_DIR" -name "*.tar.gz" -o -name "*.sql.gz" | sort | tail -3))
    local poor_compression=()
    
    for file in "${backup_files[@]}"; do
        local filename=$(basename "$file")
        
        # Skip encrypted files for compression test
        if [[ "$file" == *.enc ]]; then
            continue
        fi
        
        # Get compressed size
        local compressed_size=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null || echo 0)
        
        if [[ $compressed_size -eq 0 ]]; then
            continue
        fi
        
        # Estimate uncompressed size using gzip
        local uncompressed_size=$(gzip -l "$file" 2>/dev/null | tail -1 | awk '{print $2}' || echo 0)
        
        if [[ $uncompressed_size -gt 0 ]]; then
            local compression_ratio=$(awk "BEGIN {printf \"%.2f\", $compressed_size / $uncompressed_size}")
            
            if (( $(awk "BEGIN {print ($compression_ratio > $MIN_COMPRESSION_RATIO)}") )); then
                poor_compression+=("$filename (ratio: $compression_ratio)")
            fi
        fi
    done
    
    if [[ ${#poor_compression[@]} -gt 0 ]]; then
        echo "Poor compression detected: ${poor_compression[*]}"
        return 1
    fi
    
    echo "Compression efficiency test passed"
    return 0
}

# Backup age verification
test_backup_freshness() {
    local latest_backup=$(find "$BACKUP_DIR" -name "*_backup_*" -type f | sort | tail -1)
    
    if [[ -z "$latest_backup" ]]; then
        echo "No backups found"
        return 1
    fi
    
    local backup_age_hours=$(( ($(date +%s) - $(stat -c%Y "$latest_backup" 2>/dev/null || stat -f%m "$latest_backup" 2>/dev/null || echo 0)) / 3600 ))
    
    if [[ $backup_age_hours -gt 25 ]]; then  # More than 25 hours old
        echo "Latest backup is too old: ${backup_age_hours} hours"
        return 1
    fi
    
    echo "Backup freshness test passed: latest backup is ${backup_age_hours} hours old"
    return 0
}

# Retention policy verification
test_retention_policy() {
    local old_backups=$(find "$BACKUP_DIR" -name "*_backup_*" -type f -mtime +32)  # Older than 32 days
    
    if [[ -n "$old_backups" ]]; then
        local old_count=$(echo "$old_backups" | wc -l)
        echo "Found $old_count backups older than retention period"
        return 1
    fi
    
    local recent_backups=$(find "$BACKUP_DIR" -name "*_backup_*" -type f -mtime -2)  # Newer than 2 days
    local recent_count=$(echo "$recent_backups" | wc -l)
    
    if [[ $recent_count -lt 1 ]]; then
        echo "No recent backups found (within 2 days)"
        return 1
    fi
    
    echo "Retention policy test passed: $recent_count recent backups, no old backups"
    return 0
}

# Performance benchmarking
test_backup_performance() {
    if [[ "$PERFORMANCE_TEST" != "true" ]]; then
        echo "Performance testing disabled"
        return 0
    fi
    
    local report_files=($(find "$BACKUP_DIR" -name "*_report.json" | sort | tail -3))
    local slow_backups=()
    
    for report_file in "${report_files[@]}"; do
        if [[ -f "$report_file" ]]; then
            local backup_duration=$(jq -r '.performance.backup_duration // 0' "$report_file" 2>/dev/null)
            local backup_name=$(jq -r '.backup_id // "unknown"' "$report_file" 2>/dev/null)
            
            # Check if backup took too long (more than 2 hours)
            if [[ $backup_duration -gt 7200 ]]; then
                slow_backups+=("$backup_name (${backup_duration}s)")
            fi
        fi
    done
    
    if [[ ${#slow_backups[@]} -gt 0 ]]; then
        echo "Slow backups detected: ${slow_backups[*]}"
        return 1
    fi
    
    echo "Performance test passed: all backups completed within acceptable time"
    return 0
}

# Cloud storage verification
test_cloud_storage_sync() {
    # Check if cloud storage is configured
    if [[ -z "$S3_BUCKET" && -z "$AZURE_CONTAINER" && -z "$GCS_BUCKET" ]]; then
        echo "No cloud storage configured, skipping sync test"
        return 0
    fi
    
    local sync_issues=()
    
    # S3 verification
    if [[ -n "$S3_BUCKET" ]] && command -v aws &> /dev/null; then
        local latest_backup=$(find "$BACKUP_DIR" -name "*_backup_*" -type f | sort | tail -1)
        if [[ -n "$latest_backup" ]]; then
            local filename=$(basename "$latest_backup")
            local s3_path="s3://${S3_BUCKET}/${S3_PREFIX}${filename}"
            
            if ! aws s3 ls "$s3_path" &> /dev/null; then
                sync_issues+=("S3: $filename not found")
            fi
        fi
    fi
    
    # Azure verification
    if [[ -n "$AZURE_CONTAINER" ]] && command -v az &> /dev/null; then
        local latest_backup=$(find "$BACKUP_DIR" -name "*_backup_*" -type f | sort | tail -1)
        if [[ -n "$latest_backup" ]]; then
            local filename=$(basename "$latest_backup")
            
            if ! az storage blob exists --container-name "$AZURE_CONTAINER" --name "$filename" &> /dev/null; then
                sync_issues+=("Azure: $filename not found")
            fi
        fi
    fi
    
    # GCS verification
    if [[ -n "$GCS_BUCKET" ]] && command -v gsutil &> /dev/null; then
        local latest_backup=$(find "$BACKUP_DIR" -name "*_backup_*" -type f | sort | tail -1)
        if [[ -n "$latest_backup" ]]; then
            local filename=$(basename "$latest_backup")
            local gcs_path="gs://${GCS_BUCKET}/${filename}"
            
            if ! gsutil ls "$gcs_path" &> /dev/null; then
                sync_issues+=("GCS: $filename not found")
            fi
        fi
    fi
    
    if [[ ${#sync_issues[@]} -gt 0 ]]; then
        echo "Cloud storage sync issues: ${sync_issues[*]}"
        return 1
    fi
    
    echo "Cloud storage sync verification passed"
    return 0
}

# Generate comprehensive verification report
generate_verification_report() {
    local report_file="${VERIFICATION_DIR}/verification_report_$(date +%Y%m%d_%H%M%S).json"
    local success_rate=0
    
    if [[ $TOTAL_TESTS -gt 0 ]]; then
        success_rate=$(awk "BEGIN {printf \"%.2f\", $PASSED_TESTS / $TOTAL_TESTS * 100}")
    fi
    
    cat > "$report_file" << EOF
{
    "verification_report": {
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "verification_id": "verification_$(date +%Y%m%d_%H%M%S)",
        "summary": {
            "total_tests": $TOTAL_TESTS,
            "passed_tests": $PASSED_TESTS,
            "failed_tests": $FAILED_TESTS,
            "warnings": $WARNINGS,
            "success_rate": $success_rate
        },
        "test_results": {
            $(IFS=','; echo "${VERIFICATION_RESULTS[*]}")
        },
        "environment": {
            "backup_directory": "$BACKUP_DIR",
            "verification_directory": "$VERIFICATION_DIR",
            "database_host": "$DB_HOST",
            "encryption_enabled": $([ "$ENCRYPTION_VERIFY" == "true" ] && echo true || echo false),
            "deep_verification": $([ "$DEEP_VERIFICATION" == "true" ] && echo true || echo false),
            "restore_testing": $([ "$RESTORE_TEST" == "true" ] && echo true || echo false)
        },
        "recommendations": [
EOF
    
    # Generate recommendations based on test results
    if [[ $FAILED_TESTS -gt 0 ]]; then
        echo "            \"Investigate and resolve failed backup verification tests\"," >> "$report_file"
    fi
    
    if [[ $WARNINGS -gt 0 ]]; then
        echo "            \"Review and address backup system warnings\"," >> "$report_file"
    fi
    
    if [[ $success_rate -lt 90 ]]; then
        echo "            \"Backup success rate is below 90%, review backup procedures\"," >> "$report_file"
    fi
    
    # Remove trailing comma if present
    sed -i '$ s/,$//' "$report_file" 2>/dev/null || sed -i '' '$ s/,$//' "$report_file" 2>/dev/null || true
    
    cat >> "$report_file" << EOF
        ]
    }
}
EOF
    
    log "SUCCESS" "Verification report generated: $report_file"
    
    # Copy report to backup directory for archival
    cp "$report_file" "${BACKUP_DIR}/latest_verification_report.json"
}

# Main verification orchestration
main() {
    local start_time=$(date +%s)
    
    log "INFO" "Starting comprehensive backup verification"
    send_notification "STARTED" "Backup verification process initiated"
    
    # Initialize verification
    if ! validate_prerequisites; then
        log "CRITICAL" "Prerequisites validation failed"
        send_notification "FAILED" "Prerequisites validation failed" "critical"
        exit 1
    fi
    
    # Core verification tests
    run_test "file_existence" "test_backup_files_exist" "Verify all expected backup files exist"
    run_test "file_integrity" "test_file_integrity" "Verify backup file integrity and format"
    run_test "checksum_verification" "test_checksum_verification" "Verify backup file checksums"
    
    # Advanced verification tests
    if [[ "$DEEP_VERIFICATION" == "true" ]]; then
        run_test "database_restore" "test_database_restore" "Test database backup restore capability"
        run_test "app_data_restore" "test_app_data_restore" "Test application data restore capability"
        run_test "compression_efficiency" "test_compression_efficiency" "Verify backup compression efficiency"
    fi
    
    # Operational tests
    run_test "backup_freshness" "test_backup_freshness" "Verify backup recency and freshness"
    run_test "retention_policy" "test_retention_policy" "Verify backup retention policy compliance"
    
    # Performance and infrastructure tests
    if [[ "$PERFORMANCE_TEST" == "true" ]]; then
        run_test "backup_performance" "test_backup_performance" "Verify backup performance metrics"
        run_test "cloud_storage_sync" "test_cloud_storage_sync" "Verify cloud storage synchronization"
    fi
    
    # Generate final report
    generate_verification_report
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local success_rate=0
    
    if [[ $TOTAL_TESTS -gt 0 ]]; then
        success_rate=$(awk "BEGIN {printf \"%.1f\", $PASSED_TESTS / $TOTAL_TESTS * 100}")
    fi
    
    # Determine overall status
    local overall_status="SUCCESS"
    local severity="info"
    
    if [[ $FAILED_TESTS -gt 0 ]]; then
        overall_status="FAILED"
        severity="error"
        
        if [[ $FAILED_TESTS -gt $((TOTAL_TESTS / 2)) ]]; then
            severity="critical"
        fi
    elif [[ $WARNINGS -gt 2 ]]; then
        overall_status="WARNING"
        severity="warning"
    fi
    
    # Final notification and cleanup
    log "INFO" "Backup verification completed: $overall_status"
    log "INFO" "Results: $PASSED_TESTS/$TOTAL_TESTS tests passed (${success_rate}%), $WARNINGS warnings"
    
    send_notification "$overall_status" "Backup verification completed in ${duration}s. Success rate: ${success_rate}% ($PASSED_TESTS/$TOTAL_TESTS tests passed)" "$severity"
    
    # Cleanup temporary files
    rm -rf "$RESTORE_TEST_DIR"
    
    # Exit with appropriate code
    if [[ "$overall_status" == "FAILED" ]]; then
        exit 1
    elif [[ "$overall_status" == "WARNING" ]]; then
        exit 2
    else
        exit 0
    fi
}

# Handle script arguments
case "${1:-main}" in
    "main")
        main
        ;;
    "quick")
        DEEP_VERIFICATION="false"
        PERFORMANCE_TEST="false"
        RESTORE_TEST="false"
        main
        ;;
    "deep")
        DEEP_VERIFICATION="true"
        PERFORMANCE_TEST="true"
        RESTORE_TEST="true"
        main
        ;;
    "integrity")
        run_test "file_integrity" "test_file_integrity" "File integrity verification"
        ;;
    "restore")
        run_test "database_restore" "test_database_restore" "Database restore test"
        ;;
    "cloud")
        run_test "cloud_storage_sync" "test_cloud_storage_sync" "Cloud storage verification"
        ;;
    "help")
        cat << EOF
Usage: $0 [COMMAND]

Commands:
  main       - Run complete backup verification (default)
  quick      - Run basic verification tests only
  deep       - Run comprehensive verification with all tests
  integrity  - Run file integrity tests only
  restore    - Run restore capability tests only
  cloud      - Run cloud storage sync verification only
  help       - Show this help

Environment Variables:
  BACKUP_DIR, VERIFICATION_DIR, RESTORE_TEST_DIR
  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
  DEEP_VERIFICATION, PERFORMANCE_TEST, RESTORE_TEST
  ENCRYPTION_VERIFY, COMPRESSION_VERIFY
  SLACK_WEBHOOK, DISCORD_WEBHOOK, EMAIL_ALERTS
  S3_BUCKET, AZURE_CONTAINER, GCS_BUCKET
EOF
        ;;
    *)
        log "ERROR" "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac