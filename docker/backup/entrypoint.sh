#!/bin/bash

# Backup Service Entrypoint Script
# Learning Assistant - Docker Container Initialization
# Version: 2.0.0

set -euo pipefail

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
            echo -e "${GREEN}[INFO]${NC} ${timestamp}: $message"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} ${timestamp}: $message"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} ${timestamp}: $message"
            ;;
        "DEBUG")
            echo -e "${BLUE}[DEBUG]${NC} ${timestamp}: $message"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} ${timestamp}: $message"
            ;;
    esac
}

# Initialize backup environment
init_backup_environment() {
    log "INFO" "Initializing backup environment..."
    
    # Ensure directories exist with correct permissions
    mkdir -p "$BACKUP_DIR" "$LOG_DIR" "$WORKSPACE_DIR"
    
    # Initialize log files
    touch "$LOG_DIR/backup.log" "$LOG_DIR/monitoring.log" "$LOG_DIR/error.log"
    
    # Set up encryption key if it doesn't exist
    if [[ "$ENCRYPTION_ENABLED" == "true" && ! -f "$ENCRYPTION_KEY_FILE" ]]; then
        log "INFO" "Generating encryption key..."
        mkdir -p "$(dirname "$ENCRYPTION_KEY_FILE")"
        openssl rand -base64 32 > "$ENCRYPTION_KEY_FILE"
        chmod 600 "$ENCRYPTION_KEY_FILE"
        log "SUCCESS" "Encryption key generated"
    fi
    
    # Validate database connection
    if [[ -n "$DB_HOST" && -n "$DB_USER" && -n "$DB_PASSWORD" ]]; then
        log "INFO" "Validating database connection..."
        
        export PGPASSWORD="$DB_PASSWORD"
        if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t 10; then
            log "SUCCESS" "Database connection validated"
        else
            log "WARN" "Database connection failed - backups may not work properly"
        fi
        unset PGPASSWORD
    fi
    
    # Test cloud storage connectivity
    test_cloud_connectivity
    
    # Initialize monitoring
    if [[ "$MONITORING_ENABLED" == "true" ]]; then
        log "INFO" "Initializing backup monitoring..."
        cd "$TOOLS_DIR"
        export NODE_ENV=production
        export AUTO_START_BACKUP_MONITOR=true
        node -r ts-node/register backup-monitor.ts &
        MONITOR_PID=$!
        log "SUCCESS" "Backup monitoring started (PID: $MONITOR_PID)"
    fi
    
    log "SUCCESS" "Backup environment initialized"
}

# Test cloud storage connectivity
test_cloud_connectivity() {
    log "INFO" "Testing cloud storage connectivity..."
    
    # Test AWS S3 connectivity
    if [[ -n "$S3_BUCKET" ]]; then
        if command -v aws &> /dev/null; then
            if aws sts get-caller-identity &> /dev/null; then
                if aws s3 ls "s3://$S3_BUCKET" &> /dev/null; then
                    log "SUCCESS" "AWS S3 connectivity verified"
                else
                    log "WARN" "Cannot access S3 bucket: $S3_BUCKET"
                fi
            else
                log "WARN" "AWS credentials not configured"
            fi
        else
            log "WARN" "AWS CLI not available"
        fi
    fi
    
    # Test Azure connectivity
    if [[ -n "$AZURE_CONTAINER" ]]; then
        if command -v az &> /dev/null; then
            if az account show &> /dev/null; then
                log "SUCCESS" "Azure connectivity verified"
            else
                log "WARN" "Azure credentials not configured"
            fi
        else
            log "WARN" "Azure CLI not available"
        fi
    fi
    
    # Test GCP connectivity
    if [[ -n "$GCS_BUCKET" ]]; then
        if command -v gsutil &> /dev/null; then
            if gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1 &> /dev/null; then
                if gsutil ls "gs://$GCS_BUCKET" &> /dev/null; then
                    log "SUCCESS" "Google Cloud Storage connectivity verified"
                else
                    log "WARN" "Cannot access GCS bucket: $GCS_BUCKET"
                fi
            else
                log "WARN" "GCP credentials not configured"
            fi
        else
            log "WARN" "Google Cloud SDK not available"
        fi
    fi
}

