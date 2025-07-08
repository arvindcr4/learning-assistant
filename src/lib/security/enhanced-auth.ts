import { NextRequest, NextResponse } from 'next/server';
import { jwtService, JWTPayload } from '@/lib/jwt';
import { sessionManager } from '@/lib/session-manager';
import { auth } from '@/lib/auth';
import { defaultSecurityValidator } from '@/lib/validation/security-validation';
import { defaultRateLimiter } from '@/lib/security/advanced-rate-limiting';

// Enhanced authentication configuration
export interface AuthConfig {
  requireMFA: boolean;
  allowApiKeys: boolean;
  sessionTimeout: number;
  maxConcurrentSessions: number;
  requireStrongPasswords: boolean;
  enforcePasswordExpiry: boolean;
  logSecurityEvents: boolean;
  enableBehaviorAnalysis: boolean;
  enableGeoValidation: boolean;
  allowedDeviceTypes: string[];
  maxFailedAttempts: number;
  lockoutDuration: number;
}

// Permission system
export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface Role {
  name: string;
  permissions: Permission[];
  inherits?: string[];
  isSystemRole: boolean;
}

// Security context
export interface SecurityContext {
  userId: string;
  sessionId: string;
  roles: string[];
  permissions: Permission[];
  ipAddress: string;
  userAgent: string;
  deviceFingerprint: string;
  isNewLocation: boolean;
  lastActivity: Date;
  riskScore: number;
  mfaVerified: boolean;
  sessionMetadata: Record<string, any>;
}

// Authentication result
export interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name?: string;
    roles: string[];
    permissions: Permission[];
  };
  securityContext?: SecurityContext;
  error?: string;
  errorCode?: string;
  requiresMFA?: boolean;
  requiresPasswordChange?: boolean;
  warningMessage?: string;
}

// Audit log entry
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  action: string;
  resource: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  riskScore: number;
  metadata: Record<string, any>;
}

// Default system roles
const SYSTEM_ROLES: Role[] = [
  {
    name: 'guest',
    permissions: [
      { resource: 'public', action: 'read' },
      { resource: 'auth', action: 'login' },
      { resource: 'auth', action: 'register' },
    ],
    isSystemRole: true,
  },
  {
    name: 'user',
    permissions: [
      { resource: 'profile', action: 'read' },
      { resource: 'profile', action: 'update' },
      { resource: 'learning', action: 'read' },
      { resource: 'learning', action: 'create' },
      { resource: 'learning', action: 'update' },
      { resource: 'sessions', action: 'read' },
      { resource: 'sessions', action: 'create' },
      { resource: 'progress', action: 'read' },
      { resource: 'progress', action: 'update' },
    ],
    inherits: ['guest'],
    isSystemRole: true,
  },
  {
    name: 'premium_user',
    permissions: [
      { resource: 'analytics', action: 'read' },
      { resource: 'export', action: 'create' },
      { resource: 'advanced_features', action: 'access' },
    ],
    inherits: ['user'],
    isSystemRole: true,
  },
  {
    name: 'moderator',
    permissions: [
      { resource: 'content', action: 'moderate' },
      { resource: 'reports', action: 'read' },
      { resource: 'reports', action: 'update' },
      { resource: 'users', action: 'read' },
    ],
    inherits: ['premium_user'],
    isSystemRole: true,
  },
  {
    name: 'admin',
    permissions: [
      { resource: '*', action: '*' }, // Full access
    ],
    inherits: ['moderator'],
    isSystemRole: true,
  },
];

export class EnhancedAuthenticationService {
  private config: AuthConfig;
  private roles: Map<string, Role>;
  private auditLog: AuditLogEntry[];
  private failedAttempts: Map<string, { count: number; lastAttempt: Date; lockedUntil?: Date }>;
  private activeSessions: Map<string, SecurityContext>;
  private deviceFingerprints: Map<string, { userId: string; trusted: boolean; lastSeen: Date }>;

