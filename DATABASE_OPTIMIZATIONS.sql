-- Database Performance Optimization Script
-- Personal Learning Assistant Database Schema Enhancements
-- PostgreSQL Database Schema for Adaptive Learning System

-- ===========================================================================
-- PART 1: ENHANCED INDEXING STRATEGY
-- ===========================================================================

-- Drop existing indexes if they exist (be careful in production)
DROP INDEX IF EXISTS idx_user_sessions_recent;
DROP INDEX IF EXISTS idx_user_assessments_recent;
DROP INDEX IF EXISTS idx_content_style_difficulty;
DROP INDEX IF EXISTS idx_behavioral_indicators_user_time;
DROP INDEX IF EXISTS idx_recommendations_user_active;
DROP INDEX IF EXISTS idx_active_recommendations;
DROP INDEX IF EXISTS idx_completed_sessions;
DROP INDEX IF EXISTS idx_high_confidence_styles;

-- PRIMARY PERFORMANCE INDEXES
-- These indexes cover the most common query patterns

-- 1. User-based queries (most common pattern)
CREATE INDEX CONCURRENTLY idx_learning_sessions_user_time 
ON learning_sessions(user_id, start_time DESC) 
WHERE completed = true;

CREATE INDEX CONCURRENTLY idx_assessment_attempts_user_recent 
ON assessment_attempts(user_id, started_at DESC);

CREATE INDEX CONCURRENTLY idx_question_responses_attempt_correct 
ON question_responses(attempt_id, is_correct, response_time DESC);

CREATE INDEX CONCURRENTLY idx_behavioral_indicators_profile_time 
ON behavioral_indicators(profile_id, timestamp DESC);

CREATE INDEX CONCURRENTLY idx_adaptive_changes_session_time 
ON adaptive_changes(session_id, timestamp DESC);

-- 2. Content-based queries
CREATE INDEX CONCURRENTLY idx_content_variants_style_format 
ON content_variants(style_type, format, content_id);

CREATE INDEX CONCURRENTLY idx_adaptive_content_difficulty_concept 
ON adaptive_content(difficulty, concept);

CREATE INDEX CONCURRENTLY idx_adaptive_content_tags_gin 
ON adaptive_content USING gin(tags);

CREATE INDEX CONCURRENTLY idx_adaptive_content_prerequisites_gin 
ON adaptive_content USING gin(prerequisites);

-- 3. Assessment and question queries
CREATE INDEX CONCURRENTLY idx_adaptive_questions_assessment_difficulty 
ON adaptive_questions(assessment_id, difficulty);

CREATE INDEX CONCURRENTLY idx_question_options_question_correct 
ON question_options(question_id, is_correct);

-- 4. Analytics and recommendations
CREATE INDEX CONCURRENTLY idx_learning_analytics_user_timerange 
ON learning_analytics(user_id, time_range_start, time_range_end);

CREATE INDEX CONCURRENTLY idx_recommendations_user_status_priority 
ON recommendations(user_id, status, priority, created_at DESC) 
WHERE status = 'active';

CREATE INDEX CONCURRENTLY idx_style_effectiveness_analytics_style 
ON style_effectiveness(analytics_id, style_type, engagement_score DESC);

CREATE INDEX CONCURRENTLY idx_content_engagement_analytics_score 
ON content_engagement(analytics_id, engagement_score DESC);

-- 5. Performance trend queries
CREATE INDEX CONCURRENTLY idx_performance_trends_analytics_metric 
ON performance_trends(analytics_id, metric, time_range_start);

CREATE INDEX CONCURRENTLY idx_learning_predictions_user_target 
ON learning_predictions(user_id, target_date, confidence DESC);

-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- These indexes support multi-column WHERE clauses and ORDER BY

-- User learning overview queries
CREATE INDEX CONCURRENTLY idx_learning_sessions_user_content_time 
ON learning_sessions(user_id, content_id, start_time DESC);

CREATE INDEX CONCURRENTLY idx_learning_sessions_user_completed_score 
ON learning_sessions(user_id, completed, correct_answers, total_questions) 
WHERE completed = true AND total_questions > 0;

