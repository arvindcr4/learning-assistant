import { NextRequest, NextResponse } from 'next/server';
import { LRUCache } from 'lru-cache';

// Rate limiting configuration
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  keyGenerator: (request: NextRequest) => string;
  onLimitReached: (request: NextRequest, rateLimitInfo: RateLimitInfo) => void;
  allowWhitelist: boolean;
  allowDynamicAdjustment: boolean;
}

// Rate limit information
export interface RateLimitInfo {
  totalHits: number;
  totalHitsPerUser?: number;
  totalHitsPerIP: number;
  resetTime: Date;
  timeRemaining: number;
  limit: number;
  remaining: number;
  retryAfter: number;
  userAgent?: string;
  ipAddress: string;
  userId?: string;
  endpoint: string;
}

// DDoS protection configuration
export interface DDoSProtectionConfig {
  enabled: boolean;
  suspiciousThreshold: number;
  maliciousThreshold: number;
  banDuration: number;
  adaptiveThreshold: boolean;
  geoFiltering: boolean;
  behaviorAnalysis: boolean;
  trafficPatternAnalysis: boolean;
}

// Traffic pattern analysis
interface TrafficPattern {
  requestCount: number;
  requestTimes: number[];
  distinctEndpoints: Set<string>;
  userAgents: Set<string>;
  suspiciousScore: number;
  lastActivity: number;
}

// Geo-blocking configuration
interface GeoBlockingConfig {
  blockedCountries: string[];
  allowedCountries: string[];
  blockUnknownCountries: boolean;
}

// Rate limiting store
interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
  lastRequest: number;
  blockedUntil?: number;
  suspiciousScore: number;
  requestTimes: number[];
  endpoints: Set<string>;
  userAgents: Set<string>;
  failedRequests: number;
  successfulRequests: number;
}

export class AdvancedRateLimiter {
  private ipStore: LRUCache<string, RateLimitEntry>;
  private userStore: LRUCache<string, RateLimitEntry>;
  private patternStore: LRUCache<string, TrafficPattern>;
  private whitelist: Set<string>;
  private blacklist: Set<string>;
  private config: RateLimitConfig;
  private ddosConfig: DDoSProtectionConfig;
  private geoConfig: GeoBlockingConfig;

  constructor(
    config: Partial<RateLimitConfig> = {},
    ddosConfig: Partial<DDoSProtectionConfig> = {},
    geoConfig: Partial<GeoBlockingConfig> = {}
  ) {
    this.config = {
      windowMs: 60000, // 1 minute
      maxRequests: 100,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: (req) => this.getClientIdentifier(req),
      onLimitReached: (req, info) => this.handleLimitReached(req, info),
      allowWhitelist: true,
      allowDynamicAdjustment: true,
      ...config,
    };

    this.ddosConfig = {
      enabled: true,
      suspiciousThreshold: 200,
      maliciousThreshold: 500,
      banDuration: 24 * 60 * 60 * 1000, // 24 hours
      adaptiveThreshold: true,
      geoFiltering: true,
      behaviorAnalysis: true,
      trafficPatternAnalysis: true,
      ...ddosConfig,
    };

    this.geoConfig = {
      blockedCountries: ['CN', 'RU', 'KP'], // Example blocked countries
      allowedCountries: [],
      blockUnknownCountries: false,
      ...geoConfig,
    };

    // Initialize LRU caches
    this.ipStore = new LRUCache<string, RateLimitEntry>({
      max: 10000,
      ttl: this.config.windowMs * 2,
      updateAgeOnGet: true,
    });

    this.userStore = new LRUCache<string, RateLimitEntry>({
      max: 5000,
      ttl: this.config.windowMs * 2,
      updateAgeOnGet: true,
    });

    this.patternStore = new LRUCache<string, TrafficPattern>({
      max: 1000,
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      updateAgeOnGet: true,
    });

    this.whitelist = new Set<string>();
    this.blacklist = new Set<string>();
    
    // Add common trusted IPs to whitelist
    this.whitelist.add('127.0.0.1');
    this.whitelist.add('::1');
    this.whitelist.add('localhost');
  }

