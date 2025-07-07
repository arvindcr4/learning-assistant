import { PoolClient, QueryResult as PgQueryResult } from 'pg';
import { v4 as uuidv4 } from 'uuid';

import { query, transaction } from './connection';
import { LearningStyleType } from './models';

// Generic query result interface
export interface QueryResult<T = any> extends PgQueryResult<T> {
  rows: T[];
  rowCount: number | null;
  command: string;
}

// Database utility functions
export class DatabaseUtils {
  
  // ==========================================
  // USER MANAGEMENT UTILITIES
  // ==========================================
  
  /**
   * Create a new user with default preferences and learning profile
   */
  static async createUser(userData: {
    email: string;
    name: string;
    avatarUrl?: string;
  }): Promise<string> {
    const userId = uuidv4();
    
    return await transaction(async (client: PoolClient) => {
      // Create user
      await client.query(
        `INSERT INTO users (id, email, name, avatar_url) 
         VALUES ($1, $2, $3, $4)`,
        [userId, userData.email, userData.name, userData.avatarUrl]
      );
      
      // Create default preferences
      await client.query(
        `INSERT INTO user_preferences (user_id, difficulty_level, daily_goal_minutes, days_per_week)
         VALUES ($1, 'beginner', 30, 5)`,
        [userId]
      );
      
      // Create default learning profile
      const profileId = uuidv4();
      await client.query(
        `INSERT INTO learning_profiles (id, user_id, dominant_style, adaptation_level, confidence_score)
         VALUES ($1, $2, 'visual', 0, 0.5)`,
        [profileId, userId]
      );
      
      // Create default pace profile
      await client.query(
        `INSERT INTO pace_profiles (user_id, current_pace, optimal_pace)
         VALUES ($1, 3.0, 4.0)`,
        [userId]
      );
      
      return userId;
    });
  }
  
  /**
   * Get user with all related data
   */
  static async getUserWithProfiles(userId: string): Promise<any> {
    const result = await query(`
      SELECT 
        u.*,
        up.learning_goals, up.preferred_topics, up.difficulty_level,
        up.daily_goal_minutes, up.days_per_week,
        lp.dominant_style, lp.is_multimodal, lp.adaptation_level, lp.confidence_score,
        pp.current_pace, pp.optimal_pace, pp.comprehension_rate, pp.retention_rate
      FROM users u
      LEFT JOIN user_preferences up ON u.id = up.user_id
      LEFT JOIN learning_profiles lp ON u.id = lp.user_id
      LEFT JOIN pace_profiles pp ON u.id = pp.user_id
      WHERE u.id = $1
    `, [userId]);
    
    return result.rows[0];
  }
  
  // ==========================================
  // LEARNING STYLE UTILITIES
  // ==========================================
  
