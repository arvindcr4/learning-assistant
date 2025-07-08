import { NextRequest, NextResponse } from 'next/server';

// ====================
// RATE LIMITING TYPES
// ====================

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string; // Custom error message
  keyGenerator?: (request: NextRequest) => string; // Custom key generator
  skip?: (request: NextRequest) => boolean; // Skip rate limiting for certain requests
  onLimitReached?: (request: NextRequest, key: string) => void; // Callback when limit is reached
  headers?: boolean; // Include rate limit headers in response
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

export interface RateLimitStore {
  key: string;
  requests: number;
  resetTime: number;
}

// ====================
// REDIS STORE
// ====================

import { executeRedisCommand } from '../redis-client';

class RedisStore {
  async get(key: string): Promise<RateLimitStore | undefined> {
    try {
      const data = await executeRedisCommand<string>('get', [key]);
      if (data) {
        return JSON.parse(data) as RateLimitStore;
      }
      return undefined;
    } catch (error) {
      console.error('Redis rate limit get error:', error);
      return undefined;
    }
  }

  async set(key: string, value: RateLimitStore, ttlSeconds: number): Promise<void> {
    try {
      await executeRedisCommand('setex', [key, ttlSeconds, JSON.stringify(value)]);
    } catch (error) {
      console.error('Redis rate limit set error:', error);
    }
  }

  async increment(key: string, windowMs: number): Promise<RateLimitStore> {
    const now = Date.now();
    const resetTime = now + windowMs;
    const ttlSeconds = Math.ceil(windowMs / 1000);
    
    try {
      // Use Redis INCR for atomic increment
      const requests = await executeRedisCommand<number>('incr', [key]);
      
      if (requests === 1) {
        // First request, set expiration
        await executeRedisCommand('expire', [key, ttlSeconds]);
      }
      
      const entry: RateLimitStore = {
        key,
        requests: requests || 1,
        resetTime,
      };
      
      return entry;
    } catch (error) {
      console.error('Redis rate limit increment error:', error);
      // Fallback to basic increment
      const existing = await this.get(key);
      
      if (existing) {
        existing.requests += 1;
        await this.set(key, existing, ttlSeconds);
        return existing;
      } else {
        const newEntry: RateLimitStore = {
          key,
          requests: 1,
          resetTime,
        };
        await this.set(key, newEntry, ttlSeconds);
        return newEntry;
      }
    }
  }

  async reset(key: string): Promise<void> {
    try {
      await executeRedisCommand('del', [key]);
    } catch (error) {
      console.error('Redis rate limit reset error:', error);
    }
  }

  destroy(): void {
    // Redis connections are managed by the Redis client manager
  }
}

// ====================
// IN-MEMORY STORE (FALLBACK)
// ====================

class MemoryStore {
  private store: Map<string, RateLimitStore> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  async get(key: string): Promise<RateLimitStore | undefined> {
    const entry = this.store.get(key);
    if (entry && entry.resetTime > Date.now()) {
      return entry;
    }
    return undefined;
  }

  async set(key: string, value: RateLimitStore, ttlSeconds?: number): Promise<void> {
    this.store.set(key, value);
  }

  async increment(key: string, windowMs: number): Promise<RateLimitStore> {
    const now = Date.now();
    const resetTime = now + windowMs;
    
    const existing = await this.get(key);
    
    if (existing) {
      existing.requests += 1;
      await this.set(key, existing);
      return existing;
    } else {
      const newEntry: RateLimitStore = {
        key,
        requests: 1,
        resetTime,
      };
      await this.set(key, newEntry);
      return newEntry;
    }
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime <= now) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

// ====================
// ADAPTIVE STORE
// ====================

class AdaptiveStore {
  private redisStore: RedisStore;
  private memoryStore: MemoryStore;
  private useRedis: boolean = true;
  private fallbackMode: boolean = false;

  constructor() {
    this.redisStore = new RedisStore();
    this.memoryStore = new MemoryStore();
    this.checkRedisAvailability();
  }

  private async checkRedisAvailability(): Promise<void> {
    try {
      await executeRedisCommand('ping');
      this.useRedis = true;
      this.fallbackMode = false;
    } catch (error) {
      console.warn('⚠️ Redis unavailable, falling back to memory store for rate limiting');
      this.useRedis = false;
      this.fallbackMode = true;
    }
  }

  async get(key: string): Promise<RateLimitStore | undefined> {
    if (this.useRedis && !this.fallbackMode) {
      try {
        return await this.redisStore.get(key);
      } catch (error) {
        console.warn('⚠️ Redis error, falling back to memory store');
        this.fallbackMode = true;
        return await this.memoryStore.get(key);
      }
    }
    return await this.memoryStore.get(key);
  }

