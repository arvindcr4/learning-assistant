-- Rollback for Migration 003: Remove Added Constraints
-- Remove all constraints added in migration 003

-- ==========================================
-- REMOVE FOREIGN KEY CONSTRAINTS
-- ==========================================

ALTER TABLE learning_predictions DROP CONSTRAINT IF EXISTS fk_learning_predictions_user_id;
ALTER TABLE recommendations DROP CONSTRAINT IF EXISTS fk_recommendations_user_id;
ALTER TABLE performance_trends DROP CONSTRAINT IF EXISTS fk_performance_trends_analytics_id;
ALTER TABLE content_engagement DROP CONSTRAINT IF EXISTS fk_content_engagement_analytics_id;
ALTER TABLE style_effectiveness DROP CONSTRAINT IF EXISTS fk_style_effectiveness_analytics_id;
ALTER TABLE learning_analytics DROP CONSTRAINT IF EXISTS fk_learning_analytics_user_id;
ALTER TABLE question_responses DROP CONSTRAINT IF EXISTS fk_question_responses_question_id;
ALTER TABLE question_responses DROP CONSTRAINT IF EXISTS fk_question_responses_attempt_id;
ALTER TABLE assessment_attempts DROP CONSTRAINT IF EXISTS fk_assessment_attempts_assessment_id;
ALTER TABLE assessment_attempts DROP CONSTRAINT IF EXISTS fk_assessment_attempts_user_id;
ALTER TABLE question_options DROP CONSTRAINT IF EXISTS fk_question_options_question_id;
ALTER TABLE adaptive_questions DROP CONSTRAINT IF EXISTS fk_adaptive_questions_assessment_id;
ALTER TABLE adaptive_assessments DROP CONSTRAINT IF EXISTS fk_adaptive_assessments_content_id;
ALTER TABLE media_content DROP CONSTRAINT IF EXISTS fk_media_content_variant_id;
ALTER TABLE content_variants DROP CONSTRAINT IF EXISTS fk_content_variants_content_id;
ALTER TABLE adaptive_changes DROP CONSTRAINT IF EXISTS fk_adaptive_changes_session_id;
ALTER TABLE learning_sessions DROP CONSTRAINT IF EXISTS fk_learning_sessions_user_id;
ALTER TABLE pace_adjustments DROP CONSTRAINT IF EXISTS fk_pace_adjustments_pace_profile_id;
ALTER TABLE pace_profiles DROP CONSTRAINT IF EXISTS fk_pace_profiles_user_id;
ALTER TABLE behavioral_indicators DROP CONSTRAINT IF EXISTS fk_behavioral_indicators_profile_id;
ALTER TABLE style_assessments DROP CONSTRAINT IF EXISTS fk_style_assessments_profile_id;
ALTER TABLE learning_styles DROP CONSTRAINT IF EXISTS fk_learning_styles_profile_id;
ALTER TABLE learning_profiles DROP CONSTRAINT IF EXISTS fk_learning_profiles_user_id;
ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS fk_user_preferences_user_id;

-- ==========================================
-- REMOVE UNIQUE CONSTRAINTS
-- ==========================================

DROP INDEX IF EXISTS idx_unique_system_config_key;
DROP INDEX IF EXISTS idx_unique_style_assessment_per_profile_type;
DROP INDEX IF EXISTS idx_unique_correct_answer_per_question;
DROP INDEX IF EXISTS idx_unique_option_order_per_question;
DROP INDEX IF EXISTS idx_unique_question_order_per_assessment;
DROP INDEX IF EXISTS idx_unique_active_session_per_user;

-- ==========================================
-- REMOVE CHECK CONSTRAINTS
-- ==========================================

-- System config constraints
ALTER TABLE system_config DROP CONSTRAINT IF EXISTS system_config_config_key_length;
ALTER TABLE system_config DROP CONSTRAINT IF EXISTS system_config_config_value_not_null;
ALTER TABLE system_config DROP CONSTRAINT IF EXISTS system_config_config_key_not_null;

-- Learning predictions constraints
ALTER TABLE learning_predictions DROP CONSTRAINT IF EXISTS learning_predictions_validated_at_after_created;
ALTER TABLE learning_predictions DROP CONSTRAINT IF EXISTS learning_predictions_target_date_future;
ALTER TABLE learning_predictions DROP CONSTRAINT IF EXISTS learning_predictions_target_date_not_null;
ALTER TABLE learning_predictions DROP CONSTRAINT IF EXISTS learning_predictions_timeframe_positive;
ALTER TABLE learning_predictions DROP CONSTRAINT IF EXISTS learning_predictions_metric_not_null;
ALTER TABLE learning_predictions DROP CONSTRAINT IF EXISTS learning_predictions_user_id_not_null;