  /**
   * Update learning style assessment results
   */
  static async updateLearningStyleAssessment(
    userId: string,
    assessmentData: {
      visualScore: number;
      auditoryScore: number;
      readingScore: number;
      kinestheticScore: number;
      confidence: number;
      assessmentType: 'questionnaire' | 'behavioral' | 'hybrid';
    }
  ): Promise<void> {
    return await transaction(async (client: PoolClient) => {
      // Get learning profile
      const profileResult = await client.query(
        'SELECT id FROM learning_profiles WHERE user_id = $1',
        [userId]
      );
      
      if (profileResult.rows.length === 0) {
        throw new Error('Learning profile not found');
      }
      
      const profileId = profileResult.rows[0].id;
      
      // Insert assessment results
      await client.query(`
        INSERT INTO style_assessments 
        (profile_id, assessment_type, visual_score, auditory_score, reading_score, kinesthetic_score, confidence)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        profileId,
        assessmentData.assessmentType,
        assessmentData.visualScore,
        assessmentData.auditoryScore,
        assessmentData.readingScore,
        assessmentData.kinestheticScore,
        assessmentData.confidence
      ]);
      
      // Determine dominant style
      const scores = {
        visual: assessmentData.visualScore,
        auditory: assessmentData.auditoryScore,
        reading: assessmentData.readingScore,
        kinesthetic: assessmentData.kinestheticScore
      };
      
      const dominantStyle = Object.entries(scores).reduce((a, b) => 
        scores[a[0] as keyof typeof scores] > scores[b[0] as keyof typeof scores] ? a : b
      )[0] as LearningStyleType;
      
      // Check if multimodal (multiple styles within 20% of each other)
      const maxScore = Math.max(...Object.values(scores));
      const isMultimodal = Object.values(scores).filter(
        score => score >= maxScore * 0.8
      ).length > 1;
      
      // Update learning profile
      await client.query(`
        UPDATE learning_profiles 
        SET dominant_style = $1, is_multimodal = $2, confidence_score = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [dominantStyle, isMultimodal, assessmentData.confidence, profileId]);
      
      // Update individual style scores
      for (const [styleType, score] of Object.entries(scores)) {
        await client.query(`
          INSERT INTO learning_styles (profile_id, style_type, score, confidence)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (profile_id, style_type) 
          DO UPDATE SET score = $3, confidence = $4, last_updated = CURRENT_TIMESTAMP
        `, [profileId, styleType, Math.round(score * 100), assessmentData.confidence]);
      }
    });
  }
  
