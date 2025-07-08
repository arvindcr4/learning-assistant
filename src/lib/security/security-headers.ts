import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Security headers configuration
export interface SecurityHeadersConfig {
  // Content Security Policy
  csp: {
    enabled: boolean;
    directives: {
      defaultSrc: string[];
      scriptSrc: string[];
      styleSrc: string[];
      imgSrc: string[];
      connectSrc: string[];
      fontSrc: string[];
      objectSrc: string[];
      mediaSrc: string[];
      frameSrc: string[];
      frameAncestors: string[];
      childSrc: string[];
      workerSrc: string[];
      manifestSrc: string[];
      formAction: string[];
      upgradeInsecureRequests: boolean;
      blockAllMixedContent: boolean;
    };
    reportUri?: string;
    reportOnly: boolean;
    nonce: boolean;
  };

  // HTTP Strict Transport Security
  hsts: {
    enabled: boolean;
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };

  // Cross-Origin Resource Sharing
  cors: {
    enabled: boolean;
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    allowCredentials: boolean;
    maxAge: number;
    preflightContinue: boolean;
    optionsSuccessStatus: number;
  };

  // X-Frame-Options
  frameOptions: {
    enabled: boolean;
    value: 'DENY' | 'SAMEORIGIN' | string; // ALLOW-FROM uri
  };

  // X-Content-Type-Options
  contentTypeOptions: {
    enabled: boolean;
    nosniff: boolean;
  };

  // X-XSS-Protection
  xssProtection: {
    enabled: boolean;
    mode: 'block' | 'report';
    reportUri?: string;
  };

  // Referrer Policy
  referrerPolicy: {
    enabled: boolean;
    policy: 'no-referrer' | 'no-referrer-when-downgrade' | 'origin' | 'origin-when-cross-origin' | 
            'same-origin' | 'strict-origin' | 'strict-origin-when-cross-origin' | 'unsafe-url';
  };

  // Permissions Policy (Feature Policy)
  permissionsPolicy: {
    enabled: boolean;
    directives: Record<string, string[]>;
  };

  // Expect-CT
  expectCT: {
    enabled: boolean;
    maxAge: number;
    enforce: boolean;
    reportUri?: string;
  };

  // Clear-Site-Data
  clearSiteData: {
    enabled: boolean;
    directives: ('cache' | 'cookies' | 'storage' | 'executionContexts' | '*')[];
  };

  // Cross-Origin Embedder Policy
  coep: {
    enabled: boolean;
    policy: 'unsafe-none' | 'require-corp' | 'credentialless';
  };

  // Cross-Origin Opener Policy
  coop: {
    enabled: boolean;
    policy: 'unsafe-none' | 'same-origin-allow-popups' | 'same-origin';
  };

  // Cross-Origin Resource Policy
  corp: {
    enabled: boolean;
    policy: 'same-site' | 'same-origin' | 'cross-origin';
  };

  // Additional security headers
  additional: Record<string, string>;

  // Environment-specific overrides
  environments: {
    development?: Partial<SecurityHeadersConfig>;
    production?: Partial<SecurityHeadersConfig>;
    test?: Partial<SecurityHeadersConfig>;
  };
}

