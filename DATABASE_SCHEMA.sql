-- Personal Learning Assistant Database Schema
-- PostgreSQL Database Schema for Adaptive Learning System

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- USER MANAGEMENT TABLES
-- ==========================================

-- Users table with enhanced learning profiles
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    CONSTRAINT users_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- User preferences
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    learning_goals TEXT[],
    preferred_topics TEXT[],
    difficulty_level VARCHAR(20) CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    daily_goal_minutes INTEGER DEFAULT 30,
    preferred_times TEXT[],
    days_per_week INTEGER DEFAULT 5,
    email_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT true,
    reminder_notifications BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    UNIQUE(user_id)
);

-- ==========================================
-- LEARNING STYLE DETECTION TABLES
-- ==========================================

-- Learning profiles
CREATE TABLE learning_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dominant_style VARCHAR(20) NOT NULL CHECK (dominant_style IN ('visual', 'auditory', 'reading', 'kinesthetic')),
    is_multimodal BOOLEAN DEFAULT false,
    adaptation_level INTEGER DEFAULT 0 CHECK (adaptation_level >= 0 AND adaptation_level <= 100),
    confidence_score DECIMAL(3,2) DEFAULT 0.00 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    UNIQUE(user_id)
);

-- Learning styles with scores
CREATE TABLE learning_styles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES learning_profiles(id) ON DELETE CASCADE,
    style_type VARCHAR(20) NOT NULL CHECK (style_type IN ('visual', 'auditory', 'reading', 'kinesthetic')),
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    UNIQUE(profile_id, style_type)
);

-- Style assessments (VARK and behavioral)
CREATE TABLE style_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES learning_profiles(id) ON DELETE CASCADE,
    assessment_type VARCHAR(20) NOT NULL CHECK (assessment_type IN ('questionnaire', 'behavioral', 'hybrid')),
    visual_score DECIMAL(3,2) NOT NULL CHECK (visual_score >= 0 AND visual_score <= 1),
    auditory_score DECIMAL(3,2) NOT NULL CHECK (auditory_score >= 0 AND auditory_score <= 1),
    reading_score DECIMAL(3,2) NOT NULL CHECK (reading_score >= 0 AND reading_score <= 1),
    kinesthetic_score DECIMAL(3,2) NOT NULL CHECK (kinesthetic_score >= 0 AND kinesthetic_score <= 1),
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    data_points INTEGER DEFAULT 0,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_style_assessments_profile (profile_id),
    INDEX idx_style_assessments_type (assessment_type)
);

-- Behavioral indicators
CREATE TABLE behavioral_indicators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES learning_profiles(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('visual', 'auditory', 'reading', 'kinesthetic')),
    engagement_level INTEGER NOT NULL CHECK (engagement_level >= 0 AND engagement_level <= 100),
    completion_rate INTEGER NOT NULL CHECK (completion_rate >= 0 AND completion_rate <= 100),
    time_spent INTEGER NOT NULL, -- minutes
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_behavioral_indicators_profile (profile_id),
    INDEX idx_behavioral_indicators_timestamp (timestamp),
    INDEX idx_behavioral_indicators_content_type (content_type)
);

-- ==========================================
-- ADAPTIVE PACE MANAGEMENT TABLES
-- ==========================================

-- Pace profiles
CREATE TABLE pace_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_pace DECIMAL(4,2) NOT NULL DEFAULT 3.00, -- items per hour
    optimal_pace DECIMAL(4,2) NOT NULL DEFAULT 4.00,
    comprehension_rate INTEGER NOT NULL DEFAULT 80 CHECK (comprehension_rate >= 0 AND comprehension_rate <= 100),
    retention_rate INTEGER NOT NULL DEFAULT 80 CHECK (retention_rate >= 0 AND retention_rate <= 100),
    difficulty_adjustment DECIMAL(3,2) NOT NULL DEFAULT 1.00 CHECK (difficulty_adjustment >= 0.5 AND difficulty_adjustment <= 2.0),
    fatigue_level INTEGER NOT NULL DEFAULT 0 CHECK (fatigue_level >= 0 AND fatigue_level <= 100),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    UNIQUE(user_id)
);