  /**
   * Main rate limiting middleware
   */
  middleware(
    endpointConfig: Partial<RateLimitConfig> = {}
  ): (request: NextRequest, userId?: string) => NextResponse | null {
    const effectiveConfig = { ...this.config, ...endpointConfig };

    return (request: NextRequest, userId?: string): NextResponse | null => {
      try {
        const ipAddress = this.getClientIP(request);
        const userAgent = request.headers.get('user-agent') || 'unknown';
        const endpoint = request.nextUrl.pathname;
        const method = request.method;
        const now = Date.now();

        // Check blacklist
        if (this.blacklist.has(ipAddress)) {
          return this.createRateLimitResponse(
            'IP address is blacklisted',
            429,
            {
              totalHits: 0,
              totalHitsPerIP: 0,
              resetTime: new Date(now + effectiveConfig.windowMs),
              timeRemaining: effectiveConfig.windowMs,
              limit: 0,
              remaining: 0,
              retryAfter: Math.ceil(effectiveConfig.windowMs / 1000),
              userAgent,
              ipAddress,
              userId,
              endpoint,
            }
          );
        }

        // Check whitelist
        if (this.config.allowWhitelist && this.whitelist.has(ipAddress)) {
          return null; // Allow whitelisted IPs
        }

        // DDoS protection checks
        if (this.ddosConfig.enabled) {
          const ddosCheck = this.checkDDoSProtection(request, ipAddress, userId);
          if (ddosCheck) {
            return ddosCheck;
          }
        }

        // Geo-blocking
        if (this.ddosConfig.geoFiltering) {
          const geoCheck = this.checkGeoBlocking(request, ipAddress);
          if (geoCheck) {
            return geoCheck;
          }
        }

        // IP-based rate limiting
        const ipKey = `ip:${ipAddress}`;
        const ipResult = this.checkRateLimit(
          ipKey,
          this.ipStore,
          effectiveConfig,
          request,
          now
        );

        if (!ipResult.allowed) {
          return this.createRateLimitResponse(
            'Rate limit exceeded for IP',
            429,
            ipResult.info
          );
        }

        // User-based rate limiting (if user is authenticated)
        if (userId) {
          const userKey = `user:${userId}`;
          const userResult = this.checkRateLimit(
            userKey,
            this.userStore,
            {
              ...effectiveConfig,
              maxRequests: Math.min(effectiveConfig.maxRequests * 10, 1000), // Higher limit for authenticated users
            },
            request,
            now
          );

          if (!userResult.allowed) {
            return this.createRateLimitResponse(
              'Rate limit exceeded for user',
              429,
              userResult.info
            );
          }
        }

        // Traffic pattern analysis
        if (this.ddosConfig.trafficPatternAnalysis) {
          this.analyzeTrafficPattern(ipAddress, endpoint, userAgent, now);
        }

        // Behavior analysis
        if (this.ddosConfig.behaviorAnalysis) {
          const behaviorCheck = this.analyzeBehavior(request, ipAddress, userId);
          if (behaviorCheck) {
            return behaviorCheck;
          }
        }

        return null; // Allow request
      } catch (error) {
        console.error('Rate limiting error:', error);
        return null; // Allow request on error to prevent service disruption
      }
    };
  }