// Default security configuration
const defaultConfig: SecurityHeadersConfig = {
  csp: {
    enabled: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://api.openai.com", "wss://", "ws://"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "blob:", "data:"],
      frameSrc: ["'none'"],
      frameAncestors: ["'self'"],
      childSrc: ["'self'"],
      workerSrc: ["'self'", "blob:"],
      manifestSrc: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: true,
      blockAllMixedContent: true,
    },
    reportOnly: false,
    nonce: true,
  },

  hsts: {
    enabled: true,
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },

  cors: {
    enabled: true,
    allowedOrigins: ['http://localhost:3000', 'https://localhost:3000'],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Accept',
      'Accept-Language',
      'Content-Language',
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-API-Key',
      'X-CSRF-Token',
      'X-Client-Version',
    ],
    exposedHeaders: [
      'X-Total-Count',
      'X-Page-Count',
      'X-Rate-Limit-Limit',
      'X-Rate-Limit-Remaining',
      'X-Rate-Limit-Reset',
    ],
    allowCredentials: true,
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204,
  },

  frameOptions: {
    enabled: true,
    value: 'DENY',
  },

  contentTypeOptions: {
    enabled: true,
    nosniff: true,
  },

  xssProtection: {
    enabled: true,
    mode: 'block',
  },

  referrerPolicy: {
    enabled: true,
    policy: 'strict-origin-when-cross-origin',
  },

  permissionsPolicy: {
    enabled: true,
    directives: {
      camera: [],
      microphone: [],
      geolocation: [],
      'interest-cohort': [],
      'user-id': [],
      'browsing-topics': [],
      'payment': ["'self'"],
      'fullscreen': ["'self'"],
      'display-capture': [],
    },
  },

  expectCT: {
    enabled: false, // Deprecated, keeping for compatibility
    maxAge: 86400,
    enforce: false,
  },

  clearSiteData: {
    enabled: false,
    directives: [],
  },

  coep: {
    enabled: false,
    policy: 'unsafe-none',
  },

  coop: {
    enabled: true,
    policy: 'same-origin-allow-popups',
  },

  corp: {
    enabled: true,
    policy: 'same-site',
  },

  additional: {
    'X-DNS-Prefetch-Control': 'off',
    'X-Download-Options': 'noopen',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'X-Robots-Tag': 'noindex, nofollow, nosnippet, noarchive',
    'Server': '', // Remove server information
  },

  environments: {
    development: {
      csp: {
        directives: {
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
          connectSrc: ["'self'", "ws://localhost:*", "wss://localhost:*", "http://localhost:*", "https://localhost:*", "https://api.openai.com"],
        },
        reportOnly: true,
      },
      cors: {
        allowedOrigins: ['*'],
      },
      additional: {
        'X-Robots-Tag': 'noindex, nofollow',
      },
    },
    production: {
      csp: {
        directives: {
          scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
          connectSrc: ["'self'", "https://api.openai.com"],
        },
        reportOnly: false,
      },
      hsts: {
        maxAge: 63072000, // 2 years
        preload: true,
      },
    },
  },
};

export class SecurityHeadersService {
  private config: SecurityHeadersConfig;
  private nonces: Map<string, string>;
  private environment: string;

  constructor(
    config: Partial<SecurityHeadersConfig> = {},
    environment: string = process.env.NODE_ENV || 'development'
  ) {
    this.environment = environment;
    this.config = this.mergeConfig(defaultConfig, config);
    this.nonces = new Map();

    // Apply environment-specific overrides
    const envOverrides = this.config.environments[environment as keyof typeof this.config.environments];
    if (envOverrides) {
      this.config = this.mergeConfig(this.config, envOverrides);
    }
  }

  /**
   * Create security headers middleware
   */
  public createMiddleware() {
    return (request: NextRequest): NextResponse | null => {
      // Handle preflight requests for CORS
      if (request.method === 'OPTIONS' && this.config.cors.enabled) {
        return this.handleCORSPreflight(request);
      }

      return null; // Continue to next middleware
    };
  }