-- Pace adjustments history
CREATE TABLE pace_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pace_profile_id UUID NOT NULL REFERENCES pace_profiles(id) ON DELETE CASCADE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    previous_pace DECIMAL(4,2) NOT NULL,
    new_pace DECIMAL(4,2) NOT NULL,
    reason VARCHAR(50) NOT NULL CHECK (reason IN ('performance', 'fatigue', 'difficulty', 'time_pressure')),
    effectiveness INTEGER CHECK (effectiveness >= 0 AND effectiveness <= 100),
    
    -- Indexes
    INDEX idx_pace_adjustments_profile (pace_profile_id),
    INDEX idx_pace_adjustments_timestamp (timestamp)
);

-- ==========================================
-- LEARNING SESSION TABLES
-- ==========================================

-- Learning sessions
CREATE TABLE learning_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id UUID NOT NULL,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    duration INTEGER NOT NULL, -- minutes
    items_completed INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    total_questions INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    
    -- Engagement metrics as JSON
    focus_time INTEGER DEFAULT 0, -- minutes
    distraction_events INTEGER DEFAULT 0,
    interaction_rate DECIMAL(4,2) DEFAULT 0.00, -- interactions per minute
    scroll_depth INTEGER DEFAULT 0, -- 0-100 percentage
    video_watch_time INTEGER DEFAULT 0, -- minutes
    pause_frequency INTEGER DEFAULT 0, -- pauses per hour
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_learning_sessions_user (user_id),
    INDEX idx_learning_sessions_content (content_id),
    INDEX idx_learning_sessions_start_time (start_time)
);

-- Adaptive changes during sessions
CREATE TABLE adaptive_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES learning_sessions(id) ON DELETE CASCADE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('pace', 'difficulty', 'content_type', 'break_suggestion')),
    previous_value TEXT,
    new_value TEXT,
    reason TEXT NOT NULL,
    user_response VARCHAR(20) CHECK (user_response IN ('accepted', 'declined', 'ignored')),
    
    -- Indexes
    INDEX idx_adaptive_changes_session (session_id),
    INDEX idx_adaptive_changes_type (change_type)
);

-- ==========================================
-- CONTENT MANAGEMENT TABLES
-- ==========================================

-- Adaptive content
CREATE TABLE adaptive_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    concept VARCHAR(255) NOT NULL,
    learning_objectives TEXT[],
    difficulty INTEGER NOT NULL DEFAULT 5 CHECK (difficulty >= 1 AND difficulty <= 10),
    estimated_duration INTEGER NOT NULL DEFAULT 30, -- minutes
    prerequisites TEXT[],
    
    -- Metadata
    tags TEXT[],
    language VARCHAR(10) DEFAULT 'en',
    blooms_taxonomy_level VARCHAR(20) DEFAULT 'remember',
    cognitive_load INTEGER DEFAULT 5 CHECK (cognitive_load >= 1 AND cognitive_load <= 10),
    estimated_engagement INTEGER DEFAULT 5 CHECK (estimated_engagement >= 1 AND estimated_engagement <= 10),
    success_rate INTEGER DEFAULT 80 CHECK (success_rate >= 0 AND success_rate <= 100),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_adaptive_content_difficulty (difficulty),
    INDEX idx_adaptive_content_concept (concept),
    INDEX idx_adaptive_content_tags (tags)
);

-- Content variants for different learning styles
CREATE TABLE content_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID NOT NULL REFERENCES adaptive_content(id) ON DELETE CASCADE,
    style_type VARCHAR(20) NOT NULL CHECK (style_type IN ('visual', 'auditory', 'reading', 'kinesthetic')),
    format VARCHAR(20) NOT NULL CHECK (format IN ('text', 'video', 'audio', 'interactive', 'infographic', 'simulation', 'diagram', 'quiz')),
    content_data TEXT NOT NULL, -- JSON or HTML content
    interactivity_level VARCHAR(10) NOT NULL CHECK (interactivity_level IN ('passive', 'low', 'medium', 'high')),
    
    -- Accessibility features
    screen_reader_support BOOLEAN DEFAULT false,
    high_contrast BOOLEAN DEFAULT false,
    large_fonts BOOLEAN DEFAULT false,
    keyboard_navigation BOOLEAN DEFAULT false,
    audio_description BOOLEAN DEFAULT false,
    sign_language BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_content_variants_content (content_id),
    INDEX idx_content_variants_style (style_type),
    INDEX idx_content_variants_format (format)
);