-- Recommendations constraints
ALTER TABLE recommendations DROP CONSTRAINT IF EXISTS recommendations_responded_at_after_created;
ALTER TABLE recommendations DROP CONSTRAINT IF EXISTS recommendations_expires_at_after_created;
ALTER TABLE recommendations DROP CONSTRAINT IF EXISTS recommendations_priority_not_null;
ALTER TABLE recommendations DROP CONSTRAINT IF EXISTS recommendations_reasoning_not_null;
ALTER TABLE recommendations DROP CONSTRAINT IF EXISTS recommendations_description_not_null;
ALTER TABLE recommendations DROP CONSTRAINT IF EXISTS recommendations_title_not_null;
ALTER TABLE recommendations DROP CONSTRAINT IF EXISTS recommendations_recommendation_type_not_null;
ALTER TABLE recommendations DROP CONSTRAINT IF EXISTS recommendations_user_id_not_null;

-- Performance trends constraints
ALTER TABLE performance_trends DROP CONSTRAINT IF EXISTS performance_trends_trend_not_null;
ALTER TABLE performance_trends DROP CONSTRAINT IF EXISTS performance_trends_values_not_null;
ALTER TABLE performance_trends DROP CONSTRAINT IF EXISTS performance_trends_time_range_valid;
ALTER TABLE performance_trends DROP CONSTRAINT IF EXISTS performance_trends_time_range_end_not_null;
ALTER TABLE performance_trends DROP CONSTRAINT IF EXISTS performance_trends_time_range_start_not_null;
ALTER TABLE performance_trends DROP CONSTRAINT IF EXISTS performance_trends_metric_not_null;
ALTER TABLE performance_trends DROP CONSTRAINT IF EXISTS performance_trends_analytics_id_not_null;

-- Content engagement constraints
ALTER TABLE content_engagement DROP CONSTRAINT IF EXISTS content_engagement_time_spent_positive;
ALTER TABLE content_engagement DROP CONSTRAINT IF EXISTS content_engagement_content_type_not_null;
ALTER TABLE content_engagement DROP CONSTRAINT IF EXISTS content_engagement_content_id_not_null;
ALTER TABLE content_engagement DROP CONSTRAINT IF EXISTS content_engagement_analytics_id_not_null;

-- Style effectiveness constraints
ALTER TABLE style_effectiveness DROP CONSTRAINT IF EXISTS style_effectiveness_time_to_mastery_positive;
ALTER TABLE style_effectiveness DROP CONSTRAINT IF EXISTS style_effectiveness_style_type_not_null;
ALTER TABLE style_effectiveness DROP CONSTRAINT IF EXISTS style_effectiveness_analytics_id_not_null;

-- Learning analytics constraints
ALTER TABLE learning_analytics DROP CONSTRAINT IF EXISTS learning_analytics_recommended_breaks_non_negative;
ALTER TABLE learning_analytics DROP CONSTRAINT IF EXISTS learning_analytics_optimal_pace_positive;
ALTER TABLE learning_analytics DROP CONSTRAINT IF EXISTS learning_analytics_average_pace_positive;
ALTER TABLE learning_analytics DROP CONSTRAINT IF EXISTS learning_analytics_goals_achieved_valid;
ALTER TABLE learning_analytics DROP CONSTRAINT IF EXISTS learning_analytics_total_goals_non_negative;
ALTER TABLE learning_analytics DROP CONSTRAINT IF EXISTS learning_analytics_goals_achieved_non_negative;
ALTER TABLE learning_analytics DROP CONSTRAINT IF EXISTS learning_analytics_streak_days_non_negative;
ALTER TABLE learning_analytics DROP CONSTRAINT IF EXISTS learning_analytics_content_completed_non_negative;
ALTER TABLE learning_analytics DROP CONSTRAINT IF EXISTS learning_analytics_total_time_spent_non_negative;
ALTER TABLE learning_analytics DROP CONSTRAINT IF EXISTS learning_analytics_time_range_valid;
ALTER TABLE learning_analytics DROP CONSTRAINT IF EXISTS learning_analytics_time_range_end_not_null;
ALTER TABLE learning_analytics DROP CONSTRAINT IF EXISTS learning_analytics_time_range_start_not_null;
ALTER TABLE learning_analytics DROP CONSTRAINT IF EXISTS learning_analytics_user_id_not_null;

-- Question responses constraints
ALTER TABLE question_responses DROP CONSTRAINT IF EXISTS question_responses_time_spent_positive;
ALTER TABLE question_responses DROP CONSTRAINT IF EXISTS question_responses_hints_used_non_negative;
ALTER TABLE question_responses DROP CONSTRAINT IF EXISTS question_responses_question_id_not_null;
ALTER TABLE question_responses DROP CONSTRAINT IF EXISTS question_responses_attempt_id_not_null;

