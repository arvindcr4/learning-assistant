-- Description: Content and assessment tables for adaptive learning
-- Version: 20250106000002
-- Dependencies: 20250106000001_initial_schema.sql

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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    correct_answers INTEGER DEFAULT 0
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
    UNIQUE(attempt_id, question_id)
);

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================

-- Content indexes
CREATE INDEX idx_adaptive_content_difficulty ON adaptive_content(difficulty);
CREATE INDEX idx_adaptive_content_concept ON adaptive_content(concept);
CREATE INDEX idx_adaptive_content_tags ON adaptive_content USING GIN(tags);

-- Content variant indexes
CREATE INDEX idx_content_variants_content ON content_variants(content_id);
CREATE INDEX idx_content_variants_style ON content_variants(style_type);
CREATE INDEX idx_content_variants_format ON content_variants(format);

-- Media content indexes
CREATE INDEX idx_media_content_variant ON media_content(variant_id);
CREATE INDEX idx_media_content_type ON media_content(media_type);

-- Assessment indexes
CREATE INDEX idx_adaptive_assessments_content ON adaptive_assessments(content_id);
CREATE INDEX idx_adaptive_assessments_type ON adaptive_assessments(assessment_type);

-- Question indexes
CREATE INDEX idx_adaptive_questions_assessment ON adaptive_questions(assessment_id);
CREATE INDEX idx_adaptive_questions_difficulty ON adaptive_questions(difficulty);
CREATE INDEX idx_adaptive_questions_type ON adaptive_questions(question_type);

-- Question options indexes
CREATE INDEX idx_question_options_question ON question_options(question_id);

-- Assessment attempt indexes
CREATE INDEX idx_assessment_attempts_user ON assessment_attempts(user_id);
CREATE INDEX idx_assessment_attempts_assessment ON assessment_attempts(assessment_id);
CREATE INDEX idx_assessment_attempts_started ON assessment_attempts(started_at);

-- Question response indexes
CREATE INDEX idx_question_responses_attempt ON question_responses(attempt_id);
CREATE INDEX idx_question_responses_question ON question_responses(question_id);

-- ==========================================
-- TRIGGERS
-- ==========================================

-- Triggers for updating updated_at
CREATE TRIGGER update_adaptive_content_updated_at BEFORE UPDATE ON adaptive_content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_adaptive_assessments_updated_at BEFORE UPDATE ON adaptive_assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();