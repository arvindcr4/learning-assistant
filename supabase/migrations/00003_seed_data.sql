-- Seed Data for Personal Learning Assistant
-- Supabase Migration: Initial seed data for development and testing

-- ==========================================
-- SAMPLE ADAPTIVE CONTENT
-- ==========================================

-- Insert sample content for different subjects
INSERT INTO adaptive_content (
    title, description, concept, learning_objectives, difficulty, 
    estimated_duration, prerequisites, tags, language, 
    blooms_taxonomy_level, cognitive_load, estimated_engagement, success_rate
) VALUES 
(
    'Introduction to JavaScript Variables',
    'Learn the fundamentals of declaring and using variables in JavaScript',
    'JavaScript Fundamentals',
    ARRAY['Understand variable declaration', 'Learn var, let, and const differences', 'Practice variable naming conventions'],
    3,
    25,
    ARRAY['Basic computer literacy', 'Text editor familiarity'],
    ARRAY['javascript', 'programming', 'variables', 'beginner'],
    'en',
    'understand',
    4,
    7,
    85
),
(
    'Mathematical Functions and Graphs',
    'Explore linear and quadratic functions with interactive visualizations',
    'Algebra',
    ARRAY['Define mathematical functions', 'Interpret function graphs', 'Solve function equations'],
    5,
    40,
    ARRAY['Basic algebra', 'Coordinate plane understanding'],
    ARRAY['mathematics', 'algebra', 'functions', 'graphs'],
    'en',
    'apply',
    6,
    6,
    78
),
(
    'Introduction to Machine Learning',
    'Overview of machine learning concepts, types, and applications',
    'Artificial Intelligence',
    ARRAY['Define machine learning', 'Differentiate ML types', 'Identify real-world applications'],
    7,
    60,
    ARRAY['Basic statistics', 'Programming experience', 'Mathematical foundations'],
    ARRAY['ai', 'machine-learning', 'data-science', 'advanced'],
    'en',
    'analyze',
    8,
    8,
    72
),
(
    'Photosynthesis Process',
    'Understand how plants convert sunlight into chemical energy',
    'Biology',
    ARRAY['Explain photosynthesis steps', 'Identify chloroplast components', 'Analyze energy conversion'],
    4,
    35,
    ARRAY['Basic cell biology', 'Chemistry fundamentals'],
    ARRAY['biology', 'photosynthesis', 'plants', 'energy'],
    'en',
    'understand',
    5,
    7,
    82
),
(
    'World War II Timeline',
    'Interactive timeline of major events during World War II',
    'Modern History',
    ARRAY['Sequence major WWII events', 'Analyze cause and effect', 'Evaluate historical impact'],
    6,
    50,
    ARRAY['Basic world geography', 'Historical thinking skills'],
    ARRAY['history', 'wwii', 'timeline', 'events'],
    'en',
    'analyze',
    6,
    6,
    75
);

-- ==========================================
-- CONTENT VARIANTS FOR DIFFERENT LEARNING STYLES
-- ==========================================

-- Visual variants
INSERT INTO content_variants (
    content_id, style_type, format, content_data, interactivity_level,
    screen_reader_support, high_contrast, large_fonts, keyboard_navigation
) 
SELECT 
    id,
    'visual',
    'infographic',
    '{"type": "infographic", "title": "' || title || '", "elements": [{"type": "diagram"}, {"type": "flowchart"}, {"type": "icons"}]}',
    'medium',
    true,
    true,
    true,
    true
FROM adaptive_content;

-- Auditory variants
INSERT INTO content_variants (
    content_id, style_type, format, content_data, interactivity_level,
    audio_description, screen_reader_support
) 
SELECT 
    id,
    'auditory',
    'audio',
    '{"type": "audio", "title": "' || title || '", "duration": ' || (estimated_duration * 60) || ', "transcript": true}',
    'low',
    true,
    true
FROM adaptive_content;

-- Reading variants
INSERT INTO content_variants (
    content_id, style_type, format, content_data, interactivity_level,
    screen_reader_support, high_contrast, large_fonts
) 
SELECT 
    id,
    'reading',
    'text',
    '{"type": "text", "title": "' || title || '", "sections": [{"heading": "Overview"}, {"heading": "Details"}, {"heading": "Summary"}]}',
    'low',
    true,
    true,
    true
FROM adaptive_content;

-- Kinesthetic variants
INSERT INTO content_variants (
    content_id, style_type, format, content_data, interactivity_level,
    keyboard_navigation, screen_reader_support
) 
SELECT 
    id,
    'kinesthetic',
    'interactive',
    '{"type": "interactive", "title": "' || title || '", "activities": [{"type": "drag-drop"}, {"type": "simulation"}, {"type": "hands-on"}]}',
    'high',
    true,
    true
FROM adaptive_content;

-- ==========================================
-- SAMPLE ASSESSMENTS
-- ==========================================

INSERT INTO adaptive_assessments (
    content_id, assessment_type, title, description,
    minimum_questions, maximum_questions, target_accuracy,
    confidence_threshold, time_limit, total_points, passing_score
)
SELECT 
    id,
    'formative',
    'Quick Check: ' || title,
    'Assess your understanding of ' || concept,
    5,
    10,
    75,
    0.70,
    15,
    100,
    70
FROM adaptive_content;

