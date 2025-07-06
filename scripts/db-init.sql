-- Database initialization script
-- This script runs after the main schema is created

-- Create additional database users if needed
DO $$
BEGIN
    -- Create read-only user for analytics
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'analytics_user') THEN
        CREATE ROLE analytics_user WITH LOGIN PASSWORD 'analytics_password';
        GRANT CONNECT ON DATABASE learning_assistant_db TO analytics_user;
        GRANT USAGE ON SCHEMA public TO analytics_user;
        GRANT SELECT ON ALL TABLES IN SCHEMA public TO analytics_user;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO analytics_user;
    END IF;

    -- Create backup user
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'backup_user') THEN
        CREATE ROLE backup_user WITH LOGIN PASSWORD 'backup_password';
        GRANT CONNECT ON DATABASE learning_assistant_db TO backup_user;
        GRANT USAGE ON SCHEMA public TO backup_user;
        GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_user;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO backup_user;
    END IF;
END
$$;

-- Create database extensions if not exists
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Create custom functions for migrations
CREATE OR REPLACE FUNCTION get_migration_version() RETURNS INTEGER AS $$
BEGIN
    RETURN COALESCE(
        (SELECT MAX(version) FROM migration_history),
        0
    );
END;
$$ LANGUAGE plpgsql;

-- Create migration history table
CREATE TABLE IF NOT EXISTS migration_history (
    id SERIAL PRIMARY KEY,
    version INTEGER NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    execution_time INTEGER, -- milliseconds
    checksum VARCHAR(64),
    success BOOLEAN DEFAULT TRUE
);

-- Insert initial migration record
INSERT INTO migration_history (version, name, checksum) 
VALUES (1, 'initial_schema', md5('initial_schema_v1'))
ON CONFLICT (version) DO NOTHING;

-- Create function to log performance metrics
CREATE OR REPLACE FUNCTION log_performance_metric(
    metric_name TEXT,
    metric_value NUMERIC,
    metric_unit TEXT DEFAULT 'ms'
) RETURNS VOID AS $$
BEGIN
    INSERT INTO system_config (config_key, config_value, description)
    VALUES (
        'performance_' || metric_name || '_' || extract(epoch from now())::text,
        json_build_object(
            'value', metric_value,
            'unit', metric_unit,
            'timestamp', now()
        ),
        'Performance metric: ' || metric_name
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to cleanup old sessions
CREATE OR REPLACE FUNCTION cleanup_old_sessions() RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM learning_sessions 
    WHERE created_at < NOW() - INTERVAL '90 days'
    AND completed = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log cleanup operation
    INSERT INTO system_config (config_key, config_value, description)
    VALUES (
        'cleanup_sessions_' || extract(epoch from now())::text,
        json_build_object(
            'deleted_count', deleted_count,
            'timestamp', now()
        ),
        'Session cleanup operation'
    );
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to optimize database
CREATE OR REPLACE FUNCTION optimize_database() RETURNS TEXT AS $$
DECLARE
    result TEXT := '';
BEGIN
    -- Analyze all tables
    ANALYZE;
    result := result || 'ANALYZE completed. ';
    
    -- Vacuum analyze high-traffic tables
    VACUUM ANALYZE users;
    VACUUM ANALYZE learning_sessions;
    VACUUM ANALYZE behavioral_indicators;
    result := result || 'VACUUM ANALYZE completed for high-traffic tables. ';
    
    -- Update statistics
    SELECT pg_stat_reset();
    result := result || 'Statistics reset. ';
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance if they don't exist
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_sessions_user_created 
ON learning_sessions(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_behavioral_indicators_profile_timestamp 
ON behavioral_indicators(profile_id, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_question_responses_attempt_created 
ON question_responses(attempt_id, response_time DESC);

-- Create partial indexes for active data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_learning_sessions 
ON learning_sessions(user_id, start_time DESC) 
WHERE end_time IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recent_recommendations 
ON recommendations(user_id, created_at DESC) 
WHERE status = 'active' AND created_at > NOW() - INTERVAL '30 days';

-- Insert default configuration if not exists
INSERT INTO system_config (config_key, config_value, description) VALUES
('database_version', '"1.0.0"', 'Current database schema version'),
('maintenance_mode', 'false', 'System maintenance mode flag'),
('backup_retention_days', '30', 'Number of days to retain backups'),
('session_timeout_minutes', '30', 'User session timeout in minutes'),
('max_concurrent_sessions', '1000', 'Maximum concurrent user sessions')
ON CONFLICT (config_key) DO NOTHING;

-- Create materialized view for analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS user_analytics_summary AS
SELECT 
    u.id as user_id,
    u.name,
    u.email,
    COUNT(DISTINCT ls.id) as total_sessions,
    COALESCE(SUM(ls.duration), 0) as total_time_spent,
    COALESCE(AVG(CASE WHEN ls.total_questions > 0 THEN ls.correct_answers::DECIMAL / ls.total_questions * 100 ELSE 0 END), 0) as average_score,
    COUNT(DISTINCT DATE(ls.start_time)) as active_days,
    MAX(ls.start_time) as last_activity,
    lp.dominant_style,
    pp.current_pace,
    pp.optimal_pace
FROM users u
LEFT JOIN learning_sessions ls ON u.id = ls.user_id
LEFT JOIN learning_profiles lp ON u.id = lp.user_id
LEFT JOIN pace_profiles pp ON u.id = pp.user_id
GROUP BY u.id, u.name, u.email, lp.dominant_style, pp.current_pace, pp.optimal_pace;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_user_analytics_summary_user_id ON user_analytics_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_user_analytics_summary_last_activity ON user_analytics_summary(last_activity DESC);

-- Schedule regular maintenance tasks
-- Note: This would typically be done via cron or a job scheduler
-- INSERT INTO system_config (config_key, config_value, description) VALUES
-- ('scheduled_tasks', '{"cleanup_sessions": "0 2 * * *", "optimize_database": "0 3 * * 0", "refresh_analytics": "0 4 * * *"}', 'Scheduled maintenance tasks');

COMMIT;