-- Development Seed Data
-- This script populates the database with sample data for development

-- Insert sample users
INSERT INTO users (id, email, name, avatar_url) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'john.doe@example.com', 'John Doe', 'https://via.placeholder.com/150'),
('550e8400-e29b-41d4-a716-446655440002', 'jane.smith@example.com', 'Jane Smith', 'https://via.placeholder.com/150'),
('550e8400-e29b-41d4-a716-446655440003', 'bob.johnson@example.com', 'Bob Johnson', 'https://via.placeholder.com/150'),
('550e8400-e29b-41d4-a716-446655440004', 'alice.williams@example.com', 'Alice Williams', 'https://via.placeholder.com/150'),
('550e8400-e29b-41d4-a716-446655440005', 'charlie.brown@example.com', 'Charlie Brown', 'https://via.placeholder.com/150')
ON CONFLICT (id) DO NOTHING;

-- Insert user preferences
INSERT INTO user_preferences (user_id, learning_goals, preferred_topics, difficulty_level, daily_goal_minutes, preferred_times, days_per_week) VALUES
('550e8400-e29b-41d4-a716-446655440001', ARRAY['Improve programming skills', 'Learn new technologies'], ARRAY['JavaScript', 'React', 'Node.js'], 'intermediate', 60, ARRAY['morning', 'evening'], 5),
('550e8400-e29b-41d4-a716-446655440002', ARRAY['Data science certification', 'Machine learning'], ARRAY['Python', 'Statistics', 'ML'], 'advanced', 90, ARRAY['afternoon'], 4),
('550e8400-e29b-41d4-a716-446655440003', ARRAY['Web development basics'], ARRAY['HTML', 'CSS', 'JavaScript'], 'beginner', 30, ARRAY['evening'], 3),
('550e8400-e29b-41d4-a716-446655440004', ARRAY['Mobile app development'], ARRAY['React Native', 'Flutter'], 'intermediate', 45, ARRAY['morning'], 5),
('550e8400-e29b-41d4-a716-446655440005', ARRAY['DevOps skills', 'Cloud computing'], ARRAY['Docker', 'AWS', 'Kubernetes'], 'advanced', 120, ARRAY['morning', 'afternoon'], 6)
ON CONFLICT (user_id) DO NOTHING;

-- Insert learning profiles
INSERT INTO learning_profiles (user_id, dominant_style, is_multimodal, adaptation_level, confidence_score) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'visual', false, 75, 0.85),
('550e8400-e29b-41d4-a716-446655440002', 'reading', true, 90, 0.95),
('550e8400-e29b-41d4-a716-446655440003', 'kinesthetic', false, 45, 0.60),
('550e8400-e29b-41d4-a716-446655440004', 'auditory', true, 80, 0.90),
('550e8400-e29b-41d4-a716-446655440005', 'visual', true, 95, 0.98)
ON CONFLICT (user_id) DO NOTHING;

-- Insert learning styles for each profile
INSERT INTO learning_styles (profile_id, style_type, score, confidence) 
SELECT 
    lp.id, 
    'visual', 
    CASE WHEN lp.dominant_style = 'visual' THEN 85 ELSE 45 END,
    CASE WHEN lp.dominant_style = 'visual' THEN 0.90 ELSE 0.60 END
FROM learning_profiles lp
ON CONFLICT (profile_id, style_type) DO NOTHING;

INSERT INTO learning_styles (profile_id, style_type, score, confidence) 
SELECT 
    lp.id, 
    'auditory', 
    CASE WHEN lp.dominant_style = 'auditory' THEN 80 ELSE 35 END,
    CASE WHEN lp.dominant_style = 'auditory' THEN 0.85 ELSE 0.50 END
FROM learning_profiles lp
ON CONFLICT (profile_id, style_type) DO NOTHING;

INSERT INTO learning_styles (profile_id, style_type, score, confidence) 
SELECT 
    lp.id, 
    'reading', 
    CASE WHEN lp.dominant_style = 'reading' THEN 90 ELSE 50 END,
    CASE WHEN lp.dominant_style = 'reading' THEN 0.95 ELSE 0.70 END
FROM learning_profiles lp
ON CONFLICT (profile_id, style_type) DO NOTHING;

INSERT INTO learning_styles (profile_id, style_type, score, confidence) 
SELECT 
    lp.id, 
    'kinesthetic', 
    CASE WHEN lp.dominant_style = 'kinesthetic' THEN 75 ELSE 40 END,
    CASE WHEN lp.dominant_style = 'kinesthetic' THEN 0.80 ELSE 0.55 END
FROM learning_profiles lp
ON CONFLICT (profile_id, style_type) DO NOTHING;