-- Assessment attempts constraints
ALTER TABLE assessment_attempts DROP CONSTRAINT IF EXISTS assessment_attempts_completed_at_after_started;
ALTER TABLE assessment_attempts DROP CONSTRAINT IF EXISTS assessment_attempts_time_spent_positive;
ALTER TABLE assessment_attempts DROP CONSTRAINT IF EXISTS assessment_attempts_correct_answers_valid;
ALTER TABLE assessment_attempts DROP CONSTRAINT IF EXISTS assessment_attempts_correct_answers_non_negative;
ALTER TABLE assessment_attempts DROP CONSTRAINT IF EXISTS assessment_attempts_questions_answered_non_negative;
ALTER TABLE assessment_attempts DROP CONSTRAINT IF EXISTS assessment_attempts_assessment_id_not_null;
ALTER TABLE assessment_attempts DROP CONSTRAINT IF EXISTS assessment_attempts_user_id_not_null;

-- Question options constraints
ALTER TABLE question_options DROP CONSTRAINT IF EXISTS question_options_order_index_positive;
ALTER TABLE question_options DROP CONSTRAINT IF EXISTS question_options_option_text_not_null;
ALTER TABLE question_options DROP CONSTRAINT IF EXISTS question_options_question_id_not_null;

-- Adaptive questions constraints
ALTER TABLE adaptive_questions DROP CONSTRAINT IF EXISTS adaptive_questions_time_limit_positive;
ALTER TABLE adaptive_questions DROP CONSTRAINT IF EXISTS adaptive_questions_points_positive;
ALTER TABLE adaptive_questions DROP CONSTRAINT IF EXISTS adaptive_questions_correct_answer_not_null;
ALTER TABLE adaptive_questions DROP CONSTRAINT IF EXISTS adaptive_questions_question_type_not_null;
ALTER TABLE adaptive_questions DROP CONSTRAINT IF EXISTS adaptive_questions_question_text_not_null;
ALTER TABLE adaptive_questions DROP CONSTRAINT IF EXISTS adaptive_questions_assessment_id_not_null;

-- Adaptive assessments constraints
ALTER TABLE adaptive_assessments DROP CONSTRAINT IF EXISTS adaptive_assessments_time_limit_positive;
ALTER TABLE adaptive_assessments DROP CONSTRAINT IF EXISTS adaptive_assessments_total_points_positive;
ALTER TABLE adaptive_assessments DROP CONSTRAINT IF EXISTS adaptive_assessments_questions_range_valid;
ALTER TABLE adaptive_assessments DROP CONSTRAINT IF EXISTS adaptive_assessments_maximum_questions_positive;
ALTER TABLE adaptive_assessments DROP CONSTRAINT IF EXISTS adaptive_assessments_minimum_questions_positive;
ALTER TABLE adaptive_assessments DROP CONSTRAINT IF EXISTS adaptive_assessments_title_not_null;
ALTER TABLE adaptive_assessments DROP CONSTRAINT IF EXISTS adaptive_assessments_assessment_type_not_null;
ALTER TABLE adaptive_assessments DROP CONSTRAINT IF EXISTS adaptive_assessments_content_id_not_null;

-- Media content constraints
ALTER TABLE media_content DROP CONSTRAINT IF EXISTS media_content_file_size_positive;
ALTER TABLE media_content DROP CONSTRAINT IF EXISTS media_content_duration_positive;
ALTER TABLE media_content DROP CONSTRAINT IF EXISTS media_content_url_not_null;
ALTER TABLE media_content DROP CONSTRAINT IF EXISTS media_content_media_type_not_null;
ALTER TABLE media_content DROP CONSTRAINT IF EXISTS media_content_variant_id_not_null;

-- Content variants constraints
ALTER TABLE content_variants DROP CONSTRAINT IF EXISTS content_variants_interactivity_level_not_null;
ALTER TABLE content_variants DROP CONSTRAINT IF EXISTS content_variants_content_data_not_null;
ALTER TABLE content_variants DROP CONSTRAINT IF EXISTS content_variants_format_not_null;
ALTER TABLE content_variants DROP CONSTRAINT IF EXISTS content_variants_style_type_not_null;
ALTER TABLE content_variants DROP CONSTRAINT IF EXISTS content_variants_content_id_not_null;

-- Adaptive content constraints
ALTER TABLE adaptive_content DROP CONSTRAINT IF EXISTS adaptive_content_blooms_taxonomy_valid;
ALTER TABLE adaptive_content DROP CONSTRAINT IF EXISTS adaptive_content_title_length;
ALTER TABLE adaptive_content DROP CONSTRAINT IF EXISTS adaptive_content_estimated_duration_positive;
ALTER TABLE adaptive_content DROP CONSTRAINT IF EXISTS adaptive_content_concept_not_null;
ALTER TABLE adaptive_content DROP CONSTRAINT IF EXISTS adaptive_content_title_not_null;