  async set(key: string, value: RateLimitStore, ttlSeconds?: number): Promise<void> {
    if (this.useRedis && !this.fallbackMode) {
      try {
        await this.redisStore.set(key, value, ttlSeconds || 3600);
        return;
      } catch (error) {
        console.warn('⚠️ Redis error, falling back to memory store');
        this.fallbackMode = true;
      }
    }
    await this.memoryStore.set(key, value);
  }

  async increment(key: string, windowMs: number): Promise<RateLimitStore> {
    if (this.useRedis && !this.fallbackMode) {
      try {
        return await this.redisStore.increment(key, windowMs);
      } catch (error) {
        console.warn('⚠️ Redis error, falling back to memory store');
        this.fallbackMode = true;
      }
    }
    return await this.memoryStore.increment(key, windowMs);
  }

  async reset(key: string): Promise<void> {
    if (this.useRedis && !this.fallbackMode) {
      try {
        await this.redisStore.reset(key);
        return;
      } catch (error) {
        console.warn('⚠️ Redis error, falling back to memory store');
        this.fallbackMode = true;
      }
    }
    await this.memoryStore.reset(key);
  }

  destroy(): void {
    this.redisStore.destroy();
    this.memoryStore.destroy();
  }
}

// ====================
// RATE LIMITER CLASS
// ====================

export class RateLimiter {
  private store: AdaptiveStore;
  private config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig) {
    this.store = new AdaptiveStore();
    this.config = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      message: config.message || 'Too many requests from this IP, please try again later',
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator,
      skip: config.skip || (() => false),
      onLimitReached: config.onLimitReached || (() => {}),
      headers: config.headers !== false,
    };
  }

  private defaultKeyGenerator(request: NextRequest): string {
    // Use IP address as default key
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 
               request.headers.get('x-real-ip') || 
               request.ip || 
               'unknown';
    return `ip:${ip}`;
  }

  async isAllowed(request: NextRequest): Promise<{
    allowed: boolean;
    info: RateLimitInfo;
    response?: NextResponse;
  }> {
    // Check if request should be skipped
    if (this.config.skip(request)) {
      return {
        allowed: true,
        info: {
          limit: this.config.maxRequests,
          remaining: this.config.maxRequests,
          reset: new Date(Date.now() + this.config.windowMs),
        },
      };
    }

    const key = this.config.keyGenerator(request);
    const entry = await this.store.increment(key, this.config.windowMs);

    const info: RateLimitInfo = {
      limit: this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - entry.requests),
      reset: new Date(entry.resetTime),
    };

    if (entry.requests > this.config.maxRequests) {
      info.retryAfter = Math.ceil((entry.resetTime - Date.now()) / 1000);
      
      // Call the callback if provided
      this.config.onLimitReached(request, key);

      const response = NextResponse.json(
        {
          error: 'Rate Limit Exceeded',
          message: this.config.message,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: info.retryAfter,
          timestamp: new Date().toISOString(),
        },
        { status: 429 }
      );

      if (this.config.headers) {
        this.addRateLimitHeaders(response, info);
      }

      return {
        allowed: false,
        info,
        response,
      };
    }

    return {
      allowed: true,
      info,
    };
  }

  private addRateLimitHeaders(response: NextResponse, info: RateLimitInfo): void {
    response.headers.set('X-RateLimit-Limit', info.limit.toString());
    response.headers.set('X-RateLimit-Remaining', info.remaining.toString());
    response.headers.set('X-RateLimit-Reset', Math.ceil(info.reset.getTime() / 1000).toString());
    
    if (info.retryAfter) {
      response.headers.set('Retry-After', info.retryAfter.toString());
    }
  }

  async reset(request: NextRequest): Promise<void> {
    const key = this.config.keyGenerator(request);
    await this.store.reset(key);
  }

  destroy(): void {
    this.store.destroy();
  }
}

// ====================
// PREDEFINED RATE LIMITERS WITH REDIS SUPPORT
// ====================

// General API rate limiter
export const apiRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
  message: 'Too many API requests from this IP, please try again later',
  keyGenerator: (request: NextRequest) => {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 
               request.headers.get('x-real-ip') || 
               request.ip || 
               'unknown';
    return `api:${ip}`;
  },
});

// Authentication rate limiter (stricter)
export const authRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 login attempts per 15 minutes
  message: 'Too many authentication attempts from this IP, please try again later',
  keyGenerator: (request: NextRequest) => {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 
               request.headers.get('x-real-ip') || 
               request.ip || 
               'unknown';
    return `auth:${ip}`;
  },
});