-- Insert pace profiles
INSERT INTO pace_profiles (user_id, current_pace, optimal_pace, comprehension_rate, retention_rate, difficulty_adjustment) VALUES
('550e8400-e29b-41d4-a716-446655440001', 3.5, 4.0, 85, 80, 1.0),
('550e8400-e29b-41d4-a716-446655440002', 4.2, 4.5, 92, 90, 1.2),
('550e8400-e29b-41d4-a716-446655440003', 2.8, 3.2, 70, 65, 0.8),
('550e8400-e29b-41d4-a716-446655440004', 3.8, 4.2, 88, 85, 1.1),
('550e8400-e29b-41d4-a716-446655440005', 4.5, 5.0, 95, 92, 1.3)
ON CONFLICT (user_id) DO NOTHING;

-- Insert sample adaptive content
INSERT INTO adaptive_content (id, title, description, concept, learning_objectives, difficulty, estimated_duration, prerequisites, tags, blooms_taxonomy_level, cognitive_load) VALUES
('650e8400-e29b-41d4-a716-446655440001', 'Introduction to JavaScript', 'Learn the fundamentals of JavaScript programming', 'JavaScript Basics', ARRAY['Understand variables and data types', 'Learn control structures', 'Master functions'], 3, 45, ARRAY['Basic programming concepts'], ARRAY['javascript', 'programming', 'web-development'], 'understand', 4),
('650e8400-e29b-41d4-a716-446655440002', 'React Components', 'Building reusable UI components with React', 'React Fundamentals', ARRAY['Create functional components', 'Understand JSX', 'Manage component state'], 5, 60, ARRAY['JavaScript basics', 'HTML/CSS'], ARRAY['react', 'frontend', 'components'], 'apply', 6),
('650e8400-e29b-41d4-a716-446655440003', 'Database Design', 'Principles of relational database design', 'Database Fundamentals', ARRAY['Understand normalization', 'Design entity relationships', 'Create efficient schemas'], 6, 90, ARRAY['Basic SQL knowledge'], ARRAY['database', 'sql', 'design'], 'analyze', 7),
('650e8400-e29b-41d4-a716-446655440004', 'Machine Learning Basics', 'Introduction to machine learning concepts', 'ML Fundamentals', ARRAY['Understand supervised learning', 'Learn about algorithms', 'Practice with datasets'], 7, 120, ARRAY['Statistics', 'Python basics'], ARRAY['machine-learning', 'python', 'data-science'], 'understand', 8),
('650e8400-e29b-41d4-a716-446655440005', 'Docker Containerization', 'Containerizing applications with Docker', 'DevOps Tools', ARRAY['Create Dockerfiles', 'Manage containers', 'Use Docker Compose'], 6, 75, ARRAY['Basic Linux commands'], ARRAY['docker', 'devops', 'containers'], 'apply', 6)
ON CONFLICT (id) DO NOTHING;

-- Insert content variants for different learning styles
INSERT INTO content_variants (content_id, style_type, format, content_data, interactivity_level, screen_reader_support, keyboard_navigation) VALUES
('650e8400-e29b-41d4-a716-446655440001', 'visual', 'video', '{"video_url": "https://example.com/js-intro.mp4", "duration": 2700, "chapters": [{"title": "Variables", "start": 0}, {"title": "Functions", "start": 900}]}', 'medium', true, true),
('650e8400-e29b-41d4-a716-446655440001', 'reading', 'text', '{"content": "JavaScript is a programming language...", "reading_time": 15, "sections": ["Introduction", "Variables", "Functions"]}', 'low', true, true),
('650e8400-e29b-41d4-a716-446655440001', 'kinesthetic', 'interactive', '{"exercises": [{"type": "code", "prompt": "Declare a variable"}, {"type": "quiz", "questions": 5}]}', 'high', true, true),
('650e8400-e29b-41d4-a716-446655440002', 'visual', 'infographic', '{"image_url": "https://example.com/react-components.png", "alt_text": "React component hierarchy diagram"}', 'low', true, false),
('650e8400-e29b-41d4-a716-446655440002', 'auditory', 'audio', '{"audio_url": "https://example.com/react-podcast.mp3", "duration": 3600, "transcript": "React components are..."}', 'low', true, true)
ON CONFLICT DO NOTHING;

