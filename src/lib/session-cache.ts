import { cacheManager, CacheOptions } from './cache';
import { executeRedisCommand } from './redis-client';
import { env } from './env-validation';
import { generateUUID } from '@/utils/uuid';

// ====================
// TYPES AND INTERFACES
// ====================

export interface SessionData {
  sessionId: string;
  userId: string;
  userData?: any;
  preferences?: UserPreferences;
  learningState?: LearningState;
  authData?: AuthData;
  metadata?: SessionMetadata;
  createdAt: number;
  lastActivity: number;
  expiresAt: number;
  isActive: boolean;
}

export interface UserPreferences {
  theme: string;
  language: string;
  learningStyle: string;
  notifications: boolean;
  autoSave: boolean;
  difficulty: number;
  pace: string;
  contentTypes: string[];
}

export interface LearningState {
  currentModule?: string;
  currentLesson?: string;
  progress: number;
  streakDays: number;
  completedItems: string[];
  bookmarks: string[];
  notes: { [key: string]: string };
  achievements: string[];
  goals: Goal[];
  lastQuizScore?: number;
  adaptiveLevel: number;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  target: number;
  current: number;
  deadline?: number;
  completed: boolean;
  createdAt: number;
}

export interface AuthData {
  token?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  roles: string[];
  permissions: string[];
  lastLogin: number;
  loginCount: number;
  mfaEnabled: boolean;
  securityLevel: number;
}

export interface SessionMetadata {
  ip?: string;
  userAgent?: string;
  platform?: string;
  browser?: string;
  location?: string;
  timezone?: string;
  deviceId?: string;
  fingerprint?: string;
  isBot: boolean;
  riskScore: number;
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
  averageSessionDuration: number;
  totalSessionTime: number;
  uniqueUsers: number;
  peakConcurrentSessions: number;
  sessionsByHour: { [hour: string]: number };
  sessionsByDevice: { [device: string]: number };
  sessionsByLocation: { [location: string]: number };
}

export interface SessionQueryOptions {
  userId?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'lastActivity' | 'expiresAt';
  sortOrder?: 'asc' | 'desc';
  includeExpired?: boolean;
}

// ====================
// SESSION CACHE MANAGER
// ====================

