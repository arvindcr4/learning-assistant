import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export interface RateLimitConfig {
  // Basic rate limiting
  windowMs: number;
  maxRequests: number;
  
  // Advanced options
  keyGenerator?: (request: NextRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  
  // Endpoint-specific limits
  endpointLimits?: Map<string, {
    windowMs: number;
    maxRequests: number;
    burstLimit?: number;
    userMultiplier?: number;
  }>;
  
  // User-based limits
  userLimits?: {
    authenticated: { windowMs: number; maxRequests: number };
    anonymous: { windowMs: number; maxRequests: number };
    premium: { windowMs: number; maxRequests: number };
  };
  
  // Response options
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  message?: string;
  onLimitReached?: (request: NextRequest, identifier: string) => void;
  
  // Advanced features
  dynamicLimits?: boolean;
  adaptiveLimiting?: boolean;
  burstProtection?: boolean;
  distributeRequests?: boolean;
}

export interface RateLimitInfo {
  identifier: string;
  endpoint: string;
  windowStart: number;
  requests: number;
  resetTime: number;
  blocked: boolean;
  burstRequests?: number;
  lastRequestTime?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  headers: Record<string, string>;
}

export class AdvancedRateLimiter {
  private store: Map<string, RateLimitInfo> = new Map();
  private endpointPatterns: Map<RegExp, RateLimitConfig> = new Map();
  private globalConfig: RateLimitConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: RateLimitConfig) {
    this.globalConfig = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: 'Too many requests, please try again later.',
      dynamicLimits: true,
      adaptiveLimiting: true,
      burstProtection: true,
      distributeRequests: false,
      ...config,
    };

    this.setupEndpointLimits();
    this.startCleanupProcess();
  }

  /**
   * Setup endpoint-specific rate limits
   */
  private setupEndpointLimits(): void {
    const endpointConfigs = [
      // Authentication endpoints - stricter limits
      {
        pattern: /^\/api\/auth\/(login|register)$/,
        config: {
          windowMs: 15 * 60 * 1000, // 15 minutes
          maxRequests: 5,
          burstLimit: 2,
          userMultiplier: 1,
        },
      },
      {
        pattern: /^\/api\/auth\/reset-password$/,
        config: {
          windowMs: 60 * 60 * 1000, // 1 hour
          maxRequests: 3,
          burstLimit: 1,
          userMultiplier: 1,
        },
      },
      
      // Chat endpoints - moderate limits
      {
        pattern: /^\/api\/chat/,
        config: {
          windowMs: 1 * 60 * 1000, // 1 minute
          maxRequests: 20,
          burstLimit: 5,
          userMultiplier: 2, // Authenticated users get 2x limit
        },
      },
      
      // Assessment endpoints
      {
        pattern: /^\/api\/learning\/assessment/,
        config: {
          windowMs: 5 * 60 * 1000, // 5 minutes
          maxRequests: 10,
          burstLimit: 3,
          userMultiplier: 1.5,
        },
      },
      
      // Learning session endpoints
      {
        pattern: /^\/api\/learning\/session/,
        config: {
          windowMs: 1 * 60 * 1000, // 1 minute
          maxRequests: 30,
          burstLimit: 10,
          userMultiplier: 2,
        },
      },
      
      // File upload endpoints - very strict
      {
        pattern: /^\/api\/.*\/upload$/,
        config: {
          windowMs: 5 * 60 * 1000, // 5 minutes
          maxRequests: 5,
          burstLimit: 2,
          userMultiplier: 1,
        },
      },
      
      // Search endpoints
      {
        pattern: /^\/api\/search/,
        config: {
          windowMs: 1 * 60 * 1000, // 1 minute
          maxRequests: 50,
          burstLimit: 15,
          userMultiplier: 1.5,
        },
      },
      
      // Analytics endpoints
      {
        pattern: /^\/api\/analytics/,
        config: {
          windowMs: 5 * 60 * 1000, // 5 minutes
          maxRequests: 100,
          burstLimit: 20,
          userMultiplier: 3,
        },
      },
      
      // Health check - unlimited
      {
        pattern: /^\/api\/health$/,
        config: {
          windowMs: 1000,
          maxRequests: 1000,
          burstLimit: 100,
          userMultiplier: 1,
        },
      },
    ];

    endpointConfigs.forEach(({ pattern, config }) => {
      this.endpointPatterns.set(pattern, {
        ...this.globalConfig,
        ...config,
      });
    });
  }

  /**
   * Check rate limit for request
   */
  async checkLimit(
    request: NextRequest,
    userId?: string,
    userRole?: string
  ): Promise<RateLimitResult> {
    const endpoint = this.extractEndpoint(request);
    const config = this.getEndpointConfig(endpoint);
    const identifier = this.generateIdentifier(request, userId, config);
    
    const now = Date.now();
    const windowStart = this.getWindowStart(now, config.windowMs);
    const key = `${identifier}:${endpoint}:${windowStart}`;
    
    let info = this.store.get(key);
    if (!info) {
      info = {
        identifier,
        endpoint,
        windowStart,
        requests: 0,
        resetTime: windowStart + config.windowMs,
        blocked: false,
        burstRequests: 0,
        lastRequestTime: now,
      };
    }

    // Apply user role multipliers
    const effectiveLimit = this.calculateEffectiveLimit(config, userRole, userId);
    
    // Check burst protection
    if (config.burstProtection && this.isBurstViolation(info, config, now)) {
      return this.createLimitExceededResult(info, effectiveLimit, config);
    }

    // Check adaptive limiting
    if (config.adaptiveLimiting) {
      const adaptiveLimit = this.calculateAdaptiveLimit(info, effectiveLimit, endpoint);
      if (info.requests >= adaptiveLimit) {
        return this.createLimitExceededResult(info, adaptiveLimit, config);
      }
    }

    // Check regular limit
    if (info.requests >= effectiveLimit) {
      info.blocked = true;
      this.store.set(key, info);
      
      // Trigger callback if configured
      if (config.onLimitReached) {
        config.onLimitReached(request, identifier);
      }
      
      return this.createLimitExceededResult(info, effectiveLimit, config);
    }

    // Increment counters
    info.requests++;
    if (config.burstProtection) {
      this.updateBurstCounter(info, now);
    }
    info.lastRequestTime = now;
    
    this.store.set(key, info);

    return {
      allowed: true,
      limit: effectiveLimit,
      remaining: Math.max(0, effectiveLimit - info.requests),
      resetTime: info.resetTime,
      headers: this.generateHeaders(info, effectiveLimit, config),
    };
  }

  /**
   * Get endpoint configuration
   */
  private getEndpointConfig(endpoint: string): RateLimitConfig {
    for (const [pattern, config] of this.endpointPatterns.entries()) {
      if (pattern.test(endpoint)) {
        return config;
      }
    }
    return this.globalConfig;
  }

  /**
   * Generate unique identifier for rate limiting
   */
  private generateIdentifier(
    request: NextRequest,
    userId?: string,
    config?: RateLimitConfig
  ): string {
    if (config?.keyGenerator) {
      return config.keyGenerator(request);
    }

    // Prefer user ID for authenticated requests
    if (userId) {
      return `user:${userId}`;
    }

    // Fall back to IP address
    const ip = this.extractIpAddress(request);
    return `ip:${ip}`;
  }

  /**
   * Calculate effective limit based on user role and type
   */
  private calculateEffectiveLimit(
    config: RateLimitConfig,
    userRole?: string,
    userId?: string
  ): number {
    let baseLimit = config.maxRequests;
    
    // Apply user type multipliers
    if (userId && config.userLimits) {
      if (userRole === 'premium' && config.userLimits.premium) {
        baseLimit = config.userLimits.premium.maxRequests;
      } else if (config.userLimits.authenticated) {
        baseLimit = config.userLimits.authenticated.maxRequests;
      }
    } else if (!userId && config.userLimits?.anonymous) {
      baseLimit = config.userLimits.anonymous.maxRequests;
    }

    // Apply endpoint-specific user multiplier
    const endpointConfig = config.endpointLimits?.get('current');
    if (endpointConfig?.userMultiplier && userId) {
      baseLimit = Math.floor(baseLimit * endpointConfig.userMultiplier);
    }

    return baseLimit;
  }

  /**
   * Check for burst violations
   */
  private isBurstViolation(
    info: RateLimitInfo,
    config: RateLimitConfig,
    now: number
  ): boolean {
    if (!config.burstProtection) return false;
    
    const burstWindow = 30 * 1000; // 30 seconds
    const burstLimit = this.getBurstLimit(config);
    
    // Reset burst counter if outside burst window
    if (info.lastRequestTime && (now - info.lastRequestTime) > burstWindow) {
      info.burstRequests = 0;
    }
    
    return (info.burstRequests || 0) >= burstLimit;
  }

  /**
   * Update burst counter
   */
  private updateBurstCounter(info: RateLimitInfo, now: number): void {
    const burstWindow = 30 * 1000; // 30 seconds
    
    if (info.lastRequestTime && (now - info.lastRequestTime) > burstWindow) {
      info.burstRequests = 1;
    } else {
      info.burstRequests = (info.burstRequests || 0) + 1;
    }
  }

  /**
   * Calculate adaptive limit based on recent behavior
   */
  private calculateAdaptiveLimit(
    info: RateLimitInfo,
    baseLimit: number,
    endpoint: string
  ): number {
    // Get recent request patterns for this identifier
    const recentWindows = this.getRecentWindows(info.identifier, endpoint, 5);
    
    if (recentWindows.length < 3) {
      return baseLimit; // Not enough data
    }

    // Calculate average request rate
    const avgRequests = recentWindows.reduce((sum, w) => sum + w.requests, 0) / recentWindows.length;
    
    // If user consistently uses less than 50% of limit, increase it slightly
    if (avgRequests < baseLimit * 0.5) {
      return Math.floor(baseLimit * 1.2);
    }
    
    // If user consistently hits the limit, decrease it slightly
    if (avgRequests >= baseLimit * 0.9) {
      return Math.floor(baseLimit * 0.8);
    }
    
    return baseLimit;
  }

  /**
   * Get recent windows for identifier and endpoint
   */
  private getRecentWindows(
    identifier: string,
    endpoint: string,
    count: number
  ): RateLimitInfo[] {
    const windows: RateLimitInfo[] = [];
    
    for (const [key, info] of this.store.entries()) {
      if (key.startsWith(`${identifier}:${endpoint}:`)) {
        windows.push(info);
      }
    }
    
    return windows
      .sort((a, b) => b.windowStart - a.windowStart)
      .slice(0, count);
  }

  /**
   * Create limit exceeded result
   */
  private createLimitExceededResult(
    info: RateLimitInfo,
    limit: number,
    config: RateLimitConfig
  ): RateLimitResult {
    const retryAfter = Math.ceil((info.resetTime - Date.now()) / 1000);
    
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetTime: info.resetTime,
      retryAfter: Math.max(1, retryAfter),
      headers: {
        ...this.generateHeaders(info, limit, config),
        'Retry-After': retryAfter.toString(),
      },
    };
  }

  /**
   * Generate rate limit headers
   */
  private generateHeaders(
    info: RateLimitInfo,
    limit: number,
    config: RateLimitConfig
  ): Record<string, string> {
    const headers: Record<string, string> = {};
    
    if (config.standardHeaders) {
      headers['X-RateLimit-Limit'] = limit.toString();
      headers['X-RateLimit-Remaining'] = Math.max(0, limit - info.requests).toString();
      headers['X-RateLimit-Reset'] = Math.ceil(info.resetTime / 1000).toString();
      headers['X-RateLimit-Policy'] = `${limit};w=${Math.floor(config.windowMs / 1000)}`;
    }
    
    if (config.legacyHeaders) {
      headers['X-Rate-Limit-Limit'] = limit.toString();
      headers['X-Rate-Limit-Remaining'] = Math.max(0, limit - info.requests).toString();
      headers['X-Rate-Limit-Reset'] = new Date(info.resetTime).toISOString();
    }
    
    return headers;
  }

  /**
   * Helper methods
   */
  private extractEndpoint(request: NextRequest): string {
    const url = new URL(request.url);
    return url.pathname;
  }

  private extractIpAddress(request: NextRequest): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
           request.headers.get('x-real-ip') ||
           request.headers.get('cf-connecting-ip') ||
           'unknown';
  }

  private getWindowStart(timestamp: number, windowMs: number): number {
    return Math.floor(timestamp / windowMs) * windowMs;
  }

  private getBurstLimit(config: RateLimitConfig): number {
    // Get burst limit from endpoint configuration or default to 20% of max requests
    const endpointConfig = config.endpointLimits?.get('current');
    return endpointConfig?.burstLimit || Math.max(1, Math.floor(config.maxRequests * 0.2));
  }

  /**
   * Cleanup expired rate limit entries
   */
  private cleanup(): void {
    const now = Date.now();
    const expired: string[] = [];
    
    for (const [key, info] of this.store.entries()) {
      if (info.resetTime < now) {
        expired.push(key);
      }
    }
    
    expired.forEach(key => this.store.delete(key));
    
    if (expired.length > 0) {
      console.log(`Cleaned up ${expired.length} expired rate limit entries`);
    }
  }

  /**
   * Start automatic cleanup process
   */
  private startCleanupProcess(): void {
    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Stop cleanup process
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get current rate limit status
   */
  getStatus(identifier: string, endpoint?: string): {
    totalRequests: number;
    activeWindows: number;
    blocked: boolean;
  } {
    let totalRequests = 0;
    let activeWindows = 0;
    let blocked = false;
    
    const prefix = endpoint ? `${identifier}:${endpoint}:` : `${identifier}:`;
    
    for (const [key, info] of this.store.entries()) {
      if (key.startsWith(prefix)) {
        totalRequests += info.requests;
        activeWindows++;
        if (info.blocked) blocked = true;
      }
    }
    
    return { totalRequests, activeWindows, blocked };
  }

  /**
   * Reset rate limits for identifier
   */
  reset(identifier: string, endpoint?: string): boolean {
    const prefix = endpoint ? `${identifier}:${endpoint}:` : `${identifier}:`;
    const keysToDelete: string[] = [];
    
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.store.delete(key));
    return keysToDelete.length > 0;
  }

  /**
   * Get rate limiting statistics
   */
  getStatistics(): {
    totalEntries: number;
    uniqueIdentifiers: number;
    uniqueEndpoints: number;
    blockedRequests: number;
    topEndpoints: Array<{ endpoint: string; requests: number }>;
  } {
    const identifiers = new Set<string>();
    const endpoints = new Set<string>();
    const endpointCounts = new Map<string, number>();
    let blockedRequests = 0;
    
    for (const [key, info] of this.store.entries()) {
      identifiers.add(info.identifier);
      endpoints.add(info.endpoint);
      
      const currentCount = endpointCounts.get(info.endpoint) || 0;
      endpointCounts.set(info.endpoint, currentCount + info.requests);
      
      if (info.blocked) {
        blockedRequests++;
      }
    }
    
    const topEndpoints = Array.from(endpointCounts.entries())
      .map(([endpoint, requests]) => ({ endpoint, requests }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);
    
    return {
      totalEntries: this.store.size,
      uniqueIdentifiers: identifiers.size,
      uniqueEndpoints: endpoints.size,
      blockedRequests,
      topEndpoints,
    };
  }
}

/**
 * Create rate limiter middleware
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  const limiter = new AdvancedRateLimiter(config);
  
  return async function rateLimitMiddleware(
    request: NextRequest,
    userId?: string,
    userRole?: string
  ): Promise<NextResponse | null> {
    const result = await limiter.checkLimit(request, userId, userRole);
    
    if (!result.allowed) {
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: config.message || 'Too many requests, please try again later.',
          retryAfter: result.retryAfter,
          limit: result.limit,
          remaining: result.remaining,
          resetTime: result.resetTime,
        },
        { status: 429 }
      );
      
      // Add rate limit headers
      Object.entries(result.headers).forEach(([name, value]) => {
        response.headers.set(name, value);
      });
      
      return response;
    }
    
    return null; // Continue to next middleware
  };
}

// Export default configurations
export const defaultRateLimitConfigs = {
  strict: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 50,
    burstProtection: true,
    adaptiveLimiting: true,
  },
  moderate: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 100,
    burstProtection: true,
    adaptiveLimiting: false,
  },
  lenient: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 200,
    burstProtection: false,
    adaptiveLimiting: false,
  },
};