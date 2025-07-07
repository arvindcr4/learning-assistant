import { supabase, createServerClient } from './supabase';
import type { 
  Database, 
  User, 
  UserPreferences, 
  LearningProfile, 
  LearningSession, 
  AdaptiveContent,
  Recommendation,
  UserInsert,
  UserPreferencesInsert,
  LearningProfileInsert,
  LearningSessionInsert,
  RecommendationInsert
} from '@/types/supabase';

// Error types for better error handling
export class SupabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'SupabaseError';
  }
}

// ==========================================
// USER MANAGEMENT SERVICES
// ==========================================

export class UserService {
  static async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        throw new SupabaseError('Failed to get authenticated user', authError.message);
      }
      
      if (!user) {
        return null;
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (userError) {
        throw new SupabaseError('Failed to fetch user data', userError.code, userError);
      }

      return userData;
    } catch (error) {
      console.error('Error getting current user:', error);
      throw error instanceof SupabaseError ? error : new SupabaseError('Unknown error getting current user');
    }
  }

  static async createUser(userData: UserInsert): Promise<User> {
    try {
      const { data, error } = await supabase
        .from('users')
        .insert([userData])
        .select()
        .single();

      if (error) {
        throw new SupabaseError('Failed to create user', error.code, error);
      }

      return data;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error instanceof SupabaseError ? error : new SupabaseError('Unknown error creating user');
    }
  }

  static async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        throw new SupabaseError('Failed to update user', error.code, error);
      }

      return data;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error instanceof SupabaseError ? error : new SupabaseError('Unknown error updating user');
    }
  }

  static async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw new SupabaseError('Failed to fetch user preferences', error.code, error);
      }

      return data || null;
    } catch (error) {
      console.error('Error getting user preferences:', error);
      throw error instanceof SupabaseError ? error : new SupabaseError('Unknown error getting user preferences');
    }
  }

  static async createOrUpdateUserPreferences(
    userId: string, 
    preferences: Omit<UserPreferencesInsert, 'user_id'>
  ): Promise<UserPreferences> {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .upsert([{ ...preferences, user_id: userId }])
        .select()
        .single();

      if (error) {
        throw new SupabaseError('Failed to update user preferences', error.code, error);
      }

      return data;
    } catch (error) {
      console.error('Error updating user preferences:', error);
      throw error instanceof SupabaseError ? error : new SupabaseError('Unknown error updating user preferences');
    }
  }
}

// ==========================================
// LEARNING PROFILE SERVICES
// ==========================================

export class LearningProfileService {
  static async getLearningProfile(userId: string): Promise<LearningProfile | null> {
    try {
      const { data, error } = await supabase
        .from('learning_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new SupabaseError('Failed to fetch learning profile', error.code, error);
      }

      return data || null;
    } catch (error) {
      console.error('Error getting learning profile:', error);
      throw error instanceof SupabaseError ? error : new SupabaseError('Unknown error getting learning profile');
    }
  }

  static async createOrUpdateLearningProfile(
    userId: string,
    profile: Omit<LearningProfileInsert, 'user_id'>
  ): Promise<LearningProfile> {
    try {
      const { data, error } = await supabase
        .from('learning_profiles')
        .upsert([{ ...profile, user_id: userId }])
        .select()
        .single();

      if (error) {
        throw new SupabaseError('Failed to update learning profile', error.code, error);
      }

      return data;
    } catch (error) {
      console.error('Error updating learning profile:', error);
      throw error instanceof SupabaseError ? error : new SupabaseError('Unknown error updating learning profile');
    }
  }

  static async getLearningStyles(profileId: string) {
    try {
      const { data, error } = await supabase
        .from('learning_styles')
        .select('*')
        .eq('profile_id', profileId)
        .order('score', { ascending: false });

      if (error) {
        throw new SupabaseError('Failed to fetch learning styles', error.code, error);
      }

      return data;
    } catch (error) {
      console.error('Error getting learning styles:', error);
      throw error instanceof SupabaseError ? error : new SupabaseError('Unknown error getting learning styles');
    }
  }
}

// ==========================================
// LEARNING SESSION SERVICES
// ==========================================

export class LearningSessionService {
  static async createLearningSession(session: LearningSessionInsert): Promise<LearningSession> {
    try {
      const { data, error } = await supabase
        .from('learning_sessions')
        .insert([session])
        .select()
        .single();

      if (error) {
        throw new SupabaseError('Failed to create learning session', error.code, error);
      }

      return data;
    } catch (error) {
      console.error('Error creating learning session:', error);
      throw error instanceof SupabaseError ? error : new SupabaseError('Unknown error creating learning session');
    }
  }