-- Media content (videos, audio, images)
CREATE TABLE media_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    variant_id UUID NOT NULL REFERENCES content_variants(id) ON DELETE CASCADE,
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('video', 'audio', 'image', 'interactive', 'simulation')),
    url TEXT NOT NULL,
    duration INTEGER, -- seconds for video/audio
    transcript TEXT,
    captions TEXT,
    alternative_text TEXT,
    file_size INTEGER, -- bytes
    mime_type VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_media_content_variant (variant_id),
    INDEX idx_media_content_type (media_type)
);

-- ==========================================
-- ASSESSMENT TABLES
-- ==========================================

-- Adaptive assessments
CREATE TABLE adaptive_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID NOT NULL REFERENCES adaptive_content(id) ON DELETE CASCADE,
    assessment_type VARCHAR(20) NOT NULL CHECK (assessment_type IN ('formative', 'summative', 'diagnostic')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Adaptive settings
    minimum_questions INTEGER DEFAULT 5,
    maximum_questions INTEGER DEFAULT 20,
    target_accuracy INTEGER DEFAULT 80 CHECK (target_accuracy >= 0 AND target_accuracy <= 100),
    confidence_threshold DECIMAL(3,2) DEFAULT 0.80 CHECK (confidence_threshold >= 0 AND confidence_threshold <= 1),
    time_limit INTEGER, -- minutes
    
    -- Scoring
    total_points INTEGER DEFAULT 100,
    passing_score INTEGER DEFAULT 70 CHECK (passing_score >= 0 AND passing_score <= 100),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_adaptive_assessments_content (content_id),
    INDEX idx_adaptive_assessments_type (assessment_type)
);

-- Adaptive questions
CREATE TABLE adaptive_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES adaptive_assessments(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('multiple-choice', 'true-false', 'short-answer', 'drag-drop', 'simulation')),
    difficulty INTEGER NOT NULL CHECK (difficulty >= 1 AND difficulty <= 10),
    learning_objective VARCHAR(255),
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    hints TEXT[],
    points INTEGER DEFAULT 1,
    time_limit INTEGER, -- seconds
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_adaptive_questions_assessment (assessment_id),
    INDEX idx_adaptive_questions_difficulty (difficulty),
    INDEX idx_adaptive_questions_type (question_type)
);

-- Question options (for multiple choice)
CREATE TABLE question_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES adaptive_questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT false,
    feedback TEXT,
    order_index INTEGER NOT NULL,
    
    -- Indexes
    INDEX idx_question_options_question (question_id),
    UNIQUE(question_id, order_index)
);

-- Assessment attempts
CREATE TABLE assessment_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL REFERENCES adaptive_assessments(id) ON DELETE CASCADE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    score INTEGER CHECK (score >= 0 AND score <= 100),
    passed BOOLEAN DEFAULT false,
    time_spent INTEGER, -- minutes
    questions_answered INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    
    -- Indexes
    INDEX idx_assessment_attempts_user (user_id),
    INDEX idx_assessment_attempts_assessment (assessment_id),
    INDEX idx_assessment_attempts_started (started_at)
);

-- Question responses
CREATE TABLE question_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES adaptive_questions(id) ON DELETE CASCADE,
    user_answer TEXT,
    is_correct BOOLEAN DEFAULT false,
    points_earned INTEGER DEFAULT 0,
    time_spent INTEGER, -- seconds
    hints_used INTEGER DEFAULT 0,
    response_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_question_responses_attempt (attempt_id),
    INDEX idx_question_responses_question (question_id),
    UNIQUE(attempt_id, question_id)
);

-- ==========================================
-- ANALYTICS AND INSIGHTS TABLES
-- ==========================================

-- Learning analytics snapshots
CREATE TABLE learning_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    time_range_start TIMESTAMP NOT NULL,
    time_range_end TIMESTAMP NOT NULL,
    
    -- Overall progress metrics
    total_time_spent INTEGER DEFAULT 0, -- minutes
    content_completed INTEGER DEFAULT 0,
    average_score DECIMAL(5,2) DEFAULT 0.00,
    completion_rate DECIMAL(5,2) DEFAULT 0.00,
    retention_rate DECIMAL(5,2) DEFAULT 0.00,
    streak_days INTEGER DEFAULT 0,
    goals_achieved INTEGER DEFAULT 0,
    total_goals INTEGER DEFAULT 0,
    
    -- Pace analysis
    average_pace DECIMAL(4,2) DEFAULT 0.00,
    optimal_pace DECIMAL(4,2) DEFAULT 0.00,
    pace_consistency DECIMAL(5,2) DEFAULT 0.00,
    peak_performance_time VARCHAR(10),
    recommended_breaks INTEGER DEFAULT 0,
    
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_learning_analytics_user (user_id),
    INDEX idx_learning_analytics_time_range (time_range_start, time_range_end)
);