-- Content effectiveness queries
CREATE INDEX CONCURRENTLY idx_learning_sessions_content_user_completed 
ON learning_sessions(content_id, user_id, completed, start_time DESC) 
WHERE completed = true;

-- Assessment performance queries
CREATE INDEX CONCURRENTLY idx_assessment_attempts_user_assessment_time 
ON assessment_attempts(user_id, assessment_id, started_at DESC);

CREATE INDEX CONCURRENTLY idx_question_responses_attempt_question_time 
ON question_responses(attempt_id, question_id, response_time DESC);

-- PARTIAL INDEXES FOR SPECIFIC CONDITIONS
-- These indexes are smaller and more efficient for specific queries

-- Active users only
CREATE INDEX CONCURRENTLY idx_users_active_updated 
ON users(updated_at DESC) 
WHERE updated_at > CURRENT_DATE - INTERVAL '30 days';

-- Completed sessions with engagement metrics
CREATE INDEX CONCURRENTLY idx_sessions_completed_engagement 
ON learning_sessions(user_id, focus_time, interaction_rate) 
WHERE completed = true AND focus_time > 0;

-- High-confidence learning styles
CREATE INDEX CONCURRENTLY idx_learning_styles_high_confidence 
ON learning_styles(profile_id, style_type, score DESC) 
WHERE confidence > 0.8;

-- Recent behavioral data
CREATE INDEX CONCURRENTLY idx_behavioral_indicators_recent 
ON behavioral_indicators(profile_id, content_type, engagement_level) 
WHERE timestamp > CURRENT_DATE - INTERVAL '7 days';

-- Active recommendations
CREATE INDEX CONCURRENTLY idx_recommendations_active_priority 
ON recommendations(user_id, priority, created_at DESC) 
WHERE status = 'active' AND expires_at > CURRENT_TIMESTAMP;

-- FULL-TEXT SEARCH INDEXES
-- For content search and recommendations

-- Content search
CREATE INDEX CONCURRENTLY idx_adaptive_content_search 
ON adaptive_content USING gin(
    to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || concept)
);

-- Question search
CREATE INDEX CONCURRENTLY idx_adaptive_questions_search 
ON adaptive_questions USING gin(
    to_tsvector('english', question_text || ' ' || COALESCE(explanation, ''))
);

-- ===========================================================================
-- PART 2: QUERY OPTIMIZATION VIEWS
-- ===========================================================================

-- Drop existing views if they exist
DROP VIEW IF EXISTS user_learning_overview;
DROP VIEW IF EXISTS content_effectiveness;
DROP VIEW IF EXISTS recent_user_activity;

-- Enhanced user learning overview with better performance
CREATE VIEW user_learning_overview AS
SELECT 
    u.id as user_id,
    u.name,
    u.email,
    lp.dominant_style,
    lp.is_multimodal,
    lp.adaptation_level,
    lp.confidence_score,
    pp.current_pace,
    pp.optimal_pace,
    pp.comprehension_rate,
    pp.retention_rate,
    pp.fatigue_level,
    COALESCE(session_stats.total_sessions, 0) as total_sessions,
    COALESCE(session_stats.total_time_spent, 0) as total_time_spent,
    COALESCE(session_stats.average_score, 0) as average_score,
    COALESCE(session_stats.completion_rate, 0) as completion_rate,
    session_stats.last_session_date,
    COALESCE(assessment_stats.total_assessments, 0) as total_assessments,
    COALESCE(assessment_stats.passed_assessments, 0) as passed_assessments,
    COALESCE(assessment_stats.average_assessment_score, 0) as average_assessment_score
