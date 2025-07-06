-- Description: Database views and utility functions for common queries
-- Version: 20250106000004
-- Dependencies: 20250106000003_analytics_recommendations.sql

-- ==========================================
-- VIEWS FOR COMMON QUERIES
-- ==========================================

-- User learning overview
CREATE VIEW user_learning_overview AS
SELECT 
    u.id as user_id,
    u.name,
    u.email,
    lp.dominant_style,
    lp.is_multimodal,
    lp.adaptation_level,
    pp.current_pace,
    pp.optimal_pace,
    pp.comprehension_rate,
    COUNT(DISTINCT ls.id) as total_sessions,
    COALESCE(SUM(ls.duration), 0) as total_time_spent,
    COALESCE(AVG(CASE WHEN ls.total_questions > 0 THEN ls.correct_answers::DECIMAL / ls.total_questions * 100 ELSE 0 END), 0) as average_score
FROM users u
LEFT JOIN learning_profiles lp ON u.id = lp.user_id
LEFT JOIN pace_profiles pp ON u.id = pp.user_id
LEFT JOIN learning_sessions ls ON u.id = ls.user_id
GROUP BY u.id, u.name, u.email, lp.dominant_style, lp.is_multimodal, lp.adaptation_level, pp.current_pace, pp.optimal_pace, pp.comprehension_rate;

-- Content effectiveness view
CREATE VIEW content_effectiveness AS
SELECT 
    ac.id as content_id,
    ac.title,
    ac.concept,
    ac.difficulty,
    COUNT(DISTINCT ls.id) as total_sessions,
    AVG(CASE WHEN ls.total_questions > 0 THEN ls.correct_answers::DECIMAL / ls.total_questions * 100 ELSE 0 END) as average_score,
    AVG(ls.duration) as average_duration,
    COUNT(DISTINCT ls.user_id) as unique_users
FROM adaptive_content ac
LEFT JOIN learning_sessions ls ON ac.id::TEXT = ls.content_id
GROUP BY ac.id, ac.title, ac.concept, ac.difficulty;

-- Recent user activity view
CREATE VIEW recent_user_activity AS
SELECT 
    u.id as user_id,
    u.name,
    MAX(ls.start_time) as last_session,
    COUNT(DISTINCT DATE(ls.start_time)) as active_days_last_30,
    COUNT(DISTINCT ls.id) as sessions_last_30,
    SUM(ls.duration) as total_time_last_30
FROM users u
LEFT JOIN learning_sessions ls ON u.id = ls.user_id 
    AND ls.start_time >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY u.id, u.name;

-- Learning style distribution view
CREATE VIEW learning_style_distribution AS
SELECT 
    lp.dominant_style,
    COUNT(*) as user_count,
    AVG(lp.adaptation_level) as avg_adaptation_level,
    AVG(lp.confidence_score) as avg_confidence_score
FROM learning_profiles lp
GROUP BY lp.dominant_style;

-- User progress summary view
CREATE VIEW user_progress_summary AS
SELECT 
    u.id as user_id,
    u.name,
    COUNT(DISTINCT ls.id) as total_sessions,
    SUM(ls.duration) as total_learning_time,
    AVG(CASE WHEN ls.total_questions > 0 THEN ls.correct_answers::DECIMAL / ls.total_questions * 100 ELSE 0 END) as overall_accuracy,
    COUNT(DISTINCT aa.id) as total_assessments,
    COUNT(DISTINCT CASE WHEN aa.passed THEN aa.id END) as passed_assessments,
    MAX(ls.start_time) as last_activity
FROM users u
LEFT JOIN learning_sessions ls ON u.id = ls.user_id
LEFT JOIN assessment_attempts aa ON u.id = aa.user_id
GROUP BY u.id, u.name;

-- Content engagement summary view
CREATE VIEW content_engagement_summary AS
SELECT 
    ac.id as content_id,
    ac.title,
    ac.concept,
    ac.difficulty,
    cv.style_type,
    COUNT(DISTINCT ls.user_id) as unique_learners,
    AVG(ls.duration) as avg_session_duration,
    AVG(CASE WHEN ls.total_questions > 0 THEN ls.correct_answers::DECIMAL / ls.total_questions * 100 ELSE 0 END) as avg_accuracy,
    COUNT(DISTINCT ls.id) as total_sessions
