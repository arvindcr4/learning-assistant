import { NextRequest, NextResponse } from 'next/server';
import { csrfProtection } from '@/lib/csrf';
import { sanitizeUserInput } from '@/lib/validation/sanitization';

/**
 * Enhanced security middleware that addresses common vulnerabilities
 */

export interface SecurityCheckResult {
  isSecure: boolean;
  issues: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export class EnhancedSecurityMiddleware {
  /**
   * Check for suspicious patterns in request headers
   */
  static checkSuspiciousHeaders(request: NextRequest): SecurityCheckResult {
    const issues: string[] = [];
    let riskLevel: SecurityCheckResult['riskLevel'] = 'low';

    // Check User-Agent for suspicious patterns
    const userAgent = request.headers.get('user-agent') || '';
    const suspiciousUAPatterns = [
      /sqlmap/i,
      /nmap/i,
      /nikto/i,
      /burp/i,
      /owasp/i,
      /w3af/i,
      /masscan/i,
      /nessus/i,
    ];

    for (const pattern of suspiciousUAPatterns) {
      if (pattern.test(userAgent)) {
        issues.push(`Suspicious user agent detected: ${userAgent.substring(0, 50)}`);
        riskLevel = 'high';
        break;
      }
    }

    // Check for suspicious headers
    const suspiciousHeaders = [
      'x-forwarded-host',
      'x-original-url',
      'x-rewrite-url',
      'x-forwarded-proto',
    ];

    for (const header of suspiciousHeaders) {
      const value = request.headers.get(header);
      if (value) {
        // Check for host header injection
        if (header === 'x-forwarded-host' && value !== request.headers.get('host')) {
          issues.push('Potential host header injection detected');
          riskLevel = 'medium';
        }
        
        // Check for suspicious values
        if (value.includes('<') || value.includes('>') || value.includes('javascript:')) {
          issues.push(`Suspicious content in header ${header}: ${value.substring(0, 50)}`);
          riskLevel = 'high';
        }
      }
    }

    // Check Content-Length vs actual body size for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const contentLength = request.headers.get('content-length');
      if (!contentLength) {
        issues.push('Missing Content-Length header for request with body');
        riskLevel = 'medium';
      }
    }

    return {
      isSecure: issues.length === 0,
      issues,
      riskLevel,
    };
  }

  /**
   * Check for path traversal attempts
   */
  static checkPathTraversal(request: NextRequest): SecurityCheckResult {
    const issues: string[] = [];
    let riskLevel: SecurityCheckResult['riskLevel'] = 'low';

    const path = request.nextUrl.pathname;
    const query = request.nextUrl.search;

    // Path traversal patterns
    const traversalPatterns = [
      /\.\./,
      /%2e%2e/i,
      /%252e%252e/i,
      /\.\%2f/i,
      /%2e\//i,
      /\.%5c/i,
      /%2e%5c/i,
    ];

    for (const pattern of traversalPatterns) {
      if (pattern.test(path) || pattern.test(query)) {
        issues.push('Path traversal attempt detected');
        riskLevel = 'critical';
        break;
      }
    }

    // Check for encoded path separators
    if (path.includes('%2f') || path.includes('%5c')) {
      issues.push('Encoded path separators detected');
      riskLevel = 'medium';
    }

    return {
      isSecure: issues.length === 0,
      issues,
      riskLevel,
    };
  }

  /**
   * Check for injection attempts in URL parameters
   */
  static checkURLInjection(request: NextRequest): SecurityCheckResult {
    const issues: string[] = [];
    let riskLevel: SecurityCheckResult['riskLevel'] = 'low';

    const searchParams = request.nextUrl.searchParams;

    // SQL injection patterns
    const sqlPatterns = [
      /('|(\\')|(;)|(\\;))/i,
      /(union|select|insert|update|delete|drop|create|alter|exec|execute)/i,
      /(\bor\b|\band\b).*?[=<>]/i,
      /(\-\-|\/\*|\*\/)/i,
    ];

