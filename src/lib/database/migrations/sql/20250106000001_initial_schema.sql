-- Description: Initial database schema for Personal Learning Assistant
-- Version: 20250106000001
-- Dependencies: None

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
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    effectiveness INTEGER CHECK (effectiveness >= 0 AND effectiveness <= 100)
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
    
    -- Engagement metrics
    focus_time INTEGER DEFAULT 0, -- minutes
    distraction_events INTEGER DEFAULT 0,
    interaction_rate DECIMAL(4,2) DEFAULT 0.00, -- interactions per minute
    scroll_depth INTEGER DEFAULT 0, -- 0-100 percentage
    video_watch_time INTEGER DEFAULT 0, -- minutes
    pause_frequency INTEGER DEFAULT 0, -- pauses per hour
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    user_response VARCHAR(20) CHECK (user_response IN ('accepted', 'declined', 'ignored'))
);

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================

-- Learning style and behavioral indexes
CREATE INDEX idx_style_assessments_profile ON style_assessments(profile_id);
CREATE INDEX idx_style_assessments_type ON style_assessments(assessment_type);
CREATE INDEX idx_behavioral_indicators_profile ON behavioral_indicators(profile_id);
CREATE INDEX idx_behavioral_indicators_timestamp ON behavioral_indicators(timestamp);
CREATE INDEX idx_behavioral_indicators_content_type ON behavioral_indicators(content_type);

-- Pace management indexes
CREATE INDEX idx_pace_adjustments_profile ON pace_adjustments(pace_profile_id);
CREATE INDEX idx_pace_adjustments_timestamp ON pace_adjustments(timestamp);

-- Learning session indexes
CREATE INDEX idx_learning_sessions_user ON learning_sessions(user_id);
CREATE INDEX idx_learning_sessions_content ON learning_sessions(content_id);
CREATE INDEX idx_learning_sessions_start_time ON learning_sessions(start_time);

-- Adaptive changes indexes
CREATE INDEX idx_adaptive_changes_session ON adaptive_changes(session_id);
CREATE INDEX idx_adaptive_changes_type ON adaptive_changes(change_type);

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