FROM users u
LEFT JOIN learning_profiles lp ON u.id = lp.user_id
LEFT JOIN pace_profiles pp ON u.id = pp.user_id
LEFT JOIN (
    SELECT 
        user_id,
        COUNT(DISTINCT id) as total_sessions,
        SUM(duration) as total_time_spent,
        AVG(CASE WHEN total_questions > 0 THEN (correct_answers::DECIMAL / total_questions * 100) ELSE 0 END) as average_score,
        AVG(CASE WHEN completed THEN 1.0 ELSE 0.0 END) * 100 as completion_rate,
        MAX(start_time) as last_session_date
    FROM learning_sessions 
    WHERE start_time > CURRENT_DATE - INTERVAL '90 days'
    GROUP BY user_id
) session_stats ON u.id = session_stats.user_id
LEFT JOIN (
    SELECT 
        user_id,
        COUNT(DISTINCT id) as total_assessments,
        SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed_assessments,
        AVG(COALESCE(score, 0)) as average_assessment_score
    FROM assessment_attempts 
    WHERE started_at > CURRENT_DATE - INTERVAL '90 days'
    GROUP BY user_id
) assessment_stats ON u.id = assessment_stats.user_id;

-- Enhanced content effectiveness view
CREATE VIEW content_effectiveness AS
SELECT 
    ac.id as content_id,
    ac.title,
    ac.concept,
    ac.difficulty,
    ac.estimated_duration,
    ac.cognitive_load,
    ac.success_rate as expected_success_rate,
    COALESCE(content_stats.total_sessions, 0) as total_sessions,
    COALESCE(content_stats.unique_users, 0) as unique_users,
    COALESCE(content_stats.average_score, 0) as actual_average_score,
    COALESCE(content_stats.average_duration, 0) as actual_average_duration,
    COALESCE(content_stats.completion_rate, 0) as completion_rate,
    COALESCE(content_stats.engagement_score, 0) as engagement_score,
    CASE 
        WHEN content_stats.average_score > ac.success_rate THEN 'outperforming'
        WHEN content_stats.average_score < ac.success_rate * 0.8 THEN 'underperforming'
        ELSE 'meeting_expectations'
    END as performance_status
FROM adaptive_content ac
LEFT JOIN (
    SELECT 
        content_id,
        COUNT(DISTINCT id) as total_sessions,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(CASE WHEN total_questions > 0 THEN (correct_answers::DECIMAL / total_questions * 100) ELSE 0 END) as average_score,
        AVG(duration) as average_duration,
        AVG(CASE WHEN completed THEN 1.0 ELSE 0.0 END) * 100 as completion_rate,
        AVG(interaction_rate * 10 + (100 - distraction_events)) as engagement_score
    FROM learning_sessions 
    WHERE start_time > CURRENT_DATE - INTERVAL '90 days'
      AND content_id IS NOT NULL
    GROUP BY content_id
) content_stats ON ac.id::TEXT = content_stats.content_id;

-- Enhanced recent activity view with performance metrics
CREATE VIEW recent_user_activity AS
SELECT 
    u.id as user_id,
    u.name,
    u.email,
    recent_stats.last_session,
    COALESCE(recent_stats.active_days_last_30, 0) as active_days_last_30,
    COALESCE(recent_stats.sessions_last_30, 0) as sessions_last_30,
    COALESCE(recent_stats.total_time_last_30, 0) as total_time_last_30,
    COALESCE(recent_stats.average_score_last_30, 0) as average_score_last_30,
    COALESCE(recent_stats.streak_days, 0) as current_streak,
    COALESCE(recent_stats.engagement_trend, 0) as engagement_trend,
    CASE 
        WHEN recent_stats.last_session > CURRENT_DATE - INTERVAL '1 day' THEN 'very_active'
        WHEN recent_stats.last_session > CURRENT_DATE - INTERVAL '3 days' THEN 'active'
        WHEN recent_stats.last_session > CURRENT_DATE - INTERVAL '7 days' THEN 'moderate'
        WHEN recent_stats.last_session > CURRENT_DATE - INTERVAL '30 days' THEN 'inactive'
        ELSE 'dormant'
    END as activity_status
