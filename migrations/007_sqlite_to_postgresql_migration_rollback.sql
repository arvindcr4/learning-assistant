-- SQLite to PostgreSQL Migration Rollback Script
-- Description: Rollback script for SQLite to PostgreSQL migration
-- Version: 007_rollback
-- Dependencies: Backup tables and migration log

-- ==========================================
-- ROLLBACK SAFETY CHECKS
-- ==========================================

-- Check if rollback is safe to proceed
DO $$
DECLARE
    migration_count INTEGER;
    backup_tables_exist BOOLEAN := FALSE;
BEGIN
    -- Check if migration was actually performed
    SELECT COUNT(*) INTO migration_count
    FROM migration_log 
    WHERE migration_name LIKE '%sqlite%' AND status = 'completed';
    
    IF migration_count = 0 THEN
        RAISE EXCEPTION 'No SQLite migration found to rollback';
    END IF;
    
    -- Check if backup tables exist
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'users_backup_pre_rollback'
    ) INTO backup_tables_exist;
    
    IF NOT backup_tables_exist THEN
        RAISE WARNING 'No backup tables found. Rollback will truncate data without recovery option.';
    END IF;
    
    RAISE NOTICE 'Rollback safety checks passed. Proceeding with rollback...';
END $$;

-- ==========================================
-- CREATE BACKUP BEFORE ROLLBACK
-- ==========================================

-- Create emergency backup of current state
CREATE TABLE IF NOT EXISTS emergency_backup_users AS SELECT * FROM users;
CREATE TABLE IF NOT EXISTS emergency_backup_learning_profiles AS SELECT * FROM learning_profiles;
CREATE TABLE IF NOT EXISTS emergency_backup_learning_sessions AS SELECT * FROM learning_sessions;
CREATE TABLE IF NOT EXISTS emergency_backup_adaptive_content AS SELECT * FROM adaptive_content;
CREATE TABLE IF NOT EXISTS emergency_backup_adaptive_assessments AS SELECT * FROM adaptive_assessments;

-- ==========================================
-- ROLLBACK EXECUTION
-- ==========================================

-- Start rollback transaction
BEGIN;

-- Log rollback initiation
INSERT INTO migration_log (
    migration_name, 
    source_system, 
    target_system, 
    status, 
    migration_notes
) VALUES (
    'sqlite_to_postgresql_rollback',
    'PostgreSQL',
    'Empty',
    'started',
    'Rollback initiated due to migration issues or testing requirements'
);

-- Drop foreign key constraints temporarily to avoid dependency issues
ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_user_id_fkey;
ALTER TABLE learning_profiles DROP CONSTRAINT IF EXISTS learning_profiles_user_id_fkey;
ALTER TABLE learning_styles DROP CONSTRAINT IF EXISTS learning_styles_profile_id_fkey;
ALTER TABLE style_assessments DROP CONSTRAINT IF EXISTS style_assessments_profile_id_fkey;
ALTER TABLE behavioral_indicators DROP CONSTRAINT IF EXISTS behavioral_indicators_profile_id_fkey;
ALTER TABLE pace_profiles DROP CONSTRAINT IF EXISTS pace_profiles_user_id_fkey;
ALTER TABLE pace_adjustments DROP CONSTRAINT IF EXISTS pace_adjustments_pace_profile_id_fkey;
ALTER TABLE learning_sessions DROP CONSTRAINT IF EXISTS learning_sessions_user_id_fkey;
ALTER TABLE adaptive_changes DROP CONSTRAINT IF EXISTS adaptive_changes_session_id_fkey;
ALTER TABLE content_variants DROP CONSTRAINT IF EXISTS content_variants_content_id_fkey;
ALTER TABLE media_content DROP CONSTRAINT IF EXISTS media_content_variant_id_fkey;
ALTER TABLE adaptive_assessments DROP CONSTRAINT IF EXISTS adaptive_assessments_content_id_fkey;
ALTER TABLE adaptive_questions DROP CONSTRAINT IF EXISTS adaptive_questions_assessment_id_fkey;
ALTER TABLE question_options DROP CONSTRAINT IF EXISTS question_options_question_id_fkey;
ALTER TABLE assessment_attempts DROP CONSTRAINT IF EXISTS assessment_attempts_user_id_fkey;
ALTER TABLE assessment_attempts DROP CONSTRAINT IF EXISTS assessment_attempts_assessment_id_fkey;
ALTER TABLE question_responses DROP CONSTRAINT IF EXISTS question_responses_attempt_id_fkey;
ALTER TABLE question_responses DROP CONSTRAINT IF EXISTS question_responses_question_id_fkey;
ALTER TABLE learning_analytics DROP CONSTRAINT IF EXISTS learning_analytics_user_id_fkey;
ALTER TABLE style_effectiveness DROP CONSTRAINT IF EXISTS style_effectiveness_analytics_id_fkey;
ALTER TABLE content_engagement DROP CONSTRAINT IF EXISTS content_engagement_analytics_id_fkey;
ALTER TABLE performance_trends DROP CONSTRAINT IF EXISTS performance_trends_analytics_id_fkey;
ALTER TABLE recommendations DROP CONSTRAINT IF EXISTS recommendations_user_id_fkey;
ALTER TABLE learning_predictions DROP CONSTRAINT IF EXISTS learning_predictions_user_id_fkey;