  /**
   * Apply security headers to response
   */
  public applyHeaders(response: NextResponse, request: NextRequest, options: {
    generateNonce?: boolean;
    skipCORS?: boolean;
    customHeaders?: Record<string, string>;
  } = {}): NextResponse {
    const { generateNonce = false, skipCORS = false, customHeaders = {} } = options;

    // Generate nonce for CSP if enabled
    let nonce: string | undefined;
    if (this.config.csp.enabled && this.config.csp.nonce && generateNonce) {
      nonce = this.generateNonce();
      this.storeNonce(request, nonce);
    }

    // Apply Content Security Policy
    if (this.config.csp.enabled) {
      this.applyCspHeader(response, nonce);
    }

    // Apply HSTS
    if (this.config.hsts.enabled) {
      this.applyHstsHeader(response);
    }

    // Apply CORS headers
    if (this.config.cors.enabled && !skipCORS) {
      this.applyCorsHeaders(response, request);
    }

    // Apply X-Frame-Options
    if (this.config.frameOptions.enabled) {
      response.headers.set('X-Frame-Options', this.config.frameOptions.value);
    }

    // Apply X-Content-Type-Options
    if (this.config.contentTypeOptions.enabled && this.config.contentTypeOptions.nosniff) {
      response.headers.set('X-Content-Type-Options', 'nosniff');
    }

    // Apply X-XSS-Protection
    if (this.config.xssProtection.enabled) {
      const xssValue = this.config.xssProtection.mode === 'block' ? '1; mode=block' : '0';
      response.headers.set('X-XSS-Protection', xssValue);
    }

    // Apply Referrer Policy
    if (this.config.referrerPolicy.enabled) {
      response.headers.set('Referrer-Policy', this.config.referrerPolicy.policy);
    }

    // Apply Permissions Policy
    if (this.config.permissionsPolicy.enabled) {
      this.applyPermissionsPolicyHeader(response);
    }

    // Apply Expect-CT (if enabled)
    if (this.config.expectCT.enabled) {
      this.applyExpectCtHeader(response);
    }

    // Apply Clear-Site-Data (if enabled)
    if (this.config.clearSiteData.enabled && this.config.clearSiteData.directives.length > 0) {
      const clearSiteDataValue = this.config.clearSiteData.directives.map(d => `"${d}"`).join(', ');
      response.headers.set('Clear-Site-Data', clearSiteDataValue);
    }

    // Apply Cross-Origin Embedder Policy
    if (this.config.coep.enabled) {
      response.headers.set('Cross-Origin-Embedder-Policy', this.config.coep.policy);
    }

    // Apply Cross-Origin Opener Policy
    if (this.config.coop.enabled) {
      response.headers.set('Cross-Origin-Opener-Policy', this.config.coop.policy);
    }

    // Apply Cross-Origin Resource Policy
    if (this.config.corp.enabled) {
      response.headers.set('Cross-Origin-Resource-Policy', this.config.corp.policy);
    }

    // Apply additional headers
    Object.entries(this.config.additional).forEach(([name, value]) => {
      response.headers.set(name, value);
    });

    // Apply custom headers
    Object.entries(customHeaders).forEach(([name, value]) => {
      response.headers.set(name, value);
    });

    // Add security timestamp
    response.headers.set('X-Security-Applied', new Date().toISOString());

    return response;
  }

  /**
   * Handle CORS preflight requests
   */
  private handleCORSPreflight(request: NextRequest): NextResponse {
    const response = new NextResponse(null, { status: this.config.cors.optionsSuccessStatus });
    this.applyCorsHeaders(response, request);
    return response;
  }

  /**
   * Apply Content Security Policy header
   */
  private applyCspHeader(response: NextResponse, nonce?: string): void {
    const directives: string[] = [];

    // Build CSP directives
    Object.entries(this.config.csp.directives).forEach(([key, values]) => {
      if (key === 'upgradeInsecureRequests' || key === 'blockAllMixedContent') {
        if (values === true) {
          directives.push(this.camelToKebab(key));
        }
      } else if (Array.isArray(values) && values.length > 0) {
        let directiveValues = [...values];
        
        // Add nonce to script-src and style-src if enabled
        if (nonce && (key === 'scriptSrc' || key === 'styleSrc')) {
          directiveValues.push(`'nonce-${nonce}'`);
        }
        
        directives.push(`${this.camelToKebab(key)} ${directiveValues.join(' ')}`);
      }
    });

    // Add report-uri if specified
    if (this.config.csp.reportUri) {
      directives.push(`report-uri ${this.config.csp.reportUri}`);
    }

    const cspValue = directives.join('; ');
    const headerName = this.config.csp.reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
    
    response.headers.set(headerName, cspValue);

    // Set nonce in response for client access
    if (nonce) {
      response.headers.set('X-CSP-Nonce', nonce);
    }
  }

  /**
   * Apply HSTS header
   */
  private applyHstsHeader(response: NextResponse): void {
    let hstsValue = `max-age=${this.config.hsts.maxAge}`;
    
    if (this.config.hsts.includeSubDomains) {
      hstsValue += '; includeSubDomains';
    }
    
    if (this.config.hsts.preload) {
      hstsValue += '; preload';
    }
    
    response.headers.set('Strict-Transport-Security', hstsValue);
  }

