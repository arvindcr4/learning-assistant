import { auth } from './auth';
import { jwtService } from './jwt';
import { env } from './env-validation';
import { generateUUID } from '@/utils/uuid';

export interface SessionInfo {
  id: string;
  userId: string;
  email: string;
  name?: string;
  role: string;
  lastActivity: Date;
  createdAt: Date;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface SecurityEvent {
  type: 'login' | 'logout' | 'token_refresh' | 'suspicious_activity' | 'account_locked' | 'password_change';
  userId: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class SessionManager {
  private activeSessions: Map<string, SessionInfo> = new Map();
  private blacklistedTokens: Set<string> = new Set();
  private securityEvents: SecurityEvent[] = [];
  private readonly maxSessionsPerUser: number = 5;
  private readonly suspiciousActivityThreshold: number = 5;

  /**
   * Create a new session
   */
  async createSession(payload: {
    userId: string;
    email: string;
    name?: string;
    role: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ sessionId: string; accessToken: string; refreshToken: string }> {
    const sessionId = generateUUID();
    
    // Check for existing sessions for this user
    await this.cleanupUserSessions(payload.userId);
    
    // Create session info
    const sessionInfo: SessionInfo = {
      id: sessionId,
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      lastActivity: new Date(),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      ipAddress: payload.ipAddress,
      userAgent: payload.userAgent,
    };

    // Store session
    this.activeSessions.set(sessionId, sessionInfo);

    // Generate tokens
    const { accessToken, refreshToken } = jwtService.generateTokenPair({
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      sessionId,
    });

    // Log security event
    this.logSecurityEvent({
      type: 'login',
      userId: payload.userId,
      sessionId,
      ipAddress: payload.ipAddress,
      userAgent: payload.userAgent,
      timestamp: new Date(),
    });

    return { sessionId, accessToken, refreshToken };
  }

  /**
   * Validate a session
   */
  async validateSession(sessionId: string): Promise<SessionInfo | null> {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      this.activeSessions.delete(sessionId);
      return null;
    }

    // Update last activity
    session.lastActivity = new Date();
    this.activeSessions.set(sessionId, session);

    return session;
  }

  /**
   * Invalidate a session
   */
  async invalidateSession(sessionId: string, reason: string = 'user_logout'): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      return false;
    }

    // Remove from active sessions
    this.activeSessions.delete(sessionId);

    // Log security event
    this.logSecurityEvent({
      type: 'logout',
      userId: session.userId,
      sessionId,
      timestamp: new Date(),
      metadata: { reason },
    });

    return true;
  }