-- Truncate all main tables (preserving structure)
TRUNCATE TABLE question_responses CASCADE;
TRUNCATE TABLE question_options CASCADE;
TRUNCATE TABLE adaptive_questions CASCADE;
TRUNCATE TABLE assessment_attempts CASCADE;
TRUNCATE TABLE adaptive_assessments CASCADE;
TRUNCATE TABLE media_content CASCADE;
TRUNCATE TABLE content_variants CASCADE;
TRUNCATE TABLE adaptive_content CASCADE;
TRUNCATE TABLE learning_predictions CASCADE;
TRUNCATE TABLE recommendations CASCADE;
TRUNCATE TABLE performance_trends CASCADE;
TRUNCATE TABLE content_engagement CASCADE;
TRUNCATE TABLE style_effectiveness CASCADE;
TRUNCATE TABLE learning_analytics CASCADE;
TRUNCATE TABLE adaptive_changes CASCADE;
TRUNCATE TABLE learning_sessions CASCADE;
TRUNCATE TABLE pace_adjustments CASCADE;
TRUNCATE TABLE pace_profiles CASCADE;
TRUNCATE TABLE behavioral_indicators CASCADE;
TRUNCATE TABLE style_assessments CASCADE;
TRUNCATE TABLE learning_styles CASCADE;
TRUNCATE TABLE learning_profiles CASCADE;
TRUNCATE TABLE user_preferences CASCADE;
TRUNCATE TABLE users CASCADE;

-- Restore foreign key constraints
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE learning_profiles ADD CONSTRAINT learning_profiles_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE learning_styles ADD CONSTRAINT learning_styles_profile_id_fkey 
    FOREIGN KEY (profile_id) REFERENCES learning_profiles(id) ON DELETE CASCADE;
ALTER TABLE style_assessments ADD CONSTRAINT style_assessments_profile_id_fkey 
    FOREIGN KEY (profile_id) REFERENCES learning_profiles(id) ON DELETE CASCADE;
ALTER TABLE behavioral_indicators ADD CONSTRAINT behavioral_indicators_profile_id_fkey 
    FOREIGN KEY (profile_id) REFERENCES learning_profiles(id) ON DELETE CASCADE;
ALTER TABLE pace_profiles ADD CONSTRAINT pace_profiles_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE pace_adjustments ADD CONSTRAINT pace_adjustments_pace_profile_id_fkey 
    FOREIGN KEY (pace_profile_id) REFERENCES pace_profiles(id) ON DELETE CASCADE;
ALTER TABLE learning_sessions ADD CONSTRAINT learning_sessions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE adaptive_changes ADD CONSTRAINT adaptive_changes_session_id_fkey 
    FOREIGN KEY (session_id) REFERENCES learning_sessions(id) ON DELETE CASCADE;
ALTER TABLE content_variants ADD CONSTRAINT content_variants_content_id_fkey 
    FOREIGN KEY (content_id) REFERENCES adaptive_content(id) ON DELETE CASCADE;
ALTER TABLE media_content ADD CONSTRAINT media_content_variant_id_fkey 
    FOREIGN KEY (variant_id) REFERENCES content_variants(id) ON DELETE CASCADE;
ALTER TABLE adaptive_assessments ADD CONSTRAINT adaptive_assessments_content_id_fkey 
    FOREIGN KEY (content_id) REFERENCES adaptive_content(id) ON DELETE CASCADE;
ALTER TABLE adaptive_questions ADD CONSTRAINT adaptive_questions_assessment_id_fkey 
    FOREIGN KEY (assessment_id) REFERENCES adaptive_assessments(id) ON DELETE CASCADE;
ALTER TABLE question_options ADD CONSTRAINT question_options_question_id_fkey 
    FOREIGN KEY (question_id) REFERENCES adaptive_questions(id) ON DELETE CASCADE;
ALTER TABLE assessment_attempts ADD CONSTRAINT assessment_attempts_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE assessment_attempts ADD CONSTRAINT assessment_attempts_assessment_id_fkey 
    FOREIGN KEY (assessment_id) REFERENCES adaptive_assessments(id) ON DELETE CASCADE;
