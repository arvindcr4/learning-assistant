-- Migration 003: Add Missing Constraints and Data Validation
-- Add comprehensive constraints for data validation and integrity

-- ==========================================
-- ADD MISSING NOT NULL CONSTRAINTS
-- ==========================================

-- User preferences constraints
ALTER TABLE user_preferences 
ADD CONSTRAINT user_preferences_user_id_not_null CHECK (user_id IS NOT NULL),
ADD CONSTRAINT user_preferences_daily_goal_positive CHECK (daily_goal_minutes > 0),
ADD CONSTRAINT user_preferences_days_per_week_valid CHECK (days_per_week >= 1 AND days_per_week <= 7);

-- Learning profiles constraints
ALTER TABLE learning_profiles 
ADD CONSTRAINT learning_profiles_user_id_not_null CHECK (user_id IS NOT NULL),
ADD CONSTRAINT learning_profiles_dominant_style_not_null CHECK (dominant_style IS NOT NULL);

-- Learning styles constraints
ALTER TABLE learning_styles 
ADD CONSTRAINT learning_styles_profile_id_not_null CHECK (profile_id IS NOT NULL),
ADD CONSTRAINT learning_styles_style_type_not_null CHECK (style_type IS NOT NULL);

-- Style assessments constraints
ALTER TABLE style_assessments 
ADD CONSTRAINT style_assessments_profile_id_not_null CHECK (profile_id IS NOT NULL),
ADD CONSTRAINT style_assessments_assessment_type_not_null CHECK (assessment_type IS NOT NULL),
ADD CONSTRAINT style_assessments_data_points_non_negative CHECK (data_points >= 0);

-- Behavioral indicators constraints
ALTER TABLE behavioral_indicators 
ADD CONSTRAINT behavioral_indicators_profile_id_not_null CHECK (profile_id IS NOT NULL),
ADD CONSTRAINT behavioral_indicators_action_not_null CHECK (action IS NOT NULL),
ADD CONSTRAINT behavioral_indicators_time_spent_positive CHECK (time_spent > 0);

-- Pace profiles constraints
ALTER TABLE pace_profiles 
ADD CONSTRAINT pace_profiles_user_id_not_null CHECK (user_id IS NOT NULL),
ADD CONSTRAINT pace_profiles_current_pace_positive CHECK (current_pace > 0),
ADD CONSTRAINT pace_profiles_optimal_pace_positive CHECK (optimal_pace > 0);

-- Pace adjustments constraints
ALTER TABLE pace_adjustments 
ADD CONSTRAINT pace_adjustments_profile_id_not_null CHECK (pace_profile_id IS NOT NULL),
ADD CONSTRAINT pace_adjustments_previous_pace_positive CHECK (previous_pace > 0),
ADD CONSTRAINT pace_adjustments_new_pace_positive CHECK (new_pace > 0);

-- Learning sessions constraints
ALTER TABLE learning_sessions 
ADD CONSTRAINT learning_sessions_user_id_not_null CHECK (user_id IS NOT NULL),
ADD CONSTRAINT learning_sessions_content_id_not_null CHECK (content_id IS NOT NULL),
ADD CONSTRAINT learning_sessions_duration_positive CHECK (duration > 0),
ADD CONSTRAINT learning_sessions_items_completed_non_negative CHECK (items_completed >= 0),
ADD CONSTRAINT learning_sessions_correct_answers_non_negative CHECK (correct_answers >= 0),
ADD CONSTRAINT learning_sessions_total_questions_non_negative CHECK (total_questions >= 0),
ADD CONSTRAINT learning_sessions_correct_answers_valid CHECK (correct_answers <= total_questions),
ADD CONSTRAINT learning_sessions_focus_time_valid CHECK (focus_time >= 0 AND focus_time <= duration),
ADD CONSTRAINT learning_sessions_distraction_events_non_negative CHECK (distraction_events >= 0),
ADD CONSTRAINT learning_sessions_interaction_rate_non_negative CHECK (interaction_rate >= 0),
ADD CONSTRAINT learning_sessions_video_watch_time_valid CHECK (video_watch_time >= 0 AND video_watch_time <= duration),
ADD CONSTRAINT learning_sessions_pause_frequency_non_negative CHECK (pause_frequency >= 0),
ADD CONSTRAINT learning_sessions_end_time_after_start CHECK (end_time IS NULL OR end_time >= start_time);

