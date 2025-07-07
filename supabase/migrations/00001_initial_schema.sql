-- Personal Learning Assistant Database Schema
-- Supabase Migration: Initial Schema Setup

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable Row Level Security
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- ==========================================
-- USER MANAGEMENT TABLES
-- ==========================================

-- Users table with enhanced learning profiles
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Additional fields for Better Auth integration
    email_verified BOOLEAN DEFAULT FALSE,
    phone VARCHAR(20),
    phone_verified BOOLEAN DEFAULT FALSE,
    
    -- User metadata
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT users_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    learning_goals TEXT[],
    preferred_topics TEXT[],
    difficulty_level VARCHAR(20) CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    daily_goal_minutes INTEGER DEFAULT 30,
    preferred_times TEXT[],
    days_per_week INTEGER DEFAULT 5,
    email_notifications BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT TRUE,
    reminder_notifications BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint
    UNIQUE(user_id)
);

-- ==========================================
-- LEARNING STYLE DETECTION TABLES
-- ==========================================

-- Learning profiles
CREATE TABLE IF NOT EXISTS learning_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dominant_style VARCHAR(20) NOT NULL CHECK (dominant_style IN ('visual', 'auditory', 'reading', 'kinesthetic')),
    is_multimodal BOOLEAN DEFAULT FALSE,
    adaptation_level INTEGER DEFAULT 0 CHECK (adaptation_level >= 0 AND adaptation_level <= 100),
    confidence_score DECIMAL(3,2) DEFAULT 0.00 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint
    UNIQUE(user_id)
);

-- Learning styles with scores
CREATE TABLE IF NOT EXISTS learning_styles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES learning_profiles(id) ON DELETE CASCADE,
    style_type VARCHAR(20) NOT NULL CHECK (style_type IN ('visual', 'auditory', 'reading', 'kinesthetic')),
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint
    UNIQUE(profile_id, style_type)
);

-- ==========================================
-- LEARNING SESSION TABLES
-- ==========================================

-- Learning sessions
CREATE TABLE IF NOT EXISTS learning_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id UUID NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    duration INTEGER NOT NULL, -- minutes
    items_completed INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    total_questions INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    
    -- Engagement metrics
    focus_time INTEGER DEFAULT 0, -- minutes
    distraction_events INTEGER DEFAULT 0,
    interaction_rate DECIMAL(4,2) DEFAULT 0.00, -- interactions per minute
    scroll_depth INTEGER DEFAULT 0, -- 0-100 percentage
    video_watch_time INTEGER DEFAULT 0, -- minutes
    pause_frequency INTEGER DEFAULT 0, -- pauses per hour
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- CONTENT MANAGEMENT TABLES
-- ==========================================

-- Adaptive content
CREATE TABLE IF NOT EXISTS adaptive_content (
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
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Content variants for different learning styles
CREATE TABLE IF NOT EXISTS content_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID NOT NULL REFERENCES adaptive_content(id) ON DELETE CASCADE,
    style_type VARCHAR(20) NOT NULL CHECK (style_type IN ('visual', 'auditory', 'reading', 'kinesthetic')),
    format VARCHAR(20) NOT NULL CHECK (format IN ('text', 'video', 'audio', 'interactive', 'infographic', 'simulation', 'diagram', 'quiz')),
    content_data TEXT NOT NULL, -- JSON or HTML content
    interactivity_level VARCHAR(10) NOT NULL CHECK (interactivity_level IN ('passive', 'low', 'medium', 'high')),
    
    -- Accessibility features
    screen_reader_support BOOLEAN DEFAULT FALSE,
    high_contrast BOOLEAN DEFAULT FALSE,
    large_fonts BOOLEAN DEFAULT FALSE,
    keyboard_navigation BOOLEAN DEFAULT FALSE,
    audio_description BOOLEAN DEFAULT FALSE,
    sign_language BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- ASSESSMENT TABLES
-- ==========================================

-- Adaptive assessments
CREATE TABLE IF NOT EXISTS adaptive_assessments (
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
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- RECOMMENDATION SYSTEM TABLES
-- ==========================================

-- Recommendations
CREATE TABLE IF NOT EXISTS recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recommendation_type VARCHAR(20) NOT NULL CHECK (recommendation_type IN ('content', 'pace', 'style', 'schedule', 'goal')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    reasoning TEXT NOT NULL,
    confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
    action_required BOOLEAN DEFAULT FALSE,
    estimated_impact INTEGER NOT NULL CHECK (estimated_impact >= 0 AND estimated_impact <= 100),
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'accepted', 'declined', 'expired')),
    user_feedback TEXT,
    feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    responded_at TIMESTAMP WITH TIME ZONE
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
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at 
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_learning_profiles_updated_at 
    BEFORE UPDATE ON learning_profiles
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_adaptive_content_updated_at 
    BEFORE UPDATE ON adaptive_content
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_adaptive_assessments_updated_at 
    BEFORE UPDATE ON adaptive_assessments
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- PERFORMANCE INDEXES
-- ==========================================

-- User-related indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Learning session indexes
CREATE INDEX IF NOT EXISTS idx_learning_sessions_user_id ON learning_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_start_time ON learning_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_user_time ON learning_sessions(user_id, start_time DESC);

-- Content indexes
CREATE INDEX IF NOT EXISTS idx_adaptive_content_difficulty ON adaptive_content(difficulty);
CREATE INDEX IF NOT EXISTS idx_adaptive_content_concept ON adaptive_content(concept);
CREATE INDEX IF NOT EXISTS idx_content_variants_style ON content_variants(style_type);

-- Recommendation indexes
CREATE INDEX IF NOT EXISTS idx_recommendations_user_id ON recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_user_active ON recommendations(user_id, status, priority) WHERE status = 'active';

-- ==========================================
-- VIEWS FOR COMMON QUERIES
-- ==========================================

-- User learning overview
CREATE OR REPLACE VIEW user_learning_overview AS
SELECT 
    u.id as user_id,
    u.name,
    u.email,
    lp.dominant_style,
    lp.is_multimodal,
    lp.adaptation_level,
    NULL as current_pace,
    NULL as optimal_pace,
    NULL as comprehension_rate,
    COUNT(DISTINCT ls.id) as total_sessions,
    COALESCE(SUM(ls.duration), 0) as total_time_spent,
    COALESCE(AVG(CASE WHEN ls.total_questions > 0 THEN ls.correct_answers::DECIMAL / ls.total_questions * 100 ELSE 0 END), 0) as average_score
FROM users u
LEFT JOIN learning_profiles lp ON u.id = lp.user_id
LEFT JOIN learning_sessions ls ON u.id = ls.user_id
GROUP BY u.id, u.name, u.email, lp.dominant_style, lp.is_multimodal, lp.adaptation_level;

-- Content effectiveness view
CREATE OR REPLACE VIEW content_effectiveness AS
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
CREATE OR REPLACE VIEW recent_user_activity AS
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