  /**
   * Record behavioral indicator
   */
  static async recordBehavioralIndicator(
    userId: string,
    behaviorData: {
      action: string;
      contentType: 'visual' | 'auditory' | 'reading' | 'kinesthetic';
      engagementLevel: number;
      completionRate: number;
      timeSpent: number;
    }
  ): Promise<void> {
    // Get profile ID
    const profileResult = await query(
      'SELECT id FROM learning_profiles WHERE user_id = $1',
      [userId]
    );
    
    if (profileResult.rows.length === 0) {
      throw new Error('Learning profile not found');
    }
    
    const profileId = profileResult.rows[0].id;
    
    // Insert behavioral indicator
    await query(`
      INSERT INTO behavioral_indicators 
      (profile_id, action, content_type, engagement_level, completion_rate, time_spent)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      profileId,
      behaviorData.action,
      behaviorData.contentType,
      behaviorData.engagementLevel,
      behaviorData.completionRate,
      behaviorData.timeSpent
    ]);
    
    // Update profile confidence based on data points
    await query('SELECT update_learning_profile_confidence($1)', [profileId]);
  }
  
  // ==========================================
  // CONTENT UTILITIES
  // ==========================================
  
  /**
   * Get adaptive content for user
   */
  static async getAdaptiveContent(
    userId: string,
    contentId?: string,
    options?: {
      difficulty?: number;
      learningStyle?: string;
      limit?: number;
    }
  ): Promise<any[]> {
    let queryText = `
      SELECT 
        ac.id, ac.title, ac.description, ac.concept, ac.difficulty,
        ac.estimated_duration, ac.learning_objectives, ac.tags,
        cv.style_type, cv.format, cv.content_data, cv.interactivity_level,
        lp.dominant_style as user_dominant_style
      FROM adaptive_content ac
      LEFT JOIN content_variants cv ON ac.id = cv.content_id
      LEFT JOIN learning_profiles lp ON lp.user_id = $1
      WHERE 1=1
    `;
    
    const params = [userId];
    let paramIndex = 2;
    
    if (contentId) {
      queryText += ` AND ac.id = $${paramIndex}`;
      params.push(contentId);
      paramIndex++;
    }
    
    if (options?.difficulty) {
      queryText += ` AND ac.difficulty = $${paramIndex}`;
      params.push(options.difficulty.toString());
      paramIndex++;
    }
    
    if (options?.learningStyle) {
      queryText += ` AND cv.style_type = $${paramIndex}`;
      params.push(options.learningStyle);
      paramIndex++;
    }
    
    queryText += ' ORDER BY ac.created_at DESC';
    
    if (options?.limit) {
      queryText += ` LIMIT $${paramIndex}`;
      params.push(options.limit.toString());
    }
    
    const result = await query(queryText, params);
    return result.rows;
  }
  
  /**
   * Create learning session
   */
  static async createLearningSession(
    userId: string,
    contentId: string,
    duration: number = 0
  ): Promise<string> {
    const sessionId = uuidv4();
    
    await query(`
      INSERT INTO learning_sessions 
      (id, user_id, content_id, duration, start_time)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    `, [sessionId, userId, contentId, duration]);
    
    return sessionId;
  }
  
  /**
   * Complete learning session
   */
  static async completeLearningSession(
    sessionId: string,
    sessionData: {
      itemsCompleted?: number;
      correctAnswers?: number;
      totalQuestions?: number;
      focusTime?: number;
      distractionEvents?: number;
      interactionRate?: number;
      scrollDepth?: number;
    }
  ): Promise<void> {
    await query(`
      UPDATE learning_sessions 
      SET 
        end_time = CURRENT_TIMESTAMP,
        completed = true,
        items_completed = COALESCE($2, items_completed),
        correct_answers = COALESCE($3, correct_answers),
        total_questions = COALESCE($4, total_questions),
        focus_time = COALESCE($5, focus_time),
        distraction_events = COALESCE($6, distraction_events),
        interaction_rate = COALESCE($7, interaction_rate),
        scroll_depth = COALESCE($8, scroll_depth)
      WHERE id = $1
    `, [
      sessionId,
      sessionData.itemsCompleted,
      sessionData.correctAnswers,
      sessionData.totalQuestions,
      sessionData.focusTime,
      sessionData.distractionEvents,
      sessionData.interactionRate,
      sessionData.scrollDepth
    ]);
  }
  
  // ==========================================
  // ASSESSMENT UTILITIES
  // ==========================================
  
  /**
   * Create assessment attempt
   */
  static async createAssessmentAttempt(
    userId: string,
    assessmentId: string
  ): Promise<string> {
    const attemptId = uuidv4();
    
    await query(`
      INSERT INTO assessment_attempts 
      (id, user_id, assessment_id, started_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    `, [attemptId, userId, assessmentId]);
    
    return attemptId;
  }
  
  /**
   * Complete assessment attempt
   */
  static async completeAssessmentAttempt(
    attemptId: string,
    results: {
      score: number;
      passed: boolean;
      timeSpent: number;
      questionsAnswered: number;
      correctAnswers: number;
    }
  ): Promise<void> {
    await query(`
      UPDATE assessment_attempts 
      SET 
        completed_at = CURRENT_TIMESTAMP,
        score = $2,
        passed = $3,
        time_spent = $4,
        questions_answered = $5,
        correct_answers = $6
      WHERE id = $1
    `, [
      attemptId,
      results.score,
      results.passed,
      results.timeSpent,
      results.questionsAnswered,
      results.correctAnswers
    ]);
  }
  
  // ==========================================
  // ANALYTICS UTILITIES
  // ==========================================
  
  /**
   * Get user analytics for time range
   */
  static async getUserAnalytics(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const result = await query(`
      SELECT 
        COUNT(DISTINCT ls.id) as total_sessions,
        SUM(ls.duration) as total_time_spent,
        AVG(CASE WHEN ls.total_questions > 0 THEN ls.correct_answers::DECIMAL / ls.total_questions * 100 ELSE 0 END) as average_score,
        COUNT(DISTINCT DATE(ls.start_time)) as active_days,
        COUNT(DISTINCT aa.id) as total_assessments,
        COUNT(DISTINCT CASE WHEN aa.passed THEN aa.id END) as passed_assessments
      FROM users u
      LEFT JOIN learning_sessions ls ON u.id = ls.user_id 
        AND ls.start_time BETWEEN $2 AND $3
      LEFT JOIN assessment_attempts aa ON u.id = aa.user_id 
        AND aa.started_at BETWEEN $2 AND $3
      WHERE u.id = $1
      GROUP BY u.id
    `, [userId, startDate, endDate]);
    
    return result.rows[0];
  }
  
  /**
   * Generate learning analytics snapshot
   */
  static async generateAnalyticsSnapshot(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<string> {
    const analyticsId = uuidv4();
    const analytics = await this.getUserAnalytics(userId, startDate, endDate);
    
    await query(`
      INSERT INTO learning_analytics 
      (id, user_id, time_range_start, time_range_end, total_time_spent, 
       content_completed, average_score, completion_rate, streak_days)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      analyticsId,
      userId,
      startDate,
      endDate,
      analytics.total_time_spent || 0,
      analytics.total_sessions || 0,
      analytics.average_score || 0,
      analytics.total_assessments > 0 ? (analytics.passed_assessments / analytics.total_assessments) * 100 : 0,
      analytics.active_days || 0
    ]);
    
    return analyticsId;
  }
  