  /**
   * Apply CORS headers
   */
  private applyCorsHeaders(response: NextResponse, request: NextRequest): void {
    const origin = request.headers.get('origin');
    const requestMethod = request.headers.get('access-control-request-method');
    const requestHeaders = request.headers.get('access-control-request-headers');

    // Check if origin is allowed
    const isOriginAllowed = this.isOriginAllowed(origin);
    
    if (isOriginAllowed) {
      if (origin) {
        response.headers.set('Access-Control-Allow-Origin', origin);
      } else if (this.config.cors.allowedOrigins.includes('*')) {
        response.headers.set('Access-Control-Allow-Origin', '*');
      }
    }

    // Set allowed methods
    response.headers.set('Access-Control-Allow-Methods', this.config.cors.allowedMethods.join(', '));

    // Set allowed headers
    if (requestHeaders) {
      const requestedHeaders = requestHeaders.split(',').map(h => h.trim());
      const allowedRequestHeaders = requestedHeaders.filter(header => 
        this.config.cors.allowedHeaders.some(allowed => 
          allowed.toLowerCase() === header.toLowerCase() || allowed === '*'
        )
      );
      response.headers.set('Access-Control-Allow-Headers', allowedRequestHeaders.join(', '));
    } else {
      response.headers.set('Access-Control-Allow-Headers', this.config.cors.allowedHeaders.join(', '));
    }

    // Set exposed headers
    if (this.config.cors.exposedHeaders.length > 0) {
      response.headers.set('Access-Control-Expose-Headers', this.config.cors.exposedHeaders.join(', '));
    }

    // Set credentials
    if (this.config.cors.allowCredentials && origin !== '*') {
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }

    // Set max age for preflight cache
    response.headers.set('Access-Control-Max-Age', this.config.cors.maxAge.toString());

    // Add vary header for proper caching
    const varyHeaders = ['Origin'];
    if (requestMethod) varyHeaders.push('Access-Control-Request-Method');
    if (requestHeaders) varyHeaders.push('Access-Control-Request-Headers');
    
    const existingVary = response.headers.get('Vary');
    const newVary = existingVary ? `${existingVary}, ${varyHeaders.join(', ')}` : varyHeaders.join(', ');
    response.headers.set('Vary', newVary);
  }

  /**
   * Apply Permissions Policy header
   */
  private applyPermissionsPolicyHeader(response: NextResponse): void {
    const policies: string[] = [];
    
    Object.entries(this.config.permissionsPolicy.directives).forEach(([feature, allowlist]) => {
      if (allowlist.length === 0) {
        policies.push(`${feature}=()`);
      } else {
        const origins = allowlist.map(origin => origin === 'self' ? '"self"' : origin).join(' ');
        policies.push(`${feature}=(${origins})`);
      }
    });

    if (policies.length > 0) {
      response.headers.set('Permissions-Policy', policies.join(', '));
    }
  }

  /**
   * Apply Expect-CT header
   */
  private applyExpectCtHeader(response: NextResponse): void {
    let expectCtValue = `max-age=${this.config.expectCT.maxAge}`;
    
    if (this.config.expectCT.enforce) {
      expectCtValue += ', enforce';
    }
    
    if (this.config.expectCT.reportUri) {
      expectCtValue += `, report-uri="${this.config.expectCT.reportUri}"`;
    }
    
    response.headers.set('Expect-CT', expectCtValue);
  }

  /**
   * Check if origin is allowed
   */
  private isOriginAllowed(origin: string | null): boolean {
    if (!origin) {
      return true; // Same-origin requests don't have origin header
    }

    if (this.config.cors.allowedOrigins.includes('*')) {
      return true;
    }

    return this.config.cors.allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin === origin) {
        return true;
      }
      
      // Support wildcard subdomains
      if (allowedOrigin.startsWith('*.')) {
        const domain = allowedOrigin.substring(2);
        return origin.endsWith(`.${domain}`) || origin === domain;
      }
      
