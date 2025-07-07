-- Migration 005: Migration System Improvements
-- Enhance migration system with lock mechanism, better validation, and checksum verification

-- ==========================================
-- CREATE MIGRATION LOCK TABLE
-- ==========================================

-- Migration lock table to prevent concurrent migrations
CREATE TABLE IF NOT EXISTS migration_lock (
    id INTEGER PRIMARY KEY DEFAULT 1,
    locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    locked_by VARCHAR(255) NOT NULL,
    process_id INTEGER,
    hostname VARCHAR(255),
    migration_name VARCHAR(255),
    CONSTRAINT only_one_lock CHECK (id = 1)
);

-- Insert initial unlocked state
INSERT INTO migration_lock (id, locked_at, locked_by, process_id, hostname, migration_name) 
VALUES (1, NULL, '', NULL, '', '') 
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- ENHANCE MIGRATION HISTORY TABLE
-- ==========================================

-- Add columns for better migration tracking
ALTER TABLE migration_history 
ADD COLUMN IF NOT EXISTS rollback_checksum VARCHAR(64),
ADD COLUMN IF NOT EXISTS migration_file_path TEXT,
ADD COLUMN IF NOT EXISTS rollback_file_path TEXT,
ADD COLUMN IF NOT EXISTS applied_by VARCHAR(255) DEFAULT CURRENT_USER,
ADD COLUMN IF NOT EXISTS rollback_executed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS rollback_execution_time INTEGER,
ADD COLUMN IF NOT EXISTS rollback_success BOOLEAN,
ADD COLUMN IF NOT EXISTS migration_size_bytes INTEGER,
ADD COLUMN IF NOT EXISTS database_version VARCHAR(50),
ADD COLUMN IF NOT EXISTS application_version VARCHAR(50),
ADD COLUMN IF NOT EXISTS environment VARCHAR(50) DEFAULT COALESCE(current_setting('app.environment', true), 'unknown'),
ADD COLUMN IF NOT EXISTS prerequisites TEXT[],
ADD COLUMN IF NOT EXISTS validation_queries TEXT[],
ADD COLUMN IF NOT EXISTS post_migration_checks TEXT[];