-- Insert sample learning sessions
INSERT INTO learning_sessions (user_id, content_id, start_time, end_time, duration, items_completed, correct_answers, total_questions, completed, focus_time, interaction_rate) VALUES
('550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '45 minutes', 45, 8, 6, 8, true, 40, 2.5),
('550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440002', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '60 minutes', 60, 10, 8, 10, true, 55, 3.2),
('550e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440003', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '90 minutes', 90, 12, 11, 12, true, 85, 2.8),
('550e8400-e29b-41d4-a716-446655440003', '650e8400-e29b-41d4-a716-446655440001', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '30 minutes', 30, 5, 3, 5, true, 25, 1.8),
('550e8400-e29b-41d4-a716-446655440004', '650e8400-e29b-41d4-a716-446655440002', NOW() - INTERVAL '2 hours', NULL, 0, 0, 0, 0, false, 0, 0.0);

-- Insert sample behavioral indicators
INSERT INTO behavioral_indicators (profile_id, action, content_type, engagement_level, completion_rate, time_spent, timestamp) 
SELECT 
    lp.id,
    'content_interaction',
    'visual',
    FLOOR(RANDOM() * 40 + 60)::INTEGER,
    FLOOR(RANDOM() * 30 + 70)::INTEGER,
    FLOOR(RANDOM() * 30 + 15)::INTEGER,
    NOW() - (RANDOM() * INTERVAL '7 days')
FROM learning_profiles lp, generate_series(1, 20) gs
ON CONFLICT DO NOTHING;

-- Insert sample recommendations
INSERT INTO recommendations (user_id, recommendation_type, title, description, reasoning, confidence, priority, estimated_impact) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'content', 'Try Interactive Coding Exercises', 'Based on your visual learning style, interactive coding exercises might help you learn more effectively.', 'User shows strong visual learning preferences and high engagement with interactive content.', 85, 'high', 75),
('550e8400-e29b-41d4-a716-446655440002', 'pace', 'Increase Learning Pace', 'Your comprehension rate is excellent. Consider increasing your learning pace to cover more material.', 'User consistently scores above 90% with current pace, indicating room for acceleration.', 90, 'medium', 60),
('550e8400-e29b-41d4-a716-446655440003', 'style', 'Mix Learning Styles', 'Try combining visual and kinesthetic learning approaches for better retention.', 'Current single-style approach shows moderate effectiveness, multimodal approach may improve outcomes.', 70, 'medium', 65),
('550e8400-e29b-41d4-a716-446655440004', 'schedule', 'Optimize Study Schedule', 'Your morning sessions show higher engagement. Consider scheduling more challenging topics in the morning.', 'Analytics show 23% higher engagement and completion rates during morning hours.', 80, 'low', 45),
('550e8400-e29b-41d4-a716-446655440005', 'goal', 'Set Advanced Learning Goals', 'Your rapid progress suggests you\'re ready for more challenging objectives.', 'User consistently exceeds learning goals and shows high retention rates across all topics.', 95, 'high', 85)
ON CONFLICT DO NOTHING;

-- Insert sample assessments
INSERT INTO adaptive_assessments (content_id, assessment_type, title, description, minimum_questions, maximum_questions, target_accuracy, confidence_threshold, total_points, passing_score) VALUES
('650e8400-e29b-41d4-a716-446655440001', 'formative', 'JavaScript Basics Quiz', 'Test your understanding of JavaScript fundamentals', 5, 15, 75, 0.80, 100, 70),
('650e8400-e29b-41d4-a716-446655440002', 'summative', 'React Components Assessment', 'Comprehensive assessment of React component knowledge', 10, 25, 80, 0.85, 150, 75),
('650e8400-e29b-41d4-a716-446655440003', 'diagnostic', 'Database Design Pre-test', 'Assess your current knowledge of database design principles', 8, 20, 70, 0.75, 120, 65)
ON CONFLICT DO NOTHING;

-- Insert sample questions
INSERT INTO adaptive_questions (assessment_id, question_text, question_type, difficulty, learning_objective, correct_answer, explanation, hints, points) 
SELECT 
    aa.id,
    'What is the correct way to declare a variable in JavaScript?',
    'multiple-choice',
    3,
    'Variable Declaration',
    'var myVariable;',
    'The var keyword is used to declare variables in JavaScript.',
    ARRAY['Variables store data', 'JavaScript is case-sensitive'],
    5
FROM adaptive_assessments aa 
WHERE aa.title = 'JavaScript Basics Quiz'
ON CONFLICT DO NOTHING;

-- Insert question options
INSERT INTO question_options (question_id, option_text, is_correct, feedback, order_index)
SELECT 
    aq.id,
    'var myVariable;',
    true,
    'Correct! This is the proper syntax for variable declaration.',
    1
FROM adaptive_questions aq
WHERE aq.question_text = 'What is the correct way to declare a variable in JavaScript?'
ON CONFLICT DO NOTHING;

INSERT INTO question_options (question_id, option_text, is_correct, feedback, order_index)
SELECT 
    aq.id,
    'variable myVariable;',
    false,
    'Incorrect. JavaScript uses var, let, or const keywords.',
    2
FROM adaptive_questions aq
WHERE aq.question_text = 'What is the correct way to declare a variable in JavaScript?'
ON CONFLICT DO NOTHING;

-- Refresh materialized view
REFRESH MATERIALIZED VIEW user_analytics_summary;

-- Insert development-specific configuration
INSERT INTO system_config (config_key, config_value, description) VALUES
('development_mode', 'true', 'Enable development mode features'),
('debug_logging', 'true', 'Enable debug logging for development'),
('seed_data_loaded', 'true', 'Flag indicating seed data has been loaded'),
('last_seed_date', to_json(NOW()), 'Timestamp of last seed data load')
ON CONFLICT (config_key) DO UPDATE SET 
    config_value = EXCLUDED.config_value,
    updated_at = CURRENT_TIMESTAMP;

COMMIT;