# Setup backup schedule
setup_backup_schedule() {
    log "INFO" "Setting up backup schedule..."
    
    # Create cron job for automated backups
    local cron_schedule="$BACKUP_SCHEDULE"
    local backup_command="$SCRIPTS_DIR/database-backup.sh >> $LOG_DIR/backup.log 2>&1"
    
    # Add backup job to crontab
    (
        echo "# Learning Assistant Automated Backup Schedule"
        echo "SHELL=/bin/bash"
        echo "PATH=/usr/local/bin:/usr/bin:/bin"
        echo "MAILTO=\"\""
        echo ""
        echo "# Database backup"
        echo "$cron_schedule $backup_command"
        echo ""
        echo "# Application data backup (offset by 30 minutes)"
        echo "30 2 * * * $SCRIPTS_DIR/app-data-backup.sh >> $LOG_DIR/backup.log 2>&1"
        echo ""
        echo "# Cross-region replication (offset by 1 hour)"
        echo "0 3 * * * $SCRIPTS_DIR/cross-region-replication.sh >> $LOG_DIR/backup.log 2>&1"
        echo ""
        echo "# Backup verification (daily at 4 AM)"
        echo "0 4 * * * $SCRIPTS_DIR/backup-verification.sh >> $LOG_DIR/verification.log 2>&1"
        echo ""
        echo "# Weekly comprehensive verification (Sundays at 5 AM)"
        echo "0 5 * * 0 $SCRIPTS_DIR/backup-verification.sh deep >> $LOG_DIR/verification.log 2>&1"
        echo ""
        echo "# Monthly disaster recovery test (1st of month at 6 AM)"
        echo "0 6 1 * * $SCRIPTS_DIR/disaster-recovery.sh dry-run >> $LOG_DIR/dr-test.log 2>&1"
    ) | crontab -
    
    log "SUCCESS" "Backup schedule configured"
    crontab -l | log "DEBUG" "Current crontab:"
    crontab -l
}

# Start backup daemon
start_backup_daemon() {
    log "INFO" "Starting backup daemon..."
    
    # Start cron daemon
    if command -v cron &> /dev/null; then
        cron -f &
        CRON_PID=$!
        log "SUCCESS" "Cron daemon started (PID: $CRON_PID)"
    elif command -v crond &> /dev/null; then
        crond -f &
        CRON_PID=$!
        log "SUCCESS" "Crond daemon started (PID: $CRON_PID)"
    else
        log "ERROR" "No cron daemon found"
        exit 1
    fi
    
    # Start supervisor for service management
    if command -v supervisord &> /dev/null; then
        supervisord -c /etc/supervisor/conf.d/backup.conf &
        SUPERVISOR_PID=$!
        log "SUCCESS" "Supervisor started (PID: $SUPERVISOR_PID)"
    fi
}

# Run backup immediately
run_immediate_backup() {
    log "INFO" "Running immediate backup..."
    
    # Run database backup
    if "$SCRIPTS_DIR/database-backup.sh"; then
        log "SUCCESS" "Database backup completed"
    else
        log "ERROR" "Database backup failed"
        return 1
    fi
    
    # Run application data backup
    if "$SCRIPTS_DIR/app-data-backup.sh"; then
        log "SUCCESS" "Application data backup completed"
    else
        log "ERROR" "Application data backup failed"
        return 1
    fi
    
    # Run verification
    if "$SCRIPTS_DIR/backup-verification.sh" quick; then
        log "SUCCESS" "Backup verification passed"
    else
        log "WARN" "Backup verification failed"
    fi
    
    log "SUCCESS" "Immediate backup completed"
}