  static async updateLearningSession(
    sessionId: string,
    updates: Partial<LearningSession>
  ): Promise<LearningSession> {
    try {
      const { data, error } = await supabase
        .from('learning_sessions')
        .update(updates)
        .eq('id', sessionId)
        .select()
        .single();

      if (error) {
        throw new SupabaseError('Failed to update learning session', error.code, error);
      }

      return data;
    } catch (error) {
      console.error('Error updating learning session:', error);
      throw error instanceof SupabaseError ? error : new SupabaseError('Unknown error updating learning session');
    }
  }

  static async getUserSessions(
    userId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<LearningSession[]> {
    try {
      const { data, error } = await supabase
        .from('learning_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('start_time', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new SupabaseError('Failed to fetch user sessions', error.code, error);
      }

      return data;
    } catch (error) {
      console.error('Error getting user sessions:', error);
      throw error instanceof SupabaseError ? error : new SupabaseError('Unknown error getting user sessions');
    }
  }

  static async getSessionStats(userId: string, days: number = 30) {
    try {
      const { data, error } = await supabase
        .from('learning_sessions')
        .select('duration, correct_answers, total_questions, completed, start_time')
        .eq('user_id', userId)
        .gte('start_time', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

      if (error) {
        throw new SupabaseError('Failed to fetch session stats', error.code, error);
      }

      // Calculate stats
      const totalSessions = data.length;
      const completedSessions = data.filter(s => s.completed).length;
      const totalTime = data.reduce((sum, s) => sum + (s.duration || 0), 0);
      const totalCorrect = data.reduce((sum, s) => sum + (s.correct_answers || 0), 0);
      const totalQuestions = data.reduce((sum, s) => sum + (s.total_questions || 0), 0);
      const averageScore = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

      return {
        totalSessions,
        completedSessions,
        completionRate: totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0,
        totalTime,
        averageScore,
        averageSessionTime: totalSessions > 0 ? totalTime / totalSessions : 0
      };
    } catch (error) {
      console.error('Error getting session stats:', error);
      throw error instanceof SupabaseError ? error : new SupabaseError('Unknown error getting session stats');
    }
  }
}

// ==========================================
// CONTENT SERVICES
// ==========================================

export class ContentService {
  static async getAdaptiveContent(
    filters: {
      difficulty?: number;
      concept?: string;
      tags?: string[];
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<AdaptiveContent[]> {
    try {
      let query = supabase
        .from('adaptive_content')
        .select('*');

      if (filters.difficulty) {
        query = query.eq('difficulty', filters.difficulty);
      }

      if (filters.concept) {
        query = query.ilike('concept', `%${filters.concept}%`);
      }

      if (filters.tags && filters.tags.length > 0) {
        query = query.overlaps('tags', filters.tags);
      }

      query = query
        .order('created_at', { ascending: false })
        .range(filters.offset || 0, (filters.offset || 0) + (filters.limit || 10) - 1);

      const { data, error } = await query;

      if (error) {
        throw new SupabaseError('Failed to fetch adaptive content', error.code, error);
      }

      return data;
    } catch (error) {
      console.error('Error getting adaptive content:', error);
      throw error instanceof SupabaseError ? error : new SupabaseError('Unknown error getting adaptive content');
    }
  }

  static async getContentVariants(contentId: string, styleType?: string) {
    try {
      let query = supabase
        .from('content_variants')
        .select('*')
        .eq('content_id', contentId);

      if (styleType) {
        query = query.eq('style_type', styleType);
      }

      const { data, error } = await query;

      if (error) {
        throw new SupabaseError('Failed to fetch content variants', error.code, error);
      }

      return data;
    } catch (error) {
      console.error('Error getting content variants:', error);
      throw error instanceof SupabaseError ? error : new SupabaseError('Unknown error getting content variants');
    }
  }

  static async getRecommendedContent(userId: string): Promise<AdaptiveContent[]> {
    try {
      // Get user's learning profile to determine preferences
      const profile = await LearningProfileService.getLearningProfile(userId);
      const preferences = await UserService.getUserPreferences(userId);

      let query = supabase
        .from('adaptive_content')
        .select('*');

      // Filter by preferred topics if available
      if (preferences?.preferred_topics && preferences.preferred_topics.length > 0) {
        query = query.overlaps('tags', preferences.preferred_topics);
      }

      // Filter by difficulty level
      if (preferences?.difficulty_level) {
        const difficultyRange = {
          beginner: [1, 4],
          intermediate: [4, 7],
          advanced: [7, 10]
        };
        const [min, max] = difficultyRange[preferences.difficulty_level];
        query = query.gte('difficulty', min).lte('difficulty', max);
      }

      const { data, error } = await query
        .order('success_rate', { ascending: false })
        .limit(10);

      if (error) {
        throw new SupabaseError('Failed to fetch recommended content', error.code, error);
      }

      return data;
    } catch (error) {
      console.error('Error getting recommended content:', error);
      throw error instanceof SupabaseError ? error : new SupabaseError('Unknown error getting recommended content');
    }
  }
}

// ==========================================
// RECOMMENDATION SERVICES
// ==========================================

export class RecommendationService {
  static async getUserRecommendations(
    userId: string,
    status: 'active' | 'accepted' | 'declined' | 'expired' = 'active'
  ): Promise<Recommendation[]> {
    try {
      const { data, error } = await supabase
        .from('recommendations')
        .select('*')
        .eq('user_id', userId)
        .eq('status', status)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        throw new SupabaseError('Failed to fetch recommendations', error.code, error);
      }

      return data;
    } catch (error) {
      console.error('Error getting recommendations:', error);
      throw error instanceof SupabaseError ? error : new SupabaseError('Unknown error getting recommendations');
    }
  }

  static async createRecommendation(recommendation: RecommendationInsert): Promise<Recommendation> {
    try {
      const { data, error } = await supabase
        .from('recommendations')
        .insert([recommendation])
        .select()
        .single();

      if (error) {
        throw new SupabaseError('Failed to create recommendation', error.code, error);
      }

      return data;
    } catch (error) {
      console.error('Error creating recommendation:', error);
      throw error instanceof SupabaseError ? error : new SupabaseError('Unknown error creating recommendation');
    }
  }

  static async updateRecommendationStatus(
    recommendationId: string,
    status: 'accepted' | 'declined' | 'expired',
    feedback?: string,
    rating?: number
  ): Promise<Recommendation> {
    try {
      const updates: any = {
        status,
        responded_at: new Date().toISOString()
      };

      if (feedback) updates.user_feedback = feedback;
      if (rating) updates.feedback_rating = rating;

      const { data, error } = await supabase
        .from('recommendations')
        .update(updates)
        .eq('id', recommendationId)
        .select()
        .single();

      if (error) {
        throw new SupabaseError('Failed to update recommendation', error.code, error);
      }

      return data;
    } catch (error) {
      console.error('Error updating recommendation:', error);
      throw error instanceof SupabaseError ? error : new SupabaseError('Unknown error updating recommendation');
    }
  }
}

// ==========================================
// ANALYTICS SERVICES
// ==========================================

export class AnalyticsService {
  static async getUserLearningOverview(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_learning_overview')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new SupabaseError('Failed to fetch learning overview', error.code, error);
      }

      return data;
    } catch (error) {
      console.error('Error getting learning overview:', error);
      throw error instanceof SupabaseError ? error : new SupabaseError('Unknown error getting learning overview');
    }
  }

  static async getContentEffectiveness(contentId?: string) {
    try {
      let query = supabase
        .from('content_effectiveness')
        .select('*');

      if (contentId) {
        query = query.eq('content_id', contentId);
      }

      const { data, error } = await query
        .order('average_score', { ascending: false });

      if (error) {
        throw new SupabaseError('Failed to fetch content effectiveness', error.code, error);
      }

      return data;
    } catch (error) {
      console.error('Error getting content effectiveness:', error);
      throw error instanceof SupabaseError ? error : new SupabaseError('Unknown error getting content effectiveness');
    }
  }
}

// ==========================================
// REAL-TIME SERVICES
// ==========================================

export class RealtimeService {
  static subscribeToUserRecommendations(
    userId: string,
    callback: (payload: any) => void
  ) {
    return supabase
      .channel(`recommendations:user:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recommendations',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe();
  }

  static subscribeToLearningSession(
    sessionId: string,
    callback: (payload: any) => void
  ) {
    return supabase
      .channel(`session:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'learning_sessions',
          filter: `id=eq.${sessionId}`
        },
        callback
      )
      .subscribe();
  }
}

// Export all services
export {
  UserService,
  LearningProfileService,
  LearningSessionService,
  ContentService,
  RecommendationService,
  AnalyticsService,
  RealtimeService
};