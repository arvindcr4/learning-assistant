import jwt from 'jsonwebtoken';

import { env } from './env-validation';

export interface JWTPayload {
  userId: string;
  email: string;
  name?: string;
  role: string;
  sessionId?: string;
  iat?: number;
  exp?: number;
  aud?: string;
  iss?: string;
}

export interface RefreshTokenPayload {
  userId: string;
  email: string;
  tokenId: string;
  iat?: number;
  exp?: number;
}

export class JWTService {
  private readonly jwtSecret: string;
  private readonly refreshSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly refreshExpiresIn: string;
  private readonly issuer: string;
  private readonly audience: string;

  constructor() {
    this.jwtSecret = env.JWT_SECRET || env.BETTER_AUTH_SECRET;
    this.refreshSecret = env.JWT_REFRESH_SECRET || env.BETTER_AUTH_SECRET;
    this.jwtExpiresIn = env.JWT_EXPIRES_IN;
    this.refreshExpiresIn = env.JWT_REFRESH_EXPIRES_IN;
    this.issuer = env.NEXT_PUBLIC_APP_URL || 'learning-assistant';
    this.audience = env.NEXT_PUBLIC_APP_URL || 'learning-assistant';
  }

  /**
   * Generate an access token
   */
  generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'aud' | 'iss'>): string {
    try {
      return jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.jwtExpiresIn,
        issuer: this.issuer,
        audience: this.audience,
        algorithm: 'HS256',
      });
    } catch (error) {
      throw new Error('Failed to generate access token');
    }
  }

  /**
   * Generate a refresh token
   */
  generateRefreshToken(payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>): string {
    try {
      return jwt.sign(payload, this.refreshSecret, {
        expiresIn: this.refreshExpiresIn,
        issuer: this.issuer,
        audience: this.audience,
        algorithm: 'HS256',
      });
    } catch (error) {
      throw new Error('Failed to generate refresh token');
    }
  }

  /**
   * Verify and decode an access token
   */
  verifyAccessToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['HS256'],
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }

  /**
   * Verify and decode a refresh token
   */
  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = jwt.verify(token, this.refreshSecret, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['HS256'],
      }) as RefreshTokenPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      } else {
        throw new Error('Refresh token verification failed');
      }
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded || !decoded.exp) return true;
      
      const now = Math.floor(Date.now() / 1000);
      return decoded.exp < now;
    } catch (error) {
      return true;
    }
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token: string): Date | null {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded || !decoded.exp) return null;
      
      return new Date(decoded.exp * 1000);
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate token pair (access + refresh)
   */
  generateTokenPair(payload: {
    userId: string;
    email: string;
    name?: string;
    role: string;
    sessionId?: string;
  }): { accessToken: string; refreshToken: string } {
    const tokenId = crypto.randomUUID();
    
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken({
      userId: payload.userId,
      email: payload.email,
      tokenId,
    });

    return { accessToken, refreshToken };
  }

  /**
   * Refresh access token using refresh token
   */
  refreshAccessToken(refreshToken: string): { accessToken: string; refreshToken: string } {
    try {
      const decoded = this.verifyRefreshToken(refreshToken);
      
      // Generate new token pair
      const newTokenPair = this.generateTokenPair({
        userId: decoded.userId,
        email: decoded.email,
        role: 'user', // Default role, should be fetched from database
      });

      return newTokenPair;
    } catch (error) {
      throw new Error('Failed to refresh token');
    }
  }
}

// Export singleton instance
export const jwtService = new JWTService();

// Export utility functions
export const {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  isTokenExpired,
  getTokenExpiration,
  generateTokenPair,
  refreshAccessToken,
} = jwtService;