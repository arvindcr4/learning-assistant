-- Migration 004: Comprehensive Performance Indexes
-- Create optimized indexes for all common query patterns

-- ==========================================
-- BASIC PERFORMANCE INDEXES
-- ==========================================

-- Create all the indexes that were removed from table definitions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_style_assessments_profile 
ON style_assessments(profile_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_style_assessments_type 
ON style_assessments(assessment_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_behavioral_indicators_profile 
ON behavioral_indicators(profile_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_behavioral_indicators_timestamp 
ON behavioral_indicators(timestamp);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_behavioral_indicators_content_type 
ON behavioral_indicators(content_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pace_adjustments_profile 
ON pace_adjustments(pace_profile_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pace_adjustments_timestamp 
ON pace_adjustments(timestamp);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_sessions_user 
ON learning_sessions(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_sessions_content 
ON learning_sessions(content_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_sessions_start_time 
ON learning_sessions(start_time);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_adaptive_changes_session 
ON adaptive_changes(session_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_adaptive_changes_type 
ON adaptive_changes(change_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_adaptive_content_difficulty 
ON adaptive_content(difficulty);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_adaptive_content_concept 
ON adaptive_content(concept);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_variants_content 
ON content_variants(content_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_variants_style 
ON content_variants(style_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_variants_format 
ON content_variants(format);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_content_variant 
ON media_content(variant_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_content_type 
ON media_content(media_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_adaptive_assessments_content 
ON adaptive_assessments(content_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_adaptive_assessments_type 
ON adaptive_assessments(assessment_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_adaptive_questions_assessment 
ON adaptive_questions(assessment_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_adaptive_questions_difficulty 
ON adaptive_questions(difficulty);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_adaptive_questions_type 
ON adaptive_questions(question_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_question_options_question 
ON question_options(question_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_attempts_user 
ON assessment_attempts(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_attempts_assessment 
ON assessment_attempts(assessment_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_attempts_started 
ON assessment_attempts(started_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_question_responses_attempt 
ON question_responses(attempt_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_question_responses_question 
ON question_responses(question_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_analytics_user 
ON learning_analytics(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_analytics_time_range 
ON learning_analytics(time_range_start, time_range_end);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_style_effectiveness_analytics 
ON style_effectiveness(analytics_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_style_effectiveness_style 
ON style_effectiveness(style_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_engagement_analytics 
ON content_engagement(analytics_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_engagement_content 
ON content_engagement(content_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_trends_analytics 
ON performance_trends(analytics_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_trends_metric 
ON performance_trends(metric);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommendations_user 
ON recommendations(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommendations_type 
ON recommendations(recommendation_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommendations_priority 
ON recommendations(priority);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommendations_status 
ON recommendations(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_predictions_user 
ON learning_predictions(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_predictions_metric 
ON learning_predictions(metric);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_predictions_target_date 
ON learning_predictions(target_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_config_key 
ON system_config(config_key);

-- ==========================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ==========================================

-- User session analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_sessions_user_status_time 
ON learning_sessions(user_id, completed, start_time DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_sessions_user_content_time 
ON learning_sessions(user_id, content_id, start_time DESC);

-- Assessment performance tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_attempts_user_assessment_time 
ON assessment_attempts(user_id, assessment_id, started_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_attempts_user_score_time 
ON assessment_attempts(user_id, score DESC, started_at DESC);

-- Content effectiveness analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_variants_style_content_format 
ON content_variants(style_type, content_id, format);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_adaptive_content_difficulty_concept 
ON adaptive_content(difficulty, concept);

-- Learning style detection
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_behavioral_indicators_profile_content_time 
ON behavioral_indicators(profile_id, content_type, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_styles_profile_score 
ON learning_styles(profile_id, score DESC);

-- Pace management
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pace_adjustments_profile_reason_time 
ON pace_adjustments(pace_profile_id, reason, timestamp DESC);

-- Question response analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_question_responses_attempt_correct_time 
ON question_responses(attempt_id, is_correct, response_time DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_question_responses_question_correct_time 
ON question_responses(question_id, is_correct, response_time DESC);

-- Recommendation system
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommendations_user_status_priority_time 
ON recommendations(user_id, status, priority, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommendations_type_priority_time 
ON recommendations(recommendation_type, priority, created_at DESC);

-- Analytics time-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_analytics_user_time_generated 
ON learning_analytics(user_id, time_range_start, generated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_trends_metric_time_range 
ON performance_trends(metric, time_range_start, time_range_end);

-- Learning predictions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_predictions_user_metric_target 
ON learning_predictions(user_id, metric, target_date);

-- ==========================================
-- PARTIAL INDEXES FOR FILTERED QUERIES
-- ==========================================

-- Active learning sessions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_sessions_active 
ON learning_sessions(user_id, start_time DESC) 
WHERE end_time IS NULL;

-- Incomplete learning sessions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_sessions_incomplete 
ON learning_sessions(user_id, start_time DESC) 
WHERE completed = false;

-- Active recommendations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommendations_active 
ON recommendations(user_id, priority, created_at DESC) 
WHERE status = 'active';

-- High priority recommendations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommendations_high_priority 
ON recommendations(user_id, created_at DESC) 
WHERE status = 'active' AND priority = 'high';

-- Recent behavioral indicators
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_behavioral_indicators_recent 
ON behavioral_indicators(profile_id, timestamp DESC) 
WHERE timestamp > NOW() - INTERVAL '7 days';

-- High confidence learning styles
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_styles_high_confidence 
ON learning_styles(profile_id, score DESC) 
WHERE confidence > 0.8;

-- Recent pace adjustments
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pace_adjustments_recent 
ON pace_adjustments(pace_profile_id, timestamp DESC) 
WHERE timestamp > NOW() - INTERVAL '30 days';

-- Passed assessment attempts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_attempts_passed 
ON assessment_attempts(user_id, assessment_id, started_at DESC) 
WHERE passed = true;

-- Correct question responses
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_question_responses_correct 
ON question_responses(question_id, response_time DESC) 
WHERE is_correct = true;

-- Recent learning analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_analytics_recent 
ON learning_analytics(user_id, generated_at DESC) 
WHERE generated_at > NOW() - INTERVAL '90 days';

-- Validated predictions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_predictions_validated 
ON learning_predictions(user_id, metric, accuracy DESC) 
WHERE validated_at IS NOT NULL;

-- ==========================================
-- GIN INDEXES FOR ARRAY COLUMNS
-- ==========================================

-- Array-based content search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_adaptive_content_tags_gin 
ON adaptive_content USING gin (tags);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_adaptive_content_learning_objectives_gin 
ON adaptive_content USING gin (learning_objectives);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_adaptive_content_prerequisites_gin 
ON adaptive_content USING gin (prerequisites);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_preferences_learning_goals_gin 
ON user_preferences USING gin (learning_goals);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_preferences_preferred_topics_gin 
ON user_preferences USING gin (preferred_topics);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_preferences_preferred_times_gin 
ON user_preferences USING gin (preferred_times);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_adaptive_questions_hints_gin 
ON adaptive_questions USING gin (hints);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_trends_factors_gin 
ON performance_trends USING gin (factors);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_predictions_recommendations_gin 
ON learning_predictions USING gin (recommendations);

-- ==========================================
-- HASH INDEXES FOR EQUALITY LOOKUPS
-- ==========================================

-- Fast email lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_hash 
ON users USING hash (email);

-- Fast content type lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_behavioral_indicators_content_type_hash 
ON behavioral_indicators USING hash (content_type);

-- Fast learning style lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_styles_style_type_hash 
ON learning_styles USING hash (style_type);

-- Fast assessment type lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_adaptive_assessments_assessment_type_hash 
ON adaptive_assessments USING hash (assessment_type);

-- Fast question type lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_adaptive_questions_question_type_hash 
ON adaptive_questions USING hash (question_type);

-- Fast recommendation type lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommendations_recommendation_type_hash 
ON recommendations USING hash (recommendation_type);

-- Fast status lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommendations_status_hash 
ON recommendations USING hash (status);

-- Fast media type lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_content_media_type_hash 
ON media_content USING hash (media_type);

-- ==========================================
-- FULL-TEXT SEARCH INDEXES
-- ==========================================

-- Enable pg_trgm extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Content title search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_adaptive_content_title_trgm 
ON adaptive_content USING gin (title gin_trgm_ops);

-- Content description search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_adaptive_content_description_trgm 
ON adaptive_content USING gin (description gin_trgm_ops);

-- Question text search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_adaptive_questions_question_text_trgm 
ON adaptive_questions USING gin (question_text gin_trgm_ops);

-- Recommendation title search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommendations_title_trgm 
ON recommendations USING gin (title gin_trgm_ops);

-- User name search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_name_trgm 
ON users USING gin (name gin_trgm_ops);

-- ==========================================
-- EXPRESSION INDEXES
-- ==========================================

-- Case-insensitive email search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_lower 
ON users (LOWER(email));

-- Date-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_sessions_date 
ON learning_sessions (DATE(start_time));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_attempts_date 
ON assessment_attempts (DATE(started_at));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_behavioral_indicators_date 
ON behavioral_indicators (DATE(timestamp));

-- Time-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_sessions_hour 
ON learning_sessions (EXTRACT(hour FROM start_time));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_behavioral_indicators_hour 
ON behavioral_indicators (EXTRACT(hour FROM timestamp));

-- Score calculations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_attempts_score_percentage 
ON assessment_attempts ((score::decimal / 100));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_sessions_accuracy 
ON learning_sessions ((CASE WHEN total_questions > 0 THEN correct_answers::decimal / total_questions ELSE 0 END));

-- ==========================================
-- SPECIALIZED INDEXES
-- ==========================================

-- Covering indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_sessions_user_covering 
ON learning_sessions (user_id) 
INCLUDE (start_time, end_time, duration, completed, correct_answers, total_questions);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_attempts_user_covering 
ON assessment_attempts (user_id) 
INCLUDE (assessment_id, started_at, completed_at, score, passed);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommendations_user_covering 
ON recommendations (user_id) 
INCLUDE (recommendation_type, title, priority, status, created_at);

-- Multi-column statistics for better query planning
CREATE STATISTICS IF NOT EXISTS stats_learning_sessions_user_content 
ON user_id, content_id FROM learning_sessions;

CREATE STATISTICS IF NOT EXISTS stats_behavioral_indicators_profile_content 
ON profile_id, content_type FROM behavioral_indicators;

CREATE STATISTICS IF NOT EXISTS stats_recommendations_user_type 
ON user_id, recommendation_type FROM recommendations;

-- ==========================================
-- INDEX DOCUMENTATION
-- ==========================================

-- Basic performance indexes
COMMENT ON INDEX idx_learning_sessions_user IS 'User session queries';
COMMENT ON INDEX idx_adaptive_content_difficulty IS 'Content difficulty filtering';
COMMENT ON INDEX idx_recommendations_status IS 'Recommendation status filtering';

-- Composite indexes
COMMENT ON INDEX idx_learning_sessions_user_status_time IS 'User session history with completion status';
COMMENT ON INDEX idx_assessment_attempts_user_score_time IS 'User assessment performance tracking';
COMMENT ON INDEX idx_behavioral_indicators_profile_content_time IS 'Learning style detection queries';

-- Partial indexes
COMMENT ON INDEX idx_learning_sessions_active IS 'Active learning sessions';
COMMENT ON INDEX idx_recommendations_active IS 'Active recommendations for user dashboard';
COMMENT ON INDEX idx_learning_styles_high_confidence IS 'High confidence learning style detection';

-- GIN indexes
COMMENT ON INDEX idx_adaptive_content_tags_gin IS 'Content tag-based search';
COMMENT ON INDEX idx_user_preferences_learning_goals_gin IS 'User learning goal matching';

-- Hash indexes
COMMENT ON INDEX idx_users_email_hash IS 'Fast email-based user lookup';
COMMENT ON INDEX idx_recommendations_status_hash IS 'Fast recommendation status filtering';

-- Full-text search indexes
COMMENT ON INDEX idx_adaptive_content_title_trgm IS 'Content title full-text search';
COMMENT ON INDEX idx_adaptive_questions_question_text_trgm IS 'Question text search';

-- Expression indexes
COMMENT ON INDEX idx_users_email_lower IS 'Case-insensitive email search';
COMMENT ON INDEX idx_learning_sessions_date IS 'Date-based session queries';

-- Insert migration record
INSERT INTO migration_history (version, name, checksum, executed_at) 
VALUES (4, 'comprehensive_performance_indexes', md5('comprehensive_performance_indexes_v1'), NOW());