#!/bin/bash

# Database Maintenance Automation Script
# This script performs automated database maintenance tasks for the learning assistant

set -euo pipefail

# Configuration
DB_NAME="${DB_NAME:-learning_assistant}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
PGPASSWORD="${PGPASSWORD:-}"

# Paths and settings
LOG_DIR="${LOG_DIR:-/var/log/postgresql/maintenance}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgresql}"
ARCHIVE_DIR="${ARCHIVE_DIR:-/var/lib/postgresql/archive}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Maintenance settings
VACUUM_THRESHOLD_DAYS=7
ANALYZE_THRESHOLD_DAYS=1
REINDEX_THRESHOLD_DAYS=30
BACKUP_RETENTION_DAYS=30
LOG_RETENTION_DAYS=90

# Logging setup
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/maintenance-$(date +%Y%m%d_%H%M%S).log"

# Function to log messages
log() {
    local level="$1"
    shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE"
}

log_info() { log "INFO" "$@"; }
log_warn() { log "WARN" "$@"; }
log_error() { log "ERROR" "$@"; }

# Function to execute SQL queries
execute_sql() {
    local query="$1"
    local description="$2"
    
    log_info "Executing: $description"
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$query" >> "$LOG_FILE" 2>&1; then
        log_info "Successfully completed: $description"
        return 0
    else
        log_error "Failed: $description"
        return 1
    fi
}

# Function to check database connectivity
check_connectivity() {
    log_info "Checking database connectivity..."
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
        log_error "Cannot connect to database"
        exit 1
    fi
    log_info "Database connectivity verified"
}

# Function to get database size
get_database_size() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT pg_size_pretty(pg_database_size('$DB_NAME'));
    " | xargs
}

# Function to get table statistics
get_table_stats() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT 
            schemaname,
            tablename,
            n_live_tup as live_tuples,
            n_dead_tup as dead_tuples,
            last_vacuum,
            last_autovacuum,
            last_analyze,
            last_autoanalyze,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_stat_user_tables 
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 20;
    " >> "$LOG_FILE" 2>&1
}

# Function to perform VACUUM operations
perform_vacuum() {
    log_info "Starting VACUUM operations..."
    
    # Get tables that need vacuuming
    local tables_needing_vacuum
    tables_needing_vacuum=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT tablename 
        FROM pg_stat_user_tables 
        WHERE (last_vacuum IS NULL OR last_vacuum < NOW() - INTERVAL '$VACUUM_THRESHOLD_DAYS days')
           OR (last_autovacuum IS NULL OR last_autovacuum < NOW() - INTERVAL '$VACUUM_THRESHOLD_DAYS days')
           OR n_dead_tup > 1000;
    " | xargs)
    
    if [ -z "$tables_needing_vacuum" ]; then
        log_info "No tables need vacuuming"
        return
    fi
    
    for table in $tables_needing_vacuum; do
        log_info "Vacuuming table: $table"
        if execute_sql "VACUUM VERBOSE $table;" "VACUUM $table"; then
            log_info "Successfully vacuumed $table"
        else
            log_warn "Failed to vacuum $table"
        fi
    done
    
    log_info "VACUUM operations completed"
}

# Function to perform ANALYZE operations
perform_analyze() {
    log_info "Starting ANALYZE operations..."
    
    # Get tables that need analyzing
    local tables_needing_analyze
    tables_needing_analyze=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT tablename 
        FROM pg_stat_user_tables 
        WHERE (last_analyze IS NULL OR last_analyze < NOW() - INTERVAL '$ANALYZE_THRESHOLD_DAYS days')
           OR (last_autoanalyze IS NULL OR last_autoanalyze < NOW() - INTERVAL '$ANALYZE_THRESHOLD_DAYS days');
    " | xargs)
    
    if [ -z "$tables_needing_analyze" ]; then
        log_info "No tables need analyzing"
        return
    fi
    
    for table in $tables_needing_analyze; do
        if execute_sql "ANALYZE VERBOSE $table;" "ANALYZE $table"; then
            log_info "Successfully analyzed $table"
        else
            log_warn "Failed to analyze $table"
        fi
    done
    
    log_info "ANALYZE operations completed"
}