FROM adaptive_content ac
LEFT JOIN content_variants cv ON ac.id = cv.content_id
LEFT JOIN learning_sessions ls ON ac.id::TEXT = ls.content_id
GROUP BY ac.id, ac.title, ac.concept, ac.difficulty, cv.style_type;

-- ==========================================
-- UTILITY FUNCTIONS
-- ==========================================

-- Function to calculate learning style scores
CREATE OR REPLACE FUNCTION calculate_learning_style_score(
    profile_id_param UUID,
    style_type_param VARCHAR(20)
) RETURNS DECIMAL(5,2) AS $$
DECLARE
    behavioral_score DECIMAL(5,2) := 0;
    assessment_score DECIMAL(5,2) := 0;
    final_score DECIMAL(5,2) := 0;
BEGIN
    -- Calculate behavioral score
    SELECT COALESCE(AVG(
        CASE 
            WHEN content_type = style_type_param THEN 
                (engagement_level + completion_rate) / 2.0
            ELSE 0 
        END
    ), 0) INTO behavioral_score
    FROM behavioral_indicators 
    WHERE profile_id = profile_id_param;
    
    -- Get assessment score
    SELECT COALESCE(
        CASE style_type_param
            WHEN 'visual' THEN AVG(visual_score)
            WHEN 'auditory' THEN AVG(auditory_score)
            WHEN 'reading' THEN AVG(reading_score)
            WHEN 'kinesthetic' THEN AVG(kinesthetic_score)
            ELSE 0
        END * 100, 0
    ) INTO assessment_score
    FROM style_assessments 
    WHERE profile_id = profile_id_param;
    
    -- Weighted combination (70% behavioral, 30% assessment)
    final_score := (behavioral_score * 0.7) + (assessment_score * 0.3);
    
    RETURN final_score;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's current learning pace
CREATE OR REPLACE FUNCTION get_user_current_pace(user_id_param UUID) 
RETURNS DECIMAL(4,2) AS $$
DECLARE
    current_pace DECIMAL(4,2) := 0;
BEGIN
    SELECT COALESCE(pp.current_pace, 3.0) INTO current_pace
    FROM pace_profiles pp
    WHERE pp.user_id = user_id_param;
    
    RETURN current_pace;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate content difficulty adjustment
CREATE OR REPLACE FUNCTION calculate_difficulty_adjustment(
    user_id_param UUID,
    content_id_param UUID,
    current_performance DECIMAL(5,2)
) RETURNS INTEGER AS $$
DECLARE
    user_adaptation_level INTEGER := 0;
    content_difficulty INTEGER := 5;
    performance_threshold DECIMAL(5,2) := 80.0;
    adjustment INTEGER := 0;
BEGIN
    -- Get user adaptation level
    SELECT COALESCE(lp.adaptation_level, 0) INTO user_adaptation_level
    FROM learning_profiles lp
    WHERE lp.user_id = user_id_param;
    
    -- Get content difficulty
    SELECT COALESCE(ac.difficulty, 5) INTO content_difficulty
    FROM adaptive_content ac
    WHERE ac.id = content_id_param;
    
    -- Calculate adjustment based on performance
    IF current_performance > performance_threshold + 10 THEN
        adjustment := LEAST(2, (user_adaptation_level / 50)); -- Increase difficulty
    ELSIF current_performance < performance_threshold - 10 THEN
        adjustment := GREATEST(-2, -(user_adaptation_level / 50)); -- Decrease difficulty
    END IF;
    
    RETURN adjustment;
END;
$$ LANGUAGE plpgsql;

-- Function to update learning profile confidence
CREATE OR REPLACE FUNCTION update_learning_profile_confidence(profile_id_param UUID) 
RETURNS VOID AS $$
DECLARE
    data_points INTEGER := 0;
    new_confidence DECIMAL(3,2) := 0;