      return false;
    });
  }

  /**
   * Generate cryptographically secure nonce
   */
  private generateNonce(): string {
    return crypto.randomBytes(16).toString('base64');
  }

  /**
   * Store nonce for request
   */
  private storeNonce(request: NextRequest, nonce: string): void {
    const requestId = this.getRequestId(request);
    this.nonces.set(requestId, nonce);
    
    // Clean up old nonces (keep last 1000)
    if (this.nonces.size > 1000) {
      const entries = Array.from(this.nonces.entries());
      entries.slice(0, entries.length - 1000).forEach(([key]) => {
        this.nonces.delete(key);
      });
    }
  }

  /**
   * Get nonce for request
   */
  public getNonce(request: NextRequest): string | undefined {
    const requestId = this.getRequestId(request);
    return this.nonces.get(requestId);
  }

  /**
   * Get request ID
   */
  private getRequestId(request: NextRequest): string {
    // Use URL + timestamp as request ID (simple approach)
    return `${request.url}:${Date.now()}`;
  }

  /**
   * Convert camelCase to kebab-case
   */
  private camelToKebab(str: string): string {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
  }

  /**
   * Merge configuration objects
   */
  private mergeConfig(
    base: SecurityHeadersConfig,
    override: Partial<SecurityHeadersConfig>
  ): SecurityHeadersConfig {
    const merged = { ...base };

    Object.entries(override).forEach(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        merged[key as keyof SecurityHeadersConfig] = {
          ...(merged[key as keyof SecurityHeadersConfig] as any),
          ...value,
        };
      } else {
        (merged as any)[key] = value;
      }
    });

    return merged;
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<SecurityHeadersConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
  }

  /**
   * Get current configuration
   */
  public getConfig(): SecurityHeadersConfig {
    return { ...this.config };
  }

  /**
   * Validate security headers in response
   */
  public validateHeaders(response: NextResponse): {
    valid: boolean;
    missing: string[];
    warnings: string[];
  } {
    const missing: string[] = [];
    const warnings: string[] = [];

    // Check required security headers
    const requiredHeaders = [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Strict-Transport-Security',
    ];

    requiredHeaders.forEach(header => {
      if (!response.headers.get(header)) {
        missing.push(header);
      }
    });

    // Check CSP
    if (this.config.csp.enabled && !response.headers.get('Content-Security-Policy') && !response.headers.get('Content-Security-Policy-Report-Only')) {
      missing.push('Content-Security-Policy');
    }

    // Check for potentially insecure configurations
    const csp = response.headers.get('Content-Security-Policy') || response.headers.get('Content-Security-Policy-Report-Only');
    if (csp && csp.includes("'unsafe-eval'")) {
      warnings.push("CSP contains 'unsafe-eval' which may be insecure");
    }

    const frameOptions = response.headers.get('X-Frame-Options');
    if (frameOptions && frameOptions.toUpperCase() === 'ALLOWALL') {
      warnings.push('X-Frame-Options set to ALLOWALL may be insecure');
    }

    return {
      valid: missing.length === 0,
      missing,
      warnings,
    };
  }

  /**
   * Generate security report
   */
  public generateSecurityReport(): {
    timestamp: string;
    environment: string;
    enabledFeatures: string[];
    securityScore: number;
    recommendations: string[];
  } {
    const enabledFeatures: string[] = [];
    const recommendations: string[] = [];
    let securityScore = 0;

    // Check enabled features
    if (this.config.csp.enabled) {
      enabledFeatures.push('Content Security Policy');
      securityScore += 25;
    } else {
      recommendations.push('Enable Content Security Policy for XSS protection');
    }

    if (this.config.hsts.enabled) {
      enabledFeatures.push('HTTP Strict Transport Security');
      securityScore += 20;
    } else {
      recommendations.push('Enable HSTS for transport security');
    }

    if (this.config.cors.enabled) {
      enabledFeatures.push('CORS Protection');
      securityScore += 15;
    }

    if (this.config.frameOptions.enabled) {
      enabledFeatures.push('Frame Options Protection');
      securityScore += 10;
    }

    if (this.config.contentTypeOptions.enabled) {
      enabledFeatures.push('Content Type Options');
      securityScore += 10;
    }

    if (this.config.xssProtection.enabled) {
      enabledFeatures.push('XSS Protection');
      securityScore += 10;
    }

    if (this.config.referrerPolicy.enabled) {
      enabledFeatures.push('Referrer Policy');
      securityScore += 10;
    }

    // Environment-specific recommendations
    if (this.environment === 'production') {
      if (this.config.csp.reportOnly) {
        recommendations.push('Disable CSP report-only mode in production');
        securityScore -= 5;
      }
      
      if (this.config.cors.allowedOrigins.includes('*')) {
        recommendations.push('Restrict CORS origins in production');
        securityScore -= 10;
      }
    }

    return {
      timestamp: new Date().toISOString(),
      environment: this.environment,
      enabledFeatures,
      securityScore: Math.max(0, Math.min(100, securityScore)),
      recommendations,
    };
  }
}

// Export default instance
export const securityHeaders = new SecurityHeadersService();