  /**
   * Check rate limit for a specific key
   */
  private checkRateLimit(
    key: string,
    store: LRUCache<string, RateLimitEntry>,
    config: RateLimitConfig,
    request: NextRequest,
    now: number
  ): { allowed: boolean; info: RateLimitInfo } {
    const entry = store.get(key) || this.createNewEntry(now);
    const windowStart = now - config.windowMs;

    // Reset if window has passed
    if (entry.resetTime < now) {
      entry.count = 0;
      entry.resetTime = now + config.windowMs;
      entry.firstRequest = now;
      entry.successfulRequests = 0;
      entry.failedRequests = 0;
      entry.requestTimes = [];
      entry.endpoints = new Set();
      entry.userAgents = new Set();
    }

    // Update entry
    entry.count++;
    entry.lastRequest = now;
    entry.requestTimes.push(now);
    entry.endpoints.add(request.nextUrl.pathname);
    entry.userAgents.add(request.headers.get('user-agent') || 'unknown');

    // Keep only recent request times
    entry.requestTimes = entry.requestTimes.filter(time => time > windowStart);

    // Calculate suspicious score
    entry.suspiciousScore = this.calculateSuspiciousScore(entry, now);

    // Check if blocked
    if (entry.blockedUntil && entry.blockedUntil > now) {
      const info: RateLimitInfo = {
        totalHits: entry.count,
        totalHitsPerIP: entry.count,
        resetTime: new Date(entry.blockedUntil),
        timeRemaining: entry.blockedUntil - now,
        limit: config.maxRequests,
        remaining: 0,
        retryAfter: Math.ceil((entry.blockedUntil - now) / 1000),
        userAgent: request.headers.get('user-agent') || undefined,
        ipAddress: this.getClientIP(request),
        endpoint: request.nextUrl.pathname,
      };

      return { allowed: false, info };
    }

    // Check if limit exceeded
    const isLimitExceeded = entry.count > config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - entry.count);

    // Apply dynamic adjustment if enabled
    if (config.allowDynamicAdjustment && entry.suspiciousScore > 50) {
      const adjustedLimit = Math.max(1, Math.floor(config.maxRequests * 0.5));
      if (entry.count > adjustedLimit) {
        entry.blockedUntil = now + (config.windowMs * 2); // Extended block
      }
    }

    // Store updated entry
    store.set(key, entry);

    const info: RateLimitInfo = {
      totalHits: entry.count,
      totalHitsPerIP: entry.count,
      resetTime: new Date(entry.resetTime),
      timeRemaining: entry.resetTime - now,
      limit: config.maxRequests,
      remaining,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      userAgent: request.headers.get('user-agent') || undefined,
      ipAddress: this.getClientIP(request),
      endpoint: request.nextUrl.pathname,
    };

    if (isLimitExceeded) {
      config.onLimitReached(request, info);
    }