FROM users u
LEFT JOIN (
    SELECT 
        user_id,
        MAX(start_time) as last_session,
        COUNT(DISTINCT DATE(start_time)) as active_days_last_30,
        COUNT(DISTINCT id) as sessions_last_30,
        SUM(duration) as total_time_last_30,
        AVG(CASE WHEN total_questions > 0 THEN (correct_answers::DECIMAL / total_questions * 100) ELSE 0 END) as average_score_last_30,
        COUNT(DISTINCT DATE(start_time)) FILTER (WHERE start_time > CURRENT_DATE - INTERVAL '7 days') as streak_days,
        AVG(interaction_rate * 10 + (100 - distraction_events)) as engagement_trend
    FROM learning_sessions 
    WHERE start_time >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY user_id
) recent_stats ON u.id = recent_stats.user_id;

-- Learning progress summary view
CREATE VIEW learning_progress_summary AS
SELECT 
    u.id as user_id,
    u.name,
    lp.dominant_style,
    lp.adaptation_level,
    pp.current_pace,
    pp.comprehension_rate,
    progress_stats.total_content_completed,
    progress_stats.total_assessments_passed,
    progress_stats.mastery_level,
    progress_stats.learning_velocity,
    progress_stats.consistency_score,
    CASE 
        WHEN progress_stats.mastery_level > 80 THEN 'expert'
        WHEN progress_stats.mastery_level > 60 THEN 'proficient'
        WHEN progress_stats.mastery_level > 40 THEN 'developing'
        ELSE 'beginner'
    END as proficiency_level
FROM users u
LEFT JOIN learning_profiles lp ON u.id = lp.user_id
LEFT JOIN pace_profiles pp ON u.id = pp.user_id
LEFT JOIN (
    SELECT 
        ls.user_id,
        COUNT(DISTINCT ls.content_id) as total_content_completed,
        COUNT(DISTINCT aa.id) FILTER (WHERE aa.passed = true) as total_assessments_passed,
        AVG(CASE WHEN ls.total_questions > 0 THEN (ls.correct_answers::DECIMAL / ls.total_questions * 100) ELSE 0 END) as mastery_level,
        COUNT(DISTINCT ls.id) / NULLIF(COUNT(DISTINCT DATE(ls.start_time)), 0) as learning_velocity,
        STDDEV(CASE WHEN ls.total_questions > 0 THEN (ls.correct_answers::DECIMAL / ls.total_questions * 100) ELSE 0 END) as consistency_score
    FROM learning_sessions ls
    LEFT JOIN assessment_attempts aa ON ls.user_id = aa.user_id
    WHERE ls.start_time > CURRENT_DATE - INTERVAL '90 days'
      AND ls.completed = true
    GROUP BY ls.user_id
) progress_stats ON u.id = progress_stats.user_id;

-- ===========================================================================
-- PART 3: PERFORMANCE MONITORING TABLES
-- ===========================================================================

-- Query performance monitoring table
CREATE TABLE IF NOT EXISTS query_performance_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_hash VARCHAR(64) NOT NULL,
    query_text TEXT NOT NULL,
    execution_time_ms INTEGER NOT NULL,
    rows_examined INTEGER,
    rows_returned INTEGER,
    database_name VARCHAR(100),
    table_names TEXT[],
    index_usage TEXT[],
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id UUID,
    session_id UUID,
    endpoint VARCHAR(255),
    
    -- Performance classification
    performance_category VARCHAR(20) CHECK (performance_category IN ('fast', 'medium', 'slow', 'critical'))
);

-- Index for query performance monitoring
CREATE INDEX CONCURRENTLY idx_query_performance_hash_time 
ON query_performance_log(query_hash, executed_at DESC);

CREATE INDEX CONCURRENTLY idx_query_performance_slow 
ON query_performance_log(execution_time_ms DESC, executed_at DESC) 
WHERE execution_time_ms > 1000;

-- Database statistics snapshot table
CREATE TABLE IF NOT EXISTS database_statistics_snapshot (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Table statistics
    table_name VARCHAR(100) NOT NULL,
    table_size_bytes BIGINT,
    row_count BIGINT,
    index_size_bytes BIGINT,
    
    -- Performance metrics
    sequential_scans BIGINT,
    sequential_scan_rows BIGINT,
    index_scans BIGINT,
    index_scan_rows BIGINT,
    
    -- Activity metrics
    inserts BIGINT,
    updates BIGINT,
    deletes BIGINT,
    
    -- Cache statistics
    cache_hit_ratio DECIMAL(5,2),
    index_cache_hit_ratio DECIMAL(5,2)
);