// Chat/AI rate limiter with user-specific limits
export const chatRateLimiter = new RateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 30, // 30 messages per minute
  message: 'Too many chat messages, please slow down',
  keyGenerator: (request: NextRequest) => {
    // Use user ID if available, otherwise fall back to IP
    const userId = request.headers.get('x-user-id');
    if (userId) {
      return `chat:user:${userId}`;
    }
    
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 
               request.headers.get('x-real-ip') || 
               request.ip || 
               'unknown';
    return `chat:ip:${ip}`;
  },
});

// Assessment rate limiter with user tracking
export const assessmentRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10, // 10 assessment submissions per hour
  message: 'Too many assessment submissions, please wait before trying again',
  keyGenerator: (request: NextRequest) => {
    const userId = request.headers.get('x-user-id');
    if (userId) {
      return `assessment:user:${userId}`;
    }
    
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 
               request.headers.get('x-real-ip') || 
               request.ip || 
               'unknown';
    return `assessment:ip:${ip}`;
  },
});

// File upload rate limiter with size consideration
export const uploadRateLimiter = new RateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  maxRequests: 5, // 5 uploads per 10 minutes
  message: 'Too many file uploads, please wait before trying again',
  keyGenerator: (request: NextRequest) => {
    const userId = request.headers.get('x-user-id');
    if (userId) {
      return `upload:user:${userId}`;
    }
    
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 
               request.headers.get('x-real-ip') || 
               request.ip || 
               'unknown';
    return `upload:ip:${ip}`;
  },
});

// Content access rate limiter
export const contentRateLimiter = new RateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 50, // 50 content requests per 5 minutes
  message: 'Too many content requests, please slow down',
  keyGenerator: (request: NextRequest) => {
    const userId = request.headers.get('x-user-id');
    if (userId) {
      return `content:user:${userId}`;
    }
    
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 
               request.headers.get('x-real-ip') || 
               request.ip || 
               'unknown';
    return `content:ip:${ip}`;
  },
});

// Analytics rate limiter
export const analyticsRateLimiter = new RateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 10, // 10 analytics requests per minute
  message: 'Too many analytics requests, please wait',
  keyGenerator: (request: NextRequest) => {
    const userId = request.headers.get('x-user-id');
    if (userId) {
      return `analytics:user:${userId}`;
    }
    
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 
               request.headers.get('x-real-ip') || 
               request.ip || 
               'unknown';
    return `analytics:ip:${ip}`;
  },
});

// Email rate limiter
export const emailRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5, // 5 emails per hour
  message: 'Too many email requests, please wait before sending more emails',
  keyGenerator: (request: NextRequest) => {
    const userId = request.headers.get('x-user-id');
    if (userId) {
      return `email:user:${userId}`;
    }
    
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 
               request.headers.get('x-real-ip') || 
               request.ip || 
               'unknown';
    return `email:ip:${ip}`;
  },
});

// Search rate limiter
export const searchRateLimiter = new RateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 20, // 20 search requests per minute
  message: 'Too many search requests, please slow down',
  keyGenerator: (request: NextRequest) => {
    const userId = request.headers.get('x-user-id');
    if (userId) {
      return `search:user:${userId}`;
    }
    
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 
               request.headers.get('x-real-ip') || 
               request.ip || 
               'unknown';
    return `search:ip:${ip}`;
  },
});

// ====================
// MIDDLEWARE HELPERS
// ====================

/**
 * Creates a rate limiting middleware
 */
export function withRateLimit(rateLimiter: RateLimiter) {
  return async function(
    request: NextRequest,
    handler: (request: NextRequest) => Promise<NextResponse> | NextResponse
  ): Promise<NextResponse> {
    const result = await rateLimiter.isAllowed(request);
    
    if (!result.allowed) {
      return result.response!;
    }

    // Continue with the original handler
    const response = await handler(request);

    // Add rate limit headers to successful responses
    if (rateLimiter['config'].headers) {
      response.headers.set('X-RateLimit-Limit', result.info.limit.toString());
      response.headers.set('X-RateLimit-Remaining', result.info.remaining.toString());
      response.headers.set('X-RateLimit-Reset', Math.ceil(result.info.reset.getTime() / 1000).toString());
    }

    return response;
  };
}

/**
 * Rate limiting for specific user actions
 */
