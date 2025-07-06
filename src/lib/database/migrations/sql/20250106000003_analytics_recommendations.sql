-- Description: Analytics and recommendations system tables
-- Version: 20250106000003
-- Dependencies: 20250106000002_content_assessments.sql

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
    
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    preference_strength INTEGER NOT NULL CHECK (preference_strength >= 0 AND preference_strength <= 100)
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
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5)
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
    factors TEXT[]
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
    responded_at TIMESTAMP
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
    validated_at TIMESTAMP
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================

-- Analytics indexes
CREATE INDEX idx_learning_analytics_user ON learning_analytics(user_id);
CREATE INDEX idx_learning_analytics_time_range ON learning_analytics(time_range_start, time_range_end);

-- Style effectiveness indexes
CREATE INDEX idx_style_effectiveness_analytics ON style_effectiveness(analytics_id);
CREATE INDEX idx_style_effectiveness_style ON style_effectiveness(style_type);

-- Content engagement indexes
CREATE INDEX idx_content_engagement_analytics ON content_engagement(analytics_id);
CREATE INDEX idx_content_engagement_content ON content_engagement(content_id);

-- Performance trends indexes
CREATE INDEX idx_performance_trends_analytics ON performance_trends(analytics_id);
CREATE INDEX idx_performance_trends_metric ON performance_trends(metric);

-- Recommendations indexes
CREATE INDEX idx_recommendations_user ON recommendations(user_id);
CREATE INDEX idx_recommendations_type ON recommendations(recommendation_type);
CREATE INDEX idx_recommendations_priority ON recommendations(priority);
CREATE INDEX idx_recommendations_status ON recommendations(status);

-- Learning predictions indexes
CREATE INDEX idx_learning_predictions_user ON learning_predictions(user_id);
CREATE INDEX idx_learning_predictions_metric ON learning_predictions(metric);
CREATE INDEX idx_learning_predictions_target_date ON learning_predictions(target_date);

-- System config indexes
CREATE INDEX idx_system_config_key ON system_config(config_key);

-- ==========================================
-- COMPOSITE INDEXES FOR COMMON QUERIES
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
-- TRIGGERS
-- ==========================================

-- Triggers for updating updated_at
CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- INITIAL SYSTEM CONFIGURATION
-- ==========================================

-- Insert default system configuration
INSERT INTO system_config (config_key, config_value, description) VALUES
('adaptation_settings', '{"minDataPoints": 10, "confidenceThreshold": 0.7, "adaptationSpeed": "medium", "maxDifficultyChange": 2, "enableRealTimeAdaptation": true}', 'Adaptation system settings'),
('content_settings', '{"defaultLanguage": "en", "supportedLanguages": ["en", "es", "fr", "de"], "maxContentLength": 50000, "enableMultimodal": true, "accessibilityLevel": "enhanced"}', 'Content delivery settings'),
('assessment_settings', '{"defaultQuestionCount": 10, "minPassingScore": 70, "enableAdaptiveQuestioning": true, "maxAttempts": 3, "timeouts": {"question": 120, "assessment": 60}}', 'Assessment system settings'),
('analytics_settings', '{"dataRetentionDays": 365, "enablePredictiveAnalytics": true, "privacyLevel": "standard", "reportingFrequency": "weekly"}', 'Analytics and reporting settings'),
('privacy_settings', '{"dataCollection": "standard", "shareWithEducators": false, "anonymizeData": true, "dataExportEnabled": true, "retentionPolicy": "1 year"}', 'Privacy and data protection settings');