-- Index for database statistics
CREATE INDEX CONCURRENTLY idx_db_stats_table_date 
ON database_statistics_snapshot(table_name, snapshot_date DESC);

-- ===========================================================================
-- PART 4: ADVANCED OPTIMIZATION FEATURES
-- ===========================================================================

-- Enable query plan caching
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.max = 10000;
ALTER SYSTEM SET pg_stat_statements.track = 'all';

-- Connection and memory optimization
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';

-- Enable parallel query execution
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;
ALTER SYSTEM SET max_parallel_workers = 8;
ALTER SYSTEM SET parallel_tuple_cost = 0.1;
ALTER SYSTEM SET parallel_setup_cost = 1000;

-- Statistics collection optimization
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET track_activity_query_size = 2048;
ALTER SYSTEM SET track_functions = 'all';
ALTER SYSTEM SET track_io_timing = 'on';

-- ===========================================================================
-- PART 5: MAINTENANCE PROCEDURES
-- ===========================================================================

-- Auto-vacuum optimization
ALTER SYSTEM SET autovacuum_naptime = '1min';
ALTER SYSTEM SET autovacuum_vacuum_scale_factor = 0.1;
ALTER SYSTEM SET autovacuum_analyze_scale_factor = 0.05;
ALTER SYSTEM SET autovacuum_vacuum_cost_delay = 10;
ALTER SYSTEM SET autovacuum_vacuum_cost_limit = 1000;

-- Table-specific vacuum settings for high-traffic tables
ALTER TABLE learning_sessions SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE behavioral_indicators SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE question_responses SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02
);

-- ===========================================================================
-- PART 6: PARTITIONING STRATEGY
-- ===========================================================================

-- Partition learning_sessions by date for better performance
-- (This would be implemented when the table grows large)

-- Example partitioning strategy (commented out for now):
/*
-- Create partitioned table
CREATE TABLE learning_sessions_partitioned (
    LIKE learning_sessions INCLUDING ALL
) PARTITION BY RANGE (start_time);

-- Create monthly partitions
CREATE TABLE learning_sessions_2024_01 PARTITION OF learning_sessions_partitioned
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE learning_sessions_2024_02 PARTITION OF learning_sessions_partitioned
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Continue for other months...
*/

-- ===========================================================================
-- PART 7: COMMENTS AND DOCUMENTATION
-- ===========================================================================

COMMENT ON INDEX idx_learning_sessions_user_time IS 'Optimizes user session history queries with completion filter';
COMMENT ON INDEX idx_content_variants_style_format IS 'Supports content adaptation queries by learning style and format';
COMMENT ON INDEX idx_adaptive_content_search IS 'Full-text search index for content discovery';
COMMENT ON INDEX idx_recommendations_active_priority IS 'Optimizes active recommendation queries with priority ordering';

COMMENT ON VIEW user_learning_overview IS 'Comprehensive user learning metrics with 90-day focus';
COMMENT ON VIEW content_effectiveness IS 'Content performance analysis with success rate comparison';
COMMENT ON VIEW recent_user_activity IS 'User activity tracking with engagement trends';
COMMENT ON VIEW learning_progress_summary IS 'Learning progress categorization and velocity metrics';

COMMENT ON TABLE query_performance_log IS 'Tracks query execution times for performance monitoring';
COMMENT ON TABLE database_statistics_snapshot IS 'Periodic database statistics for capacity planning';

-- ===========================================================================
-- PART 8: VALIDATION QUERIES
-- ===========================================================================

-- Query to validate index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan > 0
ORDER BY idx_scan DESC;

-- Query to identify slow queries
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    stddev_time
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY mean_time DESC;

-- Query to check table and index sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size_without_indexes,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;