-- Style effectiveness metrics
CREATE TABLE style_effectiveness (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analytics_id UUID NOT NULL REFERENCES learning_analytics(id) ON DELETE CASCADE,
    style_type VARCHAR(20) NOT NULL CHECK (style_type IN ('visual', 'auditory', 'reading', 'kinesthetic')),
    engagement_score INTEGER NOT NULL CHECK (engagement_score >= 0 AND engagement_score <= 100),
    comprehension_score INTEGER NOT NULL CHECK (comprehension_score >= 0 AND comprehension_score <= 100),
    completion_rate DECIMAL(5,2) NOT NULL CHECK (completion_rate >= 0 AND completion_rate <= 100),
    time_to_mastery INTEGER NOT NULL, -- minutes
    preference_strength INTEGER NOT NULL CHECK (preference_strength >= 0 AND preference_strength <= 100),
    
    -- Indexes
    INDEX idx_style_effectiveness_analytics (analytics_id),
    INDEX idx_style_effectiveness_style (style_type)
);

-- Content engagement metrics
CREATE TABLE content_engagement (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analytics_id UUID NOT NULL REFERENCES learning_analytics(id) ON DELETE CASCADE,
    content_id UUID NOT NULL,
    content_type VARCHAR(20) NOT NULL,
    engagement_score INTEGER NOT NULL CHECK (engagement_score >= 0 AND engagement_score <= 100),
    completion_rate DECIMAL(5,2) NOT NULL CHECK (completion_rate >= 0 AND completion_rate <= 100),
    revisit_rate DECIMAL(5,2) NOT NULL CHECK (revisit_rate >= 0 AND revisit_rate <= 100),
    time_spent INTEGER NOT NULL, -- minutes
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    
    -- Indexes
    INDEX idx_content_engagement_analytics (analytics_id),
    INDEX idx_content_engagement_content (content_id)
);

-- Performance trends
CREATE TABLE performance_trends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analytics_id UUID NOT NULL REFERENCES learning_analytics(id) ON DELETE CASCADE,
    metric VARCHAR(50) NOT NULL,
    time_range_start TIMESTAMP NOT NULL,
    time_range_end TIMESTAMP NOT NULL,
    values DECIMAL(5,2)[] NOT NULL,
    trend VARCHAR(20) NOT NULL CHECK (trend IN ('improving', 'declining', 'stable')),
    significance DECIMAL(3,2) NOT NULL CHECK (significance >= 0 AND significance <= 1),
    factors TEXT[],
    
    -- Indexes
    INDEX idx_performance_trends_analytics (analytics_id),
    INDEX idx_performance_trends_metric (metric)
);

-- ==========================================
-- RECOMMENDATION SYSTEM TABLES
-- ==========================================

-- Recommendations
CREATE TABLE recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recommendation_type VARCHAR(20) NOT NULL CHECK (recommendation_type IN ('content', 'pace', 'style', 'schedule', 'goal')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    reasoning TEXT NOT NULL,
    confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
    action_required BOOLEAN DEFAULT false,
    estimated_impact INTEGER NOT NULL CHECK (estimated_impact >= 0 AND estimated_impact <= 100),
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'accepted', 'declined', 'expired')),
    user_feedback TEXT,
    feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    responded_at TIMESTAMP,
    
    -- Indexes
    INDEX idx_recommendations_user (user_id),
    INDEX idx_recommendations_type (recommendation_type),
    INDEX idx_recommendations_priority (priority),
    INDEX idx_recommendations_status (status)
);

-- Learning predictions
CREATE TABLE learning_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metric VARCHAR(50) NOT NULL,
    predicted_value DECIMAL(8,2) NOT NULL,
    confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
    timeframe INTEGER NOT NULL, -- days
    factors JSONB,
    recommendations TEXT[],
    
    -- Validation
    actual_value DECIMAL(8,2),
    accuracy DECIMAL(5,2), -- calculated when actual value is known
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    target_date TIMESTAMP NOT NULL,
    validated_at TIMESTAMP,
    
    -- Indexes
    INDEX idx_learning_predictions_user (user_id),
    INDEX idx_learning_predictions_metric (metric),
    INDEX idx_learning_predictions_target_date (target_date)
);

