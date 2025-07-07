-- Rollback for Migration 004: Remove Comprehensive Performance Indexes
-- Remove all indexes created in migration 004

-- ==========================================
-- REMOVE MULTI-COLUMN STATISTICS
-- ==========================================

DROP STATISTICS IF EXISTS stats_recommendations_user_type;
DROP STATISTICS IF EXISTS stats_behavioral_indicators_profile_content;
DROP STATISTICS IF EXISTS stats_learning_sessions_user_content;

-- ==========================================
-- REMOVE SPECIALIZED INDEXES
-- ==========================================

DROP INDEX CONCURRENTLY IF EXISTS idx_recommendations_user_covering;
DROP INDEX CONCURRENTLY IF EXISTS idx_assessment_attempts_user_covering;
DROP INDEX CONCURRENTLY IF EXISTS idx_learning_sessions_user_covering;

-- ==========================================
-- REMOVE EXPRESSION INDEXES
-- ==========================================

DROP INDEX CONCURRENTLY IF EXISTS idx_learning_sessions_accuracy;
DROP INDEX CONCURRENTLY IF EXISTS idx_assessment_attempts_score_percentage;
DROP INDEX CONCURRENTLY IF EXISTS idx_behavioral_indicators_hour;
DROP INDEX CONCURRENTLY IF EXISTS idx_learning_sessions_hour;
DROP INDEX CONCURRENTLY IF EXISTS idx_behavioral_indicators_date;
DROP INDEX CONCURRENTLY IF EXISTS idx_assessment_attempts_date;
DROP INDEX CONCURRENTLY IF EXISTS idx_learning_sessions_date;
DROP INDEX CONCURRENTLY IF EXISTS idx_users_email_lower;

-- ==========================================
-- REMOVE FULL-TEXT SEARCH INDEXES
-- ==========================================

DROP INDEX CONCURRENTLY IF EXISTS idx_users_name_trgm;
DROP INDEX CONCURRENTLY IF EXISTS idx_recommendations_title_trgm;
DROP INDEX CONCURRENTLY IF EXISTS idx_adaptive_questions_question_text_trgm;
DROP INDEX CONCURRENTLY IF EXISTS idx_adaptive_content_description_trgm;
DROP INDEX CONCURRENTLY IF EXISTS idx_adaptive_content_title_trgm;

-- ==========================================
-- REMOVE HASH INDEXES
-- ==========================================

DROP INDEX CONCURRENTLY IF EXISTS idx_media_content_media_type_hash;
DROP INDEX CONCURRENTLY IF EXISTS idx_recommendations_status_hash;
DROP INDEX CONCURRENTLY IF EXISTS idx_recommendations_recommendation_type_hash;
DROP INDEX CONCURRENTLY IF EXISTS idx_adaptive_questions_question_type_hash;
DROP INDEX CONCURRENTLY IF EXISTS idx_adaptive_assessments_assessment_type_hash;
DROP INDEX CONCURRENTLY IF EXISTS idx_learning_styles_style_type_hash;
DROP INDEX CONCURRENTLY IF EXISTS idx_behavioral_indicators_content_type_hash;
DROP INDEX CONCURRENTLY IF EXISTS idx_users_email_hash;

-- ==========================================
-- REMOVE GIN INDEXES
-- ==========================================

DROP INDEX CONCURRENTLY IF EXISTS idx_learning_predictions_recommendations_gin;
DROP INDEX CONCURRENTLY IF EXISTS idx_performance_trends_factors_gin;
DROP INDEX CONCURRENTLY IF EXISTS idx_adaptive_questions_hints_gin;
DROP INDEX CONCURRENTLY IF EXISTS idx_user_preferences_preferred_times_gin;
DROP INDEX CONCURRENTLY IF EXISTS idx_user_preferences_preferred_topics_gin;
DROP INDEX CONCURRENTLY IF EXISTS idx_user_preferences_learning_goals_gin;
DROP INDEX CONCURRENTLY IF EXISTS idx_adaptive_content_prerequisites_gin;
DROP INDEX CONCURRENTLY IF EXISTS idx_adaptive_content_learning_objectives_gin;
DROP INDEX CONCURRENTLY IF EXISTS idx_adaptive_content_tags_gin;

-- ==========================================
-- REMOVE PARTIAL INDEXES
-- ==========================================

DROP INDEX CONCURRENTLY IF EXISTS idx_learning_predictions_validated;
DROP INDEX CONCURRENTLY IF EXISTS idx_learning_analytics_recent;
DROP INDEX CONCURRENTLY IF EXISTS idx_question_responses_correct;
DROP INDEX CONCURRENTLY IF EXISTS idx_assessment_attempts_passed;
DROP INDEX CONCURRENTLY IF EXISTS idx_pace_adjustments_recent;
DROP INDEX CONCURRENTLY IF EXISTS idx_learning_styles_high_confidence;
DROP INDEX CONCURRENTLY IF EXISTS idx_behavioral_indicators_recent;
DROP INDEX CONCURRENTLY IF EXISTS idx_recommendations_high_priority;
DROP INDEX CONCURRENTLY IF EXISTS idx_recommendations_active;
DROP INDEX CONCURRENTLY IF EXISTS idx_learning_sessions_incomplete;
DROP INDEX CONCURRENTLY IF EXISTS idx_learning_sessions_active;

-- ==========================================
-- REMOVE COMPOSITE INDEXES
-- ==========================================