    return { allowed: !isLimitExceeded, info };
  }

  /**
   * DDoS protection checks
   */
  private checkDDoSProtection(
    request: NextRequest,
    ipAddress: string,
    userId?: string
  ): NextResponse | null {
    const now = Date.now();
    const key = `ddos:${ipAddress}`;
    const entry = this.ipStore.get(key);

    if (!entry) {
      return null;
    }

    // Check if this IP is making too many requests
    if (entry.count > this.ddosConfig.maliciousThreshold) {
      // Block for extended period
      entry.blockedUntil = now + this.ddosConfig.banDuration;
      this.blacklist.add(ipAddress);
      this.ipStore.set(key, entry);

      console.warn('DDoS attack detected', {
        ipAddress,
        requestCount: entry.count,
        threshold: this.ddosConfig.maliciousThreshold,
      });

      return this.createRateLimitResponse(
        'DDoS protection activated',
        429,
        {
          totalHits: entry.count,
          totalHitsPerIP: entry.count,
          resetTime: new Date(entry.blockedUntil),
          timeRemaining: entry.blockedUntil - now,
          limit: this.ddosConfig.maliciousThreshold,
          remaining: 0,
          retryAfter: Math.ceil((entry.blockedUntil - now) / 1000),
          ipAddress,
          endpoint: request.nextUrl.pathname,
        }
      );
    }

    // Check for suspicious activity
    if (entry.count > this.ddosConfig.suspiciousThreshold) {
      entry.suspiciousScore = Math.min(100, entry.suspiciousScore + 20);
      console.warn('Suspicious activity detected', {
        ipAddress,
        requestCount: entry.count,
        suspiciousScore: entry.suspiciousScore,
      });
    }

    return null;
  }

  /**
   * Geo-blocking checks
   */
  private checkGeoBlocking(
    request: NextRequest,
    ipAddress: string
  ): NextResponse | null {
    // This is a simplified geo-blocking implementation
    // In production, you would use a proper geolocation service
    const country = this.getCountryFromIP(ipAddress);

    if (country && this.geoConfig.blockedCountries.includes(country)) {
      console.warn('Geo-blocked request', {
        ipAddress,
        country,
        endpoint: request.nextUrl.pathname,
      });

      return this.createRateLimitResponse(
        'Access denied from your location',
        403,
        {
          totalHits: 0,
          totalHitsPerIP: 0,
          resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          timeRemaining: 24 * 60 * 60 * 1000,
          limit: 0,
          remaining: 0,
          retryAfter: 24 * 60 * 60,
          ipAddress,
          endpoint: request.nextUrl.pathname,
        }
      );
    }

    return null;
  }

  /**
   * Analyze traffic patterns
   */
  private analyzeTrafficPattern(
    ipAddress: string,
    endpoint: string,
    userAgent: string,
    now: number
  ): void {
    const key = `pattern:${ipAddress}`;
    const pattern = this.patternStore.get(key) || {
      requestCount: 0,
      requestTimes: [],
      distinctEndpoints: new Set(),
      userAgents: new Set(),
      suspiciousScore: 0,
      lastActivity: now,
    };

    pattern.requestCount++;
    pattern.requestTimes.push(now);
    pattern.distinctEndpoints.add(endpoint);
    pattern.userAgents.add(userAgent);
    pattern.lastActivity = now;

    // Keep only recent requests (last hour)
    const oneHourAgo = now - 60 * 60 * 1000;
    pattern.requestTimes = pattern.requestTimes.filter(time => time > oneHourAgo);

    // Calculate suspicious score based on patterns
    let suspiciousScore = 0;

    // High request frequency
    if (pattern.requestTimes.length > 100) {
      suspiciousScore += 30;
    }

    // Many different endpoints (scraping behavior)
    if (pattern.distinctEndpoints.size > 20) {
      suspiciousScore += 25;
    }

    // Multiple user agents (bot behavior)
    if (pattern.userAgents.size > 5) {
      suspiciousScore += 20;
    }

    // Regular intervals (automated behavior)
    if (this.detectRegularIntervals(pattern.requestTimes)) {
      suspiciousScore += 25;
    }

    pattern.suspiciousScore = Math.min(100, suspiciousScore);

    // Add to blacklist if highly suspicious
    if (pattern.suspiciousScore > 80) {
      this.blacklist.add(ipAddress);
      console.warn('Suspicious traffic pattern detected', {
        ipAddress,
        suspiciousScore: pattern.suspiciousScore,
        requestCount: pattern.requestCount,
        distinctEndpoints: pattern.distinctEndpoints.size,
        userAgents: pattern.userAgents.size,
      });
    }

    this.patternStore.set(key, pattern);
  }

  /**
   * Behavior analysis
   */
  private analyzeBehavior(
    request: NextRequest,
    ipAddress: string,
    userId?: string
  ): NextResponse | null {
    const userAgent = request.headers.get('user-agent') || '';
    const referer = request.headers.get('referer') || '';
    const acceptLanguage = request.headers.get('accept-language') || '';

    let suspiciousScore = 0;

    // Check for bot user agents
    const botPatterns = [
      /bot|crawler|spider|scraper/i,
      /curl|wget|python|java|php/i,
      /postman|insomnia|fiddler/i,
    ];

    for (const pattern of botPatterns) {
      if (pattern.test(userAgent)) {
        suspiciousScore += 40;
        break;
      }
    }

    // Check for missing or suspicious headers
    if (!userAgent || userAgent.length < 10) {
      suspiciousScore += 30;
    }

    if (!acceptLanguage) {
      suspiciousScore += 20;
    }

    // Check for suspicious referrers
    if (referer && /malicious|spam|phishing/i.test(referer)) {
      suspiciousScore += 50;
    }

    // High suspicious score triggers additional protection
    if (suspiciousScore > 70) {
      console.warn('Suspicious behavior detected', {
        ipAddress,
        userId,
        suspiciousScore,
        userAgent,
        referer,
        endpoint: request.nextUrl.pathname,
      });

      return this.createRateLimitResponse(
        'Suspicious activity detected',
        429,
        {
          totalHits: 0,
          totalHitsPerIP: 0,
          resetTime: new Date(Date.now() + 60 * 60 * 1000),
          timeRemaining: 60 * 60 * 1000,
          limit: 0,
          remaining: 0,
          retryAfter: 60 * 60,
          ipAddress,
          endpoint: request.nextUrl.pathname,
        }
      );
    }

    return null;
  }

  /**
   * Calculate suspicious score for an entry
   */
  private calculateSuspiciousScore(entry: RateLimitEntry, now: number): number {
    let score = 0;

    // High request frequency
    if (entry.requestTimes.length > 50) {
      score += 30;
    }

    // Failed requests ratio
    const totalRequests = entry.successfulRequests + entry.failedRequests;
    if (totalRequests > 0) {
      const failureRate = entry.failedRequests / totalRequests;
      if (failureRate > 0.5) {
        score += 25;
      }
    }

    // Multiple endpoints
    if (entry.endpoints.size > 10) {
      score += 20;
    }

    // Multiple user agents
    if (entry.userAgents.size > 3) {
      score += 15;
    }

    // Recent activity burst
    const recentRequests = entry.requestTimes.filter(time => time > now - 60000).length;
    if (recentRequests > 20) {
      score += 25;
    }

    return Math.min(100, score);
  }

  /**
   * Detect regular intervals in request times
   */
  private detectRegularIntervals(times: number[]): boolean {
    if (times.length < 5) return false;

    const intervals = [];
    for (let i = 1; i < times.length; i++) {
      intervals.push(times[i] - times[i - 1]);
    }

    // Check if intervals are consistently similar (within 10% variance)
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => {
      return sum + Math.pow(interval - avgInterval, 2);
    }, 0) / intervals.length;

    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = standardDeviation / avgInterval;

    return coefficientOfVariation < 0.1; // Less than 10% variation
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: NextRequest): string {
    const xForwardedFor = request.headers.get('x-forwarded-for');
    if (xForwardedFor) {
      return xForwardedFor.split(',')[0].trim();
    }

    const xRealIp = request.headers.get('x-real-ip');
    if (xRealIp) {
      return xRealIp;
    }

    const xClientIp = request.headers.get('x-client-ip');
    if (xClientIp) {
      return xClientIp;
    }

    return request.ip || 'unknown';
  }

  /**
   * Get client identifier
   */
  private getClientIdentifier(request: NextRequest): string {
    const ip = this.getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';
    const acceptLanguage = request.headers.get('accept-language') || '';
    
    // Create a hash-based identifier
    return `${ip}:${userAgent.slice(0, 50)}:${acceptLanguage.slice(0, 20)}`;
  }

  /**
   * Get country from IP (simplified implementation)
   */
  private getCountryFromIP(ipAddress: string): string | null {
    // This is a simplified implementation
    // In production, use a proper geolocation service like MaxMind GeoIP
    if (ipAddress.startsWith('192.168.') || ipAddress.startsWith('127.')) {
      return 'US'; // Local/private IPs
    }
    
    // Mock country detection based on IP ranges
    const firstOctet = parseInt(ipAddress.split('.')[0]);
    if (firstOctet >= 1 && firstOctet <= 126) return 'US';
    if (firstOctet >= 128 && firstOctet <= 191) return 'EU';
    if (firstOctet >= 192 && firstOctet <= 223) return 'APAC';
    
    return null;
  }

  /**
   * Create new rate limit entry
   */
  private createNewEntry(now: number): RateLimitEntry {
    return {
      count: 0,
      resetTime: now + this.config.windowMs,
      firstRequest: now,
      lastRequest: now,
      suspiciousScore: 0,
      requestTimes: [],
      endpoints: new Set(),
      userAgents: new Set(),
      failedRequests: 0,
      successfulRequests: 0,
    };
  }

  /**
   * Handle rate limit reached
   */
  private handleLimitReached(request: NextRequest, info: RateLimitInfo): void {
    console.warn('Rate limit exceeded', {
      ipAddress: info.ipAddress,
      endpoint: info.endpoint,
      totalHits: info.totalHits,
      limit: info.limit,
      userAgent: info.userAgent,
    });

    // Add to suspicious list if repeatedly hitting limits
    if (info.totalHits > info.limit * 2) {
      console.warn('Adding IP to suspicious list', {
        ipAddress: info.ipAddress,
        totalHits: info.totalHits,
      });
    }
  }

  /**
   * Create rate limit response
   */
  private createRateLimitResponse(
    message: string,
    status: number,
    info: RateLimitInfo
  ): NextResponse {
    return NextResponse.json(
      {
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        details: {
          limit: info.limit,
          remaining: info.remaining,
          resetTime: info.resetTime,
          retryAfter: info.retryAfter,
        },
      },
      {
        status,
        headers: {
          'X-RateLimit-Limit': info.limit.toString(),
          'X-RateLimit-Remaining': info.remaining.toString(),
          'X-RateLimit-Reset': info.resetTime.toISOString(),
          'Retry-After': info.retryAfter.toString(),
          'X-RateLimit-Reset-After': info.timeRemaining.toString(),
        },
      }
    );
  }

  /**
   * Add IP to whitelist
   */
  public addToWhitelist(ip: string): void {
    this.whitelist.add(ip);
  }

  /**
   * Remove IP from whitelist
   */
  public removeFromWhitelist(ip: string): void {
    this.whitelist.delete(ip);
  }

  /**
   * Add IP to blacklist
   */
  public addToBlacklist(ip: string): void {
    this.blacklist.add(ip);
  }

  /**
   * Remove IP from blacklist
   */
  public removeFromBlacklist(ip: string): void {
    this.blacklist.delete(ip);
  }

  /**
   * Get rate limit statistics
   */
  public getStatistics(): {
    totalIPs: number;
    totalUsers: number;
    totalPatterns: number;
    whitelistSize: number;
    blacklistSize: number;
    topIPs: Array<{ ip: string; count: number; suspiciousScore: number }>;
  } {
    const topIPs: Array<{ ip: string; count: number; suspiciousScore: number }> = [];
    
    for (const [key, entry] of this.ipStore.entries()) {
      if (key.startsWith('ip:')) {
        topIPs.push({
          ip: key.substring(3),
          count: entry.count,
          suspiciousScore: entry.suspiciousScore,
        });
      }
    }

    topIPs.sort((a, b) => b.count - a.count);

    return {
      totalIPs: this.ipStore.size,
      totalUsers: this.userStore.size,
      totalPatterns: this.patternStore.size,
      whitelistSize: this.whitelist.size,
      blacklistSize: this.blacklist.size,
      topIPs: topIPs.slice(0, 10),
    };
  }

  /**
   * Clear all rate limit data
   */
  public clearAllData(): void {
    this.ipStore.clear();
    this.userStore.clear();
    this.patternStore.clear();
  }

  /**
   * Update request status (success/failure)
   */
  public updateRequestStatus(
    request: NextRequest,
    userId: string | undefined,
    success: boolean
  ): void {
    const ipAddress = this.getClientIP(request);
    const ipKey = `ip:${ipAddress}`;
    const ipEntry = this.ipStore.get(ipKey);

    if (ipEntry) {
      if (success) {
        ipEntry.successfulRequests++;
      } else {
        ipEntry.failedRequests++;
      }
      this.ipStore.set(ipKey, ipEntry);
    }

    if (userId) {
      const userKey = `user:${userId}`;
      const userEntry = this.userStore.get(userKey);

      if (userEntry) {
        if (success) {
          userEntry.successfulRequests++;
        } else {
          userEntry.failedRequests++;
        }
        this.userStore.set(userKey, userEntry);
      }
    }
  }
}

// Export default instance
export const defaultRateLimiter = new AdvancedRateLimiter();