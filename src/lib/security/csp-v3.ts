import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export interface CSPv3Config {
  // Basic directives
  defaultSrc: string[];
  scriptSrc: string[];
  styleSrc: string[];
  imgSrc: string[];
  connectSrc: string[];
  fontSrc: string[];
  objectSrc: string[];
  mediaSrc: string[];
  manifestSrc: string[];
  
  // Frame directives
  frameSrc: string[];
  frameAncestors: string[];
  childSrc: string[];
  workerSrc: string[];
  
  // Form directives
  formAction: string[];
  
  // Base and navigation
  baseUri: string[];
  navigateTo?: string[];
  
  // Mixed content
  upgradeInsecureRequests: boolean;
  blockAllMixedContent: boolean;
  
  // Reporting
  reportUri?: string;
  reportTo?: string;
  
  // CSP Level 3 features
  strictDynamic: boolean;
  trustedTypes?: {
    enabled: boolean;
    allowDuplicates?: boolean;
    policies?: string[];
  };
  requireSriFor?: ('script' | 'style' | 'font')[];
  
  // Environment-specific settings
  nonce: {
    enabled: boolean;
    algorithm: 'sha256' | 'sha384' | 'sha512';
    length: number;
  };
  
  // Development settings
  development: {
    unsafeInline: boolean;
    unsafeEval: boolean;
    reportOnly: boolean;
  };
  
  // Violation handling
  violationCallback?: (violation: CSPViolation) => void;
}

export interface CSPViolation {
  documentUri: string;
  referrer: string;
  violatedDirective: string;
  originalPolicy: string;
  blockedUri: string;
  statusCode: number;
  lineNumber?: number;
  columnNumber?: number;
  sourceFile?: string;
  scriptSample?: string;
  disposition: 'enforce' | 'report';
  timestamp: Date;
  userAgent: string;
  ipAddress?: string;
  userId?: string;
}

export interface NonceInfo {
  value: string;
  algorithm: string;
  createdAt: Date;
  usedFor: ('script' | 'style')[];
}

export class CSPv3Service {
  private config: CSPv3Config;
  private violations: CSPViolation[] = [];
  private nonces: Map<string, NonceInfo> = new Map();
  private trustedScripts: Set<string> = new Set();
  private trustedStyles: Set<string> = new Set();

  constructor(config: Partial<CSPv3Config> = {}) {
    this.config = this.mergeWithDefaults(config);
    this.setupViolationHandler();
  }

