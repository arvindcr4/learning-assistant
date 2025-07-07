import { env } from './env-validation';

export class CSRFProtection {
  private readonly secret: string;
  private readonly tokenExpiry: number = 1 * 60 * 60 * 1000; // 1 hour
  private readonly tokenCache: Map<string, { token: string; expires: number }> = new Map();

  constructor() {
    this.secret = env.CSRF_SECRET || env.BETTER_AUTH_SECRET;
  }

  /**
   * Generate a CSRF token for a session
   */
  generateToken(sessionId?: string): string {
    const timestamp = Date.now();
    const randomBytes = crypto.getRandomValues(new Uint8Array(16));
    const randomString = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
    
    // Create token payload
    const payload = JSON.stringify({
      sessionId: sessionId || 'anonymous',
      timestamp,
      random: randomString,
    });

    // Simple encoding (in production, use proper HMAC signing)
    const token = btoa(payload);
    
    // Cache the token
    if (sessionId) {
      this.tokenCache.set(sessionId, {
        token,
        expires: timestamp + this.tokenExpiry,
      });
    }

    return token;
  }

  /**
   * Validate a CSRF token
   */
  validateToken(token: string, sessionId?: string): boolean {
    try {
      // Decode token
      const payload = JSON.parse(atob(token));
      const { sessionId: tokenSessionId, timestamp, random } = payload;

      // Check if token is expired
      if (Date.now() - timestamp > this.tokenExpiry) {
        return false;
      }

      // Validate session match
      if (sessionId && tokenSessionId !== sessionId) {
        return false;
      }

      // Check cached token if we have a session
      if (sessionId) {
        const cached = this.tokenCache.get(sessionId);
        if (!cached || cached.token !== token) {
          return false;
        }

        // Clean up expired token
        if (Date.now() > cached.expires) {
          this.tokenCache.delete(sessionId);
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Invalidate CSRF token for a session
   */
  invalidateToken(sessionId: string): void {
    this.tokenCache.delete(sessionId);
  }

  /**
   * Clean up expired tokens
   */
  cleanupExpiredTokens(): void {
    const now = Date.now();
    for (const [sessionId, cached] of this.tokenCache.entries()) {
      if (now > cached.expires) {
        this.tokenCache.delete(sessionId);
      }
    }
  }

  /**
   * Get CSRF token from request headers
   */
  getTokenFromRequest(request: Request): string | null {
    // Try X-CSRF-Token header first
    let token = request.headers.get('X-CSRF-Token');
    
    // Try X-Requested-With header
    if (!token) {
      token = request.headers.get('X-Requested-With');
      if (token !== 'XMLHttpRequest') {
        token = null;
      }
    }

    return token;
  }

  /**
   * Check if request needs CSRF protection
   */
  needsCSRFProtection(method: string, path: string): boolean {
    // Only protect state-changing methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return false;
    }

    // Skip CSRF for certain API endpoints
    const skipPaths = [
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/refresh',
      '/api/auth/reset-password',
      '/api/webhook',
    ];

    return !skipPaths.some(skipPath => path.startsWith(skipPath));
  }

  /**
   * Generate anti-CSRF headers
   */
  getCSRFHeaders(token: string): Record<string, string> {
    return {
      'X-CSRF-Token': token,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    };
  }
}

// Export singleton instance
export const csrfProtection = new CSRFProtection();

// Auto-cleanup expired tokens every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    try {
      csrfProtection.cleanupExpiredTokens();
    } catch (error) {
      console.error('Error cleaning up CSRF tokens:', error);
    }
  }, 10 * 60 * 1000);
}