# Run monitoring mode
run_monitoring_mode() {
    log "INFO" "Starting backup monitoring mode..."
    
    cd "$TOOLS_DIR"
    export NODE_ENV=production
    export AUTO_START_BACKUP_MONITOR=true
    
    # Start the monitoring service
    node -r ts-node/register backup-monitor.ts
}

# Run verification mode
run_verification_mode() {
    local mode=${1:-"quick"}
    log "INFO" "Running backup verification in $mode mode..."
    
    if "$SCRIPTS_DIR/backup-verification.sh" "$mode"; then
        log "SUCCESS" "Backup verification completed successfully"
        exit 0
    else
        log "ERROR" "Backup verification failed"
        exit 1
    fi
}

# Run disaster recovery test
run_disaster_recovery_test() {
    log "INFO" "Running disaster recovery test..."
    
    export DRY_RUN=true
    export RECOVERY_SCENARIO=full
    export RECOVERY_POINT=latest
    
    if "$SCRIPTS_DIR/disaster-recovery.sh"; then
        log "SUCCESS" "Disaster recovery test completed successfully"
        exit 0
    else
        log "ERROR" "Disaster recovery test failed"
        exit 1
    fi
}

# Cleanup function
cleanup() {
    log "INFO" "Shutting down backup service..."
    
    # Kill background processes
    if [[ -n "${CRON_PID:-}" ]]; then
        kill $CRON_PID 2>/dev/null || true
    fi
    
    if [[ -n "${SUPERVISOR_PID:-}" ]]; then
        kill $SUPERVISOR_PID 2>/dev/null || true
    fi
    
    if [[ -n "${MONITOR_PID:-}" ]]; then
        kill $MONITOR_PID 2>/dev/null || true
    fi
    
    log "SUCCESS" "Backup service shutdown complete"
}

# Signal handlers
trap cleanup EXIT INT TERM

# Print startup banner
echo -e "${PURPLE}"
echo "========================================"
echo "  Learning Assistant Backup Service   "
echo "           Version 2.0.0              "
echo "========================================"
echo -e "${NC}"

# Parse command line arguments
COMMAND=${1:-"backup-service"}

case "$COMMAND" in
    "backup-service")
        log "INFO" "Starting backup service..."
        init_backup_environment
        setup_backup_schedule
        start_backup_daemon
        
        # Keep the container running
        while true; do
            sleep 60
        done
        ;;
    
    "backup-now")
        log "INFO" "Running immediate backup..."
        init_backup_environment
        run_immediate_backup
        ;;
    
    "monitor")
        log "INFO" "Starting monitoring mode..."
        init_backup_environment
        run_monitoring_mode
        ;;
    
    "verify")
        MODE=${2:-"quick"}
        run_verification_mode "$MODE"
        ;;
    
    "test-dr")
        log "INFO" "Running disaster recovery test..."
        init_backup_environment
        run_disaster_recovery_test
        ;;
    
    "shell")
        log "INFO" "Starting interactive shell..."
        init_backup_environment
        exec /bin/bash
        ;;
    
    "help")
        echo "Learning Assistant Backup Service"
        echo ""
        echo "Usage: $0 [COMMAND]"
        echo ""
        echo "Commands:"
        echo "  backup-service  Start the backup service with scheduled backups (default)"
        echo "  backup-now      Run an immediate backup"
        echo "  monitor         Start monitoring mode only"
        echo "  verify [MODE]   Run backup verification (quick, deep)"
        echo "  test-dr         Run disaster recovery test"
        echo "  shell           Start interactive shell"
        echo "  help            Show this help"
        echo ""
        echo "Environment Variables:"
        echo "  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD"
        echo "  BACKUP_SCHEDULE, RETENTION_DAYS, ENCRYPTION_ENABLED"
        echo "  S3_BUCKET, AZURE_CONTAINER, GCS_BUCKET"
        echo "  SLACK_WEBHOOK, DISCORD_WEBHOOK, EMAIL_ALERTS"
        echo ""
        ;;
    
    *)
        log "ERROR" "Unknown command: $COMMAND"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac
