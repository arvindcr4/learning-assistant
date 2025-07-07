// Database utilities for Supabase Edge Functions
// Uses Supabase client compatible with Deno

// Import Supabase client for Deno
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  User,
  LearningProfile,
  LearningSession,
  AdaptiveContent,
  DatabaseUser,
  DatabaseLearningProfile,
  DatabaseLearningSession,
  LearningStyleType,
  NotFoundError,
  ValidationError
} from './types.ts';

/**
 * Database connection and query utilities
 */
export class DatabaseService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch user: ${error.message}`);
    }

    return this.mapDatabaseUser(data);
  }

  /**
   * Get learning profile for user
   */
  async getLearningProfile(userId: string): Promise<LearningProfile | null> {
    const { data, error } = await this.supabase
      .from('learning_profiles')
      .select(`
        *,
        style_assessments (
          assessment_type,
          visual_score,
          auditory_score,
          reading_score,
          kinesthetic_score,
          confidence,
          completed_at
        )
      `)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch learning profile: ${error.message}`);
    }

    return this.mapDatabaseLearningProfile(data);
  }

  /**
   * Get learning sessions for user
   */
  async getLearningSessions(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<LearningSession[]> {
    let query = this.supabase
      .from('learning_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: false });

    if (options.startDate) {
      query = query.gte('start_time', options.startDate);
    }

    if (options.endDate) {
      query = query.lte('start_time', options.endDate);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch learning sessions: ${error.message}`);
    }

    return (data || []).map(this.mapDatabaseLearningSession);
  }

  /**
   * Get adaptive content
   */
  async getAdaptiveContent(
    options: {
      limit?: number;
      offset?: number;
      difficultyRange?: [number, number];
      tags?: string[];
      excludeIds?: string[];
    } = {}
  ): Promise<AdaptiveContent[]> {
    let query = this.supabase
      .from('adaptive_content')
      .select(`
        *,
        content_variants (
          id,
          style_type,
          format,
          content,
          accessibility_features
        )
      `);

    if (options.difficultyRange) {
      query = query
        .gte('difficulty', options.difficultyRange[0])
        .lte('difficulty', options.difficultyRange[1]);
    }

    if (options.tags && options.tags.length > 0) {
      query = query.overlaps('tags', options.tags);
    }

    if (options.excludeIds && options.excludeIds.length > 0) {
      query = query.not('id', 'in', `(${options.excludeIds.map(id => `'${id}'`).join(',')})`);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch adaptive content: ${error.message}`);
    }

    return (data || []).map(this.mapDatabaseAdaptiveContent);
  }

  /**
   * Get content by ID
   */
  async getContentById(contentId: string): Promise<AdaptiveContent | null> {
    const { data, error } = await this.supabase
      .from('adaptive_content')
      .select(`
        *,
        content_variants (
          id,
          style_type,
          format,
          content,
          accessibility_features
        )
      `)
      .eq('id', contentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch content: ${error.message}`);
    }

    return this.mapDatabaseAdaptiveContent(data);
  }

  /**
   * Get user analytics data
   */
  async getUserAnalytics(
    userId: string,
    timeRange: { start: string; end: string }
  ): Promise<any> {
    // Get learning sessions in time range
    const sessions = await this.getLearningSession(userId, {
      startDate: timeRange.start,
      endDate: timeRange.end
    });

    // Get assessment attempts in time range
    const { data: assessments, error: assessmentsError } = await this.supabase
      .from('assessment_attempts')
      .select(`
        *,
        adaptive_assessments (
          title,
          assessment_type,
          difficulty_level
        )
      `)
      .eq('user_id', userId)
      .gte('started_at', timeRange.start)
      .lte('started_at', timeRange.end);

    if (assessmentsError) {
      throw new Error(`Failed to fetch assessments: ${assessmentsError.message}`);
    }

    // Get style effectiveness data
    const { data: styleData, error: styleError } = await this.supabase
      .from('style_effectiveness')
      .select(`
        *,
        learning_analytics!inner(user_id)
      `)
      .eq('learning_analytics.user_id', userId)
      .gte('learning_analytics.time_range_start', timeRange.start)
      .lte('learning_analytics.time_range_end', timeRange.end);

    if (styleError) {
      throw new Error(`Failed to fetch style effectiveness: ${styleError.message}`);
    }

    return {
      sessions: sessions || [],
      assessments: assessments || [],
      styleEffectiveness: styleData || []
    };
  }

  /**
   * Find similar users based on learning patterns
   */
  async findSimilarUsers(
    userId: string,
    limit: number = 10
  ): Promise<string[]> {
    // This is a simplified implementation
    // In production, you would use more sophisticated similarity algorithms
    const { data, error } = await this.supabase
      .from('learning_profiles')
      .select('user_id, dominant_style, adaptation_level')
      .neq('user_id', userId)
      .limit(limit);

    if (error) {
      throw new Error(`Failed to find similar users: ${error.message}`);
    }

    return (data || []).map(profile => profile.user_id);
  }

  /**
   * Get content consumed by similar users
   */
  async getContentConsumedBySimilarUsers(
    userIds: string[]
  ): Promise<Array<{ contentId: string; score: number; users: string[] }>> {
    if (userIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('learning_sessions')
      .select('content_id, user_id')
      .in('user_id', userIds)
      .eq('completed', true);

    if (error) {
      throw new Error(`Failed to fetch similar user content: ${error.message}`);
    }

    // Group by content and calculate scores
    const contentMap = new Map<string, { users: Set<string>; score: number }>();
    
    (data || []).forEach(session => {
      if (!contentMap.has(session.content_id)) {
        contentMap.set(session.content_id, {
          users: new Set(),
          score: 0
        });
      }
      
      const content = contentMap.get(session.content_id)!;
      content.users.add(session.user_id);
      content.score = content.users.size / userIds.length; // Popularity among similar users
    });

    return Array.from(contentMap.entries()).map(([contentId, data]) => ({
      contentId,
      score: data.score,
      users: Array.from(data.users)
    }));
  }

  /**
   * Store recommendation feedback
   */
  async storeRecommendationFeedback(
    userId: string,
    recommendationId: string,
    feedback: {
      accepted: boolean;
      rating?: number;
      reason?: string;
    }
  ): Promise<void> {
    const { error } = await this.supabase
      .from('recommendation_feedback')
      .insert({
        user_id: userId,
        recommendation_id: recommendationId,
        accepted: feedback.accepted,
        rating: feedback.rating,
        reason: feedback.reason,
        created_at: new Date().toISOString()
      });

    if (error) {
      throw new Error(`Failed to store recommendation feedback: ${error.message}`);
    }
  }

  // Mapping functions to convert database format to application format

  private mapDatabaseUser(dbUser: DatabaseUser): User {
    return {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      avatar: dbUser.avatar,
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at
    };
  }

  private mapDatabaseLearningProfile(dbProfile: any): LearningProfile {
    return {
      id: dbProfile.id,
      userId: dbProfile.user_id,
      dominantStyle: dbProfile.dominant_style as LearningStyleType,
      styles: this.mapStyleAssessments(dbProfile.style_assessments || []),
      isMultimodal: this.determineMultimodal(dbProfile.style_assessments || []),
      adaptationLevel: dbProfile.adaptation_level || 0,
      createdAt: dbProfile.created_at,
      updatedAt: dbProfile.updated_at
    };
  }

  private mapDatabaseLearningSession(dbSession: any): LearningSession {
    return {
      id: dbSession.id,
      userId: dbSession.user_id,
      contentId: dbSession.content_id,
      startTime: dbSession.start_time,
      endTime: dbSession.end_time,
      duration: dbSession.duration,
      itemsCompleted: dbSession.items_completed,
      correctAnswers: dbSession.correct_answers,
      totalQuestions: dbSession.total_questions,
      completed: dbSession.completed,
      engagementMetrics: {
        timeSpent: dbSession.duration,
        interactionCount: dbSession.interaction_count || 0,
        focusScore: dbSession.focus_score || 0,
        completionRate: dbSession.completion_rate || 0
      },
      createdAt: dbSession.created_at
    };
  }

  private mapDatabaseAdaptiveContent(dbContent: any): AdaptiveContent {
    return {
      id: dbContent.id,
      title: dbContent.title,
      description: dbContent.description,
      concept: dbContent.concept,
      difficulty: dbContent.difficulty,
      estimatedDuration: dbContent.estimated_duration,
      prerequisites: dbContent.prerequisites || [],
      learningObjectives: dbContent.learning_objectives || [],
      contentVariants: (dbContent.content_variants || []).map((variant: any) => ({
        id: variant.id,
        contentId: dbContent.id,
        styleType: variant.style_type,
        format: variant.format,
        content: variant.content,
        accessibility: variant.accessibility_features || {
          highContrast: false,
          largeFonts: false,
          keyboardNavigation: false,
          audioDescription: false,
          signLanguage: false
        },
        createdAt: variant.created_at
      })),
      metadata: {
        tags: dbContent.tags || [],
        category: dbContent.category || '',
        bloomsTaxonomyLevel: dbContent.blooms_taxonomy_level || 'remember',
        cognitiveLoad: dbContent.cognitive_load || 5,
        estimatedEngagement: dbContent.estimated_engagement || 5,
        successRate: dbContent.success_rate || 80
      },
      createdAt: dbContent.created_at,
      updatedAt: dbContent.updated_at
    };
  }

  private mapStyleAssessments(assessments: any[]): any[] {
    // Map style assessments from database format
    return assessments.map(assessment => ({
      type: this.determineStyleFromScores(assessment),
      strength: this.calculateMaxScore(assessment),
      confidence: assessment.confidence,
      evidence: [`Assessment completed on ${assessment.completed_at}`]
    }));
  }

  private determineStyleFromScores(assessment: any): LearningStyleType {
    const scores = {
      visual: assessment.visual_score,
      auditory: assessment.auditory_score,
      reading: assessment.reading_score,
      kinesthetic: assessment.kinesthetic_score
    };

    const maxScore = Math.max(...Object.values(scores));
    return Object.keys(scores).find(key => scores[key as keyof typeof scores] === maxScore) as LearningStyleType;
  }

  private calculateMaxScore(assessment: any): number {
    return Math.max(
      assessment.visual_score,
      assessment.auditory_score,
      assessment.reading_score,
      assessment.kinesthetic_score
    );
  }

  private determineMultimodal(assessments: any[]): boolean {
    if (assessments.length === 0) return false;
    
    const latest = assessments[assessments.length - 1];
    const scores = [
      latest.visual_score,
      latest.auditory_score,
      latest.reading_score,
      latest.kinesthetic_score
    ];
    
    const sortedScores = scores.sort((a, b) => b - a);
    return sortedScores[0] - sortedScores[1] < 0.2; // If top two scores are close
  }
}