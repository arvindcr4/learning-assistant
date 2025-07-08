// Database Service Wrapper - Production-ready database operations
import { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { DatabaseConnection, getDatabase } from './connection';
import { DatabaseUtils } from './utils';
import * as Models from './models';

// Service operation options
interface ServiceOptions {
  useTransaction?: boolean;
  timeout?: number;
  retries?: number;
  logQuery?: boolean;
  cacheKey?: string;
  cacheTTL?: number;
}

// Query cache interface
interface QueryCache {
  [key: string]: {
    data: any;
    timestamp: number;
    ttl: number;
  };
}

// Database service class providing high-level operations
export class DatabaseService {
  private static instance: DatabaseService;
  private db: DatabaseConnection;
  private utils: DatabaseUtils;
  private queryCache: QueryCache = {};
  private cacheCleanupInterval: NodeJS.Timeout;

  private constructor() {
    this.db = getDatabase();
    this.utils = new DatabaseUtils();
    
    // Setup cache cleanup
    this.cacheCleanupInterval = setInterval(() => {
      this.cleanupCache();
    }, 60000); // Clean every minute
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  // ==========================================
  // USER MANAGEMENT OPERATIONS
  // ==========================================

  // Create a new user
  async createUser(userData: Models.CreateUserData): Promise<Models.User> {
    const query = `
      INSERT INTO users (email, name, avatar_url)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const result = await this.db.query<Models.User>(
      query,
      [userData.email, userData.name, userData.avatar_url || null]
    );
    
    return result.rows[0];
  }

  // Get user by ID
  async getUserById(userId: string, options: ServiceOptions = {}): Promise<Models.User | null> {
    const cacheKey = `user:${userId}`;
    
    // Check cache first
    if (options.cacheKey) {
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;
    }
    
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await this.db.query<Models.User>(query, [userId], options);
    
    if (result.rows.length === 0) return null;
    
    const user = result.rows[0];
    
    // Cache the result
    if (options.cacheKey) {
      this.setCache(cacheKey, user, options.cacheTTL || 300);
    }
    
    return user;
  }

  // Get user by email
  async getUserByEmail(email: string): Promise<Models.User | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await this.db.query<Models.User>(query, [email]);
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  // Update user
  async updateUser(userId: string, updates: Partial<Models.User>): Promise<Models.User> {
    const { query, values } = this.utils.buildUpdateQuery('users', updates, { id: userId });
    const result = await this.db.query<Models.User>(query, values);
    
    // Clear cache
    this.clearCache(`user:${userId}`);
    
    return result.rows[0];
  }

  // ==========================================
  // LEARNING PROFILE OPERATIONS
  // ==========================================

  // Create learning profile
  async createLearningProfile(profileData: Models.CreateLearningProfileData): Promise<Models.LearningProfile> {
    const query = `
      INSERT INTO learning_profiles (user_id, dominant_style, is_multimodal, adaptation_level, confidence_score)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const result = await this.db.query<Models.LearningProfile>(
      query,
      [
        profileData.user_id,
        profileData.dominant_style,
        profileData.is_multimodal || false,
        profileData.adaptation_level || 0,
        profileData.confidence_score || 0
      ]
    );
    
    return result.rows[0];
  }

  // Get learning profile by user ID
  async getLearningProfile(userId: string): Promise<Models.LearningProfile | null> {
    const query = 'SELECT * FROM learning_profiles WHERE user_id = $1';
    const result = await this.db.query<Models.LearningProfile>(query, [userId]);
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  // Update learning profile
  async updateLearningProfile(
    userId: string, 
    updates: Partial<Models.LearningProfile>
  ): Promise<Models.LearningProfile> {
    const { query, values } = this.utils.buildUpdateQuery(
      'learning_profiles', 
      updates, 
      { user_id: userId }
    );
    const result = await this.db.query<Models.LearningProfile>(query, values);
    
    return result.rows[0];
  }

  // ==========================================
  // LEARNING SESSION OPERATIONS
  // ==========================================

  // Create learning session
  async createLearningSession(sessionData: Models.CreateSessionData): Promise<Models.LearningSession> {
    const query = `
      INSERT INTO learning_sessions (
        user_id, content_id, duration, items_completed, 
        correct_answers, total_questions, completed,
        focus_time, distraction_events, interaction_rate,
        scroll_depth, video_watch_time, pause_frequency
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    
    const result = await this.db.query<Models.LearningSession>(
      query,
      [
        sessionData.user_id,
        sessionData.content_id,
        sessionData.duration,
        sessionData.items_completed || 0,
        sessionData.correct_answers || 0,
        sessionData.total_questions || 0,
        sessionData.completed || false,
        sessionData.focus_time || 0,
        sessionData.distraction_events || 0,
        sessionData.interaction_rate || 0,
        sessionData.scroll_depth || 0,
        sessionData.video_watch_time || 0,
        sessionData.pause_frequency || 0
      ]
    );
    
    return result.rows[0];
  }

  // Get user's learning sessions
  async getUserSessions(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Models.LearningSession[]> {
    const query = `
      SELECT * FROM learning_sessions 
      WHERE user_id = $1 
      ORDER BY start_time DESC 
      LIMIT $2 OFFSET $3
    `;
    
    const result = await this.db.query<Models.LearningSession>(
      query,
      [userId, limit, offset]
    );
    
    return result.rows;
  }

  // Update learning session
  async updateLearningSession(
    sessionId: string,
    updates: Partial<Models.LearningSession>
  ): Promise<Models.LearningSession> {
    const { query, values } = this.utils.buildUpdateQuery(
      'learning_sessions',
      updates,
      { id: sessionId }
    );
    const result = await this.db.query<Models.LearningSession>(query, values);
    
    return result.rows[0];
  }

  // ==========================================
  // ASSESSMENT OPERATIONS
  // ==========================================

  // Create assessment attempt
  async createAssessmentAttempt(attemptData: Models.CreateAssessmentAttemptData): Promise<Models.AssessmentAttempt> {
    const query = `
      INSERT INTO assessment_attempts (
        user_id, assessment_id, score, passed, 
        time_spent, questions_answered, correct_answers
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const result = await this.db.query<Models.AssessmentAttempt>(
      query,
      [
        attemptData.user_id,
        attemptData.assessment_id,
        attemptData.score || null,
        attemptData.passed || false,
        attemptData.time_spent || null,
        attemptData.questions_answered || 0,
        attemptData.correct_answers || 0
      ]
    );
    
    return result.rows[0];
  }

  // Get user's assessment attempts
  async getUserAssessmentAttempts(
    userId: string,
    assessmentId?: string
  ): Promise<Models.AssessmentAttempt[]> {
    let query = `
      SELECT * FROM assessment_attempts 
      WHERE user_id = $1
    `;
    const params = [userId];
    
    if (assessmentId) {
      query += ' AND assessment_id = $2';
      params.push(assessmentId);
    }
    
    query += ' ORDER BY started_at DESC';
    
    const result = await this.db.query<Models.AssessmentAttempt>(query, params);
    return result.rows;
  }

  // ==========================================
  // ANALYTICS OPERATIONS
  // ==========================================

  // Get user learning analytics
  async getUserAnalytics(
    userId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<Models.LearningAnalytics | null> {
    const query = `
      SELECT * FROM learning_analytics 
      WHERE user_id = $1 
      AND time_range_start <= $2 
      AND time_range_end >= $3
      ORDER BY generated_at DESC
      LIMIT 1
    `;
    
    const result = await this.db.query<Models.LearningAnalytics>(
      query,
      [userId, timeRange.end, timeRange.start]
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  // Generate user analytics
  async generateUserAnalytics(
    userId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<Models.LearningAnalytics> {
    // This would typically involve complex aggregations
    // For now, returning a simplified version
    
    const sessionsQuery = `
      SELECT 
        COUNT(*) as total_sessions,
        SUM(duration) as total_time,
        AVG(CASE WHEN total_questions > 0 THEN correct_answers::DECIMAL / total_questions * 100 ELSE 0 END) as avg_score,
        AVG(duration) as avg_duration
      FROM learning_sessions
      WHERE user_id = $1 
      AND start_time >= $2 
      AND start_time <= $3
    `;
    
    const sessionsResult = await this.db.query(
      sessionsQuery,
      [userId, timeRange.start, timeRange.end]
    );
    
    const stats = sessionsResult.rows[0];
    
    // Insert analytics record
    const insertQuery = `
      INSERT INTO learning_analytics (
        user_id, time_range_start, time_range_end,
        total_time_spent, content_completed, average_score,
        completion_rate, retention_rate, streak_days
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const result = await this.db.query<Models.LearningAnalytics>(
      insertQuery,
      [
        userId,
        timeRange.start,
        timeRange.end,
        stats.total_time || 0,
        stats.total_sessions || 0,
        stats.avg_score || 0,
        85.0, // Placeholder
        80.0, // Placeholder
        0     // Placeholder
      ]
    );
    
    return result.rows[0];
  }

  // ==========================================
  // TRANSACTION OPERATIONS
  // ==========================================

  // Execute operations in a transaction
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    return this.db.transaction(callback);
  }

  // Execute multiple operations atomically
  async executeInTransaction<T>(
    operations: ((client: PoolClient) => Promise<any>)[]
  ): Promise<T[]> {
    return this.db.transaction(async (client) => {
      const results = [];
      for (const operation of operations) {
        const result = await operation(client);
        results.push(result);
      }
      return results;
    });
  }

  // ==========================================
  // CACHE OPERATIONS
  // ==========================================

  private getFromCache(key: string): any | null {
    const cached = this.queryCache[key];
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > cached.ttl * 1000) {
      delete this.queryCache[key];
      return null;
    }
    
    return cached.data;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.queryCache[key] = {
      data,
      timestamp: Date.now(),
      ttl
    };
  }

  private clearCache(key: string): void {
    delete this.queryCache[key];
  }

  private cleanupCache(): void {
    const now = Date.now();
    const keysToDelete = [];
    
    for (const [key, cached] of Object.entries(this.queryCache)) {
      if (now - cached.timestamp > cached.ttl * 1000) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => delete this.queryCache[key]);
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  // Get database health status
  async getHealthStatus() {
    return this.db.getHealthStatus();
  }

  // Get database metrics
  async getMetrics() {
    return this.db.getMetrics();
  }

  // Get connection pool statistics
  async getPoolStats() {
    return this.db.getPoolStats();
  }

  // Execute raw query (use with caution)
  async rawQuery<T extends QueryResultRow = any>(
    query: string,
    params?: any[],
    options?: ServiceOptions
  ): Promise<QueryResult<T>> {
    return this.db.query<T>(query, params, options);
  }

  // Close database connections
  async close(): Promise<void> {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }
    await this.db.close();
  }
}

// Export singleton instance
export const databaseService = DatabaseService.getInstance();

// Convenience functions
export const getUserById = (userId: string, options?: ServiceOptions) =>
  databaseService.getUserById(userId, options);

export const createUser = (userData: Models.CreateUserData) =>
  databaseService.createUser(userData);

export const updateUser = (userId: string, updates: Partial<Models.User>) =>
  databaseService.updateUser(userId, updates);

export const createLearningSession = (sessionData: Models.CreateSessionData) =>
  databaseService.createLearningSession(sessionData);

export const getUserSessions = (userId: string, limit?: number, offset?: number) =>
  databaseService.getUserSessions(userId, limit, offset);

export const executeInTransaction = <T>(operations: ((client: PoolClient) => Promise<any>)[]) =>
  databaseService.executeInTransaction<T>(operations);

export const getHealthStatus = () => databaseService.getHealthStatus();

export const getMetrics = () => databaseService.getMetrics();

export default databaseService;