-- Adaptive changes constraints
ALTER TABLE adaptive_changes 
ADD CONSTRAINT adaptive_changes_session_id_not_null CHECK (session_id IS NOT NULL),
ADD CONSTRAINT adaptive_changes_change_type_not_null CHECK (change_type IS NOT NULL),
ADD CONSTRAINT adaptive_changes_reason_not_null CHECK (reason IS NOT NULL);

-- Adaptive content constraints
ALTER TABLE adaptive_content 
ADD CONSTRAINT adaptive_content_title_not_null CHECK (title IS NOT NULL),
ADD CONSTRAINT adaptive_content_concept_not_null CHECK (concept IS NOT NULL),
ADD CONSTRAINT adaptive_content_estimated_duration_positive CHECK (estimated_duration > 0),
ADD CONSTRAINT adaptive_content_title_length CHECK (char_length(title) <= 255),
ADD CONSTRAINT adaptive_content_blooms_taxonomy_valid CHECK (blooms_taxonomy_level IN ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'));

-- Content variants constraints
ALTER TABLE content_variants 
ADD CONSTRAINT content_variants_content_id_not_null CHECK (content_id IS NOT NULL),
ADD CONSTRAINT content_variants_style_type_not_null CHECK (style_type IS NOT NULL),
ADD CONSTRAINT content_variants_format_not_null CHECK (format IS NOT NULL),
ADD CONSTRAINT content_variants_content_data_not_null CHECK (content_data IS NOT NULL),
ADD CONSTRAINT content_variants_interactivity_level_not_null CHECK (interactivity_level IS NOT NULL);

-- Media content constraints
ALTER TABLE media_content 
ADD CONSTRAINT media_content_variant_id_not_null CHECK (variant_id IS NOT NULL),
ADD CONSTRAINT media_content_media_type_not_null CHECK (media_type IS NOT NULL),
ADD CONSTRAINT media_content_url_not_null CHECK (url IS NOT NULL),
ADD CONSTRAINT media_content_duration_positive CHECK (duration IS NULL OR duration > 0),
ADD CONSTRAINT media_content_file_size_positive CHECK (file_size IS NULL OR file_size > 0);

-- Adaptive assessments constraints
ALTER TABLE adaptive_assessments 
ADD CONSTRAINT adaptive_assessments_content_id_not_null CHECK (content_id IS NOT NULL),
ADD CONSTRAINT adaptive_assessments_assessment_type_not_null CHECK (assessment_type IS NOT NULL),
ADD CONSTRAINT adaptive_assessments_title_not_null CHECK (title IS NOT NULL),
ADD CONSTRAINT adaptive_assessments_minimum_questions_positive CHECK (minimum_questions > 0),
ADD CONSTRAINT adaptive_assessments_maximum_questions_positive CHECK (maximum_questions > 0),
ADD CONSTRAINT adaptive_assessments_questions_range_valid CHECK (maximum_questions >= minimum_questions),
ADD CONSTRAINT adaptive_assessments_total_points_positive CHECK (total_points > 0),
ADD CONSTRAINT adaptive_assessments_time_limit_positive CHECK (time_limit IS NULL OR time_limit > 0);

-- Adaptive questions constraints
ALTER TABLE adaptive_questions 
ADD CONSTRAINT adaptive_questions_assessment_id_not_null CHECK (assessment_id IS NOT NULL),
ADD CONSTRAINT adaptive_questions_question_text_not_null CHECK (question_text IS NOT NULL),
ADD CONSTRAINT adaptive_questions_question_type_not_null CHECK (question_type IS NOT NULL),
ADD CONSTRAINT adaptive_questions_correct_answer_not_null CHECK (correct_answer IS NOT NULL),
ADD CONSTRAINT adaptive_questions_points_positive CHECK (points > 0),
ADD CONSTRAINT adaptive_questions_time_limit_positive CHECK (time_limit IS NULL OR time_limit > 0);

-- Question options constraints
ALTER TABLE question_options 
ADD CONSTRAINT question_options_question_id_not_null CHECK (question_id IS NOT NULL),
ADD CONSTRAINT question_options_option_text_not_null CHECK (option_text IS NOT NULL),
ADD CONSTRAINT question_options_order_index_positive CHECK (order_index > 0);

-- Assessment attempts constraints
ALTER TABLE assessment_attempts 
ADD CONSTRAINT assessment_attempts_user_id_not_null CHECK (user_id IS NOT NULL),
ADD CONSTRAINT assessment_attempts_assessment_id_not_null CHECK (assessment_id IS NOT NULL),
ADD CONSTRAINT assessment_attempts_questions_answered_non_negative CHECK (questions_answered >= 0),
ADD CONSTRAINT assessment_attempts_correct_answers_non_negative CHECK (correct_answers >= 0),
ADD CONSTRAINT assessment_attempts_correct_answers_valid CHECK (correct_answers <= questions_answered),
ADD CONSTRAINT assessment_attempts_time_spent_positive CHECK (time_spent IS NULL OR time_spent > 0),
ADD CONSTRAINT assessment_attempts_completed_at_after_started CHECK (completed_at IS NULL OR completed_at >= started_at);

-- Question responses constraints
ALTER TABLE question_responses 
ADD CONSTRAINT question_responses_attempt_id_not_null CHECK (attempt_id IS NOT NULL),
ADD CONSTRAINT question_responses_question_id_not_null CHECK (question_id IS NOT NULL),
ADD CONSTRAINT question_responses_hints_used_non_negative CHECK (hints_used >= 0),
ADD CONSTRAINT question_responses_time_spent_positive CHECK (time_spent IS NULL OR time_spent > 0);

-- Learning analytics constraints
ALTER TABLE learning_analytics 
ADD CONSTRAINT learning_analytics_user_id_not_null CHECK (user_id IS NOT NULL),
ADD CONSTRAINT learning_analytics_time_range_start_not_null CHECK (time_range_start IS NOT NULL),
ADD CONSTRAINT learning_analytics_time_range_end_not_null CHECK (time_range_end IS NOT NULL),
ADD CONSTRAINT learning_analytics_time_range_valid CHECK (time_range_end >= time_range_start),
ADD CONSTRAINT learning_analytics_total_time_spent_non_negative CHECK (total_time_spent >= 0),
ADD CONSTRAINT learning_analytics_content_completed_non_negative CHECK (content_completed >= 0),
ADD CONSTRAINT learning_analytics_streak_days_non_negative CHECK (streak_days >= 0),
ADD CONSTRAINT learning_analytics_goals_achieved_non_negative CHECK (goals_achieved >= 0),
ADD CONSTRAINT learning_analytics_total_goals_non_negative CHECK (total_goals >= 0),
ADD CONSTRAINT learning_analytics_goals_achieved_valid CHECK (goals_achieved <= total_goals),
ADD CONSTRAINT learning_analytics_average_pace_positive CHECK (average_pace >= 0),
ADD CONSTRAINT learning_analytics_optimal_pace_positive CHECK (optimal_pace >= 0),
ADD CONSTRAINT learning_analytics_recommended_breaks_non_negative CHECK (recommended_breaks >= 0);

-- Style effectiveness constraints
ALTER TABLE style_effectiveness 
ADD CONSTRAINT style_effectiveness_analytics_id_not_null CHECK (analytics_id IS NOT NULL),
ADD CONSTRAINT style_effectiveness_style_type_not_null CHECK (style_type IS NOT NULL),
ADD CONSTRAINT style_effectiveness_time_to_mastery_positive CHECK (time_to_mastery > 0);

-- Content engagement constraints
ALTER TABLE content_engagement 
ADD CONSTRAINT content_engagement_analytics_id_not_null CHECK (analytics_id IS NOT NULL),
ADD CONSTRAINT content_engagement_content_id_not_null CHECK (content_id IS NOT NULL),
ADD CONSTRAINT content_engagement_content_type_not_null CHECK (content_type IS NOT NULL),
ADD CONSTRAINT content_engagement_time_spent_positive CHECK (time_spent > 0);

-- Performance trends constraints
ALTER TABLE performance_trends 
ADD CONSTRAINT performance_trends_analytics_id_not_null CHECK (analytics_id IS NOT NULL),
ADD CONSTRAINT performance_trends_metric_not_null CHECK (metric IS NOT NULL),
ADD CONSTRAINT performance_trends_time_range_start_not_null CHECK (time_range_start IS NOT NULL),
ADD CONSTRAINT performance_trends_time_range_end_not_null CHECK (time_range_end IS NOT NULL),
ADD CONSTRAINT performance_trends_time_range_valid CHECK (time_range_end >= time_range_start),
ADD CONSTRAINT performance_trends_values_not_null CHECK (values IS NOT NULL),
ADD CONSTRAINT performance_trends_trend_not_null CHECK (trend IS NOT NULL);

-- Recommendations constraints
ALTER TABLE recommendations 
ADD CONSTRAINT recommendations_user_id_not_null CHECK (user_id IS NOT NULL),
ADD CONSTRAINT recommendations_recommendation_type_not_null CHECK (recommendation_type IS NOT NULL),
ADD CONSTRAINT recommendations_title_not_null CHECK (title IS NOT NULL),
ADD CONSTRAINT recommendations_description_not_null CHECK (description IS NOT NULL),
ADD CONSTRAINT recommendations_reasoning_not_null CHECK (reasoning IS NOT NULL),
ADD CONSTRAINT recommendations_priority_not_null CHECK (priority IS NOT NULL),
ADD CONSTRAINT recommendations_expires_at_after_created CHECK (expires_at IS NULL OR expires_at >= created_at),
ADD CONSTRAINT recommendations_responded_at_after_created CHECK (responded_at IS NULL OR responded_at >= created_at);

-- Learning predictions constraints
ALTER TABLE learning_predictions 
ADD CONSTRAINT learning_predictions_user_id_not_null CHECK (user_id IS NOT NULL),
ADD CONSTRAINT learning_predictions_metric_not_null CHECK (metric IS NOT NULL),
ADD CONSTRAINT learning_predictions_timeframe_positive CHECK (timeframe > 0),
ADD CONSTRAINT learning_predictions_target_date_not_null CHECK (target_date IS NOT NULL),
ADD CONSTRAINT learning_predictions_target_date_future CHECK (target_date > created_at),
ADD CONSTRAINT learning_predictions_validated_at_after_created CHECK (validated_at IS NULL OR validated_at >= created_at);

-- System config constraints
ALTER TABLE system_config 
ADD CONSTRAINT system_config_config_key_not_null CHECK (config_key IS NOT NULL),
ADD CONSTRAINT system_config_config_value_not_null CHECK (config_value IS NOT NULL),
ADD CONSTRAINT system_config_config_key_length CHECK (char_length(config_key) <= 100);

-- ==========================================
-- ADD UNIQUE CONSTRAINTS FOR BUSINESS RULES
-- ==========================================

-- Ensure only one active learning session per user
CREATE UNIQUE INDEX idx_unique_active_session_per_user 
ON learning_sessions (user_id) 
WHERE end_time IS NULL;

-- Ensure unique question order within assessment
CREATE UNIQUE INDEX idx_unique_question_order_per_assessment 
ON adaptive_questions (assessment_id, question_text);

-- Ensure unique option order within question
CREATE UNIQUE INDEX idx_unique_option_order_per_question 
ON question_options (question_id, order_index);

-- Ensure only one correct answer per multiple choice question
CREATE UNIQUE INDEX idx_unique_correct_answer_per_question 
ON question_options (question_id) 
WHERE is_correct = true;

-- Ensure unique style assessment per profile and type
CREATE UNIQUE INDEX idx_unique_style_assessment_per_profile_type 
ON style_assessments (profile_id, assessment_type);

-- Ensure unique system config keys
CREATE UNIQUE INDEX idx_unique_system_config_key 
ON system_config (config_key);

-- ==========================================
-- ADD FOREIGN KEY CONSTRAINTS
-- ==========================================

-- Add foreign key constraints that may be missing
ALTER TABLE user_preferences 
ADD CONSTRAINT fk_user_preferences_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE learning_profiles 
ADD CONSTRAINT fk_learning_profiles_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE learning_styles 
ADD CONSTRAINT fk_learning_styles_profile_id 
FOREIGN KEY (profile_id) REFERENCES learning_profiles(id) ON DELETE CASCADE;

ALTER TABLE style_assessments 
ADD CONSTRAINT fk_style_assessments_profile_id 
FOREIGN KEY (profile_id) REFERENCES learning_profiles(id) ON DELETE CASCADE;

ALTER TABLE behavioral_indicators 
ADD CONSTRAINT fk_behavioral_indicators_profile_id 
FOREIGN KEY (profile_id) REFERENCES learning_profiles(id) ON DELETE CASCADE;

ALTER TABLE pace_profiles 
ADD CONSTRAINT fk_pace_profiles_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE pace_adjustments 
ADD CONSTRAINT fk_pace_adjustments_pace_profile_id 
FOREIGN KEY (pace_profile_id) REFERENCES pace_profiles(id) ON DELETE CASCADE;

ALTER TABLE learning_sessions 
ADD CONSTRAINT fk_learning_sessions_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE adaptive_changes 
ADD CONSTRAINT fk_adaptive_changes_session_id 
FOREIGN KEY (session_id) REFERENCES learning_sessions(id) ON DELETE CASCADE;

ALTER TABLE content_variants 
ADD CONSTRAINT fk_content_variants_content_id 
FOREIGN KEY (content_id) REFERENCES adaptive_content(id) ON DELETE CASCADE;

ALTER TABLE media_content 
ADD CONSTRAINT fk_media_content_variant_id 
FOREIGN KEY (variant_id) REFERENCES content_variants(id) ON DELETE CASCADE;

ALTER TABLE adaptive_assessments 
ADD CONSTRAINT fk_adaptive_assessments_content_id 
FOREIGN KEY (content_id) REFERENCES adaptive_content(id) ON DELETE CASCADE;

ALTER TABLE adaptive_questions 
ADD CONSTRAINT fk_adaptive_questions_assessment_id 
FOREIGN KEY (assessment_id) REFERENCES adaptive_assessments(id) ON DELETE CASCADE;

ALTER TABLE question_options 
ADD CONSTRAINT fk_question_options_question_id 
FOREIGN KEY (question_id) REFERENCES adaptive_questions(id) ON DELETE CASCADE;

ALTER TABLE assessment_attempts 
ADD CONSTRAINT fk_assessment_attempts_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_assessment_attempts_assessment_id 
FOREIGN KEY (assessment_id) REFERENCES adaptive_assessments(id) ON DELETE CASCADE;

ALTER TABLE question_responses 
ADD CONSTRAINT fk_question_responses_attempt_id 
FOREIGN KEY (attempt_id) REFERENCES assessment_attempts(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_question_responses_question_id 
FOREIGN KEY (question_id) REFERENCES adaptive_questions(id) ON DELETE CASCADE;

ALTER TABLE learning_analytics 
ADD CONSTRAINT fk_learning_analytics_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE style_effectiveness 
ADD CONSTRAINT fk_style_effectiveness_analytics_id 
FOREIGN KEY (analytics_id) REFERENCES learning_analytics(id) ON DELETE CASCADE;

ALTER TABLE content_engagement 
ADD CONSTRAINT fk_content_engagement_analytics_id 
FOREIGN KEY (analytics_id) REFERENCES learning_analytics(id) ON DELETE CASCADE;

ALTER TABLE performance_trends 
ADD CONSTRAINT fk_performance_trends_analytics_id 
FOREIGN KEY (analytics_id) REFERENCES learning_analytics(id) ON DELETE CASCADE;

ALTER TABLE recommendations 
ADD CONSTRAINT fk_recommendations_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE learning_predictions 
ADD CONSTRAINT fk_learning_predictions_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ==========================================
-- ADD COMMENTS FOR DOCUMENTATION
-- ==========================================

COMMENT ON CONSTRAINT user_preferences_daily_goal_positive ON user_preferences IS 'Daily goal must be positive';
COMMENT ON CONSTRAINT learning_sessions_correct_answers_valid ON learning_sessions IS 'Correct answers cannot exceed total questions';
COMMENT ON CONSTRAINT learning_sessions_focus_time_valid ON learning_sessions IS 'Focus time cannot exceed total session duration';
COMMENT ON CONSTRAINT adaptive_assessments_questions_range_valid ON adaptive_assessments IS 'Maximum questions must be >= minimum questions';
COMMENT ON CONSTRAINT learning_analytics_goals_achieved_valid ON learning_analytics IS 'Goals achieved cannot exceed total goals';
COMMENT ON CONSTRAINT performance_trends_time_range_valid ON performance_trends IS 'Time range end must be >= start';

-- Insert migration record
INSERT INTO migration_history (version, name, checksum, executed_at) 
VALUES (3, 'add_missing_constraints', md5('add_missing_constraints_v1'), NOW());