-- ==========================================
-- SYSTEM CONFIGURATION
-- ==========================================

-- Create system configuration table if it doesn't exist
CREATE TABLE IF NOT EXISTS system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default system configuration
INSERT INTO system_config (config_key, config_value, description) VALUES
(
    'adaptation_settings', 
    '{
        "minDataPoints": 10, 
        "confidenceThreshold": 0.7, 
        "adaptationSpeed": "medium", 
        "maxDifficultyChange": 2, 
        "enableRealTimeAdaptation": true,
        "learningStyleWeights": {
            "visual": 0.25,
            "auditory": 0.25,
            "reading": 0.25,
            "kinesthetic": 0.25
        }
    }', 
    'Adaptation system settings for learning style detection and content recommendations'
),
(
    'content_settings', 
    '{
        "defaultLanguage": "en", 
        "supportedLanguages": ["en", "es", "fr", "de"], 
        "maxContentLength": 50000, 
        "enableMultimodal": true, 
        "accessibilityLevel": "enhanced",
        "defaultDifficulty": 5,
        "difficultyRange": {"min": 1, "max": 10}
    }', 
    'Content delivery and accessibility settings'
),
(
    'assessment_settings', 
    '{
        "defaultQuestionCount": 10, 
        "minPassingScore": 70, 
        "enableAdaptiveQuestioning": true, 
        "maxAttempts": 3, 
        "timeouts": {"question": 120, "assessment": 60},
        "difficultyAdjustment": {
            "correctAnswerIncrease": 1,
            "incorrectAnswerDecrease": 1,
            "maxAdjustment": 3
        }
    }', 
    'Assessment system settings and adaptive questioning parameters'
),
(
    'analytics_settings', 
    '{
        "dataRetentionDays": 365, 
        "enablePredictiveAnalytics": true, 
        "privacyLevel": "standard", 
        "reportingFrequency": "weekly",
        "metricsCollection": {
            "engagementTracking": true,
            "performanceAnalytics": true,
            "learningPathOptimization": true
        }
    }', 
    'Analytics and reporting configuration'
),
(
    'privacy_settings', 
    '{
        "dataCollection": "standard", 
        "shareWithEducators": false, 
        "anonymizeData": true, 
        "dataExportEnabled": true, 
        "retentionPolicy": "1 year",
        "cookieConsent": true,
        "gdprCompliance": true
    }', 
    'Privacy and data protection settings'
),
(
    'realtime_settings',
    '{
        "enableRealtimeUpdates": true,
        "sessionSyncInterval": 30,
        "progressSyncInterval": 60,
        "maxConnectionAttempts": 3,
        "reconnectionDelay": 5000,
        "channels": {
            "learningSession": true,
            "recommendations": true,
            "userProgress": true
        }
    }',
    'Real-time synchronization and websocket configuration'
),
(
    'storage_settings',
    '{
        "maxFileSize": 10485760,
        "allowedMimeTypes": [
            "image/jpeg", "image/png", "image/gif", "image/webp",
            "application/pdf", "video/mp4", "video/webm",
            "audio/mpeg", "audio/wav", "text/plain"
        ],
        "avatarMaxSize": 5242880,
        "materialMaxSize": 52428800,
        "compressionEnabled": true,
        "cdnEnabled": true
    }',
    'File storage and upload configuration'
)
ON CONFLICT (config_key) DO NOTHING;

-- ==========================================
-- DEMO USER DATA (for development only)
-- ==========================================

-- Note: This data should only be used in development environments
-- Production environments should start with empty user tables

-- Create demo users (only in development)
-- INSERT INTO users (id, email, name, avatar_url, email_verified) VALUES
-- ('00000000-0000-0000-0000-000000000001', 'demo@example.com', 'Demo User', null, true),
-- ('00000000-0000-0000-0000-000000000002', 'visual.learner@example.com', 'Visual Learner', null, true),
-- ('00000000-0000-0000-0000-000000000003', 'auditory.learner@example.com', 'Auditory Learner', null, true)
-- ON CONFLICT (id) DO NOTHING;

-- Demo learning profiles
-- INSERT INTO learning_profiles (user_id, dominant_style, is_multimodal, adaptation_level, confidence_score) VALUES
-- ('00000000-0000-0000-0000-000000000001', 'reading', false, 25, 0.75),
-- ('00000000-0000-0000-0000-000000000002', 'visual', false, 45, 0.85),
-- ('00000000-0000-0000-0000-000000000003', 'auditory', true, 30, 0.70)
-- ON CONFLICT (user_id) DO NOTHING;

-- Demo user preferences
-- INSERT INTO user_preferences (user_id, learning_goals, preferred_topics, difficulty_level, daily_goal_minutes) VALUES
-- ('00000000-0000-0000-0000-000000000001', ARRAY['Learn programming', 'Improve problem solving'], ARRAY['javascript', 'algorithms'], 'intermediate', 45),
-- ('00000000-0000-0000-0000-000000000002', ARRAY['Master mathematics', 'Prepare for exams'], ARRAY['algebra', 'geometry'], 'beginner', 30),
-- ('00000000-0000-0000-0000-000000000003', ARRAY['Understand science concepts'], ARRAY['biology', 'chemistry'], 'intermediate', 60)
-- ON CONFLICT (user_id) DO NOTHING;