# Function to perform REINDEX operations
perform_reindex() {
    log_info "Starting REINDEX operations..."
    
    # Get indexes that might benefit from reindexing
    local indexes_needing_reindex
    indexes_needing_reindex=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT indexname 
        FROM pg_stat_user_indexes 
        WHERE idx_scan > 1000 AND idx_tup_read > 1000000;
    " | head -10 | xargs)
    
    if [ -z "$indexes_needing_reindex" ]; then
        log_info "No indexes need reindexing"
        return
    fi
    
    for index in $indexes_needing_reindex; do
        if execute_sql "REINDEX INDEX CONCURRENTLY $index;" "REINDEX $index"; then
            log_info "Successfully reindexed $index"
        else
            log_warn "Failed to reindex $index"
        fi
    done
    
    log_info "REINDEX operations completed"
}

# Function to update table statistics
update_statistics() {
    log_info "Updating table statistics..."
    
    if execute_sql "
        UPDATE pg_class SET reltuples = (
            SELECT count(*) FROM information_schema.tables 
            WHERE table_schema = 'public'
        ) WHERE relname = 'pg_class';
    " "Update table statistics"; then
        log_info "Table statistics updated"
    else
        log_warn "Failed to update table statistics"
    fi
}

# Function to check for bloated tables
check_table_bloat() {
    log_info "Checking for table bloat..."
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT 
            schemaname,
            tablename,
            n_live_tup,
            n_dead_tup,
            CASE 
                WHEN n_live_tup > 0 THEN 
                    round((n_dead_tup::numeric / n_live_tup::numeric) * 100, 2)
                ELSE 0 
            END as bloat_percentage,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_stat_user_tables 
        WHERE n_dead_tup > 1000
        ORDER BY n_dead_tup DESC;
    " >> "$LOG_FILE" 2>&1
}

# Function to check for unused indexes
check_unused_indexes() {
    log_info "Checking for unused indexes..."
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT 
            schemaname,
            tablename,
            indexname,
            idx_scan,
            pg_size_pretty(pg_relation_size(indexname::regclass)) as size
        FROM pg_stat_user_indexes 
        WHERE idx_scan < 10
        ORDER BY pg_relation_size(indexname::regclass) DESC;
    " >> "$LOG_FILE" 2>&1
}

# Function to maintain partitions
maintain_partitions() {
    log_info "Maintaining partitions..."
    
    if execute_sql "SELECT maintain_partitions();" "Maintain partitions"; then
        log_info "Partition maintenance completed"
    else
        log_warn "Partition maintenance failed"
    fi
}

# Function to check replication lag
check_replication_lag() {
    log_info "Checking replication lag..."
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT * FROM replica_lag_status;
    " >> "$LOG_FILE" 2>&1
    
    # Record replication metrics
    if execute_sql "SELECT record_replication_metrics();" "Record replication metrics"; then
        log_info "Replication metrics recorded"
    else
        log_warn "Failed to record replication metrics"
    fi
    
    # Check for replication lag alerts
    if execute_sql "SELECT check_replication_lag();" "Check replication lag"; then
        log_info "Replication lag check completed"
    else
        log_warn "Replication lag check failed"
    fi
}

# Function to cleanup old WAL files
cleanup_wal_files() {
    log_info "Cleaning up old WAL files..."
    
    if [ -d "$ARCHIVE_DIR" ]; then
        # Remove WAL files older than 7 days
        find "$ARCHIVE_DIR" -name "*.wal" -type f -mtime +7 -delete
        find "$ARCHIVE_DIR" -name "*.backup" -type f -mtime +30 -delete
        
        local files_removed
        files_removed=$(find "$ARCHIVE_DIR" -name "*.wal" -type f -mtime +7 | wc -l)
        log_info "Removed $files_removed old WAL files"
    else
        log_warn "Archive directory $ARCHIVE_DIR not found"
    fi
}

# Function to perform database backup
perform_backup() {
    log_info "Performing database backup..."
    
    mkdir -p "$BACKUP_DIR"
    local backup_file="$BACKUP_DIR/${DB_NAME}_$(date +%Y%m%d_%H%M%S).sql.gz"
    
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --verbose | gzip > "$backup_file" 2>> "$LOG_FILE"; then
        log_info "Database backup completed: $backup_file"
        
        # Remove old backups
        find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f -mtime +${BACKUP_RETENTION_DAYS} -delete
        log_info "Old backups cleaned up (retention: $BACKUP_RETENTION_DAYS days)"
    else
        log_error "Database backup failed"
        return 1
    fi
}

