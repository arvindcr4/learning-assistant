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
    const randomBytes = crypto.getRandomValues(new Uint8Array(32)); // Increased entropy
    const randomString = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
    
    // Create token payload
    const payload = JSON.stringify({
      sessionId: sessionId || 'anonymous',
      timestamp,
      random: randomString,
    });

    // Use HMAC for proper signing instead of simple base64
    const hmac = crypto.createHmac('sha256', this.secret);
    hmac.update(payload);
    const signature = hmac.digest('hex');
    
    const signedToken = btoa(JSON.stringify({
      payload: btoa(payload),
      signature
    }));
    
    // Cache the token
    if (sessionId) {
      this.tokenCache.set(sessionId, {
        token: signedToken,
        expires: timestamp + this.tokenExpiry,
      });
    }

    return signedToken;
  }

  /**
   * Validate a CSRF token
   */
  validateToken(token: string, sessionId?: string): boolean {
    try {
      // Decode the signed token
      const signedData = JSON.parse(atob(token));
      const { payload: encodedPayload, signature } = signedData;
      
      // Verify HMAC signature
      const payloadData = atob(encodedPayload);
      const hmac = crypto.createHmac('sha256', this.secret);
      hmac.update(payloadData);
      const expectedSignature = hmac.digest('hex');
      
      // Constant-time comparison to prevent timing attacks
      if (!this.constantTimeCompare(signature, expectedSignature)) {
        return false;
      }
      
      // Parse the payload
      const payload = JSON.parse(payloadData);
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
   * Constant-time string comparison to prevent timing attacks
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
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