-- Add constraints for data validation
ALTER TABLE migration_history 
ADD CONSTRAINT migration_history_version_positive CHECK (version > 0),
ADD CONSTRAINT migration_history_execution_time_non_negative CHECK (execution_time IS NULL OR execution_time >= 0),
ADD CONSTRAINT migration_history_rollback_execution_time_non_negative CHECK (rollback_execution_time IS NULL OR rollback_execution_time >= 0),
ADD CONSTRAINT migration_history_migration_size_positive CHECK (migration_size_bytes IS NULL OR migration_size_bytes > 0),
ADD CONSTRAINT migration_history_rollback_after_migration CHECK (rollback_executed_at IS NULL OR rollback_executed_at >= executed_at);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_migration_history_executed_at ON migration_history(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_migration_history_environment ON migration_history(environment);
CREATE INDEX IF NOT EXISTS idx_migration_history_success ON migration_history(success);

-- ==========================================
-- MIGRATION SYSTEM FUNCTIONS
-- ==========================================

-- Function to acquire migration lock
CREATE OR REPLACE FUNCTION acquire_migration_lock(
    p_locked_by VARCHAR(255),
    p_migration_name VARCHAR(255) DEFAULT NULL,
    p_timeout_seconds INTEGER DEFAULT 300
) RETURNS BOOLEAN AS $$
DECLARE
    lock_acquired BOOLEAN := FALSE;
    current_lock_time TIMESTAMP;
    lock_age_seconds INTEGER;
BEGIN
    -- Check if lock is available or expired
    SELECT locked_at INTO current_lock_time FROM migration_lock WHERE id = 1;
    
    -- Calculate lock age
    IF current_lock_time IS NOT NULL THEN
        lock_age_seconds := EXTRACT(EPOCH FROM (NOW() - current_lock_time));
        
        -- If lock is too old, consider it stale and release it
        IF lock_age_seconds > p_timeout_seconds THEN
            RAISE WARNING 'Releasing stale migration lock (age: % seconds)', lock_age_seconds;
            UPDATE migration_lock SET 
                locked_at = NULL, 
                locked_by = '', 
                process_id = NULL, 
                hostname = '', 
                migration_name = ''
            WHERE id = 1;
            current_lock_time := NULL;
        END IF;
    END IF;
    
    -- Try to acquire lock
    IF current_lock_time IS NULL THEN
        UPDATE migration_lock SET 
            locked_at = NOW(),
            locked_by = p_locked_by,
            process_id = pg_backend_pid(),
            hostname = COALESCE(current_setting('app.hostname', true), 'unknown'),
            migration_name = COALESCE(p_migration_name, '')
        WHERE id = 1 AND locked_at IS NULL;
        
        GET DIAGNOSTICS lock_acquired = FOUND;
    END IF;
    
    RETURN lock_acquired;
END;
$$ LANGUAGE plpgsql;

-- Function to release migration lock
CREATE OR REPLACE FUNCTION release_migration_lock(
    p_locked_by VARCHAR(255)
) RETURNS BOOLEAN AS $$
DECLARE
    lock_released BOOLEAN := FALSE;
BEGIN
    UPDATE migration_lock SET 
        locked_at = NULL,
        locked_by = '',
        process_id = NULL,
        hostname = '',
        migration_name = ''
    WHERE id = 1 AND locked_by = p_locked_by;
    
    GET DIAGNOSTICS lock_released = FOUND;
    
    RETURN lock_released;
END;
$$ LANGUAGE plpgsql;

-- Function to check migration lock status
CREATE OR REPLACE FUNCTION check_migration_lock() 
RETURNS TABLE (
    is_locked BOOLEAN,
    locked_at TIMESTAMP,
    locked_by VARCHAR(255),
    process_id INTEGER,
    hostname VARCHAR(255),
    migration_name VARCHAR(255),
    lock_age_seconds INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (ml.locked_at IS NOT NULL) as is_locked,
        ml.locked_at,
        ml.locked_by,
        ml.process_id,
        ml.hostname,
        ml.migration_name,
        CASE 
            WHEN ml.locked_at IS NOT NULL THEN EXTRACT(EPOCH FROM (NOW() - ml.locked_at))::INTEGER
            ELSE NULL
        END as lock_age_seconds
    FROM migration_lock ml
    WHERE ml.id = 1;
END;
$$ LANGUAGE plpgsql;

-- Function to validate migration checksum
CREATE OR REPLACE FUNCTION validate_migration_checksum(
    p_version INTEGER,
    p_content TEXT,
    p_expected_checksum VARCHAR(64) DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    calculated_checksum VARCHAR(64);
    stored_checksum VARCHAR(64);
BEGIN
    -- Calculate checksum of content
    calculated_checksum := md5(p_content);
    
    -- Get stored checksum if migration exists
    SELECT checksum INTO stored_checksum 
    FROM migration_history 
    WHERE version = p_version AND success = true;
    
    -- If expected checksum is provided, validate against it
    IF p_expected_checksum IS NOT NULL THEN
        RETURN calculated_checksum = p_expected_checksum;
    END IF;
    
    -- If migration already exists, validate against stored checksum
    IF stored_checksum IS NOT NULL THEN
        RETURN calculated_checksum = stored_checksum;
    END IF;
    
    -- New migration, checksum is valid
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to record migration with enhanced tracking
CREATE OR REPLACE FUNCTION record_migration(
    p_version INTEGER,
    p_name VARCHAR(255),
    p_checksum VARCHAR(64),
    p_rollback_checksum VARCHAR(64) DEFAULT NULL,
    p_migration_file_path TEXT DEFAULT NULL,
    p_rollback_file_path TEXT DEFAULT NULL,
    p_execution_time INTEGER DEFAULT NULL,
    p_migration_size_bytes INTEGER DEFAULT NULL,
    p_database_version VARCHAR(50) DEFAULT NULL,
    p_application_version VARCHAR(50) DEFAULT NULL,
    p_environment VARCHAR(50) DEFAULT NULL,
    p_prerequisites TEXT[] DEFAULT NULL,
    p_validation_queries TEXT[] DEFAULT NULL,
    p_post_migration_checks TEXT[] DEFAULT NULL,
    p_success BOOLEAN DEFAULT TRUE
) RETURNS VOID AS $$
BEGIN
    INSERT INTO migration_history (
        version, name, checksum, rollback_checksum, migration_file_path, 
        rollback_file_path, executed_at, execution_time, migration_size_bytes,
        database_version, application_version, environment, prerequisites,
        validation_queries, post_migration_checks, success, applied_by
    ) VALUES (
        p_version, p_name, p_checksum, p_rollback_checksum, p_migration_file_path,
        p_rollback_file_path, NOW(), p_execution_time, p_migration_size_bytes,
        p_database_version, p_application_version, 
        COALESCE(p_environment, current_setting('app.environment', true), 'unknown'),
        p_prerequisites, p_validation_queries, p_post_migration_checks, p_success, CURRENT_USER
    )
    ON CONFLICT (version) DO UPDATE SET
        executed_at = NOW(),
        execution_time = p_execution_time,
        success = p_success,
        applied_by = CURRENT_USER;
END;
$$ LANGUAGE plpgsql;

-- Function to record rollback
CREATE OR REPLACE FUNCTION record_rollback(
    p_version INTEGER,
    p_rollback_execution_time INTEGER DEFAULT NULL,
    p_rollback_success BOOLEAN DEFAULT TRUE
) RETURNS VOID AS $$
BEGIN
    UPDATE migration_history SET
        rollback_executed_at = NOW(),
        rollback_execution_time = p_rollback_execution_time,
        rollback_success = p_rollback_success
    WHERE version = p_version;
    
    -- If rollback was successful, mark migration as not applied
    IF p_rollback_success THEN
        UPDATE migration_history SET
            success = FALSE
        WHERE version = p_version;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to validate migration prerequisites
CREATE OR REPLACE FUNCTION validate_migration_prerequisites(
    p_prerequisites TEXT[]
) RETURNS BOOLEAN AS $$
DECLARE
    prerequisite TEXT;
    prerequisite_met BOOLEAN;
BEGIN
    -- If no prerequisites, validation passes
    IF p_prerequisites IS NULL OR array_length(p_prerequisites, 1) = 0 THEN
        RETURN TRUE;
    END IF;
    
    -- Check each prerequisite
    FOREACH prerequisite IN ARRAY p_prerequisites
    LOOP
        -- Check if prerequisite migration exists and was successful
        SELECT EXISTS(
            SELECT 1 FROM migration_history 
            WHERE name = prerequisite AND success = true
        ) INTO prerequisite_met;
        
        IF NOT prerequisite_met THEN
            RAISE WARNING 'Migration prerequisite not met: %', prerequisite;
            RETURN FALSE;
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to run post-migration validation checks
CREATE OR REPLACE FUNCTION run_post_migration_checks(
    p_validation_queries TEXT[]
) RETURNS BOOLEAN AS $$
DECLARE
    validation_query TEXT;
    result BOOLEAN;
BEGIN
    -- If no validation queries, validation passes
    IF p_validation_queries IS NULL OR array_length(p_validation_queries, 1) = 0 THEN
        RETURN TRUE;
    END IF;
    
    -- Run each validation query
    FOREACH validation_query IN ARRAY p_validation_queries
    LOOP
        BEGIN
            EXECUTE validation_query INTO result;
            IF NOT COALESCE(result, FALSE) THEN
                RAISE WARNING 'Post-migration validation failed: %', validation_query;
                RETURN FALSE;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Post-migration validation error for query "%": %', validation_query, SQLERRM;
            RETURN FALSE;
        END;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to get migration status
CREATE OR REPLACE FUNCTION get_migration_status()
RETURNS TABLE (
    current_version INTEGER,
    total_migrations INTEGER,
    successful_migrations INTEGER,
    failed_migrations INTEGER,
    rollbacks_performed INTEGER,
    last_migration_at TIMESTAMP,
    last_migration_name VARCHAR(255),
    last_migration_success BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(MAX(CASE WHEN success THEN version END), 0) as current_version,
        COUNT(*)::INTEGER as total_migrations,
        COUNT(CASE WHEN success THEN 1 END)::INTEGER as successful_migrations,
        COUNT(CASE WHEN NOT success THEN 1 END)::INTEGER as failed_migrations,
        COUNT(CASE WHEN rollback_executed_at IS NOT NULL THEN 1 END)::INTEGER as rollbacks_performed,
        MAX(executed_at) as last_migration_at,
        (SELECT name FROM migration_history WHERE executed_at = MAX(mh.executed_at) LIMIT 1) as last_migration_name,
        (SELECT success FROM migration_history WHERE executed_at = MAX(mh.executed_at) LIMIT 1) as last_migration_success
    FROM migration_history mh;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- MIGRATION VALIDATION VIEWS
-- ==========================================

-- View for migration status overview
CREATE OR REPLACE VIEW migration_status_overview AS
SELECT 
    version,
    name,
    executed_at,
    execution_time,
    success,
    applied_by,
    environment,
    CASE 
        WHEN rollback_executed_at IS NOT NULL THEN 'ROLLED_BACK'
        WHEN success THEN 'SUCCESS'
        ELSE 'FAILED'
    END as status,
    CASE 
        WHEN execution_time IS NOT NULL THEN 
            CASE 
                WHEN execution_time < 1000 THEN 'FAST'
                WHEN execution_time < 10000 THEN 'MEDIUM'
                ELSE 'SLOW'
            END
        ELSE 'UNKNOWN'
    END as performance_category
FROM migration_history
ORDER BY version DESC;

-- View for migration integrity check
CREATE OR REPLACE VIEW migration_integrity_check AS
SELECT 
    version,
    name,
    CASE 
        WHEN checksum IS NULL THEN 'NO_CHECKSUM'
        WHEN rollback_checksum IS NULL THEN 'NO_ROLLBACK_CHECKSUM'
        ELSE 'OK'
    END as checksum_status,
    CASE 
        WHEN migration_file_path IS NULL THEN 'NO_FILE_PATH'
        ELSE 'OK'
    END as file_path_status,
    CASE 
        WHEN prerequisites IS NOT NULL AND array_length(prerequisites, 1) > 0 THEN 'HAS_PREREQUISITES'
        ELSE 'NO_PREREQUISITES'
    END as prerequisite_status,
    CASE 
        WHEN post_migration_checks IS NOT NULL AND array_length(post_migration_checks, 1) > 0 THEN 'HAS_VALIDATION'
        ELSE 'NO_VALIDATION'
    END as validation_status
FROM migration_history
ORDER BY version;

-- ==========================================
-- SECURITY AND PERMISSIONS
-- ==========================================

-- Grant permissions to migration functions
GRANT EXECUTE ON FUNCTION acquire_migration_lock(VARCHAR, VARCHAR, INTEGER) TO PUBLIC;
GRANT EXECUTE ON FUNCTION release_migration_lock(VARCHAR) TO PUBLIC;
GRANT EXECUTE ON FUNCTION check_migration_lock() TO PUBLIC;
GRANT EXECUTE ON FUNCTION validate_migration_checksum(INTEGER, TEXT, VARCHAR) TO PUBLIC;
GRANT EXECUTE ON FUNCTION record_migration(INTEGER, VARCHAR, VARCHAR, VARCHAR, TEXT, TEXT, INTEGER, INTEGER, VARCHAR, VARCHAR, VARCHAR, TEXT[], TEXT[], TEXT[], BOOLEAN) TO PUBLIC;
GRANT EXECUTE ON FUNCTION record_rollback(INTEGER, INTEGER, BOOLEAN) TO PUBLIC;
GRANT EXECUTE ON FUNCTION validate_migration_prerequisites(TEXT[]) TO PUBLIC;
GRANT EXECUTE ON FUNCTION run_post_migration_checks(TEXT[]) TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_migration_status() TO PUBLIC;

-- Grant permissions to migration tables and views
GRANT SELECT, INSERT, UPDATE ON migration_history TO PUBLIC;
GRANT SELECT, UPDATE ON migration_lock TO PUBLIC;
GRANT SELECT ON migration_status_overview TO PUBLIC;
GRANT SELECT ON migration_integrity_check TO PUBLIC;

-- ==========================================
-- DOCUMENTATION
-- ==========================================

COMMENT ON TABLE migration_lock IS 'Prevents concurrent migration execution';
COMMENT ON TABLE migration_history IS 'Enhanced migration tracking with rollback support and validation';

COMMENT ON FUNCTION acquire_migration_lock(VARCHAR, VARCHAR, INTEGER) IS 'Acquires exclusive lock for migration execution';
COMMENT ON FUNCTION release_migration_lock(VARCHAR) IS 'Releases migration lock';
COMMENT ON FUNCTION check_migration_lock() IS 'Returns current migration lock status';
COMMENT ON FUNCTION validate_migration_checksum(INTEGER, TEXT, VARCHAR) IS 'Validates migration content against checksum';
COMMENT ON FUNCTION record_migration(INTEGER, VARCHAR, VARCHAR, VARCHAR, TEXT, TEXT, INTEGER, INTEGER, VARCHAR, VARCHAR, VARCHAR, TEXT[], TEXT[], TEXT[], BOOLEAN) IS 'Records migration execution with enhanced metadata';
COMMENT ON FUNCTION record_rollback(INTEGER, INTEGER, BOOLEAN) IS 'Records migration rollback execution';
COMMENT ON FUNCTION validate_migration_prerequisites(TEXT[]) IS 'Validates migration prerequisites are met';
COMMENT ON FUNCTION run_post_migration_checks(TEXT[]) IS 'Runs post-migration validation checks';
COMMENT ON FUNCTION get_migration_status() IS 'Returns overall migration system status';

COMMENT ON VIEW migration_status_overview IS 'Provides overview of migration execution status';
COMMENT ON VIEW migration_integrity_check IS 'Checks migration data integrity and completeness';

-- Insert migration record
INSERT INTO migration_history (version, name, checksum, executed_at) 
VALUES (5, 'migration_system_improvements', md5('migration_system_improvements_v1'), NOW());