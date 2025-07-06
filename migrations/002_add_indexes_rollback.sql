-- Rollback for Migration 002: Remove Added Indexes
-- Remove indexes created in migration 002

DROP INDEX CONCURRENTLY IF EXISTS idx_users_email_lower;
DROP INDEX CONCURRENTLY IF EXISTS idx_learning_sessions_content_user;
DROP INDEX CONCURRENTLY IF EXISTS idx_assessment_attempts_user_score;
DROP INDEX CONCURRENTLY IF EXISTS idx_recommendations_user_status_priority;
DROP INDEX CONCURRENTLY IF EXISTS idx_behavioral_indicators_action_timestamp;
DROP INDEX CONCURRENTLY IF EXISTS idx_content_variants_content_style;
DROP INDEX CONCURRENTLY IF EXISTS idx_learning_analytics_user_generated;
DROP INDEX CONCURRENTLY IF EXISTS idx_learning_sessions_user_completed_time;
DROP INDEX CONCURRENTLY IF EXISTS idx_question_responses_attempt_correct;
DROP INDEX CONCURRENTLY IF EXISTS idx_adaptive_questions_assessment_difficulty;
DROP INDEX CONCURRENTLY IF EXISTS idx_learning_sessions_incomplete;
DROP INDEX CONCURRENTLY IF EXISTS idx_recommendations_high_priority;
DROP INDEX CONCURRENTLY IF EXISTS idx_pace_adjustments_recent;
DROP INDEX CONCURRENTLY IF EXISTS idx_adaptive_content_title_trgm;
DROP INDEX CONCURRENTLY IF EXISTS idx_adaptive_content_tags_gin;
DROP INDEX CONCURRENTLY IF EXISTS idx_learning_analytics_time_range;
DROP INDEX CONCURRENTLY IF EXISTS idx_performance_trends_metric_time;

-- Remove constraints
ALTER TABLE learning_sessions DROP CONSTRAINT IF EXISTS check_session_duration;
ALTER TABLE assessment_attempts DROP CONSTRAINT IF EXISTS check_attempt_score;
ALTER TABLE question_responses DROP CONSTRAINT IF EXISTS check_response_points;