export class SessionCacheManager {
  private static instance: SessionCacheManager;
  private namespace = 'sessions';
  private userSessionsNamespace = 'user_sessions';
  private sessionStatsNamespace = 'session_stats';
  private defaultTTL: number;
  private extendedTTL: number;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private statsCollectionInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.defaultTTL = env.CACHE_TTL_MEDIUM; // 30 minutes
    this.extendedTTL = env.CACHE_TTL_LONG; // 2 hours
    this.startCleanupJob();
    this.startStatsCollection();
  }

  public static getInstance(): SessionCacheManager {
    if (!SessionCacheManager.instance) {
      SessionCacheManager.instance = new SessionCacheManager();
    }
    return SessionCacheManager.instance;
  }

  /**
   * Create a new session
   */
  public async createSession(
    userId: string,
    userData?: any,
    metadata?: Partial<SessionMetadata>,
    ttl?: number
  ): Promise<SessionData> {
    const sessionId = generateUUID();
    const now = Date.now();
    const sessionTTL = ttl || this.defaultTTL;

    const sessionData: SessionData = {
      sessionId,
      userId,
      userData,
      preferences: await this.loadUserPreferences(userId),
      learningState: await this.loadLearningState(userId),
      authData: {
        roles: [],
        permissions: [],
        lastLogin: now,
        loginCount: 0,
        mfaEnabled: false,
        securityLevel: 1,
      },
      metadata: {
        ...metadata,
        isBot: false,
        riskScore: 0,
      },
      createdAt: now,
      lastActivity: now,
      expiresAt: now + (sessionTTL * 1000),
      isActive: true,
    };

    try {
      // Store session data
      await this.setSession(sessionData, sessionTTL);
      
      // Add to user's session list
      await this.addUserSession(userId, sessionId, sessionTTL);
      
      // Update session statistics
      await this.updateSessionStats('create', sessionData);
      
      console.log(`✅ Created session ${sessionId} for user ${userId}`);
      return sessionData;
    } catch (error) {
      console.error('❌ Failed to create session:', error);
      throw error;
    }
  }

  /**
   * Get session data
   */
  public async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const options: CacheOptions = { namespace: this.namespace };
      const session = await cacheManager.get<SessionData>(sessionId, options);
      
      if (!session) {
        return null;
      }

      // Check if session is expired
      if (session.expiresAt <= Date.now()) {
        await this.deleteSession(sessionId);
        return null;
      }

      // Update last activity
      session.lastActivity = Date.now();
      await this.setSession(session);
      
      return session;
    } catch (error) {
      console.error('❌ Failed to get session:', error);
      return null;
    }
  }

  /**
   * Update session data
   */
  public async updateSession(
    sessionId: string,
    updates: Partial<SessionData>,
    extendTTL: boolean = true
  ): Promise<SessionData | null> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return null;
      }

      const updatedSession: SessionData = {
        ...session,
        ...updates,
        lastActivity: Date.now(),
      };

      // Extend TTL if requested
      if (extendTTL) {
        updatedSession.expiresAt = Date.now() + (this.defaultTTL * 1000);
      }

      await this.setSession(updatedSession);
      return updatedSession;
    } catch (error) {
      console.error('❌ Failed to update session:', error);
      return null;
    }
  }

  /**
   * Delete session
   */
  public async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      
      // Remove from cache
      const options: CacheOptions = { namespace: this.namespace };
      const deleted = await cacheManager.delete(sessionId, options);
      
      if (session) {
        // Remove from user's session list
        await this.removeUserSession(session.userId, sessionId);
        
        // Update statistics
        await this.updateSessionStats('delete', session);
      }
      
      console.log(`✅ Deleted session ${sessionId}`);
      return deleted;
    } catch (error) {
      console.error('❌ Failed to delete session:', error);
      return false;
    }
  }

  /**
   * Get all sessions for a user
   */
  public async getUserSessions(
    userId: string,
    options: SessionQueryOptions = {}
  ): Promise<SessionData[]> {
    try {
      // Get user's session IDs
      const sessionIds = await this.getUserSessionIds(userId);
      
      if (sessionIds.length === 0) {
        return [];
      }

      // Get session data for each ID
      const sessions: SessionData[] = [];
      const promises = sessionIds.map(sessionId => this.getSession(sessionId));
      const results = await Promise.allSettled(promises);
      
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          sessions.push(result.value);
        }
      }

      // Apply filters
      let filteredSessions = sessions;
      
      if (options.active !== undefined) {
        filteredSessions = filteredSessions.filter(session => 
          session.isActive === options.active
        );
      }
      
      if (!options.includeExpired) {
        const now = Date.now();
        filteredSessions = filteredSessions.filter(session => 
          session.expiresAt > now
        );
      }

      // Sort sessions
      const sortBy = options.sortBy || 'lastActivity';
      const sortOrder = options.sortOrder || 'desc';
      
      filteredSessions.sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];
        const comparison = sortOrder === 'asc' ? 
          (aValue < bValue ? -1 : aValue > bValue ? 1 : 0) :
          (aValue > bValue ? -1 : aValue < bValue ? 1 : 0);
        return comparison;
      });

      // Apply pagination
      const offset = options.offset || 0;
      const limit = options.limit || 50;
      
      return filteredSessions.slice(offset, offset + limit);
    } catch (error) {
      console.error('❌ Failed to get user sessions:', error);
      return [];
    }
  }

  /**
   * Get active session count for a user
   */
  public async getActiveSessionCount(userId: string): Promise<number> {
    try {
      const sessions = await this.getUserSessions(userId, { active: true });
      return sessions.length;
    } catch (error) {
      console.error('❌ Failed to get active session count:', error);
      return 0;
    }
  }

  /**
   * Invalidate all sessions for a user
   */
  public async invalidateUserSessions(userId: string): Promise<number> {
    try {
      const sessionIds = await this.getUserSessionIds(userId);
      let deletedCount = 0;
      
      for (const sessionId of sessionIds) {
        const deleted = await this.deleteSession(sessionId);
        if (deleted) {
          deletedCount++;
        }
      }
      
      console.log(`✅ Invalidated ${deletedCount} sessions for user ${userId}`);
      return deletedCount;
    } catch (error) {
      console.error('❌ Failed to invalidate user sessions:', error);
      return 0;
    }
  }

  /**
   * Extend session TTL
   */
  public async extendSession(sessionId: string, additionalTTL?: number): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return false;
      }

      const extension = additionalTTL || this.defaultTTL;
      session.expiresAt = Date.now() + (extension * 1000);
      session.lastActivity = Date.now();
      
      await this.setSession(session, extension);
      return true;
    } catch (error) {
      console.error('❌ Failed to extend session:', error);
      return false;
    }
  }

  /**
   * Update user preferences in session
   */
  public async updateUserPreferences(
    sessionId: string,
    preferences: Partial<UserPreferences>
  ): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return false;
      }

      session.preferences = {
        ...session.preferences,
        ...preferences,
      };

      await this.setSession(session);
      
      // Also update persistent user preferences
      await this.saveUserPreferences(session.userId, session.preferences);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to update user preferences:', error);
      return false;
    }
  }

  /**
   * Update learning state in session
   */
  public async updateLearningState(
    sessionId: string,
    learningState: Partial<LearningState>
  ): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return false;
      }

      session.learningState = {
        ...session.learningState,
        ...learningState,
      };

      await this.setSession(session);
      
      // Also update persistent learning state
      await this.saveLearningState(session.userId, session.learningState);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to update learning state:', error);
      return false;
    }
  }

  /**
   * Get session statistics
   */
  public async getSessionStats(): Promise<SessionStats> {
    try {
      const options: CacheOptions = { namespace: this.sessionStatsNamespace };
      const stats = await cacheManager.get<SessionStats>('global', options);
      
      if (stats) {
        return stats;
      }

      // Return default stats if none found
      return {
        totalSessions: 0,
        activeSessions: 0,
        expiredSessions: 0,
        averageSessionDuration: 0,
        totalSessionTime: 0,
        uniqueUsers: 0,
        peakConcurrentSessions: 0,
        sessionsByHour: {},
        sessionsByDevice: {},
        sessionsByLocation: {},
      };
    } catch (error) {
      console.error('❌ Failed to get session stats:', error);
      return {
        totalSessions: 0,
        activeSessions: 0,
        expiredSessions: 0,
        averageSessionDuration: 0,
        totalSessionTime: 0,
        uniqueUsers: 0,
        peakConcurrentSessions: 0,
        sessionsByHour: {},
        sessionsByDevice: {},
        sessionsByLocation: {},
      };
    }
  }

  // ====================
  // PRIVATE METHODS
  // ====================

  private async setSession(session: SessionData, ttl?: number): Promise<void> {
    const sessionTTL = ttl || Math.ceil((session.expiresAt - Date.now()) / 1000);
    const options: CacheOptions = {
      namespace: this.namespace,
      ttl: Math.max(sessionTTL, 1), // Ensure TTL is at least 1 second
      tags: ['session', `user:${session.userId}`],
    };
    
    await cacheManager.set(session.sessionId, session, options);
  }

  private async addUserSession(userId: string, sessionId: string, ttl: number): Promise<void> {
    try {
      const setKey = `user:${userId}:sessions`;
      const options: CacheOptions = { namespace: this.userSessionsNamespace };
      
      // Add session ID to user's session set
      await executeRedisCommand('sadd', [`${this.userSessionsNamespace}:${setKey}`, sessionId]);
      await executeRedisCommand('expire', [`${this.userSessionsNamespace}:${setKey}`, ttl + 3600]);
    } catch (error) {
      console.error('❌ Failed to add user session:', error);
    }
  }

  private async removeUserSession(userId: string, sessionId: string): Promise<void> {
    try {
      const setKey = `user:${userId}:sessions`;
      await executeRedisCommand('srem', [`${this.userSessionsNamespace}:${setKey}`, sessionId]);
    } catch (error) {
      console.error('❌ Failed to remove user session:', error);
    }
  }

  private async getUserSessionIds(userId: string): Promise<string[]> {
    try {
      const setKey = `user:${userId}:sessions`;
      const sessionIds = await executeRedisCommand<string[]>('smembers', [`${this.userSessionsNamespace}:${setKey}`]);
      return sessionIds || [];
    } catch (error) {
      console.error('❌ Failed to get user session IDs:', error);
      return [];
    }
  }

  private async loadUserPreferences(userId: string): Promise<UserPreferences> {
    try {
      const options: CacheOptions = { namespace: 'user_preferences' };
      const preferences = await cacheManager.get<UserPreferences>(userId, options);
      
      return preferences || {
        theme: 'light',
        language: 'en',
        learningStyle: 'visual',
        notifications: true,
        autoSave: true,
        difficulty: 5,
        pace: 'normal',
        contentTypes: ['text', 'video', 'interactive'],
      };
    } catch (error) {
      console.error('❌ Failed to load user preferences:', error);
      return {
        theme: 'light',
        language: 'en',
        learningStyle: 'visual',
        notifications: true,
        autoSave: true,
        difficulty: 5,
        pace: 'normal',
        contentTypes: ['text', 'video', 'interactive'],
      };
    }
  }

  private async saveUserPreferences(userId: string, preferences: UserPreferences): Promise<void> {
    try {
      const options: CacheOptions = {
        namespace: 'user_preferences',
        ttl: env.CACHE_TTL_LONG,
        tags: ['preferences', `user:${userId}`],
      };
      
      await cacheManager.set(userId, preferences, options);
    } catch (error) {
      console.error('❌ Failed to save user preferences:', error);
    }
  }

  private async loadLearningState(userId: string): Promise<LearningState> {
    try {
      const options: CacheOptions = { namespace: 'learning_state' };
      const state = await cacheManager.get<LearningState>(userId, options);
      
      return state || {
        progress: 0,
        streakDays: 0,
        completedItems: [],
        bookmarks: [],
        notes: {},
        achievements: [],
        goals: [],
        adaptiveLevel: 1,
      };
    } catch (error) {
      console.error('❌ Failed to load learning state:', error);
      return {
        progress: 0,
        streakDays: 0,
        completedItems: [],
        bookmarks: [],
        notes: {},
        achievements: [],
        goals: [],
        adaptiveLevel: 1,
      };
    }
  }

  private async saveLearningState(userId: string, state: LearningState): Promise<void> {
    try {
      const options: CacheOptions = {
        namespace: 'learning_state',
        ttl: env.CACHE_TTL_LONG,
        tags: ['learning_state', `user:${userId}`],
      };
      
      await cacheManager.set(userId, state, options);
    } catch (error) {
      console.error('❌ Failed to save learning state:', error);
    }
  }

  private async updateSessionStats(action: 'create' | 'delete', session: SessionData): Promise<void> {
    try {
      const options: CacheOptions = { namespace: this.sessionStatsNamespace };
      let stats = await cacheManager.get<SessionStats>('global', options);
      
      if (!stats) {
        stats = {
          totalSessions: 0,
          activeSessions: 0,
          expiredSessions: 0,
          averageSessionDuration: 0,
          totalSessionTime: 0,
          uniqueUsers: 0,
          peakConcurrentSessions: 0,
          sessionsByHour: {},
          sessionsByDevice: {},
          sessionsByLocation: {},
        };
      }

      const now = Date.now();
      const hour = new Date(now).getHours().toString();
      const device = session.metadata?.platform || 'unknown';
      const location = session.metadata?.location || 'unknown';

      if (action === 'create') {
        stats.totalSessions++;
        stats.activeSessions++;
        stats.sessionsByHour[hour] = (stats.sessionsByHour[hour] || 0) + 1;
        stats.sessionsByDevice[device] = (stats.sessionsByDevice[device] || 0) + 1;
        stats.sessionsByLocation[location] = (stats.sessionsByLocation[location] || 0) + 1;
        
        if (stats.activeSessions > stats.peakConcurrentSessions) {
          stats.peakConcurrentSessions = stats.activeSessions;
        }
      } else if (action === 'delete') {
        stats.activeSessions = Math.max(0, stats.activeSessions - 1);
        
        if (session.expiresAt <= now) {
          stats.expiredSessions++;
        }
        
        // Update session duration stats
        const duration = now - session.createdAt;
        stats.totalSessionTime += duration;
        
        const totalCompletedSessions = stats.totalSessions - stats.activeSessions;
        if (totalCompletedSessions > 0) {
          stats.averageSessionDuration = stats.totalSessionTime / totalCompletedSessions;
        }
      }

      await cacheManager.set('global', stats, {
        ...options,
        ttl: env.CACHE_TTL_LONG,
      });
    } catch (error) {
      console.error('❌ Failed to update session stats:', error);
    }
  }

  private startCleanupJob(): void {
    // Clean up expired sessions every 10 minutes
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpiredSessions();
    }, 10 * 60 * 1000);
  }

  private startStatsCollection(): void {
    // Update stats every 5 minutes
    this.statsCollectionInterval = setInterval(async () => {
      await this.collectDetailedStats();
    }, 5 * 60 * 1000);
  }

  private async cleanupExpiredSessions(): Promise<void> {
    try {
      console.log('🧹 Starting session cleanup...');
      
      // This would require scanning all session keys, which might be expensive
      // In a real implementation, you might want to use Redis SCAN or keep an index
      const pattern = `${this.namespace}:*`;
      const deletedCount = await cacheManager.deleteByPattern(pattern);
      
      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} expired sessions`);
      }
    } catch (error) {
      console.error('❌ Session cleanup failed:', error);
    }
  }

  private async collectDetailedStats(): Promise<void> {
    try {
      // Collect additional metrics like unique users, etc.
      const stats = await this.getSessionStats();
      
      // You could add more detailed collection here
      console.log(`📊 Session stats - Active: ${stats.activeSessions}, Total: ${stats.totalSessions}`);
    } catch (error) {
      console.error('❌ Failed to collect session stats:', error);
    }
  }

  /**
   * Shutdown cleanup
   */
  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.statsCollectionInterval) {
      clearInterval(this.statsCollectionInterval);
    }
  }
}

// ====================
// SINGLETON INSTANCE
// ====================

export const sessionCache = SessionCacheManager.getInstance();

// ====================
// CONVENIENCE FUNCTIONS
// ====================

/**
 * Create a new session
 */
export async function createSession(
  userId: string,
  userData?: any,
  metadata?: Partial<SessionMetadata>,
  ttl?: number
): Promise<SessionData> {
  return sessionCache.createSession(userId, userData, metadata, ttl);
}

/**
 * Get session data
 */
export async function getSession(sessionId: string): Promise<SessionData | null> {
  return sessionCache.getSession(sessionId);
}

/**
 * Update session data
 */
export async function updateSession(
  sessionId: string,
  updates: Partial<SessionData>,
  extendTTL?: boolean
): Promise<SessionData | null> {
  return sessionCache.updateSession(sessionId, updates, extendTTL);
}

/**
 * Delete session
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  return sessionCache.deleteSession(sessionId);
}

/**
 * Get user sessions
 */
export async function getUserSessions(
  userId: string,
  options?: SessionQueryOptions
): Promise<SessionData[]> {
  return sessionCache.getUserSessions(userId, options);
}

/**
 * Invalidate all user sessions
 */
export async function invalidateUserSessions(userId: string): Promise<number> {
  return sessionCache.invalidateUserSessions(userId);
}

/**
 * Get session statistics
 */
export async function getSessionStats(): Promise<SessionStats> {
  return sessionCache.getSessionStats();
}

export default sessionCache;