export function withUserRateLimit(
  config: {
    windowMs: number;
    maxRequests: number;
    action: string;
    message?: string;
  }
) {
  const rateLimiter = new RateLimiter({
    ...config,
    keyGenerator: (request: NextRequest) => {
      const userId = request.headers.get('x-user-id');
      if (userId) {
        return `${config.action}:user:${userId}`;
      }
      
      const forwarded = request.headers.get('x-forwarded-for');
      const ip = forwarded ? forwarded.split(',')[0].trim() : 
                 request.headers.get('x-real-ip') || 
                 request.ip || 
                 'unknown';
      return `${config.action}:ip:${ip}`;
    },
  });

  return withRateLimit(rateLimiter);
}

/**
 * Combines multiple rate limiters
 */
export function withMultipleRateLimits(...rateLimiters: RateLimiter[]) {
  return async function(
    request: NextRequest,
    handler: (request: NextRequest) => Promise<NextResponse> | NextResponse
  ): Promise<NextResponse> {
    // Check all rate limiters
    for (const rateLimiter of rateLimiters) {
      const result = await rateLimiter.isAllowed(request);
      if (!result.allowed) {
        return result.response!;
      }
    }

    // All rate limiters passed, continue with handler
    return handler(request);
  };
}

// ====================
// ABUSE DETECTION
// ====================

export interface AbuseDetectionConfig {
  suspiciousRequestThreshold: number;
  timeWindow: number;
  blockDuration: number;
  patterns: {
    rapidRequests: boolean;
    repeatedFailures: boolean;
    suspiciousUserAgents: boolean;
    invalidRequests: boolean;
  };
}

export class AbuseDetector {
  private suspiciousIps: Map<string, {
    count: number;
    firstSeen: number;
    blockedUntil?: number;
    reasons: string[];
  }> = new Map();

  private config: AbuseDetectionConfig;

  constructor(config: AbuseDetectionConfig) {
    this.config = config;
    
    // Clean up old entries every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  isBlocked(ip: string): boolean {
    const entry = this.suspiciousIps.get(ip);
    if (!entry) return false;

    if (entry.blockedUntil && entry.blockedUntil > Date.now()) {
      return true;
    }

    // Remove expired block
    if (entry.blockedUntil && entry.blockedUntil <= Date.now()) {
      entry.blockedUntil = undefined;
    }

    return false;
  }

  recordSuspiciousActivity(ip: string, reason: string): void {
    const now = Date.now();
    const entry = this.suspiciousIps.get(ip) || {
      count: 0,
      firstSeen: now,
      reasons: [],
    };

    // Reset if window has passed
    if (now - entry.firstSeen > this.config.timeWindow) {
      entry.count = 0;
      entry.firstSeen = now;
      entry.reasons = [];
    }

    entry.count += 1;
    entry.reasons.push(reason);

    if (entry.count >= this.config.suspiciousRequestThreshold) {
      entry.blockedUntil = now + this.config.blockDuration;
    }

    this.suspiciousIps.set(ip, entry);
  }

  checkRequest(request: NextRequest): { isAbusive: boolean; reason?: string } {
    const ip = this.getClientIp(request);
    
    if (this.isBlocked(ip)) {
      return { isAbusive: true, reason: 'IP is temporarily blocked due to suspicious activity' };
    }

    // Check for suspicious patterns
    if (this.config.patterns.suspiciousUserAgents) {
      const userAgent = request.headers.get('user-agent') || '';
      if (this.isSuspiciousUserAgent(userAgent)) {
        this.recordSuspiciousActivity(ip, 'Suspicious user agent');
        return { isAbusive: true, reason: 'Suspicious user agent detected' };
      }
    }

    return { isAbusive: false };
  }

  private getClientIp(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    return forwarded ? forwarded.split(',')[0].trim() : 
           request.headers.get('x-real-ip') || 
           request.ip || 
           'unknown';
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /^$/,
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [ip, entry] of this.suspiciousIps.entries()) {
      // Remove entries older than 24 hours
      if (now - entry.firstSeen > 24 * 60 * 60 * 1000) {
        this.suspiciousIps.delete(ip);
      }
    }
  }
}

// Default abuse detector
export const abuseDetector = new AbuseDetector({
  suspiciousRequestThreshold: 50,
  timeWindow: 10 * 60 * 1000, // 10 minutes
  blockDuration: 60 * 60 * 1000, // 1 hour
  patterns: {
    rapidRequests: true,
    repeatedFailures: true,
    suspiciousUserAgents: true,
    invalidRequests: true,
  },
});

export default {
  RateLimiter,
  apiRateLimiter,
  authRateLimiter,
  chatRateLimiter,
  assessmentRateLimiter,
  uploadRateLimiter,
  contentRateLimiter,
  analyticsRateLimiter,
  emailRateLimiter,
  searchRateLimiter,
  withRateLimit,
  withUserRateLimit,
  withMultipleRateLimits,
  AbuseDetector,
  abuseDetector,
};