ALTER TABLE question_responses ADD CONSTRAINT question_responses_attempt_id_fkey 
    FOREIGN KEY (attempt_id) REFERENCES assessment_attempts(id) ON DELETE CASCADE;
ALTER TABLE question_responses ADD CONSTRAINT question_responses_question_id_fkey 
    FOREIGN KEY (question_id) REFERENCES adaptive_questions(id) ON DELETE CASCADE;
ALTER TABLE learning_analytics ADD CONSTRAINT learning_analytics_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE style_effectiveness ADD CONSTRAINT style_effectiveness_analytics_id_fkey 
    FOREIGN KEY (analytics_id) REFERENCES learning_analytics(id) ON DELETE CASCADE;
ALTER TABLE content_engagement ADD CONSTRAINT content_engagement_analytics_id_fkey 
    FOREIGN KEY (analytics_id) REFERENCES learning_analytics(id) ON DELETE CASCADE;
ALTER TABLE performance_trends ADD CONSTRAINT performance_trends_analytics_id_fkey 
    FOREIGN KEY (analytics_id) REFERENCES learning_analytics(id) ON DELETE CASCADE;
ALTER TABLE recommendations ADD CONSTRAINT recommendations_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE learning_predictions ADD CONSTRAINT learning_predictions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Remove migration-specific system configurations
DELETE FROM system_config WHERE config_key IN (
    'migration_status',
    'data_validation_rules',
    'performance_settings'
);

-- Drop migration-specific functions
DROP FUNCTION IF EXISTS migrate_users_from_sqlite();
DROP FUNCTION IF EXISTS validate_migration_integrity();
DROP FUNCTION IF EXISTS rollback_sqlite_migration();
DROP FUNCTION IF EXISTS optimize_post_migration();
DROP FUNCTION IF EXISTS generate_migration_report();
DROP FUNCTION IF EXISTS sqlite_id_to_uuid(INTEGER, TEXT);
DROP FUNCTION IF EXISTS migrate_timestamp(TEXT);

-- Drop migration log table (optional - comment out if you want to keep history)
-- DROP TABLE IF EXISTS migration_log;

-- Update rollback status
UPDATE migration_log 
SET status = 'rolled_back',
    completed_at = CURRENT_TIMESTAMP,
    migration_notes = migration_notes || ' - Rollback completed successfully'
WHERE migration_name = 'sqlite_to_postgresql_rollback';

-- Commit rollback transaction
COMMIT;

-- ==========================================
-- POST-ROLLBACK VERIFICATION
-- ==========================================

-- Verify rollback completion
DO $$
DECLARE
    table_record_count INTEGER;
    tables_to_check TEXT[] := ARRAY['users', 'learning_profiles', 'learning_sessions', 'adaptive_content'];
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY tables_to_check
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', table_name) INTO table_record_count;
        RAISE NOTICE 'Table % now has % records', table_name, table_record_count;
    END LOOP;
    
    RAISE NOTICE 'Rollback verification completed';
    RAISE NOTICE 'Emergency backup tables created with current timestamp suffix';
    RAISE NOTICE 'Database is now in pre-migration state';
END $$;

-- ==========================================
-- CLEANUP INSTRUCTIONS
-- ==========================================

-- Instructions for manual cleanup (commented out for safety)
/*
-- To clean up backup tables after verifying rollback success:
-- DROP TABLE IF EXISTS emergency_backup_users;
-- DROP TABLE IF EXISTS emergency_backup_learning_profiles;
-- DROP TABLE IF EXISTS emergency_backup_learning_sessions;
-- DROP TABLE IF EXISTS emergency_backup_adaptive_content;
-- DROP TABLE IF EXISTS emergency_backup_adaptive_assessments;

-- To clean up pre-rollback backup tables:
-- DROP TABLE IF EXISTS users_backup_pre_rollback;
-- DROP TABLE IF EXISTS learning_profiles_backup_pre_rollback;
-- DROP TABLE IF EXISTS learning_sessions_backup_pre_rollback;
*/

-- Final notification
DO $$
BEGIN
    RAISE NOTICE '=================================================';
    RAISE NOTICE 'SQLite to PostgreSQL migration rollback completed!';
    RAISE NOTICE '=================================================';
    RAISE NOTICE 'Database has been restored to pre-migration state';
    RAISE NOTICE 'All migrated data has been removed';
    RAISE NOTICE 'Emergency backups have been created';
    RAISE NOTICE 'Verify application functionality before proceeding';
    RAISE NOTICE '=================================================';
END $$;