    // XSS patterns
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
    ];

    // Command injection patterns
    const cmdPatterns = [
      /(\||\&\&|\|\|)/,
      /(;|\n|\r)/,
      /(wget|curl|nc|netcat|bash|sh|cmd|powershell)/i,
    ];

    for (const [key, value] of searchParams.entries()) {
      // Check SQL injection
      for (const pattern of sqlPatterns) {
        if (pattern.test(value)) {
          issues.push(`Potential SQL injection in parameter ${key}: ${value.substring(0, 50)}`);
          riskLevel = 'critical';
          break;
        }
      }

      // Check XSS
      for (const pattern of xssPatterns) {
        if (pattern.test(value)) {
          issues.push(`Potential XSS in parameter ${key}: ${value.substring(0, 50)}`);
          riskLevel = 'high';
          break;
        }
      }

      // Check command injection
      for (const pattern of cmdPatterns) {
        if (pattern.test(value)) {
          issues.push(`Potential command injection in parameter ${key}: ${value.substring(0, 50)}`);
          riskLevel = 'critical';
          break;
        }
      }

      // Check parameter length
      if (value.length > 10000) {
        issues.push(`Oversized parameter detected: ${key} (${value.length} chars)`);
        riskLevel = 'medium';
      }
    }

    return {
      isSecure: issues.length === 0,
      issues,
      riskLevel,
    };
  }

  /**
   * Validate request body for security issues
   */
  static async validateRequestBody(request: NextRequest): Promise<SecurityCheckResult> {
    const issues: string[] = [];
    let riskLevel: SecurityCheckResult['riskLevel'] = 'low';

    // Only check POST/PUT/PATCH requests
    if (!['POST', 'PUT', 'PATCH'].includes(request.method)) {
      return { isSecure: true, issues: [], riskLevel: 'low' };
    }

    try {
      const contentType = request.headers.get('content-type') || '';
      
      // Check content type
      if (contentType.includes('application/json')) {
        const body = await request.json();
        
        // Check for excessive nesting
        const depth = this.getObjectDepth(body);
        if (depth > 10) {
          issues.push(`Excessive object nesting detected: ${depth} levels`);
          riskLevel = 'medium';
        }

        // Check for large arrays
        this.checkLargeArrays(body, issues);
        
        // Check for suspicious content in string values
        this.checkSuspiciousContent(body, issues);

      } else if (contentType.includes('multipart/form-data')) {
        // Handle file uploads
        const formData = await request.formData();
        
        for (const [key, value] of formData.entries()) {
          if (value instanceof File) {
            // Check file size
            if (value.size > 50 * 1024 * 1024) { // 50MB
              issues.push(`Large file upload detected: ${value.name} (${value.size} bytes)`);
              riskLevel = 'medium';
            }
            
            // Check file type
            const dangerousTypes = [
              'application/x-executable',
              'application/x-msdownload',
              'application/x-sh',
              'text/x-script',
            ];
            
            if (dangerousTypes.includes(value.type)) {
              issues.push(`Potentially dangerous file type: ${value.type}`);
              riskLevel = 'high';
            }
          }
        }
      }

    } catch (error) {
      // If we can't parse the body, it might be malformed
      issues.push('Malformed request body');
      riskLevel = 'medium';
    }

    return {
      isSecure: issues.length === 0,
      issues,
      riskLevel,
    };
  }

  /**
   * Comprehensive security check
   */
  static async performSecurityCheck(request: NextRequest): Promise<{
    isSecure: boolean;
    allIssues: string[];
    highestRiskLevel: SecurityCheckResult['riskLevel'];
    details: {
      headers: SecurityCheckResult;
      pathTraversal: SecurityCheckResult;
      urlInjection: SecurityCheckResult;
      requestBody: SecurityCheckResult;
    };
  }> {
    // Perform all security checks
    const headerCheck = this.checkSuspiciousHeaders(request);
    const pathCheck = this.checkPathTraversal(request);
    const urlCheck = this.checkURLInjection(request);
    const bodyCheck = await this.validateRequestBody(request);

    // Aggregate results
    const allIssues = [
      ...headerCheck.issues,
      ...pathCheck.issues,
      ...urlCheck.issues,
      ...bodyCheck.issues,
    ];

    // Determine highest risk level
    const riskLevels = [headerCheck.riskLevel, pathCheck.riskLevel, urlCheck.riskLevel, bodyCheck.riskLevel];
    const riskHierarchy = { low: 0, medium: 1, high: 2, critical: 3 };
    const highestRiskLevel = riskLevels.reduce((highest, current) => 
      riskHierarchy[current] > riskHierarchy[highest] ? current : highest
    );

    return {
      isSecure: allIssues.length === 0,
      allIssues,
      highestRiskLevel,
      details: {
        headers: headerCheck,
        pathTraversal: pathCheck,
        urlInjection: urlCheck,
        requestBody: bodyCheck,
      },
    };
  }

  /**
   * Create security response for blocked requests
   */
  static createSecurityResponse(
    issues: string[],
    riskLevel: SecurityCheckResult['riskLevel'],
    requestId: string
  ): NextResponse {
    const statusCode = riskLevel === 'critical' ? 403 : riskLevel === 'high' ? 429 : 400;
    
    const response = NextResponse.json({
      error: 'Security violation detected',
      message: 'Request blocked due to security policy',
      code: 'SECURITY_VIOLATION',
      riskLevel,
      requestId,
      timestamp: new Date().toISOString(),
      // Don't expose specific issues in production
      ...(process.env.NODE_ENV === 'development' && { issues }),
    }, { status: statusCode });

    // Add security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Cache-Control', 'no-store');

    return response;
  }

  /**
   * Helper methods
   */
  private static getObjectDepth(obj: any, depth = 0): number {
    if (depth > 20) return depth; // Prevent infinite recursion
    
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      return Math.max(depth, ...Object.values(obj).map(v => this.getObjectDepth(v, depth + 1)));
    }
    return depth;
  }

  private static checkLargeArrays(obj: any, issues: string[], path = ''): void {
    if (Array.isArray(obj)) {
      if (obj.length > 1000) {
        issues.push(`Large array detected at ${path || 'root'}: ${obj.length} items`);
      }
      obj.forEach((item, index) => {
        this.checkLargeArrays(item, issues, `${path}[${index}]`);
      });
    } else if (obj && typeof obj === 'object') {
      Object.entries(obj).forEach(([key, value]) => {
        this.checkLargeArrays(value, issues, path ? `${path}.${key}` : key);
      });
    }
  }

  private static checkSuspiciousContent(obj: any, issues: string[], path = ''): void {
    if (typeof obj === 'string') {
      const suspiciousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /(union|select|insert|update|delete|drop)/i,
        /(\-\-|\/\*|\*\/)/i,
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(obj)) {
          issues.push(`Suspicious content detected at ${path || 'root'}: ${obj.substring(0, 50)}`);
          break;
        }
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this.checkSuspiciousContent(item, issues, `${path}[${index}]`);
      });
    } else if (obj && typeof obj === 'object') {
      Object.entries(obj).forEach(([key, value]) => {
        this.checkSuspiciousContent(value, issues, path ? `${path}.${key}` : key);
      });
    }
  }
}

