-- Row Level Security Policies
-- Supabase Migration: RLS Setup for Personal Learning Assistant

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE adaptive_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE adaptive_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- USER POLICIES
-- ==========================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile" 
    ON users FOR SELECT 
    USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" 
    ON users FOR UPDATE 
    USING (auth.uid() = id);

-- Users can insert their own profile (for registration)
CREATE POLICY "Users can insert own profile" 
    ON users FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- ==========================================
-- USER PREFERENCES POLICIES
-- ==========================================

-- Users can view their own preferences
CREATE POLICY "Users can view own preferences" 
    ON user_preferences FOR SELECT 
    USING (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own preferences" 
    ON user_preferences FOR UPDATE 
    USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert own preferences" 
    ON user_preferences FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own preferences
CREATE POLICY "Users can delete own preferences" 
    ON user_preferences FOR DELETE 
    USING (auth.uid() = user_id);

-- ==========================================
-- LEARNING PROFILE POLICIES
-- ==========================================

-- Users can view their own learning profile
CREATE POLICY "Users can view own learning profile" 
    ON learning_profiles FOR SELECT 
    USING (auth.uid() = user_id);

-- Users can update their own learning profile
CREATE POLICY "Users can update own learning profile" 
    ON learning_profiles FOR UPDATE 
    USING (auth.uid() = user_id);

-- Users can insert their own learning profile
CREATE POLICY "Users can insert own learning profile" 
    ON learning_profiles FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own learning profile
CREATE POLICY "Users can delete own learning profile" 
    ON learning_profiles FOR DELETE 
    USING (auth.uid() = user_id);

-- ==========================================
-- LEARNING STYLES POLICIES
-- ==========================================

-- Users can view their own learning styles
CREATE POLICY "Users can view own learning styles" 
    ON learning_styles FOR SELECT 
    USING (EXISTS (
        SELECT 1 FROM learning_profiles 
        WHERE learning_profiles.id = learning_styles.profile_id 
        AND learning_profiles.user_id = auth.uid()
    ));

-- Users can update their own learning styles
CREATE POLICY "Users can update own learning styles" 
    ON learning_styles FOR UPDATE 
    USING (EXISTS (
        SELECT 1 FROM learning_profiles 
        WHERE learning_profiles.id = learning_styles.profile_id 
        AND learning_profiles.user_id = auth.uid()
    ));

-- Users can insert their own learning styles
CREATE POLICY "Users can insert own learning styles" 
    ON learning_styles FOR INSERT 
    WITH CHECK (EXISTS (
        SELECT 1 FROM learning_profiles 
        WHERE learning_profiles.id = learning_styles.profile_id 
        AND learning_profiles.user_id = auth.uid()
    ));

-- Users can delete their own learning styles
CREATE POLICY "Users can delete own learning styles" 
    ON learning_styles FOR DELETE 
    USING (EXISTS (
        SELECT 1 FROM learning_profiles 
        WHERE learning_profiles.id = learning_styles.profile_id 
        AND learning_profiles.user_id = auth.uid()
    ));

-- ==========================================
-- LEARNING SESSION POLICIES
-- ==========================================

-- Users can view their own learning sessions
CREATE POLICY "Users can view own learning sessions" 
    ON learning_sessions FOR SELECT 
    USING (auth.uid() = user_id);

-- Users can update their own learning sessions
CREATE POLICY "Users can update own learning sessions" 
    ON learning_sessions FOR UPDATE 
    USING (auth.uid() = user_id);

-- Users can insert their own learning sessions
CREATE POLICY "Users can insert own learning sessions" 
    ON learning_sessions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own learning sessions
CREATE POLICY "Users can delete own learning sessions" 
    ON learning_sessions FOR DELETE 
    USING (auth.uid() = user_id);

-- ==========================================
-- CONTENT POLICIES
-- ==========================================

-- All authenticated users can view content
CREATE POLICY "Authenticated users can view content" 
    ON adaptive_content FOR SELECT 
    USING (auth.role() = 'authenticated');

-- Only administrators can modify content
CREATE POLICY "Admins can modify content" 
    ON adaptive_content FOR ALL 
    USING (auth.jwt() ->> 'role' = 'admin');

-- All authenticated users can view content variants
CREATE POLICY "Authenticated users can view content variants" 
    ON content_variants FOR SELECT 
    USING (auth.role() = 'authenticated');

-- Only administrators can modify content variants
CREATE POLICY "Admins can modify content variants" 
    ON content_variants FOR ALL 
    USING (auth.jwt() ->> 'role' = 'admin');

-- ==========================================
-- ASSESSMENT POLICIES
-- ==========================================

-- All authenticated users can view assessments
CREATE POLICY "Authenticated users can view assessments" 
    ON adaptive_assessments FOR SELECT 
    USING (auth.role() = 'authenticated');

-- Only administrators can modify assessments
CREATE POLICY "Admins can modify assessments" 
    ON adaptive_assessments FOR ALL 
    USING (auth.jwt() ->> 'role' = 'admin');

-- ==========================================
-- RECOMMENDATION POLICIES
-- ==========================================

-- Users can view their own recommendations
CREATE POLICY "Users can view own recommendations" 
    ON recommendations FOR SELECT 
    USING (auth.uid() = user_id);

-- Users can update their own recommendations (for feedback)
CREATE POLICY "Users can update own recommendations" 
    ON recommendations FOR UPDATE 
    USING (auth.uid() = user_id);

-- System can insert recommendations for users
CREATE POLICY "System can insert recommendations" 
    ON recommendations FOR INSERT 
    WITH CHECK (true);

-- System can delete expired recommendations
CREATE POLICY "System can delete expired recommendations" 
    ON recommendations FOR DELETE 
    USING (status = 'expired' OR expires_at < NOW());

-- ==========================================
-- HELPER FUNCTIONS FOR RLS
-- ==========================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN auth.jwt() ->> 'role' = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user owns a learning profile
CREATE OR REPLACE FUNCTION auth.owns_learning_profile(profile_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM learning_profiles 
        WHERE id = profile_id 
        AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's learning profile ID
CREATE OR REPLACE FUNCTION auth.get_user_learning_profile_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT id FROM learning_profiles 
        WHERE user_id = auth.uid() 
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- REALTIME PUBLICATIONS
-- ==========================================

-- Enable realtime for learning sessions
ALTER PUBLICATION supabase_realtime ADD TABLE learning_sessions;

-- Enable realtime for recommendations
ALTER PUBLICATION supabase_realtime ADD TABLE recommendations;

-- Enable realtime for user preferences
ALTER PUBLICATION supabase_realtime ADD TABLE user_preferences;

-- Enable realtime for learning profiles
ALTER PUBLICATION supabase_realtime ADD TABLE learning_profiles;

-- ==========================================
-- STORAGE POLICIES
-- ==========================================

-- Create storage buckets (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('user-avatars', 'user-avatars', false, 5242880, '{"image/jpeg", "image/png", "image/gif", "image/webp"}'),
  ('learning-materials', 'learning-materials', false, 52428800, '{"image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf", "video/mp4", "video/webm", "audio/mpeg", "audio/wav"}'),
  ('user-uploads', 'user-uploads', false, 10485760, '{"image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf", "text/plain"}')
ON CONFLICT (id) DO NOTHING;

-- Policies for user-avatars bucket
CREATE POLICY "Users can upload their own avatar" 
    ON storage.objects FOR INSERT 
    WITH CHECK (
        bucket_id = 'user-avatars' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can update their own avatar" 
    ON storage.objects FOR UPDATE 
    USING (
        bucket_id = 'user-avatars' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete their own avatar" 
    ON storage.objects FOR DELETE 
    USING (
        bucket_id = 'user-avatars' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Anyone can view user avatars" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'user-avatars');

-- Policies for learning-materials bucket
CREATE POLICY "Authenticated users can view learning materials" 
    ON storage.objects FOR SELECT 
    USING (
        bucket_id = 'learning-materials' 
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Admins can manage learning materials" 
    ON storage.objects FOR ALL 
    USING (
        bucket_id = 'learning-materials' 
        AND auth.jwt() ->> 'role' = 'admin'
    );

-- Policies for user-uploads bucket
CREATE POLICY "Users can upload their own files" 
    ON storage.objects FOR INSERT 
    WITH CHECK (
        bucket_id = 'user-uploads' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can view their own files" 
    ON storage.objects FOR SELECT 
    USING (
        bucket_id = 'user-uploads' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can update their own files" 
    ON storage.objects FOR UPDATE 
    USING (
        bucket_id = 'user-uploads' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete their own files" 
    ON storage.objects FOR DELETE 
    USING (
        bucket_id = 'user-uploads' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );