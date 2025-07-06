-- Migration 002: Add Performance Indexes
-- Add additional indexes for better query performance

-- Create indexes for frequently queried columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_lower 
ON users (LOWER(email));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_sessions_content_user 
ON learning_sessions (content_id, user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_attempts_user_score 
ON assessment_attempts (user_id, score DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommendations_user_status_priority 
ON recommendations (user_id, status, priority) 
WHERE status = 'active';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_behavioral_indicators_action_timestamp 
ON behavioral_indicators (action, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_variants_content_style 
ON content_variants (content_id, style_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_analytics_user_generated 
ON learning_analytics (user_id, generated_at DESC);

-- Create composite indexes for complex queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_sessions_user_completed_time 
ON learning_sessions (user_id, completed, start_time DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_question_responses_attempt_correct 
ON question_responses (attempt_id, is_correct);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_adaptive_questions_assessment_difficulty 
ON adaptive_questions (assessment_id, difficulty);

-- Create partial indexes for better performance on filtered queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_sessions_incomplete 
ON learning_sessions (user_id, start_time DESC) 
WHERE completed = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommendations_high_priority 
ON recommendations (user_id, created_at DESC) 
WHERE priority = 'high' AND status = 'active';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pace_adjustments_recent 
ON pace_adjustments (pace_profile_id, timestamp DESC) 
WHERE timestamp > NOW() - INTERVAL '30 days';

-- Create indexes for text search (if needed)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_adaptive_content_title_trgm 
ON adaptive_content USING gin (title gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_adaptive_content_tags_gin 
ON adaptive_content USING gin (tags);

-- Create indexes for analytics queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_analytics_time_range 
ON learning_analytics (time_range_start, time_range_end);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_trends_metric_time 
ON performance_trends (metric, time_range_start);

-- Add constraint to ensure data integrity
ALTER TABLE learning_sessions 
ADD CONSTRAINT check_session_duration 
CHECK (duration >= 0 AND duration <= 480); -- Max 8 hours

ALTER TABLE assessment_attempts 
ADD CONSTRAINT check_attempt_score 
CHECK (score IS NULL OR (score >= 0 AND score <= 100));

ALTER TABLE question_responses 
ADD CONSTRAINT check_response_points 
CHECK (points_earned >= 0);

-- Add comment for documentation
COMMENT ON INDEX idx_users_email_lower IS 'Case-insensitive email lookups for authentication';
COMMENT ON INDEX idx_learning_sessions_content_user IS 'Content performance analysis by user';
COMMENT ON INDEX idx_recommendations_user_status_priority IS 'Active recommendations for user dashboard';
COMMENT ON INDEX idx_learning_sessions_incomplete IS 'Finding and resuming incomplete sessions';
COMMENT ON INDEX idx_adaptive_content_title_trgm IS 'Full-text search on content titles';
COMMENT ON INDEX idx_adaptive_content_tags_gin IS 'Fast tag-based content filtering';