-- Adaptive changes constraints
ALTER TABLE adaptive_changes DROP CONSTRAINT IF EXISTS adaptive_changes_reason_not_null;
ALTER TABLE adaptive_changes DROP CONSTRAINT IF EXISTS adaptive_changes_change_type_not_null;
ALTER TABLE adaptive_changes DROP CONSTRAINT IF EXISTS adaptive_changes_session_id_not_null;

-- Learning sessions constraints
ALTER TABLE learning_sessions DROP CONSTRAINT IF EXISTS learning_sessions_end_time_after_start;
ALTER TABLE learning_sessions DROP CONSTRAINT IF EXISTS learning_sessions_pause_frequency_non_negative;
ALTER TABLE learning_sessions DROP CONSTRAINT IF EXISTS learning_sessions_video_watch_time_valid;
ALTER TABLE learning_sessions DROP CONSTRAINT IF EXISTS learning_sessions_interaction_rate_non_negative;
ALTER TABLE learning_sessions DROP CONSTRAINT IF EXISTS learning_sessions_distraction_events_non_negative;
ALTER TABLE learning_sessions DROP CONSTRAINT IF EXISTS learning_sessions_focus_time_valid;
ALTER TABLE learning_sessions DROP CONSTRAINT IF EXISTS learning_sessions_correct_answers_valid;
ALTER TABLE learning_sessions DROP CONSTRAINT IF EXISTS learning_sessions_total_questions_non_negative;
ALTER TABLE learning_sessions DROP CONSTRAINT IF EXISTS learning_sessions_correct_answers_non_negative;
ALTER TABLE learning_sessions DROP CONSTRAINT IF EXISTS learning_sessions_items_completed_non_negative;
ALTER TABLE learning_sessions DROP CONSTRAINT IF EXISTS learning_sessions_duration_positive;
ALTER TABLE learning_sessions DROP CONSTRAINT IF EXISTS learning_sessions_content_id_not_null;
ALTER TABLE learning_sessions DROP CONSTRAINT IF EXISTS learning_sessions_user_id_not_null;

-- Pace adjustments constraints
ALTER TABLE pace_adjustments DROP CONSTRAINT IF EXISTS pace_adjustments_new_pace_positive;
ALTER TABLE pace_adjustments DROP CONSTRAINT IF EXISTS pace_adjustments_previous_pace_positive;
ALTER TABLE pace_adjustments DROP CONSTRAINT IF EXISTS pace_adjustments_profile_id_not_null;

-- Pace profiles constraints
ALTER TABLE pace_profiles DROP CONSTRAINT IF EXISTS pace_profiles_optimal_pace_positive;
ALTER TABLE pace_profiles DROP CONSTRAINT IF EXISTS pace_profiles_current_pace_positive;
ALTER TABLE pace_profiles DROP CONSTRAINT IF EXISTS pace_profiles_user_id_not_null;

-- Behavioral indicators constraints
ALTER TABLE behavioral_indicators DROP CONSTRAINT IF EXISTS behavioral_indicators_time_spent_positive;
ALTER TABLE behavioral_indicators DROP CONSTRAINT IF EXISTS behavioral_indicators_action_not_null;
ALTER TABLE behavioral_indicators DROP CONSTRAINT IF EXISTS behavioral_indicators_profile_id_not_null;

-- Style assessments constraints
ALTER TABLE style_assessments DROP CONSTRAINT IF EXISTS style_assessments_data_points_non_negative;
ALTER TABLE style_assessments DROP CONSTRAINT IF EXISTS style_assessments_assessment_type_not_null;
ALTER TABLE style_assessments DROP CONSTRAINT IF EXISTS style_assessments_profile_id_not_null;

-- Learning styles constraints
ALTER TABLE learning_styles DROP CONSTRAINT IF EXISTS learning_styles_style_type_not_null;
ALTER TABLE learning_styles DROP CONSTRAINT IF EXISTS learning_styles_profile_id_not_null;

-- Learning profiles constraints
ALTER TABLE learning_profiles DROP CONSTRAINT IF EXISTS learning_profiles_dominant_style_not_null;
ALTER TABLE learning_profiles DROP CONSTRAINT IF EXISTS learning_profiles_user_id_not_null;

-- User preferences constraints
ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_days_per_week_valid;
ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_daily_goal_positive;
ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_user_id_not_null;

-- Remove migration record
DELETE FROM migration_history WHERE version = 3;