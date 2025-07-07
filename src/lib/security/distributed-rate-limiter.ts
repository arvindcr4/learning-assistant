import { NextRequest } from 'next/server';

/**
 * Distributed Rate Limiter with Redis-like interface
 * This provides a more robust rate limiting solution for production
 */

export interface RateLimitRule {
  id: string;
  pattern: string;
  method?: string;
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: NextRequest) => string;
  skip?: (req: NextRequest) => boolean;
  handler?: (req: NextRequest, remaining: number) => any;
  onLimitReached?: (req: NextRequest, key: string) => void;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
  rule: RateLimitRule;
}

export interface RateLimitStore {
  get(key: string): Promise<{ count: number; resetTime: number } | null>;
  set(key: string, value: { count: number; resetTime: number }, ttlMs: number): Promise<void>;
  increment(key: string, ttlMs: number): Promise<{ count: number; resetTime: number }>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * In-memory store for development/testing
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  async get(key: string): Promise<{ count: number; resetTime: number } | null> {
    const entry = this.store.get(key);
    if (!entry || Date.now() > entry.resetTime) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  async set(key: string, value: { count: number; resetTime: number }, ttlMs: number): Promise<void> {
    this.store.set(key, value);
  }

  async increment(key: string, ttlMs: number): Promise<{ count: number; resetTime: number }> {
    const now = Date.now();
    const resetTime = now + ttlMs;
    
    const existing = await this.get(key);
    
    if (existing) {
      existing.count += 1;
      await this.set(key, existing, ttlMs);
      return existing;
    } else {
      const newEntry = { count: 1, resetTime };
      await this.set(key, newEntry, ttlMs);
      return newEntry;
    }
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
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

/**
 * Redis store for production use
 */
export class RedisRateLimitStore implements RateLimitStore {
  private redis: any; // Redis client instance

  constructor(redisClient: any) {
    this.redis = redisClient;
  }

  async get(key: string): Promise<{ count: number; resetTime: number } | null> {
    try {
      const data = await this.redis.get(key);
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      if (Date.now() > parsed.resetTime) {
        await this.redis.del(key);
        return null;
      }
      
      return parsed;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async set(key: string, value: { count: number; resetTime: number }, ttlMs: number): Promise<void> {
    try {
      const ttlSeconds = Math.ceil(ttlMs / 1000);
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async increment(key: string, ttlMs: number): Promise<{ count: number; resetTime: number }> {
    try {
      const now = Date.now();
      const resetTime = now + ttlMs;
      
      // Use Redis Lua script for atomic increment
      const luaScript = `
        local key = KEYS[1]
        local ttl = ARGV[1]
        local resetTime = ARGV[2]
        
        local current = redis.call('GET', key)
        if current == false then
          redis.call('SET', key, '{"count":1,"resetTime":' .. resetTime .. '}')
          redis.call('EXPIRE', key, ttl)
          return '{"count":1,"resetTime":' .. resetTime .. '}'
        else
          local data = cjson.decode(current)
          if tonumber(resetTime) > data.resetTime then
            redis.call('SET', key, '{"count":1,"resetTime":' .. resetTime .. '}')
            redis.call('EXPIRE', key, ttl)
            return '{"count":1,"resetTime":' .. resetTime .. '}'
          else
            data.count = data.count + 1
            local newData = cjson.encode(data)
            redis.call('SET', key, newData)
            redis.call('EXPIRE', key, ttl)
            return newData
          end
        end
      `;
      
      const result = await this.redis.eval(
        luaScript,
        1,
        key,
        Math.ceil(ttlMs / 1000),
        resetTime
      );
      
      return JSON.parse(result);
    } catch (error) {
      console.error('Redis increment error:', error);
      // Fallback to simple increment
      const existing = await this.get(key) || { count: 0, resetTime: Date.now() + ttlMs };
      existing.count += 1;
      await this.set(key, existing, ttlMs);
      return existing;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error('Redis delete error:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.redis.flushall();
    } catch (error) {
      console.error('Redis clear error:', error);
    }
  }
}

/**
 * Distributed Rate Limiter
 */
export class DistributedRateLimiter {
  private store: RateLimitStore;
  private rules: Map<string, RateLimitRule> = new Map();

  constructor(store?: RateLimitStore) {
    this.store = store || new MemoryRateLimitStore();
    this.setupDefaultRules();
  }

  /**
   * Add a rate limiting rule
   */
  addRule(rule: RateLimitRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove a rate limiting rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * Check if request is allowed
   */
  async checkRequest(request: NextRequest): Promise<RateLimitResult[]> {
    const results: RateLimitResult[] = [];
    
    for (const rule of this.rules.values()) {
      if (this.shouldApplyRule(request, rule)) {
        const result = await this.checkRule(request, rule);
        results.push(result);
        
        // If any rule blocks the request, we can short-circuit
        if (!result.allowed) {
          break;
        }
      }
    }
    
    return results;
  }

  /**
   * Check a specific rule
   */
  private async checkRule(request: NextRequest, rule: RateLimitRule): Promise<RateLimitResult> {
    if (rule.skip && rule.skip(request)) {
      return {
        allowed: true,
        remaining: rule.maxRequests,
        resetTime: new Date(Date.now() + rule.windowMs),
        rule,
      };
    }
    
    const key = this.generateKey(request, rule);
    const entry = await this.store.increment(key, rule.windowMs);
    
    const remaining = Math.max(0, rule.maxRequests - entry.count);
    const allowed = entry.count <= rule.maxRequests;
    
    if (!allowed && rule.onLimitReached) {
      rule.onLimitReached(request, key);
    }
    
    const result: RateLimitResult = {
      allowed,
      remaining,
      resetTime: new Date(entry.resetTime),
      rule,
    };
    
    if (!allowed) {
      result.retryAfter = Math.ceil((entry.resetTime - Date.now()) / 1000);
    }
    
    return result;
  }

  /**
   * Generate cache key for a request
   */
  private generateKey(request: NextRequest, rule: RateLimitRule): string {
    if (rule.keyGenerator) {
      return `rl:${rule.id}:${rule.keyGenerator(request)}`;
    }
    
    // Default key generation
    const ip = this.getClientIP(request);
    const method = request.method;
    const path = request.nextUrl.pathname;
    
    return `rl:${rule.id}:${ip}:${method}:${path}`;
  }

  /**
   * Check if rule should apply to request
   */
  private shouldApplyRule(request: NextRequest, rule: RateLimitRule): boolean {
    // Check method
    if (rule.method && rule.method !== request.method) {
      return false;
    }
    
    // Check path pattern
    const path = request.nextUrl.pathname;
    if (rule.pattern !== '*') {
      const regex = new RegExp(rule.pattern.replace(/\*/g, '.*'));
      if (!regex.test(path)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    
    return request.headers.get('x-real-ip') || 
           request.ip || 
           'unknown';
  }

  /**
   * Setup default rate limiting rules
   */
  private setupDefaultRules(): void {
    // Global rate limit
    this.addRule({
      id: 'global',
      pattern: '*',
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 1000,
    });

    // Authentication endpoints
    this.addRule({
      id: 'auth',
      pattern: '/api/auth/*',
      method: 'POST',
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 10,
      onLimitReached: (req, key) => {
        console.warn(`Auth rate limit exceeded for ${key}`);
      },
    });

    // API endpoints
    this.addRule({
      id: 'api',
      pattern: '/api/*',
      windowMs: 1 * 60 * 1000, // 1 minute
      maxRequests: 100,
    });

    // Learning endpoints (higher limits for authenticated users)
    this.addRule({
      id: 'learning',
      pattern: '/api/learning/*',
      windowMs: 1 * 60 * 1000, // 1 minute
      maxRequests: 50,
      keyGenerator: (req) => {
        const userId = req.headers.get('x-user-id');
        if (userId) {
          return `user:${userId}`;
        }
        return `ip:${this.getClientIP(req)}`;
      },
    });

    // File upload endpoints (very strict)
    this.addRule({
      id: 'upload',
      pattern: '/api/upload/*',
      method: 'POST',
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 10,
    });

    // Search endpoints
    this.addRule({
      id: 'search',
      pattern: '/api/search/*',
      windowMs: 1 * 60 * 1000, // 1 minute
      maxRequests: 30,
    });
  }

  /**
   * Get rate limit status for a key
   */
  async getStatus(key: string): Promise<{ count: number; resetTime: number } | null> {
    return await this.store.get(key);
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key: string): Promise<void> {
    await this.store.delete(key);
  }

  /**
   * Clear all rate limit data
   */
  async clearAll(): Promise<void> {
    await this.store.clear();
  }

  /**
   * Get all rules
   */
  getRules(): RateLimitRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Update rule configuration
   */
  updateRule(ruleId: string, updates: Partial<RateLimitRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;
    
    Object.assign(rule, updates);
    this.rules.set(ruleId, rule);
    return true;
  }
}

// Create global instance
export const distributedRateLimiter = new DistributedRateLimiter();

// Export default rule configurations
export const defaultRules = {
  global: { windowMs: 15 * 60 * 1000, maxRequests: 1000 },
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 10 },
  api: { windowMs: 1 * 60 * 1000, maxRequests: 100 },
  learning: { windowMs: 1 * 60 * 1000, maxRequests: 50 },
  upload: { windowMs: 60 * 60 * 1000, maxRequests: 10 },
  search: { windowMs: 1 * 60 * 1000, maxRequests: 30 },
};