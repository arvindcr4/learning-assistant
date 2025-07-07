import { NextRequest, NextResponse } from 'next/server';
import { advancedValidator } from './advanced-validation';
import { distributedRateLimiter } from './distributed-rate-limiter';
import { z } from 'zod';

export interface SecurityConfig {
  enableValidation: boolean;
  enableRateLimit: boolean;
  enableCSRF: boolean;
  enableCORS: boolean;
  enableLogging: boolean;
  maxRequestSize: number;
  allowedOrigins: string[];
  blockedUserAgents: string[];
}

export interface SecurityContext {
  request: NextRequest;
  ipAddress: string;
  userAgent: string;
  origin?: string;
  userId?: string;
  userRole?: string;
}

export interface SecurityResult {
  allowed: boolean;
  response?: NextResponse;
  threats: string[];
  metadata: Record<string, any>;
}

/**
 * Comprehensive API Security Middleware
 */
export class APISecurityMiddleware {
  private config: SecurityConfig;

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      enableValidation: true,
      enableRateLimit: true,
      enableCSRF: true,
      enableCORS: true,
      enableLogging: true,
      maxRequestSize: 10 * 1024 * 1024, // 10MB
      allowedOrigins: ['http://localhost:3000'],
      blockedUserAgents: [
        /bot/i,
        /crawler/i,
        /spider/i,
        /scraper/i,
        /curl/i,
        /wget/i,
      ],
      ...config,
    };
  }

  /**
   * Main security check function
   */
  async checkSecurity(request: NextRequest): Promise<SecurityResult> {
    const context = this.buildSecurityContext(request);
    const threats: string[] = [];
    const metadata: Record<string, any> = {};

    try {
      // 1. Basic security checks
      const basicCheck = await this.performBasicChecks(context);
      if (!basicCheck.allowed) {
        return basicCheck;
      }
      threats.push(...basicCheck.threats);
      Object.assign(metadata, basicCheck.metadata);

      // 2. Rate limiting
      if (this.config.enableRateLimit) {
        const rateLimitCheck = await this.checkRateLimit(context);
        if (!rateLimitCheck.allowed) {
          return rateLimitCheck;
        }
        threats.push(...rateLimitCheck.threats);
        Object.assign(metadata, rateLimitCheck.metadata);
      }

      // 3. Input validation (for POST/PUT/PATCH requests)
      if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
        const validationCheck = await this.validateInput(context);
        if (!validationCheck.allowed) {
          return validationCheck;
        }
        threats.push(...validationCheck.threats);
        Object.assign(metadata, validationCheck.metadata);
      }

      // 4. CSRF protection
      if (this.config.enableCSRF && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
        const csrfCheck = await this.checkCSRF(context);
        if (!csrfCheck.allowed) {
          return csrfCheck;
        }
        threats.push(...csrfCheck.threats);
        Object.assign(metadata, csrfCheck.metadata);
      }

      // 5. CORS validation
      if (this.config.enableCORS && context.origin) {
        const corsCheck = await this.checkCORS(context);
        if (!corsCheck.allowed) {
          return corsCheck;
        }
        threats.push(...corsCheck.threats);
        Object.assign(metadata, corsCheck.metadata);
      }

      // 6. Advanced threat detection
      const threatCheck = await this.detectAdvancedThreats(context);
      threats.push(...threatCheck.threats);
      Object.assign(metadata, threatCheck.metadata);

      // Log security events if enabled
      if (this.config.enableLogging && threats.length > 0) {
        this.logSecurityEvent(context, threats, metadata);
      }

      return {
        allowed: true,
        threats,
        metadata,
      };

    } catch (error) {
      console.error('Security middleware error:', error);
      return {
        allowed: false,
        response: NextResponse.json(
          { 
            error: 'Security check failed',
            code: 'SECURITY_ERROR'
          },
          { status: 500 }
        ),
        threats: ['security_system_error'],
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * Build security context from request
   */
  private buildSecurityContext(request: NextRequest): SecurityContext {
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : 
                     request.headers.get('x-real-ip') || 
                     request.ip || 
                     'unknown';

    return {
      request,
      ipAddress,
      userAgent: request.headers.get('user-agent') || '',
      origin: request.headers.get('origin') || undefined,
      userId: request.headers.get('x-user-id') || undefined,
      userRole: request.headers.get('x-user-role') || undefined,
    };
  }

  /**
   * Perform basic security checks
   */
  private async performBasicChecks(context: SecurityContext): Promise<SecurityResult> {
    const threats: string[] = [];
    const metadata: Record<string, any> = {};

    // Check request size
    const contentLength = parseInt(context.request.headers.get('content-length') || '0');
    if (contentLength > this.config.maxRequestSize) {
      return {
        allowed: false,
        response: NextResponse.json(
          { 
            error: 'Request too large',
            code: 'REQUEST_TOO_LARGE',
            maxSize: this.config.maxRequestSize
          },
          { status: 413 }
        ),
        threats: ['request_too_large'],
        metadata: { requestSize: contentLength },
      };
    }

    // Check user agent
    if (this.isBlockedUserAgent(context.userAgent)) {
      threats.push('blocked_user_agent');
      return {
        allowed: false,
        response: NextResponse.json(
          { 
            error: 'Forbidden',
            code: 'BLOCKED_USER_AGENT'
          },
          { status: 403 }
        ),
        threats,
        metadata: { userAgent: context.userAgent },
      };
    }

    // Check for malicious headers
    const maliciousHeaders = this.checkMaliciousHeaders(context.request);
    if (maliciousHeaders.length > 0) {
      threats.push(...maliciousHeaders);
    }

    // Check request method
    const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
    if (!allowedMethods.includes(context.request.method)) {
      return {
        allowed: false,
        response: NextResponse.json(
          { 
            error: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED'
          },
          { status: 405 }
        ),
        threats: ['invalid_method'],
        metadata: { method: context.request.method },
      };
    }

    return {
      allowed: true,
      threats,
      metadata,
    };
  }

  /**
   * Check rate limiting
   */
  private async checkRateLimit(context: SecurityContext): Promise<SecurityResult> {
    try {
      const results = await distributedRateLimiter.checkRequest(context.request);
      const blockedResult = results.find(r => !r.allowed);
      
      if (blockedResult) {
        return {
          allowed: false,
          response: NextResponse.json(
            {
              error: 'Rate limit exceeded',
              code: 'RATE_LIMIT_EXCEEDED',
              retryAfter: blockedResult.retryAfter,
              rule: blockedResult.rule.id,
            },
            { 
              status: 429,
              headers: {
                'Retry-After': blockedResult.retryAfter?.toString() || '60',
                'X-RateLimit-Limit': blockedResult.rule.maxRequests.toString(),
                'X-RateLimit-Remaining': blockedResult.remaining.toString(),
                'X-RateLimit-Reset': Math.ceil(blockedResult.resetTime.getTime() / 1000).toString(),
              }
            }
          ),
          threats: ['rate_limit_exceeded'],
          metadata: { 
            rule: blockedResult.rule.id,
            remaining: blockedResult.remaining,
            resetTime: blockedResult.resetTime,
          },
        };
      }

      return {
        allowed: true,
        threats: [],
        metadata: { rateLimitResults: results },
      };
    } catch (error) {
      console.error('Rate limit check error:', error);
      return {
        allowed: true, // Fail open for rate limiting
        threats: ['rate_limit_check_error'],
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * Validate input data
   */
  private async validateInput(context: SecurityContext): Promise<SecurityResult> {
    try {
      const contentType = context.request.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        try {
          const body = await context.request.clone().json();
          const validation = advancedValidator.validateObject(body);
          
          if (!validation.isValid) {
            return {
              allowed: false,
              response: NextResponse.json(
                {
                  error: 'Invalid input data',
                  code: 'INVALID_INPUT',
                  threats: validation.threats,
                  errors: validation.errors,
                },
                { status: 400 }
              ),
              threats: validation.threats,
              metadata: { validationErrors: validation.errors },
            };
          }

          return {
            allowed: true,
            threats: validation.threats,
            metadata: { sanitizedBody: validation.sanitized },
          };
        } catch (error) {
          return {
            allowed: false,
            response: NextResponse.json(
              {
                error: 'Invalid JSON',
                code: 'INVALID_JSON',
              },
              { status: 400 }
            ),
            threats: ['invalid_json'],
            metadata: {},
          };
        }
      }

      if (contentType.includes('application/x-www-form-urlencoded')) {
        try {
          const formData = await context.request.clone().formData();
          const threats: string[] = [];
          
          for (const [key, value] of formData.entries()) {
            if (typeof value === 'string') {
              const validation = advancedValidator.validateInput(value, 'html');
              if (!validation.isValid) {
                threats.push(...validation.threats);
              }
            }
          }

          if (threats.length > 0) {
            return {
              allowed: false,
              response: NextResponse.json(
                {
                  error: 'Invalid form data',
                  code: 'INVALID_FORM_DATA',
                  threats,
                },
                { status: 400 }
              ),
              threats,
              metadata: {},
            };
          }

          return {
            allowed: true,
            threats: [],
            metadata: {},
          };
        } catch (error) {
          return {
            allowed: false,
            response: NextResponse.json(
              {
                error: 'Invalid form data',
                code: 'INVALID_FORM_DATA',
              },
              { status: 400 }
            ),
            threats: ['invalid_form_data'],
            metadata: {},
          };
        }
      }

      return {
        allowed: true,
        threats: [],
        metadata: {},
      };
    } catch (error) {
      console.error('Input validation error:', error);
      return {
        allowed: false,
        response: NextResponse.json(
          {
            error: 'Input validation failed',
            code: 'VALIDATION_ERROR',
          },
          { status: 500 }
        ),
        threats: ['validation_system_error'],
        metadata: {},
      };
    }
  }

  /**
   * Check CSRF protection
   */
  private async checkCSRF(context: SecurityContext): Promise<SecurityResult> {
    // Skip CSRF for certain endpoints
    const skipCSRF = [
      '/api/auth/login',
      '/api/auth/register',
      '/api/webhook',
      '/api/health',
    ];

    if (skipCSRF.some(path => context.request.nextUrl.pathname.startsWith(path))) {
      return {
        allowed: true,
        threats: [],
        metadata: { csrfSkipped: true },
      };
    }

    // Check for CSRF token
    const csrfToken = context.request.headers.get('x-csrf-token') ||
                     context.request.headers.get('x-requested-with');

    if (!csrfToken) {
      return {
        allowed: false,
        response: NextResponse.json(
          {
            error: 'CSRF token required',
            code: 'CSRF_TOKEN_REQUIRED',
          },
          { status: 403 }
        ),
        threats: ['missing_csrf_token'],
        metadata: {},
      };
    }

    // Additional CSRF validation would go here
    // For now, we just check presence

    return {
      allowed: true,
      threats: [],
      metadata: { csrfToken: csrfToken.substring(0, 10) + '...' },
    };
  }

  /**
   * Check CORS policy
   */
  private async checkCORS(context: SecurityContext): Promise<SecurityResult> {
    if (!context.origin) {
      return {
        allowed: true,
        threats: [],
        metadata: {},
      };
    }

    const isAllowed = this.config.allowedOrigins.includes('*') ||
                     this.config.allowedOrigins.includes(context.origin);

    if (!isAllowed) {
      return {
        allowed: false,
        response: NextResponse.json(
          {
            error: 'CORS policy violation',
            code: 'CORS_VIOLATION',
          },
          { status: 403 }
        ),
        threats: ['cors_violation'],
        metadata: { origin: context.origin },
      };
    }

    return {
      allowed: true,
      threats: [],
      metadata: { corsValidated: true },
    };
  }

  /**
   * Detect advanced threats
   */
  private async detectAdvancedThreats(context: SecurityContext): Promise<SecurityResult> {
    const threats: string[] = [];
    const metadata: Record<string, any> = {};

    // Check for suspicious request patterns
    const path = context.request.nextUrl.pathname;
    const query = context.request.nextUrl.search;

    // Path traversal detection
    if (/\.\.|\/\.\.|\.\.\/|\.\.\\/.test(path + query)) {
      threats.push('path_traversal_attempt');
    }

    // SQL injection patterns in URL
    const sqlPatterns = [
      /union.*select/i,
      /drop.*table/i,
      /insert.*into/i,
      /delete.*from/i,
      /update.*set/i,
    ];

    for (const pattern of sqlPatterns) {
      if (pattern.test(path + query)) {
        threats.push('sql_injection_attempt');
        break;
      }
    }

    // XSS patterns in URL
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /onload=/i,
      /onerror=/i,
    ];

    for (const pattern of xssPatterns) {
      if (pattern.test(path + query)) {
        threats.push('xss_attempt');
        break;
      }
    }

    // Check for scanning attempts
    const scanningPatterns = [
      /\/wp-admin/i,
      /\/admin/i,
      /phpmyadmin/i,
      /\.php$/i,
      /\.asp$/i,
      /\.jsp$/i,
    ];

    for (const pattern of scanningPatterns) {
      if (pattern.test(path)) {
        threats.push('scanning_attempt');
        break;
      }
    }

    // Suspicious user agent patterns
    if (this.isSuspiciousUserAgent(context.userAgent)) {
      threats.push('suspicious_user_agent');
    }

    return {
      allowed: true,
      threats,
      metadata,
    };
  }

  /**
   * Check for blocked user agents
   */
  private isBlockedUserAgent(userAgent: string): boolean {
    return this.config.blockedUserAgents.some(pattern => {
      if (pattern instanceof RegExp) {
        return pattern.test(userAgent);
      }
      return userAgent.toLowerCase().includes(pattern.toLowerCase());
    });
  }

  /**
   * Check for suspicious user agents
   */
  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /python/i,
      /java/i,
      /perl/i,
      /ruby/i,
      /^$/,
      /sqlmap/i,
      /nikto/i,
      /nmap/i,
      /masscan/i,
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Check for malicious headers
   */
  private checkMaliciousHeaders(request: NextRequest): string[] {
    const threats: string[] = [];

    // Check for header injection
    for (const [name, value] of request.headers.entries()) {
      if (/[\r\n]/.test(name) || /[\r\n]/.test(value)) {
        threats.push('header_injection');
      }

      // Check for suspicious header values
      if (value.length > 8192) { // Very long header value
        threats.push('oversized_header');
      }
    }

    return threats;
  }

  /**
   * Log security events
   */
  private logSecurityEvent(
    context: SecurityContext,
    threats: string[],
    metadata: Record<string, any>
  ): void {
    const event = {
      timestamp: new Date().toISOString(),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      origin: context.origin,
      userId: context.userId,
      userRole: context.userRole,
      method: context.request.method,
      path: context.request.nextUrl.pathname,
      threats,
      metadata,
    };

    console.warn('Security Event:', JSON.stringify(event, null, 2));

    // In production, you would send this to your security monitoring system
    // Example: await securityMonitor.logEvent(event);
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const apiSecurityMiddleware = new APISecurityMiddleware();