DROP INDEX CONCURRENTLY IF EXISTS idx_learning_predictions_user_metric_target;
DROP INDEX CONCURRENTLY IF EXISTS idx_performance_trends_metric_time_range;
DROP INDEX CONCURRENTLY IF EXISTS idx_learning_analytics_user_time_generated;
DROP INDEX CONCURRENTLY IF EXISTS idx_recommendations_type_priority_time;
DROP INDEX CONCURRENTLY IF EXISTS idx_recommendations_user_status_priority_time;
DROP INDEX CONCURRENTLY IF EXISTS idx_question_responses_question_correct_time;
DROP INDEX CONCURRENTLY IF EXISTS idx_question_responses_attempt_correct_time;
DROP INDEX CONCURRENTLY IF EXISTS idx_pace_adjustments_profile_reason_time;
DROP INDEX CONCURRENTLY IF EXISTS idx_learning_styles_profile_score;
DROP INDEX CONCURRENTLY IF EXISTS idx_behavioral_indicators_profile_content_time;
DROP INDEX CONCURRENTLY IF EXISTS idx_adaptive_content_difficulty_concept;
DROP INDEX CONCURRENTLY IF EXISTS idx_content_variants_style_content_format;
DROP INDEX CONCURRENTLY IF EXISTS idx_assessment_attempts_user_score_time;
DROP INDEX CONCURRENTLY IF EXISTS idx_assessment_attempts_user_assessment_time;
DROP INDEX CONCURRENTLY IF EXISTS idx_learning_sessions_user_content_time;
DROP INDEX CONCURRENTLY IF EXISTS idx_learning_sessions_user_status_time;

-- ==========================================
-- REMOVE BASIC PERFORMANCE INDEXES
-- ==========================================

DROP INDEX CONCURRENTLY IF EXISTS idx_system_config_key;
DROP INDEX CONCURRENTLY IF EXISTS idx_learning_predictions_target_date;
DROP INDEX CONCURRENTLY IF EXISTS idx_learning_predictions_metric;
DROP INDEX CONCURRENTLY IF EXISTS idx_learning_predictions_user;
DROP INDEX CONCURRENTLY IF EXISTS idx_recommendations_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_recommendations_priority;
DROP INDEX CONCURRENTLY IF EXISTS idx_recommendations_type;
DROP INDEX CONCURRENTLY IF EXISTS idx_recommendations_user;
DROP INDEX CONCURRENTLY IF EXISTS idx_performance_trends_metric;
DROP INDEX CONCURRENTLY IF EXISTS idx_performance_trends_analytics;
DROP INDEX CONCURRENTLY IF EXISTS idx_content_engagement_content;
DROP INDEX CONCURRENTLY IF EXISTS idx_content_engagement_analytics;
DROP INDEX CONCURRENTLY IF EXISTS idx_style_effectiveness_style;
DROP INDEX CONCURRENTLY IF EXISTS idx_style_effectiveness_analytics;
DROP INDEX CONCURRENTLY IF EXISTS idx_learning_analytics_time_range;
DROP INDEX CONCURRENTLY IF EXISTS idx_learning_analytics_user;
DROP INDEX CONCURRENTLY IF EXISTS idx_question_responses_question;
DROP INDEX CONCURRENTLY IF EXISTS idx_question_responses_attempt;
DROP INDEX CONCURRENTLY IF EXISTS idx_assessment_attempts_started;
DROP INDEX CONCURRENTLY IF EXISTS idx_assessment_attempts_assessment;
DROP INDEX CONCURRENTLY IF EXISTS idx_assessment_attempts_user;
DROP INDEX CONCURRENTLY IF EXISTS idx_question_options_question;
DROP INDEX CONCURRENTLY IF EXISTS idx_adaptive_questions_type;
DROP INDEX CONCURRENTLY IF EXISTS idx_adaptive_questions_difficulty;
DROP INDEX CONCURRENTLY IF EXISTS idx_adaptive_questions_assessment;
DROP INDEX CONCURRENTLY IF EXISTS idx_adaptive_assessments_type;
DROP INDEX CONCURRENTLY IF EXISTS idx_adaptive_assessments_content;
DROP INDEX CONCURRENTLY IF EXISTS idx_media_content_type;
DROP INDEX CONCURRENTLY IF EXISTS idx_media_content_variant;
DROP INDEX CONCURRENTLY IF EXISTS idx_content_variants_format;
DROP INDEX CONCURRENTLY IF EXISTS idx_content_variants_style;
DROP INDEX CONCURRENTLY IF EXISTS idx_content_variants_content;
DROP INDEX CONCURRENTLY IF EXISTS idx_adaptive_content_concept;
DROP INDEX CONCURRENTLY IF EXISTS idx_adaptive_content_difficulty;
DROP INDEX CONCURRENTLY IF EXISTS idx_adaptive_changes_type;
DROP INDEX CONCURRENTLY IF EXISTS idx_adaptive_changes_session;
DROP INDEX CONCURRENTLY IF EXISTS idx_learning_sessions_start_time;
DROP INDEX CONCURRENTLY IF EXISTS idx_learning_sessions_content;
DROP INDEX CONCURRENTLY IF EXISTS idx_learning_sessions_user;
DROP INDEX CONCURRENTLY IF EXISTS idx_pace_adjustments_timestamp;
DROP INDEX CONCURRENTLY IF EXISTS idx_pace_adjustments_profile;
DROP INDEX CONCURRENTLY IF EXISTS idx_behavioral_indicators_content_type;
DROP INDEX CONCURRENTLY IF EXISTS idx_behavioral_indicators_timestamp;
DROP INDEX CONCURRENTLY IF EXISTS idx_behavioral_indicators_profile;
DROP INDEX CONCURRENTLY IF EXISTS idx_style_assessments_type;
DROP INDEX CONCURRENTLY IF EXISTS idx_style_assessments_profile;

-- Remove migration record
DELETE FROM migration_history WHERE version = 4;