-- ==========================================
-- SYSTEM CONFIGURATION TABLES
-- ==========================================

-- System configuration
CREATE TABLE system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_system_config_key (config_key)
);

-- ==========================================
-- TRIGGERS AND FUNCTIONS
-- ==========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updating updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_learning_profiles_updated_at BEFORE UPDATE ON learning_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_adaptive_content_updated_at BEFORE UPDATE ON adaptive_content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_adaptive_assessments_updated_at BEFORE UPDATE ON adaptive_assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- INITIAL DATA INSERTS
-- ==========================================

-- Insert default system configuration
INSERT INTO system_config (config_key, config_value, description) VALUES
('adaptation_settings', '{"minDataPoints": 10, "confidenceThreshold": 0.7, "adaptationSpeed": "medium", "maxDifficultyChange": 2, "enableRealTimeAdaptation": true}', 'Adaptation system settings'),
('content_settings', '{"defaultLanguage": "en", "supportedLanguages": ["en", "es", "fr", "de"], "maxContentLength": 50000, "enableMultimodal": true, "accessibilityLevel": "enhanced"}', 'Content delivery settings'),
('assessment_settings', '{"defaultQuestionCount": 10, "minPassingScore": 70, "enableAdaptiveQuestioning": true, "maxAttempts": 3, "timeouts": {"question": 120, "assessment": 60}}', 'Assessment system settings'),
('analytics_settings', '{"dataRetentionDays": 365, "enablePredictiveAnalytics": true, "privacyLevel": "standard", "reportingFrequency": "weekly"}', 'Analytics and reporting settings'),
('privacy_settings', '{"dataCollection": "standard", "shareWithEducators": false, "anonymizeData": true, "dataExportEnabled": true, "retentionPolicy": "1 year"}', 'Privacy and data protection settings');

-- ==========================================
-- PERFORMANCE INDEXES
-- ==========================================

-- Composite indexes for common queries
CREATE INDEX idx_user_sessions_recent ON learning_sessions(user_id, start_time DESC);
CREATE INDEX idx_user_assessments_recent ON assessment_attempts(user_id, started_at DESC);
CREATE INDEX idx_content_style_difficulty ON content_variants(style_type, content_id);
CREATE INDEX idx_behavioral_indicators_user_time ON behavioral_indicators(profile_id, timestamp DESC);
CREATE INDEX idx_recommendations_user_active ON recommendations(user_id, status, priority) WHERE status = 'active';

-- Partial indexes for better performance
CREATE INDEX idx_active_recommendations ON recommendations(user_id, created_at DESC) WHERE status = 'active';
CREATE INDEX idx_completed_sessions ON learning_sessions(user_id, end_time DESC) WHERE completed = true;
CREATE INDEX idx_high_confidence_styles ON learning_styles(profile_id, score DESC) WHERE confidence > 0.7;

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

-- ==========================================
-- COMMENTS AND DOCUMENTATION
-- ==========================================

COMMENT ON TABLE users IS 'Core user accounts with basic profile information';
COMMENT ON TABLE learning_profiles IS 'User learning style profiles with VARK assessment results';
COMMENT ON TABLE behavioral_indicators IS 'Behavioral data points for learning style detection';
COMMENT ON TABLE pace_profiles IS 'Adaptive pace management profiles for each user';
COMMENT ON TABLE learning_sessions IS 'Individual learning session records with engagement metrics';
COMMENT ON TABLE adaptive_content IS 'Multi-modal content that adapts to learning styles';
COMMENT ON TABLE content_variants IS 'Different versions of content for each learning style';
COMMENT ON TABLE adaptive_assessments IS 'Assessments that adapt based on user performance';
COMMENT ON TABLE recommendations IS 'Personalized recommendations generated by the system';
COMMENT ON TABLE learning_analytics IS 'Comprehensive analytics snapshots for users';

-- Performance monitoring
COMMENT ON INDEX idx_user_sessions_recent IS 'Optimizes queries for recent user sessions';
COMMENT ON INDEX idx_behavioral_indicators_user_time IS 'Optimizes behavioral analysis queries';
COMMENT ON INDEX idx_recommendations_user_active IS 'Optimizes active recommendation queries';

-- System health check query
-- SELECT schemaname, tablename, attname, n_distinct, correlation 
-- FROM pg_stats 
-- WHERE schemaname = 'public' 
-- ORDER BY tablename, attname;