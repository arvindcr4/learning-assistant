-- Rollback for Migration 005: Remove Migration System Improvements
-- Remove all enhancements to migration system

-- ==========================================
-- REMOVE PERMISSIONS
-- ==========================================

REVOKE SELECT ON migration_integrity_check FROM PUBLIC;
REVOKE SELECT ON migration_status_overview FROM PUBLIC;
REVOKE SELECT, UPDATE ON migration_lock FROM PUBLIC;
REVOKE SELECT, INSERT, UPDATE ON migration_history FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION get_migration_status() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION run_post_migration_checks(TEXT[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION validate_migration_prerequisites(TEXT[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION record_rollback(INTEGER, INTEGER, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION record_migration(INTEGER, VARCHAR, VARCHAR, VARCHAR, TEXT, TEXT, INTEGER, INTEGER, VARCHAR, VARCHAR, VARCHAR, TEXT[], TEXT[], TEXT[], BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION validate_migration_checksum(INTEGER, TEXT, VARCHAR) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION check_migration_lock() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION release_migration_lock(VARCHAR) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION acquire_migration_lock(VARCHAR, VARCHAR, INTEGER) FROM PUBLIC;

-- ==========================================
-- REMOVE VIEWS
-- ==========================================

DROP VIEW IF EXISTS migration_integrity_check;
DROP VIEW IF EXISTS migration_status_overview;

-- ==========================================
-- REMOVE FUNCTIONS
-- ==========================================

DROP FUNCTION IF EXISTS get_migration_status();
DROP FUNCTION IF EXISTS run_post_migration_checks(TEXT[]);
DROP FUNCTION IF EXISTS validate_migration_prerequisites(TEXT[]);
DROP FUNCTION IF EXISTS record_rollback(INTEGER, INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS record_migration(INTEGER, VARCHAR, VARCHAR, VARCHAR, TEXT, TEXT, INTEGER, INTEGER, VARCHAR, VARCHAR, VARCHAR, TEXT[], TEXT[], TEXT[], BOOLEAN);
DROP FUNCTION IF EXISTS validate_migration_checksum(INTEGER, TEXT, VARCHAR);
DROP FUNCTION IF EXISTS check_migration_lock();
DROP FUNCTION IF EXISTS release_migration_lock(VARCHAR);
DROP FUNCTION IF EXISTS acquire_migration_lock(VARCHAR, VARCHAR, INTEGER);

-- ==========================================
-- REMOVE INDEXES
-- ==========================================

DROP INDEX IF EXISTS idx_migration_history_success;
DROP INDEX IF EXISTS idx_migration_history_environment;
DROP INDEX IF EXISTS idx_migration_history_executed_at;

-- ==========================================
-- REMOVE CONSTRAINTS
-- ==========================================

ALTER TABLE migration_history DROP CONSTRAINT IF EXISTS migration_history_rollback_after_migration;
ALTER TABLE migration_history DROP CONSTRAINT IF EXISTS migration_history_migration_size_positive;
ALTER TABLE migration_history DROP CONSTRAINT IF EXISTS migration_history_rollback_execution_time_non_negative;
ALTER TABLE migration_history DROP CONSTRAINT IF EXISTS migration_history_execution_time_non_negative;
ALTER TABLE migration_history DROP CONSTRAINT IF EXISTS migration_history_version_positive;

-- ==========================================
-- REMOVE COLUMNS FROM MIGRATION_HISTORY
-- ==========================================

ALTER TABLE migration_history 
DROP COLUMN IF EXISTS post_migration_checks,
DROP COLUMN IF EXISTS validation_queries,
DROP COLUMN IF EXISTS prerequisites,
DROP COLUMN IF EXISTS environment,
DROP COLUMN IF EXISTS application_version,
DROP COLUMN IF EXISTS database_version,
DROP COLUMN IF EXISTS migration_size_bytes,
DROP COLUMN IF EXISTS rollback_success,
DROP COLUMN IF EXISTS rollback_execution_time,
DROP COLUMN IF EXISTS rollback_executed_at,
DROP COLUMN IF EXISTS applied_by,
DROP COLUMN IF EXISTS rollback_file_path,
DROP COLUMN IF EXISTS migration_file_path,
DROP COLUMN IF EXISTS rollback_checksum;

-- ==========================================
-- REMOVE MIGRATION LOCK TABLE
-- ==========================================

DROP TABLE IF EXISTS migration_lock;

-- Remove migration record
DELETE FROM migration_history WHERE version = 5;