  constructor(config: Partial<AuthConfig> = {}) {
    this.config = {
      requireMFA: false,
      allowApiKeys: true,
      sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
      maxConcurrentSessions: 5,
      requireStrongPasswords: true,
      enforcePasswordExpiry: false,
      logSecurityEvents: true,
      enableBehaviorAnalysis: true,
      enableGeoValidation: true,
      allowedDeviceTypes: ['web', 'mobile', 'desktop'],
      maxFailedAttempts: 5,
      lockoutDuration: 30 * 60 * 1000, // 30 minutes
      ...config,
    };

    this.roles = new Map();
    this.auditLog = [];
    this.failedAttempts = new Map();
    this.activeSessions = new Map();
    this.deviceFingerprints = new Map();

    // Initialize system roles
    SYSTEM_ROLES.forEach(role => {
      this.roles.set(role.name, role);
    });
  }

  /**
   * Enhanced authentication middleware
   */
  public createAuthMiddleware(
    requiredPermissions: Permission[] = [],
    options: {
      allowGuests?: boolean;
      requireMFA?: boolean;
      maxRiskScore?: number;
      requireTrustedDevice?: boolean;
    } = {}
  ) {
    return async (request: NextRequest): Promise<NextResponse | null> => {
      try {
        const startTime = Date.now();
        const ipAddress = this.getClientIP(request);
        const userAgent = request.headers.get('user-agent') || 'unknown';

        // Input validation for request headers
        const headerValidation = defaultSecurityValidator.validateHeaders(request);
        if (!headerValidation.isValid) {
          this.logSecurityEvent('HEADER_VALIDATION_FAILED', request, {
            errors: headerValidation.errors,
            threats: headerValidation.threats,
          });
          
          return NextResponse.json(
            {
              error: 'Invalid request headers',
              code: 'INVALID_HEADERS',
              details: headerValidation.errors,
            },
            { status: 400 }
          );
        }

        // Check account lockout
        const lockoutCheck = this.checkAccountLockout(ipAddress);
        if (lockoutCheck) {
          return lockoutCheck;
        }

        // Extract and validate authentication
        const authResult = await this.authenticateRequest(request);
        
        if (!authResult.success) {
          // Log failed authentication attempt
          this.recordFailedAttempt(ipAddress);
          this.logSecurityEvent('AUTH_FAILED', request, {
            error: authResult.error,
            errorCode: authResult.errorCode,
          });

          // Handle specific authentication failures
          if (authResult.requiresMFA) {
            return NextResponse.json(
              {
                error: 'MFA verification required',
                code: 'MFA_REQUIRED',
                redirectUrl: '/auth/mfa',
              },
              { status: 401 }
            );
          }

          if (authResult.requiresPasswordChange) {
            return NextResponse.json(
              {
                error: 'Password change required',
                code: 'PASSWORD_CHANGE_REQUIRED',
                redirectUrl: '/auth/change-password',
              },
              { status: 401 }
            );
          }

          return NextResponse.json(
            {
              error: authResult.error || 'Authentication failed',
              code: authResult.errorCode || 'AUTH_FAILED',
            },
            { status: 401 }
          );
        }

        // Clear failed attempts on successful authentication
        this.clearFailedAttempts(ipAddress);

        const { user, securityContext } = authResult;

        // Check permissions
        if (requiredPermissions.length > 0) {
          const hasPermission = this.checkPermissions(user!.permissions, requiredPermissions);
          if (!hasPermission) {
            this.logSecurityEvent('PERMISSION_DENIED', request, {
              userId: user!.id,
              requiredPermissions,
              userPermissions: user!.permissions,
            });

            return NextResponse.json(
              {
                error: 'Insufficient permissions',
                code: 'PERMISSION_DENIED',
                required: requiredPermissions,
              },
              { status: 403 }
            );
          }
        }

        // Additional security checks
        if (options.requireMFA && !securityContext!.mfaVerified) {
          return NextResponse.json(
            {
              error: 'MFA verification required for this action',
              code: 'MFA_REQUIRED',
              redirectUrl: '/auth/mfa/verify',
            },
            { status: 401 }
          );
        }

        if (options.maxRiskScore && securityContext!.riskScore > options.maxRiskScore) {
          this.logSecurityEvent('HIGH_RISK_ACCESS_DENIED', request, {
            userId: user!.id,
            riskScore: securityContext!.riskScore,
            maxAllowed: options.maxRiskScore,
          });

          return NextResponse.json(
            {
              error: 'Access denied due to high risk score',
              code: 'HIGH_RISK_DENIED',
              riskScore: securityContext!.riskScore,
            },
            { status: 403 }
          );
        }

        if (options.requireTrustedDevice) {
          const deviceTrust = this.checkDeviceTrust(securityContext!.deviceFingerprint, user!.id);
          if (!deviceTrust.trusted) {
            return NextResponse.json(
              {
                error: 'Trusted device required for this action',
                code: 'UNTRUSTED_DEVICE',
                deviceVerificationUrl: '/auth/device/verify',
              },
              { status: 401 }
            );
          }
        }

        // Update session activity
        this.updateSessionActivity(securityContext!);

        // Log successful access
        this.logSecurityEvent('ACCESS_GRANTED', request, {
          userId: user!.id,
          permissions: requiredPermissions,
          riskScore: securityContext!.riskScore,
          duration: Date.now() - startTime,
        });

        // Add security context to request
        (request as any).user = user;
        (request as any).securityContext = securityContext;

        return null; // Continue to handler
      } catch (error) {
        console.error('Enhanced auth middleware error:', error);
        this.logSecurityEvent('AUTH_MIDDLEWARE_ERROR', request, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        return NextResponse.json(
          {
            error: 'Authentication service error',
            code: 'AUTH_SERVICE_ERROR',
          },
          { status: 500 }
        );
      }
    };
  }

  /**
   * Authenticate request
   */
  private async authenticateRequest(request: NextRequest): Promise<AuthResult> {
    try {
      // Extract token
      const token = this.extractToken(request);
      if (!token) {
        return {
          success: false,
          error: 'No authentication token provided',
          errorCode: 'NO_TOKEN',
        };
      }

      // Validate token format and basic security
      const tokenValidation = defaultSecurityValidator.validateInput(token, 'string');
      if (!tokenValidation.isValid) {
        return {
          success: false,
          error: 'Invalid token format',
          errorCode: 'INVALID_TOKEN_FORMAT',
        };
      }

      // Check if token is blacklisted
      if (await sessionManager.isTokenBlacklisted(token)) {
        return {
          success: false,
          error: 'Token has been revoked',
          errorCode: 'TOKEN_REVOKED',
        };
      }

      // Verify JWT token
      let payload: JWTPayload;
      try {
        payload = jwtService.verifyAccessToken(token);
      } catch (error) {
        return {
          success: false,
          error: 'Invalid or expired token',
          errorCode: 'TOKEN_INVALID',
        };
      }

      // Validate session
      if (payload.sessionId) {
        const session = await sessionManager.validateSession(payload.sessionId);
        if (!session) {
          await sessionManager.blacklistToken(token);
          return {
            success: false,
            error: 'Session expired or invalid',
            errorCode: 'SESSION_INVALID',
          };
        }

        // Ensure session belongs to the token user
        if (session.userId !== payload.userId) {
          await sessionManager.blacklistToken(token);
          return {
            success: false,
            error: 'Session mismatch detected',
            errorCode: 'SESSION_MISMATCH',
          };
        }
      }

      // Get user from better-auth
      const user = await this.getUserById(payload.userId);
      if (!user) {
        await sessionManager.blacklistToken(token);
        return {
          success: false,
          error: 'User not found or inactive',
          errorCode: 'USER_NOT_FOUND',
        };
      }

      // Check if user account is locked or suspended
      if (user.status === 'suspended' || user.status === 'locked') {
        return {
          success: false,
          error: `Account is ${user.status}`,
          errorCode: `ACCOUNT_${user.status.toUpperCase()}`,
        };
      }

      // Build security context
      const securityContext = await this.buildSecurityContext(request, user, payload);

      // Check for suspicious activity
      const suspiciousActivity = await this.detectSuspiciousActivity(securityContext);
      if (suspiciousActivity.isBlocked) {
        return {
          success: false,
          error: suspiciousActivity.reason,
          errorCode: 'SUSPICIOUS_ACTIVITY',
        };
      }

      // Check MFA requirements
      if (this.requiresMFA(user, securityContext)) {
        if (!securityContext.mfaVerified) {
          return {
            success: false,
            error: 'MFA verification required',
            errorCode: 'MFA_REQUIRED',
            requiresMFA: true,
          };
        }
      }

      // Check password expiry
      if (this.config.enforcePasswordExpiry && user.passwordExpiredAt && user.passwordExpiredAt < new Date()) {
        return {
          success: false,
          error: 'Password has expired',
          errorCode: 'PASSWORD_EXPIRED',
          requiresPasswordChange: true,
        };
      }

      // Get user roles and permissions
      const userRoles = user.roles || ['user'];
      const permissions = this.getUserPermissions(userRoles);

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: userRoles,
          permissions,
        },
        securityContext,
        warningMessage: suspiciousActivity.warning,
      };
    } catch (error) {
      console.error('Authentication error:', error);
      return {
        success: false,
        error: 'Authentication service error',
        errorCode: 'AUTH_SERVICE_ERROR',
      };
    }
  }

  /**
   * Build security context
   */
  private async buildSecurityContext(
    request: NextRequest,
    user: any,
    payload: JWTPayload
  ): Promise<SecurityContext> {
    const ipAddress = this.getClientIP(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const deviceFingerprint = this.generateDeviceFingerprint(request);

    // Check if this is a new location
    const isNewLocation = await this.isNewLocation(user.id, ipAddress);

    // Calculate risk score
    const riskScore = await this.calculateRiskScore(request, user, {
      isNewLocation,
      deviceFingerprint,
    });

    return {
      userId: user.id,
      sessionId: payload.sessionId || '',
      roles: user.roles || ['user'],
      permissions: this.getUserPermissions(user.roles || ['user']),
      ipAddress,
      userAgent,
      deviceFingerprint,
      isNewLocation,
      lastActivity: new Date(),
      riskScore,
      mfaVerified: payload.mfaVerified || false,
      sessionMetadata: {
        loginTime: payload.iat ? new Date(payload.iat * 1000) : new Date(),
        deviceType: this.detectDeviceType(userAgent),
        browserInfo: this.extractBrowserInfo(userAgent),
      },
    };
  }

  /**
   * Check permissions
   */
  private checkPermissions(userPermissions: Permission[], requiredPermissions: Permission[]): boolean {
    for (const required of requiredPermissions) {
      const hasPermission = userPermissions.some(perm => {
        // Wildcard permissions
        if (perm.resource === '*' && perm.action === '*') {
          return true;
        }

        // Exact match
        if (perm.resource === required.resource && perm.action === required.action) {
          return true;
        }

        // Resource wildcard
        if (perm.resource === '*' && perm.action === required.action) {
          return true;
        }

        // Action wildcard
        if (perm.resource === required.resource && perm.action === '*') {
          return true;
        }

        return false;
      });

      if (!hasPermission) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get user permissions from roles
   */
  private getUserPermissions(userRoles: string[]): Permission[] {
    const permissions: Permission[] = [];
    const processedRoles = new Set<string>();

    const processRole = (roleName: string) => {
      if (processedRoles.has(roleName)) {
        return; // Avoid circular dependencies
      }

      processedRoles.add(roleName);
      const role = this.roles.get(roleName);
      
      if (role) {
        // Add role permissions
        permissions.push(...role.permissions);

        // Process inherited roles
        if (role.inherits) {
          for (const inheritedRole of role.inherits) {
            processRole(inheritedRole);
          }
        }
      }
    };

    // Process all user roles
    for (const roleName of userRoles) {
      processRole(roleName);
    }

    // Remove duplicates
    const uniquePermissions: Permission[] = [];
    const permissionKeys = new Set<string>();

    for (const permission of permissions) {
      const key = `${permission.resource}:${permission.action}`;
      if (!permissionKeys.has(key)) {
        permissionKeys.add(key);
        uniquePermissions.push(permission);
      }
    }

    return uniquePermissions;
  }

  /**
   * Calculate risk score
   */
  private async calculateRiskScore(
    request: NextRequest,
    user: any,
    context: {
      isNewLocation: boolean;
      deviceFingerprint: string;
    }
  ): Promise<number> {
    let riskScore = 0;

    // New location adds risk
    if (context.isNewLocation) {
      riskScore += 30;
    }

    // Check device trust
    const deviceTrust = this.checkDeviceTrust(context.deviceFingerprint, user.id);
    if (!deviceTrust.trusted) {
      riskScore += 25;
    }

    // Time-based risk (unusual hours)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      riskScore += 10;
    }

    // Request frequency risk
    const recentActivity = await this.getRecentUserActivity(user.id);
    if (recentActivity.requestCount > 100) {
      riskScore += 15;
    }

    // User agent analysis
    const userAgent = request.headers.get('user-agent') || '';
    if (this.isSuspiciousUserAgent(userAgent)) {
      riskScore += 20;
    }

    // Account age (new accounts are riskier)
    const accountAge = Date.now() - new Date(user.createdAt).getTime();
    const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);
    if (daysSinceCreation < 7) {
      riskScore += 15;
    }

    return Math.min(100, Math.max(0, riskScore));
  }

  /**
   * Detect suspicious activity
   */
  private async detectSuspiciousActivity(
    context: SecurityContext
  ): Promise<{ isBlocked: boolean; reason?: string; warning?: string }> {
    // Check for concurrent session abuse
    const userSessions = Array.from(this.activeSessions.values()).filter(
      session => session.userId === context.userId
    );

    if (userSessions.length > this.config.maxConcurrentSessions) {
      return {
        isBlocked: true,
        reason: 'Too many concurrent sessions detected',
      };
    }

    // Check for rapid location changes
    const recentSessions = userSessions.filter(
      session => Date.now() - session.lastActivity.getTime() < 5 * 60 * 1000 // 5 minutes
    );

    const uniqueIPs = new Set(recentSessions.map(session => session.ipAddress));
    if (uniqueIPs.size > 3) {
      return {
        isBlocked: true,
        reason: 'Rapid location changes detected',
      };
    }

    // Check for unusual activity patterns
    const recentActivity = await this.getRecentUserActivity(context.userId);
    if (recentActivity.requestCount > 500) {
      return {
        isBlocked: true,
        reason: 'Excessive request volume detected',
      };
    }

    // Warning for elevated risk
    if (context.riskScore > 60) {
      return {
        isBlocked: false,
        warning: 'Elevated security risk detected for this session',
      };
    }

    return { isBlocked: false };
  }

  /**
   * Check account lockout
   */
  private checkAccountLockout(identifier: string): NextResponse | null {
    const attempts = this.failedAttempts.get(identifier);
    
    if (attempts && attempts.lockedUntil && attempts.lockedUntil > new Date()) {
      const remainingTime = Math.ceil((attempts.lockedUntil.getTime() - Date.now()) / 1000);
      
      return NextResponse.json(
        {
          error: 'Account temporarily locked due to multiple failed attempts',
          code: 'ACCOUNT_LOCKED',
          retryAfter: remainingTime,
          lockedUntil: attempts.lockedUntil.toISOString(),
        },
        { 
          status: 423,
          headers: {
            'Retry-After': remainingTime.toString(),
          },
        }
      );
    }

    return null;
  }

  /**
   * Record failed attempt
   */
  private recordFailedAttempt(identifier: string): void {
    const attempts = this.failedAttempts.get(identifier) || {
      count: 0,
      lastAttempt: new Date(),
    };

    attempts.count++;
    attempts.lastAttempt = new Date();

    if (attempts.count >= this.config.maxFailedAttempts) {
      attempts.lockedUntil = new Date(Date.now() + this.config.lockoutDuration);
    }

    this.failedAttempts.set(identifier, attempts);
  }

  /**
   * Clear failed attempts
   */
  private clearFailedAttempts(identifier: string): void {
    this.failedAttempts.delete(identifier);
  }

  /**
   * Extract authentication token
   */
  private extractToken(request: NextRequest): string | null {
    // Bearer token
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Cookie token
    const cookieToken = request.cookies.get('auth-token')?.value;
    if (cookieToken) {
      return cookieToken;
    }

    // API key
    if (this.config.allowApiKeys) {
      const apiKey = request.headers.get('x-api-key');
      if (apiKey) {
        return apiKey;
      }
    }

    return null;
  }

  /**
   * Get user by ID
   */
  private async getUserById(userId: string): Promise<any> {
    try {
      return await auth.api.getUser({ userId });
    } catch (error) {
      console.error('Failed to get user:', error);
      return null;
    }
  }

  /**
   * Check if MFA is required
   */
  private requiresMFA(user: any, context: SecurityContext): boolean {
    // Global MFA requirement
    if (this.config.requireMFA) {
      return true;
    }

    // High-risk sessions require MFA
    if (context.riskScore > 70) {
      return true;
    }

    // Admin users require MFA
    if (context.roles.includes('admin')) {
      return true;
    }

    // User has MFA enabled
    if (user.mfaEnabled) {
      return true;
    }

    return false;
  }

  /**
   * Update session activity
   */
  private updateSessionActivity(context: SecurityContext): void {
    context.lastActivity = new Date();
    this.activeSessions.set(context.sessionId, context);
  }

  /**
   * Log security events
   */
  private logSecurityEvent(
    action: string,
    request: NextRequest,
    metadata: Record<string, any> = {}
  ): void {
    if (!this.config.logSecurityEvents) {
      return;
    }

    const entry: AuditLogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      userId: (request as any).user?.id,
      sessionId: (request as any).securityContext?.sessionId,
      action,
      resource: request.nextUrl.pathname,
      ipAddress: this.getClientIP(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      success: !action.includes('FAILED') && !action.includes('DENIED'),
      riskScore: (request as any).securityContext?.riskScore || 0,
      metadata,
    };

    this.auditLog.push(entry);

    // Keep only recent entries (last 10000)
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-10000);
    }

    // Log to console for debugging
    console.log('Security Event:', {
      action: entry.action,
      resource: entry.resource,
      userId: entry.userId,
      success: entry.success,
      riskScore: entry.riskScore,
    });
  }

  /**
   * Utility methods
   */
  private getClientIP(request: NextRequest): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
           request.headers.get('x-real-ip') ||
           request.ip ||
           'unknown';
  }

  private generateDeviceFingerprint(request: NextRequest): string {
    const userAgent = request.headers.get('user-agent') || '';
    const acceptLanguage = request.headers.get('accept-language') || '';
    const acceptEncoding = request.headers.get('accept-encoding') || '';
    
    return Buffer.from(`${userAgent}:${acceptLanguage}:${acceptEncoding}`).toString('base64');
  }

  private detectDeviceType(userAgent: string): string {
    if (/Mobile|Android|iPhone|iPad/i.test(userAgent)) {
      return 'mobile';
    }
    if (/Electron/i.test(userAgent)) {
      return 'desktop';
    }
    return 'web';
  }

  private extractBrowserInfo(userAgent: string): Record<string, string> {
    const info: Record<string, string> = {};
    
    if (/Chrome/i.test(userAgent)) info.browser = 'Chrome';
    else if (/Firefox/i.test(userAgent)) info.browser = 'Firefox';
    else if (/Safari/i.test(userAgent)) info.browser = 'Safari';
    else if (/Edge/i.test(userAgent)) info.browser = 'Edge';
    else info.browser = 'Unknown';

    if (/Windows/i.test(userAgent)) info.os = 'Windows';
    else if (/Mac/i.test(userAgent)) info.os = 'macOS';
    else if (/Linux/i.test(userAgent)) info.os = 'Linux';
    else if (/Android/i.test(userAgent)) info.os = 'Android';
    else if (/iOS/i.test(userAgent)) info.os = 'iOS';
    else info.os = 'Unknown';

    return info;
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot|crawler|spider|scraper/i,
      /curl|wget|python|java|php/i,
      /postman|insomnia|fiddler/i,
      /^$/,
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  private async isNewLocation(userId: string, ipAddress: string): Promise<boolean> {
    // Simplified implementation - in production, use geolocation service
    const userSessions = Array.from(this.activeSessions.values()).filter(
      session => session.userId === userId
    );

    const recentIPs = userSessions
      .filter(session => Date.now() - session.lastActivity.getTime() < 7 * 24 * 60 * 60 * 1000) // 7 days
      .map(session => session.ipAddress);

    return !recentIPs.includes(ipAddress);
  }

  private checkDeviceTrust(fingerprint: string, userId: string): { trusted: boolean; firstSeen?: Date } {
    const device = this.deviceFingerprints.get(fingerprint);
    
    if (!device) {
      // New device
      this.deviceFingerprints.set(fingerprint, {
        userId,
        trusted: false,
        lastSeen: new Date(),
      });
      
      return { trusted: false, firstSeen: new Date() };
    }

    if (device.userId !== userId) {
      // Device used by different user
      return { trusted: false };
    }

    // Update last seen
    device.lastSeen = new Date();
    this.deviceFingerprints.set(fingerprint, device);

    return { trusted: device.trusted };
  }

  private async getRecentUserActivity(userId: string): Promise<{
    requestCount: number;
    lastActivity: Date;
    distinctEndpoints: number;
  }> {
    // Filter audit log for recent user activity
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentEvents = this.auditLog.filter(
      entry => entry.userId === userId && entry.timestamp > oneHourAgo
    );

    const distinctEndpoints = new Set(recentEvents.map(entry => entry.resource));

    return {
      requestCount: recentEvents.length,
      lastActivity: recentEvents.length > 0 
        ? recentEvents[recentEvents.length - 1].timestamp 
        : new Date(0),
      distinctEndpoints: distinctEndpoints.size,
    };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Public API methods
   */
  
  public addRole(role: Role): void {
    this.roles.set(role.name, role);
  }

  public removeRole(roleName: string): boolean {
    const role = this.roles.get(roleName);
    if (role && !role.isSystemRole) {
      return this.roles.delete(roleName);
    }
    return false;
  }

  public trustDevice(fingerprint: string, userId: string): void {
    const device = this.deviceFingerprints.get(fingerprint);
    if (device && device.userId === userId) {
      device.trusted = true;
      this.deviceFingerprints.set(fingerprint, device);
    }
  }

  public getAuditLog(filters: {
    userId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}): AuditLogEntry[] {
    let filtered = this.auditLog;

    if (filters.userId) {
      filtered = filtered.filter(entry => entry.userId === filters.userId);
    }

    if (filters.action) {
      filtered = filtered.filter(entry => entry.action === filters.action);
    }

    if (filters.startDate) {
      filtered = filtered.filter(entry => entry.timestamp >= filters.startDate!);
    }

    if (filters.endDate) {
      filtered = filtered.filter(entry => entry.timestamp <= filters.endDate!);
    }

    if (filters.limit) {
      filtered = filtered.slice(-filters.limit);
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public getSecurityMetrics(): {
    totalSessions: number;
    failedAttempts: number;
    suspiciousActivity: number;
    trustedDevices: number;
    recentAlerts: number;
  } {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentEvents = this.auditLog.filter(entry => entry.timestamp > oneHourAgo);

    return {
      totalSessions: this.activeSessions.size,
      failedAttempts: Array.from(this.failedAttempts.values()).reduce((sum, attempts) => sum + attempts.count, 0),
      suspiciousActivity: recentEvents.filter(entry => entry.riskScore > 60).length,
      trustedDevices: Array.from(this.deviceFingerprints.values()).filter(device => device.trusted).length,
      recentAlerts: recentEvents.filter(entry => !entry.success).length,
    };
  }
}

// Export default instance
export const enhancedAuth = new EnhancedAuthenticationService();