BEGIN
    -- Count behavioral indicators
    SELECT COUNT(*) INTO data_points
    FROM behavioral_indicators bi
    WHERE bi.profile_id = profile_id_param;
    
    -- Calculate confidence based on data points
    IF data_points >= 50 THEN
        new_confidence := 0.95;
    ELSIF data_points >= 30 THEN
        new_confidence := 0.85;
    ELSIF data_points >= 20 THEN
        new_confidence := 0.75;
    ELSIF data_points >= 10 THEN
        new_confidence := 0.65;
    ELSE
        new_confidence := 0.50;
    END IF;
    
    -- Update the profile
    UPDATE learning_profiles 
    SET confidence_score = new_confidence,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = profile_id_param;
END;
$$ LANGUAGE plpgsql;

-- Function to get personalized content recommendations
CREATE OR REPLACE FUNCTION get_content_recommendations(
    user_id_param UUID,
    limit_param INTEGER DEFAULT 5
) RETURNS TABLE(
    content_id UUID,
    title VARCHAR(255),
    concept VARCHAR(255),
    difficulty INTEGER,
    match_score DECIMAL(5,2),
    recommendation_reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ac.id,
        ac.title,
        ac.concept,
        ac.difficulty,
        -- Calculate match score based on user's learning style and progress
        (
            CASE 
                WHEN lp.dominant_style = 'visual' AND cv.style_type = 'visual' THEN 20
                WHEN lp.dominant_style = 'auditory' AND cv.style_type = 'auditory' THEN 20
                WHEN lp.dominant_style = 'reading' AND cv.style_type = 'reading' THEN 20
                WHEN lp.dominant_style = 'kinesthetic' AND cv.style_type = 'kinesthetic' THEN 20
                ELSE 5
            END +
            CASE 
                WHEN ac.difficulty BETWEEN (pp.current_pace * 2 - 1) AND (pp.current_pace * 2 + 1) THEN 15
                ELSE 0
            END +
            CASE 
                WHEN ac.success_rate >= 80 THEN 10
                ELSE 0
            END
        )::DECIMAL(5,2) as match_score,
        CASE 
            WHEN lp.dominant_style = cv.style_type THEN 'Matches your ' || lp.dominant_style || ' learning style'
            ELSE 'Recommended based on your progress'
        END as recommendation_reason
    FROM adaptive_content ac
    JOIN content_variants cv ON ac.id = cv.content_id
    LEFT JOIN learning_profiles lp ON lp.user_id = user_id_param
    LEFT JOIN pace_profiles pp ON pp.user_id = user_id_param
    WHERE ac.id NOT IN (
        SELECT DISTINCT ls.content_id::UUID
        FROM learning_sessions ls
        WHERE ls.user_id = user_id_param
        AND ls.completed = true
    )
    ORDER BY match_score DESC
    LIMIT limit_param;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- COMMENTS AND DOCUMENTATION
-- ==========================================

COMMENT ON VIEW user_learning_overview IS 'Comprehensive overview of user learning statistics and preferences';
COMMENT ON VIEW content_effectiveness IS 'Analytics on content performance and user engagement';
COMMENT ON VIEW recent_user_activity IS 'Recent activity summary for user engagement tracking';
COMMENT ON VIEW learning_style_distribution IS 'Distribution of learning styles across all users';
COMMENT ON VIEW user_progress_summary IS 'Individual user progress and achievement summary';
COMMENT ON VIEW content_engagement_summary IS 'Content engagement metrics by learning style';

COMMENT ON FUNCTION calculate_learning_style_score IS 'Calculates weighted learning style score combining behavioral and assessment data';
COMMENT ON FUNCTION get_user_current_pace IS 'Returns the current learning pace for a user';
COMMENT ON FUNCTION calculate_difficulty_adjustment IS 'Calculates recommended difficulty adjustment based on performance';
COMMENT ON FUNCTION update_learning_profile_confidence IS 'Updates learning profile confidence based on data points';
COMMENT ON FUNCTION get_content_recommendations IS 'Returns personalized content recommendations for a user';