/**
 * Main enhanced security middleware function
 */
export async function enhancedSecurityMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // Perform comprehensive security check
    const securityCheck = await EnhancedSecurityMiddleware.performSecurityCheck(request);
    
    // Log security events
    if (!securityCheck.isSecure) {
      console.warn('Security violation detected:', {
        requestId,
        url: request.url,
        method: request.method,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent'),
        riskLevel: securityCheck.highestRiskLevel,
        issues: securityCheck.allIssues,
        timestamp: new Date().toISOString(),
      });
      
      // Block high-risk or critical requests
      if (securityCheck.highestRiskLevel === 'critical' || securityCheck.highestRiskLevel === 'high') {
        return EnhancedSecurityMiddleware.createSecurityResponse(
          securityCheck.allIssues,
          securityCheck.highestRiskLevel,
          requestId
        );
      }
    }
    
    // CSRF protection for state-changing requests
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      const csrfToken = csrfProtection.getTokenFromRequest(request);
      const needsCSRF = csrfProtection.needsCSRFProtection(request.method, request.nextUrl.pathname);
      
      if (needsCSRF && (!csrfToken || !csrfProtection.validateToken(csrfToken))) {
        console.warn('CSRF token validation failed:', {
          requestId,
          url: request.url,
          method: request.method,
          hasToken: !!csrfToken,
        });
        
        return NextResponse.json({
          error: 'CSRF token validation failed',
          code: 'CSRF_TOKEN_INVALID',
          requestId,
        }, { status: 403 });
      }
    }
    
    // All security checks passed
    return null;
    
  } catch (error) {
    console.error('Enhanced security middleware error:', error);
    
    // Fail securely - allow the request but log the error
    return null;
  }
}

export default enhancedSecurityMiddleware;