# Function to cleanup old log files
cleanup_logs() {
    log_info "Cleaning up old log files..."
    
    # Remove maintenance logs older than retention period
    find "$LOG_DIR" -name "maintenance-*.log" -type f -mtime +${LOG_RETENTION_DAYS} -delete
    
    # Remove PostgreSQL logs older than retention period
    if [ -d "/var/log/postgresql" ]; then
        find "/var/log/postgresql" -name "postgresql-*.log" -type f -mtime +${LOG_RETENTION_DAYS} -delete
        find "/var/log/postgresql" -name "postgresql-*.csv" -type f -mtime +${LOG_RETENTION_DAYS} -delete
    fi
    
    log_info "Log cleanup completed"
}

# Function to collect performance metrics
collect_performance_metrics() {
    log_info "Collecting performance metrics..."
    
    # Database size and growth
    local db_size
    db_size=$(get_database_size)
    log_info "Current database size: $db_size"
    
    # Connection statistics
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT 
            datname,
            numbackends as active_connections,
            xact_commit,
            xact_rollback,
            blks_read,
            blks_hit,
            round(blks_hit::numeric/(blks_read+blks_hit+1)*100,2) as cache_hit_ratio
        FROM pg_stat_database 
        WHERE datname = '$DB_NAME';
    " >> "$LOG_FILE" 2>&1
    
    # Top slow queries
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT 
            query,
            calls,
            total_exec_time,
            mean_exec_time,
            rows
        FROM pg_stat_statements 
        ORDER BY total_exec_time DESC 
        LIMIT 10;
    " >> "$LOG_FILE" 2>&1
}

# Function to send maintenance report
send_maintenance_report() {
    log_info "Generating maintenance report..."
    
    local report_file="$LOG_DIR/maintenance-report-$(date +%Y%m%d).txt"
    
    cat > "$report_file" << EOF
Database Maintenance Report
Generated: $(date)
Database: $DB_NAME
Host: $DB_HOST

=== Summary ===
Database Size: $(get_database_size)
Maintenance Log: $LOG_FILE

=== Table Statistics ===
EOF
    
    get_table_stats >> "$report_file"
    
    cat >> "$report_file" << EOF

=== Performance Metrics ===
EOF
    
    collect_performance_metrics >> "$report_file"
    
    log_info "Maintenance report generated: $report_file"
}

# Main maintenance function
main() {
    log_info "Starting database maintenance for $DB_NAME"
    log_info "=============================================="
    
    # Check prerequisites
    check_connectivity
    
    # Record start time and database state
    local start_time
    start_time=$(date +%s)
    local initial_size
    initial_size=$(get_database_size)
    
    log_info "Initial database size: $initial_size"
    log_info "Starting maintenance operations..."
    
    # Perform maintenance tasks
    get_table_stats
    check_table_bloat
    check_unused_indexes
    
    # Core maintenance operations
    perform_analyze
    perform_vacuum
    update_statistics
    
    # Advanced maintenance (if needed)
    if [ "${FULL_MAINTENANCE:-false}" = "true" ]; then
        perform_reindex
        maintain_partitions
    fi
    
    # Monitoring and cleanup
    check_replication_lag
    cleanup_wal_files
    cleanup_logs
    
    # Backup (if enabled)
    if [ "${ENABLE_BACKUP:-false}" = "true" ]; then
        perform_backup
    fi
    
    # Performance metrics
    collect_performance_metrics
    
    # Generate report
    send_maintenance_report
    
    # Calculate maintenance duration
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local final_size
    final_size=$(get_database_size)
    
    log_info "=============================================="
    log_info "Database maintenance completed"
    log_info "Duration: ${duration} seconds"
    log_info "Initial size: $initial_size"
    log_info "Final size: $final_size"
    log_info "Log file: $LOG_FILE"
}

# Command line argument handling
case "${1:-maintenance}" in
    "vacuum")
        check_connectivity
        perform_vacuum
        ;;
    "analyze")
        check_connectivity
        perform_analyze
        ;;
    "reindex")
        check_connectivity
        perform_reindex
        ;;
    "backup")
        check_connectivity
        perform_backup
        ;;
    "partitions")
        check_connectivity
        maintain_partitions
        ;;
    "cleanup")
        cleanup_wal_files
        cleanup_logs
        ;;
    "stats")
        check_connectivity
        collect_performance_metrics
        ;;
    "full")
        FULL_MAINTENANCE=true
        ENABLE_BACKUP=true
        main
        ;;
    "maintenance"|*)
        main
        ;;
esac

log_info "Script execution completed"