  // ==========================================
  // RECOMMENDATION UTILITIES
  // ==========================================
  
  /**
   * Get personalized recommendations
   */
  static async getPersonalizedRecommendations(
    userId: string,
    limit: number = 5
  ): Promise<any[]> {
    const result = await query(
      'SELECT * FROM get_content_recommendations($1, $2)',
      [userId, limit]
    );
    
    return result.rows;
  }
  
  /**
   * Create recommendation
   */
  static async createRecommendation(
    userId: string,
    recommendationData: {
      type: 'content' | 'pace' | 'style' | 'schedule' | 'goal';
      title: string;
      description: string;
      reasoning: string;
      confidence: number;
      priority: 'low' | 'medium' | 'high';
      actionRequired?: boolean;
      estimatedImpact: number;
      expiresAt?: Date;
    }
  ): Promise<string> {
    const recommendationId = uuidv4();
    
    await query(`
      INSERT INTO recommendations 
      (id, user_id, recommendation_type, title, description, reasoning, 
       confidence, priority, action_required, estimated_impact, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      recommendationId,
      userId,
      recommendationData.type,
      recommendationData.title,
      recommendationData.description,
      recommendationData.reasoning,
      recommendationData.confidence,
      recommendationData.priority,
      recommendationData.actionRequired || false,
      recommendationData.estimatedImpact,
      recommendationData.expiresAt
    ]);
    
    return recommendationId;
  }
  
  // ==========================================
  // SYSTEM UTILITIES
  // ==========================================
  
  /**
   * Get system configuration
   */
  static async getSystemConfig(key: string): Promise<any> {
    const result = await query(
      'SELECT config_value FROM system_config WHERE config_key = $1',
      [key]
    );
    
    return result.rows[0]?.config_value;
  }
  
  /**
   * Update system configuration
   */
  static async updateSystemConfig(
    key: string,
    value: any,
    description?: string
  ): Promise<void> {
    await query(`
      INSERT INTO system_config (config_key, config_value, description)
      VALUES ($1, $2, $3)
      ON CONFLICT (config_key) 
      DO UPDATE SET config_value = $2, description = COALESCE($3, description), updated_at = CURRENT_TIMESTAMP
    `, [key, JSON.stringify(value), description]);
  }
  
  /**
   * Health check - verify database integrity
   */
  static async healthCheck(): Promise<{
    healthy: boolean;
    checks: Record<string, boolean>;
  }> {
    const checks: Record<string, boolean> = {};
    
    try {
      // Check basic connectivity
      const connectResult = await query('SELECT 1');
      checks.connectivity = connectResult.rows.length > 0;
      
      // Check essential tables exist
      const tablesResult = await query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('users', 'learning_profiles', 'adaptive_content')
      `);
      checks.essential_tables = tablesResult.rows.length === 3;
      
      // Check system config
      const configResult = await query('SELECT COUNT(*) FROM system_config');
      checks.system_config = configResult.rows[0].count > 0;
      
      const healthy = Object.values(checks).every(check => check);
      
      return { healthy, checks };
    } catch (error) {
      console.error('Health check failed:', error);
      return { healthy: false, checks };
    }
  }
}