  /**
   * Generate CSP header with nonce
   */
  generateCSPHeader(request: NextRequest, options: {
    generateNonce?: boolean;
    includeReporting?: boolean;
    strictMode?: boolean;
  } = {}): {
    header: string;
    nonce?: string;
    reportOnly: boolean;
  } {
    const { generateNonce = true, includeReporting = true, strictMode = false } = options;
    
    let nonce: string | undefined;
    
    if (this.config.nonce.enabled && generateNonce) {
      nonce = this.generateNonce();
      this.storeNonce(nonce);
    }

    const directives: string[] = [];
    
    // Build directives
    this.addDirective(directives, 'default-src', this.config.defaultSrc);
    this.addDirective(directives, 'script-src', this.buildScriptSrc(nonce, strictMode));
    this.addDirective(directives, 'style-src', this.buildStyleSrc(nonce, strictMode));
    this.addDirective(directives, 'img-src', this.config.imgSrc);
    this.addDirective(directives, 'connect-src', this.config.connectSrc);
    this.addDirective(directives, 'font-src', this.config.fontSrc);
    this.addDirective(directives, 'object-src', this.config.objectSrc);
    this.addDirective(directives, 'media-src', this.config.mediaSrc);
    this.addDirective(directives, 'manifest-src', this.config.manifestSrc);
    
    // Frame directives
    this.addDirective(directives, 'frame-src', this.config.frameSrc);
    this.addDirective(directives, 'frame-ancestors', this.config.frameAncestors);
    this.addDirective(directives, 'child-src', this.config.childSrc);
    this.addDirective(directives, 'worker-src', this.config.workerSrc);
    
    // Form and navigation
    this.addDirective(directives, 'form-action', this.config.formAction);
    this.addDirective(directives, 'base-uri', this.config.baseUri);
    
    if (this.config.navigateTo) {
      this.addDirective(directives, 'navigate-to', this.config.navigateTo);
    }
    
    // Mixed content directives
    if (this.config.upgradeInsecureRequests) {
      directives.push('upgrade-insecure-requests');
    }
    
    if (this.config.blockAllMixedContent) {
      directives.push('block-all-mixed-content');
    }
    
    // CSP Level 3 features
    if (this.config.trustedTypes?.enabled) {
      this.addTrustedTypesDirective(directives);
    }
    
    if (this.config.requireSriFor) {
      directives.push(`require-sri-for ${this.config.requireSriFor.join(' ')}`);
    }
    
    // Reporting
    if (includeReporting) {
      if (this.config.reportUri) {
        directives.push(`report-uri ${this.config.reportUri}`);
      }
      
      if (this.config.reportTo) {
        directives.push(`report-to ${this.config.reportTo}`);
      }
    }

    const header = directives.join('; ');
    const reportOnly = process.env.NODE_ENV === 'development' && this.config.development.reportOnly;

    return { header, nonce, reportOnly };
  }

  /**
   * Apply CSP headers to response
   */
  applyHeaders(
    response: NextResponse,
    request: NextRequest,
    options: {
      generateNonce?: boolean;
      includeReporting?: boolean;
      strictMode?: boolean;
    } = {}
  ): { response: NextResponse; nonce?: string } {
    const { header, nonce, reportOnly } = this.generateCSPHeader(request, options);
    
    const headerName = reportOnly 
      ? 'Content-Security-Policy-Report-Only' 
      : 'Content-Security-Policy';
    
    response.headers.set(headerName, header);
    
    // Add nonce to response headers for client access
    if (nonce) {
      response.headers.set('X-CSP-Nonce', nonce);
    }
    
    // Add additional security headers
    this.addSupplementaryHeaders(response);
    
    return { response, nonce };
  }

  /**
   * Handle CSP violation reports
   */
  handleViolationReport(report: any, request: NextRequest): void {
    try {
      const violation: CSPViolation = {
        documentUri: report['document-uri'] || '',
        referrer: report.referrer || '',
        violatedDirective: report['violated-directive'] || '',
        originalPolicy: report['original-policy'] || '',
        blockedUri: report['blocked-uri'] || '',
        statusCode: report['status-code'] || 0,
        lineNumber: report['line-number'],
        columnNumber: report['column-number'],
        sourceFile: report['source-file'],
        scriptSample: report['script-sample'],
        disposition: report.disposition || 'enforce',
        timestamp: new Date(),
        userAgent: request.headers.get('user-agent') || '',
        ipAddress: this.extractIpAddress(request),
      };

      this.violations.push(violation);
      
      // Keep only recent violations
      if (this.violations.length > 1000) {
        this.violations = this.violations.slice(-1000);
      }

      // Call violation callback if configured
      if (this.config.violationCallback) {
        this.config.violationCallback(violation);
      }

      // Log in development
      if (process.env.NODE_ENV === 'development') {
        console.warn('CSP Violation:', violation);
      }

    } catch (error) {
      console.error('Error processing CSP violation report:', error);
    }
  }

  /**
   * Add trusted script hash
   */
  addTrustedScript(script: string): string {
    const hash = this.generateHash(script);
    this.trustedScripts.add(hash);
    return hash;
  }

  /**
   * Add trusted style hash
   */
  addTrustedStyle(style: string): string {
    const hash = this.generateHash(style);
    this.trustedStyles.add(hash);
    return hash;
  }