  /**
   * Invalidate all sessions for a user
   */
  async invalidateAllUserSessions(userId: string, reason: string = 'security_measure'): Promise<number> {
    let invalidated = 0;
    
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.userId === userId) {
        this.activeSessions.delete(sessionId);
        invalidated++;
      }
    }

    // Log security event
    this.logSecurityEvent({
      type: 'logout',
      userId,
      timestamp: new Date(),
      metadata: { reason, sessionsInvalidated: invalidated },
    });

    return invalidated;
  }

  /**
   * Blacklist a token
   */
  async blacklistToken(token: string): Promise<void> {
    this.blacklistedTokens.add(token);
    
    // Clean up old blacklisted tokens periodically
    if (this.blacklistedTokens.size > 10000) {
      this.cleanupBlacklistedTokens();
    }
  }

  /**
   * Check if a token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    return this.blacklistedTokens.has(token);
  }

  /**
   * Get active sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionInfo[]> {
    const sessions: SessionInfo[] = [];
    
    for (const session of this.activeSessions.values()) {
      if (session.userId === userId) {
        sessions.push(session);
      }
    }

    return sessions.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    let cleaned = 0;
    
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.expiresAt < now) {
        this.activeSessions.delete(sessionId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Clean up user sessions (enforce max sessions per user)
   */
  private async cleanupUserSessions(userId: string): Promise<void> {
    const userSessions = await this.getUserSessions(userId);
    
    if (userSessions.length >= this.maxSessionsPerUser) {
      // Remove oldest sessions
      const sessionsToRemove = userSessions
        .sort((a, b) => a.lastActivity.getTime() - b.lastActivity.getTime())
        .slice(0, userSessions.length - this.maxSessionsPerUser + 1);

      for (const session of sessionsToRemove) {
        this.activeSessions.delete(session.id);
      }
    }
  }

  /**
   * Clean up old blacklisted tokens
   */
  private cleanupBlacklistedTokens(): void {
    // In a real implementation, you'd check token expiration dates
    // For now, we'll just clear half of them
    const tokens = Array.from(this.blacklistedTokens);
    const toKeep = tokens.slice(tokens.length / 2);
    
    this.blacklistedTokens.clear();
    toKeep.forEach(token => this.blacklistedTokens.add(token));
  }

  /**
   * Log security event
   */
  private logSecurityEvent(event: SecurityEvent): void {
    this.securityEvents.push(event);
    
    // Keep only recent events (last 1000)
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-1000);
    }

    // Log to console in development
    if (env.NODE_ENV === 'development') {
      console.log('Security Event:', event);
    }
  }

  /**
   * Get security events for a user
   */
  async getSecurityEvents(userId: string, limit: number = 50): Promise<SecurityEvent[]> {
    return this.securityEvents
      .filter(event => event.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Detect suspicious activity
   */
  async detectSuspiciousActivity(userId: string, ipAddress?: string): Promise<boolean> {
    const recentEvents = this.securityEvents
      .filter(event => 
        event.userId === userId && 
        event.timestamp > new Date(Date.now() - 60 * 60 * 1000) // Last hour
      );

    // Check for multiple failed login attempts
    const failedLogins = recentEvents.filter(event => 
      event.type === 'login' && 
      event.metadata?.success === false
    );

    if (failedLogins.length >= this.suspiciousActivityThreshold) {
      this.logSecurityEvent({
        type: 'suspicious_activity',
        userId,
        timestamp: new Date(),
        metadata: { reason: 'multiple_failed_logins', count: failedLogins.length },
      });
      return true;
    }

    // Check for logins from different IPs
    if (ipAddress) {
      const differentIPs = new Set(
        recentEvents
          .filter(event => event.ipAddress && event.ipAddress !== ipAddress)
          .map(event => event.ipAddress)
      );

      if (differentIPs.size >= 3) {
        this.logSecurityEvent({
          type: 'suspicious_activity',
          userId,
          timestamp: new Date(),
          metadata: { reason: 'multiple_ip_addresses', ipCount: differentIPs.size },
        });
        return true;
      }
    }

    return false;
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    totalActiveSessions: number;
    uniqueUsers: number;
    expiredSessions: number;
    blacklistedTokens: number;
    securityEvents: number;
  }> {
    const now = new Date();
    let expiredSessions = 0;
    const uniqueUsers = new Set<string>();

    for (const session of this.activeSessions.values()) {
      uniqueUsers.add(session.userId);
      if (session.expiresAt < now) {
        expiredSessions++;
      }
    }

    return {
      totalActiveSessions: this.activeSessions.size,
      uniqueUsers: uniqueUsers.size,
      expiredSessions,
      blacklistedTokens: this.blacklistedTokens.size,
      securityEvents: this.securityEvents.length,
    };
  }

  /**
   * Force password change for user
   */
  async forcePasswordChange(userId: string, reason: string): Promise<void> {
    // Invalidate all sessions
    await this.invalidateAllUserSessions(userId, 'password_change_required');

    // Log security event
    this.logSecurityEvent({
      type: 'password_change',
      userId,
      timestamp: new Date(),
      metadata: { reason, forced: true },
    });
  }

  /**
   * Lock user account
   */
  async lockUserAccount(userId: string, reason: string, duration: number = 30 * 60 * 1000): Promise<void> {
    // Invalidate all sessions
    await this.invalidateAllUserSessions(userId, 'account_locked');

    // Log security event
    this.logSecurityEvent({
      type: 'account_locked',
      userId,
      timestamp: new Date(),
      metadata: { reason, duration },
    });
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();

// Auto-cleanup expired sessions every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(async () => {
    try {
      const cleaned = await sessionManager.cleanupExpiredSessions();
      if (cleaned > 0) {
        console.log(`Cleaned up ${cleaned} expired sessions`);
      }
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
    }
  }, 5 * 60 * 1000);
}