  /**
   * Get nonce for current request
   */
  getNonce(requestId?: string): string | undefined {
    // In a real implementation, you'd use request ID to track nonces
    // For now, return the most recent nonce
    const entries = Array.from(this.nonces.entries());
    if (entries.length === 0) return undefined;
    
    return entries[entries.length - 1][1].value;
  }

  /**
   * Generate violation report
   */
  generateViolationReport(filters: {
    timeRange?: { start: Date; end: Date };
    directive?: string;
    severity?: 'low' | 'medium' | 'high';
  } = {}): {
    violations: CSPViolation[];
    summary: {
      total: number;
      byDirective: Record<string, number>;
      byBlockedUri: Record<string, number>;
      topViolations: Array<{ directive: string; count: number }>;
    };
  } {
    let filteredViolations = [...this.violations];

    // Apply filters
    if (filters.timeRange) {
      filteredViolations = filteredViolations.filter(v => 
        v.timestamp >= filters.timeRange!.start && v.timestamp <= filters.timeRange!.end
      );
    }

    if (filters.directive) {
      filteredViolations = filteredViolations.filter(v => 
        v.violatedDirective.includes(filters.directive!)
      );
    }

    // Generate summary
    const byDirective: Record<string, number> = {};
    const byBlockedUri: Record<string, number> = {};

    filteredViolations.forEach(violation => {
      byDirective[violation.violatedDirective] = (byDirective[violation.violatedDirective] || 0) + 1;
      byBlockedUri[violation.blockedUri] = (byBlockedUri[violation.blockedUri] || 0) + 1;
    });

    const topViolations = Object.entries(byDirective)
      .map(([directive, count]) => ({ directive, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      violations: filteredViolations,
      summary: {
        total: filteredViolations.length,
        byDirective,
        byBlockedUri,
        topViolations,
      },
    };
  }

  /**
   * Update CSP configuration
   */
  updateConfig(updates: Partial<CSPv3Config>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Private helper methods
   */
  private mergeWithDefaults(config: Partial<CSPv3Config>): CSPv3Config {
    const defaults: CSPv3Config = {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      manifestSrc: ["'self'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'self'"],
      childSrc: ["'self'"],
      workerSrc: ["'self'", "blob:"],
      formAction: ["'self'"],
      baseUri: ["'self'"],
      upgradeInsecureRequests: true,
      blockAllMixedContent: false,
      strictDynamic: false,
      nonce: {
        enabled: true,
        algorithm: 'sha256',
        length: 32,
      },
      development: {
        unsafeInline: false,
        unsafeEval: false,
        reportOnly: true,
      },
    };

    return { ...defaults, ...config };
  }

  private buildScriptSrc(nonce?: string, strictMode: boolean = false): string[] {
    let sources = [...this.config.scriptSrc];

    if (nonce) {
      sources.push(`'nonce-${nonce}'`);
    }

    if (this.config.strictDynamic) {
      sources.push("'strict-dynamic'");
      // With strict-dynamic, remove 'self' and 'unsafe-inline'
      sources = sources.filter(src => src !== "'self'" && src !== "'unsafe-inline'");
    }

    // Add trusted script hashes
    this.trustedScripts.forEach(hash => {
      sources.push(`'${hash}'`);
    });

    // Development allowances
    if (process.env.NODE_ENV === 'development' && !strictMode) {
      if (this.config.development.unsafeInline) {
        sources.push("'unsafe-inline'");
      }
      if (this.config.development.unsafeEval) {
        sources.push("'unsafe-eval'");
      }
    }

    return sources;
  }

  private buildStyleSrc(nonce?: string, strictMode: boolean = false): string[] {
    let sources = [...this.config.styleSrc];

    if (nonce) {
      sources.push(`'nonce-${nonce}'`);
    }

    // Add trusted style hashes
    this.trustedStyles.forEach(hash => {
      sources.push(`'${hash}'`);
    });

    // Development allowances
    if (process.env.NODE_ENV === 'development' && !strictMode) {
      if (this.config.development.unsafeInline) {
        sources.push("'unsafe-inline'");
      }
    }

    return sources;
  }

  private addDirective(directives: string[], name: string, sources: string[]): void {
    if (sources.length > 0) {
      directives.push(`${name} ${sources.join(' ')}`);
    }
  }

  private addTrustedTypesDirective(directives: string[]): void {
    if (!this.config.trustedTypes) return;

    const policies = this.config.trustedTypes.policies || ['default'];
    let directive = `trusted-types ${policies.join(' ')}`;

    if (this.config.trustedTypes.allowDuplicates) {
      directive += " 'allow-duplicates'";
    }

    directives.push(directive);
  }

  private addSupplementaryHeaders(response: NextResponse): void {
    // Add related security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  }

  private generateNonce(): string {
    return crypto.randomBytes(this.config.nonce.length).toString('base64');
  }

  private storeNonce(nonce: string): void {
    const info: NonceInfo = {
      value: nonce,
      algorithm: this.config.nonce.algorithm,
      createdAt: new Date(),
      usedFor: ['script', 'style'],
    };

    this.nonces.set(nonce, info);

    // Clean up old nonces (keep only recent ones)
    if (this.nonces.size > 100) {
      const entries = Array.from(this.nonces.entries());
      entries.slice(0, entries.length - 100).forEach(([key]) => {
        this.nonces.delete(key);
      });
    }
  }

  private generateHash(content: string): string {
    const hash = crypto.createHash(this.config.nonce.algorithm).update(content).digest('base64');
    return `${this.config.nonce.algorithm}-${hash}`;
  }

  private extractIpAddress(request: NextRequest): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
           request.headers.get('x-real-ip') ||
           request.headers.get('cf-connecting-ip') ||
           'unknown';
  }

  private setupViolationHandler(): void {
    // In a real implementation, you might set up a violation endpoint
    // This is just for demonstration
  }
}

/**
 * Create CSP middleware
 */
export function createCSPMiddleware(config: Partial<CSPv3Config> = {}) {
  const cspService = new CSPv3Service(config);

  return {
    middleware: (request: NextRequest): NextResponse | null => {
      // Handle CSP violation reports
      if (request.method === 'POST' && request.nextUrl.pathname === '/api/csp-violation') {
        return handleViolationReport(request, cspService);
      }

      return null;
    },
    
    applyHeaders: (response: NextResponse, request: NextRequest, options = {}) => {
      return cspService.applyHeaders(response, request, options);
    },
    
    service: cspService,
  };
}

/**
 * Handle CSP violation reports
 */
async function handleViolationReport(
  request: NextRequest,
  cspService: CSPv3Service
): Promise<NextResponse> {
  try {
    const report = await request.json();
    cspService.handleViolationReport(report['csp-report'] || report, request);
    
    return NextResponse.json({ status: 'received' }, { status: 200 });
  } catch (error) {
    console.error('Error handling CSP violation report:', error);
    return NextResponse.json({ error: 'Invalid report' }, { status: 400 });
  }
}

// Export default configurations
export const defaultCSPConfigs = {
  strict: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    imgSrc: ["'self'", "data:"],
    connectSrc: ["'self'"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: true,
    strictDynamic: true,
    nonce: { enabled: true, algorithm: 'sha256' as const, length: 32 },
  },
  
  moderate: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
    styleSrc: ["'self'", "https://fonts.googleapis.com"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", "https://api.openai.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: true,
    nonce: { enabled: true, algorithm: 'sha256' as const, length: 32 },
  },
  
  development: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"],
    objectSrc: ["'none'"],
    development: {
      unsafeInline: true,
      unsafeEval: true,
      reportOnly: true,
    },
  },
};